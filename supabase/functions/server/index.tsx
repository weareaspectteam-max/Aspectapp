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
// Her iki durumu da destekler: önce X-Access-Token, sonra Authorization header.
const verifyToken = async (c: any) => {
  const xToken = c.req.header("X-Access-Token");
  const authHeader = c.req.header("Authorization");
  const token = xToken || authHeader?.split(" ")[1];
  if (!token) return null;
  const supabase = getAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
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
// Body: { full_name?, phone? }
// ──────────────────────────────────────────
app.put("/make-server-4da0b637/auth/profile", async (c) => {
  try {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz erişim." }, 401);

    const { full_name, phone } = await c.req.json();
    const supabase = getAdminClient();

    const updatedMetadata: Record<string, string> = {
      ...user.user_metadata,
    };
    if (full_name !== undefined) updatedMetadata.full_name = full_name.trim();
    if (phone !== undefined) updatedMetadata.phone = phone.trim();

    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: updatedMetadata,
    });

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
    if (!["yonetici", "ust-mudur"].includes(callerRole)) {
      return c.json({ error: "Bu işlem için yetkiniz yok." }, 403);
    }

    const { userId, role } = await c.req.json();
    const validRoles = ["yonetici", "ust-mudur", "mudur", "operasyon", "personel", "idari", "bekleyen"];
    if (!validRoles.includes(role)) {
      return c.json({ error: "Geçersiz rol." }, 400);
    }

    const supabase = getAdminClient();
    const { data: targetData } = await supabase.auth.admin.getUserById(userId);
    if (!targetData?.user) return c.json({ error: "Kullanıcı bulunamadı." }, 404);

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
    if (!["yonetici", "ust-mudur", "mudur", "idari"].includes(callerRole)) {
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
// ──────────────────────────────────────────
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

Deno.serve(app.fetch);