/**
 * STOCK SERVICE
 * Stok yönetimi için Supabase KV Store API entegrasyonu
 */

import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';
import { bizDateStr } from '../lib/date';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

export interface StokSayim {
  album3: number;
  album5: number;
  album7: number;
  album9: number;
  album11: number;
  album13: number;
  album15: number;
  // Tam/yarım format (yeni)
  album3_tam?: number; album3_yarim?: number;
  album5_tam?: number; album5_yarim?: number;
  album7_tam?: number; album7_yarim?: number;
  album9_tam?: number; album9_yarim?: number;
  album11_tam?: number; album11_yarim?: number;
  album13_tam?: number; album13_yarim?: number;
  album15_tam?: number; album15_yarim?: number;
  paspartu: number;
  ribon: number;                          // Toplam (geriye uyumluluk + sum of ribonlar)
  ribonlar?: Record<string, number>;      // kagitTipiId → takım sayısı
  [key: string]: any;                     // Dinamik alan desteği
}

export const bosStok = (): StokSayim => ({
  album3: 0, album5: 0, album7: 0, album9: 0,
  album11: 0, album13: 0, album15: 0, paspartu: 0, ribon: 0, ribonlar: {},
});

/** ribonlar varsa ribon toplamını yeniden hesaplar */
export const normalizeRibon = (sayim: StokSayim): StokSayim => {
  if (sayim.ribonlar && Object.keys(sayim.ribonlar).length > 0) {
    sayim.ribon = Object.values(sayim.ribonlar).reduce((s, v) => s + (v || 0), 0);
  }
  return sayim;
};

export interface VardiyaSatis {
  id: string;
  items: { product: string; quantity: number; unitPrice: number; color: string; dijital?: boolean }[];
  totalPrice: number;
  discount: number;
  finalPrice: number;
  paymentMethod: 'cash' | 'iban' | 'card';
  currency: string;
  currencyPrice?: number | null;
  timestamp: string;
  kaydeden?: string;
  kaydedenId?: string;
  iptal: boolean;
  iptalNeden?: string | null;
  iptalZamani?: string | null;
  iptalEden?: string;
}

export interface KareKayit {
  id: string;
  photographerName: string;
  photographerId: string;
  frameCount: number;
  timestamp: string;
  kaydeden?: string;
  kaydedenId?: string;
}

export interface StokGunluk {
  mekanId: string;
  tarih: string;
  acilis?: StokSayim;
  acilisNot?: string;
  acilisYapildi?: boolean;
  acilisZamani?: string;
  acilisYapanAd?: string;
  acilisAnomali?: Partial<StokSayim>;
  kapanish?: StokSayim;
  kapanisNot?: string;
  kapanisYapildi?: boolean;
  kapanisZamani?: string;
  kapanisYapanAd?: string;
  kapanisAnomali?: Partial<StokSayim>;
  kapanisBeklenen?: StokSayim;
  satislar?: VardiyaSatis[];
  kareKayitlari?: KareKayit[];
}

export interface StokEkleme {
  id: string;
  mekanId: string;
  tarih: string;
  miktar: Partial<StokSayim>;
  not?: string;
  girenKisiAd: string;
  girenZaman: string;
}

export interface Aktarim {
  id: string;
  kaynakMekanId: string;
  hedefMekanId: string;
  tarih: string;
  miktar: Partial<StokSayim>;
  not?: string;
  durum: 'bekliyor' | 'onaylandi' | 'iptal';
  gonderenKisiAd: string;
  gonderimZamani: string;
  alanKisiAd?: string;
  onayZamani?: string;
  gercekMiktar?: Partial<StokSayim>;
  miktarAnomali?: Partial<StokSayim>;
}

export interface GunlukStokResponse {
  bugun: StokGunluk | null;
  dunKapanis: StokSayim | null;
  eklemeler: StokEkleme[];
  bekleyenAktarimlar: Aktarim[];
  mekanYazicilari?: MekanYazici[];
}

// Ekipman kaydındaki yazıcı (GET /stok/gunluk cevabında gelir)
export interface MekanYazici {
  ekipmanId: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  lastEndCounter: number | null;
  lastEndTarih: string | null;
  lastEndRibonMevcut: number | null;
}

// Bugünün tarihini YYYY-MM-DD formatında döndür (05:00 TR kırılımlı iş günü)
export const bugunTarih = (): string => {
  return bizDateStr();
};

// Günlük stok verisini getir (dünün kapanışı dahil)
export const getGunlukStok = async (mekanId: string, tarih: string): Promise<GunlukStokResponse> => {
  try {
    const res = await fetch(`${API_BASE}/stok/gunluk/${mekanId}/${tarih}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      console.error('getGunlukStok error:', res.status, await res.text());
      return { bugun: null, dunKapanis: null, eklemeler: [], bekleyenAktarimlar: [] };
    }
    return await res.json();
  } catch (err) {
    console.error('getGunlukStok exception:', err);
    return { bugun: null, dunKapanis: null, eklemeler: [], bekleyenAktarimlar: [] };
  }
};

// Açılış kaydı yap
export const postAcilis = async (
  mekanId: string,
  tarih: string,
  sayim: StokSayim,
  not?: string,
  printerData?: Array<{
    ekipmanId: string;
    label: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    startCounter: number;
  }>,
  photo?: string | null
): Promise<{ kayit: StokGunluk; anomali: Partial<StokSayim>; printerAnomali?: any[] } | null> => {
  try {
    const res = await fetch(`${API_BASE}/stok/acilis`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ mekanId, tarih, sayim, not, printerData: printerData || [], photo: photo || undefined }),
    });
    if (!res.ok) {
      console.error('postAcilis error:', res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('postAcilis exception:', err);
    return null;
  }
};

// Kapanış kaydı yap
export interface PrinterKapanis {
  id: string;
  ekipmanId?: string;
  label: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  startCounter: number;
  endCounter: number;
  ribonDegisim: number;
  iadeFotograf: number;
  ribonMevcut?: number;
}

export const postKapanis = async (
  mekanId: string,
  tarih: string,
  sayim: StokSayim,
  not?: string,
  printerData?: PrinterKapanis[],
  photo?: string | null
): Promise<{ kayit: StokGunluk; anomali: Partial<StokSayim>; beklenen: StokSayim } | { __hata: string } | null> => {
  try {
    const res = await fetch(`${API_BASE}/stok/kapanis`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ mekanId, tarih, sayim, not, printerData: printerData || [], photo: photo || undefined }),
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try { const d = await res.json(); errMsg = d.error || errMsg; } catch { /* ignore */ }
      console.error('postKapanis error:', res.status, errMsg);
      return { __hata: errMsg };
    }
    return await res.json();
  } catch (err) {
    console.error('postKapanis exception:', err);
    return null;
  }
};

// Gün içi stok ekleme
export const postStokEkleme = async (
  mekanId: string,
  tarih: string,
  miktar: Partial<StokSayim>,
  not?: string
): Promise<StokEkleme | null> => {
  try {
    const res = await fetch(`${API_BASE}/stok/ekleme`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ mekanId, tarih, miktar, not }),
    });
    if (!res.ok) {
      console.error('postStokEkleme error:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.ekleme;
  } catch (err) {
    console.error('postStokEkleme exception:', err);
    return null;
  }
};

// Aktarım oluştur
export const postAktarim = async (
  kaynakMekanId: string,
  hedefMekanId: string,
  tarih: string,
  miktar: Partial<StokSayim>,
  not?: string
): Promise<Aktarim | null> => {
  try {
    const res = await fetch(`${API_BASE}/aktarim`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ kaynakMekanId, hedefMekanId, tarih, miktar, not }),
    });
    if (!res.ok) {
      console.error('postAktarim error:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.aktarim;
  } catch (err) {
    console.error('postAktarim exception:', err);
    return null;
  }
};

// Aktarım onayla
export const putAktarimOnayla = async (
  id: string,
  gercekMiktar: Partial<StokSayim>
): Promise<{ aktarim: Aktarim; miktarAnomali: Partial<StokSayim> } | null> => {
  try {
    const res = await fetch(`${API_BASE}/aktarim/${id}/onayla`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ gercekMiktar }),
    });
    if (!res.ok) {
      console.error('putAktarimOnayla error:', res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('putAktarimOnayla exception:', err);
    return null;
  }
};

// Aktarım iptal
export const putAktarimIptal = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/aktarim/${id}/iptal`, {
      method: 'PUT',
      headers: await authHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error('putAktarimIptal exception:', err);
    return false;
  }
};

// Bekleyen aktarımlar
export const getBekleyenAktarimlar = async (mekanId: string): Promise<Aktarim[]> => {
  try {
    const res = await fetch(`${API_BASE}/aktarim/bekleyen/${mekanId}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.aktarimlar || [];
  } catch (err) {
    console.error('getBekleyenAktarimlar exception:', err);
    return [];
  }
};

// Alan adları (UI için) — paspartu hariç
export const stokAlanAdi: Record<string, string> = {
  album3: '3 Kare',
  album5: '5 Kare',
  album7: '7 Kare',
  album9: '9 Kare',
  album11: '11 Kare',
  album3_tam: '3 Kare Tam', album3_yarim: '3 Kare Yarım',
  album5_tam: '5 Kare Tam', album5_yarim: '5 Kare Yarım',
  album7_tam: '7 Kare Tam', album7_yarim: '7 Kare Yarım',
  album9_tam: '9 Kare Tam', album9_yarim: '9 Kare Yarım',
  album11_tam: '11 Kare Tam', album11_yarim: '11 Kare Yarım',
  album13_tam: '13 Kare Tam', album13_yarim: '13 Kare Yarım',
  album15_tam: '15 Kare Tam', album15_yarim: '15 Kare Yarım',
  album13: '13 Kare',
  album15: '15 Kare',
  ribon: 'Ribon Takımı',
};

export const stokAlanEmoji: Record<string, string> = {
  album3: '📘', album5: '📗', album7: '📙', album9: '📕',
  album11: '📔', album13: '📒', album15: '📓',
  album3_tam: '📘', album3_yarim: '📘', album5_tam: '📗', album5_yarim: '📗',
  album7_tam: '📙', album7_yarim: '📙', album9_tam: '📕', album9_yarim: '📕',
  album11_tam: '📔', album11_yarim: '📔', album13_tam: '📒', album13_yarim: '📒',
  album15_tam: '📓', album15_yarim: '📓',
  ribon: '🎞️',
};