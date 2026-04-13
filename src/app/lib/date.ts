/**
 * Cihazın yerel saatine göre bugünün tarihini YYYY-MM-DD formatında döndürür.
 * NOT: new Date().toISOString() UTC kullanır → Türkiye'de (UTC+3) gün 03:00'da değişir.
 * Bu fonksiyon yerel saati kullanarak gün değişimini doğru yapar (00:00 yerel).
 */
export const localDateStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Verilen Date nesnesini YYYY-MM-DD formatına çevirir (lokal saat ile).
 */
export const toLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * ── İŞ GÜNÜ TARİHİ (Business Date) ─────────────────────────────────────────
 * Turistik fotoğrafçılık vardiyaları gece geçer; iş günü 05:00 TR'de başlar.
 * Kural:  TR saati 00:00 – 06:59 → hâlâ önceki takvim günüdür.
 *         TR saati 07:00+        → yeni iş günüdür.
 * Backend bizDateTR() ile aynı kırılım (< 7) kullanılmalı.
 *
 * Örnek:
 *   TR 03:45 → bizDateStr() = dünün tarihi  (vardiya henüz bitmedi)
 *   TR 07:01 → bizDateStr() = bugünün tarihi (yeni vardiya dönemi)
 */
export const bizDateStr = (): string => {
  // Date.now() + 3h → UTC offset'i ile TR saatini UTC üzerinden okuruz
  const trMs  = Date.now() + 3 * 60 * 60 * 1000;
  const trHour = new Date(trMs).getUTCHours();
  // TR 00:00-06:59 → önceki iş günü
  if (trHour < 7) {
    return new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  return new Date(trMs).toISOString().split('T')[0];
};