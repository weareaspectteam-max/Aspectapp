import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import { jwtVerify } from "npm:jose@5";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
// X-Access-Token: kullanıcının ES256 JWT'si (gateway doğrulamasını bypass eder, sunucu doğrular)
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Access-Token"],
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
// Önce JWT'yi SUPABASE_JWT_SECRET ile yerel doğrular (ağ çağrısı yok).
// Yerel doğrulama başarısız olursa network fallback (3 deneme).
const verifyToken = async (c: any) => {
  const xToken = c.req.header("X-Access-Token");

  if (!xToken) {
    console.log("[verifyToken] X-Access-Token header eksik — 401");
    return null;
  }

  // ── 1. Yerel JWT doğrulaması (ağ çağrısı yok, connection reset riski sıfır) ──
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(xToken, secret);
      if (payload?.sub) {
        return { id: payload.sub, email: payload.email ?? "", role: payload.role ?? "" };
      }
    } catch (jwtErr) {
      console.log("[verifyToken] yerel JWT başarısız, network fallback:", String(jwtErr).slice(0, 120));
    }
  }

  // ── 2. Network fallback (3 deneme, üstel geri çekilme) ──
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const supabase = getAdminClient();
      const { data: { user }, error } = await supabase.auth.getUser(xToken);
      if (error) {
        console.log(`[verifyToken] getUser hatası (deneme ${attempt}):`, error.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 300 * attempt));
        continue;
      }
      if (!user) {
        console.log("[verifyToken] getUser: kullanıcı bulunamadı");
        return null;
      }
      return user;
    } catch (err) {
      console.log(`[verifyToken] network hatası (deneme ${attempt}):`, String(err).slice(0, 120));
      if (attempt < 3) await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }
  console.log("[verifyToken] tüm denemeler başarısız — 401 döndürülüyor");
  return null;
};

// ──────────────────────────────────────────
// Health check
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/health", (c) => {
  return c.json({ status: "ok" });
});

// ──────────────────────────────────────────
// AUTH: Kayıt ol
// POST /make-server-4da0b637/auth/signup
// Body: { email, password, full_name, phone? }
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/auth/signup", async (c) => {
  try {
    const { email, password, full_name, phone } = await c.req.json();

    if (!email || !password || !full_name) {
      return c.json({ error: "E-posta, şifre ve ad soyad zorunludur." }, 400);
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      user_metadata: {
        full_name: full_name.trim(),
        role: "bekleyen", // Yeni kullanıcılar bekleyen olarak başlar
        phone: phone?.trim() || "",
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
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/auth/me", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) {
      return c.json({ error: "Yetkisiz erişim." }, 401);
    }

    return c.json({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || "",
      role: user.user_metadata?.role || "bekleyen",
      phone: user.user_metadata?.phone || "",
      avatar: user.user_metadata?.avatar || "",
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at,
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

    const { full_name, phone, avatar, email, birth_date } = await c.req.json();
    const supabase = getAdminClient();

    const updatedMetadata: Record<string, string> = {
      ...user.user_metadata,
    };
    if (full_name !== undefined) updatedMetadata.full_name = full_name.trim();
    if (phone !== undefined) updatedMetadata.phone = phone.trim();
    if (avatar !== undefined) updatedMetadata.avatar = avatar;
    if (birth_date !== undefined) updatedMetadata.birth_date = birth_date;

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
    if (!["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    const { userId, role } = await c.req.json();
    const validRoles = ["yonetici", "ust-mudur", "mudur", "operasyon", "personel", "idari", "bekleyen"];
    if (!validRoles.includes(role)) {
      return c.json({ error: "Geçersiz rol." }, 400);
    }

    // Hiyerarşi kontrolü — kendi seviyenizi aşan işlem yapılamaz
    const hierarchy: Record<string, number> = {
      yonetici: 6, "ust-mudur": 5, mudur: 4, operasyon: 3, idari: 2, personel: 1, bekleyen: 0,
    };

    const supabase = getAdminClient();
    const { data: targetData } = await supabase.auth.admin.getUserById(userId);
    if (!targetData?.user) return c.json({ error: "Kullanıcı bulunamadı." }, 404);

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
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    const supabase = getAdminClient();
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error) {
      console.log("List users error:", error.message);
      return c.json({ error: `Kullanıcılar listelenemedi: ${error.message}` }, 400);
    }

    const mappedUsers = users.map((u) => ({
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

// ──────────────────────────────────────────
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
    if (!allowedRoles.includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    const mekanlar = await kv.getByPrefix("mekan_");
    const sorted = mekanlar.sort((a: any, b: any) =>
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
    const { name, emoji, color, photoPrice, yearlyRent, dailyCostPercentage, profitPercentage, paperType, printType, workingHours } = body;

    if (!name?.trim()) {
      return c.json({ error: "Mekan adı zorunludur." }, 400);
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const mekan = {
      id,
      name: name.trim(),
      emoji: emoji || "📍",
      color: color || "#9dd9ea",
      photoPrice: Number(photoPrice) || 0,
      yearlyRent: Number(yearlyRent) || 0,
      dailyCostPercentage: Number(dailyCostPercentage) || 0,
      profitPercentage: Number(profitPercentage) || 0,
      paperType: paperType || "",
      printType: printType || "yarim",
      workingHours: workingHours || { start: "09:00", end: "18:00" },
      kotaKademeleri: Array.isArray(body.kotaKademeleri) ? body.kotaKademeleri : [],
      created_at: new Date().toISOString(),
      created_by: user.id,
    };

    await kv.set(`mekan_${id}`, mekan);
    console.log(`Mekan oluşturuldu: ${name} by ${user.id}`);
    return c.json({ mekan }, 201);
  } catch (err) {
    console.log("Create mekan error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
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

    const { id } = c.req.param();
    const existing = await kv.get(`mekan_${id}`);
    if (!existing) return c.json({ error: "Mekan bulunamadı." }, 404);

    const body = await c.req.json();
    const { name, emoji, color, photoPrice, yearlyRent, dailyCostPercentage, profitPercentage, paperType, printType, workingHours } = body;

    if (!name?.trim()) {
      return c.json({ error: "Mekan adı zorunludur." }, 400);
    }

    const updated = {
      ...existing,
      name: name.trim(),
      emoji: emoji || existing.emoji,
      color: color || existing.color,
      photoPrice: Number(photoPrice) ?? existing.photoPrice,
      yearlyRent: Number(yearlyRent) ?? existing.yearlyRent,
      dailyCostPercentage: Number(dailyCostPercentage) ?? existing.dailyCostPercentage,
      profitPercentage: Number(profitPercentage) ?? existing.profitPercentage,
      paperType: paperType ?? existing.paperType,
      printType: printType ?? existing.printType,
      workingHours: workingHours ?? existing.workingHours,
      kotaKademeleri: Array.isArray(body.kotaKademeleri) ? body.kotaKademeleri : (existing.kotaKademeleri || []),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    await kv.set(`mekan_${id}`, updated);
    console.log(`Mekan güncellendi: ${id} by ${user.id}`);
    return c.json({ mekan: updated });
  } catch (err) {
    console.log("Update mekan error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
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

    const { id } = c.req.param();
    const existing = await kv.get(`mekan_${id}`);
    if (!existing) return c.json({ error: "Mekan bulunamadı." }, 404);

    await kv.del(`mekan_${id}`);
    console.log(`Mekan silindi: ${id} (${existing.name}) by ${user.id}`);
    return c.json({ message: `"${existing.name}" mekanı silindi.` });
  } catch (err) {
    console.log("Delete mekan error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALİYET YÖNETİMİ: Tüm verileri getir
// GET /make-server-4da0b637/maliyetler
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/maliyetler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    // Maliyet okuma: tüm aktif roller erişebilir (personel/operasyon kağıt kapasitesine ihtiyaç duyar)
    const allowedReadRoles = ["yonetici", "ust-mudur", "mudur", "idari", "operasyon", "personel"];
    if (!allowedReadRoles.includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    const exchangeRates = await kv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20, isAuto: false };
    const albums = await kv.get("cost_albums") || [
      { size: 3,  tamBoy: 25, yarimBoy: 20, currency: "TRY" },
      { size: 5,  tamBoy: 35, yarimBoy: 28, currency: "TRY" },
      { size: 7,  tamBoy: 45, yarimBoy: 36, currency: "TRY" },
      { size: 9,  tamBoy: 55, yarimBoy: 44, currency: "TRY" },
      { size: 11, tamBoy: 65, yarimBoy: 52, currency: "TRY" },
      { size: 13, tamBoy: 75, yarimBoy: 60, currency: "TRY" },
      { size: 15, tamBoy: 85, yarimBoy: 68, currency: "TRY" },
    ];
    const papers = await kv.getByPrefix("cost_paper_");
    const recurring = await kv.getByPrefix("cost_recurring_");
    const salaries = await kv.getByPrefix("cost_salary_");

    return c.json({ exchangeRates, albums, papers, recurring, salaries });
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
    // Önce KV cache'e bak (10 dk TTL)
    const cached = await kv.get("live_rates_cache");
    if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt) < 10 * 60 * 1000) {
      return c.json({ rates: cached.rates, source: "cache", fetchedAt: cached.fetchedAt });
    }

    // Canlı çek: USD baz alarak TRY, EUR, GBP (5 sn timeout)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res: Response;
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
    const rates = {
      USD: parseFloat(r.TRY.toFixed(4)),
      EUR: parseFloat((r.TRY / r.EUR).toFixed(4)),
      GBP: parseFloat((r.TRY / r.GBP).toFixed(4)),
    };

    // Trend hesapla: önceki cache ile karşılaştır
    let trend: { USD: number; EUR: number; GBP: number } | null = null;
    if (cached?.rates) {
      trend = {
        USD: parseFloat(((rates.USD - cached.rates.USD) / cached.rates.USD * 100).toFixed(3)),
        EUR: parseFloat(((rates.EUR - cached.rates.EUR) / cached.rates.EUR * 100).toFixed(3)),
        GBP: parseFloat(((rates.GBP - cached.rates.GBP) / cached.rates.GBP * 100).toFixed(3)),
      };
    } else {
      const prev = await kv.get("live_rates_prev_day");
      if (prev?.rates) {
        trend = {
          USD: parseFloat(((rates.USD - prev.rates.USD) / prev.rates.USD * 100).toFixed(3)),
          EUR: parseFloat(((rates.EUR - prev.rates.EUR) / prev.rates.EUR * 100).toFixed(3)),
          GBP: parseFloat(((rates.GBP - prev.rates.GBP) / prev.rates.GBP * 100).toFixed(3)),
        };
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
    const manual = await kv.get("cost_exchange_rates");
    if (manual) {
      return c.json({ rates: { USD: Number(manual.USD), EUR: Number(manual.EUR), GBP: Number(manual.GBP) }, trend: null, source: "manual" });
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
    await kv.set("cost_exchange_rates", body);
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
    await kv.set("cost_albums", albums);
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
    const paper = { ...body, id };
    await kv.set(`cost_paper_${id}`, paper);
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
    const existing = await kv.get(`cost_paper_${id}`);
    if (!existing) return c.json({ error: "Kağıt bulunamadı." }, 404);
    const body = await c.req.json();
    const paper = { ...existing, ...body, id };
    await kv.set(`cost_paper_${id}`, paper);
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
    await kv.del(`cost_paper_${id}`);
    return c.json({ message: "Kağıt silindi." });
  } catch (err) {
    console.log("Delete kagit error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// MALİYET: Düzenli gider ekle/güncelle/sil
// ──────────────────────────────────────────
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
    const gider = { ...body, id };
    await kv.set(`cost_recurring_${id}`, gider);
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
    const existing = await kv.get(`cost_recurring_${id}`);
    if (!existing) return c.json({ error: "Gider bulunamadı." }, 404);
    const body = await c.req.json();
    const gider = { ...existing, ...body, id };
    await kv.set(`cost_recurring_${id}`, gider);
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
    await kv.del(`cost_recurring_${id}`);
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
    const maas = { ...body, id };
    await kv.set(`cost_salary_${id}`, maas);
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
    const existing = await kv.get(`cost_salary_${id}`);
    if (!existing) return c.json({ error: "Maaş bulunamadı." }, 404);
    const body = await c.req.json();
    const maas = { ...existing, ...body, id };
    await kv.set(`cost_salary_${id}`, maas);
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
    await kv.del(`cost_salary_${id}`);
    return c.json({ message: "Maaş silindi." });
  } catch (err) {
    console.log("Delete maas error:", err);
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
    if (callerRole === "bekleyen" || callerRole === "personel") {
      return c.json({ error: "Bu sayfaya erişim yetkiniz yok." }, 403);
    }
    const tumGiderler: any[] = await kv.getByPrefix("isletme_gider_") || [];
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
    await kv.set(`isletme_gider_${id}`, gider);
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
    const existing = await kv.get(`isletme_gider_${id}`);
    if (!existing) return c.json({ error: "Gider bulunamadı." }, 404);
    const body = await c.req.json();
    const gider = { ...existing, ...body, id };
    await kv.set(`isletme_gider_${id}`, gider);
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
    await kv.del(`isletme_gider_${id}`);
    return c.json({ message: "Gider silindi." });
  } catch (err) {
    console.log("Delete isletme gider error:", err);
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
    const all: any[] = await kv.getByPrefix("mekan_ziyaret_") || [];
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
    await kv.set(`mekan_ziyaret_${id}`, ziyaret);
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
    const existing = await kv.get(`mekan_ziyaret_${id}`);
    if (!existing) return c.json({ error: "Ziyaret bulunamadı." }, 404);
    const body = await c.req.json();
    const ziyaret = { ...existing, ...body, id };
    await kv.set(`mekan_ziyaret_${id}`, ziyaret);
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
    await kv.del(`mekan_ziyaret_${id}`);
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
    const all: any[] = await kv.getByPrefix("personel_gorusme_") || [];
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
    await kv.set(`personel_gorusme_${id}`, gorusme);
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
    const existing = await kv.get(`personel_gorusme_${id}`);
    if (!existing) return c.json({ error: "Görüşme bulunamadı." }, 404);
    const body = await c.req.json();
    await kv.set(`personel_gorusme_${id}`, { ...existing, ...body, id });
    return c.json({ gorusme: { ...existing, ...body, id } });
  } catch (err) { console.log("Update gorusme error:", err); return c.json({ error: `Sunucu hatası: ${err}` }, 500); }
});
app.delete("/make-server-4da0b637/gorusmeler/:id", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const { id } = c.req.param();
    await kv.del(`personel_gorusme_${id}`);
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
    const all: any[] = await kv.getByPrefix("mudur_rapor_") || [];
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
    await kv.set(`mudur_rapor_${id}`, rapor);
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
    const existing = await kv.get(`mudur_rapor_${id}`);
    if (!existing) return c.json({ error: "Rapor bulunamadı." }, 404);
    const body = await c.req.json();
    await kv.set(`mudur_rapor_${id}`, { ...existing, ...body, id });
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
    await kv.del(`mudur_rapor_${id}`);
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

    const staffMembers = users
      .filter(u => u.user_metadata?.role && u.user_metadata.role !== 'bekleyen')
      .map(u => ({
        id: u.id,
        name: u.user_metadata?.full_name || u.email || 'İsimsiz',
        avatar: roleAvatars[u.user_metadata?.role as string] || '👤',
        role: u.user_metadata?.role || 'personel',
        status: 'active',
      }));

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
    const tasks = await kv.getByPrefix("rotation_task_");
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
    await kv.set(`rotation_task_${body.id}`, task);
    console.log(`Görev oluşturuldu: ${body.id} by ${user.id}`);
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
    const existing = await kv.get(`rotation_task_${id}`);
    if (!existing) return c.json({ error: "Görev bulunamadı." }, 404);
    const body = await c.req.json();
    const task = { ...existing, ...body };
    await kv.set(`rotation_task_${id}`, task);
    console.log(`Görev güncellendi: ${id} by ${user.id}`);
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
    await kv.del(`rotation_task_${id}`);
    console.log(`Görev silindi: ${id} by ${user.id}`);
    return c.json({ message: "Görev silindi." });
  } catch (err) {
    console.log("Delete gorev error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// ROTASYON: İzin Talepleri CRUD
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/rotasyon/izinler", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const callerRole = user.user_metadata?.role;
    if (callerRole === "bekleyen") return c.json({ error: "Yetki yok." }, 403);
    const leaveRequests = await kv.getByPrefix("rotation_leave_");
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
    const leave = { ...body, created_by: user.id };
    await kv.set(`rotation_leave_${body.id}`, leave);
    console.log(`İzin talebi oluşturuldu: ${body.id} by ${user.id}`);
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
    const existing = await kv.get(`rotation_leave_${id}`);
    if (!existing) return c.json({ error: "İzin talebi bulunamadı." }, 404);
    const body = await c.req.json();
    const leave = { ...existing, ...body };
    await kv.set(`rotation_leave_${id}`, leave);
    console.log(`İzin güncellendi: ${id} by ${user.id}`);
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
    await kv.del(`rotation_leave_${id}`);
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
    const dailyOnLeave = await kv.get("rotation_daily_onleave") || {};
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
    await kv.set("rotation_daily_onleave", body.dailyOnLeave);
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

    const { mekanId, tarih } = c.req.param();
    const bugunRaw = await kv.get(`stok_gunluk_${mekanId}_${tarih}`);

    // ── Baskı maliyeti kur düzeltmesi ──
    // Eski kayıtlarda toplamMaliyet yabancı para birimi cinsinden TL gibi kaydedilmiş olabilir.
    // GET sırasında on-the-fly kur uygulanarak doğru TL değeri hesaplanır.
    let bugun = bugunRaw;
    if (bugunRaw?.vardiyaToplam) {
      const vt = bugunRaw.vardiyaToplam;
      const paperCur: string = vt.paperCurrency || vt.currency || "TRY";
      // Eğer kur dönüşümü daha önce yapılmamışsa (kurCarpani eksikse veya 1'se)
      const kurZatenUygulanmis = !!vt.kurCarpani && vt.kurCarpani !== 1;
      if (paperCur !== "TRY" && !kurZatenUygulanmis) {
        const exRates = await kv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20 };
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
      kv.get(`stok_gunluk_${mekanId}_${dunStr}`).catch(() => null),
      kv.getByPrefix(`stok_ekleme_`).catch(() => []),
      kv.getByPrefix(`stok_aktarim_`).catch(() => []),
      kv.getByPrefix(`ekipman_`).catch(() => []),
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
          gunStrler.map(gStr => kv.get(`stok_gunluk_${mekanId}_${gStr}`).catch(() => null))
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
const checkRotasyonYetkisi = async (userId: string, role: string, mekanId: string, tarih: string): Promise<boolean> => {
  // SADECE yonetici rotasyonu bypass eder
  if (role === "yonetici") return true;
  // Diğer herkes (ust-mudur, mudur, operasyon, personel, idari vb.) rotasyona tabi

  // Mekana ait lokasyon adını al
  const mekan: any = await kv.get(`mekan_${mekanId}`);
  if (!mekan) return false;
  const mekanAdi: string = mekan.name || "";

  // Bugüne ait rotasyon görevlerini tara
  const tasks: any[] = await kv.getByPrefix("rotation_task_") || [];
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

    const { mekanId, tarih, sayim, not: acilisNot, printerData } = await c.req.json();
    if (!mekanId || !tarih || !sayim) {
      return c.json({ error: "mekanId, tarih ve sayim zorunludur." }, 400);
    }

    // Rotasyon yetkisi kontrolü
    const yetkili = await checkRotasyonYetkisi(user.id, callerRole, mekanId, tarih);
    if (!yetkili) {
      console.log(`Rotasyon yetki reddi — acilis: user=${user.id}, role=${callerRole}, mekan=${mekanId}, tarih=${tarih}`);
      return c.json({ error: "Bu mekana bugünkü rotasyonunuzda atanmamışsınız. Açılış yapma yetkiniz yok." }, 403);
    }

    const dunTarih = new Date(tarih);
    dunTarih.setDate(dunTarih.getDate() - 1);
    const dunStr = dunTarih.toISOString().split("T")[0];
    const dun = await kv.get(`stok_gunluk_${mekanId}_${dunStr}`);
    const dunKapanis = dun?.kapanish || null;

    const anomali: Record<string, number> = {};
    if (dunKapanis) {
      const alanlar = ["album3","album5","album7","album9","album11","album13","album15","paspartu","ribon"];
      for (const alan of alanlar) {
        const fark = (sayim[alan] || 0) - (dunKapanis[alan] || 0);
        if (fark !== 0) anomali[alan] = fark;
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
        const ekipman: any = await kv.get(pr.ekipmanId);
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

    const existing = await kv.get(`stok_gunluk_${mekanId}_${tarih}`) || {};
    const kayit = {
      ...existing,
      mekanId,
      tarih,
      acilis: sayim,
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

    await kv.set(`stok_gunluk_${mekanId}_${tarih}`, kayit);
    console.log(`Stok açılışı: ${mekanId} / ${tarih} by ${user.id} | ${printerData?.length || 0} yazıcı | ${printerAnomali.length} yazıcı anomali`);
    return c.json({ kayit, anomali, printerAnomali });
  } catch (err) {
    console.log("Post stok acilis error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
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

    const { mekanId, tarih, sayim, not: kapanisNot, printerData } = await c.req.json();
    if (!mekanId || !tarih || !sayim) {
      return c.json({ error: "mekanId, tarih ve sayim zorunludur." }, 400);
    }

    // Rotasyon yetkisi kontrolü
    const yetkiliKapanis = await checkRotasyonYetkisi(user.id, callerRole, mekanId, tarih);
    if (!yetkiliKapanis) {
      console.log(`Rotasyon yetki reddi — kapanis: user=${user.id}, role=${callerRole}, mekan=${mekanId}, tarih=${tarih}`);
      return c.json({ error: "Bu mekana bugünkü rotasyonunuzda atanmamışsınız. Kapanış yapma yetkiniz yok." }, 403);
    }

    const existing = await kv.get(`stok_gunluk_${mekanId}_${tarih}`);
    if (!existing) return c.json({ error: "Önce açılış kaydı yapılmalıdır." }, 400);

    // Paralel KV okuma
    const [tumEklemelerKapRaw, tumAktarimlarKapRaw] = await Promise.all([
      kv.getByPrefix(`stok_ekleme_`).catch(() => []),
      kv.getByPrefix(`stok_aktarim_`).catch(() => []),
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

    const alanlar = ["album3","album5","album7","album9","album11","album13","album15","paspartu","ribon"];

    // Günlük iptal olmayan satışlardan albüm stok düşümü
    // Ürün adından sayı çıkarılır: "3'lü" → album3, "13'lü" → album13
    // "1 Fotoğraf" ve "Paspartu" stok alanıyla ilişkili değil, atlanır
    const satislar: any[] = existing.satislar || [];
    const satisAlbumDusum: Record<string, number> = {};
    for (const satis of satislar) {
      if (satis.iptal) continue;
      for (const item of (satis.items || [])) {
        const match = String(item.product || '').match(/^(\d+)/);
        if (match) {
          const alan = `album${match[1]}`;
          if (alanlar.includes(alan)) {
            satisAlbumDusum[alan] = (satisAlbumDusum[alan] || 0) + (Number(item.quantity) || 0);
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
      // Satışlardan albüm düşümü (album3..album15; paspartu ve ribon etkilenmez)
      toplam -= satisAlbumDusum[alan] || 0;
      // Ribon: yazıcılarda değiştirilen takım adedi beklenen stoktan düşülür
      if (alan === "ribon") toplam -= toplamRibonDegisim;
      beklenen[alan] = Math.max(0, toplam);
    }

    const anomali: Record<string, number> = {};
    for (const alan of alanlar) {
      const fark = (sayim[alan] || 0) - (beklenen[alan] || 0);
      if (fark !== 0) anomali[alan] = fark;
    }

    // ── Vardiya Baskı & Maliyet Hesaplamaları ──
    const mekan = await kv.get(`mekan_${mekanId}`);
    const printType: string = mekan?.printType || "yarim"; // "tam" | "yarim"
    const paperTypeId: string | null = mekan?.paperType || null;

    let paper: any = null;
    if (paperTypeId) {
      paper = await kv.get(`cost_paper_${paperTypeId}`);
    }

    const kapasitePerTakim = paper
      ? (Number(paper.pcsPerBox) / Number(paper.setsPerBox))
      : 0;

    // Kur dönüşümü: kağıt para birimi → TL
    const exchangeRates = await kv.get("cost_exchange_rates") || { EUR: 35.50, USD: 32.80, GBP: 41.20 };
    const paperCurrency: string = paper?.currency || "TRY";
    const kurCarpani = paperCurrency === "TRY" ? 1
      : paperCurrency === "EUR" ? Number(exchangeRates.EUR) || 35.50
      : paperCurrency === "USD" ? Number(exchangeRates.USD) || 32.80
      : paperCurrency === "GBP" ? Number(exchangeRates.GBP) || 41.20
      : 1;

    // birimMaliyet TL cinsinden: (boxPrice / pcsPerBox) × kur
    const birimMaliyetTam = paper
      ? (Number(paper.boxPrice) / Number(paper.pcsPerBox)) * kurCarpani
      : 0;
    // carpan: yarım kağıtta 1 baskı → 2 fotoğraf çıkışı
    const carpan = printType === "tam" ? 1 : 2;

    // Her yazıcı için hesapla
    const enrichedPrinterData = (printerData || []).map((pr: any) => {
      const acilisSayac = Number(pr.startCounter) || 0;
      const kapanisSayac = Number(pr.endCounter) || 0;
      const degisimAdedi = Number(pr.ribonDegisim) || 0;
      const iadeFotograf = Number(pr.iadeFotograf) || 0;

      // kullanilanBaskı: açılış + (değişim × kapasite) - kapanış
      const kullanilanBaskı = Math.max(
        0, acilisSayac + (degisimAdedi * kapasitePerTakim) - kapanisSayac
      );
      // stokDusum: fiziksel kağıt düşümü — tam/yarım fark etmez
      const stokDusum = kullanilanBaskı;
      // cikisAdedi: müşteriye çıkan fotoğraf adedi (istatistik)
      const cikisAdedi = Math.round(kullanilanBaskı * carpan);
      // satılanFotograf: iade çıkarılınca net satış
      const satılanFotograf = Math.max(0, cikisAdedi - iadeFotograf);
      // toplamMaliyet: kullanilanBaskı × birimMaliyetTam(TL) — kur dönüşümü dahil, tam/yarım fark etmez
      const toplamMaliyet = birimMaliyetTam > 0
        ? parseFloat((kullanilanBaskı * birimMaliyetTam).toFixed(4))
        : 0;

      return {
        ...pr,
        iadeFotograf,
        kullanilanBaskı,
        stokDusum,
        cikisAdedi,
        satılanFotograf,
        toplamMaliyet,
      };
    });

    // Vardiya genel toplamları
    const vardiyaToplam = {
      toplamKullanilanBaskı: enrichedPrinterData.reduce((s: number, p: any) => s + (p.kullanilanBaskı || 0), 0),
      toplamStokDusum: enrichedPrinterData.reduce((s: number, p: any) => s + (p.stokDusum || 0), 0),
      toplamCikisAdedi: enrichedPrinterData.reduce((s: number, p: any) => s + (p.cikisAdedi || 0), 0),
      toplamIadeFotograf: enrichedPrinterData.reduce((s: number, p: any) => s + (p.iadeFotograf || 0), 0),
      toplamSatılanFotograf: enrichedPrinterData.reduce((s: number, p: any) => s + (p.satılanFotograf || 0), 0),
      toplamMaliyet: parseFloat(
        enrichedPrinterData.reduce((s: number, p: any) => s + (p.toplamMaliyet || 0), 0).toFixed(4)
      ),
      printType,
      carpan,
      paperName: paper?.name || null,
      paperCurrency,
      kurCarpani: parseFloat(kurCarpani.toFixed(4)),
      birimMaliyetOrijinal: paper ? parseFloat((Number(paper.boxPrice) / Number(paper.pcsPerBox)).toFixed(6)) : 0,
      birimMaliyet: birimMaliyetTam > 0 ? parseFloat(birimMaliyetTam.toFixed(4)) : 0,
      currency: "TRY",
    };

    // ── Bitiş Sayacı Anomali Tespiti ─────────────────────────────────────────
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
      kapanish: sayim,
      kapanisNot: kapanisNot || "",
      kapanisYapildi: true,
      kapanisZamani: new Date().toISOString(),
      kapanisYapanId: user.id,
      kapanisYapanAd: user.user_metadata?.full_name || user.email,
      kapanisAnomali: anomali,
      kapanisBeklenen: beklenen,
      // Yazıcı verileri — hesaplamalar dahil
      printerData: enrichedPrinterData,
      toplamRibonDegisim,
      // Vardiya baskı & maliyet özeti
      vardiyaToplam,
      // Bitiş sayacı anomalisi (yazıcı net satılan vs satış toplamı)
      kapanisYaziciAnomali: kapanisYaziciAnomali || null,
    };

    await kv.set(`stok_gunluk_${mekanId}_${tarih}`, kayit);

    // ── Her yazıcının endCounter'ını ekipman ribonMevcut olarak kaydet ──────
    for (const pr of enrichedPrinterData) {
      const eid = pr.ekipmanId || pr.id;
      if (!eid || pr.endCounter === undefined || pr.endCounter === null) continue;
      try {
        const ekipman: any = await kv.get(eid);
        if (ekipman) {
          await kv.set(eid, {
            ...ekipman,
            ribonMevcut: Number(pr.endCounter),
          });
        }
      } catch (e) {
        console.log(`Yazıcı ${eid} ekipman kaydı güncellenemedi:`, e);
      }
    }

    console.log(`Stok kapanışı: ${mekanId} / ${tarih} by ${user.id} | baskı: ${vardiyaToplam.toplamKullanilanBaskı} | satılan: ${vardiyaToplam.toplamSatılanFotograf} | maliyet: ${vardiyaToplam.toplamMaliyet} ${vardiyaToplam.currency} | bitisAnomali: ${kapanisYaziciAnomali ? `fark=${kapanisYaziciAnomali.fark}` : 'yok'}`);
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

    const kvKey = `stok_gunluk_${mekanId}_${tarih}`;
    const existing: any = await kv.get(kvKey);

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

    await kv.set(kvKey, yeniKayit);
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

    await kv.set(`stok_ekleme_${id}`, ekleme);
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

    await kv.set(`stok_aktarim_${id}`, aktarim);
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
    const existing = await kv.get(`stok_aktarim_${id}`);
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

    await kv.set(`stok_aktarim_${id}`, updated);
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
    const existing = await kv.get(`stok_aktarim_${id}`);
    if (!existing) return c.json({ error: "Aktarım bulunamadı." }, 404);
    if (existing.durum !== "bekliyor") return c.json({ error: "Bu aktarım zaten işlendi." }, 400);

    const updated = {
      ...existing,
      durum: "iptal",
      iptalZamani: new Date().toISOString(),
      iptalEdenId: user.id,
    };
    await kv.set(`stok_aktarim_${id}`, updated);
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
    const tumAktarimlar = await kv.getByPrefix(`stok_aktarim_`);
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

    // Frontend bugunTarih() ile aynı format: UTC tabanlı YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];

    // Tüm mekanları çek → id→mekan map
    const mekanlarList = await kv.getByPrefix("mekan_");
    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) {
      mekanMap[m.id] = m;
    }

    // Bugünkü tüm stok kayıtlarını çek
    const tumKayitlar = await kv.getByPrefix("stok_gunluk_");
    const bugunKayitlar = (tumKayitlar || []).filter((k: any) => k.tarih === today);

    // Satış + Kare kayıtlarını unified feed'e topla
    const feed: any[] = [];
    for (const kayit of bugunKayitlar) {
      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍", color: "#9dd9ea" };

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

    console.log(`Canlı feed: ${today} — ${tumSatislar.length} satış, ${tumKareler.length} kare, ${bugunKayitlar.length} mekan`);
    return c.json({ feed, satislar: tumSatislar, kareler: tumKareler, mekanlar: mekanlarList || [] });
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
    if (!["yonetici", "ust-mudur", "mudur"].includes(callerRole)) {
      return c.json({ error: "Yetki yok." }, 403);
    }

    const today = new Date().toISOString().split("T")[0];

    // Mekan haritası
    const mekanlarList = await kv.getByPrefix("mekan_");
    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) {
      mekanMap[m.id] = m;
    }

    // Bugünkü stok kayıtları
    const tumKayitlar = await kv.getByPrefix("stok_gunluk_");
    const bugunKayitlar = (tumKayitlar || []).filter((k: any) => k.tarih === today);

    let toplamCiro = 0;
    let toplamAdet = 0;
    let toplamKare = 0;
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

      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      let mekanCiro = 0;
      let mekanAdet = 0;

      for (const s of satislar) {
        const finalPrice = s.finalPrice || 0;
        const adet = (s.items || []).reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 1;
        mekanCiro += finalPrice;
        mekanAdet += adet;

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

    // ── Albüm dağılımı ──────────────────────────────────────────────────────
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

    // ── Personel bazlı performans sıralaması ─────────────────────────────────
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

    console.log(`Manager dashboard: ${today} — ciro:${toplamCiro} adet:${toplamAdet} kare:${toplamKare} anomali:${anomaliSayisi} personel:${personelPerformans.length}`);

    return c.json({
      tarih: today,
      toplamCiro: Math.round(toplamCiro),
      toplamAdet,
      toplamKare,
      anomaliSayisi,
      aktifMekanSayisi: aktifMekanlar.length,
      toplamMekanSayisi: bugunKayitlar.length,
      aktifMekanlar,
      saatlikData: saatlikArray,
      albumDagilimi,
      mekanCiroList,
      personelPerformans,
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

    // Tüm mekanları çek
    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];
    const mekanMap: Record<string, any> = {};
    for (const m of mekanlarList) mekanMap[m.id] = m;

    // O aya ait tüm stok kayıtlarını çek
    const tumKayitlar: any[] = await kv.getByPrefix("stok_gunluk_") || [];
    const ayKayitlari = tumKayitlar.filter((k: any) => {
      if (!k.tarih) return false;
      const [ky, ka] = k.tarih.split("-").map(Number);
      return ky === yil && ka === ayNo;
    });

    // Ödendi kayıtlarını çek — key, odendi ve odemeTarihi saklanıyor
    const odemePrefix = `prim_odendi_`;
    const tumOdemeler: any[] = await kv.getByPrefix(odemePrefix) || [];
    const odemeMap: Record<string, { odendi: boolean; odemeTarihi?: string }> = {};
    for (const o of tumOdemeler) {
      if (o.key) odemeMap[o.key] = { odendi: o.odendi || false, odemeTarihi: o.odemeTarihi };
    }

    // Tüm rotasyon görevlerini çek — personeli buradan alacağız
    const tumRotasyonlar: any[] = await kv.getByPrefix("rotation_task_") || [];

    // Her gün × her mekan × her kademe × her personel için AYRI prim kaydı
    const primKayitlari: any[] = [];

    for (const kayit of ayKayitlari) {
      const mekan = mekanMap[kayit.mekanId];
      if (!mekan || !mekan.kotaKademeleri || mekan.kotaKademeleri.length === 0) continue;

      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const ciro = satislar.reduce((sum: number, s: any) => sum + (s.finalPrice || 0), 0);

      // Personel listesi: o gün o mekana atanmış rotasyon personeli (id → ad Map ile tekilleştir)
      const mekanAdi: string = mekan.name || "";
      const rotasyonPersonelMap = new Map<string, string>(); // id → ad

      for (const task of tumRotasyonlar) {
        if (task.date !== kayit.tarih) continue;
        if (!["sent", "revised"].includes(task.status)) continue;
        if (task.location !== mekanAdi) continue;
        if (!Array.isArray(task.personnel)) continue;
        for (const p of task.personnel) {
          if (p.id && p.name) rotasyonPersonelMap.set(p.id, p.name);
        }
      }

      const fotografcilar: string[] = rotasyonPersonelMap.size > 0
        ? Array.from(rotasyonPersonelMap.values())
        : ["Bilinmiyor"];

      const personelSayisi = fotografcilar.length;
      const coklu = personelSayisi > 1;

      // Kademeleri hedef'e göre sırala — ki indeksi görsel sırayla eşleşsin
      const sortedKademeler = [...mekan.kotaKademeleri].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));

      for (let ki = 0; ki < sortedKademeler.length; ki++) {
        const kademe = sortedKademeler[ki];
        if (ciro >= Number(kademe.hedef)) {
          const primMiktar = (coklu ? Number(kademe.primCoklu) : Number(kademe.primTek)) || 0;

          // Her personel için ayrı kayıt
          for (const personelAdi of fotografcilar) {
            const safeAd = encodeURIComponent(personelAdi);
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
              personelAdi,
              personelSayisi,
              coklu,
              odendi: odemeData?.odendi || false,
              odemeTarihi: odemeData?.odemeTarihi || null,
              odemeKey,
            });
          }
        }
      }
    }

    // Özet: her kayıt tek kişinin primini tutuyor
    const toplamPrim = primKayitlari.reduce((s, p) => s + p.primMiktar, 0);
    const odenenPrim = primKayitlari.filter(p => p.odendi).reduce((s, p) => s + p.primMiktar, 0);
    const bekleyenPrim = toplamPrim - odenenPrim;

    console.log(`Prim raporu ${ay}: ${primKayitlari.length} kişi-kademe kaydı, toplam ₺${toplamPrim}`);
    return c.json({ ay, primKayitlari, toplamPrim, odenenPrim, bekleyenPrim });
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

    // Paralel veri çekimi
    const [mekanlarList, tumKayitlar, tumOdemeler, tumRotasyonlar] = await Promise.all([
      kv.getByPrefix("mekan_").catch(() => []),
      kv.getByPrefix("stok_gunluk_").catch(() => []),
      kv.getByPrefix("prim_odendi_").catch(() => []),
      kv.getByPrefix("rotation_task_").catch(() => []),
    ]);

    const mekanMap: Record<string, any> = {};
    for (const m of (mekanlarList || [])) mekanMap[m.id] = m;

    const odemeMap: Record<string, { odendi: boolean; odemeTarihi?: string }> = {};
    for (const o of (tumOdemeler || [])) {
      if (o.key) odemeMap[o.key] = { odendi: o.odendi || false, odemeTarihi: o.odemeTarihi };
    }

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
      const rotasyonPersonelMap = new Map<string, string>();
      for (const task of (tumRotasyonlar || [])) {
        if (task.date !== kayit.tarih) continue;
        if (!["sent", "revised"].includes(task.status)) continue;
        if (task.location !== mekanAdi) continue;
        if (!Array.isArray(task.personnel)) continue;
        for (const p of task.personnel) {
          if (p.id && p.name) rotasyonPersonelMap.set(p.id, p.name);
        }
      }

      // Çağıran kişi bu mekana o gün atanmış mı?
      const personelListesi = Array.from(rotasyonPersonelMap.values());
      const buradaVar = personelListesi.some(
        (ad) => ad.toLowerCase().trim() === callerAdi.toLowerCase().trim()
      );
      if (!buradaVar) continue;

      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const ciro = satislar.reduce((sum: number, s: any) => sum + (s.finalPrice || 0), 0);
      const personelSayisi = personelListesi.length;
      const coklu = personelSayisi > 1;

      const sortedKademeler = [...mekan.kotaKademeleri].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));

      for (let ki = 0; ki < sortedKademeler.length; ki++) {
        const kademe = sortedKademeler[ki];
        if (ciro >= Number(kademe.hedef)) {
          const primMiktar = (coklu ? Number(kademe.primCoklu) : Number(kademe.primTek)) || 0;
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
            personelSayisi,
            coklu,
            odendi: odemeData?.odendi || false,
            odemeTarihi: odemeData?.odemeTarihi || null,
            odemeKey,
          });
        }
      }
    }

    primKayitlari.sort((a, b) => b.tarih.localeCompare(a.tarih) || a.kademeIndex - b.kademeIndex);

    const toplamPrim = primKayitlari.reduce((s, p) => s + p.primMiktar, 0);
    const odenenPrim = primKayitlari.filter((p) => p.odendi).reduce((s, p) => s + p.primMiktar, 0);
    const bekleyenPrim = toplamPrim - odenenPrim;

    console.log(`Kendi prim raporu ${ay} / ${callerAdi}: ${primKayitlari.length} kayıt, ₺${toplamPrim}`);
    return c.json({ ay, callerAdi, primKayitlari, toplamPrim, odenenPrim, bekleyenPrim });
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

    // Bugünün tarihi (TR timezone)
    const now = new Date();
    const istanbulOffset = 3 * 60;
    const localMs = now.getTime() + (now.getTimezoneOffset() + istanbulOffset) * 60000;
    const localDate = new Date(localMs);
    const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;

    // Tüm mekanları al, ada göre bul
    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];
    const mekan = mekanlarList.find((m: any) =>
      (m.name || "").toLowerCase().trim() === mekanAdi.toLowerCase().trim()
    );
    if (!mekan) return c.json({ primBilgi: null, sebep: "Mekan bulunamadı." });

    const kotaKademeleriRaw: any[] = mekan.kotaKademeleri || [];
    if (kotaKademeleriRaw.length === 0) return c.json({ primBilgi: null, sebep: "Bu mekanda kota tanımlı değil." });

    // Kademeleri hedef'e göre sırala (backend'de tutarlı sıralama)
    const kotaKademeleri = [...kotaKademeleriRaw].sort((a: any, b: any) => Number(a.hedef) - Number(b.hedef));

    // Bugünkü stok kaydını al
    const stokKey = `stok_gunluk_${mekan.id}_${today}`;
    const kayit: any = await kv.get(stokKey);
    if (!kayit) return c.json({ primBilgi: null, sebep: "Bugün için stok kaydı bulunamadı." });

    const satislar: any[] = (kayit.satislar || []).filter((s: any) => !s.iptal);
    const ciro = Math.round(satislar.reduce((sum: number, s: any) => sum + (Number(s.finalPrice) || 0), 0));

    // Personel sayısı
    const fotografcilar = new Set((kayit.kareKayitlari || []).map((k: any) => k.photographerName).filter(Boolean));
    const personelSayisi = fotografcilar.size || 1;
    const coklu = personelSayisi > 1;

    // Sıralı dizi üzerinden geçilen kademeler (index = sıralı pozisyon)
    const gecilenKademeler = kotaKademeleri
      .map((k: any, i: number) => ({ ...k, index: i }))
      .filter((k: any) => ciro >= Number(k.hedef));

    const kotaKademeOzet = kotaKademeleri.map((k: any) => ({
      hedef: Number(k.hedef),
      primTek: Number(k.primTek) || 0,
      primCoklu: Number(k.primCoklu) || 0,
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
    const toplamPrim = gecilenKademeler.reduce((s: number, k: any) => s + ((coklu ? Number(k.primCoklu) : Number(k.primTek)) || 0), 0);

    return c.json({
      primBilgi: {
        kademeIndex: topKademe.index,
        kademeHedef: Number(topKademe.hedef),
        topKademePrim: (coklu ? Number(topKademe.primCoklu) : Number(topKademe.primTek)) || 0,
        toplamPrim,
        toplamKademe: gecilenKademeler.length,
        toplamKademeAdet: kotaKademeleri.length,
        personelSayisi,
        coklu,
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
      return c.json({ error: "Prim ödeme yetkisi yalnızca Yönetici / Üst Müdür rolüne aittir." }, 403);
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
    let tumGiderler: any[] = [];
    if (!odendiMi) {
      tumGiderler = await kv.getByPrefix("isletme_gider_").catch(() => []) || [];
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
      await kv.set(key, record);
      results.push(key);

      if (odendiMi && detay) {
        // Ödeme → otomatik işletme gider kalemi oluştur
        const kademeLabel = `${(detay.kademeIndex ?? 0) + 1}. Kademe`;
        const giderId = `prim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const gider = {
          id: giderId,
          category: "personel",
          odemeTipi: "prim",
          amount: detay.primMiktar || 0,
          currency: "TRY",
          description: `Personel Prim Ödemesi — ${detay.personelAdi || "Bilinmiyor"} — ${detay.mekanAdi || ""} ${detay.tarih || todayStr} ${kademeLabel}`,
          date: detay.tarih || todayStr,
          personelAdi: detay.personelAdi,
          mekanAdi: detay.mekanAdi,
          primKey: key,
          created_at: now,
          created_by: user.email || user.id,
        };
        await kv.set(`isletme_gider_${giderId}`, gider);
        giderSayisi++;
      } else if (!odendiMi) {
        // İptal → bu prime ait işletme gider kaydını/kayıtlarını sil
        const eslesen = tumGiderler.filter((g: any) => g.primKey === key);
        for (const g of eslesen) {
          await kv.del(`isletme_gider_${g.id}`);
          giderSilinen++;
        }
      }
    }

    console.log(`Prim ödeme: ${results.length} kayıt ${odendiMi ? "ödendi" : "geri alındı"}, ${giderSayisi} gider oluşturuldu, ${giderSilinen} gider silindi — by ${user.email}`);
    return c.json({ success: true, guncellenen: results.length, giderOlusturulan: giderSayisi, giderSilinen });
  } catch (err) {
    console.log("Prim ode error:", err);
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
    const tumKayitlar = await kv.getByPrefix(`stok_gunluk_${mekanId}_`);
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

// ══════════════════════════════════════════
// DUYURULAR
// ══════════════════════════════════════════

// GET /make-server-4da0b637/announcements
app.get("/make-server-4da0b637/announcements", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const all = await kv.getByPrefix("announcement_");
    const now = new Date();

    const active = (all || []).filter((a: any) => {
      if (a.type === "temporary" && a.endDate) {
        return new Date(a.endDate) >= now;
      }
      return true;
    });

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

    await kv.set(`announcement_${id}`, announcement);
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
    const existing = await kv.get(`announcement_${id}`);
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

    await kv.set(`announcement_${id}`, updated);
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
    await kv.del(`announcement_${id}`);
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

    const today = new Date().toISOString().split("T")[0];
    const RIBON_PER_TAKIM = 200; // 1 takım = 200 baskı

    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];
    const tumKayitlar: any[] = await kv.getByPrefix("stok_gunluk_") || [];
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

    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15","paspartu","ribon"];
    const albumEtiketleri: Record<string, string> = {
      album3:"3 Kare", album5:"5 Kare", album7:"7 Kare",
      album9:"9 Kare", album11:"11 Kare", album13:"13 Kare",
      album15:"15 Kare", paspartu:"Paspartu", ribon:"Ribon",
    };
    const albumRenkleri: Record<string, string> = {
      album3:"#9dd9ea", album5:"#a8e6cf", album7:"#ffd4a3",
      album9:"#ffb3ba", album11:"#d4a5ff", album13:"#b8d4f1",
      album15:"#ffc78f", paspartu:"#e2e8f0", ribon:"#f9a8d4",
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

      const albumSayilari: Record<string, number> = {};
      for (const alan of albumAlanlari) {
        albumSayilari[alan] = stok ? (Number(stok[alan]) || 0) : 0;
      }

      // Stoktaki takımlar × 200
      const stokRibonAdet = albumSayilari["ribon"] * RIBON_PER_TAKIM;

      // Makinaların içindeki kalan baskı (kapanış sayacı = makinada kalan baskı adedi)
      let makinaKalan = 0;
      if (kayit?.printerData && Array.isArray(kayit.printerData)) {
        for (const pr of kayit.printerData) {
          makinaKalan += Math.max(0, Number(pr.endCounter) || 0);
        }
      }

      const toplamRibonKapasite = stokRibonAdet + makinaKalan;

      return {
        id: mekan.id,
        name: mekan.name,
        emoji: mekan.emoji || "📍",
        color: mekan.color || "#9dd9ea",
        vardiyaDurumu,
        albumSayilari,
        stokRibonAdet,
        makinaKalan,
        toplamRibonKapasite,
        veriVar: stok !== null,
        tarih: isFallback ? (kayit?.tarih || today) : today,
        fallbackTarih: isFallback ? (kayit?.tarih || null) : null,
      };
    });

    const albumTipleri = ["album3","album5","album7","album9","album11","album13","album15"];
    const genelAlbumToplam: Record<string, number> = {};
    for (const alan of albumTipleri) {
      genelAlbumToplam[alan] = mekanOzetleri.reduce((s: number, m: any) => s + (m.albumSayilari[alan] || 0), 0);
    }
    genelAlbumToplam["paspartu"] = mekanOzetleri.reduce((s: number, m: any) => s + (m.albumSayilari["paspartu"] || 0), 0);
    genelAlbumToplam["ribon"] = mekanOzetleri.reduce((s: number, m: any) => s + (m.albumSayilari["ribon"] || 0), 0);

    const genelRibonKapasite = mekanOzetleri.reduce((s: number, m: any) => s + m.toplamRibonKapasite, 0);

    // Depo stoğunu dahil et
    const depoStok: any = await kv.get("depo_stok") || {};
    const depoAlbumSayilari: Record<string, number> = {};
    for (const alan of albumTipleri) {
      depoAlbumSayilari[alan] = Number(depoStok[alan]) || 0;
    }
    const depoRibonTakim = Number(depoStok.ribon) || 0;
    const depoRibonAdet = depoRibonTakim * RIBON_PER_TAKIM;

    // Genel toplam albüm dağılımına depo da dahil et
    const genelAlbumToplam2: Record<string, number> = { ...genelAlbumToplam };
    for (const alan of albumTipleri) {
      genelAlbumToplam2[alan] = (genelAlbumToplam2[alan] || 0) + depoAlbumSayilari[alan];
    }

    const albumDagilimiFinal = albumTipleri.map((alan: string) => ({
      alan,
      name: albumEtiketleri[alan],
      color: albumRenkleri[alan],
      count: genelAlbumToplam2[alan],
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
      },
    });
  } catch (err) {
    console.log("Stok genel durum error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

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
    const stok: any = await kv.get("depo_stok") || {};
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

    const { alan, miktar, not: notText } = await c.req.json();
    if (!alan || !miktar || miktar <= 0) return c.json({ error: "Alan ve pozitif miktar zorunludur." }, 400);

    const mevcutStok: any = await kv.get("depo_stok") || {};
    const eskiDeger = Number(mevcutStok[alan]) || 0;
    mevcutStok[alan] = eskiDeger + miktar;
    mevcutStok.guncellenmeTarihi = new Date().toISOString();
    await kv.set("depo_stok", mevcutStok);

    const hareket = {
      id: `depo_hareket_${Date.now()}`,
      tip: "giris",
      alan,
      miktar,
      eskiDeger,
      yeniDeger: mevcutStok[alan],
      not: notText || "",
      tarih: new Date().toISOString(),
      kullaniciId: user.id,
      kullaniciAdi: user.user_metadata?.full_name || user.email,
    };
    await kv.set(hareket.id, hareket);

    console.log(`Depo giriş: ${alan} +${miktar} (${hareket.kullaniciAdi})`);
    return c.json({ basarili: true, yeniDeger: mevcutStok[alan], hareket });
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

    const { alan, miktar, hedefMekan, not: notText } = await c.req.json();
    if (!alan || !miktar || miktar <= 0) return c.json({ error: "Alan ve pozitif miktar zorunludur." }, 400);

    const mevcutStok: any = await kv.get("depo_stok") || {};
    const eskiDeger = Number(mevcutStok[alan]) || 0;
    if (eskiDeger < miktar) return c.json({ error: `Yetersiz stok. Mevcut: ${eskiDeger}, İstenen: ${miktar}` }, 400);

    mevcutStok[alan] = eskiDeger - miktar;
    mevcutStok.guncellenmeTarihi = new Date().toISOString();
    await kv.set("depo_stok", mevcutStok);

    const hareket = {
      id: `depo_hareket_${Date.now()}`,
      tip: "cikis",
      alan,
      miktar,
      eskiDeger,
      yeniDeger: mevcutStok[alan],
      hedefMekan: hedefMekan || "",
      not: notText || "",
      tarih: new Date().toISOString(),
      kullaniciId: user.id,
      kullaniciAdi: user.user_metadata?.full_name || user.email,
    };
    await kv.set(hareket.id, hareket);

    console.log(`Depo çıkış: ${alan} -${miktar} → ${hedefMekan || "manuel"} (${hareket.kullaniciAdi})`);
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

    const tumHareketler: any[] = await kv.getByPrefix("depo_hareket_") || [];
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

    const { mekanId, albumSayilari, ribonTakim } = await c.req.json();
    if (!mekanId) return c.json({ error: "mekanId zorunludur." }, 400);

    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15"];
    const stokObj: Record<string, number> = {};
    for (const alan of albumAlanlari) stokObj[alan] = Number(albumSayilari?.[alan]) || 0;
    stokObj.ribon = Number(ribonTakim) || 0;

    if (mekanId === "depo") {
      const depoStok: any = await kv.get("depo_stok") || {};
      for (const alan of albumAlanlari) depoStok[alan] = stokObj[alan];
      depoStok.ribon = stokObj.ribon;
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await kv.set("depo_stok", depoStok);
      console.log(`Depo stok güncellendi: ${user.user_metadata?.full_name}`);
      return c.json({ basarili: true });
    }

    const today = new Date().toISOString().split("T")[0];
    const kvKey = `stok_gunluk_${mekanId}_${today}`;
    const kayit: any = await kv.get(kvKey) || { mekanId, tarih: today };
    // Hem acilis hem kapanish'e yaz; böylece hiç vardiya açılmamış
    // mekanlarda da stok görünür ve fallback mantığı çalışır.
    kayit.acilis = { ...(kayit.acilis || {}), ...stokObj };
    kayit.acilisYapildi = true;
    kayit.kapanish = { ...(kayit.kapanish || {}), ...stokObj };
    kayit.kapanisYapildi = true;
    kayit.yoneticiGuncelleme = new Date().toISOString();
    await kv.set(kvKey, kayit);

    console.log(`Mekan stok güncellendi: mekan=${mekanId}, kullanıcı=${user.user_metadata?.full_name}`);
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
// ──────────────────────────────────────────
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

    if (mekanId === "depo") {
      const depoStok: any = { ...sifirStok, guncellenmeTarihi: new Date().toISOString() };
      await kv.set("depo_stok", depoStok);
      console.log(`Depo stok sıfırlandı: ${user.user_metadata?.full_name}`);
      return c.json({ basarili: true });
    }

    const today = new Date().toISOString().split("T")[0];
    const kvKey = `stok_gunluk_${mekanId}_${today}`;
    const kayit: any = await kv.get(kvKey) || { mekanId, tarih: today };
    kayit.acilis = { ...(kayit.acilis || {}), ...sifirStok };
    kayit.acilisYapildi = true;
    kayit.yoneticiSifirlama = new Date().toISOString();
    await kv.set(kvKey, kayit);

    console.log(`Mekan stok sıfırlandı: mekan=${mekanId}, kullanıcı=${user.user_metadata?.full_name}`);
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

    const { kaynakId, hedefId, alan, miktar, not: notText } = await c.req.json();
    if (!kaynakId || !hedefId || !alan || !miktar || miktar <= 0) {
      return c.json({ error: "Kaynak, hedef, alan ve pozitif miktar zorunludur." }, 400);
    }
    if (kaynakId === hedefId) {
      return c.json({ error: "Kaynak ve hedef aynı olamaz." }, 400);
    }
    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15","ribon"];
    if (!albumAlanlari.includes(alan)) {
      return c.json({ error: "Geçersiz alan." }, 400);
    }

    const today = new Date().toISOString().split("T")[0];
    const kullaniciAdi = user.user_metadata?.full_name || user.email || "Bilinmeyen";

    // Helper: mekan stok oku (bugün veya fallback)
    const getMekanStok = async (mekanId: string) => {
      const kvKey = `stok_gunluk_${mekanId}_${today}`;
      const kayit: any = await kv.get(kvKey);
      if (kayit) {
        const aktifField = kayit.kapanisYapildi ? "kapanish" : "acilis";
        const aktif = kayit[aktifField] || {};
        return { kayit, kvKey, aktif, alan_deger: Number(aktif[alan]) || 0, aktifField };
      }
      // Fallback: en son kapanış kaydı
      const tumKayitlar: any[] = await kv.getByPrefix("stok_gunluk_") || [];
      const mekanKayitlari = tumKayitlar
        .filter((k: any) => k.mekanId === mekanId && k.kapanisYapildi && k.kapanish)
        .sort((a: any, b: any) => (b.tarih || "").localeCompare(a.tarih || ""));
      const fallbackAktif = mekanKayitlari[0]?.kapanish || {};
      return { kayit: null, kvKey, aktif: fallbackAktif, alan_deger: Number(fallbackAktif[alan]) || 0, aktifField: "acilis" };
    };

    // Helper: mekan stok yaz
    const setMekanStok = async (mekanId: string, kvKey: string, kayit: any, aktifField: string, aktif: any, yeniDeger: number) => {
      const yeniKayit: any = kayit ? { ...kayit } : { mekanId, tarih: today };
      yeniKayit[aktifField] = { ...aktif, [alan]: yeniDeger };
      if (aktifField === "acilis") yeniKayit.acilisYapildi = true;
      yeniKayit.stokTransferGuncelleme = new Date().toISOString();
      await kv.set(kvKey, yeniKayit);
    };

    // Mekan isimlerini al (log için)
    let kaynakAdi = "Depo", hedefAdi = "Depo";
    let kaynakEmoji = "🏪", hedefEmoji = "🏪";
    if (kaynakId !== "depo") {
      const m: any = await kv.get(`mekan_${kaynakId}`);
      if (m) { kaynakAdi = m.name; kaynakEmoji = m.emoji || "📍"; }
    }
    if (hedefId !== "depo") {
      const m: any = await kv.get(`mekan_${hedefId}`);
      if (m) { hedefAdi = m.name; hedefEmoji = m.emoji || "📍"; }
    }

    let eskiKaynakDeger = 0, yeniKaynakDeger = 0;
    let eskiHedefDeger = 0, yeniHedefDeger = 0;

    // Kaynak: stok azalt
    if (kaynakId === "depo") {
      const depoStok: any = await kv.get("depo_stok") || {};
      eskiKaynakDeger = Number(depoStok[alan]) || 0;
      if (eskiKaynakDeger < miktar) {
        return c.json({ error: `Depo stoğu yetersiz. Mevcut: ${eskiKaynakDeger}, İstenen: ${miktar}` }, 400);
      }
      yeniKaynakDeger = eskiKaynakDeger - miktar;
      depoStok[alan] = yeniKaynakDeger;
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await kv.set("depo_stok", depoStok);
    } else {
      const { kayit, kvKey, aktif, alan_deger, aktifField } = await getMekanStok(kaynakId);
      eskiKaynakDeger = alan_deger;
      if (eskiKaynakDeger < miktar) {
        return c.json({ error: `${kaynakAdi} stoğu yetersiz. Mevcut: ${eskiKaynakDeger}, İstenen: ${miktar}` }, 400);
      }
      yeniKaynakDeger = eskiKaynakDeger - miktar;
      await setMekanStok(kaynakId, kvKey, kayit, aktifField, aktif, yeniKaynakDeger);
    }

    // Hedef: stok artır
    if (hedefId === "depo") {
      const depoStok: any = await kv.get("depo_stok") || {};
      eskiHedefDeger = Number(depoStok[alan]) || 0;
      yeniHedefDeger = eskiHedefDeger + miktar;
      depoStok[alan] = yeniHedefDeger;
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await kv.set("depo_stok", depoStok);
    } else {
      const { kayit, kvKey, aktif, alan_deger, aktifField } = await getMekanStok(hedefId);
      eskiHedefDeger = alan_deger;
      yeniHedefDeger = eskiHedefDeger + miktar;
      await setMekanStok(hedefId, kvKey, kayit, aktifField, aktif, yeniHedefDeger);
    }

    // Transfer logu kaydet
    const transferId = `stok_transfer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const transferLog = {
      id: transferId,
      kaynakId, kaynakAdi, kaynakEmoji,
      hedefId, hedefAdi, hedefEmoji,
      alan, miktar,
      not: notText || "",
      tarih: new Date().toISOString(),
      kullaniciId: user.id,
      kullaniciAdi,
      eskiKaynakDeger, yeniKaynakDeger,
      eskiHedefDeger, yeniHedefDeger,
    };
    await kv.set(transferId, transferLog);

    console.log(`Stok transfer: ${alan} x${miktar} | ${kaynakEmoji}${kaynakAdi} → ${hedefEmoji}${hedefAdi} | ${kullaniciAdi}`);
    return c.json({ basarili: true, transfer: transferLog });
  } catch (err) {
    console.log("Stok transfer error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
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
    const tumTransferler: any[] = await kv.getByPrefix("stok_transfer_") || [];
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

    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];

    // Bugünün tarihini Türkiye saatiyle hesapla (UTC+3)
    const nowTR = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const bugunTR = nowTR.toISOString().split('T')[0];
    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15"];

    // Her mekan için bugünün günlük stok kaydını çek
    const mekanlar = await Promise.all(mekanlarList.map(async (m: any) => {
      // Önce bugünü dene, bulamazsan geriye doğru 14 güne kadar tara
      let bulunanKayit: any = null;
      let bulunanTarih = bugunTR;
      for (let i = 0; i <= 14; i++) {
        const d = new Date(Date.now() + 3 * 60 * 60 * 1000 - i * 86400000);
        const dStr = d.toISOString().split('T')[0];
        const kayit: any = await kv.get(`stok_gunluk_${m.id}_${dStr}`);
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

    const depoStok: any = await kv.get("depo_stok") || {};
    const depo = {
      id: "depo",
      name: "Depo",
      emoji: "🏪",
      albumSayilari: {
        album3: Number(depoStok.album3) || 0,
        album5: Number(depoStok.album5) || 0,
        album7: Number(depoStok.album7) || 0,
        album9: Number(depoStok.album9) || 0,
        album11: Number(depoStok.album11) || 0,
        album13: Number(depoStok.album13) || 0,
        album15: Number(depoStok.album15) || 0,
      },
      ribonTakim: Number(depoStok.ribon) || 0,
    };

    // ── Tüm yazıcıları getir (ekipman kaydından) ──────────────────────────
    const tumEkipmanlarEkstra: any[] = await kv.getByPrefix("ekipman_") || [];
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
          const gunKayit: any = await kv.get(`stok_gunluk_${eq.locationId}_${dStr}`);
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
    const kayit: any = await kv.get(`ekstra_is_${taskId}_${tarih}`);
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

    const mevcutKayit: any = await kv.get(`ekstra_is_${taskId}_${tarih}`);
    if (mevcutKayit?.acilisYapildi) {
      return c.json({ error: "Açılış zaten yapılmış." }, 400);
    }

    const albumAlanlari = ["album3","album5","album7","album9","album11","album13","album15"];

    // Kaynak stoktan düş
    if (kaynakId === "depo") {
      const depoStok: any = await kv.get("depo_stok") || {};
      for (const alan of albumAlanlari) {
        const istenen = Number(acilis[alan]) || 0;
        if (istenen <= 0) continue;
        const mevcutStok = Number(depoStok[alan]) || 0;
        if (mevcutStok < istenen) {
          return c.json({ error: `Depo ${alan} stoğu yetersiz. Mevcut: ${mevcutStok}, İstenen: ${istenen}` }, 400);
        }
        depoStok[alan] = mevcutStok - istenen;
      }
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await kv.set("depo_stok", depoStok);
    } else {
      // Mekan stoku — bugünün kaydından düş, yoksa önceki en son kaydı bul
      let mekanKayit: any = await kv.get(`stok_gunluk_${kaynakId}_${tarih}`);
      let stokKayitAnahtari = `stok_gunluk_${kaynakId}_${tarih}`;
      if (!mekanKayit) {
        const bugunDt = new Date(tarih);
        for (let i = 1; i <= 14; i++) {
          const dt = new Date(bugunDt);
          dt.setDate(bugunDt.getDate() - i);
          const dtStr = dt.toISOString().split("T")[0];
          const gecmis: any = await kv.get(`stok_gunluk_${kaynakId}_${dtStr}`);
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
      await kv.set(stokKayitAnahtari, guncelKayit);
    }

    // ── Yazıcı sayaç anomali tespiti (açılıştaki startCounter vs önceki endCounter) ──
    let yaziciAnomali: any = null;
    if (yaziciData?.ekipmanId && yaziciData?.startCounter !== undefined) {
      const ekipman: any = await kv.get(yaziciData.ekipmanId);
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
            const gk: any = await kv.get(`stok_gunluk_${ekipman.locationId}_${dStr}`);
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

    await kv.set(`ekstra_is_${taskId}_${tarih}`, kayit);
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

    const mevcut: any = await kv.get(`ekstra_is_${taskId}_${tarih}`);
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
    await kv.set(`ekstra_is_${taskId}_${tarih}`, { ...mevcut, kareKayitlari });
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

    const mevcut: any = await kv.get(`ekstra_is_${taskId}_${tarih}`);
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
      const depoStok: any = await kv.get("depo_stok") || {};
      for (const alan of albumAlanlari) {
        const iade = Number(kapalis[alan]) || 0;
        if (iade <= 0) continue;
        depoStok[alan] = (Number(depoStok[alan]) || 0) + iade;
      }
      depoStok.guncellenmeTarihi = new Date().toISOString();
      await kv.set("depo_stok", depoStok);
    } else {
      // Mekan — bugünkü kayıt yoksa önceki en son kaydı bul
      let mekanKayit: any = await kv.get(`stok_gunluk_${iadeHedefId}_${tarih}`);
      let iadeKayitAnahtari = `stok_gunluk_${iadeHedefId}_${tarih}`;
      if (!mekanKayit) {
        const bugunDt = new Date(tarih);
        for (let i = 1; i <= 14; i++) {
          const dt = new Date(bugunDt);
          dt.setDate(bugunDt.getDate() - i);
          const dtStr = dt.toISOString().split("T")[0];
          const gecmis: any = await kv.get(`stok_gunluk_${iadeHedefId}_${dtStr}`);
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
        await kv.set(iadeKayitAnahtari, guncelKayit);
      } else {
        console.log(`Iade hedefi ${iadeHedefAdi} için stok kaydı bulunamadı, iade yapılamadı.`);
      }
    }

    // ── Yazıcı kapanış: ekipman kaydına son endCounter yaz ──────────────
    if (yaziciKapanisData?.ekipmanId && yaziciKapanisData?.endCounter !== undefined) {
      try {
        const ekipman: any = await kv.get(yaziciKapanisData.ekipmanId);
        if (ekipman) {
          const guncelEkipman = {
            ...ekipman,
            lastEndCounter: Number(yaziciKapanisData.endCounter),
            lastEndTarih: tarih,
            lastEndRibonMevcut: yaziciKapanisData.ribonMevcut !== undefined ? Number(yaziciKapanisData.ribonMevcut) : (ekipman.lastEndRibonMevcut || null),
          };
          await kv.set(yaziciKapanisData.ekipmanId, guncelEkipman);
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

    await kv.set(`ekstra_is_${taskId}_${tarih}`, guncelKayit);
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
    const kayit: any = await kv.get(`ozel_is_${taskId}_${tarih}`);
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

    const mevcutKayit: any = await kv.get(`ozel_is_${taskId}_${tarih}`);
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

    await kv.set(`ozel_is_${taskId}_${tarih}`, kayit);
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
// ──────────────────────────────────────────
app.post("/make-server-4da0b637/ozel-is/tamamla", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    if (user.user_metadata?.role === "bekleyen") return c.json({ error: "Yetki yok." }, 403);

    const { taskId, tarih, tamamlamaNot, fotografUrl } = await c.req.json();
    if (!taskId || !tarih) return c.json({ error: "taskId ve tarih zorunludur." }, 400);

    const mevcutKayit: any = await kv.get(`ozel_is_${taskId}_${tarih}`);
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

    await kv.set(`ozel_is_${taskId}_${tarih}`, guncelKayit);
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

    const today = new Date().toISOString().split("T")[0];
    const isAdmin = ["yonetici", "ust-mudur", "mudur", "idari", "operasyon"].includes(callerRole);

    // Mekanlar
    const mekanlarList = await kv.getByPrefix("mekan_") || [];
    const mekanMap: Record<string, any> = {};
    for (const m of mekanlarList) mekanMap[m.id] = m;

    // Bugünkü tüm stok kayıtları
    const tumKayitlar = await kv.getByPrefix("stok_gunluk_") || [];
    const bugunKayitlar = tumKayitlar.filter((k: any) => k.tarih === today);

    // Satış aggregation
    let toplamCiro = 0;
    let toplamSatisAdet = 0;
    let toplamIskonto = 0;
    const mekanOzetleri: any[] = [];
    const tumSatislar: any[] = [];
    const anomaliler: any[] = [];
    const personelCiro: Record<string, { ad: string; ciro: number; satis: number }> = {};

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
        if (!personelCiro[kaydeden]) personelCiro[kaydeden] = { ad: kaydeden, ciro: 0, satis: 0 };
        personelCiro[kaydeden].ciro += tutar;
        personelCiro[kaydeden].satis++;
      }

      toplamCiro += mekanCiro;
      toplamSatisAdet += mekanSatis;
      toplamIskonto += mekanIskonto;

      // Anomali kontrolü
      const acilisAnomali = kayit.acilisAnomali && Object.keys(kayit.acilisAnomali).length > 0;
      const kapanisAnomali = kayit.kapanisAnomali && Object.keys(kayit.kapanisAnomali).length > 0;
      if (acilisAnomali || kapanisAnomali) {
        anomaliler.push({
          mekan: mekan.name,
          mekanEmoji: mekan.emoji,
          type: acilisAnomali ? "acilis" : "kapanis",
          detail: kayit.acilisAnomali || kayit.kapanisAnomali,
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

    // Personel sıralaması
    const personelSiralama = Object.values(personelCiro)
      .sort((a, b) => b.ciro - a.ciro)
      .slice(0, 5);

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

    const tumKayitlar: any[] = await kv.getByPrefix("stok_gunluk_") || [];

    const filtrelenmis = tumKayitlar.filter((k: any) => {
      if (!k.tarih) return false;
      if (baslangic && k.tarih < baslangic) return false;
      if (bitis && k.tarih > bitis) return false;
      return true;
    });

    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];
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

    const tumKayitlar: any[] = await kv.getByPrefix("stok_gunluk_") || [];
    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];
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
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍", color: "#9dd9ea" };

      if (!mekanOzetMap[kayit.mekanId]) {
        mekanOzetMap[kayit.mekanId] = {
          id: kayit.mekanId,
          name: mekan.name,
          emoji: mekan.emoji || "📍",
          color: mekan.color || "#9dd9ea",
          ciro: 0, satisAdet: 0, iskonto: 0,
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
          personelMap[personelId] = { id: personelId, name: personelAd, ciro: 0, satisAdet: 0, iskonto: 0 };
        }
        personelMap[personelId].ciro += tutar;
        personelMap[personelId].satisAdet++;
        personelMap[personelId].iskonto += iskonto;

        if (!odemeMap[pm]) odemeMap[pm] = { adet: 0, ciro: 0 };
        odemeMap[pm].adet++;
        odemeMap[pm].ciro += tutar;

        for (const item of (satis.items || [])) {
          const tip = item.product || "Diğer";
          const adet = Number(item.quantity) || 1;
          const birimFiyat = Number(item.unitPrice) || 0;
          if (!albumMap[tip]) albumMap[tip] = { tip, adet: 0, ciro: 0 };
          albumMap[tip].adet += adet;
          albumMap[tip].ciro += birimFiyat * adet;
        }
      }
    }

    const mekanListesi = Object.values(mekanOzetMap).sort((a: any, b: any) => b.ciro - a.ciro);
    const personelListesi = Object.values(personelMap).sort((a: any, b: any) => b.ciro - a.ciro);
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

    const mekanIdQ = c.req.query("mekanId") || "";

    // Kısa dönem eşiği: bugünden tam 365 gün önce
    const now = new Date();
    const kisaBaslangic = new Date(now);
    kisaBaslangic.setFullYear(kisaBaslangic.getFullYear() - 1);
    const kisaEsik = kisaBaslangic.toISOString().split("T")[0];

    // Mekan haritası
    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];
    const mekanById: Record<string, any> = {};
    for (const m of mekanlarList) mekanById[m.id] = m;

    // Tüm günlük kayıtları çek, isteğe bağlı mekan filtresi
    const tumKayitlar: any[] = await kv.getByPrefix("stok_gunluk_") || [];
    const filtrelenmis = mekanIdQ
      ? tumKayitlar.filter((k: any) => k.mekanId === mekanIdQ)
      : tumKayitlar;

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
        avatar: "👤",
        uzun:   hesapla(p.uzun),
        kisa:   hesapla(p.kisa),
      }))
      .sort((a, b) => b.uzun.ortalamaIndirimOrani - a.uzun.ortalamaIndirimOrani);

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
    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];
    const mekanById:   Record<string, any> = {};
    for (const m of mekanlarList) {
      mekanById[m.id] = m;
    }

    // ── 2. Rotation task haritası: { "YYYY-MM-DD__mekanAdi" → Personnel[] } ──
    const allTasks: any[] = await kv.getByPrefix("rotation_task_") || [];
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
    const tumKayitlar: any[] = await kv.getByPrefix("stok_gunluk_") || [];
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
// DOĞUM GÜNÜ: Kendi gizlilik ayarlarını getir
// GET /make-server-4da0b637/birthday
// Doğum tarihi user_metadata.birth_date'den okunur
// ──────────────────────────────────────────
app.get("/make-server-4da0b637/birthday", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);
    const privacy = await kv.get(`bday_privacy_${user.id}`);
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
    await kv.set(`bday_privacy_${user.id}`, privacy);
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

    const myPrivacy = await kv.get(`bday_privacy_${user.id}`);
    const hideOthers = myPrivacy?.hideOthersBirthdays === true;

    const supabase = getAdminClient();
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) return c.json({ error: `Kullanıcılar yüklenemedi: ${error.message}` }, 400);

    // Tüm gizlilik ayarlarını toplu çek, userId bazında map oluştur
    const allPrivacy = await kv.getByPrefix("bday_privacy_");
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
    const { mekanId, tarih, items, totalPrice, discount, paymentMethod, currency, currencyPrice } = body;
    if (!mekanId || !tarih || !items || totalPrice === undefined || !paymentMethod) {
      return c.json({ error: "mekanId, tarih, items, totalPrice, paymentMethod zorunludur." }, 400);
    }

    // Rotasyon yetkisi kontrolü
    const yetkiliSatis = await checkRotasyonYetkisi(user.id, callerRole, mekanId, tarih);
    if (!yetkiliSatis) {
      console.log(`Rotasyon yetki reddi — satis: user=${user.id}, role=${callerRole}, mekan=${mekanId}, tarih=${tarih}`);
      return c.json({ error: "Bu mekana bugünkü rotasyonunuzda atanmamışsınız. Satış kaydedemezsiniz." }, 403);
    }

    const existing = await kv.get(`stok_gunluk_${mekanId}_${tarih}`) || { mekanId, tarih };
    const satislar: any[] = existing.satislar || [];

    const satisId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const satis = {
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
    satislar.unshift(satis);
    await kv.set(`stok_gunluk_${mekanId}_${tarih}`, { ...existing, satislar });
    console.log(`Satış kaydedildi: ${satisId} | ${mekanId} | ${tarih} | ${satis.finalPrice} TRY`);
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
    try { const body = await c.req.json(); neden = body.neden || ""; } catch {}

    const existing = await kv.get(`stok_gunluk_${mekanId}_${tarih}`);
    if (!existing) return c.json({ error: "Kayıt bulunamadı." }, 404);

    const satislar = (existing.satislar || []).map((s: any) =>
      s.id === satisId
        ? { ...s, iptal: true, iptalNeden: neden, iptalZamani: new Date().toISOString(), iptalEden: user.user_metadata?.full_name || user.email }
        : s
    );
    await kv.set(`stok_gunluk_${mekanId}_${tarih}`, { ...existing, satislar });
    console.log(`Satış iptal: ${satisId} | neden: ${neden}`);
    return c.json({ success: true });
  } catch (err) {
    console.log("Delete stok satis error:", err);
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
    const yetkiliKare = await checkRotasyonYetkisi(user.id, callerRole, mekanId, tarih);
    if (!yetkiliKare) {
      console.log(`Rotasyon yetki reddi — kare: user=${user.id}, role=${callerRole}, mekan=${mekanId}, tarih=${tarih}`);
      return c.json({ error: "Bu mekana bugünkü rotasyonunuzda atanmamışsınız. Kare kaydı yapma yetkiniz yok." }, 403);
    }

    const existing = await kv.get(`stok_gunluk_${mekanId}_${tarih}`) || { mekanId, tarih };
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
    kareKayitlari.push(entry);
    await kv.set(`stok_gunluk_${mekanId}_${tarih}`, { ...existing, kareKayitlari });
    console.log(`Kare kaydedildi: ${entryId} | ${photographerName} | ${count} kare | ${mekanId}/${tarih}`);
    return c.json({ entry });
  } catch (err) {
    console.log("Post stok kare error:", err);
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

    const today = new Date().toISOString().split("T")[0];
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

    await kv.set(`kare_${today}_${id}`, entry);
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

    const all = await kv.getByPrefix(`kare_${dateParam}_`);
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
    await kv.del(`kare_${date}_${id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log("Delete kare error:", err);
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

    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const aktifler = (data.users || [])
      .filter((u: any) => u.user_metadata?.role && u.user_metadata.role !== "bekleyen")
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

    const tumEkipmanlar: any[] = await kv.getByPrefix("ekipman_") || [];
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
      olusturulmaTarihi: new Date().toISOString(),
      olusturanId: user.id,
      olusturanAdi: user.user_metadata?.full_name || user.email,
      guncellemeTarihi: new Date().toISOString(),
    };
    await kv.set(id, ekipman);

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

    const mevcut: any = await kv.get(id);
    if (!mevcut) return c.json({ error: "Ekipman bulunamadı." }, 404);

    const guncellendi = {
      ...mevcut,
      ...fields,
      id,
      guncellemeTarihi: new Date().toISOString(),
      guncelleyenId: user.id,
      guncelleyenAdi: user.user_metadata?.full_name || user.email,
    };
    await kv.set(id, guncellendi);

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

    const mevcut: any = await kv.get(id);
    if (!mevcut) return c.json({ error: "Ekipman bulunamadı." }, 404);

    mevcut.assignedTo = assignedTo || undefined;
    mevcut.assignedToId = assignedToId || undefined;
    mevcut.guncellemeTarihi = new Date().toISOString();
    mevcut.zimmetTarihi = assignedTo ? new Date().toISOString() : undefined;
    mevcut.zimmeti = user.user_metadata?.full_name || user.email;
    await kv.set(id, mevcut);

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
    const mevcut: any = await kv.get(id);
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

    await kv.del(id);

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
    const config = await kv.get("ai_role_config_v1") || null;
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
    await kv.set("ai_role_config_v1", body.config);
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

    const targetRole = targetData.user.user_metadata?.role ?? "bekleyen";
    const hierarchy: Record<string, number> = {
      yonetici: 6, "ust-mudur": 5, mudur: 4, operasyon: 3, idari: 2, personel: 1, bekleyen: 0,
    };
    if (callerRole !== "yonetici" && hierarchy[targetRole] >= hierarchy[callerRole]) {
      return c.json({ error: "Kendi seviyenizde veya üzerindeki kullanıcıları silemezsiniz." }, 403);
    }

    const targetName = targetData.user.user_metadata?.full_name || targetData.user.email || userId;
    let kvTemizlendi = 0;

    // ── 1. rotation_task_* — personeli görevden çıkar ──
    // Tek kişilik görev → tamamen sil | Çok kişilik → sadece bu kişiyi çıkar
    try {
      const tasks = await kv.getByPrefix("rotation_task_");
      for (const task of (tasks || [])) {
        if (!task.id) continue;
        const personnel: any[] = Array.isArray(task.personnel) ? task.personnel : [];
        const buKisiVar = personnel.some((p: any) => p.id === userId);
        if (!buKisiVar) continue;

        if (personnel.length <= 1) {
          await kv.del(`rotation_task_${task.id}`);
          kvTemizlendi++;
          console.log(`[userDelete] rotation_task_${task.id} silindi (tek kişilik görev)`);
        } else {
          const yeniPersonnel = personnel.filter((p: any) => p.id !== userId);
          await kv.set(`rotation_task_${task.id}`, { ...task, personnel: yeniPersonnel });
          kvTemizlendi++;
          console.log(`[userDelete] rotation_task_${task.id} güncellendi (${personnel.length} → ${yeniPersonnel.length} kişi)`);
        }
      }
    } catch (e) {
      console.log("[userDelete] rotation_task temizlik hatası:", e);
    }

    // ── 2. rotation_leave_* — bu kullanıcının izin talepleri ──
    try {
      const leaves = await kv.getByPrefix("rotation_leave_");
      for (const leave of (leaves || [])) {
        if (leave.personnelId === userId || leave.staffId === userId || leave.created_by === userId) {
          await kv.del(`rotation_leave_${leave.id}`);
          kvTemizlendi++;
          console.log(`[userDelete] rotation_leave_${leave.id} silindi`);
        }
      }
    } catch (e) {
      console.log("[userDelete] rotation_leave temizlik hatası:", e);
    }

    // ── 3. rotation_daily_onleave — tarih bazlı listeden userId çıkar ──
    try {
      const dailyOnLeave = await kv.get("rotation_daily_onleave");
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
          await kv.set("rotation_daily_onleave", dailyOnLeave);
          console.log(`[userDelete] rotation_daily_onleave güncellendi`);
          kvTemizlendi++;
        }
      }
    } catch (e) {
      console.log("[userDelete] rotation_daily_onleave temizlik hatası:", e);
    }

    // ── 4. bday_privacy_ — doğum günü gizlilik kaydını sil ──
    try {
      await kv.del(`bday_privacy_${userId}`);
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
    const canSeeMekan = ["yonetici", "ust-mudur"].includes(role);

    const STATIC_CHANNELS = [
      { id: "general",  name: "general",  type: "channel", isAdminOnly: false, deletable: false },
      { id: "rotasyon", name: "rotasyon", type: "channel", isAdminOnly: false, deletable: false },
    ];

    // Mekan kanalları — sadece yonetici + ust-mudur
    let mekanChannels: any[] = [];
    if (canSeeMekan) {
      const mekanlar: any[] = await kv.getByPrefix("mekan_") || [];
      mekanChannels = mekanlar.map((m: any) => ({
        id: `mekan_${m.id}`, name: m.name, type: "project", emoji: m.emoji || "📍",
        isAdminOnly: true, deletable: false,
      }));
    }

    // Özel kanallar — tüm aktif roller görebilir
    const customs: any[] = await kv.getByPrefix("chat_channel_") || [];
    const customChannels = customs.map((ch: any) => ({
      id: ch.id, name: ch.name, type: "channel", emoji: ch.emoji || "💬",
      isAdminOnly: false, deletable: true, createdBy: ch.createdBy,
    }));

    const allChannels = [...STATIC_CHANNELS, ...mekanChannels, ...customChannels];
    const readMap: Record<string, string> = await kv.get(`chat_read_${user.id}`) || {};

    const channelsWithMeta = await Promise.all(allChannels.map(async (ch) => {
      const data: any = await kv.get(`chat_msgs_${ch.id}`) || { messages: [] };
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
    await kv.set(`chat_channel_${id}`, channel);
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
    await kv.del(`chat_channel_${channelId}`);
    await kv.del(`chat_msgs_${channelId}`);
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
    const data: any = await kv.get(`chat_msgs_${channelId}`) || { messages: [] };
    const readMap: Record<string, string> = await kv.get(`chat_read_${user.id}`) || {};
    readMap[channelId] = new Date().toISOString();
    await kv.set(`chat_read_${user.id}`, readMap);
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

    const data: any = await kv.get(`chat_msgs_${channelId}`) || { messages: [] };
    const messages = [...(data.messages || []), msg].slice(-MAX_MSGS);
    await kv.set(`chat_msgs_${channelId}`, { messages, lastUpdated: new Date().toISOString() });
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
    const supabase = getAdminClient();
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 500 });
    if (error) return c.json({ error: `Kullanıcılar alınamadı: ${error.message}` }, 400);
    const list = users
      .filter((u: any) => u.id !== user.id && u.user_metadata?.role !== "bekleyen")
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

    const dmListKey = `chat_dm_list_${user.id}`;
    const dmList: string[] = await kv.get(dmListKey) || [];

    const supabase = getAdminClient();
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 500 });
    const userMap: Record<string, any> = {};
    for (const u of (users || [])) userMap[u.id] = u;

    const readMap: Record<string, string> = await kv.get(`chat_read_${user.id}`) || {};

    const conversations = await Promise.all(dmList.map(async (otherUserId: string) => {
      const other = userMap[otherUserId];
      if (!other) return null;
      const dmKey = sortedDmKey(user.id, otherUserId);
      const data: any = await kv.get(dmKey) || { messages: [] };
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
    const dmKey = sortedDmKey(user.id, otherUserId);
    const data: any = await kv.get(dmKey) || { messages: [] };
    const readMap: Record<string, string> = await kv.get(`chat_read_${user.id}`) || {};
    readMap[`dm_${otherUserId}`] = new Date().toISOString();
    await kv.set(`chat_read_${user.id}`, readMap);
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

    const data: any = await kv.get(dmKey) || { messages: [] };
    const messages = [...(data.messages || []), msg].slice(-MAX_MSGS);
    await kv.set(dmKey, { messages, lastUpdated: new Date().toISOString() });

    // Her iki kullanıcının DM listesine ekle
    for (const [meId, themId] of [[user.id, otherUserId], [otherUserId, user.id]]) {
      const listKey = `chat_dm_list_${meId}`;
      const list: string[] = await kv.get(listKey) || [];
      if (!list.includes(themId)) await kv.set(listKey, [...list, themId]);
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

    // ��─ 1. Mekanlar ──
    const mekanlarList: any[] = await kv.getByPrefix("mekan_") || [];
    const mekanById: Record<string, any> = {};
    for (const m of mekanlarList) mekanById[m.id] = m;

    // ── 2. Stok kayıtları filtrele ──
    const tumKayitlar: any[] = await kv.getByPrefix("stok_gunluk_") || [];
    const filtrelenmis = tumKayitlar.filter((k: any) => {
      if (!k.tarih) return false;
      if (baslangic && k.tarih < baslangic) return false;
      if (bitis && k.tarih > bitis) return false;
      if (mekanIdFilter && k.mekanId !== mekanIdFilter) return false;
      return true;
    });

    // ── 3. Personel satış aggregation ──
    const personMap: Record<string, any> = {};
    const mekanTotalCiro: Record<string, number> = {};

    for (const kayit of filtrelenmis) {
      const satislar = (kayit.satislar || []).filter((s: any) => !s.iptal);
      const mekanId = kayit.mekanId;
      if (!mekanTotalCiro[mekanId]) mekanTotalCiro[mekanId] = 0;

      for (const satis of satislar) {
        const tutar = Number(satis.finalPrice) || 0;
        const brut = Number(satis.totalPrice) || tutar;
        const iskonto = Number(satis.discount) || 0;
        const pid = satis.kaydedenId || satis.kaydeden || "bilinmeyen";
        const pad = satis.kaydeden || "Bilinmiyor";

        mekanTotalCiro[mekanId] += tutar;

        if (!personMap[pid]) {
          personMap[pid] = {
            id: pid, ad: pad, avatar: "👤",
            ciro: 0, brutCiro: 0, iskonto: 0, satisAdet: 0,
            ciroByMekan: {} as Record<string, number>,
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
      for (const kare of (kayit.kareKayitlari || [])) {
        const pid = kare.photographerId;
        if (!pid) continue;
        if (!personMap[pid]) {
          personMap[pid] = {
            id: pid, ad: kare.photographerName || "Bilinmiyor", avatar: "👤",
            ciro: 0, brutCiro: 0, iskonto: 0, satisAdet: 0,
            ciroByMekan: {} as Record<string, number>,
            toplamKare: 0,
          };
        }
        personMap[pid].toplamKare += Number(kare.frameCount) || 0;
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
    const allTasks: any[] = await kv.getByPrefix("rotation_task_") || [];
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

    // ── 6. Ham metrikler ──
    const liste: any[] = Object.values(personMap).filter((p: any) => p.satisAdet > 0);

    for (const p of liste) {
      p.ortSatis = p.satisAdet > 0 ? p.ciro / p.satisAdet : 0;
      p.iskontoDisipling = p.brutCiro > 0 ? 1 - (p.iskonto / p.brutCiro) : 1;
      let mekanKatkiScore = 0;
      for (const [mid, pciro] of Object.entries(p.ciroByMekan as Record<string, number>)) {
        const mtotal = mekanTotalCiro[mid] || 1;
        mekanKatkiScore += (pciro / mtotal) * (pciro / p.ciro);
      }
      p.mekanKatki = mekanKatkiScore;
      p.anomaliVardiya = personAnomalSet[p.id]?.size || 0;
      p.toplamVardiya = personVardiya[p.id]?.size || 0;
      p.anomaliOran = p.toplamVardiya > 0 ? p.anomaliVardiya / p.toplamVardiya : 0;
      p.anomaliTemizligi = 1 - p.anomaliOran;
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
    normalize(liste, "toplamKare", "karePuan");

    // ── 8. Ağırlıklı toplam skor ──
    // İskonto %25 | OrtSatış %15 | MekanKatkı %25 | Anomali %20 | Kare %15
    for (const p of liste) {
      p.toplamSkor = Math.round(
        (p.iskontoPuan    || 0) * 0.25 +
        (p.ortSatisPuan   || 0) * 0.15 +
        (p.mekanKatkiPuan || 0) * 0.25 +
        (p.anomaliPuan    || 0) * 0.20 +
        (p.karePuan       || 0) * 0.15
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
        karePuan:       p.karePuan       || 0,
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
      },
    }));

    // ── 7. Podyum quote'ları: top3'ü çek, top3 dışındakileri sil ──
    const quotesMap: Record<string, string> = {};
    if (periodKey) {
      const top3Ids = new Set(result.slice(0, 3).map((p: any) => p.id));
      const allQuotes: any[] = await kv.getByPrefix("podium_quote_") || [];
      for (const q of allQuotes) {
        if (q._periodKey !== periodKey) continue;
        if (!top3Ids.has(q.userId)) {
          // Top3 dışına düştü — quote'u sil
          await kv.del(`podium_quote_${q.userId}_${periodKey}`);
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
// ──────────────────────────────────────────────────────────────
app.put("/make-server-4da0b637/leaderboard/quotes", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { periodKey, quote } = await c.req.json();
    if (!periodKey || typeof periodKey !== "string") return c.json({ error: "periodKey gerekli." }, 400);
    if (typeof quote !== "string" || quote.length > 120) return c.json({ error: "Mesaj en fazla 120 karakter olmalı." }, 400);

    const trimmed = quote.trim();
    if (!trimmed) {
      // Boş mesaj → sil
      await kv.del(`podium_quote_${user.id}_${periodKey}`);
      return c.json({ ok: true, deleted: true });
    }

    await kv.set(`podium_quote_${user.id}_${periodKey}`, {
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

    const [tumKayitlarRaw, mekanlarList, costAlbumsRaw, exRatesRaw] = await Promise.all([
      kv.getByPrefix("stok_gunluk_"),
      kv.getByPrefix("mekan_"),
      kv.get("cost_albums"),
      kv.get("cost_exchange_rates"),
    ]);

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
      return ["album3","album5","album7","album9","album11","album13","album15","paspartu"]
        .reduce((s: number, k: string) => s + (Number(obj[k]) || 0), 0);
    };

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

    const raporlar = filtrelenmis.map((kayit: any) => {
      const mekan = mekanMap[kayit.mekanId] || { name: kayit.mekanId, emoji: "📍", color: "#9dd9ea", printType: "yarim" };
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
        else if (pm.includes("kredi") || pm.includes("kart")) pMap[pid].krediTL += tutar;
        else pMap[pid].nakitTL += tutar;
        for (const item of (satis.items || [])) {
          const ua = item.product || "Diger";
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

      const yazicilar = (kayit.printerData || []).map((pr: any) => ({
        ad: pr.ad || pr.label || "Yazici",
        baslangic: Number(pr.baslangicSayac ?? pr.startCounter) || 0,
        bitis: Number(pr.bitisSayac ?? pr.endCounter) || 0,
        netBasilan: Number(pr.netBasilan) || 0,
      }));

      const anomaliler: any[] = [];
      const acA = kayit.acilisAnomali || {};
      if (Object.keys(acA).length > 0) {
        anomaliler.push({ tip: "stok", aciklama: "Acilis stok anomalisi: " + Object.entries(acA).map(([k, v]) => `${k}: ${Number(v) > 0 ? "+" : ""}${v}`).join(", ") });
      }
      const kpA = kayit.kapanisAnomali || {};
      if (Object.keys(kpA).length > 0) {
        anomaliler.push({ tip: "stok", aciklama: "Kapanis stok anomalisi: " + Object.entries(kpA).map(([k, v]) => `${k}: ${Number(v) > 0 ? "+" : ""}${v}`).join(", ") });
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
        personeller,
        yazicilar,
        anomaliler,
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
        baskiPaperName,
        kotaKademeleri: mekan.kotaKademeleri || [],
        primBilgi: (() => {
          const kkList: any[] = mekan.kotaKademeleri || [];
          if (kkList.length === 0) return null;
          const fotografcilar = new Set((kayit.kareKayitlari || []).map((k: any) => k.photographerName).filter(Boolean));
          const personelSayisi = fotografcilar.size || personeller.length || 1;
          const coklu = personelSayisi > 1;
          const gecilenKademeler = kkList
            .map((k: any, i: number) => ({ ...k, index: i }))
            .filter((k: any) => Math.round(toplamCiro) >= k.hedef);
          if (gecilenKademeler.length === 0) return null;
          const topKademe = gecilenKademeler[gecilenKademeler.length - 1];
          const toplamPrimTutar = gecilenKademeler.reduce((s: number, k: any) => {
            return s + ((coklu ? k.primCoklu : k.primTek) || 0);
          }, 0);
          return {
            kademeIndex: topKademe.index,
            kademeHedef: topKademe.hedef,
            topKademePrim: (coklu ? topKademe.primCoklu : topKademe.primTek) || 0,
            toplamPrim: toplamPrimTutar,
            toplamKademe: gecilenKademeler.length,
            personelSayisi,
            coklu,
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

// ──────────────────────────────────────────────────────────────
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
    const mevcut = await kv.get(kvKey);
    if (!mevcut) {
      return c.json({ error: `KV kaydi bulunamadi: ${kvKey}` }, 404);
    }

    await kv.del(kvKey);
    console.log(`Vardiya silindi: ${kvKey} | silen: ${user.email}`);
    return c.json({ ok: true, silinen: kvKey });
  } catch (err) {
    console.log("Vardiya sil error:", err);
    return c.json({ error: `Sunucu hatasi: ${err}` }, 500);
  }
});

// ──────────────────────────────────────────
// AI STATUS — Herkese açık, sadece global durum okur
// GET /make-server-4da0b637/ai/status
// ──────────────────────────────────────────

app.get("/make-server-4da0b637/ai/status", async (c) => {
  try {
    const globalEnabled = await kv.get("ai_global_enabled");
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
    const globalEnabled   = await kv.get("ai_global_enabled");
    const personalKey     = `ai_personal_yonetici_${user.id}`;
    const personalEnabled = await kv.get(personalKey);
    return c.json({
      ai_global_enabled:    globalEnabled  !== null ? Boolean(globalEnabled)  : true,
      ai_personal_yonetici: personalEnabled !== null ? Boolean(personalEnabled) : true,
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
    if (typeof body.ai_global_enabled !== "undefined") {
      await kv.set("ai_global_enabled", Boolean(body.ai_global_enabled));
      console.log(`[AI Toggle] ai_global_enabled → ${body.ai_global_enabled} | ${user.user_metadata?.full_name}`);
    }
    if (typeof body.ai_personal_yonetici !== "undefined") {
      await kv.set(`ai_personal_yonetici_${user.id}`, Boolean(body.ai_personal_yonetici));
      console.log(`[AI Toggle] ai_personal_yonetici_${user.id} → ${body.ai_personal_yonetici} | ${user.user_metadata?.full_name}`);
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
// Toggle ON  → OpenAI GPT-4o-mini kullanır
// Toggle OFF → { use_kv: true } döner, frontend KV motorunu kullanır
// ══════════════════════════════════════════

app.post("/make-server-4da0b637/ai/chat", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    // Body'yi önce parse et — userRole toggle kararı için gerekli
    const body = await c.req.json();
    const { messages, userRole, userName, systemContext, ozet } = body;

    // Toggle durumunu belirle (userRole body'den, user.id KV key için güvenli)
    let useOpenAI = false;
    if (userRole === "yonetici") {
      const personalKey = `ai_personal_yonetici_${user.id}`;
      const personalEnabled = await kv.get(personalKey);
      useOpenAI = personalEnabled !== null ? Boolean(personalEnabled) : true;
    } else {
      const globalEnabled = await kv.get("ai_global_enabled");
      useOpenAI = globalEnabled !== null ? Boolean(globalEnabled) : true;
    }

    if (!useOpenAI) {
      return c.json({ use_kv: true }, 200);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.log("[AI Chat] OPENAI_API_KEY eksik, KV moduna düşülüyor.");
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
        const allLeaves: any[] = await kv.getByPrefix("rotation_leave_") || [];
        const bugunIzinliler = allLeaves.filter((l: any) => {
          if (l.status === "rejected") return false;
          const start = l.startDate || l.date || "";
          const end   = l.endDate   || l.date || "";
          return start <= todayStr && todayStr <= end;
        });
        const dailyOnLeaveMap: Record<string, string[]> = await kv.get("rotation_daily_onleave") || {};
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

        const anomaliStr = Array.isArray(ozet.anomaliler) && ozet.anomaliler.length > 0
          ? ozet.anomaliler.map((a: any) => `  ⚠️ ${a.mekanEmoji} ${a.mekan}: ${a.type}`).join("\n")
          : "  Anomali yok.";

        const personelStr = Array.isArray(ozet.personelSiralama)
          ? ozet.personelSiralama.map((p: any) => `  • ${p.ad}: ${p.satis} satış, ₺${Number(p.ciro).toLocaleString("tr-TR")}`).join("\n")
          : "  Veri yok.";

        const odemeStr = ozet.odemeDagilimi
          ? `Nakit: ₺${Number(ozet.odemeDagilimi.cash).toLocaleString("tr-TR")}, Kart: ₺${Number(ozet.odemeDagilimi.card).toLocaleString("tr-TR")}, IBAN: ₺${Number(ozet.odemeDagilimi.iban).toLocaleString("tr-TR")}, Döviz: ₺${Number(ozet.odemeDagilimi.foreign).toLocaleString("tr-TR")}`
          : "Veri yok.";

        ozetContext = `
--- BUGÜNKÜ OPERASYON VERİLERİ (${ozet.tarih || "bugün"}) ---
Toplam Ciro: ₺${Number(ozet.toplamCiro).toLocaleString("tr-TR")} | Satış: ${ozet.toplamSatisAdet} adet | İskonto: ₺${Number(ozet.toplamIskonto).toLocaleString("tr-TR")} | Fotoğraf: ${ozet.toplamKare} kare
Aktif Mekan: ${ozet.aktifMekanSayisi}/${ozet.mekanSayisi}

MEKANLAR:
${mekanlarStr}

GENEL STOK (tüm mekanlar toplamı):
${stokStr}

MEKAN BAZLI STOK DETAYI:
${mekanStokStr}

ANOMALİLER:
${anomaliStr}

PERSONEL SIRALAMASI (ciro bazlı):
${personelStr}

BUGÜN İZİNLİ PERSONEL:
${izinlerStr}

İZİN GEÇMİŞİ (son 90 gün + gelecek onaylılar):
${izinGecmisiStr}

ÖDEME DAĞILIMI: ${odemeStr}
--- VERİ SONU ---`;
      } else {
        // Ozet yoksa sadece izin bilgisini ver
        ozetContext = `
--- YÖNETİCİ VERİLERİ ---
Bugün için satış/stok verisi henüz girilmemiş veya yüklenmemiş.

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
        const allLeaves: any[] = await kv.getByPrefix("rotation_leave_") || [];
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
        const allPrimler: any[] = await kv.getByPrefix("prim_odendi_") || [];
        // prim key formatı: prim_odendi_{mekanId}_{tarih}_{ki}_{safeAd}
        // stok_gunluk_ kayıtlarından bu kullanıcının prim verilerini bulmak için
        // personelPrimTakip endpoint'indeki mantığı kullanalım
        const mekanlarList: any[] = await kv.getByPrefix("mekan_").catch(() => []);
        const stokKayitlar: any[] = await kv.getByPrefix("stok_gunluk_").catch(() => []);
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

      // 4. Kişisel görevler (rotation_task'tan)
      let gorevStr = "  Veri yok.";
      try {
        const allTasks: any[] = await kv.getByPrefix("rotation_task_") || [];
        const myTasks = allTasks.filter((t: any) => {
          const personList: any[] = Array.isArray(t.personnel) ? t.personnel : [];
          return personList.some((p: any) => p.id === user.id || p.name === userName);
        });
        if (myTasks.length > 0) {
          gorevStr = myTasks.slice(-8).map((t: any) =>
            `  • ${t.mekanName || t.mekanId || "Mekan"} — ${t.date || "?"} | ${t.completed ? "✅ Tamamlandı" : "⏳ Devam"}`
          ).join("\n");
        }
      } catch (e) {
        console.log("[AI] Görev çekme hatası:", e);
      }

      ozetContext = `
--- KİŞİSEL VERİLER: ${userName || "Kullanıcı"} ---
ÖNEMLİ: Bu kullanıcının yalnızca kendi verileri aşağıdadır. Başka personelin finansal veya kişisel bilgilerini paylaşma.

GENEL STOK (tüm mekanlar toplamı):
${stokStr}

MEKAN BAZLI STOK DETAYI:
${mekanStokStr}

İZİN TALEPLERİM:
${izinStr}

PRİM BİLGİLERİM:
${primStr}

ATANMIŞ GÖREVLERİM:
${gorevStr}
--- VERİ SONU ---`;
    }

    const rolKisitlamasi = userRole !== "yonetici"
      ? `\nKRİTİK KISITLAMA: Finansal veriler (ciro, gelir, ödeme dağılımı, diğer personelin primleri, işletme gelirleri) kesinlikle paylaşılmaz. Sadece stok durumu ve kullanıcının kendi kişisel verileri (izin, prim, görev) hakkında yanıt ver.`
      : "";

    const systemPrompt = `Sen "Aspect AI" adlı bir turistik fotoğrafçılık işletmesi asistanısın. İşletme adı: Aspect Operations.
Kullanıcı: ${userName || "Kullanıcı"} | Rol: ${userRole || "personel"}
Türkçe yanıt ver. Kısa ve net ol. Sayısal verileri kullanarak somut cevaplar ver. Markdown bold (**) kullanabilirsin.
STOK SORULARI: "Genel stok" veya "toplam stok" sorulunca GENEL STOK bölümünü kullan. "[Mekan adı] stok" veya "[Mekan adı] stoğu" gibi mekan adı geçen sorularda MEKAN BAZLI STOK DETAYI bölümünü kullan. Her iki bölüm de ayrıdır — karıştırma.${rolKisitlamasi}
${ozetContext}
${systemContext || ""}`;

    const openAIMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content || m.text || "",
      })),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openAIMessages,
        max_tokens: 800,
        temperature: 0.65,
      }),
    });

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

    const tumSkorlar: any[] = await kv.getByPrefix("game_skor_") || [];

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

    await kv.set(`game_skor_${id}`, kayit);
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
    const tumSkorlar: any[] = await kv.getByPrefix("game_quest_skor_") || [];

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

    await kv.set(`game_quest_skor_${id}`, kayit);
    console.log(`Quest skor: ${isim} → ${skor} (Seviye ${seviye})`);
    return c.json({ kayit });
  } catch (err) {
    console.log("Quest skor error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

Deno.serve(async (req) => {
  // Supabase Edge Functions'da OPTIONS preflight istekleri gateway tarafından kesilebilir.
  // Bu nedenle OPTIONS'ı Hono'ya göndermeden önce burada açıkça handle ediyoruz.
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-access-token',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '600',
      },
    });
  }
  return app.fetch(req);
});