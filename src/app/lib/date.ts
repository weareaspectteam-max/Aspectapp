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
