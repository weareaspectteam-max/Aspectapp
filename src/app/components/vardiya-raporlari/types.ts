import type { UserRole } from '../login';

/* ─────────────────────── Types ─────────────────────── */
export interface UrunSatir {
  urun: string;
  adet: number;
  toplamTL: number;
}

export interface PersonelSatis {
  id: string;
  ad: string;
  avatar: string;
  kare: number;
  nakitTL: number;
  ibanTL: number;
  krediTL: number;
  toplamTL: number;
  satirlar: UrunSatir[];
  gunlukMaas?: number;
  hakedisDahil?: boolean;
  gecGiris?: boolean;
  gecGirisDk?: number;
}

export interface YaziciSayac {
  ad: string;
  baslangic: number;
  bitis: number;
  ribonDegisim: number;
  iadeFotograf: number;
  kullanilanBaski: number;
  cikisAdedi: number;
  satilanFotograf: number;
  kagitTipiAdi?: string | null;
  kapasitePerTakim?: number;
  birimMaliyet?: number;
  yaziciMaliyet?: number;
  serialNumber?: string;
}

export interface Anomali {
  tip: 'stok' | 'yazici';
  aciklama: string;
}

export interface VardiyaKayit {
  id: string;
  mekanId: string;
  mekan: string;
  mekanEmoji: string;
  mekanColor: string;
  tarih: string;
  acilisSaat: string;
  kapanisSaat: string;
  printType: 'tam' | 'yarim' | null;
  personeller: PersonelSatis[];
  yazicilar: YaziciSayac[];
  anomaliler: Anomali[];
  albumler: Record<string, number>;
  toplamKare: number;
  toplamIade: number;
  stokBaslangic: number;
  stokBitis: number;
  toplamIskonto: number;
  toplamCiro: number;
  nakitToplamTL: number;
  ibanToplamTL: number;
  krediToplamTL: number;
  albumMaliyeti: number;
  baskiMaliyeti: number;
  baskiPaperName: string | null;
  personelMaasGideri?: number;
  mekanGunlukKira: number;
  kotaKademeleri?: any[];
  gecGirisSayisi?: number;
  primBilgi?: {
    kademeIndex: number;
    kademeHedef: number;
    topKademePrim: number;
    toplamPrim: number;
    toplamKademe: number;
    personelSayisi: number;
    coklu: boolean;
  } | null;
}

export interface FiltreProps {
  filtreMekan: string; setFiltreMekan: (v: string) => void;
  filtreTarihBas: string; setFiltreTarihBas: (v: string) => void;
  filtreTarihBit: string; setFiltreTarihBit: (v: string) => void;
  mekanlar: { id: string; ad: string }[];
  onReset: () => void;
  onAra: () => void;
}

export interface Props {
  userName: string;
  userRole: UserRole;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}
