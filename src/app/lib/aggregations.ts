/**
 * Mekan/satış istatistikleri için aggregation yardımcıları.
 * Frontend tarafında gruplamayı, YoY karşılaştırmayı ve dağılımları yapar.
 */

const TR_AYLAR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const TR_GUNLER = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];

export interface AyOzeti {
  ay: string;             // "2026-04"
  label: string;          // "Nis 2026"
  ciro: number;
  musteri: number;
  iadeAdet: number;
  indirimTL: number;
  brutoCiro: number;
  anomali: number;
}

export interface GunDagilim {
  gun: string;            // "Pzt"
  ciro: number;
  satis: number;
  musteri: number;
}

export interface SaatDagilim {
  saat: number;           // 0-23
  satis: number;
  ciro: number;
}

/**
 * YYYY-MM-DD tarihinden YYYY-MM ay anahtarına çevirir.
 */
export const tarihToAy = (tarih: string): string => {
  if (!tarih || tarih.length < 7) return '';
  return tarih.slice(0, 7);
};

/**
 * "2026-04" → "Nis 2026" gibi insan-okur etiket.
 */
export const ayLabel = (ay: string): string => {
  if (!ay || ay.length < 7) return ay;
  const [yil, ayNo] = ay.split('-');
  const idx = parseInt(ayNo, 10) - 1;
  if (idx < 0 || idx > 11) return ay;
  return `${TR_AYLAR[idx]} ${yil}`;
};

/**
 * İki dönem rakamı arasında yüzde değişim hesaplar.
 * Önceki 0 ise: current 0 → 0, current > 0 → 100.
 */
export const calculateYoY = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
};

/**
 * Tarih aralığını eşit uzunlukta önceki döneme kaydırır.
 * Örn: 2026-04-01 .. 2026-04-30 → 2026-03-02 .. 2026-03-31
 */
export const oncekiDonem = (
  baslangic: string,
  bitis: string,
): { baslangic: string; bitis: string } => {
  const b = new Date(baslangic);
  const e = new Date(bitis);
  const ms = e.getTime() - b.getTime();
  const yeniBitis = new Date(b.getTime() - 24 * 60 * 60 * 1000);
  const yeniBaslangic = new Date(yeniBitis.getTime() - ms);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { baslangic: fmt(yeniBaslangic), bitis: fmt(yeniBitis) };
};

/**
 * Geçen yıl aynı dönem.
 */
export const gecenYilAyniDonem = (
  baslangic: string,
  bitis: string,
): { baslangic: string; bitis: string } => {
  const fmt = (s: string) => {
    const d = new Date(s);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };
  return { baslangic: fmt(baslangic), bitis: fmt(bitis) };
};

/**
 * Boş ay özetlerini son N ay için döndürür (en eskiden en yeniye).
 */
export const sonNAy = (n: number): AyOzeti[] => {
  const out: AyOzeti[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ ay, label: ayLabel(ay), ciro: 0, musteri: 0, iadeAdet: 0, indirimTL: 0, brutoCiro: 0, anomali: 0 });
  }
  return out;
};

/**
 * "YYYY-MM-DD" tarihinden haftanın günü (Pzt=0..Paz=6, TR sıralaması).
 */
export const haftaninGunu = (tarih: string): number => {
  const d = new Date(tarih);
  const js = d.getDay(); // Sunday=0..Saturday=6
  return (js + 6) % 7;   // Monday=0..Sunday=6
};

/**
 * Boş haftalık dağılım şablonu.
 */
export const bosHaftaDagilim = (): GunDagilim[] =>
  TR_GUNLER.map(gun => ({ gun, ciro: 0, satis: 0, musteri: 0 }));

/**
 * Boş saatlik dağılım şablonu (0..23).
 */
export const bosSaatDagilim = (): SaatDagilim[] =>
  Array.from({ length: 24 }, (_, saat) => ({ saat, satis: 0, ciro: 0 }));

/**
 * Türkçe sayı formatı (binlik nokta).
 */
export const formatNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('tr-TR');
};

/**
 * Yüzde gösterim — 1 ondalık.
 */
export const formatPct = (n: number): string => {
  if (!Number.isFinite(n)) return '0%';
  return `${(Math.round(n * 10) / 10).toString().replace('.', ',')}%`;
};

/**
 * TL kısa biçim — 1.2 M₺, 845 K₺, 320₺ gibi.
 */
export const formatTLShort = (n: number): string => {
  if (!Number.isFinite(n)) return '0₺';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')} M₺`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(1).replace('.', ',')} K₺`;
  return `${sign}${Math.round(abs)}₺`;
};
