-- ══════════════════════════════════════════════════════════════
-- KASA v2 — Hareket Defteri (event-sourced, append-only)
-- Bakiye HİÇ saklanmaz; her zaman SUM(giriş) − SUM(çıkış) ile türetilir.
-- Satış cirosu buraya YAZILMAZ (sales/stok_gunluk'tan canlı türetilir).
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kasa_hareket (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL DEFAULT 'aspect',
  tarih        DATE NOT NULL,                                   -- iş günü
  ts           TIMESTAMPTZ DEFAULT NOW(),                       -- kesin zaman
  yon          TEXT NOT NULL CHECK (yon IN ('giris','cikis')),
  pot          TEXT NOT NULL CHECK (pot IN ('nakit','banka')),
  tutar        NUMERIC(14,2) NOT NULL CHECK (tutar >= 0),
  kategori     TEXT,                                            -- yakit/market/avans/hakedis/malzeme/ekipman/kira/maas/ortak/gelir/acilis/duzeltme
  aciklama     TEXT,
  kaynak       TEXT DEFAULT 'manuel',                           -- manuel/acilis/gider/gelir/maas/kira/tedarikci/hakedis/ortak/duzeltme
  kaynak_id    TEXT,                                            -- idempotency / referans
  ortak_id     TEXT,                                            -- ortak hareketleri
  iptal        BOOLEAN DEFAULT FALSE,                           -- Geri Al ile iptal (bakiyeden düşülmez), satır SİLİNMEZ (iz kalır)
  iptal_ts     TIMESTAMPTZ,
  iptal_by     TEXT,
  olusturan    TEXT,
  olusturan_id TEXT,
  extra_data   JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kasa_hareket_company_tarih ON kasa_hareket(company_id, tarih);
CREATE INDEX IF NOT EXISTS idx_kasa_hareket_kaynak       ON kasa_hareket(company_id, kaynak, kaynak_id);
CREATE INDEX IF NOT EXISTS idx_kasa_hareket_ortak        ON kasa_hareket(company_id, ortak_id);

ALTER TABLE kasa_hareket ENABLE ROW LEVEL SECURITY;
-- Edge Functions service_role ile çağrılır; ayrı policy gerekmez.
