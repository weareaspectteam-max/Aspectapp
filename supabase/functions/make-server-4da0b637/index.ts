import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import { jwtVerify, decodeJwt, SignJWT } from "npm:jose@5";
import * as kv from "./kv_store.tsx";
import { companyKvFor, getCompanyId, migrateLegacyToAspect } from "./company_kv.tsx";
import { registerKareTkmRoutes } from "./kare_tkm.tsx";

// ── Şirket-bağımlı mekan helper'ı ───────────────────────────────────────────
// kv.getByPrefix("mekan_") "mekan_ziyaret_*" kayıtlarını da eşleştirir.
// Gerçek mekan objeleri `name` ve `emoji` alanına sahiptir; ziyaret kayıtları sahip değildir.
// getMekanlarFor: multi-tenant (companyId prefix'li)
// getMekanlar: legacy alias — aspect-only context'ler için (Telegram webhook vb.)
// ── Retry helper — Deno Edge'de loopback HTTP bağlantıları ara sıra "connection reset"
// hatasıyla kesilir. Bu wrapper, geçici ağ hatalarında üstel geri-çekilmeyle yeniden dener.
async function retryOp<T>(
  op: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 300,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      const msg = String(err);
      const isTransient =
        msg.includes("connection reset") ||
        msg.includes("Connection reset") ||
        msg.includes("connection error") ||
        msg.includes("SendRequest") ||
        msg.includes("broken pipe") ||
        msg.includes("ECONNRESET");
      if (!isTransient || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`[retryOp] Geçici hata (deneme ${attempt}/${maxAttempts}), ${delay}ms bekliyor: ${msg}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

const getMekanlarFor = async (companyId: string): Promise<any[]> => {
  const ckv = companyKvFor(companyId);
  const all: any[] = await retryOp(() => ckv.getByPrefix("mekan_"), 3, 300) || [];
  return all.filter((m: any) => m && m.name && m.emoji);
};
const getMekanlar = (): Promise<any[]> => getMekanlarFor("aspect");

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
// X-Access-Token: kullanıcının ES256 JWT'si (gateway doğrulamasını bypass eder, sunucu doğrular)
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Access-Token", "X-Supplier-Company"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper: admin supabase client
const getAdminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

// Helper: PostgreSQL dual-write (fire-and-forget, hata loglanır)
const pgWrite = async (table: string, action: "upsert" | "insert" | "update" | "delete", data: any, match?: Record<string, any>) => {
  try {
    const db = getAdminClient();
    if (action === "insert") {
      const { error } = await db.from(table).insert(data);
      if (error) console.log(`[pg] ${table} insert HATA: ${error.message}`);
    } else if (action === "upsert") {
      const { error } = await db.from(table).upsert(data, { onConflict: "id" });
      if (error) console.log(`[pg] ${table} upsert HATA: ${error.message}`);
    } else if (action === "update" && match) {
      let q = db.from(table).update(data);
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      const { error } = await q;
      if (error) console.log(`[pg] ${table} update HATA: ${error.message}`);
    } else if (action === "delete" && match) {
      let q = db.from(table).delete();
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      const { error } = await q;
      if (error) console.log(`[pg] ${table} delete HATA: ${error.message}`);
    }
  } catch (err) {
    console.log(`[pg] ${table} ${action} exception: ${err}`);
  }
};

// ── Supabase Storage: ekipman fotoğrafları bucket ──────────────────────────
const EQUIPMENT_BUCKET = "make-4da0b637-equipment-photos";
let bucketReady = false;
async function ensureEquipmentBucket() {
  if (bucketReady) return;
  try {
    const sb = getAdminClient();
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.name === EQUIPMENT_BUCKET);
    if (!exists) {
      await sb.storage.createBucket(EQUIPMENT_BUCKET, { public: false });
      console.log("Bucket oluşturuldu:", EQUIPMENT_BUCKET);
    }
    bucketReady = true;
  } catch (e) {
    console.log("ensureEquipmentBucket error:", e);
  }
}

// Helper: verify caller and return user
// Doğrulama sırası:
// 1. Yerel JWT — SUPABASE_JWT_SECRET varsa imzalı doğrulama (ağ yok, hızlı)
// 2. decodeJwt fallback — JWT secret yoksa veya imzalama başarısızsa imzasız payload + exp grace 10 dk
// NOT: supabase.auth.getUser() network çağrısı Deno edge runtime'da
// "Connection reset by peer" hatasını try/catch'i delerek fırlattığı için kaldırıldı.
const verifyToken = async (c: any) => {
  const xToken = c.req.header("X-Access-Token");

  if (!xToken) {
    console.log("[verifyToken] X-Access-Token header eksik — 401");
    return null;
  }

  // ── Payload'dan user nesnesi oluşturan helper ──
  const buildUser = (p: any) => {
    const rawMeta = p.user_metadata ?? {};
    const rawRole = rawMeta.role ?? "";
    // superadmin → yonetici seviyesinde tüm yetki kontrollerini geçer.
    // Orijinal rol originalRole'de saklanır; superadmin endpoint'leri bunu kontrol eder.
    const effectiveRole = rawRole === "superadmin" ? "yonetici" : rawRole;
    return {
      id: p.sub,
      email: p.email ?? "",
      role: p.role ?? "",
      user_metadata: { ...rawMeta, role: effectiveRole, originalRole: rawRole },
      app_metadata: p.app_metadata ?? {},
      created_at: p.iat ? new Date(p.iat * 1000).toISOString() : "",
      last_sign_in_at: "",
    };
  };

  // ── decodeJwt fallback helper: imzasız + exp kontrollü ──
  const tryDecodeJwtFallback = (): ReturnType<typeof buildUser> | null => {
    try {
      const payload = decodeJwt(xToken) as any;
      if (!payload?.sub) return null;
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp ?? 0;
      const graceSec = 600; // 10 dakika grace period
      if (exp > 0 && now - exp > graceSec) {
        console.log(`[verifyToken] decodeJwt: token ${now - exp}s önce sona erdi (grace=${graceSec}s) → 401`);
        return null;
      }
      console.log("[verifyToken] ⚠️ decodeJwt fallback — JWT secret yok/başarısız, imzasız kabul edildi");
      return buildUser(payload);
    } catch (e) {
      console.log("[verifyToken] decodeJwt başarısız:", String(e).slice(0, 80));
      return null;
    }
  };

  // ── 1. Yerel JWT doğrulaması — clockTolerance:300 ──
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");
  let prelimUser: ReturnType<typeof buildUser> | null = null;
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(xToken, secret, { clockTolerance: 300 });
      if (payload?.sub) prelimUser = buildUser(payload);
    } catch (jwtErr) {
      console.log("[verifyToken] yerel JWT başarısız:", String(jwtErr).slice(0, 100));
    }
  } else {
    console.log("[verifyToken] SUPABASE_JWT_SECRET yok → decodeJwt fallback");
  }

  if (!prelimUser) {
    // ── 2. decodeJwt fallback — network çağrısı yok, connection reset riski sıfır ──
    prelimUser = tryDecodeJwtFallback();
  }

  if (!prelimUser) return null;

  // ── 3. Stale JWT tespiti: JWT rolü bekleyen/boş ise Supabase admin'den canlı rol al ──
  // Bu, kullanıcının rolü değiştirildikten sonra yeni JWT almadan yaptığı istekleri kapsar.
  const jwtRole = prelimUser.user_metadata?.role ?? "";
  if (jwtRole === "bekleyen" || jwtRole === "") {
    try {
      const supabaseAdmin = getAdminClient();
      const { data: { user: liveUser }, error: liveErr } = await supabaseAdmin.auth.admin.getUserById(prelimUser.id);
      if (!liveErr && liveUser?.user_metadata?.role) {
        const rawRole = liveUser.user_metadata.role as string;
        const effectiveRole = rawRole === "superadmin" ? "yonetici" : rawRole;
        console.log(`[verifyToken] stale JWT düzeltmesi: ${prelimUser.email} ${jwtRole} → ${rawRole}`);
        prelimUser = {
          ...prelimUser,
          user_metadata: { ...liveUser.user_metadata, role: effectiveRole, originalRole: rawRole },
        };
      }
    } catch (liveErr) {
      // Admin API başarısız — JWT rolüyle devam et
      console.log("[verifyToken] canlı rol kontrolü başarısız:", String(liveErr).slice(0, 80));
    }
  }

  return prelimUser;
};

// ── Yetki yardımcısı: superadmin her zaman geçer ──────────────────────────
// Kullanım: if (!hasPermission(callerRole, ["yonetici", "mudur"])) return 403
const hasPermission = (callerRole: string, allowedRoles: string[]): boolean =>
  callerRole === "superadmin" || allowedRoles.includes(callerRole);

// ── Efektif rol: superadmin → yonetici gibi davranır, tüm yetki listelerini geçer ──
// Superadmin-özel endpoint'ler user.user_metadata?.role doğrudan okur, bu etkilenmez.
const getEffectiveRole = (user: any): string => {
  const role = user?.user_metadata?.role ?? "";
  return role === "superadmin" ? "yonetici" : role;
};

// ──────────────────────────────────────────
// BİLDİRİM HELPER: Kullanıcıya bildirim oluştur (non-blocking)
// companyId parametresi eklendi — multi-tenant KV prefix desteği
// ──────────────────────────────────────────
const createNotification = async (
  userId: string,
  type: string,
  title: string,
  body: string,
  meta?: any,
  companyId: string = "aspect"
): Promise<void> => {
  try {
    if (!userId) return;
    const ts   = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const key  = `notif_${userId}_${ts}_${rand}`;
    const ckv  = companyKvFor(companyId);
    const notifData = {
      id: key,
      userId,
      type,
      title,
      body,
      read: false,
      created_at: new Date().toISOString(),
      meta: meta || {},
    };
    await ckv.set(key, notifData);
    pgWrite("notifications", "insert", {
      id: key, company_id: companyId, user_id: userId, type, title,
      message: body, data: meta || {}, read: false,
    });
  } catch (e) {
    console.log("createNotification error:", e);
  }
};

// ──────────────────────────────────────────
// TELEGRAM HELPER: Şirkete özel config oku (KV → env fallback)
// ──────────────────────────────────────────
const getTelegramConfig = async (companyId: string = "aspect"): Promise<{ token: string; chatId: string } | null> => {
  try {
    const ckv = companyKvFor(companyId);
    const cfg: any = await ckv.get("company_telegram_config");
    if (cfg?.token && cfg?.chatId) {
      return { token: cfg.token, chatId: cfg.chatId };
    }
  } catch (e) {
    console.log(`[Telegram] KV config okunamadı (${companyId}):`, e);
  }
  // Fallback: env vars (geriye dönük uyumluluk)
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_GROUP_CHAT_ID");
  if (token && chatId) return { token, chatId };
  return null;
};

// ──────────────────────────────────────────
// TELEGRAM HELPER: Gruba mesaj gönder (non-blocking)
// ──────────────────────────────────────────
const sendTelegramMessage = async (text: string, parseMode: string = "HTML", companyId: string = "aspect"): Promise<void> => {
  try {
    const cfg = await getTelegramConfig(companyId);
    if (!cfg) {
      console.log(`[Telegram] Config eksik (${companyId}) — bildirim atlandı.`);
      return;
    }
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: parseMode,
      }),
    });
    const result = await res.json();
    if (!result.ok) {
      console.log("[Telegram] Mesaj gönderilemedi:", JSON.stringify(result));
    } else {
      console.log("[Telegram] Mesaj gönderildi:", result.result?.message_id);
    }
  } catch (e) {
    console.log("[Telegram] sendTelegramMessage error:", e);
  }
};

// ──────────────────────────────────────────
// TELEGRAM HELPER: Fotoğraf gönder (base64 → multipart)
// ──────────────────────────────────────────
const sendTelegramPhoto = async (base64Data: string, caption: string, companyId: string = "aspect"): Promise<void> => {
  try {
    const cfg = await getTelegramConfig(companyId);
    if (!cfg) {
      console.log(`[Telegram] Config eksik (${companyId}) — fotoğraf atlandı.`);
      return;
    }
    // base64 → Uint8Array
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const binaryStr = atob(base64Clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const form = new FormData();
    form.append("chat_id", cfg.chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([bytes], { type: "image/jpeg" }), "vardiya.jpg");

    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    const result = await res.json();
    if (!result.ok) {
      console.log("[Telegram] Fotoğraf gönderilemedi:", JSON.stringify(result));
    } else {
      console.log("[Telegram] Fotoğraf gönderildi:", result.result?.message_id);
    }
  } catch (e) {
    console.log("[Telegram] sendTelegramPhoto error:", e);
  }
};

// ──────────────────────────────────────────
// TELEGRAM HELPER: Inline keyboard ile mesaj gönder
// ──────────────────────────────────────────
const sendTelegramWithInlineKeyboard = async (
  text: string,
  inlineKeyboard: Array<Array<{ text: string; callback_data: string }>>,
  parseMode: string = "HTML",
  companyId: string = "aspect"
): Promise<number | null> => {
  try {
    const cfg = await getTelegramConfig(companyId);
    if (!cfg) {
      console.log(`[Telegram] Config eksik (${companyId}) — inline mesaj atlandı.`);
      return null;
    }
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: parseMode,
        reply_markup: { inline_keyboard: inlineKeyboard },
      }),
    });
    const result = await res.json();
    if (!result.ok) {
      console.log("[Telegram] Inline keyboard mesaj gönderilemedi:", JSON.stringify(result));
      return null;
    }
    console.log("[Telegram] Inline keyboard mesaj gönderildi:", result.result?.message_id);
    return result.result?.message_id ?? null;
  } catch (e) {
    console.log("[Telegram] sendTelegramWithInlineKeyboard error:", e);
    return null;
  }
};

// ──────────────────────────────────────────
// İŞ GÜNÜ TARİHİ HELPER (Business Date)
// Vardiyalar gece geçer; iş günü TR saatiyle 05:00'da başlar.
// TR 00:00–04:59 → hâlâ önceki takvim günü sayılır.
// Tüm endpointler "today" için bu fonksiyonu kullanmalıdır.
// ──────────────────────────────────────────
const bizDateTR = (): string => {
  const trMs   = Date.now() + 3 * 60 * 60 * 1000; // UTC+3
  const trHour = new Date(trMs).getUTCHours();
  if (trHour < 7) {
    // 00:00-06:59 TR → önceki iş günü
    return new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }
  return new Date(trMs).toISOString().split("T")[0];
};

// ──────────────────────────────────────────
// Health check
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/health", (c) => {
  return c.json({ status: "ok" });
});

// ──────────────────────────────────────────
// OTOMATİK GÜNLÜK GİDER: Maaş + Düzenli giderler → isletme_gider_ (lazy, idempotent)
// Her gün ilk çağrıldığında eksik günlerin giderlerini otomatik oluşturur.
// ──────────────────────────────────────────
const ensureOtomatikGiderler = async (companyId: string): Promise<void> => {
  try {
    const ckv = companyKvFor(companyId);
    const today = bizDateTR();

    // Son kontrol tarihini oku — aynı gün tekrar çalışmasın
    const lastCheck: string | null = await ckv.get("otomatik_gider_son_kontrol");
    // Backfill kontrolü: eğer yıl başından bu yana eksik gün varsa tekrar çalıştır
    const yilBasiCheck = `${today.slice(0, 4)}-01-01`;
    const isFullyBackfilled = lastCheck === today && await ckv.get("otomatik_gider_backfill_done_" + today.slice(0, 4));
    if (isFullyBackfilled) return;

    // Maaşlar ve düzenli giderler
    const [maaslar, duzenliler, tumGiderler] = await Promise.all([
      ckv.getByPrefix("cost_salary_").catch(() => []),
      ckv.getByPrefix("cost_recurring_").catch(() => []),
      ckv.getByPrefix("isletme_gider_").catch(() => []),
    ]);

    if ((!maaslar || maaslar.length === 0) && (!duzenliler || duzenliler.length === 0)) {
      await ckv.set("otomatik_gider_son_kontrol", today);
      return;
    }

    // Döviz kurları
    const exRates: any = await ckv.get("cost_exchange_rates").catch(() => null) || { EUR: 38, USD: 33, GBP: 41.20, BGN: 19.50, RUB: 0.38, SAR: 8.80 };
    const toTL = (v: number, cur: string) =>
      cur === "EUR" ? v * (Number(exRates.EUR) || 38) :
      cur === "USD" ? v * (Number(exRates.USD) || 33) :
      cur === "GBP" ? v * (Number(exRates.GBP) || 41.2) : v;

    // Mevcut otomatik giderlerin tarihlerini topla (tekrar oluşturmamak için)
    const mevcutOtomatikTarihler = new Set<string>();
    for (const g of (tumGiderler || [])) {
      if (g.otomatik && g.otomatikKey) mevcutOtomatikTarihler.add(g.otomatikKey);
    }

    // Son kontrol tarihinden bugüne eksik günleri bul
    // İlk çalışmada: yıl başından itibaren tüm günleri ekle
    const yilBasi = `${today.slice(0, 4)}-01-01`;
    const baslangic = lastCheck && lastCheck >= yilBasi ? lastCheck : yilBasi;
    const baslangicDate = new Date(baslangic + "T00:00:00Z");
    const todayDate = new Date(today + "T00:00:00Z");

    const gunler: string[] = [];
    const d = new Date(baslangicDate);
    while (d <= todayDate) {
      gunler.push(d.toISOString().split("T")[0]);
      d.setUTCDate(d.getUTCDate() + 1);
    }

    let eklenen = 0;
    for (const gun of gunler) {
      // O günün ait olduğu ayın gün sayısı (Şubat=28/29, Mart=31, vs.)
      const gunDate = new Date(gun + "T00:00:00Z");
      const ayGunSayisi = new Date(Date.UTC(gunDate.getUTCFullYear(), gunDate.getUTCMonth() + 1, 0)).getUTCDate();

      // Her maaş için günlük kayıt
      for (const m of (maaslar || [])) {
        const otomatikKey = `maas_${m.id || m.name}_${gun}`;
        if (mevcutOtomatikTarihler.has(otomatikKey)) continue;

        const amt = toTL(Number(m.amount) || 0, m.currency || "TRY");
        const extra = amt * ((Number(m.extraCostPercentage) || 0) / 100);
        const total = amt + extra;
        const aylik = m.frequency === "daily" ? total * ayGunSayisi : m.frequency === "weekly" ? total * 4.33 : m.frequency === "yearly" ? total / 12 : total;
        const gunluk = Math.round((aylik / ayGunSayisi) * 100) / 100;
        if (gunluk <= 0) continue;

        const giderId = `oto_maas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await ckv.set(`isletme_gider_${giderId}`, {
          id: giderId,
          category: "personel",
          odemeTipi: "maas",
          amount: gunluk,
          currency: "TRY",
          description: `🔄 Otomatik Maaş — ${m.name || "Personel"} (${gun})`,
          date: gun,
          personelAdi: m.name || "",
          personelId: m.userId || "",
          otomatik: true,
          otomatikKey,
          created_at: new Date().toISOString(),
          created_by: "sistem",
        });
        eklenen++;
      }

      // Her düzenli gider için günlük kayıt
      for (const r of (duzenliler || [])) {
        const otomatikKey = `duzenli_${r.id || r.name}_${gun}`;
        if (mevcutOtomatikTarihler.has(otomatikKey)) continue;

        const amt = toTL(Number(r.amount) || 0, r.currency || "TRY");
        const aylik = r.frequency === "daily" ? amt * ayGunSayisi : r.frequency === "weekly" ? amt * 4.33 : r.frequency === "yearly" ? amt / 12 : amt;
        const gunluk = Math.round((aylik / ayGunSayisi) * 100) / 100;
        if (gunluk <= 0) continue;

        const giderId = `oto_duzenli_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await ckv.set(`isletme_gider_${giderId}`, {
          id: giderId,
          category: "operasyonel",
          amount: gunluk,
          currency: "TRY",
          description: `🔄 Otomatik Gider — ${r.name || "Düzenli Gider"} (${gun})`,
          date: gun,
          personelAdi: r.name || "Düzenli Gider",
          otomatik: true,
          otomatikKey,
          created_at: new Date().toISOString(),
          created_by: "sistem",
        });
        eklenen++;
      }
    }

    await ckv.set("otomatik_gider_son_kontrol", today);
    await ckv.set("otomatik_gider_backfill_done_" + today.slice(0, 4), true);
    if (eklenen > 0) console.log(`[OtomatikGider] ${companyId}: ${eklenen} gider kaydı oluşturuldu (${gunler.length} gün, backfill: ${yilBasiCheck}→${today})`);
  } catch (e) {
    console.log("[OtomatikGider] Hata:", e);
  }
};

// ──────────────────────────────────────────
// MIGRATION: Legacy aspect verisi → aspect: prefix'i altına kopyala
// POST /make-server-4da0b637/admin/migrate-legacy
// Sadece yönetici çağırabilir. İdempotent (iki kez çalıştırılabilir).
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/admin/migrate-legacy", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole      = callerUser.user_metadata?.role;
    const callerCompanyId = getCompanyId(callerUser);

    if (callerRole !== "yonetici" || callerCompanyId !== "aspect") {
      return c.json({ error: "Bu işlem yalnızca Aspect yöneticisi tarafından yapılabilir." }, 403);
    }

    console.log("[migrate-legacy] Migration başladı...");

    // Migrate edilecek KV prefix'leri (tüm şirket verileri)
    const PREFIXES_TO_MIGRATE = [
      "mekan_",
      "vardiya_",
      "satis_",
      "stok_",
      "kota_",
      "kidem_",
      "kidem_personel_",
      "notif_",
      "cost_",
      "odeme_",
      "business_",
      "equipment_",
      "iptal_talep_",
      "isletme_gider_",
      "ziyaret_",
      "gorusme_",
      "mudur_rapor_",
      "rotasyon_",
      "izin_",
      "aktarim_",
      "anomali_",
      "duyuru_",
      "mesaj_",
      "dm_",
      "kanal_",
      "prim_",
      "leaderboard_",
      "game_",
      "gecikme_",
      "kare_",
    ];

    const result = await migrateLegacyToAspect(PREFIXES_TO_MIGRATE);
    console.log("[migrate-legacy] Tamamlandı:", result);

    return c.json({
      success: true,
      message: `Migration tamamlandı. ${result.migrated} kayıt kopyalandı, ${result.skipped} atlandı (zaten var).`,
      ...result,
    });
  } catch (err) {
    console.log("[migrate-legacy] Error:", err);
    return c.json({ error: `Migration hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// SUPERADMIN — Şirket Yönetimi (Multi-Tenant)
// Sadece role === 'superadmin' erişebilir.
// Şirket profilleri global KV'de company_profile_{id} anahtarıyla tutulur.
// ═══��══════════════════════════════════════════════════════════════

/** Tüm şirket profillerini getir (başlangıç 3 şirketi dahil) */
const seedInitialCompanies = async () => {
  const defaults = [
    { id: "aspect", name: "Aspect Agency",  emoji: "✦", color: "#a855f7", description: "Turistik fotoğrafçılık operasyon merkezi", status: "active" },
    { id: "frame",  name: "Frame Studios",  emoji: "🖼", color: "#9dd9ea", description: "Frame fotoğraf stüdyoları",               status: "active" },
    { id: "tetra",  name: "Tetra Works",    emoji: "🔷", color: "#34d399", description: "Tetra operasyon birimi",                   status: "active" },
  ];
  for (const c of defaults) {
    // Tombstone varsa bu şirket kasıtlı silindi — yeniden oluşturma
    const tombstone = await kv.get(`company_tombstone_${c.id}`);
    if (tombstone) {
      console.log(`[seed] ${c.id} tombstone var, atlanıyor.`);
      continue;
    }
    const existing = await kv.get(`company_profile_${c.id}`);
    if (!existing) {
      await kv.set(`company_profile_${c.id}`, { ...c, createdAt: new Date().toISOString(), createdBy: "system" });
    } else {
      // Her zaman status ve temel alanları güncelle — kayıt var ama eksik olabilir
      await kv.set(`company_profile_${c.id}`, { ...c, ...existing, status: existing.status ?? "active", id: c.id });
    }
  }
};
// Sunucu başlangıcında seed'le (non-blocking)
seedInitialCompanies().catch(e => console.log("[seed] company profiles error:", e));

// ── Aspect için Telegram config seed: env → KV (idempotent) ──────────────────
const seedAspectTelegramConfig = async () => {
  try {
    const envToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const envChatId = Deno.env.get("TELEGRAM_GROUP_CHAT_ID");
    if (!envToken || !envChatId) return; // env yoksa seed etme
    const ckv = companyKvFor("aspect");
    const existing = await ckv.get("company_telegram_config");
    if (!existing) {
      await ckv.set("company_telegram_config", { token: envToken, chatId: envChatId });
      console.log("[seed] Aspect Telegram config env'den KV'ye yazıldı.");
    } else {
      console.log("[seed] Aspect Telegram config zaten KV'de mevcut.");
    }
  } catch (e) {
    console.log("[seed] Aspect Telegram config seed hatası:", e);
  }
};
seedAspectTelegramConfig().catch(e => console.log("[seed] telegram config error:", e));

/** ozgur.demirbas@yandex.com kullanıcısını superadmin yap — on-demand endpoint üzerinden tetiklenir */
const doBootstrapSuperAdmin = async (): Promise<{ ok: boolean; message: string }> => {
  const TARGET_EMAIL = "ozgur.demirbas@yandex.com";
  const supabase = getAdminClient();
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers hatası: ${error.message}`);
  const target = (users || []).find((u: any) => u.email === TARGET_EMAIL);
  if (!target) return { ok: false, message: `${TARGET_EMAIL} henüz kayıtlı değil.` };
  if (target.user_metadata?.role === "superadmin") return { ok: true, message: `${TARGET_EMAIL} zaten superadmin.` };
  const { error: updateErr } = await supabase.auth.admin.updateUserById(target.id, {
    user_metadata: {
      ...target.user_metadata,
      role: "superadmin",
      company_id: target.user_metadata?.company_id || "aspect",
      full_name: target.user_metadata?.full_name || "Özgür Demirbaş",
    },
  });
  if (updateErr) throw new Error(`updateUserById hatası: ${updateErr.message}`);
  return { ok: true, message: `✅ ${TARGET_EMAIL} → superadmin yapıldı!` };
};

// POST /auth/bootstrap-superadmin — isteğe bağlı tetiklenebilir (login sonrası frontend çağırır)
app.post("/make-server-4da0b637/auth/bootstrap-superadmin", async (c) => {
  try {
    const result = await doBootstrapSuperAdmin();
    console.log("[bootstrap-sa]", result.message);
    return c.json(result);
  } catch (e) {
    console.log("[bootstrap-sa] hata:", e);
    return c.json({ ok: false, message: String(e) }, 500);
  }
});

// GET /superadmin/companies — tüm şirketleri listele
app.get("/make-server-4da0b637/superadmin/companies", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const companies: any[] = await kv.getByPrefix("company_profile_") || [];
    // Her şirket için kullanıcı sayısını da getir
    const supabase = getAdminClient();
    const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const countByCompany: Record<string, number> = {};
    for (const u of allUsers || []) {
      const cid = u.user_metadata?.company_id || "aspect";
      countByCompany[cid] = (countByCompany[cid] || 0) + 1;
    }
    const result = companies.map((c: any) => ({
      ...c,
      userCount: countByCompany[c.id] || 0,
    })).sort((a: any, b: any) => a.id.localeCompare(b.id));

    return c.json({ companies: result });
  } catch (err) {
    console.log("[superadmin/companies GET] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /superadmin/companies — yeni şirket oluştur
app.post("/make-server-4da0b637/superadmin/companies", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const body = await c.req.json();
    const { id, name, emoji, color, description } = body;

    if (!id || !name) return c.json({ error: "id ve name zorunludur." }, 400);
    const companyId = id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!companyId) return c.json({ error: "Geçersiz company ID. Sadece küçük harf, rakam, - ve _ kullanabilirsiniz." }, 400);
    if (companyId.length < 2 || companyId.length > 20) return c.json({ error: "Company ID 2-20 karakter arası olmalıdır." }, 400);

    const existing = await kv.get(`company_profile_${companyId}`);
    if (existing) return c.json({ error: `'${companyId}' ID'li şirket zaten mevcut.` }, 409);

    const profile = {
      id: companyId,
      name: name.trim(),
      emoji: emoji || "🏢",
      color: color || "#a855f7",
      description: description?.trim() || "",
      status: "active",
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };
    await kv.set(`company_profile_${companyId}`, profile);
    console.log(`[superadmin] Yeni şirket oluşturuldu: ${companyId} — ${name}`);
    return c.json({ success: true, company: profile });
  } catch (err) {
    console.log("[superadmin/companies POST] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// PUT /superadmin/companies/:id — şirket profili güncelle
app.put("/make-server-4da0b637/superadmin/companies/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const companyId = c.req.param("id").toLowerCase();
    const existing = await kv.get(`company_profile_${companyId}`);
    if (!existing) return c.json({ error: "Şirket bulunamadı." }, 404);

    const body = await c.req.json();
    const updated = {
      ...existing,
      name:        body.name        ?? existing.name,
      emoji:       body.emoji       ?? existing.emoji,
      color:       body.color       ?? existing.color,
      description: body.description ?? existing.description,
      status:      body.status      ?? existing.status,
      updatedAt:   new Date().toISOString(),
      updatedBy:   user.id,
    };
    await kv.set(`company_profile_${companyId}`, updated);
    return c.json({ success: true, company: updated });
  } catch (err) {
    console.log("[superadmin/companies PUT] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /superadmin/companies/:id/create-admin — şirket için kullanıcı oluştur
app.post("/make-server-4da0b637/superadmin/companies/:id/create-admin", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const companyId = c.req.param("id").toLowerCase();
    const profile = await kv.get(`company_profile_${companyId}`);
    if (!profile) return c.json({ error: "Şirket bulunamadı." }, 404);

    const { email, password, full_name, phone, role: reqRole } = await c.req.json();
    if (!email || !password || !full_name)
      return c.json({ error: "email, password ve full_name zorunludur." }, 400);

    const allowedRoles = ["yonetici", "ust-mudur", "mudur", "operasyon", "idari", "personel"];
    const assignedRole = allowedRoles.includes(reqRole) ? reqRole : "yonetici";

    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      user_metadata: {
        full_name: full_name.trim(),
        role: assignedRole,
        phone: phone?.trim() || "",
        company_id: companyId,
      },
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes("already registered"))
        return c.json({ error: "Bu e-posta zaten kayıtlı." }, 400);
      return c.json({ error: `Kullanıcı oluşturma hatası: ${error.message}` }, 400);
    }

    console.log(`[superadmin] ${companyId} şirketi için kullanıcı oluşturuldu: ${data.user?.email} (${assignedRole})`);
    return c.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        full_name: data.user?.user_metadata?.full_name,
        role: data.user?.user_metadata?.role,
        company_id: companyId,
      },
    });
  } catch (err) {
    console.log("[superadmin/create-admin] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// GET /superadmin/companies/:id/users — şirketteki kullanıcıları listele
app.get("/make-server-4da0b637/superadmin/companies/:id/users", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const companyId = c.req.param("id").toLowerCase();
    const supabase = getAdminClient();
    const { data: { users: allUsers }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) return c.json({ error: `Kullanıcı listesi alınamadı: ${error.message}` }, 500);

    const filtered = (allUsers || [])
      .filter((u: any) => (u.user_metadata?.company_id || "aspect") === companyId)
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || "",
        role: u.user_metadata?.role || "bekleyen",
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
      }));

    return c.json({ users: filtered, total: filtered.length });
  } catch (err) {
    console.log("[superadmin/company-users] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── PUBLIC: Şirket kodu doğrulama (kayıt formu için, token gerekmez) ──
app.get("/make-server-4da0b637/public/validate-company/:code", async (c) => {
  try {
    const code = c.req.param("code").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!code || code.length < 2) return c.json({ valid: false, reason: "too_short" });

    // Tombstone varsa şirket silindi
    const tombstone = await kv.get(`company_tombstone_${code}`);
    if (tombstone) return c.json({ valid: false, reason: "not_found" });

    const profile = await kv.get(`company_profile_${code}`);
    if (!profile) return c.json({ valid: false, reason: "not_found" });
    if (profile.status === "suspended") return c.json({ valid: false, reason: "suspended", name: profile.name });

    return c.json({
      valid: true,
      company: { id: profile.id, name: profile.name, emoji: profile.emoji, color: profile.color },
    });
  } catch (err) {
    console.log("[public/validate-company] error:", err);
    return c.json({ valid: false, reason: "error" }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// BAŞVURU SİSTEMİ (Applications) — v2 approve/reject/delete aktif
// ══════════════════════════════════════════════════════════════════

// POST /superadmin/applications — PUBLIC, başvuruyu KV'ye kaydet (auth gerekmez)
app.post("/make-server-4da0b637/superadmin/applications", async (c) => {
  try {
    const body = await c.req.json();
    const { companyName, companyCode, description, contactEmail, contactPhone,
            adminName, adminEmail, adminPhone, adminPassword } = body;

    if (!companyName?.trim()) return c.json({ error: "Şirket adı zorunludur." }, 400);
    if (!companyCode?.trim()) return c.json({ error: "Şirket kodu zorunludur." }, 400);
    if (!contactEmail?.trim()) return c.json({ error: "İletişim e-postası zorunludur." }, 400);
    if (!adminName?.trim()) return c.json({ error: "Yönetici adı zorunludur." }, 400);
    if (!adminEmail?.trim()) return c.json({ error: "Yönetici e-postası zorunludur." }, 400);
    if (!adminPassword || adminPassword.length < 6) return c.json({ error: "Yönetici şifresi en az 6 karakter olmalıdır." }, 400);

    const code = companyCode.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (code.length < 3) return c.json({ error: "Şirket kodu en az 3 karakter olmalıdır." }, 400);

    const existing = await kv.get(`company_profile_${code}`);
    if (existing) return c.json({ error: `'${code}' kodu ile zaten bir şirket mevcut.` }, 409);

    const id = crypto.randomUUID();
    const application = {
      id,
      companyName: companyName.trim(),
      companyCode: code,
      description: description?.trim() || "",
      contactEmail: contactEmail.toLowerCase().trim(),
      contactPhone: contactPhone?.trim() || "",
      adminName: adminName.trim(),
      adminEmail: adminEmail.toLowerCase().trim(),
      adminPhone: adminPhone?.trim() || "",
      adminPassword, // geçici; onayda Supabase Auth'a aktarılır, sonra temizlenir
      submittedAt: new Date().toISOString(),
      status: "pending",
    };

    await kv.set(`application_${id}`, application);
    console.log(`[applications] Yeni başvuru: ${code} — ${companyName}`);
    return c.json({ success: true, id, message: "Başvurunuz alındı. Superadmin onayı bekleniyor." });
  } catch (err) {
    console.log("[applications POST] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// GET /superadmin/applications — superadmin: tüm başvuruları listele
app.get("/make-server-4da0b637/superadmin/applications", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const all: any[] = await kv.getByPrefix("application_") || [];
    const sorted = all
      .filter((a: any) => a && a.id)
      .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    // Şifreyi asla döndürme
    const safe = sorted.map(({ adminPassword: _pw, ...rest }: any) => rest);
    return c.json({ applications: safe });
  } catch (err) {
    console.log("[applications GET] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /superadmin/applications/:id/approve — Onayla: şirket + yönetici oluştur
app.post("/make-server-4da0b637/superadmin/applications/:id/approve", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const appId = c.req.param("id");
    const application: any = await kv.get(`application_${appId}`);
    if (!application) return c.json({ error: "Başvuru bulunamadı." }, 404);
    if (application.status !== "pending") return c.json({ error: "Bu başvuru zaten işlenmiş." }, 400);

    const { companyName, companyCode, description,
            adminName, adminEmail, adminPhone, adminPassword } = application;

    // 1. Şirket profili oluştur
    const existingCompany = await kv.get(`company_profile_${companyCode}`);
    if (existingCompany) return c.json({ error: `'${companyCode}' kodu ile şirket zaten mevcut.` }, 409);

    const profile = {
      id: companyCode,
      name: companyName,
      emoji: "🏢",
      color: "#a855f7",
      description: description || `${companyName} şirketi`,
      status: "active",
      createdAt: new Date().toISOString(),
      createdBy: "application",
      applicationId: appId,
    };
    await kv.set(`company_profile_${companyCode}`, profile);

    // 2. Yönetici hesabını Supabase Auth'ta oluştur
    const supabase = getAdminClient();
    const { data, error: createErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      user_metadata: {
        full_name: adminName,
        role: "yonetici",
        phone: adminPhone || "",
        company_id: companyCode,
      },
      email_confirm: true,
    });

    if (createErr) {
      await kv.del(`company_profile_${companyCode}`).catch(() => {});
      if (createErr.message.includes("already registered"))
        return c.json({ error: `Yönetici e-postası (${adminEmail}) zaten kayıtlı.` }, 400);
      return c.json({ error: `Kullanıcı oluşturulamadı: ${createErr.message}` }, 400);
    }

    // 3. Başvuruyu güncelle (şifreyi temizle)
    await kv.set(`application_${appId}`, {
      ...application,
      adminPassword: undefined,
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvedBy: user.email,
      createdUserId: data.user?.id,
    });

    console.log(`[applications] ✅ Onaylandı: ${companyCode} — Yönetici: ${adminEmail}`);
    return c.json({
      success: true,
      company: profile,
      admin: { id: data.user?.id, email: adminEmail, name: adminName },
      message: `${companyName} şirketi ve yönetici hesabı oluşturuldu.`,
    });
  } catch (err) {
    console.log("[applications/approve] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /superadmin/applications/:id/reject — Reddet
app.post("/make-server-4da0b637/superadmin/applications/:id/reject", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const appId = c.req.param("id");
    const application: any = await kv.get(`application_${appId}`);
    if (!application) return c.json({ error: "Başvuru bulunamadı." }, 404);
    if (application.status !== "pending") return c.json({ error: "Bu başvuru zaten işlenmiş." }, 400);

    await kv.set(`application_${appId}`, {
      ...application,
      adminPassword: undefined,
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      rejectedBy: user.email,
    });

    console.log(`[applications] ❌ Reddedildi: ${application.companyCode}`);
    return c.json({ success: true, message: "Başvuru reddedildi." });
  } catch (err) {
    console.log("[applications/reject] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /superadmin/applications/:id — Başvuruyu sil
app.delete("/make-server-4da0b637/superadmin/applications/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const appId = c.req.param("id");
    const application: any = await kv.get(`application_${appId}`);
    if (!application) return c.json({ error: "Başvuru bulunamadı." }, 404);

    await kv.del(`application_${appId}`);
    console.log(`[applications] 🗑️ Silindi: ${appId}`);
    return c.json({ success: true, message: "Başvuru silindi." });
  } catch (err) {
    console.log("[applications/delete] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /superadmin/ghost-token — Hedef şirketin yöneticisi adına imzalı JWT üret
app.post("/make-server-4da0b637/superadmin/ghost-token", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const { targetUserId } = await c.req.json();
    if (!targetUserId) return c.json({ error: "targetUserId zorunludur." }, 400);

    const adminClient = getAdminClient();
    const { data: { user: targetUser }, error } = await adminClient.auth.admin.getUserById(targetUserId);
    if (error || !targetUser) return c.json({ error: "Kullanıcı bulunamadı." }, 404);

    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") || Deno.env.get("JWT_SECRET");
    if (!jwtSecret) return c.json({ error: "JWT secret yapılandırılmamış." }, 500);

    const secret = new TextEncoder().encode(jwtSecret);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const now = Math.floor(Date.now() / 1000);

    const ghostToken = await new SignJWT({
      sub: targetUser.id,
      email: targetUser.email ?? "",
      role: "authenticated",
      app_metadata: targetUser.app_metadata ?? {},
      user_metadata: targetUser.user_metadata ?? {},
      iss: `${supabaseUrl}/auth/v1`,
      aud: "authenticated",
      iat: now,
      exp: now + 3600,
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    console.log(`[ghost-token] superadmin → ${targetUser.email} (${targetUser.user_metadata?.company_id}) ghost token üretildi`);
    return c.json({ access_token: ghostToken });
  } catch (err) {
    console.log("[ghost-token] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /superadmin/companies/:id — Şirketi ve TÜM verisini kalıcı olarak sil
app.delete("/make-server-4da0b637/superadmin/companies/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user || user.user_metadata?.originalRole !== "superadmin")
      return c.json({ error: "Yetkisiz erişim." }, 403);

    const companyId = c.req.param("id").toLowerCase();
    const profile = await kv.get(`company_profile_${companyId}`);
    if (!profile) return c.json({ error: "Şirket bulunamadı." }, 404);

    const supabase = getAdminClient();
    let deletedUsers = 0;

    // 1. Şirkete ait tüm kullanıcıları Supabase Auth'tan sil
    const { data: { users: allUsers }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (!listErr) {
      const companyUsers = (allUsers || []).filter((u: any) =>
        (u.user_metadata?.company_id || "aspect") === companyId
      );
      for (const u of companyUsers) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
        if (!delErr) deletedUsers++;
        else console.log(`[companies/delete] kullanıcı silinemedi ${u.email}: ${delErr.message}`);
      }
    }

    // 2. KV'deki tüm şirket-prefix'li anahtarları sil (companyId:* pattern)
    await supabase
      .from("kv_store_4da0b637")
      .delete()
      .like("key", `${companyId}:%`);

    // 3. Şirket profilini sil
    await kv.del(`company_profile_${companyId}`);
    // Varsayılan şirketlerin seed'de yeniden oluşturulmaması için tombstone bırak
    await kv.set(`company_tombstone_${companyId}`, { deletedAt: new Date().toISOString() });

    // 4. Bu şirkete ait başvuruları temizle
    const allApps: any[] = await kv.getByPrefix("application_") || [];
    for (const app of allApps) {
      if (app?.companyCode === companyId) {
        await kv.del(`application_${app.id}`).catch(() => {});
      }
    }

    console.log(`[companies/delete] ✅ Silindi: ${companyId} — ${deletedUsers} kullanıcı`);
    return c.json({
      success: true,
      message: `${profile.name} şirketi ve tüm verisi kalıcı olarak silindi.`,
      deletedUsers,
    });
  } catch (err) {
    console.log("[companies/delete] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── ONE-TIME: ozgur.demirbas@yandex.com → superadmin yap ──────────────────
app.post("/make-server-4da0b637/bootstrap/make-superadmin", async (c) => {
  try {
    const TARGET_EMAIL = "ozgur.demirbas@yandex.com";
    const supabase = getAdminClient();

    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return c.json({ error: `Kullanıcı listesi alınamadı: ${listErr.message}` }, 500);

    const target = users?.find((u: any) => u.email === TARGET_EMAIL);
    if (!target) {
      return c.json({ error: `${TARGET_EMAIL} bulunamadı. Önce bu e-posta ile kayıt olunmalı.` }, 404);
    }

    const { data, error: updateErr } = await supabase.auth.admin.updateUserById(target.id, {
      user_metadata: {
        ...target.user_metadata,
        role: "superadmin",
        company_id: target.user_metadata?.company_id || "aspect",
        full_name: target.user_metadata?.full_name || "Özgür Demirbaş",
      },
    });
    if (updateErr) return c.json({ error: `Güncelleme hatası: ${updateErr.message}` }, 500);

    console.log(`[bootstrap] ${TARGET_EMAIL} → superadmin yapıldı. ID: ${target.id}`);
    return c.json({
      success: true,
      message: `✅ ${TARGET_EMAIL} artık superadmin!`,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role: data.user?.user_metadata?.role,
      },
    });
  } catch (err) {
    console.log("[bootstrap/make-superadmin] error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// TELEGRAM: Tanı endpoint — bot + getUpdates ile gerçek chat ID tespiti
// GET /make-server-4da0b637/telegram/diagnose
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/telegram/diagnose", async (c) => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const savedChatId = Deno.env.get("TELEGRAM_GROUP_CHAT_ID");
  if (!token) return c.json({ error: "TELEGRAM_BOT_TOKEN eksik" }, 500);

  const tgBase = `https://api.telegram.org/bot${token}`;

  // 1. Bot kimliği
  const meRes: any = await fetch(`${tgBase}/getMe`).then(r => r.json()).catch((e: any) => ({ error: String(e) }));

  // 2. Son güncellemeler (bot'un bulunduğu grupları listeler)
  const updatesRes: any = await fetch(`${tgBase}/getUpdates?limit=100`)
    .then(r => r.json()).catch((e: any) => ({ error: String(e) }));

  // 3. Güncellemelerden benzersiz chat'leri çıkar
  const chats: Record<string, any> = {};
  if (updatesRes?.ok && Array.isArray(updatesRes.result)) {
    for (const u of updatesRes.result) {
      const chat = u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat;
      if (chat?.id) {
        chats[String(chat.id)] = { id: chat.id, title: chat.title, type: chat.type };
      }
    }
  }

  // 4. Kayıtlı ID ile getChat dene (orijinal + supergroup prefix varyantı)
  let getChatResult: any = null;
  if (savedChatId) {
    const raw = savedChatId.trim();
    const variants = [raw];
    if (raw.startsWith("-") && !raw.startsWith("-100")) {
      variants.push("-100" + raw.slice(1));
    }
    for (const cid of variants) {
      const r: any = await fetch(`${tgBase}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: cid }),
      }).then(r => r.json()).catch((e: any) => ({ error: String(e) }));
      getChatResult = { tried_id: cid, result: r };
      if (r?.ok) break;
    }
  }

  const detectedList = Object.values(chats);
  return c.json({
    bot: meRes?.result
      ? { id: meRes.result.id, username: meRes.result.username, name: meRes.result.first_name }
      : { error: meRes },
    saved_chat_id: savedChatId ?? "(yok)",
    getChat_result: getChatResult,
    detected_chats: detectedList,
    updates_count: updatesRes?.result?.length ?? 0,
    hint: detectedList.length === 0
      ? "⚠️ Bot'un hiç mesaj geçmişi yok. 1) Gruba @AspectReportBot'u ekleyin, 2) Gruba herhangi bir mesaj yazın, 3) Bu endpoint'i tekrar çağırın."
      : "✅ detected_chats listesinden hedef grubun id'sini alıp TELEGRAM_GROUP_CHAT_ID secret'ını güncelleyin.",
  });
});

// ──────────────────────────────────────────
// TELEGRAM: Test endpoint (debug)
// GET /make-server-4da0b637/telegram/test
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/telegram/test", async (c) => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_GROUP_CHAT_ID");

  if (!token) return c.json({ error: "TELEGRAM_BOT_TOKEN eksik" }, 500);
  if (!chatId) return c.json({ error: "TELEGRAM_GROUP_CHAT_ID eksik" }, 500);

  const tgBase = `https://api.telegram.org/bot${token}`;

  // ── 1. Bot token doğruluğunu kontrol et ──
  let botInfo: any = null;
  try {
    const r = await fetch(`${tgBase}/getMe`);
    botInfo = await r.json();
  } catch (e) {
    return c.json({ success: false, error: "getMe başarısız: " + String(e) }, 500);
  }
  if (!botInfo?.ok) {
    return c.json({ success: false, stage: "getMe", error: "Bot token geçersiz", telegram_error: botInfo }, 400);
  }

  // ── 2. Gruba ulaşılabilir mi? Normal + supergroup ID varyantlarını dene ──
  // Normal grup: -5142979348  →  Süper gruba dönüştüyse: -1005142979348
  const rawId = chatId.trim();
  const candidateIds: string[] = [rawId];
  if (rawId.startsWith("-") && !rawId.startsWith("-100")) {
    candidateIds.push("-100" + rawId.slice(1));
  }

  let workingChatId: string | null = null;
  const getChatResults: Record<string, any> = {};

  for (const cid of candidateIds) {
    try {
      const r = await fetch(`${tgBase}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: cid }),
      });
      const result = await r.json();
      getChatResults[cid] = result;
      if (result.ok) {
        workingChatId = cid;
        break;
      }
    } catch (e) {
      getChatResults[cid] = { error: String(e) };
    }
  }

  if (!workingChatId) {
    return c.json({
      success: false,
      stage: "getChat",
      error: "Bot gruba erişemiyor. Bot'u gruba admin olarak ekleyin.",
      bot_username: botInfo.result?.username,
      token_prefix: token.slice(0, 10) + "...",
      chat_id_tried: candidateIds,
      getChat_results: getChatResults,
    }, 400);
  }

  // ── 3. Mesaj gönder ──
  const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const testMsg = `🧪 <b>Aspect Operations — Test Bildirimi</b>\n\n✅ Telegram bağlantısı başarılı!\n🤖 Bot: @${botInfo.result?.username}\n💬 Chat ID: <code>${workingChatId}</code>\n⏰ ${now}\n\n<i>Bu mesaj sunucu test endpoint'inden gönderilmiştir.</i>`;

  try {
    const res = await fetch(`${tgBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: workingChatId, text: testMsg, parse_mode: "HTML" }),
    });
    const result = await res.json();
    console.log("[Telegram Test] Sonuç:", JSON.stringify(result));
    if (result.ok) {
      const idChanged = workingChatId !== rawId;
      return c.json({
        success: true,
        message_id: result.result?.message_id,
        chat_id_used: workingChatId,
        chat_id_in_secret: rawId,
        id_was_corrected: idChanged,
        correction_note: idChanged
          ? `Supergroup ID (${workingChatId}) kullanıldı. TELEGRAM_GROUP_CHAT_ID secret'ını güncelleyin!`
          : undefined,
        bot_username: botInfo.result?.username,
      });
    } else {
      return c.json({ success: false, stage: "sendMessage", telegram_error: result, chat_id: workingChatId }, 400);
    }
  } catch (e) {
    return c.json({ success: false, stage: "sendMessage", error: String(e), chat_id: workingChatId }, 500);
  }
});

// ─────────��──────────────────────────────���─
// TELEGRAM: Webhook handler (Telegram callback_query'lerini işler)
// POST /make-server-4da0b637/telegram/webhook
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/telegram/webhook", async (c) => {
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    // Not: secret_token doğrulaması kaldırıldı — URL'deki ?apikey= Supabase gateway'i zaten korur.
    const update = await c.req.json();
    console.log("[TG Webhook] Update alındı:", JSON.stringify(update).slice(0, 300));

    if (!update.callback_query) {
      return c.json({ ok: true }); // Diğer update tipleri atla
    }

    const cbq = update.callback_query;
    const cbqId = cbq.id;
    const data: string = cbq.data || "";
    const from = cbq.from?.first_name
      ? `${cbq.from.first_name}${cbq.from.last_name ? " " + cbq.from.last_name : ""}`
      : cbq.from?.username || "Bilinmiyor";
    const chatId = cbq.message?.chat?.id;
    const messageId = cbq.message?.message_id;

    let answerText = "";

    console.log("[TG Webhook] callback_query data:", data, "| chatId:", chatId, "| from:", from);

    if (data.startsWith("iptal_onayla:") || data.startsWith("iptal_reddet:")) {
      const isApprove = data.startsWith("iptal_onayla:");
      const approvalId = data.replace(isApprove ? "iptal_onayla:" : "iptal_reddet:", "");
      console.log("[TG Webhook] approvalId:", approvalId, "| isApprove:", isApprove);
      const talep: any = await kv.get(`iptal_talep_${approvalId}`);
      console.log("[TG Webhook] talep KV sonucu:", talep ? `status=${talep.status}` : "BULUNAMADI");

      if (!talep) {
        answerText = "⚠️ Talep bulunamadı veya süresi doldu.";
      } else if (talep.status !== "bekliyor") {
        answerText = talep.status === "onaylandi"
          ? "✅ Bu talep zaten onaylandı."
          : "❌ Bu talep zaten reddedildi.";
      } else {
        const yeniStatus = isApprove ? "onaylandi" : "reddedildi";
        await kv.set(`iptal_talep_${approvalId}`, {
          ...talep,
          status: yeniStatus,
          resolvedAt: new Date().toISOString(),
          resolvedBy: from,
        });

        answerText = isApprove
          ? "✅ Satış iptali onaylandı!"
          : "❌ Satış iptali reddedildi.";

        // Telegram mesajından butonları kaldır
        if (chatId && messageId) {
          try {
            await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
            });
          } catch {}
        }

        // Sonuç mesajı gönder
        const emoji = isApprove ? "✅" : "❌";
        const durum = isApprove ? "ONAYLANDI" : "REDDEDİLDİ";
        await sendTelegramMessage(
          `${emoji} <b>Satış iptali ${durum}</b>\n👤 Karar veren: <b>${from}</b>\n📝 Sebep: ${talep.neden || "(belirtilmedi)"}\n🆔 <code>${approvalId}</code>`,
          "HTML",
          talep?.companyId || "aspect"
        );
        console.log(`[TG Webhook] İptal talebi ${yeniStatus}: ${approvalId} — ${from}`);
      }
    }

    // Callback yanıtı gönder (popup)
    if (cbqId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cbqId, text: answerText || "İşlendi.", show_alert: !!answerText }),
        });
      } catch {}
    }

    return c.json({ ok: true });
  } catch (err) {
    console.log("[TG Webhook] Error:", err);
    return c.json({ ok: false }, 200); // 200 döndür — Telegram retry yapmasın
  }
});

// ──────────────────────────────────────────
// TELEGRAM: Webhook bilgisi sorgula (debug)
// GET /make-server-4da0b637/telegram/webhook-info
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/telegram/webhook-info", async (c) => {
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return c.json({ error: "TELEGRAM_BOT_TOKEN eksik" }, 500);
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ──────────────────────────────────────────
// AUTH: Kayıt ol
// POST /make-server-4da0b637/auth/signup
// Body: { email, password, full_name, phone? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/auth/signup", async (c) => {
  try {
    const { email, password, full_name, phone, company_id } = await c.req.json();

    if (!email || !password || !full_name) {
      return c.json({ error: "E-posta, şifre ve ad soyad zorunludur." }, 400);
    }

    // Şirket doğrulama — KV'deki tüm şirket profillerini kabul et (dinamik)
    let resolvedCompanyId = "aspect"; // varsayılan: aspect (eski kayıtlar için geriye dönük uyumluluk)
    if (company_id) {
      const cid = company_id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      // Tombstone kontrolü — kasıtlı silinmiş şirket
      const tombstone = await kv.get(`company_tombstone_${cid}`);
      if (tombstone) {
        return c.json({ error: "Geçersiz şirket kodu. Lütfen doğru kodu girdiğinizden emin olun." }, 400);
      }
      const companyProfile = await kv.get(`company_profile_${cid}`);
      if (companyProfile && companyProfile.status === "suspended") {
        return c.json({ error: "Bu şirket hesabı askıya alınmış. Yöneticinizle iletişime geçin." }, 403);
      }
      if (companyProfile) {
        resolvedCompanyId = cid;
      } else {
        return c.json({ error: "Geçersiz şirket kodu. Lütfen doğru kodu girdiğinizden emin olun." }, 400);
      }
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      user_metadata: {
        full_name: full_name.trim(),
        role: "bekleyen", // Yeni kullanıcılar bekleyen olarak başlar
        phone: phone?.trim() || "",
        company_id: resolvedCompanyId,
      },
      // E-posta sunucusu yapılandırılmadığı için otomatik onaylıyoruz
      email_confirm: true,
    });

    if (error) {
      console.log("Signup error:", error.message);
      if (error.message.includes("already registered")) {
        return c.json({ error: "Bu e-posta adresi zaten kayıtlı." }, 400);
      }
      return c.json({ error: `Kayıt hatası: ${error.message}` }, 400);
    }

    console.log("User created successfully:", data.user?.id);
    return c.json({
      message: "Hesap oluşturuldu. Yönetici onayı bekleniyor.",
      user: {
        id: data.user?.id,
        email: data.user?.email,
        full_name: data.user?.user_metadata?.full_name,
        role: data.user?.user_metadata?.role,
      },
    });
  } catch (err) {
    console.log("Signup unexpected error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// AUTH: Mevcut kullanıcı profili
// GET /make-server-4da0b637/auth/me
// ───────��──────────────────────────────────
app.get("/make-server-4da0b637/auth/me", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) {
      return c.json({ error: "Yetkisiz erişim." }, 401);
    }

    const cId = getCompanyId(user);
    const profile: any = await kv.get(`company_profile_${cId}`);
    return c.json({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || "",
      role: user.user_metadata?.role || "bekleyen",
      phone: user.user_metadata?.phone || "",
      avatar: user.user_metadata?.avatar || "",
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at,
      company_id: cId,
      company_name: profile?.name || cId,
      company_emoji: profile?.emoji || "🏢",
    });
  } catch (err) {
    console.log("Get profile error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// AUTH: Profil güncelle
// PUT /make-server-4da0b637/auth/profile
// Body: { full_name?, phone?, avatar?, email? }
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/auth/profile", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { full_name, phone, avatar, email, birth_date, theme } = await c.req.json();
    const supabase = getAdminClient();

    const updatedMetadata: Record<string, string> = {
      ...user.user_metadata,
    };
    if (full_name !== undefined) updatedMetadata.full_name = full_name.trim();
    if (phone !== undefined) updatedMetadata.phone = phone.trim();
    if (avatar !== undefined) updatedMetadata.avatar = avatar;
    if (birth_date !== undefined) updatedMetadata.birth_date = birth_date;
    if (theme !== undefined) updatedMetadata.theme = theme;

    // E-posta değişiyorsa updateUserById'e email de ekle
    const updatePayload: Record<string, any> = { user_metadata: updatedMetadata };
    if (email !== undefined && email.trim() !== '' && email.trim() !== user.email) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return c.json({ error: "Geçersiz e-posta formatı." }, 400);
      }
      updatePayload.email = trimmedEmail;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(user.id, updatePayload);

    if (error) {
      console.log("Profile update error:", error.message);
      return c.json({ error: `Profil güncellenemedi: ${error.message}` }, 400);
    }

    return c.json({
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name,
      role: data.user.user_metadata?.role,
      phone: data.user.user_metadata?.phone,
      avatar: data.user.user_metadata?.avatar,
      theme: data.user.user_metadata?.theme,
    });
  } catch (err) {
    console.log("Profile update unexpected error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// AUTH: Kullanıcı rolü güncelle (sadece yönetici/üst-müdür)
// PUT /make-server-4da0b637/auth/update-role
// Body: { userId, role }
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/auth/update-role", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = callerUser.user_metadata?.role;
    if (!hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    const { userId, role } = await c.req.json();
    const validRoles = ["yonetici", "ust-mudur", "mudur", "operasyon", "personel", "idari", "tedarikci", "bekleyen"];
    if (!validRoles.includes(role)) {
      return c.json({ error: "Geçersiz rol." }, 400);
    }

    // Hiyerarşi kontrolü — kendi seviyenizi aşan işlem yapılamaz
    const hierarchy: Record<string, number> = {
      yonetici: 6, "ust-mudur": 5, mudur: 4, operasyon: 3, idari: 2, personel: 1, tedarikci: 0.5, bekleyen: 0,
    };

    const callerCompanyId = getCompanyId(callerUser);
    const supabase = getAdminClient();
    const { data: targetData } = await supabase.auth.admin.getUserById(userId);
    if (!targetData?.user) return c.json({ error: "Kullanıcı bulunamadı." }, 404);

    // ── Multi-tenant güvenlik: farklı şirketteki kullanıcıya dokunulamaz ──
    const targetCompanyId = getCompanyId(targetData.user);
    if (targetCompanyId !== callerCompanyId) {
      console.log(`[update-role] Şirket uyuşmazlığı: ${callerCompanyId} → ${targetCompanyId}`);
      return c.json({ error: "Bu kullanıcı başka bir şirkete ait." }, 403);
    }

    if (callerRole !== "yonetici") {
      const callerLevel = hierarchy[callerRole] ?? 0;
      const targetCurrentLevel = hierarchy[targetData.user.user_metadata?.role ?? "bekleyen"] ?? 0;
      const newRoleLevel = hierarchy[role] ?? 0;
      if (targetCurrentLevel >= callerLevel) {
        return c.json({ error: "Kendi seviyenizde veya üzerindeki kullanıcıları düzenleyemezsiniz." }, 403);
      }
      if (newRoleLevel >= callerLevel) {
        return c.json({ error: "Kendinizden yüksek veya eşit bir rol atayamazsınız." }, 403);
      }
    }

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...targetData.user.user_metadata,
        role,
      },
    });

    if (error) {
      console.log("Role update error:", error.message);
      return c.json({ error: `Rol güncellenemedi: ${error.message}` }, 400);
    }

    console.log(`Role updated: ${userId} -> ${role} by ${callerUser.id}`);
    return c.json({
      message: "Rol güncellendi.",
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name,
        role: data.user.user_metadata?.role,
      },
    });
  } catch (err) {
    console.log("Role update unexpected error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// USERS: Tüm kullanıcıları listele (yönetici/üst-müdür/müdür/idari)
// GET /make-server-4da0b637/users
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/users", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = callerUser.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari", "superadmin"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    // Superadmin ghost mod: originalRole kontrol et (callerRole yonetici'ye normalize edilmiş)
    const isSuperAdmin = callerUser.user_metadata?.originalRole === "superadmin";
    const requestedCompanyId = c.req.query("company_id");
    const callerCompanyId = isSuperAdmin && requestedCompanyId
      ? requestedCompanyId
      : getCompanyId(callerUser);

    const supabase = getAdminClient();
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error) {
      console.log("List users error:", error.message);
      return c.json({ error: `Kullanıcılar listelenemedi: ${error.message}` }, 400);
    }

    // ── Multi-tenant filtreleme: yalnızca aynı şirketteki kullanıcılar ──
    // superadmin tüm şirket kullanıcılarını görebilir (company_id query param ile)
    // company_id yoksa (legacy aspect kullanıcısı) → aspect'e dahil et
    const companyUsers = users.filter((u) => {
      const cId = u.user_metadata?.company_id || "aspect";
      return cId === callerCompanyId;
    });

    const mappedUsers = companyUsers.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || "",
      role: u.user_metadata?.role || "bekleyen",
      phone: u.user_metadata?.phone || "",
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at || null,
    }));

    return c.json({ users: mappedUsers });
  } catch (err) {
    console.log("List users unexpected error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────���───────────────────────
// USERS: Tek kullanıcı detayı
// GET /make-server-4da0b637/users/:userId
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/users/:userId", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { userId } = c.req.param();
    const supabase = getAdminClient();
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !user) {
      return c.json({ error: "Kullanıcı bulunamadı." }, 404);
    }

    return c.json({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || "",
      role: user.user_metadata?.role || "bekleyen",
      phone: user.user_metadata?.phone || "",
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at || null,
    });
  } catch (err) {
    console.log("Get user unexpected error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MEKANLAR: Tüm mekanları listele
// GET /make-server-4da0b637/mekanlar
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/mekanlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = user.user_metadata?.role;
    const allowedRoles = ["yonetici", "ust-mudur", "mudur", "operasyon", "personel", "idari"];
    if (!hasPermission(callerRole, allowedRoles)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    // Superadmin ghost mod: originalRole kontrol et (callerRole yonetici'ye normalize edilmiş)
    const isSuperAdminCaller = user.user_metadata?.originalRole === "superadmin";
    const requestedCId = c.req.query("company_id");
    const cId = (isSuperAdminCaller && requestedCId) ? requestedCId : getCompanyId(user);

    const mekanlar = await getMekanlarFor(cId);
    const sorted   = mekanlar.sort((a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return c.json({ mekanlar: sorted });
  } catch (err) {
    console.log("List mekanlar error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MEKANLAR: Yeni mekan ekle
// POST /make-server-4da0b637/mekanlar
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/mekanlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Mekan ekleme yetkisi yalnızca Yönetici rolüne aittir." }, 403);
    }

    const body = await c.req.json();
    const { name, emoji, color, photoPrice, yearlyRent, dailyCostPercentage, profitPercentage, paperType, printType, zorlukKatsayisi, workingHours, priceCurrency } = body;

    if (!name?.trim()) {
      return c.json({ error: "Mekan adı zorunludur." }, 400);
    }

    const cId  = getCompanyId(user);
    const ckv  = companyKvFor(cId);
    const id   = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const mekan = {
      id,
      name: name.trim(),
      emoji: emoji || "📍",
      color: color || "#9dd9ea",
      photoPrice: Number(photoPrice) || 0,
      priceCurrency: ["TRY","USD","EUR","GBP"].includes(priceCurrency) ? priceCurrency : "TRY",
      yearlyRent: Number(yearlyRent) || 0,
      yearlyRents: (body.yearlyRents && typeof body.yearlyRents === "object") ? body.yearlyRents : {},
      profitTargets: (body.profitTargets && typeof body.profitTargets === "object") ? body.profitTargets : {},
      dailyCostPercentage: Number(dailyCostPercentage) || 0,
      profitPercentage: Number(profitPercentage) || 0,
      paperType: paperType || "",
      printType: printType || "yarim",
      zorlukKatsayisi: Number(zorlukKatsayisi) || 1.0,
      workingHours: workingHours || { start: "09:00", end: "18:00" },
      kotaKademeleri: Array.isArray(body.kotaKademeleri) ? body.kotaKademeleri : [],
      created_at: new Date().toISOString(),
      created_by: user.id,
    };

    await ckv.set(`mekan_${id}`, mekan);
    pgWrite("venues", "insert", {
      id, company_id: cId, name, emoji: emoji || "📍", color: color || "#9dd9ea",
      photo_price: Number(photoPrice) || 0, price_currency: body.priceCurrency || "TRY",
      yearly_rent: Number(yearlyRent) || 0, profit_target: Number(profitTarget) || 0,
      print_type: printType || "yarim", zorluk_katsayisi: Number(zorlukKatsayisi) || 1.0,
      kare_charpani: Number(body.kareCharpani) || 5, working_hours: workingHours || null,
      kota_kademeleri: body.kotaKademeleri || null, extra_data: body,
    });
    console.log(`[${cId}] Mekan oluşturuldu: ${name} by ${user.id}`);
    return c.json({ mekan }, 201);
  } catch (err) {
    console.log("Create mekan error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ────────────────────��─────────────────────
// MEKANLAR: Mekan güncelle
// PUT /make-server-4da0b637/mekanlar/:id
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/mekanlar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Mekan düzenleme yetkisi yalnızca Yönetici rolüne aittir." }, 403);
    }

    const cId  = getCompanyId(user);
    const ckv  = companyKvFor(cId);
    const { id } = c.req.param();
    const existing = await ckv.get(`mekan_${id}`);
    if (!existing) return c.json({ error: "Mekan bulunamadı." }, 404);

    const body = await c.req.json();
    const { name, emoji, color, photoPrice, yearlyRent, dailyCostPercentage, profitPercentage, paperType, printType, zorlukKatsayisi, workingHours, priceCurrency } = body;

    if (!name?.trim()) {
      return c.json({ error: "Mekan adı zorunludur." }, 400);
    }

    const updated = {
      ...existing,
      name: name.trim(),
      emoji: emoji || existing.emoji,
      color: color || existing.color,
      photoPrice: Number(photoPrice) ?? existing.photoPrice,
      priceCurrency: priceCurrency !== undefined ? (["TRY","USD","EUR","GBP"].includes(priceCurrency) ? priceCurrency : "TRY") : (existing.priceCurrency || "TRY"),
      yearlyRent: Number(yearlyRent) ?? existing.yearlyRent,
      yearlyRents: (body.yearlyRents && typeof body.yearlyRents === "object") ? body.yearlyRents : (existing.yearlyRents || {}),
      profitTargets: (body.profitTargets && typeof body.profitTargets === "object") ? body.profitTargets : (existing.profitTargets || {}),
      dailyCostPercentage: Number(dailyCostPercentage) ?? existing.dailyCostPercentage,
      profitPercentage: Number(profitPercentage) ?? existing.profitPercentage,
      paperType: paperType ?? existing.paperType,
      printType: printType ?? existing.printType,
      zorlukKatsayisi: zorlukKatsayisi !== undefined ? Number(zorlukKatsayisi) : (existing.zorlukKatsayisi ?? 1.0),
      workingHours: workingHours ?? existing.workingHours,
      kotaKademeleri: Array.isArray(body.kotaKademeleri) ? body.kotaKademeleri : (existing.kotaKademeleri || []),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    await ckv.set(`mekan_${id}`, updated);
    pgWrite("venues", "upsert", {
      id, company_id: cId, name: updated.name, emoji: updated.emoji, color: updated.color,
      photo_price: Number(updated.photoPrice) || 0, price_currency: updated.priceCurrency || "TRY",
      yearly_rent: Number(updated.yearlyRent) || 0, profit_target: Number(updated.profitTarget) || 0,
      print_type: updated.printType || "yarim", zorluk_katsayisi: Number(updated.zorlukKatsayisi) || 1.0,
      kare_charpani: Number(updated.kareCharpani) || 5, working_hours: updated.workingHours || null,
      kota_kademeleri: updated.kotaKademeleri || null, extra_data: updated,
    });
    console.log(`[${cId}] Mekan güncellendi: ${id} by ${user.id}`);
    return c.json({ mekan: updated });
  } catch (err) {
    console.log("Update mekan error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ─────────────────────────────────────────��
// MEKANLAR: Mekan sil
// DELETE /make-server-4da0b637/mekanlar/:id
// ──────────────────────────────────────────
app.delete("/make-server-4da0b637/mekanlar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Mekan silme yetkisi yalnızca Yönetici rolüne aittir." }, 403);
    }

    const cId  = getCompanyId(user);
    const ckv  = companyKvFor(cId);
    const { id } = c.req.param();
    const existing = await ckv.get(`mekan_${id}`);
    if (!existing) return c.json({ error: "Mekan bulunamadı." }, 404);

    await ckv.del(`mekan_${id}`);
    console.log(`[${cId}] Mekan silindi: ${id} (${existing.name}) by ${user.id}`);
    return c.json({ message: `"${existing.name}" mekanı silindi.` });
  } catch (err) {
    console.log("Delete mekan error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALİYET YÖNETİMİ: Tüm verileri getir
// GET /make-server-4da0b637/maliyetler
// ─────────────���────────────────────────────
app.get("/make-server-4da0b637/maliyetler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    // Maliyet okuma: tüm aktif roller erişebilir (personel/operasyon kağıt kapasitesine ihtiyaç duyar)
    const allowedReadRoles = ["yonetici", "ust-mudur", "mudur", "idari", "operasyon", "personel"];
    if (!hasPermission(callerRole, allowedReadRoles)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    // Superadmin ghost mod: originalRole kontrol et (callerRole yonetici'ye normalize edilmiş)
    const isSuperAdminMaliyet = user.user_metadata?.originalRole === "superadmin";
    const requestedCIdMaliyet = c.req.query("company_id");
    const cIdMaliyet = (isSuperAdminMaliyet && requestedCIdMaliyet) ? requestedCIdMaliyet : getCompanyId(user);
    const ckv = companyKvFor(cIdMaliyet);
    const exchangeRates = await ckv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20, BGN: 19.50, RUB: 0.38, SAR: 8.80, isAuto: false };
    const albums = await ckv.get("cost_albums") || [
      { size: 3,  tamBoy: 25, yarimBoy: 20, currency: "TRY" },
      { size: 5,  tamBoy: 35, yarimBoy: 28, currency: "TRY" },
      { size: 7,  tamBoy: 45, yarimBoy: 36, currency: "TRY" },
      { size: 9,  tamBoy: 55, yarimBoy: 44, currency: "TRY" },
      { size: 11, tamBoy: 65, yarimBoy: 52, currency: "TRY" },
      { size: 13, tamBoy: 75, yarimBoy: 60, currency: "TRY" },
      { size: 15, tamBoy: 85, yarimBoy: 68, currency: "TRY" },
    ];
    const papers = await ckv.getByPrefix("cost_paper_");
    const recurring = await ckv.getByPrefix("cost_recurring_");
    const salaries = await ckv.getByPrefix("cost_salary_");
    const cariler = await ckv.getByPrefix("cost_cari_").catch(() => []) || [];

    return c.json({ exchangeRates, albums, papers, recurring, salaries, cariler });
  } catch (err) {
    console.log("Get maliyetler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// DÖVİZ: Canlı kurları çek (open.er-api.com, ücretsiz)
// GET /make-server-4da0b637/doviz/canli
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/doviz/canli", async (c) => {
  try {
    // companyId: auth token'dan veya query param'dan al (manuel kur fallback için)
    let ckvCompany: ReturnType<typeof companyKvFor> | null = null;
    try {
      const u = await verifyToken(c);
      if (u) ckvCompany = companyKvFor(getCompanyId(u));
    } catch (_) { /* no token */ }
    if (!ckvCompany) {
      const qcid = (c.req.query("companyId") || "").toLowerCase() || "aspect";
      ckvCompany = companyKvFor(qcid);
    }

    // Manuel mod kontrolü: isAuto=false ise canlı API'ye gitme, direkt manuel kurları dön
    const manualRates = await ckvCompany!.get("cost_exchange_rates");
    if (manualRates && !manualRates.isAuto) {
      return c.json({
        rates: { USD: Number(manualRates.USD), EUR: Number(manualRates.EUR), GBP: Number(manualRates.GBP), BGN: Number(manualRates.BGN) || 0, RUB: Number(manualRates.RUB) || 0, SAR: Number(manualRates.SAR) || 0 },
        trend: null, source: "manual", fetchedAt: Date.now(),
      });
    }

    // Önce KV cache'e bak (10 dk TTL) — global, tüm şirketler için aynı
    const cached = await kv.get("live_rates_cache");
    if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt) < 10 * 60 * 1000) {
      return c.json({ rates: cached.rates, source: "cache", fetchedAt: cached.fetchedAt });
    }

    // Canlı çek: USD baz alarak TRY, EUR, GBP (5 sn timeout)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res!: Response; // Definite assignment assertion — TS2454 hatasını önler
    try {
      res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`Exchange API HTTP ${res.status}`);
    const data = await res.json();

    if (data.result !== "success" || !data.rates) {
      throw new Error(`Exchange API error: ${JSON.stringify(data)}`);
    }

    const r = data.rates;
    // 1 USD = r.TRY ₺ → 1 EUR = (r.TRY / r.EUR) ₺, vb.
    const rates: Record<string, number> = {
      USD: parseFloat(r.TRY.toFixed(4)),
      EUR: parseFloat((r.TRY / r.EUR).toFixed(4)),
      GBP: parseFloat((r.TRY / r.GBP).toFixed(4)),
      BGN: r.BGN ? parseFloat((r.TRY / r.BGN).toFixed(4)) : 0,
      RUB: r.RUB ? parseFloat((r.TRY / r.RUB).toFixed(4)) : 0,
      SAR: r.SAR ? parseFloat((r.TRY / r.SAR).toFixed(4)) : 0,
    };

    // Trend hesapla: önceki cache ile karşılaştır
    const trendKeys = ["USD", "EUR", "GBP", "BGN", "RUB", "SAR"] as const;
    let trend: Record<string, number> | null = null;
    if (cached?.rates) {
      trend = {};
      for (const k of trendKeys) {
        trend[k] = cached.rates[k] ? parseFloat(((rates[k] - cached.rates[k]) / cached.rates[k] * 100).toFixed(3)) : 0;
      }
    } else {
      const prev = await kv.get("live_rates_prev_day");
      if (prev?.rates) {
        trend = {};
        for (const k of trendKeys) {
          trend[k] = prev.rates[k] ? parseFloat(((rates[k] - prev.rates[k]) / prev.rates[k] * 100).toFixed(3)) : 0;
        }
      }
    }

    const fetchedAt = Date.now();
    await kv.set("live_rates_cache", { rates, trend, fetchedAt });

    // Her 24 saatte bir "önceki gün" kuru güncelle
    const prevDay = await kv.get("live_rates_prev_day");
    if (!prevDay || (Date.now() - (prevDay.savedAt || 0)) > 24 * 60 * 60 * 1000) {
      await kv.set("live_rates_prev_day", { rates, savedAt: fetchedAt });
    }

    return c.json({ rates, trend, source: "live", fetchedAt });
  } catch (err) {
    console.log("Doviz canli error:", err);
    const stale = await kv.get("live_rates_cache");
    if (stale?.rates) {
      return c.json({ rates: stale.rates, trend: stale.trend || null, source: "stale", fetchedAt: stale.fetchedAt });
    }
    const manual = await ckvCompany.get("cost_exchange_rates");
    if (manual) {
      return c.json({ rates: { USD: Number(manual.USD), EUR: Number(manual.EUR), GBP: Number(manual.GBP), BGN: Number(manual.BGN) || 0, RUB: Number(manual.RUB) || 0, SAR: Number(manual.SAR) || 0 }, trend: null, source: "manual" });
    }
    return c.json({ error: `Kur alınamadı: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALİYET: Döviz kurlarını güncelle
// PUT /make-server-4da0b637/maliyetler/doviz
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/maliyetler/doviz", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const body = await c.req.json();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set("cost_exchange_rates", body);
    return c.json({ exchangeRates: body });
  } catch (err) {
    console.log("Update doviz error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALİYET: Albüm maliyetlerini güncelle
// PUT /make-server-4da0b637/maliyetler/albumler
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/maliyetler/albumler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { albums } = await c.req.json();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set("cost_albums", albums);
    return c.json({ albums });
  } catch (err) {
    console.log("Update albumler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALİYET: Kağıt ekle
// POST /make-server-4da0b637/maliyetler/kagitlar
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/maliyetler/kagitlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const body = await c.req.json();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ckv = companyKvFor(getCompanyId(user));
    const paper = { ...body, id };
    await ckv.set(`cost_paper_${id}`, paper);
    return c.json({ paper }, 201);
  } catch (err) {
    console.log("Create kagit error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// PUT /make-server-4da0b637/maliyetler/kagitlar/:id
app.put("/make-server-4da0b637/maliyetler/kagitlar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`cost_paper_${id}`);
    if (!existing) return c.json({ error: "Kağıt bulunamadı." }, 404);
    const body = await c.req.json();
    const paper = { ...existing, ...body, id };
    await ckv.set(`cost_paper_${id}`, paper);
    return c.json({ paper });
  } catch (err) {
    console.log("Update kagit error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /make-server-4da0b637/maliyetler/kagitlar/:id
app.delete("/make-server-4da0b637/maliyetler/kagitlar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`cost_paper_${id}`);
    return c.json({ message: "Kağıt silindi." });
  } catch (err) {
    console.log("Delete kagit error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALİYET: Düzenli gider ekle/güncelle/sil
// ─────────────────────────────────����────────
app.post("/make-server-4da0b637/maliyetler/giderler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const body = await c.req.json();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ckv = companyKvFor(getCompanyId(user));
    const gider = { ...body, id };
    await ckv.set(`cost_recurring_${id}`, gider);
    return c.json({ gider }, 201);
  } catch (err) {
    console.log("Create gider error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.put("/make-server-4da0b637/maliyetler/giderler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`cost_recurring_${id}`);
    if (!existing) return c.json({ error: "Gider bulunamadı." }, 404);
    const body = await c.req.json();
    const gider = { ...existing, ...body, id };
    await ckv.set(`cost_recurring_${id}`, gider);
    return c.json({ gider });
  } catch (err) {
    console.log("Update gider error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.delete("/make-server-4da0b637/maliyetler/giderler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`cost_recurring_${id}`);
    return c.json({ message: "Gider silindi." });
  } catch (err) {
    console.log("Delete gider error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALİYET: Maaş ekle/güncelle/sil
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/maliyetler/maaslar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const body = await c.req.json();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ckv = companyKvFor(getCompanyId(user));
    const maas = { ...body, id };
    await ckv.set(`cost_salary_${id}`, maas);
    return c.json({ maas }, 201);
  } catch (err) {
    console.log("Create maas error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.put("/make-server-4da0b637/maliyetler/maaslar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`cost_salary_${id}`);
    if (!existing) return c.json({ error: "Maaş bulunamadı." }, 404);
    const body = await c.req.json();
    const maas = { ...existing, ...body, id };
    await ckv.set(`cost_salary_${id}`, maas);
    return c.json({ maas });
  } catch (err) {
    console.log("Update maas error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.delete("/make-server-4da0b637/maliyetler/maaslar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`cost_salary_${id}`);
    return c.json({ message: "Maaş silindi." });
  } catch (err) {
    console.log("Delete maas error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// CARİ HESAPLAR: CRUD
// ──────────────────────────────────────────

// POST /maliyetler/cariler — Cari ekle/güncelle
app.post("/make-server-4da0b637/maliyetler/cariler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(user.user_metadata?.role, ["yonetici", "ust-mudur"])) return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    const body = await c.req.json();
    const { id, name } = body;
    if (!name?.trim()) return c.json({ error: "Cari adı zorunlu." }, 400);

    const cariId = id || `cari_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Mevcut kayıt varsa merge et (linkedUserId, supplierType vb. korunsun)
    const existing = id ? (await ckv.get(`cost_cari_${id}`) || {}) : {};
    const cari = { ...existing, ...body, id: cariId, name: name.trim(), emoji: body.emoji || existing.emoji || "🏢", createdAt: existing.createdAt || new Date().toISOString() };

    await ckv.set(`cost_cari_${cariId}`, cari);
    return c.json({ cari });
  } catch (err) {
    console.log("Post cari error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /maliyetler/cariler/:id
app.delete("/make-server-4da0b637/maliyetler/cariler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(user.user_metadata?.role, ["yonetici", "ust-mudur"])) return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`cost_cari_${c.req.param("id")}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Delete cari error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// İŞLETME GİDERLERİ: CRUD
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/isletme/giderler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Bu sayfaya erişim yetkiniz yok." }, 403);
    }
    const isSAGider = user.user_metadata?.originalRole === "superadmin";
    const reqCIdGider = c.req.query("company_id");
    const companyId = (isSAGider && reqCIdGider) ? reqCIdGider : getCompanyId(user);

    // SQL read geçici devre dışı — KV'den oku
    const ckv = companyKvFor(companyId);
    const tumGiderler: any[] = await ckv.getByPrefix("isletme_gider_") || [];
    const tedCarilerIGD = await ckv.getByPrefix("cost_cari_").catch(() => []) || [];
    const tedIsimSetIGD = new Set(tedCarilerIGD.map((c: any) => (c.name || "").trim().toLowerCase()).filter(Boolean));
    for (const g of tumGiderler) {
      const nameCheck = g.personelAdi || g.category || "";
      if (nameCheck && tedIsimSetIGD.has(nameCheck.trim().toLowerCase()) && g.category !== "tedarikci") {
        if (!g.personelAdi) g.personelAdi = nameCheck;
        g.category = "tedarikci";
      }
    }
    const sirali = tumGiderler.sort((a: any, b: any) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return c.json({ giderler: sirali });
  } catch (err) {
    console.log("Get isletme giderler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/isletme/giderler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const body = await c.req.json();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const gider = {
      ...body,
      id,
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email,
    };
    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);
    await ckv.set(`isletme_gider_${id}`, gider);
    pgWrite("operating_expenses", "insert", {
      id, company_id: companyId, category: body.category || null, description: body.description || body.personelAdi || null,
      amount: Number(body.amount) || 0, currency: body.currency || "TRY", date: body.date || null,
      venue_id: body.mekanId || null, recurring_id: body.recurringId || null,
      payment_status: body.paymentStatus || "pending", created_by: gider.created_by, extra_data: body,
    });
    return c.json({ gider }, 201);
  } catch (err) {
    console.log("Create isletme gider error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.put("/make-server-4da0b637/isletme/giderler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`isletme_gider_${id}`);
    if (!existing) return c.json({ error: "Gider bulunamadı." }, 404);
    const body = await c.req.json();
    const gider = { ...existing, ...body, id };
    await ckv.set(`isletme_gider_${id}`, gider);
    pgWrite("operating_expenses", "upsert", {
      id, company_id: getCompanyId(user), category: gider.category || null, description: gider.description || gider.personelAdi || null,
      amount: Number(gider.amount) || 0, currency: gider.currency || "TRY", date: gider.date || null,
      venue_id: gider.mekanId || null, payment_status: gider.paymentStatus || "pending", extra_data: gider,
    });

    // Kasa senkronu: tutar değiştiyse kasa_odeme kaydını da güncelle
    if (body.amount !== undefined && Number(body.amount) !== Number(existing.amount)) {
      const odemeKey = `kasa_odeme_${id}`;
      const odeme = await ckv.get(odemeKey);
      if (odeme) {
        const yeniTutar = Number(body.amount);
        odeme.odpienenTutar = yeniTutar;
        if (odeme.odemeler?.length) {
          odeme.odemeler[odeme.odemeler.length - 1].tutar = yeniTutar;
        }
        await ckv.set(odemeKey, odeme);
      }
    }

    return c.json({ gider });
  } catch (err) {
    console.log("Update isletme gider error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.delete("/make-server-4da0b637/isletme/giderler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "idari"].includes(callerRole)) {
      return c.json({ error: "Silme için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`isletme_gider_${id}`);
    pgWrite("operating_expenses", "delete", null, { id });
    return c.json({ message: "Gider silindi." });
  } catch (err) {
    console.log("Delete isletme gider error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// İŞLETME GELİRLERİ: CRUD (isletme_gelir_)
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/isletme/gelirler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Bu sayfaya erişim yetkiniz yok." }, 403);
    }
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const companyId = (isSA && reqCId) ? reqCId : getCompanyId(user);

    // SQL read geçici devre dışı — KV'den oku
    const ckv = companyKvFor(companyId);
    const tumGelirler: any[] = await ckv.getByPrefix("isletme_gelir_") || [];
    const sirali = tumGelirler.sort((a: any, b: any) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return c.json({ gelirler: sirali });
  } catch (err) {
    console.log("Get isletme gelirler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/isletme/gelirler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const body = await c.req.json();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const gelir = {
      ...body,
      id,
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email,
    };
    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);
    await ckv.set(`isletme_gelir_${id}`, gelir);
    pgWrite("operating_income", "insert", {
      id, company_id: companyId, description: body.description || null,
      amount: Number(body.amount) || 0, currency: body.currency || "TRY",
      date: body.date || null, source: body.source || null, created_by: gelir.created_by, extra_data: body,
    });
    return c.json({ gelir }, 201);
  } catch (err) {
    console.log("Create isletme gelir error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.put("/make-server-4da0b637/isletme/gelirler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`isletme_gelir_${id}`);
    if (!existing) return c.json({ error: "Gelir bulunamadı." }, 404);
    const body = await c.req.json();
    const gelir = { ...existing, ...body, id };
    await ckv.set(`isletme_gelir_${id}`, gelir);
    pgWrite("operating_income", "upsert", {
      id, company_id: getCompanyId(user), description: gelir.description || null,
      amount: Number(gelir.amount) || 0, currency: gelir.currency || "TRY",
      date: gelir.date || null, source: gelir.source || null, extra_data: gelir,
    });
    return c.json({ gelir });
  } catch (err) {
    console.log("Update isletme gelir error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.delete("/make-server-4da0b637/isletme/gelirler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "idari"].includes(callerRole)) {
      return c.json({ error: "Silme için yetkiniz yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`isletme_gelir_${id}`);
    pgWrite("operating_income", "delete", null, { id });
    return c.json({ message: "Gelir silindi." });
  } catch (err) {
    console.log("Delete isletme gelir error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MEKAN ZİYARETLERİ: CRUD
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/ziyaretler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (["bekleyen", "personel"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    const all: any[] = await ckv.getByPrefix("mekan_ziyaret_") || [];
    all.sort((a: any, b: any) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
    return c.json({ ziyaretler: all });
  } catch (err) { console.log("Get ziyaretler error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.post("/make-server-4da0b637/ziyaretler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const body = await c.req.json();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ziyaret = { ...body, id, created_at: new Date().toISOString(), created_by: user.user_metadata?.full_name || user.email };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`mekan_ziyaret_${id}`, ziyaret);
    return c.json({ ziyaret }, 201);
  } catch (err) { console.log("Create ziyaret error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.put("/make-server-4da0b637/ziyaretler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`mekan_ziyaret_${id}`);
    if (!existing) return c.json({ error: "Ziyaret bulunamadı." }, 404);
    const body = await c.req.json();
    const ziyaret = { ...existing, ...body, id };
    await ckv.set(`mekan_ziyaret_${id}`, ziyaret);
    return c.json({ ziyaret });
  } catch (err) { console.log("Update ziyaret error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.delete("/make-server-4da0b637/ziyaretler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`mekan_ziyaret_${id}`);
    return c.json({ message: "Ziyaret silindi." });
  } catch (err) { console.log("Delete ziyaret error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ──────────────────────────────────────────
// PERSONEL GÖRÜŞMELERİ: CRUD
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/gorusmeler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (["bekleyen", "personel"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const isSAGorusme = user.user_metadata?.originalRole === "superadmin";
    const reqCIdGorusme = c.req.query("company_id");
    const ckv = companyKvFor((isSAGorusme && reqCIdGorusme) ? reqCIdGorusme : getCompanyId(user));
    const all: any[] = await ckv.getByPrefix("personel_gorusme_") || [];
    const callerName = user.user_metadata?.full_name || user.email;
    const filtered = ["yonetici", "ust-mudur"].includes(callerRole) ? all : all.filter((g: any) => g.managerName === callerName);
    filtered.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return c.json({ gorusmeler: filtered });
  } catch (err) { console.log("Get gorusmeler error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.post("/make-server-4da0b637/gorusmeler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const body = await c.req.json();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const gorusme = { ...body, id, created_at: new Date().toISOString(), managerName: body.managerName || user.user_metadata?.full_name || user.email };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`personel_gorusme_${id}`, gorusme);
    return c.json({ gorusme }, 201);
  } catch (err) { console.log("Create gorusme error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.put("/make-server-4da0b637/gorusmeler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`personel_gorusme_${id}`);
    if (!existing) return c.json({ error: "Görüşme bulunamadı." }, 404);
    const body = await c.req.json();
    await ckv.set(`personel_gorusme_${id}`, { ...existing, ...body, id });
    return c.json({ gorusme: { ...existing, ...body, id } });
  } catch (err) { console.log("Update gorusme error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.delete("/make-server-4da0b637/gorusmeler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`personel_gorusme_${id}`);
    return c.json({ message: "Görüşme silindi." });
  } catch (err) { console.log("Delete gorusme error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ──────────────────────────────────────────
// MÜDÜR RAPORLARI: CRUD
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/mudur-raporlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (["bekleyen", "personel", "operasyon"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const isSAMudur = user.user_metadata?.originalRole === "superadmin";
    const reqCIdMudur = c.req.query("company_id");
    const ckv = companyKvFor((isSAMudur && reqCIdMudur) ? reqCIdMudur : getCompanyId(user));
    const all: any[] = await ckv.getByPrefix("mudur_rapor_") || [];
    const callerName = user.user_metadata?.full_name || user.email;
    const filtered = ["yonetici", "ust-mudur"].includes(callerRole) ? all : all.filter((r: any) => r.managerName === callerName);
    filtered.sort((a: any, b: any) => new Date(b.created_at || b.startDate).getTime() - new Date(a.created_at || a.startDate).getTime());
    return c.json({ raporlar: filtered });
  } catch (err) { console.log("Get mudur-raporlar error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.post("/make-server-4da0b637/mudur-raporlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const body = await c.req.json();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const rapor = { ...body, id, created_at: new Date().toISOString(), managerName: body.managerName || user.user_metadata?.full_name || user.email };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`mudur_rapor_${id}`, rapor);
    return c.json({ rapor }, 201);
  } catch (err) { console.log("Create mudur-rapor error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.put("/make-server-4da0b637/mudur-raporlar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`mudur_rapor_${id}`);
    if (!existing) return c.json({ error: "Rapor bulunamadı." }, 404);
    const body = await c.req.json();
    await ckv.set(`mudur_rapor_${id}`, { ...existing, ...body, id });
    return c.json({ rapor: { ...existing, ...body, id } });
  } catch (err) { console.log("Update mudur-rapor error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.delete("/make-server-4da0b637/mudur-raporlar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`mudur_rapor_${id}`);
    return c.json({ message: "Rapor silindi." });
  } catch (err) { console.log("Delete mudur-rapor error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ──────────────────────────────────────────
// ROTASYON: Personel listesi (rotasyon için)
// GET /make-server-4da0b637/rotasyon/personel
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/rotasyon/personel", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const supabase = getAdminClient();
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) return c.json({ error: `Kullanıcılar yüklenemedi: ${error.message}` }, 400);

    const roleAvatars: Record<string, string> = {
      'yonetici': '👨‍💼', 'ust-mudur': '👩‍💼', 'mudur': '🧑‍💼',
      'operasyon': '👨‍🔧', 'personel': '👤', 'idari': '👩‍💻',
    };

    // ── Şirket izolasyonu: sadece aynı şirketin personelini döndür ──
    const isSARot = user.user_metadata?.originalRole === "superadmin";
    const reqCIdRot = c.req.query("company_id");
    const companyId = (isSARot && reqCIdRot) ? reqCIdRot : getCompanyId(user);

    const staffMembers = users
      .filter(u => {
        const userCompany = u.user_metadata?.company_id || "aspect";
        if (userCompany !== companyId) return false;
        return u.user_metadata?.role && u.user_metadata.role !== 'bekleyen';
      })
      .map(u => ({
        id: u.id,
        name: u.user_metadata?.full_name || u.email || 'İsimsiz',
        avatar: roleAvatars[u.user_metadata?.role as string] || '👤',
        role: u.user_metadata?.role || 'personel',
        status: 'active',
      }));

    console.log(`[rotasyon/personel] company=${companyId} → ${staffMembers.length} personel`);
    return c.json({ staffMembers });
  } catch (err) {
    console.log("Get rotasyon personel error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ROTASYON: Görevler CRUD
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/rotasyon/gorevler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const isSAGorev = user.user_metadata?.originalRole === "superadmin";
    const reqCIdGorev = c.req.query("company_id");
    const companyId = (isSAGorev && reqCIdGorev) ? reqCIdGorev : getCompanyId(user);

    // SQL read geçici devre dışı — KV'den oku
    const ckv = companyKvFor(companyId);
    const tasks = await ckv.getByPrefix("rotation_task_");
    return c.json({ tasks: tasks || [] });
  } catch (err) {
    console.log("Get gorevler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/rotasyon/gorevler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "operasyon"].includes(callerRole)) {
      return c.json({ error: "Görev oluşturma yetkisi yok." }, 403);
    }
    const body = await c.req.json();
    if (!body.id) return c.json({ error: "Görev ID gerekli." }, 400);
    const task = { ...body, created_by: user.id };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`rotation_task_${body.id}`, task);
    pgWrite("rotation_tasks", "upsert", {
      id: body.id, company_id: getCompanyId(user), date: task.date, location: task.location,
      location_icon: task.locationIcon || "📍", start_time: task.startTime, end_time: task.endTime,
      task_type: task.taskType || "regular", status: task.status || "draft",
      personnel: task.personnel || [], notes: task.notes || null, created_by: user.id, extra_data: task,
    });
    console.log(`Görev oluşturuldu: ${body.id} by ${user.id}`);

    // Personellere bildirim gönder (sadece sent/revised durumundaki görevler)
    if (['sent', 'revised'].includes(task.status || '') && Array.isArray(task.personnel) && task.personnel.length > 0) {
      const dateStr = task.date || 'Bilinmeyen Tarih';
      const location = task.location || 'Bilinmeyen Mekan';
      await Promise.all(task.personnel.map((p: any) => {
        if (!p.id) return Promise.resolve();
        return createNotification(
          p.id, 'rotation_assigned', 'Yeni Görev Atandı',
          `${dateStr} — ${location} görevine atandınız.`,
          { taskId: task.id, date: task.date, location: task.location, taskType: task.taskType }
        );
      }));
    }

    return c.json({ task }, 201);
  } catch (err) {
    console.log("Create gorev error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.put("/make-server-4da0b637/rotasyon/gorevler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "operasyon"].includes(callerRole)) {
      return c.json({ error: "Görev güncelleme yetkisi yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    let existing = await ckv.get(`rotation_task_${id}`);
    // Güvenli fallback: doğrudan anahtar bulunamazsa tüm görevler arasında id ile ara
    // (legacy/prefix uyumsuzluğu veya KV null/undefined davranışı durumunda koruma)
    if (!existing) {
      const allTasks: any[] = await ckv.getByPrefix("rotation_task_").catch(() => []);
      existing = allTasks.find((t: any) => t?.id === id) ?? null;
      if (existing) {
        console.log(`[updateTask] doğrudan anahtar bulunamadı, prefix arama ile bulundu: ${id}`);
      }
    }
    if (!existing) return c.json({ error: "Görev bulunamadı." }, 404);
    const body = await c.req.json();
    const task = { ...existing, ...body };
    await ckv.set(`rotation_task_${id}`, task);
    pgWrite("rotation_tasks", "upsert", {
      id, company_id: getCompanyId(user), date: task.date, location: task.location,
      location_icon: task.locationIcon || "📍", start_time: task.startTime, end_time: task.endTime,
      task_type: task.taskType || "regular", status: task.status || "draft",
      personnel: task.personnel || [], notes: task.notes || null, extra_data: task,
    });
    console.log(`Görev güncellendi: ${id} by ${user.id}`);

    // Personel değişiklik bildirimleri
    if (['sent', 'revised'].includes(task.status || '')) {
      const oldStatus = existing.status || 'draft';
      const oldPersonnelIds = new Set((existing.personnel || []).map((p: any) => p.id));
      const newPersonnelIds = new Set((task.personnel || []).map((p: any) => p.id));
      const dateStr = task.date || 'Bilinmeyen Tarih';
      const location = task.location || 'Bilinmeyen Mekan';
      const oldLocation = existing.location || location;
      const oldDate = existing.date || dateStr;

      // draft → sent geçişi: TÜM personeli bildir (daha önce bildirim almadılar)
      const statusBecameSent = ['draft'].includes(oldStatus) && task.status === 'sent';

      for (const p of (task.personnel || [])) {
        if (!p.id) continue;
        if (statusBecameSent || !oldPersonnelIds.has(p.id)) {
          await createNotification(p.id, 'rotation_assigned', 'Yeni Görev Atandı',
            `${dateStr} — ${location} g��revine atandınız.`,
            { taskId: id, date: task.date, location: task.location }
          );
        } else if (oldLocation !== location || oldDate !== dateStr) {
          await createNotification(p.id, 'rotation_changed', 'Göreviniz Güncellendi',
            `${oldLocation !== location ? `${oldLocation} → ${location}` : location}, ${dateStr}.`,
            { taskId: id, oldLocation, newLocation: location, date: dateStr }
          );
        }
      }
      // Görevden çıkarılanlar (draft→sent geçişinde değil)
      if (!statusBecameSent) {
        for (const p of (existing.personnel || [])) {
          if (!p.id) continue;
          if (!newPersonnelIds.has(p.id)) {
            await createNotification(p.id, 'rotation_removed', 'Görevden Alındınız',
              `${oldDate} — ${oldLocation} görevi güncellendi, bu görevde yer almıyorsunuz.`,
              { taskId: id, date: oldDate, location: oldLocation }
            );
          }
        }
      }
    }

    return c.json({ task });
  } catch (err) {
    console.log("Update gorev error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.delete("/make-server-4da0b637/rotasyon/gorevler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "operasyon"].includes(callerRole)) {
      return c.json({ error: "Görev silme yetkisi yok." }, 403);
    }
    const { id } = c.req.param();
    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);
    let existingTask = await ckv.get(`rotation_task_${id}`);
    // Fallback: tüm görevler arasında ara (legacy anahtar uyumsuzluğu koruması)
    if (!existingTask) {
      const allTasks: any[] = await ckv.getByPrefix("rotation_task_").catch(() => []);
      existingTask = allTasks.find((t: any) => t?.id === id) ?? null;
    }
    // Hem prefix'li hem legacy anahtarı sil (company_kv.del artık her ikisini de siler)
    await ckv.del(`rotation_task_${id}`);
    // Ekstra güvence: aspect için global legacy anahtarını da doğrudan sil
    if (companyId === "aspect") {
      await kv.del(`rotation_task_${id}`).catch(() => {});
    }
    console.log(`Görev silindi: ${id} by ${user.id} (company: ${companyId})`);

    // Eski personellere bildirim gönder
    if (existingTask && Array.isArray(existingTask.personnel) && existingTask.personnel.length > 0) {
      const dateStr = existingTask.date || 'Bilinmeyen Tarih';
      const location = existingTask.location || 'Bilinmeyen Mekan';
      await Promise.all(existingTask.personnel.map((p: any) => {
        if (!p.id) return Promise.resolve();
        return createNotification(p.id, 'rotation_removed', 'Görev İptal Edildi',
          `${dateStr} — ${location} görevi silindi.`,
          { taskId: id, date: existingTask.date, location: existingTask.location }
        );
      }));
    }

    return c.json({ message: "Görev silindi." });
  } catch (err) {
    console.log("Delete gorev error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ROTASYON: İzin Talepleri CRUD
// ──��───────────────────────────────────────
app.get("/make-server-4da0b637/rotasyon/izinler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const isSAIzin = user.user_metadata?.originalRole === "superadmin";
    const reqCIdIzin = c.req.query("company_id");
    const companyId = (isSAIzin && reqCIdIzin) ? reqCIdIzin : getCompanyId(user);

    // SQL read geçici devre dışı — KV'den oku
    const ckv = companyKvFor(companyId);
    const leaveRequests = await ckv.getByPrefix("rotation_leave_");
    return c.json({ leaveRequests: leaveRequests || [] });
  } catch (err) {
    console.log("Get izinler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/rotasyon/izinler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const body = await c.req.json();
    if (!body.id) return c.json({ error: "İzin ID gerekli." }, 400);
    const ckv = companyKvFor(getCompanyId(user));
    const leave = { ...body, created_by: user.id };
    await ckv.set(`rotation_leave_${body.id}`, leave);
    pgWrite("leave_requests", "upsert", {
      id: body.id, company_id: getCompanyId(user), personnel_id: body.personnelId || "",
      personnel_name: body.personnelName || "", personnel_avatar: body.personnelAvatar || "",
      personnel_role: body.personnelRole || "", start_date: body.startDate, end_date: body.endDate,
      days: Number(body.days) || 1, type: body.type || "annual", notes: body.notes || null, status: body.status || "pending", extra_data: leave,
    });
    console.log(`İzin talebi oluşturuldu: ${body.id} by ${user.id}`);

    // Yöneticilere bildirim gönder
    try {
      const sbAdmin = getAdminClient();
      const { data: { users: allUsers } } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 });
      const managers = (allUsers || []).filter((u: any) => u.user_metadata?.role === 'yonetici');
      const personnelName = body.personnelName || 'Bir personel';
      const startDate = body.startDate || '';
      const endDate = body.endDate || body.startDate || '';
      const dateRange = startDate === endDate ? startDate : `${startDate} – ${endDate}`;
      await Promise.all(managers.map((m: any) =>
        createNotification(m.id, 'izin_talebi', 'Yeni İzin Talebi',
          `${personnelName} izin talep etti — ${dateRange}`,
          { leaveId: body.id, personnelId: body.personnelId, personnelName, startDate, endDate }
        )
      ));
    } catch (ne) {
      console.log("İzin bildirimi hatası:", ne);
    }

    return c.json({ leave }, 201);
  } catch (err) {
    console.log("Create izin error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.put("/make-server-4da0b637/rotasyon/izinler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`rotation_leave_${id}`);
    if (!existing) return c.json({ error: "İzin talebi bulunamadı." }, 404);
    const body = await c.req.json();
    const leave = { ...existing, ...body };
    await ckv.set(`rotation_leave_${id}`, leave);
    pgWrite("leave_requests", "upsert", {
      id, company_id: getCompanyId(user), personnel_id: leave.personnelId || "",
      personnel_name: leave.personnelName || "", start_date: leave.startDate, end_date: leave.endDate,
      days: Number(leave.days) || 1, type: leave.type || "annual", notes: leave.notes || null, status: leave.status || "pending", extra_data: leave,
    });
    console.log(`İzin güncellendi: ${id} by ${user.id}`);

    // Durum değişikliği bildirimi → personele
    if (body.status && body.status !== existing.status && ['approved', 'rejected'].includes(body.status)) {
      const recipientId = existing.personnelId || existing.created_by;
      if (recipientId) {
        const startDate = existing.startDate || '';
        const endDate = existing.endDate || startDate;
        const dateRange = startDate === endDate ? startDate : `${startDate} – ${endDate}`;
        if (body.status === 'approved') {
          await createNotification(recipientId, 'izin_onaylandi', 'İzin Talebiniz Onaylandı',
            `${dateRange} tarihli izin talebiniz onaylandı.`,
            { leaveId: id, startDate, endDate }
          );
        } else {
          await createNotification(recipientId, 'izin_reddedildi', 'İzin Talebiniz Reddedildi',
            `${dateRange} tarihli izin talebiniz reddedildi.`,
            { leaveId: id, startDate, endDate }
          );
        }
      }
    }

    return c.json({ leave });
  } catch (err) {
    console.log("Update izin error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.delete("/make-server-4da0b637/rotasyon/izinler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "İzin silme yetkisi yok." }, 403);
    }
    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`rotation_leave_${id}`);
    console.log(`İzin silindi: ${id} by ${user.id}`);
    return c.json({ message: "İzin talebi silindi." });
  } catch (err) {
    console.log("Delete izin error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ROTASYON: Günlük İzin Durumu
// GET /make-server-4da0b637/rotasyon/gunluk-izin
// PUT /make-server-4da0b637/rotasyon/gunluk-izin
// ───────────────────────────────────────���──
app.get("/make-server-4da0b637/rotasyon/gunluk-izin", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    const dailyOnLeave = await ckv.get("rotation_daily_onleave") || {};
    return c.json({ dailyOnLeave });
  } catch (err) {
    console.log("Get gunluk-izin error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.put("/make-server-4da0b637/rotasyon/gunluk-izin", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "operasyon"].includes(callerRole)) {
      return c.json({ error: "Yetki yok." }, 403);
    }
    const body = await c.req.json();
    const ckv = companyKvFor(getCompanyId(user));
    const oldDailyOnLeave: Record<string, string[]> = await ckv.get("rotation_daily_onleave") || {};
    await ckv.set("rotation_daily_onleave", body.dailyOnLeave);

    // Yeni izinli eklenen kişilere bildirim gönder
    const newDailyOnLeave: Record<string, string[]> = body.dailyOnLeave || {};
    for (const [date, userIds] of Object.entries(newDailyOnLeave)) {
      const oldIds = new Set<string>(oldDailyOnLeave[date] || []);
      for (const uid of (userIds as string[])) {
        if (!oldIds.has(uid)) {
          await createNotification(uid, 'izinli_atandi', 'İzinli Olarak İşaretlendiniz',
            `${date} tarihiniz izinli olarak işaretlendi.`,
            { date }
          );
        }
      }
    }

    return c.json({ dailyOnLeave: body.dailyOnLeave });
  } catch (err) {
    console.log("Put gunluk-izin error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Günlük kayıt getir
// GET /stok/gunluk/:mekanId/:tarih
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/stok/gunluk/:mekanId/:tarih", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));

    const { mekanId, tarih } = c.req.param();
    const bugunRaw = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`);

    // ── Baskı maliyeti kur düzeltmesi ��─
    // Eski kayıtlarda toplamMaliyet yabancı para birimi cinsinden TL gibi kaydedilmiş olabilir.
    // GET sırasında on-the-fly kur uygulanarak doğru TL değeri hesaplanır.
    let bugun = bugunRaw;
    if (bugunRaw?.vardiyaToplam) {
      const vt = bugunRaw.vardiyaToplam;
      const paperCur: string = vt.paperCurrency || vt.currency || "TRY";
      // Eğer kur dönüşümü daha önce yapılmamışsa (kurCarpani eksikse veya 1'se)
      const kurZatenUygulanmis = !!vt.kurCarpani && vt.kurCarpani !== 1;
      if (paperCur !== "TRY" && !kurZatenUygulanmis) {
        const exRates = await ckv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20 };
        const kur = paperCur === "EUR" ? Number(exRates.EUR) || 35.50
          : paperCur === "USD" ? Number(exRates.USD) || 32.80
          : paperCur === "GBP" ? Number(exRates.GBP) || 41.20
          : 1;
        const duzeltilmisMaliyet = parseFloat((vt.toplamMaliyet * kur).toFixed(2));
        const duzeltilmisBirimMaliyet = parseFloat((vt.birimMaliyet * kur).toFixed(4));
        bugun = {
          ...bugunRaw,
          vardiyaToplam: {
            ...vt,
            toplamMaliyet: duzeltilmisMaliyet,
            birimMaliyet: duzeltilmisBirimMaliyet,
            kurCarpani: kur,
            currency: "TRY",
          },
        };
      }
    }

    const dunTarih = new Date(tarih);
    dunTarih.setDate(dunTarih.getDate() - 1);
    const dunStr = dunTarih.toISOString().split("T")[0];

    // ── Bağımsız KV okumalarını paralel çalıştır (timeout riskini azaltır) ─
    const [dun, tumEklemelerRaw, tumAktarimlarRaw, tumEkipmanlarRaw] = await Promise.all([
      ckv.get(`stok_gunluk_${mekanId}_${dunStr}`).catch(() => null),
      ckv.getByPrefix(`stok_ekleme_`).catch(() => []),
      ckv.getByPrefix(`stok_aktarim_`).catch(() => []),
      ckv.getByPrefix(`ekipman_`).catch(() => []),
    ]);

    const tumEklemeler: any[] = tumEklemelerRaw || [];
    const tumAktarimlar: any[] = tumAktarimlarRaw || [];
    const tumEkipmanlar: any[] = tumEkipmanlarRaw || [];

    const eklemeler = tumEklemeler.filter(
      (e: any) => e.mekanId === mekanId && e.tarih === tarih
    );

    const bekleyenAktarimlar = tumAktarimlar.filter(
      (a: any) => a.hedefMekanId === mekanId && a.durum === "bekliyor"
    );

    // ── Mekana bağlı ekipman yazıcılarını çek ──────────────────────────────
    const mekanYazicilariRaw = tumEkipmanlar.filter((eq: any) =>
      eq.category === 'printer' &&
      eq.locationId === mekanId &&
      eq.status !== 'broken'
    ).map((yazici: any) => ({
      ekipmanId: yazici.id,
      brand: yazici.brand || '',
      model: yazici.model || '',
      serialNumber: yazici.serialNumber || '',
      status: yazici.status || 'working',
      kagitTipiId: yazici.kagitTipiId || null,
      ribonMevcut: (yazici.ribonMevcut !== undefined && yazici.ribonMevcut !== null)
        ? Number(yazici.ribonMevcut)
        : null,
    }));

    // Fallback: ribonMevcut yoksa son 7 günlük kapanış kayıtlarını PARALEL çek
    if (mekanYazicilariRaw.length > 0) {
      const eksikler = mekanYazicilariRaw.filter((y: any) => y.ribonMevcut === null);
      if (eksikler.length > 0) {
        const baseDate = new Date(tarih);
        const gunStrler = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - (i + 1));
          return d.toISOString().split('T')[0];
        });
        const gunKayitlar = await Promise.all(
          gunStrler.map(gStr => ckv.get(`stok_gunluk_${mekanId}_${gStr}`).catch(() => null))
        );
        for (const gunKayit of gunKayitlar) {
          if (eksikler.every((y: any) => y.ribonMevcut !== null)) break;
          if (!gunKayit?.printerData || !Array.isArray(gunKayit.printerData)) continue;
          for (const pr of gunKayit.printerData) {
            const eid = pr.ekipmanId || pr.id;
            if (!eid) continue;
            const yazici = eksikler.find((y: any) => y.ekipmanId === eid && y.ribonMevcut === null);
            if (yazici && pr.endCounter !== undefined) {
              yazici.ribonMevcut = Number(pr.endCounter);
            }
          }
        }
      }
    }

    return c.json({
      bugun: bugun || null,
      dunKapanis: dun?.kapanish || null,
      eklemeler,
      bekleyenAktarimlar,
      mekanYazicilari: mekanYazicilariRaw,
    });
  } catch (err) {
    console.log("Get stok gunluk error (kur düzeltmesi dahil):", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ────────────────────────────────────���─────
// HELPER: Personel rotasyon kontrolü
// Personel rolündeki kullanıcının belirli mekana bugün atanmış olup olmadığını kontrol eder.
// Yönetici rolleri için her zaman true döner.
// ──────────────────────────────────────────
const checkRotasyonYetkisi = async (userId: string, role: string, mekanId: string, tarih: string, companyId: string = "aspect"): Promise<boolean> => {
  // SADECE yonetici ve superadmin rotasyonu bypass eder
  if (role === "yonetici" || role === "superadmin") return true;
  // Diğer herkes (ust-mudur, mudur, operasyon, personel, idari vb.) rotasyona tabi
  const ckv = companyKvFor(companyId);

  // Mekana ait lokasyon adını al
  const mekan: any = await ckv.get(`mekan_${mekanId}`);
  if (!mekan) return false;
  const mekanAdi: string = mekan.name || "";

  // Bugüne ait rotasyon görevlerini tara
  const tasks: any[] = await ckv.getByPrefix("rotation_task_") || [];
  const atanmis = tasks.some((t: any) => {
    if (t.date !== tarih) return false;
    if (!["sent", "revised"].includes(t.status)) return false;
    // taskType: regular/extra/special — sadece regular için mekan adıyla eşleştir
    if ((t.taskType === "regular" || !t.taskType) && t.location !== mekanAdi) return false;
    if (t.taskType === "extra" && t.location !== mekanAdi) return false;
    return Array.isArray(t.personnel) && t.personnel.some((p: any) => p.id === userId);
  });

  return atanmis;
};

// ──────────────────────────────────────────
// STOK: Açılış kaydet
// POST /stok/acilis
// Body: { mekanId, tarih, sayim, not? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/stok/acilis", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);

    const { mekanId, tarih, sayim, not: acilisNot, printerData, photo: acilisPhoto } = await c.req.json();
    if (!mekanId || !tarih || !sayim) {
      return c.json({ error: "mekanId, tarih ve sayim zorunludur." }, 400);
    }

    // Rotasyon yetkisi kontrolü
    const yetkili = await checkRotasyonYetkisi(user.id, callerRole, mekanId, tarih, companyId);
    if (!yetkili) {
      console.log(`Rotasyon yetki reddi — acilis: user=${user.id}, role=${callerRole}, mekan=${mekanId}, tarih=${tarih}`);
      return c.json({ error: "Bu mekana bugünkü rotasyonunuzda atanmamışsınız. Açılış yapma yetkiniz yok." }, 403);
    }

    const dunTarih = new Date(tarih);
    dunTarih.setDate(dunTarih.getDate() - 1);
    const dunStr = dunTarih.toISOString().split("T")[0];
    const dun = await ckv.get(`stok_gunluk_${mekanId}_${dunStr}`);
    const dunKapanisRaw = dun?.kapanish || null;
    const dunKapanis = dunKapanisRaw ? migrateMekanStok({ ...dunKapanisRaw }) : null;
    // Gelen sayımı da migrate et
    const migSayim = migrateMekanStok({ ...sayim });

    const anomali: Record<string, number> = {};
    if (dunKapanis) {
      const alanlar = ["album3_tam","album3_yarim","album5_tam","album5_yarim","album7_tam","album7_yarim","album9_tam","album9_yarim","album11_tam","album11_yarim","album13_tam","album13_yarim","album15_tam","album15_yarim","paspartu","ribon"];
      for (const alan of alanlar) {
        const fark = (migSayim[alan] || 0) - (dunKapanis[alan] || 0);
        if (fark !== 0) anomali[alan] = fark;
      }
      // ribonlar tip bazlı anomali
      const sayimRibonlar: Record<string, number> = sayim.ribonlar || {};
      const dunRibonlar: Record<string, number> = dunKapanis.ribonlar || {};
      const tumRibonTipler = new Set([...Object.keys(sayimRibonlar), ...Object.keys(dunRibonlar)]);
      for (const tip of tumRibonTipler) {
        const fark = (sayimRibonlar[tip] || 0) - (dunRibonlar[tip] || 0);
        if (fark !== 0) anomali[`ribonlar.${tip}`] = fark;
      }
    }

    // ── Yazıcı sayaç anomali tespiti ──────────────────────────────────────
    // Beklenen: ekipman kaydındaki ribonMevcut (önceki kapanışta yazılır)
    const printerAnomali: any[] = [];
    if (printerData && Array.isArray(printerData) && printerData.length > 0) {
      for (const pr of printerData) {
        if (!pr.ekipmanId) continue;
        const startCounter = Number(pr.startCounter) || 0;
        if (startCounter === 0) continue;
        const ekipman: any = await ckv.get(pr.ekipmanId);
        const beklenen = (ekipman?.ribonMevcut !== undefined && ekipman?.ribonMevcut !== null)
          ? Number(ekipman.ribonMevcut)
          : null;
        if (beklenen !== null && startCounter !== beklenen) {
          printerAnomali.push({
            ekipmanId: pr.ekipmanId,
            label: pr.label || `${pr.brand || ''} ${pr.model || ''}`.trim(),
            serialNumber: pr.serialNumber || '',
            startCounter,
            beklenenCounter: beklenen,
            fark: startCounter - beklenen,
          });
        }
      }
    }

    const existing = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`) || {};
    const kayit = {
      ...existing,
      mekanId,
      tarih,
      acilis: migSayim,
      acilisNot: acilisNot || "",
      acilisYapildi: true,
      acilisZamani: new Date().toISOString(),
      acilisYapanId: user.id,
      acilisYapanAd: user.user_metadata?.full_name || user.email,
      acilisAnomali: anomali,
      // Yazıcı açılış verileri (ekipmanId bağlantılı)
      acilisYazicilar: printerData || [],
      acilisYaziciAnomali: printerAnomali,
    };

    await ckv.set(`stok_gunluk_${mekanId}_${tarih}`, kayit);

    // ── PostgreSQL dual-write (açılış) ──
    try {
      const db = getAdminClient();
      await db.from("stock_movements").insert({
        company_id: companyId,
        venue_id: mekanId,
        date: tarih,
        type: "opening",
        stock_data: migSayim,
        printer_data: printerData || null,
        anomaly_data: anomali,
        customer_count: existing.musteriSayisi || null,
        performed_by_id: user.id,
        performed_by_name: user.user_metadata?.full_name || user.email,
        notes: acilisNot || null,
        timestamp: kayit.acilisZamani,
      });
    } catch (sqlErr) {
      console.log(`[dual-write] SQL açılış HATA: ${sqlErr}`);
    }

    console.log(`Stok açılışı (dual): ${mekanId} / ${tarih} by ${user.id} | ${printerData?.length || 0} yazıcı | ${printerAnomali.length} yazıcı anomali`);

    // ── Telegram: Açılış bildirimi (fotoğraflı veya metin) ─────────────
    try {
      const mekanObj: any = await ckv.get(`mekan_${mekanId}`) || await ckv.get(mekanId);
      const mekanAdi = mekanObj?.name || mekanId;
      const mekanEmoji = mekanObj?.emoji || "🏪";
      const kullanici = user.user_metadata?.full_name || user.email || "Bilinmiyor";
      const saatTR = new Date().toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
      const msg = `${mekanEmoji} AÇILIŞ 🟢 ${mekanAdi}\n⏰ ${saatTR} 👤 ${kullanici}`;
      if (acilisPhoto) {
        sendTelegramPhoto(acilisPhoto, msg, getCompanyId(user));
      } else {
        sendTelegramMessage(msg, "HTML", getCompanyId(user));
      }
    } catch (tgErr) {
      console.log("[Telegram] Açılış bildirimi gönderilemedi:", tgErr);
    }

    return c.json({ kayit, anomali, printerAnomali });
  } catch (err) {
    console.log("Post stok acilis error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ─────────────────────────────────��────────
// STOK: Kapanış kaydet
// POST /stok/kapanis
// Body: { mekanId, tarih, sayim, not? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/stok/kapanis", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);

    const { mekanId, tarih, sayim, not: kapanisNot, printerData, photo: kapanisPhoto } = await c.req.json();
    if (!mekanId || !tarih || !sayim) {
      return c.json({ error: "mekanId, tarih ve sayim zorunludur." }, 400);
    }

    // Rotasyon yetkisi kontrolü
    const yetkiliKapanis = await checkRotasyonYetkisi(user.id, callerRole, mekanId, tarih, companyId);
    if (!yetkiliKapanis) {
      console.log(`Rotasyon yetki reddi — kapanis: user=${user.id}, role=${callerRole}, mekan=${mekanId}, tarih=${tarih}`);
      return c.json({ error: "Bu mekana bugünkü rotasyonunuzda atanmamışsınız. Kapanış yapma yetkiniz yok." }, 403);
    }

    const existing = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`);
    if (!existing) return c.json({ error: "Önce açılış kaydı yapılmalıdır." }, 400);

    // Paralel KV okuma
    const [tumEklemelerKapRaw, tumAktarimlarKapRaw] = await Promise.all([
      ckv.getByPrefix(`stok_ekleme_`).catch(() => []),
      ckv.getByPrefix(`stok_aktarim_`).catch(() => []),
    ]);
    const tumEklemeler: any[] = tumEklemelerKapRaw || [];
    const tumAktarimlar: any[] = tumAktarimlarKapRaw || [];
    const eklemeler = tumEklemeler.filter(
      (e: any) => e.mekanId === mekanId && e.tarih === tarih
    );
    const gelenOnaylandi = tumAktarimlar.filter(
      (a: any) => a.hedefMekanId === mekanId && a.tarih === tarih && a.durum === "onaylandi"
    );
    const gidenOnaylandi = tumAktarimlar.filter(
      (a: any) => a.kaynakMekanId === mekanId && a.tarih === tarih && a.durum === "onaylandi"
    );

    // Toplam ribon değişim adedi (tüm yazıcılardan)
    const toplamRibonDegisim = (printerData || []).reduce(
      (sum: number, pr: any) => sum + (Number(pr.ribonDegisim) || 0), 0
    );

    // Ribon değişimlerini kağıt tipine göre grupla (yazıcının kagitTipiId'si üzerinden)
    const ribonDegisimByTip: Record<string, number> = {};
    for (const pr of (printerData || [])) {
      const degisim = Number(pr.ribonDegisim) || 0;
      if (degisim <= 0) continue;
      const ekipmanKaydi: any = await ckv.get(pr.ekipmanId || pr.id).catch(() => null);
      const kagitTipiId: string = ekipmanKaydi?.kagitTipiId || pr.kagitTipiId || "_bilinmeyen";
      ribonDegisimByTip[kagitTipiId] = (ribonDegisimByTip[kagitTipiId] || 0) + degisim;
    }

    const alanlar = ["album3_tam","album3_yarim","album5_tam","album5_yarim","album7_tam","album7_yarim","album9_tam","album9_yarim","album11_tam","album11_yarim","album13_tam","album13_yarim","album15_tam","album15_yarim","paspartu","ribon"];

    // Mekan printType'ını al
    const mekanObjStok: any = await ckv.get(`mekan_${mekanId}`).catch(() => null);
    const mekanPrintType: string = mekanObjStok?.printType || "yarim";
    const tercihSuffix = mekanPrintType === "tam" ? "_tam" : "_yarim";
    const digerSuffix = mekanPrintType === "tam" ? "_yarim" : "_tam";

    // Açılışı migrate et
    if (existing.acilis) existing.acilis = migrateMekanStok({ ...existing.acilis });

    // Günlük iptal olmayan satışlardan albüm stok düşümü
    // Ürün adından sayı çıkarılır: "3'lü" → album3, "13'lü" → album13
    // Önce mekanın kendi tipinden düş, bittiyse diğer tipten düş
    const satislar: any[] = existing.satislar || [];
    const satisAlbumDusum: Record<string, number> = {};
    const farkliTipKullanim: { boyut: number; adet: number; tip: string }[] = [];
    for (const satis of satislar) {
      if (satis.iptal) continue;
      for (const item of (satis.items || [])) {
        if (item.dijital) continue; // Dijital satışlar stoktan düşülmez
        const match = String(item.product || '').match(/^(\d+)/);
        if (match) {
          const sz = match[1];
          const tercihAlan = `album${sz}${tercihSuffix}`;
          const digerAlan = `album${sz}${digerSuffix}`;
          if (!alanlar.includes(tercihAlan)) continue;
          const qty = Number(item.quantity) || 0;
          // Mevcut stok hesabı (açılış - şimdiye kadar düşülen)
          const tercihMevcut = Math.max(0, (existing.acilis?.[tercihAlan] || 0) - (satisAlbumDusum[tercihAlan] || 0));
          if (tercihMevcut >= qty) {
            satisAlbumDusum[tercihAlan] = (satisAlbumDusum[tercihAlan] || 0) + qty;
          } else {
            // Kendi tipi yetmez — kalanını diğer tipten düş
            satisAlbumDusum[tercihAlan] = (satisAlbumDusum[tercihAlan] || 0) + tercihMevcut;
            const kalanQty = qty - tercihMevcut;
            satisAlbumDusum[digerAlan] = (satisAlbumDusum[digerAlan] || 0) + kalanQty;
            if (kalanQty > 0) farkliTipKullanim.push({ boyut: Number(sz), adet: kalanQty, tip: digerSuffix === "_tam" ? "tam" : "yarim" });
          }
        }
      }
    }

    const beklenen: Record<string, number> = {};
    for (const alan of alanlar) {
      let toplam = existing.acilis?.[alan] || 0;
      for (const ek of eklemeler) toplam += ek.miktar?.[alan] || 0;
      for (const ak of gelenOnaylandi) toplam += ak.gercekMiktar?.[alan] || 0;
      for (const ak of gidenOnaylandi) toplam -= ak.gercekMiktar?.[alan] || 0;
      toplam -= satisAlbumDusum[alan] || 0;
      if (alan === "ribon") toplam -= toplamRibonDegisim;
      beklenen[alan] = Math.max(0, toplam);
    }

    // ribonlar tip bazlı beklenen hesabı
    const acilisRibonlar: Record<string, number> = existing.acilis?.ribonlar || {};
    const beklenenRibonlar: Record<string, number> = {};
    const tumRibonTiplerKap = new Set([...Object.keys(acilisRibonlar), ...Object.keys(ribonDegisimByTip)]);
    for (const tip of tumRibonTiplerKap) {
      const toplam = (acilisRibonlar[tip] || 0) - (ribonDegisimByTip[tip] || 0);
      beklenenRibonlar[tip] = Math.max(0, toplam);
    }

    // Kapanış sayımını migrate et
    const migKapSayim = migrateMekanStok({ ...sayim });

    const anomali: Record<string, number> = {};
    for (const alan of alanlar) {
      const fark = (migKapSayim[alan] || 0) - (beklenen[alan] || 0);
      if (fark !== 0) anomali[alan] = fark;
    }
    // ribonlar tip bazlı anomali
    const sayimRibonlarKap: Record<string, number> = sayim.ribonlar || {};
    const tumRibonAnomaliTipler = new Set([...Object.keys(sayimRibonlarKap), ...Object.keys(beklenenRibonlar)]);
    for (const tip of tumRibonAnomaliTipler) {
      const fark = (sayimRibonlarKap[tip] || 0) - (beklenenRibonlar[tip] || 0);
      if (fark !== 0) anomali[`ribonlar.${tip}`] = fark;
    }

    // ── Vardiya Baskı & Maliyet Hesaplamaları ──
    const mekan = await ckv.get(`mekan_${mekanId}`);
    // printType mekan bazlı kalır — yarım/tam kağıt çıkış çarpanı
    const printType: string = mekan?.printType || "yarim"; // "tam" | "yarim"
    const carpan = printType === "tam" ? 1 : 2;

    // Kur dönüşümü için exchange rates (tek seferlik çek)
    const exchangeRates: any = await ckv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20 };

    // Tüm kağıtları tek seferlik çek — her yazıcı kendi kagitTipiId'sine göre kullanacak
    const allPapers: any[] = await ckv.getByPrefix("cost_paper_").catch(() => []) || [];

    // Helper: kağıt ID'sinden paper objesini bul (isim fallback dahil)
    const findPaper = (kagitTipiId: string | null | undefined): any | null => {
      if (!kagitTipiId) return null;
      return allPapers.find((p: any) => p.id === kagitTipiId || p.name === kagitTipiId) || null;
    };

    // Helper: para birimi → kur çarpanı
    const getKur = (currency: string): number => {
      if (currency === "EUR") return Number(exchangeRates.EUR) || 35.50;
      if (currency === "USD") return Number(exchangeRates.USD) || 32.80;
      if (currency === "GBP") return Number(exchangeRates.GBP) || 41.20;
      return 1;
    };

    // Her yazıcı için kendi kagitTipiId'sini kullanarak ayrı ayrı hesapla
    const enrichedPrinterData = await Promise.all((printerData || []).map(async (pr: any) => {
      const acilisSayac = Number(pr.startCounter) || 0;
      const kapanisSayac = Number(pr.endCounter) || 0;
      const degisimAdedi = Number(pr.ribonDegisim) || 0;
      const iadeFotograf = Number(pr.iadeFotograf) || 0;

      // Yazıcının ekipman kaydından kagitTipiId'yi al
      const ekipmanKaydi: any = await ckv.get(pr.ekipmanId || pr.id).catch(() => null);
      const kagitTipiId: string | null = ekipmanKaydi?.kagitTipiId || pr.kagitTipiId || null;
      const yaziciPaper = findPaper(kagitTipiId);

      if (yaziciPaper) {
        console.log(`Yazıcı ${pr.ekipmanId || pr.id}: kağıt="${yaziciPaper.name}" pcs=${yaziciPaper.pcsPerBox} sets=${yaziciPaper.setsPerBox}`);
      }

      // Bu yazıcının kağıdına göre kapasite ve maliyet hesabı
      const safePcsPerBox = Number(yaziciPaper?.pcsPerBox) || 1;
      const safeSetsPerBox = Number(yaziciPaper?.setsPerBox) || 1;
      // kapasitePerTakim: 1 ribon değişiminde kaç fiziksel baskı yapılabilir
      const kapasitePerTakim = yaziciPaper ? (safePcsPerBox / safeSetsPerBox) : 0;

      const paperCur: string = yaziciPaper?.currency || "TRY";
      const kurCarpani = getKur(paperCur);
      // birimMaliyet TL/baskı: (boxPrice / pcsPerBox) × kur
      const birimMaliyetTam = yaziciPaper
        ? (Number(yaziciPaper.boxPrice) / safePcsPerBox) * kurCarpani
        : 0;

      // kullanilanBaskı: açılış + (değişim × kapasitePerTakim) - kapanış
      const kullanilanBaskı = Math.max(
        0, acilisSayac + (degisimAdedi * kapasitePerTakim) - kapanisSayac
      );
      // stokDusum: fiziksel kağıt düşümü (tam/yarım fark etmez — fiziksel sayı)
      const stokDusum = kullanilanBaskı;
      // cikisAdedi: müşteriye çıkan fotoğraf adedi — mekan printType çarpanı uygulanır
      const cikisAdedi = Math.round(kullanilanBaskı * carpan);
      // satılanFotograf: iade çıkarılınca net satış
      const satılanFotograf = Math.max(0, cikisAdedi - iadeFotograf);
      // toplamMaliyet: bu yazıcının kendi kağıdına göre TL maliyet
      const toplamMaliyet = birimMaliyetTam > 0
        ? parseFloat((kullanilanBaskı * birimMaliyetTam).toFixed(4))
        : 0;

      return {
        ...pr,
        kagitTipiId,
        kagitTipiAdi: yaziciPaper?.name || null,
        kapasitePerTakim,
        birimMaliyet: parseFloat(birimMaliyetTam.toFixed(4)),
        paperCurrency: paperCur,
        iadeFotograf,
        kullanilanBaskı,
        stokDusum,
        cikisAdedi,
        satılanFotograf,
        toplamMaliyet,
      };
    }));

    // Vardiya genel toplamları (multi-printer, multi-paper)
    const toplamMaliyet = parseFloat(
      enrichedPrinterData.reduce((s: number, p: any) => s + (p.toplamMaliyet || 0), 0).toFixed(4)
    );
    // paperName: birden fazla kağıt varsa virgülle ayır, tekil ise tek ad
    const kagitAdlari = [...new Set(enrichedPrinterData.map((p: any) => p.kagitTipiAdi).filter(Boolean))];
    const vardiyaToplam = {
      toplamKullanilanBaskı: enrichedPrinterData.reduce((s: number, p: any) => s + (p.kullanilanBaskı || 0), 0),
      toplamStokDusum: enrichedPrinterData.reduce((s: number, p: any) => s + (p.stokDusum || 0), 0),
      toplamCikisAdedi: enrichedPrinterData.reduce((s: number, p: any) => s + (p.cikisAdedi || 0), 0),
      toplamIadeFotograf: enrichedPrinterData.reduce((s: number, p: any) => s + (p.iadeFotograf || 0), 0),
      toplamSatılanFotograf: enrichedPrinterData.reduce((s: number, p: any) => s + (p.satılanFotograf || 0), 0),
      toplamMaliyet,
      printType,
      carpan,
      // Geriye dönük uyumluluk için paperName (birden fazlaysa virgülle)
      paperName: kagitAdlari.join(', ') || null,
      paperCurrency: "TRY", // Kur dönüşümü yapılmış, sonuç her zaman TRY
      kurCarpani: 1,        // Her yazıcı kendi kuru ile hesaplandı
      birimMaliyetOrijinal: 0,
      birimMaliyet: 0,
      currency: "TRY",
    };

    // ── Bitiş Sayacı Anomali Tespiti ─────────────────────────────���───────────
    // Yazıcıların net satılan toplamı vs satış kayıtlarındaki fotoğraf toplamı
    const netSatilanToplam = vardiyaToplam.toplamSatılanFotograf;
    let satisFotografToplam = 0;
    for (const satis of satislar) {
      if (satis.iptal) continue;
      for (const item of (satis.items || [])) {
        const urun = String(item.product || '');
        let fotografSayisi = 0;
        if (urun === '1 Fotoğraf') {
          fotografSayisi = 1;
        } else {
          const match = urun.match(/^(\d+)/);
          if (match) fotografSayisi = Number(match[1]);
        }
        satisFotografToplam += fotografSayisi * (Number(item.quantity) || 0);
      }
    }
    const bitisAnomFark = netSatilanToplam - satisFotografToplam;
    const kapanisYaziciAnomali = Math.abs(bitisAnomFark) > 2 ? {
      netSatilan: netSatilanToplam,
      satisToplam: satisFotografToplam,
      fark: bitisAnomFark,
    } : null;

    const kayit = {
      ...existing,
      kapanish: migKapSayim,
      kapanisNot: kapanisNot || "",
      farkliTipKullanim: farkliTipKullanim.length > 0 ? farkliTipKullanim : undefined,
      satisAlbumDusum,
      kapanisYapildi: true,
      kapanisZamani: new Date().toISOString(),
      kapanisYapanId: user.id,
      kapanisYapanAd: user.user_metadata?.full_name || user.email,
      kapanisAnomali: anomali,
      kapanisBeklenen: beklenen,
      kapanisBeklenenRibonlar: beklenenRibonlar,
      // Yazıcı verileri — hesaplamalar dahil
      printerData: enrichedPrinterData,
      toplamRibonDegisim,
      ribonDegisimByTip,
      // Vardiya baskı & maliyet özeti
      vardiyaToplam,
      // Bitiş sayacı anomalisi (yazıcı net satılan vs satış toplamı)
      kapanisYaziciAnomali: kapanisYaziciAnomali || null,
    };

    await ckv.set(`stok_gunluk_${mekanId}_${tarih}`, kayit);

    // ── PostgreSQL dual-write (kapanış) ──
    try {
      const db = getAdminClient();
      await db.from("stock_movements").insert({
        company_id: companyId,
        venue_id: mekanId,
        date: tarih,
        type: "closing",
        stock_data: migKapSayim,
        printer_data: enrichedPrinterData || null,
        shift_total: vardiyaToplam || null,
        anomaly_data: anomali,
        customer_count: existing.musteriSayisi || null,
        performed_by_id: user.id,
        performed_by_name: user.user_metadata?.full_name || user.email,
        notes: kapanisNot || null,
        timestamp: kayit.kapanisZamani,
      });
    } catch (sqlErr) {
      console.log(`[dual-write] SQL kapanış HATA: ${sqlErr}`);
    }

    // ── Telegram: Kapanış bildirimi (fotoğraflı veya metin) ─────────────────
    try {
      const mekanObjKap: any = await ckv.get(`mekan_${mekanId}`) || await ckv.get(mekanId);
      const mekanAdiKap = mekanObjKap?.name || mekanId;
      const mekanEmojiKap = mekanObjKap?.emoji || "🏪";
      const kullaniciKap = user.user_metadata?.full_name || user.email || "Bilinmiyor";
      const saatTRKap = new Date().toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
      const msgKap = `${mekanEmojiKap} KAPANIŞ 🔴 ${mekanAdiKap}\n⏰ ${saatTRKap} 👤 ${kullaniciKap}`;
      if (kapanisPhoto) {
        sendTelegramPhoto(kapanisPhoto, msgKap, getCompanyId(user));
      } else {
        sendTelegramMessage(msgKap, "HTML", getCompanyId(user));
      }
    } catch (tgErr) {
      console.log("[Telegram] Kapanış bildirimi gönderilemedi:", tgErr);
    }

    // ── Her yazıcının endCounter'ını ekipman ribonMevcut olarak kaydet ──────
    for (const pr of enrichedPrinterData) {
      const eid = pr.ekipmanId || pr.id;
      if (!eid || pr.endCounter === undefined || pr.endCounter === null) continue;
      try {
        const ekipman: any = await ckv.get(eid);
        if (ekipman) {
          await ckv.set(eid, {
            ...ekipman,
            ribonMevcut: Number(pr.endCounter),
          });
        }
      } catch (e) {
        console.log(`Yazıcı ${eid} ekipman kaydı güncellenemedi:`, e);
      }
    }

    console.log(`Stok kapanışı: ${mekanId} / ${tarih} by ${user.id} | kagitlar="${vardiyaToplam.paperName || 'YOK'}" | baskı: ${vardiyaToplam.toplamKullanilanBaskı} | cikis: ${vardiyaToplam.toplamCikisAdedi} | satılan: ${vardiyaToplam.toplamSatılanFotograf} | maliyet: ${vardiyaToplam.toplamMaliyet} TRY | bitisAnomali: ${kapanisYaziciAnomali ? `fark=${kapanisYaziciAnomali.fark}` : 'yok'}`);

    // ── Otomatik checkout: kapanış yapılan mekandaki personeli checkout yap ──
    try {
      const mekanObjCheckout: any = await ckv.get(`mekan_${mekanId}`) || {};
      const mekanAdiCheckout = mekanObjCheckout?.name || mekanId;
      const allTasksCheckout: any[] = await ckv.getByPrefix("rotation_task_").catch(() => []) || [];
      const checkoutTime = new Date().toISOString();
      for (const t of allTasksCheckout) {
        if (t.date !== tarih || t.location !== mekanAdiCheckout) continue;
        if (!["sent", "revised"].includes(t.status)) continue;
        for (const p of (t.personnel || [])) {
          if (!p?.id) continue;
          const existingCheckout = await ckv.get(`checkout_${p.id}_${tarih}`);
          if (!existingCheckout) {
            await ckv.set(`checkout_${p.id}_${tarih}`, { userId: p.id, tarih, checkOutTime: checkoutTime, autoCheckout: true, mekanId });
          }
        }
      }
    } catch (autoCoErr) { console.log("Auto checkout error (non-fatal):", autoCoErr); }

    return c.json({ kayit, anomali, beklenen, kapanisYaziciAnomali });
  } catch (err) {
    console.log("Post stok kapanis error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Açılış + Kapanışı sıfırla (satışlar korunur)
// POST /stok/acilis-sifirla
// Body: { mekanId, tarih }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/stok/acilis-sifirla", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { mekanId, tarih } = await c.req.json();
    if (!mekanId || !tarih) {
      return c.json({ error: "mekanId ve tarih zorunludur." }, 400);
    }

    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);
    const kvKey = `stok_gunluk_${mekanId}_${tarih}`;
    const existing: any = await ckv.get(kvKey);

    if (!existing) {
      return c.json({ error: "Bu tarih için kayıt bulunamadı." }, 404);
    }

    // Satışlar, kare kayıtları ve mekan/tarih bilgisi korunur.
    // Açılış ve kapanışa ait tüm alanlar temizlenir.
    const {
      acilis: _a,
      acilisNot: _an,
      acilisYapildi: _ay,
      acilisZamani: _az,
      acilisYapanId: _ayi,
      acilisYapanAd: _aya,
      acilisAnomali: _aano,
      kapanish: _k,
      kapanisNot: _kn,
      kapanisYapildi: _ky,
      kapanisZamani: _kz,
      kapanisYapanId: _kyi,
      kapanisYapanAd: _kya,
      kapanisAnomali: _kano,
      kapanisBeklenen: _kb,
      printerData: _pd,
      toplamRibonDegisim: _tr,
      vardiyaToplam: _vt,
      yoneticiGuncelleme: _yg,
      yoneticiSifirlama: _ys,
      ...korunan
    } = existing;

    const yeniKayit = {
      ...korunan,
      acilisSifirlamaZamani: new Date().toISOString(),
      acilisSifirlamaYapanId: user.id,
      acilisSifirlamaYapanAd: user.user_metadata?.full_name || user.email,
    };

    await ckv.set(kvKey, yeniKayit);
    console.log(`Açılış+Kapanış sıfırlandı: ${mekanId} / ${tarih} by ${user.id}`);
    return c.json({ message: "Açılış ve kapanış başarıyla sıfırlandı. Satış verileri korundu.", kayit: yeniKayit });
  } catch (err) {
    console.log("Stok acilis-sifirla error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Gün içi ekleme
// POST /stok/ekleme
// Body: { mekanId, tarih, miktar: {...}, not? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/stok/ekleme", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { mekanId, tarih, miktar, not: eklemeNot } = await c.req.json();
    if (!mekanId || !tarih || !miktar) {
      return c.json({ error: "mekanId, tarih ve miktar zorunludur." }, 400);
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ekleme = {
      id, mekanId, tarih, miktar,
      not: eklemeNot || "",
      girenKisiId: user.id,
      girenKisiAd: user.user_metadata?.full_name || user.email,
      girenZaman: new Date().toISOString(),
    };

    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`stok_ekleme_${id}`, ekleme);
    console.log(`Stok ekleme: ${mekanId} / ${tarih} by ${user.id}`);
    return c.json({ ekleme }, 201);
  } catch (err) {
    console.log("Post stok ekleme error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// AKTARIM: Yeni aktarım oluştur
// POST /aktarim
// Body: { kaynakMekanId, hedefMekanId, tarih, miktar, not? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/aktarim", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { kaynakMekanId, hedefMekanId, tarih, miktar, not: aktarimNot } = await c.req.json();
    if (!kaynakMekanId || !hedefMekanId || !tarih || !miktar) {
      return c.json({ error: "kaynakMekanId, hedefMekanId, tarih ve miktar zorunludur." }, 400);
    }
    if (kaynakMekanId === hedefMekanId) {
      return c.json({ error: "Kaynak ve hedef mekan aynı olamaz." }, 400);
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const aktarim = {
      id, kaynakMekanId, hedefMekanId, tarih, miktar,
      not: aktarimNot || "",
      durum: "bekliyor",
      gonderenKisiId: user.id,
      gonderenKisiAd: user.user_metadata?.full_name || user.email,
      gonderimZamani: new Date().toISOString(),
      alanKisiId: null,
      alanKisiAd: null,
      onayZamani: null,
      gercekMiktar: null,
      miktarAnomali: {},
    };

    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`stok_aktarim_${id}`, aktarim);
    console.log(`Aktarım oluşturuldu: ${id} ${kaynakMekanId} → ${hedefMekanId}`);
    return c.json({ aktarim }, 201);
  } catch (err) {
    console.log("Post aktarim error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// AKTARIM: Onayla
// PUT /aktarim/:id/onayla
// Body: { gercekMiktar: {...} }
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/aktarim/:id/onayla", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`stok_aktarim_${id}`);
    if (!existing) return c.json({ error: "Aktarım bulunamadı." }, 404);
    if (existing.durum !== "bekliyor") return c.json({ error: "Bu aktarım zaten işlendi." }, 400);

    const { gercekMiktar } = await c.req.json();

    const alanlar = ["album3","album5","album7","album9","album11","album13","album15","paspartu","ribon"];
    const miktarAnomali: Record<string, number> = {};
    for (const alan of alanlar) {
      const fark = (gercekMiktar?.[alan] || 0) - (existing.miktar?.[alan] || 0);
      if (fark !== 0) miktarAnomali[alan] = fark;
    }

    const updated = {
      ...existing,
      durum: "onaylandi",
      gercekMiktar: gercekMiktar || existing.miktar,
      miktarAnomali,
      alanKisiId: user.id,
      alanKisiAd: user.user_metadata?.full_name || user.email,
      onayZamani: new Date().toISOString(),
    };

    await ckv.set(`stok_aktarim_${id}`, updated);
    console.log(`Aktarım onaylandı: ${id} by ${user.id}`);
    return c.json({ aktarim: updated, miktarAnomali });
  } catch (err) {
    console.log("Put aktarim onayla error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ───────────────────────���──────────────────
// AKTARIM: İptal et
// PUT /aktarim/:id/iptal
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/aktarim/:id/iptal", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { id } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`stok_aktarim_${id}`);
    if (!existing) return c.json({ error: "Aktarım bulunamadı." }, 404);
    if (existing.durum !== "bekliyor") return c.json({ error: "Bu aktarım zaten işlendi." }, 400);

    const updated = {
      ...existing,
      durum: "iptal",
      iptalZamani: new Date().toISOString(),
      iptalEdenId: user.id,
    };
    await ckv.set(`stok_aktarim_${id}`, updated);
    console.log(`Aktarım iptal: ${id} by ${user.id}`);
    return c.json({ aktarim: updated });
  } catch (err) {
    console.log("Put aktarim iptal error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// AKTARIM: Bekleyen aktarımlar (mekan için)
// GET /aktarim/bekleyen/:mekanId
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/aktarim/bekleyen/:mekanId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { mekanId } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const tumAktarimlar = await ckv.getByPrefix(`stok_aktarim_`);
    const bekleyen = tumAktarimlar.filter(
      (a: any) => a.hedefMekanId === mekanId && a.durum === "bekliyor"
    );
    return c.json({ aktarimlar: bekleyen });
  } catch (err) {
    console.log("Get aktarim bekleyen error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Canlı satış feed'i — bugünkü tüm mekanların satışları
// GET /stok/canli-satis
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/stok/canli-satis", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    // ── Tarih hesabı: 05:00 TR kırılımlı iş günü ─────────────────────────────
    // Vardiyalar gece geçtiğinden iş günü TR 05:00'da başlar.
    // TR 00:00-04:59 → hâlâ önceki iş günü sayılır.
    // bizDateTR() bu mantığı zaten içeriyor, ayrıca yesterday gerekmez.
    const today = bizDateTR();
    console.log(`[canli-satis] bizDate=${today} | UTC=${new Date().toISOString()}`);

    // Ghost mod desteği
    const isSuperAdminFeed = user.user_metadata?.originalRole === "superadmin";
    const requestedCompanyIdFeed = c.req.query("company_id");
    const effectiveCompanyIdFeed = (isSuperAdminFeed && requestedCompanyIdFeed)
      ? requestedCompanyIdFeed : getCompanyId(user);

    // Tüm mekanları çek → id→mekan map
    const mekanlarList = await getMekanlarFor(effectiveCompanyIdFeed);
    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) {
      mekanMap[m.id] = m;
    }
    console.log(`[canli-satis] getMekanlar → ${mekanlarList.length} mekan: ${mekanlarList.map((m: any) => m.name).join(", ")}`);

    // Sadece bugünkü stok kayıtlarını çek (bizDateTR gece 03:00 → dün olarak yazar, zaten doğru)
    const ckv = companyKvFor(effectiveCompanyIdFeed);
    const tumKayitlar = await ckv.getByPrefix("stok_gunluk_");
    const bugunKayitlar = (tumKayitlar || []).filter(
      (k: any) => k.tarih === today
    );
    console.log(`[canli-satis] stok_gunluk_ toplam=${tumKayitlar?.length ?? 0}, bugün=${bugunKayitlar.length}`);
    if (bugunKayitlar.length > 0) {
      console.log(`[canli-satis] kayıtlar: ${bugunKayitlar.map((k: any) => `${k.mekanId}→${k.tarih}(${(k.satislar||[]).length}satış)`).join(", ")}`);
    }

    // Satış + Kare kayıtlarını unified feed'e topla
    const feed: any[] = [];
    // Feed'de görünen mekanları da takip et (getMekanlar dışında kalanlar için güvenli net)
    const feedMekanSet: Record<string, any> = {};

    for (const kayit of bugunKayitlar) {
      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍", color: "#9dd9ea" };

      if (!feedMekanSet[kayit.mekanId]) {
        feedMekanSet[kayit.mekanId] = { id: kayit.mekanId, name: mekan.name, emoji: mekan.emoji, color: mekan.color };
      }

      // Satışlar
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      for (const satis of satislar) {
        feed.push({
          type: "satis",
          ...satis,
          mekanId: kayit.mekanId,
          mekanAdi: mekan.name,
          mekanEmoji: mekan.emoji,
          mekanColor: mekan.color,
        });
      }

      // Kare kayıtları
      const kareKayitlari = kayit.kareKayitlari || [];
      for (const kare of kareKayitlari) {
        feed.push({
          type: "kare",
          ...kare,
          mekanId: kayit.mekanId,
          mekanAdi: mekan.name,
          mekanEmoji: mekan.emoji,
          mekanColor: mekan.color,
        });
      }
    }

    // Zamana göre azalan sırala (en yeni önce)
    feed.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const tumSatislar = feed.filter((f) => f.type === "satis");
    const tumKareler = feed.filter((f) => f.type === "kare");

    // Mekanlar listesi: getMekanlar() + feed'de görünen ama listede olmayan mekanlar
    const mekanlarMapFinal: Record<string, any> = {};
    for (const m of mekanlarList) mekanlarMapFinal[m.id] = m;
    for (const [mid, mData] of Object.entries(feedMekanSet)) {
      if (!mekanlarMapFinal[mid]) {
        mekanlarMapFinal[mid] = mData;
        console.log(`[canli-satis] ⚠️ Mekan getMekanlar'da yok ama feed'de satış var: id=${mid} name=${mData.name}`);
      }
    }
    const mekanlarFinal = Object.values(mekanlarMapFinal);

    console.log(`[canli-satis] → ${tumSatislar.length} satış, ${tumKareler.length} kare, ${mekanlarFinal.length} mekan döndürülüyor`);
    return c.json({ feed, satislar: tumSatislar, kareler: tumKareler, mekanlar: mekanlarFinal });
  } catch (err) {
    console.log("Get canli satis error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// YÖNETİCİ DASHBOARD ÖZET
// GET /manager/dashboard-summary
// ══════════════════════════════════════════
app.get("/make-server-4da0b637/manager/dashboard-summary", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    const originalRole = user.user_metadata?.originalRole;
    console.log(`[dashboard-summary] callerRole=${callerRole} originalRole=${originalRole} email=${user.email}`);
    if (!hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      return c.json({ error: "Yetki yok.", debug: { callerRole, originalRole } }, 403);
    }

    // İş günü tarihi (05:00 TR kırılımlı)
    const today = bizDateTR();

    // Superadmin ghost mod: originalRole kontrol et (callerRole yonetici'ye normalize edilmiş)
    const isSuperAdminDash = user.user_metadata?.originalRole === "superadmin";
    const requestedCompanyIdDash = c.req.query("company_id");
    const effectiveCompanyId = (isSuperAdminDash && requestedCompanyIdDash)
      ? requestedCompanyIdDash
      : getCompanyId(user);

    // Otomatik günlük gider oluşturma (non-blocking)
    ensureOtomatikGiderler(effectiveCompanyId).catch(() => {});

    // Mekan haritası — efektif şirkete göre
    const mekanlarList = await getMekanlarFor(effectiveCompanyId);
    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) {
      mekanMap[m.id] = m;
    }

    // Bugünkü stok kayıtları — efektif şirkete göre
    const ckv = companyKvFor(effectiveCompanyId);
    const tumKayitlar = await ckv.getByPrefix("stok_gunluk_");
    const bugunKayitlar = (tumKayitlar || []).filter((k: any) => k.tarih === today);

    let toplamCiro = 0;
    let toplamAdet = 0;
    let toplamKare = 0;
    let toplamBasilan = 0;
    let toplamIadeFoto = 0;
    let toplamIskontoDash = 0;
    let toplamBrutCiroDash = 0;
    let toplamDijitalAdet = 0;
    let toplamFizikselAdet = 0;
    let anomaliSayisi = 0;
    const aktifMekanlar: any[] = [];
    const saatlikData: Record<number, { saat: number; adet: number; ciro: number }> = {};

    for (let h = 8; h <= 22; h++) {
      saatlikData[h] = { saat: h, adet: 0, ciro: 0 };
    }

    for (const kayit of bugunKayitlar) {
      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍", color: "#9dd9ea" };
      const acikMi = !!kayit.acilis && !kayit.kapanish;

      const acilisAnomali = kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0;
      const kapanisAnomali = kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0;
      if (acilisAnomali || kapanisAnomali) anomaliSayisi++;

      const kareKayitlari = kayit.kareKayitlari || [];
      const mekanKare = kareKayitlari.reduce((s: number, k: any) => s + (k.frameCount || 0), 0);
      toplamKare += mekanKare;

      // Kapanmış mekanlardan basılan ve iade fotoğraf toplanır
      if (kayit.vardiyaToplam) {
        toplamBasilan += kayit.vardiyaToplam.toplamCikisAdedi || 0;
        toplamIadeFoto += kayit.vardiyaToplam.toplamIadeFotograf || 0;
      }

      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      let mekanCiro = 0;
      let mekanAdet = 0;

      for (const s of satislar) {
        const finalPrice = s.finalPrice || 0;
        const adet = (s.items || []).reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 1;
        mekanCiro += finalPrice;
        mekanAdet += adet;
        toplamIskontoDash += Number(s.discount) || 0;
        toplamBrutCiroDash += Number(s.totalPrice) || finalPrice;
        for (const item of (s.items || [])) {
          const qty = Number(item.quantity) || 1;
          if (item.dijital) toplamDijitalAdet += qty;
          else toplamFizikselAdet += qty;
        }

        if (s.timestamp) {
          const h = new Date(s.timestamp).getHours();
          if (saatlikData[h]) {
            saatlikData[h].adet += adet;
            saatlikData[h].ciro += finalPrice;
          }
        }
      }

      toplamCiro += mekanCiro;
      toplamAdet += mekanAdet;

      if (acikMi) {
        aktifMekanlar.push({
          id: kayit.mekanId,
          name: mekan.name,
          emoji: mekan.emoji || "📍",
          color: mekan.color || "#9dd9ea",
          satisAdet: mekanAdet,
          ciro: mekanCiro,
          kare: mekanKare,
          acilisZamani: kayit.acilis,
          kotaKademeleri: mekan.kotaKademeleri || [],
        });
      }
    }

    const saatlikArray = Object.values(saatlikData)
      .filter(d => d.adet > 0 || d.ciro > 0)
      .sort((a, b) => a.saat - b.saat)
      .map(d => ({
        saat: `${String(d.saat).padStart(2, "0")}:00`,
        adet: d.adet,
        ciro: Math.round(d.ciro),
      }));

    // ── Albüm dağılımı ────────────────────────────────────────────────���─────
    const albumSayac: Record<string, number> = {};
    for (const kayit of bugunKayitlar) {
      for (const s of (kayit.satislar || []).filter((s: any) => !s.iptal)) {
        for (const item of (s.items || [])) {
          const tip = item.product || "Diğer";
          albumSayac[tip] = (albumSayac[tip] || 0) + (item.quantity || 1);
        }
      }
    }
    const albumDagilimi = Object.entries(albumSayac)
      .map(([tip, adet]) => ({ tip, adet }))
      .sort((a, b) => b.adet - a.adet);

    // ── Mekan bazlı ciro sıralaması ──────────────────────────────────────────
    const mekanCiroList = bugunKayitlar.map((kayit: any) => {
      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍", color: "#9dd9ea" };
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const ciro = satislar.reduce((sum: number, s: any) => sum + (s.finalPrice || 0), 0);
      const adet = satislar.reduce((sum: number, s: any) => {
        return sum + ((s.items || []).reduce((a: number, i: any) => a + (i.quantity || 1), 0) || 1);
      }, 0);
      return {
        id: kayit.mekanId,
        name: mekan.name,
        emoji: mekan.emoji || "📍",
        color: mekan.color || "#9dd9ea",
        ciro: Math.round(ciro),
        adet,
      };
    }).sort((a: any, b: any) => b.ciro - a.ciro).slice(0, 5);

    // ── Personel bazlı performans sıralaması ───────────────────────────────��─
    const personelMap: Record<string, { name: string; ciro: number; satisAdet: number; mekan: string }> = {};
    for (const kayit of bugunKayitlar) {
      const mekanP = mekanMap[kayit.mekanId] || { name: kayit.mekanId };
      const satislarP = (kayit.satislar || []).filter((s: any) => !s.iptal);
      for (const s of satislarP) {
        const name = s.kaydeden || "Bilinmiyor";
        const id = s.kaydedenId || name;
        if (!personelMap[id]) {
          personelMap[id] = { name, ciro: 0, satisAdet: 0, mekan: mekanP.name };
        }
        personelMap[id].ciro += s.finalPrice || 0;
        personelMap[id].satisAdet += (s.items || []).reduce((a: number, i: any) => a + (i.quantity || 1), 0) || 1;
        personelMap[id].mekan = mekanP.name;
      }
    }
    const personelPerformans = Object.entries(personelMap)
      .map(([id, v]) => ({ id, name: v.name, ciro: Math.round(v.ciro), satisAdet: v.satisAdet, mekan: v.mekan }))
      .sort((a, b) => b.ciro - a.ciro);

    // ── Aktif personel: bugün checkin yapmış + checkout yapmamış ──
    const ckv2 = companyKvFor(effectiveCompanyId);
    const [allCheckins2, allCheckouts2] = await Promise.all([
      ckv2.getByPrefix("checkin_").catch(() => []),
      ckv2.getByPrefix("checkout_").catch(() => []),
    ]);
    const bugunCheckins = (allCheckins2 || []).filter((ci: any) => ci?.tarih === today && ci?.userId);
    const bugunCheckoutIds = new Set((allCheckouts2 || []).filter((co: any) => co?.tarih === today && co?.userId).map((co: any) => co.userId));
    const aktifPersonel = bugunCheckins.filter((ci: any) => !bugunCheckoutIds.has(ci.userId));
    const aktifPersonelSayisi = aktifPersonel.length;
    const gecGirisSayisi = bugunCheckins.filter((ci: any) => ci.lateMin > 0).length;

    // Toplam personel: Supabase auth'tan şirketin tüm personelini say
    let toplamPersonelSayisi = 0;
    try {
      const sb = getAdminClient();
      const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 });
      const companyUsers = (users || []).filter((u: any) => {
        const meta = u.user_metadata || {};
        const userCid = (typeof meta.company_id === "string" && meta.company_id.length > 0) ? meta.company_id.toLowerCase() : "aspect";
        return userCid === effectiveCompanyId.toLowerCase() && ['personel', 'operasyon', 'mudur', 'ust-mudur', 'yonetici', 'idari'].includes(meta.role);
      });
      toplamPersonelSayisi = companyUsers.length;
      // Aktif personel detayını user isimleriyle zenginleştir
      const userNameMap: Record<string, string> = {};
      for (const u of companyUsers) { userNameMap[u.id] = u.user_metadata?.full_name || u.user_metadata?.name || u.email || u.id; }
      for (const ci of aktifPersonel) { ci._name = userNameMap[ci.userId] || ci.userId; }
    } catch {}

    console.log(`Manager dashboard: ${today} — ciro:${toplamCiro} adet:${toplamAdet} kare:${toplamKare} anomali:${anomaliSayisi} personel:${personelPerformans.length} aktifPersonel:${aktifPersonelSayisi}/${toplamPersonelSayisi}`);

    return c.json({
      tarih: today,
      toplamCiro: Math.round(toplamCiro),
      toplamAdet,
      toplamKare,
      toplamBasilan,
      toplamIadeFoto,
      toplamIskonto: Math.round(toplamIskontoDash),
      toplamBrutCiro: Math.round(toplamBrutCiroDash),
      toplamDijitalAdet,
      toplamFizikselAdet,
      anomaliSayisi,
      aktifMekanSayisi: aktifMekanlar.length,
      toplamMekanSayisi: bugunKayitlar.length,
      aktifMekanlar,
      saatlikData: saatlikArray,
      albumDagilimi,
      mekanCiroList,
      personelPerformans,
      aktifPersonelSayisi,
      aktifPersonelDetay: aktifPersonel.map((ci: any) => ({ name: ci._name || ci.userId, mekan: ci.location || '', checkinZamani: ci.checkInTime || '' })),
      toplamPersonelSayisi,
      gecGirisSayisi,
    });
  } catch (err) {
    console.log("Manager dashboard-summary error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// PRİM: Aylık rapor — KİŞİ BAZLI prim kayıtları
// GET /primler/rapor?ay=2026-03
// ══════════════════════════════════════════
app.get("/make-server-4da0b637/primler/rapor", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Yetki yok." }, 403);
    }

    // ay parametresi: "2026-03" formatında
    const ay = c.req.query("ay") || new Date().toISOString().slice(0, 7);
    const [yil, ayNo] = ay.split("-").map(Number);

    const isSAPrim = user.user_metadata?.originalRole === "superadmin";
    const reqCIdPrim = c.req.query("company_id");
    const effCIdPrim = (isSAPrim && reqCIdPrim) ? reqCIdPrim : getCompanyId(user);

    // Tüm mekanları çek
    const mekanlarList: any[] = await getMekanlarFor(effCIdPrim);
    const mekanMap: Record<string, any> = {};
    for (const m of mekanlarList) mekanMap[m.id] = m;

    // O aya ait tüm stok kayıtlarını çek
    const ckv = companyKvFor(effCIdPrim);
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
    const ayKayitlari = tumKayitlar.filter((k: any) => {
      if (!k.tarih) return false;
      const [ky, ka] = k.tarih.split("-").map(Number);
      return ky === yil && ka === ayNo;
    });

    // Ödendi kayıtlarını ve iptal edilen (silindi) kayıtları çek
    const odemePrefix = `prim_odendi_`;
    const [tumOdemeler, tumSilindi] = await Promise.all([
      ckv.getByPrefix(odemePrefix).catch(() => []),
      ckv.getByPrefix("prim_silindi_").catch(() => []),
    ]);
    const odemeMap: Record<string, { odendi: boolean; odemeTarihi?: string }> = {};
    for (const o of (tumOdemeler || [])) {
      if (o.key) odemeMap[o.key] = { odendi: o.odendi || false, odemeTarihi: o.odemeTarihi };
    }
    // iptal edilmiş (silindi) orijinalKey'ler
    const silinenKeys = new Set<string>(
      (tumSilindi || []).filter((s: any) => s.silindi).map((s: any) => s.orijinalKey).filter(Boolean)
    );

    // Tüm rotasyon görevlerini + kıdem verilerini + hakediş hariç listesini çek (paralel)
    const [tumRotasyonlar, tumKidemler, kidemCarpanlari, hakedisDahilRawPR] = await Promise.all([
      ckv.getByPrefix("rotation_task_").catch(() => []),
      ckv.getByPrefix("kidem_personel_").catch(() => []),
      ckv.get("kidem_carpanlari").catch(() => null),
      ckv.get(HAKEDIS_DAHIL_KEY).catch(() => []),
    ]);
    const hakedisDahilSet = new Set<string>(hakedisDahilRawPR || []);
    // Kıdem haritaları
    const kidemMap: Record<string, string> = {}; // userId → kidemSeviye
    for (const k of (tumKidemler || [])) {
      if (k?.userId && k?.kidemSeviye) kidemMap[k.userId] = k.kidemSeviye;
    }
    const carpanlar: Record<string, number> = kidemCarpanlari || { kidemsiz: 1.0, kidemli: 1.15, kidemliPlus: 1.30 };

    // ── Hakediş hesaplama helper: bantlı + kıdem çarpanlı ──
    // gorevKisiSayisi: o görevdeki toplam kişi sayısı (bantlar için)
    // soloMu: tek kişi görevsiz mi
    const getGorevHakedis = (kademe: any, gorev: string | undefined, gorevKisiSayisi: number, soloMu: boolean, personelId: string): number => {
      let baseTutar = 0;

      if (soloMu) {
        // Solo: görevsiz tek kişi
        baseTutar = Number(kademe.primTek) || 0;
      } else {
        // Görev bazlı bant kontrolü
        const bantKey = gorev === 'baski' ? 'baskiBantlar'
          : gorev === 'album' ? 'albumBantlar'
          : gorev === 'gozlemci' ? 'gozlemciBantlar'
          : 'fotografBantlar'; // fotograf-satis veya varsayılan

        const bantlar: any[] = kademe[bantKey];
        if (bantlar && Array.isArray(bantlar) && bantlar.length > 0) {
          // Bantlı sistem: kişi sayısına göre bant bul
          const bant = bantlar.find((b: any) => gorevKisiSayisi >= Number(b.min) && gorevKisiSayisi <= Number(b.max));
          baseTutar = bant ? Number(bant.tutar) || 0 : 0;
        } else {
          // Geriye uyumluluk: eski sabit alanlar
          if (gorev === 'baski') baseTutar = Number(kademe.primBaski) || Number(kademe.primCoklu) || 0;
          else if (gorev === 'album') baseTutar = Number(kademe.primAlbum) || Number(kademe.primCoklu) || 0;
          else if (gorev === 'gozlemci') baseTutar = Number(kademe.primGozlemci) || 0;
          else baseTutar = Number(kademe.primFotograf) || Number(kademe.primCoklu) || 0;
        }
      }

      // Kıdem çarpanı uygula
      const kidemSeviye = kidemMap[personelId] || 'kidemsiz';
      const carpan = Number(carpanlar[kidemSeviye]) ?? 1.0;
      return Math.round(baseTutar * carpan);
    };

    // Her gün × her mekan × her kademe × her personel için AYRI prim kaydı
    const primKayitlari: any[] = [];

    for (const kayit of ayKayitlari) {
      const mekan = mekanMap[kayit.mekanId];
      if (!mekan || !mekan.kotaKademeleri || mekan.kotaKademeleri.length === 0) continue;

      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const ciro = satislar.reduce((sum: number, s: any) => sum + (s.finalPrice || 0), 0);

      // Personel listesi: o gün o mekana atanmış rotasyon personeli (id → {name, gorev})
      const mekanAdi: string = mekan.name || "";
      const rotasyonPersonelList: Array<{id: string; name: string; gorev?: string}> = [];
      const seenIds = new Set<string>();

      for (const task of (tumRotasyonlar || [])) {
        if (task.date !== kayit.tarih) continue;
        if (!["sent", "revised"].includes(task.status)) continue;
        if (task.location !== mekanAdi) continue;
        if (!Array.isArray(task.personnel)) continue;
        for (const p of task.personnel) {
          if (p.id && p.name && !seenIds.has(p.id)) {
            // Hakediş dahil listesinde olmayanlar atlanır
            if (!hakedisDahilSet.has(p.id)) continue;
            seenIds.add(p.id);
            rotasyonPersonelList.push({ id: p.id, name: p.name, gorev: p.gorev });
          }
        }
      }

      // Hakediş dahil personel yoksa bu kayıt için hakediş oluşturma
      if (rotasyonPersonelList.length === 0) continue;
      const rotasyonPersoneller = rotasyonPersonelList;

      const personelSayisi = rotasyonPersoneller.length;
      const soloMu = personelSayisi === 1 && !rotasyonPersoneller[0].gorev;

      // Görev bazlı kişi sayıları (bantlar için)
      const gorevSayilari: Record<string, number> = {};
      for (const p of rotasyonPersoneller) {
        const g = p.gorev || '_solo';
        gorevSayilari[g] = (gorevSayilari[g] || 0) + 1;
      }

      // Kademeleri hedef'e göre sırala — ki indeksi görsel sırayla eşleşsin
      const sortedKademeler = [...mekan.kotaKademeleri].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));

      for (let ki = 0; ki < sortedKademeler.length; ki++) {
        const kademe = sortedKademeler[ki];
        if (ciro >= Number(kademe.hedef)) {
          // Her personel için ayrı kayıt (göreve göre hakediş)
          for (const personel of rotasyonPersoneller) {
            const gorevKisiSayisi = gorevSayilari[personel.gorev || '_solo'] || 1;
            const primMiktar = getGorevHakedis(kademe, personel.gorev, gorevKisiSayisi, soloMu, personel.id);
            const safeAd = encodeURIComponent(personel.name);
            const odemeKey = `prim_odendi_${kayit.mekanId}_${kayit.tarih}_${ki}_${safeAd}`;
            const odemeData = odemeMap[odemeKey] || null;

            primKayitlari.push({
              mekanId: kayit.mekanId,
              mekanName: mekan.name,
              mekanEmoji: mekan.emoji || "📍",
              mekanColor: mekan.color || "#9dd9ea",
              tarih: kayit.tarih,
              ciro: Math.round(ciro),
              kademeIndex: ki,
              kademeHedef: Number(kademe.hedef),
              primMiktar,
              personelAdi: personel.name,
              personelGorev: personel.gorev,
              personelSayisi,
              coklu: !soloMu,
              gorevKisiSayisi,
              kidemSeviye: kidemMap[personel.id] || 'kidemsiz',
              odendi: odemeData?.odendi || false,
              odemeTarihi: odemeData?.odemeTarihi || null,
              odemeKey,
            });
          }
        }
      }
    }

    // İptal edilmiş (silindi) kayıtları filtrele — silindi flag eklenerek döndür
    const primKayitlariFinal = primKayitlari.map(p => ({
      ...p,
      silindi: silinenKeys.has(p.odemeKey),
    })).filter(p => !p.silindi || p.odendi); // ödenmişler silinse de göster; sadece bekleyenler gizlenir

    // Özet: her kayıt tek kişinin primini tutuyor
    const toplamPrim = primKayitlariFinal.reduce((s, p) => s + p.primMiktar, 0);
    const odenenPrim = primKayitlariFinal.filter(p => p.odendi).reduce((s, p) => s + p.primMiktar, 0);
    const bekleyenPrim = toplamPrim - odenenPrim;

    // ── Bekleyen hakedişleri İGD'ye gider olarak yaz (idempotent) ──
    // Bu, kasada personele borç olarak görünmesini sağlar
    const mevcutGiderKeys = new Set<string>();
    const tumGiderlerPrim = await ckv.getByPrefix("isletme_gider_").catch(() => []) || [];
    for (const g of tumGiderlerPrim) { if (g.primOdemeKey) mevcutGiderKeys.add(g.primOdemeKey); }

    let primGiderEklenen = 0;
    for (const p of primKayitlariFinal) {
      if (p.silindi) continue;
      if (p.odendi) continue; // ödenmişler zaten İGD'ye yazılmış (ödeme anında)
      if (mevcutGiderKeys.has(p.odemeKey)) continue; // zaten İGD'de var

      const giderId = `prim_bekleyen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await ckv.set(`isletme_gider_${giderId}`, {
        id: giderId,
        category: "personel",
        odemeTipi: "prim_bekleyen",
        amount: p.primMiktar || 0,
        currency: "TRY",
        description: `Hakediş — ${p.personelAdi || "?"} · ${p.mekanName || ""} ${p.tarih} ${(p.kademeIndex ?? 0) + 1}. Kademe`,
        date: p.tarih || ay + "-01",
        personelAdi: p.personelAdi || "",
        mekanAdi: p.mekanName || "",
        primOdemeKey: p.odemeKey,
        otomatik: true,
        kasaBekleyen: true,
        created_at: new Date().toISOString(),
        created_by: "sistem",
      });
      primGiderEklenen++;
    }
    if (primGiderEklenen > 0) console.log(`[Prim→İGD] ${primGiderEklenen} bekleyen hakediş gider olarak eklendi (${ay})`);

    console.log(`Prim raporu ${ay}: ${primKayitlariFinal.length} kişi-kademe kaydı, toplam ₺${toplamPrim}`);
    return c.json({ ay, primKayitlari: primKayitlariFinal, toplamPrim, odenenPrim, bekleyenPrim });
  } catch (err) {
    console.log("Prim rapor error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// PRİM: Personel kendi prim geçmişi
// GET /primler/kendi-rapor?ay=2026-03
// Auth: tüm roller (kendi kaydını görür)
// ══════════════════════════════════════════
app.get("/make-server-4da0b637/primler/kendi-rapor", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerAdi: string = user.user_metadata?.full_name || "";
    if (!callerAdi) return c.json({ error: "Kullanıcı adı bulunamadı." }, 400);

    const ay = c.req.query("ay") || new Date().toISOString().slice(0, 7);
    const [yil, ayNo] = ay.split("-").map(Number);

    // Paralel veri çekimi (kıdem + hakediş hariç dahil)
    const ckv = companyKvFor(getCompanyId(user));
    const [mekanlarList, tumKayitlar, tumOdemeler, tumRotasyonlar, tumSilindiKendi, tumKidemlerKendi, kidemCarpanlariKendi, hakedisDahilRawKR] = await Promise.all([
      getMekanlar().catch(() => []),
      ckv.getByPrefix("stok_gunluk_").catch(() => []),
      ckv.getByPrefix("prim_odendi_").catch(() => []),
      ckv.getByPrefix("rotation_task_").catch(() => []),
      ckv.getByPrefix("prim_silindi_").catch(() => []),
      ckv.getByPrefix("kidem_personel_").catch(() => []),
      ckv.get("kidem_carpanlari").catch(() => null),
      ckv.get(HAKEDIS_DAHIL_KEY).catch(() => []),
    ]);
    const hakedisDahilSet = new Set<string>(hakedisDahilRawKR || []);
    // Kıdem haritaları
    const kidemMapKendi: Record<string, string> = {};
    for (const k of (tumKidemlerKendi || [])) {
      if (k?.userId && k?.kidemSeviye) kidemMapKendi[k.userId] = k.kidemSeviye;
    }
    const carpanlarKendi: Record<string, number> = kidemCarpanlariKendi || { kidemsiz: 1.0, kidemli: 1.15, kidemliPlus: 1.30 };

    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) mekanMap[m.id] = m;

    const odemeMap: Record<string, { odendi: boolean; odemeTarihi?: string }> = {};
    for (const o of (tumOdemeler || [])) {
      if (o.key) odemeMap[o.key] = { odendi: o.odendi || false, odemeTarihi: o.odemeTarihi };
    }
    const silinenKeysKendi = new Set<string>(
      (tumSilindiKendi || []).filter((s: any) => s.silindi).map((s: any) => s.orijinalKey).filter(Boolean)
    );

    const ayKayitlari = (tumKayitlar || []).filter((k: any) => {
      if (!k.tarih) return false;
      const [ky, ka] = k.tarih.split("-").map(Number);
      return ky === yil && ka === ayNo;
    });

    const primKayitlari: any[] = [];

    for (const kayit of ayKayitlari) {
      const mekan = mekanMap[kayit.mekanId];
      if (!mekan || !mekan.kotaKademeleri || mekan.kotaKademeleri.length === 0) continue;

      // O gün o mekandaki personel listesini rotasyondan al
      const mekanAdi: string = mekan.name || "";
      const rotasyonPersonelList2: Array<{id: string; name: string; gorev?: string}> = [];
      const seenIds2 = new Set<string>();
      for (const task of (tumRotasyonlar || [])) {
        if (task.date !== kayit.tarih) continue;
        if (!["sent", "revised"].includes(task.status)) continue;
        if (task.location !== mekanAdi) continue;
        if (!Array.isArray(task.personnel)) continue;
        for (const p of task.personnel) {
          if (p.id && p.name && !seenIds2.has(p.id)) {
            // Hakediş dahil listesinde olmayanlar atlanır
            if (!hakedisDahilSet.has(p.id)) continue;
            seenIds2.add(p.id);
            rotasyonPersonelList2.push({ id: p.id, name: p.name, gorev: p.gorev });
          }
        }
      }

      // Çağıran kişi bu mekana o gün atanmış mı?
      const buradaVar = rotasyonPersonelList2.some(
        (p) => p.name.toLowerCase().trim() === callerAdi.toLowerCase().trim()
      );
      if (!buradaVar) continue;

      // Çağıran kişinin görevi
      const callerGorev = rotasyonPersonelList2.find(
        (p) => p.name.toLowerCase().trim() === callerAdi.toLowerCase().trim()
      )?.gorev;

      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const ciro = satislar.reduce((sum: number, s: any) => sum + (s.finalPrice || 0), 0);
      const personelSayisi = rotasyonPersonelList2.length;
      const soloMuKendi = personelSayisi === 1 && !rotasyonPersonelList2[0]?.gorev;

      // Görev bazlı kişi sayıları
      const gorevSayilariKendi: Record<string, number> = {};
      for (const p of rotasyonPersonelList2) {
        const g = p.gorev || '_solo';
        gorevSayilariKendi[g] = (gorevSayilariKendi[g] || 0) + 1;
      }

      // Bantlı + kıdemli hakediş hesaplama (primler/rapor ile aynı mantık)
      const getGorevHakedisKendi = (kademe: any, gorev: string | undefined, gorevKisiSayisi: number, solo: boolean, pId: string): number => {
        let baseTutar = 0;
        if (solo) {
          baseTutar = Number(kademe.primTek) || 0;
        } else {
          const bantKey = gorev === 'baski' ? 'baskiBantlar' : gorev === 'album' ? 'albumBantlar' : gorev === 'gozlemci' ? 'gozlemciBantlar' : 'fotografBantlar';
          const bantlar: any[] = kademe[bantKey];
          if (bantlar && Array.isArray(bantlar) && bantlar.length > 0) {
            const bant = bantlar.find((b: any) => gorevKisiSayisi >= Number(b.min) && gorevKisiSayisi <= Number(b.max));
            baseTutar = bant ? Number(bant.tutar) || 0 : 0;
          } else {
            if (gorev === 'baski') baseTutar = Number(kademe.primBaski) || Number(kademe.primCoklu) || 0;
            else if (gorev === 'album') baseTutar = Number(kademe.primAlbum) || Number(kademe.primCoklu) || 0;
            else if (gorev === 'gozlemci') baseTutar = Number(kademe.primGozlemci) || 0;
            else baseTutar = Number(kademe.primFotograf) || Number(kademe.primCoklu) || 0;
          }
        }
        const kSeviye = kidemMapKendi[pId] || 'kidemsiz';
        const carp = Number(carpanlarKendi[kSeviye]) ?? 1.0;
        return Math.round(baseTutar * carp);
      };

      const callerGorevKisiSayisi = gorevSayilariKendi[callerGorev || '_solo'] || 1;
      // Caller'ın userId'sini bul (rotasyon listesinden)
      const callerPersonel = rotasyonPersonelList2.find(
        (p) => p.name.toLowerCase().trim() === callerAdi.toLowerCase().trim()
      );
      const callerUserId = callerPersonel?.id || user.id;

      const sortedKademeler = [...mekan.kotaKademeleri].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));

      for (let ki = 0; ki < sortedKademeler.length; ki++) {
        const kademe = sortedKademeler[ki];
        if (ciro >= Number(kademe.hedef)) {
          const primMiktar = getGorevHakedisKendi(kademe, callerGorev, callerGorevKisiSayisi, soloMuKendi, callerUserId);
          const safeAd = encodeURIComponent(callerAdi);
          const odemeKey = `prim_odendi_${kayit.mekanId}_${kayit.tarih}_${ki}_${safeAd}`;
          const odemeData = odemeMap[odemeKey] || null;

          primKayitlari.push({
            mekanId: kayit.mekanId,
            mekanName: mekan.name,
            mekanEmoji: mekan.emoji || "📍",
            mekanColor: mekan.color || "#9dd9ea",
            tarih: kayit.tarih,
            ciro: Math.round(ciro),
            kademeIndex: ki,
            kademeHedef: Number(kademe.hedef),
            primMiktar,
            personelAdi: callerAdi,
            personelGorev: callerGorev,
            personelSayisi,
            coklu: !soloMuKendi,
            gorevKisiSayisi: callerGorevKisiSayisi,
            kidemSeviye: kidemMapKendi[callerUserId] || 'kidemsiz',
            odendi: odemeData?.odendi || false,
            odemeTarihi: odemeData?.odemeTarihi || null,
            odemeKey,
          });
        }
      }
    }

    primKayitlari.sort((a, b) => b.tarih.localeCompare(a.tarih) || a.kademeIndex - b.kademeIndex);

    // Silinmiş (iptal) bekleyen kayıtları filtrele
    const primKayitlariFinalKendi = primKayitlari.filter(p => !silinenKeysKendi.has(p.odemeKey) || p.odendi);

    const toplamPrim = primKayitlariFinalKendi.reduce((s, p) => s + p.primMiktar, 0);
    const odenenPrim = primKayitlariFinalKendi.filter((p) => p.odendi).reduce((s, p) => s + p.primMiktar, 0);
    const bekleyenPrim = toplamPrim - odenenPrim;

    console.log(`Kendi prim raporu ${ay} / ${callerAdi}: ${primKayitlariFinalKendi.length} kayit, ₺${toplamPrim}`);
    return c.json({ ay, callerAdi, primKayitlari: primKayitlariFinalKendi, toplamPrim, odenenPrim, bekleyenPrim });
  } catch (err) {
    console.log("Kendi prim rapor error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// PRİM: Anlık vardiya prim bilgisi (personel için)
// GET /shift/prim-bilgi?mekanAdi=...
// Auth: tüm roller
// ══════════════════════════════════════════
app.get("/make-server-4da0b637/shift/prim-bilgi", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const mekanAdi = c.req.query("mekanAdi") || "";
    if (!mekanAdi) return c.json({ error: "mekanAdi zorunludur." }, 400);

    // İş günü tarihi (05:00 TR kırılımlı)
    const today = bizDateTR();

    // Tüm mekanları al, ada göre bul
    const mekanlarList: any[] = await getMekanlar();
    const mekan = mekanlarList.find((m: any) =>
      (m.name || "").toLowerCase().trim() === mekanAdi.toLowerCase().trim()
    );
    if (!mekan) return c.json({ primBilgi: null, sebep: "Mekan bulunamadı." });

    const kotaKademeleriRaw: any[] = mekan.kotaKademeleri || [];
    if (kotaKademeleriRaw.length === 0) return c.json({ primBilgi: null, sebep: "Bu mekanda kota tanımlı değil." });

    // Kademeleri hedef'e göre sırala (backend'de tutarlı sıralama)
    const kotaKademeleri = [...kotaKademeleriRaw].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));

    const kotaKademeOzetErken = kotaKademeleri.map((k: any) => ({
      hedef: Number(k.hedef),
      primTek: Number(k.primTek) || 0,
      primFotograf: Number(k.primFotograf) || Number(k.primCoklu) || 0,
      primBaski: Number(k.primBaski) || Number(k.primCoklu) || 0,
      primAlbum: Number(k.primAlbum) || Number(k.primCoklu) || 0,
      primCoklu: Number(k.primCoklu) || 0,
    }));

    // Bugünkü stok kaydını al — yoksa ciro:0 ile kademeleri yine de döndür
    const stokKey = `stok_gunluk_${mekan.id}_${today}`;
    const ckv = companyKvFor(getCompanyId(user));
    const kayit: any = await ckv.get(stokKey);
    if (!kayit) {
      return c.json({
        primBilgi: null,
        ciro: 0,
        ilkHedef: Number(kotaKademeleri[0].hedef),
        fark: Number(kotaKademeleri[0].hedef),
        sebep: "Vardiya henüz açılmadı.",
        kotaKademeleri: kotaKademeOzetErken,
      });
    }

    const satislar: any[] = (kayit.satislar || []).filter((s: any) => !s.iptal);
    const ciro = Math.round(satislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0));

    // Rotasyon görevinden personel listesi ve çağıran kişinin görevi + kıdem
    const callerName = user.user_metadata?.full_name || user.email || "";
    const [tumRotasyonlarPrim, tumKidemlerPB, kidemCarpanlariPB, hakedisDahilRawPB] = await Promise.all([
      ckv.getByPrefix("rotation_task_").catch(() => []),
      ckv.getByPrefix("kidem_personel_").catch(() => []),
      ckv.get("kidem_carpanlari").catch(() => null),
      ckv.get(HAKEDIS_DAHIL_KEY).catch(() => []),
    ]);
    const hakedisDahilSetPB = new Set<string>(hakedisDahilRawPB || []);
    const kidemMapPB: Record<string, string> = {};
    for (const k of (tumKidemlerPB || [])) { if (k?.userId && k?.kidemSeviye) kidemMapPB[k.userId] = k.kidemSeviye; }
    const carpanlarPB: Record<string, number> = kidemCarpanlariPB || { kidemsiz: 1.0, kidemli: 1.15, kidemliPlus: 1.30 };

    const todayTasks = (tumRotasyonlarPrim || []).filter((t: any) =>
      t.date === today &&
      ["sent", "revised"].includes(t.status || "") &&
      (t.location || "").toLowerCase().trim() === mekanAdi.toLowerCase().trim() &&
      Array.isArray(t.personnel)
    );
    const rotasyonPersonelList3: Array<{id: string; name: string; gorev?: string}> = [];
    const seenIds3 = new Set<string>();
    for (const task of todayTasks) {
      for (const p of task.personnel) {
        if (p.id && p.name && !seenIds3.has(p.id)) {
          if (!hakedisDahilSetPB.has(p.id)) continue;
          seenIds3.add(p.id);
          rotasyonPersonelList3.push({ id: p.id, name: p.name, gorev: p.gorev });
        }
      }
    }
    const callerPersonelPB = rotasyonPersonelList3.find(
      (p) => p.name.toLowerCase().trim() === callerName.toLowerCase().trim()
    );
    const callerGorevPrim = callerPersonelPB?.gorev;
    const callerIdPB = callerPersonelPB?.id || user.id;

    const personelSayisi = rotasyonPersonelList3.length ||
      new Set((kayit.kareKayitlari || []).map((k: any) => k.photographerName).filter(Boolean)).size || 1;
    const soloMuPB = personelSayisi === 1 && !rotasyonPersonelList3[0]?.gorev;

    // Görev bazlı kişi sayıları
    const gorevSayilariPB: Record<string, number> = {};
    for (const p of rotasyonPersonelList3) { const g = p.gorev || '_solo'; gorevSayilariPB[g] = (gorevSayilariPB[g] || 0) + 1; }
    const callerGorevKisiSayisiPB = gorevSayilariPB[callerGorevPrim || '_solo'] || 1;

    // Bantlı + kıdemli hakediş helper
    const getHakedisPB = (kademe: any, gorev: string | undefined, gorevKisiSayisi: number, solo: boolean, pId: string): number => {
      let baseTutar = 0;
      if (solo) { baseTutar = Number(kademe.primTek) || 0; }
      else {
        const bantKey = gorev === 'baski' ? 'baskiBantlar' : gorev === 'album' ? 'albumBantlar' : gorev === 'gozlemci' ? 'gozlemciBantlar' : 'fotografBantlar';
        const bantlar: any[] = kademe[bantKey];
        if (bantlar && Array.isArray(bantlar) && bantlar.length > 0) {
          const bant = bantlar.find((b: any) => gorevKisiSayisi >= Number(b.min) && gorevKisiSayisi <= Number(b.max));
          baseTutar = bant ? Number(bant.tutar) || 0 : 0;
        } else {
          if (gorev === 'baski') baseTutar = Number(kademe.primBaski) || Number(kademe.primCoklu) || 0;
          else if (gorev === 'album') baseTutar = Number(kademe.primAlbum) || Number(kademe.primCoklu) || 0;
          else if (gorev === 'gozlemci') baseTutar = Number(kademe.primGozlemci) || 0;
          else baseTutar = Number(kademe.primFotograf) || Number(kademe.primCoklu) || 0;
        }
      }
      const kSev = kidemMapPB[pId] || 'kidemsiz';
      const carp = Number(carpanlarPB[kSev]) ?? 1.0;
      return Math.round(baseTutar * carp);
    };

    // Sıralı dizi üzerinden geçilen kademeler
    const gecilenKademeler = kotaKademeleri
      .map((k: any, i: number) => ({ ...k, index: i }))
      .filter((k: any) => ciro >= Number(k.hedef));

    const kotaKademeOzet = kotaKademeleri.map((k: any) => ({
      hedef: Number(k.hedef),
      primTek: Number(k.primTek) || 0,
      primFotograf: Number(k.primFotograf) || Number(k.primCoklu) || 0,
      primBaski: Number(k.primBaski) || Number(k.primCoklu) || 0,
      primAlbum: Number(k.primAlbum) || Number(k.primCoklu) || 0,
      primCoklu: Number(k.primCoklu) || 0,
      fotografBantlar: k.fotografBantlar || null,
      baskiBantlar: k.baskiBantlar || null,
      albumBantlar: k.albumBantlar || null,
      gozlemciBantlar: k.gozlemciBantlar || null,
    }));

    if (gecilenKademeler.length === 0) {
      const ilk = kotaKademeleri[0];
      return c.json({
        primBilgi: null,
        ciro,
        ilkHedef: Number(ilk.hedef),
        fark: Number(ilk.hedef) - ciro,
        sebep: "Henüz kota geçilmedi.",
        kotaKademeleri: kotaKademeOzet,
      });
    }

    const topKademe = gecilenKademeler[gecilenKademeler.length - 1];
    const toplamPrim = gecilenKademeler.reduce((s: number, k: any) => s + getHakedisPB(k, callerGorevPrim, callerGorevKisiSayisiPB, soloMuPB, callerIdPB), 0);
    const topKademePrim = getHakedisPB(topKademe, callerGorevPrim, callerGorevKisiSayisiPB, soloMuPB, callerIdPB);

    return c.json({
      primBilgi: {
        kademeIndex: topKademe.index,
        kademeHedef: Number(topKademe.hedef),
        topKademePrim,
        toplamPrim,
        toplamKademe: gecilenKademeler.length,
        toplamKademeAdet: kotaKademeleri.length,
        personelSayisi,
        callerGorev: callerGorevPrim,
        coklu: !soloMuPB,
        gorevKisiSayisi: callerGorevKisiSayisiPB,
        kidemSeviye: kidemMapPB[callerIdPB] || 'kidemsiz',
        ciro,
      },
      ciro,
      ilkHedef: Number(kotaKademeleri[0].hedef),
      fark: 0,
      kotaKademeleri: kotaKademeOzet,
    });
  } catch (err) {
    console.log("shift/prim-bilgi error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// PRİM: Ödendi olarak işaretle + otomatik gider kalemi
// POST /primler/ode
// body: { odemeKeys: string[], odendiMi: boolean, odemeDetaylari: OdemeDetay[] }
// OdemeDetay: { key, personelAdi, mekanAdi, tarih, kademeIndex, primMiktar }
// ══════════════════════════════════════════
app.post("/make-server-4da0b637/primler/ode", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Hakediş ödeme yetkisi yalnızca Yönetici / Üst Müdür rolüne aittir." }, 403);
    }

    const body = await c.req.json();
    const { odemeKeys, odendiMi = true, odemeDetaylari = [] } = body;

    if (!Array.isArray(odemeKeys) || odemeKeys.length === 0) {
      return c.json({ error: "odemeKeys dizisi zorunludur." }, 400);
    }

    const now = new Date().toISOString();
    const todayStr = now.slice(0, 10);
    const results = [];
    let giderSayisi = 0;
    let giderSilinen = 0;

    // İptal durumunda silinecek gider kayıtlarını önceden tek seferde çek
    const ckv = companyKvFor(getCompanyId(user));
    let tumGiderler: any[] = [];
    if (!odendiMi) {
      tumGiderler = await ckv.getByPrefix("isletme_gider_").catch(() => []) || [];
    }

    for (const key of odemeKeys) {
      const detay = (odemeDetaylari as any[]).find((d: any) => d.key === key);
      const record = {
        key,
        odendi: odendiMi,
        odemeTarihi: now,
        odeyenKisi: user.email || user.id,
        personelAdi: detay?.personelAdi,
        mekanAdi: detay?.mekanAdi,
        primMiktar: detay?.primMiktar,
      };
      await ckv.set(key, record);
      results.push(key);

      if (odendiMi && detay) {
        // Ödeme → bekleyen İGD giderini bul ve kasada ödendi işaretle
        // Eğer bekleyen yoksa yeni İGD gider oluştur (geriye uyumluluk)
        if (!tumGiderler.length) tumGiderler = await ckv.getByPrefix("isletme_gider_").catch(() => []) || [];
        const bekleyenGider = tumGiderler.find((g: any) => g.primOdemeKey === key);

        if (bekleyenGider) {
          // Bekleyen gider var → kasada ödendi işaretle
          const gId = bekleyenGider.id || bekleyenGider.otomatikKey;
          const odemeKey = `kasa_odeme_${gId}`;
          await ckv.set(odemeKey, {
            giderId: gId,
            odemeler: [{ tutar: detay.primMiktar || 0, tarih: todayStr, aciklama: `Hakediş ödendi — ${detay.personelAdi}`, created_at: now }],
            odpiendi: true,
            odpienenTutar: detay.primMiktar || 0,
            silinenTutar: 0,
            personelAdi: detay.personelAdi,
            category: "personel",
          });
          // Bekleyen gideri "ödendi" tipine güncelle
          bekleyenGider.odemeTipi = "prim";
          bekleyenGider.description = `Hakediş Ödemesi ✅ ${detay.personelAdi || ""} — ${detay.mekanAdi || ""} ${detay.tarih || todayStr}`;
          await ckv.set(`isletme_gider_${bekleyenGider.id}`, bekleyenGider);
        } else {
          // Bekleyen yok → eski sistem, yeni gider oluştur + kasada ödendi
          const kademeLabel = `${(detay.kademeIndex ?? 0) + 1}. Kademe`;
          const giderId = `prim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const gider = {
            id: giderId,
            category: "personel",
            odemeTipi: "prim",
            amount: detay.primMiktar || 0,
            currency: "TRY",
            description: `Hakediş Ödemesi ✅ ${detay.personelAdi || "Bilinmiyor"} — ${detay.mekanAdi || ""} ${detay.tarih || todayStr} ${kademeLabel}`,
            date: detay.tarih || todayStr,
            personelAdi: detay.personelAdi,
            mekanAdi: detay.mekanAdi,
            primKey: key,
            primOdemeKey: key,
            created_at: now,
            created_by: user.email || user.id,
          };
          await ckv.set(`isletme_gider_${giderId}`, gider);
          // Kasada da ödendi
          await ckv.set(`kasa_odeme_${giderId}`, {
            giderId: giderId,
            odemeler: [{ tutar: detay.primMiktar || 0, tarih: todayStr, aciklama: `Hakediş ödendi — ${detay.personelAdi}`, created_at: now }],
            odpiendi: true,
            odpienenTutar: detay.primMiktar || 0,
            silinenTutar: 0,
          });
        }
        giderSayisi++;
      } else if (!odendiMi) {
        // İptal → bu prime ait işletme gider kaydını/kayıtlarını + kasa ödeme kaydını sil
        const eslesen = tumGiderler.filter((g: any) => g.primKey === key || g.primOdemeKey === key);
        for (const g of eslesen) {
          await ckv.del(`isletme_gider_${g.id}`);
          await ckv.del(`kasa_odeme_${g.id}`).catch(() => {});
          giderSilinen++;
        }
      }
    }

    console.log(`Prim ödeme: ${results.length} kayıt ${odendiMi ? "ödendi" : "geri alındı"}, ${giderSayisi} gider oluşturuldu, ${giderSilinen} gider silindi — by ${user.email}`);

    // Ödeme yapılıyorsa personele bildirim gönder
    if (odendiMi && odemeDetaylari.length > 0) {
      try {
        const sbAdminPrim = getAdminClient();
        const { data: { users: allPrimUsers } } = await sbAdminPrim.auth.admin.listUsers({ perPage: 1000 });
        for (const detay of (odemeDetaylari as any[])) {
          if (!detay?.personelAdi) continue;
          const staffUser = (allPrimUsers || []).find((u: any) =>
            (u.user_metadata?.full_name || '').toLowerCase().trim() === detay.personelAdi.toLowerCase().trim()
          );
          if (staffUser) {
            const primTL = `₺${Number(detay.primMiktar || 0).toLocaleString('tr-TR')}`;
            await createNotification(staffUser.id, 'prim_guncellendi', 'Hakediş Ödemeniz Yapıldı',
              `${detay.mekanAdi || ''} — ${detay.tarih || ''}: ${primTL} hakediş ödemeniz gerçekleşti.`,
              { primMiktar: detay.primMiktar, mekanAdi: detay.mekanAdi, tarih: detay.tarih }
            );
          }
        }
      } catch (pe) {
        console.log("Prim bildirim hatası:", pe);
      }
    }

    return c.json({ success: true, guncellenen: results.length, giderOlusturulan: giderSayisi, giderSilinen });
  } catch (err) {
    console.log("Prim ode error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// PRİM: Bekleyen prim kaydını iptal/sil
// POST /primler/sil
// body: { odemeKeys: string[], geriAl?: boolean }
// ══════════════════════════════════════════
app.post("/make-server-4da0b637/primler/sil", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Hakediş silme yetkisi yalnızca Yönetici / Üst Müdür rolüne aittir." }, 403);
    }
    const body = await c.req.json();
    const { odemeKeys, geriAl = false } = body;
    if (!Array.isArray(odemeKeys) || odemeKeys.length === 0) {
      return c.json({ error: "odemeKeys dizisi zorunludur." }, 400);
    }
    const now = new Date().toISOString();
    const ckv = companyKvFor(getCompanyId(user));
    let islenen = 0;
    for (const key of odemeKeys) {
      const silKey = `prim_silindi_${key}`;
      if (geriAl) {
        await ckv.del(silKey);
      } else {
        await ckv.set(silKey, {
          silindi: true,
          silindiTarihi: now,
          silenKisi: user.email || user.id,
          orijinalKey: key,
        });
      }
      islenen++;
    }
    console.log(`Prim ${geriAl ? "geri alindi" : "iptal edildi"}: ${islenen} kayit — by ${user.email}`);
    return c.json({ success: true, islenen, geriAl });
  } catch (err) {
    console.log("Prim sil error:", err);
    return c.json({ error: `Sunucu hatasi: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// HAKEDİŞ DAHİL: Kişi bazlı hakediş dahil listesi
// Varsayılan: dahil değil — listeye eklenenler hakediş alır
// GET  /hakedis/dahil — dahil userId listesini getir
// POST /hakedis/dahil — listeyi güncelle { userIds: string[] }
// ══════════════════════════════════════════
const HAKEDIS_DAHIL_KEY = "hakedis_dahil_kisiler";

app.get("/make-server-4da0b637/hakedis/dahil", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Bu endpoint yalnızca yönetici ve üst-müdür rolüne açıktır." }, 403);
    }
    const ckv = companyKvFor(getCompanyId(user));
    const stored: string[] = await ckv.get(HAKEDIS_DAHIL_KEY) || [];
    return c.json({ userIds: stored });
  } catch (err) {
    console.log("Hakedis dahil GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/hakedis/dahil", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Hakediş dahil listesini sadece yönetici güncelleyebilir." }, 403);
    }
    const body = await c.req.json();
    const { userIds } = body;
    if (!Array.isArray(userIds)) {
      return c.json({ error: "userIds dizisi zorunludur." }, 400);
    }
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(HAKEDIS_DAHIL_KEY, userIds);
    console.log(`[Hakediş Dahil] ${userIds.length} kişi dahil — by ${user.email}`);
    return c.json({ success: true, userIds });
  } catch (err) {
    console.log("Hakedis dahil POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// KİDEM ÇARPANLARI
// GET /kidem/carpanlar  — yönetici + üst-müdür
// POST /kidem/carpanlar — sadece yönetici
// ══════════════════════════════════════════
const KIDEM_CARPAN_KEY = "kidem_carpanlari";
const KIDEM_CARPAN_DEFAULT = { kidemsiz: 1.0, kidemli: 1.15, kidemliPlus: 1.30 };

app.get("/make-server-4da0b637/kidem/carpanlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Bu endpoint yalnızca yönetici ve üst-müdür rolüne açıktır." }, 403);
    }
    const isSAKidem = user.user_metadata?.originalRole === "superadmin";
    const reqCIdKidem = c.req.query("company_id");
    const ckv = companyKvFor((isSAKidem && reqCIdKidem) ? reqCIdKidem : getCompanyId(user));
    const stored = await ckv.get(KIDEM_CARPAN_KEY);
    const carpanlar = stored || KIDEM_CARPAN_DEFAULT;
    return c.json({ carpanlar });
  } catch (err) {
    console.log("Kidem carpanlar GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/kidem/carpanlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Kıdem çarpanlarını sadece yönetici güncelleyebilir." }, 403);
    }
    const body = await c.req.json();
    const { kidemsiz, kidemli, kidemliPlus } = body;
    if (
      typeof kidemsiz !== "number" || typeof kidemli !== "number" || typeof kidemliPlus !== "number" ||
      kidemsiz < 0 || kidemli < 0 || kidemliPlus < 0
    ) {
      return c.json({ error: "Geçersiz çarpan değerleri. Tüm değerler 0 veya üzeri olmalıdır." }, 400);
    }
    const carpanlar = { kidemsiz, kidemli, kidemliPlus };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(KIDEM_CARPAN_KEY, carpanlar);
    console.log(`[Kidem] Çarpanlar güncellendi: ${JSON.stringify(carpanlar)} — by ${user.email}`);
    return c.json({ success: true, carpanlar });
  } catch (err) {
    console.log("Kidem carpanlar POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// KİDEM ATAMA (Personel bazlı)
// GET  /kidem/personel            — yönetici + üst-müdür: tüm personel kidem listesi
// POST /kidem/personel/:userId    — sadece yönetici: kıdem ata/güncelle
// GET  /kidem/personel/:userId    — yönetici + üst-müdür: tekil kıdem sorgula
// ══════════════════════════════════════════
const KIDEM_ELIGIBLE_ROLES = ["mudur", "operasyon", "personel"];
const KIDEM_LEVELS_ARR = ["kidemsiz", "kidemli", "kidemliPlus"];

app.get("/make-server-4da0b637/kidem/personel", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Bu endpoint yalnızca yönetici ve üst-müdür rolüne açıktır." }, 403);
    }
    const ckv = companyKvFor(getCompanyId(user));
    const allKidem: any[] = await ckv.getByPrefix("kidem_personel_") || [];
    return c.json({ kidemler: allKidem });
  } catch (err) {
    console.log("Kidem personel GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.get("/make-server-4da0b637/kidem/personel/:userId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Bu endpoint yalnızca yönetici ve üst-müdür rolüne açıktır." }, 403);
    }
    const { userId } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const kidem = await ckv.get(`kidem_personel_${userId}`);
    return c.json({ kidem: kidem || null });
  } catch (err) {
    console.log("Kidem personel/:userId GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/kidem/personel/:userId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Kıdem ataması sadece yönetici tarafından yapılabilir." }, 403);
    }
    const { userId } = c.req.param();
    const body = await c.req.json();
    const { kidemSeviye, personelAdi, personelRol } = body;

    if (!KIDEM_LEVELS_ARR.includes(kidemSeviye)) {
      return c.json({ error: `Geçersiz kıdem seviyesi. Geçerli değerler: ${KIDEM_LEVELS_ARR.join(", ")}` }, 400);
    }
    if (personelRol && !KIDEM_ELIGIBLE_ROLES.includes(personelRol)) {
      return c.json({ error: `${personelRol} rolüne kıdem atanamaz.` }, 400);
    }

    const now = new Date().toISOString();
    const kidemObj = {
      userId,
      personelAdi: personelAdi || "",
      personelRol: personelRol || "",
      kidemSeviye,
      atanmaTarihi: now,
      atayanKisi: user.email || user.id,
    };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`kidem_personel_${userId}`, kidemObj);
    console.log(`[Kidem] ${personelAdi} → ${kidemSeviye} (by ${user.email})`);
    return c.json({ success: true, kidem: kidemObj });
  } catch (err) {
    console.log("Kidem personel POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Anomali geçmişi
// GET /stok/anomali/:mekanId
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/stok/anomali/:mekanId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "operasyon"].includes(callerRole)) {
      return c.json({ error: "Yetki yok." }, 403);
    }

    const { mekanId } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const tumKayitlar = await ckv.getByPrefix(`stok_gunluk_${mekanId}_`);
    const anomaliler = tumKayitlar
      .filter((k: any) => {
        const acilisVar = k.acilisAnomali && Object.keys(k.acilisAnomali).length > 0;
        const kapanisVar = k.kapanisAnomali && Object.keys(k.kapanisAnomali).length > 0;
        return acilisVar || kapanisVar;
      })
      .sort((a: any, b: any) => b.tarih.localeCompare(a.tarih));

    return c.json({ anomaliler });
  } catch (err) {
    console.log("Get stok anomali error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Tüm mekanlar anomali raporu (tarih aralıklı)
// GET /stok/anomali-raporu?baslangic=YYYY-MM-DD&bitis=YYYY-MM-DD
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/stok/anomali-raporu", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "operasyon"].includes(callerRole)) {
      return c.json({ error: "Yetki yok." }, 403);
    }

    const baslangic = c.req.query("baslangic") || "";
    const bitis = c.req.query("bitis") || "";

    const ckv = companyKvFor(getCompanyId(user));
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
    const mekanlarList: any[] = await getMekanlar();
    const mekanMap: Record<string, any> = {};
    for (const m of mekanlarList) mekanMap[m.id] = m;

    const stokEtiket: Record<string, string> = {
      album3:"3 Kare Albüm", album5:"5 Kare Albüm", album7:"7 Kare Albüm",
      album9:"9 Kare Albüm", album11:"11 Kare Albüm", album13:"13 Kare Albüm",
      album15:"15 Kare Albüm", paspartu:"Paspartu", ribon:"Ribon Takımı",
    };
    const fmtDetail = (d: Record<string, number>) =>
      Object.entries(d).filter(([, v]) => v !== 0)
        .map(([k, v]) => `${stokEtiket[k] || k}: ${v > 0 ? "+" : ""}${v} adet`).join(", ");

    const anomaliler: any[] = [];
    let stokAnomali = 0, yaziciAnomali = 0;

    for (const kayit of tumKayitlar) {
      if (!kayit.tarih) continue;
      if (baslangic && kayit.tarih < baslangic) continue;
      if (bitis && kayit.tarih > bitis) continue;

      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍" };

      if (kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0) {
        anomaliler.push({
          tarih: kayit.tarih,
          mekan: mekan.name,
          mekanEmoji: mekan.emoji,
          type: "acilis",
          detailStr: fmtDetail(kayit.acilisAnomali),
          detail: kayit.acilisAnomali,
        });
        stokAnomali++;
      }
      if (kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0) {
        anomaliler.push({
          tarih: kayit.tarih,
          mekan: mekan.name,
          mekanEmoji: mekan.emoji,
          type: "kapanis",
          detailStr: fmtDetail(kayit.kapanisAnomali),
          detail: kayit.kapanisAnomali,
        });
        stokAnomali++;
      }
      if (Array.isArray(kayit.acilisYaziciAnomali) && kayit.acilisYaziciAnomali.length > 0) {
        for (const pa of kayit.acilisYaziciAnomali) {
          anomaliler.push({
            tarih: kayit.tarih,
            mekan: mekan.name,
            mekanEmoji: mekan.emoji,
            type: "yazici_acilis",
            detailStr: `${pa.label || "Yazıcı"}: beklenen ${pa.beklenenCounter}, girilen ${pa.startCounter} (fark: ${pa.fark > 0 ? "+" : ""}${pa.fark})`,
            detail: pa,
          });
          yaziciAnomali++;
        }
      }
      if (kayit.kapanisYaziciAnomali && Math.abs(kayit.kapanisYaziciAnomali.fark || 0) > 0) {
        const kya = kayit.kapanisYaziciAnomali;
        anomaliler.push({
          tarih: kayit.tarih,
          mekan: mekan.name,
          mekanEmoji: mekan.emoji,
          type: "yazici_kapanis",
          detailStr: `Net basılan ${kya.netBasilan || 0}, satış ${kya.satisAdet || 0} (fark: ${kya.fark > 0 ? "+" : ""}${kya.fark} kare)`,
          detail: kya,
        });
        yaziciAnomali++;
      }
    }

    anomaliler.sort((a, b) => b.tarih.localeCompare(a.tarih));

    console.log(`Anomali raporu: ${baslangic}–${bitis} — ${anomaliler.length} anomali (stok:${stokAnomali} yazıcı:${yaziciAnomali})`);
    return c.json({
      anomaliler,
      ozet: { toplam: anomaliler.length, stokAnomali, yaziciAnomali, baslangic, bitis },
    });
  } catch (err) {
    console.log("Anomali raporu error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// DUYURULAR
// ══════════════════════════════════════════

// GET /make-server-4da0b637/announcements
app.get("/make-server-4da0b637/announcements", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const isSADuyuru = user.user_metadata?.originalRole === "superadmin";
    const reqCIdDuyuru = c.req.query("company_id");
    const companyId = (isSADuyuru && reqCIdDuyuru) ? reqCIdDuyuru : getCompanyId(user);

    // SQL read geçici devre dışı — KV'den oku
    const ckv = companyKvFor(companyId);
    const all = await ckv.getByPrefix("announcement_");
    const now = new Date();
    const active = (all || []).filter((a: any) => { if (a.type === "temporary" && a.endDate) return new Date(a.endDate) >= now; return true; });
    active.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ announcements: active });
  } catch (err) {
    console.log("Get announcements error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /make-server-4da0b637/announcements
app.post("/make-server-4da0b637/announcements", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const role = user.user_metadata?.role || "personel";
    const canCreate = ["yonetici", "ust-mudur", "mudur", "operasyon"].includes(role);
    if (!canCreate) return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);

    const body = await c.req.json();
    const { title, message, photo, type, endDate, priority } = body;

    if (!title?.trim() || !message?.trim()) {
      return c.json({ error: "Başlık ve mesaj zorunludur." }, 400);
    }
    if (type === "temporary" && !endDate) {
      return c.json({ error: "Süreli duyuru için bitiş tarihi zorunludur." }, 400);
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const announcement = {
      id,
      title: title.trim(),
      message: message.trim(),
      photo: photo || null,
      type: type || "temporary",
      endDate: type === "temporary" ? endDate : null,
      priority: priority || "medium",
      createdAt: new Date().toISOString(),
      createdBy: user.user_metadata?.full_name || user.email || "",
      createdByRole: role,
    };

    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`announcement_${id}`, announcement);
    pgWrite("announcements", "insert", {
      id, company_id: getCompanyId(user), title: announcement.title, message: announcement.message,
      type: announcement.type, priority: announcement.priority, extra_data: announcement,
    });
    console.log(`Announcement created: ${id} by ${user.id}`);
    return c.json({ announcement });
  } catch (err) {
    console.log("Post announcement error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// PUT /make-server-4da0b637/announcements/:id
app.put("/make-server-4da0b637/announcements/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const role = user.user_metadata?.role || "personel";
    const canEdit = ["yonetici", "ust-mudur", "mudur", "operasyon"].includes(role);
    if (!canEdit) return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);

    const id = c.req.param("id");
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`announcement_${id}`);
    if (!existing) return c.json({ error: "Duyuru bulunamadı." }, 404);

    const body = await c.req.json();
    const { title, message, photo, type, endDate, priority } = body;

    const updated = {
      ...existing,
      title: title?.trim() ?? existing.title,
      message: message?.trim() ?? existing.message,
      photo: photo !== undefined ? photo : existing.photo,
      type: type ?? existing.type,
      endDate: (type ?? existing.type) === "temporary" ? (endDate ?? existing.endDate) : null,
      priority: priority ?? existing.priority,
      updatedAt: new Date().toISOString(),
    };

    await ckv.set(`announcement_${id}`, updated);
    return c.json({ announcement: updated });
  } catch (err) {
    console.log("Put announcement error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /make-server-4da0b637/announcements/:id
app.delete("/make-server-4da0b637/announcements/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const role = user.user_metadata?.role || "personel";
    const canDelete = ["yonetici", "ust-mudur", "mudur", "operasyon"].includes(role);
    if (!canDelete) return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);

    const id = c.req.param("id");
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`announcement_${id}`);
    console.log(`Announcement deleted: ${id} by ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log("Delete announcement error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Genel durum — tüm mekanların bugünkü albüm + ribon özeti
// GET /make-server-4da0b637/stok/genel-durum
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/stok/genel-durum", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const today = bizDateTR(); // İş günü tarihi (05:00 TR kırılımlı)
    const RIBON_PER_TAKIM = 200; // 1 takım = 200 baskı

    const isSAGenel = user.user_metadata?.originalRole === "superadmin";
    const reqCIdGenel = c.req.query("company_id");
    const effCIdGenel = (isSAGenel && reqCIdGenel) ? reqCIdGenel : getCompanyId(user);
    const mekanlarList: any[] = await getMekanlarFor(effCIdGenel);
    const ckv = companyKvFor(effCIdGenel);
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
    const bugunKayitlar = tumKayitlar.filter((k: any) => k.tarih === today);

    const kayitMap: Record<string, any> = {};
    for (const k of bugunKayitlar) kayitMap[k.mekanId] = k;

    // Bugün kaydı olmayan mekanlar için en son kapanış kaydını fallback olarak kullan
    const kapanisliKayitlar = tumKayitlar.filter((k: any) => k.kapanisYapildi && k.kapanish);
    for (const mekan of mekanlarList) {
      if (!kayitMap[mekan.id]) {
        const mekanKayitlari = kapanisliKayitlar
          .filter((k: any) => k.mekanId === mekan.id)
          .sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
        if (mekanKayitlari.length > 0) {
          kayitMap[mekan.id] = { ...mekanKayitlari[0], _fallback: true };
        }
      }
    }

    // Mekan stokları eski formatta (album3 vb.)
    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15","paspartu","ribon"];
    const albumEtiketleri: Record<string, string> = {
      album3:"3 Kare", album5:"5 Kare", album7:"7 Kare",
      album9:"9 Kare", album11:"11 Kare", album13:"13 Kare",
      album15:"15 Kare", paspartu:"Paspartu", ribon:"Ribon",
      // Depo tam/yarım etiketleri
      album3_tam:"3 Kare Tam", album3_yarim:"3 Kare Yarım",
      album5_tam:"5 Kare Tam", album5_yarim:"5 Kare Yarım",
      album7_tam:"7 Kare Tam", album7_yarim:"7 Kare Yarım",
      album9_tam:"9 Kare Tam", album9_yarim:"9 Kare Yarım",
      album11_tam:"11 Kare Tam", album11_yarim:"11 Kare Yarım",
      album13_tam:"13 Kare Tam", album13_yarim:"13 Kare Yarım",
      album15_tam:"15 Kare Tam", album15_yarim:"15 Kare Yarım",
    };
    const albumRenkleri: Record<string, string> = {
      album3:"#9dd9ea", album5:"#a8e6cf", album7:"#ffd4a3",
      album9:"#ffb3ba", album11:"#d4a5ff", album13:"#b8d4f1",
      album15:"#ffc78f", paspartu:"#e2e8f0", ribon:"#f9a8d4",
      // Depo tam/yarım renkleri (tam=koyu, yarım=açık ton)
      album3_tam:"#7cc5d6", album3_yarim:"#9dd9ea",
      album5_tam:"#8cd4b5", album5_yarim:"#a8e6cf",
      album7_tam:"#ebc28a", album7_yarim:"#ffd4a3",
      album9_tam:"#e69aa3", album9_yarim:"#ffb3ba",
      album11_tam:"#be8de6", album11_yarim:"#d4a5ff",
      album13_tam:"#9fbdd9", album13_yarim:"#b8d4f1",
      album15_tam:"#e6ad76", album15_yarim:"#ffc78f",
    };

    const mekanOzetleri: any[] = mekanlarList.map((mekan: any) => {
      const kayit = kayitMap[mekan.id];
      const isFallback = kayit?._fallback === true;
      // Fallback durumunda sadece kapanış stokunu kullan (açılışı değil)
      const stok = isFallback
        ? (kayit?.kapanish || null)
        : (kayit?.kapanish || kayit?.acilis || null);
      const vardiyaDurumu = isFallback
        ? "onceki_kapanis"
        : kayit
          ? kayit.kapanisYapildi ? "kapandi" : kayit.acilisYapildi ? "acik" : "yok"
          : "yok";

      // Stoku tam/yarım formatına migrate et
      const migStok = stok ? migrateMekanStok({ ...stok }) : null;
      const albumSayilari: Record<string, number> = {};
      // Eski format alanları + yeni tam/yarım alanları
      const tumAlbumAlanlari = [...albumAlanlari, "album3_tam","album3_yarim","album5_tam","album5_yarim","album7_tam","album7_yarim","album9_tam","album9_yarim","album11_tam","album11_yarim","album13_tam","album13_yarim","album15_tam","album15_yarim"];
      for (const alan of tumAlbumAlanlari) {
        albumSayilari[alan] = migStok ? (Number(migStok[alan]) || 0) : 0;
      }

      // Stoktaki takımlar × 200
      const stokRibonAdet = albumSayilari["ribon"] * RIBON_PER_TAKIM;

      // Makinaların içindeki kalan baskı (kapanış sayacı = makinada kalan baskı adedi)
      let makinaKalan = 0;
      const makinaKalanByTip: Record<string, number> = {};
      if (kayit?.printerData && Array.isArray(kayit.printerData)) {
        for (const pr of kayit.printerData) {
          const kalan = Math.max(0, Number(pr.endCounter) || 0);
          makinaKalan += kalan;
          if (kalan > 0 && pr.kagitTipiId) {
            makinaKalanByTip[pr.kagitTipiId] = (makinaKalanByTip[pr.kagitTipiId] || 0) + kalan;
          }
        }
      }

      const toplamRibonKapasite = stokRibonAdet + makinaKalan;

      // Mekan ribonlar (tip bazlı)
      const mekanRibonlar: Record<string, number> = stok?.ribonlar || {};

      return {
        id: mekan.id,
        name: mekan.name,
        emoji: mekan.emoji || "📍",
        color: mekan.color || "#9dd9ea",
        vardiyaDurumu,
        albumSayilari,
        ribonlar: mekanRibonlar,
        stokRibonAdet,
        makinaKalan,
        makinaKalanByTip,
        toplamRibonKapasite,
        veriVar: stok !== null,
        tarih: isFallback ? (kayit?.tarih || today) : today,
        fallbackTarih: isFallback ? (kayit?.tarih || null) : null,
      };
    });

    const genelRibonKapasite = mekanOzetleri.reduce((s: number, m: any) => s + m.toplamRibonKapasite, 0);

    // Depo stoğunu dahil et (tam/yarım migrasyonuyla)
    const depoStokMigrated: any = migrateDepoStok(await ckv.get("depo_stok") || {});
    const depoAlbumSayilari: Record<string, number> = {};
    for (const s of [3, 5, 7, 9, 11, 13, 15]) {
      depoAlbumSayilari[`album${s}_tam`] = Number(depoStokMigrated[`album${s}_tam`]) || 0;
      depoAlbumSayilari[`album${s}_yarim`] = Number(depoStokMigrated[`album${s}_yarim`]) || 0;
    }
    const depoRibonTakim = Number(depoStokMigrated.ribon) || 0;
    const depoRibonlar: Record<string, number> = depoStokMigrated.ribonlar || {};
    const depoRibonAdet = depoRibonTakim * RIBON_PER_TAKIM;

    // Genel toplam albüm dağılımı — tam/yarım ayrı (mekan + depo)
    const genelAlbumToplam2: Record<string, number> = {};
    for (const s of [3, 5, 7, 9, 11, 13, 15]) {
      const tamKey = `album${s}_tam`;
      const yarimKey = `album${s}_yarim`;
      genelAlbumToplam2[tamKey] = mekanOzetleri.reduce((sum: number, m: any) => sum + (m.albumSayilari[tamKey] || 0), 0) + (depoAlbumSayilari[tamKey] || 0);
      genelAlbumToplam2[yarimKey] = mekanOzetleri.reduce((sum: number, m: any) => sum + (m.albumSayilari[yarimKey] || 0), 0) + (depoAlbumSayilari[yarimKey] || 0);
    }
    genelAlbumToplam2["paspartu"] = mekanOzetleri.reduce((s: number, m: any) => s + (m.albumSayilari["paspartu"] || 0), 0);
    genelAlbumToplam2["ribon"] = mekanOzetleri.reduce((s: number, m: any) => s + (m.albumSayilari["ribon"] || 0), 0);

    // Boyut bazlı dağılım (tam+yarım toplam + ayrı detay)
    const albumDagilimiFinal = [3, 5, 7, 9, 11, 13, 15].map((sz) => ({
      alan: `album${sz}`,
      name: `${sz} Kare`,
      color: albumRenkleri[`album${sz}`],
      count: (genelAlbumToplam2[`album${sz}_tam`] || 0) + (genelAlbumToplam2[`album${sz}_yarim`] || 0),
      tam: genelAlbumToplam2[`album${sz}_tam`] || 0,
      yarim: genelAlbumToplam2[`album${sz}_yarim`] || 0,
    }));

    const genelRibonKapasiteFinal = genelRibonKapasite + depoRibonAdet;

    console.log(`Stok genel durum: ${today} — ${mekanOzetleri.length} mekan, genel ribon: ${genelRibonKapasiteFinal} baskı (depo: ${depoRibonAdet})`);
    return c.json({
      tarih: today,
      mekanlar: mekanOzetleri,
      genelAlbumDagilimi: albumDagilimiFinal,
      genelRibonKapasite: genelRibonKapasiteFinal,
      albumEtiketleri,
      albumRenkleri,
      ribonPerTakim: RIBON_PER_TAKIM,
      depo: {
        albumSayilari: depoAlbumSayilari,
        ribonTakim: depoRibonTakim,
        ribonAdet: depoRibonAdet,
        ribonlar: depoRibonlar,
      },
    });
  } catch (err) {
    console.log("Stok genel durum error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── DEPO STOK: Tam Boy / Yarım Boy Migrasyon Helper ──
// Eski format (album3, album5, ...) → yeni format (album3_tam, album3_yarim, ...)
// Mevcut stoklar yarım boy olarak taşınır.
function migrateDepoStok(stok: any): any {
  if (!stok || typeof stok !== "object") return stok || {};
  for (const s of [3, 5, 7, 9, 11, 13, 15]) {
    const oldKey = `album${s}`;
    const tamKey = `album${s}_tam`;
    const yarimKey = `album${s}_yarim`;
    if (stok[oldKey] !== undefined && stok[tamKey] === undefined && stok[yarimKey] === undefined) {
      stok[yarimKey] = stok[oldKey];
      stok[tamKey] = 0;
      delete stok[oldKey];
    }
  }
  return stok;
}

// Mekan stokunu tam/yarım formatına migrate et (eski album3 → album3_yarim)
function migrateMekanStok(stok: any): any {
  if (!stok || typeof stok !== "object") return stok || {};
  for (const s of [3, 5, 7, 9, 11, 13, 15]) {
    const oldKey = `album${s}`;
    const tamKey = `album${s}_tam`;
    const yarimKey = `album${s}_yarim`;
    if (stok[oldKey] !== undefined && stok[tamKey] === undefined && stok[yarimKey] === undefined) {
      stok[yarimKey] = stok[oldKey];
      stok[tamKey] = 0;
      delete stok[oldKey];
    }
  }
  return stok;
}

// Depo stok alanından mekan stok alanına dönüştür: album3_tam → album3 (LEGACY — artık kullanılmayabilir)
function depoAlanToMekanAlan(alan: string): string {
  return alan.replace(/_tam$/, "").replace(/_yarim$/, "");
}

// ──────────────────────────────────────────
// DEPO: Stok görüntüle
// GET /make-server-4da0b637/depo/stok
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/depo/stok", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    const stok: any = migrateDepoStok(await ckv.get("depo_stok") || {});
    return c.json({ stok });
  } catch (err) {
    console.log("Depo stok error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// DEPO: Giriş (üretimden gelen stok)
// POST /make-server-4da0b637/depo/giris
// Body: { alan: string, miktar: number, not?: string }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/depo/giris", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["admin", "yonetici", "ust-mudur", "mudur"].includes(role)) return c.json({ error: "Yalnızca yönetici ve müdür işlem yapabilir." }, 403);

    const { alan, miktar, not: notText, kagitTipiId } = await c.req.json();
    if (!alan || !miktar || miktar <= 0) return c.json({ error: "Alan ve pozitif miktar zorunludur." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const mevcutStok: any = migrateDepoStok(await ckv.get("depo_stok") || {});

    // Ribon tip bazlı: kagitTipiId varsa ribonlar objesini güncelle
    if (alan === "ribon" && kagitTipiId) {
      if (!mevcutStok.ribonlar || typeof mevcutStok.ribonlar !== "object") {
        // İlk kez ribonlar oluşturuluyor — mevcut ribon toplamını bu tipe ata (lazy migration)
        const mevcutRibonToplam = Number(mevcutStok.ribon) || 0;
        mevcutStok.ribonlar = mevcutRibonToplam > 0 ? { [kagitTipiId]: mevcutRibonToplam } : {};
      }
      const eskiTipDeger = Number(mevcutStok.ribonlar[kagitTipiId]) || 0;
      mevcutStok.ribonlar[kagitTipiId] = eskiTipDeger + miktar;
      // ribon toplamını yeniden hesapla
      mevcutStok.ribon = Object.values(mevcutStok.ribonlar as Record<string, number>).reduce((s: number, v: number) => s + (Number(v) || 0), 0);
    } else {
      const eskiDeger = Number(mevcutStok[alan]) || 0;
      mevcutStok[alan] = eskiDeger + miktar;
    }
    const eskiDeger = alan === "ribon" && kagitTipiId ? (Number((mevcutStok.ribonlar || {})[kagitTipiId]) || 0) - miktar : (Number(mevcutStok[alan]) || 0) - miktar;
    mevcutStok.guncellenmeTarihi = new Date().toISOString();
    await ckv.set("depo_stok", mevcutStok);

    const hareket = {
      id: `depo_hareket_${Date.now()}`,
      tip: "giris",
      alan,
      kagitTipiId: kagitTipiId || null,
      miktar,
      eskiDeger,
      yeniDeger: alan === "ribon" && kagitTipiId ? (mevcutStok.ribonlar[kagitTipiId] || 0) : (mevcutStok[alan] || 0),
      not: notText || "",
      tarih: new Date().toISOString(),
      kullaniciId: user.id,
      kullaniciAdi: user.user_metadata?.full_name || user.email,
    };
    await ckv.set(hareket.id, hareket);

    console.log(`Depo giriş: ${alan}${kagitTipiId ? `(${kagitTipiId})` : ''} +${miktar} (${hareket.kullaniciAdi})`);
    return c.json({ basarili: true, yeniDeger: hareket.yeniDeger, hareket });
  } catch (err) {
    console.log("Depo giriş error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// DEPO: Çıkış (mekana dağıtım)
// POST /make-server-4da0b637/depo/cikis
// Body: { alan: string, miktar: number, hedefMekan?: string, not?: string }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/depo/cikis", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["admin", "yonetici", "ust-mudur", "mudur"].includes(role)) return c.json({ error: "Yalnızca yönetici ve müdür işlem yapabilir." }, 403);

    const { alan, miktar, hedefMekan, not: notText, kagitTipiId } = await c.req.json();
    if (!alan || !miktar || miktar <= 0) return c.json({ error: "Alan ve pozitif miktar zorunludur." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const mevcutStok: any = migrateDepoStok(await ckv.get("depo_stok") || {});

    let eskiDeger: number;
    if (alan === "ribon" && kagitTipiId) {
      if (!mevcutStok.ribonlar || typeof mevcutStok.ribonlar !== "object") {
        // İlk kez ribonlar oluşturuluyor — mevcut ribon toplamını bu tipe ata (lazy migration)
        const mevcutRibonToplam = Number(mevcutStok.ribon) || 0;
        mevcutStok.ribonlar = mevcutRibonToplam > 0 ? { [kagitTipiId]: mevcutRibonToplam } : {};
      }
      eskiDeger = Number(mevcutStok.ribonlar[kagitTipiId]) || 0;
      if (eskiDeger < miktar) return c.json({ error: `Yetersiz stok. Mevcut: ${eskiDeger}, İstenen: ${miktar}` }, 400);
      mevcutStok.ribonlar[kagitTipiId] = eskiDeger - miktar;
      mevcutStok.ribon = Object.values(mevcutStok.ribonlar as Record<string, number>).reduce((s: number, v: number) => s + (Number(v) || 0), 0);
    } else {
      eskiDeger = Number(mevcutStok[alan]) || 0;
      if (eskiDeger < miktar) return c.json({ error: `Yetersiz stok. Mevcut: ${eskiDeger}, İstenen: ${miktar}` }, 400);
      mevcutStok[alan] = eskiDeger - miktar;
    }

    mevcutStok.guncellenmeTarihi = new Date().toISOString();
    await ckv.set("depo_stok", mevcutStok);

    const yeniDeger = alan === "ribon" && kagitTipiId ? (mevcutStok.ribonlar[kagitTipiId] || 0) : (mevcutStok[alan] || 0);
    const hareket = {
      id: `depo_hareket_${Date.now()}`,
      tip: "cikis",
      alan,
      kagitTipiId: kagitTipiId || null,
      miktar,
      eskiDeger,
      yeniDeger,
      hedefMekan: hedefMekan || "",
      not: notText || "",
      tarih: new Date().toISOString(),
      kullaniciId: user.id,
      kullaniciAdi: user.user_metadata?.full_name || user.email,
    };
    await ckv.set(hareket.id, hareket);

    console.log(`Depo çıkış: ${alan}${kagitTipiId ? `(${kagitTipiId})` : ''} -${miktar} → ${hedefMekan || "manuel"} (${hareket.kullaniciAdi})`);
    return c.json({ basarili: true, yeniDeger: mevcutStok[alan], hareket });
  } catch (err) {
    console.log("Depo çıkış error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// DEPO: Hareket geçmişi (son 50)
// GET /make-server-4da0b637/depo/hareketler
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/depo/hareketler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["admin", "yonetici", "ust-mudur", "mudur"].includes(role)) return c.json({ error: "Yetki yok." }, 403);

    const isSAHareket = user.user_metadata?.originalRole === "superadmin";
    const reqCIdHareket = c.req.query("company_id");
    const ckv = companyKvFor((isSAHareket && reqCIdHareket) ? reqCIdHareket : getCompanyId(user));
    const tumHareketler: any[] = await ckv.getByPrefix("depo_hareket_") || [];
    const sirali = tumHareketler.sort((a: any, b: any) =>
      new Date(b.tarih).getTime() - new Date(a.tarih).getTime()
    );
    return c.json({ hareketler: sirali.slice(0, 50) });
  } catch (err) {
    console.log("Depo hareketler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Mekan / Depo stok güncelle (yönetici)
// POST /make-server-4da0b637/stok/mekan/guncelle
// Body: { mekanId: string, albumSayilari: Record<string,number>, ribonTakim: number }
// mekanId = "depo" ise depo_stok güncellenir, yoksa bugünün stok_gunluk kaydının acilis alanı
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/stok/mekan/guncelle", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(role)) return c.json({ error: "Yalnızca yönetici ve müdür stok güncelleyebilir." }, 403);

    const { mekanId, albumSayilari, ribonTakim, ribonlar: bodyRibonlar } = await c.req.json();
    if (!mekanId) return c.json({ error: "mekanId zorunludur." }, 400);

    const albumAlanlariYeni = ["album3_tam","album3_yarim","album5_tam","album5_yarim","album7_tam","album7_yarim","album9_tam","album9_yarim","album11_tam","album11_yarim","album13_tam","album13_yarim","album15_tam","album15_yarim"];
    const stokObj: Record<string, number> = {};
    // Gelen veri tam/yarım formatında mı yoksa eski formatta mı kontrol et
    const hasNewMekanFormat = albumAlanlariYeni.some(a => albumSayilari?.[a] !== undefined);
    if (hasNewMekanFormat) {
      for (const alan of albumAlanlariYeni) stokObj[alan] = Number(albumSayilari?.[alan]) || 0;
    } else {
      // Eski format → yarım'a migrate et
      for (const s of [3, 5, 7, 9, 11, 13, 15]) {
        stokObj[`album${s}_yarim`] = Number(albumSayilari?.[`album${s}`]) || 0;
        stokObj[`album${s}_tam`] = 0;
      }
    }
    // ribonlar varsa toplam hesapla, yoksa eski ribonTakim kullan
    const ribonlarObj: Record<string, number> = bodyRibonlar && typeof bodyRibonlar === "object" ? bodyRibonlar : {};
    const ribonlarToplam = Object.values(ribonlarObj).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    stokObj.ribon = ribonlarToplam > 0 ? ribonlarToplam : (Number(ribonTakim) || 0);
    const today = bizDateTR(); // İş günü tarihi (05:00 TR kırılımlı)

    const ckv = companyKvFor(getCompanyId(user));
    if (mekanId === "depo") {
      const depoStok: any = migrateDepoStok(await ckv.get("depo_stok") || {});
      // albumSayilari depo formatında olabilir (album3_tam, album3_yarim) veya eski formatta
      for (const s of [3, 5, 7, 9, 11, 13, 15]) {
        const tamKey = `album${s}_tam`;
        const yarimKey = `album${s}_yarim`;
        if (albumSayilari?.[tamKey] !== undefined || albumSayilari?.[yarimKey] !== undefined) {
          // Yeni format gönderilmiş
          depoStok[tamKey] = Number(albumSayilari[tamKey]) || 0;
          depoStok[yarimKey] = Number(albumSayilari[yarimKey]) || 0;
        } else if (albumSayilari?.[`album${s}`] !== undefined) {
          // Eski format — yarım olarak ata
          depoStok[yarimKey] = Number(albumSayilari[`album${s}`]) || 0;
          depoStok[tamKey] = depoStok[tamKey] || 0;
        }
      }
      depoStok.ribon = stokObj.ribon;
      if (Object.keys(ribonlarObj).length > 0) depoStok.ribonlar = ribonlarObj;
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await ckv.set("depo_stok", depoStok);
      console.log(`Depo stok güncellendi: ${user.user_metadata?.full_name}`);
      return c.json({ basarili: true });
    }

    // Doğru kaydı bul: bugün varsa bugünkü, yoksa son kapanış kaydı
    // Yeni kayıt OLUŞTURULMAZ — mekanı açık/kapalı gibi göstermemek için
    const todayKey = `stok_gunluk_${mekanId}_${today}`;
    let kvKey = todayKey;
    let kayit: any = await ckv.get(todayKey);
    let aktifField: string;

    if (kayit) {
      // Bugün kayıt var — vardiya açıksa acilis, kapandıysa kapanish
      aktifField = kayit.kapanisYapildi ? "kapanish" : "acilis";
    } else {
      // Bugün kayıt yok → en son kapanış kaydını bul
      const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
      const mekanKayitlari = tumKayitlar
        .filter((k: any) => k.mekanId === mekanId && k.kapanisYapildi && k.kapanish)
        .sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
      if (mekanKayitlari.length > 0) {
        kayit = mekanKayitlari[0];
        kvKey = `stok_gunluk_${mekanId}_${kayit.tarih}`;
        aktifField = "kapanish";
      } else {
        // Hiç kayıt yok — bugüne yönetici kaydı oluştur (acilisYapildi set edilmez)
        kayit = { mekanId, tarih: today };
        aktifField = "acilis";
      }
    }

    const aktifStok = { ...migrateMekanStok({ ...(kayit[aktifField] || {}) }), ...stokObj };
    if (Object.keys(ribonlarObj).length > 0) aktifStok.ribonlar = ribonlarObj;
    // Eski format alanları temizle
    for (const s of [3, 5, 7, 9, 11, 13, 15]) delete aktifStok[`album${s}`];
    kayit[aktifField] = aktifStok;
    kayit.yoneticiGuncelleme = new Date().toISOString();
    await ckv.set(kvKey, kayit);

    console.log(`Mekan stok güncellendi: mekan=${mekanId}, alan=${aktifField}, key=${kvKey}, kullanıcı=${user.user_metadata?.full_name}`);
    return c.json({ basarili: true });
  } catch (err) {
    console.log("Stok mekan güncelle error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Mekan / Depo stok sıfırla (yönetici)
// POST /make-server-4da0b637/stok/mekan/sifirla
// Body: { mekanId: string }
// ───────��──────────────────────────────────
app.post("/make-server-4da0b637/stok/mekan/sifirla", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(role)) return c.json({ error: "Yalnızca yönetici ve müdür stok sıfırlayabilir." }, 403);

    const { mekanId } = await c.req.json();
    if (!mekanId) return c.json({ error: "mekanId zorunludur." }, 400);

    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15"];
    const sifirStok: Record<string, number> = {};
    for (const alan of albumAlanlari) sifirStok[alan] = 0;
    sifirStok.ribon = 0;

    const ckv = companyKvFor(getCompanyId(user));
    if (mekanId === "depo") {
      const depoSifir: Record<string, any> = { ribon: 0, guncellenmeTarihi: new Date().toISOString() };
      for (const s of [3, 5, 7, 9, 11, 13, 15]) {
        depoSifir[`album${s}_tam`] = 0;
        depoSifir[`album${s}_yarim`] = 0;
      }
      await ckv.set("depo_stok", depoSifir);
      console.log(`Depo stok sıfırlandı: ${user.user_metadata?.full_name}`);
      return c.json({ basarili: true });
    }

    const today = bizDateTR(); // İş günü tarihi (05:00 TR kırılımlı)

    // Transfer ile aynı mantık: mevcut kaydı bul, uygun alana yaz, yeni kayıt açma
    const todaySKey = `stok_gunluk_${mekanId}_${today}`;
    let sKvKey = todaySKey;
    let sKayit: any = await ckv.get(todaySKey);
    let sAktifField: string;

    if (sKayit) {
      sAktifField = sKayit.kapanisYapildi ? "kapanish" : "acilis";
    } else {
      const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
      const mekanKayitlari = tumKayitlar
        .filter((k: any) => k.mekanId === mekanId && k.kapanisYapildi && k.kapanish)
        .sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
      if (mekanKayitlari.length > 0) {
        sKayit = mekanKayitlari[0];
        sKvKey = `stok_gunluk_${mekanId}_${sKayit.tarih}`;
        sAktifField = "kapanish";
      } else {
        sKayit = { mekanId, tarih: today };
        sAktifField = "acilis";
      }
    }

    sKayit[sAktifField] = { ...(sKayit[sAktifField] || {}), ...sifirStok };
    sKayit.yoneticiSifirlama = new Date().toISOString();
    await ckv.set(sKvKey, sKayit);

    console.log(`Mekan stok sıfırlandı: mekan=${mekanId}, alan=${sAktifField}, key=${sKvKey}, kullanıcı=${user.user_metadata?.full_name}`);
    return c.json({ basarili: true });
  } catch (err) {
    console.log("Stok mekan sıfırla error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// STOK: Mekan / Depo arası aktarım
// POST /make-server-4da0b637/stok/transfer
// Body: { kaynakId, hedefId, alan, miktar, not? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/stok/transfer", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(role)) {
      return c.json({ error: "Aktarım için yetkiniz yok." }, 403);
    }

    const { kaynakId, hedefId, alan, miktar, not: notText, kagitTipiId: transferKagitTipiId } = await c.req.json();
    if (!kaynakId || !hedefId || !alan || !miktar || miktar <= 0) {
      return c.json({ error: "Kaynak, hedef, alan ve pozitif miktar zorunludur." }, 400);
    }
    if (kaynakId === hedefId) {
      return c.json({ error: "Kaynak ve hedef aynı olamaz." }, 400);
    }
    const albumAlanlariEski = ["album3","album5","album7","album9","album11","album13","album15"];
    const albumAlanlariDepo = albumAlanlariEski.flatMap(a => [`${a}_tam`, `${a}_yarim`]);
    const gecerliAlanlar = [...albumAlanlariEski, ...albumAlanlariDepo, "ribon"];
    if (!gecerliAlanlar.includes(alan)) {
      return c.json({ error: "Geçersiz alan." }, 400);
    }
    // Ribon transferinde kagitTipiId zorunlu (yeni format)
    const isRibonTransfer = alan === "ribon" && !!transferKagitTipiId;
    // Artık mekanlar da tam/yarım tutuyor — alan direkt kullanılır
    const mekanAlan = alan;

    const today = bizDateTR(); // İş günü tarihi (05:00 TR kırılımlı)
    const kullaniciAdi = user.user_metadata?.full_name || user.email || "Bilinmeyen";

    const ckv = companyKvFor(getCompanyId(user));

    // Helper: mekan stok oku (bugün veya fallback)
    // ÖNEMLİ: Fallback durumunda fallback kaydının kendi tarihli key'i döndürülür,
    // bugünün key'i DEĞİL — böylece transfer yazarken yeni kayıt oluşturulmaz (mekan açılmaz).
    // Mekan stoku eski formatta (album3 vb.) — mekanAlan kullanılır.
    const getMekanStok = async (mekanId: string) => {
      const todayKey = `stok_gunluk_${mekanId}_${today}`;
      const kayit: any = await ckv.get(todayKey);
      if (kayit) {
        const aktifField = kayit.kapanisYapildi ? "kapanish" : "acilis";
        const aktif = migrateMekanStok({ ...(kayit[aktifField] || {}) });
        return { kayit, kvKey: todayKey, aktif, alan_deger: Number(aktif[mekanAlan]) || 0, aktifField };
      }
      const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
      const mekanKayitlari = tumKayitlar
        .filter((k: any) => k.mekanId === mekanId && k.kapanisYapildi && k.kapanish)
        .sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
      if (mekanKayitlari.length > 0) {
        const fallbackKayit = mekanKayitlari[0];
        const fallbackKey = `stok_gunluk_${mekanId}_${fallbackKayit.tarih}`;
        const fallbackAktif = migrateMekanStok({ ...(fallbackKayit.kapanish || {}) });
        return { kayit: fallbackKayit, kvKey: fallbackKey, aktif: fallbackAktif, alan_deger: Number(fallbackAktif[mekanAlan]) || 0, aktifField: "kapanish" };
      }
      return { kayit: null, kvKey: todayKey, aktif: {}, alan_deger: 0, aktifField: "acilis" };
    };

    // Helper: mekan stok yaz — mekanAlan (eski format) kullanır
    const setMekanStok = async (mekanId: string, kvKey: string, kayit: any, aktifField: string, aktif: any, yeniDeger: number) => {
      const yeniKayit: any = kayit ? { ...kayit } : { mekanId, tarih: today };
      yeniKayit[aktifField] = { ...aktif, [mekanAlan]: yeniDeger };
      yeniKayit.stokTransferGuncelleme = new Date().toISOString();
      await ckv.set(kvKey, yeniKayit);
    };

    // Mekan isimlerini al (log için)
    let kaynakAdi = "Depo", hedefAdi = "Depo";
    let kaynakEmoji = "🏪", hedefEmoji = "🏪";
    if (kaynakId !== "depo") {
      const m: any = await ckv.get(`mekan_${kaynakId}`);
      if (m) { kaynakAdi = m.name; kaynakEmoji = m.emoji || "📍"; }
    }
    if (hedefId !== "depo") {
      const m: any = await ckv.get(`mekan_${hedefId}`);
      if (m) { hedefAdi = m.name; hedefEmoji = m.emoji || "📍"; }
    }

    let eskiKaynakDeger = 0, yeniKaynakDeger = 0;
    let eskiHedefDeger = 0, yeniHedefDeger = 0;

    // Helper: ribonlar objesini güncelle + ribon toplamını yeniden hesapla
    const updateRibonlar = (stokObj: any, kagitId: string, delta: number) => {
      if (!stokObj.ribonlar || typeof stokObj.ribonlar !== "object") {
        // Lazy migration: mevcut ribon toplamını bu tipe ata
        const mevcutToplam = Number(stokObj.ribon) || 0;
        stokObj.ribonlar = mevcutToplam > 0 ? { [kagitId]: mevcutToplam } : {};
      }
      stokObj.ribonlar[kagitId] = Math.max(0, (Number(stokObj.ribonlar[kagitId]) || 0) + delta);
      // ribon toplamını yeniden hesapla
      stokObj.ribon = Object.values(stokObj.ribonlar as Record<string, number>).reduce((s: number, v: number) => s + (Number(v) || 0), 0);
    };

    // Kaynak: stok azalt
    if (kaynakId === "depo") {
      const depoStok: any = migrateDepoStok(await ckv.get("depo_stok") || {});
      if (isRibonTransfer) {
        eskiKaynakDeger = Number(depoStok.ribonlar?.[transferKagitTipiId]) || 0;
      } else {
        eskiKaynakDeger = Number(depoStok[alan]) || 0;
      }
      if (eskiKaynakDeger < miktar) {
        return c.json({ error: `Depo stoğu yetersiz. Mevcut: ${eskiKaynakDeger}, İstenen: ${miktar}` }, 400);
      }
      yeniKaynakDeger = eskiKaynakDeger - miktar;
      if (isRibonTransfer) {
        updateRibonlar(depoStok, transferKagitTipiId, -miktar);
      } else {
        depoStok[alan] = yeniKaynakDeger;
      }
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await ckv.set("depo_stok", depoStok);
    } else {
      const { kayit, kvKey, aktif, alan_deger, aktifField } = await getMekanStok(kaynakId);
      if (isRibonTransfer) {
        eskiKaynakDeger = Number(aktif.ribonlar?.[transferKagitTipiId]) || 0;
      } else {
        eskiKaynakDeger = alan_deger;
      }
      if (eskiKaynakDeger < miktar) {
        return c.json({ error: `${kaynakAdi} stoğu yetersiz. Mevcut: ${eskiKaynakDeger}, İstenen: ${miktar}` }, 400);
      }
      yeniKaynakDeger = eskiKaynakDeger - miktar;
      if (isRibonTransfer) {
        updateRibonlar(aktif, transferKagitTipiId, -miktar);
        const yeniKayit: any = kayit ? { ...kayit } : { mekanId: kaynakId, tarih: today };
        yeniKayit[aktifField] = aktif;
        yeniKayit.stokTransferGuncelleme = new Date().toISOString();
        await ckv.set(kvKey, yeniKayit);
      } else {
        await setMekanStok(kaynakId, kvKey, kayit, aktifField, aktif, yeniKaynakDeger);
      }
    }

    // Hedef: stok artır
    if (hedefId === "depo") {
      const depoStok: any = migrateDepoStok(await ckv.get("depo_stok") || {});
      if (isRibonTransfer) {
        eskiHedefDeger = Number(depoStok.ribonlar?.[transferKagitTipiId]) || 0;
      } else {
        eskiHedefDeger = Number(depoStok[alan]) || 0;
      }
      yeniHedefDeger = eskiHedefDeger + miktar;
      if (isRibonTransfer) {
        updateRibonlar(depoStok, transferKagitTipiId, miktar);
      } else {
        depoStok[alan] = yeniHedefDeger;
      }
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await ckv.set("depo_stok", depoStok);
    } else {
      const { kayit, kvKey, aktif, alan_deger, aktifField } = await getMekanStok(hedefId);
      if (isRibonTransfer) {
        eskiHedefDeger = Number(aktif.ribonlar?.[transferKagitTipiId]) || 0;
      } else {
        eskiHedefDeger = alan_deger;
      }
      yeniHedefDeger = eskiHedefDeger + miktar;
      if (isRibonTransfer) {
        updateRibonlar(aktif, transferKagitTipiId, miktar);
        const yeniKayit: any = kayit ? { ...kayit } : { mekanId: hedefId, tarih: today };
        yeniKayit[aktifField] = aktif;
        yeniKayit.stokTransferGuncelleme = new Date().toISOString();
        await ckv.set(kvKey, yeniKayit);
      } else {
        await setMekanStok(hedefId, kvKey, kayit, aktifField, aktif, yeniHedefDeger);
      }
    }

    // Transfer logu kaydet
    const transferId = `stok_transfer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const transferLog = {
      id: transferId,
      kaynakId, kaynakAdi, kaynakEmoji,
      hedefId, hedefAdi, hedefEmoji,
      alan, miktar,
      kagitTipiId: transferKagitTipiId || null,
      not: notText || "",
      tarih: new Date().toISOString(),
      kullaniciId: user.id,
      kullaniciAdi,
      eskiKaynakDeger, yeniKaynakDeger,
      eskiHedefDeger, yeniHedefDeger,
    };
    await ckv.set(transferId, transferLog);

    console.log(`Stok transfer: ${alan} x${miktar} | ${kaynakEmoji}${kaynakAdi} → ${hedefEmoji}${hedefAdi} | ${kullaniciAdi}`);
    return c.json({ basarili: true, transfer: transferLog });
  } catch (err) {
    console.log("Stok transfer error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ─────────────────���────────────────────────
// STOK: Transfer geçmişi (son 50)
// GET /make-server-4da0b637/stok/transferler
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/stok/transferler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(role)) {
      return c.json({ error: "Yetki yok." }, 403);
    }
    const isSATransfer = user.user_metadata?.originalRole === "superadmin";
    const reqCIdTransfer = c.req.query("company_id");
    const ckv = companyKvFor((isSATransfer && reqCIdTransfer) ? reqCIdTransfer : getCompanyId(user));
    const tumTransferler: any[] = await ckv.getByPrefix("stok_transfer_") || [];
    const sirali = tumTransferler.sort((a: any, b: any) =>
      new Date(b.tarih).getTime() - new Date(a.tarih).getTime()
    );
    return c.json({ transferler: sirali.slice(0, 50) });
  } catch (err) {
    console.log("Stok transferler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// EKSTRA İŞ: Kaynak listesi (depo + mekanlar)
// GET /make-server-4da0b637/ekstra-is/kaynaklar
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/ekstra-is/kaynaklar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const mekanlarList: any[] = await getMekanlar();

    // Bugünün tarihini Türkiye saatiyle hesapla (UTC+3)
    const nowTR = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const bugunTR = nowTR.toISOString().split('T')[0];
    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15"];

    const ckv = companyKvFor(getCompanyId(user));
    // Her mekan için bugünün günlük stok kaydını çek
    const mekanlar = await Promise.all(mekanlarList.map(async (m: any) => {
      // Önce bugünü dene, bulamazsan geriye doğru 14 güne kadar tara
      let bulunanKayit: any = null;
      let bulunanTarih = bugunTR;
      for (let i = 0; i <= 14; i++) {
        const d = new Date(Date.now() + 3 * 60 * 60 * 1000 - i * 86400000);
        const dStr = d.toISOString().split('T')[0];
        const kayit: any = await ckv.get(`stok_gunluk_${m.id}_${dStr}`);
        if (kayit && (kayit.kapanish || kayit.acilis)) {
          bulunanKayit = kayit;
          bulunanTarih = dStr;
          break;
        }
      }
      const albumSayilari: Record<string, number> = {};
      if (bulunanKayit) {
        const aktifStok = bulunanKayit.kapanish || bulunanKayit.acilis || {};
        for (const alan of albumAlanlari) albumSayilari[alan] = Number(aktifStok[alan]) || 0;
      } else {
        for (const alan of albumAlanlari) albumSayilari[alan] = 0;
      }
      // stokTarihi: null = bugünden, string = önceki bir tarihten
      const stokTarihi = bulunanTarih !== bugunTR ? bulunanTarih : null;
      return { id: m.id, name: m.name, emoji: m.emoji || "📍", color: m.color || "#9dd9ea", albumSayilari, stokTarihi };
    }));

    const depoStokRaw: any = migrateDepoStok(await ckv.get("depo_stok") || {});
    const depoAlbumSayilari: Record<string, number> = {};
    for (const s of [3, 5, 7, 9, 11, 13, 15]) {
      depoAlbumSayilari[`album${s}_tam`] = Number(depoStokRaw[`album${s}_tam`]) || 0;
      depoAlbumSayilari[`album${s}_yarim`] = Number(depoStokRaw[`album${s}_yarim`]) || 0;
    }
    const depo = {
      id: "depo",
      name: "Depo",
      emoji: "🏪",
      albumSayilari: depoAlbumSayilari,
      ribonTakim: Number(depoStokRaw.ribon) || 0,
    };

    // ── Tüm yazıcıları getir (ekipman kaydından) ─────────────────���────────
    const tumEkipmanlarEkstra: any[] = await ckv.getByPrefix("ekipman_") || [];
    const tumYazicilar = tumEkipmanlarEkstra.filter((eq: any) =>
      eq.category === 'printer' && eq.status !== 'broken'
    );
    const nowTR2 = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const yazicilar = await Promise.all(tumYazicilar.map(async (eq: any) => {
      const mekan = mekanlarList.find((m: any) => m.id === eq.locationId);
      let lastEndCounter: number | null = null;
      let lastEndTarih: string | null = null;
      let lastEndRibonMevcut: number | null = null;

      // Önce ekipman kaydında direkt kayıtlı olan değeri dene
      if (eq.lastEndCounter !== undefined && eq.lastEndCounter !== null) {
        lastEndCounter = Number(eq.lastEndCounter);
        lastEndTarih = eq.lastEndTarih || null;
        lastEndRibonMevcut = eq.lastEndRibonMevcut !== undefined ? Number(eq.lastEndRibonMevcut) : null;
      } else if (eq.locationId) {
        // Mekan KV kayıtlarından tara (geriye 14 gün)
        for (let i = 0; i <= 14; i++) {
          const d = new Date(nowTR2.getTime() - i * 86400000);
          const dStr = d.toISOString().split('T')[0];
          const gunKayit: any = await ckv.get(`stok_gunluk_${eq.locationId}_${dStr}`);
          if (gunKayit?.printerData && Array.isArray(gunKayit.printerData)) {
            const pr = gunKayit.printerData.find((p: any) => (p.ekipmanId || p.id) === eq.id);
            if (pr?.endCounter !== undefined) {
              lastEndCounter = Number(pr.endCounter);
              lastEndTarih = dStr;
              lastEndRibonMevcut = pr.ribonMevcut !== undefined ? Number(pr.ribonMevcut) : null;
              break;
            }
          }
        }
      }

      return {
        ekipmanId: eq.id,
        brand: eq.brand || '',
        model: eq.model || '',
        serialNumber: eq.serialNumber || '',
        status: eq.status || 'working',
        mekanId: eq.locationId || null,
        mekanAdi: mekan?.name || null,
        mekanEmoji: mekan?.emoji || null,
        lastEndCounter,
        lastEndTarih,
        lastEndRibonMevcut,
      };
    }));

    return c.json({ mekanlar, depo, yazicilar });
  } catch (err) {
    console.log("Ekstra-is kaynaklar error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// EKSTRA İŞ: Durum sorgula
// GET /make-server-4da0b637/ekstra-is/durum/:taskId/:tarih
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/ekstra-is/durum/:taskId/:tarih", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { taskId, tarih } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const kayit: any = await ckv.get(`ekstra_is_${taskId}_${tarih}`);
    return c.json({ kayit: kayit || null });
  } catch (err) {
    console.log("Ekstra-is durum error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// EKSTRA İŞ: Açılış (kaynak stok transferi)
// POST /make-server-4da0b637/ekstra-is/acilis
// Body: { taskId, tarih, kaynakId, kaynakTipi, kaynakAdi, kaynakEmoji, acilis, acilisNot? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/ekstra-is/acilis", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { taskId, tarih, kaynakId, kaynakAdi, kaynakEmoji, acilis, acilisNot, yaziciData } = await c.req.json();
    if (!taskId || !tarih || !kaynakId || !acilis) {
      return c.json({ error: "taskId, tarih, kaynakId ve acilis zorunludur." }, 400);
    }

    const ckv = companyKvFor(getCompanyId(user));
    const mevcutKayit: any = await ckv.get(`ekstra_is_${taskId}_${tarih}`);
    if (mevcutKayit?.acilisYapildi) {
      return c.json({ error: "Açılış zaten yapılmış." }, 400);
    }

    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15"];

    // Kaynak stoktan düş
    if (kaynakId === "depo") {
      const depoStok: any = migrateDepoStok(await ckv.get("depo_stok") || {});
      // acilis objesi eski formatta (album3 vb.) — depoda _yarim'dan düş (varsayılan)
      for (const alan of albumAlanlari) {
        const istenen = Number(acilis[alan]) || 0;
        if (istenen <= 0) continue;
        // Önce yarımdan düşmeye çalış, yetmezse tamdan
        const yarimKey = `${alan}_yarim`;
        const tamKey = `${alan}_tam`;
        const yarimMevcut = Number(depoStok[yarimKey]) || 0;
        const tamMevcut = Number(depoStok[tamKey]) || 0;
        if (yarimMevcut + tamMevcut < istenen) {
          return c.json({ error: `Depo ${alan} stoğu yetersiz. Mevcut: ${yarimMevcut + tamMevcut}, İstenen: ${istenen}` }, 400);
        }
        if (yarimMevcut >= istenen) {
          depoStok[yarimKey] = yarimMevcut - istenen;
        } else {
          depoStok[yarimKey] = 0;
          depoStok[tamKey] = tamMevcut - (istenen - yarimMevcut);
        }
      }
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await ckv.set("depo_stok", depoStok);
    } else {
      // Mekan stoku — bugünün kaydından düş, yoksa önceki en son kaydı bul
      let mekanKayit: any = await ckv.get(`stok_gunluk_${kaynakId}_${tarih}`);
      let stokKayitAnahtari = `stok_gunluk_${kaynakId}_${tarih}`;
      if (!mekanKayit) {
        const bugunDt = new Date(tarih);
        for (let i = 1; i <= 14; i++) {
          const dt = new Date(bugunDt);
          dt.setDate(bugunDt.getDate() - i);
          const dtStr = dt.toISOString().split("T")[0];
          const gecmis: any = await ckv.get(`stok_gunluk_${kaynakId}_${dtStr}`);
          if (gecmis) { mekanKayit = gecmis; stokKayitAnahtari = `stok_gunluk_${kaynakId}_${dtStr}`; break; }
        }
      }
      if (!mekanKayit) {
        return c.json({ error: `${kaynakAdi} için stok kaydı bulunamadı (son 14 gün).` }, 400);
      }
      const aktifField = mekanKayit.kapanish ? "kapanish" : "acilis";
      const aktifStok: any = { ...(mekanKayit[aktifField] || {}) };
      // Önce yeterliliği kontrol et
      for (const alan of albumAlanlari) {
        const istenen = Number(acilis[alan]) || 0;
        if (istenen <= 0) continue;
        const mevcutStok = Number(aktifStok[alan]) || 0;
        if (mevcutStok < istenen) {
          return c.json({ error: `${kaynakAdi} ${alan} stoğu yetersiz. Mevcut: ${mevcutStok}, İstenen: ${istenen}` }, 400);
        }
      }
      // Düş
      for (const alan of albumAlanlari) {
        const istenen = Number(acilis[alan]) || 0;
        if (istenen <= 0) continue;
        aktifStok[alan] = (Number(aktifStok[alan]) || 0) - istenen;
      }
      const guncelKayit: any = { ...mekanKayit, [aktifField]: aktifStok, stokTransferGuncelleme: new Date().toISOString() };
      await ckv.set(stokKayitAnahtari, guncelKayit);
    }

    // ── Yazıcı sayaç anomali tespiti (açılıştaki startCounter vs önceki endCounter) ──
    let yaziciAnomali: any = null;
    if (yaziciData?.ekipmanId && yaziciData?.startCounter !== undefined) {
      const ekipman: any = await ckv.get(yaziciData.ekipmanId);
      const startC = Number(yaziciData.startCounter);
      let lastEnd: number | null = ekipman?.lastEndCounter !== undefined ? Number(ekipman.lastEndCounter) : null;
      if (lastEnd === null) {
        // Geriye tara
        const baseD = new Date(tarih);
        for (let i = 1; i <= 14; i++) {
          const d = new Date(baseD);
          d.setDate(d.getDate() - i);
          const dStr = d.toISOString().split('T')[0];
          // Mekan stok kaydında ara
          if (ekipman?.locationId) {
            const gk: any = await ckv.get(`stok_gunluk_${ekipman.locationId}_${dStr}`);
            if (gk?.printerData) {
              const pr = gk.printerData.find((p: any) => (p.ekipmanId || p.id) === yaziciData.ekipmanId);
              if (pr?.endCounter !== undefined) { lastEnd = Number(pr.endCounter); break; }
            }
          }
        }
      }
      if (lastEnd !== null && startC !== lastEnd) {
        yaziciAnomali = { ekipmanId: yaziciData.ekipmanId, startCounter: startC, lastEndCounter: lastEnd, fark: startC - lastEnd };
      }
    }

    // Ekstra iş kaydı oluştur
    const kayit = {
      taskId,
      tarih,
      kaynakId,
      kaynakAdi: kaynakAdi || (kaynakId === "depo" ? "Depo" : kaynakId),
      kaynakEmoji: kaynakEmoji || (kaynakId === "depo" ? "🏪" : "📍"),
      acilis,
      acilisNot: acilisNot || "",
      acilisYapildi: true,
      acilisZamani: new Date().toISOString(),
      acilisYapanId: user.id,
      acilisYapanAd: user.user_metadata?.full_name || user.email,
      kapanisYapildi: false,
      kareKayitlari: [],
      satislar: [],
      // Yazıcı verisi (opsiyonel)
      yaziciData: yaziciData || null,
      yaziciAnomali: yaziciAnomali || null,
    };

    await ckv.set(`ekstra_is_${taskId}_${tarih}`, kayit);
    console.log(`Ekstra iş açılış: taskId=${taskId} tarih=${tarih} kaynak=${kaynakAdi} by ${user.id}`);
    return c.json({ kayit });
  } catch (err) {
    console.log("Ekstra-is acilis error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// EKSTRA İŞ: Kare kaydı ekle
// POST /make-server-4da0b637/ekstra-is/kare
// Body: { taskId, tarih, photographerName, photographerId, frameCount }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/ekstra-is/kare", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { taskId, tarih, photographerName, photographerId, frameCount } = await c.req.json();
    if (!taskId || !tarih || !frameCount) return c.json({ error: "taskId, tarih ve frameCount zorunludur." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const mevcut: any = await ckv.get(`ekstra_is_${taskId}_${tarih}`);
    if (!mevcut?.acilisYapildi) return c.json({ error: "Önce açılış yapılmalıdır." }, 400);

    const yeniKare = {
      id: `kare_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      photographerName: photographerName || user.user_metadata?.full_name || user.email,
      photographerId: photographerId || user.id,
      frameCount: Number(frameCount),
      timestamp: new Date().toISOString(),
      kaydeden: user.user_metadata?.full_name || user.email,
      kaydedenId: user.id,
    };

    const kareKayitlari = [...(mevcut.kareKayitlari || []), yeniKare];
    await ckv.set(`ekstra_is_${taskId}_${tarih}`, { ...mevcut, kareKayitlari });
    console.log(`Ekstra iş kare: taskId=${taskId} fotoğrafçı=${photographerName} kare=${frameCount}`);
    return c.json({ kare: yeniKare, kareKayitlari });
  } catch (err) {
    console.log("Ekstra-is kare error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// EKSTRA İŞ: Kapanış (iade transferi + anomali)
// POST /make-server-4da0b637/ekstra-is/kapalis
// Body: { taskId, tarih, kapalis: StokSayim, kapalisNot?, iadeHedefId, iadeHedefAdi, iadeHedefEmoji }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/ekstra-is/kapalis", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { taskId, tarih, kapalis, kapalisNot, iadeHedefId, iadeHedefAdi, iadeHedefEmoji, yaziciKapanisData } = await c.req.json();
    if (!taskId || !tarih || !kapalis) return c.json({ error: "taskId, tarih ve kapalis zorunludur." }, 400);
    if (!iadeHedefId) return c.json({ error: "İade hedefi seçilmedi." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const mevcut: any = await ckv.get(`ekstra_is_${taskId}_${tarih}`);
    if (!mevcut?.acilisYapildi) return c.json({ error: "Önce açılış yapılmalıdır." }, 400);
    if (mevcut?.kapanisYapildi) return c.json({ error: "Kapanış zaten yapılmış." }, 400);

    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15"];
    const { acilis, satislar = [] } = mevcut;

    // Beklenen iade = acilis - satışlarda albüm düşümü
    const beklenen: Record<string, number> = {};
    const albumItemMap: Record<string, string> = {
      album3: "3", album5: "5", album7: "7", album9: "9",
      album11: "11", album13: "13", album15: "15"
    };
    for (const alan of albumAlanlari) {
      let toplam = Number(acilis[alan]) || 0;
      const kareNo = albumItemMap[alan];
      for (const satis of satislar) {
        if (!satis.iptal) {
          for (const item of (satis.items || [])) {
            if (item.product?.includes(kareNo) || item.product?.toLowerCase().includes(alan)) {
              toplam -= Number(item.quantity) || 0;
            }
          }
        }
      }
      beklenen[alan] = Math.max(0, toplam);
    }

    // Anomali hesapla
    const anomali: Record<string, number> = {};
    for (const alan of albumAlanlari) {
      const fark = (Number(kapalis[alan]) || 0) - (beklenen[alan] || 0);
      if (fark !== 0) anomali[alan] = fark;
    }

    // İade stokunu seçilen hedefe aktar (depo veya mekan)
    if (iadeHedefId === "depo") {
      const depoStok: any = migrateDepoStok(await ckv.get("depo_stok") || {});
      // kapalis eski formatta (album3 vb.) — depoya _yarim olarak iade et (varsayılan)
      for (const alan of albumAlanlari) {
        const iade = Number(kapalis[alan]) || 0;
        if (iade <= 0) continue;
        const yarimKey = `${alan}_yarim`;
        depoStok[yarimKey] = (Number(depoStok[yarimKey]) || 0) + iade;
      }
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await ckv.set("depo_stok", depoStok);
    } else {
      // Mekan — bugünkü kayıt yoksa önceki en son kaydı bul
      let mekanKayit: any = await ckv.get(`stok_gunluk_${iadeHedefId}_${tarih}`);
      let iadeKayitAnahtari = `stok_gunluk_${iadeHedefId}_${tarih}`;
      if (!mekanKayit) {
        const bugunDt = new Date(tarih);
        for (let i = 1; i <= 14; i++) {
          const dt = new Date(bugunDt);
          dt.setDate(bugunDt.getDate() - i);
          const dtStr = dt.toISOString().split("T")[0];
          const gecmis: any = await ckv.get(`stok_gunluk_${iadeHedefId}_${dtStr}`);
          if (gecmis) { mekanKayit = gecmis; iadeKayitAnahtari = `stok_gunluk_${iadeHedefId}_${dtStr}`; break; }
        }
      }
      if (mekanKayit) {
        const aktifField = mekanKayit.kapanish ? "kapanish" : "acilis";
        const guncelStok: any = { ...(mekanKayit[aktifField] || {}) };
        for (const alan of albumAlanlari) {
          const iade = Number(kapalis[alan]) || 0;
          if (iade <= 0) continue;
          guncelStok[alan] = (Number(guncelStok[alan]) || 0) + iade;
        }
        const guncelKayit: any = { ...mekanKayit, [aktifField]: guncelStok, stokTransferGuncelleme: new Date().toISOString() };
        await ckv.set(iadeKayitAnahtari, guncelKayit);
      } else {
        console.log(`Iade hedefi ${iadeHedefAdi} için stok kaydı bulunamadı, iade yapılamadı.`);
      }
    }

    // ── Yazıcı kapanış: ekipman kaydına son endCounter yaz ──────────────
    if (yaziciKapanisData?.ekipmanId && yaziciKapanisData?.endCounter !== undefined) {
      try {
        const ekipman: any = await ckv.get(yaziciKapanisData.ekipmanId);
        if (ekipman) {
          const guncelEkipman = {
            ...ekipman,
            lastEndCounter: Number(yaziciKapanisData.endCounter),
            lastEndTarih: tarih,
            lastEndRibonMevcut: yaziciKapanisData.ribonMevcut !== undefined ? Number(yaziciKapanisData.ribonMevcut) : (ekipman.lastEndRibonMevcut || null),
          };
          await ckv.set(yaziciKapanisData.ekipmanId, guncelEkipman);
          console.log(`Yazıcı endCounter güncellendi: ${yaziciKapanisData.ekipmanId} → ${yaziciKapanisData.endCounter}`);
        }
      } catch (e) {
        console.log("Yazıcı ekipman kaydı güncellenemedi:", e);
      }
    }

    const guncelKayit = {
      ...mevcut,
      kapalis,
      kapalisNot: kapalisNot || "",
      kapanisYapildi: true,
      kapanisZamani: new Date().toISOString(),
      kapanisYapanId: user.id,
      kapanisYapanAd: user.user_metadata?.full_name || user.email,
      kapanisAnomali: anomali,
      kapanisBeklenen: beklenen,
      iadeHedefId: iadeHedefId || "",
      iadeHedefAdi: iadeHedefAdi || "",
      iadeHedefEmoji: iadeHedefEmoji || "",
      yaziciKapanisData: yaziciKapanisData || null,
    };

    await ckv.set(`ekstra_is_${taskId}_${tarih}`, guncelKayit);
    console.log(`Ekstra iş kapanış: taskId=${taskId} tarih=${tarih} iadeHedef=${iadeHedefAdi} by ${user.id} anomali=${JSON.stringify(anomali)}`);
    return c.json({ kayit: guncelKayit, anomali, beklenen });
  } catch (err) {
    console.log("Ekstra-is kapalis error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ÖZEL İŞ: Durum sorgula
// GET /make-server-4da0b637/ozel-is/durum/:taskId/:tarih
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/ozel-is/durum/:taskId/:tarih", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { taskId, tarih } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const kayit: any = await ckv.get(`ozel_is_${taskId}_${tarih}`);
    return c.json({ kayit: kayit || null });
  } catch (err) {
    console.log("Ozel-is durum error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ÖZEL İŞ: Başlat
// POST /make-server-4da0b637/ozel-is/baslat
// Body: { taskId, tarih, baslamaNot? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/ozel-is/baslat", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { taskId, tarih, baslamaNot } = await c.req.json();
    if (!taskId || !tarih) return c.json({ error: "taskId ve tarih zorunludur." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const mevcutKayit: any = await ckv.get(`ozel_is_${taskId}_${tarih}`);
    if (mevcutKayit?.baslatildi) return c.json({ error: "Görev zaten başlatılmış." }, 400);

    const kayit = {
      taskId,
      tarih,
      baslatildi: true,
      tamamlandi: false,
      baslamaNot: baslamaNot || "",
      baslatan: user.user_metadata?.full_name || user.email,
      baslatanId: user.id,
      baslamaTarihi: new Date().toISOString(),
      tamamlamaTarihi: null,
      tamamlamaNot: "",
      fotografUrl: null,
    };

    await ckv.set(`ozel_is_${taskId}_${tarih}`, kayit);
    console.log(`Özel iş başlatıldı: taskId=${taskId} tarih=${tarih} by ${user.id}`);
    return c.json({ kayit });
  } catch (err) {
    console.log("Ozel-is baslat error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ÖZEL İŞ: Tamamla
// POST /make-server-4da0b637/ozel-is/tamamla
// Body: { taskId, tarih, tamamlamaNot?, fotografUrl? }
// ───────────��──────────────────────────────
app.post("/make-server-4da0b637/ozel-is/tamamla", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { taskId, tarih, tamamlamaNot, fotografUrl } = await c.req.json();
    if (!taskId || !tarih) return c.json({ error: "taskId ve tarih zorunludur." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const mevcutKayit: any = await ckv.get(`ozel_is_${taskId}_${tarih}`);
    if (!mevcutKayit?.baslatildi) return c.json({ error: "Önce görevi başlatmalısınız." }, 400);
    if (mevcutKayit?.tamamlandi) return c.json({ error: "Görev zaten tamamlanmış." }, 400);

    const guncelKayit = {
      ...mevcutKayit,
      tamamlandi: true,
      tamamlamaNot: tamamlamaNot || "",
      fotografUrl: fotografUrl || null,
      tamamlayan: user.user_metadata?.full_name || user.email,
      tamamlayanId: user.id,
      tamamlamaTarihi: new Date().toISOString(),
    };

    await ckv.set(`ozel_is_${taskId}_${tarih}`, guncelKayit);
    console.log(`Özel iş tamamlandı: taskId=${taskId} tarih=${tarih} by ${user.id}`);
    return c.json({ kayit: guncelKayit });
  } catch (err) {
    console.log("Ozel-is tamamla error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ASPECT AI: Günlük özet veri
// GET /make-server-4da0b637/ai/ozet
// Tüm mekanların bugünkü satış, stok ve anomali verilerini toplar
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/ai/ozet", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const today = bizDateTR(); // İş günü tarihi (05:00 TR kırılımlı)
    const isAdmin = ["yonetici", "ust-mudur", "mudur", "idari", "operasyon"].includes(callerRole);

    // Mekanlar
    const mekanlarList = await getMekanlarFor(getCompanyId(user));
    const mekanMap: Record<string, any> = {};
    for (const m of mekanlarList) mekanMap[m.id] = m;

    // Bugünkü tüm stok kayıtları
    const ckv = companyKvFor(getCompanyId(user));
    const tumKayitlar = await ckv.getByPrefix("stok_gunluk_") || [];
    const bugunKayitlar = tumKayitlar.filter((k: any) => k.tarih === today);

    // Satış aggregation
    let toplamCiro = 0;
    let toplamSatisAdet = 0;
    let toplamIskonto = 0;
    const mekanOzetleri: any[] = [];
    const tumSatislar: any[] = [];
    const anomaliler: any[] = [];
    const personelCiro: Record<string, { ad: string; ciro: number; satis: number; iskonto: number; brutoCiro: number }> = {};

    for (const kayit of bugunKayitlar) {
      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍", color: "#9dd9ea" };
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);

      let mekanCiro = 0;
      let mekanSatis = 0;
      let mekanIskonto = 0;

      for (const satis of satislar) {
        const tutar = Number(satis.finalPrice) || 0;
        const iskonto = Number(satis.discount) || 0;
        mekanCiro += tutar;
        mekanSatis++;
        mekanIskonto += iskonto;
        tumSatislar.push({ ...satis, mekanAdi: mekan.name, mekanEmoji: mekan.emoji });

        // Personel performansı
        const kaydeden = satis.kaydeden || "Bilinmeyen";
        if (!personelCiro[kaydeden]) personelCiro[kaydeden] = { ad: kaydeden, ciro: 0, satis: 0, iskonto: 0, brutoCiro: 0 };
        personelCiro[kaydeden].ciro += tutar;
        personelCiro[kaydeden].satis++;
        personelCiro[kaydeden].iskonto += iskonto;
        personelCiro[kaydeden].brutoCiro += tutar + iskonto;
      }

      toplamCiro += mekanCiro;
      toplamSatisAdet += mekanSatis;
      toplamIskonto += mekanIskonto;

      // Anomali kontrolü — stok + yazıcı anomalileri
      const stokEtiketlerAnomali: Record<string, string> = {
        album3:"3 Kare Albüm", album5:"5 Kare Albüm", album7:"7 Kare Albüm",
        album9:"9 Kare Albüm", album11:"11 Kare Albüm", album13:"13 Kare Albüm",
        album15:"15 Kare Albüm", paspartu:"Paspartu", ribon:"Ribon Takımı",
      };
      const formatAnomaliDetail = (detail: Record<string, number>) =>
        Object.entries(detail)
          .filter(([, v]) => v !== 0)
          .map(([k, v]) => `${stokEtiketlerAnomali[k] || k}: ${v > 0 ? "+" : ""}${v} adet`)
          .join(", ");

      const acilisAnomali = kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0;
      const kapanisAnomali = kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0;

      if (acilisAnomali) {
        anomaliler.push({
          mekan: mekan.name,
          mekanEmoji: mekan.emoji,
          type: "acilis",
          detail: kayit.acilisAnomali,
          detailStr: formatAnomaliDetail(kayit.acilisAnomali),
          tarih: kayit.tarih,
        });
      }
      if (kapanisAnomali) {
        anomaliler.push({
          mekan: mekan.name,
          mekanEmoji: mekan.emoji,
          type: "kapanis",
          detail: kayit.kapanisAnomali,
          detailStr: formatAnomaliDetail(kayit.kapanisAnomali),
          tarih: kayit.tarih,
        });
      }

      // Yazıcı anomalileri (açılış)
      if (Array.isArray(kayit.acilisYaziciAnomali) && kayit.acilisYaziciAnomali.length > 0) {
        for (const pa of kayit.acilisYaziciAnomali) {
          anomaliler.push({
            mekan: mekan.name,
            mekanEmoji: mekan.emoji,
            type: "yazici_acilis",
            detail: pa,
            detailStr: `${pa.label || "Yazıcı"}: beklenen ${pa.beklenenCounter}, girilen ${pa.startCounter} (fark: ${pa.fark > 0 ? "+" : ""}${pa.fark})`,
            tarih: kayit.tarih,
          });
        }
      }

      // Yazıcı anomalisi (kapanış — net basılan vs satış farkı)
      if (kayit.kapanisYaziciAnomali && Math.abs(kayit.kapanisYaziciAnomali.fark || 0) > 0) {
        const kya = kayit.kapanisYaziciAnomali;
        anomaliler.push({
          mekan: mekan.name,
          mekanEmoji: mekan.emoji,
          type: "yazici_kapanis",
          detail: kya,
          detailStr: `Net basılan (${kya.netBasilan || 0}) ile satış (${kya.satisAdet || 0}) farkı: ${kya.fark > 0 ? "+" : ""}${kya.fark} kare`,
          tarih: kayit.tarih,
        });
      }

      if (mekanSatis > 0 || kayit.acilisYapildi) {
        mekanOzetleri.push({
          id: kayit.mekanId,
          name: mekan.name,
          emoji: mekan.emoji,
          color: mekan.color || "#9dd9ea",
          ciro: mekanCiro,
          satisAdet: mekanSatis,
          iskonto: mekanIskonto,
          acilisYapildi: !!kayit.acilisYapildi,
          kapanisYapildi: !!kayit.kapanisYapildi,
        });
      }
    }

    // Stok durumu — tüm mekanların bugünkü açılış/kapanış stoğunu birleştir
    const stokAlanlari = ["album3","album5","album7","album9","album11","album13","album15","paspartu","ribon"];
    const stokEtiketler: Record<string, string> = {
      album3:"3 Kare Albüm", album5:"5 Kare Albüm", album7:"7 Kare Albüm",
      album9:"9 Kare Albüm", album11:"11 Kare Albüm", album13:"13 Kare Albüm",
      album15:"15 Kare Albüm", paspartu:"Paspartu", ribon:"Ribon Takımı",
    };
    const stokToplam: Record<string, number> = {};
    for (const alan of stokAlanlari) stokToplam[alan] = 0;

    // Mekan bazlı stok — her mekan için ayrı stok objesi
    const mekanBazliStok: Array<{
      mekanId: string; mekanAdi: string; mekanEmoji: string;
      stokTipi: string; urunler: Array<{ alan: string; name: string; count: number; status: string }>;
    }> = [];

    for (const kayit of bugunKayitlar) {
      const stok = kayit.kapanish || kayit.acilis;
      const stokTipi = kayit.kapanish ? "kapaniş" : "açılış";
      if (stok) {
        for (const alan of stokAlanlari) stokToplam[alan] += Number(stok[alan]) || 0;
        const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍" };
        mekanBazliStok.push({
          mekanId: kayit.mekanId,
          mekanAdi: mekan.name,
          mekanEmoji: mekan.emoji || "📍",
          stokTipi,
          urunler: stokAlanlari.map(alan => {
            const adet = Number(stok[alan]) || 0;
            return {
              alan,
              name: stokEtiketler[alan] || alan,
              count: adet,
              status: adet === 0 ? "kritik" : adet <= 3 ? "kritik" : adet <= 8 ? "az" : "normal",
            };
          }),
        });
      }
    }

    // Genel stok durumu değerlendirme (tüm mekanların toplamı)
    const stokDurum = stokAlanlari.map(alan => {
      const adet = stokToplam[alan];
      return {
        alan,
        name: stokEtiketler[alan] || alan,
        count: adet,
        status: adet === 0 ? "kritik" : adet <= 3 ? "kritik" : adet <= 8 ? "az" : "normal",
      };
    });

    // Personel sıralaması — iskonto oran�� dahil, tüm personel (slice yok)
    const personelSiralama = Object.values(personelCiro)
      .map((p: any) => ({
        ...p,
        indirimOrani: p.brutoCiro > 0 ? Math.round((p.iskonto / p.brutoCiro) * 100) : 0,
      }))
      .sort((a: any, b: any) => b.ciro - a.ciro);

    // Kare kayıtları
    let toplamKare = 0;
    for (const kayit of bugunKayitlar) {
      for (const kare of (kayit.kareKayitlari || [])) {
        toplamKare += Number(kare.frameCount) || 0;
      }
    }

    // Ödeme dağılımı
    const odemeTipi = { cash: 0, card: 0, iban: 0, foreign: 0 };
    for (const satis of tumSatislar) {
      const pm = satis.paymentMethod as string;
      if (pm === "cash") odemeTipi.cash += satis.finalPrice;
      else if (pm === "card") odemeTipi.card += satis.finalPrice;
      else if (pm === "iban") odemeTipi.iban += satis.finalPrice;
      else odemeTipi.foreign += satis.finalPrice;
    }

    // ── Albüm bazlı satış dökümü (bugün) ──────────────────────────────────────
    // Ciro: finalPrice üzerinden orantılı dağıtım — iskonto doğru yansır
    const albumSatisMap: Record<string, { adet: number; ciro: number }> = {};
    for (const satis of tumSatislar) {
      const items = satis.items || [];
      if (items.length === 0) continue;
      const orijinalToplam = items.reduce((sum: number, item: any) =>
        sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1), 0);
      const finalFiyat = Number(satis.finalPrice) || 0;
      const iskontoOrani = orijinalToplam > 0 ? finalFiyat / orijinalToplam : 1;
      for (const item of items) {
        const tip = item.product || "Diğer";
        const adet = Number(item.quantity) || 1;
        const orijinalItemCiro = (Number(item.unitPrice) || 0) * adet;
        if (!albumSatisMap[tip]) albumSatisMap[tip] = { adet: 0, ciro: 0 };
        albumSatisMap[tip].adet += adet;
        albumSatisMap[tip].ciro += Math.round(orijinalItemCiro * iskontoOrani);
      }
    }
    const albumSatisDokumu = Object.entries(albumSatisMap)
      .map(([product, d]) => ({ product, ...d }))
      .sort((a, b) => b.adet - a.adet);

    // Mekan sıralaması (ciro)
    mekanOzetleri.sort((a, b) => b.ciro - a.ciro);

    const callerName = user.user_metadata?.full_name || user.email || "Kullanıcı";

    const ozet = {
      tarih: today,
      tarihTR: new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
      toplamCiro,
      toplamSatisAdet,
      toplamIskonto,
      toplamKare,
      mekanSayisi: mekanOzetleri.length,
      aktifMekanSayisi: mekanlarList.length,
      mekanlar: mekanOzetleri,
      stokDurum,
      mekanBazliStok,
      anomaliler,
      personelSiralama,
      albumSatisDokumu,
      odemeDagilimi: odemeTipi,
      callerName,
      callerRole,
      isAdmin,
      guncellemeZamani: new Date().toISOString(),
    };

    console.log(`AI özet: ${today} — ${toplamSatisAdet} satış, ₺${toplamCiro} ciro, ${mekanOzetleri.length} aktif mekan`);
    return c.json({ ozet });
  } catch (err) {
    console.log("AI ozet error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// İŞLETME: Ciro özeti (tarih aralığı bazlı)
// GET /make-server-4da0b637/isletme/ciro
// Query: ?baslangic=YYYY-MM-DD&bitis=YYYY-MM-DD
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/isletme/ciro", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (["bekleyen", "personel"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);

    const baslangic = c.req.query("baslangic") || "";
    const bitis = c.req.query("bitis") || "";

    const isSACiro = user.user_metadata?.originalRole === "superadmin";
    const reqCIdCiro = c.req.query("company_id");
    const ckv = companyKvFor((isSACiro && reqCIdCiro) ? reqCIdCiro : getCompanyId(user));
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];

    const filtrelenmis = tumKayitlar.filter((k: any) => {
      if (!k.tarih) return false;
      if (baslangic && k.tarih < baslangic) return false;
      if (bitis && k.tarih > bitis) return false;
      return true;
    });

    const mekanlarList: any[] = await getMekanlar();
    const mekanMap: Record<string, any> = {};
    for (const m of mekanlarList) mekanMap[m.id] = m;

    let toplamCiro = 0;
    let toplamSatisAdet = 0;
    let toplamIskonto = 0;
    const mekanOzetMap: Record<string, any> = {};

    for (const kayit of filtrelenmis) {
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍", color: "#9dd9ea" };

      let mekanCiro = 0;
      let mekanSatis = 0;
      let mekanIskonto = 0;

      for (const satis of satislar) {
        const tutar = Number(satis.finalPrice) || 0;
        const iskonto = Number(satis.discount) || 0;
        mekanCiro += tutar;
        mekanSatis++;
        mekanIskonto += iskonto;
      }

      toplamCiro += mekanCiro;
      toplamSatisAdet += mekanSatis;
      toplamIskonto += mekanIskonto;

      if (!mekanOzetMap[kayit.mekanId]) {
        mekanOzetMap[kayit.mekanId] = {
          id: kayit.mekanId,
          name: mekan.name,
          emoji: mekan.emoji,
          color: mekan.color || "#9dd9ea",
          ciro: 0,
          satisAdet: 0,
          iskonto: 0,
        };
      }
      mekanOzetMap[kayit.mekanId].ciro += mekanCiro;
      mekanOzetMap[kayit.mekanId].satisAdet += mekanSatis;
      mekanOzetMap[kayit.mekanId].iskonto += mekanIskonto;
    }

    const mekanListesi = Object.values(mekanOzetMap).sort((a: any, b: any) => b.ciro - a.ciro);

    console.log(`İşletme ciro: ${baslangic}–${bitis} — ₺${toplamCiro}, ${toplamSatisAdet} satış`);
    return c.json({ toplamCiro, toplamSatisAdet, toplamIskonto, baslangic, bitis, mekanlar: mekanListesi });
  } catch (err) {
    console.log("İşletme ciro error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// İŞLETME: Detaylı Satış Raporu
// GET /make-server-4da0b637/isletme/satis-raporu
// Query: ?baslangic=YYYY-MM-DD&bitis=YYYY-MM-DD&mekanId=optional
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/isletme/satis-raporu", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (["bekleyen", "personel"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);

    const baslangic = c.req.query("baslangic") || "";
    const bitis = c.req.query("bitis") || "";
    const mekanIdFilter = c.req.query("mekanId") || "";

    const isSASatis = user.user_metadata?.originalRole === "superadmin";
    const reqCIdSatis = c.req.query("company_id");
    const effCIdSatis = (isSASatis && reqCIdSatis) ? reqCIdSatis : getCompanyId(user);
    const ckv = companyKvFor(effCIdSatis);
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
    const mekanlarList: any[] = await getMekanlarFor(effCIdSatis);
    const mekanMap: Record<string, any> = {};
    for (const m of mekanlarList) mekanMap[m.id] = m;

    const filtrelenmis = tumKayitlar.filter((k: any) => {
      if (!k.tarih) return false;
      if (baslangic && k.tarih < baslangic) return false;
      if (bitis && k.tarih > bitis) return false;
      if (mekanIdFilter && k.mekanId !== mekanIdFilter) return false;
      return true;
    });

    let toplamCiro = 0;
    let toplamSatisAdet = 0;
    let toplamIskonto = 0;

    const mekanOzetMap: Record<string, any> = {};
    const personelMap: Record<string, any> = {};
    const albumMap: Record<string, any> = {};
    const odemeMap: Record<string, { adet: number; ciro: number }> = {};

    for (const kayit of filtrelenmis) {
      const mekan = mekanMap[kayit.mekanId];
      if (!mekan) continue;
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);

      if (!mekanOzetMap[kayit.mekanId]) {
        mekanOzetMap[kayit.mekanId] = {
          id: kayit.mekanId,
          name: mekan.name,
          emoji: mekan.emoji || "📍",
          color: mekan.color || "#9dd9ea",
          ciro: 0, satisAdet: 0, iskonto: 0,
          albumKirilimi: {} as Record<string, { tip: string; adet: number; ciro: number }>,
        };
      }

      for (const satis of satislar) {
        const tutar = Number(satis.finalPrice) || 0;
        const iskonto = Number(satis.discount) || 0;
        const personelAd = satis.kaydeden || "Bilinmiyor";
        const personelId = satis.kaydedenId || personelAd;
        const pm = satis.paymentMethod || "Diğer";

        toplamCiro += tutar;
        toplamSatisAdet++;
        toplamIskonto += iskonto;

        mekanOzetMap[kayit.mekanId].ciro += tutar;
        mekanOzetMap[kayit.mekanId].satisAdet++;
        mekanOzetMap[kayit.mekanId].iskonto += iskonto;

        if (!personelMap[personelId]) {
          personelMap[personelId] = { id: personelId, name: personelAd, ciro: 0, satisAdet: 0, iskonto: 0, albumKirilimi: {} as Record<string, { tip: string; adet: number; ciro: number }> };
        }
        personelMap[personelId].ciro += tutar;
        personelMap[personelId].satisAdet++;
        personelMap[personelId].iskonto += iskonto;

        if (!odemeMap[pm]) odemeMap[pm] = { adet: 0, ciro: 0 };
        odemeMap[pm].adet++;
        odemeMap[pm].ciro += tutar;

        // Albüm ciro: finalPrice oranında dağıt — iskonto doğru yansır
        const satisItems = satis.items || [];
        const orijToplam = satisItems.reduce((s: number, it: any) =>
          s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
        const satisRatio = orijToplam > 0 ? tutar / orijToplam : 1;
        for (const item of satisItems) {
          const tip = item.product || "Diğer";
          const adet = Number(item.quantity) || 1;
          const birimFiyat = Number(item.unitPrice) || 0;
          const itemCiro = Math.round(birimFiyat * adet * satisRatio);
          if (!albumMap[tip]) albumMap[tip] = { tip, adet: 0, ciro: 0 };
          albumMap[tip].adet += adet;
          albumMap[tip].ciro += itemCiro;

          // Personel albüm kırılımı
          const pAlbum = personelMap[personelId].albumKirilimi;
          if (!pAlbum[tip]) pAlbum[tip] = { tip, adet: 0, ciro: 0 };
          pAlbum[tip].adet += adet;
          pAlbum[tip].ciro += itemCiro;

          // Mekan albüm kırılımı
          const mAlbum = mekanOzetMap[kayit.mekanId].albumKirilimi;
          if (!mAlbum[tip]) mAlbum[tip] = { tip, adet: 0, ciro: 0 };
          mAlbum[tip].adet += adet;
          mAlbum[tip].ciro += itemCiro;
        }
      }
    }

    const mekanListesi = Object.values(mekanOzetMap).map((m: any) => ({
      ...m, albumKirilimi: Object.values(m.albumKirilimi).sort((a: any, b: any) => b.adet - a.adet),
    })).sort((a: any, b: any) => b.ciro - a.ciro);
    const personelListesi = Object.values(personelMap).map((p: any) => ({
      ...p, albumKirilimi: Object.values(p.albumKirilimi).sort((a: any, b: any) => b.adet - a.adet),
    })).sort((a: any, b: any) => b.ciro - a.ciro);
    const albumListesi = Object.values(albumMap).sort((a: any, b: any) => b.adet - a.adet);
    const odemeListesi = Object.entries(odemeMap)
      .map(([yontem, v]) => ({ yontem, ...v }))
      .sort((a, b) => b.ciro - a.ciro);

    console.log(`Satış raporu: ${baslangic}–${bitis} mekan:${mekanIdFilter||"tümü"} — ₺${toplamCiro}, ${toplamSatisAdet} satış, ${personelListesi.length} personel`);
    return c.json({ toplamCiro, toplamSatisAdet, toplamIskonto, baslangic, bitis, mekanlar: mekanListesi, personeller: personelListesi, albumler: albumListesi, odemeler: odemeListesi });
  } catch (err) {
    console.log("Satış raporu error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// PERSONEL: İndirim İstatistikleri
// GET /make-server-4da0b637/personel/indirim-istatistik
// Query: ?mekanId=optional
// Yalnızca yonetici / ust-mudur / mudur erişebilir
// Uzun dönem = tüm zamanlar | Kısa dönem = son 365 gün
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/personel/indirim-istatistik", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "Bu modülü yalnızca yöneticiler görebilir." }, 403);
    }

    const mekanIdQ  = c.req.query("mekanId")  || "";
    const baslangic = c.req.query("baslangic") || "";
    const bitis     = c.req.query("bitis")     || "";

    // Kısa dönem eşiği: bugünden tam 365 gün önce
    const now = new Date();
    const kisaBaslangic = new Date(now);
    kisaBaslangic.setFullYear(kisaBaslangic.getFullYear() - 1);
    const kisaEsik = kisaBaslangic.toISOString().split("T")[0];

    // Mekan haritası
    const isSAIndirim = user.user_metadata?.originalRole === "superadmin";
    const reqCIdIndirim = c.req.query("company_id");
    const effCIdIndirim = (isSAIndirim && reqCIdIndirim) ? reqCIdIndirim : getCompanyId(user);
    const mekanlarList: any[] = await getMekanlarFor(effCIdIndirim);
    const mekanById: Record<string, any> = {};
    for (const m of mekanlarList) mekanById[m.id] = m;

    // Tüm günlük kayıtları çek, isteğe bağlı mekan filtresi
    const ckv = companyKvFor(effCIdIndirim);
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
    let filtrelenmis = mekanIdQ
      ? tumKayitlar.filter((k: any) => k.mekanId === mekanIdQ)
      : tumKayitlar;
    // Tarih aralığı filtresi
    if (baslangic) filtrelenmis = filtrelenmis.filter((k: any) => k.tarih && k.tarih >= baslangic);
    if (bitis)     filtrelenmis = filtrelenmis.filter((k: any) => k.tarih && k.tarih <= bitis);

    // Kova veri yapısı
    interface Kova {
      toplamSatis: number;
      indirimliSatis: number;
      toplamIndirimTL: number;
      toplamBrutoCiro: number;
    }
    interface SatirRow {
      userId: string;
      ad: string;
      uzun: Kova;
      kisa: Kova;
    }

    const personelMap: Record<string, SatirRow> = {};

    const getRow = (id: string, ad: string): SatirRow => {
      if (!personelMap[id]) {
        const bos = (): Kova => ({ toplamSatis: 0, indirimliSatis: 0, toplamIndirimTL: 0, toplamBrutoCiro: 0 });
        personelMap[id] = { userId: id, ad, uzun: bos(), kisa: bos() };
      }
      return personelMap[id];
    };

    for (const kayit of filtrelenmis) {
      const tarih: string = kayit.tarih || "";
      const satislar: any[] = (kayit.satislar || []).filter((s: any) => !s.iptal);

      for (const s of satislar) {
        const finalPrice = Number(s.finalPrice) || 0;
        const discount   = Number(s.discount)   || 0;
        const bruto      = finalPrice + discount;
        const indirimlimi = discount > 0;

        const kid = s.kaydedenId || s.kaydeden || "bilinmiyor";
        const kad = s.kaydeden   || "Bilinmiyor";
        const row = getRow(kid, kad);

        row.uzun.toplamSatis++;
        row.uzun.toplamBrutoCiro  += bruto;
        row.uzun.toplamIndirimTL  += discount;
        if (indirimlimi) row.uzun.indirimliSatis++;

        if (tarih >= kisaEsik) {
          row.kisa.toplamSatis++;
          row.kisa.toplamBrutoCiro  += bruto;
          row.kisa.toplamIndirimTL  += discount;
          if (indirimlimi) row.kisa.indirimliSatis++;
        }
      }
    }

    const r1 = (n: number) => Math.round(n * 10) / 10;
    const r0 = (n: number) => Math.round(n);

    const hesapla = (k: Kova) => ({
      toplamSatis:          k.toplamSatis,
      indirimliSatis:       k.indirimliSatis,
      toplamIndirimTL:      r0(k.toplamIndirimTL),
      toplamBrutoCiro:      r0(k.toplamBrutoCiro),
      // Ortalama indirim oranı = toplam indirim ₺ / toplam brüto ciro × 100
      ortalamaIndirimOrani: k.toplamBrutoCiro > 0 ? r1((k.toplamIndirimTL / k.toplamBrutoCiro) * 100) : 0,
      // İndirimli satış oranı = indirimli satış adedi / toplam satış × 100
      indirimliSatisOrani:  k.toplamSatis > 0 ? r1((k.indirimliSatis / k.toplamSatis) * 100) : 0,
    });

    const personeller = Object.values(personelMap)
      .filter((p) => p.uzun.toplamSatis > 0)
      .map((p) => ({
        userId: p.userId,
        ad:     p.ad,
        name:   p.ad,   // alias — frontend uyumluluğu
        avatar: "👤",
        uzunDonem: { ...hesapla(p.uzun), ortalamaIndirimYuzde: p.uzun.toplamBrutoCiro > 0 ? Math.round((p.uzun.toplamIndirimTL / p.uzun.toplamBrutoCiro) * 100 * 10) / 10 : 0 },
        kisaDonem: { ...hesapla(p.kisa), ortalamaIndirimYuzde: p.kisa.toplamBrutoCiro > 0 ? Math.round((p.kisa.toplamIndirimTL / p.kisa.toplamBrutoCiro) * 100 * 10) / 10 : 0, gun: baslangic ? null : 365 },
        // Geriye uyumluluk
        uzun: hesapla(p.uzun),
        kisa: hesapla(p.kisa),
      }))
      .sort((a, b) => (b.uzunDonem?.ortalamaIndirimYuzde || 0) - (a.uzunDonem?.ortalamaIndirimYuzde || 0));

    const mekanListesi = mekanlarList.map((m: any) => ({ id: m.id, name: m.name, emoji: m.emoji || "📍" }));

    const ozet = {
      uzun: {
        toplamSatis:     personeller.reduce((s, p) => s + p.uzun.toplamSatis, 0),
        toplamIndirimTL: personeller.reduce((s, p) => s + p.uzun.toplamIndirimTL, 0),
      },
      kisa: {
        toplamSatis:     personeller.reduce((s, p) => s + p.kisa.toplamSatis, 0),
        toplamIndirimTL: personeller.reduce((s, p) => s + p.kisa.toplamIndirimTL, 0),
      },
      kisaDonemBaslangic: kisaEsik,
    };

    console.log(`İndirim istatistik: ${personeller.length} personel — uzun=${ozet.uzun.toplamSatis} satış, kisa=${ozet.kisa.toplamSatis} satış`);
    return c.json({ personeller, mekanlar: mekanListesi, ozet });
  } catch (err) {
    console.log("Personel indirim-istatistik error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// PERSONEL: Anomali Puanları
// GET /make-server-4da0b637/personel/anomali-puanlar
// Query: ?baslangic=YYYY-MM-DD&bitis=YYYY-MM-DD&mekanId=&userId=
// Yalnızca yonetici / ust-mudur / mudur erişebilir
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/personel/anomali-puanlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "Bu modülü yalnızca yöneticiler görebilir." }, 403);
    }

    const baslangic = c.req.query("baslangic") || "";
    const bitis     = c.req.query("bitis")     || "";
    const mekanIdQ  = c.req.query("mekanId")   || "";
    const userIdQ   = c.req.query("userId")    || "";

    // ── 1. Mekan haritaları ──
    const isSAAnomali = user.user_metadata?.originalRole === "superadmin";
    const reqCIdAnomali = c.req.query("company_id");
    const effCIdAnomali = (isSAAnomali && reqCIdAnomali) ? reqCIdAnomali : getCompanyId(user);
    const mekanlarList: any[] = await getMekanlarFor(effCIdAnomali);
    const mekanById:   Record<string, any> = {};
    for (const m of mekanlarList) {
      mekanById[m.id] = m;
    }

    // ── 2. Rotation task haritası: { "YYYY-MM-DD__mekanAdi" → Personnel[] } ──
    const ckv = companyKvFor(effCIdAnomali);
    const allTasks: any[] = await ckv.getByPrefix("rotation_task_") || [];
    const taskMap: Record<string, any[]> = {};
    for (const t of allTasks) {
      if (!t.date || !t.location || t.status === "cancelled") continue;
      const key = `${t.date}__${t.location}`;
      if (!taskMap[key]) taskMap[key] = [];
      const personnel: any[] = t.personnel || [];
      for (const p of personnel) {
        if (!taskMap[key].find((x: any) => x.id === p.id)) {
          taskMap[key].push(p);
        }
      }
    }

    // ── 3. Stok kayıtları — anomali olanları filtrele ──
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
    const anomaliKayitlar = tumKayitlar.filter((k: any) => {
      if (!k.tarih) return false;
      if (baslangic && k.tarih < baslangic) return false;
      if (bitis     && k.tarih > bitis)     return false;
      if (mekanIdQ  && k.mekanId !== mekanIdQ) return false;
      const acilisVar           = k.acilisAnomali      && Object.keys(k.acilisAnomali).length  > 0;
      const kapanisVar          = k.kapanisAnomali     && Object.keys(k.kapanisAnomali).length > 0;
      const yaziciAnomali       = k.acilisYaziciAnomali && Array.isArray(k.acilisYaziciAnomali) && k.acilisYaziciAnomali.length > 0;
      const kapanisYaziciVar    = k.kapanisYaziciAnomali && k.kapanisYaziciAnomali.fark !== undefined;
      return acilisVar || kapanisVar || yaziciAnomali || kapanisYaziciVar;
    });

    // ── 4. Yardımcı: bir önceki gün ──
    const prevDay = (tarih: string): string => {
      const d = new Date(tarih + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().split("T")[0];
    };

    // ── 5. Puan toplama ──
    const puanMap: Record<string, any> = {};

    const addPuan = (
      personList: any[],
      tarih: string,
      mekanId: string,
      tip: "acilis" | "kapanis",
      farklar: Record<string, number>
    ) => {
      const mekan = mekanById[mekanId] || { name: mekanId, emoji: "📍" };
      for (const p of personList) {
        if (!p?.id) continue;
        if (!puanMap[p.id]) {
          puanMap[p.id] = {
            userId:     p.id,
            ad:         p.name   || "Bilinmiyor",
            avatar:     p.avatar || "👤",
            toplamPuan: 0,
            detaylar:   [],
          };
        }
        puanMap[p.id].toplamPuan += 1;
        puanMap[p.id].detaylar.push({
          tarih,
          mekanId,
          mekanAdi:   mekan.name,
          mekanEmoji: mekan.emoji || "📍",
          tip,
          farklar,
        });
      }
    };

    for (const kayit of anomaliKayitlar) {
      const mekan    = mekanById[kayit.mekanId] || {};
      const mekanAdi = mekan.name || "";

      // Açılış anomalisi → önceki günün personeli
      if (kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0) {
        const taskKey    = `${prevDay(kayit.tarih)}__${mekanAdi}`;
        const personList = taskMap[taskKey] || [];
        addPuan(personList, kayit.tarih, kayit.mekanId, "acilis", kayit.acilisAnomali);
      }

      // Kapanış anomalisi → aynı günün personeli
      if (kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0) {
        const taskKey    = `${kayit.tarih}__${mekanAdi}`;
        const personList = taskMap[taskKey] || [];
        addPuan(personList, kayit.tarih, kayit.mekanId, "kapanis", kayit.kapanisAnomali);
      }

      // Yazıcı sayaç anomalisi → önceki günün personeli (her yanlış yazıcı +1 puan)
      if (kayit.acilisYaziciAnomali && Array.isArray(kayit.acilisYaziciAnomali) && kayit.acilisYaziciAnomali.length > 0) {
        const taskKey    = `${prevDay(kayit.tarih)}__${mekanAdi}`;
        const personList = taskMap[taskKey] || [];
        for (const ya of kayit.acilisYaziciAnomali) {
          addPuan(personList, kayit.tarih, kayit.mekanId, "acilis", {
            [`yazici_sayac_${ya.ekipmanId}`]: ya.fark || 0,
          });
        }
      }

      // Bitiş sayacı anomalisi → aynı günün personeli (+1 puan)
      if (kayit.kapanisYaziciAnomali && kayit.kapanisYaziciAnomali.fark !== undefined) {
        const taskKey    = `${kayit.tarih}__${mekanAdi}`;
        const personList = taskMap[taskKey] || [];
        addPuan(personList, kayit.tarih, kayit.mekanId, "kapanis", {
          yazici_bitis_sayac: kayit.kapanisYaziciAnomali.fark,
        });
      }
    }

    // ── 6. Filtrele ve sırala ──
    let puanListesi = Object.values(puanMap);
    if (userIdQ) {
      puanListesi = puanListesi.filter((p: any) => p.userId === userIdQ);
    }

    const toplamAnomaliOlayi = anomaliKayitlar.reduce((sum: number, k: any) => {
      if (k.acilisAnomali      && Object.keys(k.acilisAnomali).length  > 0) sum++;
      if (k.kapanisAnomali     && Object.keys(k.kapanisAnomali).length > 0) sum++;
      if (k.acilisYaziciAnomali && Array.isArray(k.acilisYaziciAnomali)) sum += k.acilisYaziciAnomali.length;
      return sum;
    }, 0);

    for (const p of puanListesi) {
      p.detaylar.sort((a: any, b: any) => b.tarih.localeCompare(a.tarih));
    }
    puanListesi.sort((a: any, b: any) => b.toplamPuan - a.toplamPuan);

    const mekanListesiFiltre = mekanlarList.map((m: any) => ({
      id:    m.id,
      name:  m.name,
      emoji: m.emoji || "📍",
    }));

    console.log(`Anomali puanları: ${anomaliKayitlar.length} kayıt, ${puanListesi.length} personel etkilendi`);
    return c.json({
      puanlar:                 puanListesi,
      mekanlar:                mekanListesiFiltre,
      toplamAnomaliOlayi,
      etkilenenPersonelSayisi: puanListesi.length,
    });
  } catch (err) {
    console.log("Personel anomali-puanlar error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// PERSONEL: Anomali Sıfırla (yalnızca yönetici)
// POST /make-server-4da0b637/personel/anomali-sifirla
// Body: { baslangic?: string, bitis?: string }
// Eşleşen stok_gunluk_ kayıtlarındaki anomali alanlarını temizler
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/personel/anomali-sifirla", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (role !== "yonetici") {
      return c.json({ error: "Bu işlemi yalnızca yönetici yapabilir." }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const baslangic: string = body.baslangic || "";
    const bitis:     string = body.bitis     || "";

    const ckv = companyKvFor(getCompanyId(user));
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];

    const ANOMALI_ALANLARI = [
      "acilisAnomali",
      "kapanisAnomali",
      "acilisYaziciAnomali",
      "kapanisYaziciAnomali",
      "acilisAnomaliNeden",
      "kapanisAnomaliNeden",
    ];

    let sifirlanenSayisi = 0;
    for (const kayit of tumKayitlar) {
      if (!kayit.mekanId || !kayit.tarih) continue;
      if (baslangic && kayit.tarih < baslangic) continue;
      if (bitis     && kayit.tarih > bitis)     continue;

      const anomaliVar = ANOMALI_ALANLARI.some(alan => {
        const v = kayit[alan];
        if (!v) return false;
        if (typeof v === "object" && !Array.isArray(v)) return Object.keys(v).length > 0;
        if (Array.isArray(v)) return v.length > 0;
        return !!v;
      });
      if (!anomaliVar) continue;

      for (const alan of ANOMALI_ALANLARI) delete kayit[alan];
      kayit.anomaliSifirlamaTarihi = new Date().toISOString();
      kayit.anomaliSifirlayanKullanici = user.user_metadata?.full_name || user.email;

      const kvKey = `stok_gunluk_${kayit.mekanId}_${kayit.tarih}`;
      await ckv.set(kvKey, kayit);
      sifirlanenSayisi++;
    }

    console.log(`Anomali sıfırlama: ${sifirlanenSayisi} kayıt temizlendi, kullanıcı=${user.user_metadata?.full_name}`);
    return c.json({ basarili: true, sifirlanenSayisi });
  } catch (err) {
    console.log("Anomali sıfırla error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// DOĞUM GÜNÜ: Kendi gizlilik ayarlarını getir
// GET /make-server-4da0b637/birthday
// Doğum tarihi user_metadata.birth_date'den okunur
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/birthday", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const ckv = companyKvFor(getCompanyId(user));
    const privacy = await ckv.get(`bday_privacy_${user.id}`);
    return c.json({
      birth_date: user.user_metadata?.birth_date || null,
      hideBirthdayFromOthers: privacy?.hideBirthdayFromOthers ?? false,
      hideOthersBirthdays: privacy?.hideOthersBirthdays ?? false,
    });
  } catch (err) {
    console.log("Get birthday error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// DOĞUM GÜNÜ: Gizlilik ayarlarını güncelle
// PUT /make-server-4da0b637/birthday
// Body: { hideBirthdayFromOthers, hideOthersBirthdays }
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/birthday", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { hideBirthdayFromOthers, hideOthersBirthdays } = await c.req.json();

    const privacy = {
      userId: user.id,
      hideBirthdayFromOthers: !!hideBirthdayFromOthers,
      hideOthersBirthdays: !!hideOthersBirthdays,
      updatedAt: new Date().toISOString(),
    };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`bday_privacy_${user.id}`, privacy);
    console.log(`Birthday privacy updated for user: ${user.id}`);
    return c.json({ ...privacy, birth_date: user.user_metadata?.birth_date || null });
  } catch (err) {
    console.log("Put birthday error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// DOĞUM GÜNÜ: Tüm ekip doğum günlerini getir (gizlilik + auth profil)
// GET /make-server-4da0b637/birthdays
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/birthdays", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const ckv = companyKvFor(getCompanyId(user));
    const myPrivacy = await ckv.get(`bday_privacy_${user.id}`);
    const hideOthers = myPrivacy?.hideOthersBirthdays === true;

    const supabase = getAdminClient();
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) return c.json({ error: `Kullanıcılar yüklenemedi: ${error.message}` }, 400);

    // Tüm gizlilik ayarlarını toplu çek, userId bazında map oluştur
    const allPrivacy = await ckv.getByPrefix("bday_privacy_");
    const privacyMapById: Record<string, any> = {};
    (allPrivacy || []).forEach((p: any) => {
      if (p?.userId) privacyMapById[p.userId] = p;
    });

    const birthdays = users
      .filter(u => {
        const bd = u.user_metadata?.birth_date;
        if (!bd) return false; // Profilde doğum tarihi olmayanlar gösterilmez
        if (u.id === user.id) return true; // Kendi kaydı her zaman görünür
        const priv = privacyMapById[u.id];
        return !priv?.hideBirthdayFromOthers;
      })
      .map(u => ({
        userId: u.id,
        name: u.user_metadata?.full_name || u.email || "",
        avatar: u.user_metadata?.avatar || "👤",
        birthday: u.user_metadata?.birth_date,
        hideBirthdayFromOthers: privacyMapById[u.id]?.hideBirthdayFromOthers ?? false,
        hideOthersBirthdays: privacyMapById[u.id]?.hideOthersBirthdays ?? false,
      }));

    if (hideOthers) {
      const myEntry = birthdays.find(b => b.userId === user.id);
      return c.json({ birthdays: myEntry ? [myEntry] : [] });
    }

    return c.json({ birthdays });
  } catch (err) {
    console.log("Get birthdays error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// VARDIYA SATIŞLARI — stok_gunluk içine gömülü
// ══════════════════════════════════════════

// POST /stok/satis
app.post("/make-server-4da0b637/stok/satis", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const body = await c.req.json();
    const { mekanId, tarih, items, totalPrice, discount, paymentMethod, currency, currencyPrice, gerekce } = body;
    if (!mekanId || !tarih || !items || totalPrice === undefined || !paymentMethod) {
      return c.json({ error: "mekanId, tarih, items, totalPrice, paymentMethod zorunludur." }, 400);
    }

    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);

    // Rotasyon yetkisi kontrolü
    const yetkiliSatis = await checkRotasyonYetkisi(user.id, callerRole, mekanId, tarih, companyId);
    if (!yetkiliSatis) {
      console.log(`Rotasyon yetki reddi — satis: user=${user.id}, role=${callerRole}, mekan=${mekanId}, tarih=${tarih}`);
      return c.json({ error: "Bu mekana bugünkü rotasyonunuzda atanmamışsınız. Satış kaydedemezsiniz." }, 403);
    }

    const existing = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`) || { mekanId, tarih };
    const satislar: any[] = existing.satislar || [];

    const satisId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const satis: any = {
      id: satisId,
      items,
      totalPrice,
      discount: discount || 0,
      finalPrice: totalPrice - (discount || 0),
      paymentMethod,
      currency: currency || "TRY",
      currencyPrice: currencyPrice || null,
      timestamp: new Date().toISOString(),
      kaydeden: user.user_metadata?.full_name || user.email || "",
      kaydedenId: user.id,
      iptal: false,
      iptalNeden: null,
      iptalZamani: null,
    };
    if (gerekce?.trim()) satis.gerekce = gerekce.trim();

    // ── PostgreSQL dual-write (source of truth) ──
    const db = getAdminClient();
    const { error: sqlErr } = await db.from("sales").insert({
      id: satisId,
      company_id: companyId,
      venue_id: mekanId,
      date: tarih,
      items: items,
      total_price: totalPrice,
      discount: discount || 0,
      final_price: totalPrice - (discount || 0),
      payment_method: paymentMethod,
      currency: currency || "TRY",
      currency_price: currencyPrice || null,
      recorded_by_id: user.id,
      recorded_by_name: user.user_metadata?.full_name || user.email || "",
      is_cancelled: false,
      gerekce: gerekce?.trim() || null,
      idempotency_key: satisId,
      timestamp: satis.timestamp,
    });
    if (sqlErr) {
      console.log(`[dual-write] SQL satış HATA: ${sqlErr.message} | ${satisId}`);
      // SQL başarısızsa işlem başarısız — KV'ye yazma
      return c.json({ error: `Satış kaydedilemedi: ${sqlErr.message}` }, 500);
    }

    // SQL başarılı → KV'ye de yaz (cache)
    satislar.unshift(satis);
    await ckv.set(`stok_gunluk_${mekanId}_${tarih}`, { ...existing, satislar });
    console.log(`Satış kaydedildi (dual): ${satisId} | ${mekanId} | ${tarih} | ${satis.finalPrice} TRY`);
    return c.json({ satis });
  } catch (err) {
    console.log("Post stok satis error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /stok/satis/:mekanId/:tarih/:satisId — iptal (soft delete)
app.delete("/make-server-4da0b637/stok/satis/:mekanId/:tarih/:satisId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const mekanId = c.req.param("mekanId");
    const tarih = c.req.param("tarih");
    const satisId = c.req.param("satisId");
    let neden = "";
    let skipTelegram = false;
    try { const body = await c.req.json(); neden = body.neden || ""; skipTelegram = !!body.skipTelegram; } catch {}

    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`);
    if (!existing) return c.json({ error: "Kayıt bulunamadı." }, 404);

    // İptal edilecek satışı bul (bildirim için)
    const iptalEdilecek = (existing.satislar || []).find((s: any) => s.id === satisId);

    const iptalZamani = new Date().toISOString();
    const iptalEden = user.user_metadata?.full_name || user.email || "Bilinmiyor";

    const satislar = (existing.satislar || []).map((s: any) =>
      s.id === satisId
        ? { ...s, iptal: true, iptalNeden: neden, iptalZamani, iptalEden }
        : s
    );

    // ── PostgreSQL dual-write (iptal) ──
    try {
      const db = getAdminClient();
      await db.from("sales").update({
        is_cancelled: true,
        cancel_reason: neden,
        cancel_time: iptalZamani,
      }).eq("id", satisId);
    } catch (sqlErr) {
      console.log(`[dual-write] SQL iptal HATA: ${sqlErr} | ${satisId}`);
    }

    await ckv.set(`stok_gunluk_${mekanId}_${tarih}`, { ...existing, satislar });
    console.log(`Satış iptal (dual): ${satisId} | neden: ${neden} | skipTelegram: ${skipTelegram}`);

    // ── Telegram bildirimi — onay akışından geliyorsa atla (karar endpoint zaten gönderdi) ──
    if (iptalEdilecek && !skipTelegram) {
      try {
        // Mekan adını çek
        let mekanAdi = mekanId;
        try {
          const mekanObj: any = await ckv.get(`mekan_${mekanId}`);
          if (mekanObj?.name) mekanAdi = `${mekanObj.emoji || "📍"} ${mekanObj.name}`;
        } catch {}

        // Ürün listesi
        const urunler = (iptalEdilecek.items || [])
          .map((item: any) => `  • ${item.product} x${item.quantity} — ${(item.quantity * item.unitPrice).toLocaleString("tr-TR")} ₺`)
          .join("\n");

        const finalFiyat = iptalEdilecek.finalPrice ?? iptalEdilecek.totalPrice ?? 0;
        const indirim = iptalEdilecek.discount ?? 0;
        const odemeYontemi =
          iptalEdilecek.paymentMethod === "cash" ? "💵 Nakit" :
          iptalEdilecek.paymentMethod === "card" ? "💳 Kart" :
          iptalEdilecek.paymentMethod === "iban" ? "🏦 IBAN" :
          iptalEdilecek.paymentMethod || "Bilinmiyor";

        const satisSaati = iptalEdilecek.timestamp
          ? new Date(iptalEdilecek.timestamp).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" })
          : "?";

        const msg = [
          `🚫 <b>SATIŞ İPTAL BİLDİRİMİ</b>`,
          ``,
          `📍 <b>Mekan:</b> ${mekanAdi}`,
          `📅 <b>Tarih:</b> ${tarih} | ⏰ Satış saati: ${satisSaati}`,
          ``,
          `🛒 <b>İptal edilen ürünler:</b>`,
          urunler || "  (ürün listesi yok)",
          ``,
          `💰 <b>Toplam:</b> ${finalFiyat.toLocaleString("tr-TR")} ₺${indirim > 0 ? ` (indirim: ${indirim} ₺)` : ""}`,
          `💳 <b>Ödeme:</b> ${odemeYontemi}`,
          ...(iptalEdilecek.kaydeden ? [`👤 <b>Satışı yapan:</b> ${iptalEdilecek.kaydeden}`] : []),
          ``,
          `❌ <b>İptal eden:</b> ${iptalEden}`,
          `📝 <b>İptal sebebi:</b> ${neden || "(sebep girilmedi)"}`,
          ``,
          `🆔 <code>${satisId}</code>`,
        ].join("\n");

        // await ile gönder — edge function kapanmadan önce tamamlansın
        await sendTelegramMessage(msg, "HTML", getCompanyId(user));
      } catch (tgErr) {
        console.log("[Telegram] iptal mesaj hazırlama hatası:", tgErr);
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.log("Delete stok satis error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// SATIŞ İPTAL ONAYI: Telegram onay talebi oluştur
// POST /stok/satis-iptal-talep
// Body: { mekanId, tarih, satisId, neden }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/stok/satis-iptal-talep", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { mekanId, tarih, satisId, neden } = await c.req.json();
    if (!mekanId || !tarih || !satisId) {
      return c.json({ error: "mekanId, tarih ve satisId zorunludur." }, 400);
    }
    if (!neden?.trim()) {
      return c.json({ error: "İptal sebebi zorunludur." }, 400);
    }

    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`);
    if (!existing) return c.json({ error: "Günlük kayıt bulunamadı." }, 404);

    const satis = (existing.satislar || []).find((s: any) => s.id === satisId);
    if (!satis) return c.json({ error: "Satış bulunamadı." }, 404);
    if (satis.iptal) return c.json({ error: "Bu satış zaten iptal edilmiş." }, 400);

    // Aynı satış için zaten bekleyen talep var mı?
    const mevcutTalepler: any[] = await kv.getByPrefix("iptal_talep_") || [];
    const zatenBekleyen = mevcutTalepler.find((t: any) => t && t.satisId === satisId && t.status === "bekliyor" && t.requestedAt && Date.now() - new Date(t.requestedAt).getTime() <= 180 * 1000);
    if (zatenBekleyen) {
      return c.json({ error: "Bu satış için zaten bekleyen bir iptal talebi var." }, 400);
    }

    // Mekan adını çek
    let mekanAdi = mekanId;
    try {
      const mekanObj: any = await ckv.get(`mekan_${mekanId}`);
      if (mekanObj?.name) mekanAdi = `${mekanObj.emoji || "📍"} ${mekanObj.name}`;
    } catch {}

    const urunler = (satis.items || [])
      .map((item: any) => `  • ${item.product} ×${item.quantity} — ${(item.quantity * item.unitPrice).toLocaleString("tr-TR")} ₺`)
      .join("\n");
    const finalFiyat = satis.finalPrice ?? satis.totalPrice ?? 0;
    const indirim = satis.discount ?? 0;
    const odemeYontemi =
      satis.paymentMethod === "cash" ? "💵 Nakit" :
      satis.paymentMethod === "card" ? "💳 Kart" :
      satis.paymentMethod === "iban" ? "🏦 IBAN" :
      satis.paymentMethod || "Bilinmiyor";
    const satisSaati = satis.timestamp
      ? new Date(satis.timestamp).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" })
      : "?";

    const approvalId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const iptalEden = user.user_metadata?.full_name || user.email || "Bilinmiyor";

    // KV'e bekleyen talep kaydet (satış detayları da dahil — panel kartında gösterilecek)
    await kv.set(`iptal_talep_${approvalId}`, {
      approvalId,
      satisId,
      mekanId,
      mekanAdi,
      tarih,
      neden,
      companyId: getCompanyId(user),
      status: "bekliyor",
      requestedAt: new Date().toISOString(),
      requestedBy: user.id,
      requestedByName: iptalEden,
      // Satış detayları
      items: satis.items || [],
      finalPrice: satis.finalPrice ?? satis.totalPrice ?? 0,
      discount: satis.discount ?? 0,
      paymentMethod: satis.paymentMethod || "",
      kaydeden: satis.kaydeden || "",
      satisSaati,
    });

    // Telegram'a inline keyboard mesajı gönder
    const msg = [
      `🚨 <b>SATIŞ İPTAL ONAYI GEREKİYOR</b>`,
      ``,
      `📍 <b>Mekan:</b> ${mekanAdi}`,
      `📅 <b>Tarih:</b> ${tarih} | ⏰ Satış saati: ${satisSaati}`,
      ``,
      `🛒 <b>İptal talep edilen ürünler:</b>`,
      urunler || "  (ürün listesi yok)",
      ``,
      `💰 <b>Toplam:</b> ${finalFiyat.toLocaleString("tr-TR")} ₺${indirim > 0 ? ` (indirim: −${indirim} ₺)` : ""}`,
      `💳 <b>Ödeme:</b> ${odemeYontemi}`,
      ...(satis.kaydeden ? [`👤 <b>Satışı yapan:</b> ${satis.kaydeden}`] : []),
      ``,
      `❓ <b>İptal talep eden:</b> ${iptalEden}`,
      `📝 <b>İptal sebebi:</b> ${neden}`,
      ``,
      ``,
      `📱 <i>Onay veya red için Aspect Operations uygulamasını açın.</i>`,
    ].join("\n");

    await sendTelegramMessage(msg, "HTML", getCompanyId(user));

    console.log(`[İptal Talep] Oluşturuldu: ${approvalId} | satisId: ${satisId} | talep eden: ${iptalEden}`);
    return c.json({ approvalId, status: "bekliyor" });
  } catch (err) {
    console.log("Satis iptal talep error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// SATIŞ İPTAL ONAYI: Durum sorgula
// GET /stok/satis-iptal-durum/:approvalId
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/stok/satis-iptal-durum/:approvalId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const approvalId = c.req.param("approvalId");
    const talep: any = await kv.get(`iptal_talep_${approvalId}`);
    if (!talep) return c.json({ error: "Talep bulunamadı." }, 404);
    if (talep.companyId && talep.companyId !== getCompanyId(user)) {
      return c.json({ error: "Yetkisiz erişim." }, 403);
    }

    return c.json({
      approvalId: talep.approvalId,
      status: talep.status,
      resolvedAt: talep.resolvedAt || null,
      resolvedBy: talep.resolvedBy || null,
    });
  } catch (err) {
    console.log("Satis iptal durum error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// SATIŞ İPTAL ONAYI: Uygulama içi doğrudan karar (Telegram webhook bypass)
// POST /stok/satis-iptal-karar/:approvalId
// Body: { karar: 'onaylandi' | 'reddedildi' }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/stok/satis-iptal-karar/:approvalId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = user.user_metadata?.role;
    const yetkiliRoller = ["yonetici", "ust-mudur", "mudur", "operasyon"];
    if (!yetkiliRoller.includes(callerRole)) {
      return c.json({ error: "Bu işlem için yönetici yetkisi gereklidir." }, 403);
    }

    const approvalId = c.req.param("approvalId");
    const { karar } = await c.req.json();
    if (karar !== "onaylandi" && karar !== "reddedildi") {
      return c.json({ error: "Geçersiz karar değeri." }, 400);
    }

    const talep: any = await kv.get(`iptal_talep_${approvalId}`);
    console.log(`[İptal Karar] approvalId=${approvalId} | karar=${karar} | talep=`, talep ? `status=${talep.status}` : "BULUNAMADI");

    if (!talep) return c.json({ error: "Talep bulunamadı veya süresi doldu." }, 404);
    if (talep.companyId && talep.companyId !== getCompanyId(user)) {
      return c.json({ error: "Yetkisiz erişim." }, 403);
    }
    if (talep.status !== "bekliyor") {
      return c.json({ error: `Bu talep zaten işlenmiş: ${talep.status}` }, 400);
    }
    // 180sn süre kontrolü
    const elapsed = Date.now() - new Date(talep.requestedAt).getTime();
    if (elapsed > 180 * 1000) {
      await kv.set(`iptal_talep_${approvalId}`, { ...talep, status: "suresi_doldu" });
      return c.json({ error: "Talep süresi doldu." }, 400);
    }

    const resolvedBy = user.user_metadata?.full_name || user.email || "Yönetici";
    await kv.set(`iptal_talep_${approvalId}`, {
      ...talep,
      status: karar,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
      resolvedVia: "uygulama",
    });

    const emoji = karar === "onaylandi" ? "✅" : "❌";
    const durumLabel = karar === "onaylandi" ? "ONAYLANDI" : "REDDEDİLDİ";
    await sendTelegramMessage(
      `${emoji} <b>Satış iptali ${durumLabel}</b>\n👤 Karar veren: <b>${resolvedBy}</b> (uygulama içi)\n📝 Sebep: ${talep.neden || "(belirtilmedi)"}\n🆔 <code>${approvalId}</code>`,
      "HTML",
      talep?.companyId || getCompanyId(user)
    );

    console.log(`[İptal Karar] ✅ İşlendi: ${approvalId} → ${karar} (${resolvedBy})`);
    return c.json({ success: true, status: karar, resolvedBy });
  } catch (err) {
    console.log("Satis iptal karar error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// SATIŞ İPTAL ONAYI: Bekleyen talepleri listele (yöneticiler için)
// GET /stok/iptal-bekleyen
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/stok/iptal-bekleyen", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = user.user_metadata?.role;
    const yetkiliRoller = ["yonetici", "ust-mudur", "mudur", "operasyon"];
    if (!yetkiliRoller.includes(callerRole)) {
      return c.json({ talepleri: [] });
    }

    const callerCompanyId = getCompanyId(user);
    const tumTalep: any[] = await retryOp(() => kv.getByPrefix("iptal_talep_"), 3, 400) || [];
    const now = Date.now();
    const TTL_24H = 24 * 60 * 60 * 1000;
    const TIMEOUT_MS = 180 * 1000;

    // 24 saatten eski kayıtları sil
    const eskiler = tumTalep.filter((t: any) => t && t.requestedAt && now - new Date(t.requestedAt).getTime() > TTL_24H);
    if (eskiler.length > 0) {
      Promise.all(eskiler.map((t: any) => kv.del(`iptal_talep_${t.approvalId}`))).catch(() => {});
    }

    // 180sn geçmiş bekleyenleri "suresi_doldu" olarak güncelle
    const suresiDolanlar = tumTalep.filter((t: any) => t && t.status === "bekliyor" && t.requestedAt && now - new Date(t.requestedAt).getTime() > TIMEOUT_MS);
    if (suresiDolanlar.length > 0) {
      Promise.all(suresiDolanlar.map((t: any) => kv.set(`iptal_talep_${t.approvalId}`, { ...t, status: "suresi_doldu" }))).catch(() => {});
    }

    const bekleyen = tumTalep
      .filter((t: any) => t && t.status === "bekliyor" && t.companyId === callerCompanyId && t.requestedAt && now - new Date(t.requestedAt).getTime() <= TIMEOUT_MS)
      .sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    console.log(`[İptal Bekleyen] ${bekleyen.length} bekleyen talep (company=${callerCompanyId}).`);
    return c.json({ talepleri: bekleyen });
  } catch (err) {
    const msg = String(err);
    // Geçici ağ hataları için boş liste döndür — frontend polling'i patlatmasın
    const isTransient =
      msg.includes("connection reset") ||
      msg.includes("connection error") ||
      msg.includes("SendRequest") ||
      msg.includes("ECONNRESET");
    console.log("Iptal bekleyen list error:", err);
    if (isTransient) {
      return c.json({ talepleri: [], _warning: "Geçici bağlantı hatası, tekrar denenecek." });
    }
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// VARDIYA KARE TAKİBİ — stok_gunluk içine gömülü
// ══════════════════════════════════════════

// POST /stok/kare
app.post("/make-server-4da0b637/stok/kare", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const body = await c.req.json();
    const { mekanId, tarih, photographerName, photographerId, frameCount } = body;
    if (!mekanId || !tarih || !photographerId || !frameCount) {
      return c.json({ error: "mekanId, tarih, photographerId, frameCount zorunludur." }, 400);
    }
    const count = parseInt(frameCount);
    if (isNaN(count) || count <= 0) return c.json({ error: "Geçersiz kare sayısı." }, 400);

    // Rotasyon yetkisi kontrolü
    const companyId = getCompanyId(user);
    const yetkiliKare = await checkRotasyonYetkisi(user.id, callerRole, mekanId, tarih, companyId);
    if (!yetkiliKare) {
      console.log(`Rotasyon yetki reddi — kare: user=${user.id}, role=${callerRole}, mekan=${mekanId}, tarih=${tarih}`);
      return c.json({ error: "Bu mekana bugünkü rotasyonunuzda atanmamışsınız. Kare kaydı yapma yetkiniz yok." }, 403);
    }

    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`) || { mekanId, tarih };
    const kareKayitlari: any[] = existing.kareKayitlari || [];
    const entryId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id: entryId,
      photographerName,
      photographerId,
      frameCount: count,
      timestamp: new Date().toISOString(),
      kaydeden: user.user_metadata?.full_name || user.email || "",
      kaydedenId: user.id,
    };
    // ── PostgreSQL dual-write (kare) ──
    try {
      const db = getAdminClient();
      await db.from("frame_records").insert({
        id: entryId,
        company_id: companyId,
        venue_id: mekanId,
        date: tarih,
        photographer_id: photographerId,
        photographer_name: photographerName,
        frame_count: count,
        recorded_by_id: user.id,
        recorded_by_name: user.user_metadata?.full_name || user.email || "",
        timestamp: entry.timestamp,
      });
    } catch (sqlErr) {
      console.log(`[dual-write] SQL kare HATA: ${sqlErr} | ${entryId}`);
    }

    kareKayitlari.push(entry);
    await ckv.set(`stok_gunluk_${mekanId}_${tarih}`, { ...existing, kareKayitlari });
    console.log(`Kare kaydedildi (dual): ${entryId} | ${photographerName} | ${count} kare | ${mekanId}/${tarih}`);
    return c.json({ entry });
  } catch (err) {
    console.log("Post stok kare error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /stok/musteri-sayisi — Mekana günlük müşteri sayısı gir (tek sefer, sonra kilitlenir)
app.post("/make-server-4da0b637/stok/musteri-sayisi", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const body = await c.req.json();
    const { mekanId, tarih, musteriSayisi } = body;
    if (!mekanId || !tarih || !musteriSayisi) {
      return c.json({ error: "mekanId, tarih ve musteriSayisi zorunludur." }, 400);
    }
    const count = parseInt(musteriSayisi);
    if (isNaN(count) || count <= 0) return c.json({ error: "Geçersiz müşteri sayısı." }, 400);

    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const companyId = (isSA && reqCId) ? reqCId : getCompanyId(user);
    const ckv = companyKvFor(companyId);
    const existing = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`) || { mekanId, tarih };

    // Zaten girilmişse sadece yönetici/müdür düzeltebilir
    if (existing.musteriSayisi && !["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "Müşteri sayısı zaten girilmiş. Düzeltme için yöneticinize başvurun." }, 400);
    }

    existing.musteriSayisi = count;
    existing.musteriSayisiGiren = user.user_metadata?.name || user.email || "";
    existing.musteriSayisiGirenId = user.id;
    existing.musteriSayisiZamani = new Date().toISOString();
    await ckv.set(`stok_gunluk_${mekanId}_${tarih}`, existing);

    // ── PostgreSQL dual-write (müşteri sayısı → stock_movements customer_count) ──
    try {
      const db = getAdminClient();
      // Mevcut opening/closing kayıtlarının customer_count'unu güncelle
      await db.from("stock_movements")
        .update({ customer_count: count })
        .eq("company_id", companyId)
        .eq("venue_id", mekanId)
        .eq("date", tarih);
    } catch (sqlErr) {
      console.log(`[dual-write] SQL müşteri sayısı HATA: ${sqlErr}`);
    }

    console.log(`Müşteri sayısı kaydedildi (dual): ${mekanId}/${tarih} → ${count} (by ${user.email})`);
    return c.json({ success: true, musteriSayisi: count });
  } catch (err) {
    console.log("musteri-sayisi error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// GET /kare/performans — Personel performans hesaplama (çekim % + baskı dönüşüm %)
// Query: baslangic, bitis, mekanId? (opsiyonel), source=sql|kv (default: sql)
app.get("/make-server-4da0b637/kare/performans", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const companyId = (isSA && reqCId) ? reqCId : getCompanyId(user);
    const ckv = companyKvFor(companyId);
    const baslangic = c.req.query("baslangic") || bizDateTR();
    const bitis = c.req.query("bitis") || bizDateTR();
    const filterMekanId = c.req.query("mekanId") || "";
    const source = c.req.query("source") || "sql"; // sql veya kv

    // ══ SQL READ MODE ══
    if (source === "sql") {
      try {
        const db = getAdminClient();

        // SQL'den kare kayıtları
        let frameQuery = db.from("frame_records")
          .select("venue_id, date, photographer_id, photographer_name, frame_count")
          .eq("company_id", companyId)
          .gte("date", baslangic)
          .lte("date", bitis);
        if (filterMekanId) frameQuery = frameQuery.eq("venue_id", filterMekanId);
        const { data: sqlFrames, error: frameErr } = await frameQuery;
        if (frameErr) throw new Error(`SQL frame error: ${frameErr.message}`);

        // SQL'den satışlar
        let salesQuery = db.from("sales")
          .select("venue_id, date, recorded_by_id, recorded_by_name, final_price")
          .eq("company_id", companyId)
          .eq("is_cancelled", false)
          .gte("date", baslangic)
          .lte("date", bitis);
        if (filterMekanId) salesQuery = salesQuery.eq("venue_id", filterMekanId);
        const { data: sqlSales, error: salesErr } = await salesQuery;
        if (salesErr) throw new Error(`SQL sales error: ${salesErr.message}`);

        // Mekan bilgileri (venues tablosu)
        const { data: sqlVenues } = await db.from("venues")
          .select("id, name, emoji, kare_charpani")
          .eq("company_id", companyId);
        const mekanMap: Record<string, any> = {};
        for (const v of (sqlVenues || [])) mekanMap[v.id] = v;

        // Müşteri sayıları hâlâ KV'den (stock_movements henüz boş)
        const musteriMap: Record<string, number> = {};
        const baskiMap: Record<string, number> = {};
        const mekanIds = filterMekanId ? [filterMekanId] : Object.keys(mekanMap);
        // Tarih aralığındaki günler
        const gunlerArr: string[] = [];
        const startD = new Date(baslangic);
        const endD = new Date(bitis);
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          gunlerArr.push(d.toISOString().split("T")[0]);
        }
        for (const t of gunlerArr) {
          for (const mid of mekanIds) {
            const stok: any = await ckv.get(`stok_gunluk_${mid}_${t}`);
            if (stok?.musteriSayisi) musteriMap[`${mid}_${t}`] = stok.musteriSayisi;
            if (stok?.vardiyaToplam?.toplamCikisAdedi) baskiMap[`${mid}_${t}`] = stok.vardiyaToplam.toplamCikisAdedi;
          }
        }

        // Verileri gün-mekan bazlı grupla
        const personelPerf: Record<string, any> = {};

        // Frame verisini gün-mekan-fotograf bazlı grupla
        const framByDayVenue: Record<string, Record<string, { ad: string; toplam: number }>> = {};
        for (const f of (sqlFrames || [])) {
          const key = `${f.venue_id}_${f.date}`;
          if (!framByDayVenue[key]) framByDayVenue[key] = {};
          if (!framByDayVenue[key][f.photographer_id]) framByDayVenue[key][f.photographer_id] = { ad: f.photographer_name || "", toplam: 0 };
          framByDayVenue[key][f.photographer_id].toplam += f.frame_count || 0;
        }

        // Sales verisini gün-mekan-satıcı bazlı grupla
        const salesByDayVenue: Record<string, Record<string, { ad: string; toplam: number }>> = {};
        for (const s of (sqlSales || [])) {
          const key = `${s.venue_id}_${s.date}`;
          if (!salesByDayVenue[key]) salesByDayVenue[key] = {};
          const sid = s.recorded_by_id || "unknown";
          if (!salesByDayVenue[key][sid]) salesByDayVenue[key][sid] = { ad: s.recorded_by_name || "", toplam: 0 };
          salesByDayVenue[key][sid].toplam++;
        }

        // Her gün-mekan için performans hesapla
        for (const dayVenueKey of new Set([...Object.keys(framByDayVenue), ...Object.keys(salesByDayVenue)])) {
          const [venueId, date] = [dayVenueKey.split("_").slice(0, -1).join("_"), dayVenueKey.split("_").pop()!];
          // venue_id'de underscore olabilir, doğru parse:
          const parts = dayVenueKey.match(/^(.+)_(\d{4}-\d{2}-\d{2})$/);
          if (!parts) continue;
          const vId = parts[1];
          const vDate = parts[2];

          const musteriSayisi = musteriMap[dayVenueKey] || 0;
          if (!musteriSayisi) continue;

          const mekan = mekanMap[vId];
          const kareCharpani = mekan?.kare_charpani || mekan?.kareCharpani || 5;
          const kota = musteriSayisi * kareCharpani;

          const fotografciKare = framByDayVenue[dayVenueKey] || {};
          const satisciSatis = salesByDayVenue[dayVenueKey] || {};
          const fotografciSayisi = Object.keys(fotografciKare).length;
          const satisciSayisi = Object.keys(satisciSatis).length;
          if (fotografciSayisi === 0 && satisciSayisi === 0) continue;

          const kisiBasiKota = fotografciSayisi > 0 ? Math.round(kota / fotografciSayisi) : 0;
          const kisiBasiMusteri = fotografciSayisi > 0 ? Math.round(musteriSayisi / fotografciSayisi) : 0;
          const kisiBasiMusteriSatis = satisciSayisi > 0 ? Math.round(musteriSayisi / satisciSayisi) : 0;
          const toplamCekilen = Object.values(fotografciKare).reduce((s, f) => s + f.toplam, 0);
          const toplamBasilan = baskiMap[dayVenueKey] || 0;
          const baskiDonusumYuzde = toplamCekilen > 0 ? Math.round((toplamBasilan / toplamCekilen) * 100) : 0;
          const kisiBasiBasilan = satisciSayisi > 0 ? Math.round(toplamBasilan / satisciSayisi) : 0;

          const tumPersonelIds = new Set([...Object.keys(fotografciKare), ...Object.keys(satisciSatis)]);
          for (const pid of tumPersonelIds) {
            const fotoData = fotografciKare[pid];
            const satisData = satisciSatis[pid];
            const ad = fotoData?.ad || satisData?.ad || "";
            const cektigiKare = fotoData?.toplam || 0;
            const satisAdet = satisData?.toplam || 0;

            if (!personelPerf[pid]) {
              personelPerf[pid] = { id: pid, ad, gunler: [], toplamKare: 0, toplamSorumluMusteri: 0, toplamSatisAdet: 0 };
            }
            const cekimYuzde = kisiBasiKota > 0 ? Math.round((cektigiKare / kisiBasiKota) * 100) : 0;
            const satisDonusumYuzde = kisiBasiMusteriSatis > 0 ? Math.round((satisAdet / kisiBasiMusteriSatis) * 100) : 0;
            const baskiSatisOraniYuzde = kisiBasiBasilan > 0 ? Math.round((satisAdet / kisiBasiBasilan) * 100) : 0;

            personelPerf[pid].gunler.push({
              tarih: vDate, mekanId: vId,
              mekanAd: mekan?.name || vId,
              mekanEmoji: mekan?.emoji || "📍",
              musteriSayisi, kisiBasiMusteri, kisiBasiMusteriSatis, kota, kisiBasiKota,
              cektigiKare, cekimYuzde, baskiDonusumYuzde,
              satisAdet, satisDonusumYuzde, baskiSatisOraniYuzde,
            });
            personelPerf[pid].toplamKare += cektigiKare;
            personelPerf[pid].toplamSorumluMusteri += kisiBasiMusteri || kisiBasiMusteriSatis;
            personelPerf[pid].toplamSatisAdet += satisAdet;
          }
        }

        // Ortalama + sırala
        const personeller = Object.values(personelPerf).map((p: any) => {
          const gunSayisi = p.gunler.length;
          return {
            ...p,
            gunSayisi,
            ortCekimYuzde: gunSayisi > 0 ? Math.round(p.gunler.reduce((s: number, g: any) => s + g.cekimYuzde, 0) / gunSayisi) : 0,
            ortBaskiDonusumYuzde: gunSayisi > 0 ? Math.round(p.gunler.reduce((s: number, g: any) => s + g.baskiDonusumYuzde, 0) / gunSayisi) : 0,
            ortSatisDonusumYuzde: gunSayisi > 0 ? Math.round(p.gunler.reduce((s: number, g: any) => s + (g.satisDonusumYuzde || 0), 0) / gunSayisi) : 0,
            ortBaskiSatisOraniYuzde: gunSayisi > 0 ? Math.round(p.gunler.reduce((s: number, g: any) => s + (g.baskiSatisOraniYuzde || 0), 0) / gunSayisi) : 0,
          };
        }).sort((a: any, b: any) => b.ortCekimYuzde - a.ortCekimYuzde);

        const toplamPersonel = personeller.length;
        return c.json({
          baslangic, bitis, source: "sql",
          toplamPersonel,
          genelOrtCekimYuzde: toplamPersonel > 0 ? Math.round(personeller.reduce((s: number, p: any) => s + p.ortCekimYuzde, 0) / toplamPersonel) : 0,
          genelOrtBaskiDonusumYuzde: toplamPersonel > 0 ? Math.round(personeller.reduce((s: number, p: any) => s + p.ortBaskiDonusumYuzde, 0) / toplamPersonel) : 0,
          genelOrtSatisDonusumYuzde: toplamPersonel > 0 ? Math.round(personeller.reduce((s: number, p: any) => s + p.ortSatisDonusumYuzde, 0) / toplamPersonel) : 0,
          genelOrtBaskiSatisOraniYuzde: toplamPersonel > 0 ? Math.round(personeller.reduce((s: number, p: any) => s + p.ortBaskiSatisOraniYuzde, 0) / toplamPersonel) : 0,
          personeller,
        });
      } catch (sqlReadErr) {
        console.log(`[sql-read] kare/performans SQL hatası, KV fallback: ${sqlReadErr}`);
        // SQL hata verirse KV'ye düş — aşağıdaki mevcut KV kodu çalışır
      }
    }

    // ══ KV READ MODE (fallback veya source=kv) ══

    // Tüm mekanları al
    const mekanlar: any[] = await ckv.getByPrefix("mekan_") || [];
    const mekanMap: Record<string, any> = {};
    for (const m of mekanlar) mekanMap[m.id] = m;

    // Tarih aralığındaki günleri oluştur
    const gunler: string[] = [];
    const startD = new Date(baslangic);
    const endD = new Date(bitis);
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      gunler.push(d.toISOString().split("T")[0]);
    }

    // Personel bazlı performans toplama
    const personelPerf: Record<string, {
      id: string; ad: string;
      gunler: { tarih: string; mekanId: string; mekanAd: string; mekanEmoji: string; musteriSayisi: number; kota: number; kisiBasiKota: number; cektigiKare: number; cekimYuzde: number; baskiDonusumYuzde: number }[];
      toplamKare: number; toplamSorumluMusteri: number;
    }> = {};

    // Her gün her mekan için stok verisini çek ve hesapla
    for (const tarih of gunler) {
      const mekanIds = filterMekanId ? [filterMekanId] : mekanlar.map(m => m.id);

      for (const mekanId of mekanIds) {
        const stok: any = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`);
        if (!stok) continue;

        const musteriSayisi = stok.musteriSayisi || 0;
        if (!musteriSayisi) continue; // müşteri sayısı girilmemişse hesaplama yapma

        const mekan = mekanMap[mekanId];
        const kareCharpani = mekan?.kareCharpani || 5;
        const kota = musteriSayisi * kareCharpani;

        const kareKayitlari: any[] = stok.kareKayitlari || [];
        const satislar: any[] = (stok.satislar || []).filter((s: any) => !s.iptal);

        // Fotoğrafçı bazlı kare toplamı
        const fotografciKare: Record<string, { ad: string; toplam: number }> = {};
        for (const k of kareKayitlari) {
          if (!k.photographerId) continue;
          if (!fotografciKare[k.photographerId]) {
            fotografciKare[k.photographerId] = { ad: k.photographerName || "", toplam: 0 };
          }
          fotografciKare[k.photographerId].toplam += k.frameCount || 0;
        }

        // Satışçı bazlı satış toplamı
        const satisciSatis: Record<string, { ad: string; toplam: number }> = {};
        for (const s of satislar) {
          const sid = s.kaydedenId || s.kaydeden;
          if (!sid) continue;
          if (!satisciSatis[sid]) {
            satisciSatis[sid] = { ad: s.kaydeden || "", toplam: 0 };
          }
          satisciSatis[sid].toplam++;
        }

        const fotografciSayisi = Object.keys(fotografciKare).length;
        const satisciSayisi = Object.keys(satisciSatis).length;

        // En az biri olmalı
        if (fotografciSayisi === 0 && satisciSayisi === 0) continue;

        const kisiBasiKota = fotografciSayisi > 0 ? Math.round(kota / fotografciSayisi) : 0;
        const kisiBasiMusteri = fotografciSayisi > 0 ? Math.round(musteriSayisi / fotografciSayisi) : 0;
        const kisiBasiMusteriSatis = satisciSayisi > 0 ? Math.round(musteriSayisi / satisciSayisi) : 0;
        const toplamCekilen = Object.values(fotografciKare).reduce((s, f) => s + f.toplam, 0);

        // Baskı dönüşüm: kapanış verisi
        const toplamBasilan = stok.vardiyaToplam?.toplamCikisAdedi || 0;
        const baskiDonusumYuzde = toplamCekilen > 0 ? Math.round((toplamBasilan / toplamCekilen) * 100) : 0;
        const kisiBasiBasilan = satisciSayisi > 0 ? Math.round(toplamBasilan / satisciSayisi) : 0;

        // Tüm personeli (fotoğrafçı + satışçı) birleştir
        const tumPersonelIds = new Set([...Object.keys(fotografciKare), ...Object.keys(satisciSatis)]);

        for (const pid of tumPersonelIds) {
          const fotoData = fotografciKare[pid];
          const satisData = satisciSatis[pid];
          const ad = fotoData?.ad || satisData?.ad || "";
          const cektigiKare = fotoData?.toplam || 0;
          const satisAdet = satisData?.toplam || 0;

          if (!personelPerf[pid]) {
            personelPerf[pid] = { id: pid, ad, gunler: [], toplamKare: 0, toplamSorumluMusteri: 0, toplamSatisAdet: 0 };
          }
          const cekimYuzde = kisiBasiKota > 0 ? Math.round((cektigiKare / kisiBasiKota) * 100) : 0;
          const satisDonusumYuzde = kisiBasiMusteriSatis > 0 ? Math.round((satisAdet / kisiBasiMusteriSatis) * 100) : 0;
          const baskiSatisOraniYuzde = kisiBasiBasilan > 0 ? Math.round((satisAdet / kisiBasiBasilan) * 100) : 0;

          personelPerf[pid].gunler.push({
            tarih, mekanId,
            mekanAd: mekan?.name || mekanId,
            mekanEmoji: mekan?.emoji || "📍",
            musteriSayisi, kisiBasiMusteri, kisiBasiMusteriSatis, kota, kisiBasiKota,
            cektigiKare,
            cekimYuzde,
            baskiDonusumYuzde,
            satisAdet,
            satisDonusumYuzde,
            baskiSatisOraniYuzde,
          });
          personelPerf[pid].toplamKare += cektigiKare;
          personelPerf[pid].toplamSorumluMusteri += kisiBasiMusteri || kisiBasiMusteriSatis;
          (personelPerf[pid] as any).toplamSatisAdet = ((personelPerf[pid] as any).toplamSatisAdet || 0) + satisAdet;
        }
      }
    }

    // Ortalama hesapla ve listeye dönüştür
    const personeller = Object.values(personelPerf).map(p => {
      const gunSayisi = p.gunler.length;
      const ortCekimYuzde = gunSayisi > 0 ? Math.round(p.gunler.reduce((s, g) => s + g.cekimYuzde, 0) / gunSayisi) : 0;
      const ortBaskiDonusumYuzde = gunSayisi > 0 ? Math.round(p.gunler.reduce((s, g) => s + g.baskiDonusumYuzde, 0) / gunSayisi) : 0;
      const ortSatisDonusumYuzde = gunSayisi > 0 ? Math.round(p.gunler.reduce((s, g) => s + (g.satisDonusumYuzde || 0), 0) / gunSayisi) : 0;
      const ortBaskiSatisOraniYuzde = gunSayisi > 0 ? Math.round(p.gunler.reduce((s, g) => s + (g.baskiSatisOraniYuzde || 0), 0) / gunSayisi) : 0;
      return {
        ...p,
        gunSayisi,
        ortCekimYuzde,
        ortBaskiDonusumYuzde,
        ortSatisDonusumYuzde,
        ortBaskiSatisOraniYuzde,
      };
    }).sort((a, b) => b.ortCekimYuzde - a.ortCekimYuzde);

    const toplamPersonel = personeller.length;
    const genelOrtCekim = toplamPersonel > 0 ? Math.round(personeller.reduce((s, p) => s + p.ortCekimYuzde, 0) / toplamPersonel) : 0;
    const genelOrtBaski = toplamPersonel > 0 ? Math.round(personeller.reduce((s, p) => s + p.ortBaskiDonusumYuzde, 0) / toplamPersonel) : 0;
    const genelOrtSatisDonusum = toplamPersonel > 0 ? Math.round(personeller.reduce((s, p) => s + p.ortSatisDonusumYuzde, 0) / toplamPersonel) : 0;
    const genelOrtBaskiSatis = toplamPersonel > 0 ? Math.round(personeller.reduce((s, p) => s + p.ortBaskiSatisOraniYuzde, 0) / toplamPersonel) : 0;

    return c.json({
      baslangic, bitis,
      toplamPersonel,
      genelOrtCekimYuzde: genelOrtCekim,
      genelOrtBaskiDonusumYuzde: genelOrtBaski,
      genelOrtSatisDonusumYuzde: genelOrtSatisDonusum,
      genelOrtBaskiSatisOraniYuzde: genelOrtBaskiSatis,
      personeller,
    });
  } catch (err) {
    console.log("kare/performans error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// VARDIYA KARE SİLME
// DELETE /stok/kare/:mekanId/:tarih/:id
// ──────────────────────────────────────────
app.delete("/make-server-4da0b637/stok/kare/:mekanId/:tarih/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur", "mudur", "operasyon"].includes(role)) {
      return c.json({ error: "Kare kaydı silme yetkisi yok." }, 403);
    }

    const mekanId = c.req.param("mekanId");
    const tarih   = c.req.param("tarih");
    const id      = c.req.param("id");

    const ckv = companyKvFor(getCompanyId(user));
    const kayit: any = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`);
    if (!kayit) return c.json({ error: "Stok kaydı bulunamadı." }, 404);

    const onceki: any[] = kayit.kareKayitlari || [];
    const entry = onceki.find((k: any) => k.id === id);
    if (!entry) return c.json({ error: "Kare kaydı bulunamadı." }, 404);

    // Kapanış yapılmışsa silme
    if (kayit.kapanish) {
      return c.json({ error: "Kapanış yapılmış vardiyada kare silinemez." }, 400);
    }

    const guncellendi = onceki.filter((k: any) => k.id !== id);
    await ckv.set(`stok_gunluk_${mekanId}_${tarih}`, { ...kayit, kareKayitlari: guncellendi });

    const silenAd = user.user_metadata?.full_name || user.email || "Bilinmiyor";
    const silenRole = user.user_metadata?.role || role;
    console.log(`Kare silindi: id=${id} | ${entry.photographerName} | ${entry.frameCount} kare | ${mekanId}/${tarih} | silen=${silenAd}`);

    // ── Telegram bildirimi ──
    try {
      let mekanAdi = mekanId;
      try {
        const mekanObj: any = await ckv.get(`mekan_${mekanId}`);
        if (mekanObj?.name) mekanAdi = `${mekanObj.emoji || "📍"} ${mekanObj.name}`;
      } catch {}

      const kareZamani = entry.timestamp
        ? new Date(entry.timestamp).toLocaleString("tr-TR", {
            timeZone: "Europe/Istanbul",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "?";

      const silmeZamani = new Date().toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
      });

      const msg = [
        `🗑️ <b>KARE KAYDI İPTAL BİLDİRİMİ</b>`,
        ``,
        `📍 <b>Mekan:</b> ${mekanAdi}`,
        `📅 <b>Tarih:</b> ${tarih} | ⏰ Kayıt saati: ${kareZamani}`,
        ``,
        `📷 <b>Fotoğrafçı:</b> ${entry.photographerName || "Bilinmiyor"}`,
        `🖼️ <b>Silinen kare sayısı:</b> ${entry.frameCount} kare`,
        ...(entry.kaydeden ? [`👤 <b>Kaydeden:</b> ${entry.kaydeden}`] : []),
        ``,
        `🔴 <b>Silen:</b> ${silenAd} <i>(${silenRole})</i>`,
        `⏱️ <b>Silme saati:</b> ${silmeZamani}`,
        ``,
        `🆔 <code>${id}</code>`,
      ].join("\n");

      await sendTelegramMessage(msg, "HTML", getCompanyId(user));
    } catch (tgErr) {
      console.log("[Telegram] kare silme mesaj hatası:", tgErr);
    }

    return c.json({ success: true, silinen: entry });
  } catch (err) {
    console.log("Delete stok kare error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── ESKI STANDALONE KARE ENDPOINTS (artık kullanılmıyor, stok/kare kullanın) ──
// Aşağıdakiler backward compat için bırakıldı ama yeni kod kullanmıyor

// POST /make-server-4da0b637/kare (eski — stok/kare'ye yönlendir)
app.post("/make-server-4da0b637/kare", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const body = await c.req.json();
    const { photographerName, photographerId, frameCount, location, locationIcon } = body;

    if (!photographerId || !frameCount || !location) {
      return c.json({ error: "photographerId, frameCount ve location zorunludur." }, 400);
    }
    const count = parseInt(frameCount);
    if (isNaN(count) || count <= 0) return c.json({ error: "Geçersiz kare sayısı." }, 400);

    const today = bizDateTR(); // İş günü tarihi (05:00 TR kırılımlı)
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id,
      photographerName,
      photographerId,
      frameCount: count,
      location,
      locationIcon: locationIcon || "📷",
      timestamp: new Date().toISOString(),
      date: today,
      enteredBy: user.user_metadata?.full_name || user.email || "",
      enteredById: user.id,
    };

    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`kare_${today}_${id}`, entry);
    console.log(`Kare entry saved: ${id} | ${photographerName} | ${count} kare | ${location}`);
    return c.json({ entry });
  } catch (err) {
    console.log("Post kare error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// GET /make-server-4da0b637/kare?date=YYYY-MM-DD&location=...
app.get("/make-server-4da0b637/kare", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const dateParam = c.req.query("date") || new Date().toISOString().split("T")[0];
    const locationParam = c.req.query("location");

    const ckv = companyKvFor(getCompanyId(user));
    const all = await ckv.getByPrefix(`kare_${dateParam}_`);
    let entries = (all || []).filter(Boolean);

    if (locationParam) {
      entries = entries.filter((e: any) => e.location === locationParam);
    }
    entries.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return c.json({ entries, date: dateParam });
  } catch (err) {
    console.log("Get kare error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /make-server-4da0b637/kare/:date/:id
app.delete("/make-server-4da0b637/kare/:date/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur", "mudur", "operasyon"].includes(role)) {
      return c.json({ error: "Silme yetkisi yok." }, 403);
    }

    const date = c.req.param("date");
    const id = c.req.param("id");
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`kare_${date}_${id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log("Delete kare error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// GERİ BİLDİRİM: Kullanıcı geri bildirim sistemi
// POST /geri-bildirim — yeni bildirim gönder (tüm roller)
// GET  /geri-bildirim — tüm bildirimleri listele (sadece superadmin)
// DELETE /geri-bildirim/:id — bildirim sil (sadece superadmin)
// ══════════════════════════════════════════

app.post("/make-server-4da0b637/geri-bildirim", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { tip, mesaj } = await c.req.json();
    if (!tip || !mesaj?.trim()) return c.json({ error: "Tip ve mesaj zorunludur." }, 400);

    const userName = user.user_metadata?.full_name || user.email || "Bilinmiyor";
    const userRole = user.user_metadata?.role || "personel";
    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);

    const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const bildirim = {
      id,
      userId: user.id,
      userName,
      userRole,
      tip,
      mesaj: mesaj.trim(),
      tarih: new Date().toISOString(),
    };

    await ckv.set(`geri_bildirim_${id}`, bildirim);

    // Telegram bildirimi
    const tipLabel = tip === "aksaklik" ? "Aksaklık Bildirimi" : "Güncelleme Talebi";
    const tipEmoji = tip === "aksaklik" ? "🐛" : "💡";
    const roleLabels: Record<string, string> = { yonetici: "Yönetici", "ust-mudur": "Üst Müdür", mudur: "Müdür", operasyon: "Operasyon", personel: "Personel", idari: "İdari" };
    const telegramText = `📬 <b>Yeni Geri Bildirim</b>\n\n👤 <b>${userName}</b> (${roleLabels[userRole] || userRole})\n${tipEmoji} Tip: <b>${tipLabel}</b>\n💬 ${mesaj.trim()}\n\n📅 ${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    await sendTelegramMessage(telegramText, "HTML", companyId).catch(e => console.log("[Geri Bildirim] Telegram hata:", e));

    console.log(`[Geri Bildirim] ${userName} → ${tipLabel}: ${mesaj.trim().slice(0, 50)}`);
    return c.json({ success: true, id });
  } catch (err) {
    console.log("Geri bildirim POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.get("/make-server-4da0b637/geri-bildirim", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const originalRole = user.user_metadata?.originalRole || user.user_metadata?.role;
    if (originalRole !== "superadmin") {
      return c.json({ error: "Bu endpoint yalnızca yetkili kullanıcıya açıktır." }, 403);
    }
    const reqCId = c.req.query("company_id");
    const effCId = reqCId || getCompanyId(user);
    const ckv = companyKvFor(effCId);
    const raw = await ckv.getByPrefix("geri_bildirim_");
    const bildirimler = (raw || []).filter((b: any) => b?.id && b?.mesaj).sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
    return c.json({ bildirimler });
  } catch (err) {
    console.log("Geri bildirim GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.delete("/make-server-4da0b637/geri-bildirim/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const originalRole = user.user_metadata?.originalRole || user.user_metadata?.role;
    if (originalRole !== "superadmin") {
      return c.json({ error: "Silme yetkisi yalnızca yetkili kullanıcıya aittir." }, 403);
    }
    const id = c.req.param("id");
    const reqCId = c.req.query("company_id");
    const effCId = reqCId || getCompanyId(user);
    const ckv = companyKvFor(effCId);
    await ckv.del(`geri_bildirim_${id}`);
    console.log(`[Geri Bildirim] Silindi: ${id} — by ${user.email}`);
    return c.json({ success: true });
  } catch (err) {
    console.log("Geri bildirim DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// KARE İSTATİSTİK: Personel bazlı kare istatistikleri
// GET /kare/istatistik?baslangic=YYYY-MM-DD&bitis=YYYY-MM-DD&mekanId=xxx
// ══════════════════════════════════════════
app.get("/make-server-4da0b637/kare/istatistik", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "superadmin"].includes(callerRole)) {
      return c.json({ error: "Bu endpoint yalnızca yönetici rollerine açıktır." }, 403);
    }

    const reqCId = c.req.query("company_id");
    const isSA = callerRole === "superadmin";
    const effCId = (isSA && reqCId) ? reqCId : getCompanyId(user);
    const ckv = companyKvFor(effCId);

    const baslangic = c.req.query("baslangic") || "";
    const bitis = c.req.query("bitis") || "";
    const mekanIdFilter = c.req.query("mekanId") || "";

    // Tüm günlük stok kayıtlarını çek
    const tumKayitlar = await ckv.getByPrefix("stok_gunluk_");
    const mekanlarList = await getMekanlarFor(effCId);
    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) mekanMap[m.id] = m;

    // Personel haritası
    const personelMap: Record<string, {
      id: string;
      ad: string;
      toplamKare: number;
      gunler: Record<string, { mekanId: string; mekanAd: string; kare: number }>;
      mekanlar: Record<string, number>;
    }> = {};

    // Mekan bazlı günlük toplam (yüzde hesabı için)
    const mekanGunToplam: Record<string, number> = {}; // "mekanId_tarih" → toplam kare

    let genelToplamKare = 0;

    for (const kayit of (tumKayitlar || [])) {
      if (!kayit || !kayit.tarih || !kayit.mekanId) continue;
      if (baslangic && kayit.tarih < baslangic) continue;
      if (bitis && kayit.tarih > bitis) continue;
      if (mekanIdFilter && kayit.mekanId !== mekanIdFilter) continue;

      const mekan = mekanMap[kayit.mekanId];
      const mekanAd = mekan?.name || kayit.mekanId;
      const kareKayitlari = kayit.kareKayitlari || [];

      // Mekan-gün toplam
      const mgKey = `${kayit.mekanId}_${kayit.tarih}`;
      const gunToplamKare = kareKayitlari.reduce((s: number, k: any) => s + (Number(k.frameCount) || 0), 0);
      mekanGunToplam[mgKey] = gunToplamKare;
      genelToplamKare += gunToplamKare;

      for (const kare of kareKayitlari) {
        const pid = kare.photographerId || kare.photographerName || "bilinmiyor";
        const pAd = kare.photographerName || "Bilinmiyor";
        const frameCount = Number(kare.frameCount) || 0;

        if (!personelMap[pid]) {
          personelMap[pid] = { id: pid, ad: pAd, toplamKare: 0, gunler: {}, mekanlar: {} };
        }
        const p = personelMap[pid];
        if (p.ad === "Bilinmiyor" && pAd !== "Bilinmiyor") p.ad = pAd;
        p.toplamKare += frameCount;

        // Gün detayı
        const gunKey = `${kayit.mekanId}_${kayit.tarih}`;
        if (!p.gunler[gunKey]) p.gunler[gunKey] = { mekanId: kayit.mekanId, mekanAd, kare: 0 };
        p.gunler[gunKey].kare += frameCount;

        // Mekan toplam
        p.mekanlar[kayit.mekanId] = (p.mekanlar[kayit.mekanId] || 0) + frameCount;
      }
    }

    // Response oluştur
    const personeller = Object.values(personelMap)
      .sort((a, b) => b.toplamKare - a.toplamKare)
      .map(p => {
        // Gün detaylarını diziye çevir + yüzde hesapla
        const gunDetay = Object.entries(p.gunler).map(([key, g]) => {
          const gunToplam = mekanGunToplam[key] || 1;
          return {
            tarih: key.split("_").slice(1).join("_"), // mekanId_tarih → tarih
            mekanId: g.mekanId,
            mekanAd: g.mekanAd,
            kare: g.kare,
            gunToplam,
            yuzde: Math.round((g.kare / gunToplam) * 100),
          };
        }).sort((a, b) => b.tarih.localeCompare(a.tarih));

        const mekanDetay = Object.entries(p.mekanlar).map(([mId, kare]) => ({
          mekanId: mId,
          mekanAd: mekanMap[mId]?.name || mId,
          mekanEmoji: mekanMap[mId]?.emoji || "📍",
          mekanColor: mekanMap[mId]?.color || "#9dd9ea",
          kare,
        })).sort((a, b) => b.kare - a.kare);

        return {
          id: p.id,
          ad: p.ad,
          toplamKare: p.toplamKare,
          genelYuzde: genelToplamKare > 0 ? Math.round((p.toplamKare / genelToplamKare) * 100) : 0,
          gunSayisi: gunDetay.length,
          gunDetay,
          mekanDetay,
        };
      });

    const mekanlar = (mekanlarList || []).map((m: any) => ({ id: m.id, name: m.name, emoji: m.emoji }));

    return c.json({ personeller, genelToplamKare, mekanlar });
  } catch (err) {
    console.log("Kare istatistik error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// KULLANICILAR: Zimmet için aktif kullanıcı listesi
// GET /make-server-4da0b637/auth/kullanicilar
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/auth/kullanicilar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const companyId = getCompanyId(user);

    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const aktifler = (data.users || [])
      .filter((u: any) => {
        const uCompany = (u.user_metadata?.company_id || "aspect").toLowerCase();
        return (
          uCompany === companyId &&
          u.user_metadata?.role &&
          u.user_metadata.role !== "bekleyen"
        );
      })
      .map((u: any) => ({
        id: u.id,
        ad: u.user_metadata?.full_name || u.email,
        rol: u.user_metadata?.role,
        email: u.email,
      }));

    return c.json({ kullanicilar: aktifler });
  } catch (err) {
    console.log("Kullanıcı listesi error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALZEME: Fotoğraf Yükle
// POST /make-server-4da0b637/malzeme/foto-yukle
// Body: { imageData: "data:image/jpeg;base64,...", equipmentId: string }
// Returns: { imagePath: string }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/malzeme/foto-yukle", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["admin", "yonetici", "ust-mudur", "mudur", "operasyon"].includes(role))
      return c.json({ error: "Yetki yok." }, 403);

    const { imageData, equipmentId } = await c.req.json();
    if (!imageData) return c.json({ error: "imageData zorunludur." }, 400);

    await ensureEquipmentBucket();

    // data:image/jpeg;base64,<base64data> formatını ayrıştır
    const match = imageData.match(/^data:([a-zA-Z0-9+\/]+\/[a-zA-Z0-9+\/]+);base64,(.+)$/);
    if (!match) return c.json({ error: "Geçersiz imageData formatı." }, 400);
    const mimeType = match[1];
    const base64 = match[2];
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";

    const fileName = `${equipmentId || Date.now()}_${Date.now()}.${ext}`;
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));

    const sb = getAdminClient();
    const { data, error } = await sb.storage
      .from(EQUIPMENT_BUCKET)
      .upload(fileName, bytes, { contentType: mimeType, upsert: true });

    if (error) {
      console.log("Storage upload error:", error.message);
      return c.json({ error: `Yükleme hatası: ${error.message}` }, 500);
    }

    console.log(`Ekipman fotoğrafı yüklendi: ${fileName} — ${user.user_metadata?.full_name}`);
    return c.json({ imagePath: data.path }, 201);
  } catch (err) {
    console.log("Malzeme foto-yukle error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALZEME: Liste
// GET /make-server-4da0b637/malzeme/liste
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/malzeme/liste", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const isSAMalzeme = user.user_metadata?.originalRole === "superadmin";
    const reqCIdMalzeme = c.req.query("company_id");
    const effCIdMalzeme = (isSAMalzeme && reqCIdMalzeme) ? reqCIdMalzeme : getCompanyId(user);

    const ckv = companyKvFor(effCIdMalzeme);
    const tumEkipmanlar: any[] = await ckv.getByPrefix("ekipman_") || [];
    const sirali = tumEkipmanlar.sort((a: any, b: any) =>
      new Date(a.olusturulmaTarihi || 0).getTime() - new Date(b.olusturulmaTarihi || 0).getTime()
    );

    // imagePath olan ekipmanlar için imzalı URL üret (1 saat geçerli)
    const sb = getAdminClient();
    const ekipmanlarWithUrls = await Promise.all(
      sirali.map(async (eq: any) => {
        if (!eq.imagePath) return eq;
        try {
          const { data } = await sb.storage
            .from(EQUIPMENT_BUCKET)
            .createSignedUrl(eq.imagePath, 3600);
          return { ...eq, imageUrl: data?.signedUrl || null };
        } catch {
          return eq;
        }
      })
    );

    return c.json({ ekipmanlar: ekipmanlarWithUrls });
  } catch (err) {
    console.log("Malzeme liste error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALZEME: Ekle
// POST /make-server-4da0b637/malzeme/ekle
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/malzeme/ekle", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["admin", "yonetici", "ust-mudur", "mudur", "operasyon"].includes(role))
      return c.json({ error: "Yetki yok." }, 403);

    const body = await c.req.json();
    const { category, brand, model, serialNumber, status, location } = body;
    if (!category || !brand || !model || !serialNumber || !status || !location)
      return c.json({ error: "Zorunlu alanlar eksik." }, 400);

    const id = `ekipman_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ekipman = {
      id,
      category, brand, model, serialNumber, status, location,
      locationType: body.locationType || 'diger',
      locationId: body.locationId || undefined,
      flashId: body.flashId || undefined,
      notes: body.notes || undefined,
      gecmis: body.gecmis || [],
      imagePath: body.imagePath || undefined,
      assignedTo: undefined,
      assignedToId: undefined,
      // Yazıcıya özgü alanlar
      ribonMevcut: category === 'printer' && body.ribonMevcut !== undefined ? Number(body.ribonMevcut) : undefined,
      kagitTipiId: category === 'printer' && body.kagitTipiId ? body.kagitTipiId : undefined,
      olusturulmaTarihi: new Date().toISOString(),
      olusturanId: user.id,
      olusturanAdi: user.user_metadata?.full_name || user.email,
      guncellemeTarihi: new Date().toISOString(),
    };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(id, ekipman);
    pgWrite("equipment", "insert", {
      id, company_id: getCompanyId(user), venue_id: body.locationId || null,
      name: `${brand} ${model}`.trim(), type: category || "other",
      ribon_mevcut: Number(body.ribonMevcut) || 0, ribon_kapasitesi: Number(body.ribonKapasitesi) || 0,
      extra_data: ekipman,
    });

    console.log(`Malzeme eklendi: ${brand} ${model} — ${user.user_metadata?.full_name}`);
    return c.json({ basarili: true, ekipman });
  } catch (err) {
    console.log("Malzeme ekle error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALZEME: Güncelle
// PUT /make-server-4da0b637/malzeme/guncelle
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/malzeme/guncelle", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["admin", "yonetici", "ust-mudur", "mudur", "operasyon"].includes(role))
      return c.json({ error: "Yetki yok." }, 403);

    const body = await c.req.json();
    const { id, ...fields } = body;
    if (!id) return c.json({ error: "id zorunludur." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const mevcut: any = await ckv.get(id);
    if (!mevcut) return c.json({ error: "Ekipman bulunamadı." }, 404);

    const guncellendi = {
      ...mevcut,
      ...fields,
      id,
      guncellemeTarihi: new Date().toISOString(),
      guncelleyenId: user.id,
      guncelleyenAdi: user.user_metadata?.full_name || user.email,
    };
    await ckv.set(id, guncellendi);

    console.log(`Malzeme güncellendi: ${id} — ${user.user_metadata?.full_name}`);
    return c.json({ basarili: true, ekipman: guncellendi });
  } catch (err) {
    console.log("Malzeme güncelle error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALZEME: Zimmet ata / kaldır
// PUT /make-server-4da0b637/malzeme/zimmet
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/malzeme/zimmet", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["admin", "yonetici", "ust-mudur", "mudur"].includes(role))
      return c.json({ error: "Yetki yok." }, 403);

    const { id, assignedTo, assignedToId } = await c.req.json();
    if (!id) return c.json({ error: "id zorunludur." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const mevcut: any = await ckv.get(id);
    if (!mevcut) return c.json({ error: "Ekipman bulunamadı." }, 404);

    mevcut.assignedTo = assignedTo || undefined;
    mevcut.assignedToId = assignedToId || undefined;
    mevcut.guncellemeTarihi = new Date().toISOString();
    mevcut.zimmetTarihi = assignedTo ? new Date().toISOString() : undefined;
    mevcut.zimmeti = user.user_metadata?.full_name || user.email;
    await ckv.set(id, mevcut);

    console.log(`Zimmet: ${id} → ${assignedTo || "kaldırıldı"} — ${user.user_metadata?.full_name}`);
    return c.json({ basarili: true, ekipman: mevcut });
  } catch (err) {
    console.log("Malzeme zimmet error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALZEME: Sil
// DELETE /make-server-4da0b637/malzeme/sil/:id
// ──────────────────────────────────────────
app.delete("/make-server-4da0b637/malzeme/sil/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["admin", "yonetici", "ust-mudur", "mudur"].includes(role))
      return c.json({ error: "Yetki yok." }, 403);

    const id = c.req.param("id");
    const ckv = companyKvFor(getCompanyId(user));
    const mevcut: any = await ckv.get(id);
    if (!mevcut) return c.json({ error: "Ekipman bulunamadı." }, 404);

    // Storage'dan fotoğrafı sil (varsa)
    if (mevcut.imagePath) {
      try {
        const sb = getAdminClient();
        await sb.storage.from(EQUIPMENT_BUCKET).remove([mevcut.imagePath]);
        console.log(`Ekipman fotoğrafı silindi: ${mevcut.imagePath}`);
      } catch (imgErr) {
        console.log("Fotoğraf silme hatası (devam ediliyor):", imgErr);
      }
    }

    await ckv.del(id);

    console.log(`Malzeme silindi: ${mevcut.brand} ${mevcut.model} — ${user.user_metadata?.full_name}`);
    return c.json({ basarili: true });
  } catch (err) {
    console.log("Malzeme sil error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ASPECT AI: Rol Konfigürasyonu
// GET  /make-server-4da0b637/ai/role-config
// POST /make-server-4da0b637/ai/role-config
// ──────────────────────────────────────────

app.get("/make-server-4da0b637/ai/role-config", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const ckv = companyKvFor(getCompanyId(user));
    const config = await ckv.get("ai_role_config_v1") || null;
    return c.json({ config });
  } catch (err) {
    console.log("AI role-config GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/ai/role-config", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Bu ayarı sadece Yönetici ve Üst Müdür değiştirebilir." }, 403);
    }
    const body = await c.req.json();
    if (!body.config) return c.json({ error: "config alanı zorunlu." }, 400);
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set("ai_role_config_v1", body.config);
    console.log(`AI role-config güncellendi: ${callerRole} — ${user.user_metadata?.full_name}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("AI role-config POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// USERS: Kullanıcı sil + KV temizliği
// DELETE /make-server-4da0b637/users/:userId
// Sıralama: 1) KV temizle → 2) Auth'tan sil
// ──────────────────────────────────────────
app.delete("/make-server-4da0b637/users/:userId", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);

    const callerRole = callerUser.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Kullanıcı silme yetkisi yalnızca Yönetici ve Üst Müdür rolüne aittir." }, 403);
    }

    const { userId } = c.req.param();

    if (userId === callerUser.id) {
      return c.json({ error: "Kendinizi silemezsiniz." }, 400);
    }

    const supabase = getAdminClient();

    const { data: targetData } = await supabase.auth.admin.getUserById(userId);
    if (!targetData?.user) return c.json({ error: "Kullanıcı bulunamadı." }, 404);

    // ── Multi-tenant güvenlik: farklı şirketteki kullanıcı silinemez ──
    const callerCompanyId = getCompanyId(callerUser);
    const targetCompanyId = getCompanyId(targetData.user);
    if (targetCompanyId !== callerCompanyId) {
      console.log(`[userDelete] Şirket uyuşmazlığı: ${callerCompanyId} → ${targetCompanyId}`);
      return c.json({ error: "Bu kullanıcı başka bir şirkete ait." }, 403);
    }

    const targetRole = targetData.user.user_metadata?.role ?? "bekleyen";
    const hierarchy: Record<string, number> = {
      yonetici: 6, "ust-mudur": 5, mudur: 4, operasyon: 3, idari: 2, personel: 1, bekleyen: 0,
    };
    if (callerRole !== "yonetici" && hierarchy[targetRole] >= hierarchy[callerRole]) {
      return c.json({ error: "Kendi seviyenizde veya üzerindeki kullanıcıları silemezsiniz." }, 403);
    }

    const targetName = targetData.user.user_metadata?.full_name || targetData.user.email || userId;
    let kvTemizlendi = 0;
    const ckv = companyKvFor(callerCompanyId);

    // ── 1. rotation_task_* — personeli görevden çıkar ──
    // Tek kişilik görev → tamamen sil | Çok kişilik → sadece bu kişiyi çıkar
    try {
      const tasks = await ckv.getByPrefix("rotation_task_");
      for (const task of (tasks || [])) {
        if (!task.id) continue;
        const personnel: any[] = Array.isArray(task.personnel) ? task.personnel : [];
        const buKisiVar = personnel.some((p: any) => p.id === userId);
        if (!buKisiVar) continue;

        if (personnel.length <= 1) {
          await ckv.del(`rotation_task_${task.id}`);
          kvTemizlendi++;
          console.log(`[userDelete] rotation_task_${task.id} silindi (tek kişilik görev)`);
        } else {
          const yeniPersonnel = personnel.filter((p: any) => p.id !== userId);
          await ckv.set(`rotation_task_${task.id}`, { ...task, personnel: yeniPersonnel });
          kvTemizlendi++;
          console.log(`[userDelete] rotation_task_${task.id} güncellendi (${personnel.length} → ${yeniPersonnel.length} kişi)`);
        }
      }
    } catch (e) {
      console.log("[userDelete] rotation_task temizlik hatası:", e);
    }

    // ── 2. rotation_leave_* — bu kullanıcının izin talepleri ──
    try {
      const leaves = await ckv.getByPrefix("rotation_leave_");
      for (const leave of (leaves || [])) {
        if (leave.personnelId === userId || leave.staffId === userId || leave.created_by === userId) {
          await ckv.del(`rotation_leave_${leave.id}`);
          kvTemizlendi++;
          console.log(`[userDelete] rotation_leave_${leave.id} silindi`);
        }
      }
    } catch (e) {
      console.log("[userDelete] rotation_leave temizlik hatası:", e);
    }

    // ── 3. rotation_daily_onleave — tarih bazlı listeden userId çıkar ──
    try {
      const dailyOnLeave = await ckv.get("rotation_daily_onleave");
      if (dailyOnLeave && typeof dailyOnLeave === "object") {
        let degisti = false;
        for (const tarih of Object.keys(dailyOnLeave)) {
          const arr: string[] = dailyOnLeave[tarih];
          if (Array.isArray(arr) && arr.includes(userId)) {
            dailyOnLeave[tarih] = arr.filter((id: string) => id !== userId);
            degisti = true;
          }
        }
        if (degisti) {
          await ckv.set("rotation_daily_onleave", dailyOnLeave);
          console.log(`[userDelete] rotation_daily_onleave güncellendi`);
          kvTemizlendi++;
        }
      }
    } catch (e) {
      console.log("[userDelete] rotation_daily_onleave temizlik hatası:", e);
    }

    // ── 4. bday_privacy_ — doğum günü gizlilik kaydını sil ──
    try {
      await ckv.del(`bday_privacy_${userId}`);
      console.log(`[userDelete] bday_privacy_${userId} silindi`);
    } catch (e) {
      console.log("[userDelete] bday_privacy temizlik hatası:", e);
    }

    // ── 5. Supabase Auth'tan kullanıcıyı sil ──
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.log("[userDelete] Auth silme hatası:", deleteError.message);
      return c.json({ error: `Kullanıcı Auth'tan silinemedi: ${deleteError.message}` }, 500);
    }

    console.log(`[userDelete] ${targetName} (${userId}) silindi. KV temizlendi: ${kvTemizlendi} kayıt. Silen: ${callerUser.id}`);
    return c.json({
      message: `"${targetName}" kullanıcısı ve ilgili ${kvTemizlendi} KV kaydı başarıyla silindi.`,
      kvTemizlendi,
    });
  } catch (err) {
    console.log("Delete user unexpected error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// MESAJLAŞMA SİSTEMİ
// KV yapısı:
//   chat_msgs_{channelId}   → { messages: Message[], lastUpdated: string }
//   chat_dm_{uid1}_{uid2}   → { messages: Message[], lastUpdated: string }
//   chat_read_{userId}      → Record<channelId, ISO string>
//   chat_dm_list_{userId}   → string[]  (DM yaptığı userId listesi)
// ══════════════════════════════════════════════════════════════════

const MAX_MSGS = 100;

function sortedDmKey(a: string, b: string) {
  return a < b ? `chat_dm_${a}_${b}` : `chat_dm_${b}_${a}`;
}

// ── GET /mesajlar/kanallar — kanal listesi ──
// Mekan kanalları: sadece yonetici + ust-mudur
// Özel kanallar  : tüm aktif roller
app.get("/make-server-4da0b637/mesajlar/kanallar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const canSeeMekan = ["yonetici", "ust-mudur", "superadmin"].includes(role);
    const isSAMesaj = user.user_metadata?.originalRole === "superadmin";
    const reqCIdMesaj = c.req.query("company_id");
    const companyId = (isSAMesaj && reqCIdMesaj) ? reqCIdMesaj : getCompanyId(user);

    const STATIC_CHANNELS = [
      { id: "general",  name: "general",  type: "channel", isAdminOnly: false, deletable: false },
      { id: "rotasyon", name: "rotasyon", type: "channel", isAdminOnly: false, deletable: false },
    ];

    // Mekan kanalları — sadece yonetici + ust-mudur + superadmin, kendi şirketine göre
    let mekanChannels: any[] = [];
    if (canSeeMekan) {
      const mekanlar: any[] = await getMekanlarFor(companyId);
      mekanChannels = mekanlar.map((m: any) => ({
        id: `mekan_${m.id}`, name: m.name, type: "project", emoji: m.emoji || "📍",
        isAdminOnly: true, deletable: false,
      }));
    }

    // Özel kanallar — tüm aktif roller görebilir
    const ckv = companyKvFor(companyId);
    const customs: any[] = await ckv.getByPrefix("chat_channel_") || [];
    const customChannels = customs.map((ch: any) => ({
      id: ch.id, name: ch.name, type: "channel", emoji: ch.emoji || "💬",
      isAdminOnly: false, deletable: true, createdBy: ch.createdBy,
    }));

    const allChannels = [...STATIC_CHANNELS, ...mekanChannels, ...customChannels];
    const readMap: Record<string, string> = await ckv.get(`chat_read_${user.id}`) || {};

    const channelsWithMeta = await Promise.all(allChannels.map(async (ch) => {
      const data: any = await ckv.get(`chat_msgs_${ch.id}`) || { messages: [] };
      const msgs: any[] = data.messages || [];
      const lastMsg = msgs[msgs.length - 1];
      const lastReadTime = readMap[ch.id] ? new Date(readMap[ch.id]).getTime() : 0;
      const unread = msgs.filter((m: any) =>
        new Date(m.timestamp).getTime() > lastReadTime && m.senderId !== user.id
      ).length;
      return { ...ch, lastMessage: lastMsg?.content || "", lastMessageTime: lastMsg?.timestamp || null, unread };
    }));

    return c.json({ channels: channelsWithMeta });
  } catch (err) {
    console.log("GET mesajlar/kanallar error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── POST /mesajlar/ozel-kanal — yeni özel kanal oluştur (yonetici + ust-mudur) ──
app.post("/make-server-4da0b637/mesajlar/ozel-kanal", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) {
      return c.json({ error: "Kanal oluşturma yetkisi yalnızca Yönetici ve Üst Müdür rolüne aittir." }, 403);
    }
    const { name, emoji } = await c.req.json();
    if (!name?.trim()) return c.json({ error: "Kanal adı zorunludur." }, 400);

    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const channel = {
      id, name: name.trim(), emoji: emoji || "💬",
      createdBy: user.user_metadata?.full_name || user.email || "Bilinmeyen",
      createdById: user.id,
      createdAt: new Date().toISOString(),
    };
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`chat_channel_${id}`, channel);
    pgWrite("chat_channels", "insert", { id, company_id: getCompanyId(user), name: name.trim(), type: "custom", extra_data: channel });
    console.log(`Yeni özel kanal: ${name} by ${user.id}`);
    return c.json({ channel }, 201);
  } catch (err) {
    console.log("POST mesajlar/ozel-kanal error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── DELETE /mesajlar/ozel-kanal/:channelId — özel kanalı sil (yonetici + ust-mudur) ──
app.delete("/make-server-4da0b637/mesajlar/ozel-kanal/:channelId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) {
      return c.json({ error: "Kanal silme yetkisi yalnızca Yönetici ve Üst Müdür rolüne aittir." }, 403);
    }
    const { channelId } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`chat_channel_${channelId}`);
    await ckv.del(`chat_msgs_${channelId}`);
    console.log(`Özel kanal silindi: ${channelId} by ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log("DELETE mesajlar/ozel-kanal error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── GET /mesajlar/kanallar/:channelId — mesajları getir ──
app.get("/make-server-4da0b637/mesajlar/kanallar/:channelId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const { channelId } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const data: any = await ckv.get(`chat_msgs_${channelId}`) || { messages: [] };
    const readMap: Record<string, string> = await ckv.get(`chat_read_${user.id}`) || {};
    readMap[channelId] = new Date().toISOString();
    await ckv.set(`chat_read_${user.id}`, readMap);
    return c.json({ messages: data.messages || [] });
  } catch (err) {
    console.log("GET mesajlar/kanallar/:id error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── POST /mesajlar/kanallar/:channelId — mesaj gönder ──
app.post("/make-server-4da0b637/mesajlar/kanallar/:channelId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const { channelId } = c.req.param();
    const { content } = await c.req.json();
    if (!content?.trim()) return c.json({ error: "Mesaj boş olamaz." }, 400);
    if (channelId.startsWith("mekan_")) return c.json({ error: "Mekan kanalları salt okunurdur." }, 403);

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const msg = {
      id,
      senderId: user.id,
      senderName: user.user_metadata?.full_name || user.email || "Bilinmeyen",
      senderRole: user.user_metadata?.role || "personel",
      content: content.trim(),
      timestamp: new Date().toISOString(),
      channelId,
    };

    const ckv = companyKvFor(getCompanyId(user));
    const data: any = await ckv.get(`chat_msgs_${channelId}`) || { messages: [] };
    const messages = [...(data.messages || []), msg].slice(-MAX_MSGS);
    await ckv.set(`chat_msgs_${channelId}`, { messages, lastUpdated: new Date().toISOString() });
    pgWrite("chat_messages", "insert", { channel_id: channelId, sender_id: user.id, sender_name: msg.senderName, content: msg.content, timestamp: msg.timestamp });
    console.log(`Mesaj: ${user.user_metadata?.full_name} → #${channelId}`);
    return c.json({ message: msg }, 201);
  } catch (err) {
    console.log("POST mesajlar/kanallar/:id error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── GET /mesajlar/kullanicilar — DM için kullanıcı listesi ──
app.get("/make-server-4da0b637/mesajlar/kullanicilar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const isSAMesajU = user.user_metadata?.originalRole === "superadmin";
    const reqCIdMesajU = c.req.query("company_id");
    const filterCompanyId = (isSAMesajU && reqCIdMesajU) ? reqCIdMesajU : getCompanyId(user);
    const supabase = getAdminClient();
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 500 });
    if (error) return c.json({ error: `Kullanıcılar alınamadı: ${error.message}` }, 400);
    const list = users
      .filter((u: any) => u.id !== user.id && u.user_metadata?.role !== "bekleyen" && u.user_metadata?.company_id === filterCompanyId)
      .map((u: any) => ({
        id: u.id,
        name: u.user_metadata?.full_name || u.email || "Bilinmeyen",
        role: u.user_metadata?.role || "personel",
        avatar: u.user_metadata?.avatar || "",
      }));
    return c.json({ users: list });
  } catch (err) {
    console.log("GET mesajlar/kullanicilar error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── GET /mesajlar/dm-list — aktif DM konuşmalarını listele ──
app.get("/make-server-4da0b637/mesajlar/dm-list", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const ckv = companyKvFor(getCompanyId(user));
    const dmListKey = `chat_dm_list_${user.id}`;
    const dmList: string[] = await ckv.get(dmListKey) || [];

    const supabase = getAdminClient();
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 500 });
    const userMap: Record<string, any> = {};
    for (const u of (users || [])) userMap[u.id] = u;

    const readMap: Record<string, string> = await ckv.get(`chat_read_${user.id}`) || {};

    const conversations = await Promise.all(dmList.map(async (otherUserId: string) => {
      const other = userMap[otherUserId];
      if (!other) return null;
      const dmKey = sortedDmKey(user.id, otherUserId);
      const data: any = await ckv.get(dmKey) || { messages: [] };
      const msgs: any[] = data.messages || [];
      const lastMsg = msgs[msgs.length - 1];
      const lastReadTime = readMap[`dm_${otherUserId}`]
        ? new Date(readMap[`dm_${otherUserId}`]).getTime() : 0;
      const unread = msgs.filter((m: any) =>
        new Date(m.timestamp).getTime() > lastReadTime && m.senderId !== user.id
      ).length;
      return {
        userId: otherUserId,
        name: other.user_metadata?.full_name || other.email || "Bilinmeyen",
        role: other.user_metadata?.role || "personel",
        avatar: other.user_metadata?.avatar || "",
        lastMessage: lastMsg?.content || "",
        lastMessageTime: lastMsg?.timestamp || null,
        unread,
      };
    }));

    return c.json({ conversations: conversations.filter(Boolean) });
  } catch (err) {
    console.log("GET mesajlar/dm-list error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── GET /mesajlar/dm/:otherUserId — DM mesajlarını getir ──
app.get("/make-server-4da0b637/mesajlar/dm/:otherUserId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const { otherUserId } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const dmKey = sortedDmKey(user.id, otherUserId);
    const data: any = await ckv.get(dmKey) || { messages: [] };
    const readMap: Record<string, string> = await ckv.get(`chat_read_${user.id}`) || {};
    readMap[`dm_${otherUserId}`] = new Date().toISOString();
    await ckv.set(`chat_read_${user.id}`, readMap);
    return c.json({ messages: data.messages || [] });
  } catch (err) {
    console.log("GET mesajlar/dm/:id error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── POST /mesajlar/dm/:otherUserId — DM gönder ──
app.post("/make-server-4da0b637/mesajlar/dm/:otherUserId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const { otherUserId } = c.req.param();
    const { content } = await c.req.json();
    if (!content?.trim()) return c.json({ error: "Mesaj boş olamaz." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const dmKey = sortedDmKey(user.id, otherUserId);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const msg = {
      id,
      senderId: user.id,
      senderName: user.user_metadata?.full_name || user.email || "Bilinmeyen",
      senderRole: user.user_metadata?.role || "personel",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    const data: any = await ckv.get(dmKey) || { messages: [] };
    const messages = [...(data.messages || []), msg].slice(-MAX_MSGS);
    await ckv.set(dmKey, { messages, lastUpdated: new Date().toISOString() });

    // Her iki kullanıcının DM listesine ekle
    for (const [meId, themId] of [[user.id, otherUserId], [otherUserId, user.id]]) {
      const listKey = `chat_dm_list_${meId}`;
      const list: string[] = await ckv.get(listKey) || [];
      if (!list.includes(themId)) await ckv.set(listKey, [...list, themId]);
    }

    console.log(`DM: ${user.user_metadata?.full_name} → ${otherUserId}`);
    return c.json({ message: msg }, 201);
  } catch (err) {
    console.log("POST mesajlar/dm/:id error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// LEADERBOARD: Performans Sıralaması
// GET /make-server-4da0b637/leaderboard/performans
// Query: ?baslangic=YYYY-MM-DD&bitis=YYYY-MM-DD&mekanId=(optional)
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/leaderboard/performans", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const baslangic = c.req.query("baslangic") || "";
    const bitis = c.req.query("bitis") || "";
    const mekanIdFilter = c.req.query("mekanId") || "";
    const periodKey = c.req.query("periodKey") || "";

    // ── 1. Mekanlar ──
    const isSALeader = user.user_metadata?.originalRole === "superadmin";
    const reqCIdLeader = c.req.query("company_id");
    const effCIdLeader = (isSALeader && reqCIdLeader) ? reqCIdLeader : getCompanyId(user);
    const mekanlarList: any[] = await getMekanlarFor(effCIdLeader);
    const mekanById: Record<string, any> = {};
    for (const m of mekanlarList) mekanById[m.id] = m;

    // ── 2. Stok kayıtları filtrele ──
    const ckv = companyKvFor(effCIdLeader);
    const tumKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
    const filtrelenmis = tumKayitlar.filter((k: any) => {
      if (!k.tarih) return false;
      if (baslangic && k.tarih < baslangic) return false;
      if (bitis && k.tarih > bitis) return false;
      if (mekanIdFilter && k.mekanId !== mekanIdFilter) return false;
      return true;
    });

    // ── 2b. Leaderboard config KV'den oku ──
    const lbConfig: any = await ckv.get("leaderboard_config_v1") || null;
    const W_ISKONTO = lbConfig?.iskontoPuan ?? 0.25;
    const W_ORTSATIS = lbConfig?.ortSatisPuan ?? 0.15;
    const W_MEKANKATKI = lbConfig?.mekanKatkiPuan ?? 0.30;
    const W_ANOMALI = lbConfig?.anomaliPuan ?? 0.20;
    const W_DEVAMSIZLIK = lbConfig?.devamsizlikPuan ?? 0.10;
    const W_MEKAN_CIRO = lbConfig?.mekanKatkiCiroAgirlik ?? 0.65;
    const W_MEKAN_KARE = lbConfig?.mekanKatkiKareAgirlik ?? 0.35;

    // ── 3. Personel satış aggregation ──
    const personMap: Record<string, any> = {};
    const mekanTotalCiro: Record<string, number> = {};
    const mekanTotalKare: Record<string, number> = {};

    for (const kayit of filtrelenmis) {
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const mekanId = kayit.mekanId;
      if (!mekanTotalCiro[mekanId]) mekanTotalCiro[mekanId] = 0;

      const zorlukK = Number(mekanById[mekanId]?.zorlukKatsayisi) || 1.0;

      for (const satis of satislar) {
        const hamTutar = Number(satis.finalPrice) || 0;
        const tutar = hamTutar * zorlukK; // Zorluk katsayısı uygulanmış ciro
        const brut = (Number(satis.totalPrice) || hamTutar) * zorlukK;
        const iskonto = Number(satis.discount) || 0;
        const pid = satis.kaydedenId || satis.kaydeden || "bilinmeyen";
        const pad = satis.kaydeden || "Bilinmiyor";

        mekanTotalCiro[mekanId] += tutar;

        if (!personMap[pid]) {
          personMap[pid] = {
            id: pid, ad: pad, avatar: "👤",
            ciro: 0, brutCiro: 0, iskonto: 0, satisAdet: 0,
            ciroByMekan: {} as Record<string, number>,
            kareByMekan: {} as Record<string, number>,
            toplamKare: 0,
          };
        }
        personMap[pid].ciro += tutar;
        personMap[pid].brutCiro += brut;
        personMap[pid].iskonto += iskonto;
        personMap[pid].satisAdet++;
        if (!personMap[pid].ciroByMekan[mekanId]) personMap[pid].ciroByMekan[mekanId] = 0;
        personMap[pid].ciroByMekan[mekanId] += tutar;
      }

      // ── Kare kayıtları aggregation ──
      if (!mekanTotalKare[mekanId]) mekanTotalKare[mekanId] = 0;
      for (const kare of (kayit.kareKayitlari || [])) {
        const pid = kare.photographerId;
        if (!pid) continue;
        if (!personMap[pid]) {
          personMap[pid] = {
            id: pid, ad: kare.photographerName || "Bilinmiyor", avatar: "👤",
            ciro: 0, brutCiro: 0, iskonto: 0, satisAdet: 0,
            ciroByMekan: {} as Record<string, number>,
            kareByMekan: {} as Record<string, number>,
            toplamKare: 0,
          };
        }
        const kareVal = Math.round((Number(kare.frameCount) || 0) * zorlukK);
        personMap[pid].toplamKare += kareVal;
        if (!personMap[pid].kareByMekan[mekanId]) personMap[pid].kareByMekan[mekanId] = 0;
        personMap[pid].kareByMekan[mekanId] += kareVal;
        mekanTotalKare[mekanId] += kareVal;
      }
    }

    // ── 3b. Supabase user_metadata'dan güncel avatar ve isim çek ──
    try {
      const sb = getAdminClient();
      const { data: { users: allUsers } } = await sb.auth.admin.listUsers({ perPage: 1000 });
      for (const u of (allUsers || [])) {
        const pid = u.id;
        if (!personMap[pid]) continue;
        const meta = u.user_metadata || {};
        if (meta.avatar) personMap[pid].avatar = meta.avatar;
        if (meta.full_name && personMap[pid].ad === "Bilinmiyor") personMap[pid].ad = meta.full_name;
      }
    } catch (avatarErr) {
      console.log("Leaderboard avatar enrich error (non-fatal):", avatarErr);
    }

    // ── 4. Rotasyon görevleri: vardiya sayısı + avatar güncelleme ──
    const allTasks: any[] = await ckv.getByPrefix("rotation_task_") || [];
    const taskMap: Record<string, any[]> = {};
    const personVardiya: Record<string, Set<string>> = {};

    for (const t of allTasks) {
      if (!t.date || !t.location || t.status === "cancelled") continue;
      if (baslangic && t.date < baslangic) continue;
      if (bitis && t.date > bitis) continue;

      const key = `${t.date}__${t.location}`;
      if (!taskMap[key]) taskMap[key] = [];

      for (const p of (t.personnel || [])) {
        if (!p?.id) continue;
        if (!taskMap[key].find((x: any) => x.id === p.id)) taskMap[key].push(p);
        if (!personVardiya[p.id]) personVardiya[p.id] = new Set();
        personVardiya[p.id].add(t.date);
        if (personMap[p.id]) {
          personMap[p.id].avatar = p.avatar || "👤";
          if (personMap[p.id].ad === "Bilinmiyor" && p.name) personMap[p.id].ad = p.name;
        }
      }
    }

    // ── 5. Anomali vardiya sayısı per person ──
    const prevDay = (tarih: string): string => {
      const d = new Date(tarih + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().split("T")[0];
    };

    const personAnomalSet: Record<string, Set<string>> = {};

    for (const kayit of filtrelenmis) {
      const mekan = mekanById[kayit.mekanId] || {};
      const mekanAdi = mekan.name || "";

      if (kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0) {
        const taskKey = `${prevDay(kayit.tarih)}__${mekanAdi}`;
        for (const p of (taskMap[taskKey] || [])) {
          if (!personAnomalSet[p.id]) personAnomalSet[p.id] = new Set();
          personAnomalSet[p.id].add(`${kayit.tarih}__acilis__${kayit.mekanId}`);
        }
      }

      if (kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0) {
        const taskKey = `${kayit.tarih}__${mekanAdi}`;
        for (const p of (taskMap[taskKey] || [])) {
          if (!personAnomalSet[p.id]) personAnomalSet[p.id] = new Set();
          personAnomalSet[p.id].add(`${kayit.tarih}__kapanis__${kayit.mekanId}`);
        }
      }
    }

    // ── 5b. Devamsızlık: checkin verilerinden geç giriş ──
    const allCheckins: any[] = await ckv.getByPrefix("checkin_").catch(() => []) || [];
    const personGecGiris: Record<string, number> = {}; // userId → geç giriş sayısı
    for (const ci of allCheckins) {
      if (!ci?.userId || !(ci.lateMin > 0) || !ci.tarih) continue;
      if (baslangic && ci.tarih < baslangic) continue;
      if (bitis && ci.tarih > bitis) continue;
      personGecGiris[ci.userId] = (personGecGiris[ci.userId] || 0) + 1;
    }

    // ── 6. Ham metrikler ──
    const liste: any[] = Object.values(personMap).filter((p: any) => p.satisAdet > 0 || p.toplamKare > 0);

    for (const p of liste) {
      p.ortSatis = p.satisAdet > 0 ? p.ciro / p.satisAdet : 0;
      p.iskontoDisipling = p.brutCiro > 0 ? 1 - (p.iskonto / p.brutCiro) : 1;

      // Mekan Katkısı: ciro payı × W_MEKAN_CIRO + kare payı × W_MEKAN_KARE
      let ciroKatki = 0;
      if (p.ciro > 0) {
        for (const [mid, pciro] of Object.entries(p.ciroByMekan as Record<string, number>)) {
          const mtotal = mekanTotalCiro[mid] || 1;
          ciroKatki += (pciro / mtotal) * (pciro / p.ciro);
        }
      }
      let kareKatki = 0;
      if (p.toplamKare > 0) {
        for (const [mid, pkare] of Object.entries(p.kareByMekan as Record<string, number>)) {
          const mtotal = mekanTotalKare[mid] || 1;
          kareKatki += (pkare / mtotal) * (pkare / p.toplamKare);
        }
      }
      p.mekanKatki = ciroKatki * W_MEKAN_CIRO + kareKatki * W_MEKAN_KARE;

      p.anomaliVardiya = personAnomalSet[p.id]?.size || 0;
      p.toplamVardiya = personVardiya[p.id]?.size || 0;
      p.anomaliOran = p.toplamVardiya > 0 ? p.anomaliVardiya / p.toplamVardiya : 0;
      p.anomaliTemizligi = 1 - p.anomaliOran;

      // Devamsızlık
      p.gecGirisSayisi = personGecGiris[p.id] || 0;
      p.devamsizlik = p.toplamVardiya > 0 ? 1 - (p.gecGirisSayisi / p.toplamVardiya) : 1;

      // Satış yapıp yapmadığı flag
      p._satisBased = p.satisAdet > 0;
    }

    // ── 7. Normalizasyon (0–100) ──
    const normalize = (arr: any[], srcKey: string, dstKey: string) => {
      if (arr.length === 0) return;
      const vals = arr.map(p => p[srcKey]);
      const mn = Math.min(...vals);
      const mx = Math.max(...vals);
      for (const p of arr) {
        const raw = mx === mn ? 0.7 : (p[srcKey] - mn) / (mx - mn);
        p[dstKey] = Math.round(raw * 100);
      }
    };

    normalize(liste, "iskontoDisipling", "iskontoPuan");
    normalize(liste, "ortSatis", "ortSatisPuan");
    normalize(liste, "mekanKatki", "mekanKatkiPuan");
    normalize(liste, "anomaliTemizligi", "anomaliPuan");
    normalize(liste, "devamsizlik", "devamsizlikPuan");

    // ── 8. Ağırlıklı toplam skor (config'den veya varsayılan) ──
    for (const p of liste) {
      // Satış yapmayan personelde iskonto/ort.satış atlanır, kalan oranlanır
      let w_iskonto = W_ISKONTO;
      let w_ortSatis = W_ORTSATIS;
      let w_mekanKatki = W_MEKANKATKI;
      let w_anomali = W_ANOMALI;
      let w_devamsizlik = W_DEVAMSIZLIK;

      if (!p._satisBased) {
        // Satış metrikleri atla, kalanı oranla
        const kalanToplam = w_mekanKatki + w_anomali + w_devamsizlik;
        if (kalanToplam > 0) {
          const oran = 1.0 / kalanToplam;
          w_mekanKatki *= oran;
          w_anomali *= oran;
          w_devamsizlik *= oran;
        }
        w_iskonto = 0;
        w_ortSatis = 0;
      }

      p.toplamSkor = Math.round(
        (p.iskontoPuan     || 0) * w_iskonto +
        (p.ortSatisPuan    || 0) * w_ortSatis +
        (p.mekanKatkiPuan  || 0) * w_mekanKatki +
        (p.anomaliPuan     || 0) * w_anomali +
        (p.devamsizlikPuan || 0) * w_devamsizlik
      );
    }

    liste.sort((a: any, b: any) => b.toplamSkor - a.toplamSkor);
    liste.forEach((p: any, i: number) => { p.sira = i + 1; });

    const result = liste.map((p: any) => ({
      id:         p.id,
      ad:         p.ad,
      avatar:     p.avatar,
      sira:       p.sira,
      toplamSkor: p.toplamSkor,
      metrikler: {
        iskontoPuan:    p.iskontoPuan    || 0,
        ortSatisPuan:   p.ortSatisPuan   || 0,
        mekanKatkiPuan: p.mekanKatkiPuan || 0,
        anomaliPuan:    p.anomaliPuan    || 0,
        devamsizlikPuan: p.devamsizlikPuan || 0,
      },
      ham: {
        ciro:           Math.round(p.ciro),
        satisAdet:      p.satisAdet,
        iskonto:        Math.round(p.iskonto),
        brutCiro:       Math.round(p.brutCiro),
        ortSatis:       Math.round(p.ortSatis),
        anomaliVardiya: p.anomaliVardiya,
        toplamVardiya:  p.toplamVardiya,
        toplamKare:     p.toplamKare || 0,
        gecGirisSayisi: p.gecGirisSayisi || 0,
      },
      config: {
        iskonto: W_ISKONTO, ortSatis: W_ORTSATIS, mekanKatki: W_MEKANKATKI,
        anomali: W_ANOMALI, devamsizlik: W_DEVAMSIZLIK,
        mekanCiro: W_MEKAN_CIRO, mekanKare: W_MEKAN_KARE,
      },
    }));

    // ── 7. Podyum quote'ları: top3'ü çek, top3 dışındakileri sil ──
    const quotesMap: Record<string, string> = {};
    if (periodKey) {
      const top3Ids = new Set(result.slice(0, 3).map((p: any) => p.id));
      const allQuotes: any[] = await ckv.getByPrefix("podium_quote_") || [];
      for (const q of allQuotes) {
        if (q._periodKey !== periodKey) continue;
        if (!top3Ids.has(q.userId)) {
          // Top3 dışına düştü — quote'u sil
          await ckv.del(`podium_quote_${q.userId}_${periodKey}`);
        } else if (q.quote) {
          quotesMap[q.userId] = q.quote;
        }
      }
    }

    console.log(`Leaderboard: ${baslangic}–${bitis} → ${result.length} personel`);
    return c.json({
      personeller: result,
      mekanlar: mekanlarList.map((m: any) => ({ id: m.id, name: m.name, emoji: m.emoji || "📍" })),
      donem: { baslangic, bitis },
      quotes: quotesMap,
    });
  } catch (err) {
    console.log("Leaderboard performans error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// LEADERBOARD QUOTES: Podyum mesajı kaydet
// PUT /make-server-4da0b637/leaderboard/quotes
// Body: { periodKey, quote }
// ────────────────────────────────────────────────��─────────────
app.put("/make-server-4da0b637/leaderboard/quotes", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { periodKey, quote } = await c.req.json();
    if (!periodKey || typeof periodKey !== "string") return c.json({ error: "periodKey gerekli." }, 400);
    if (typeof quote !== "string" || quote.length > 120) return c.json({ error: "Mesaj en fazla 120 karakter olmalı." }, 400);

    const trimmed = quote.trim();
    const ckv = companyKvFor(getCompanyId(user));
    if (!trimmed) {
      // Boş mesaj → sil
      await ckv.del(`podium_quote_${user.id}_${periodKey}`);
      return c.json({ ok: true, deleted: true });
    }

    await ckv.set(`podium_quote_${user.id}_${periodKey}`, {
      userId: user.id,
      _periodKey: periodKey,
      quote: trimmed,
      ad: user.user_metadata?.full_name || user.email || "",
      updatedAt: new Date().toISOString(),
    });

    console.log(`Podium quote saved: ${user.id} | ${periodKey} | "${trimmed}"`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Leaderboard quotes PUT error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// LEADERBOARD CONFIG: Ayarları getir / kaydet
// ──────────────────────────────────────────────────────────────
app.get("/make-server-4da0b637/leaderboard/config", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(role)) return c.json({ error: "Yetki yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));
    const config = await ckv.get("leaderboard_config_v1");
    const defaults = {
      iskontoPuan: 0.25, ortSatisPuan: 0.15, mekanKatkiPuan: 0.30,
      anomaliPuan: 0.20, devamsizlikPuan: 0.10,
      mekanKatkiCiroAgirlik: 0.65, mekanKatkiKareAgirlik: 0.35,
    };
    return c.json({ config: config || defaults, isDefault: !config });
  } catch (err) {
    console.log("Leaderboard config GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.put("/make-server-4da0b637/leaderboard/config", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role;
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici bu ayarları değiştirebilir." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));
    const body = await c.req.json();
    const { iskontoPuan, ortSatisPuan, mekanKatkiPuan, anomaliPuan, devamsizlikPuan, mekanKatkiCiroAgirlik, mekanKatkiKareAgirlik } = body;
    // Toplam %100 validasyonu
    const toplam = (Number(iskontoPuan) || 0) + (Number(ortSatisPuan) || 0) + (Number(mekanKatkiPuan) || 0) + (Number(anomaliPuan) || 0) + (Number(devamsizlikPuan) || 0);
    if (Math.abs(toplam - 1.0) > 0.01) return c.json({ error: `Ağırlıklar toplamı %100 olmalı (şu an: %${Math.round(toplam * 100)}).` }, 400);
    const config = {
      iskontoPuan: Number(iskontoPuan) || 0,
      ortSatisPuan: Number(ortSatisPuan) || 0,
      mekanKatkiPuan: Number(mekanKatkiPuan) || 0,
      anomaliPuan: Number(anomaliPuan) || 0,
      devamsizlikPuan: Number(devamsizlikPuan) || 0,
      mekanKatkiCiroAgirlik: Number(mekanKatkiCiroAgirlik) || 0.65,
      mekanKatkiKareAgirlik: Number(mekanKatkiKareAgirlik) || 0.35,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };
    await ckv.set("leaderboard_config_v1", config);
    console.log(`[Leaderboard Config] Güncellendi by ${user.id}:`, JSON.stringify(config));
    return c.json({ ok: true, config });
  } catch (err) {
    console.log("Leaderboard config PUT error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// HEDEF TAKİP — GET /make-server-4da0b637/hedef-takip
// Her mekan için yıllık kar hedefi, gelir-gider detayları, aylık grafik, en iyi/kötü günler
// Auth: sadece yonetici
// ──────────────────────────────────────────────────────────────
app.get("/make-server-4da0b637/hedef-takip", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) return c.json({ error: "Bu sayfa yalnızca yönetici ve üst müdüre açıktır." }, 403);

    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const effCId = (isSA && reqCId) ? reqCId : getCompanyId(user);
    const ckv = companyKvFor(effCId);

    const today = bizDateTR();
    const qYil = c.req.query("yil");
    const buYil = qYil && /^\d{4}$/.test(qYil) ? qYil : today.slice(0, 4); // query param veya bu yıl

    // Otomatik günlük gider oluşturma (sadece bu yıl için)
    if (buYil === today.slice(0, 4)) await ensureOtomatikGiderler(effCId);

    // Paralel veri çekimi
    const [mekanlarList, tumKayitlarRaw, costAlbumsRaw, exRatesRaw, tumGiderlerRaw, tumGelirlerRaw] = await Promise.all([
      getMekanlarFor(effCId),
      ckv.getByPrefix("stok_gunluk_").catch(() => []),
      ckv.get("cost_albums").catch(() => null),
      ckv.get("cost_exchange_rates").catch(() => null),
      ckv.getByPrefix("isletme_gider_").catch(() => []),
      ckv.getByPrefix("isletme_gelir_").catch(() => []),
    ]);
    const tumKayitlar = tumKayitlarRaw || [];

    // isletme_gelir_ kayıtlarından bu yılın gelirlerini mekan bazlı topla
    const yilGelirleri = (tumGelirlerRaw || []).filter((g: any) => g.date && g.date.startsWith(buYil));
    // Mekan bazlı gelir toplamı
    const gelirByMekanId: Record<string, number> = {};
    // Aylık gelir toplamı (mekan bazlı)
    const gelirAylikByMekanId: Record<string, Record<string, number>> = {};
    // Genel aylık gelir
    const gelirAylikGenel: Record<string, number> = {};
    let toplamEkGelir = 0;
    for (const g of yilGelirleri) {
      const tutar = Number(g.amount) || 0;
      const mekanId = g.mekanId || "";
      const ayKey = (g.date || "").slice(0, 7);
      toplamEkGelir += tutar;
      if (mekanId) {
        gelirByMekanId[mekanId] = (gelirByMekanId[mekanId] || 0) + tutar;
        if (!gelirAylikByMekanId[mekanId]) gelirAylikByMekanId[mekanId] = {};
        gelirAylikByMekanId[mekanId][ayKey] = (gelirAylikByMekanId[mekanId][ayKey] || 0) + tutar;
      }
      if (ayKey) gelirAylikGenel[ayKey] = (gelirAylikGenel[ayKey] || 0) + tutar;
    }

    const albums: any[] = costAlbumsRaw || [];
    const exRates: any = exRatesRaw || { EUR: 38, USD: 33, GBP: 41.20 };
    const toTL = (v: number, cur: string) =>
      cur === "EUR" ? v * (Number(exRates.EUR) || 38) :
      cur === "USD" ? v * (Number(exRates.USD) || 33) :
      cur === "GBP" ? v * (Number(exRates.GBP) || 41.2) : v;

    // isletme_gider_ kayıtlarından bu yılın giderlerini kategori bazlı topla
    const yilGiderleri = (tumGiderlerRaw || []).filter((g: any) => g.date && g.date.startsWith(buYil));
    const giderByKategori: Record<string, number> = {};
    for (const g of yilGiderleri) {
      const tutar = Number(g.amount) || 0;
      const kat = g.category || "diger";
      giderByKategori[kat] = (giderByKategori[kat] || 0) + tutar;
    }
    // Kategori toplamlarını yuvarla
    for (const k of Object.keys(giderByKategori)) {
      giderByKategori[k] = Math.round(giderByKategori[k]);
    }
    const toplamGiderTutar = Object.values(giderByKategori).reduce((s, v) => s + v, 0);

    // Mekan bazlı gider toplamı (isletme_gider_'den mekanId eşleşmesi)
    const giderByMekanId: Record<string, number> = {};
    const giderAylikByMekanId: Record<string, Record<string, number>> = {};
    // Mekan bazlı gider kategori kırılımı
    const giderKategoriByMekanId: Record<string, Record<string, number>> = {};
    for (const g of yilGiderleri) {
      const mekanId = g.mekanId || "";
      if (!mekanId) continue;
      const tutar = Number(g.amount) || 0;
      const ayKey = (g.date || "").slice(0, 7);
      giderByMekanId[mekanId] = (giderByMekanId[mekanId] || 0) + tutar;
      if (!giderAylikByMekanId[mekanId]) giderAylikByMekanId[mekanId] = {};
      if (ayKey) giderAylikByMekanId[mekanId][ayKey] = (giderAylikByMekanId[mekanId][ayKey] || 0) + tutar;
      // Kategori kırılımı
      const kat = g.category || "diger";
      if (!giderKategoriByMekanId[mekanId]) giderKategoriByMekanId[mekanId] = {};
      giderKategoriByMekanId[mekanId][kat] = (giderKategoriByMekanId[mekanId][kat] || 0) + tutar;
    }

    // Albüm birim maliyeti: size → TL
    const albumBirimMaliyet = (size: number, printType: string): number => {
      const al = albums.find((a: any) => Number(a.size) === size);
      if (!al) return 0;
      const birim = printType === "tam" ? Number(al.tamBoy) : Number(al.yarimBoy);
      return toTL(birim, al.currency || "TRY");
    };

    // Maaş: userId → aylık maaş TL (cost_salary_'den) — günlüğe çevirme tarihe göre yapılır
    const maaslarRaw: any[] = await ckv.getByPrefix("cost_salary_").catch(() => []) || [];
    const aylikMaasById_ay: Record<string, number> = {};
    for (const m of maaslarRaw) {
      if (!m.userId) continue;
      const amt = toTL(Number(m.amount) || 0, m.currency || "TRY");
      const extra = amt * ((Number(m.extraCostPercentage) || 0) / 100);
      const total = amt + extra;
      const aylik = m.frequency === "daily" ? total * 30 : m.frequency === "weekly" ? total * 4.33 : m.frequency === "yearly" ? total / 12 : total;
      aylikMaasById_ay[m.userId] = aylik;
    }
    // Tarihe göre günlük maaş hesaplayan helper
    const getGunlukMaas = (userId: string, tarih: string): number => {
      const aylik = aylikMaasById_ay[userId];
      if (!aylik) return 0;
      const d = new Date(tarih + "T00:00:00Z");
      const ayGun = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      return Math.round(aylik / ayGun);
    };

    // Mekan bazlı prim (isletme_gider_'den mekanAdi eşleşmesi)
    const mekanlarListForPrim = mekanlarList;
    const primByMekanAdi: Record<string, number> = {};
    for (const g of yilGiderleri) {
      if (g.category === "personel" && g.odemeTipi === "prim" && g.mekanAdi) {
        primByMekanAdi[g.mekanAdi] = (primByMekanAdi[g.mekanAdi] || 0) + (Number(g.amount) || 0);
      }
    }

    // Tarih → personelId → kaç mekanda çalıştı haritası (maaş bölüştürme için)
    const gunPersonelMekan: Record<string, Record<string, number>> = {};
    for (const k of (tumKayitlarRaw || [])) {
      if (!k.tarih || !k.satislar) continue;
      if (!gunPersonelMekan[k.tarih]) gunPersonelMekan[k.tarih] = {};
      const pIds = new Set<string>();
      for (const s of (k.satislar || [])) { if (s.kaydedenId) pIds.add(s.kaydedenId); if (s.satisciId) pIds.add(s.satisciId); }
      for (const kk of (k.kareKayitlari || [])) { if (kk.photographerId) pIds.add(kk.photographerId); }
      for (const pid of pIds) {
        gunPersonelMekan[k.tarih][pid] = (gunPersonelMekan[k.tarih][pid] || 0) + 1;
      }
    }

    // Bu yılın kayıtlarını filtrele
    const yilKayitlar = (tumKayitlar || []).filter((k: any) => k.tarih && k.tarih.startsWith(buYil));

    const hesaplaMekan = (mekan: any, mekanKayitlar: any[]) => {
      // Yıl bazlı kira ve hedef: yearlyRents/profitTargets map'inden al, yoksa varsayılan
      const yearlyRent = Number(mekan.yearlyRents?.[buYil]) || Number(mekan.yearlyRent) || 0;
      const profitTarget = Number(mekan.profitTargets?.[buYil]) || Number(mekan.profitTarget) || (
        mekan.profitPercentage ? Math.round(yearlyRent * (Number(mekan.profitPercentage) / 100)) : 0
      );
      const printType: string = mekan.printType || "yarim";

      // Aylık kırılım
      const aylarMap: Record<string, { ciro: number; baskiMaliyet: number; albumMaliyet: number; maas: number; prim: number }> = {};
      // Günlük ciro listesi (en iyi/kötü 5)
      const gunlukCiroList: Array<{ tarih: string; ciro: number }> = [];

      for (const kayit of mekanKayitlar) {
        const ayKey = kayit.tarih.slice(0, 7); // "2026-03"
        if (!aylarMap[ayKey]) aylarMap[ayKey] = { ciro: 0, baskiMaliyet: 0, albumMaliyet: 0, maas: 0, prim: 0 };
        const ay = aylarMap[ayKey];

        // Ciro
        const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
        const gunCiro = satislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0);
        ay.ciro += gunCiro;
        if (gunCiro > 0) gunlukCiroList.push({ tarih: kayit.tarih, ciro: Math.round(gunCiro) });

        // Baskı maliyeti
        if (kayit.vardiyaToplam) {
          ay.baskiMaliyet += Number(kayit.vardiyaToplam.toplamMaliyet) || 0;
        }

        // Albüm maliyeti (satış item'larından)
        for (const satis of satislar) {
          for (const item of (satis.items || [])) {
            const match = String(item.product || "").match(/^(\d+)/);
            if (match) {
              const size = parseInt(match[1]);
              const adet = Number(item.quantity) || 1;
              ay.albumMaliyet += adet * albumBirimMaliyet(size, printType);
            }
          }
        }

        // Personel maaş (o gün çalışan personelden — mekan sayısına bölünür)
        const personelIds = new Set<string>();
        for (const s of satislar) { if (s.kaydedenId) personelIds.add(s.kaydedenId); }
        for (const k of (kayit.kareKayitlari || [])) { if (k.photographerId) personelIds.add(k.photographerId); }
        for (const pid of personelIds) {
          const mekanSayisi = gunPersonelMekan[kayit.tarih]?.[pid] || 1;
          ay.maas += getGunlukMaas(pid, kayit.tarih) / mekanSayisi;
        }
      }

      // Primler — mekan bazlı (isletme_gider_'den mekanAdi eşleşmesi)
      const mekanPrim = Math.round(primByMekanAdi[mekan.name] || 0);

      // Aylık diziyi oluştur (Ocak-Aralık)
      const aylarDizi = [];
      for (let m = 1; m <= 12; m++) {
        const ayKey = `${buYil}-${String(m).padStart(2, "0")}`;
        const d = aylarMap[ayKey] || { ciro: 0, baskiMaliyet: 0, albumMaliyet: 0, maas: 0, prim: 0 };
        aylarDizi.push({
          ay: ayKey,
          ciro: Math.round(d.ciro),
          baskiMaliyet: Math.round(d.baskiMaliyet),
          albumMaliyet: Math.round(d.albumMaliyet),
          maas: Math.round(d.maas),
          prim: 0, // aylık kırılım yok, toplam yıllıkta
        });
      }

      // Ek gelir (isletme_gelir_'den mekan bazlı) — aylık kırılıma ekle
      const mekanGelirAylik = gelirAylikByMekanId[mekan.id] || {};
      for (let m = 0; m < 12; m++) {
        const ayKey = `${buYil}-${String(m + 1).padStart(2, "0")}`;
        const ekGelir = Math.round(mekanGelirAylik[ayKey] || 0);
        if (ekGelir > 0) aylarDizi[m].ciro += ekGelir;
      }

      // Toplamlar
      const toplamCiro = aylarDizi.reduce((s, a) => s + a.ciro, 0);
      const toplamBaskiMaliyet = aylarDizi.reduce((s, a) => s + a.baskiMaliyet, 0);
      const toplamAlbumMaliyet = aylarDizi.reduce((s, a) => s + a.albumMaliyet, 0);
      const toplamMaas = aylarDizi.reduce((s, a) => s + a.maas, 0);
      const toplamPrim = Math.round(mekanPrim);
      const toplamEkGelirMekan = Math.round(gelirByMekanId[mekan.id] || 0);
      const toplamEkGiderMekan = Math.round(giderByMekanId[mekan.id] || 0);
      const toplamGider = toplamBaskiMaliyet + toplamAlbumMaliyet + toplamMaas + toplamPrim + toplamEkGiderMekan;
      const netKar = toplamCiro - toplamGider; // kira hariç
      const netKarKiraDahil = toplamCiro - toplamGider - yearlyRent; // kira dahil

      // En iyi / en kötü 5 gün
      const sirali = [...gunlukCiroList].sort((a, b) => b.ciro - a.ciro);
      const enIyi5 = sirali.slice(0, 5);
      const enKotu5 = sirali.filter(g => g.ciro > 0).reverse().slice(0, 5);

      return {
        id: mekan.id,
        name: mekan.name,
        emoji: mekan.emoji || "📍",
        color: mekan.color || "#9dd9ea",
        yearlyRent,
        profitTarget,
        aylar: aylarDizi,
        enIyi5,
        enKotu5,
        toplamCiro,
        toplamBaskiMaliyet: Math.round(toplamBaskiMaliyet),
        toplamAlbumMaliyet: Math.round(toplamAlbumMaliyet),
        toplamMaas,
        toplamPrim,
        toplamEkGelir: toplamEkGelirMekan,
        toplamEkGider: toplamEkGiderMekan,
        ekGiderByKategori: giderKategoriByMekanId[mekan.id] || {},
        toplamGider: Math.round(toplamGider),
        netKar: Math.round(netKar),
        netKarKiraDahil: Math.round(netKarKiraDahil),
      };
    };

    // Mekan bazlı hesapla
    const mekanSonuclar = mekanlarList.map((mekan: any) => {
      const mekanKayitlar = yilKayitlar.filter((k: any) => k.mekanId === mekan.id);
      return hesaplaMekan(mekan, mekanKayitlar);
    });

    // Genel toplam
    const genelYearlyRent = mekanSonuclar.reduce((s: number, m: any) => s + m.yearlyRent, 0);
    const genelProfitTarget = mekanSonuclar.reduce((s: number, m: any) => s + m.profitTarget, 0);

    // Aylık gider toplamı (isletme_gider_'den)
    const aylikGiderMap: Record<string, number> = {};
    for (const g of yilGiderleri) {
      const ayKey = (g.date || "").slice(0, 7);
      if (!ayKey) continue;
      aylikGiderMap[ayKey] = (aylikGiderMap[ayKey] || 0) + (Number(g.amount) || 0);
    }

    const genelAylar = Array.from({ length: 12 }, (_, i) => {
      const ayKey = `${buYil}-${String(i + 1).padStart(2, "0")}`;
      const mekanCiroToplam = mekanSonuclar.reduce((s: number, m: any) => s + m.aylar[i].ciro, 0);
      // Mekan'a atanmamış gelirler (mekanId boş olanlar) genel toplama eklenir
      const mekanAtanmamisGelir = Math.round((gelirAylikGenel[ayKey] || 0) -
        mekanSonuclar.reduce((s: number, m: any) => {
          const mg = gelirAylikByMekanId[m.id] || {};
          return s + (mg[ayKey] || 0);
        }, 0));
      return {
        ay: ayKey,
        ciro: mekanCiroToplam + Math.max(0, mekanAtanmamisGelir),
        gider: Math.round(aylikGiderMap[ayKey] || 0),
        baskiMaliyet: mekanSonuclar.reduce((s: number, m: any) => s + m.aylar[i].baskiMaliyet, 0),
        albumMaliyet: mekanSonuclar.reduce((s: number, m: any) => s + m.aylar[i].albumMaliyet, 0),
        maas: mekanSonuclar.reduce((s: number, m: any) => s + m.aylar[i].maas, 0),
        prim: 0,
      };
    });
    // Genel en iyi/kötü 5
    const tumGunler: Array<{ tarih: string; ciro: number }> = [];
    for (const m of mekanSonuclar) {
      for (const k of yilKayitlar.filter((k: any) => k.mekanId === m.id)) {
        const satislar = (k.satislar || []).filter((s: any) => !s.iptal);
        const c = satislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0);
        if (c > 0) {
          const existing = tumGunler.find(g => g.tarih === k.tarih);
          if (existing) existing.ciro += c;
          else tumGunler.push({ tarih: k.tarih, ciro: Math.round(c) });
        }
      }
    }
    const genelSirali = [...tumGunler].sort((a, b) => b.ciro - a.ciro);

    const genel = {
      yearlyRent: genelYearlyRent,
      profitTarget: genelProfitTarget,
      aylar: genelAylar,
      enIyi5: genelSirali.slice(0, 5),
      enKotu5: genelSirali.filter(g => g.ciro > 0).reverse().slice(0, 5),
      toplamCiro: mekanSonuclar.reduce((s: number, m: any) => s + m.toplamCiro, 0),
      toplamEkGelir: Math.round(toplamEkGelir),
      toplamBaskiMaliyet: mekanSonuclar.reduce((s: number, m: any) => s + m.toplamBaskiMaliyet, 0),
      toplamAlbumMaliyet: mekanSonuclar.reduce((s: number, m: any) => s + m.toplamAlbumMaliyet, 0),
      giderByKategori,
      toplamGider: toplamGiderTutar,
      netKar: mekanSonuclar.reduce((s: number, m: any) => s + m.toplamCiro, 0) - toplamGiderTutar,
      netKarKiraDahil: mekanSonuclar.reduce((s: number, m: any) => s + m.toplamCiro, 0) - toplamGiderTutar - genelYearlyRent,
    };

    console.log(`Hedef takip: ${mekanSonuclar.length} mekan, genel ciro: ₺${genel.toplamCiro}`);
    return c.json({ tarih: today, yil: buYil, genel, mekanlar: mekanSonuclar });
  } catch (err) {
    console.log("Hedef takip error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// VARDİYA RAPORLARI — GET /make-server-4da0b637/vardiya/raporlar
// Query: baslangic, bitis, mekanId  |  Auth: yonetici/ust-mudur/mudur
// ──────────────────────────────────────────────────────────────
app.get("/make-server-4da0b637/vardiya/raporlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erisim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "Bu raporu yalnizca yoneticiler gorebilir." }, 403);
    }

    const qBaslangic = c.req.query("baslangic") || "";
    const qBitis    = c.req.query("bitis") || "";
    const qMekanId  = c.req.query("mekanId") || "";

    const isSAVardiya = user.user_metadata?.originalRole === "superadmin";
    const reqCIdVardiya = c.req.query("company_id");
    const effCIdVardiya = (isSAVardiya && reqCIdVardiya) ? reqCIdVardiya : getCompanyId(user);

    const ckv = companyKvFor(effCIdVardiya);
    const [tumKayitlarRaw, mekanlarList, costAlbumsRaw, exRatesRaw, maaslarRaw, tumRotasyonlarVR, hakedisDahilRawVR, tumCheckinsVR, kidemPersonelRawVR, kidemCarpanlarRawVR] = await Promise.all([
      ckv.getByPrefix("stok_gunluk_"),
      getMekanlarFor(effCIdVardiya),
      ckv.get("cost_albums"),
      ckv.get("cost_exchange_rates"),
      ckv.getByPrefix("cost_salary_"),
      ckv.getByPrefix("rotation_task_").catch(() => []),
      ckv.get(HAKEDIS_DAHIL_KEY).catch(() => []),
      ckv.getByPrefix("checkin_").catch(() => []),
      ckv.getByPrefix("kidem_personel_").catch(() => []),
      ckv.get("kidem_carpanlari").catch(() => null),
    ]);
    const hakedisDahilSetVR = new Set<string>(hakedisDahilRawVR || []);

    // Kıdem verileri (hakediş çarpanı için)
    const kidemMapVR: Record<string, string> = {};
    for (const kp of (kidemPersonelRawVR || [])) {
      if (kp.key && kp.value) {
        const uid = kp.key.replace("kidem_personel_", "");
        kidemMapVR[uid] = String(kp.value);
      }
    }
    const defaultCarpanlarVR: Record<string, number> = { kidemsiz: 1.0, kidemli: 1.0, kidemliPlus: 1.0 };
    const carpanlarVR: Record<string, number> = kidemCarpanlarRawVR
      ? { ...defaultCarpanlarVR, ...(typeof kidemCarpanlarRawVR === 'object' ? kidemCarpanlarRawVR : {}) }
      : defaultCarpanlarVR;

    // Geç giriş: tarih_mekanAdi → sayı
    const gecGirisByTarihMekan: Record<string, number> = {};
    for (const ci of (tumCheckinsVR || [])) {
      if (!ci?.tarih || !(ci.lateMin > 0) || !ci.location) continue;
      const key = `${ci.tarih}_${ci.location}`;
      gecGirisByTarihMekan[key] = (gecGirisByTarihMekan[key] || 0) + 1;
    }

    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) mekanMap[m.id] = m;

    const albums: any[] = costAlbumsRaw || [
      { size: 3,  tamBoy: 25, yarimBoy: 20, currency: "TRY" },
      { size: 5,  tamBoy: 35, yarimBoy: 28, currency: "TRY" },
      { size: 7,  tamBoy: 45, yarimBoy: 36, currency: "TRY" },
      { size: 9,  tamBoy: 55, yarimBoy: 44, currency: "TRY" },
      { size: 11, tamBoy: 65, yarimBoy: 52, currency: "TRY" },
      { size: 13, tamBoy: 75, yarimBoy: 60, currency: "TRY" },
      { size: 15, tamBoy: 85, yarimBoy: 68, currency: "TRY" },
    ];

    const exRates: any = exRatesRaw || { EUR: 38, USD: 33, GBP: 41.20 };
    const EUR_KR = Number(exRates.EUR) || 38;
    const USD_KR = Number(exRates.USD) || 33;
    const GBP_KR = Number(exRates.GBP) || 41.20;

    const toTL2 = (v: number, cur: string) =>
      cur === "EUR" ? v * EUR_KR : cur === "USD" ? v * USD_KR : cur === "GBP" ? v * GBP_KR : v;

    const sizeFromName = (n: string): number | null => {
      const mm = String(n || "").match(/^(\d+)/);
      return mm ? parseInt(mm[1]) : null;
    };

    // Maaş yardımcıları
    const maaslar: any[] = maaslarRaw || [];
    // userId → aylık maaş (TRY) haritası
    const aylikMaasByIdVR: Record<string, number> = {};
    for (const m of maaslar) {
      if (!m.userId) continue;
      const amt = toTL2(Number(m.amount) || 0, m.currency || "TRY");
      const extra = amt * ((Number(m.extraCostPercentage) || 0) / 100);
      const total = amt + extra;
      const aylik = m.frequency === "daily" ? total * 30 : m.frequency === "weekly" ? total * 4.33 : m.frequency === "yearly" ? total / 12 : total;
      aylikMaasByIdVR[m.userId] = Math.round(aylik);
    }
    // Günlük maaş: gunlukMaasForVR kullanılıyor (aşağıda tanımlı)

    // gunPersonelMekan zaten yukarıda tanımlı (hesaplaMekan'dan önce)

    const isFotoPaspartu = (n: string): boolean => {
      const lc = String(n || "").toLowerCase();
      return lc.includes("paspartu") || lc === "1 fotograf" || lc.startsWith("1 ");
    };

    const fmtSaat = (iso?: string): string => {
      if (!iso) return "";
      try { return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }); }
      catch { return ""; }
    };

    const stokSum = (obj: any): number => {
      if (!obj) return 0;
      let toplam = 0;
      for (const s of [3, 5, 7, 9, 11, 13, 15]) {
        toplam += (Number(obj[`album${s}`]) || 0) + (Number(obj[`album${s}_tam`]) || 0) + (Number(obj[`album${s}_yarim`]) || 0);
      }
      toplam += Number(obj.paspartu) || 0;
      return toplam;
    };

    // Personel maaş: tarih bazlı günlük hesaplama (ayın gün sayısına göre)
    const gunlukMaasForVR = (userId: string, tarih: string): number => {
      const aylik = aylikMaasByIdVR[userId] || 0;
      if (aylik <= 0) return 0;
      const ayIdx = parseInt(tarih.slice(5, 7));
      const yilNum = parseInt(tarih.slice(0, 4));
      const ayGunSayisi = new Date(yilNum, ayIdx, 0).getDate();
      return Math.round(aylik / ayGunSayisi);
    };

    // Personel gün-mekan haritası (maaş bölüştürme için)
    const gunPersonelMekanVR: Record<string, Record<string, number>> = {};
    for (const k of (tumKayitlarRaw || [])) {
      if (!k.tarih || !k.satislar) continue;
      if (!gunPersonelMekanVR[k.tarih]) gunPersonelMekanVR[k.tarih] = {};
      const pIds = new Set<string>();
      for (const s of (k.satislar || [])) { if (s.kaydedenId) pIds.add(s.kaydedenId); }
      for (const kk of (k.kareKayitlari || [])) { if (kk.photographerId) pIds.add(kk.photographerId); }
      for (const pid of pIds) {
        gunPersonelMekanVR[k.tarih][pid] = (gunPersonelMekanVR[k.tarih][pid] || 0) + 1;
      }
    }

    const filtrelenmis: any[] = (tumKayitlarRaw || [])
      .filter((k: any) => {
        if (!k.kapanisYapildi) return false;
        if (!k.tarih) return false;
        if (qBaslangic && k.tarih < qBaslangic) return false;
        if (qBitis && k.tarih > qBitis) return false;
        if (qMekanId && k.mekanId !== qMekanId) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));

    const raporlar = filtrelenmis.filter((kayit: any) => mekanMap[kayit.mekanId]).map((kayit: any) => {
      const mekan = mekanMap[kayit.mekanId];
      const printType: string = mekan.printType || "yarim";

      const satislar: any[] = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const iptalSatislar: any[] = (kayit.satislar || []).filter((s: any) => s.iptal);

      // ── Personel dökümü ──
      const pMap: Record<string, any> = {};
      for (const satis of satislar) {
        const pid = satis.kaydedenId || satis.kaydeden || "bilinmeyen";
        if (!pMap[pid]) pMap[pid] = { id: pid, ad: satis.kaydeden || "Bilinmiyor", avatar: "👤", kare: 0, nakitTL: 0, ibanTL: 0, krediTL: 0, urunler: {} };
        const tutar = Number(satis.finalPrice) || 0;
        const pm = String(satis.paymentMethod || "").toLowerCase();
        if (pm.includes("iban") || pm.includes("havale") || pm.includes("transfer")) pMap[pid].ibanTL += tutar;
        else if (pm.includes("kredi") || pm.includes("kart") || pm.includes("card")) pMap[pid].krediTL += tutar;
        else pMap[pid].nakitTL += tutar;
        for (const item of (satis.items || [])) {
          const ua = (item.dijital ? '📱 ' : '') + (item.product || "Diger");
          const qty = Number(item.quantity) || 1;
          const biTL = Number(item.unitPrice) || 0;
          if (!pMap[pid].urunler[ua]) pMap[pid].urunler[ua] = { adet: 0, toplamTL: 0 };
          pMap[pid].urunler[ua].adet += qty;
          pMap[pid].urunler[ua].toplamTL += biTL * qty;
        }
      }
      for (const kk of (kayit.kareKayitlari || [])) {
        const pid = kk.photographerId;
        if (!pid) continue;
        if (!pMap[pid]) pMap[pid] = { id: pid, ad: kk.photographerName || "Bilinmiyor", avatar: "👤", kare: 0, nakitTL: 0, ibanTL: 0, krediTL: 0, urunler: {} };
        pMap[pid].kare += Number(kk.frameCount) || 0;
        if (kk.photographerName && pMap[pid].ad === "Bilinmiyor") pMap[pid].ad = kk.photographerName;
      }

      const personeller = Object.values(pMap).map((p: any) => ({
        id: p.id, ad: p.ad, avatar: p.avatar, kare: p.kare,
        nakitTL: Math.round(p.nakitTL), ibanTL: Math.round(p.ibanTL), krediTL: Math.round(p.krediTL),
        toplamTL: Math.round(p.nakitTL + p.ibanTL + p.krediTL),
        satirlar: Object.entries(p.urunler)
          .map(([urun, v]: [string, any]) => ({ urun, adet: v.adet, toplamTL: Math.round(v.toplamTL) }))
          .sort((a: any, b: any) => b.toplamTL - a.toplamTL),
      }));

      const yazicilar = (kayit.printerData || []).map((pr: any) => {
        const baslangic = Number(pr.baslangicSayac ?? pr.startCounter) || 0;
        const bitis = Number(pr.bitisSayac ?? pr.endCounter) || 0;
        const ribonDegisim = Number(pr.ribonDegisim) || 0;
        const iadeFotograf = Number(pr.iadeFotograf) || 0;
        const kullanilanBaski = Number(pr["kullanilanBaskı"] ?? pr.kullanilanBaski) || 0;
        const cikisAdedi = Number(pr.cikisAdedi) || 0;
        const satilanFotograf = Number(pr["satılanFotograf"] ?? pr.satilanFotograf) || 0;
        return {
          ad: pr.ad || pr.label || "Yazici",
          serialNumber: pr.serialNumber || "",
          baslangic,
          bitis,
          ribonDegisim,
          iadeFotograf,
          kullanilanBaski,
          cikisAdedi,
          satilanFotograf,
          kagitTipiAdi: pr.kagitTipiAdi || null,
          kapasitePerTakim: pr.kapasitePerTakim || 0,
          birimMaliyet: pr.birimMaliyet || 0,
          yaziciMaliyet: pr.toplamMaliyet || 0,
        };
      });

      // Kağıt tipi ID → ad eşleştirmesi (anomali açıklamalarında kullanılır)
      const kagitTipiAdMap: Record<string, string> = {};
      for (const pr of (kayit.printerData || [])) {
        if (pr.kagitTipiId && pr.kagitTipiAdi) kagitTipiAdMap[pr.kagitTipiId] = pr.kagitTipiAdi;
      }
      const anomDetayStrVR = (detay: Record<string, any>, tip: string): string => {
        return Object.entries(detay).map(([k, v]) => {
          const val = Number(v);
          const farkStr = val > 0 ? `${val} fazla` : `${Math.abs(val)} eksik`;
          if (k.startsWith("ribonlar.")) {
            const tipId = k.replace("ribonlar.", "");
            const ad = kagitTipiAdMap[tipId];
            return `${tip === "acilis" ? "Acilista" : "Kapanista"} ${farkStr} takim sayildi${ad ? ` (${ad} kagidi)` : ""}`;
          }
          if (k.startsWith("album")) return `${k.replace("album", "")} Fotograf albumu: ${farkStr}`;
          if (k === "paspartu") return `Paspartu: ${farkStr}`;
          return `${k}: ${val > 0 ? "+" : ""}${val}`;
        }).join(", ");
      };

      const anomaliler: any[] = [];
      const acA = kayit.acilisAnomali || {};
      if (Object.keys(acA).length > 0) {
        anomaliler.push({ tip: "stok", aciklama: anomDetayStrVR(acA, "acilis") });
      }
      const kpA = kayit.kapanisAnomali || {};
      if (Object.keys(kpA).length > 0) {
        anomaliler.push({ tip: "stok", aciklama: anomDetayStrVR(kpA, "kapanis") });
      }
      if (kayit.kapanisYaziciAnomali) {
        const fark = kayit.kapanisYaziciAnomali.fark;
        anomaliler.push({ tip: "yazici", aciklama: `Yazici net basilan ile satis farki: ${fark > 0 ? "+" : ""}${fark} kare` });
      }
      for (const an of (kayit.acilisYaziciAnomali || [])) {
        anomaliler.push({ tip: "yazici", aciklama: `${an.label || "Yazici"}: beklenen ${an.beklenenCounter}, girilen ${an.startCounter} (fark: ${an.fark > 0 ? "+" : ""}${an.fark})` });
      }

      const albumler: Record<string, number> = {};
      for (const satis of satislar) {
        for (const item of (satis.items || [])) {
          const ua = item.product || "Diger";
          if (isFotoPaspartu(ua)) continue;
          albumler[ua] = (albumler[ua] || 0) + (Number(item.quantity) || 1);
        }
      }

      let albumMaliyeti = 0;
      for (const [ua, adet] of Object.entries(albumler)) {
        const sz = sizeFromName(ua);
        if (!sz) continue;
        const al = albums.find((a: any) => Number(a.size) === sz);
        if (!al) continue;
        const birim = printType === "tam" ? Number(al.tamBoy) : Number(al.yarimBoy);
        albumMaliyeti += (adet as number) * toTL2(birim, al.currency || "TRY");
      }

      let baskiMaliyeti = 0;
      let baskiPaperName: string | null = null;
      if (kayit.vardiyaToplam) {
        const vt = kayit.vardiyaToplam;
        baskiPaperName = vt.paperName || null;
        const pCur: string = vt.paperCurrency || vt.currency || "TRY";
        const kurUygulanmis = !!vt.kurCarpani && vt.kurCarpani !== 1;
        baskiMaliyeti = (pCur !== "TRY" && !kurUygulanmis)
          ? parseFloat((Number(vt.toplamMaliyet) * toTL2(1, pCur)).toFixed(2))
          : Number(vt.toplamMaliyet) || 0;
      }

      const toplamCiro = personeller.reduce((s, p) => s + p.toplamTL, 0);
      const toplamIskonto = satislar.reduce((s: number, sat: any) => s + (Number(sat.discount) || 0), 0);

      // Personel günlük maaş hesabı + kişi bazlı hakediş + geç giriş
      // hakedisDahilSetVR zaten üstte tanımlı
      // Geç giriş: bu tarih + bu mekan için checkin kayıtları
      const gecGirisPersonelMapVR: Record<string, number> = {};
      for (const ci of (tumCheckinsVR || [])) {
        if (ci?.tarih === kayit.tarih && ci.location === (mekan.name || '') && ci.lateMin > 0 && ci.userId) {
          gecGirisPersonelMapVR[ci.userId] = ci.lateMin;
        }
      }
      const personellerWithMaas = personeller.map((p: any) => {
        const mekanSayisi = gunPersonelMekanVR[kayit.tarih]?.[p.id] || 1;
        const gunlukMaas = gunlukMaasForVR(p.id, kayit.tarih) ? Math.round(gunlukMaasForVR(p.id, kayit.tarih) / mekanSayisi) : 0;
        const hakedisDahil = hakedisDahilSetVR.has(p.id);
        const gecGiris = !!gecGirisPersonelMapVR[p.id];
        const gecGirisDk = gecGirisPersonelMapVR[p.id] || 0;
        return { ...p, gunlukMaas, hakedisDahil, gecGiris, gecGirisDk };
      });
      const personelMaasGideri = personellerWithMaas.reduce((s: number, p: any) => s + p.gunlukMaas, 0);

      return {
        id: `${kayit.mekanId}_${kayit.tarih}`,
        mekanId: kayit.mekanId,
        mekan: mekan.name || kayit.mekanId,
        mekanEmoji: mekan.emoji || "📍",
        mekanColor: mekan.color || "#9dd9ea",
        tarih: kayit.tarih,
        acilisSaat: fmtSaat(kayit.acilisZamani),
        kapanisSaat: fmtSaat(kayit.kapanisZamani),
        printType: printType as "tam" | "yarim",
        personeller: personellerWithMaas,
        yazicilar,
        anomaliler,
        acilisNot: kayit.acilisNot || "",
        kapanisNot: kayit.kapanisNot || "",
        albumler,
        toplamKare: Number(kayit.vardiyaToplam?.toplamKullanilanBaskI) || Number(kayit.vardiyaToplam?.toplamKullanilanBaskı) || 0,
        toplamIade: iptalSatislar.length,
        stokBaslangic: stokSum(kayit.acilis),
        stokBitis: stokSum(kayit.kapanish),
        toplamIskonto: Math.round(toplamIskonto),
        toplamCiro: Math.round(toplamCiro),
        nakitToplamTL: Math.round(personeller.reduce((s, p) => s + p.nakitTL, 0)),
        ibanToplamTL: Math.round(personeller.reduce((s, p) => s + p.ibanTL, 0)),
        krediToplamTL: Math.round(personeller.reduce((s, p) => s + p.krediTL, 0)),
        albumMaliyeti: Math.round(albumMaliyeti),
        baskiMaliyeti: Math.round(baskiMaliyeti),
        gecGirisSayisi: gecGirisByTarihMekan[`${kayit.tarih}_${mekan.name}`] || 0,
        personelMaasGideri: Math.round(personelMaasGideri),
        baskiPaperName,
        kotaKademeleri: mekan.kotaKademeleri || [],
        mekanGunlukKira: Math.round((Number(mekan.yearlyRents?.[kayit.tarih?.slice(0, 4)]) || Number(mekan.yearlyRent) || 0) / 365),
        primBilgi: (() => {
          const kkList: any[] = mekan.kotaKademeleri || [];
          if (kkList.length === 0) return null;
          // Rotasyon personelini kullan — ust-mudur ve yonetici hakediş hesabına dahil değil
          const mekanAdiPB = mekan.name || "";
          const rotPers: Array<{id: string; gorev?: string}> = [];
          const seenPB = new Set<string>();
          for (const task of (tumRotasyonlarVR || []).filter((t: any) =>
            t.date === kayit.tarih && ["sent","revised"].includes(t.status || "") && t.location === mekanAdiPB && Array.isArray(t.personnel)
          )) {
            for (const p of task.personnel) {
              if (p.id && p.name && !seenPB.has(p.id) && hakedisDahilSetVR.has(p.id)) {
                seenPB.add(p.id);
                rotPers.push({ id: p.id, gorev: p.gorev });
              }
            }
          }
          // Rotasyon bulunamazsa fallback: kare kayıtlarından (eski davranış)
          if (rotPers.length === 0) {
            const fotografcilar = new Set((kayit.kareKayitlari || []).map((k: any) => k.photographerName).filter(Boolean));
            const personelSayisi = fotografcilar.size || personeller.length || 1;
            const coklu = personelSayisi > 1;
            const gecilenKademeler = kkList.map((k: any, i: number) => ({ ...k, index: i })).filter((k: any) => Math.round(toplamCiro) >= k.hedef);
            if (gecilenKademeler.length === 0) return null;
            const topKademe = gecilenKademeler[gecilenKademeler.length - 1];
            const toplamPrimTutar = gecilenKademeler.reduce((s: number, k: any) => s + ((coklu ? k.primCoklu : k.primTek) || 0), 0);
            return { kademeIndex: topKademe.index, kademeHedef: topKademe.hedef, topKademePrim: (coklu ? topKademe.primCoklu : topKademe.primTek) || 0, toplamPrim: toplamPrimTutar, toplamKademe: gecilenKademeler.length, personelSayisi, coklu };
          }
          const personelSayisi = rotPers.length;
          const soloMu = personelSayisi === 1 && !rotPers[0].gorev;
          // Görev bazlı kişi sayıları (bantlı sistem)
          const gorevSayilariVR: Record<string, number> = {};
          for (const per of rotPers) {
            const g = per.gorev || 'fotograf-satis';
            gorevSayilariVR[g] = (gorevSayilariVR[g] || 0) + 1;
          }
          const gecilenKademeler = kkList.map((k: any, i: number) => ({ ...k, index: i })).filter((k: any) => Math.round(toplamCiro) >= k.hedef);
          if (gecilenKademeler.length === 0) return null;
          const topKademe = gecilenKademeler[gecilenKademeler.length - 1];
          // Bantlı hakediş hesaplama helper
          const getVRHakedis = (kademe: any, gorev: string | undefined, solo: boolean): number => {
            if (solo) return Number(kademe.primTek) || 0;
            const g = gorev || 'fotograf-satis';
            const gorevKisiSayisi = gorevSayilariVR[g] || 1;
            const bantKey = g === 'baski' ? 'baskiBantlar' : g === 'album' ? 'albumBantlar' : g === 'gozlemci' ? 'gozlemciBantlar' : 'fotografBantlar';
            const bantlar: any[] = kademe[bantKey];
            if (bantlar && Array.isArray(bantlar) && bantlar.length > 0) {
              const bant = bantlar.find((b: any) => gorevKisiSayisi >= Number(b.min) && gorevKisiSayisi <= Number(b.max));
              return bant ? Number(bant.tutar) || 0 : 0;
            }
            // Geriye uyumluluk
            if (g === 'baski') return Number(kademe.primBaski) || Number(kademe.primCoklu) || 0;
            if (g === 'album') return Number(kademe.primAlbum) || Number(kademe.primCoklu) || 0;
            if (g === 'gozlemci') return Number(kademe.primGozlemci) || 0;
            return Number(kademe.primFotograf) || Number(kademe.primCoklu) || 0;
          };
          // Toplam hakediş: her personel × her kademe × kıdem çarpanı
          let toplamPrimTutar = 0;
          for (const kademe of gecilenKademeler) {
            for (const per of rotPers) {
              const baseTutar = getVRHakedis(kademe, per.gorev, soloMu);
              const kidemSeviye = kidemMapVR[per.id] || 'kidemsiz';
              const kidemCarpan = Number(carpanlarVR[kidemSeviye]) ?? 1.0;
              toplamPrimTutar += Math.round(baseTutar * kidemCarpan);
            }
          }
          // topKademePrim: kişi başı ortalama (UI'da gösterim)
          const topKademePerPersonel = Math.round(toplamPrimTutar > 0 && gecilenKademeler.length > 0
            ? rotPers.reduce((s, p) => {
                const bt = getVRHakedis(topKademe, p.gorev, soloMu);
                const ks = kidemMapVR[p.id] || 'kidemsiz';
                const kc = Number(carpanlarVR[ks]) ?? 1.0;
                return s + Math.round(bt * kc);
              }, 0) / personelSayisi
            : 0);
          return {
            kademeIndex: topKademe.index,
            kademeHedef: topKademe.hedef,
            topKademePrim: topKademePerPersonel,
            toplamPrim: toplamPrimTutar,
            toplamKademe: gecilenKademeler.length,
            personelSayisi,
            coklu: !soloMu,
          };
        })(),
      };
    });

    console.log(`Vardiya raporlar: ${raporlar.length} kayit | ${qBaslangic||"*"}-${qBitis||"*"} mekan:${qMekanId||"tumu"}`);
    return c.json({ raporlar, toplam: raporlar.length });
  } catch (err) {
    console.log("Vardiya raporlar error:", err);
    return c.json({ error: `Sunucu hatasi: ${err}` }, 500);
  }
});

// ───────────────────────────────────────────────��──────────────
// VARDİYA SİL — DELETE /make-server-4da0b637/vardiya/sil
// Body: { mekanId, tarih }  |  Auth: yalnizca yonetici
// ──────────────────────────────────────────────────────────────
app.delete("/make-server-4da0b637/vardiya/sil", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erisim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Vardiyi yalnizca yonetici silebilir." }, 403);
    }

    const body = await c.req.json().catch(() => null);
    const { mekanId, tarih } = body || {};
    if (!mekanId || !tarih) {
      return c.json({ error: "mekanId ve tarih zorunludur." }, 400);
    }

    const kvKey = `stok_gunluk_${mekanId}_${tarih}`;
    const ckv = companyKvFor(getCompanyId(user));
    const mevcut = await ckv.get(kvKey);
    if (!mevcut) {
      return c.json({ error: `KV kaydi bulunamadi: ${kvKey}` }, 404);
    }

    await ckv.del(kvKey);
    console.log(`Vardiya silindi: ${kvKey} | silen: ${user.email}`);
    return c.json({ ok: true, silinen: kvKey });
  } catch (err) {
    console.log("Vardiya sil error:", err);
    return c.json({ error: `Sunucu hatasi: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// AY RAPORU — GET /make-server-4da0b637/vardiya/ay-raporu?yil=2026
// Aylık kırılım: ciro, satış, kare, ödeme dağılımı, kâr/zarar, mekan detayı
// ──────────────────────────────────────────────────────────────
app.get("/make-server-4da0b637/vardiya/ay-raporu", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "Bu raporu yalnızca yöneticiler görebilir." }, 403);
    }

    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const effCId = (isSA && reqCId) ? reqCId : getCompanyId(user);
    const ckv = companyKvFor(effCId);

    const today = bizDateTR();
    const yil = c.req.query("yil") || today.slice(0, 4);

    const [tumKayitlar, mekanlarList, costAlbumsRaw, exRatesRaw, maaslarRaw, tumGiderlerRaw, tumGelirlerRaw, tumRotasyonlar, tumEkipmanlar, hakedisDahilRawAR, kidemPersonelRawAR, kidemCarpanlarRawAR, tumIzinlerAR] = await Promise.all([
      ckv.getByPrefix("stok_gunluk_").catch(() => []),
      getMekanlarFor(effCId),
      ckv.get("cost_albums").catch(() => null),
      ckv.get("cost_exchange_rates").catch(() => null),
      ckv.getByPrefix("cost_salary_").catch(() => []),
      ckv.getByPrefix("isletme_gider_").catch(() => []),
      ckv.getByPrefix("isletme_gelir_").catch(() => []),
      ckv.getByPrefix("rotation_task_").catch(() => []),
      ckv.getByPrefix("ekipman_").catch(() => []),
      ckv.get(HAKEDIS_DAHIL_KEY).catch(() => []),
      ckv.getByPrefix("kidem_personel_").catch(() => []),
      ckv.get("kidem_carpanlari").catch(() => null),
      ckv.getByPrefix("rotation_leave_").catch(() => []),
    ]);

    const mekanMap: Record<string, any> = {};

    // Ekipman → mekan bazlı kağıt tipi haritası (güncel atanmış kağıt)
    // mekanId → kagitTipiAdi (varsayılan kağıt — birden fazla yazıcı varsa ilkini al)
    const costPapers: any[] = costAlbumsRaw || [];
    const findPaperName = (kagitTipiId: string | null): string => {
      if (!kagitTipiId) return 'Citizen';
      const p = costPapers.find((cp: any) => cp.id === kagitTipiId);
      return p?.name || 'Citizen';
    };
    const mekanVarsayilanKagit: Record<string, string> = {};
    for (const eq of (tumEkipmanlar || [])) {
      if (eq.category !== 'printer' || eq.status === 'broken' || !eq.locationId) continue;
      if (!mekanVarsayilanKagit[eq.locationId]) {
        mekanVarsayilanKagit[eq.locationId] = findPaperName(eq.kagitTipiId);
      }
    }
    for (const m of (mekanlarList || [])) mekanMap[m.id] = m;

    const albums: any[] = costAlbumsRaw || [];
    const exRates: any = exRatesRaw || { EUR: 38, USD: 33, GBP: 41.20 };
    const toTL = (v: number, cur: string) =>
      cur === "EUR" ? v * (Number(exRates.EUR) || 38) :
      cur === "USD" ? v * (Number(exRates.USD) || 33) :
      cur === "GBP" ? v * (Number(exRates.GBP) || 41.2) : v;

    // Maaş aylık haritası
    const aylikMaasById: Record<string, number> = {};
    for (const m of (maaslarRaw || [])) {
      if (!m.userId) continue;
      const amt = toTL(Number(m.amount) || 0, m.currency || "TRY");
      const extra = amt * ((Number(m.extraCostPercentage) || 0) / 100);
      const total = amt + extra;
      const aylik = m.frequency === "daily" ? total * 30 : m.frequency === "weekly" ? total * 4.33 : m.frequency === "yearly" ? total / 12 : total;
      aylikMaasById[m.userId] = Math.round(aylik);
    }

    // Rotasyondan: personelin hangi gün hangi mekanlarda çalıştığı
    // mekan adı → mekan ID eşleştirmesi
    const mekanAdToIdRot: Record<string, string> = {};
    for (const m of (mekanlarList || [])) mekanAdToIdRot[m.name] = m.id;

    // tarih_personelId → Set<mekanId>
    const personelGunMekan: Record<string, Set<string>> = {};
    // ay_mekanId_personelId → gün sayısı (maaş hesabı için)
    const personelAyMekanGun: Record<string, number> = {};

    for (const task of (tumRotasyonlar || [])) {
      if (!task.date || !task.date.startsWith(yil)) continue;
      if (!["sent", "revised"].includes(task.status || "")) continue;
      if (!Array.isArray(task.personnel)) continue;
      const mekanId = mekanAdToIdRot[task.location] || "";
      if (!mekanId || !mekanMap[mekanId]) continue;

      for (const p of task.personnel) {
        if (!p.id) continue;
        const key = `${task.date}_${p.id}`;
        if (!personelGunMekan[key]) personelGunMekan[key] = new Set();
        personelGunMekan[key].add(mekanId);

        const ayKey = task.date.slice(0, 7);
        const pamKey = `${ayKey}_${mekanId}_${p.id}`;
        personelAyMekanGun[pamKey] = (personelAyMekanGun[pamKey] || 0) + 1;
      }
    }

    // Geç giriş verileri
    const gecGirisRaw: any[] = await ckv.getByPrefix("checkin_").catch(() => []) || [];
    const gecGirisByAy: Record<string, number> = {};
    const gecGirisByAyMekan: Record<string, number> = {}; // "ay_mekanAdi" → sayı
    for (const ci of gecGirisRaw) {
      if (!(ci.lateMin > 0) || !ci.tarih) continue;
      const ayKey = ci.tarih.slice(0, 7);
      if (!ayKey.startsWith(yil)) continue;
      gecGirisByAy[ayKey] = (gecGirisByAy[ayKey] || 0) + 1;
      if (ci.location) {
        gecGirisByAyMekan[`${ayKey}_${ci.location}`] = (gecGirisByAyMekan[`${ayKey}_${ci.location}`] || 0) + 1;
      }
    }

    // isletme_gider_ kayıtlarını ay + mekan bazlı grupla
    // mekanAdi ile mekan eşleştirmesi
    const mekanAdToId: Record<string, string> = {};
    for (const m of (mekanlarList || [])) mekanAdToId[m.name] = m.id;

    // ay_mekanId → { maas, hakedis, operasyonel, diger }
    const giderByAyMekan: Record<string, { maas: number; hakedis: number; operasyonel: number; diger: number }> = {};
    // ay → { maas, hakedis, operasyonel, diger } (mekan ataması olmayan)
    const giderByAy: Record<string, { maas: number; hakedis: number; operasyonel: number; diger: number }> = {};

    for (const g of (tumGiderlerRaw || [])) {
      if (!g.date || !g.date.startsWith(yil)) continue;
      const ayKey = g.date.slice(0, 7);
      const tutar = Number(g.amount) || 0;
      const mekanId = g.mekanId || (g.mekanAdi ? mekanAdToId[g.mekanAdi] : null);
      const isPersonelMaas = g.category === 'personel' && g.odemeTipi === 'maas';
      const isHakedis = g.category === 'personel' && g.odemeTipi === 'prim';
      const isOps = g.category === 'operasyonel';

      if (mekanId) {
        const key = `${ayKey}_${mekanId}`;
        if (!giderByAyMekan[key]) giderByAyMekan[key] = { maas: 0, hakedis: 0, operasyonel: 0, diger: 0 };
        if (isPersonelMaas) giderByAyMekan[key].maas += tutar;
        else if (isHakedis) giderByAyMekan[key].hakedis += tutar;
        else if (isOps) giderByAyMekan[key].operasyonel += tutar;
        else giderByAyMekan[key].diger += tutar;
      }
      // Genel ay toplamına da ekle
      if (!giderByAy[ayKey]) giderByAy[ayKey] = { maas: 0, hakedis: 0, operasyonel: 0, diger: 0 };
      if (isPersonelMaas) giderByAy[ayKey].maas += tutar;
      else if (isHakedis) giderByAy[ayKey].hakedis += tutar;
      else if (isOps) giderByAy[ayKey].operasyonel += tutar;
      else giderByAy[ayKey].diger += tutar;
    }

    // ── Otomatik hakediş hesaplama (vardiya/gün bazlıyla tutarlı) ──
    const hakedisDahilSetAR = new Set<string>(hakedisDahilRawAR || []);
    const kidemMapAR: Record<string, string> = {};
    for (const kp of (kidemPersonelRawAR || [])) {
      if (kp.key && kp.value) {
        const uid = kp.key.replace("kidem_personel_", "");
        kidemMapAR[uid] = String(kp.value);
      }
    }
    const defaultCarpanlarAR: Record<string, number> = { kidemsiz: 1.0, kidemli: 1.0, kidemliPlus: 1.0 };
    const carpanlarAR: Record<string, number> = kidemCarpanlarRawAR
      ? { ...defaultCarpanlarAR, ...(typeof kidemCarpanlarRawAR === 'object' ? kidemCarpanlarRawAR : {}) }
      : defaultCarpanlarAR;

    // Her gün × her mekan için otomatik hakediş hesapla
    const otomatikHakedisByAyMekan: Record<string, number> = {}; // "ay_mekanId" → tutar
    const otomatikHakedisByAy: Record<string, number> = {}; // "ay" → tutar
    for (const kayit of (tumKayitlar || [])) {
      if (!kayit.tarih || !kayit.tarih.startsWith(yil) || !kayit.kapanisYapildi) continue;
      const mekan = mekanMap[kayit.mekanId];
      if (!mekan || !mekan.kotaKademeleri || mekan.kotaKademeleri.length === 0) continue;
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const ciro = satislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0);
      const mekanAdi = mekan.name || "";
      const seenIds = new Set<string>();
      const rotPersoneller: Array<{id: string; gorev?: string}> = [];
      for (const task of (tumRotasyonlar || [])) {
        if (task.date !== kayit.tarih || !["sent", "revised"].includes(task.status) || task.location !== mekanAdi) continue;
        for (const p of (task.personnel || [])) {
          if (p.id && p.name && !seenIds.has(p.id) && hakedisDahilSetAR.has(p.id)) {
            seenIds.add(p.id);
            rotPersoneller.push({ id: p.id, gorev: p.gorev });
          }
        }
      }
      if (rotPersoneller.length === 0) continue;
      const soloMu = rotPersoneller.length === 1 && !rotPersoneller[0].gorev;
      const gorevSayilari: Record<string, number> = {};
      for (const per of rotPersoneller) {
        const g = per.gorev || 'fotograf-satis';
        gorevSayilari[g] = (gorevSayilari[g] || 0) + 1;
      }
      const sortedK = [...mekan.kotaKademeleri].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));
      let vardiyaPrim = 0;
      for (const kademe of sortedK) {
        if (ciro >= Number(kademe.hedef)) {
          for (const per of rotPersoneller) {
            let baseTutar = 0;
            if (soloMu) {
              baseTutar = Number(kademe.primTek) || 0;
            } else {
              const gorev = per.gorev || 'fotograf-satis';
              const gorevKisiSayisi = gorevSayilari[gorev] || 1;
              const bantKey = gorev === 'baski' ? 'baskiBantlar' : gorev === 'album' ? 'albumBantlar' : gorev === 'gozlemci' ? 'gozlemciBantlar' : 'fotografBantlar';
              const bantlar: any[] = kademe[bantKey];
              if (bantlar && Array.isArray(bantlar) && bantlar.length > 0) {
                const bant = bantlar.find((b: any) => gorevKisiSayisi >= Number(b.min) && gorevKisiSayisi <= Number(b.max));
                baseTutar = bant ? Number(bant.tutar) || 0 : 0;
              } else {
                if (gorev === 'baski') baseTutar = Number(kademe.primBaski) || Number(kademe.primCoklu) || 0;
                else if (gorev === 'album') baseTutar = Number(kademe.primAlbum) || Number(kademe.primCoklu) || 0;
                else if (gorev === 'gozlemci') baseTutar = Number(kademe.primGozlemci) || 0;
                else baseTutar = Number(kademe.primFotograf) || Number(kademe.primCoklu) || 0;
              }
            }
            const kidemSeviye = kidemMapAR[per.id] || 'kidemsiz';
            const kidemCarpan = Number(carpanlarAR[kidemSeviye]) ?? 1.0;
            vardiyaPrim += Math.round(baseTutar * kidemCarpan);
          }
        }
      }
      if (vardiyaPrim > 0) {
        const ayKey = kayit.tarih.slice(0, 7);
        const amKey = `${ayKey}_${kayit.mekanId}`;
        otomatikHakedisByAyMekan[amKey] = (otomatikHakedisByAyMekan[amKey] || 0) + vardiyaPrim;
        otomatikHakedisByAy[ayKey] = (otomatikHakedisByAy[ayKey] || 0) + vardiyaPrim;
      }
    }

    // isletme_gelir_ kayıtlarını ay + mekan bazlı grupla
    const gelirByAyMekan: Record<string, number> = {}; // "ay_mekanId" → tutar
    for (const g of (tumGelirlerRaw || [])) {
      if (!g.date || !g.date.startsWith(yil) || !g.mekanId) continue;
      const ayKey = g.date.slice(0, 7);
      const key = `${ayKey}_${g.mekanId}`;
      gelirByAyMekan[key] = (gelirByAyMekan[key] || 0) + (Number(g.amount) || 0);
    }

    // Yıl kayıtlarını filtrele
    const yilKayitlar = (tumKayitlar || []).filter((k: any) => k.tarih && k.tarih.startsWith(yil));

    const ayLabels = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

    // Aylık gruplama
    const ayMap: Record<string, any> = {};

    for (const kayit of yilKayitlar) {
      const mekan = mekanMap[kayit.mekanId];
      if (!mekan) continue;
      const ayKey = kayit.tarih.slice(0, 7);
      if (!ayMap[ayKey]) {
        const ayIndex = parseInt(ayKey.split('-')[1]) - 1;
        ayMap[ayKey] = {
          ay: ayKey,
          label: ayLabels[ayIndex] + ' ' + yil,
          toplamCiro: 0, toplamSatis: 0, toplamKare: 0, toplamIskonto: 0,
          nakitToplam: 0, ibanToplam: 0, krediToplam: 0,
          toplamGider: 0, karZarar: 0, karMarji: 0,
          toplamBasilan: 0, toplamSatilanFotograf: 0, toplamIadeFotograf: 0, toplamKullanilanBaski: 0,
          anomaliSayisi: 0, gecGirisSayisi: 0, gunSayisi: 0, anomaliler: [] as any[],
          mekanlar: {} as Record<string, any>,
          mekanLabels: [] as string[],
          _gunler: new Set<string>(),
          _personelIds: new Set<string>(),
          _baskiMaliyet: 0, _albumMaliyet: 0, _kira: 0, _maas: 0, _hakedis: 0,
          _albumMap: {} as Record<string, { tip: string; adet: number }>,
          _personelMap: {} as Record<string, { id: string; ad: string; ciro: number; kare: number; vardiya: number; satisAdet: number }>,
        };
      }
      const am = ayMap[ayKey];
      am._gunler.add(kayit.tarih);

      // Kira
      const kayitYili = kayit.tarih.slice(0, 4);
      const yillikKira = Number(mekan.yearlyRents?.[kayitYili]) || Number(mekan.yearlyRent) || 0;
      am._kira += Math.round(yillikKira / 365);

      // Baskı maliyeti + fotoğraf metrikleri
      if (kayit.vardiyaToplam) {
        am._baskiMaliyet += Number(kayit.vardiyaToplam.toplamMaliyet) || 0;
        am.toplamBasilan += Number(kayit.vardiyaToplam.toplamCikisAdedi) || 0;
        am.toplamSatilanFotograf += Number(kayit.vardiyaToplam["toplamSatılanFotograf"]) || 0;
        am.toplamIadeFotograf += Number(kayit.vardiyaToplam.toplamIadeFotograf) || 0;
        am.toplamKullanilanBaski += Number(kayit.vardiyaToplam["toplamKullanilanBaskı"]) || 0;
        // Baskı detay (son vardiyadan al — aynı ay genelde aynı kağıt/boyut)
        if (kayit.vardiyaToplam.printType) am.baskiBoyutu = kayit.vardiyaToplam.printType;
        if (kayit.vardiyaToplam.paperName) am.baskiKagitAdi = kayit.vardiyaToplam.paperName;
      }

      // Kare
      const kareKayitlari = kayit.kareKayitlari || [];
      am.toplamKare += kareKayitlari.reduce((s: number, k: any) => s + (Number(k.frameCount) || 0), 0);

      // Anomali (stok + yazıcı — gün raporuyla aynı mantık + detay)
      const kagitAdMapAR: Record<string, string> = {};
      for (const pr of (kayit.printerData || [])) {
        if (pr.kagitTipiId && pr.kagitTipiAdi) kagitAdMapAR[pr.kagitTipiId] = pr.kagitTipiAdi;
      }
      const anomDetayAR = (detay: Record<string, any>, tip: string): string => {
        return Object.entries(detay).map(([k, v]) => {
          const val = Number(v);
          const farkStr = val > 0 ? `${val} fazla` : `${Math.abs(val)} eksik`;
          if (k.startsWith("ribonlar.")) {
            const tipId = k.replace("ribonlar.", "");
            const ad = kagitAdMapAR[tipId];
            return `${tip === "acilis" ? "Acilista" : "Kapanista"} ${farkStr} takim sayildi${ad ? ` (${ad})` : ""}`;
          }
          if (k.startsWith("album")) return `${k.replace("album", "")} Fotograf albumu: ${farkStr}`;
          if (k === "paspartu") return `Paspartu: ${farkStr}`;
          return `${k}: ${val > 0 ? "+" : ""}${val}`;
        }).join(", ");
      };
      const hasStokAnomali = (kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0) || (kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0);
      const hasYaziciAnomali = (Array.isArray(kayit.acilisYaziciAnomali) && kayit.acilisYaziciAnomali.length > 0) || (kayit.kapanisYaziciAnomali && kayit.kapanisYaziciAnomali.fark !== undefined);
      if (hasStokAnomali || hasYaziciAnomali) {
        am.anomaliSayisi++;
        if (kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0) {
          // Açılış anomalisi → önceki günün personeline puan
          const oncekiGun = new Date(kayit.tarih);
          oncekiGun.setDate(oncekiGun.getDate() - 1);
          const oncekiGunStr = oncekiGun.toISOString().split("T")[0];
          const acilisPersoneller = (tumRotasyonlar || [])
            .filter((t: any) => t.date === oncekiGunStr && ["sent","revised"].includes(t.status) && t.location === mekan.name)
            .flatMap((t: any) => (t.personnel || []).filter((p: any) => p.name).map((p: any) => p.name));
          am.anomaliler.push({ mekan: mekan.name, mekanEmoji: mekan.emoji, tarih: kayit.tarih, tip: "acilis", aciklama: anomDetayAR(kayit.acilisAnomali, "acilis"), personeller: [...new Set(acilisPersoneller)] });
        }
        if (kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0) {
          // Kapanış anomalisi → aynı günün personeline puan
          const kapanisPersoneller = (tumRotasyonlar || [])
            .filter((t: any) => t.date === kayit.tarih && ["sent","revised"].includes(t.status) && t.location === mekan.name)
            .flatMap((t: any) => (t.personnel || []).filter((p: any) => p.name).map((p: any) => p.name));
          am.anomaliler.push({ mekan: mekan.name, mekanEmoji: mekan.emoji, tarih: kayit.tarih, tip: "kapanis", aciklama: anomDetayAR(kayit.kapanisAnomali, "kapanis"), personeller: [...new Set(kapanisPersoneller)] });
        }
        if (kayit.kapanisYaziciAnomali && kayit.kapanisYaziciAnomali.fark !== undefined) {
          const fark = kayit.kapanisYaziciAnomali.fark;
          // Yazıcı anomalisi → aynı günün personeline puan
          const yaziciPersoneller = (tumRotasyonlar || [])
            .filter((t: any) => t.date === kayit.tarih && ["sent","revised"].includes(t.status) && t.location === mekan.name)
            .flatMap((t: any) => (t.personnel || []).filter((p: any) => p.name).map((p: any) => p.name));
          am.anomaliler.push({ mekan: mekan.name, mekanEmoji: mekan.emoji, tarih: kayit.tarih, tip: "yazici", aciklama: `Net basilan ile satis farki: ${fark > 0 ? "+" : ""}${fark} kare`, personeller: [...new Set(yaziciPersoneller)] });
        }
      }

      // Mekan detay
      if (!am.mekanlar[kayit.mekanId]) {
        am.mekanlar[kayit.mekanId] = { mekanId: kayit.mekanId, mekanAd: mekan.name, mekanEmoji: mekan.emoji || '📍', ciro: 0, satis: 0, gider: 0, karZarar: 0, baskiMaliyet: 0, baskiAdet: 0, baskiBoyutu: '', baskiKagitAdi: '', vardiyaSayisi: 0, _albumMap: {} as Record<string, { tip: string; adet: number }>, _personelMap: {} as Record<string, string> };
        am.mekanLabels.push(`${mekan.emoji || '📍'} ${mekan.name}`);
      }
      const md = am.mekanlar[kayit.mekanId];
      md.vardiyaSayisi++;
      // Kare kayıtlarından personel toplama
      for (const kk of kareKayitlari) {
        if (kk.photographerId && kk.photographerName) {
          md._personelMap[kk.photographerId] = kk.photographerName;
          const pid = kk.photographerId;
          if (!am._personelMap[pid]) am._personelMap[pid] = { id: pid, ad: kk.photographerName, ciro: 0, kare: 0, vardiya: 0, satisAdet: 0 };
          am._personelMap[pid].kare += Number(kk.frameCount) || 0;
        }
      }

      // Mekan baskı bilgileri — kağıt tipi bazlı
      if (kayit.vardiyaToplam) {
        md.baskiMaliyet = (md.baskiMaliyet || 0) + (Number(kayit.vardiyaToplam.toplamMaliyet) || 0);
        md.baskiAdet = (md.baskiAdet || 0) + (Number(kayit.vardiyaToplam.toplamCikisAdedi) || 0);
        if (kayit.vardiyaToplam.printType) md.baskiBoyutu = kayit.vardiyaToplam.printType;
      }
      // Yazıcı bazlı detay (ekipmanId ile gruplama)
      if (!md.yazicilar) md.yazicilar = {} as Record<string, any>;
      for (const pr of (kayit.printerData || [])) {
        const eid = pr.ekipmanId || pr.id || 'bilinmiyor';
        // Ekipman kaydından marka/model/seri no
        const ekipman = (tumEkipmanlar || []).find((eq: any) => eq.id === eid);
        const marka = ekipman?.brand || pr.brand || '';
        const model = ekipman?.model || pr.model || '';
        const seriNo = ekipman?.serialNumber || pr.serialNumber || '';
        const kagitAdi = pr.kagitTipiAdi || findPaperName(ekipman?.kagitTipiId) || mekanVarsayilanKagit[kayit.mekanId] || 'Citizen';
        const boyut = kayit.vardiyaToplam?.printType || 'yarim';

        if (!md.yazicilar[eid]) md.yazicilar[eid] = { ekipmanId: eid, marka, model, seriNo, kagitAdi, boyut, baskiAdet: 0, maliyet: 0, birimMaliyet: 0 };
        const yz = md.yazicilar[eid];
        yz.baskiAdet += Number(pr.cikisAdedi) || 0;
        yz.maliyet += Number(pr.toplamMaliyet) || 0;
        if (pr.birimMaliyet > 0) yz.birimMaliyet = Number(pr.birimMaliyet);
        // Güncel bilgileri güncelle
        if (marka) yz.marka = marka;
        if (model) yz.model = model;
        if (seriNo) yz.seriNo = seriNo;
        if (pr.kagitTipiAdi) yz.kagitAdi = pr.kagitTipiAdi;
      }

      // Mekan gider: baskı + kira payı
      let mekanBaskiMaliyet = 0;
      if (kayit.vardiyaToplam) mekanBaskiMaliyet = Number(kayit.vardiyaToplam.toplamMaliyet) || 0;
      const mekanGunlukKira = Math.round(yillikKira / 365);
      let mekanAlbumMaliyet = 0;
      // Satışlar
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      for (const satis of satislar) {
        const tutar = Number(satis.finalPrice) || 0;
        const iskonto = Number(satis.discount) || 0;
        // Personel toplama (mekan + ay bazlı)
        if (satis.kaydedenId && satis.kaydeden) {
          md._personelMap[satis.kaydedenId] = satis.kaydeden;
          const pid = satis.kaydedenId;
          if (!am._personelMap[pid]) am._personelMap[pid] = { id: pid, ad: satis.kaydeden, ciro: 0, kare: 0, vardiya: 0, satisAdet: 0 };
          am._personelMap[pid].ciro += tutar;
          am._personelMap[pid].satisAdet++;
        }
        am.toplamCiro += tutar;
        am.toplamSatis++;
        am.toplamIskonto += iskonto;
        md.ciro += tutar;
        md.satis++;

        // Ödeme dağılımı
        const pm = String(satis.paymentMethod || "").toLowerCase();
        if (pm.includes("iban") || pm.includes("havale") || pm.includes("transfer")) am.ibanToplam += tutar;
        else if (pm.includes("kart") || pm.includes("card") || pm.includes("kredi")) am.krediToplam += tutar;
        else am.nakitToplam += tutar;

        // Albüm maliyeti + ürün dökümü
        for (const item of (satis.items || [])) {
          const urunAdi = String(item.product || "");
          const adet = Number(item.quantity) || 1;
          const match = urunAdi.match(/^(\d+)/);
          if (match) {
            const sz = parseInt(match[1]);
            const al = albums.find((a: any) => Number(a.size) === sz);
            if (al) {
              const printType = mekan.printType || "yarim";
              const birim = printType === "tam" ? Number(al.tamBoy) : Number(al.yarimBoy);
              const albumCost = adet * toTL(birim, al.currency || "TRY");
              am._albumMaliyet += albumCost;
              mekanAlbumMaliyet += albumCost;
            }
          }
          // Ürün dökümü (tüm ürünler — satış grafiği için)
          if (urunAdi) {
            if (!am._albumMap[urunAdi]) am._albumMap[urunAdi] = { tip: urunAdi, adet: 0 };
            am._albumMap[urunAdi].adet += adet;
            // Mekan bazlı ürün dökümü
            if (!md._albumMap) md._albumMap = {};
            if (!md._albumMap[urunAdi]) md._albumMap[urunAdi] = { tip: urunAdi, adet: 0 };
            md._albumMap[urunAdi].adet += adet;
          }
        }

        // Personel
        if (satis.kaydedenId) am._personelIds.add(satis.kaydedenId);
      }
      for (const k of kareKayitlari) { if (k.photographerId) am._personelIds.add(k.photographerId); }

      // Mekan maaş: rotasyondan o gün o mekanda çalışan personelin maaşı
      // Aylık maaş / o ayın gün sayısı × mekan sayısına böl
      let mekanMaas = 0;
      const gunDateMaas = new Date(kayit.tarih + "T00:00:00Z");
      const ayGunSayisiMaas = new Date(Date.UTC(gunDateMaas.getUTCFullYear(), gunDateMaas.getUTCMonth() + 1, 0)).getUTCDate();
      // Rotasyondan o gün bu mekada atanan personeller
      for (const task of (tumRotasyonlar || [])) {
        if (task.date !== kayit.tarih) continue;
        if (!["sent", "revised"].includes(task.status || "")) continue;
        const taskMekanId = mekanAdToIdRot[task.location] || "";
        if (taskMekanId !== kayit.mekanId) continue;
        for (const p of (task.personnel || [])) {
          if (!p.id) continue;
          const gunluk = aylikMaasById[p.id] ? Math.round(aylikMaasById[p.id] / ayGunSayisiMaas) : 0;
          if (gunluk <= 0) continue;
          const pgmKey = `${kayit.tarih}_${p.id}`;
          const mekanSayisi = personelGunMekan[pgmKey]?.size || 1;
          mekanMaas += gunluk / mekanSayisi;
        }
      }

      // Mekan giderini tamamla: baskı + kira + albüm + maaş
      md.gider += mekanBaskiMaliyet + mekanGunlukKira + mekanAlbumMaliyet + mekanMaas;
      md.albumMaliyet = Math.round((md.albumMaliyet || 0) + mekanAlbumMaliyet);
      md.kiraMaliyet = Math.round((md.kiraMaliyet || 0) + mekanGunlukKira);
      md.maasMaliyet = Math.round((md.maasMaliyet || 0) + mekanMaas);
      am._kira += mekanGunlukKira;
      am._maas += mekanMaas;
    }

    // Hesaplamaları tamamla
    const aylarResult = [];
    let yoneticiIdSetAR: Set<string> | null = null;
    for (const am of Object.values(ayMap)) {
      am.gunSayisi = am._gunler.size;
      am.gecGirisSayisi = gecGirisByAy[am.ay] || 0;

      // isletme_gider_ kayıtlarından gelen giderler
      const ayGider = giderByAy[am.ay] || { maas: 0, hakedis: 0, operasyonel: 0, diger: 0 };

      // Mekan kâr/zarar — isletme_gider_ + isletme_gelir_ kayıtlarından
      let ayEkGelir = 0;
      for (const md of Object.values(am.mekanlar) as any[]) {
        const mgKey = `${am.ay}_${md.mekanId}`;
        // Giderler (hakediş + operasyonel — maaş rotasyondan zaten eklendi)
        const mgGider = giderByAyMekan[mgKey] || { maas: 0, hakedis: 0, operasyonel: 0, diger: 0 };
        // Hakediş: otomatik hesaplanan (isletme_gider_ yerine — hesaplandığı anda gidere dahil)
        const mekanOtomatikHakedis = otomatikHakedisByAyMekan[mgKey] || 0;
        md.gider += mekanOtomatikHakedis + mgGider.operasyonel;
        md.hakedisMaliyet = Math.round((md.hakedisMaliyet || 0) + mekanOtomatikHakedis);
        am._hakedis += mekanOtomatikHakedis;
        // Ek gelirler
        const ekGelir = gelirByAyMekan[mgKey] || 0;
        md.ciro += ekGelir;
        md.ekGelir = Math.round(ekGelir);
        ayEkGelir += ekGelir;
        // Geç giriş (mekan bazlı)
        md.gecGirisSayisi = gecGirisByAyMekan[`${am.ay}_${md.mekanAd}`] || 0;
        // Kâr
        md.karZarar = Math.round(md.ciro - md.gider);
        md.ciro = Math.round(md.ciro);
        md.gider = Math.round(md.gider);
        md.baskiMaliyet = Math.round(md.baskiMaliyet || 0);
        md.baskiBirimMaliyet = md.baskiAdet > 0 ? Math.round(((md.baskiMaliyet || 0) / md.baskiAdet) * 100) / 100 : 0;
        md.yazicilar = Object.values(md.yazicilar || {}).map((yz: any) => ({ ...yz, maliyet: Math.round(yz.maliyet) }));
        md.personeller = Object.entries(md._personelMap || {}).map(([id, ad]: [string, any]) => ({ id, ad }));
        delete md._personelMap;
        md.albumler = Object.values(md._albumMap || {}).sort((a: any, b: any) => {
          const sA = parseInt(String(a.tip).match(/^(\d+)/)?.[1] || '999');
          const sB = parseInt(String(b.tip).match(/^(\d+)/)?.[1] || '999');
          return sA - sB;
        });
        delete md._albumMap;
        delete md.kagitTipleri;
      }
      // Ek gelirleri genel ciroya ekle
      am.toplamCiro += Math.round(ayEkGelir);
      // Genel toplam = mekan detaylarının toplamı (tutarlılık)
      am.toplamGider = Object.values(am.mekanlar).reduce((s: number, md: any) => s + md.gider, 0);
      am.karZarar = Object.values(am.mekanlar).reduce((s: number, md: any) => s + md.karZarar, 0);
      am.karMarji = am.toplamCiro > 0 ? Math.round((am.karZarar / am.toplamCiro) * 100) : 0;

      // Baskı birim maliyet
      am.toplamBaskiMaliyet = Math.round(am._baskiMaliyet);
      am.baskiBirimMaliyet = am.toplamBasilan > 0 ? Math.round((am._baskiMaliyet / am.toplamBasilan) * 100) / 100 : 0;

      // Yuvarlama
      am.toplamCiro = Math.round(am.toplamCiro);
      am.toplamIskonto = Math.round(am.toplamIskonto);
      am.nakitToplam = Math.round(am.nakitToplam);
      am.ibanToplam = Math.round(am.ibanToplam);
      am.krediToplam = Math.round(am.krediToplam);

      // Personel listesi: ciro, kare, vardiya, hakediş, izin
      // Yönetici ID'leri (ilk ay'da bir kere çekilir, cache'lenir)
      if (!yoneticiIdSetAR) {
        try {
          const { data: { users: allUsersAR } } = await getAdminClient().auth.admin.listUsers({ perPage: 1000 });
          yoneticiIdSetAR = new Set((allUsersAR || []).filter((u: any) => u.user_metadata?.role === 'yonetici').map((u: any) => u.id));
        } catch { yoneticiIdSetAR = new Set(); }
      }
      const personelListesi = Object.values(am._personelMap).map((p: any) => {
        // Vardiya sayısı: rotasyondan o personel o ay kaç gün çalışmış
        let vardiyaSayisi = 0;
        for (const [pamKey, gunSayisi] of Object.entries(personelAyMekanGun)) {
          if (pamKey.startsWith(`${am.ay}_`) && pamKey.endsWith(`_${p.id}`)) {
            vardiyaSayisi += gunSayisi as number;
          }
        }
        // Hakediş: otomatik hesaplanan
        // personel bazlı hakediş ay raporunda ayrı tutulmadı, rotasyondan hesaplayalım
        let hakedis = 0;
        for (const kayit of (tumKayitlar || [])) {
          if (!kayit.tarih?.startsWith(am.ay) || !kayit.kapanisYapildi) continue;
          const mk = mekanMap[kayit.mekanId];
          if (!mk || !mk.kotaKademeleri || mk.kotaKademeleri.length === 0) continue;
          const sSatislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
          const sCiro = sSatislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0);
          const mAdi = mk.name || "";
          for (const task of (tumRotasyonlar || [])) {
            if (task.date !== kayit.tarih || !["sent","revised"].includes(task.status) || task.location !== mAdi) continue;
            const kisi = (task.personnel || []).find((pp: any) => pp.id === p.id);
            if (!kisi || !hakedisDahilSetAR.has(p.id)) continue;
            const rotPers = (task.personnel || []).filter((pp: any) => pp.id && pp.name && hakedisDahilSetAR.has(pp.id));
            const soloMu = rotPers.length === 1 && !rotPers[0].gorev;
            const gorevSay: Record<string, number> = {};
            for (const rp of rotPers) { const g = rp.gorev || 'fotograf-satis'; gorevSay[g] = (gorevSay[g] || 0) + 1; }
            for (const kademe of mk.kotaKademeleri) {
              if (sCiro >= Number(kademe.hedef)) {
                let bt = 0;
                if (soloMu) { bt = Number(kademe.primTek) || 0; }
                else {
                  const gorev = kisi.gorev || 'fotograf-satis';
                  const gks = gorevSay[gorev] || 1;
                  const bk = gorev === 'baski' ? 'baskiBantlar' : gorev === 'album' ? 'albumBantlar' : gorev === 'gozlemci' ? 'gozlemciBantlar' : 'fotografBantlar';
                  const bantlar: any[] = kademe[bk];
                  if (bantlar && Array.isArray(bantlar) && bantlar.length > 0) {
                    const bant = bantlar.find((b: any) => gks >= Number(b.min) && gks <= Number(b.max));
                    bt = bant ? Number(bant.tutar) || 0 : 0;
                  } else {
                    if (gorev === 'baski') bt = Number(kademe.primBaski) || Number(kademe.primCoklu) || 0;
                    else if (gorev === 'album') bt = Number(kademe.primAlbum) || Number(kademe.primCoklu) || 0;
                    else if (gorev === 'gozlemci') bt = Number(kademe.primGozlemci) || 0;
                    else bt = Number(kademe.primFotograf) || Number(kademe.primCoklu) || 0;
                  }
                }
                const ks = kidemMapAR[p.id] || 'kidemsiz';
                const kc = Number(carpanlarAR[ks]) ?? 1.0;
                hakedis += Math.round(bt * kc);
              }
            }
          }
        }
        // İzin sayısı: o ay onaylı + günlük
        let izinGun = 0;
        for (const leave of (tumIzinlerAR || [])) {
          if (leave.personnelId !== p.id || leave.status !== 'approved') continue;
          const start = leave.startDate || '';
          const end = leave.endDate || start;
          // İzin tarih aralığı bu ay ile kesişiyor mu?
          const ayBas = `${am.ay}-01`;
          const ayBit = `${am.ay}-31`;
          if (end < ayBas || start > ayBit) continue;
          // Kesişen gün sayısı
          const effStart = start < ayBas ? ayBas : start;
          const effEnd = end > ayBit ? ayBit : end;
          const d1 = new Date(effStart);
          const d2 = new Date(effEnd);
          const gunFark = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          izinGun += Math.max(gunFark, 0);
        }
        // Geç giriş sayısı (o ay)
        let gecGirisSayisi = 0;
        for (const ci of (gecGirisRaw || [])) {
          if (ci.userId === p.id && ci.lateMin > 0 && ci.tarih?.startsWith(am.ay)) gecGirisSayisi++;
        }
        // Anomali sayısı: personelin adı anomali personeller listesinde kaç kez geçiyor
        let anomaliSayisi = 0;
        for (const anom of (am.anomaliler || [])) {
          if ((anom.personeller || []).includes(p.ad)) anomaliSayisi++;
        }
        return {
          id: p.id,
          ad: p.ad,
          ciro: Math.round(p.ciro),
          kare: p.kare,
          satisAdet: p.satisAdet,
          vardiyaSayisi,
          hakedis: Math.round(hakedis),
          izinGun,
          gecGirisSayisi,
          anomaliSayisi,
        };
      }).filter((p: any) => p.vardiyaSayisi > 0 && !yoneticiIdSetAR?.has(p.id)).sort((a: any, b: any) => b.ciro - a.ciro);
      am.personeller = personelListesi;
      delete am._personelMap;

      // Mekan detayını diziye çevir
      am.mekanDetay = Object.values(am.mekanlar);
      delete am.mekanlar;
      delete am._gunler;
      delete am._personelIds;
      delete am._baskiMaliyet;
      am.albumMaliyet = Math.round(am._albumMaliyet);
      am.kiraMaliyeti = Math.round(am._kira);
      am.maasGideri = Math.round(am._maas);
      am.hakedisGideri = Math.round(am._hakedis);
      am.albumler = Object.values(am._albumMap).sort((a: any, b: any) => b.adet - a.adet);
      delete am._albumMaliyet;
      delete am._albumMap;
      delete am._kira;
      delete am._maas;
      delete am._hakedis;

      aylarResult.push(am);
    }

    aylarResult.sort((a: any, b: any) => b.ay.localeCompare(a.ay));

    console.log(`Ay raporu: ${yil} — ${aylarResult.length} ay`);
    return c.json({ yil: Number(yil), aylar: aylarResult });
  } catch (err) {
    console.log("Ay raporu error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// GÜN RAPORU — GET /make-server-4da0b637/vardiya/gun-raporu
// Query: baslangic=YYYY-MM-DD&bitis=YYYY-MM-DD  (veya tarih= tek gün)
// Auth: yonetici/ust-mudur/mudur
// Tarih aralığındaki her gün için birleşik özet döndürür
// ──────────────────────────────────────────────────────────────
app.get("/make-server-4da0b637/vardiya/gun-raporu", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "Bu raporu yalnızca yöneticiler görebilir." }, 403);
    }

    // Tarih aralığı veya tek tarih desteği
    const qBaslangic = c.req.query("baslangic") || "";
    const qBitis = c.req.query("bitis") || "";
    const qTarih = c.req.query("tarih") || "";
    // Tek tarih modunda geriye uyumluluk
    const tarih = qTarih || qBitis || bizDateTR();
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const effCId = (isSA && reqCId) ? reqCId : getCompanyId(user);

    const ckv = companyKvFor(effCId);
    const [tumKayitlar, mekanlarList, costAlbumsRaw, exRatesRaw, maaslarRaw, tumRotasyonlar, kidemPersonelRaw, kidemCarpanlarRaw, hakedisDahilRaw, tumGiderlerGR] = await Promise.all([
      ckv.getByPrefix("stok_gunluk_"),
      getMekanlarFor(effCId),
      ckv.get("cost_albums"),
      ckv.get("cost_exchange_rates"),
      ckv.getByPrefix("cost_salary_"),
      ckv.getByPrefix("rotation_task_").catch(() => []),
      ckv.getByPrefix("kidem_personel_").catch(() => []),
      ckv.get("kidem_carpanlari").catch(() => null),
      ckv.get(HAKEDIS_DAHIL_KEY).catch(() => []),
      ckv.getByPrefix("isletme_gider_").catch(() => []),
    ]);

    // Hakediş giderleri: tarih_mekanAdi → toplam hakediş tutarı
    const hakedisGiderByTarihMekan: Record<string, number> = {};
    for (const g of (tumGiderlerGR || [])) {
      if (g.category !== 'personel' || g.odemeTipi !== 'prim') continue;
      if (!g.date || !g.mekanAdi) continue;
      const key = `${g.date}_${g.mekanAdi}`;
      hakedisGiderByTarihMekan[key] = (hakedisGiderByTarihMekan[key] || 0) + (Number(g.amount) || 0);
    }

    // Hakediş dahil kişiler (kişi bazlı, rol bağımsız — listede olmayanlar hakediş almaz)
    const hakedisDahilSet = new Set<string>(hakedisDahilRaw || []);

    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) mekanMap[m.id] = m;

    // Kıdem verileri parse
    const kidemMap: Record<string, string> = {};
    for (const kp of (kidemPersonelRaw || [])) {
      if (kp.key && kp.value) {
        const uid = kp.key.replace("kidem_personel_", "");
        kidemMap[uid] = String(kp.value);
      }
    }
    const defaultCarpanlar: Record<string, number> = { kidemsiz: 1.0, kidemli: 1.0, kidemliPlus: 1.0 };
    const carpanlar: Record<string, number> = kidemCarpanlarRaw
      ? { ...defaultCarpanlar, ...(typeof kidemCarpanlarRaw === 'object' ? kidemCarpanlarRaw : {}) }
      : defaultCarpanlar;

    // Tarih aralığı modunda: tüm günleri grupla ve her gün için özet hesapla
    const baslangicTarih = qBaslangic || tarih;
    const bitisTarih = qBitis || tarih;
    const isMultiDay = baslangicTarih !== bitisTarih;

    // Tüm kayıtları tarihe göre filtrele
    const aralikKayitlar = (tumKayitlar || []).filter((k: any) => {
      if (!k.tarih) return false;
      return k.tarih >= baslangicTarih && k.tarih <= bitisTarih;
    });

    // Tarihlere göre grupla
    const tarihGrup: Record<string, any[]> = {};
    for (const k of aralikKayitlar) {
      if (!tarihGrup[k.tarih]) tarihGrup[k.tarih] = [];
      tarihGrup[k.tarih].push(k);
    }

    // Tek gün modu (geriye uyumluluk)
    const gunKayitlar = tarihGrup[tarih] || aralikKayitlar;

    if (aralikKayitlar.length === 0) {
      return c.json({ tarih, baslangic: baslangicTarih, bitis: bitisTarih, bos: true, mesaj: "Bu tarih aralığında kayıt bulunamadı.", gunler: [] });
    }

    const albums: any[] = costAlbumsRaw || [];
    const exRates: any = exRatesRaw || { EUR: 38, USD: 33, GBP: 41.20 };
    const maaslar: any[] = maaslarRaw || [];

    const toTL = (v: number, cur: string) =>
      cur === "EUR" ? v * (Number(exRates.EUR) || 38) :
      cur === "USD" ? v * (Number(exRates.USD) || 33) :
      cur === "GBP" ? v * (Number(exRates.GBP) || 41.2) : v;

    // Maaş aylık haritası + tarih bazlı günlük hesaplama
    const aylikMaasByIdGR: Record<string, number> = {};
    for (const m of maaslar) {
      if (!m.userId) continue;
      const amt = toTL(Number(m.amount) || 0, m.currency || "TRY");
      const extra = amt * ((Number(m.extraCostPercentage) || 0) / 100);
      const total = amt + extra;
      const aylik = m.frequency === "daily" ? total * 30 : m.frequency === "weekly" ? total * 4.33 : m.frequency === "yearly" ? total / 12 : total;
      aylikMaasByIdGR[m.userId] = Math.round(aylik);
    }
    const gunlukMaasForGR = (userId: string, tarihStr: string): number => {
      const aylik = aylikMaasByIdGR[userId] || 0;
      if (aylik <= 0) return 0;
      const ayIdx = parseInt(tarihStr.slice(5, 7));
      const yilNum = parseInt(tarihStr.slice(0, 4));
      const ayGunSayisi = new Date(yilNum, ayIdx, 0).getDate();
      return Math.round(aylik / ayGunSayisi);
    };
    // Eski uyumluluk
    const maasById: Record<string, number> = {};
    for (const m of maaslar) {
      if (!m.userId) continue;
      maasById[m.userId] = gunlukMaasForGR(m.userId, tarih);
    }

    // Toplam metrikler
    let toplamCiro = 0, toplamSatisAdet = 0, toplamIskonto = 0, toplamKare = 0;
    let toplamBaskiMaliyet = 0, toplamAlbumMaliyet = 0, toplamKira = 0;
    let acilanMekan = 0, kapananMekan = 0;
    let toplamSatilanFotograf = 0, toplamIadeFotograf = 0, toplamBasilanFotograf = 0, toplamKullanilanBaski = 0;

    const mekanOzetleri: any[] = [];
    const personelMap: Record<string, any> = {};
    const albumMap: Record<string, { tip: string; adet: number; ciro: number }> = {};
    const odemeMap: Record<string, number> = { cash: 0, card: 0, iban: 0, foreign: 0 };
    const anomaliler: any[] = [];
    const personelIdSet = new Set<string>();

    for (const kayit of gunKayitlar) {
      const mekan = mekanMap[kayit.mekanId];
      if (!mekan) continue; // Mekan tanımı yoksa (bozuk/silinmiş kayıt) atla
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);

      if (kayit.acilisYapildi) acilanMekan++;
      if (kayit.kapanisYapildi) kapananMekan++;

      // Günlük kira (yıl bazlı: kayıt tarihinin yılına göre)
      const kayitYili = kayit.tarih?.slice(0, 4);
      const yillikKira = Number(mekan.yearlyRents?.[kayitYili]) || Number(mekan.yearlyRent) || 0;
      const gunlukKira = Math.round(yillikKira / 365);
      toplamKira += gunlukKira;

      // Baskı maliyeti + fotoğraf metrikleri
      if (kayit.vardiyaToplam) {
        toplamBaskiMaliyet += Number(kayit.vardiyaToplam.toplamMaliyet) || 0;
        toplamBasilanFotograf += Number(kayit.vardiyaToplam.toplamCikisAdedi) || 0;
        toplamSatilanFotograf += Number(kayit.vardiyaToplam["toplamSatılanFotograf"]) || 0;
        toplamIadeFotograf += Number(kayit.vardiyaToplam.toplamIadeFotograf) || 0;
        toplamKullanilanBaski += Number(kayit.vardiyaToplam["toplamKullanilanBaskı"]) || 0;
      }

      // Kare
      const kareKayitlari = kayit.kareKayitlari || [];
      const mekanKare = kareKayitlari.reduce((s: number, k: any) => s + (Number(k.frameCount) || 0), 0);
      toplamKare += mekanKare;

      let mekanCiro = 0, mekanSatis = 0, mekanIskonto = 0;

      for (const satis of satislar) {
        const tutar = Number(satis.finalPrice) || 0;
        const iskonto = Number(satis.discount) || 0;
        mekanCiro += tutar;
        mekanSatis++;
        mekanIskonto += iskonto;

        // Ödeme dağılımı
        const pm = String(satis.paymentMethod || "").toLowerCase();
        if (pm.includes("iban") || pm.includes("havale") || pm.includes("transfer")) odemeMap.iban += tutar;
        else if (pm.includes("kart") || pm.includes("card") || pm.includes("kredi")) odemeMap.card += tutar;
        else if (pm.includes("foreign") || pm.includes("doviz") || pm.includes("döviz")) odemeMap.foreign += tutar;
        else odemeMap.cash += tutar;

        // Personel
        const pid = satis.kaydedenId || satis.kaydeden || "bilinmiyor";
        const pad = satis.kaydeden || "Bilinmiyor";
        personelIdSet.add(pid);
        if (!personelMap[pid]) {
          personelMap[pid] = { id: pid, ad: pad, ciro: 0, satisAdet: 0, iskonto: 0, kare: 0, mekanlar: new Set() };
        }
        personelMap[pid].ciro += tutar;
        personelMap[pid].satisAdet++;
        personelMap[pid].iskonto += iskonto;
        personelMap[pid].mekanlar.add(mekan.name);

        // Albüm kırılımı
        const satisItems = satis.items || [];
        const orijToplam = satisItems.reduce((s: number, it: any) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
        const satisRatio = orijToplam > 0 ? tutar / orijToplam : 1;
        for (const item of satisItems) {
          const tip = item.product || "Diğer";
          const adet = Number(item.quantity) || 1;
          const birimFiyat = Number(item.unitPrice) || 0;
          const itemCiro = Math.round(birimFiyat * adet * satisRatio);
          if (!albumMap[tip]) albumMap[tip] = { tip, adet: 0, ciro: 0 };
          albumMap[tip].adet += adet;
          albumMap[tip].ciro += itemCiro;

          // Albüm maliyeti
          const match = String(tip).match(/^(\d+)/);
          if (match) {
            const sz = parseInt(match[1]);
            const al = albums.find((a: any) => Number(a.size) === sz);
            if (al) {
              const printType = mekan.printType || "yarim";
              const birim = printType === "tam" ? Number(al.tamBoy) : Number(al.yarimBoy);
              toplamAlbumMaliyet += adet * toTL(birim, al.currency || "TRY");
            }
          }
        }
      }

      toplamCiro += mekanCiro;
      toplamSatisAdet += mekanSatis;
      toplamIskonto += mekanIskonto;

      // Kare → personel
      for (const kk of kareKayitlari) {
        const pid = kk.photographerId;
        if (!pid) continue;
        personelIdSet.add(pid);
        if (!personelMap[pid]) {
          personelMap[pid] = { id: pid, ad: kk.photographerName || "Bilinmiyor", ciro: 0, satisAdet: 0, iskonto: 0, kare: 0, mekanlar: new Set() };
        }
        personelMap[pid].kare += Number(kk.frameCount) || 0;
        personelMap[pid].mekanlar.add(mekan.name);
      }

      // Anomaliler — kağıt tipi ID → ad çevrimi
      const kagitAdMapGR: Record<string, string> = {};
      for (const pr of (kayit.printerData || [])) {
        if (pr.kagitTipiId && pr.kagitTipiAdi) kagitAdMapGR[pr.kagitTipiId] = pr.kagitTipiAdi;
      }
      const anomDetayStrGR = (detay: Record<string, any>, tip: string): string => {
        return Object.entries(detay).map(([k, v]) => {
          const val = Number(v);
          const farkStr = val > 0 ? `${val} fazla` : `${Math.abs(val)} eksik`;
          if (k.startsWith("ribonlar.")) {
            const tipId = k.replace("ribonlar.", "");
            const ad = kagitAdMapGR[tipId];
            return `${tip === "acilis" ? "Acilista" : "Kapanista"} ${farkStr} takim sayildi${ad ? ` (${ad} kagidi)` : ""}`;
          }
          const alanAd = k.replace("album", "").replace("paspartu", "Paspartu");
          if (k.startsWith("album")) return `${k.replace("album", "")} Fotograf albumu: ${farkStr}`;
          if (k === "paspartu") return `Paspartu: ${farkStr}`;
          return `${k}: ${val > 0 ? "+" : ""}${val}`;
        }).join(", ");
      };

      if (kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0) {
        anomaliler.push({ mekan: mekan.name, mekanEmoji: mekan.emoji, tip: "acilis", aciklama: anomDetayStrGR(kayit.acilisAnomali, "acilis") });
      }
      if (kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0) {
        anomaliler.push({ mekan: mekan.name, mekanEmoji: mekan.emoji, tip: "kapanis", aciklama: anomDetayStrGR(kayit.kapanisAnomali, "kapanis") });
      }
      if (kayit.kapanisYaziciAnomali && kayit.kapanisYaziciAnomali.fark) {
        const fark = kayit.kapanisYaziciAnomali.fark;
        anomaliler.push({ mekan: mekan.name, mekanEmoji: mekan.emoji, tip: "yazici", aciklama: `Net basilan ile satis farki: ${fark > 0 ? "+" : ""}${fark} kare` });
      }

      // Baskı detayı (yazıcı metrikleri)
      const vt = kayit.vardiyaToplam;
      const basilanFotograf = Number(vt?.toplamCikisAdedi) || 0;
      const mekanIadeFotograf = Number(vt?.toplamIadeFotograf) || 0;
      const netSatilanFotograf = Number(vt?.["toplamSatılanFotograf"]) || 0;
      const mekanBaskiMaliyeti = Math.round(Number(vt?.toplamMaliyet) || 0);
      // Birim baskı maliyeti: toplam maliyet / basılan (cikisAdedi değil kullanilanBaskı üzerinden)
      const kullanilanBaski = Number(vt?.["toplamKullanilanBaskı"]) || 0;
      const birimBaskiMaliyeti = kullanilanBaski > 0 ? parseFloat((mekanBaskiMaliyeti / basilanFotograf).toFixed(2)) : 0;

      // Performans verileri
      const mekanMusteriSayisi = kayit.musteriSayisi || 0;
      const mekanKareCharpani = mekan.kareCharpani || 5;
      const mekanKota = mekanMusteriSayisi * mekanKareCharpani;
      const mekanBaskiDonusumYuzde = mekanKare > 0 ? Math.round((basilanFotograf / mekanKare) * 100) : 0;
      // Fotoğrafçı sayısı (kare girişi yapan unique personel)
      const mekanFotografciIds = new Set<string>();
      for (const kk of kareKayitlari) { if (kk.photographerId) mekanFotografciIds.add(kk.photographerId); }
      const mekanFotografciSayisi = mekanFotografciIds.size;
      const mekanKisiBasiKota = mekanFotografciSayisi > 0 ? Math.round(mekanKota / mekanFotografciSayisi) : 0;
      // Kişi başı müşteri
      const mekanKisiBasiMusteri = mekanFotografciSayisi > 0 ? Math.round(mekanMusteriSayisi / mekanFotografciSayisi) : 0;

      // Personel bazlı çekim yüzdesi hesapla (personelMap'e ekle)
      for (const kk of kareKayitlari) {
        const pid = kk.photographerId;
        if (!pid || !personelMap[pid]) continue;
        if (!personelMap[pid]._mekanPerf) personelMap[pid]._mekanPerf = [];
        // Aynı mekana birden fazla kare girişi olabilir, toplamı al
      }
      // Fotoğrafçı bazlı kare toplamı (bu mekanda)
      const fotografciKareBuMekan: Record<string, number> = {};
      for (const kk of kareKayitlari) {
        if (!kk.photographerId) continue;
        fotografciKareBuMekan[kk.photographerId] = (fotografciKareBuMekan[kk.photographerId] || 0) + (Number(kk.frameCount) || 0);
      }
      for (const [pid, pKare] of Object.entries(fotografciKareBuMekan)) {
        if (!personelMap[pid]) continue;
        if (!personelMap[pid]._perfData) personelMap[pid]._perfData = { toplamKota: 0, toplamMusteri: 0, mekanlar: [] };
        const cekimYuzde = mekanKisiBasiKota > 0 ? Math.round((pKare / mekanKisiBasiKota) * 100) : 0;
        personelMap[pid]._perfData.toplamKota += mekanKisiBasiKota;
        personelMap[pid]._perfData.toplamMusteri += mekanKisiBasiMusteri;
        personelMap[pid]._perfData.mekanlar.push({ mekanAd: mekan.name, cekimYuzde, baskiDonusumYuzde: mekanBaskiDonusumYuzde, musteriSayisi: mekanMusteriSayisi, kisiBasiMusteri: mekanKisiBasiMusteri, kota: mekanKota, kisiBasiKota: mekanKisiBasiKota, cektigiKare: pKare });
      }

      mekanOzetleri.push({
        id: kayit.mekanId,
        name: mekan.name,
        emoji: mekan.emoji || "📍",
        color: mekan.color || "#9dd9ea",
        ciro: Math.round(mekanCiro),
        satisAdet: mekanSatis,
        iskonto: Math.round(mekanIskonto),
        kare: mekanKare,
        acilisYapildi: !!kayit.acilisYapildi,
        kapanisYapildi: !!kayit.kapanisYapildi,
        acilisSaat: kayit.acilisZamani ? new Date(kayit.acilisZamani).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }) : null,
        kapanisSaat: kayit.kapanisZamani ? new Date(kayit.kapanisZamani).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }) : null,
        gunlukKira,
        baskiMaliyeti: mekanBaskiMaliyeti,
        basilanFotograf,
        iadeFotograf: mekanIadeFotograf,
        netSatilanFotograf,
        birimBaskiMaliyeti,
        paperName: vt?.paperName || null,
        printType: mekan.printType || "yarim",
        musteriSayisi: mekanMusteriSayisi,
        kareCharpani: mekanKareCharpani,
        kota: mekanKota,
        baskiDonusumYuzde: mekanBaskiDonusumYuzde,
        fotografciSayisi: mekanFotografciSayisi,
        kisiBasiKota: mekanKisiBasiKota,
      });
    }

    mekanOzetleri.sort((a: any, b: any) => b.ciro - a.ciro);

    const albumListesi = Object.values(albumMap).sort((a: any, b: any) => b.adet - a.adet);
    const odemeListesi = Object.entries(odemeMap).filter(([, v]) => v > 0).map(([yontem, ciro]) => ({ yontem, ciro: Math.round(ciro) }));

    // Hakediş gideri hesapla (bantlı + kıdemli — tek gün + çok gün ortak helper)
    const hesaplaPrimGideri = (kayitlar: any[], mekanMapRef: Record<string, any>, rotasyonlar: any[]): number => {
      let topPrim = 0;
      for (const kayit of kayitlar) {
        const mekan = mekanMapRef[kayit.mekanId];
        if (!mekan || !mekan.kotaKademeleri || mekan.kotaKademeleri.length === 0) continue;
        const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
        const ciro = satislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0);
        const mekanAdi = mekan.name || "";
        const seenIds = new Set<string>();
        const rotPersoneller: Array<{id: string; gorev?: string}> = [];
        for (const task of rotasyonlar) {
          if (task.date !== kayit.tarih || !["sent", "revised"].includes(task.status) || task.location !== mekanAdi) continue;
          for (const p of (task.personnel || [])) {
            if (p.id && p.name && !seenIds.has(p.id) && hakedisDahilSet.has(p.id)) {
              seenIds.add(p.id);
              rotPersoneller.push({ id: p.id, gorev: p.gorev });
            }
          }
        }
        if (rotPersoneller.length === 0) rotPersoneller.push({ id: '', gorev: undefined });
        const soloMu = rotPersoneller.length === 1 && !rotPersoneller[0].gorev;

        // Görev bazlı kişi sayıları
        const gorevSayilari: Record<string, number> = {};
        for (const per of rotPersoneller) {
          const g = per.gorev || 'fotograf-satis';
          gorevSayilari[g] = (gorevSayilari[g] || 0) + 1;
        }

        const sortedK = [...mekan.kotaKademeleri].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));
        for (const kademe of sortedK) {
          if (ciro >= Number(kademe.hedef)) {
            for (const per of rotPersoneller) {
              let baseTutar = 0;
              if (soloMu) {
                baseTutar = Number(kademe.primTek) || 0;
              } else {
                const gorev = per.gorev || 'fotograf-satis';
                const gorevKisiSayisi = gorevSayilari[gorev] || 1;
                const bantKey = gorev === 'baski' ? 'baskiBantlar'
                  : gorev === 'album' ? 'albumBantlar'
                  : gorev === 'gozlemci' ? 'gozlemciBantlar'
                  : 'fotografBantlar';

                const bantlar: any[] = kademe[bantKey];
                if (bantlar && Array.isArray(bantlar) && bantlar.length > 0) {
                  const bant = bantlar.find((b: any) => gorevKisiSayisi >= Number(b.min) && gorevKisiSayisi <= Number(b.max));
                  baseTutar = bant ? Number(bant.tutar) || 0 : 0;
                } else {
                  // Geriye uyumluluk: eski sabit alanlar
                  if (gorev === 'baski') baseTutar = Number(kademe.primBaski) || Number(kademe.primCoklu) || 0;
                  else if (gorev === 'album') baseTutar = Number(kademe.primAlbum) || Number(kademe.primCoklu) || 0;
                  else if (gorev === 'gozlemci') baseTutar = Number(kademe.primGozlemci) || 0;
                  else baseTutar = Number(kademe.primFotograf) || Number(kademe.primCoklu) || 0;
                }
              }
              // Kıdem çarpanı
              const kidemSeviye = kidemMap[per.id] || 'kidemsiz';
              const carpan = Number(carpanlar[kidemSeviye]) ?? 1.0;
              topPrim += Math.round(baseTutar * carpan);
            }
          }
        }
      }
      return Math.round(topPrim);
    };

    const toplamPrimGideri = hesaplaPrimGideri(gunKayitlar, mekanMap, tumRotasyonlar || []);

    // Personel bazlı hakediş hesabı (tek gün modu için — bantlı + kıdemli)
    const personelPrimMap: Record<string, number> = {};
    if (!isMultiDay) {
      for (const kayit of gunKayitlar) {
        const mekan = mekanMap[kayit.mekanId];
        if (!mekan || !mekan.kotaKademeleri || mekan.kotaKademeleri.length === 0) continue;
        const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
        const ciro = satislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0);
        const mekanAdi = mekan.name || "";
        const seenIds = new Set<string>();
        const rotPersoneller: Array<{id: string; name: string; gorev?: string}> = [];
        for (const task of (tumRotasyonlar || [])) {
          if (task.date !== kayit.tarih || !["sent", "revised"].includes(task.status) || task.location !== mekanAdi) continue;
          for (const p of (task.personnel || [])) {
            if (p.id && p.name && !seenIds.has(p.id) && hakedisDahilSet.has(p.id)) {
              seenIds.add(p.id);
              rotPersoneller.push({ id: p.id, name: p.name, gorev: p.gorev });
            }
          }
        }
        if (rotPersoneller.length === 0) continue;
        const soloMuP = rotPersoneller.length === 1 && !rotPersoneller[0].gorev;
        // Görev bazlı kişi sayıları
        const gorevSayilariP: Record<string, number> = {};
        for (const per of rotPersoneller) {
          const g = per.gorev || 'fotograf-satis';
          gorevSayilariP[g] = (gorevSayilariP[g] || 0) + 1;
        }
        const sortedK = [...mekan.kotaKademeleri].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));
        for (const kademe of sortedK) {
          if (ciro >= Number(kademe.hedef)) {
            for (const per of rotPersoneller) {
              let baseTutar = 0;
              if (soloMuP) {
                baseTutar = Number(kademe.primTek) || 0;
              } else {
                const gorev = per.gorev || 'fotograf-satis';
                const gorevKisiSayisi = gorevSayilariP[gorev] || 1;
                const bantKey = gorev === 'baski' ? 'baskiBantlar'
                  : gorev === 'album' ? 'albumBantlar'
                  : gorev === 'gozlemci' ? 'gozlemciBantlar'
                  : 'fotografBantlar';
                const bantlar: any[] = kademe[bantKey];
                if (bantlar && Array.isArray(bantlar) && bantlar.length > 0) {
                  const bant = bantlar.find((b: any) => gorevKisiSayisi >= Number(b.min) && gorevKisiSayisi <= Number(b.max));
                  baseTutar = bant ? Number(bant.tutar) || 0 : 0;
                } else {
                  if (gorev === 'baski') baseTutar = Number(kademe.primBaski) || Number(kademe.primCoklu) || 0;
                  else if (gorev === 'album') baseTutar = Number(kademe.primAlbum) || Number(kademe.primCoklu) || 0;
                  else if (gorev === 'gozlemci') baseTutar = Number(kademe.primGozlemci) || 0;
                  else baseTutar = Number(kademe.primFotograf) || Number(kademe.primCoklu) || 0;
                }
              }
              // Kıdem çarpanı
              const kidemSeviye = kidemMap[per.id] || 'kidemsiz';
              const carp = Number(carpanlar[kidemSeviye]) ?? 1.0;
              personelPrimMap[per.id] = (personelPrimMap[per.id] || 0) + Math.round(baseTutar * carp);
            }
          }
        }
      }
    }

    // Geç giriş: personel bazlı (tek gün modu)
    const gecGirisCheckins: any[] = await ckv.getByPrefix("checkin_").catch(() => []) || [];
    const gecGirisPersonelSet = new Set<string>();
    const gecGirisPersonelDk: Record<string, number> = {};
    for (const ci of gecGirisCheckins) {
      if (!ci?.tarih || ci.tarih !== tarih) continue;
      if (ci.lateMin > 0 && ci.userId) {
        gecGirisPersonelSet.add(ci.userId);
        gecGirisPersonelDk[ci.userId] = ci.lateMin;
      }
    }

    // Personel maaş gideri
    let toplamMaasGideri = 0;
    const personelListesi = Object.values(personelMap).map((p: any) => {
      const mekanSayisi = p.mekanlar.size || 1;
      const gunlukMaas = maasById[p.id] ? Math.round(maasById[p.id] / mekanSayisi) : 0;
      toplamMaasGideri += gunlukMaas;
      const primToplam = Math.round(personelPrimMap[p.id] || 0);
      const gecGiris = gecGirisPersonelSet.has(p.id);
      const gecGirisDk = gecGirisPersonelDk[p.id] || 0;
      // Performans verileri
      const perf = p._perfData || null;
      const cekimYuzde = perf && perf.toplamKota > 0 ? Math.round((p.kare / perf.toplamKota) * 100) : null;
      // Baskı dönüşüm: personelin çalıştığı mekanların ortalaması
      const baskiDonusumYuzde = perf && perf.mekanlar.length > 0 ? Math.round(perf.mekanlar.reduce((s: number, m: any) => s + m.baskiDonusumYuzde, 0) / perf.mekanlar.length) : null;

      return {
        id: p.id, ad: p.ad, ciro: Math.round(p.ciro), satisAdet: p.satisAdet,
        iskonto: Math.round(p.iskonto), kare: p.kare, gunlukMaas, primToplam,
        mekanlar: Array.from(p.mekanlar),
        gecGiris, gecGirisDk,
        // Performans
        cekimYuzde,
        baskiDonusumYuzde,
        musteriSayisi: perf?.toplamMusteri || null,
        kisiBasiKota: perf?.toplamKota || null,
        toplamKota: perf?.mekanlar.reduce((s: number, m: any) => s + m.kota, 0) || null,
        toplamMusteri: perf?.mekanlar.reduce((s: number, m: any) => s + m.musteriSayisi, 0) || null,
      };
    }).sort((a: any, b: any) => b.ciro - a.ciro);

    // Kar/Zarar
    const toplamGider = Math.round(toplamBaskiMaliyet + toplamAlbumMaliyet + toplamKira + toplamMaasGideri + toplamPrimGideri);
    const karZarar = Math.round(toplamCiro - toplamGider);

    // ── Çok-gün listesi: her gün için hızlı özet hesapla ──
    const gunlerListesi: any[] = [];
    if (isMultiDay) {
      // Geç giriş sayısı için checkin kayıtlarını çek
      const tumCheckins: any[] = await ckv.getByPrefix("checkin_").catch(() => []) || [];
      const gecGirisByTarih: Record<string, number> = {};
      for (const ci of tumCheckins) {
        if (!ci?.tarih || !(ci.lateMin > 0)) continue;
        gecGirisByTarih[ci.tarih] = (gecGirisByTarih[ci.tarih] || 0) + 1;
      }

      const sortedTarihler = Object.keys(tarihGrup).sort().reverse();
      for (const t of sortedTarihler) {
        const gKayitlar = tarihGrup[t];
        let gCiro = 0, gSatis = 0, gIskonto = 0, gKare = 0, gBaskiMaliyet = 0, gAlbumMaliyet = 0, gKira = 0;
        let gAcilan = 0, gKapanan = 0, gAnomali = 0, gIadeFotograf = 0;
        let gNakit = 0, gIban = 0, gKredi = 0;
        const gMekanlar: string[] = [];
        const gMekanDetay: Record<string, { mekanId: string; mekanAd: string; mekanEmoji: string; ciro: number; satis: number; gider: number }> = {};

        for (const kayit of gKayitlar) {
          const mekan = mekanMap[kayit.mekanId];
          if (!mekan) continue;
          if (kayit.acilisYapildi) gAcilan++;
          if (kayit.kapanisYapildi) gKapanan++;
          gKira += Math.round((Number(mekan.yearlyRents?.[kayit.tarih?.slice(0, 4)]) || Number(mekan.yearlyRent) || 0) / 365);
          if (kayit.vardiyaToplam) {
            gBaskiMaliyet += Number(kayit.vardiyaToplam.toplamMaliyet) || 0;
            gIadeFotograf += Number(kayit.vardiyaToplam.toplamIadeFotograf) || 0;
          }
          const kareK = (kayit.kareKayitlari || []).reduce((s: number, k: any) => s + (Number(k.frameCount) || 0), 0);
          gKare += kareK;
          const hasStokAnomali = (kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0) || (kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0);
          const hasYaziciAnomali = (Array.isArray(kayit.acilisYaziciAnomali) && kayit.acilisYaziciAnomali.length > 0) || (kayit.kapanisYaziciAnomali && kayit.kapanisYaziciAnomali.fark !== undefined);
          if (hasStokAnomali || hasYaziciAnomali) gAnomali++;
          const mekanLabel = `${mekan.emoji || "📍"} ${mekan.name}`;
          gMekanlar.push(mekanLabel);
          if (!gMekanDetay[kayit.mekanId]) gMekanDetay[kayit.mekanId] = { mekanId: kayit.mekanId, mekanAd: mekan.name, mekanEmoji: mekan.emoji || "📍", ciro: 0, satis: 0, gider: 0 };
          // Mekan gider: baskı + kira + hakediş
          const mdBaskiMaliyet = kayit.vardiyaToplam ? (Number(kayit.vardiyaToplam.toplamMaliyet) || 0) : 0;
          const mdKayitYili = kayit.tarih?.slice(0, 4);
          const mdYillikKira = Number(mekan.yearlyRents?.[mdKayitYili]) || Number(mekan.yearlyRent) || 0;
          const mdGunlukKira = Math.round(mdYillikKira / 365);
          const mdHakedis = hakedisGiderByTarihMekan[`${kayit.tarih}_${mekan.name}`] || 0;
          gMekanDetay[kayit.mekanId].gider += mdBaskiMaliyet + mdGunlukKira + mdHakedis;
          const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
          for (const satis of satislar) {
            const sTutar = Number(satis.finalPrice) || 0;
            gCiro += sTutar;
            gSatis++;
            gMekanDetay[kayit.mekanId].ciro += sTutar;
            gMekanDetay[kayit.mekanId].satis++;
            gIskonto += Number(satis.discount) || 0;
            // Ödeme dağılımı
            const sPm = String(satis.paymentMethod || "").toLowerCase();
            if (sPm.includes("iban") || sPm.includes("havale") || sPm.includes("transfer")) gIban += sTutar;
            else if (sPm.includes("kart") || sPm.includes("card") || sPm.includes("kredi")) gKredi += sTutar;
            else gNakit += sTutar;
            // Albüm maliyeti
            for (const item of (satis.items || [])) {
              const match = String(item.product || "").match(/^(\d+)/);
              if (match) {
                const sz = parseInt(match[1]);
                const al = albums.find((a: any) => Number(a.size) === sz);
                if (al) {
                  const printType = mekan.printType || "yarim";
                  const birim = printType === "tam" ? Number(al.tamBoy) : Number(al.yarimBoy);
                  const albumCostGun = (Number(item.quantity) || 1) * toTL(birim, al.currency || "TRY");
                  gAlbumMaliyet += albumCostGun;
                  gMekanDetay[kayit.mekanId].gider += albumCostGun;
                }
              }
            }
          }
          // Mekan maaş (personel bazlı — mekan sayısına böl)
          const mdPIds = new Set<string>();
          for (const s of satislar) { if (s.kaydedenId) mdPIds.add(s.kaydedenId); }
          for (const kk of (kayit.kareKayitlari || [])) { if (kk.photographerId) mdPIds.add(kk.photographerId); }
          for (const pid of mdPIds) {
            const mdMaas = gunlukMaasForGR(pid, t);
            if (mdMaas > 0) {
              // O gün bu personel kaç mekanda?
              let mdMekanSayisi = 0;
              for (const k2 of gKayitlar) {
                const k2Pids = new Set<string>();
                for (const s2 of ((k2.satislar || []).filter((s2: any) => !s2.iptal))) { if (s2.kaydedenId) k2Pids.add(s2.kaydedenId); }
                for (const kk2 of (k2.kareKayitlari || [])) { if (kk2.photographerId) k2Pids.add(kk2.photographerId); }
                if (k2Pids.has(pid)) mdMekanSayisi++;
              }
              gMekanDetay[kayit.mekanId].gider += mdMaas / Math.max(mdMekanSayisi, 1);
            }
          }
        }
        // Maaş gideri basitleştirilmiş
        let gMaas = 0;
        const gPersonelIds = new Set<string>();
        for (const kayit of gKayitlar) {
          for (const s of (kayit.satislar || [])) { if (s.kaydedenId) gPersonelIds.add(s.kaydedenId); }
          for (const k of (kayit.kareKayitlari || [])) { if (k.photographerId) gPersonelIds.add(k.photographerId); }
        }
        for (const pid of gPersonelIds) { gMaas += maasById[pid] || 0; }

        const gPrim = hesaplaPrimGideri(gKayitlar, mekanMap, tumRotasyonlar || []);
        const gGider = Math.round(gBaskiMaliyet + gAlbumMaliyet + gKira + gMaas + gPrim);
        const gKar = Math.round(gCiro - gGider);

        gunlerListesi.push({
          tarih: t,
          toplamCiro: Math.round(gCiro),
          toplamSatisAdet: gSatis,
          toplamIskonto: Math.round(gIskonto),
          toplamKare: gKare,
          acilanMekan: gAcilan,
          kapananMekan: gKapanan,
          toplamMekan: gKayitlar.length,
          toplamGider: gGider,
          karZarar: gKar,
          karMarji: gCiro > 0 ? Math.round((gKar / gCiro) * 100) : 0,
          anomaliSayisi: gAnomali,
          mekanlar: [...new Set(gMekanlar)],
          mekanDetay: Object.values(gMekanDetay).map((md: any) => ({ ...md, ciro: Math.round(md.ciro), gider: Math.round(md.gider), karZarar: Math.round(md.ciro - md.gider) })).sort((a: any, b: any) => b.ciro - a.ciro),
          nakitToplam: Math.round(gNakit),
          ibanToplam: Math.round(gIban),
          krediToplam: Math.round(gKredi),
          gecGirisSayisi: gecGirisByTarih[t] || 0,
          iadeFotograf: gIadeFotograf,
        });
      }
    }

    console.log(`Gün raporu: ${baslangicTarih}–${bitisTarih} — ${isMultiDay ? gunlerListesi.length + " gün" : mekanOzetleri.length + " mekan"}, ₺${toplamCiro} ciro`);
    return c.json({
      tarih,
      baslangic: baslangicTarih,
      bitis: bitisTarih,
      bos: false,
      // Çok-gün modu: gunler listesi
      gunler: isMultiDay ? gunlerListesi : [],
      // Tek-gün modu (detay): mevcut alanlar
      ozet: !isMultiDay ? {
        toplamCiro: Math.round(toplamCiro),
        toplamSatisAdet,
        toplamIskonto: Math.round(toplamIskonto),
        toplamKare,
        toplamBasilanFotograf,
        toplamSatilanFotograf,
        toplamIadeFotograf,
        toplamKullanilanBaski,
        acilanMekan,
        kapananMekan,
        toplamMekan: gunKayitlar.length,
        // Performans özet
        toplamMusteriSayisi: mekanOzetleri.reduce((s: number, m: any) => s + (m.musteriSayisi || 0), 0),
        toplamKota: mekanOzetleri.reduce((s: number, m: any) => s + (m.kota || 0), 0),
        baskiDonusumYuzde: toplamKare > 0 ? Math.round((toplamBasilanFotograf / toplamKare) * 100) : 0,
      } : undefined,
      maliyet: !isMultiDay ? {
        baskiMaliyeti: Math.round(toplamBaskiMaliyet),
        albumMaliyeti: Math.round(toplamAlbumMaliyet),
        kiraGideri: toplamKira,
        maasGideri: toplamMaasGideri,
        primGideri: toplamPrimGideri,
        toplamGider,
        karZarar,
        karMarji: toplamCiro > 0 ? Math.round((karZarar / toplamCiro) * 100) : 0,
      } : undefined,
      mekanlar: !isMultiDay ? mekanOzetleri : undefined,
      personeller: !isMultiDay ? personelListesi : undefined,
      albumler: !isMultiDay ? albumListesi : undefined,
      odemeler: !isMultiDay ? odemeListesi : undefined,
      anomaliler: !isMultiDay ? anomaliler : undefined,
    });

  } catch (err) {
    console.log("Gün raporu error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// GEÇ GİRİŞ SIFIRLA — POST /make-server-4da0b637/vardiya/gec-giris-sifirla
// Body: { baslangic: string, bitis: string, userId?: string }
// baslangic/bitis: YYYY-MM-DD formatında tarih aralığı
// userId verilirse sadece o personel, verilmezse tüm personel
// Sadece yonetici rolü erişebilir
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/vardiya/gec-giris-sifirla", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Bu işlemi yalnızca yönetici yapabilir." }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const baslangic: string = body.baslangic || "";
    const bitis: string = body.bitis || "";
    const userId: string | undefined = body.userId;

    if (!baslangic || !bitis) {
      return c.json({ error: "baslangic ve bitis tarihleri zorunludur." }, 400);
    }

    const ckv = companyKvFor(getCompanyId(user));

    // checkin_ kayıtlarını getir, aralıktakilerin lateMin'ini sıfırla
    // Her kayıt hem aspect: prefixli hem legacy (prefix'siz) olabilir — ikisini de güncelle
    const tumCheckins: any[] = await ckv.getByPrefix("checkin_") || [];
    let sifirlanenCheckin = 0;
    for (const kayit of tumCheckins) {
      if (!kayit?.tarih || !kayit?.userId) continue;
      if (kayit.tarih < baslangic || kayit.tarih > bitis) continue;
      if (userId && kayit.userId !== userId) continue;
      if ((kayit.lateMin || 0) === 0) continue;

      const guncellenmis = { ...kayit, lateMin: 0 };
      const baseKey = `checkin_${kayit.userId}_${kayit.tarih}`;
      await ckv.set(baseKey, guncellenmis);   // aspect:checkin_... (prefixli)
      await kv.set(baseKey, guncellenmis);    // checkin_... (legacy)
      sifirlanenCheckin++;
    }

    // lateNotice_ kayıtlarını sil (ckv.del zaten her iki versiyonu da siler)
    const tumLateNotices: any[] = await ckv.getByPrefix("lateNotice_") || [];
    let silinenNotice = 0;
    for (const kayit of tumLateNotices) {
      if (!kayit?.tarih || !kayit?.userId) continue;
      if (kayit.tarih < baslangic || kayit.tarih > bitis) continue;
      if (userId && kayit.userId !== userId) continue;

      const baseKey = `lateNotice_${kayit.userId}_${kayit.tarih}`;
      await ckv.del(baseKey); // aspect:lateNotice_... ve legacy ikisini de siler
      silinenNotice++;
    }

    console.log(`Geç giriş sıfırlama: ${sifirlanenCheckin} checkin, ${silinenNotice} bildirim | ${baslangic}-${bitis} | kullanıcı=${user.email}`);
    return c.json({ basarili: true, sifirlanenCheckin, silinenNotice });
  } catch (err) {
    console.log("Geç giriş sıfırla error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// AI STATUS — Herkese açık, sadece global durum okur
// GET /make-server-4da0b637/ai/status
// ──────────────────────────────────────────

app.get("/make-server-4da0b637/ai/status", async (c) => {
  try {
    // ai_global_enabled is per-company. Try auth first; fall back to companyId query param.
    let cid: string | null = null;
    try {
      const u = await verifyToken(c);
      if (u) cid = getCompanyId(u);
    } catch (_) { /* no token — ok */ }
    if (!cid) cid = (c.req.query("companyId") || "").toLowerCase() || "aspect";
    const ckv = companyKvFor(cid);
    const globalEnabled = await ckv.get("ai_global_enabled");
    return c.json({ ai_global_enabled: globalEnabled !== null ? Boolean(globalEnabled) : true });
  } catch (err) {
    console.log("AI status GET error:", err);
    return c.json({ ai_global_enabled: true }); // hata durumunda AI açık varsay
  }
});

// ──────────────────────────────────────────
// AI TOGGLE SETTINGS — Yönetici Ayarları
// GET  /make-server-4da0b637/ai/toggle-settings
// POST /make-server-4da0b637/ai/toggle-settings
// KV keys:
//   ai_global_enabled                  → boolean (tüm roller için)
//   ai_personal_yonetici_{userId}      → boolean (yöneticinin kendi modu)
// ──────────────────────────────────────────

app.get("/make-server-4da0b637/ai/toggle-settings", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Bu ayara yalnızca Yönetici erişebilir." }, 403);
    }
    const ckv = companyKvFor(getCompanyId(user));
    const personalKey = `ai_personal_yonetici_${user.id}`;
    const [personalEnabled, yonetimEnabled, idariEnabled, personelEnabled, operasyonEnabled] = await Promise.all([
      ckv.get(personalKey),
      ckv.get("ai_yonetim_enabled"),
      ckv.get("ai_idari_enabled"),
      ckv.get("ai_personel_enabled"),
      ckv.get("ai_operasyon_enabled"),
    ]);
    return c.json({
      ai_personal_yonetici: personalEnabled  !== null ? Boolean(personalEnabled)  : true,
      ai_yonetim_enabled:   yonetimEnabled   !== null ? Boolean(yonetimEnabled)   : true,
      ai_idari_enabled:     idariEnabled      !== null ? Boolean(idariEnabled)      : true,
      ai_personel_enabled:  personelEnabled   !== null ? Boolean(personelEnabled)   : true,
      ai_operasyon_enabled: operasyonEnabled  !== null ? Boolean(operasyonEnabled)  : true,
    });
  } catch (err) {
    console.log("AI toggle-settings GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/ai/toggle-settings", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole !== "yonetici") {
      return c.json({ error: "Bu ayarı yalnızca Yönetici değiştirebilir." }, 403);
    }
    const body = await c.req.json();
    const perRoleKeys = [
      "ai_personal_yonetici",
      "ai_yonetim_enabled",
      "ai_idari_enabled",
      "ai_personel_enabled",
      "ai_operasyon_enabled",
    ];
    for (const key of perRoleKeys) {
      if (typeof body[key] !== "undefined") {
        const ckv = companyKvFor(getCompanyId(user));
        if (key === "ai_personal_yonetici") {
          await ckv.set(`ai_personal_yonetici_${user.id}`, Boolean(body[key]));
          console.log(`[AI Toggle] ai_personal_yonetici_${user.id} → ${body[key]} | ${user.user_metadata?.full_name}`);
        } else {
          await ckv.set(key, Boolean(body[key]));
          console.log(`[AI Toggle] ${key} → ${body[key]} | ${user.user_metadata?.full_name}`);
        }
      }
    }
    return c.json({ ok: true });
  } catch (err) {
    console.log("AI toggle-settings POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// AI CHAT — OpenAI entegrasyonu
// POST /make-server-4da0b637/ai/chat
// Toggle ON  → OpenAI GPT-4o mini kullanır
// Toggle OFF → { use_kv: true } döner, frontend KV motorunu kullanır
// ══════════════════════════════════════════

app.post("/make-server-4da0b637/ai/chat", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    // Body'yi parse et — rol ve kullanıcı adı JWT'den alınır, body'den ALINMAZ (güvenlik)
    const body = await c.req.json();
    const { messages, systemContext, ozet } = body;

    // Rol ve isim JWT'den — body'den gelen userRole/userName güvenlik açığı oluşturur, ignore edilir
    const userRole = (user.user_metadata?.role as string) || "";
    const userName = user.user_metadata?.full_name || user.email || "Kullanıcı";

    console.log(`[AI Chat] Kullanıcı: ${userName} | JWT rol: ${userRole} | body.userRole (yoksayıldı): ${body.userRole ?? "yok"}`);

    // Toggle durumunu belirle — her rol için ayrı KV anahtarı (rol JWT'den, güvenli)
    const userCompanyId = getCompanyId(user);
    const ckv = companyKvFor(userCompanyId);
    let useOpenAI = false;
    if (userRole === "yonetici") {
      const personalKey = `ai_personal_yonetici_${user.id}`;
      const personalEnabled = await ckv.get(personalKey);
      useOpenAI = personalEnabled !== null ? Boolean(personalEnabled) : true;
    } else if (userRole === "ust-mudur" || userRole === "mudur") {
      const val = await ckv.get("ai_yonetim_enabled");
      useOpenAI = val !== null ? Boolean(val) : true;
    } else if (userRole === "idari") {
      const val = await ckv.get("ai_idari_enabled");
      useOpenAI = val !== null ? Boolean(val) : true;
    } else if (userRole === "personel") {
      const val = await ckv.get("ai_personel_enabled");
      useOpenAI = val !== null ? Boolean(val) : true;
    } else if (userRole === "operasyon") {
      const val = await ckv.get("ai_operasyon_enabled");
      useOpenAI = val !== null ? Boolean(val) : true;
    } else {
      // Bilinmeyen rol → varsayılan açık
      useOpenAI = true;
    }

    if (!useOpenAI) {
      return c.json({ use_kv: true }, 200);
    }

    // Şirkete özel OpenAI key — env key hiç kullanılmaz
    const apiKey = await ckv.get("company_openai_key") as string | null;
    if (!apiKey) {
      console.log(`[AI Chat] ${userCompanyId} şirketi için OpenAI key girilmemiş, KV moduna geçiliyor.`);
      return c.json({ use_kv: true }, 200);
    }

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: "messages dizisi gerekli." }, 400);
    }

    // ── Rol bazlı bağlam kurgusu ──────────────────────────────────────────────
    let ozetContext = "";

    if (userRole === "yonetici") {
      // ─ YÖNETİCİ: İzin verisi her zaman çekilir (ozet'ten bağımsız) ──────────
      let izinlerStr     = "  Veri yok.";
      let izinGecmisiStr = "  Veri yok.";
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const allLeaves: any[] = await ckv.getByPrefix("rotation_leave_") || [];
        const bugunIzinliler = allLeaves.filter((l: any) => {
          if (l.status === "rejected") return false;
          const start = l.startDate || l.date || "";
          const end   = l.endDate   || l.date || "";
          return start <= todayStr && todayStr <= end;
        });
        const dailyOnLeaveMap: Record<string, string[]> = await ckv.get("rotation_daily_onleave") || {};
        const gunlukIzinIds: string[] = dailyOnLeaveMap[todayStr] || [];
        let allStaff: any[] = [];
        try {
          const adminSb = getAdminClient();
          const { data: { users: authUsers } } = await adminSb.auth.admin.listUsers({ perPage: 1000 });
          allStaff = (authUsers || []).map((u: any) => ({
            id: u.id,
            name: u.user_metadata?.full_name || u.email || u.id,
            status: u.user_metadata?.status || "active",
          }));
        } catch (se) { console.log("[AI] Staff listesi çekme hatası:", se); }
        const satirListesi: string[] = [];
        const eklenenIds   = new Set<string>();   // ID bazlı dedup
        const eklenenAdlar = new Set<string>();   // isim bazlı ek dedup (ID boş ise)

        const ekle = (id: string | undefined, ad: string, satir: string) => {
          if (id && eklenenIds.has(id)) return;
          const adKey = ad.toLowerCase().trim();
          if (eklenenAdlar.has(adKey)) return;
          satirListesi.push(satir);
          if (id) eklenenIds.add(id);
          eklenenAdlar.add(adKey);
        };

        // Kaynak 1: Resmi izin talepleri — en yüksek öncelik
        for (const l of bugunIzinliler) {
          const ad    = l.personnelName || l.staffName || l.name || "Bilinmeyen";
          const tip   = l.type === "annual" ? "Yıllık İzin" : l.type === "sick" ? "Hastalık" : l.type === "personal" ? "Mazeret" : (l.leaveType || l.type || "İzin");
          const bas   = l.startDate || l.date || "?";
          const bit   = l.endDate   || l.date || "?";
          const durum = l.status === "approved" ? "✅ Onaylı" : "⏳ Bekliyor";
          ekle(l.personnelId, ad, `  • ${ad}: ${tip} | ${bas} → ${bit} | ${durum}`);
        }

        // Kaynak 2: Günlük manuel izin — sadece Kaynak 1'de olmayanlar
        for (const staffId of gunlukIzinIds) {
          const staff = allStaff.find((s: any) => s.id === staffId);
          const ad = staff?.name || staffId;
          ekle(staffId, ad, `  • ${ad}: Günlük İzin | ${todayStr} | ✅ Manuel`);
        }

        // Kaynak 3: Sabit on_leave statüsü — sadece diğer kaynaklarda olmayanlar
        for (const s of allStaff) {
          if (s.status === "on_leave") {
            ekle(s.id, s.name, `  • ${s.name}: Sabit İzin (süregelen)`);
          }
        }

        izinlerStr = satirListesi.length > 0 ? satirListesi.join("\n") : "  Bugün izinli personel yok.";

        // ── Tüm izin geçmişi (son 90 gün + gelecek talepler) ──────────────────
        const doksonGunOnce = new Date();
        doksonGunOnce.setDate(doksonGunOnce.getDate() - 90);
        const doksonGunStr = doksonGunOnce.toISOString().split("T")[0];

        const gecmisVeGelecek = allLeaves
          .filter((l: any) => l.status !== "rejected" && (l.endDate || l.date || "") >= doksonGunStr)
          .sort((a: any, b: any) => (b.startDate || b.date || "").localeCompare(a.startDate || a.date || ""));

        if (gecmisVeGelecek.length > 0) {
          const gecmisLines = gecmisVeGelecek.slice(0, 80).map((l: any) => {
            const ad    = l.personnelName || l.staffName || l.name || "Bilinmeyen";
            const tip   = l.type === "annual" ? "Yıllık" : l.type === "sick" ? "Hastalık" : l.type === "personal" ? "Mazeret" : (l.type || "İzin");
            const bas   = l.startDate || l.date || "?";
            const bit   = l.endDate   || l.date || "?";
            const durum = l.status === "approved" ? "Onaylı" : "Bekliyor";
            return `  • ${ad}: ${tip} | ${bas} → ${bit} | ${durum}`;
          });
          izinGecmisiStr = gecmisLines.join("\n");
        } else {
          izinGecmisiStr = "  Son 90 günde onaylı/bekleyen izin kaydı yok.";
        }

        // Günlük izin geçmişini de ekle
        const gunlukGecmis: string[] = [];
        for (const [tarih, ids] of Object.entries(dailyOnLeaveMap as Record<string, string[]>)) {
          if (tarih < doksonGunStr) continue;
          for (const sid of (ids || [])) {
            const staff = allStaff.find((s: any) => s.id === sid);
            const ad = staff?.name || sid;
            gunlukGecmis.push(`  • ${ad}: Günlük İzin | ${tarih}`);
          }
        }
        if (gunlukGecmis.length > 0) {
          izinGecmisiStr += "\n\nGÜNLÜK MANUEL İZİNLER (son 90 gün):\n" + gunlukGecmis.sort().reverse().slice(0, 30).join("\n");
        }
      } catch (e) {
        console.log("[AI] Yönetici izin çekme hatası:", e);
      }

      // ─ YÖNETİCİ: tüm operasyonel veriler ─

      // ── Mekan detayları (kira, sayfa tipi, fotoğraf fiyatı) ──
      let mekanDetayStr = "  Veri yok.";
      try {
        const mekanlarDetay: any[] = await getMekanlarFor(userCompanyId);
        if (mekanlarDetay.length > 0) {
          // Döviz kurları (birim maliyet için)
          const mekanExRates: any = await ckv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20 };
          // Kağıt adını ID üzerinden çözmek için tüm kağıtları çek
          const tumKagitlar: any[] = await ckv.getByPrefix("cost_paper_").catch(() => []) || [];
          const kagitById: Record<string, string> = {};
          for (const k of tumKagitlar) {
            if (k.id && k.name) kagitById[k.id] = k.name;
          }
          mekanDetayStr = mekanlarDetay
            .filter((m: any) => m.id && m.name && m.created_by !== undefined)
            .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
            .map((m: any) => {
              const yillikKira = Number(m.yearlyRent) || 0;
              const aylikKira = Math.round(yillikKira / 12);
              const gunlukKira = Math.round(yillikKira / 365);
              const sayfaTipi = m.printType === "tam" ? "Tam Sayfa" : m.printType === "yarim" ? "Yarım Sayfa" : m.printType || "Bilinmiyor";
              const fotFiyat = Number(m.photoPrice) || 0;
              const calisma = m.workingHours ? `${m.workingHours.start || "?"} - ${m.workingHours.end || "?"}` : "Belirtilmemiş";
              // paperType: önce ID ile isim çöz, bulamazsan direkt değeri göster
              let kagitTipi = "Belirtilmemiş";
              let kagitMaliyetEk = "";
              if (m.paperType) {
                const kagitObj = tumKagitlar.find((k: any) => k.id === m.paperType || k.name === m.paperType);
                if (kagitObj) {
                  kagitTipi = kagitObj.name;
                  const kKur = kagitObj.currency === "EUR" ? (Number(mekanExRates?.EUR) || 35.5) : kagitObj.currency === "USD" ? (Number(mekanExRates?.USD) || 32.8) : kagitObj.currency === "GBP" ? (Number(mekanExRates?.GBP) || 41.2) : 1;
                  const kPcs = Number(kagitObj.pcsPerBox) || 1;
                  const kBirim = (Number(kagitObj.boxPrice) || 0) / kPcs * kKur;
                  const fotBasiMaliyet = m.printType === "yarim" ? kBirim / 2 : kBirim;
                  const baskiTipiAciklama = m.printType === "yarim"
                    ? `Yarım Sayfa: 1 baskıdan 2 fotoğraf çıkar, birim baskı ₺${kBirim.toFixed(2)} ÷ 2 = 1 fotoğraf ≈₺${fotBasiMaliyet.toFixed(2)}`
                    : `Tam Sayfa: 1 baskıdan 1 fotoğraf çıkar, 1 fotoğraf ≈₺${fotBasiMaliyet.toFixed(2)}`;
                  kagitMaliyetEk = ` | ⚠️ 1 FOTOĞRAF ÜRETİM MALİYETİ: ≈₺${fotBasiMaliyet.toFixed(2)} TRY (${baskiTipiAciklama})`;
                } else {
                  kagitTipi = kagitById[m.paperType] || m.paperType;
                }
              }
              return `  • ${m.emoji || "📍"} ${m.name}:\n    - SATIŞ FİYATI (müşteri öder, maliyet DEĞİL): ₺${fotFiyat} / kare\n    - Baskı tipi: ${sayfaTipi}\n    - Kağıt tipi: ${kagitTipi}${kagitMaliyetEk}\n    - Yıllık kira: ₺${yillikKira.toLocaleString("tr-TR")} (aylık ≈₺${aylikKira.toLocaleString("tr-TR")}, günlük ≈₺${gunlukKira.toLocaleString("tr-TR")})\n    - Çalışma saatleri: ${calisma}`;
            }).join("\n");
        }
      } catch (e) {
        console.log("[AI] Mekan detay hatası:", e);
      }

      // ── Albüm fiyat listesi (mekan bazlı photoPrice × kare) ──
      let albumFiyatStr = "  Veri yok.";
      try {
        const mekanlarFiyat: any[] = await getMekanlarFor(userCompanyId);
        const fiyatliMekanlar = mekanlarFiyat.filter((m: any) => m.id && m.name && Number(m.photoPrice) > 0);
        if (fiyatliMekanlar.length > 0) {
          albumFiyatStr = fiyatliMekanlar
            .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
            .map((m: any) => {
              const pp = Number(m.photoPrice) || 0;
              const kareler = [3, 5, 7, 9, 11, 13, 15].map(k => `${k} Kare: ₺${pp * k}`).join(", ");
              return `  • ${m.emoji || "📍"} ${m.name}: 1 Kare=₺${pp} | ${kareler}`;
            }).join("\n");
        }
      } catch (e) {
        console.log("[AI] Albüm fiyat hesaplama hatası:", e);
      }

      // ── Maliyet / Malzeme yönetimi ──
      let maliyetStr = "  Veri yok.";
      try {
        const exRates: any = await ckv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20 };
        const albumMaliyetler: any = await ckv.get("cost_albums") || [];
        const kagitlar: any[] = await ckv.getByPrefix("cost_paper_") || [];
        const giderler: any[] = await ckv.getByPrefix("cost_recurring_") || [];
        const maaslar: any[] = await ckv.getByPrefix("cost_salary_") || [];

        const dovizStr = `EUR: ${exRates.EUR || 35.5} ₺, USD: ${exRates.USD || 32.8} ₺, GBP: ${exRates.GBP || 41.2} ₺`;

        const albumMalStr = Array.isArray(albumMaliyetler) && albumMaliyetler.length > 0
          ? albumMaliyetler.map((a: any) => {
              const kur = a.currency === "EUR" ? (exRates.EUR || 35.5) : a.currency === "USD" ? (exRates.USD || 32.8) : 1;
              const tamTRY = a.currency === "TRY" ? a.tamBoy : Math.round(a.tamBoy * kur);
              const yarimTRY = a.currency === "TRY" ? a.yarimBoy : Math.round(a.yarimBoy * kur);
              return `${a.size} Kare: Tam=${a.tamBoy}${a.currency}(≈₺${tamTRY}) Yarım=${a.yarimBoy}${a.currency}(≈₺${yarimTRY})`;
            }).join(", ")
          : "Girilmemiş";

        const kagitStr = kagitlar.length > 0
          ? kagitlar.map((p: any) => {
              const kur = p.currency === "EUR" ? (exRates.EUR || 35.5) : p.currency === "USD" ? (exRates.USD || 32.8) : p.currency === "GBP" ? (exRates.GBP || 41.2) : 1;
              const pcs = Number(p.pcsPerBox) || 1;
              const sets = Number(p.setsPerBox) || 1;
              const boxPrice = Number(p.boxPrice) || 0;
              const birimBaskiOrijinal = boxPrice / pcs;
              const birimBaskiTRY = birimBaskiOrijinal * kur;
              return `${p.name || "Kağıt"}: Kutu=${boxPrice} ${p.currency || "TRY"} / ${pcs} baskı, 1 baskı ≈₺${birimBaskiTRY.toFixed(2)} TRY (kutu içi takım: ${sets})`;
            }).join(" | ")
          : "Girilmemiş";

        const giderStr = giderler.length > 0
          ? giderler.map((g: any) => {
              const kur = g.currency === "EUR" ? (exRates.EUR || 35.5) : g.currency === "USD" ? (exRates.USD || 32.8) : 1;
              const tutarTRY = g.currency === "TRY" ? g.amount : Math.round(g.amount * kur);
              return `${g.name || g.category || "Gider"}: ₺${Number(tutarTRY).toLocaleString("tr-TR")}/ay`;
            }).join(" | ")
          : "Girilmemiş";

        const maasStr = maaslar.length > 0
          ? maaslar.map((s: any) => `${s.name || s.role || "Personel"}: ₺${Number(s.amount || s.salary || 0).toLocaleString("tr-TR")}/ay`).join(" | ")
          : "Girilmemiş";

        const toplamGider = [
          ...giderler.map((g: any) => {
            const kur = g.currency === "EUR" ? (exRates.EUR || 35.5) : g.currency === "USD" ? (exRates.USD || 32.8) : 1;
            return g.currency === "TRY" ? Number(g.amount) : Math.round(g.amount * kur);
          }),
          ...maaslar.map((s: any) => Number(s.amount || s.salary || 0)),
        ].reduce((sum: number, v: number) => sum + v, 0);

        // ── Bugünkü mekan bazlı baskı maliyet özeti (vardiyaToplam) ──
        let bugunBaskiMaliyetStr = "  Henüz kapanış yapılmadı veya veri yok.";
        try {
          const bugunStr = new Date().toISOString().split("T")[0];
          const tumBugunKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
          const bugunKayitlar = tumBugunKayitlar.filter((k: any) => k.tarih === bugunStr && k.vardiyaToplam);
          if (bugunKayitlar.length > 0) {
            const mekanlarBugun: any[] = await getMekanlarFor(userCompanyId);
            const mekanMapBugun: Record<string, any> = {};
            for (const m of mekanlarBugun) mekanMapBugun[m.id] = m;
            const satirlar = bugunKayitlar.map((k: any) => {
              const m = mekanMapBugun[k.mekanId] || { name: k.mekanId, emoji: "📍" };
              const vt = k.vardiyaToplam;
              return `  • ${m.emoji || "📍"} ${m.name}: kullanılan baskı=${vt.toplamKullanilanBaskı || 0}, kağıt=${vt.paperName || "?"}, birim maliyet=₺${Number(vt.birimMaliyet || 0).toFixed(4)}, toplam maliyet=₺${Number(vt.toplamMaliyet || 0).toFixed(2)}, baskı tipi=${vt.printType || "?"}, döviz kur=${vt.kurCarpani || 1}`;
            });
            bugunBaskiMaliyetStr = satirlar.join("\n");
          }
        } catch (e) { console.log("[AI] Bugün baskı maliyet hatası:", e); }

        maliyetStr = `Döviz Kurları: ${dovizStr}\n  Albüm Üretim Maliyetleri: ${albumMalStr}\n  Kağıt/Malzeme Tanımları:\n  ${kagitStr}\n  Düzenli Giderler: ${giderStr}\n  Maaşlar: ${maasStr}\n  Toplam Aylık Sabit Gider (tahmini): ₺${toplamGider.toLocaleString("tr-TR")}\n\nBUGÜN MEKAN BAZLI BASKI MALİYETİ (kapanış verisinden):\n${bugunBaskiMaliyetStr}`;
      } catch (e) {
        console.log("[AI] Maliyet veri hatası:", e);
      }

      // ── Mekan × Albüm Boyutu Üretim Maliyet Tablosu (PRE-COMPUTED) ──
      let mekanAlbumMaliyetTabloStr = "  Veri yok.";
      try {
        const exRatesTablo: any = await ckv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20 };
        const albumMaliyetlerTablo: any[] = await ckv.get("cost_albums") || [];
        const kagitlarTablo: any[] = await ckv.getByPrefix("cost_paper_") || [];
        const mekanlarTablo: any[] = await getMekanlar();

        const albumMalMapT: Record<string, { tam: number; yarim: number }> = {};
        for (const a of albumMaliyetlerTablo) {
          const kur = a.currency === "EUR" ? (Number(exRatesTablo.EUR) || 35.5)
            : a.currency === "USD" ? (Number(exRatesTablo.USD) || 32.8)
            : a.currency === "GBP" ? (Number(exRatesTablo.GBP) || 41.2) : 1;
          albumMalMapT[String(a.size)] = {
            tam: a.currency === "TRY" ? Number(a.tamBoy) : Math.round(Number(a.tamBoy) * kur * 100) / 100,
            yarim: a.currency === "TRY" ? Number(a.yarimBoy) : Math.round(Number(a.yarimBoy) * kur * 100) / 100,
          };
        }

        const albumBoyutlari = [3, 5, 7, 9, 11, 13, 15];
        const tablosatirlar: string[] = [];

        for (const mekan of mekanlarTablo) {
          if (!mekan.id || !mekan.name) continue;
          const printType: string = mekan.printType || "tam";

          let fotBasiMaliyet = 0;
          if (mekan.paperType) {
            const kagitObj = kagitlarTablo.find((p: any) =>
              p.id === mekan.paperType || p.name === mekan.paperType
            );
            if (kagitObj) {
              const kKur = kagitObj.currency === "EUR" ? (Number(exRatesTablo.EUR) || 35.5)
                : kagitObj.currency === "USD" ? (Number(exRatesTablo.USD) || 32.8)
                : kagitObj.currency === "GBP" ? (Number(exRatesTablo.GBP) || 41.2) : 1;
              const kPcs = Number(kagitObj.pcsPerBox) || 1;
              const kBirim = (Number(kagitObj.boxPrice) || 0) / kPcs * kKur;
              fotBasiMaliyet = printType === "yarim" ? kBirim / 2 : kBirim;
            }
          }

          const mekanSatirlari: string[] = [
            `  ${mekan.emoji || "📍"} ${mekan.name} (${printType === "yarim" ? "Yarım Sayfa" : "Tam Sayfa"}, fotoğraf başı baskı maliyeti: ₺${fotBasiMaliyet.toFixed(2)}):`
          ];
          for (const boyut of albumBoyutlari) {
            const albumMal = albumMalMapT[String(boyut)];
            const kapakMaliyet = albumMal ? (printType === "yarim" ? albumMal.yarim : albumMal.tam) : 0;
            const baskiMaliyet = Math.round(boyut * fotBasiMaliyet * 100) / 100;
            const birimToplam = Math.round((kapakMaliyet + baskiMaliyet) * 100) / 100;
            mekanSatirlari.push(
              `    • ${boyut} Kare Albüm → kapak ₺${Math.round(kapakMaliyet)} + ${boyut}×baskı ₺${Math.round(baskiMaliyet)} = BİRİM ÜRETİM MALİYETİ ₺${Math.round(birimToplam)}`
            );
          }
          tablosatirlar.push(mekanSatirlari.join("\n"));
        }

        if (tablosatirlar.length > 0) mekanAlbumMaliyetTabloStr = tablosatirlar.join("\n");
      } catch (e) { console.log("[AI] Mekan-albüm maliyet tablo hatası:", e); }

      // ── Merkez Depo Stok ──
      let depoStokStr = "  Veri yok.";
      const albumEtikDepo: Record<string, string> = {
        album3: "3 Kare", album5: "5 Kare", album7: "7 Kare", album9: "9 Kare",
        album11: "11 Kare", album13: "13 Kare", album15: "15 Kare",
        paspartu: "Paspartu", ribon: "Ribon (takım)"
      };
      let depoStokObj: Record<string, number> = {};
      try {
        const depoStok: any = await ckv.get("depo_stok") || {};
        depoStokObj = depoStok;
        const depoLines = Object.entries(albumEtikDepo).map(([key, label]) => {
          const adet = Number(depoStok[key]) || 0;
          return `  • ${label}: ${adet} adet`;
        });
        if (depoLines.length > 0) depoStokStr = depoLines.join("\n");
      } catch (e) { console.log("[AI] Depo stok hatası:", e); }

      // ── Mekan Anlık Stok (KV'den doğrudan çekilen en son kapanış/açılış stoğu) ──
      // Frontend'den bağımsız — kapanış girilmese bile en son kayıtlı stoğu gösterir
      let mekanAnlikStokStr = "  Veri yok.";
      const tumStokByKey: Record<string, number> = {};
      try {
        const tumGunlukAI: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
        const mekanlarAI: any[] = await getMekanlarFor(userCompanyId);
        // Her mekan için en son kapanış stoğunu (yoksa açılış stoğunu) bul
        const mekanSonStok: Record<string, { tarih: string; stok: Record<string, number>; tip: string }> = {};
        for (const kayit of tumGunlukAI) {
          if (!kayit.mekanId || !kayit.tarih) continue;
          // KV'de kapanış "kapanish", açılış "acilis" olarak kayıtlı (eski isimlere de fallback)
          const stokAlacak = kayit.kapanish || kayit.kapanisStok || kayit.acilis || kayit.acilisStok;
          if (!stokAlacak) continue;
          const mevcut = mekanSonStok[kayit.mekanId];
          if (!mevcut || kayit.tarih > mevcut.tarih) {
            mekanSonStok[kayit.mekanId] = {
              tarih: kayit.tarih,
              stok: stokAlacak,
              tip: (kayit.kapanish || kayit.kapanisStok) ? "kapanış" : "açılış",
            };
          }
        }
        const mekanAnlikLines: string[] = [];
        for (const mekan of mekanlarAI) {
          if (!mekan.id) continue;
          const sonStokData = mekanSonStok[mekan.id];
          if (!sonStokData) {
            mekanAnlikLines.push(`  ${mekan.emoji || "📍"} ${mekan.name}: Stok kaydı henüz yok`);
            continue;
          }
          const stokSatirlar = Object.entries(albumEtikDepo).map(([key, label]) => {
            const adet = Number(sonStokData.stok[key]) || 0;
            tumStokByKey[key] = (tumStokByKey[key] || 0) + adet;
            return `${label}: ${adet}`;
          }).join(", ");
          mekanAnlikLines.push(`  ${mekan.emoji || "📍"} ${mekan.name} (son kayıt: ${sonStokData.tarih} ${sonStokData.tip}): ${stokSatirlar}`);
        }
        if (mekanAnlikLines.length > 0) mekanAnlikStokStr = mekanAnlikLines.join("\n");
        // Depo stoğunu da genel toplama ekle
        for (const [key] of Object.entries(albumEtikDepo)) {
          tumStokByKey[key] = (tumStokByKey[key] || 0) + (Number(depoStokObj[key]) || 0);
        }
      } catch (e) { console.log("[AI] Mekan anlık stok hatası:", e); }

      // Tüm lokasyonlar toplamı (merkez depo + tüm mekanlar)
      const genelToplamStokStr = Object.entries(albumEtikDepo)
        .map(([key, label]) => `  • ${label}: ${tumStokByKey[key] || 0} adet`)
        .join("\n");

      // ── İşletme Gider Kayıtları (son 30 gün) ──
      let isletmeGiderStr = "  Veri yok.";
      try {
        const tumGiderlerAI: any[] = await ckv.getByPrefix("isletme_gider_") || [];
        if (tumGiderlerAI.length > 0) {
          const son30gAI = new Date(); son30gAI.setDate(son30gAI.getDate() - 30);
          const son30StrAI = son30gAI.toISOString().split("T")[0];
          const filtreGiderAI = tumGiderlerAI.filter((g: any) => (g.date || g.created_at || "") >= son30StrAI);
          const siraliGiderAI = filtreGiderAI.sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));
          const toplamGiderAI = filtreGiderAI.reduce((s: number, g: any) => s + (Number(g.amount) || 0), 0);
          const katBazli: Record<string, number> = {};
          for (const g of filtreGiderAI) {
            const kat = g.odemeTipi || g.category || "Diğer";
            katBazli[kat] = (katBazli[kat] || 0) + (Number(g.amount) || 0);
          }
          const katStr = Object.entries(katBazli).sort(([,a],[,b]) => b - a)
            .map(([kat, top]) => `${kat}: ₺${Number(top).toLocaleString("tr-TR")}`).join(" | ");
          const sonKayitlarGider = siraliGiderAI.slice(0, 20).map((g: any) =>
            `  • ${(g.date || g.created_at || "?").slice(0,10)} — ${g.description || g.category || "?"}: ₺${Number(g.amount || 0).toLocaleString("tr-TR")}${g.currency && g.currency !== "TRY" ? ` ${g.currency}` : ""}${g.personelAdi ? ` (${g.personelAdi})` : ""}`
          ).join("\n");
          isletmeGiderStr = `Son 30 gün toplam: ₺${toplamGiderAI.toLocaleString("tr-TR")} | Kategori: ${katStr}\nSon kayıtlar:\n${sonKayitlarGider}`;
        }
      } catch (e) { console.log("[AI] İşletme gider hatası:", e); }

      // ── Ekipman / Malzeme Listesi ──
      let ekipmanStr = "  Veri yok.";
      try {
        const tumEkipmanlarAI: any[] = await ckv.getByPrefix("ekipman_") || [];
        if (tumEkipmanlarAI.length > 0) {
          const statusLabelAI: Record<string, string> = {
            active: "✅ Aktif", maintenance: "🔧 Bakımda", broken: "❌ Arızalı", retired: "⬛ Emekli"
          };
          const katEkipman: Record<string, any[]> = {};
          for (const e of tumEkipmanlarAI) {
            const kat = e.category || "Diğer";
            if (!katEkipman[kat]) katEkipman[kat] = [];
            katEkipman[kat].push(e);
          }
          const ekipmanLines: string[] = [];
          for (const [kat, liste] of Object.entries(katEkipman)) {
            const aktifSayisi = liste.filter((e: any) => e.status === "active").length;
            const arizaliSayisi = liste.filter((e: any) => e.status === "broken").length;
            ekipmanLines.push(`  ${kat} — ${liste.length} adet (${aktifSayisi} aktif${arizaliSayisi > 0 ? `, ${arizaliSayisi} arızalı` : ""}):`);
            for (const e of liste.slice(0, 25)) {
              const durum = statusLabelAI[e.status] || e.status || "?";
              ekipmanLines.push(`    - ${e.brand || ""} ${e.model || ""} | S/N: ${e.serialNumber || "?"} | Konum: ${e.location || "?"} | ${durum}${e.notes ? ` | Not: ${e.notes}` : ""}`);
            }
          }
          ekipmanStr = ekipmanLines.join("\n");
        }
      } catch (e) { console.log("[AI] Ekipman listesi hatası:", e); }

      // ── Mekan Ziyaret Kayıtları (son 90 gün) ──
      let ziyaretStr = "  Veri yok.";
      try {
        const tumZiyaretlerAI: any[] = await ckv.getByPrefix("mekan_ziyaret_") || [];
        if (tumZiyaretlerAI.length > 0) {
          const son90z = new Date(); son90z.setDate(son90z.getDate() - 90);
          const son90zStr = son90z.toISOString().split("T")[0];
          const filtreZ = tumZiyaretlerAI
            .filter((z: any) => (z.visitDate || z.date || z.created_at || "") >= son90zStr)
            .sort((a: any, b: any) => (b.visitDate || b.date || "").localeCompare(a.visitDate || a.date || ""));
          if (filtreZ.length > 0) {
            ziyaretStr = filtreZ.slice(0, 20).map((z: any) =>
              `  • ${(z.visitDate || z.date || "?").slice(0,10)} — ${z.locationName || z.mekanAdi || z.location || "?"}: ${z.notes || z.note || z.description || "Not yok"} (Ziyaretçi: ${z.visitorName || z.created_by || "?"})`
            ).join("\n");
          } else {
            ziyaretStr = "  Son 90 günde ziyaret kaydı yok.";
          }
        }
      } catch (e) { console.log("[AI] Ziyaret hatası:", e); }

      // ── Müdür Raporları (son 90 gün) ──
      let mudurRaporStr = "  Veri yok.";
      try {
        const tumRaporlarAI: any[] = await ckv.getByPrefix("mudur_rapor_") || [];
        if (tumRaporlarAI.length > 0) {
          const son90r = new Date(); son90r.setDate(son90r.getDate() - 90);
          const son90rStr = son90r.toISOString().split("T")[0];
          const filtreR = tumRaporlarAI
            .filter((r: any) => (r.created_at || r.startDate || "") >= son90rStr)
            .sort((a: any, b: any) => (b.created_at || b.startDate || "").localeCompare(a.created_at || a.startDate || ""));
          if (filtreR.length > 0) {
            mudurRaporStr = filtreR.slice(0, 20).map((r: any) =>
              `  • ${(r.created_at || r.startDate || "?").slice(0,10)} — Müdür: ${r.managerName || "?"} | Başlık: ${r.title || r.type || r.reportType || "?"} | ${r.summary || r.notes || r.content || r.description || "İçerik yok"}`
            ).join("\n");
          } else {
            mudurRaporStr = "  Son 90 günde müdür raporu yok.";
          }
        }
      } catch (e) { console.log("[AI] Müdür raporu hatası:", e); }

      // ── Aktif Duyurular ──
      let duyuruStr = "  Aktif duyuru yok.";
      try {
        const tumDuyurularAI: any[] = await ckv.getByPrefix("announcement_") || [];
        if (tumDuyurularAI.length > 0) {
          const bugunDuyuru = new Date().toISOString().split("T")[0];
          const aktifDuyurular = tumDuyurularAI
            .filter((d: any) => {
              if (d.isActive === false) return false;
              const bitis = d.endDate || d.expiresAt || "";
              if (bitis && bitis < bugunDuyuru) return false;
              return true;
            })
            .sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
          if (aktifDuyurular.length > 0) {
            duyuruStr = aktifDuyurular.slice(0, 15).map((d: any) =>
              `  • [${d.type || d.category || d.targetRole || "Genel"}] ${d.title || d.subject || "?"}: ${d.content || d.message || d.description || d.body || ""} (${(d.created_at || "?").slice(0,10)})`
            ).join("\n");
          }
        }
      } catch (e) { console.log("[AI] Duyuru hatası:", e); }

      // ── Mekan Bazlı Günlük Operasyon Geçmişi (son 30 gün, bugün hariç) ──
      let mekanGunlukGecmisStr = "";
      try {
        const tumGunlukKayitlarGecmis: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
        const mekanlarGecmis: any[] = await getMekanlarFor(userCompanyId);
        const mekanMapGecmis: Record<string, any> = {};
        for (const m of mekanlarGecmis) mekanMapGecmis[m.id] = m;

        // ── Üretim maliyeti hesabı için maliyet verilerini çek ──
        const exRatesGecmis: any = await ckv.get("cost_exchange_rates").catch(() => ({})) || { EUR: 35.50, USD: 32.80, GBP: 41.20 };
        const albumMaliyetlerGecmis: any[] = await ckv.get("cost_albums").catch(() => []) || [];
        const kagitlarGecmis: any[] = await ckv.getByPrefix("cost_paper_").catch(() => []) || [];

        // Mekan başına 1 fotoğraf baskı maliyeti (kağıt/yazıcı, printType göz önüne alınarak)
        const mekanFotMaliyetMap: Record<string, number> = {};
        for (const m of mekanlarGecmis) {
          if (!m.id || !m.paperType) continue;
          const kagitObj = kagitlarGecmis.find((k: any) => k.id === m.paperType || k.name === m.paperType);
          if (!kagitObj) continue;
          const kKur2 = kagitObj.currency === "EUR" ? (Number(exRatesGecmis.EUR) || 35.5) : kagitObj.currency === "USD" ? (Number(exRatesGecmis.USD) || 32.8) : kagitObj.currency === "GBP" ? (Number(exRatesGecmis.GBP) || 41.2) : 1;
          const kPcs2 = Number(kagitObj.pcsPerBox) || 1;
          const kBirim2 = (Number(kagitObj.boxPrice) || 0) / kPcs2 * kKur2;
          // Yarım sayfa: 1 baskıdan 2 fotoğraf çıkar, fotoğraf başı maliyet = birim/2
          mekanFotMaliyetMap[m.id] = m.printType === "yarim" ? kBirim2 / 2 : kBirim2;
        }

        // Albüm kapak/cilt maliyeti (cost_albums): size → { tam: ₺X, yarim: ₺Y }
        const albumMalMap: Record<string, { tam: number; yarim: number }> = {};
        if (Array.isArray(albumMaliyetlerGecmis)) {
          for (const a of albumMaliyetlerGecmis) {
            const kur2 = a.currency === "EUR" ? (Number(exRatesGecmis.EUR) || 35.5) : a.currency === "USD" ? (Number(exRatesGecmis.USD) || 32.8) : a.currency === "GBP" ? (Number(exRatesGecmis.GBP) || 41.2) : 1;
            albumMalMap[String(a.size)] = {
              tam: a.currency === "TRY" ? Number(a.tamBoy) : Math.round(Number(a.tamBoy) * kur2),
              yarim: a.currency === "TRY" ? Number(a.yarimBoy) : Math.round(Number(a.yarimBoy) * kur2),
            };
          }
        }

        // Geçerli albüm kare sayıları
        const GECERLI_ALBUM_KARELER = [3, 5, 7, 9, 11, 13, 15];
        // Ürün adından kare sayısını çıkar: "5 Kare", "5 Kare Albüm", "5'li Albüm", "5li Albüm", vb.
        const extractKare = (product: string): number | null => {
          const m = product.match(/^(\d+)\s*(?:Kare|'?li)/i);
          if (!m) return null;
          const n = Number(m[1]);
          return GECERLI_ALBUM_KARELER.includes(n) ? n : null;
        };

        // Ürün başına üretim maliyeti: kapak + (kare × baskı) ayrıştırılmış
        const hesaplaUretimMaliyeti = (product: string, qty: number, mekanId: string): string => {
          const fotBasiMaliyet = mekanFotMaliyetMap[mekanId] || 0;
          const mekan = mekanMapGecmis[mekanId];
          const printType = mekan?.printType || "tam";
          const kare = extractKare(product);
          if (kare !== null) {
            const albumMal = albumMalMap[String(kare)];
            const kapakMaliyet = albumMal ? (printType === "yarim" ? albumMal.yarim : albumMal.tam) : 0;
            const baskiMaliyet = Math.round(kare * fotBasiMaliyet * 100) / 100;
            const birimToplam = Math.round((kapakMaliyet + baskiMaliyet) * 100) / 100;
            const toplamToplam = Math.round(birimToplam * qty * 100) / 100;
            if (kapakMaliyet === 0 && baskiMaliyet === 0) return "";
            return ` (üretim maliyeti: kapak ₺${Math.round(kapakMaliyet)} + ${kare}×baskı ₺${Math.round(baskiMaliyet)} = ₺${Math.round(birimToplam)}/birim × ${qty}adet = TOPLAM ₺${Math.round(toplamToplam)})`;
          }
          if (product.match(/fotoğraf|foto/i) || product === "Ribon" || product === "Paspartu") {
            if (fotBasiMaliyet === 0) return "";
            const toplam = Math.round(fotBasiMaliyet * qty * 100) / 100;
            return ` (üretim maliyeti: ${qty}baskı × ₺${fotBasiMaliyet.toFixed(2)} = TOPLAM ₺${Math.round(toplam)})`;
          }
          return "";
        };

        const todayGecmis = new Date().toISOString().split("T")[0];
        const son30gGecmis = new Date(); son30gGecmis.setDate(son30gGecmis.getDate() - 30);
        const son30gStrGecmis = son30gGecmis.toISOString().split("T")[0];

        const filtreGunluk = tumGunlukKayitlarGecmis
          .filter((k: any) => k.tarih && k.tarih >= son30gStrGecmis && k.tarih < todayGecmis)
          .sort((a: any, b: any) => b.tarih.localeCompare(a.tarih));

        if (filtreGunluk.length > 0) {
          const tarihMekanMap: Record<string, Record<string, any>> = {};
          for (const k of filtreGunluk) {
            if (!tarihMekanMap[k.tarih]) tarihMekanMap[k.tarih] = {};
            tarihMekanMap[k.tarih][k.mekanId] = k;
          }

          const gunlukLines: string[] = [];
          const sortedTarihler = Object.keys(tarihMekanMap).sort().reverse().slice(0, 30);

          for (const tarih of sortedTarihler) {
            const mekanKayitlari = tarihMekanMap[tarih];
            const gunLines: string[] = [`  📅 ${tarih}:`];
            for (const [mekanId, k] of Object.entries(mekanKayitlari)) {
              const m = mekanMapGecmis[mekanId] || { name: mekanId, emoji: "📍" };
              const satislar = (k.satislar || []).filter((s: any) => !s.iptal);
              const toplamSatis = satislar.length;
              const toplamCiro = satislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0);
              const toplamKare = satislar.reduce((sum: number, s: any) =>
                sum + (s.items || []).reduce((ss: number, it: any) => ss + (Number(it.quantity) || 1), 0), 0);
              const toplamIskonto = satislar.reduce((sum: number, s: any) => {
                const items = s.items || [];
                const orig = items.reduce((ss: number, it: any) => ss + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
                return sum + Math.max(0, orig - (Number(s.finalPrice) || 0));
              }, 0);
              const personeller = [...new Set(satislar.map((s: any) => s.personnelName || s.createdBy || s.kaydeden || "").filter(Boolean))];
              const personelStr2 = personeller.length > 0 ? personeller.join(", ") : "Bilinmiyor";
              const acilisVar = (k.acilis || k.acilisStok || k.acilisYapildi) ? "✅" : "❌";
              const kapanisVar = (k.kapanish || k.kapanisStok || k.kapanisYapildi) ? "✅" : "❌";
              const urunMap: Record<string, { adet: number; ciro: number }> = {};
              for (const s of satislar) {
                const items = s.items || [];
                const orig = items.reduce((ss: number, it: any) => ss + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
                const ratio = orig > 0 ? (Number(s.finalPrice) || 0) / orig : 1;
                for (const it of items) {
                  const prod = it.product || "Diğer";
                  const qty = Number(it.quantity) || 1;
                  const ciro = Math.round((Number(it.unitPrice) || 0) * qty * ratio);
                  if (!urunMap[prod]) urunMap[prod] = { adet: 0, ciro: 0 };
                  urunMap[prod].adet += qty;
                  urunMap[prod].ciro += ciro;
                }
              }
              // Ürün bazlı satış + üretim maliyeti (kapak + baskı ayrıştırılmış)
              const urunStr = Object.entries(urunMap).length > 0
                ? Object.entries(urunMap).sort((a, b) => b[1].adet - a[1].adet)
                    .map(([p, v]) => {
                      const maliyetBilgisi = hesaplaUretimMaliyeti(p, v.adet, mekanId);
                      return `${p}: ${v.adet}adet satış=₺${v.ciro.toLocaleString("tr-TR")}${maliyetBilgisi}`;
                    }).join(" | ")
                : "Satış yok";

              // Günün toplam üretim maliyetini de hesapla
              let gunToplamUretimMaliyet = 0;
              for (const [p, v] of Object.entries(urunMap)) {
                const fotBasiM = mekanFotMaliyetMap[mekanId] || 0;
                const mekanG = mekanMapGecmis[mekanId];
                const pTypeG = mekanG?.printType || "tam";
                const kareG = extractKare(p);
                if (kareG !== null) {
                  const albumMalG = albumMalMap[String(kareG)];
                  const kapakM = albumMalG ? (pTypeG === "yarim" ? albumMalG.yarim : albumMalG.tam) : 0;
                  const baskiM = kareG * fotBasiM;
                  gunToplamUretimMaliyet += (kapakM + baskiM) * v.adet;
                } else if (p.match(/fotoğraf|foto/i) || p === "Ribon" || p === "Paspartu") {
                  gunToplamUretimMaliyet += fotBasiM * v.adet;
                }
              }
              const toplamUretimStr = gunToplamUretimMaliyet > 0
                ? ` | GÜN TOPLAM ÜRETİM MALİYETİ: ₺${gunToplamUretimMaliyet.toFixed(2)}`
                : "";

              gunLines.push(
                `    ${m.emoji || "📍"} ${m.name}: Açılış=${acilisVar} Kapanış=${kapanisVar} | ` +
                `${toplamSatis} satış, ${toplamKare} kare, ₺${toplamCiro.toLocaleString("tr-TR")} ciro` +
                (toplamIskonto > 0 ? `, ₺${toplamIskonto.toLocaleString("tr-TR")} iskonto` : "") +
                `${toplamUretimStr} | Personel: ${personelStr2} | Ürünler:\n      ${urunStr}`
              );
            }
            gunlukLines.push(gunLines.join("\n"));
          }

          mekanGunlukGecmisStr = `\nMEKAN BAZLI GÜNLÜK OPERASYON GEÇMİŞİ (son 30 gün, bugün hariç):\n` +
            `NOT: Her ürün satırındaki (üretim maliyeti: ... TOPLAM ₺X) parantez içindeki TOPLAM değeri sunucuda hesaplanmış kesin maliyettir. Bu değerleri doğrudan kullan, yeniden hesaplama yapma.\n` +
            gunlukLines.join("\n");
        }
      } catch (e) { console.log("[AI] Mekan günlük geçmiş hatası:", e); }

      // ── Stok Aktarım Geçmişi (son 30 gün) ──
      let stokAktarimStr = "";
      try {
        const tumAktarimlarAI: any[] = await ckv.getByPrefix("stok_aktarim_") || [];
        const son30a = new Date(); son30a.setDate(son30a.getDate() - 30);
        const son30aStr = son30a.toISOString().split("T")[0];
        const filtreA = tumAktarimlarAI
          .filter((a: any) => (a.created_at || a.tarih || "") >= son30aStr && a.status !== "rejected")
          .sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
        if (filtreA.length > 0) {
          stokAktarimStr = `\nSTOK AKTARIM GEÇMİŞİ (son 30 gün — ${filtreA.length} kayıt):\n` +
            filtreA.slice(0, 15).map((a: any) => {
              const urunlerA = Array.isArray(a.items)
                ? a.items.map((it: any) => `${it.product || it.name || "?"}: ${it.quantity || it.adet || "?"}adet`).join(", ")
                : (a.urun || "");
              return `  • ${(a.created_at || a.tarih || "?").slice(0,10)} — ${a.fromName || a.from || a.kaynakAdi || "?"} → ${a.toName || a.to || a.hedefAdi || "?"}: ${urunlerA} | ${a.status || a.durum || "?"}`;
            }).join("\n");
        }
      } catch (e) { console.log("[AI] Stok aktarım hatası:", e); }

      // ── Stok Ekleme Geçmişi (son 30 gün) ──
      let stokEklemeStr = "";
      try {
        const tumEklemelerAI: any[] = await ckv.getByPrefix("stok_ekleme_") || [];
        const son30e = new Date(); son30e.setDate(son30e.getDate() - 30);
        const son30eStr = son30e.toISOString().split("T")[0];
        const filtreE = tumEklemelerAI
          .filter((e: any) => (e.created_at || e.tarih || "") >= son30eStr)
          .sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
        if (filtreE.length > 0) {
          stokEklemeStr = `\nSTOK EKLEME GEÇMİŞİ (son 30 gün — ${filtreE.length} kayıt):\n` +
            filtreE.slice(0, 15).map((e: any) => {
              const urunlerE = Array.isArray(e.items)
                ? e.items.map((it: any) => `${it.product || it.name || "?"}: ${it.quantity || it.adet || "?"}adet`).join(", ")
                : (e.urun || "");
              return `  • ${(e.created_at || e.tarih || "?").slice(0,10)} — ${e.toName || e.mekanAdi || e.hedefAdi || "Depo"}: ${urunlerE} (Ekleyen: ${e.created_by || "?"})`;
            }).join("\n");
        }
      } catch (e) { console.log("[AI] Stok ekleme hatası:", e); }

      // ── Rotasyon Programı (bugün + gelecek 7 gün + geçmiş 30 gün) ──
      let rotasyonStr = "";
      try {
        const tumRotasyonAI: any[] = await ckv.getByPrefix("rotation_task_") || [];
        const bugunTRAI = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
        const son30rAI = new Date(Date.now() + 3 * 60 * 60 * 1000);
        son30rAI.setDate(son30rAI.getDate() - 30);
        const son30rStr = son30rAI.toISOString().split("T")[0];
        const gelecek7rAI = new Date(Date.now() + 3 * 60 * 60 * 1000);
        gelecek7rAI.setDate(gelecek7rAI.getDate() + 7);
        const gelecek7rStr = gelecek7rAI.toISOString().split("T")[0];

        const gecerliRotasyonlar = tumRotasyonAI
          .filter((t: any) => t.date >= son30rStr && t.date <= gelecek7rStr && t.status !== "cancelled")
          .sort((a: any, b: any) => (a.date || "").localeCompare(b.date || "") || (a.startTime || "").localeCompare(b.startTime || ""));

        if (gecerliRotasyonlar.length > 0) {
          const tarihGrupR: Record<string, any[]> = {};
          for (const t of gecerliRotasyonlar) {
            if (!tarihGrupR[t.date]) tarihGrupR[t.date] = [];
            tarihGrupR[t.date].push(t);
          }

          const taskTypeLabels: Record<string, string> = { regular: "Normal", extra: "Ekstra", special: "Özel" };
          const statusLabels: Record<string, string> = { draft: "Taslak", sent: "Gönderildi", revised: "Revize", cancelled: "İptal" };

          const rotasyonLines: string[] = [];
          for (const tarih of Object.keys(tarihGrupR).sort()) {
            const label = tarih === bugunTRAI ? `📅 ${tarih} (BUGÜN)` : tarih > bugunTRAI ? `📅 ${tarih} (gelecek)` : `📅 ${tarih} (geçmiş)`;
            rotasyonLines.push(label + ":");
            for (const t of tarihGrupR[tarih]) {
              const personelAdlari = (t.personnel || []).map((p: any) => p.name || p.ad || p.id).join(", ") || "Personel yok";
              const tip = taskTypeLabels[t.taskType || t.type] || t.taskType || t.type || "Normal";
              const durum = statusLabels[t.status] || t.status || "?";
              const notStr = t.notes ? ` | Not: ${t.notes}` : "";
              rotasyonLines.push(`  • ${t.locationIcon || "📍"} ${t.location} | ${t.startTime || "?"}-${t.endTime || "?"} | ${tip} | Durum: ${durum} | Personel: ${personelAdlari}${notStr}`);
            }
          }

          rotasyonStr = `\nROTASYON PROGRAMI (son 30 gün + gelecek 7 gün — iptal hariç):\n` + rotasyonLines.join("\n");
        } else {
          rotasyonStr = "\nROTASYON PROGRAMI: Kayıt yok.";
        }
      } catch (e) { console.log("[AI] Rotasyon hatası:", e); }

      // ── Hava Durumu (Open-Meteo — ücretsiz, key gerektirmez) ──
      let havaDurumuStr = "";
      try {
        const lastMsg: string = (messages[messages.length - 1]?.content || messages[messages.length - 1]?.text || "").toLowerCase();
        const havaKeywords = ["hava", "sıcaklık", "sicaklik", "yağmur", "yagmur", "kar", "rüzgar", "ruzgar", "fırtına", "firtina", "güneş", "bulut", "nem", "weather", "derece", "forecast", "tahmin"];
        const isWeatherQuery = havaKeywords.some((k: string) => lastMsg.includes(k));

        if (isWeatherQuery) {
          const sehirListesi: Record<string, { lat: number; lon: number; ad: string }> = {
            "istanbul": { lat: 41.0082, lon: 28.9784, ad: "İstanbul" },
            "ankara": { lat: 39.9334, lon: 32.8597, ad: "Ankara" },
            "izmir": { lat: 38.4192, lon: 27.1287, ad: "İzmir" },
            "antalya": { lat: 36.8969, lon: 30.7133, ad: "Antalya" },
            "fethiye": { lat: 36.6565, lon: 29.1234, ad: "Fethiye" },
            "bodrum": { lat: 37.0344, lon: 27.4305, ad: "Bodrum" },
            "marmaris": { lat: 36.8556, lon: 28.2700, ad: "Marmaris" },
            "alanya": { lat: 36.5440, lon: 31.9993, ad: "Alanya" },
            "kaş": { lat: 36.2015, lon: 29.6410, ad: "Kaş" },
            "kas": { lat: 36.2015, lon: 29.6410, ad: "Kaş" },
            "ölüdeniz": { lat: 36.5477, lon: 29.1155, ad: "Ölüdeniz" },
            "oludeniz": { lat: 36.5477, lon: 29.1155, ad: "Ölüdeniz" },
            "dalaman": { lat: 36.7673, lon: 28.7936, ad: "Dalaman" },
            "muğla": { lat: 37.2153, lon: 28.3636, ad: "Muğla" },
            "mugla": { lat: 37.2153, lon: 28.3636, ad: "Muğla" },
            "bursa": { lat: 40.1885, lon: 29.0610, ad: "Bursa" },
            "konya": { lat: 37.8746, lon: 32.4932, ad: "Konya" },
            "adana": { lat: 37.0000, lon: 35.3213, ad: "Adana" },
            "trabzon": { lat: 41.0015, lon: 39.7178, ad: "Trabzon" },
            "samsun": { lat: 41.2867, lon: 36.3300, ad: "Samsun" },
            "erzurum": { lat: 39.9055, lon: 41.2658, ad: "Erzurum" },
            "gaziantep": { lat: 37.0662, lon: 37.3833, ad: "Gaziantep" },
            "diyarbakır": { lat: 37.9144, lon: 40.2306, ad: "Diyarbakır" },
            "diyarbakir": { lat: 37.9144, lon: 40.2306, ad: "Diyarbakır" },
            "kapadokya": { lat: 38.6431, lon: 34.8307, ad: "Kapadokya" },
            "cappadocia": { lat: 38.6431, lon: 34.8307, ad: "Kapadokya" },
            "nevşehir": { lat: 38.6939, lon: 34.6857, ad: "Nevşehir" },
            "nevsehir": { lat: 38.6939, lon: 34.6857, ad: "Nevşehir" },
            "pamukkale": { lat: 37.9208, lon: 29.1204, ad: "Pamukkale" },
            "denizli": { lat: 37.7765, lon: 29.0864, ad: "Denizli" },
            "efes": { lat: 37.9394, lon: 27.3417, ad: "Efes/Selçuk" },
            "selçuk": { lat: 37.9508, lon: 27.3697, ad: "Selçuk" },
            "selcuk": { lat: 37.9508, lon: 27.3697, ad: "Selçuk" },
            "çeşme": { lat: 38.3249, lon: 26.3053, ad: "Çeşme" },
            "cesme": { lat: 38.3249, lon: 26.3053, ad: "Çeşme" },
            "kuşadası": { lat: 37.8567, lon: 27.2597, ad: "Kuşadası" },
            "kusadasi": { lat: 37.8567, lon: 27.2597, ad: "Kuşadası" },
            "sarıgerme": { lat: 36.7053, lon: 28.8742, ad: "Sarıgerme" },
            "sarigerme": { lat: 36.7053, lon: 28.8742, ad: "Sarıgerme" },
            "göcek": { lat: 36.7479, lon: 28.9359, ad: "Göcek" },
            "gocek": { lat: 36.7479, lon: 28.9359, ad: "Göcek" },
            "side": { lat: 36.7688, lon: 31.3878, ad: "Side" },
            "belek": { lat: 36.8640, lon: 31.0550, ad: "Belek" },
            "kemer": { lat: 36.5987, lon: 30.5592, ad: "Kemer" },
            "didim": { lat: 37.3747, lon: 27.2697, ad: "Didim" },
            "ayvalık": { lat: 39.3194, lon: 26.6960, ad: "Ayvalık" },
            "ayvalik": { lat: 39.3194, lon: 26.6960, ad: "Ayvalık" },
          };

          let hedefSehir: { lat: number; lon: number; ad: string } | null = null;
          for (const [anahtar, konum] of Object.entries(sehirListesi)) {
            if (lastMsg.includes(anahtar)) {
              hedefSehir = konum;
              break;
            }
          }

          if (!hedefSehir) {
            const stopWords = new Set(["hava", "durumu", "söyle", "soyle", "yarin", "yarın", "bugün", "bugun", "bu", "hafta", "ay", "için", "icin", "nasıl", "nasil", "ne", "kadar", "derece", "tahmin", "sıcaklık", "sicaklik", "yağmur", "kar", "bilgi", "ver", "bana", "lütfen", "lutfen", "merhaba", "tamam", "ve", "ile", "de", "da"]);
            const kelimeler = lastMsg.split(/\s+/).filter((k: string) => k.length > 2 && !stopWords.has(k));
            for (const kelime of kelimeler) {
              try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(kelime)}&count=1&language=tr&format=json`);
                if (geoRes.ok) {
                  const geoData = await geoRes.json();
                  if (geoData.results && geoData.results.length > 0) {
                    const r = geoData.results[0];
                    if (r.country_code === "TR" || kelimeler.length === 1) {
                      hedefSehir = { lat: r.latitude, lon: r.longitude, ad: r.name };
                      break;
                    }
                  }
                }
              } catch (_) { /* geocoding opsiyonel */ }
            }
          }

          if (hedefSehir) {
            const wRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${hedefSehir.lat}&longitude=${hedefSehir.lon}` +
              `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,uv_index_max` +
              `&current_weather=true&timezone=Europe%2FIstanbul&forecast_days=7`
            );
            if (wRes.ok) {
              const w = await wRes.json();
              const wmoDesc = (code: number): string => {
                if (code === 0) return "Açık ☀️";
                if (code <= 2) return "Parçalı Bulutlu ⛅";
                if (code === 3) return "Kapalı ☁️";
                if (code <= 49) return "Sisli 🌫️";
                if (code <= 59) return "Çisenti 🌦️";
                if (code <= 69) return "Yağmurlu 🌧️";
                if (code <= 79) return "Karlı ❄️";
                if (code <= 82) return "Sağanak 🌧️";
                if (code <= 84) return "Kar Yağışlı 🌨️";
                if (code <= 94) return "Fırtınalı ⛈️";
                return "Şiddetli Fırtına 🌪️";
              };
              const cur = w.current_weather;
              const daily = w.daily;
              const todayWStr = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
              const days: string[] = (daily.time || []);
              const gunlerStr = days.slice(0, 7).map((tarih: string, i: number) => {
                const isToday = tarih === todayWStr;
                const label = isToday ? "BUGÜN" : tarih;
                return `  ${label}: ${wmoDesc(daily.weathercode[i])} | Min: ${daily.temperature_2m_min[i]}°C Max: ${daily.temperature_2m_max[i]}°C | Yağış: ${daily.precipitation_sum[i]}mm | Rüzgar: ${daily.windspeed_10m_max[i]}km/h | UV: ${daily.uv_index_max[i]}`;
              }).join("\n");
              havaDurumuStr = `\nHAVA DURUMU — ${hedefSehir.ad} (gerçek zamanlı Open-Meteo verisi):\nŞu an: ${wmoDesc(cur.weathercode)} | ${cur.temperature}°C | Rüzgar: ${cur.windspeed}km/h\n7 Günlük Tahmin:\n${gunlerStr}`;
            }
          } else {
            havaDurumuStr = "\nHAVA DURUMU: Şehir tespit edilemedi. Kullanıcıya hangi şehir için hava durumu istediğini sor.";
          }
        }
      } catch (e) { console.log("[AI] Hava durumu hatası:", e); }

      if (ozet) {
        const mekanlarStr = Array.isArray(ozet.mekanlar)
          ? ozet.mekanlar.map((m: any) =>
              `  • ${m.emoji} ${m.name}: ${m.satisAdet} satış, ₺${Number(m.ciro).toLocaleString("tr-TR")} ciro${m.iskonto > 0 ? `, ₺${Number(m.iskonto).toLocaleString("tr-TR")} iskonto` : ""}, Açılış: ${m.acilisYapildi ? "✅" : "❌"}, Kapanış: ${m.kapanisYapildi ? "✅" : "❌"}`
            ).join("\n")
          : "  Veri yok.";

        // Genel stok (tüm mekanların toplamı)
        const stokStr = Array.isArray(ozet.stokDurum)
          ? ozet.stokDurum.map((s: any) => `  • ${s.name}: ${s.count} adet (${s.status})`).join("\n")
          : "  Veri yok.";

        // Mekan bazlı stok detayı
        const mekanStokStr = Array.isArray(ozet.mekanBazliStok) && ozet.mekanBazliStok.length > 0
          ? ozet.mekanBazliStok.map((ms: any) =>
              `  ${ms.mekanEmoji} ${ms.mekanAdi} (${ms.stokTipi} stoğu):\n` +
              ms.urunler.map((u: any) => `    - ${u.name}: ${u.count} adet${u.status !== "normal" ? ` ⚠️${u.status}` : ""}`).join("\n")
            ).join("\n")
          : "  Mekan bazlı stok verisi yok.";

        const typeLabel = (t: string) => t === "acilis" ? "Açılış Stok" : t === "kapanis" ? "Kapanış Stok" : t === "yazici_acilis" ? "Yazıcı Açılış" : t === "yazici_kapanis" ? "Yazıcı Kapanış" : t;
        const anomaliStr = Array.isArray(ozet.anomaliler) && ozet.anomaliler.length > 0
          ? ozet.anomaliler.map((a: any) =>
              `  ⚠️ ${a.mekanEmoji} ${a.mekan} — ${typeLabel(a.type)}${a.detailStr ? `: ${a.detailStr}` : ""}`
            ).join("\n")
          : "  Bugün anomali yok.";

        // Geçmiş anomaliler (son 30 gün)
        let gecmisAnomaliStr = "";
        try {
          const tumKayitlarAnomali: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
          const mekanlarAnomali: any[] = await getMekanlar();
          const mekanMapAnomali: Record<string, any> = {};
          for (const m of mekanlarAnomali) mekanMapAnomali[m.id] = m;
          const today_aichat = new Date().toISOString().split("T")[0];
          const otuzGunOnce = new Date();
          otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);
          const otuzGunStr = otuzGunOnce.toISOString().split("T")[0];
          const stokEtAnomali: Record<string, string> = {
            album3:"3 Kare", album5:"5 Kare", album7:"7 Kare", album9:"9 Kare",
            album11:"11 Kare", album13:"13 Kare", album15:"15 Kare", paspartu:"Paspartu", ribon:"Ribon",
          };
          const gecmisAnomaliList: string[] = [];
          for (const kayit of tumKayitlarAnomali) {
            if (!kayit.tarih || kayit.tarih >= today_aichat || kayit.tarih < otuzGunStr) continue;
            const mekanAdGecmis = mekanMapAnomali[kayit.mekanId]?.name || kayit.mekanId;
            const mekanEmojiGecmis = mekanMapAnomali[kayit.mekanId]?.emoji || "📍";
            const fmtDetail = (d: Record<string, number>) =>
              Object.entries(d).filter(([, v]) => v !== 0)
                .map(([k, v]) => `${stokEtAnomali[k] || k}: ${v > 0 ? "+" : ""}${v}`).join(", ");
            if (kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0)
              gecmisAnomaliList.push(`  • ${kayit.tarih} ${mekanEmojiGecmis} ${mekanAdGecmis} — Açılış Stok: ${fmtDetail(kayit.acilisAnomali)}`);
            if (kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0)
              gecmisAnomaliList.push(`  • ${kayit.tarih} ${mekanEmojiGecmis} ${mekanAdGecmis} — Kapanış Stok: ${fmtDetail(kayit.kapanisAnomali)}`);
            if (Array.isArray(kayit.acilisYaziciAnomali) && kayit.acilisYaziciAnomali.length > 0) {
              for (const pa of kayit.acilisYaziciAnomali)
                gecmisAnomaliList.push(`  • ${kayit.tarih} ${mekanEmojiGecmis} ${mekanAdGecmis} — Yazıcı Açılış (${pa.label || "Yazıcı"}): beklenen ${pa.beklenenCounter} girilen ${pa.startCounter} (fark: ${pa.fark > 0 ? "+" : ""}${pa.fark})`);
            }
            if (kayit.kapanisYaziciAnomali && Math.abs(kayit.kapanisYaziciAnomali.fark || 0) > 0) {
              const kya = kayit.kapanisYaziciAnomali;
              gecmisAnomaliList.push(`  • ${kayit.tarih} ${mekanEmojiGecmis} ${mekanAdGecmis} — Yazıcı Kapanış: net basılan ${kya.netBasilan || 0}, satış ${kya.satisAdet || 0} (fark: ${kya.fark > 0 ? "+" : ""}${kya.fark} kare)`);
            }
          }
          gecmisAnomaliStr = gecmisAnomaliList.length > 0
            ? `\nSON 30 GÜN ANOMALİ GEÇMİŞİ (${otuzGunStr} → dün):\n` + gecmisAnomaliList.sort().reverse().slice(0, 60).join("\n")
            : "\nSON 30 GÜN: Stok veya yazıcı anomalisi yok.";
        } catch (e) {
          console.log("[AI] Geçmiş anomali çekme hatası:", e);
          gecmisAnomaliStr = "";
        }

        const personelStr = Array.isArray(ozet.personelSiralama)
          ? ozet.personelSiralama.map((p: any) => {
              const brutoCiro = (p.brutoCiro || p.ciro) + (p.iskonto || 0);
              const oran = brutoCiro > 0 ? Math.round(((p.iskonto || 0) / brutoCiro) * 100) : 0;
              return `  • ${p.ad}: ${p.satis} işlem | Net ₺${Number(p.ciro).toLocaleString("tr-TR")} | İskonto ₺${Number(p.iskonto || 0).toLocaleString("tr-TR")} (%${oran}) | Brüt ₺${Number(brutoCiro).toLocaleString("tr-TR")}`;
            }).join("\n")
          : "  Veri yok.";

        const odemeStr = ozet.odemeDagilimi
          ? `Nakit: ₺${Number(ozet.odemeDagilimi.cash).toLocaleString("tr-TR")}, Kart: ₺${Number(ozet.odemeDagilimi.card).toLocaleString("tr-TR")}, IBAN: ₺${Number(ozet.odemeDagilimi.iban).toLocaleString("tr-TR")}, Döviz: ₺${Number(ozet.odemeDagilimi.foreign).toLocaleString("tr-TR")}`
          : "Veri yok.";

        // Albüm/ürün bazlı satış dökümü
        const albumSatisStr = Array.isArray(ozet.albumSatisDokumu) && ozet.albumSatisDokumu.length > 0
          ? ozet.albumSatisDokumu.map((a: any) =>
              `  • ${a.product}: ${a.adet} adet, ₺${Number(a.ciro).toLocaleString("tr-TR")} ciro`
            ).join("\n")
          : "  Bugün albüm/ürün satışı yok veya veri girilmemiş.";

        // Son 7 günlük satış özeti (bugün hariç)
        let sonYediGunStr = "";
        try {
          const tumKayitlarHafta: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
          const yediGunOnce = new Date();
          yediGunOnce.setDate(yediGunOnce.getDate() - 7);
          const yediGunStr = yediGunOnce.toISOString().split("T")[0];
          const haftalikAlbumMap: Record<string, Record<string, { adet: number; ciro: number }>> = {};
          let haftalikCiro = 0, haftalikSatis = 0;

          const todayAichat2 = new Date().toISOString().split("T")[0];
          for (const kayit of tumKayitlarHafta) {
            if (!kayit.tarih || kayit.tarih < yediGunStr || kayit.tarih >= todayAichat2) continue;
            const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
            haftalikSatis += satislar.length;
            for (const satis of satislar) {
              const satFinal = Number(satis.finalPrice) || 0;
              haftalikCiro += satFinal;
              const satItems = satis.items || [];
              const satOrijToplam = satItems.reduce((s: number, it: any) =>
                s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
              const satRatio = satOrijToplam > 0 ? satFinal / satOrijToplam : 1;
              for (const item of satItems) {
                const tip = item.product || "Diğer";
                const qty = Number(item.quantity) || 1;
                const orijItemCiro = (Number(item.unitPrice) || 0) * qty;
                if (!haftalikAlbumMap[tip]) haftalikAlbumMap[tip] = {};
                if (!haftalikAlbumMap[tip][kayit.tarih]) haftalikAlbumMap[tip][kayit.tarih] = { adet: 0, ciro: 0 };
                haftalikAlbumMap[tip][kayit.tarih].adet += qty;
                haftalikAlbumMap[tip][kayit.tarih].ciro += Math.round(orijItemCiro * satRatio);
              }
            }
          }

          // Albüm toplamları
          const haftalikAlbumToplam = Object.entries(haftalikAlbumMap).map(([product, gunler]) => {
            const topAdet = Object.values(gunler).reduce((s, d) => s + d.adet, 0);
            const topCiro = Object.values(gunler).reduce((s, d) => s + d.ciro, 0);
            return { product, adet: topAdet, ciro: topCiro };
          }).sort((a, b) => b.adet - a.adet);

          if (haftalikSatis > 0) {
            sonYediGunStr = `\nSON 7 GÜN SATIŞ ÖZETİ (${yediGunStr} → dün):\nToplam: ${haftalikSatis} satış, ₺${Number(haftalikCiro).toLocaleString("tr-TR")} ciro\nÜrün bazlı:\n` +
              haftalikAlbumToplam.map(a => `  • ${a.product}: ${a.adet} adet, ₺${Number(a.ciro).toLocaleString("tr-TR")}`).join("\n");
          } else {
            sonYediGunStr = "\nSON 7 GÜN: Satış verisi yok.";
          }
        } catch (e) {
          console.log("[AI] Haftalık satış özeti hatası:", e);
          sonYediGunStr = "";
        }

        ozetContext = `
--- BUGÜNKÜ OPERASYON VERİLERİ (${ozet.tarih || "bugün"}) ---
Toplam Ciro: ₺${Number(ozet.toplamCiro).toLocaleString("tr-TR")} | Satış: ${ozet.toplamSatisAdet} işlem | İskonto: ₺${Number(ozet.toplamIskonto).toLocaleString("tr-TR")} | Fotoğraf: ${ozet.toplamKare} kare
NOT: "Satış" burada işlem/fiş adedidir, ürün adedi değil. Ürün adedini görmek için albüm/ürün bazlı dökümüne bak.
Aktif Mekan: ${ozet.aktifMekanSayisi}/${ozet.mekanSayisi}

MEKANLAR:
${mekanlarStr}

GENEL STOK (bugünkü kapanış/açılış özeti — frontend verisi):
${stokStr}

MEKAN BAZLI STOK DETAYI (bugünkü frontend verisi):
${mekanStokStr}

MERKEZ DEPO STOĞU:
${depoStokStr}

MEKAN ANLIK STOKLARI (KV'den doğrudan — en son kapanış/açılış kaydı, frontend'den bağımsız):
${mekanAnlikStokStr}

TÜM LOKASYONLAR TOPLAM STOK (merkez depo + tüm mekanlar en son kayıt):
${genelToplamStokStr}

ANOMALİLER (bugün):
${anomaliStr}
${gecmisAnomaliStr}

PERSONEL SIRALAMASI (ciro bazlı):
${personelStr}

BUGÜN ÜRÜN/ALBÜM BAZLI SATIŞ DÖKÜMÜ:
${albumSatisStr}

BUGÜN İZİNLİ PERSONEL:
${izinlerStr}

İZİN GEÇMİŞİ (son 90 gün + gelecek onaylılar):
${izinGecmisiStr}

ÖDEME DAĞILIMI: ${odemeStr}
${sonYediGunStr}

MEKAN DETAYLARI (kira, fiyat, baskı tipi):
${mekanDetayStr}

ALBÜM/ÜRÜN SATIŞ FİYAT LİSTESİ (mekan bazlı):
${albumFiyatStr}

MALİYET / MALZEME YÖNETİMİ:
${maliyetStr}

MEKAN BAZLI ALBÜM ÜRETİM MALİYETİ TABLOSU (sunucu tarafında önceden hesaplanmış — kesin doğru değerler):
ÖNEMLİ: Herhangi bir mekan için albüm üretim maliyeti sorulduğunda YALNIZCA bu tablodaki değerleri kullan. Asla kendi başına hesap yapma.
${mekanAlbumMaliyetTabloStr}

İŞLETME GİDER KAYITLARI (son 30 gün):
${isletmeGiderStr}

EKİPMAN / MALZEME LİSTESİ:
${ekipmanStr}

MEKAN ZİYARET KAYITLARI (son 90 gün):
${ziyaretStr}

MÜDÜR RAPORLARI (son 90 gün):
${mudurRaporStr}

AKTİF DUYURULAR:
${duyuruStr}
${stokAktarimStr}
${stokEklemeStr}
${mekanGunlukGecmisStr}
${rotasyonStr}
${havaDurumuStr}
--- VERİ SONU ---`;
      } else {
        // Ozet yoksa sadece izin + temel mekan/maliyet bilgisi ver
        ozetContext = `
--- YÖNETİCİ VERİLERİ ---
Bugün için satış/stok verisi henüz girilmemiş veya yüklenmemiş.

MERKEZ DEPO STOĞU:
${depoStokStr}

MEKAN ANLIK STOKLARI (KV'den doğrudan — en son kapanış/açılış kaydı):
${mekanAnlikStokStr}

TÜM LOKASYONLAR TOPLAM STOK (merkez depo + tüm mekanlar en son kayıt):
${genelToplamStokStr}

MEKAN DETAYLARI (kira, fiyat, baskı tipi):
${mekanDetayStr}

ALBÜM/ÜRÜN SATIŞ FİYAT LİSTESİ:
${albumFiyatStr}

MALİYET / MALZEME YÖNETİMİ:
${maliyetStr}

MEKAN BAZLI ALBÜM ÜRETİM MALİYETİ TABLOSU (sunucu tarafında önceden hesaplanmış — kesin doğru değerler):
ÖNEMLİ: Herhangi bir mekan için albüm üretim maliyeti sorulduğunda YALNIZCA bu tablodaki değerleri kullan. Asla kendi başına hesap yapma.
${mekanAlbumMaliyetTabloStr}

İŞLETME GİDER KAYITLARI (son 30 gün):
${isletmeGiderStr}

EKİPMAN / MALZEME LİSTESİ:
${ekipmanStr}

MEKAN ZİYARET KAYITLARI (son 90 gün):
${ziyaretStr}

MÜDÜR RAPORLARI (son 90 gün):
${mudurRaporStr}

AKTİF DUYURULAR:
${duyuruStr}
${stokAktarimStr}
${stokEklemeStr}
${mekanGunlukGecmisStr}
${rotasyonStr}
${havaDurumuStr}

BUGÜN İZİNLİ PERSONEL:
${izinlerStr}

İZİN GEÇMİŞİ (son 90 gün + gelecek onaylılar):
${izinGecmisiStr}
--- VERİ SONU ---`;
      }
    } else {
      // ─ DİĞER ROLLER: sadece stok + kişisel veriler ─
      // 1. Genel stok (ozet'ten geldi — finansal değil, sadece stok adedi)
      const stokStr = Array.isArray(ozet?.stokDurum)
        ? ozet.stokDurum.map((s: any) => `  • ${s.name}: ${s.count} adet (${s.status})`).join("\n")
        : "  Veri yok.";

      // 1b. Mekan bazlı stok detayı
      const mekanStokStr = Array.isArray(ozet?.mekanBazliStok) && ozet.mekanBazliStok.length > 0
        ? ozet.mekanBazliStok.map((ms: any) =>
            `  ${ms.mekanEmoji} ${ms.mekanAdi} (${ms.stokTipi} stoğu):\n` +
            ms.urunler.map((u: any) => `    - ${u.name}: ${u.count} adet${u.status !== "normal" ? ` ⚠️${u.status}` : ""}`).join("\n")
          ).join("\n")
        : "  Mekan bazlı stok verisi yok.";

      // 2. Kişisel izin talepleri (KV'den çek, user.id ile filtrele)
      let izinStr = "  Veri yok.";
      try {
        const allLeaves: any[] = await ckv.getByPrefix("rotation_leave_") || [];
        const myLeaves = allLeaves.filter((l: any) =>
          l.personnelId === user.id || l.staffId === user.id || l.created_by === user.id
        );
        if (myLeaves.length > 0) {
          izinStr = myLeaves.slice(-10).map((l: any) =>
            `  • ${l.leaveType || l.type || "İzin"}: ${l.startDate || l.date || "?"} → ${l.endDate || l.date || "?"} | Durum: ${l.status === "approved" ? "✅ Onaylı" : l.status === "rejected" ? "❌ Reddedildi" : "⏳ Bekliyor"}`
          ).join("\n");
        }
      } catch (e) {
        console.log("[AI] İzin çekme hatası:", e);
      }

      // 3. Kişisel prim verileri (KV'den çek, userName ile filtrele)
      let primStr = "  Veri yok.";
      try {
        const safeAd = encodeURIComponent(userName || "");
        const allPrimler: any[] = await ckv.getByPrefix("prim_odendi_") || [];
        // prim key formatı: prim_odendi_{mekanId}_{tarih}_{ki}_{safeAd}
        // stok_gunluk_ kayıtlarından bu kullanıcının prim verilerini bulmak için
        // personelPrimTakip endpoint'indeki mantığı kullanalım
        const mekanlarList: any[] = await getMekanlar().catch(() => []);
        const stokKayitlar: any[] = await ckv.getByPrefix("stok_gunluk_").catch(() => []);
        const odemeMap: Record<string, any> = {};
        for (const o of allPrimler) {
          if (o.key) odemeMap[o.key] = o;
        }

        const myPrimler: any[] = [];
        const son30gun = new Date();
        son30gun.setDate(son30gun.getDate() - 30);

        for (const kayit of stokKayitlar) {
          if (!kayit.fotografcilar || !Array.isArray(kayit.fotografcilar)) continue;
          const isInvolved = kayit.fotografcilar.some((ad: string) =>
            encodeURIComponent(ad) === safeAd || ad === (userName || "")
          );
          if (!isInvolved) continue;

          const kayitTarih = new Date(kayit.tarih || "");
          if (kayitTarih < son30gun) continue;

          const mekan = mekanlarList.find((m: any) => m.id === kayit.mekanId);
          if (!mekan?.primKademeleri) continue;

          const ciro = Number(kayit.toplamTutar || 0);
          const kademeler = mekan.primKademeleri;
          for (let ki = 0; ki < kademeler.length; ki++) {
            const kademe = kademeler[ki];
            if (ciro >= Number(kademe.hedef)) {
              const coklu = kayit.fotografcilar.length > 1;
              const primMiktar = (coklu ? Number(kademe.primCoklu) : Number(kademe.primTek)) || 0;
              const odemeKey = `prim_odendi_${kayit.mekanId}_${kayit.tarih}_${ki}_${safeAd}`;
              const odemeData = odemeMap[odemeKey];
              myPrimler.push({
                mekan: mekan.name || kayit.mekanId,
                tarih: kayit.tarih,
                primMiktar,
                odendi: odemeData?.odendi || false,
              });
            }
          }
        }

        if (myPrimler.length > 0) {
          const toplamHak = myPrimler.reduce((s: number, p: any) => s + p.primMiktar, 0);
          const odenen = myPrimler.filter((p: any) => p.odendi).reduce((s: number, p: any) => s + p.primMiktar, 0);
          const bekleyen = toplamHak - odenen;
          primStr = `Son 30 gün hak edilen: ₺${toplamHak.toLocaleString("tr-TR")} | Ödenen: ₺${odenen.toLocaleString("tr-TR")} | Bekleyen: ₺${bekleyen.toLocaleString("tr-TR")}\n` +
            myPrimler.slice(-5).map((p: any) =>
              `  • ${p.mekan} (${p.tarih}): ₺${p.primMiktar.toLocaleString("tr-TR")} — ${p.odendi ? "✅ Ödendi" : "⏳ Bekliyor"}`
            ).join("\n");
        }
      } catch (e) {
        console.log("[AI] Prim çekme hatası:", e);
      }

      // 4. Kişisel görevler (rotation_task'tan) — son 30 gün + gelecek 7 gün
      let gorevStr = "  Veri yok.";
      try {
        const allTasksKisisel: any[] = await ckv.getByPrefix("rotation_task_") || [];
        const bugunTRKisisel = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
        const son30kisisel = new Date(Date.now() + 3 * 60 * 60 * 1000);
        son30kisisel.setDate(son30kisisel.getDate() - 30);
        const son30kisiselStr = son30kisisel.toISOString().split("T")[0];
        const gelecek7kisisel = new Date(Date.now() + 3 * 60 * 60 * 1000);
        gelecek7kisisel.setDate(gelecek7kisisel.getDate() + 7);
        const gelecek7kisiselStr = gelecek7kisisel.toISOString().split("T")[0];

        const myTasks = allTasksKisisel.filter((t: any) => {
          const personList: any[] = Array.isArray(t.personnel) ? t.personnel : [];
          const isAssigned = personList.some((p: any) => p.id === user.id || p.name === userName);
          const inRange = (t.date || "") >= son30kisiselStr && (t.date || "") <= gelecek7kisiselStr;
          return isAssigned && inRange && t.status !== "cancelled";
        }).sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));

        if (myTasks.length > 0) {
          const statusKLabels: Record<string, string> = { draft: "Taslak", sent: "Gönderildi", revised: "Revize", cancelled: "İptal" };
          gorevStr = myTasks.map((t: any) => {
            const tarihLabel = t.date === bugunTRKisisel ? `${t.date} (BUGÜN)` : t.date > bugunTRKisisel ? `${t.date} (gelecek)` : `${t.date} (geçmiş)`;
            const durum = statusKLabels[t.status] || t.status || "?";
            return `  • ${t.locationIcon || "📍"} ${t.location || "Mekan"} — ${tarihLabel} | ${t.startTime || "?"}-${t.endTime || "?"} | Durum: ${durum}`;
          }).join("\n");
        }
      } catch (e) {
        console.log("[AI] Görev çekme hatası:", e);
      }

      ozetContext = `
--- KİŞİSEL VERİLER: ${userName || "Kullanıcı"} ---
ÖNEMLİ: Bu kullanıcının yalnızca kendi verileri aşağıdadır. Başka personelin finansal veya kişisel bilgilerini paylaşma.

GENEL STOK (bugünkü kapanış özeti — frontend verisi):
${stokStr}

MEKAN BAZLI STOK DETAYI (bugünkü frontend verisi):
${mekanStokStr}

MEKAN ANLIK STOKLARI (KV'den doğrudan — en son kapanış/açılış kaydı):
${mekanAnlikStokStr}

TÜM LOKASYONLAR TOPLAM STOK (merkez depo + tüm mekanlar):
${genelToplamStokStr}

İZİN TALEPLERİM:
${izinStr}

PRİM BİLGİLERİM:
${primStr}

ATANMIŞ GÖREVLERİM:
${gorevStr}
${havaDurumuStr}
--- VERİ SONU ---`;
    }

    const rolKisitlamasi = userRole !== "yonetici"
      ? `\nKRİTİK KISITLAMA: Finansal veriler (ciro, gelir, ödeme dağılımı, diğer personelin primleri, işletme gelirleri) kesinlikle paylaşılmaz. Sadece stok durumu ve kullanıcının kendi kişisel verileri (izin, prim, görev) hakkında yanıt ver.`
      : "";

    // Türkiye saati (UTC+3) ile kesin tarih hesabı
    const nowTR = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const todayTR   = nowTR.toISOString().split("T")[0];
    const dunTR     = new Date(nowTR.getTime() - 86400000).toISOString().split("T")[0];
    const yarinTR   = new Date(nowTR.getTime() + 86400000).toISOString().split("T")[0];
    const haftaBasiTR = (() => {
      const d = new Date(nowTR); const g = d.getDay();
      d.setDate(d.getDate() - (g === 0 ? 6 : g - 1)); return d.toISOString().split("T")[0];
    })();

    const systemPrompt = `Sen "Aspect AI" adlı bir turistik fotoğrafçılık işletmesi asistanısın. İşletme adı: Aspect Operations.
Kullanıcı: ${userName || "Kullanıcı"} | Rol: ${userRole || "personel"}
⚠️ TARİH BİLGİSİ (KESİN — SORGULARDA KULLAN):
  • Bugün     = ${todayTR} (Türkiye, UTC+3)
  • Dün       = ${dunTR}
  • Yarın     = ${yarinTR}
  • Bu hafta başı = ${haftaBasiTR}
Kullanıcı "dün", "bugün", "yarın", "bu hafta", "geçen hafta" gibi göreli tarih kullandığında yukarıdaki kesin tarihleri MUTLAKA kullan.
Türkçe yanıt ver. Kısa ve net ol. Sayısal verileri kullanarak somut cevaplar ver. Markdown bold (**) kullanabilirsin.
STOK SORULARI: "Elimizde kaç var", "şu an stok", "mevcut stok", "toplam stok" gibi genel sorgularda KESİNLİKLE "TÜM LOKASYONLAR TOPLAM STOK" bölümünü kullan — bu veri KV'den doğrudan çekilmiş en güncel ve doğru rakamdır. "MEKAN ANLIK STOKLARI" bölümü mekan bazlı detayı gösterir. "Depo stok", "depoda kaç" veya "merkez depo" sorgularında "MERKEZ DEPO STOĞU" bölümünü kullan. "GENEL STOK" ve "MEKAN BAZLI STOK DETAYI" bölümleri yalnızca bugün frontend'den gönderilen kapanış verisini gösterir; sıfır görünüyorsa bugün kapanış girilmemiş demektir — "MEKAN ANLIK STOKLARI" bölümünü tercih et.
SATIŞ VE ÜRÜN SORULARI: Albüm tiplerini (3 Kare, 5 Kare, 7 Kare, 9 Kare, 11 Kare, 13 Kare, 15 Kare, Ribon, Paspartu) tanıyorsun. "BUGÜN ÜRÜN/ALBÜM BAZLI SATIŞ DÖKÜMÜ" bölümünden bugünün verilerini, "SON 7 GÜN SATIŞ ÖZETİ" bölümünden geçmiş hafta verisini kullan.
İNDİRİM SORULARI: "PERSONEL SIRALAMASI" bölümünde her personelin Net ciro, İskonto ₺ ve indirim yüzdesi (%oran) var. "Kimin indirim oranı en yüksek?", "Ahmet bugün ne kadar indirim yaptı?", "Toplam iskonto ne kadar?" gibi soruları bu veriden cevaplayabilirsin.
MEKAN SORULARI: "MEKAN DETAYLARI" bölümünde her mekanın fotoğraf birim fiyatı, baskı tipi (tam/yarım sayfa), kağıt tipi, yıllık/aylık/günlük kira ve çalışma saatleri var. "Kaç mekanda tam sayfa kullanıyoruz?", "En pahalı mekan hangisi?", "Aylık toplam kira ne kadar?" sorularını bu veriden cevaplayabilirsin.
FİYAT SORULARI: "ALBÜM/ÜRÜN SATIŞ FİYAT LİSTESİ" bölümünde mekan bazlı tüm albüm fiyatları var (1 Kare, 3 Kare, … 15 Kare). "3 kare ne kadar?", "Hangi mekanda fiyatlar farklı?" sorularını cevaplayabilirsin.
MALİYET SORULARI: KRİTİK AYRIMI UNUTMA — "SATIŞ FİYATI (müşteri öder, maliyet DEĞİL)" ile "ÜRETİM MALİYETİ" TAMAMEN FARKLIDIR. ALBÜM ÜRETİM MALİYETİ SORUSU: "X Kare albümün maliyeti nedir?", "3'lü albüm ne kadar tutar?", "üretim maliyeti?" gibi sorularda KESİNLİKLE "MEKAN BAZLI ALBÜM ÜRETİM MALİYETİ TABLOSU" bölümündeki ilgili satırı kullan — bu tablo sunucu tarafında önceden hesaplanmış kesin değerleri içerir, asla kendi başına hesap yapma. Mekan belirtilmişse o mekanın satırına bak, belirtilmemişse tüm mekanları listele. TEK FOTOĞRAF ÜRETİM MALİYETİ: "MEKAN DETAYLARI" bölümünde her mekan için "⚠️ 1 FOTOĞRAF ÜRETİM MALİYETİ: ₺X.XX TRY" hazır değeri var — onu kullan. "MALİYET / MALZEME YÖNETİMİ" bölümünde ham kağıt/malzeme birim fiyatları, düzenli giderler ve maaş listesi var. Satış fiyatı ile üretim maliyetini karşılaştırarak marj da hesaplayabilirsin.
İŞLETME GİDER SORULARI: "İŞLETME GİDER KAYITLARI" bölümünde son 30 günün fiili harcama kayıtları var (kategori bazlı toplam + tek tek kayıtlar). "Bu ay toplam ne kadar harcadık?", "En büyük gider kalemi nedir?", "Hakediş ödemeleri ne kadar tuttu?", "Personel giderleri toplamı?" gibi soruları bu veriden cevaplayabilirsin.
EKİPMAN SORULARI: "EKİPMAN / MALZEME LİSTESİ" bölümünde tüm ekipmanların kategori, marka/model, seri numarası, konum ve durumu (aktif/bakımda/arızalı/emekli) var. "Hangi mekanın yazıcısı arızalı?", "Kaç adet kamera var?", "Bakımdaki ekipmanlar neler?", "Toplam kaç ekipman var?" sorularını bu veriden cevaplayabilirsin.
ZİYARET SORULARI: "MEKAN ZİYARET KAYITLARI" bölümünde son 90 günün mekan ziyaret notları ve tarihleri var. "Son mekan ziyareti ne zamandı?", "Hangi mekanlar ziyaret edildi?", "Ziyaret notları neler?" sorularını cevaplayabilirsin.
MÜDÜR RAPORU SORULARI: "MÜDÜR RAPORLARI" bölümünde son 90 günün müdür raporları var. "Son raporda ne yazıyor?", "Hangi müdür kaç rapor yazdı?", "Bu ay rapor var mı?" sorularını cevaplayabilirsin.
DUYURU SORULARI: "AKTİF DUYURULAR" bölümünde şu an yürürlükteki tüm duyurular var. "Aktif duyurular neler?", "Yeni bir duyuru var mı?", "Hangi role duyuru yapılmış?" sorularını cevaplayabilirsin.
STOK HAREKETİ SORULARI: "STOK AKTARIM GEÇMİŞİ" bölümünde son 30 günün mekanlar arası stok transferleri var. "STOK EKLEME GEÇMİŞİ" bölümünde ise depoya veya mekanlara yapılan stok eklemeleri var. "Son 30 günde depoya ne eklendi?", "Mekanlar arası aktarımlar neler?", "Kim stok aktardı?" sorularını cevaplayabilirsin.
GEÇMİŞ GÜN ÜRETİM MALİYETİ SORULARI — KRİTİK KURAL: "MEKAN BAZLI GÜNLÜK OPERASYON GEÇMİŞİ" bölümünde her ürün satırının sonunda (üretim maliyeti: ... TOPLAM ₺X.XX) şeklinde parantez içinde sunucu tarafında önceden hesaplanmış kesin maliyet değerleri bulunur. Bu parantez içindeki TOPLAM ₺ değerini doğrudan kullan — hiçbir koşulda kendi başına yeniden hesaplama yapma ve parantez içeriğini olduğu gibi cevabına kopyalama, yalnızca sayısal sonucu sade bir şekilde yaz. Özellikle albümler için: "5'li Albüm", "5 Kare Albüm", "5 Kare" gibi isimler hepsi 5-kare albüm demektir; üretim maliyeti parantez içindeki TOPLAM değerdir. "GÜN TOPLAM ÜRETİM MALİYETİ: ₺X" satırı o mekanda o günün tüm ürün maliyetlerinin hazır toplamıdır; bunu da doğrudan kullan. Kendi başına hesap yaparsan yanlış sonuç üretirsin — kesinlikle yapma.
ANOMALİ SORULARI: "ANOMALİLER (bugün)" bölümünden bugünkü anomalileri — stok farkları ve yazıcı sayaç farklılıkları dahil — detaylıca cevaplayabilirsin. "SON 30 GÜN ANOMALİ GEÇMİŞİ" bölümünden tarihsel anomali sorgularını yanıtla. Anomali tipleri: Açılış Stok (sayım farkı), Kapanış Stok (beklenen ile gerçek fark), Yazıcı Açılış (sayaç tutarsızlığı), Yazıcı Kapanış (basılan kare ile satış farkı).
İZİN SORULARI: "BUGÜN İZİNLİLER" bölümü bugün (${todayTR}) izinli personeli gösterir. "İZİN GEÇMİŞİ" bölümünde son 90 günün tüm izin kayıtları (startDate → endDate aralığıyla) bulunur. "Dün kim izindeydi?" sorusunda dün = ${dunTR} tarihini kullan ve izin geçmişinde startDate <= ${dunTR} <= endDate olan kayıtları bul. "Bu hafta izinliler?" sorusunda ${haftaBasiTR} → ${todayTR} aralığını kullan. Göreli tarih referansları için yukarıdaki TARİH BİLGİSİ bölümündeki kesin tarihleri kullan — hiçbir zaman tarih bilemiyorum deme.
HAVA DURUMU SORULARI: Kullanıcı bir şehir için hava durumu sorarsa "HAVA DURUMU" bölümünde gerçek zamanlı Open-Meteo verisinden 7 günlük tahmin bulunur. Bugün, yarın veya belirli bir günü sorarsa o tarihi bul ve yanıtla. Şehir tespit edilemezse kullanıcıya tekrar sor. Hava durumunu kısa, net ve emoji ile sun.
ROTASYON SORULARI: "ROTASYON PROGRAMI" bölümünde son 30 gün ve gelecek 7 günün tüm görev atamaları var (tarih, mekan, saat aralığı, görev tipi, durum, atanan personel). "Bugün kim hangi mekanda?", "Yarın rotasyon ne?", "Bu hafta Balık Hali'nde kimler çalışıyor?", "Geçen hafta Zoka'ya kim atandı?", "X kişi bu ay kaç gün görev aldı?" gibi soruları bu veriden cevaplayabilirsin. Durum: Taslak=henüz gönderilmemiş, Gönderildi=aktif görev, Revize=değiştirilmiş, İptal=geçersiz. Sadece "Gönderildi" veya "Revize" statüsündeki görevler fiilen aktif sayılır.${rolKisitlamasi}
${ozetContext}
${systemContext || ""}`;

    // OpenAI API formatına çevir
    const openaiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const m of messages) {
      const role = m.role === "ai" ? "assistant" : "user";
      const content = m.content || m.text || "";
      if (!content.trim()) continue;
      const last = openaiMessages[openaiMessages.length - 1];
      if (last && last.role === role && role !== "system") {
        // Art arda aynı role gelirse birleştir
        last.content += "\n" + content;
      } else {
        openaiMessages.push({ role, content });
      }
    }

    // Son mesaj user ile bitmiyorsa dummy ekle
    if (openaiMessages[openaiMessages.length - 1]?.role !== "user") {
      openaiMessages.push({ role: "user", content: "..." });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: openaiMessages,
          max_tokens: 800,
          temperature: 0.65,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.log("[AI Chat] OpenAI hata:", response.status, errText);
      return c.json({ use_kv: true, error: `OpenAI hatası: ${response.status}` }, 200);
    }

    const data = await response.json();
    const replyContent = data.choices?.[0]?.message?.content || "";
    console.log(`[AI Chat] OpenAI yanıt: ${userName} → ${replyContent.slice(0, 80)}...`);

    return c.json({ reply: replyContent });
  } catch (err) {
    console.log("[AI Chat] Hata:", err);
    return c.json({ use_kv: true, error: `Sunucu hatası: ${err}` }, 200);
  }
});

// ══════════════════════════════════════════
// OYUN: Aspect Runner Skor Sistemi
// GET  /game/skorlar?tip=haftalik|tumzamanlar
// POST /game/skor   { skor, temaSayisi }
// ══════════════════════════════════════════

app.get("/make-server-4da0b637/game/skorlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const tip = c.req.query("tip") || "haftalik";
    const ckv = companyKvFor(getCompanyId(user));
    const tumSkorlar: any[] = await ckv.getByPrefix("game_skor_") || [];

    let filtrelenmis = tumSkorlar;
    if (tip === "haftalik") {
      const gecenHafta = new Date();
      gecenHafta.setDate(gecenHafta.getDate() - 7);
      filtrelenmis = tumSkorlar.filter((s: any) =>
        s.tarih && new Date(s.tarih) >= gecenHafta
      );
    }

    // Kişi başına en yüksek skoru al
    const kisiSkoru: Record<string, any> = {};
    for (const skor of filtrelenmis) {
      const key = skor.userId || skor.isim;
      if (!kisiSkoru[key] || kisiSkoru[key].skor < skor.skor) {
        kisiSkoru[key] = skor;
      }
    }

    const sirali = Object.values(kisiSkoru)
      .sort((a: any, b: any) => b.skor - a.skor)
      .slice(0, 20)
      .map((s: any, i: number) => ({ ...s, sira: i + 1 }));

    return c.json({ skorlar: sirali });
  } catch (err) {
    console.log("Game skorlar error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/game/skor", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { skor, temaSayisi } = await c.req.json();

    if (typeof skor !== "number" || skor < 0) {
      return c.json({ error: "Geçersiz skor." }, 400);
    }

    const isim = user.user_metadata?.full_name || user.email || "Bilinmeyen";
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const kayit = {
      id,
      userId: user.id,
      isim,
      skor: Math.round(skor),
      temaSayisi: temaSayisi || 0,
      tarih: new Date().toISOString(),
    };

    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`game_skor_${id}`, kayit);
    console.log(`Game skor: ${isim} → ${skor}`);
    return c.json({ kayit });
  } catch (err) {
    console.log("Game skor error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// OYUN: Aspect Quest Skor Sistemi
// GET  /game/quest/skorlar?tip=haftalik|tumzamanlar
// POST /game/quest/skor   { skor, seviye, seviyeAdi }
// ══════════════════════════════════════════

app.get("/make-server-4da0b637/game/quest/skorlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const tip = c.req.query("tip") || "haftalik";
    const ckv = companyKvFor(getCompanyId(user));
    const tumSkorlar: any[] = await ckv.getByPrefix("game_quest_skor_") || [];

    let filtrelenmis = tumSkorlar;
    if (tip === "haftalik") {
      const gecenHafta = new Date();
      gecenHafta.setDate(gecenHafta.getDate() - 7);
      filtrelenmis = tumSkorlar.filter((s: any) =>
        s.tarih && new Date(s.tarih) >= gecenHafta
      );
    }

    const kisiSkoru: Record<string, any> = {};
    for (const skor of filtrelenmis) {
      const key = skor.userId || skor.isim;
      if (!kisiSkoru[key] || kisiSkoru[key].skor < skor.skor) {
        kisiSkoru[key] = skor;
      }
    }

    const sirali = Object.values(kisiSkoru)
      .sort((a: any, b: any) => b.skor - a.skor)
      .slice(0, 20)
      .map((s: any, i: number) => ({ ...s, sira: i + 1 }));

    return c.json({ skorlar: sirali });
  } catch (err) {
    console.log("Quest skorlar error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

app.post("/make-server-4da0b637/game/quest/skor", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { skor, seviye, seviyeAdi } = await c.req.json();

    if (typeof skor !== "number" || skor < 0) {
      return c.json({ error: "Geçersiz skor." }, 400);
    }

    const isim = user.user_metadata?.full_name || user.email || "Bilinmeyen";
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const kayit = {
      id,
      userId: user.id,
      isim,
      skor: Math.round(skor),
      seviye: seviye || 0,
      seviyeAdi: seviyeAdi || "",
      tarih: new Date().toISOString(),
    };

    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set(`game_quest_skor_${id}`, kayit);
    console.log(`Quest skor: ${isim} → ${skor} (Seviye ${seviye})`);
    return c.json({ kayit });
  } catch (err) {
    console.log("Quest skor error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// BİLDİRİMLER
// ══════════════════════════════════════════

// GET /bildirimler — oturum açan kullanıcının bildirimleri
app.get("/make-server-4da0b637/bildirimler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const ckv = companyKvFor(getCompanyId(user));
    const all = await ckv.getByPrefix(`notif_${user.id}_`);
    const now = Date.now();
    const TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

    // 24 saati geçenleri KV'den sil (arka planda, beklemeden)
    const expired = (all || []).filter(
      (n: any) => n?.created_at && now - new Date(n.created_at).getTime() > TTL_MS
    );
    if (expired.length > 0) {
      Promise.all(expired.map((n: any) => ckv.del(n.id))).catch(() => {});
      console.log(`[Bildirim TTL] ${expired.length} bildirim 24 saat doldu, silindi.`);
    }

    // Sadece 24 saat içindekileri döndür
    const fresh = (all || []).filter(
      (n: any) => n?.created_at && now - new Date(n.created_at).getTime() <= TTL_MS
    );
    const sorted = fresh.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const unreadCount = sorted.filter((n: any) => !n.read).length;
    return c.json({ notifications: sorted, unreadCount });
  } catch (err) {
    console.log("Get bildirimler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// PUT /bildirimler/hepsini-oku — tüm bildirimleri okundu işaretle
app.put("/make-server-4da0b637/bildirimler/hepsini-oku", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const ckv = companyKvFor(getCompanyId(user));
    const all = await ckv.getByPrefix(`notif_${user.id}_`);
    const unread = (all || []).filter((n: any) => !n.read);
    await Promise.all(unread.map((n: any) => ckv.set(n.id, { ...n, read: true })));
    return c.json({ success: true, markedCount: unread.length });
  } catch (err) {
    console.log("Hepsini oku error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// PUT /bildirimler/:id/oku — tek bildirimi okundu işaretle
app.put("/make-server-4da0b637/bildirimler/:notifId/oku", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const { notifId } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(notifId);
    if (!existing || existing.userId !== user.id) return c.json({ error: "Bildirim bulunamadı." }, 404);
    await ckv.set(notifId, { ...existing, read: true });
    return c.json({ success: true });
  } catch (err) {
    console.log("Bildirim oku error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /bildirimler/:id — bildirimi sil
app.delete("/make-server-4da0b637/bildirimler/:notifId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const { notifId } = c.req.param();
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(notifId);
    if (!existing || existing.userId !== user.id) return c.json({ error: "Bildirim bulunamadı." }, 404);
    await ckv.del(notifId);
    return c.json({ success: true });
  } catch (err) {
    console.log("Bildirim sil error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── Gecikmiş Kayıt Telegram Bildirimi ──────────────────────────────────────────
// POST /make-server-4da0b637/stok/gecikme-bildir
app.post("/make-server-4da0b637/stok/gecikme-bildir", async (c) => {
  try {
    const body = await c.req.json();
    const {
      type,           // 'satis' | 'kare'
      personnelName,
      projectName,
      tarih,
      queuedAt,      // timestamp (ms)
      gecikmeMs,     // ms cinsinden gecikme
      companyId: bodyCompanyId,
      // Satış alanları
      items,
      totalPrice,
      discount,
      paymentMethod,
      currency,
      currencyPrice,
      // Kare alanları
      photographerName,
      frameCount,
    } = body;
    const gecikmeCompanyId: string = bodyCompanyId || "aspect";

    const formatTs = (ms: number) => {
      const d = new Date(ms);
      return d.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    };

    const formatDelay = (ms: number) => {
      const hours = Math.floor(ms / 3600000);
      if (hours < 24) return `${hours} saat`;
      const days = Math.floor(hours / 24);
      const rem = hours % 24;
      return rem > 0 ? `${days} gün ${rem} saat` : `${days} gün`;
    };

    const payLabel = (pm: string) =>
      pm === "cash" ? "Nakit" : pm === "iban" ? "IBAN" : pm === "card" ? "Kart" : pm;

    let msg = "";

    if (type === "satis") {
      const itemLines = (items || [])
        .map((it: any) => `  • ${it.product} x${it.quantity} — ${(it.unitPrice * it.quantity).toLocaleString("tr-TR")} TL`)
        .join("\n");

      const discountLine = discount && discount > 0
        ? `\n  • İskonto: -${Number(discount).toLocaleString("tr-TR")} TL` : "";

      const dovizLine = currencyPrice && currency && currency !== "TRY"
        ? `\n  • Döviz: ${currencyPrice} ${currency}` : "";

      msg =
        `⚠️ <b>GECİKMİŞ SATIŞ GÖNDERİLDİ</b>\n\n` +
        `👤 <b>Personel:</b> ${personnelName}\n` +
        `📍 <b>Mekan:</b> ${projectName}\n` +
        `🗓 <b>Tarih:</b> ${tarih}\n` +
        `🕐 <b>Kuyruğa alındı:</b> ${formatTs(queuedAt)}\n` +
        `📤 <b>Gönderilme:</b> ${formatTs(Date.now())}\n` +
        `⏱ <b>Gecikme:</b> ${formatDelay(gecikmeMs)}\n\n` +
        `🛒 <b>Satış Detayı:</b>\n` +
        `${itemLines}` +
        `${discountLine}\n` +
        `  • <b>Toplam: ${Number(totalPrice).toLocaleString("tr-TR")} TL</b>\n` +
        `  • Ödeme: ${payLabel(paymentMethod)}` +
        `${dovizLine}`;
    } else {
      msg =
        `⚠️ <b>GECİKMİŞ KARE GÖNDERİLDİ</b>\n\n` +
        `👤 <b>Personel:</b> ${personnelName}\n` +
        `📍 <b>Mekan:</b> ${projectName}\n` +
        `🗓 <b>Tarih:</b> ${tarih}\n` +
        `🕐 <b>Kuyruğa alındı:</b> ${formatTs(queuedAt)}\n` +
        `📤 <b>Gönderilme:</b> ${formatTs(Date.now())}\n` +
        `⏱ <b>Gecikme:</b> ${formatDelay(gecikmeMs)}\n\n` +
        `🎞️ <b>Kare Detayı:</b>\n` +
        `  • <b>Fotoğrafçı:</b> ${photographerName}\n` +
        `  • <b>Kare sayısı:</b> ${frameCount}`;
    }

    await sendTelegramMessage(msg, "HTML", gecikmeCompanyId);
    return c.json({ ok: true });
  } catch (err) {
    console.log("gecikme-bildir error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── Telegram Webhook Kurulumu: modül seviyesinden kaldırıldı.
// Cold-start sırasında api.telegram.org'a yapılan ağ çağrısı
// Edge Function'ın ilk yanıt vermesini geciktirip 503'e yol açıyordu.
// Webhook'u yeniden kurmak için GET /telegram/setup-webhook endpoint'ini kullanın.
app.get("/make-server-4da0b637/telegram/setup-webhook", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur"].includes(callerRole)) return c.json({ error: "Yetki yok." }, 403);
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const pidMatch = supabaseUrl.match(/https:\/\/([^.]+)/);
    if (!token || !pidMatch) return c.json({ error: "Token veya URL eksik." }, 400);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const webhookUrl = `https://${pidMatch[1]}.supabase.co/functions/v1/make-server-4da0b637/telegram/webhook?apikey=${anonKey}`;
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["callback_query", "message"], drop_pending_updates: false }),
    });
    const result = await res.json();
    console.log("[TG Webhook setup]", result.ok ? "✅" : "⚠️", result.description || "");
    return c.json({ ok: result.ok, description: result.description, webhookUrl });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// ─────────────────���────────────────────────
// VARDİYA CHECK-IN / CHECK-OUT SİSTEMİ
// ──────────────────────────────────────────

// GET /vardiya/bugun — Bugünkü check-in/out + geç bildirim + sessions + paused
app.get("/make-server-4da0b637/vardiya/bugun", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const userId = user.id;
    const tarih = bizDateTR();
    const ckv = companyKvFor(getCompanyId(user));
    const [checkin, checkout, lateNotice, sessions, paused] = await Promise.all([
      ckv.get(`checkin_${userId}_${tarih}`),
      ckv.get(`checkout_${userId}_${tarih}`),
      ckv.get(`lateNotice_${userId}_${tarih}`),
      ckv.get(`sessions_${userId}_${tarih}`),
      ckv.get(`paused_${userId}_${tarih}`),
    ]);
    return c.json({
      tarih,
      checkin: checkin || null,
      checkout: checkout || null,
      lateNotice: lateNotice || null,
      sessions: sessions || null,
      paused: paused || null,
    });
  } catch (err) {
    console.log("vardiya/bugun error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /vardiya/checkin — Vardiyayı başlat veya devam ettir
app.post("/make-server-4da0b637/vardiya/checkin", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    // ── Ghost mod: superadmin check-in yapamaz ──
    if (user.user_metadata?.originalRole === "superadmin") {
      console.log("[checkin] superadmin ghost mod — check-in atlandı");
      return c.json({ ghost: true, message: "Süper yönetici vardiya check-in'e girmez (ghost mod)." });
    }

    const userId = user.id;
    const userName = user.user_metadata?.name || user.email || userId;
    const body = await c.req.json();
    const { plannedStart, plannedEnd, location, locationIcon, taskId } = body;
    if (!plannedStart) return c.json({ error: "plannedStart gerekli." }, 400);
    const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const tarih = bizDateTR();
    const checkInTime = new Date().toISOString();
    const [ph, pm] = plannedStart.split(":").map(Number);
    const plannedMs = ph * 3600000 + pm * 60000;
    const nowMs = now.getUTCHours() * 3600000 + now.getUTCMinutes() * 60000 + now.getUTCSeconds() * 1000;
    const lateMin = Math.round((nowMs - plannedMs) / 60000);
    const isLate = lateMin > 5;

    // Sessions yönetimi
    const ckv = companyKvFor(getCompanyId(user));
    const existingSessions: any[] = (await ckv.get(`sessions_${userId}_${tarih}`)) || [];

    // Mevcut checkin verisini oku — farklı görev mi kontrol et
    const existingCheckin: any = await ckv.get(`checkin_${userId}_${tarih}`);
    const isNewShift = !existingCheckin || (taskId && existingCheckin.taskId !== taskId);
    const isResume = existingSessions.length > 0 && !isNewShift;

    // Zaten aktif oturum varsa hata dön (aynı görev için)
    if (isResume) {
      const lastSession = existingSessions[existingSessions.length - 1];
      if (!lastSession.checkOut) {
        return c.json({ error: "Zaten aktif bir vardiya var." }, 400);
      }
    }

    // Farklı görev ise ve önceki görev hâlâ aktifse, önce onu kapat
    if (isNewShift && existingSessions.length > 0) {
      const lastSession = existingSessions[existingSessions.length - 1];
      if (!lastSession.checkOut) {
        lastSession.checkOut = checkInTime; // önceki görevi şimdi kapat
      }
    }

    const newSession = {
      checkIn: checkInTime,
      checkOut: null as string | null,
      lateMin: (!isResume && isLate) ? lateMin : 0,
      type: isResume ? "resume" : "initial",
      taskId: taskId || null,
    };
    const updatedSessions = [...existingSessions, newSession];
    await ckv.set(`sessions_${userId}_${tarih}`, updatedSessions);

    // checkin_ anahtarını her zaman güncelle (farklı görev veya ilk giriş)
    const data = { checkInTime, plannedStart, plannedEnd, location, locationIcon, taskId, lateMin: (!isResume && isLate) ? lateMin : 0, userId, tarih };
    if (!isResume || isNewShift) {
      await ckv.set(`checkin_${userId}_${tarih}`, data);
    }
    // Her durumda checkout_ ve paused_ anahtarlarını temizle
    await ckv.del(`checkout_${userId}_${tarih}`);
    await ckv.del(`paused_${userId}_${tarih}`);

    const nowTrHH = String(now.getUTCHours()).padStart(2, "0");
    const nowTrMM = String(now.getUTCMinutes()).padStart(2, "0");
    const nowTrStr = `${nowTrHH}:${nowTrMM}`;

    if (isResume && !isNewShift) {
      console.log(`[Vardiya] Devam: ${userName} — ${tarih} ${nowTrStr}`);
      const tg = `▶️ <b>Vardiya Devam Etti</b>\n\n👤 <b>${userName}</b> vardiyasına geri döndü.\n📍 ${locationIcon || "📍"} ${location || "Bilinmiyor"}\n🕐 Dönüş saati: <b>${nowTrStr}</b>\n📅 Tarih: ${tarih}\n🔄 Oturum: ${updatedSessions.length}. giriş`;
      sendTelegramMessage(tg, "HTML", getCompanyId(user)).catch(() => {});
    } else if (isLate) {
      console.log(`[Vardiya] Check-in (geç): ${userName} — ${tarih} ${plannedStart} → ${lateMin}dk geç`);
      const tg = `⚠️ <b>Geç Giriş Bildirimi</b>\n\n👤 <b>${userName}</b> vardiyasına geç başladı.\n📍 ${locationIcon || "📍"} ${location || "Bilinmiyor"}\n⏰ Planlanan: <b>${plannedStart}</b>\n⏱️ Gecikme: <b>${lateMin} dk</b>\n📅 Tarih: ${tarih}`;
      sendTelegramMessage(tg, "HTML", getCompanyId(user)).catch(() => {});
    } else {
      console.log(`[Vardiya] Check-in: ${userName} — ${tarih} ${plannedStart}`);
      const erken = lateMin < 0 ? ` (${Math.abs(lateMin)} dk erken)` : "";
      const tg = `✅ <b>Vardiya Başladı</b>\n\n👤 <b>${userName}</b> vardiyasına başladı.\n📍 ${locationIcon || "📍"} ${location || "Bilinmiyor"}\n⏰ Planlanan: <b>${plannedStart}</b>\n🕐 Giriş saati: <b>${nowTrStr}</b>${erken}\n📅 Tarih: ${tarih}`;
      sendTelegramMessage(tg, "HTML", getCompanyId(user)).catch(() => {});
    }

    return c.json({ success: true, data, isLate: !isResume && isLate, lateMin: (!isResume && isLate) ? lateMin : 0, isResume, isNewShift });
  } catch (err) {
    console.log("vardiya/checkin error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /vardiya/checkout — Vardiyayı bitir (erken/geçici veya final)
// Body: { plannedEnd, erken?: boolean }
// erken=true → paused durumu (devam ettirebilir)
// erken=false/undefined → final çıkış
app.post("/make-server-4da0b637/vardiya/checkout", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const userId = user.id;
    const userName = user.user_metadata?.name || user.email || userId;
    const body = await c.req.json();
    const { plannedEnd, erken } = body;
    const tarih = bizDateTR();
    const checkOutTime = new Date().toISOString();
    const ckv = companyKvFor(getCompanyId(user));
    const checkin = await ckv.get(`checkin_${userId}_${tarih}`);

    // Sessions güncelle: son açık oturumun checkOut'unu kapat
    const existingSessions: any[] = (await ckv.get(`sessions_${userId}_${tarih}`)) || [];
    if (existingSessions.length > 0) {
      // Son açık oturumu bul
      let lastOpenIdx = -1;
      for (let i = existingSessions.length - 1; i >= 0; i--) {
        if (!existingSessions[i].checkOut) { lastOpenIdx = i; break; }
      }
      if (lastOpenIdx !== -1) {
        existingSessions[lastOpenIdx].checkOut = checkOutTime;
      }
      await ckv.set(`sessions_${userId}_${tarih}`, existingSessions);
    } else {
      // Eski format için geriye dönük uyumluluk: sessions yoksa checkin'den oluştur
      if (checkin?.checkInTime) {
        const retroSessions = [{ checkIn: checkin.checkInTime, checkOut: checkOutTime, lateMin: checkin.lateMin || 0, type: "initial" }];
        await ckv.set(`sessions_${userId}_${tarih}`, retroSessions);
      }
    }

    const nowTR2 = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const outHH = String(nowTR2.getUTCHours()).padStart(2, "0");
    const outMM = String(nowTR2.getUTCMinutes()).padStart(2, "0");
    const outTrStr = `${outHH}:${outMM}`;

    // Toplam çalışılan süreyi sessions üzerinden hesapla
    const updatedSessions: any[] = (await ckv.get(`sessions_${userId}_${tarih}`)) || [];
    let totalWorkedMin = 0;
    for (const s of updatedSessions) {
      if (s.checkIn && s.checkOut) {
        totalWorkedMin += Math.round((new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime()) / 60000);
      }
    }
    const twH = Math.floor(totalWorkedMin / 60);
    const twM = totalWorkedMin % 60;
    const sureStr = twH > 0 ? `${twH} sa ${twM} dk` : `${twM} dk`;

    const loc = checkin?.location || "Bilinmiyor";
    const locIcon = checkin?.locationIcon || "📍";
    const plannedEndStr = plannedEnd || checkin?.plannedEnd || "?";
    const lateMinOut = checkin?.lateMin || 0;

    if (erken) {
      // Geçici çıkış: paused_ yaz, checkout_ yazma
      const pausedData = {
        pausedAt: checkOutTime,
        plannedEnd: plannedEndStr,
        location: loc,
        locationIcon: locIcon,
        sessionCount: updatedSessions.length,
        totalWorkedMin,
      };
      await ckv.set(`paused_${userId}_${tarih}`, pausedData);
      console.log(`[Vardiya] Geçici Çıkış: ${userName} — ${tarih} ${outTrStr}`);
      const tg = `⏸️ <b>Geçici Çıkış</b>\n\n👤 <b>${userName}</b> kısa süreliğine vardiyasından ayrıldı.\n📍 ${locIcon} ${loc}\n🕐 Ayrılış: <b>${outTrStr}</b>\n⏱️ Şimdiye kadar: <b>${sureStr}</b>\n📅 Tarih: ${tarih}\n💡 Devam etmek için tekrar giriş yapabilir.`;
      sendTelegramMessage(tg, "HTML", getCompanyId(user)).catch(() => {});
      return c.json({ success: true, erken: true, totalWorkedMin });
    } else {
      // Final çıkış: checkout_ yaz, paused_ temizle
      const data = { checkOutTime, plannedEnd: plannedEndStr, userId, tarih, totalWorkedMin };
      await ckv.set(`checkout_${userId}_${tarih}`, data);
      await ckv.del(`paused_${userId}_${tarih}`);
      console.log(`[Vardiya] Final Çıkış: ${userName} — ${tarih} ${outTrStr}`);
      const sessionNote = updatedSessions.length > 1 ? `\n🔄 Oturum sayısı: <b>${updatedSessions.length}</b>` : "";
      const tg = `🔴 <b>Vardiya Bitti</b>\n\n👤 <b>${userName}</b> vardiyasını tamamladı.\n📍 ${locIcon} ${loc}\n⏰ Planlanan bitiş: <b>${plannedEndStr}</b>\n🕐 Çıkış saati: <b>${outTrStr}</b>\n⏱️ Toplam çalışılan: <b>${sureStr}</b>${lateMinOut > 0 ? `\n⚠️ Geç giriş: <b>${lateMinOut} dk</b>` : ""}${sessionNote}\n📅 Tarih: ${tarih}`;
      sendTelegramMessage(tg, "HTML", getCompanyId(user)).catch(() => {});
      return c.json({ success: true, data });
    }
  } catch (err) {
    console.log("vardiya/checkout error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /vardiya/gec-bildir — Geç kalma bildirimi gönder
app.post("/make-server-4da0b637/vardiya/gec-bildir", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const userId = user.id;
    const userName = user.user_metadata?.name || user.email || userId;
    const body = await c.req.json();
    const { delayMin, reason, plannedStart, location, locationIcon } = body;
    const tarih = bizDateTR(); // İş günü tarihi (05:00 TR kırılımlı)
    const ckv = companyKvFor(getCompanyId(user));
    const existing = await ckv.get(`lateNotice_${userId}_${tarih}`);
    if (existing) {
      return c.json({ success: true, alreadySent: true, data: existing });
    }
    const data = { sentAt: new Date().toISOString(), delayMin: delayMin || 0, reason: reason || "", plannedStart, location, userId, tarih }; // Gerçek UTC ✓
    await ckv.set(`lateNotice_${userId}_${tarih}`, data);
    const reasonEmoji = reason === "Trafik" ? "🚗" : reason === "Ulaşım" ? "🚌" : "💬";
    const telegramText = `⚠️ <b>Geç Kalma Bildirimi</b>\n\n👤 <b>${userName}</b> geç kalacağını bildirdi.\n📍 ${locationIcon || "📍"} ${location || "Bilinmiyor"}\n⏰ Planlanan giriş: <b>${plannedStart || "?"}</b>\n⏱️ Tahmini gecikme: <b>${delayMin || "?"} dk</b>\n${reasonEmoji} Sebep: <b>${reason || "Belirtilmedi"}</b>\n📅 Tarih: ${tarih}`;
    await sendTelegramMessage(telegramText, "HTML", getCompanyId(user));
    console.log(`[Vardiya] Geç bildirim: ${userName} — ${delayMin}dk, sebep: ${reason}`);
    return c.json({ success: true, alreadySent: false, data });
  } catch (err) {
    console.log("vardiya/gec-bildir error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// GET /vardiya/istatistikler — Yönetici için personel vardiya istatistikleri
app.get("/make-server-4da0b637/vardiya/istatistikler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (!["yonetici", "ust-mudur", "mudur", "operasyon", "idari"].includes(callerRole)) {
      return c.json({ error: "Yetki yok." }, 403);
    }
    const isSAVardiya = user.user_metadata?.originalRole === "superadmin";
    const reqCIdVardiya = c.req.query("company_id");
    const callerCompanyId = (isSAVardiya && reqCIdVardiya) ? reqCIdVardiya : getCompanyId(user);
    const ckv = companyKvFor(callerCompanyId);
    const { searchParams } = new URL(c.req.url);
    const ay = searchParams.get("ay") || new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const [checkins, checkouts, lateNotices] = await Promise.all([
      ckv.getByPrefix("checkin_"),
      ckv.getByPrefix("checkout_"),
      ckv.getByPrefix("lateNotice_"),
    ]);
    const sbAdmin = getAdminClient();
    const { data: { users: allUsers } } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 });
    const personeller = (allUsers || []).filter((u: any) =>
      ["personel", "operasyon", "idari"].includes(u.user_metadata?.role) &&
      getCompanyId(u) === callerCompanyId
    );
    const stats = personeller.map((u: any) => {
      const uid = u.id;
      const name = u.user_metadata?.name || u.email;
      const userCheckins = (checkins || []).filter((item: any) =>
        item?.userId === uid && (item?.tarih || "").startsWith(ay)
      );
      const userCheckouts = (checkouts || []).filter((item: any) =>
        item?.userId === uid && (item?.tarih || "").startsWith(ay)
      );
      const userLates = (lateNotices || []).filter((item: any) =>
        item?.userId === uid && (item?.tarih || "").startsWith(ay)
      );
      const gecGiris = userCheckins.filter((item: any) => (item.lateMin || 0) > 0).length;
      const gecBildirim = userLates.length;
      const toplamGecDk = userCheckins.reduce((sum: number, item: any) => sum + (item.lateMin || 0), 0);
      return {
        userId: uid,
        name,
        role: u.user_metadata?.role,
        toplamVardiya: userCheckins.length,
        toplamCheckout: userCheckouts.length,
        gecGiris,
        gecBildirim,
        toplamGecDk,
        ortGecDk: userCheckins.length > 0 ? Math.round(toplamGecDk / userCheckins.length) : 0,
      };
    });
    return c.json({ ay, stats });
  } catch (err) {
    console.log("vardiya/istatistikler error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// Şirkete özel Telegram Konfigürasyonu
// GET    /make-server-4da0b637/telegram/company-config  → { hasConfig, chatId }
// POST   /make-server-4da0b637/telegram/company-config  → { ok: true }
// DELETE /make-server-4da0b637/telegram/company-config  → { ok: true }
// POST   /make-server-4da0b637/telegram/company-config/test → test mesajı gönder
// Sadece yonetici rolü erişebilir; token hiçbir zaman frontend'e dönmez.
// ══════════════════════════════════════════

app.get("/make-server-4da0b637/telegram/company-config", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role as string;
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici erişebilir." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    const cfg: any = await ckv.get("company_telegram_config");
    return c.json({ hasConfig: !!(cfg?.token && cfg?.chatId), chatId: cfg?.chatId || null });
  } catch (e) {
    console.log("[telegram/company-config GET] Hata:", e);
    return c.json({ error: `Sunucu hatası: ${e}` }, 500);
  }
});

app.post("/make-server-4da0b637/telegram/company-config", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role as string;
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici erişebilir." }, 403);
    const body = await c.req.json();
    const { token, chatId } = body;
    if (!token || typeof token !== "string" || !token.startsWith("bot") && !token.includes(":")) {
      // Token format: "1234567890:ABCDefgh..."
      if (!token || typeof token !== "string" || token.trim().length < 10) {
        return c.json({ error: "Geçersiz Bot Token formatı." }, 400);
      }
    }
    if (!chatId || typeof chatId !== "string" || chatId.trim().length < 3) {
      return c.json({ error: "Geçersiz Chat ID." }, 400);
    }
    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);
    await ckv.set("company_telegram_config", { token: token.trim(), chatId: chatId.trim() });
    console.log(`[telegram/company-config POST] ${companyId} şirketi için Telegram config kaydedildi.`);
    return c.json({ ok: true });
  } catch (e) {
    console.log("[telegram/company-config POST] Hata:", e);
    return c.json({ error: `Sunucu hatası: ${e}` }, 500);
  }
});

app.delete("/make-server-4da0b637/telegram/company-config", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role as string;
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici erişebilir." }, 403);
    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);
    await ckv.del("company_telegram_config");
    console.log(`[telegram/company-config DELETE] ${companyId} şirketi için Telegram config silindi.`);
    return c.json({ ok: true });
  } catch (e) {
    console.log("[telegram/company-config DELETE] Hata:", e);
    return c.json({ error: `Sunucu hatası: ${e}` }, 500);
  }
});

app.post("/make-server-4da0b637/telegram/company-config/test", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role as string;
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici erişebilir." }, 403);
    const companyId = getCompanyId(user);
    const cfg = await getTelegramConfig(companyId);
    if (!cfg) return c.json({ error: "Önce Telegram konfigürasyonu kaydedin." }, 400);
    const senderName = user.user_metadata?.full_name || user.email || "Yönetici";
    const testMsg = `✅ <b>Telegram Bağlantısı Başarılı!</b>\n\n🏢 <b>Şirket:</b> ${companyId.toUpperCase()}\n👤 <b>Test eden:</b> ${senderName}\n🕐 <b>Saat:</b> ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n<i>Bu bir test mesajıdır. Aspect Operations uygulamasından gönderildi.</i>`;
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chatId, text: testMsg, parse_mode: "HTML" }),
    });
    const result = await res.json();
    if (!result.ok) {
      console.log("[telegram/test] Telegram API hatası:", JSON.stringify(result));
      return c.json({ error: `Telegram API hatası: ${result.description || "Bilinmiyor"}` }, 400);
    }
    console.log(`[telegram/test] ${companyId} için test mesajı gönderildi: ${result.result?.message_id}`);
    return c.json({ ok: true, messageId: result.result?.message_id });
  } catch (e) {
    console.log("[telegram/company-config/test] Hata:", e);
    return c.json({ error: `Sunucu hatası: ${e}` }, 500);
  }
});

// ══════════════════════════════════════════
// Şirkete özel OpenAI API Key yönetimi
// GET    /make-server-4da0b637/ai/company-key  → { hasKey: bool }
// POST   /make-server-4da0b637/ai/company-key  → { ok: true }
// DELETE /make-server-4da0b637/ai/company-key  → { ok: true }
// Sadece yonetici rolü erişebilir; key hiçbir zaman frontend'e dönmez.
// ══════════════════════════════════════════

app.get("/make-server-4da0b637/ai/company-key", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role as string;
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici erişebilir." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    const existingKey = await ckv.get("company_openai_key");
    return c.json({ hasKey: !!existingKey });
  } catch (e) {
    console.log("[company-key GET] Hata:", e);
    return c.json({ error: `Sunucu hatası: ${e}` }, 500);
  }
});

app.post("/make-server-4da0b637/ai/company-key", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role as string;
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici erişebilir." }, 403);
    const body = await c.req.json();
    const { apiKey } = body;
    if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("sk-")) {
      return c.json({ error: "Geçersiz API key. 'sk-' ile başlamalıdır." }, 400);
    }
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.set("company_openai_key", apiKey.trim());
    const companyId = getCompanyId(user);
    console.log(`[company-key POST] ${companyId} şirketi için OpenAI key kaydedildi.`);
    return c.json({ ok: true });
  } catch (e) {
    console.log("[company-key POST] Hata:", e);
    return c.json({ error: `Sunucu hatası: ${e}` }, 500);
  }
});

app.delete("/make-server-4da0b637/ai/company-key", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role as string;
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici erişebilir." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del("company_openai_key");
    const companyId = getCompanyId(user);
    console.log(`[company-key DELETE] ${companyId} şirketi için OpenAI key silindi.`);
    return c.json({ ok: true });
  } catch (e) {
    console.log("[company-key DELETE] Hata:", e);
    return c.json({ error: `Sunucu hatası: ${e}` }, 500);
  }
});

// ──────────────────────────────────────────
// XOX OYUNU — Cross-company multiplayer Tic-tac-toe
// ──────────────────────────────────────────

const XOX_WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function xoxCheckWinner(board: string[]): { winner: string | null; line: number[] | null } {
  for (const line of XOX_WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (board.every(cell => cell !== "")) return { winner: "draw", line: null };
  return { winner: null, line: null };
}

function xoxGenerateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /xox/room/create
app.post("/make-server-4da0b637/xox/room/create", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const body = await c.req.json();
    const type: string = body.type || "open";
    const password: string = body.password || "";
    const userName: string = user.user_metadata?.name || user.email || "Anonim";
    const companyId: string = getCompanyId(user);

    let code = xoxGenerateCode();
    let existing = await retryOp(() => kv.get(`xox_room_${code}`));
    let attempts = 0;
    while (existing && attempts < 10) {
      code = xoxGenerateCode();
      existing = await retryOp(() => kv.get(`xox_room_${code}`));
      attempts++;
    }

    const now = Date.now();
    const room = {
      code, type,
      password: type === "private" ? password : "",
      hostId: user.id, hostName: userName, hostCompanyId: companyId,
      guestId: null, guestName: null, guestCompanyId: null,
      status: "waiting",
      board: ["","","","","","","","",""],
      currentTurn: "X",
      winner: null, winLine: null,
      hostScore: 0, guestScore: 0, draws: 0,
      rematchRequestBy: null,
      createdAt: now, lastMoveAt: now,
    };

    await retryOp(() => kv.set(`xox_room_${code}`, room));
    if (type === "open") {
      await retryOp(() => kv.set(`xox_open_${code}`, { code, hostName: userName, createdAt: now }));
    }
    console.log(`[XOX] Oda oluşturuldu: ${code} (${type}) by ${userName}`);
    return c.json({ ok: true, code, room });
  } catch (e) {
    console.log("[XOX] create room error:", e);
    return c.json({ error: `Oda oluşturma hatası: ${e}` }, 500);
  }
});

// GET /xox/rooms/open
app.get("/make-server-4da0b637/xox/rooms/open", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const openMarkers: any[] = await retryOp(() => kv.getByPrefix("xox_open_")) || [];
    const now = Date.now();
    const rooms: any[] = [];
    for (const marker of openMarkers) {
      if (!marker?.code) continue;
      if (now - (marker.createdAt || 0) > 10 * 60 * 1000) {
        await kv.del(`xox_open_${marker.code}`).catch(() => {});
        continue;
      }
      const room: any = await retryOp(() => kv.get(`xox_room_${marker.code}`));
      if (!room || room.status !== "waiting" || room.hostId === user.id) continue;
      rooms.push({ code: room.code, hostName: room.hostName, createdAt: room.createdAt });
    }
    return c.json({ ok: true, rooms });
  } catch (e) {
    console.log("[XOX] open rooms error:", e);
    return c.json({ error: `Oda listesi hatası: ${e}` }, 500);
  }
});

// POST /xox/room/join
app.post("/make-server-4da0b637/xox/room/join", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const body = await c.req.json();
    const code: string = (body.code || "").toUpperCase().trim();
    const password: string = body.password || "";
    const userName: string = user.user_metadata?.name || user.email || "Anonim";
    const companyId: string = getCompanyId(user);

    if (!code) return c.json({ error: "Oda kodu gereklidir" }, 400);
    const room: any = await retryOp(() => kv.get(`xox_room_${code}`));
    if (!room) return c.json({ error: "Oda bulunamadı" }, 404);
    if (room.status !== "waiting") return c.json({ error: "Oda dolu veya oyun bitti" }, 400);
    if (room.hostId === user.id) return c.json({ error: "Kendi odanıza katılamazsınız" }, 400);
    if (room.type === "private" && room.password !== password) return c.json({ error: "Şifre yanlış" }, 403);

    const updatedRoom = {
      ...room,
      guestId: user.id, guestName: userName, guestCompanyId: companyId,
      status: "playing", lastMoveAt: Date.now(),
    };
    await retryOp(() => kv.set(`xox_room_${code}`, updatedRoom));
    await kv.del(`xox_open_${code}`).catch(() => {});
    console.log(`[XOX] ${userName} odaya katıldı: ${code}`);
    return c.json({ ok: true, room: updatedRoom });
  } catch (e) {
    console.log("[XOX] join room error:", e);
    return c.json({ error: `Odaya katılma hatası: ${e}` }, 500);
  }
});

// POST /xox/quickmatch
app.post("/make-server-4da0b637/xox/quickmatch", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const userName: string = user.user_metadata?.name || user.email || "Anonim";
    const companyId: string = getCompanyId(user);
    const now = Date.now();

    const openMarkers: any[] = await retryOp(() => kv.getByPrefix("xox_open_")) || [];
    for (const marker of openMarkers) {
      if (!marker?.code) continue;
      if (now - (marker.createdAt || 0) > 10 * 60 * 1000) continue;
      const room: any = await retryOp(() => kv.get(`xox_room_${marker.code}`));
      if (!room || room.status !== "waiting" || room.hostId === user.id) continue;
      const updatedRoom = { ...room, guestId: user.id, guestName: userName, guestCompanyId: companyId, status: "playing", lastMoveAt: now };
      await retryOp(() => kv.set(`xox_room_${room.code}`, updatedRoom));
      await kv.del(`xox_open_${room.code}`).catch(() => {});
      console.log(`[XOX] Hızlı eşleşme: ${userName} → ${room.code}`);
      return c.json({ ok: true, action: "joined", room: updatedRoom });
    }

    let code = xoxGenerateCode();
    let existing = await retryOp(() => kv.get(`xox_room_${code}`));
    let attempts = 0;
    while (existing && attempts < 10) { code = xoxGenerateCode(); existing = await retryOp(() => kv.get(`xox_room_${code}`)); attempts++; }
    const room = {
      code, type: "open", password: "",
      hostId: user.id, hostName: userName, hostCompanyId: companyId,
      guestId: null, guestName: null, guestCompanyId: null,
      status: "waiting", board: ["","","","","","","","",""],
      currentTurn: "X", winner: null, winLine: null,
      hostScore: 0, guestScore: 0, draws: 0, rematchRequestBy: null,
      createdAt: now, lastMoveAt: now,
    };
    await retryOp(() => kv.set(`xox_room_${code}`, room));
    await retryOp(() => kv.set(`xox_open_${code}`, { code, hostName: userName, createdAt: now }));
    console.log(`[XOX] Hızlı eşleşme: ${userName} yeni oda ${code}`);
    return c.json({ ok: true, action: "created", room });
  } catch (e) {
    console.log("[XOX] quickmatch error:", e);
    return c.json({ error: `Hızlı eşleşme hatası: ${e}` }, 500);
  }
});

// GET /xox/room/:code
app.get("/make-server-4da0b637/xox/room/:code", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const code = c.req.param("code").toUpperCase();
    const room: any = await retryOp(() => kv.get(`xox_room_${code}`));
    if (!room) return c.json({ error: "Oda bulunamadı" }, 404);
    const now = Date.now();
    if (room.status === "playing" && now - room.lastMoveAt > 5 * 60 * 1000) {
      const updatedRoom = { ...room, status: "finished", winner: "timeout" };
      await retryOp(() => kv.set(`xox_room_${code}`, updatedRoom));
      return c.json({ ok: true, room: updatedRoom });
    }
    if (room.status === "waiting" && now - room.createdAt > 15 * 60 * 1000) {
      await kv.del(`xox_room_${code}`).catch(() => {});
      await kv.del(`xox_open_${code}`).catch(() => {});
      return c.json({ error: "Oda süresi doldu" }, 404);
    }
    return c.json({ ok: true, room });
  } catch (e) {
    console.log("[XOX] get room error:", e);
    return c.json({ error: `Oda bilgisi hatası: ${e}` }, 500);
  }
});

// POST /xox/room/:code/move
app.post("/make-server-4da0b637/xox/room/:code/move", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const code = c.req.param("code").toUpperCase();
    const body = await c.req.json();
    const cellIndex: number = body.cellIndex;
    if (cellIndex === undefined || cellIndex < 0 || cellIndex > 8) return c.json({ error: "Geçersiz hücre" }, 400);

    const room: any = await retryOp(() => kv.get(`xox_room_${code}`));
    if (!room) return c.json({ error: "Oda bulunamadı" }, 404);
    if (room.status !== "playing") return c.json({ error: "Oyun aktif değil" }, 400);

    const isHost = room.hostId === user.id;
    const isGuest = room.guestId === user.id;
    if (!isHost && !isGuest) return c.json({ error: "Bu odada oyuncu değilsiniz" }, 403);

    const mySymbol = isHost ? "X" : "O";
    if (room.currentTurn !== mySymbol) return c.json({ error: "Sıra sizde değil" }, 400);
    if (room.board[cellIndex] !== "") return c.json({ error: "Hücre dolu" }, 400);

    const newBoard = [...room.board];
    newBoard[cellIndex] = mySymbol;
    const { winner, line } = xoxCheckWinner(newBoard);
    const nextTurn = mySymbol === "X" ? "O" : "X";
    const now = Date.now();

    let hostScore = room.hostScore || 0;
    let guestScore = room.guestScore || 0;
    let draws = room.draws || 0;
    if (winner === "X") hostScore++;
    else if (winner === "O") guestScore++;
    else if (winner === "draw") draws++;

    const updatedRoom = {
      ...room, board: newBoard,
      currentTurn: winner ? room.currentTurn : nextTurn,
      winner: winner || null, winLine: line || null,
      hostScore, guestScore, draws,
      status: winner ? "finished" : "playing",
      lastMoveAt: now, rematchRequestBy: null,
    };
    await retryOp(() => kv.set(`xox_room_${code}`, updatedRoom));

    if (winner && winner !== "draw") {
      const winnerId = winner === "X" ? room.hostId : room.guestId;
      const winnerName = winner === "X" ? room.hostName : room.guestName;
      const winnerCompanyId = winner === "X" ? room.hostCompanyId : room.guestCompanyId;
      const loserId = winner === "X" ? room.guestId : room.hostId;
      const loserName = winner === "X" ? room.guestName : room.hostName;
      const loserCompanyId = winner === "X" ? room.guestCompanyId : room.hostCompanyId;
      const ws: any = (await kv.get(`xox_score_${winnerId}`)) || { wins: 0, losses: 0, draws: 0 };
      await kv.set(`xox_score_${winnerId}`, { userId: winnerId, userName: winnerName, companyId: winnerCompanyId, wins: (ws.wins || 0) + 1, losses: ws.losses || 0, draws: ws.draws || 0 });
      const ls: any = (await kv.get(`xox_score_${loserId}`)) || { wins: 0, losses: 0, draws: 0 };
      await kv.set(`xox_score_${loserId}`, { userId: loserId, userName: loserName, companyId: loserCompanyId, wins: ls.wins || 0, losses: (ls.losses || 0) + 1, draws: ls.draws || 0 });
    } else if (winner === "draw") {
      for (const [pid, pname, pcid] of [[room.hostId, room.hostName, room.hostCompanyId],[room.guestId, room.guestName, room.guestCompanyId]] as [string,string,string][]) {
        if (!pid) continue;
        const sc: any = (await kv.get(`xox_score_${pid}`)) || { wins: 0, losses: 0, draws: 0 };
        await kv.set(`xox_score_${pid}`, { userId: pid, userName: pname, companyId: pcid, wins: sc.wins || 0, losses: sc.losses || 0, draws: (sc.draws || 0) + 1 });
      }
    }
    return c.json({ ok: true, room: updatedRoom });
  } catch (e) {
    console.log("[XOX] move error:", e);
    return c.json({ error: `Hamle hatası: ${e}` }, 500);
  }
});

// POST /xox/room/:code/rematch
app.post("/make-server-4da0b637/xox/room/:code/rematch", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const code = c.req.param("code").toUpperCase();
    const room: any = await retryOp(() => kv.get(`xox_room_${code}`));
    if (!room) return c.json({ error: "Oda bulunamadı" }, 404);
    if (room.status !== "finished") return c.json({ error: "Oyun henüz bitmedi" }, 400);
    const isHost = room.hostId === user.id;
    const isGuest = room.guestId === user.id;
    if (!isHost && !isGuest) return c.json({ error: "Bu odada değilsiniz" }, 403);

    const alreadyRequested = room.rematchRequestBy && room.rematchRequestBy !== user.id;
    let updatedRoom: any;
    if (alreadyRequested) {
      updatedRoom = { ...room, board: ["","","","","","","","",""], currentTurn: room.currentTurn === "X" ? "O" : "X", winner: null, winLine: null, status: "playing", rematchRequestBy: null, lastMoveAt: Date.now() };
    } else {
      updatedRoom = { ...room, rematchRequestBy: user.id };
    }
    await retryOp(() => kv.set(`xox_room_${code}`, updatedRoom));
    return c.json({ ok: true, room: updatedRoom });
  } catch (e) {
    console.log("[XOX] rematch error:", e);
    return c.json({ error: `Yeniden oynama hatası: ${e}` }, 500);
  }
});

// POST /xox/room/:code/leave
app.post("/make-server-4da0b637/xox/room/:code/leave", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const code = c.req.param("code").toUpperCase();
    await kv.del(`xox_room_${code}`).catch(() => {});
    await kv.del(`xox_open_${code}`).catch(() => {});
    console.log(`[XOX] Oda silindi: ${code}`);
    return c.json({ ok: true });
  } catch (e) {
    console.log("[XOX] leave error:", e);
    return c.json({ error: `Ayrılma hatası: ${e}` }, 500);
  }
});

// GET /xox/leaderboard
app.get("/make-server-4da0b637/xox/leaderboard", async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: "Yetkisiz erişim" }, 401);
  try {
    const myCompanyId = getCompanyId(user);
    const scores: any[] = await retryOp(() => kv.getByPrefix("xox_score_")) || [];
    const sorted = scores
      .filter((s: any) => s && s.userId && (s.wins > 0 || s.losses > 0 || s.draws > 0))
      .sort((a: any, b: any) => (b.wins || 0) - (a.wins || 0))
      .slice(0, 50)
      .map((s: any) => ({
        userId: s.userId,
        displayName: s.companyId === myCompanyId ? s.userName : "Gizemli Rakip",
        companyId: s.companyId,
        isSameCompany: s.companyId === myCompanyId,
        wins: s.wins || 0, losses: s.losses || 0, draws: s.draws || 0,
      }));
    return c.json({ ok: true, leaderboard: sorted });
  } catch (e) {
    console.log("[XOX] leaderboard error:", e);
    return c.json({ error: `Liderboard hatası: ${e}` }, 500);
  }
});

// ──────────────────────────────────────────

// Kare Coin & TKM Oyunu route'larını kaydet
registerKareTkmRoutes(app, verifyToken);


// ══════════════════════════════════════════
// ═══ AKADEMİ SİSTEMİ ═══════════════════
// ══════════════════════════════════════════
// KV: academy_categories → [{ id, name, emoji, order }]
// KV: academy_content_{id} → { id, categoryId, type, title, description, data, order, createdAt, createdBy }
// KV: academy_progress_{userId} → { [contentId]: { watched: bool, date: string } }
// İçerik tipleri: video (youtubeId), text (html/markdown), pdf (url), gallery (images[]), quiz (questions[]), link (url)

// GET /academy — Tüm kategoriler + içerikler + kullanıcı ilerlemesi
app.get("/make-server-4da0b637/academy", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const companyId = (isSA && reqCId) ? reqCId : getCompanyId(user);

    const [categories, allContent, progress, announcement, globalCats, globalContent, hiddenList] = await Promise.all([
      ckv.get("academy_categories"),
      ckv.getByPrefix("academy_content_"),
      ckv.get(`academy_progress_${user.id}`),
      ckv.get("academy_announcement"),
      kv.get("academy_global_categories"),
      kv.getByPrefix("academy_global_content_"),
      ckv.get("academy_hidden"),
    ]);

    const hidden = new Set(hiddenList || []);

    // Şirket kategorileri
    const localCats = (categories || []).map((c: any) => ({ ...c, global: false }));
    // Global kategoriler — gizlenmemişleri ekle
    const gCats = (globalCats || []).filter((c: any) => !hidden.has(c.id)).map((c: any) => ({ ...c, global: true }));
    const cats = [...localCats, ...gCats].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

    // Şirket içerikleri
    const localContents = (allContent || []).map((c: any) => ({ ...c, global: false }));
    // Global içerikler — gizlenmemişleri ekle
    const gContents = (globalContent || []).filter((c: any) => !hidden.has(c.id) && !hidden.has(c.categoryId)).map((c: any) => ({ ...c, global: true }));
    const contents = [...localContents, ...gContents].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

    // Gizlenen içerikleri de döndür (admin görmek isterse)
    const hiddenGlobalCats = (globalCats || []).filter((c: any) => hidden.has(c.id)).map((c: any) => ({ ...c, global: true, gizli: true }));
    const hiddenGlobalContents = (globalContent || []).filter((c: any) => hidden.has(c.id) || hidden.has(c.categoryId)).map((c: any) => ({ ...c, global: true, gizli: true }));

    return c.json({ categories: cats, contents, progress: progress || {}, announcement: announcement || null, companyId, hiddenItems: hiddenList || [], hiddenCategories: hiddenGlobalCats });
  } catch (err) {
    console.log("Academy GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /academy/category — Kategori ekle/güncelle (yönetici)
app.post("/make-server-4da0b637/academy/category", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);

    const body = await c.req.json();
    const { id, name, emoji, order } = body;
    if (!name?.trim()) return c.json({ error: "Kategori adı zorunlu." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const cats = (await ckv.get("academy_categories")) || [];
    const catId = id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const existing = cats.findIndex((c: any) => c.id === catId);
    const cat = { id: catId, name: name.trim(), emoji: emoji || "📚", order: order ?? cats.length };
    if (existing >= 0) cats[existing] = cat;
    else cats.push(cat);

    await ckv.set("academy_categories", cats);
    return c.json({ category: cat });
  } catch (err) {
    console.log("Academy category POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /academy/category/:id — Kategori sil
app.delete("/make-server-4da0b637/academy/category/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);

    const catId = c.req.param("id");
    const ckv = companyKvFor(getCompanyId(user));
    const cats = (await ckv.get("academy_categories")) || [];
    const filtered = cats.filter((cat: any) => cat.id !== catId);
    await ckv.set("academy_categories", filtered);

    // İlgili içerikleri de sil
    const allContent = (await ckv.getByPrefix("academy_content_")) || [];
    const toDelete = allContent.filter((ct: any) => ct.categoryId === catId);
    for (const ct of toDelete) {
      await ckv.del(`academy_content_${ct.id}`);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.log("Academy category DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /academy/content — İçerik ekle/güncelle (yönetici)
app.post("/make-server-4da0b637/academy/content", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);

    const body = await c.req.json();
    const { id, categoryId, type, title, description, data, order } = body;

    if (!categoryId || !type || !title?.trim()) {
      return c.json({ error: "categoryId, type ve title zorunlu." }, 400);
    }

    const validTypes = ["video", "text", "pdf", "gallery", "quiz", "link"];
    if (!validTypes.includes(type)) return c.json({ error: `Geçersiz tip: ${type}` }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const contentId = id || `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const content = {
      id: contentId,
      categoryId,
      type,
      title: title.trim(),
      description: description?.trim() || "",
      data: data || {},
      order: order ?? 0,
      createdAt: id ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.user_metadata?.full_name || user.email || "",
    };

    // Eğer güncelleme ise createdAt'i koru
    if (id) {
      const existing = await ckv.get(`academy_content_${id}`);
      if (existing) content.createdAt = existing.createdAt;
    }
    if (!content.createdAt) content.createdAt = new Date().toISOString();

    await ckv.set(`academy_content_${contentId}`, content);
    return c.json({ content });
  } catch (err) {
    console.log("Academy content POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /academy/content/:id — İçerik sil
app.delete("/make-server-4da0b637/academy/content/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);

    const contentId = c.req.param("id");
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`academy_content_${contentId}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Academy content DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /academy/progress — İçerik tamamlandı işaretle
app.post("/make-server-4da0b637/academy/progress", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { contentId, watched } = await c.req.json();
    if (!contentId) return c.json({ error: "contentId zorunlu." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const key = `academy_progress_${user.id}`;
    const progress = (await ckv.get(key)) || {};

    if (watched === false) {
      delete progress[contentId];
    } else {
      progress[contentId] = { watched: true, date: new Date().toISOString() };
    }

    await ckv.set(key, progress);
    return c.json({ progress });
  } catch (err) {
    console.log("Academy progress POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── GLOBAL AKADEMİ ──

// POST /academy/global/category — Global kategori ekle/güncelle
app.post("/make-server-4da0b637/academy/global/category", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici." }, 403);

    const { id, name, emoji, order } = await c.req.json();
    if (!name?.trim()) return c.json({ error: "Kategori adı zorunlu." }, 400);

    const cats = (await kv.get("academy_global_categories")) || [];
    const catId = id || `gcat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const companyId = getCompanyId(user);

    // Düzenleme: sadece oluşturan şirket
    if (id) {
      const existing = cats.find((c: any) => c.id === id);
      if (existing && existing.createdByCompany && existing.createdByCompany !== companyId) {
        return c.json({ error: "Bu kategoriyi sadece oluşturan şirket düzenleyebilir." }, 403);
      }
    }

    const cat = { id: catId, name: name.trim(), emoji: emoji || "📁", order: order ?? cats.length, global: true, createdByCompany: companyId, createdBy: user.user_metadata?.full_name || "" };
    const idx = cats.findIndex((c: any) => c.id === catId);
    if (idx >= 0) { cat.createdByCompany = cats[idx].createdByCompany; cats[idx] = cat; }
    else cats.push(cat);

    await kv.set("academy_global_categories", cats);
    return c.json({ category: cat });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// DELETE /academy/global/category/:id
app.delete("/make-server-4da0b637/academy/global/category/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici") return c.json({ error: "Sadece yönetici." }, 403);

    const catId = c.req.param("id");
    const companyId = getCompanyId(user);
    const cats = (await kv.get("academy_global_categories")) || [];
    const cat = cats.find((c: any) => c.id === catId);
    if (cat && cat.createdByCompany && cat.createdByCompany !== companyId) {
      return c.json({ error: "Bu kategoriyi sadece oluşturan şirket silebilir." }, 403);
    }

    await kv.set("academy_global_categories", cats.filter((c: any) => c.id !== catId));
    // İçerikleri de sil
    const allContent = (await kv.getByPrefix("academy_global_content_")) || [];
    for (const ct of allContent) { if (ct.categoryId === catId) await kv.del(`academy_global_content_${ct.id}`); }
    return c.json({ ok: true });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// POST /academy/global/content — Global içerik ekle/güncelle
app.post("/make-server-4da0b637/academy/global/content", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici") return c.json({ error: "Sadece yönetici." }, 403);

    const body = await c.req.json();
    const { id, categoryId, type, title, description, data, order } = body;
    if (!categoryId || !type || !title?.trim()) return c.json({ error: "categoryId, type ve title zorunlu." }, 400);

    const companyId = getCompanyId(user);
    const contentId = id || `gcnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Düzenleme: sadece oluşturan şirket
    if (id) {
      const existing = await kv.get(`academy_global_content_${id}`);
      if (existing && existing.createdByCompany && existing.createdByCompany !== companyId) {
        return c.json({ error: "Bu içeriği sadece oluşturan şirket düzenleyebilir." }, 403);
      }
    }

    const content = {
      id: contentId, categoryId, type, title: title.trim(),
      description: description?.trim() || "", data: data || {}, order: order ?? 0,
      global: true, createdByCompany: companyId,
      createdBy: user.user_metadata?.full_name || "",
      createdAt: id ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (id) { const ex = await kv.get(`academy_global_content_${id}`); if (ex?.createdAt) content.createdAt = ex.createdAt; content.createdByCompany = ex?.createdByCompany || companyId; }
    if (!content.createdAt) content.createdAt = new Date().toISOString();

    await kv.set(`academy_global_content_${contentId}`, content);
    return c.json({ content });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// DELETE /academy/global/content/:id
app.delete("/make-server-4da0b637/academy/global/content/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici") return c.json({ error: "Sadece yönetici." }, 403);

    const contentId = c.req.param("id");
    const companyId = getCompanyId(user);
    const existing = await kv.get(`academy_global_content_${contentId}`);
    if (existing && existing.createdByCompany && existing.createdByCompany !== companyId) {
      return c.json({ error: "Bu içeriği sadece oluşturan şirket silebilir." }, 403);
    }
    await kv.del(`academy_global_content_${contentId}`);
    return c.json({ ok: true });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// POST /academy/hide — İçerik/kategori gizle/göster (şirkete özel)
app.post("/make-server-4da0b637/academy/hide", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici") return c.json({ error: "Sadece yönetici." }, 403);

    const ckv = companyKvFor(getCompanyId(user));
    const { itemId, hide } = await c.req.json();
    if (!itemId) return c.json({ error: "itemId zorunlu." }, 400);

    const hidden: string[] = (await ckv.get("academy_hidden")) || [];
    if (hide && !hidden.includes(itemId)) hidden.push(itemId);
    else if (!hide) { const idx = hidden.indexOf(itemId); if (idx >= 0) hidden.splice(idx, 1); }

    await ckv.set("academy_hidden", hidden);
    return c.json({ hidden });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// POST /academy/toggle-global — İçeriği/kategoriyi globale taşı veya globalden kaldır
app.post("/make-server-4da0b637/academy/toggle-global", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici") return c.json({ error: "Sadece yönetici." }, 403);

    const companyId = getCompanyId(user);
    const ckv = companyKvFor(companyId);
    const { type, id, toGlobal } = await c.req.json(); // type: 'category' | 'content'

    if (type === 'category') {
      if (toGlobal) {
        // Şirketten → Global
        const localCats = (await ckv.get("academy_categories")) || [];
        const cat = localCats.find((c: any) => c.id === id);
        if (!cat) return c.json({ error: "Kategori bulunamadı." }, 404);

        // Global'e ekle
        const globalCats = (await kv.get("academy_global_categories")) || [];
        globalCats.push({ ...cat, global: true, createdByCompany: companyId, createdBy: user.user_metadata?.full_name || "" });
        await kv.set("academy_global_categories", globalCats);

        // İçerikleri de taşı
        const localContents = (await ckv.getByPrefix("academy_content_")) || [];
        for (const ct of localContents) {
          if (ct.categoryId === id) {
            await kv.set(`academy_global_content_${ct.id}`, { ...ct, global: true, createdByCompany: companyId });
            await ckv.del(`academy_content_${ct.id}`);
          }
        }

        // Şirketten kaldır
        await ckv.set("academy_categories", localCats.filter((c: any) => c.id !== id));
        return c.json({ ok: true, direction: 'toGlobal' });

      } else {
        // Global → Şirkete (sadece oluşturan)
        const globalCats = (await kv.get("academy_global_categories")) || [];
        const cat = globalCats.find((c: any) => c.id === id);
        if (!cat) return c.json({ error: "Kategori bulunamadı." }, 404);
        if (cat.createdByCompany && cat.createdByCompany !== companyId) {
          return c.json({ error: "Bu kategoriyi sadece oluşturan şirket kaldırabilir." }, 403);
        }

        // Şirkete ekle
        const localCats = (await ckv.get("academy_categories")) || [];
        localCats.push({ ...cat, global: false });
        await ckv.set("academy_categories", localCats);

        // İçerikleri de taşı
        const globalContents = (await kv.getByPrefix("academy_global_content_")) || [];
        for (const ct of globalContents) {
          if (ct.categoryId === id) {
            await ckv.set(`academy_content_${ct.id}`, { ...ct, global: false });
            await kv.del(`academy_global_content_${ct.id}`);
          }
        }

        // Globalden kaldır
        await kv.set("academy_global_categories", globalCats.filter((c: any) => c.id !== id));
        return c.json({ ok: true, direction: 'toLocal' });
      }
    }

    return c.json({ error: "Geçersiz type." }, 400);
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// POST /academy/seed-guide — Uygulama Kullanım Rehberi seed'le (global)
// Kategori yoksa oluşturur, varsa mevcut kategoriye eksik içerikleri ekler.
app.post("/make-server-4da0b637/academy/seed-guide", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici bu işlemi yapabilir." }, 403);
    const companyId = getCompanyId(user);
    const now = new Date().toISOString();
    const createdBy = user.user_metadata?.full_name || user.email || "Sistem";

    // Kategoriyi bul veya oluştur
    const globalCats: any[] = (await kv.get("academy_global_categories")) || [];
    let cat = globalCats.find((c: any) => c.name === "Uygulama Kullanımı");
    if (!cat) {
      cat = { id: `gcat_guide_${Date.now()}`, name: "Uygulama Kullanımı", emoji: "📱", order: 0, global: true, createdByCompany: companyId };
      globalCats.push(cat);
      await kv.set("academy_global_categories", globalCats);
    }
    const catId = cat.id;

    // Mevcut içerikleri al — title bazında duplicate kontrolü
    const existingContents: any[] = (await kv.getByPrefix("academy_global_content_")) || [];
    const existingTitles = new Set(existingContents.filter((c: any) => c.categoryId === catId).map((c: any) => c.title));

    // Tüm rehber içerikleri
    const allGuideContents = [
      {
        title: "Vardiya Açılış & Kapanış",
        description: "Günlük açılış ve kapanış sürecinin detaylı rehberi",
        order: 1,
        data: { content: `Vardiya Açılışı her gün iş başında, Kapanış gün sonunda yapılır. Bu ikisi birlikte günlük stok ve satış takibinin temelini oluşturur.

━━━━━━━━━━━━━━━━━━━━
Vardiya AÇILIŞ
━━━━━━━━━━━━━━━━━━━━

1. STOK SAYIMI
Açılışta tüm albümleri (3, 5, 7, 9, 11, 13, 15 Kare) ve ribon takımlarını fiziksel olarak saymanız gerekir.

📌 Ribon Takımı Nedir?
Ribon takımı, ribon kutusunun içindeki tek baskı filmi rulosudur. Kutu ile takımı karıştırmayın: Örneğin bir Citizen CX-02 kutusunda 2 takım, bir Kodak kutusunda 1 takım ribon bulunur. Uygulamada her yerde yalnızca takım sayısı baz alınır — kutu değil. Sayım yaparken açılmamış kutuları takıma çevirmeyi unutmayın.

Ekranda dünkü kapanıştan gelen "önerilen" değerler yüklü olarak gelir — bu değerlere güvenip geçmeyin, mutlaka fiziksel sayımınızı yapın. Sayım sonucunuz önerilen değerden farklıysa, kendi saydığınız değeri girin. Sistem farkı otomatik algılar.

⚠️ Anomali Hakkında:
Açılıştaki sayımınız ile bir önceki kapanış değeri arasında fark varsa bu "anomali" olarak kaydedilir. Önemli: Bu anomali bir önceki kapanış vardiyasındaki ekibe yazılır, size değil. Uygulama her daim açılış sayımını dikkate alır. Çünkü fark onların kapanış sayımından kaynaklanmaktadır. Bu yüzden doğru saydığınızdan emin olun ve kendi değerinizi girin.

2. YAZICI SAYAÇLARI
Her yazıcının ekranındaki sayaç numarasını okuyup girin. En az 1 yazıcı sayacı girilmesi zorunludur. Açılışta yazıcı sayacı gözükmüyorsa vardiya açılışı yapılamaz. Yöneticinizle iletişime geçin. Eğer bir önce ki gün yazıcı sayacı "0" olarak bırakıldıysa açılışa "0" yazın ve daha sonra ribon değişimi yapın.

3. REYON (Opsiyonel)
Bugün reyon kullanılacaksa toggle'ı açın ve reyona koyduğunuz albüm adetlerini girin. Kapanışta reyonda kalan sayılacak, aradaki fark satılan olarak hesaplanacaktır.

4. PERSONEL FOTOĞRAFI (Zorunlu)
Vardiya başındaki ekibin fotoğrafını çekin. Fotoğraf olmadan açılış gönderilemez. Bulanık, karanlık ve anlamsız fotoğraf göndermemek için göndermeden önce kontrol edin.

━━━━━━━━━━━━━━━━━━━━
Vardiya KAPANIŞ
━━━━━━━━━━━━━━━━━━━━

1. YAZICI BİTİŞ SAYAÇLARI
Her yazıcının güncel sayacını girin. Yazıcılar seri numaraları ile belirtilmiştir. Başka bir yazıcının bitişini başka bir yazıcıya girmemek için gereken dikkati gösterin. Gün içinde kaç ribon değiştirildi seri numarası ile kontrol ettiğiniz ilgili yazıcıya ve varsa toplam kaç fotoğraf iade edildi bilgilerini ekleyin. Bu bilgiler gereklidir. Dikkatle alanların tamamını doldurun.

2. STOK KAPANIŞ SAYIMI
Reyon açıksa reyonda kalan albümleri sayın. Ekleme yapıldıysa ilgili alanı doldurun. Reyon kapalıysa tüm stoğu baştan sayın. Sistem açılış stoku, satışlar ve eklemelere göre "beklenen" kapanış değerini hesaplar. Saydığınız değer beklenenden farklıysa anomali olarak kaydedilir. Dikkatli ve acele etmeden doğru değerleri girin.

3. MEKAN FOTOĞRAFI (Zorunlu)
Mekanın kapanış durumunun fotoğrafını çekin. Fotoğraf olmadan kapanış tamamlanamaz.

4. GÖNDER
"Vardiyayı Tamamla"ya basın.

━━━━━━━━━━━━━━━━━━━━
ÖNEMLİ NOTLAR
━━━━━━━━━━━━━━━━━━━━

• Fotoğrafı önce çekin, sonra sayımlara geçin
• Önerilen değerlere körü körüne güvenmeyin — mutlaka fiziksel sayım yapın
• Anomali uyarısı gelirse kendi sayımınızdan eminseniz "Yine de Gönder" diyebilirsiniz
• Paspartu: Paspartu sayımı yapılmaz. Ancak paspartu azalmışsa, bir sonraki vardiyada çalışacak ekibe mutlaka bilgi verin ki tedarik süreci aksamamış olsun.

👁️ Gözlemcilere Not:
Gözlemciler, düzenli aralıklarla stok kontrolü yapmalıdır. Bu hem vardiyadaki personele yardımcı olur hem de olası sayım hatalarının erken tespit edilip önüne geçilmesini sağlar.` },
      },
      {
        title: "Kare Sistemi",
        description: "Fotoğraf kare girişi nasıl yapılır",
        order: 2,
        data: { content: `Kare Nedir?
Kare, fotoğrafçının vardiyası boyunca çektiği toplam fotoğraf karesi sayısıdır.

━━━━━━━━━━━━━━━━━━━━
KARE GİRİŞİ NEREDE YAPILIR?
━━━━━━━━━━━━━━━━━━━━

Vardiya ekranında üstte 4 sekme bulunur: Açılış, Satış, Kare, Kapanış. "📷 Kare" sekmesine tıklayarak kare giriş ekranına geçersiniz.

━━━━━━━━━━━━━━━━━━━━
NASIL KAYDEDİLİR?
━━━━━━━━━━━━━━━━━━━━

Öncelikli olarak baskıyı yapacak kişinin kare girişi beklenir. Adımlar:

1. Vardiya ekranında üst menüden "📷 Kare" sekmesine tıklayın
2. Fotoğrafçıyı seçin — rotasyondaki personel listesi otomatik gelir
3. "Kaç kare teslim edildi?" alanına kare sayısını girin
4. "Kareyi Kaydet" butonuna basın
5. Saat otomatik kaydedilir

Birden fazla giriş yapabilirsiniz — örneğin sabah 100, öğleden sonra 150 kare girebilirsiniz. Sistem hepsini toplar. Günün tüm kayıtları ekranın altında listelenir.

━━━━━━━━━━━━━━━━━━━━
DOĞRULUK ÖNEMLİDİR
━━━━━━━━━━━━━━━━━━━━

Kare girişinin çok olması veya az olması daha iyi ya da daha kötü değildir. Önemli olan doğru olmasıdır. Sistem; kare sayısı, iade, satış ve ciro verilerini birlikte değerlendirerek orantılı bir hesaplama yapar. Yanlış kare girişi bu hesaplamaları bozar ve tüm vardiya verilerini olumsuz etkiler.

━━━━━━━━━━━━━━━━━━━━
KURALLAR
━━━━━━━━━━━━━━━━━━━━

• Sadece o gün rotasyonunuzda atandığınız mekanda kare kaydı yapabilirsiniz
• Sadece pozitif sayı kabul edilir
• Kapanış yapıldıktan sonra kare girişi değiştirilemez
• Yanlış giriş varsa sadece yönetici silebilir` },
      },
      {
        title: "Satış Girişi",
        description: "Satış kaydetme, iskonto ve ödeme yöntemleri",
        order: 3,
        data: { content: `Satış Nasıl Kaydedilir?
Vardiya ekranında üst menüden "⚡ Satış" sekmesine tıklayarak satış ekranına geçersiniz.

━━━━━━━━━━━━━━━━━━━━
ADIMLAR
━━━━━━━━━━━━━━━━━━━━

1. Ürün kartlarına tıklayarak sepete ekleyin (1 Fotoğraf, 3'lü, 5'li, 7'li, 9'lu, 11'li, 13'lü, 15'li). Her tıklama adedi 1 artırır. Sepetteki + ve − butonlarıyla adedi ayarlayabilirsiniz.
2. İskonto uygulanacaksa 🏷️ İskonto butonuna basın, ₺ cinsinden indirim tutarını girin.
3. "İlerle" butonuna basın.
4. Ödeme yöntemini seçin: 💵 Nakit, 💳 Kredi Kartı veya 🏦 İban/Havale.
5. "Satışı Yap" butonuyla satışı tamamlayın.

━━━━━━━━━━━━━━━━━━━━
DÖVİZLİ MÜŞTERİLER
━━━━━━━━━━━━━━━━━━━━

Satış ekranının alt kısmında canlı döviz kurları gösterilir. Yabancı müşteriye fiyat söylerken ilgili dövize tıklayarak karşılığını görebilirsiniz.

Bazı mekanlar döviz cinsinden fiyatlandırılmıştır (ör: EUR). Bu mekanlarda ürün fiyatları otomatik olarak döviz cinsinden gösterilir ve satış kaydedilirken güncel kur üzerinden TL'ye çevrilir.

━━━━━━━━━━━━━━━━━━━━
SATIŞ İPTALİ
━━━━━━━━━━━━━━━━━━━━

Hatalı bir satışı iptal etmek için satış kaydının yanındaki × butonuna basın. İptal sebebi yazmanız zorunludur. Talebiniz yöneticiye iletilir ve 3 dakika içinde onay/red beklenir. Yönetici onaylamazsa satış geçerli kalır.

━━━━━━━━━━━━━━━━━━━━
ÇEVRİMDIŞI ÇALIŞMA
━━━━━━━━━━━━━━━━━━━━

İnternet bağlantısı kesilse bile satış kaydedebilirsiniz. Satışlar kuyruğa alınır ve bağlantı geldiğinde otomatik gönderilir. Bekleyen satışlar turuncu çerçeveyle gösterilir.

━━━━━━━━━━━━━━━━━━━━
DİKKAT
━━━━━━━━━━━━━━━━━━━━

• Ürün fiyatları mekan bazlı sabitlenmiştir, değiştirilemez
• İskonto tutarı toplam fiyatı geçemez
• Her satışta ödeme yöntemi seçilmesi zorunludur
• Satış iptali sadece yönetici onayıyla gerçekleşir` },
      },
    ];

    // Sadece henüz eklenmemiş içerikleri ekle
    let eklenen = 0;
    for (const guide of allGuideContents) {
      if (existingTitles.has(guide.title)) continue;
      const content = {
        id: `gcnt_guide_${guide.title.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        categoryId: catId, type: "text",
        title: guide.title, description: guide.description, data: guide.data,
        order: guide.order, createdAt: now, createdBy, global: true, createdByCompany: companyId,
      };
      await kv.set(`academy_global_content_${content.id}`, content);
      eklenen++;
    }

    console.log(`[Academy] Rehber güncellendi: ${eklenen} yeni içerik eklendi, kullanıcı=${createdBy}`);
    return c.json({ ok: true, kategori: catId, yeniIcerik: eklenen, toplamIcerik: allGuideContents.length });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// POST /academy/announcement — Yönetici duyuru mesajı yaz/güncelle
app.post("/make-server-4da0b637/academy/announcement", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);

    const { message } = await c.req.json();
    if (!message?.trim()) return c.json({ error: "Mesaj zorunlu." }, 400);

    const ckv = companyKvFor(getCompanyId(user));
    const announcement = {
      message: message.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: user.user_metadata?.full_name || user.email || "",
    };
    await ckv.set("academy_announcement", announcement);
    return c.json({ announcement });
  } catch (err) {
    console.log("Academy announcement POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /academy/announcement — Duyuru sil
app.delete("/make-server-4da0b637/academy/announcement", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);

    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del("academy_announcement");
    return c.json({ ok: true });
  } catch (err) {
    console.log("Academy announcement DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// ═══ KASA SİSTEMİ ══════════════════════
// ══════════════════════════════════════════

// ── Helper: stok_gunluk → ciro hesapla ──
function hesaplaCiro(kayit: any): { toplam: number; nakit: number; kart: number; iban: number } {
  const satislar = (kayit?.satislar || []).filter((s: any) => !s.iptal);
  let nakit = 0, kart = 0, iban = 0;
  for (const s of satislar) {
    const tutar = Number(s.finalPrice) || 0;
    const pm = (s.paymentMethod || "").toLowerCase();
    if (pm.includes("iban") || pm.includes("havale") || pm.includes("transfer")) iban += tutar;
    else if (pm.includes("kredi") || pm.includes("kart") || pm.includes("card")) kart += tutar;
    else nakit += tutar;
  }
  return { toplam: nakit + kart + iban, nakit, kart, iban };
}

// GET /kasa/sirket — Bakiye + devirler + İGD giderleri + ödeme durumları
app.get("/make-server-4da0b637/kasa/sirket", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const companyId = (isSA && reqCId) ? reqCId : getCompanyId(user);
    const ckv = companyKvFor(companyId);

    // Görünürlük kontrolü — rol bazlı
    const settings = await ckv.get("kasa_sirket_settings") || {};
    const visibleUstMudur = settings.visibleUstMudur ?? false;
    const visibleIdari = settings.visibleIdari ?? false;
    if (!["yonetici"].includes(role) && !isSA) {
      if (role === "ust-mudur" && !visibleUstMudur) return c.json({ error: "Kasa görünürlüğü kapalı." }, 403);
      if (role === "idari" && !visibleIdari) return c.json({ error: "Kasa görünürlüğü kapalı." }, 403);
      if (!["ust-mudur", "idari"].includes(role)) return c.json({ error: "Kasa görünürlüğü kapalı." }, 403);
    }

    const ay = c.req.query("ay"); // "2026-04" formatı

    // Paralel KV okuma
    const [devirler, tumGiderler, tumOdemeler, mekanlar, tumGelirler, tumKasaIslemler, tumBorclar] = await Promise.all([
      ckv.getByPrefix("kasa_devir_"),
      ckv.getByPrefix("isletme_gider_"),       // İGD giderleri
      ckv.getByPrefix("kasa_odeme_"),           // Ödeme kayıtları
      getMekanlarFor(companyId),
      ckv.getByPrefix("isletme_gelir_"),        // Para Girişleri
      ckv.getByPrefix("kasa_islem_"),           // Manuel kasa işlemleri (para girişi/çıkışı)
      ckv.getByPrefix("kasa_borc_"),            // Borçlar (alacak/verecek)
    ]);

    // Ay filtresi — devirler
    const filteredDevirler = ay
      ? (devirler || []).filter((d: any) => d.tarih?.startsWith(ay))
      : (devirler || []);

    // Ay filtresi — İGD giderleri
    const ayGiderleri = ay
      ? (tumGiderler || []).filter((g: any) => g.date?.startsWith(ay))
      : (tumGiderler || []);

    // Mekan kiraları hesapla (ayın gün sayısına göre)
    const mekanKiralari: any[] = [];
    if (ay) {
      const [yil, ayNum] = ay.split("-").map(Number);
      const ayGunSayisi = new Date(yil, ayNum, 0).getDate();
      for (const m of (mekanlar || [])) {
        const yillikKira = Number(m.yearlyRent) || (m.yearlyRents ? Number(m.yearlyRents[String(yil)]) || 0 : 0);
        if (yillikKira <= 0) continue;
        const aylikKira = Math.round((yillikKira / 365) * ayGunSayisi);
        mekanKiralari.push({
          id: `kira_${m.id || m.mekanId}_${ay}`,
          type: "kira",
          category: "kira",
          amount: aylikKira,
          description: `${m.emoji || '🏢'} ${m.name} — ${ay} kirası`,
          date: `${ay}-01`,
          personelAdi: m.name,
          mekanId: m.id || m.mekanId,
          otomatik: true,
        });
      }
    }

    // Döviz kurları — giderleri TRY'ye çevirmek için
    const exRatesKasa: any = await ckv.get("cost_exchange_rates").catch(() => null) || { EUR: 38, USD: 33, GBP: 41.20 };
    const toTLKasa = (amount: number, currency: string) => {
      if (!currency || currency === "TRY") return amount;
      if (currency === "EUR") return amount * (Number(exRatesKasa.EUR) || 38);
      if (currency === "USD") return amount * (Number(exRatesKasa.USD) || 33);
      if (currency === "GBP") return amount * (Number(exRatesKasa.GBP) || 41.2);
      return amount;
    };

    // Tüm giderler = İGD giderleri + mekan kiraları (döviz → TRY çevirme)
    const tumAyGiderleri = [...ayGiderleri.map((g: any) => ({ ...g, amount: toTLKasa(g.amount || 0, g.currency) })), ...mekanKiralari];

    // Ödeme durumlarını map'e al
    const odemeMap: Record<string, any> = {};
    for (const o of (tumOdemeler || [])) {
      if (o.giderId) odemeMap[o.giderId] = o;
    }

    // Giderleri kategorize et: ödenen vs bekleyen
    const tedarikciCarilerKasa = await ckv.getByPrefix("cost_cari_").catch(() => []) || [];
    const tedarikciIsimKasa = new Set(tedarikciCarilerKasa.map((c: any) => (c.name || "").trim().toLowerCase()).filter(Boolean));
    const bekleyenOdemeler: any[] = [];
    let toplamOdpienenGider = 0;
    let toplamBekleyenGider = 0;

    for (const g of tumAyGiderleri) {
      // Tedarikçi cari ismiyle eşleşiyorsa category'yi tedarikci yap
      const nameToCheck = g.personelAdi || g.category || "";
      if (nameToCheck && tedarikciIsimKasa.has(nameToCheck.trim().toLowerCase()) && g.category !== "tedarikci") {
        if (!g.personelAdi) g.personelAdi = nameToCheck;
        g.category = "tedarikci";
      }
      const gId = g.id || g.otomatikKey || `gider_${g.date}_${g.amount}`;
      const odeme = odemeMap[gId];

      const silinenTutar = odeme?.silinenTutar || 0;
      const komipleSilindi = odeme?.komplesilindi || false;

      if (komipleSilindi) {
        // Komple silindi — bekleyende de ödenende de görünmez
        continue;
      }

      const efektifTutar = Math.max(0, (g.amount || 0) - silinenTutar);
      if (efektifTutar <= 0) continue; // silme sonrası kalan 0

      if (odeme && odeme.odpiendi) {
        // Tamamen ödendi
        toplamOdpienenGider += odeme.odpienenTutar || efektifTutar;
      } else if (odeme && odeme.odemeler?.length > 0) {
        // Kısmi ödeme yapılmış
        const odpienenKisim = (odeme.odemeler || []).reduce((s: number, o: any) => s + (o.tutar || 0), 0);
        toplamOdpienenGider += odpienenKisim;
        const kalan = efektifTutar - odpienenKisim;
        if (kalan > 0) {
          toplamBekleyenGider += kalan;
          bekleyenOdemeler.push({ ...g, giderId: gId, kalanTutar: kalan, odpienenTutar: odpienenKisim, silinenTutar, odemeler: odeme.odemeler, silmeler: odeme.silmeler || [] });
        }
      } else {
        // Hiç ödenmemiş
        toplamBekleyenGider += efektifTutar;
        bekleyenOdemeler.push({ ...g, giderId: gId, kalanTutar: efektifTutar, odpienenTutar: 0, silinenTutar, odemeler: [], silmeler: odeme?.silmeler || [] });
      }
    }

    // Ciro toplamları
    const toplamDevir = filteredDevirler.reduce((s: number, d: any) => s + (d.ciro || 0), 0);

    // Nakit/kart/iban dağılımı
    const nakitDevir = filteredDevirler.reduce((s: number, d: any) => s + (d.nakit || 0), 0);
    const kartDevir = filteredDevirler.reduce((s: number, d: any) => s + (d.kart || 0), 0);
    const ibanDevir = filteredDevirler.reduce((s: number, d: any) => s + (d.iban || 0), 0);

    // Önceki aydan devir bakiye
    let devirBakiye = 0;
    let ayKapatildi = false;
    let ayDevretsiz = false;
    const oncekiAydanKalanlar: any[] = [];
    if (ay) {
      const [yil, ayNum] = ay.split("-").map(Number);
      const oncekiAy = ayNum === 1
        ? `${yil - 1}-12`
        : `${yil}-${String(ayNum - 1).padStart(2, "0")}`;
      const oncekiKapatis = await ckv.get(`kasa_ay_kapatis_${oncekiAy}`);
      devirBakiye = oncekiKapatis?.bakiye ?? 0;

      const buAyKapatis = await ckv.get(`kasa_ay_kapatis_${ay}`);
      ayKapatildi = !!buAyKapatis;
      ayDevretsiz = buAyKapatis?.devretsiz || false;

      // Önceki aydan kalan ödenmemiş giderler
      const oncekiOdenmemisler = oncekiKapatis?.odenmemisler || [];
      // Her kalan için bu ayda ödeme yapılmış mı kontrol et
      for (const od of oncekiOdenmemisler) {
        const odemeKey = `kasa_odeme_onceki_${od.giderId}`;
        const odeme = odemeMap[odemeKey] || await ckv.get(odemeKey);
        if (odeme?.odpiendi || odeme?.komplesilindi) continue;
        const odpipienenKisim = (odeme?.odemeler || []).reduce((s: number, o: any) => s + (o.tutar || 0), 0);
        const kalan = (od.kalanTutar || 0) - odpipienenKisim;
        if (kalan > 0) {
          oncekiAydanKalanlar.push({ ...od, giderId: `onceki_${od.giderId}`, kalanTutar: kalan, odpipienenTutar: odpipienenKisim, oncekiAy });
        }
      }
    }

    // Para Girişleri (isletme_gelir_) — ay filtreli
    const ayGelirleri = ay
      ? (tumGelirler || []).filter((g: any) => g.date?.startsWith(ay))
      : (tumGelirler || []);
    const toplamParaGirisi = ayGelirleri.reduce((s: number, g: any) => s + (g.amount || 0), 0);

    // Manuel kasa işlemleri (para girişi/çıkışı) — ay filtreli
    const ayKasaIslemleri = ay
      ? (tumKasaIslemler || []).filter((i: any) => i.date?.startsWith(ay))
      : (tumKasaIslemler || []);
    const kasaIslemGelir = ayKasaIslemleri.filter((i: any) => i.type === 'gelir').reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const kasaIslemGider = ayKasaIslemleri.filter((i: any) => i.type === 'gider').reduce((s: number, i: any) => s + (i.amount || 0), 0);

    // Bakiye = önceki aydan devir + cirolar + para girişleri + kasa işlem gelirleri - ödenen giderler - kasa işlem giderleri
    // Açılış bakiyesi
    const acilisBakiye = ay ? await ckv.get(`kasa_acilis_${ay}`) : null;
    const acilisTutar = acilisBakiye?.tutar || 0;

    // Borçlar: alacak (borç verdik → kasadan çıkış), verecek (borç aldık → kasaya giriş)
    const ayBorclari = ay
      ? (tumBorclar || []).filter((b: any) => b.tarih?.startsWith(ay))
      : (tumBorclar || []);
    const borcVerilenToplam = ayBorclari.filter((b: any) => b.yon === 'alacak').reduce((s: number, b: any) => s + Number(b.kalanTutar ?? b.tutar ?? 0), 0);
    const borcAlinanToplam = ayBorclari.filter((b: any) => b.yon === 'verecek').reduce((s: number, b: any) => s + Number(b.kalanTutar ?? b.tutar ?? 0), 0);
    // Borç tahsilatları ve ödemeleri artık kalanTutar'da zaten düşülmüş — ayrı hesaplamaya gerek yok
    const borcTahsilatToplam = 0;
    const borcOdemeToplam = 0;

    const bakiye = devirBakiye + acilisTutar + toplamDevir + toplamParaGirisi + kasaIslemGelir + borcAlinanToplam + borcTahsilatToplam - toplamOdpienenGider - kasaIslemGider - borcVerilenToplam - borcOdemeToplam;

    // İşlem geçmişi: ödeme yapılmış giderler
    // Gider map oluştur — giderId → gider bilgisi (tarih, açıklama)
    const giderMap: Record<string, any> = {};
    for (const g of tumAyGiderleri) {
      const gId = g.id || g.otomatikKey || `gider_${g.date}_${g.amount}`;
      giderMap[gId] = g;
    }

    const opipienenIslemler: any[] = [];
    for (const o of (tumOdemeler || [])) {
      if (!o.odemeler?.length) continue;
      const gider = giderMap[o.giderId];
      // Sadece bu aya ait olanlar
      for (let idx = 0; idx < o.odemeler.length; idx++) { const odm = o.odemeler[idx];
        if (ay && !odm.tarih?.startsWith(ay)) continue;
        opipienenIslemler.push({
          id: `odeme_${o.giderId}_${idx}_${odm.tarih}`,
          tip: 'odeme',
          tutar: odm.tutar,
          tarih: odm.tarih,
          giderTarih: gider?.date || '',
          aciklama: o.aciklama || o.description || gider?.description || '',
          kategori: o.category || gider?.category || '',
          personelAdi: o.personelAdi || gider?.personelAdi || '',
          giderId: o.giderId,
          odemeIndex: idx,
        });
      }
      // Silme kayıtlarını da işlem geçmişine ekle
      for (let sIdx = 0; sIdx < (o.silmeler || []).length; sIdx++) {
        const slm = o.silmeler[sIdx];
        if (ay && !slm.tarih?.startsWith(ay)) continue;
        opipienenIslemler.push({
          id: `silme_${o.giderId}_${sIdx}_${slm.tarih}`,
          tip: 'silme',
          tutar: slm.tutar,
          tarih: slm.tarih,
          aciklama: slm.aciklama || 'Kısmi silme',
          kategori: o.category || '',
          personelAdi: o.personelAdi || '',
          giderId: o.giderId,
        });
      }
    }

    // Kasa işlemlerini işlem geçmişine ekle
    for (const ki of ayKasaIslemleri) {
      opipienenIslemler.push({
        id: `kasa_islem_${ki.id}`,
        tip: ki.type === 'gelir' ? 'kasa_giris' : 'kasa_cikis',
        tutar: ki.amount,
        tarih: ki.date,
        aciklama: ki.description || (ki.type === 'gelir' ? 'Para girişi' : 'Para çıkışı'),
        kategori: ki.category || '',
        personelAdi: ki.created_by || '',
        giderId: ki.id,
      });
    }

    return c.json({
      bakiye,
      devirBakiye,
      acilisTutar,
      ayKapatildi,
      ayDevretsiz,
      oncekiAydanKalanlar,
      toplamDevir,
      toplamOdpienenGider,
      toplamBekleyenGider,
      toplamParaGirisi: toplamParaGirisi + kasaIslemGelir,
      kasaIslemGider,
      odemeDagilimi: { nakit: nakitDevir, kart: kartDevir, iban: ibanDevir },
      devirler: filteredDevirler.sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || "")),
      bekleyenOdemeler: bekleyenOdemeler.sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0)),
      opipienenIslemler: opipienenIslemler.sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || "")),
      visibleUstMudur,
      visibleIdari,
    });
  } catch (err) {
    console.log("Kasa sirket GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// GET /kasa/sirket/bekleyen — Devredilmemiş vardiyalar
app.get("/make-server-4da0b637/kasa/sirket/bekleyen", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role) && user.user_metadata?.originalRole !== "superadmin") {
      return c.json({ error: "Yetkiniz yok." }, 403);
    }
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const companyId = (isSA && reqCId) ? reqCId : getCompanyId(user);
    const ckv = companyKvFor(companyId);

    const [tumStok, tumDevirler, mekanlar] = await Promise.all([
      ckv.getByPrefix("stok_gunluk_"),
      ckv.getByPrefix("kasa_devir_"),
      getMekanlarFor(companyId),
    ]);

    const devirSet = new Set((tumDevirler || []).map((d: any) => `${d.mekanId}_${d.tarih}`));
    const mekanMap = new Map((mekanlar || []).map((m: any) => [m.id || m.mekanId, m]));

    const bekleyen: any[] = [];
    for (const kayit of (tumStok || [])) {
      if (!kayit.kapanisYapildi) continue;
      const key = `${kayit.mekanId}_${kayit.tarih}`;
      if (devirSet.has(key)) continue;

      const ciro = hesaplaCiro(kayit);
      if (ciro.toplam === 0) continue;

      const mekan = mekanMap.get(kayit.mekanId);
      bekleyen.push({
        mekanId: kayit.mekanId,
        tarih: kayit.tarih,
        mekanAdi: mekan?.name || kayit.mekanId,
        mekanEmoji: mekan?.emoji || "🏪",
        ...ciro,
      });
    }

    bekleyen.sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
    return c.json({ bekleyen });
  } catch (err) {
    console.log("Kasa bekleyen GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/sirket/devret — Ciro devir
app.post("/make-server-4da0b637/kasa/sirket/devret", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));

    const { mekanId, tarih } = await c.req.json();
    if (!mekanId || !tarih) return c.json({ error: "mekanId ve tarih zorunlu." }, 400);

    // Zaten devredilmiş mi?
    const existing = await ckv.get(`kasa_devir_${mekanId}_${tarih}`);
    if (existing) return c.json({ error: "Bu vardiya zaten devredilmiş." }, 400);

    // Stok verisi oku
    const kayit = await ckv.get(`stok_gunluk_${mekanId}_${tarih}`);
    if (!kayit || !kayit.kapanisYapildi) return c.json({ error: "Kapanmış vardiya bulunamadı." }, 400);

    const ciro = hesaplaCiro(kayit);
    const mekanlar = await getMekanlarFor(getCompanyId(user));
    const mekan = mekanlar.find((m: any) => (m.id || m.mekanId) === mekanId);

    const devir = {
      mekanId,
      tarih,
      ciro: ciro.toplam,
      nakit: ciro.nakit,
      kart: ciro.kart,
      iban: ciro.iban,
      mekanAdi: mekan?.name || mekanId,
      mekanEmoji: mekan?.emoji || "🏪",
      devreden: user.user_metadata?.full_name || user.email || "",
      devredildiAt: new Date().toISOString(),
    };
    await ckv.set(`kasa_devir_${mekanId}_${tarih}`, devir);

    console.log(`[Kasa] Devir: ${mekanId}/${tarih} ciro=${ciro.toplam} by ${user.id}`);
    return c.json({ devir });
  } catch (err) {
    console.log("Kasa devret POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/sirket/ode — Gider ödemesi (tam veya kısmi)
app.post("/make-server-4da0b637/kasa/sirket/ode", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { giderId, tutar, aciklama, ay, borcTutar, personelAdi, category } = await c.req.json();
    if (!giderId || !tutar || tutar <= 0) return c.json({ error: "giderId ve tutar zorunlu." }, 400);

    const odemeKey = `kasa_odeme_${giderId}`;
    const existing = await ckv.get(odemeKey) || { giderId, odemeler: [], odpiendi: false, odpienenTutar: 0 };

    const yeniOdeme = {
      tutar: Number(tutar),
      tarih: new Date().toISOString().split("T")[0],
      aciklama: aciklama?.trim() || "",
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email || "",
    };

    existing.odemeler = [...(existing.odemeler || []), yeniOdeme];
    existing.odpienenTutar = (existing.odemeler || []).reduce((s: number, o: any) => s + (o.tutar || 0), 0);
    existing.description = aciklama || existing.description;
    existing.category = category || existing.category || "";
    existing.personelAdi = personelAdi || existing.personelAdi || "";

    // borcTutar gönderilmediyse (Para Çıkışı gibi), tek seferde tam ödendi say
    if (!borcTutar) {
      existing.odpiendi = true;
    }

    await ckv.set(odemeKey, existing);

    // Kur farkı: borç kapandığında toplam ödenen vs borç tutarı karşılaştır
    if (borcTutar && Number(borcTutar) > 0 && existing.odpienenTutar >= Number(borcTutar)) {
      existing.odpiendi = true;
      const fark = existing.odpienenTutar - Number(borcTutar);
      if (Math.abs(fark) >= 1) { // ₺1'den büyük fark varsa
        const kurFarkId = `kurfark_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const kisim = personelAdi || category || "Gider";
        if (fark > 0) {
          // Fazla ödendi → kur farkı gideri
          await ckv.set(`isletme_gider_${kurFarkId}`, {
            id: kurFarkId,
            category: "kur_farki",
            amount: fark,
            currency: "TRY",
            description: `📈 Kur farkı gideri — ${kisim}`,
            date: new Date().toISOString().split("T")[0],
            personelAdi: personelAdi || "",
            otomatik: false,
            created_at: new Date().toISOString(),
            created_by: user.user_metadata?.full_name || "",
          });
          console.log(`[Kasa] Kur farkı gideri: +${fark} for ${giderId}`);
        } else {
          // Az ödendi → kur farkı geliri
          await ckv.set(`isletme_gelir_${kurFarkId}`, {
            id: kurFarkId,
            amount: Math.abs(fark),
            description: `📉 Kur farkı geliri — ${kisim}`,
            date: new Date().toISOString().split("T")[0],
            created_at: new Date().toISOString(),
            created_by: user.user_metadata?.full_name || "",
          });
          console.log(`[Kasa] Kur farkı geliri: ${fark} for ${giderId}`);
        }
      }
    }

    // Hakediş senkron: eğer bu gider bir prim bekleyen ise, prim_odendi_ kaydını da güncelle
    if (existing.odpiendi || existing.odpienenTutar >= Number(borcTutar || 0)) {
      // Gideri bul ve primOdemeKey kontrol et
      const giderKaydi = await ckv.get(`isletme_gider_${giderId}`);
      if (giderKaydi?.primOdemeKey) {
        const primKey = giderKaydi.primOdemeKey;
        await ckv.set(primKey, {
          key: primKey,
          odendi: true,
          odemeTarihi: new Date().toISOString(),
          odeyenKisi: user.email || user.id,
          personelAdi: giderKaydi.personelAdi,
          mekanAdi: giderKaydi.mekanAdi,
          primMiktar: giderKaydi.amount,
        });
        // Gider tipini güncelle
        giderKaydi.odemeTipi = "prim";
        giderKaydi.description = `Hakediş Ödemesi ✅ ${giderKaydi.personelAdi || ""} — ${giderKaydi.mekanAdi || ""}`;
        await ckv.set(`isletme_gider_${giderId}`, giderKaydi);
        console.log(`[Kasa→Prim] ${primKey} ödendi işaretlendi (kasadan)`);
      }
    }

    // Tedarikçi senkron: kasadan tedarikçi borcuna ödeme yapılınca tedarikçi portalına da yansıt
    // giderId kasadan gelirken tam key olarak gelir (isletme_gider_tedarikci_xxx)
    let giderKaydiFull = await ckv.get(giderId);
    if (!giderKaydiFull) giderKaydiFull = await ckv.get(`isletme_gider_${giderId}`);
    console.log(`[Kasa→Tedarikci] giderId=${giderId}, found=${!!giderKaydiFull}, category=${giderKaydiFull?.category}, cariId=${giderKaydiFull?.cariId}`);
    if (giderKaydiFull?.category === "tedarikci") {
      const tedOdemeId = `tedarikci_odeme_kasa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const cariIdResolved = giderKaydiFull.cariId || "";
      const cariNameResolved = giderKaydiFull.personelAdi || personelAdi || "";
      // cariId yoksa personelAdi ile cari bul
      let finalCariId = cariIdResolved;
      if (!finalCariId && cariNameResolved) {
        const allCariler = await ckv.getByPrefix("cost_cari_");
        const matchCari = (allCariler || []).find((c: any) => (c.name || "").trim().toLowerCase() === cariNameResolved.trim().toLowerCase());
        if (matchCari) finalCariId = matchCari.id;
      }
      if (finalCariId) {
        const sipId = giderKaydiFull.siparisId ? (giderKaydiFull.siparisId || "").replace("siparis_", "") : null;
        await ckv.set(tedOdemeId, { id: tedOdemeId, siparisId: sipId, cariId: finalCariId, cariName: cariNameResolved, amount: Number(tutar), currency: "TRY", paymentMethod: "kasa", paymentDate: new Date().toISOString().split("T")[0], status: "onaylandi", supplierConfirmed: false, createdAt: new Date().toISOString(), createdBy: user.user_metadata?.full_name || "", tip: "kasa_odeme" });
        console.log(`[Kasa→Tedarikci] tedarikci_odeme oluşturuldu: ${tedOdemeId}, cariId=${finalCariId}, tutar=${tutar}`);
        // Sipariş loguna ödeme kaydı ekle
        if (sipId) {
          const siparis = await ckv.get(`siparis_${sipId}`);
          if (siparis) {
            siparis.loglar = [...(siparis.loglar || []), { tarih: new Date().toISOString(), kisi: user.user_metadata?.full_name || "", taraf: "admin", mesaj: `₺${Number(tutar).toLocaleString("tr-TR")} ödeme yapıldı (kasadan)` }];
            siparis.updatedAt = new Date().toISOString();
            await ckv.set(`siparis_${sipId}`, siparis);
            const allTedOdeme = await ckv.getByPrefix("tedarikci_odeme_");
            const toplamOdenen = (allTedOdeme || []).filter((o: any) => o.siparisId === sipId && o.status !== "reddedildi").reduce((a: number, o: any) => a + (o.amount || 0), 0);
            const expectedAmount = siparis.teklifFiyat || siparis.totalAmount || 0;
            if (toplamOdenen >= expectedAmount && siparis.status === "teslim_edildi") {
              siparis.status = "tamamlandi"; siparis.completedAt = new Date().toISOString();
              siparis.loglar = [...(siparis.loglar || []), { tarih: new Date().toISOString(), kisi: "Sistem", taraf: "sistem", mesaj: "Sipariş tamamlandı — ödeme tam (kasadan)" }];
              siparis.updatedAt = new Date().toISOString();
              await ckv.set(`siparis_${sipId}`, siparis);
            }
          }
        }
      } else {
        console.log(`[Kasa→Tedarikci] cariId bulunamadı, tedarikci_odeme oluşturulamadı. personelAdi=${cariNameResolved}`);
      }
    }

    console.log(`[Kasa] Ödeme: ${giderId} tutar=${tutar} by ${user.id}`);
    return c.json({ odeme: existing });
  } catch (err) {
    console.log("Kasa ode POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/sirket/ode-tumu — Tüm bekleyenleri öde
app.post("/make-server-4da0b637/kasa/sirket/ode-tumu", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { odemeler } = await c.req.json(); // [{giderId, tutar}]
    if (!odemeler || !Array.isArray(odemeler)) return c.json({ error: "odemeler array zorunlu." }, 400);

    const tarih = new Date().toISOString().split("T")[0];
    const by = user.user_metadata?.full_name || user.email || "";
    let count = 0;

    for (const o of odemeler) {
      if (!o.giderId || !o.tutar || o.tutar <= 0) continue;
      const odemeKey = `kasa_odeme_${o.giderId}`;
      const existing = await ckv.get(odemeKey) || { giderId: o.giderId, odemeler: [], odpiendi: false, odpienenTutar: 0 };
      existing.odemeler = [...(existing.odemeler || []), { tutar: o.tutar, tarih, aciklama: "Toplu ödeme", created_at: new Date().toISOString(), created_by: by }];
      existing.odpienenTutar = existing.odemeler.reduce((s: number, x: any) => s + (x.tutar || 0), 0);
      existing.odpiendi = true;
      await ckv.set(odemeKey, existing);
      count++;
    }

    console.log(`[Kasa] Toplu ödeme: ${count} gider ödendi by ${user.id}`);
    return c.json({ ok: true, count });
  } catch (err) {
    console.log("Kasa ode-tumu POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /kasa/sirket/odeme/:giderId — Ödeme kaydını sil (komple sil)
app.delete("/make-server-4da0b637/kasa/sirket/odeme/:giderId", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (role !== "yonetici" && user.user_metadata?.originalRole !== "superadmin") return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const giderId = c.req.param("giderId");
    await ckv.del(`kasa_odeme_${giderId}`);
    await ckv.del(`isletme_gider_${giderId}`);
    console.log(`[Kasa] Ödeme + gider silindi: ${giderId} by ${user.id}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Kasa odeme DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /kasa/sirket/odeme/:giderId/kismi/:index — Kısmi ödeme kaydını sil
app.delete("/make-server-4da0b637/kasa/sirket/odeme/:giderId/kismi/:index", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (role !== "yonetici" && user.user_metadata?.originalRole !== "superadmin") return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const giderId = c.req.param("giderId");
    const index = parseInt(c.req.param("index"));
    const odemeKey = `kasa_odeme_${giderId}`;
    const existing = await ckv.get(odemeKey);
    if (!existing) return c.json({ error: "Ödeme bulunamadı." }, 404);

    existing.odemeler = (existing.odemeler || []).filter((_: any, i: number) => i !== index);
    existing.odpienenTutar = existing.odemeler.reduce((s: number, o: any) => s + (o.tutar || 0), 0);
    existing.odpiendi = false;

    if (existing.odemeler.length === 0) {
      await ckv.del(odemeKey);
      await ckv.del(`isletme_gider_${giderId}`);
    } else {
      await ckv.set(odemeKey, existing);
    }

    console.log(`[Kasa] Kısmi ödeme silindi: ${giderId} index=${index} by ${user.id}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Kasa kismi odeme DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/sirket/kismi-sil — Gider tutarından düş + İGD'ye düzeltme kaydı ekle
app.post("/make-server-4da0b637/kasa/sirket/kismi-sil", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { giderId, tutar, aciklama, personelAdi, category, ay } = await c.req.json();
    if (!giderId || !tutar || tutar <= 0) return c.json({ error: "giderId ve tutar zorunlu." }, 400);

    // Zaten komple silinmiş mi?
    const mevcutOdeme = await ckv.get(`kasa_odeme_${giderId}`);
    if (mevcutOdeme?.komplesilindi) return c.json({ error: "Bu gider zaten silinmiş." }, 400);

    // 1. Kasadaki ödeme kaydına "silinen" olarak ekle
    const odemeKey = `kasa_odeme_${giderId}`;
    const existing = await ckv.get(odemeKey) || { giderId, odemeler: [], silmeler: [], odpiendi: false, odpienenTutar: 0, silinenTutar: 0 };

    const yeniSilme = {
      tutar: Number(tutar),
      tarih: new Date().toISOString().split("T")[0],
      aciklama: aciklama?.trim() || "Kısmi silme",
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email || "",
    };

    existing.silmeler = [...(existing.silmeler || []), yeniSilme];
    existing.silinenTutar = (existing.silmeler || []).reduce((s: number, sl: any) => s + (sl.tutar || 0), 0);
    await ckv.set(odemeKey, existing);

    // 2. İGD'ye negatif düzeltme kaydı ekle
    const duzeltmeId = `duzeltme_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const duzeltmeAciklama = aciklama?.trim()
      ? `📝 Kasa düzeltme — ${aciklama.trim()}`
      : `📝 Kasa düzeltme — ${personelAdi || category || 'Gider'} indirimi`;

    await ckv.set(`isletme_gider_${duzeltmeId}`, {
      id: duzeltmeId,
      category: category || "duzeltme",
      odemeTipi: "duzeltme",
      amount: -Number(tutar),
      currency: "TRY",
      description: duzeltmeAciklama,
      date: ay ? `${ay}-01` : new Date().toISOString().split("T")[0],
      personelAdi: personelAdi || "",
      otomatik: false,
      kasaDuzeltme: true,
      kasaGiderId: giderId,
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email || "",
    });

    console.log(`[Kasa] Kısmi sil: ${giderId} -${tutar} → İGD düzeltme ${duzeltmeId} by ${user.id}`);
    return c.json({ ok: true, duzeltmeId });
  } catch (err) {
    console.log("Kasa kismi-sil POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/sirket/komple-sil — Tüm borcu sıfırla + İGD'ye düzeltme
app.post("/make-server-4da0b637/kasa/sirket/komple-sil", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { giderIds, tutar, aciklama, personelAdi, category, ay } = await c.req.json();
    // giderIds: bir grup giderin ID listesi (aynı kişinin tüm günlük kayıtları)
    if (!giderIds || !Array.isArray(giderIds) || !tutar || tutar <= 0) return c.json({ error: "giderIds ve tutar zorunlu." }, 400);

    // Zaten komple silinmiş mi kontrol et
    const ilkOdeme = await ckv.get(`kasa_odeme_${giderIds[0]}`);
    if (ilkOdeme?.komplesilindi) return c.json({ error: "Bu gider zaten silinmiş." }, 400);

    // Her gider için kasadaki ödeme kaydını VE İGD giderini sil
    for (const gId of giderIds) {
      await ckv.del(`kasa_odeme_${gId}`);
      await ckv.del(`isletme_gider_${gId}`);
    }

    console.log(`[Kasa] Komple sil: ${giderIds.length} gider silindi by ${user.id}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Kasa komple-sil POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/sirket/islem — Manuel gelir/gider ekle
app.post("/make-server-4da0b637/kasa/sirket/islem", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));

    const { type, category, amount, description, date } = await c.req.json();
    if (!type || !amount || amount <= 0) return c.json({ error: "type ve amount zorunlu." }, 400);
    if (!["gelir", "gider"].includes(type)) return c.json({ error: "type: gelir veya gider olmalı." }, 400);

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const islem = {
      id, type, category: category || "Genel", amount,
      description: description?.trim() || "",
      date: date || new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email || "",
    };
    await ckv.set(`kasa_islem_${id}`, islem);
    pgWrite("cash_transactions", "insert", {
      id, company_id: getCompanyId(user), type: islem.type || null, amount: Number(islem.amount) || 0,
      description: islem.description || null, date: islem.date || null,
      created_by: user.user_metadata?.full_name || user.email, extra_data: islem,
    });
    return c.json({ islem });
  } catch (err) {
    console.log("Kasa islem POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /kasa/sirket/islem/:id — İşlem sil (kasa_islem_ veya kasa_odeme_ ödeme kaydı)
app.delete("/make-server-4da0b637/kasa/sirket/islem/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (role !== "yonetici" && user.user_metadata?.originalRole !== "superadmin") return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    const rawId = c.req.param("id");

    // kasa_islem_ kaydı mı kontrol et
    if (rawId.startsWith("kasa_islem_")) {
      await ckv.del(rawId);
      return c.json({ ok: true });
    }

    // Ödeme kaydı silme: odeme_{giderId}_{idx}_{tarih} formatı
    if (rawId.startsWith("odeme_")) {
      // Tarih YYYY-MM-DD son 10 karakter, idx ondan önceki _, giderId geri kalan
      const withoutPrefix = rawId.replace("odeme_", "");
      const tarih = withoutPrefix.slice(-10); // 2026-04-05
      const rest = withoutPrefix.slice(0, -11); // giderId_idx kısmı (son _ da atılır)
      const lastUnderscore = rest.lastIndexOf("_");
      const idx = parseInt(rest.slice(lastUnderscore + 1) || "0");
      const giderId = rest.slice(0, lastUnderscore);
      const odemeKey = `kasa_odeme_${giderId}`;
      const odeme = await ckv.get(odemeKey);
      if (odeme?.odemeler?.length > idx) {
        const silinenOdeme = odeme.odemeler[idx];
        odeme.odemeler.splice(idx, 1);
        odeme.odpienenTutar = (odeme.odemeler || []).reduce((s: number, o: any) => s + (o.tutar || 0), 0);
        if (odeme.odemeler.length === 0) odeme.odpiendi = false;
        await ckv.set(odemeKey, odeme);
        return c.json({ ok: true, silinen: silinenOdeme });
      }
      return c.json({ error: "Ödeme kaydı bulunamadı." }, 404);
    }

    // Fallback: eski format
    await ckv.del(`kasa_islem_${rawId}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Kasa islem DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// PUT /kasa/sirket/ayarlar — Görünürlük toggle
app.put("/make-server-4da0b637/kasa/sirket/ayarlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici") return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    const { visibleUstMudur, visibleIdari } = await c.req.json();
    const existing = await ckv.get("kasa_sirket_settings") || {};
    const updated = {
      ...existing,
      visibleUstMudur: visibleUstMudur !== undefined ? !!visibleUstMudur : (existing.visibleUstMudur ?? false),
      visibleIdari: visibleIdari !== undefined ? !!visibleIdari : (existing.visibleIdari ?? false),
      // geriye uyumluluk
      visible: (visibleUstMudur !== undefined ? !!visibleUstMudur : existing.visibleUstMudur) || (visibleIdari !== undefined ? !!visibleIdari : existing.visibleIdari),
      updated_at: new Date().toISOString(),
      updated_by: user.user_metadata?.full_name || "",
    };
    await ckv.set("kasa_sirket_settings", updated);
    return c.json({ visibleUstMudur: updated.visibleUstMudur, visibleIdari: updated.visibleIdari });
  } catch (err) {
    console.log("Kasa ayarlar PUT error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// GET /kasa/eksik-analiz — Devirler vs Gelirler karşılaştırması
app.get("/make-server-4da0b637/kasa/eksik-analiz", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));
    const ay = c.req.query("ay") || "2026-04";

    const [devirler, gelirler] = await Promise.all([
      ckv.getByPrefix("kasa_devir_"),
      ckv.getByPrefix("isletme_gelir_"),
    ]);

    const ayDevirleri = (devirler || []).filter((d: any) => d.tarih?.startsWith(ay));
    const ayGelirleri = (gelirler || []).filter((g: any) => g.date?.startsWith(ay));

    // Her devir için eşleşen gelir var mı kontrol et
    const eksikler: any[] = [];
    for (const devir of ayDevirleri) {
      const eslesme = ayGelirleri.find((g: any) =>
        g.mekanId === devir.mekanId && g.date === devir.tarih
      );
      if (!eslesme) {
        eksikler.push({
          mekanAdi: devir.mekanAdi,
          mekanId: devir.mekanId,
          tarih: devir.tarih,
          ciro: devir.ciro,
          nakit: devir.nakit,
          kart: devir.kart,
          iban: devir.iban,
        });
      }
    }

    return c.json({
      ay,
      toplamDevir: ayDevirleri.length,
      toplamGelir: ayGelirleri.length,
      eksikSayisi: eksikler.length,
      eksikler,
      devirler: ayDevirleri.map((d: any) => ({ mekanAdi: d.mekanAdi, tarih: d.tarih, ciro: d.ciro })),
      gelirler: ayGelirleri.map((g: any) => ({ description: g.description, date: g.date, amount: g.amount, mekanAdi: g.mekanAdi, id: g.id })),
    });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// GET /ortaklar
app.get("/make-server-4da0b637/ortaklar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));
    const ortaklar = await ckv.get("pay_ortaklar") || [];
    return c.json({ ortaklar });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// POST /ortaklar (kaydet/güncelle)
app.post("/make-server-4da0b637/ortaklar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));
    const { ortaklar } = await c.req.json();
    if (!Array.isArray(ortaklar) || ortaklar.length === 0) return c.json({ error: "En az bir ortak gerekli." }, 400);
    const toplam = ortaklar.reduce((s: number, o: any) => s + (o.yuzde || 0), 0);
    if (Math.abs(toplam - 100) > 0.01) return c.json({ error: `Yüzdelerin toplamı 100 olmalı (şu an: ${toplam}).` }, 400);
    await ckv.set("pay_ortaklar", ortaklar);
    return c.json({ ortaklar });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// POST /kasa/paydagitim
app.post("/make-server-4da0b637/dagitim", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));
    const { toplamTutar, ortaklar } = await c.req.json();
    if (!toplamTutar || toplamTutar <= 0) return c.json({ error: "Toplam tutar zorunlu." }, 400);
    if (!Array.isArray(ortaklar) || ortaklar.length === 0) return c.json({ error: "Ortak bilgisi zorunlu." }, 400);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const dagitim = { id, toplamTutar, ortaklar, tarih: new Date().toISOString().split("T")[0], created_at: new Date().toISOString(), created_by: user.user_metadata?.full_name || user.email || "" };
    await ckv.set(`pay_dagitim_${id}`, dagitim);
    return c.json({ dagitim });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// GET /dagitimlar
app.get("/make-server-4da0b637/dagitimlar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));
    const all = (await ckv.getByPrefix("pay_dagitim_")) || [];
    all.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
    return c.json({ dagitimlar: all });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// POST /kasa/sirket/ay-kapat — Ayı kapat ve bakiyeyi sonraki aya devret
app.post("/make-server-4da0b637/kasa/sirket/ay-kapat", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici") return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { ay, devretsiz } = await c.req.json(); // "2026-03" formatı, devretsiz: true ise bakiye 0 devredilir
    if (!ay || !/^\d{4}-\d{2}$/.test(ay)) return c.json({ error: "ay formatı YYYY-MM olmalı." }, 400);

    // Zaten kapatılmış mı?
    const existing = await ckv.get(`kasa_ay_kapatis_${ay}`);
    if (existing) return c.json({ error: "Bu ay zaten kapatılmış." }, 400);

    // Önceki ayın devir bakiyesini bul
    const [yil, ayNum] = ay.split("-").map(Number);
    const oncekiAy = ayNum === 1
      ? `${yil - 1}-12`
      : `${yil}-${String(ayNum - 1).padStart(2, "0")}`;
    const oncekiKapatis = await ckv.get(`kasa_ay_kapatis_${oncekiAy}`);
    const devirBakiye = oncekiKapatis?.bakiye ?? 0;

    // Bu ayın verilerini hesapla
    const [devirler, tumGiderlerKapat, tumOdemelerKapat, mekanlarKapat] = await Promise.all([
      ckv.getByPrefix("kasa_devir_"),
      ckv.getByPrefix("isletme_gider_"),
      ckv.getByPrefix("kasa_odeme_"),
      getMekanlarFor((isSA && reqCId) ? reqCId : getCompanyId(user)),
    ]);

    const ayDevirler = (devirler || []).filter((d: any) => d.tarih?.startsWith(ay));
    const toplamDevir = ayDevirler.reduce((s: number, d: any) => s + (d.ciro || 0), 0);

    // Nakit/kart/iban dağılımı
    const nakit = ayDevirler.reduce((s: number, d: any) => s + (d.nakit || 0), 0);
    const kart = ayDevirler.reduce((s: number, d: any) => s + (d.kart || 0), 0);
    const iban = ayDevirler.reduce((s: number, d: any) => s + (d.iban || 0), 0);

    // İGD giderleri + mekan kiraları → bekleyen ödemeleri hesapla
    const ayGiderleriKapat = (tumGiderlerKapat || []).filter((g: any) => g.date?.startsWith(ay));
    // Mekan kiraları
    const mekanKiralariKapat: any[] = [];
    const [yilK, ayNumK] = [yil, ayNum];
    const ayGunSayisiKapat = new Date(yilK, ayNumK, 0).getDate();
    for (const m of (mekanlarKapat || [])) {
      const yillikKira = Number(m.yearlyRent) || (m.yearlyRents ? Number(m.yearlyRents[String(yilK)]) || 0 : 0);
      if (yillikKira <= 0) continue;
      const aylikKira = Math.round((yillikKira / 365) * ayGunSayisiKapat);
      mekanKiralariKapat.push({ id: `kira_${m.id || m.mekanId}_${ay}`, amount: aylikKira, personelAdi: m.name, category: "kira", description: `${m.emoji || '🏢'} ${m.name} — ${ay} kirası` });
    }
    const tumAyGiderleriKapat = [...ayGiderleriKapat, ...mekanKiralariKapat];

    const odemeMapKapat: Record<string, any> = {};
    for (const o of (tumOdemelerKapat || [])) { if (o.giderId) odemeMapKapat[o.giderId] = o; }

    // Bekleyen ödemeleri topla (ödenmemiş olanlar)
    const odenmemisler: any[] = [];
    let toplamOdpienenKapat = 0;
    for (const g of tumAyGiderleriKapat) {
      const gId = g.id || g.otomatikKey || `gider_${g.date}_${g.amount}`;
      const odeme = odemeMapKapat[gId];
      const silinenTutar = odeme?.silinenTutar || 0;
      if (odeme?.komplesilindi) continue;
      const efektifTutar = Math.max(0, (g.amount || 0) - silinenTutar);
      if (efektifTutar <= 0) continue;

      const odpienenKisim = odeme ? (odeme.odemeler || []).reduce((s: number, o: any) => s + (o.tutar || 0), 0) : 0;
      toplamOdpienenKapat += odpienenKisim;
      const kalan = efektifTutar - odpienenKisim;
      if (kalan > 0 && !odeme?.odpiendi) {
        odenmemisler.push({ giderId: gId, amount: g.amount, kalanTutar: kalan, personelAdi: g.personelAdi || "", category: g.category || "", description: g.description || "", odemeTipi: g.odemeTipi || "" });
      } else if (odeme?.odpiendi) {
        toplamOdpienenKapat += odeme.odpienenTutar || efektifTutar;
      }
    }

    const ayBakiye = devirBakiye + toplamDevir - toplamOdpienenKapat;

    const kapatis = {
      ay,
      bakiye: devretsiz ? 0 : ayBakiye,
      gercekBakiye: ayBakiye,
      devretsiz: !!devretsiz,
      devirBakiye,
      toplamDevir,
      toplamOdpipipipipienenGider: toplamOdpienenKapat,
      odemeDagilimi: { nakit, kart, iban },
      odenmemisler,
      kapatisTarihi: new Date().toISOString(),
      kapatanKisi: user.user_metadata?.full_name || user.email || "",
    };

    await ckv.set(`kasa_ay_kapatis_${ay}`, kapatis);
    console.log(`[Kasa] Ay kapatıldı: ${ay} bakiye=${ayBakiye} by ${user.id}`);
    return c.json({ kapatis });
  } catch (err) {
    console.log("Kasa ay-kapat POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── AÇILIŞ BAKİYE / BORÇ ──

// POST /kasa/sirket/acilis-bakiye — Açılış bakiyesi ekle (İGD'ye yazmaz)
app.post("/make-server-4da0b637/kasa/sirket/acilis-bakiye", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!["yonetici", "ust-mudur"].includes(user.user_metadata?.role || "personel")) return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { tutar, aciklama, ay } = await c.req.json();
    if (!tutar || !ay) return c.json({ error: "tutar ve ay zorunlu." }, 400);

    await ckv.set(`kasa_acilis_${ay}`, {
      tutar: Number(tutar),
      aciklama: aciklama?.trim() || "Açılış bakiyesi",
      tarih: new Date().toISOString(),
      ekleyen: user.user_metadata?.full_name || user.email || "",
    });

    console.log(`[Kasa] Açılış bakiye: ${ay} ₺${tutar} by ${user.id}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Kasa acilis-bakiye POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/sirket/acilis-borc — Açılış borcu ekle (İGD'ye yazmaz, cariler'de görünür)
app.post("/make-server-4da0b637/kasa/sirket/acilis-borc", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!["yonetici", "ust-mudur"].includes(user.user_metadata?.role || "personel")) return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { kisi, tutar, aciklama, emoji } = await c.req.json();
    if (!kisi?.trim() || !tutar || tutar <= 0) return c.json({ error: "kisi ve tutar zorunlu." }, 400);

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const borc = {
      id,
      kisi: kisi.trim(),
      tutar: Number(tutar),
      kalanTutar: Number(tutar),
      aciklama: aciklama?.trim() || "Açılış borcu",
      emoji: emoji || "🏢",
      tarih: new Date().toISOString().split("T")[0],
      odemeler: [],
      acilisBorc: true,
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email || "",
    };

    await ckv.set(`kasa_acilis_borc_${id}`, borc);
    console.log(`[Kasa] Açılış borç: ${kisi} ₺${tutar} by ${user.id}`);
    return c.json({ borc });
  } catch (err) {
    console.log("Kasa acilis-borc POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/sirket/acilis-borc/:id/odeme — Açılış borcu ödeme
app.post("/make-server-4da0b637/kasa/sirket/acilis-borc/:id/odeme", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!["yonetici", "ust-mudur"].includes(user.user_metadata?.role || "personel")) return c.json({ error: "Yetkiniz yok." }, 403);
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const borcId = c.req.param("id");
    const { tutar, aciklama } = await c.req.json();
    if (!tutar || tutar <= 0) return c.json({ error: "Ödeme tutarı zorunlu." }, 400);

    const borc = await ckv.get(`kasa_acilis_borc_${borcId}`);
    if (!borc) return c.json({ error: "Borç bulunamadı." }, 404);

    const odemeTarih = new Date().toISOString().split("T")[0];
    borc.odemeler = [...(borc.odemeler || []), { tutar: Number(tutar), tarih: odemeTarih, aciklama: aciklama?.trim() || "", created_at: new Date().toISOString() }];
    borc.kalanTutar = Math.max(0, (borc.kalanTutar || borc.tutar) - Number(tutar));
    await ckv.set(`kasa_acilis_borc_${borcId}`, borc);

    // İGD'ye gider yaz + kasada ödendi işaretle → bakiyeden düşsün
    const giderId = `acilis_borc_odeme_${borcId}_${Date.now()}`;
    await ckv.set(`isletme_gider_${giderId}`, {
      id: giderId, personelAdi: borc.kisi || "", category: "diger",
      amount: Number(tutar), currency: "TRY", date: odemeTarih,
      description: `Açılış borcu ödemesi: ${borc.kisi || ""} ${aciklama ? "— " + aciklama : ""}`.trim(),
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email || "",
      odemeTipi: "normal", kasaDuzeltme: false,
    });
    await ckv.set(`kasa_odeme_${giderId}`, {
      giderId, odpiendi: true, odpienenTutar: Number(tutar),
      odemeler: [{ tutar: Number(tutar), tarih: odemeTarih, aciklama: aciklama?.trim() || "Açılış borcu ödemesi" }],
    });

    return c.json({ borc });
  } catch (err) {
    console.log("Kasa acilis-borc odeme POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /kasa/sirket/acilis-borc/:id
app.delete("/make-server-4da0b637/kasa/sirket/acilis-borc/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici") return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`kasa_acilis_borc_${c.req.param("id")}`);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── CARİ HESAPLAR (kişi/firma bazlı borç/ödeme özet) ──

// GET /kasa/cariler — Tüm kişi/firma bazlı borç/ödeme durumu
app.get("/make-server-4da0b637/kasa/cariler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role) && user.user_metadata?.originalRole !== "superadmin") {
      return c.json({ error: "Yetkiniz yok." }, 403);
    }
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const companyId = (isSA && reqCId) ? reqCId : getCompanyId(user);
    const ckv = companyKvFor(companyId);

    const ay = c.req.query("ay"); // opsiyonel — boşsa tüm zamanlar

    // Paralel KV okuma
    const [tumGiderler, tumOdemeler, mekanlar] = await Promise.all([
      ckv.getByPrefix("isletme_gider_"),
      ckv.getByPrefix("kasa_odeme_"),
      getMekanlarFor(companyId),
    ]);

    // Ödeme map
    const odemeMap: Record<string, any> = {};
    for (const o of (tumOdemeler || [])) { if (o.giderId) odemeMap[o.giderId] = o; }

    // Mekan kiraları
    const mekanKiraGiderleri: any[] = [];
    if (ay) {
      const [yil, ayNum] = ay.split("-").map(Number);
      const ayGun = new Date(yil, ayNum, 0).getDate();
      for (const m of (mekanlar || [])) {
        const yillikKira = Number(m.yearlyRent) || (m.yearlyRents ? Number(m.yearlyRents[String(yil)]) || 0 : 0);
        if (yillikKira <= 0) continue;
        const aylikKira = Math.round((yillikKira / 365) * ayGun);
        mekanKiraGiderleri.push({
          id: `kira_${m.id || m.mekanId}_${ay}`,
          category: "kira",
          amount: aylikKira,
          description: `${ay} kirası`,
          date: `${ay}-01`,
          personelAdi: m.name,
          mekanEmoji: m.emoji || "🏠",
          otomatik: true,
        });
      }
    }

    // Tüm giderleri birleştir
    // Nisan 2026 öncesi giderleri gösterme (eski veriler temizlendi)
    const kasaBaslangic = "2026-04-01";
    const filteredGiderler = ay
      ? (tumGiderler || []).filter((g: any) => g.date?.startsWith(ay) && g.amount > 0 && g.date >= kasaBaslangic)
      : (tumGiderler || []).filter((g: any) => g.amount > 0 && g.date >= kasaBaslangic);
    // Döviz kurları
    const exRatesCari: any = await ckv.get("cost_exchange_rates").catch(() => null) || { EUR: 38, USD: 33, GBP: 41.20 };
    const toTLCari = (amount: number, currency: string) => {
      if (!currency || currency === "TRY") return amount;
      if (currency === "EUR") return amount * (Number(exRatesCari.EUR) || 38);
      if (currency === "USD") return amount * (Number(exRatesCari.USD) || 33);
      if (currency === "GBP") return amount * (Number(exRatesCari.GBP) || 41.2);
      return amount;
    };
    const tumAyGiderleri = [...filteredGiderler.map((g: any) => ({ ...g, amount: toTLCari(g.amount || 0, g.currency) })), ...mekanKiraGiderleri].filter((g: any) => g.odemeTipi !== "duzeltme" && !g.kasaDuzeltme);

    // Kişi/firma bazlı grupla
    const cariMap: Record<string, any> = {};
    // Tedarikçi cari isimlerini yükle
    const tedarikciCariler = await ckv.getByPrefix("cost_cari_").catch(() => []) || [];
    const tedarikciIsimleri = new Set(tedarikciCariler.map((c: any) => (c.name || "").trim().toLowerCase()).filter(Boolean));

    for (const g of tumAyGiderleri) {
      const gId = g.id || g.otomatikKey || `gider_${g.date}_${g.amount}`;
      const nameToCheckCari = g.personelAdi || g.category || "";
      const isTedarikciCari = nameToCheckCari && tedarikciIsimleri.has(nameToCheckCari.trim().toLowerCase());
      if (isTedarikciCari && !g.personelAdi) g.personelAdi = nameToCheckCari;
      if (isTedarikciCari) g.category = "tedarikci";
      const kisi = g.personelAdi || g.category || "Diğer";
      const standartKategoriler = ["personel", "malzeme", "ekipman", "operasyonel", "ulasim", "diger", "kira", "duzeltme", "kur_farki", "tedarikci"];
      const tip = g.category === "personel" && !isTedarikciCari ? "personel"
        : g.category === "kira" ? "kira"
        : g.category === "tedarikci" || isTedarikciCari ? "tedarikci"
        : standartKategoriler.includes(g.category) ? "diger_gider"
        : "cari";

      if (!cariMap[kisi]) {
        cariMap[kisi] = {
          kisi,
          tip,
          emoji: g.mekanEmoji || (tip === "personel" ? "👤" : tip === "kira" ? "🏠" : "🏢"),
          toplamBorc: 0,
          toplamOdpipipiienen: 0,
          toplamSilinen: 0,
          hareketler: [],
        };
      }

      const odeme = odemeMap[gId];
      const silinenTutar = odeme?.silinenTutar || 0;
      const komipleSilindi = odeme?.komplesilindi || false;

      if (komipleSilindi) continue;

      const efektifTutar = Math.max(0, (g.amount || 0) - silinenTutar);
      if (efektifTutar <= 0) continue;

      cariMap[kisi].toplamBorc += efektifTutar;

      // Borç hareketi
      cariMap[kisi].hareketler.push({
        tip: "borc",
        tutar: efektifTutar,
        tarih: g.date,
        aciklama: g.description || "",
        giderId: gId,
      });

      // Ödeme hareketleri
      if (odeme?.odemeler?.length > 0) {
        for (const odm of odeme.odemeler) {
          cariMap[kisi].toplamOdpipipiienen += odm.tutar || 0;
          cariMap[kisi].hareketler.push({
            tip: "odeme",
            tutar: odm.tutar,
            tarih: odm.tarih,
            aciklama: odm.aciklama || "Ödeme",
            giderId: gId,
          });
        }
      }
      if (odeme?.odpiendi) {
        const odpipipipienenToplam = (odeme.odemeler || []).reduce((s: number, o: any) => s + (o.tutar || 0), 0);
        if (odpipipipienenToplam === 0) {
          cariMap[kisi].toplamOdpipipiienen += efektifTutar;
          cariMap[kisi].hareketler.push({ tip: "odeme", tutar: efektifTutar, tarih: odeme.odemeler?.[0]?.tarih || g.date, aciklama: "Tam ödeme", giderId: gId });
        }
      }

      // Silme hareketleri
      if (odeme?.silmeler?.length > 0) {
        for (const slm of odeme.silmeler) {
          if (slm.tutar > 0) {
            cariMap[kisi].toplamSilinen += slm.tutar;
            cariMap[kisi].hareketler.push({ tip: "silme", tutar: slm.tutar, tarih: slm.tarih, aciklama: slm.aciklama || "Silme" });
          }
        }
      }
    }

    // Kalan hesapla ve listeye çevir
    // Açılış borçlarını da cariler'e ekle
    const acilisBorclar = await ckv.getByPrefix("kasa_acilis_borc_").catch(() => []) || [];
    for (const ab of acilisBorclar) {
      const kisi = ab.kisi || "Bilinmeyen";
      if (!cariMap[kisi]) {
        cariMap[kisi] = { kisi, tip: "cari", emoji: ab.emoji || "🏢", toplamBorc: 0, toplamOdpipipiienen: 0, toplamSilinen: 0, hareketler: [] };
      }
      cariMap[kisi].toplamBorc += ab.tutar || 0;
      cariMap[kisi].hareketler.push({ tip: "borc", tutar: ab.tutar, tarih: ab.tarih, aciklama: ab.aciklama || "Açılış borcu", giderId: `acilis_${ab.id}` });
      for (const odm of (ab.odemeler || [])) {
        cariMap[kisi].toplamOdpipipiienen += odm.tutar || 0;
        cariMap[kisi].hareketler.push({ tip: "odeme", tutar: odm.tutar, tarih: odm.tarih, aciklama: odm.aciklama || "Ödeme", giderId: `acilis_${ab.id}` });
      }
    }

    const cariler = Object.values(cariMap).map((c: any) => ({
      ...c,
      kalanBorc: Math.max(0, c.toplamBorc - c.toplamOdpipipiienen),
      hareketler: c.hareketler.sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || "")),
    })).sort((a: any, b: any) => b.kalanBorc - a.kalanBorc);

    return c.json({ cariler });
  } catch (err) {
    console.log("Kasa cariler GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── KİŞİSEL KASA ──

// GET /kasa/kisisel — Bakiye + işlemler
app.get("/make-server-4da0b637/kasa/kisisel", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const ay = c.req.query("ay");
    // Kişisel kasa userId ile prefix'li — kendi verisini okur
    const all = (await ckv.getByPrefix(`kasa_kisisel_`)) || [];
    // Yöneticinin kendi kayıtlarını filtrele (prefix'ten userId alınamaz, tüm kisisel kayıtlar gelir)
    // Bu şekilde superadmin ghost modda hedef şirketin yöneticisinin kasasını görebilir
    const filtered = ay ? all.filter((i: any) => i.date?.startsWith(ay)) : all;

    const toplamGelir = filtered.filter((i: any) => i.type === "gelir").reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const toplamGider = filtered.filter((i: any) => i.type === "gider").reduce((s: number, i: any) => s + (i.amount || 0), 0);

    return c.json({
      bakiye: toplamGelir - toplamGider,
      toplamGelir,
      toplamGider,
      islemler: filtered.sort((a: any, b: any) => (b.date || "").localeCompare(a.date || "")),
    });
  } catch (err) {
    console.log("Kasa kisisel GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/kisisel/islem — Kişisel gelir/gider ekle
app.post("/make-server-4da0b637/kasa/kisisel/islem", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { type, category, amount, description, date } = await c.req.json();
    if (!type || !amount || amount <= 0) return c.json({ error: "type ve amount zorunlu." }, 400);

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const islem = {
      id, type, category: category || "Genel", amount,
      description: description?.trim() || "",
      date: date || new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
    };
    await ckv.set(`kasa_kisisel_${user.id}_tx_${id}`, islem);
    return c.json({ islem });
  } catch (err) {
    console.log("Kasa kisisel islem POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /kasa/kisisel/islem/:id
app.delete("/make-server-4da0b637/kasa/kisisel/islem/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const roleD = user.user_metadata?.role || "personel";
    const isSAD = user.user_metadata?.originalRole === "superadmin";
    if (roleD !== "yonetici" && !isSAD) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCIdD = c.req.query("company_id");
    const ckv = companyKvFor((isSAD && reqCIdD) ? reqCIdD : getCompanyId(user));
    await ckv.del(`kasa_kisisel_${user.id}_tx_${c.req.param("id")}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Kasa kisisel islem DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── KİŞİSEL BORÇLAR ──

// GET /kasa/kisisel/borclar
app.get("/make-server-4da0b637/kasa/kisisel/borclar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const all = (await ckv.getByPrefix(`kasa_kisisel_borc_`)) || [];
    const alacaklar = all.filter((b: any) => b.yon === "alacak").sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
    const verecekler = all.filter((b: any) => b.yon === "verecek").sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
    return c.json({
      alacaklar, verecekler,
      toplamAlacak: alacaklar.reduce((s: number, b: any) => s + (b.kalanTutar || 0), 0),
      toplamVerecek: verecekler.reduce((s: number, b: any) => s + (b.kalanTutar || 0), 0),
    });
  } catch (err) {
    console.log("Kasa kisisel borclar GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/kisisel/borclar
app.post("/make-server-4da0b637/kasa/kisisel/borclar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const { yon, kisi, tutar, aciklama, tarih } = await c.req.json();
    if (!yon || !kisi?.trim() || !tutar || tutar <= 0) return c.json({ error: "yon, kisi ve tutar zorunlu." }, 400);

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const borc = {
      id, yon, kisi: kisi.trim(), tutar: Number(tutar), kalanTutar: Number(tutar),
      aciklama: aciklama?.trim() || "",
      tarih: tarih || new Date().toISOString().split("T")[0],
      odemeler: [],
      created_at: new Date().toISOString(),
    };
    await ckv.set(`kasa_kisisel_borc_${id}`, borc);
    return c.json({ borc });
  } catch (err) {
    console.log("Kasa kisisel borc POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/kisisel/borclar/:id/odeme
app.post("/make-server-4da0b637/kasa/kisisel/borclar/:id/odeme", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const borcId = c.req.param("id");
    const { tutar, aciklama } = await c.req.json();
    if (!tutar || tutar <= 0) return c.json({ error: "Ödeme tutarı zorunlu." }, 400);

    const borc = await ckv.get(`kasa_kisisel_borc_${borcId}`);
    if (!borc) return c.json({ error: "Borç bulunamadı." }, 404);

    borc.odemeler = [...(borc.odemeler || []), { tutar: Number(tutar), tarih: new Date().toISOString().split("T")[0], aciklama: aciklama?.trim() || "", created_at: new Date().toISOString() }];
    borc.kalanTutar = Math.max(0, Number(borc.kalanTutar || borc.tutar) - Number(tutar));
    await ckv.set(`kasa_kisisel_borc_${borcId}`, borc);
    return c.json({ borc });
  } catch (err) {
    console.log("Kasa kisisel borc odeme POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /kasa/kisisel/borclar/:id
app.delete("/make-server-4da0b637/kasa/kisisel/borclar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    const isSA = user.user_metadata?.originalRole === "superadmin";
    if (role !== "yonetici" && !isSA) return c.json({ error: "Yetkiniz yok." }, 403);
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));
    await ckv.del(`kasa_kisisel_borc_${c.req.param("id")}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Kasa kisisel borc DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ── ŞİRKET BORÇLARI ──

// GET /kasa/borclar — Tüm borçlar
app.get("/make-server-4da0b637/kasa/borclar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role) && user.user_metadata?.originalRole !== "superadmin") {
      return c.json({ error: "Yetkiniz yok." }, 403);
    }
    const isSA = user.user_metadata?.originalRole === "superadmin";
    const reqCId = c.req.query("company_id");
    const ckv = companyKvFor((isSA && reqCId) ? reqCId : getCompanyId(user));

    const all = (await ckv.getByPrefix("kasa_borc_")) || [];
    const alacaklar = all.filter((b: any) => b.yon === "alacak").sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
    const verecekler = all.filter((b: any) => b.yon === "verecek").sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));

    return c.json({
      alacaklar,
      verecekler,
      toplamAlacak: alacaklar.reduce((s: number, b: any) => s + (b.kalanTutar || 0), 0),
      toplamVerecek: verecekler.reduce((s: number, b: any) => s + (b.kalanTutar || 0), 0),
    });
  } catch (err) {
    console.log("Kasa borclar GET error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/borclar — Yeni borç ekle
app.post("/make-server-4da0b637/kasa/borclar", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));

    const { yon, kisi, tutar, aciklama, tarih, currency } = await c.req.json();
    if (!yon || !kisi?.trim() || !tutar || tutar <= 0) return c.json({ error: "yon, kisi ve tutar zorunlu." }, 400);
    if (!["alacak", "verecek"].includes(yon)) return c.json({ error: "yon: alacak veya verecek olmalı." }, 400);

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const borc = {
      id, yon, kisi: kisi.trim(), tutar: Number(tutar), kalanTutar: Number(tutar),
      currency: currency || "TRY",
      aciklama: aciklama?.trim() || "",
      tarih: tarih || new Date().toISOString().split("T")[0],
      odemeler: [],
      created_at: new Date().toISOString(),
      created_by: user.user_metadata?.full_name || user.email || "",
    };
    await ckv.set(`kasa_borc_${id}`, borc);
    return c.json({ borc });
  } catch (err) {
    console.log("Kasa borc POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// POST /kasa/borclar/:id/odeme — Kısmi/tam ödeme
app.post("/make-server-4da0b637/kasa/borclar/:id/odeme", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (!["yonetici", "ust-mudur"].includes(role)) return c.json({ error: "Yetkiniz yok." }, 403);
    const ckv = companyKvFor(getCompanyId(user));

    const borcId = c.req.param("id");
    const { tutar, aciklama } = await c.req.json();
    if (!tutar || tutar <= 0) return c.json({ error: "Ödeme tutarı zorunlu." }, 400);

    const borc = await ckv.get(`kasa_borc_${borcId}`);
    if (!borc) return c.json({ error: "Borç bulunamadı." }, 404);

    const odeme = {
      tutar: Number(tutar),
      tarih: new Date().toISOString().split("T")[0],
      aciklama: aciklama?.trim() || "",
      created_at: new Date().toISOString(),
    };
    borc.odemeler = [...(borc.odemeler || []), odeme];
    borc.kalanTutar = Math.max(0, Number(borc.kalanTutar || borc.tutar) - Number(tutar));

    await ckv.set(`kasa_borc_${borcId}`, borc);
    return c.json({ borc });
  } catch (err) {
    console.log("Kasa borc odeme POST error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// DELETE /kasa/borclar/:id — Borç sil
app.delete("/make-server-4da0b637/kasa/borclar/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if ((user.user_metadata?.role || "personel") !== "yonetici" && user.user_metadata?.originalRole !== "superadmin") {
      return c.json({ error: "Yetkiniz yok." }, 403);
    }
    const ckv = companyKvFor(getCompanyId(user));
    await ckv.del(`kasa_borc_${c.req.param("id")}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log("Kasa borc DELETE error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// ═══ FABRİKA SIFIRLAMASI ════════════════
// ══════════════════════════════════════════

// POST /sistem/fabrika-sifirla — Şirketi tamamen sıfırla
app.post("/make-server-4da0b637/sistem/fabrika-sifirla", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = user.user_metadata?.role || "personel";
    if (role !== "yonetici") return c.json({ error: "Sadece yönetici bu işlemi yapabilir." }, 403);

    const companyId = getCompanyId(user);
    const { onay, sirketAdi, mod } = await c.req.json();
    const sifirlaMod = mod || "tam"; // "tam" | "finansal"

    // Çift doğrulama: şirket adı + şirket kodu
    if (!sirketAdi?.trim() || !onay?.trim()) return c.json({ error: "Şirket adı ve şirket kodu zorunlu." }, 400);

    // Şirket kodu doğrulaması (companyId ile eşleşmeli)
    if (onay.trim().toLowerCase() !== companyId.toLowerCase()) {
      return c.json({ error: `Şirket kodu eşleşmiyor.` }, 400);
    }

    // Şirket adı doğrulaması
    const companyConfig = await companyKvFor(companyId).get("company_config");
    const giris = sirketAdi.trim().toLowerCase();
    if (giris !== companyId.toLowerCase() && giris !== (companyConfig?.name || "").toLowerCase()) {
      return c.json({ error: "Şirket adı eşleşmiyor." }, 400);
    }

    const ckv = companyKvFor(companyId);
    const supabaseAdmin = getAdminClient();
    const prefix = `${companyId}:`;
    let deletedKV = 0;
    let deletedUsers = 0;

    console.log(`[FABRİKA SIFIRLA] BAŞLADI — mod=${sifirlaMod}, ${companyId} by ${user.email}`);

    if (sifirlaMod === "finansal") {
      // ── FİNANSAL SIFIRLAMA: sadece satış/gelir/gider/kasa verileri ──
      const finansalPrefixler = [
        "stok_gunluk_", "stok_aktarim_", "stok_ekleme_", "stok_transfer_", "depo_hareket_",
        "isletme_gider_", "isletme_gelir_",
        "kasa_odeme_", "kasa_devir_", "kasa_islem_", "kasa_acilis_", "kasa_acilis_borc_",
        "kasa_ay_kapatis_", "kasa_borc_", "kasa_kisisel_", "kasa_kisisel_borc_",
        "siparis_", "teslimat_", "tedarikci_odeme_", "tedarikci_fiyat_talep_",
        "prim_odendi_", "prim_silindi_", "pay_dagitim_",
        "checkin_", "checkout_", "sessions_", "lateNotice_", "paused_",
        "kidem_personel_",
      ];
      // Tek key'ler (prefix değil)
      const finansalTekKeyler = [
        "depo_stok", "kasa_sirket_settings", "otomatik_gider_son_kontrol",
      ];

      // Prefix bazlı silme
      for (const fp of finansalPrefixler) {
        const { data: rows } = await supabaseAdmin
          .from("kv_store_4da0b637")
          .select("key")
          .like("key", `${prefix}${fp}%`);
        for (const row of (rows || [])) {
          await supabaseAdmin.from("kv_store_4da0b637").delete().eq("key", row.key);
          deletedKV++;
        }
      }
      // Tek key silme
      for (const tk of finansalTekKeyler) {
        const fullKey = `${prefix}${tk}`;
        const { count } = await supabaseAdmin.from("kv_store_4da0b637").delete().eq("key", fullKey);
        if (count && count > 0) deletedKV++;
      }
      // Backfill key'leri
      const { data: bfRows } = await supabaseAdmin
        .from("kv_store_4da0b637")
        .select("key")
        .like("key", `${prefix}otomatik_gider_backfill_done_%`);
      for (const row of (bfRows || [])) {
        await supabaseAdmin.from("kv_store_4da0b637").delete().eq("key", row.key);
        deletedKV++;
      }

      console.log(`[FABRİKA SIFIRLA] FİNANSAL TAMAMLANDI — ${companyId}: ${deletedKV} KV kaydı silindi — by ${user.email}`);
      return c.json({
        ok: true,
        mod: "finansal",
        silinen: { kvKayit: deletedKV, kullanici: 0 },
        mesaj: `Finansal veriler sıfırlandı. ${deletedKV} kayıt silindi. Mekanlar, kullanıcılar ve ekipman korundu.`,
      });
    }

    // ── TAM FABRİKA SIFIRLAMA ──
    // 1. Tüm şirket KV verilerini sil
    const { data: kvRows, error: kvErr } = await supabaseAdmin
      .from("kv_store_4da0b637")
      .select("key")
      .like("key", `${prefix}%`);

    if (!kvErr && kvRows) {
      for (const row of kvRows) {
        await supabaseAdmin.from("kv_store_4da0b637").delete().eq("key", row.key);
        deletedKV++;
      }
    }

    // 2. Kullanıcıları sil (yönetici hariç)
    const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of (allUsers || [])) {
      if (u.id === user.id) continue;
      const uCompany = u.user_metadata?.company_id || "aspect";
      if (uCompany !== companyId) continue;
      await supabaseAdmin.auth.admin.deleteUser(u.id);
      deletedUsers++;
    }

    console.log(`[FABRİKA SIFIRLA] TAM TAMAMLANDI — ${companyId}: ${deletedKV} KV kaydı, ${deletedUsers} kullanıcı silindi — by ${user.email}`);

    return c.json({
      ok: true,
      mod: "tam",
      silinen: { kvKayit: deletedKV, kullanici: deletedUsers },
      mesaj: `Şirket tamamen sıfırlandı. ${deletedKV} veri kaydı ve ${deletedUsers} kullanıcı silindi.`,
    });
  } catch (err) {
    console.log("Fabrika sifirla error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// TEDARİKÇİ PORTALI
// ══════════════════════════════════════════

const resolveSupplierCompany = async (c, callerUser) => {
  const role = callerUser.user_metadata?.role;
  if (role !== "tedarikci") return null;
  const scId = c.req.header("x-supplier-company") || "";
  if (!scId) return null;
  const linked = callerUser.user_metadata?.linkedCompanies || [];
  const entry = linked.find((lc) => lc.companyId === scId);
  if (!entry) return null;
  const sckv = companyKvFor(scId);
  const cari = await sckv.get(`cost_cari_${entry.cariId}`);
  if (!cari || cari.linkedUserId !== callerUser.id) return null;
  return { companyId: scId, cariId: entry.cariId, ckv: sckv };
};

app.post("/make-server-4da0b637/tedarikci/davet", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = getEffectiveRole(callerUser);
    if (!hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const callerCompanyId = getCompanyId(callerUser);
    const { email, fullName, phone, cariId, tempPassword } = await c.req.json();
    if (!email || !cariId) return c.json({ error: "Email ve cariId zorunlu." }, 400);
    const ckv = companyKvFor(callerCompanyId);
    const cari = await ckv.get(`cost_cari_${cariId}`);
    if (!cari) return c.json({ error: "Cari bulunamadı." }, 404);
    const companyProfile = await kv.get(`company_profile_${callerCompanyId}`);
    const companyName = companyProfile?.name || callerCompanyId;
    const supabase = getAdminClient();
    const trimmedEmail = email.toLowerCase().trim();
    const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.find((u) => u.email === trimmedEmail);
    if (existingUser) {
      if (existingUser.user_metadata?.role !== "tedarikci") return c.json({ error: "Bu email başka bir rolde kayıtlı." }, 409);
      const linked = existingUser.user_metadata?.linkedCompanies || [];
      if (linked.some((lc) => lc.companyId === callerCompanyId)) return c.json({ error: "Bu tedarikçi zaten bu şirkete bağlı." }, 409);
      linked.push({ companyId: callerCompanyId, cariId, companyName });
      await supabase.auth.admin.updateUserById(existingUser.id, { user_metadata: { ...existingUser.user_metadata, linkedCompanies: linked } });
      await ckv.set(`cost_cari_${cariId}`, { ...cari, linkedUserId: existingUser.id, linkedUserEmail: trimmedEmail });
      return c.json({ ok: true, message: "Mevcut tedarikçiye şirket eklendi.", userId: existingUser.id });
    }
    const password = tempPassword || Math.random().toString(36).slice(2, 10) + "A1!";
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: trimmedEmail, password,
      user_metadata: { full_name: (fullName || cari.name || "").trim(), role: "tedarikci", phone: phone || "", company_id: "__tedarikci__", linkedCompanies: [{ companyId: callerCompanyId, cariId, companyName }] },
      email_confirm: true,
    });
    if (createError) return c.json({ error: `Kullanıcı oluşturulamadı: ${createError.message}` }, 500);
    await ckv.set(`cost_cari_${cariId}`, { ...cari, linkedUserId: newUser.user.id, linkedUserEmail: trimmedEmail });
    return c.json({ ok: true, message: "Tedarikçi hesabı oluşturuldu.", userId: newUser.user.id, tempPassword: password });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.get("/make-server-4da0b637/tedarikci/sirketlerim", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (callerUser.user_metadata?.role !== "tedarikci") return c.json({ error: "Yetki yok." }, 403);
    return c.json({ ok: true, companies: callerUser.user_metadata?.linkedCompanies || [] });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.get("/make-server-4da0b637/tedarikci/portal", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (callerUser.user_metadata?.role !== "tedarikci") return c.json({ error: "Bu endpoint tedarikçiler içindir." }, 403);
    const resolved = await resolveSupplierCompany(c, callerUser);
    if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
    const { cariId, ckv: sckv } = resolved;
    const [allSiparis, allTeslimat, allOdeme, albumler, fiyatListesi] = await Promise.all([
      sckv.getByPrefix("siparis_"), sckv.getByPrefix("teslimat_"), sckv.getByPrefix("tedarikci_odeme_"),
      sckv.get("cost_albums"), sckv.get(`tedarikci_fiyat_${cariId}`),
    ]);
    const mySiparis = (allSiparis || []).filter((s) => s.cariId === cariId && s.status !== "iptal");
    const myTeslimat = (allTeslimat || []).filter((t) => t.cariId === cariId);
    const myOdeme = (allOdeme || []).filter((o) => o.cariId === cariId);
    const cari = await sckv.get(`cost_cari_${cariId}`);
    const aktivSiparis = mySiparis.filter((s) => !["tamamlandi","iptal","taslak"].includes(s.status)).length;
    const bekleyenTeslimat = myTeslimat.filter((t) => t.status === "beklemede").length;
    const kesinSiparisler = mySiparis.filter((s) => ["onaylandi", "kismen_teslim", "teslim_edildi", "tamamlandi"].includes(s.status));
    const toplamSiparisTutar = kesinSiparisler.reduce((a, s) => a + (s.teklifFiyat || s.totalAmount || 0), 0);
    const toplamOdenen = myOdeme.filter((o) => o.status !== "reddedildi" && o.status !== "iptal").reduce((a, o) => a + (o.amount || 0), 0);
    return c.json({ ok: true, cari: cari || {}, ozet: { aktivSiparis, bekleyenTeslimat, toplamSiparisTutar, toplamOdenen, kalanBorc: toplamSiparisTutar - toplamOdenen },
      siparisler: mySiparis.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      teslimatlar: myTeslimat.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      odemeler: myOdeme.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      albumler: albumler || [], fiyatListesi: fiyatListesi || null,
    });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.get("/make-server-4da0b637/tedarikci/ozet", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = getEffectiveRole(callerUser);
    if (!hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const companyId = getCompanyId(callerUser);
    const ckv = companyKvFor(companyId);
    const [cariler, siparisler, teslimatlar, odemeler, albumler, depoStok, papers, tumStoklar, fiyatListeleri] = await Promise.all([
      ckv.getByPrefix("cost_cari_"), ckv.getByPrefix("siparis_"), ckv.getByPrefix("teslimat_"), ckv.getByPrefix("tedarikci_odeme_"),
      ckv.get("cost_albums"), ckv.get("depo_stok"), ckv.getByPrefix("cost_paper_"), ckv.getByPrefix("stok_gunluk_"), ckv.getByPrefix("tedarikci_fiyat_"),
    ]);
    // Genel stok: depo + tüm mekanların en son stok sayımı (boyut bazında toplam)
    const ds: any = migrateDepoStok(depoStok || {});
    const genelStok: Record<string, number> = {};
    for (const s of [3, 5, 7, 9, 11, 13, 15]) {
      genelStok[`album${s}`] = (Number(ds[`album${s}_tam`]) || 0) + (Number(ds[`album${s}_yarim`]) || 0);
      genelStok[`album${s}_tam`] = Number(ds[`album${s}_tam`]) || 0;
      genelStok[`album${s}_yarim`] = Number(ds[`album${s}_yarim`]) || 0;
    }
    genelStok.paspartu = ds.paspartu || 0;
    const mekanSon: Record<string, any> = {};
    for (const s of (tumStoklar || [])) { const mid = s.mekanId; if (!mid) continue; if (!mekanSon[mid] || (s.tarih || "") > (mekanSon[mid].tarih || "")) mekanSon[mid] = s; }
    for (const s of Object.values(mekanSon)) {
      const sayim = (s as any).kapanish || (s as any).acilis || {};
      for (const sz of [3, 5, 7, 9, 11, 13, 15]) {
        const eskiVal = Number(sayim[`album${sz}`]) || 0;
        const tamVal = Number(sayim[`album${sz}_tam`]) || 0;
        const yarimVal = Number(sayim[`album${sz}_yarim`]) || 0;
        genelStok[`album${sz}`] += eskiVal + tamVal + yarimVal;
        genelStok[`album${sz}_tam`] += tamVal;
        genelStok[`album${sz}_yarim`] += eskiVal + yarimVal; // eski format → yarım olarak say
      }
      genelStok.paspartu += Number(sayim.paspartu) || 0;
    }
    // Fiyat listeleri map
    const fiyatMap = {};
    for (const fl of (fiyatListeleri || [])) { if (fl.cariId) fiyatMap[fl.cariId] = fl; }

    return c.json({ ok: true, cariler: cariler || [], siparisler: (siparisler || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      teslimatlar: (teslimatlar || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      odemeler: (odemeler || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      linkedCariler: (cariler || []).filter((cr) => cr.linkedUserId).length,
      bekleyenTeslimat: (teslimatlar || []).filter((t) => t.status === "beklemede").length,
      albumler: albumler || [], depoStok: ds, genelStok, papers: papers || [], fiyatMap,
    });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.get("/make-server-4da0b637/tedarikci/siparisler", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    const callerRole = getEffectiveRole(callerUser);
    let siparisler;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      const all = await resolved.ckv.getByPrefix("siparis_");
      siparisler = (all || []).filter((s) => s.cariId === resolved.cariId && s.status !== "taslak");
    } else if (hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      const ckv = companyKvFor(getCompanyId(callerUser));
      siparisler = await ckv.getByPrefix("siparis_");
    } else { return c.json({ error: "Yetki yok." }, 403); }
    return c.json({ ok: true, siparisler: (siparisler || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.get("/make-server-4da0b637/tedarikci/siparisler/:id", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    const callerRole = getEffectiveRole(callerUser);
    const rawSipId = c.req.param("id"); const siparisId = rawSipId.startsWith("siparis_") ? rawSipId.replace("siparis_", "") : rawSipId;
    let sckv, cariId = null;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      sckv = resolved.ckv; cariId = resolved.cariId;
    } else if (hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      sckv = companyKvFor(getCompanyId(callerUser));
    } else { return c.json({ error: "Yetki yok." }, 403); }
    const siparis = await sckv.get(`siparis_${siparisId}`);
    if (!siparis) return c.json({ error: "Sipariş bulunamadı." }, 404);
    if (cariId && siparis.cariId !== cariId) return c.json({ error: "Yetki yok." }, 403);
    const [allT, allO] = await Promise.all([sckv.getByPrefix("teslimat_"), sckv.getByPrefix("tedarikci_odeme_")]);
    return c.json({ ok: true, siparis, teslimatlar: (allT || []).filter((t) => t.siparisId === siparisId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      odemeler: (allO || []).filter((o) => o.siparisId === siparisId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/siparisler", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(getEffectiveRole(callerUser), ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const companyId = getCompanyId(callerUser);
    const ckv = companyKvFor(companyId);
    const { cariId, items, currency, notes, teklifFiyat } = await c.req.json();
    if (!cariId || !items?.length) return c.json({ error: "CariId ve en az 1 kalem zorunlu." }, 400);
    const cari = await ckv.get(`cost_cari_${cariId}`);
    if (!cari) return c.json({ error: "Cari bulunamadı." }, 404);
    const now = new Date().toISOString();
    const id = `siparis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const orderItems = items.map((it, idx) => ({ id: `item_${idx}_${Math.random().toString(36).slice(2, 6)}`, productName: it.productName || "", quantity: it.quantity || 0, unitPrice: it.unitPrice || 0, currency: it.currency || currency || "TRY", deliveredQuantity: 0, notes: it.notes || "" }));
    const totalAmount = orderItems.reduce((a, it) => a + ((it.productName || "").toLowerCase().includes("paspartu") ? (it.unitPrice || 0) : (it.quantity * it.unitPrice)), 0);
    const siparis = { id, cariId, cariName: cari.name || "", status: "taslak", items: orderItems, totalAmount, currency: currency || "TRY", notes: notes || "", createdAt: now, createdBy: callerUser.user_metadata?.full_name || "", createdByUserId: callerUser.id, updatedAt: now,
      teklifFiyat: teklifFiyat ? Number(teklifFiyat) : null,
      teklifler: teklifFiyat ? [{ taraf: "admin", fiyat: Number(teklifFiyat), tarih: now, kisi: callerUser.user_metadata?.full_name || "" }] : [],
      teklifDurum: teklifFiyat ? "teklif_verildi" : null,
      loglar: [{ tarih: now, kisi: callerUser.user_metadata?.full_name || "", taraf: "admin", mesaj: teklifFiyat ? `Sipariş oluşturuldu, ₺${Number(teklifFiyat).toLocaleString("tr-TR")} teklif edildi` : `Sipariş oluşturuldu (₺${totalAmount.toLocaleString("tr-TR")})` }],
    };
    await ckv.set(id, siparis);
    return c.json({ ok: true, siparis });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/siparisler/:id/gonder", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(getEffectiveRole(callerUser), ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const companyId = getCompanyId(callerUser);
    const ckv = companyKvFor(companyId);
    const rawSipId = c.req.param("id"); const siparisId = rawSipId.startsWith("siparis_") ? rawSipId.replace("siparis_", "") : rawSipId;
    const siparis = await ckv.get(`siparis_${siparisId}`);
    if (!siparis) return c.json({ error: "Sipariş bulunamadı." }, 404);
    if (siparis.status !== "taslak") return c.json({ error: "Sadece taslak siparişler gönderilebilir." }, 400);
    siparis.status = "gonderildi"; siparis.sentAt = new Date().toISOString(); siparis.updatedAt = new Date().toISOString();
    siparis.loglar = [...(siparis.loglar || []), { tarih: new Date().toISOString(), kisi: callerUser.user_metadata?.full_name || "", taraf: "admin", mesaj: "Sipariş tedarikçiye gönderildi" }];
    await ckv.set(`siparis_${siparisId}`, siparis);
    const cari = await ckv.get(`cost_cari_${siparis.cariId}`);
    if (cari?.linkedUserId) await createNotification(cari.linkedUserId, "siparis_yeni", "Yeni Sipariş", `${siparis.items.length} kalem, toplam ${siparis.totalAmount} ${siparis.currency}`, { siparisId }, companyId);
    return c.json({ ok: true, siparis });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/siparisler/:id/onayla", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (callerUser.user_metadata?.role !== "tedarikci") return c.json({ error: "Yetki yok." }, 403);
    const resolved = await resolveSupplierCompany(c, callerUser);
    if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
    const rawSipId = c.req.param("id"); const siparisId = rawSipId.startsWith("siparis_") ? rawSipId.replace("siparis_", "") : rawSipId;
    const siparis = await resolved.ckv.get(`siparis_${siparisId}`);
    if (!siparis || siparis.cariId !== resolved.cariId) return c.json({ error: "Sipariş bulunamadı." }, 404);
    if (siparis.status !== "gonderildi") return c.json({ error: "Bu sipariş onaylanamaz." }, 400);
    siparis.status = "onaylandi"; siparis.confirmedAt = new Date().toISOString(); siparis.updatedAt = new Date().toISOString();
    siparis.loglar = [...(siparis.loglar || []), { tarih: new Date().toISOString(), kisi: callerUser.user_metadata?.full_name || "", taraf: "tedarikci", mesaj: "Sipariş onaylandı" }];
    await resolved.ckv.set(`siparis_${siparisId}`, siparis);
    // Kasada borç kaydı oluştur
    const borcTutar = siparis.teklifFiyat ? siparis.teklifFiyat : siparis.totalAmount || 0;
    if (borcTutar > 0) {
      const giderId = `isletme_gider_tedarikci_${siparisId}`;
      const gider = { id: giderId, amount: borcTutar, currency: siparis.currency || "TRY", description: `Tedarikçi sipariş: ${siparis.cariName || ""}`, category: "tedarikci", subcategory: "siparis", personelAdi: siparis.cariName || "", date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), createdBy: "sistem", siparisId: `siparis_${siparisId}` };
      await resolved.ckv.set(giderId, gider);
    }
    return c.json({ ok: true, siparis });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/siparisler/:id/iptal", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(getEffectiveRole(callerUser), ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const ckv = companyKvFor(getCompanyId(callerUser));
    const rawSipId = c.req.param("id"); const siparisId = rawSipId.startsWith("siparis_") ? rawSipId.replace("siparis_", "") : rawSipId;
    const siparis = await ckv.get(`siparis_${siparisId}`);
    if (!siparis) return c.json({ error: "Sipariş bulunamadı." }, 404);
    if (siparis.status === "tamamlandi") return c.json({ error: "Tamamlanmış sipariş iptal edilemez." }, 400);
    const { reason } = await c.req.json();
    siparis.status = "iptal"; siparis.cancelledAt = new Date().toISOString(); siparis.cancelReason = reason || ""; siparis.updatedAt = new Date().toISOString();
    siparis.loglar = [...(siparis.loglar || []), { tarih: new Date().toISOString(), kisi: callerUser.user_metadata?.full_name || "", taraf: "admin", mesaj: `Sipariş iptal edildi${reason ? ": " + reason : ""}` }];
    await ckv.set(`siparis_${siparisId}`, siparis);
    const cari = await ckv.get(`cost_cari_${siparis.cariId}`);
    if (cari?.linkedUserId) await createNotification(cari.linkedUserId, "siparis_iptal", "Sipariş İptal", reason || "Sipariş iptal edildi.", { siparisId }, getCompanyId(callerUser));
    return c.json({ ok: true, siparis });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/teslimat", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (callerUser.user_metadata?.role !== "tedarikci") return c.json({ error: "Yetki yok." }, 403);
    const resolved = await resolveSupplierCompany(c, callerUser);
    if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
    const { siparisId: rawSipId, lines, deliveryNote, deliveryDate } = await c.req.json();
    if (!rawSipId || !lines?.length) return c.json({ error: "SiparisId ve en az 1 kalem zorunlu." }, 400);
    const siparisId = rawSipId.startsWith("siparis_") ? rawSipId.replace("siparis_", "") : rawSipId;
    const siparis = await resolved.ckv.get(`siparis_${siparisId}`);
    if (!siparis || siparis.cariId !== resolved.cariId) return c.json({ error: "Sipariş bulunamadı." }, 404);
    if (!["onaylandi","kismen_teslim"].includes(siparis.status)) return c.json({ error: "Bu sipariş için teslimat bildirilemez." }, 400);
    const now = new Date().toISOString();
    const id = `teslimat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const teslimat = { id, siparisId, cariId: resolved.cariId, cariName: siparis.cariName || "", status: "beklemede",
      lines: lines.map((l) => ({ itemId: l.itemId, productName: l.productName || siparis.items?.find((i) => i.id === l.itemId)?.productName || "", quantity: l.quantity || 0 })),
      deliveryDate: deliveryDate || now.slice(0, 10), deliveryNote: deliveryNote || "", createdAt: now, createdBy: callerUser.user_metadata?.full_name || "", createdByUserId: callerUser.id };
    await resolved.ckv.set(id, teslimat);
    // Siparişe log ekle
    const sip = await resolved.ckv.get(`siparis_${siparisId}`);
    if (sip) { sip.loglar = [...(sip.loglar || []), { tarih: now, kisi: callerUser.user_metadata?.full_name || "", taraf: "tedarikci", mesaj: `Teslimat bildirildi: ${teslimat.lines.map(l => l.productName + " ×" + l.quantity).join(", ")}` }]; await resolved.ckv.set(`siparis_${siparisId}`, sip); }
    return c.json({ ok: true, teslimat });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.get("/make-server-4da0b637/tedarikci/teslimatlar", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(getEffectiveRole(callerUser), ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const ckv = companyKvFor(getCompanyId(callerUser));
    const all = await ckv.getByPrefix("teslimat_");
    const status = c.req.query("status");
    const filtered = status ? (all || []).filter((t) => t.status === status) : (all || []);
    return c.json({ ok: true, teslimatlar: filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.put("/make-server-4da0b637/tedarikci/teslimatlar/:id/onayla", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(getEffectiveRole(callerUser), ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const companyId = getCompanyId(callerUser);
    const ckv = companyKvFor(companyId);
    const rawId = c.req.param("id");
    const teslimatId = rawId.startsWith("teslimat_") ? rawId.replace("teslimat_", "") : rawId;
    const teslimat = await ckv.get(`teslimat_${teslimatId}`);
    if (!teslimat) return c.json({ error: "Teslimat bulunamadı." }, 404);
    if (teslimat.status !== "beklemede") return c.json({ error: "Bu teslimat zaten işlenmiş." }, 400);
    teslimat.status = "onaylandi"; teslimat.reviewedAt = new Date().toISOString(); teslimat.reviewedBy = callerUser.user_metadata?.full_name || "";
    await ckv.set(`teslimat_${teslimatId}`, teslimat);
    const siparis = await ckv.get(`siparis_${teslimat.siparisId}`);
    if (siparis) {
      for (const line of teslimat.lines) { const item = siparis.items?.find((i) => i.id === line.itemId); if (item) item.deliveredQuantity = (item.deliveredQuantity || 0) + (line.quantity || 0); }
      const allDelivered = siparis.items.every((i) => (i.deliveredQuantity || 0) >= i.quantity);
      const anyDelivered = siparis.items.some((i) => (i.deliveredQuantity || 0) > 0);
      if (allDelivered) siparis.status = "teslim_edildi"; else if (anyDelivered) siparis.status = "kismen_teslim";
      siparis.loglar = [...(siparis.loglar || []), { tarih: new Date().toISOString(), kisi: callerUser.user_metadata?.full_name || "", taraf: "admin", mesaj: `Teslimat onaylandı${allDelivered ? " — tümü teslim edildi" : ""}` }];
      siparis.updatedAt = new Date().toISOString();
      await ckv.set(`siparis_${teslimat.siparisId}`, siparis);
    }
    // Depo stok girişi — teslimat kalemlerini depoya ekle (tam/yarım ayrımıyla)
    const depoStok: any = migrateDepoStok(await ckv.get("depo_stok") || {});
    for (const line of teslimat.lines) {
      const name = (line.productName || "").toLowerCase();
      if (name.includes("paspartu")) {
        // Paspartu depoya eklenmez
      } else {
        const sizeMatch = name.match(/(\d+)/);
        if (sizeMatch) {
          const isTam = name.includes("tam");
          const suffix = isTam ? "_tam" : "_yarim";
          const key = `album${sizeMatch[1]}${suffix}`;
          depoStok[key] = (depoStok[key] || 0) + (line.quantity || 0);
        }
      }
    }
    await ckv.set("depo_stok", depoStok);
    console.log(`[Tedarikci] Teslimat onaylandı → depo_stok güncellendi: ${teslimatId}`);

    const cari = await ckv.get(`cost_cari_${teslimat.cariId}`);
    if (cari?.linkedUserId) await createNotification(cari.linkedUserId, "teslimat_onaylandi", "Teslimat Onaylandı", "Teslimatınız onaylandı.", { siparisId: teslimat.siparisId, teslimatId }, companyId);
    return c.json({ ok: true, teslimat, siparis });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.put("/make-server-4da0b637/tedarikci/teslimatlar/:id/reddet", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(getEffectiveRole(callerUser), ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const ckv = companyKvFor(getCompanyId(callerUser));
    const rawId = c.req.param("id");
    const teslimatId = rawId.startsWith("teslimat_") ? rawId.replace("teslimat_", "") : rawId;
    const teslimat = await ckv.get(`teslimat_${teslimatId}`);
    if (!teslimat || teslimat.status !== "beklemede") return c.json({ error: "Teslimat bulunamadı veya zaten işlenmiş." }, 400);
    const { reason } = await c.req.json();
    teslimat.status = "reddedildi"; teslimat.reviewedAt = new Date().toISOString(); teslimat.reviewedBy = callerUser.user_metadata?.full_name || ""; teslimat.rejectionReason = reason || "";
    await ckv.set(`teslimat_${teslimatId}`, teslimat);
    const cari = await ckv.get(`cost_cari_${teslimat.cariId}`);
    if (cari?.linkedUserId) await createNotification(cari.linkedUserId, "teslimat_reddedildi", "Teslimat Reddedildi", reason || "Teslimatınız reddedildi.", { siparisId: teslimat.siparisId, teslimatId }, getCompanyId(callerUser));
    return c.json({ ok: true, teslimat });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/odemeler", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (!hasPermission(getEffectiveRole(callerUser), ["yonetici", "ust-mudur", "mudur"])) return c.json({ error: "Yetki yok." }, 403);
    const companyId = getCompanyId(callerUser);
    const ckv = companyKvFor(companyId);
    const { siparisId: rawSipId, cariId: directCariId, amount, currency, paymentMethod, paymentDate, aciklama } = await c.req.json();
    if (!amount) return c.json({ error: "Tutar zorunlu." }, 400);
    const isOnOdeme = !rawSipId || String(rawSipId).startsWith("on_odeme");
    const now = new Date().toISOString();
    const payDate = paymentDate || now.slice(0, 10);
    const odemeId = `tedarikci_odeme_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (isOnOdeme) {
      // Ön ödeme — siparişe bağlı değil, doğrudan cari'ye
      if (!directCariId) return c.json({ error: "Ön ödeme için cariId zorunlu." }, 400);
      const cari = await ckv.get(`cost_cari_${directCariId}`);
      const cariName = cari?.name || directCariId;
      const odeme = { id: odemeId, siparisId: null, cariId: directCariId, cariName, amount, currency: currency || "TRY", paymentMethod: paymentMethod || "havale", paymentDate: payDate, status: "beklemede", supplierConfirmed: false, createdAt: now, createdBy: callerUser.user_metadata?.full_name || "", tip: "on_odeme" };
      await ckv.set(odemeId, odeme);
      const giderId = `isletme_gider_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await ckv.set(giderId, { id: giderId.replace("isletme_gider_", ""), personelAdi: cariName, category: "tedarikci", amount, currency: currency || "TRY", date: payDate, description: aciklama || `Ön ödeme: ${cariName}`, created_at: now, created_by: callerUser.user_metadata?.full_name || "", odemeTipi: "on_odeme", cariId: directCariId });
      await ckv.set(`kasa_odeme_${giderId.replace("isletme_gider_", "")}`, { giderId: giderId.replace("isletme_gider_", ""), odpiendi: true, odpienenTutar: amount, odemeler: [{ tutar: amount, tarih: payDate, aciklama: aciklama || `Ön ödeme: ${cariName}` }] });
      if (cari?.linkedUserId) await createNotification(cari.linkedUserId, "odeme_bildirimi", "Ödeme Kaydedildi", `₺${amount.toLocaleString("tr-TR")} ön ödeme kaydedildi`, { cariId: directCariId }, companyId);
      return c.json({ ok: true, odeme });
    }
    // Normal sipariş ödemesi
    const siparisId = rawSipId.startsWith("siparis_") ? rawSipId.replace("siparis_", "") : rawSipId;
    const siparis = await ckv.get(`siparis_${siparisId}`);
    if (!siparis) return c.json({ error: "Sipariş bulunamadı." }, 404);
    const odeme = { id: odemeId, siparisId, cariId: siparis.cariId, cariName: siparis.cariName, amount, currency: currency || siparis.currency || "TRY", paymentMethod: paymentMethod || "havale", paymentDate: payDate, status: "beklemede", supplierConfirmed: false, createdAt: now, createdBy: callerUser.user_metadata?.full_name || "" };
    await ckv.set(odemeId, odeme);
    const giderId = `isletme_gider_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await ckv.set(giderId, { id: giderId.replace("isletme_gider_", ""), personelAdi: siparis.cariName, category: "tedarikci", amount, currency: currency || siparis.currency || "TRY", date: payDate, description: aciklama || `Sipariş ödemesi: ${siparis.cariName}`, created_at: now, created_by: callerUser.user_metadata?.full_name || "", odemeTipi: "normal", cariId: siparis.cariId, siparisId });
    await ckv.set(`kasa_odeme_${giderId.replace("isletme_gider_", "")}`, { giderId: giderId.replace("isletme_gider_", ""), odpiendi: true, odpienenTutar: amount, odemeler: [{ tutar: amount, tarih: payDate, aciklama: `Tedarikçi ödemesi: ${siparis.cariName}` }] });
    const allOdeme = await ckv.getByPrefix("tedarikci_odeme_");
    const toplamOdenen = (allOdeme || []).filter((o) => o.siparisId === siparisId && o.status !== "reddedildi").reduce((a, o) => a + (o.amount || 0), 0);
    siparis.loglar = [...(siparis.loglar || []), { tarih: now, kisi: callerUser.user_metadata?.full_name || "", taraf: "admin", mesaj: `₺${amount.toLocaleString("tr-TR")} ödeme kaydedildi` }];
    const expectedAmount = siparis.teklifFiyat ? siparis.teklifFiyat : siparis.totalAmount || 0;
    if (toplamOdenen >= expectedAmount && siparis.status === "teslim_edildi") {
      siparis.status = "tamamlandi"; siparis.completedAt = now;
      siparis.loglar = [...(siparis.loglar || []), { tarih: now, kisi: "Sistem", taraf: "sistem", mesaj: "Sipariş tamamlandı — ödeme tam" }];
    }
    siparis.updatedAt = now;
    await ckv.set(`siparis_${siparisId}`, siparis);
    const cari = await ckv.get(`cost_cari_${siparis.cariId}`);
    if (cari?.linkedUserId) await createNotification(cari.linkedUserId, "odeme_yapildi", "Ödeme Kaydedildi", `${amount} ${currency || "TRY"} ödeme kaydedildi.`, { siparisId, odemeId }, companyId);
    return c.json({ ok: true, odeme });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.get("/make-server-4da0b637/tedarikci/odemeler", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      const all = await resolved.ckv.getByPrefix("tedarikci_odeme_");
      return c.json({ ok: true, odemeler: (all || []).filter((o) => o.cariId === resolved.cariId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) });
    }
    if (hasPermission(getEffectiveRole(callerUser), ["yonetici", "ust-mudur", "mudur"])) {
      const ckv = companyKvFor(getCompanyId(callerUser));
      const all = await ckv.getByPrefix("tedarikci_odeme_");
      return c.json({ ok: true, odemeler: (all || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) });
    }
    return c.json({ error: "Yetki yok." }, 403);
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/odemeler/:id/onayla", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (callerUser.user_metadata?.role !== "tedarikci") return c.json({ error: "Yetki yok." }, 403);
    const resolved = await resolveSupplierCompany(c, callerUser);
    if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
    const odemeId = c.req.param("id");
    const odeme = await resolved.ckv.get(`tedarikci_odeme_${odemeId}`);
    if (!odeme || odeme.cariId !== resolved.cariId) return c.json({ error: "Ödeme bulunamadı." }, 404);
    odeme.supplierConfirmed = true; odeme.supplierConfirmedAt = new Date().toISOString(); odeme.status = "onaylandi";
    await resolved.ckv.set(`tedarikci_odeme_${odemeId}`, odeme);
    return c.json({ ok: true, odeme });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ── TEDARİKÇİDEN TEKLİF OLUŞTURMA ──
app.post("/make-server-4da0b637/tedarikci/teklif", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (callerUser.user_metadata?.role !== "tedarikci") return c.json({ error: "Yetki yok." }, 403);
    const resolved = await resolveSupplierCompany(c, callerUser);
    if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
    const { items, currency, notes, teklifFiyat } = await c.req.json();
    if (!items?.length) return c.json({ error: "En az 1 kalem zorunlu." }, 400);
    const cari = await resolved.ckv.get(`cost_cari_${resolved.cariId}`);
    const now = new Date().toISOString();
    const id = `siparis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const orderItems = items.map((it, idx) => ({ id: `item_${idx}_${Math.random().toString(36).slice(2, 6)}`, productName: it.productName || "", quantity: it.quantity || 0, unitPrice: it.unitPrice || 0, currency: it.currency || currency || "TRY", deliveredQuantity: 0 }));
    const totalAmount = orderItems.reduce((a, it) => a + ((it.productName || "").toLowerCase().includes("paspartu") ? (it.unitPrice || 0) : (it.quantity * it.unitPrice)), 0);
    const siparis = {
      id, cariId: resolved.cariId, cariName: cari?.name || "", status: "gonderildi", items: orderItems, totalAmount, currency: currency || "TRY", notes: notes || "",
      createdAt: now, createdBy: callerUser.user_metadata?.full_name || "", createdByUserId: callerUser.id, updatedAt: now, sentAt: now,
      teklifFiyat: teklifFiyat ? Number(teklifFiyat) : totalAmount,
      teklifler: [{ taraf: "tedarikci", fiyat: teklifFiyat ? Number(teklifFiyat) : totalAmount, tarih: now, kisi: callerUser.user_metadata?.full_name || "" }],
      teklifDurum: "tedarikci_teklifi", kaynakTedarikci: true,
      loglar: [{ tarih: now, kisi: callerUser.user_metadata?.full_name || "", taraf: "tedarikci", mesaj: `Teklif oluşturuldu: ₺${(teklifFiyat || totalAmount).toLocaleString("tr-TR")}` }],
    };
    await resolved.ckv.set(id, siparis);
    // Admin'lere bildirim
    const supabase = getAdminClient();
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const admins = (users || []).filter((u) => ["yonetici", "ust-mudur"].includes(u.user_metadata?.role) && (u.user_metadata?.company_id || "aspect") === resolved.companyId);
    for (const admin of admins) await createNotification(admin.id, "siparis_teklif", "Tedarikçi Teklifi", `${cari?.name || ""}: ₺${(teklifFiyat || totalAmount).toLocaleString("tr-TR")}`, { siparisId: id }, resolved.companyId);
    return c.json({ ok: true, siparis });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ── FİYAT TALEP SİSTEMİ ──
app.post("/make-server-4da0b637/tedarikci/fiyat-talep/:cariId", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    const callerRole = getEffectiveRole(callerUser);
    let ckv;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      ckv = resolved.ckv;
    } else if (hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      ckv = companyKvFor(getCompanyId(callerUser));
    } else { return c.json({ error: "Yetki yok." }, 403); }
    const cariId = c.req.param("cariId");
    const { items } = await c.req.json();
    const taraf = role === "tedarikci" ? "tedarikci" : "admin";
    const now = new Date().toISOString();
    // Mevcut fiyatları al
    const mevcutFiyat = await ckv.get(`tedarikci_fiyat_${cariId}`);
    const talep = { cariId, items: (items || []).map((it) => {
      const mevcut = (mevcutFiyat?.items || []).find((f) => f.productName === it.productName);
      return { productName: it.productName, eskiFiyat: mevcut?.fiyat || 0, yeniFiyat: it.fiyat || 0, currency: it.currency || "TRY" };
    }), gonderen: taraf, gonderenKisi: callerUser.user_metadata?.full_name || "", tarih: now, durum: "beklemede" };
    await ckv.set(`tedarikci_fiyat_talep_${cariId}`, talep);
    // Bildirim
    if (taraf === "tedarikci") {
      const supabase = getAdminClient();
      const companyId = role === "tedarikci" ? (await resolveSupplierCompany(c, callerUser))?.companyId || "aspect" : getCompanyId(callerUser);
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const admins = (users || []).filter((u) => ["yonetici", "ust-mudur"].includes(u.user_metadata?.role) && (u.user_metadata?.company_id || "aspect") === companyId);
      for (const admin of admins) await createNotification(admin.id, "fiyat_talebi", "Fiyat Güncelleme Talebi", `${callerUser.user_metadata?.full_name || ""} fiyat güncellemesi istedi`, { cariId }, companyId);
    } else {
      const cari = await ckv.get(`cost_cari_${cariId}`);
      if (cari?.linkedUserId) await createNotification(cari.linkedUserId, "fiyat_talebi", "Fiyat Güncelleme Talebi", "Şirket fiyat güncellemesi istedi", { cariId }, getCompanyId(callerUser));
    }
    return c.json({ ok: true, talep });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/fiyat-talep/:cariId/kabul", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    const callerRole = getEffectiveRole(callerUser);
    let ckv;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      ckv = resolved.ckv;
    } else if (hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      ckv = companyKvFor(getCompanyId(callerUser));
    } else { return c.json({ error: "Yetki yok." }, 403); }
    const cariId = c.req.param("cariId");
    const { maliyetYansit } = await c.req.json();
    const talep = await ckv.get(`tedarikci_fiyat_talep_${cariId}`);
    if (!talep || talep.durum !== "beklemede") return c.json({ error: "Bekleyen talep yok." }, 404);
    talep.durum = "kabul";
    await ckv.set(`tedarikci_fiyat_talep_${cariId}`, talep);
    // Fiyat listesini güncelle
    const yeniFiyatlar = { cariId, items: (talep.items || []).map((it) => ({ productName: it.productName, fiyat: it.yeniFiyat, currency: it.currency || "TRY" })), updatedAt: new Date().toISOString(), updatedBy: callerUser.user_metadata?.full_name || "" };
    await ckv.set(`tedarikci_fiyat_${cariId}`, yeniFiyatlar);
    // Maliyet yönetimine yansıt
    if (maliyetYansit) {
      const albums = await ckv.get("cost_albums") || [];
      for (const it of talep.items) {
        const sizeMatch = it.productName.match(/(\d+)/);
        if (sizeMatch) {
          const size = parseInt(sizeMatch[1]);
          const album = albums.find((a) => a.size === size || a.size === String(size));
          if (album) { album.yarimBoy = it.yeniFiyat; }
        }
      }
      await ckv.set("cost_albums", albums);
    }
    return c.json({ ok: true, talep, fiyat: yeniFiyatlar });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.post("/make-server-4da0b637/tedarikci/fiyat-talep/:cariId/red", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    const callerRole = getEffectiveRole(callerUser);
    let ckv;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      ckv = resolved.ckv;
    } else if (hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      ckv = companyKvFor(getCompanyId(callerUser));
    } else { return c.json({ error: "Yetki yok." }, 403); }
    const cariId = c.req.param("cariId");
    const talep = await ckv.get(`tedarikci_fiyat_talep_${cariId}`);
    if (!talep || talep.durum !== "beklemede") return c.json({ error: "Bekleyen talep yok." }, 404);
    talep.durum = "red";
    await ckv.set(`tedarikci_fiyat_talep_${cariId}`, talep);
    return c.json({ ok: true, talep });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ── ÜRETİM DURUMU ──
app.post("/make-server-4da0b637/tedarikci/siparisler/:id/durum", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (callerUser.user_metadata?.role !== "tedarikci") return c.json({ error: "Yetki yok." }, 403);
    const resolved = await resolveSupplierCompany(c, callerUser);
    if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
    const rawSipId = c.req.param("id"); const siparisId = rawSipId.startsWith("siparis_") ? rawSipId.replace("siparis_", "") : rawSipId;
    const siparis = await resolved.ckv.get(`siparis_${siparisId}`);
    if (!siparis || siparis.cariId !== resolved.cariId) return c.json({ error: "Sipariş bulunamadı." }, 404);
    const { durum, not } = await c.req.json();
    const durumLabel = durum === "uretimde" ? "Üretimde" : durum === "hazir" ? "Hazır — Teslimat Bekliyor" : durum === "kismi_hazir" ? "Kısmi Hazır" : durum;
    siparis.uretimDurum = durum;
    siparis.loglar = [...(siparis.loglar || []), { tarih: new Date().toISOString(), kisi: callerUser.user_metadata?.full_name || "", taraf: "tedarikci", mesaj: `Üretim durumu: ${durumLabel}${not ? " — " + not : ""}` }];
    siparis.updatedAt = new Date().toISOString();
    await resolved.ckv.set(`siparis_${siparisId}`, siparis);
    // Admin bildirim
    const supabase = getAdminClient();
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const admins = (users || []).filter((u) => ["yonetici", "ust-mudur"].includes(u.user_metadata?.role) && (u.user_metadata?.company_id || "aspect") === resolved.companyId);
    for (const admin of admins) await createNotification(admin.id, "siparis_durum", "Üretim Durumu", `${siparis.cariName}: ${durumLabel}`, { siparisId }, resolved.companyId);
    return c.json({ ok: true, siparis });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ── TEKLİF / PAZARLIK ──
app.post("/make-server-4da0b637/tedarikci/siparisler/:id/teklif", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    const callerRole = getEffectiveRole(callerUser);
    let ckv;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      ckv = resolved.ckv;
    } else if (hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      ckv = companyKvFor(getCompanyId(callerUser));
    } else { return c.json({ error: "Yetki yok." }, 403); }
    const rawSipId = c.req.param("id"); const siparisId = rawSipId.startsWith("siparis_") ? rawSipId.replace("siparis_", "") : rawSipId;
    const { fiyat, aksiyon, items } = await c.req.json(); // aksiyon: "teklif" | "kabul" | "red"
    const siparis = await ckv.get(`siparis_${siparisId}`);
    if (!siparis) return c.json({ error: "Sipariş bulunamadı." }, 404);
    const taraf = role === "tedarikci" ? "tedarikci" : "admin";
    const now = new Date().toISOString();
    if (aksiyon === "kabul") {
      siparis.teklifDurum = "kabul_edildi";
      siparis.teklifler = [...(siparis.teklifler || []), { taraf, fiyat: siparis.teklifFiyat, tarih: now, kisi: callerUser.user_metadata?.full_name || "", aksiyon: "kabul" }];
      if (siparis.status === "gonderildi" || siparis.status === "taslak") siparis.status = "onaylandi";
      siparis.confirmedAt = now;
      // Teklif kabul → kasada borç oluştur veya güncelle
      const borcTutar = siparis.teklifFiyat || siparis.totalAmount || 0;
      if (borcTutar > 0) {
        const giderId = `isletme_gider_tedarikci_${siparisId}`;
        const mevcutGider = await ckv.get(giderId);
        if (!mevcutGider) {
          await ckv.set(giderId, { id: giderId, amount: borcTutar, currency: siparis.currency || "TRY", description: `Tedarikçi sipariş: ${siparis.cariName || ""}`, category: "tedarikci", subcategory: "siparis", personelAdi: siparis.cariName || "", date: now.slice(0, 10), createdAt: now, createdBy: "sistem", siparisId: `siparis_${siparisId}` });
        } else {
          // Teklif fiyatı değişmiş olabilir — güncelle
          mevcutGider.amount = borcTutar;
          mevcutGider.description = `Tedarikçi sipariş: ${siparis.cariName || ""}`;
          await ckv.set(giderId, mevcutGider);
        }
      }
    } else if (aksiyon === "red") {
      siparis.teklifDurum = "reddedildi";
      siparis.status = "iptal";
      siparis.cancelledAt = now;
      siparis.cancelReason = "Teklif reddedildi";
      siparis.teklifler = [...(siparis.teklifler || []), { taraf, fiyat: siparis.teklifFiyat, tarih: now, kisi: callerUser.user_metadata?.full_name || "", aksiyon: "red" }];
    } else {
      siparis.teklifFiyat = Number(fiyat);
      siparis.teklifDurum = taraf === "admin" ? "teklif_verildi" : "karsi_teklif";
      siparis.teklifler = [...(siparis.teklifler || []), { taraf, fiyat: Number(fiyat), tarih: now, kisi: callerUser.user_metadata?.full_name || "", items: items || null }];
      // Karşı teklifte ürün kalemleri değiştirilmişse güncelle
      if (items?.length) {
        siparis.items = items.map((it, idx) => ({ id: it.id || `item_${idx}_${Math.random().toString(36).slice(2, 6)}`, productName: it.productName || "", quantity: it.quantity || 0, unitPrice: it.unitPrice || 0, currency: it.currency || siparis.currency || "TRY", deliveredQuantity: 0 }));
        siparis.totalAmount = siparis.items.reduce((a, it) => a + ((it.productName || "").toLowerCase().includes("paspartu") ? (it.unitPrice || 0) : (it.quantity * it.unitPrice)), 0);
      }
    }
    const logMesaj = aksiyon === "kabul" ? "Teklif kabul edildi" : aksiyon === "red" ? "Teklif reddedildi" : `₺${Number(fiyat).toLocaleString("tr-TR")} ${taraf === "admin" ? "teklif edildi" : "karşı teklif yapıldı"}`;
    siparis.loglar = [...(siparis.loglar || []), { tarih: now, kisi: callerUser.user_metadata?.full_name || "", taraf, mesaj: logMesaj }];
    siparis.updatedAt = now;
    await ckv.set(`siparis_${siparisId}`, siparis);
    // Bildirim
    if (taraf === "tedarikci") {
      const supabase = getAdminClient();
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const admins = (users || []).filter((u) => ["yonetici", "ust-mudur"].includes(u.user_metadata?.role) && (u.user_metadata?.company_id || "aspect") === (siparis.companyId || getCompanyId(callerUser)));
      for (const admin of admins) await createNotification(admin.id, "siparis_teklif", aksiyon === "kabul" ? "Teklif Kabul Edildi" : aksiyon === "red" ? "Teklif Reddedildi" : "Karşı Teklif", `${siparis.cariName}: ₺${fiyat || siparis.teklifFiyat}`, { siparisId }, getCompanyId(callerUser));
    } else {
      const cari = await ckv.get(`cost_cari_${siparis.cariId}`);
      if (cari?.linkedUserId) await createNotification(cari.linkedUserId, "siparis_teklif", aksiyon === "kabul" ? "Teklif Kabul Edildi" : aksiyon === "red" ? "Teklif Reddedildi" : "Yeni Teklif", `₺${fiyat || siparis.teklifFiyat}`, { siparisId }, getCompanyId(callerUser));
    }
    return c.json({ ok: true, siparis });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ── Mevcut siparişler için eksik borç kayıtlarını oluştur (tek seferlik migrasyon) ──
app.post("/make-server-4da0b637/tedarikci/migrasyon/borc-olustur", async (c) => {
  try {
    const { companyId, secret } = await c.req.json().catch(() => ({}));
    if (secret !== "aspect_migrasyon_2026") {
      const callerUser = await verifyToken(c);
      if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
      if (!hasPermission(getEffectiveRole(callerUser), ["yonetici"])) return c.json({ error: "Sadece yönetici." }, 403);
    }
    const cid = companyId || "aspect";
    const ckv = companyKvFor(cid);
    const allSiparis = await ckv.getByPrefix("siparis_");
    const allTedOdeme = await ckv.getByPrefix("tedarikci_odeme_");
    const debug = { companyId: cid, toplamSiparis: (allSiparis || []).length, tedOdemeleri: (allTedOdeme || []).map((o: any) => ({ id: o.id, cariId: o.cariId, cariName: o.cariName, amount: o.amount, siparisId: o.siparisId, tip: o.tip, status: o.status })), statuslar: (allSiparis || []).map((s: any) => ({ id: s.id, status: s.status, cari: s.cariName, teklif: s.teklifFiyat, total: s.totalAmount })) };
    const olusturulan: string[] = [];
    for (const siparis of (allSiparis || [])) {
      if (!["onaylandi", "kismen_teslim", "teslim_edildi", "tamamlandi"].includes(siparis.status)) continue;
      const siparisId = (siparis.id || "").replace("siparis_", "");
      if (!siparisId) continue;
      const borcTutar = siparis.teklifFiyat || siparis.totalAmount || 0;
      if (borcTutar <= 0) continue;
      // Eski yanlış prefix'li kaydı sil
      const eskiGiderId = `gider_tedarikci_${siparisId}`;
      const eskiMevcut = await ckv.get(eskiGiderId);
      if (eskiMevcut) await ckv.del(eskiGiderId);
      // Doğru prefix ile oluştur
      const giderId = `isletme_gider_tedarikci_${siparisId}`;
      const mevcut = await ckv.get(giderId);
      if (mevcut) { olusturulan.push(`MEVCUT: ${siparis.cariName}: ₺${mevcut.amount} cat=${mevcut.category} cariId=${mevcut.cariId} sipId=${mevcut.siparisId} (${giderId})`); continue; }
      await ckv.set(giderId, { id: giderId, amount: borcTutar, currency: siparis.currency || "TRY", description: `Tedarikçi sipariş: ${siparis.cariName || ""}`, category: "tedarikci", subcategory: "siparis", personelAdi: siparis.cariName || "", date: (siparis.confirmedAt || siparis.createdAt || new Date().toISOString()).slice(0, 10), createdAt: new Date().toISOString(), createdBy: "migrasyon", siparisId: siparis.id });
      olusturulan.push(`YENİ: ${siparis.cariName}: ₺${borcTutar} (${siparis.id})`);
    }
    return c.json({ ok: true, olusturulan, toplam: olusturulan.length, debug });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ── TEDARİKÇİ FİYAT LİSTESİ ──
app.get("/make-server-4da0b637/tedarikci/fiyat/:cariId", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    const callerRole = getEffectiveRole(callerUser);
    let ckv;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      ckv = resolved.ckv;
    } else if (hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      ckv = companyKvFor(getCompanyId(callerUser));
    } else { return c.json({ error: "Yetki yok." }, 403); }
    const cariId = c.req.param("cariId");
    const fiyat = await ckv.get(`tedarikci_fiyat_${cariId}`);
    return c.json({ ok: true, fiyat: fiyat || { cariId, items: [] } });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

app.put("/make-server-4da0b637/tedarikci/fiyat/:cariId", async (c) => {
  try {
    const callerUser = await verifyToken(c);
    if (!callerUser) return c.json({ error: "Yetkisiz erişim." }, 401);
    const role = callerUser.user_metadata?.role;
    const callerRole = getEffectiveRole(callerUser);
    let ckv;
    if (role === "tedarikci") {
      const resolved = await resolveSupplierCompany(c, callerUser);
      if (!resolved) return c.json({ error: "Geçersiz şirket." }, 403);
      ckv = resolved.ckv;
    } else if (hasPermission(callerRole, ["yonetici", "ust-mudur", "mudur"])) {
      ckv = companyKvFor(getCompanyId(callerUser));
    } else { return c.json({ error: "Yetki yok." }, 403); }
    const cariId = c.req.param("cariId");
    const { items } = await c.req.json();
    const fiyat = { cariId, items: items || [], updatedAt: new Date().toISOString(), updatedBy: callerUser.user_metadata?.full_name || callerUser.email || "" };
    await ckv.set(`tedarikci_fiyat_${cariId}`, fiyat);
    return c.json({ ok: true, fiyat });
  } catch (err) { return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});

// ══════════════════════════════════════════
// SHADOW COMPARE: KV vs PostgreSQL (Aşama 4)
// GET /make-server-4da0b637/migration/shadow-compare
// Tarih aralığındaki KV ve SQL satış/kare verilerini karşılaştırır
// ══════════════════════════════════════════
app.get("/make-server-4da0b637/migration/shadow-compare", async (c) => {
  try {
    const migKey = c.req.header("X-Migration-Key");
    if (migKey !== "aspect-pg-migration-2026") {
      const user = await verifyToken(c);
      if (!user || (user.user_metadata?.originalRole !== "superadmin" && user.user_metadata?.role !== "yonetici")) {
        return c.json({ error: "Yetkisiz." }, 403);
      }
    }

    const targetCompany = c.req.query("company_id") || "aspect";
    const tarih = c.req.query("tarih") || bizDateTR();
    const ckv = companyKvFor(targetCompany);
    const db = getAdminClient();

    const diffs: any[] = [];

    // Tüm mekanları al
    const mekanlar: any[] = await ckv.getByPrefix("mekan_") || [];

    for (const mekan of mekanlar) {
      const stok: any = await ckv.get(`stok_gunluk_${mekan.id}_${tarih}`);
      if (!stok) continue;

      // KV satış sayısı
      const kvSatislar = (stok.satislar || []).filter((s: any) => !s.iptal);
      const kvSatisCount = kvSatislar.length;
      const kvCiro = kvSatislar.reduce((s: number, sale: any) => s + (Number(sale.finalPrice) || 0), 0);

      // SQL satış sayısı
      const { data: sqlSales, error: sqlErr } = await db.from("sales")
        .select("id, final_price")
        .eq("company_id", targetCompany)
        .eq("venue_id", mekan.id)
        .eq("date", tarih)
        .eq("is_cancelled", false);

      const sqlSatisCount = sqlSales?.length || 0;
      const sqlCiro = (sqlSales || []).reduce((s: number, sale: any) => s + (Number(sale.final_price) || 0), 0);

      // KV kare
      const kvKareler = stok.kareKayitlari || [];
      const kvKareCount = kvKareler.length;
      const kvKareTotal = kvKareler.reduce((s: number, k: any) => s + (Number(k.frameCount) || 0), 0);

      // SQL kare
      const { data: sqlFrames } = await db.from("frame_records")
        .select("id, frame_count")
        .eq("company_id", targetCompany)
        .eq("venue_id", mekan.id)
        .eq("date", tarih);

      const sqlKareCount = sqlFrames?.length || 0;
      const sqlKareTotal = (sqlFrames || []).reduce((s: number, f: any) => s + (Number(f.frame_count) || 0), 0);

      // Fark var mı?
      const satisMatch = kvSatisCount === sqlSatisCount && Math.round(kvCiro) === Math.round(sqlCiro);
      const kareMatch = kvKareCount === sqlKareCount && kvKareTotal === sqlKareTotal;

      if (!satisMatch || !kareMatch) {
        diffs.push({
          mekan: mekan.name,
          mekanId: mekan.id,
          satis: { kv: kvSatisCount, sql: sqlSatisCount, kvCiro: Math.round(kvCiro), sqlCiro: Math.round(sqlCiro), match: satisMatch },
          kare: { kv: kvKareCount, sql: sqlKareCount, kvTotal: kvKareTotal, sqlTotal: sqlKareTotal, match: kareMatch },
        });
      }
    }

    const result = {
      company: targetCompany,
      tarih,
      mekanSayisi: mekanlar.length,
      farkSayisi: diffs.length,
      status: diffs.length === 0 ? "MATCH" : "DIFF",
      diffs,
    };

    if (diffs.length > 0) {
      console.log(`[shadow-compare] FARK BULUNDU: ${targetCompany}/${tarih} — ${diffs.length} mekanda uyuşmazlık`);
    } else {
      console.log(`[shadow-compare] OK: ${targetCompany}/${tarih} — ${mekanlar.length} mekan eşleşti`);
    }

    return c.json(result);
  } catch (err) {
    console.log("shadow-compare error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════
// MIGRATION: KV → PostgreSQL (Aşama 2 — Referans Veriler)
// POST /make-server-4da0b637/migration/ref-data
// Sadece superadmin çalıştırabilir. Tek seferlik.
// ══════════════════════════════════════════
app.post("/make-server-4da0b637/migration/ref-data", async (c) => {
  try {
    // Auth: ya superadmin token ya da X-Migration-Key header
    const migKey = c.req.header("X-Migration-Key");
    if (migKey !== "aspect-pg-migration-2026") {
      const user = await verifyToken(c);
      if (!user) return c.json({ error: "Yetkisiz." }, 401);
      if (user.user_metadata?.originalRole !== "superadmin" && user.user_metadata?.role !== "yonetici") {
        return c.json({ error: "Sadece superadmin/yönetici çalıştırabilir." }, 403);
      }
    }

    const db = getAdminClient();
    const singleCompany = c.req.query("company_id");

    // Tek şirket belirtilmişse onu yap, yoksa tüm şirketleri bul
    let companyIds: string[] = [];
    if (singleCompany) {
      companyIds = [singleCompany];
    } else {
      const allCompanies: any[] = await kv.getByPrefix("company_profile_") || [];
      companyIds = allCompanies.map((cp: any) => cp.id || "").filter(Boolean);
      if (!companyIds.includes("aspect")) companyIds.unshift("aspect");
    }

    const allResults: Record<string, string[]> = {};

    for (const targetCompany of companyIds) {
    const ckv = companyKvFor(targetCompany);
    const log: string[] = [];

    // ── 1. MEKANLAR ──
    const mekanlar: any[] = await ckv.getByPrefix("mekan_") || [];
    if (mekanlar.length > 0) {
      const venueRows = mekanlar.map((m: any) => ({
        id: m.id,
        company_id: targetCompany,
        name: m.name || "",
        emoji: m.emoji || "📍",
        color: m.color || "#9dd9ea",
        photo_price: Number(m.photoPrice) || 0,
        price_currency: m.priceCurrency || "TRY",
        yearly_rent: Number(m.yearlyRent) || 0,
        profit_target: Number(m.profitTarget) || 0,
        print_type: m.printType || "yarim",
        zorluk_katsayisi: Number(m.zorlukKatsayisi) || 1.0,
        kare_charpani: Number(m.kareCharpani) || 5,
        working_hours: m.workingHours || null,
        kota_kademeleri: m.kotaKademeleri || null,
        extra_data: m,
      }));
      const { error } = await db.from("venues").upsert(venueRows, { onConflict: "id" });
      log.push(error ? `venues HATA: ${error.message}` : `venues: ${venueRows.length} kayıt`);
    }

    // ── 2. EKİPMAN ──
    const ekipmanlar: any[] = await ckv.getByPrefix("ekipman_") || [];
    if (ekipmanlar.length > 0) {
      const eqRows = ekipmanlar.map((e: any) => ({
        id: e.id,
        company_id: targetCompany,
        venue_id: e.locationId || e.mekanId || null,
        name: e.model ? `${e.brand || ''} ${e.model}`.trim() : (e.name || ""),
        type: e.category || e.type || "other",
        ribon_mevcut: Number(e.ribonMevcut) || 0,
        ribon_kapasitesi: Number(e.ribonKapasitesi) || 0,
        extra_data: { category: e.category, brand: e.brand, model: e.model, serialNumber: e.serialNumber, serialNo: e.serialNo, status: e.status, location: e.location, locationType: e.locationType, carpan: e.carpan, kagitTipiId: e.kagitTipiId, kagitTipiAdi: e.kagitTipiAdi, notes: e.notes, assignedTo: e.assignedTo, assignedToId: e.assignedToId, flashId: e.flashId, imagePath: e.imagePath, gecmis: e.gecmis },
      }));
      const { error } = await db.from("equipment").upsert(eqRows, { onConflict: "id" });
      log.push(error ? `equipment HATA: ${error.message}` : `equipment: ${eqRows.length} kayıt`);
    }

    // ── 3. ROTASYON GÖREVLERİ ──
    const rotasyonlar: any[] = await ckv.getByPrefix("rotation_task_") || [];
    if (rotasyonlar.length > 0) {
      const rotRows = rotasyonlar.map((t: any) => ({
        id: t.id,
        company_id: targetCompany,
        date: t.date || null,
        location: t.location || "",
        location_icon: t.locationIcon || "📍",
        start_time: t.startTime || null,
        end_time: t.endTime || null,
        task_type: t.taskType || "regular",
        status: t.status || "draft",
        personnel: t.personnel || [],
        notes: t.notes || null,
        created_by: t.created_by || null,
        extra_data: t,
      }));
      const { error } = await db.from("rotation_tasks").upsert(rotRows, { onConflict: "id" });
      log.push(error ? `rotation_tasks HATA: ${error.message}` : `rotation_tasks: ${rotRows.length} kayıt`);
    }

    // ── 4. İZİN TALEPLERİ ──
    const izinler: any[] = await ckv.getByPrefix("rotation_leave_") || [];
    if (izinler.length > 0) {
      const leaveRows = izinler.map((l: any) => ({
        id: l.id,
        company_id: targetCompany,
        personnel_id: l.personnelId || "",
        personnel_name: l.personnelName || "",
        personnel_avatar: l.personnelAvatar || "",
        personnel_role: l.personnelRole || "",
        start_date: l.startDate || null,
        end_date: l.endDate || null,
        days: Number(l.days) || 1,
        type: l.type || "annual",
        notes: l.notes || null,
        status: l.status || "pending",
        extra_data: l,
      }));
      const { error } = await db.from("leave_requests").upsert(leaveRows, { onConflict: "id" });
      log.push(error ? `leave_requests HATA: ${error.message}` : `leave_requests: ${leaveRows.length} kayıt`);
    }

    // ── 5. DUYURULAR ──
    const duyurular: any[] = await ckv.getByPrefix("announcement_") || [];
    if (duyurular.length > 0) {
      const annRows = duyurular.map((a: any) => ({
        id: a.id,
        company_id: targetCompany,
        title: a.title || "",
        message: a.message || "",
        type: a.type || "info",
        priority: a.priority || "medium",
      }));
      const { error } = await db.from("announcements").upsert(annRows, { onConflict: "id" });
      log.push(error ? `announcements HATA: ${error.message}` : `announcements: ${annRows.length} kayıt`);
    }

    // ── 6. ŞİRKET AYARLARI ──
    const settingsKeys = [
      { kvKey: "cost_exchange_rates", settingKey: "exchange_rates" },
      { kvKey: "cost_albums", settingKey: "album_costs" },
      { kvKey: "leaderboard_config_v1", settingKey: "leaderboard_config" },
      { kvKey: "ai_role_config_v1", settingKey: "ai_role_config" },
      { kvKey: "company_telegram_config", settingKey: "telegram_config" },
      { kvKey: "kasa_sirket_settings", settingKey: "kasa_settings" },
      { kvKey: "kidem_carpanlari", settingKey: "kidem_carpanlari" },
    ];
    let settingsCount = 0;
    for (const sk of settingsKeys) {
      const val = await ckv.get(sk.kvKey);
      if (val) {
        const { error } = await db.from("company_settings").upsert(
          { company_id: targetCompany, key: sk.settingKey, value: val },
          { onConflict: "company_id,key" }
        );
        if (error) log.push(`settings/${sk.settingKey} HATA: ${error.message}`);
        else settingsCount++;
      }
    }
    log.push(`company_settings: ${settingsCount} ayar`);

    // ── 7. TEDARİKÇİ/CARİ ──
    const cariler: any[] = await ckv.getByPrefix("cost_cari_") || [];
    if (cariler.length > 0) {
      const vendorRows = cariler.map((v: any) => ({
        id: v.id,
        company_id: targetCompany,
        name: v.name || "",
        type: v.type || "supplier",
        balance: Number(v.balance) || 0,
        extra_data: v,
      }));
      const { error } = await db.from("vendor_accounts").upsert(vendorRows, { onConflict: "id" });
      log.push(error ? `vendor_accounts HATA: ${error.message}` : `vendor_accounts: ${vendorRows.length} kayıt`);
    }

    // ── 8. MAAŞLAR ──
    const maaslar: any[] = await ckv.getByPrefix("cost_salary_") || [];
    if (maaslar.length > 0) {
      const salaryRows = maaslar.map((m: any) => ({
        id: m.id || `sal-${m.userId}-${Date.now()}`,
        company_id: targetCompany,
        user_id: m.userId || "",
        monthly_amount: Number(m.monthlyAmount || m.amount) || 0,
        extra_data: m,
      }));
      // salaries PK is UUID, use insert instead of upsert
      for (const row of salaryRows) {
        const { error } = await db.from("salaries").insert(row).select();
        if (error && !error.message.includes("duplicate")) log.push(`salaries HATA: ${error.message}`);
      }
      log.push(`salaries: ${salaryRows.length} kayıt`);
    }

    // ── 9. SATIŞLAR (stok_gunluk → sales tablosu) ──
    const tumStoklar: any[] = await ckv.getByPrefix("stok_gunluk_") || [];
    let satisCount = 0;
    let kareCount = 0;
    const satisRows: any[] = [];
    const kareRows: any[] = [];

    for (const stok of tumStoklar) {
      const stkMekanId = stok.mekanId || "";
      const stkTarih = stok.tarih || "";
      if (!stkMekanId || !stkTarih) continue;

      // Satışlar
      const satislar: any[] = (stok.satislar || []);
      for (const s of satislar) {
        if (!s.id) continue;
        satisRows.push({
          id: s.id,
          company_id: targetCompany,
          venue_id: stkMekanId,
          date: stkTarih,
          items: s.items || [],
          total_price: Number(s.totalPrice) || 0,
          discount: Number(s.discount) || 0,
          final_price: Number(s.finalPrice) || 0,
          payment_method: s.paymentMethod || "cash",
          currency: s.currency || "TRY",
          currency_price: s.currencyPrice || null,
          recorded_by_id: s.kaydedenId || null,
          recorded_by_name: s.kaydeden || null,
          is_cancelled: !!s.iptal,
          cancel_reason: s.iptalNeden || null,
          cancel_time: s.iptalZamani || null,
          gerekce: s.gerekce || null,
          idempotency_key: s.id,
          timestamp: s.timestamp || null,
        });
      }

      // Kare kayıtları
      const kareler: any[] = (stok.kareKayitlari || []);
      for (const k of kareler) {
        if (!k.id) continue;
        kareRows.push({
          id: k.id,
          company_id: targetCompany,
          venue_id: stkMekanId,
          date: stkTarih,
          photographer_id: k.photographerId || "",
          photographer_name: k.photographerName || "",
          frame_count: Number(k.frameCount) || 0,
          recorded_by_id: k.kaydedenId || null,
          recorded_by_name: k.kaydeden || null,
          timestamp: k.timestamp || null,
        });
      }
    }

    // Batch upsert — 500'er parça halinde
    if (satisRows.length > 0) {
      for (let i = 0; i < satisRows.length; i += 500) {
        const batch = satisRows.slice(i, i + 500);
        const { error } = await db.from("sales").upsert(batch, { onConflict: "id" });
        if (error) { log.push(`sales batch ${i} HATA: ${error.message}`); break; }
      }
      satisCount = satisRows.length;
      log.push(`sales: ${satisCount} kayıt`);
    } else {
      log.push(`sales: 0 kayıt`);
    }

    if (kareRows.length > 0) {
      for (let i = 0; i < kareRows.length; i += 500) {
        const batch = kareRows.slice(i, i + 500);
        const { error } = await db.from("frame_records").upsert(batch, { onConflict: "id" });
        if (error) { log.push(`frame_records batch ${i} HATA: ${error.message}`); break; }
      }
      kareCount = kareRows.length;
      log.push(`frame_records: ${kareCount} kayıt`);
    } else {
      log.push(`frame_records: 0 kayıt`);
    }

    // ── 10. STOK HAREKETLERİ (stok_gunluk → stock_movements) ──
    let stockCount = 0;
    for (const stok of tumStoklar) {
      const stkMekanId = stok.mekanId || "";
      const stkTarih = stok.tarih || "";
      if (!stkMekanId || !stkTarih) continue;

      const movements: any[] = [];

      // Açılış
      if (stok.acilisYapildi) {
        movements.push({
          company_id: targetCompany,
          venue_id: stkMekanId,
          date: stkTarih,
          type: "opening",
          stock_data: stok.acilis || null,
          printer_data: stok.acilisYazicilar || null,
          anomaly_data: stok.acilisAnomali || null,
          customer_count: stok.musteriSayisi || null,
          performed_by_id: stok.acilisYapanId || null,
          performed_by_name: stok.acilisYapanAd || null,
          notes: stok.acilisNot || null,
          timestamp: stok.acilisZamani || null,
        });
      }

      // Kapanış
      if (stok.kapanisYapildi) {
        movements.push({
          company_id: targetCompany,
          venue_id: stkMekanId,
          date: stkTarih,
          type: "closing",
          stock_data: stok.kapanish || null,
          printer_data: stok.printerData || null,
          shift_total: stok.vardiyaToplam || null,
          anomaly_data: stok.kapanisAnomali || null,
          customer_count: stok.musteriSayisi || null,
          performed_by_id: stok.kapanisYapanId || null,
          performed_by_name: stok.kapanisYapanAd || null,
          notes: stok.kapanisNot || null,
          timestamp: stok.kapanisZamani || null,
        });
      }

      if (movements.length > 0) {
        for (const mov of movements) {
          // Unique check: company + venue + date + type
          const { data: existing } = await db.from("stock_movements")
            .select("id")
            .eq("company_id", mov.company_id)
            .eq("venue_id", mov.venue_id)
            .eq("date", mov.date)
            .eq("type", mov.type)
            .limit(1);
          if (existing && existing.length > 0) continue; // zaten var
          const { error } = await db.from("stock_movements").insert(mov);
          if (error) { log.push(`stock_movements HATA: ${error.message}`); }
          else stockCount++;
        }
      }
    }
    log.push(`stock_movements: ${stockCount} kayıt`);

    console.log(`[Migration] Ref-data ${targetCompany}: ${log.join(" | ")}`);
    allResults[targetCompany] = log;
    } // for companyIds loop end

    return c.json({ success: true, companies: Object.keys(allResults), results: allResults });
  } catch (err) {
    console.log("migration/ref-data error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════

Deno.serve(async (req) => {
  // Supabase Edge Functions'da OPTIONS preflight istekleri gateway tarafından kesilebilir.
  // Bu nedenle OPTIONS'ı Hono'ya göndermeden önce burada açıkça handle ediyoruz.
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-access-token, x-supplier-company',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '600',
      },
    });
  }
  return app.fetch(req);
});