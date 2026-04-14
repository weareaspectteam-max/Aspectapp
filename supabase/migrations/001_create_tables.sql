-- ══════════════════════════════════════════════════════════════
-- ASPECT APP — PostgreSQL Schema v1
-- Deno KV → PostgreSQL Migration — Aşama 1: Tablo Oluşturma
-- ══════════════════════════════════════════════════════════════

-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────
-- 1. VENUES (Mekanlar)
-- KV: mekan_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📍',
  color TEXT DEFAULT '#9dd9ea',
  photo_price NUMERIC(10,2) DEFAULT 0,
  price_currency TEXT DEFAULT 'TRY',
  yearly_rent NUMERIC(12,2) DEFAULT 0,
  profit_target NUMERIC(12,2) DEFAULT 0,
  print_type TEXT DEFAULT 'yarim' CHECK (print_type IN ('tam', 'yarim')),
  zorluk_katsayisi NUMERIC(3,1) DEFAULT 1.0,
  kare_charpani INTEGER DEFAULT 5,
  working_hours JSONB,
  kota_kademeleri JSONB,
  extra_data JSONB, -- ileride ek alanlar için
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_company ON venues(company_id);

-- ──────────────────────────────────────────
-- 2. PROFILES (Personel)
-- KV: Supabase Auth user_metadata + cost_salary_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'bekleyen',
  avatar TEXT DEFAULT '👨‍💼',
  status TEXT DEFAULT 'active',
  daily_salary NUMERIC(10,2) DEFAULT 0,
  birth_date TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(company_id, role);

-- ──────────────────────────────────────────
-- 3. SALES (Satışlar) — EN KRİTİK
-- KV: stok_gunluk_${mekanId}_${tarih}.satislar[]
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  venue_id TEXT NOT NULL,
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_price NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  final_price NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  currency TEXT DEFAULT 'TRY',
  currency_price NUMERIC(10,2),
  recorded_by_id TEXT,
  recorded_by_name TEXT,
  is_digital BOOLEAN DEFAULT FALSE,
  is_cancelled BOOLEAN DEFAULT FALSE,
  cancel_reason TEXT,
  cancel_time TIMESTAMPTZ,
  gerekce TEXT,
  idempotency_key TEXT UNIQUE,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_company_date ON sales(company_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_venue_date ON sales(venue_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_recorded_by ON sales(recorded_by_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_company_venue_date ON sales(company_id, venue_id, date);

-- ──────────────────────────────────────────
-- 4. SALE_ITEMS (Satış kalemleri)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- ──────────────────────────────────────────
-- 5. FRAME_RECORDS (Kare Kayıtları)
-- KV: stok_gunluk_${mekanId}_${tarih}.kareKayitlari[]
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS frame_records (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  venue_id TEXT NOT NULL,
  date DATE NOT NULL,
  photographer_id TEXT NOT NULL,
  photographer_name TEXT,
  frame_count INTEGER NOT NULL DEFAULT 0,
  recorded_by_id TEXT,
  recorded_by_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frames_company_date ON frame_records(company_id, date);
CREATE INDEX IF NOT EXISTS idx_frames_venue_date ON frame_records(venue_id, date);
CREATE INDEX IF NOT EXISTS idx_frames_photographer ON frame_records(photographer_id, date);

-- ──────────────────────────────────────────
-- 6. STOCK_MOVEMENTS (Stok Hareketleri)
-- KV: stok_gunluk_${mekanId}_${tarih} (açılış/kapanış/ekleme/transfer)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL DEFAULT 'aspect',
  venue_id TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('opening', 'closing', 'addition', 'transfer')),
  stock_data JSONB, -- sayım verisi
  printer_data JSONB, -- yazıcı verisi
  shift_total JSONB, -- vardiyaToplam
  anomaly_data JSONB, -- anomali
  customer_count INTEGER, -- müşteri sayısı
  performed_by_id TEXT,
  performed_by_name TEXT,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_company_date ON stock_movements(company_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_venue_date ON stock_movements(venue_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_type ON stock_movements(company_id, venue_id, date, type);

-- ──────────────────────────────────────────
-- 7. SHIFT_SESSIONS (Vardiya Check-in/out)
-- KV: checkin_${userId}_${tarih}, sessions_${userId}_${tarih}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL DEFAULT 'aspect',
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  task_id TEXT,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  late_min INTEGER DEFAULT 0,
  session_type TEXT DEFAULT 'initial' CHECK (session_type IN ('initial', 'resume')),
  location TEXT,
  location_icon TEXT,
  planned_start TEXT, -- "HH:MM"
  planned_end TEXT,   -- "HH:MM"
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_company_date ON shift_sessions(company_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shift_sessions(user_id, date);

-- ──────────────────────────────────────────
-- 8. ROTATION_TASKS (Rotasyon Görevleri)
-- KV: rotation_task_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rotation_tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  date DATE NOT NULL,
  location TEXT NOT NULL,
  location_icon TEXT DEFAULT '📍',
  start_time TEXT, -- "HH:MM"
  end_time TEXT,   -- "HH:MM"
  task_type TEXT DEFAULT 'regular',
  status TEXT DEFAULT 'draft',
  personnel JSONB DEFAULT '[]',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rotation_company_date ON rotation_tasks(company_id, date);
CREATE INDEX IF NOT EXISTS idx_rotation_status ON rotation_tasks(company_id, status, date);

-- ──────────────────────────────────────────
-- 9. LEAVE_REQUESTS (İzin Talepleri)
-- KV: rotation_leave_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  personnel_id TEXT NOT NULL,
  personnel_name TEXT,
  personnel_avatar TEXT,
  personnel_role TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER DEFAULT 1,
  type TEXT DEFAULT 'annual',
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_company ON leave_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_personnel ON leave_requests(personnel_id);

-- ──────────────────────────────────────────
-- 10. EQUIPMENT (Ekipman)
-- KV: ekipman_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  venue_id TEXT,
  name TEXT NOT NULL,
  type TEXT,
  ribon_mevcut INTEGER DEFAULT 0,
  ribon_kapasitesi INTEGER DEFAULT 0,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_company ON equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_venue ON equipment(venue_id);

-- ──────────────────────────────────────────
-- 11. OPERATING_EXPENSES (İşletme Giderleri)
-- KV: isletme_gider_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operating_expenses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  category TEXT,
  description TEXT,
  amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'TRY',
  date DATE,
  venue_id TEXT,
  recurring_id TEXT,
  payment_status TEXT DEFAULT 'pending',
  created_by TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON operating_expenses(company_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON operating_expenses(company_id, category);

-- ──────────────────────────────────────────
-- 12. OPERATING_INCOME (İşletme Gelirleri)
-- KV: isletme_gelir_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operating_income (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  description TEXT,
  amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'TRY',
  date DATE,
  source TEXT,
  created_by TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_company_date ON operating_income(company_id, date);

-- ──────────────────────────────────────────
-- 13. CASH_TRANSACTIONS (Kasa İşlemleri)
-- KV: kasa_islem_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_transactions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  type TEXT, -- 'income', 'expense', 'transfer'
  amount NUMERIC(12,2) DEFAULT 0,
  description TEXT,
  related_expense_id TEXT,
  date DATE,
  created_by TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_company_date ON cash_transactions(company_id, date);

-- ──────────────────────────────────────────
-- 14. VENDOR_ACCOUNTS (Tedarikçi/Cari)
-- KV: cost_cari_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  name TEXT NOT NULL,
  type TEXT, -- 'supplier', 'vendor'
  balance NUMERIC(12,2) DEFAULT 0,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendor_accounts(company_id);

-- ──────────────────────────────────────────
-- 15. PURCHASE_ORDERS (Siparişler)
-- KV: siparis_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  vendor_id TEXT,
  items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  total_amount NUMERIC(12,2) DEFAULT 0,
  created_by TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_company ON purchase_orders(company_id, status);

-- ──────────────────────────────────────────
-- 16. SALARIES (Maaşlar)
-- KV: cost_salary_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL DEFAULT 'aspect',
  user_id TEXT NOT NULL,
  monthly_amount NUMERIC(10,2) DEFAULT 0,
  effective_from DATE,
  effective_to DATE,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salaries_company ON salaries(company_id);
CREATE INDEX IF NOT EXISTS idx_salaries_user ON salaries(user_id);

-- ──────────────────────────────────────────
-- 17. CHAT_CHANNELS
-- KV: chat_channel_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_channels (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  name TEXT,
  type TEXT DEFAULT 'group',
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_company ON chat_channels(company_id);

-- ──────────────────────────────────────────
-- 18. CHAT_MESSAGES
-- KV: chat_msgs_${channelId}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  content TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_msgs_channel ON chat_messages(channel_id, timestamp);

-- ──────────────────────────────────────────
-- 19. NOTIFICATIONS (Bildirimler)
-- KV: notif_${userId}_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  user_id TEXT NOT NULL,
  type TEXT,
  title TEXT,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notif_company ON notifications(company_id);

-- ──────────────────────────────────────────
-- 20. ANNOUNCEMENTS (Duyurular)
-- KV: announcement_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  priority TEXT DEFAULT 'medium',
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_company ON announcements(company_id);

-- ──────────────────────────────────────────
-- 21. COMPANY_SETTINGS (Şirket Ayarları)
-- KV: cost_exchange_rates, leaderboard_config_v1, ai_role_config_v1, etc.
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  company_id TEXT NOT NULL DEFAULT 'aspect',
  key TEXT NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, key)
);

-- ──────────────────────────────────────────
-- 22. CANCEL_REQUESTS (İptal Talepleri)
-- KV: iptal_talep_${id}
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cancel_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  sale_id TEXT,
  venue_id TEXT,
  date DATE,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  requested_by_id TEXT,
  requested_by_name TEXT,
  approved_by_id TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancel_company ON cancel_requests(company_id, status);

-- ══════════════════════════════════════════════════════════════
-- RLS (Row Level Security) — her şirket sadece kendi verisini görsün
-- ══════════════════════════════════════════════════════════════

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE frame_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancel_requests ENABLE ROW LEVEL SECURITY;

-- Service role (Edge Functions) her şeye erişebilir
-- Tablolar service_role key ile çağrılacağı için ayrı policy gerekmez
-- İleride client-side erişim eklenirse company_id bazlı policy eklenir

-- ══════════════════════════════════════════════════════════════
-- VIEW'lar (türetilmiş veri)
-- ══════════════════════════════════════════════════════════════

-- Günlük stok özeti
CREATE OR REPLACE VIEW daily_stock_summary AS
SELECT
  sm.company_id,
  sm.venue_id,
  sm.date,
  (SELECT s.stock_data FROM stock_movements s WHERE s.venue_id = sm.venue_id AND s.date = sm.date AND s.company_id = sm.company_id AND s.type = 'opening' LIMIT 1) AS opening_stock,
  (SELECT s.stock_data FROM stock_movements s WHERE s.venue_id = sm.venue_id AND s.date = sm.date AND s.company_id = sm.company_id AND s.type = 'closing' LIMIT 1) AS closing_stock,
  (SELECT s.shift_total FROM stock_movements s WHERE s.venue_id = sm.venue_id AND s.date = sm.date AND s.company_id = sm.company_id AND s.type = 'closing' LIMIT 1) AS shift_total,
  (SELECT s.printer_data FROM stock_movements s WHERE s.venue_id = sm.venue_id AND s.date = sm.date AND s.company_id = sm.company_id AND s.type = 'closing' LIMIT 1) AS printer_data,
  MAX(sm.customer_count) AS customer_count,
  BOOL_OR(sm.type = 'opening') AS opening_done,
  BOOL_OR(sm.type = 'closing') AS closing_done
FROM stock_movements sm
GROUP BY sm.company_id, sm.venue_id, sm.date;

-- Günlük satış özeti
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT
  s.company_id,
  s.venue_id,
  s.date,
  COUNT(*) FILTER (WHERE NOT s.is_cancelled) AS sale_count,
  COALESCE(SUM(s.final_price) FILTER (WHERE NOT s.is_cancelled), 0) AS total_revenue,
  COALESCE(SUM(s.discount) FILTER (WHERE NOT s.is_cancelled), 0) AS total_discount,
  COUNT(DISTINCT s.recorded_by_id) AS seller_count
FROM sales s
GROUP BY s.company_id, s.venue_id, s.date;

-- Günlük kare özeti
CREATE OR REPLACE VIEW daily_frame_summary AS
SELECT
  f.company_id,
  f.venue_id,
  f.date,
  SUM(f.frame_count) AS total_frames,
  COUNT(DISTINCT f.photographer_id) AS photographer_count
FROM frame_records f
GROUP BY f.company_id, f.venue_id, f.date;

-- ══════════════════════════════════════════════════════════════
-- DONE — Aşama 1 tamamlandı
-- ══════════════════════════════════════════════════════════════
