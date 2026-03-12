import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
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

// Helper: verify caller and return user
// Supabase projesi ES256 (asimetrik) JWT kullandığından gateway bunu reddedebilir.
// Çözüm: gateway için Authorization: Bearer <anonKey> (HS256), kullanıcı için X-Access-Token: <userJWT> (ES256).
// Sadece X-Access-Token'a bakar — Authorization'daki anonKey bir kullanıcı JWT'si değildir.
const verifyToken = async (c: any) => {
  const xToken = c.req.header("X-Access-Token");

  // Sadece X-Access-Token kullan; Authorization header'ı Supabase gateway içindir,
  // anonKey ile auth.getUser() her zaman başarısız olur.
  if (!xToken) {
    console.log("[verifyToken] X-Access-Token header eksik — 401");
    return null;
  }

  try {
    const supabase = getAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser(xToken);
    if (error) {
      console.log("[verifyToken] getUser hatası:", error.message);
      return null;
    }
    if (!user) {
      console.log("[verifyToken] getUser: kullanıcı bulunamadı");
      return null;
    }
    return user;
  } catch (err) {
    console.log("[verifyToken] beklenmeyen hata:", err);
    return null;
  }
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

    // Canlı çek: USD baz alarak TRY, EUR, GBP
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
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
    const bugun = await kv.get(`stok_gunluk_${mekanId}_${tarih}`);

    const dunTarih = new Date(tarih);
    dunTarih.setDate(dunTarih.getDate() - 1);
    const dunStr = dunTarih.toISOString().split("T")[0];
    const dun = await kv.get(`stok_gunluk_${mekanId}_${dunStr}`);

    const tumEklemeler = await kv.getByPrefix(`stok_ekleme_`);
    const eklemeler = tumEklemeler.filter(
      (e: any) => e.mekanId === mekanId && e.tarih === tarih
    );

    const tumAktarimlar = await kv.getByPrefix(`stok_aktarim_`);
    const bekleyenAktarimlar = tumAktarimlar.filter(
      (a: any) => a.hedefMekanId === mekanId && a.durum === "bekliyor"
    );

    return c.json({
      bugun: bugun || null,
      dunKapanis: dun?.kapanish || null,
      eklemeler,
      bekleyenAktarimlar,
    });
  } catch (err) {
    console.log("Get stok gunluk error:", err);
    return c.json({ error: `Sunucu hatası: ${err}` }, 500);
  }
});

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

    const { mekanId, tarih, sayim, not: acilisNot } = await c.req.json();
    if (!mekanId || !tarih || !sayim) {
      return c.json({ error: "mekanId, tarih ve sayim zorunludur." }, 400);
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
    };

    await kv.set(`stok_gunluk_${mekanId}_${tarih}`, kayit);
    console.log(`Stok açılışı: ${mekanId} / ${tarih} by ${user.id}`);
    return c.json({ kayit, anomali });
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

    const existing = await kv.get(`stok_gunluk_${mekanId}_${tarih}`);
    if (!existing) return c.json({ error: "Önce açılış kaydı yapılmalıdır." }, 400);

    const tumEklemeler = await kv.getByPrefix(`stok_ekleme_`);
    const eklemeler = tumEklemeler.filter(
      (e: any) => e.mekanId === mekanId && e.tarih === tarih
    );
    const tumAktarimlar = await kv.getByPrefix(`stok_aktarim_`);
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
    const beklenen: Record<string, number> = {};
    for (const alan of alanlar) {
      let toplam = existing.acilis?.[alan] || 0;
      for (const ek of eklemeler) toplam += ek.miktar?.[alan] || 0;
      for (const ak of gelenOnaylandi) toplam += ak.gercekMiktar?.[alan] || 0;
      for (const ak of gidenOnaylandi) toplam -= ak.gercekMiktar?.[alan] || 0;
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
    // birimMaliyet: tam kağıtta boxPrice/pcsPerBox — yarım kağıtta da aynı (cikis 2x, birim 0.5x → toplam aynı)
    const birimMaliyetTam = paper
      ? (Number(paper.boxPrice) / Number(paper.pcsPerBox))
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
      // toplamMaliyet: kullanilanBaskı × birimMaliyetTam (tek alan, tam/yarım fark etmez)
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
      birimMaliyet: birimMaliyetTam > 0 ? parseFloat(birimMaliyetTam.toFixed(6)) : 0,
      currency: paper?.currency || "TRY",
    };

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
    };

    await kv.set(`stok_gunluk_${mekanId}_${tarih}`, kayit);
    console.log(`Stok kapanışı: ${mekanId} / ${tarih} by ${user.id} | baskı: ${vardiyaToplam.toplamKullanilanBaskı} | satılan: ${vardiyaToplam.toplamSatılanFotograf} | maliyet: ${vardiyaToplam.toplamMaliyet} ${vardiyaToplam.currency}`);
    return c.json({ kayit, anomali, beklenen });
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
      const stok = kayit?.kapanish || kayit?.acilis || null;
      const vardiyaDurumu = kayit
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
        tarih: today,
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
    if (!["admin", "yonetici"].includes(role)) return c.json({ error: "Yalnızca admin ve yönetici işlem yapabilir." }, 403);

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
    if (!["admin", "yonetici"].includes(role)) return c.json({ error: "Yalnızca admin ve yönetici işlem yapabilir." }, 403);

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
    if (!["admin", "yonetici"].includes(role)) return c.json({ error: "Yetki yok." }, 403);

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
    if (role !== "yonetici") return c.json({ error: "Yalnızca yönetici stok güncelleyebilir." }, 403);

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
    kayit.acilis = { ...(kayit.acilis || {}), ...stokObj };
    kayit.acilisYapildi = true;
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
    if (role !== "yonetici") return c.json({ error: "Yalnızca yönetici stok sıfırlayabilir." }, 403);

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
    const stokToplam: Record<string, number> = {};
    for (const alan of stokAlanlari) stokToplam[alan] = 0;
    for (const kayit of bugunKayitlar) {
      const stok = kayit.kapanish || kayit.acilis;
      if (stok) {
        for (const alan of stokAlanlari) stokToplam[alan] += Number(stok[alan]) || 0;
      }
    }

    // Stok durumu değerlendirme
    const stokDurum = stokAlanlari.map(alan => {
      const adet = stokToplam[alan];
      const etiketler: Record<string, string> = {
        album3:"3 Kare Albüm", album5:"5 Kare Albüm", album7:"7 Kare Albüm",
        album9:"9 Kare Albüm", album11:"11 Kare Albüm", album13:"13 Kare Albüm",
        album15:"15 Kare Albüm", paspartu:"Paspartu", ribon:"Ribon Takımı",
      };
      return {
        alan,
        name: etiketler[alan] || alan,
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
      const acilisVar  = k.acilisAnomali  && Object.keys(k.acilisAnomali).length  > 0;
      const kapanisVar = k.kapanisAnomali && Object.keys(k.kapanisAnomali).length > 0;
      return acilisVar || kapanisVar;
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
    }

    // ── 6. Filtrele ve sırala ──
    let puanListesi = Object.values(puanMap);
    if (userIdQ) {
      puanListesi = puanListesi.filter((p: any) => p.userId === userIdQ);
    }

    const toplamAnomaliOlayi = anomaliKayitlar.reduce((sum: number, k: any) => {
      if (k.acilisAnomali  && Object.keys(k.acilisAnomali).length  > 0) sum++;
      if (k.kapanisAnomali && Object.keys(k.kapanisAnomali).length > 0) sum++;
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
    return c.json({ ekipmanlar: sirali });
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

    await kv.del(id);

    console.log(`Malzeme silindi: ${mevcut.brand} ${mevcut.model} — ${user.user_metadata?.full_name}`);
    return c.json({ basarili: true });
  } catch (err) {
    console.log("Malzeme sil error:", err);
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