-- 1. deliveries tablosu
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  order_id TEXT,
  vendor_id TEXT,
  status TEXT DEFAULT 'beklemede',
  lines JSONB DEFAULT '[]',
  delivery_date DATE,
  delivery_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_company ON deliveries(company_id, order_id);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 2. supplier_payments tablosu
CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'aspect',
  order_id TEXT,
  vendor_id TEXT,
  amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'TRY',
  payment_method TEXT,
  payment_date DATE,
  status TEXT DEFAULT 'beklemede',
  supplier_confirmed BOOLEAN DEFAULT FALSE,
  supplier_confirmed_at TIMESTAMPTZ,
  tip TEXT,
  source_gider_id TEXT,
  created_by TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_company ON supplier_payments(company_id, vendor_id);
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- 3. purchase_orders tablosunu genişlet
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
