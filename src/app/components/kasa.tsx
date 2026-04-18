import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet, Plus, Trash2, ChevronLeft, ChevronRight, Eye, EyeOff,
  Loader2, RefreshCw, AlertTriangle, ArrowRightLeft, TrendingUp,
  TrendingDown, CreditCard, Banknote, Building2, X, Check,
  ChevronDown, ChevronUp, CircleDollarSign, Lock, CheckCircle, Settings, HelpCircle
} from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { authHeaders, appendGhostParam } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ── Types ──────────────────────────────────────────────────────────────
interface KasaProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  userId: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface SirketKasaData {
  bakiye: number;
  devirBakiye: number;
  ayKapatildi: boolean;
  toplamDevir: number;
  toplamOdpienenGider: number;
  toplamBekleyenGider: number;
  odemeDagilimi: { nakit: number; kart: number; iban: number };
  visible: boolean;
  bekleyenDevirler: BekleyenDevir[];
  bekleyenOdemeler: any[];
  opipienenIslemler: any[];
  devirler: any[];
  islemler: Islem[];
}

interface BekleyenDevir {
  id: string;
  mekanAdi: string;
  mekanEmoji: string;
  tarih: string;
  ciro: number;
}

interface Islem {
  id: string;
  tip: 'devir' | 'gelir' | 'gider' | 'odeme';
  tutar: number;
  aciklama: string;
  kategori: string;
  tarih: string;
  mekanAdi?: string;
  mekanEmoji?: string;
  manuel?: boolean;
}

interface KisiselKasaData {
  bakiye: number;
  gelir: number;
  gider: number;
  islemler: KisiselIslem[];
}

interface KisiselIslem {
  id: string;
  tip: 'gelir' | 'gider';
  tutar: number;
  aciklama: string;
  kategori: string;
  tarih: string;
}

interface Borc {
  id: string;
  yon: 'alacak' | 'verecek';
  kisi: string;
  tutar: number;
  kalanTutar: number;
  currency?: string;
  aciklama: string;
  tarih: string;
  odemeler: { tutar: number; aciklama: string; tarih: string }[];
}

interface BorclarData {
  toplamAlacak: number;
  toplamVerecek: number;
  alacaklar: Borc[];
  verecekler: Borc[];
}

interface CariHesap {
  kisi: string;
  tip: string;
  emoji: string;
  toplamBorc: number;
  toplamOdpipipiienen: number;
  toplamSilinen: number;
  kalanBorc: number;
  hareketler: { tip: string; tutar: number; tarih: string; aciklama: string; giderId?: string }[];
}

type TabKey = 'sirket' | 'kisisel' | 'cariler' | 'borclar';

const KISISEL_KATEGORILER = ['Maaş', 'Kira', 'Market', 'Fatura', 'Yatırım', 'Diğer'];

// ── Helpers ────────────────────────────────────────────────────────────
const formatMoney = (n: number | undefined | null) => `₺${(n ?? 0).toLocaleString('tr-TR')}`;
const CUR_SYM: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };
const formatMoneyC = (n: number | undefined | null, cur?: string) => `${CUR_SYM[cur || 'TRY'] || cur || '₺'}${(n ?? 0).toLocaleString('tr-TR')}`;

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};

const getMonthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  return `${aylar[parseInt(mo) - 1]} ${y}`;
};

const shiftMonth = (m: string, dir: -1 | 1) => {
  const d = new Date(m + '-01');
  d.setMonth(d.getMonth() + dir);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ── Main Component ─────────────────────────────────────────────────────
export function Kasa({ userName, userRole, userId, onLogout, onNavigate }: KasaProps) {
  const isAdmin = userRole === 'yonetici' || userRole === 'ust-mudur';

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sirket', label: 'Şirket Kasası' },
    // Kişisel kasa ayrı sayfaya taşınacak
    { key: 'cariler', label: 'Cariler' },
    { key: 'borclar', label: '📝' },
  ];

  const [activeTab, setActiveTab] = useState<TabKey>('sirket');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());

  // ─ Şirket Kasası State ─
  const [sirketData, setSirketData] = useState<SirketKasaData | null>(null);
  const [sirketLoading, setSirketLoading] = useState(false);
  const [sirketError, setSirketError] = useState<string | null>(null);
  const [devirlerOpen, setDevirlerOpen] = useState(true);
  const [islemLimit, setIslemLimit] = useState(5);
  const [islemFiltreBas, setIslemFiltreBas] = useState('');
  const [islemFiltreBit, setIslemFiltreBit] = useState('');
  const [islemFiltreAcik, setIslemFiltreAcik] = useState(false);
  const [showSirketModal, setShowSirketModal] = useState(false);
  const [showDevretDialog, setShowDevretDialog] = useState<BekleyenDevir | null>(null);
  const [devretGider, setDevretGider] = useState('');
  const [devretGiderAciklama, setDevretGiderAciklama] = useState('');
  const [bekleyenOdemelerOpen, setBekleyenOdemelerOpen] = useState(true);
  const [bekleyenGrupOpen, setBekleyenGrupOpen] = useState<string | null>(null);
  const [showKismiOdemeDialog, setShowKismiOdemeDialog] = useState<any>(null);
  const [kismiOdemeTutar, setKismiOdemeTutar] = useState('');
  const [kismiOdemeAciklama, setKismiOdemeAciklama] = useState('');
  const [odemeYapiliyor, setOdemeYapiliyor] = useState(false);
  const [showKismiSilDialog, setShowKismiSilDialog] = useState<any>(null);
  const [cariData, setCariData] = useState<CariHesap[]>([]);
  const [cariLoading, setCariLoading] = useState(false);
  const [acikCari, setAcikCari] = useState<string | null>(null);
  const [cariAra, setCariAra] = useState('');
  const [acikKategori, setAcikKategori] = useState<string | null>(null); // {giderId, label, toplam}
  const [kismiSilTutar, setKismiSilTutar] = useState('');

  const [showKasaGuide, setShowKasaGuide] = useState(false);

  // ─ Aksiyon Modalları State ─
  const [showParaGirisi, setShowParaGirisi] = useState(false);
  const [showParaCikisi, setShowParaCikisi] = useState(false);
  const [showAcilisBakiye, setShowAcilisBakiye] = useState(false);
  const [showAcilisBorc, setShowAcilisBorc] = useState(false);
  const [aksiyonTutar, setAksiyonTutar] = useState('');
  const [aksiyonAciklama, setAksiyonAciklama] = useState('');
  const [aksiyonTarih, setAksiyonTarih] = useState(todayStr());
  const [aksiyonOdemeYontemi, setAksiyonOdemeYontemi] = useState('cash');
  const [aksiyonKategori, setAksiyonKategori] = useState('');
  const [aksiyonOdendi, setAksiyonOdendi] = useState(true);
  const [aksiyonKisi, setAksiyonKisi] = useState('');
  const [aksiyonEmoji, setAksiyonEmoji] = useState('🏢');
  const [aksiyonSaving, setAksiyonSaving] = useState(false);

  // ─ Kişisel Kasa State ─
  const [kisiselData, setKisiselData] = useState<KisiselKasaData | null>(null);
  const [kisiselLoading, setKisiselLoading] = useState(false);
  const [kisiselError, setKisiselError] = useState<string | null>(null);
  const [showKisiselModal, setShowKisiselModal] = useState(false);
  const [kisiselBorclar, setKisiselBorclar] = useState<BorclarData | null>(null);
  const [showKisiselBorcModal, setShowKisiselBorcModal] = useState(false);
  const [showKisiselOdemeDialog, setShowKisiselOdemeDialog] = useState<Borc | null>(null);
  const [kisiselBorcListe, setKisiselBorcListe] = useState<'alacak' | 'verecek'>('alacak');

  // ─ Borçlar State ─
  const [borclarData, setBorclarData] = useState<BorclarData | null>(null);
  const [borclarLoading, setBorclarLoading] = useState(false);
  const [borclarError, setBorclarError] = useState<string | null>(null);
  const [showBorcModal, setShowBorcModal] = useState(false);
  const [showOdemeDialog, setShowOdemeDialog] = useState<Borc | null>(null);
  const [borcListeGoster, setBorcListeGoster] = useState<'alacak' | 'verecek'>('alacak');

  // ─ Form States ─
  const [formTip, setFormTip] = useState<'gelir' | 'gider'>('gelir');
  const [formTutar, setFormTutar] = useState('');
  const [formKategori, setFormKategori] = useState('');
  const [formAciklama, setFormAciklama] = useState('');
  const [formTarih, setFormTarih] = useState(todayStr());
  const [formSaving, setFormSaving] = useState(false);

  // ─ Borç Form ─
  const [borcYon, setBorcYon] = useState<'alacak' | 'verecek'>('alacak');
  const [borcKisi, setBorcKisi] = useState('');
  const [borcTutar, setBorcTutar] = useState('');
  const [borcParaBirimi, setBorcParaBirimi] = useState('TRY');
  const [borcAciklama, setBorcAciklama] = useState('');
  const [borcTarih, setBorcTarih] = useState(todayStr());

  // ─ Ödeme Form ─
  const [odemeTutar, setOdemeTutar] = useState('');
  const [odemeAciklama, setOdemeAciklama] = useState('');

  // ─ Döviz Kurları ─
  const [kurlar, setKurlar] = useState<{USD: number; EUR: number; GBP: number}>({ USD: 1, EUR: 1, GBP: 1 });

  // ─ Pay Dağıtımı State ─
  const [showPayDagitim, setShowPayDagitim] = useState(false);
  const [payOrtaklar, setPayOrtaklar] = useState<{id: string; isim: string; yuzde: number}[]>([]);
  const [payOrtaklarLoading, setPayOrtaklarLoading] = useState(false);
  const [payDagitimlar, setPayDagitimlar] = useState<any[]>([]);
  const [payDagitimlarLoading, setPayDagitimlarLoading] = useState(false);
  const [payTutar, setPayTutar] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [showOrtakDuzenle, setShowOrtakDuzenle] = useState(false);
  const [ortakForm, setOrtakForm] = useState<{isim: string; yuzde: string}[]>([]);
  const [ortakSaving, setOrtakSaving] = useState(false);
  const [payAccordionOpen, setPayAccordionOpen] = useState<string | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────
  const fetchSirket = useCallback(async () => {
    setSirketLoading(true);
    setSirketError(null);
    try {
      const hdrs = await authHeaders();
      const [res, bekleyenRes] = await Promise.all([
        fetch(appendGhostParam(`${API_BASE}/kasa/sirket?ay=${selectedMonth}`), { headers: hdrs }),
        isAdmin ? fetch(appendGhostParam(`${API_BASE}/kasa/sirket/bekleyen`), { headers: hdrs }) : Promise.resolve(null),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Bekleyen devirleri ana dataya ekle
      if (bekleyenRes && bekleyenRes.ok) {
        const bekleyenData = await bekleyenRes.json();
        data.bekleyenDevirler = bekleyenData.bekleyen || [];
      } else {
        data.bekleyenDevirler = [];
      }
      setSirketData(data);
    } catch (e: any) {
      setSirketError(e.message || 'Veri alınamadı');
    } finally {
      setSirketLoading(false);
    }
  }, [selectedMonth, isAdmin]);

  const fetchKisisel = useCallback(async () => {
    if (!isAdmin) return;
    setKisiselLoading(true);
    setKisiselError(null);
    try {
      const res = await fetch(
        appendGhostParam(`${API_BASE}/kasa/kisisel`),
        { headers: await authHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKisiselData(data);
      // Kişisel borçları da çek
      try {
        const bRes = await fetch(appendGhostParam(`${API_BASE}/kasa/kisisel/borclar`), { headers: await authHeaders() });
        if (bRes.ok) setKisiselBorclar(await bRes.json());
      } catch {}
    } catch (e: any) {
      setKisiselError(e.message || 'Veri alınamadı');
    } finally {
      setKisiselLoading(false);
    }
  }, [isAdmin]);

  const fetchCariler = useCallback(async () => {
    setCariLoading(true);
    try {
      const res = await fetch(appendGhostParam(`${API_BASE}/kasa/cariler`), { headers: await authHeaders() });
      if (res.ok) { const data = await res.json(); setCariData(data.cariler || []); }
    } catch {} finally { setCariLoading(false); }
  }, [selectedMonth]);

  const fetchBorclar = useCallback(async () => {
    setBorclarLoading(true);
    setBorclarError(null);
    try {
      const res = await fetch(
        appendGhostParam(`${API_BASE}/kasa/borclar`),
        { headers: await authHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBorclarData(data);
    } catch (e: any) {
      setBorclarError(e.message || 'Veri alınamadı');
    } finally {
      setBorclarLoading(false);
    }
  }, []);

  const fetchPayOrtaklar = useCallback(async () => {
    setPayOrtaklarLoading(true);
    try {
      const res = await fetch(appendGhostParam(`${API_BASE}/ortaklar`), { headers: await authHeaders() });
      if (res.ok) { const d = await res.json(); setPayOrtaklar(d.ortaklar || []); }
    } catch {} finally { setPayOrtaklarLoading(false); }
  }, []);

  const fetchPayDagitimlar = useCallback(async () => {
    setPayDagitimlarLoading(true);
    try {
      const res = await fetch(appendGhostParam(`${API_BASE}/dagitimlar`), { headers: await authHeaders() });
      if (res.ok) { const d = await res.json(); setPayDagitimlar(d.dagitimlar || []); }
    } catch {} finally { setPayDagitimlarLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(appendGhostParam(`${API_BASE}/doviz/canli`), { headers: await authHeaders() });
        if (res.ok) { const d = await res.json(); if (d.rates) setKurlar({ USD: d.rates.USD, EUR: d.rates.EUR, GBP: d.rates.GBP }); }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (activeTab === 'sirket') { fetchSirket(); fetchCariler(); fetchBorclar(); }
    else if (activeTab === 'kisisel') fetchKisisel();
    else if (activeTab === 'cariler') fetchCariler();
    else if (activeTab === 'borclar') fetchBorclar();
  }, [activeTab, fetchSirket, fetchKisisel, fetchCariler]);

  useEffect(() => {
    if (showPayDagitim && isAdmin) { fetchPayOrtaklar(); fetchPayDagitimlar(); }
  }, [showPayDagitim]);

  // ── Actions ───────────────────────────────────────────────────────────
  const toggleGorunurluk = async () => {
    if (!isAdmin || !sirketData) return;
    try {
      // Kullanılmıyor — yeni toggleGorunurlukRol kullanılıyor
    } catch {}
  };

  const toggleGorunurlukRol = async (rol: 'ustMudur' | 'idari') => {
    if (!sirketData) return;
    const key = rol === 'ustMudur' ? 'visibleUstMudur' : 'visibleIdari';
    const yeniDeger = !(sirketData as any)[key];
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ayarlar`), {
        method: 'PUT', headers: await authHeaders(),
        body: JSON.stringify({ [key]: yeniDeger }),
      });
      setSirketData({ ...sirketData, [key]: yeniDeger } as any);
    } catch {}
  };

  const handleDevret = async () => {
    if (!showDevretDialog) return;
    setFormSaving(true);
    try {
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/sirket/devret`),
        {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            devirId: showDevretDialog.id,
          }),
        }
      );
      setShowDevretDialog(null);
      setDevretGider('');
      setDevretGiderAciklama('');
      fetchSirket();
    } catch {
    } finally {
      setFormSaving(false);
    }
  };

  // ── Bekleyen Ödeme Actions ──
  const handleBekleyenOde = async (giderId: string, tutar: number) => {
    setOdemeYapiliyor(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ode`), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ giderId, tutar }),
      });
      fetchSirket();
    } catch {} finally { setOdemeYapiliyor(false); }
  };

  const handleBekleyenOdeTumu = async (odemeler: { giderId: string; tutar: number }[]) => {
    setOdemeYapiliyor(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ode-tumu`), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ odemeler }),
      });
      fetchSirket();
    } catch {} finally { setOdemeYapiliyor(false); }
  };

  const handleKismiOdeme = async () => {
    if (!showKismiOdemeDialog || !kismiOdemeTutar) return;
    setOdemeYapiliyor(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ode`), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          giderId: showKismiOdemeDialog.giderId,
          tutar: parseFloat(kismiOdemeTutar),
          aciklama: kismiOdemeAciklama || undefined,
          borcTutar: showKismiOdemeDialog.kalanTutar || 0,
          personelAdi: showKismiOdemeDialog.personelAdi || '',
          category: showKismiOdemeDialog.category || '',
        }),
      });
      setShowKismiOdemeDialog(null);
      setKismiOdemeTutar('');
      setKismiOdemeAciklama('');
      fetchSirket();
    } catch {} finally { setOdemeYapiliyor(false); }
  };

  const handleSirketIslem = async () => {
    if (!formTutar) return;
    setFormSaving(true);
    try {
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/sirket/islem`),
        {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            tip: formTip,
            tutar: parseFloat(formTutar),
            kategori: formKategori,
            aciklama: formAciklama,
            tarih: formTarih,
          }),
        }
      );
      resetForm();
      setShowSirketModal(false);
      fetchSirket();
    } catch {
    } finally {
      setFormSaving(false);
    }
  };

  const handleKisiselIslem = async () => {
    if (!formTutar) return;
    setFormSaving(true);
    try {
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/kisisel/islem`),
        {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            tip: formTip,
            tutar: parseFloat(formTutar),
            kategori: formKategori,
            aciklama: formAciklama,
            tarih: formTarih,
          }),
        }
      );
      resetForm();
      setShowKisiselModal(false);
      fetchKisisel();
    } catch {
    } finally {
      setFormSaving(false);
    }
  };

  const deleteIslem = async (type: 'sirket' | 'kisisel', id: string) => {
    const base = type === 'sirket' ? 'kasa/sirket/islem' : 'kasa/kisisel/islem';
    try {
      await fetch(
        appendGhostParam(`${API_BASE}/${base}/${id}`),
        { method: 'DELETE', headers: await authHeaders() }
      );
      if (type === 'sirket') fetchSirket();
      else fetchKisisel();
    } catch {}
  };

  const handleBorcEkle = async () => {
    if (!borcKisi || !borcTutar) return;
    setFormSaving(true);
    try {
      const hdrs = await authHeaders();
      const tutar = parseFloat(borcTutar);
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/borclar`),
        {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify({
            yon: borcYon,
            kisi: borcKisi,
            tutar,
            aciklama: borcAciklama,
            tarih: borcTarih,
            currency: borcParaBirimi,
          }),
        }
      );
      // Borçlar İGD'ye yazılmaz — sadece kasa_borc_ kaydı yeterli
      setBorcKisi('');
      setBorcTutar('');
      setBorcAciklama('');
      setBorcTarih(todayStr());
      setShowBorcModal(false);
      fetchBorclar();
      fetchSirket();
    } catch {
    } finally {
      setFormSaving(false);
    }
  };

  const handleOdeme = async () => {
    if (!showOdemeDialog || !odemeTutar) return;
    setFormSaving(true);
    try {
      const hdrs = await authHeaders();
      const tutar = parseFloat(odemeTutar);
      const isAlacak = showOdemeDialog.yon === 'alacak';
      const kisi = showOdemeDialog.kisi;

      // Borç kaydını güncelle
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/borclar/${showOdemeDialog.id}/odeme`),
        {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify({ tutar, aciklama: odemeAciklama }),
        }
      );

      // Kasaya yansıt
      if (isAlacak) {
        // Tahsilat → kasaya para girişi
        await fetch(appendGhostParam(`${API_BASE}/isletme/gelirler`), {
          method: 'POST', headers: hdrs,
          body: JSON.stringify({ amount: tutar, description: `Borçlar — Tahsilat — ${kisi}`, date: new Date().toISOString().split('T')[0], mekanId: '', mekanAdi: '', paymentMethod: 'cash' }),
        });
      } else {
        // Ödeme → kasadan para çıkışı
        const giderRes = await fetch(appendGhostParam(`${API_BASE}/isletme/giderler`), {
          method: 'POST', headers: hdrs,
          body: JSON.stringify({ category: 'borc-odeme', amount: tutar, description: `Borçlar — Ödeme — ${kisi}`, date: new Date().toISOString().split('T')[0], currency: 'TRY' }),
        });
        if (giderRes.ok) {
          const giderData = await giderRes.json();
          const giderId = giderData?.gider?.id || giderData?.id || giderData?.giderId;
          if (giderId) {
            await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ode`), {
              method: 'POST', headers: hdrs,
              body: JSON.stringify({ giderId, tutar }),
            });
          }
        }
      }

      setShowOdemeDialog(null);
      setOdemeTutar('');
      setOdemeAciklama('');
      fetchBorclar();
      fetchSirket();
    } catch {
    } finally {
      setFormSaving(false);
    }
  };

  const deletBorc = async (borc: Borc) => {
    try {
      const hdrs = await authHeaders();
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/borclar/${borc.id}`),
        { method: 'DELETE', headers: hdrs }
      );
      // Borç silindi — İGD'ye dokunmaya gerek yok (borçlar İGD'de değil)
      fetchBorclar();
      fetchSirket();
    } catch {}
  };

  const resetForm = () => {
    setFormTip('gelir');
    setFormTutar('');
    setFormKategori('');
    setFormAciklama('');
    setFormTarih(todayStr());
  };

  const resetAksiyonForm = () => {
    setAksiyonTutar('');
    setAksiyonAciklama('');
    setAksiyonTarih(todayStr());
    setAksiyonKategori('');
    setAksiyonOdendi(true);
    setAksiyonOdemeYontemi('cash');
    setAksiyonKisi('');
    setAksiyonEmoji('🏢');
  };

  const GIDER_KATEGORILER = ['personel', 'malzeme', 'ekipman', 'operasyonel', 'ulasim', 'diger'];

  const handleParaGirisi = async () => {
    if (!aksiyonTutar) return;
    setAksiyonSaving(true);
    try {
      const odemeLabel = aksiyonOdemeYontemi === 'cash' ? 'Nakit' : aksiyonOdemeYontemi === 'card' ? 'Kart' : 'İban';
      await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/islem`), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          type: 'gelir',
          category: odemeLabel,
          amount: parseFloat(aksiyonTutar),
          description: aksiyonAciklama || `${odemeLabel} girişi`,
          date: aksiyonTarih,
        }),
      });
      setShowParaGirisi(false);
      resetAksiyonForm();
      fetchSirket();
    } catch {} finally { setAksiyonSaving(false); }
  };

  const handleParaCikisi = async () => {
    if (!aksiyonTutar || !aksiyonKategori) return;
    setAksiyonSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/islem`), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          type: 'gider',
          category: aksiyonKategori,
          amount: parseFloat(aksiyonTutar),
          description: aksiyonAciklama || 'Para çıkışı',
          date: aksiyonTarih,
        }),
      });
      setShowParaCikisi(false);
      resetAksiyonForm();
      fetchSirket();
    } catch {} finally { setAksiyonSaving(false); }
  };

  const handleAcilisBakiye = async () => {
    if (!aksiyonTutar) return;
    setAksiyonSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/acilis-bakiye`), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          tutar: parseFloat(aksiyonTutar),
          aciklama: aksiyonAciklama || 'Açılış bakiyesi',
          ay: selectedMonth,
        }),
      });
      setShowAcilisBakiye(false);
      resetAksiyonForm();
      fetchSirket();
    } catch {} finally { setAksiyonSaving(false); }
  };

  const handleAcilisBorc = async () => {
    if (!aksiyonKisi || !aksiyonTutar) return;
    setAksiyonSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/acilis-borc`), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          kisi: aksiyonKisi,
          tutar: parseFloat(aksiyonTutar),
          aciklama: aksiyonAciklama || 'Açılış borcu',
          emoji: aksiyonEmoji,
        }),
      });
      setShowAcilisBorc(false);
      resetAksiyonForm();
      fetchSirket();
      fetchCariler();
    } catch {} finally { setAksiyonSaving(false); }
  };

  // ── Render Helpers ────────────────────────────────────────────────────
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-ta" />
    </div>
  );

  const ErrorBox = ({ msg, retry }: { msg: string; retry: () => void }) => (
    <div className="flex flex-col items-center gap-3 py-12">
      <AlertTriangle className="w-10 h-10 text-amber-400" />
      <p className="text-white/60 text-sm text-center">{msg}</p>
      <button onClick={retry} className="flex items-center gap-2 text-ta text-sm">
        <RefreshCw className="w-4 h-4" /> Tekrar Dene
      </button>
    </div>
  );

  // ── TAB 1: Şirket Kasası ─────────────────────────────────────────────
  const renderSirket = () => {
    if (sirketLoading) return <LoadingSpinner />;
    if (sirketError) return <ErrorBox msg={sirketError} retry={fetchSirket} />;
    if (!sirketData) return null;

    const d = sirketData;
    const totalPayment = d.odemeDagilimi.nakit + d.odemeDagilimi.kart + d.odemeDagilimi.iban || 1;
    const nakitPct = (d.odemeDagilimi.nakit / totalPayment) * 100;
    const kartPct = (d.odemeDagilimi.kart / totalPayment) * 100;
    const ibanPct = (d.odemeDagilimi.iban / totalPayment) * 100;
    const bekleyenCount = d.bekleyenDevirler?.length || 0;

    return (
      <div className="space-y-4">
        {/* Month Selector + Visibility */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => { setSelectedMonth(m => shiftMonth(m, -1)); setIslemLimit(5); setIslemFiltreBas(''); setIslemFiltreBit(''); }} className="p-2 rounded-xl bg-white/5 text-white/60 active:bg-white/10">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white/80 text-sm font-medium min-w-[120px] text-center">{getMonthLabel(selectedMonth)}</span>
            <button onClick={() => { setSelectedMonth(m => shiftMonth(m, 1)); setIslemLimit(5); setIslemFiltreBas(''); setIslemFiltreBit(''); }} className="p-2 rounded-xl bg-white/5 text-white/60 active:bg-white/10">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {isAdmin && (
            <div className="flex gap-1">
              <button onClick={() => toggleGorunurlukRol('ustMudur')}
                className="px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                style={{ background: (d as any).visibleUstMudur ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)', border: (d as any).visibleUstMudur ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>
                {(d as any).visibleUstMudur ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-white/30" />}
                <span style={{ color: (d as any).visibleUstMudur ? '#34d399' : 'rgba(255,255,255,0.3)' }}>ÜM</span>
              </button>
              <button onClick={() => toggleGorunurlukRol('idari')}
                className="px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                style={{ background: (d as any).visibleIdari ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)', border: (d as any).visibleIdari ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>
                {(d as any).visibleIdari ? <Eye className="w-3 h-3 text-blue-400" /> : <EyeOff className="w-3 h-3 text-white/30" />}
                <span style={{ color: (d as any).visibleIdari ? '#60a5fa' : 'rgba(255,255,255,0.3)' }}>İD</span>
              </button>
            </div>
          )}
        </div>

        {/* Kapalı ay bildirimi */}
        {d.ayKapatildi && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl p-3 flex items-center gap-2 mb-3"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-400">Bu ay kapatılmış</p>
              <p className="text-[10px] text-white/30">
                {(d as any).ayDevretsiz
                  ? 'Veriler bilgi amaçlıdır. Bakiye devredilmeden kapatılmıştır.'
                  : 'Veriler bilgi amaçlıdır. Bakiye bir sonraki aya devredilmiştir.'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Devir Bakiye (önceki aydan) */}
        {(d.devirBakiye ?? 0) !== 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl p-3 flex items-center justify-between mb-3"
            style={{ background: 'rgba(var(--app-accent-rgb),0.06)', border: '1px solid rgba(var(--app-accent-rgb),0.15)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="text-xs text-white/50">Önceki aydan devir</span>
            </div>
            <span className="text-sm font-bold text-ta">{formatMoney(d.devirBakiye)}</span>
          </motion.div>
        )}

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={glass}
          className="p-5"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/40 text-xs tracking-wider uppercase mb-1">Bakiye</p>
              <p className="text-3xl font-bold text-white">{formatMoney(d.bakiye)}</p>
            </div>
            {borclarData && ((borclarData.toplamAlacak || 0) > 0 || (borclarData.toplamVerecek || 0) > 0) && (
              <div className="text-right space-y-1 pt-1">
                {(() => {
                  const borcToTRY = (borc: Borc) => {
                    const cur = (borc as any).currency || 'TRY';
                    if (cur === 'TRY') return borc.kalanTutar;
                    return borc.kalanTutar * (kurlar[cur as keyof typeof kurlar] || 1);
                  };
                  const alacakTRY = (borclarData.alacaklar || []).reduce((s, b) => s + borcToTRY(b), 0);
                  const verecekTRY = (borclarData.verecekler || []).reduce((s, b) => s + borcToTRY(b), 0);
                  return (
                    <>
                      {alacakTRY > 0 && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-[10px] text-white/40">Alacak</span>
                          <span className="text-xs font-bold text-emerald-400">{formatMoney(alacakTRY)}</span>
                        </div>
                      )}
                      {verecekTRY > 0 && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <TrendingDown className="w-3 h-3 text-red-400" />
                          <span className="text-[10px] text-white/40">Verecek</span>
                          <span className="text-xs font-bold text-red-400">{formatMoney(verecekTRY)}</span>
                        </div>
                      )}
                      {(alacakTRY > 0 || verecekTRY > 0) && (
                        <div className="flex items-center gap-1.5 justify-end border-t border-white/10 pt-1 mt-1">
                          <span className="text-[10px] text-white/50">Net Bakiye</span>
                          <span className={`text-xs font-bold ${(d.bakiye + alacakTRY - verecekTRY) >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                            {formatMoney(d.bakiye + alacakTRY - verecekTRY)}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Vardiya Devir</p>
              <p className="text-white font-semibold text-sm">{formatMoney(d.toplamDevir)}</p>
            </div>
            <div className="text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Ödenen</p>
              <p className="text-red-400 font-semibold text-sm">{formatMoney(d.toplamOdpienenGider)}</p>
            </div>
            <div className="text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Bekleyen</p>
              <p className="text-amber-400 font-semibold text-sm">{formatMoney(d.toplamBekleyenGider)}</p>
            </div>
          </div>

          {/* Ödeme dağılımı detay */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-[9px] text-white/40 uppercase">Nakit</p>
              <p className="text-sm font-bold" style={{ color: '#22c55e' }}>{formatMoney(d.odemeDagilimi.nakit)}</p>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-[9px] text-white/40 uppercase">Kart</p>
              <p className="text-sm font-bold" style={{ color: '#f97316' }}>{formatMoney(d.odemeDagilimi.kart)}</p>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <p className="text-[9px] text-white/40 uppercase">İban</p>
              <p className="text-sm font-bold" style={{ color: '#06b6d4' }}>{formatMoney(d.odemeDagilimi.iban)}</p>
            </div>
          </div>

          {/* Payment Breakdown Bar */}
          <div className="space-y-2">
            <div className="flex rounded-full overflow-hidden h-2.5 bg-white/5">
              {nakitPct > 0 && <div className="transition-all" style={{ width: `${nakitPct}%`, background: '#22c55e' }} />}
              {kartPct > 0 && <div className="transition-all" style={{ width: `${kartPct}%`, background: '#f97316' }} />}
              {ibanPct > 0 && <div className="transition-all" style={{ width: `${ibanPct}%`, background: '#06b6d4' }} />}
            </div>
            <div className="flex justify-between text-[10px] text-white/50">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#22c55e' }} /> Nakit</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#f97316' }} /> Kart</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#06b6d4' }} /> İban</span>
            </div>
          </div>
        </motion.div>

        {/* Açılış Bakiyesi */}
        {(d as any).acilisTutar > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl p-3 flex items-center justify-between"
            style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="text-xs text-white/50">Açılış bakiyesi</span>
            </div>
            <span className="text-sm font-bold" style={{ color: '#60a5fa' }}>{formatMoney((d as any).acilisTutar)}</span>
          </motion.div>
        )}

        {/* Aksiyon Butonları — sadece yönetici */}
        {userRole === 'yonetici' && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => { resetAksiyonForm(); setShowParaGirisi(true); }}
              className="flex items-center gap-2 p-3 rounded-xl text-left transition-all active:scale-[0.97]"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
            >
              <span className="text-lg">💰</span>
              <span className="text-xs font-bold" style={{ color: '#34d399' }}>Para Girişi</span>
            </button>
            <button
              onClick={() => { resetAksiyonForm(); setShowParaCikisi(true); }}
              className="flex items-center gap-2 p-3 rounded-xl text-left transition-all active:scale-[0.97]"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              <span className="text-lg">💸</span>
              <span className="text-xs font-bold" style={{ color: '#f87171' }}>Para Çıkışı</span>
            </button>
            <button
              onClick={() => { resetAksiyonForm(); setShowAcilisBakiye(true); }}
              className="flex items-center gap-2 p-3 rounded-xl text-left transition-all active:scale-[0.97]"
              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}
            >
              <span className="text-lg">📋</span>
              <span className="text-xs font-bold" style={{ color: '#60a5fa' }}>Açılış Bakiye</span>
            </button>
            <button
              onClick={() => { resetAksiyonForm(); setShowAcilisBorc(true); }}
              className="flex items-center gap-2 p-3 rounded-xl text-left transition-all active:scale-[0.97]"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              <span className="text-lg">📋</span>
              <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>Açılış Borcu</span>
            </button>
            <button
              onClick={() => setShowPayDagitim(true)}
              className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl text-left transition-all active:scale-[0.97]"
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              <span className="text-lg">💎</span>
              <span className="text-xs font-bold" style={{ color: '#a855f7' }}>Pay Dağıt</span>
            </button>
          </div>
        )}

        {/* Önceki Aydan Kalan Ödemeler */}
        {isAdmin && ((d as any).oncekiAydanKalanlar?.length || 0) > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ ...glass, borderColor: 'rgba(239,68,68,0.25)' }} className="overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-400 text-sm">⚡</span>
                <span className="text-red-300 font-medium text-sm flex-1">Önceki Aydan Kalan</span>
                <span className="bg-red-400/20 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  {(d as any).oncekiAydanKalanlar.length}
                </span>
                <span className="text-red-300 text-xs font-bold">
                  {formatMoney((d as any).oncekiAydanKalanlar.reduce((s: number, o: any) => s + (o.kalanTutar || 0), 0))}
                </span>
              </div>
              <div className="space-y-2">
                {(d as any).oncekiAydanKalanlar.map((od: any) => (
                  <div key={od.giderId} className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-red-300">{od.personelAdi || od.category || 'Gider'}</span>
                      <span className="text-sm font-bold text-red-300">{formatMoney(od.kalanTutar)}</span>
                    </div>
                    <p className="text-[10px] text-white/30 mb-2">{od.description || `${od.oncekiAy} ayından kalan`}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBekleyenOde(od.giderId, od.kalanTutar)}
                        disabled={odemeYapiliyor}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40 bg-red-500/80"
                      >
                        Öde
                      </button>
                      <button
                        onClick={() => { setShowKismiOdemeDialog(od); setKismiOdemeTutar(''); setKismiOdemeAciklama(''); }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-red-300 border border-red-400/30 bg-red-400/10"
                      >
                        Kısmi Öde
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Bekleyen Ödemeler */}
        {isAdmin && (d.bekleyenOdemeler?.length || 0) > 0 && (() => {
          const odemeler = d.bekleyenOdemeler || [];
          // Grup: personelAdi olanlar "Personel" altında, diğerleri category bazlı
          const grouped: Record<string, { label: string; items: any[]; toplam: number; subGroups?: Record<string, { label: string; items: any[]; toplam: number }> }> = {};
          for (const o of odemeler) {
            // Kategori bazlı gruplama (öncelik: tedarikci > kira/operasyonel > personel > diğer)
            const tutar = o.kalanTutar || o.amount || 0;
            const addToGroup = (grpKey: string, label: string, useSubGroups: boolean) => {
              if (!grouped[grpKey]) grouped[grpKey] = { label, items: [], toplam: 0, subGroups: useSubGroups ? {} : undefined };
              grouped[grpKey].items.push(o);
              grouped[grpKey].toplam += tutar;
              if (useSubGroups && o.personelAdi) {
                const subKey = o.personelAdi;
                if (!grouped[grpKey].subGroups![subKey]) grouped[grpKey].subGroups![subKey] = { label: subKey, items: [], toplam: 0 };
                grouped[grpKey].subGroups![subKey].items.push(o);
                grouped[grpKey].subGroups![subKey].toplam += tutar;
              }
            };
            if (o.category === 'tedarikci') {
              addToGroup('__tedarikci__', 'Tedarikçiler', true);
            } else if (o.category === 'personel' || (o.personelAdi && !['kira', 'operasyonel', 'malzeme', 'ekipman', 'ulasim', 'diger', 'tedarikci'].includes(o.category))) {
              addToGroup('__personel__', 'Personel', true);
            } else {
              const key = o.category || 'Diğer';
              addToGroup(key, key, true);
            }
          }
          const gruplar = Object.values(grouped);
          const genelToplam = odemeler.reduce((s: number, o: any) => s + (o.kalanTutar || o.amount || 0), 0);

          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              style={{ ...glass, borderColor: 'rgba(245,158,11,0.25)' }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setBekleyenOdemelerOpen(p => !p)}
                  className="flex items-center gap-2 flex-1"
                >
                  <CircleDollarSign className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-300 font-medium text-sm">Bekleyen Ödemeler</span>
                  <span className="bg-amber-400/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">{odemeler.length}</span>
                  <span className="text-white/20 text-[10px]">({formatMoney(genelToplam)})</span>
                  {bekleyenOdemelerOpen ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`Tüm bekleyen ${odemeler.length} ödemeyi yapmak istiyor musunuz?`)) return;
                    handleBekleyenOdeTumu(odemeler.map((o: any) => ({ giderId: o.giderId, tutar: o.kalanTutar || o.amount })));
                  }}
                  disabled={odemeYapiliyor}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shrink-0 ml-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  {odemeYapiliyor ? 'Ödeniyor...' : 'Tümünü Öde'}
                </button>
              </div>
              <AnimatePresence>
                {bekleyenOdemelerOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2">
                      {gruplar.map(grup => {
                        const isOpen = bekleyenGrupOpen === grup.label;
                        return (
                        <div key={grup.label} className="rounded-xl overflow-hidden" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
                          <button
                            onClick={() => setBekleyenGrupOpen(isOpen ? null : grup.label)}
                            className="w-full p-3 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-amber-300">{grup.label}</span>
                              <span className="text-[10px] text-white/30">{grup.items.length} adet</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-amber-300">{formatMoney(grup.toplam)}</span>
                              <ChevronDown className={`w-3.5 h-3.5 text-amber-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3">
                          {/* Alt gruplar varsa (Personel) her birini ayrı göster */}
                          {grup.subGroups ? (
                            <div className="space-y-2">
                              {Object.values(grup.subGroups).map((sub: any) => (
                                <div key={sub.label} className="rounded-lg p-2.5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.08)' }}>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-amber-200">{sub.label}</span>
                                    <span className="text-xs font-bold text-amber-300">{formatMoney(sub.toplam)}</span>
                                  </div>
                                  <p className="text-[10px] text-white/30 mb-2">{sub.items.length} adet bekleyen ödeme</p>
                                  <div className="flex gap-2 items-center">
                                    <button onClick={() => {
                                      if (sub.items.length === 1) handleBekleyenOde(sub.items[0].giderId, sub.items[0].kalanTutar || sub.items[0].amount);
                                      else handleBekleyenOdeTumu(sub.items.map((o: any) => ({ giderId: o.giderId, tutar: o.kalanTutar || o.amount })));
                                    }} disabled={odemeYapiliyor} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: 'var(--app-accent)' }}>Öde</button>
                                    <button onClick={() => { setShowKismiOdemeDialog(sub.items[0]); setKismiOdemeTutar(''); setKismiOdemeAciklama(''); }}
                                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-300 border border-amber-400/30 bg-amber-400/10">Kısmi Öde</button>
                                    <div className="flex-1" />
                                    <button onClick={() => { setShowKismiSilDialog({ items: sub.items, label: sub.label, toplam: sub.toplam }); setKismiSilTutar(''); }}
                                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-red-400/50 border border-red-400/15 bg-red-400/5">Kısmi Sil</button>
                                    <button onClick={async () => {
                                      if (!confirm(`${sub.label} komple silinecek. İGD'ye düzeltme kaydı eklenecek. Emin misiniz?`)) return;
                                      try { await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/komple-sil`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ giderIds: sub.items.map((it: any) => it.giderId), tutar: sub.toplam, personelAdi: sub.items[0]?.personelAdi || '', category: sub.items[0]?.category || '', ay: selectedMonth }) }); fetchSirket(); } catch {}
                                    }} className="px-2 py-1.5 rounded-lg text-[10px] text-red-400/60 border border-red-400/20 bg-red-400/5"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                </div>
                              ))}
                              {/* Tümünü öde butonu */}
                              <div className="flex gap-2 items-center pt-1">
                                <button onClick={() => handleBekleyenOdeTumu(grup.items.map((o: any) => ({ giderId: o.giderId, tutar: o.kalanTutar || o.amount })))}
                                  disabled={odemeYapiliyor} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: 'var(--app-accent)' }}>Tümünü Öde</button>
                                <button onClick={() => { setShowKismiSilDialog({ items: grup.items, label: grup.label, toplam: grup.toplam }); setKismiSilTutar(''); }}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-red-400/50 border border-red-400/15 bg-red-400/5">Kısmi Sil</button>
                                <button onClick={async () => {
                                  if (!confirm(`Tüm personel komple silinecek. İGD'ye düzeltme kaydı eklenecek. Emin misiniz?`)) return;
                                  try { await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/komple-sil`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ giderIds: grup.items.map((it: any) => it.giderId), tutar: grup.toplam, personelAdi: '', category: 'personel', ay: selectedMonth }) }); fetchSirket(); } catch {}
                                }} className="px-2 py-1.5 rounded-lg text-[10px] text-red-400/60 border border-red-400/20 bg-red-400/5"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ) : (
                            <>
                          {grup.items.some((it: any) => it.odpienenTutar > 0) && (
                            <p className="text-[10px] text-white/30 mb-2">{formatMoney(grup.items.reduce((s: number, it: any) => s + (it.odpienenTutar || 0), 0))} kısmi ödendi</p>
                          )}

                          {/* Kısmi ödemeler geçmişi */}
                          {grup.items.some((it: any) => it.odemeler?.length > 0) && (
                            <div className="mb-2 space-y-1">
                              {grup.items.flatMap((it: any) => (it.odemeler || []).map((o: any, idx: number) => ({ ...o, giderId: it.giderId, odemeIndex: idx }))).map((o: any, i: number) => (
                                <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg bg-white/3">
                                  <span className="text-[9px] text-white/30">{o.tarih} — {o.aciklama || 'Kısmi ödeme'}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-orange-400">{formatMoney(o.tutar)}</span>
                                    <button onClick={async () => {
                                      if (!confirm('Bu kısmi ödemeyi silmek istiyor musunuz?')) return;
                                      try {
                                        await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/odeme/${o.giderId}/kismi/${o.odemeIndex}`), { method: 'DELETE', headers: await authHeaders() });
                                        fetchSirket();
                                      } catch {}
                                    }} className="p-0.5 rounded text-white/15 active:text-red-400">
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2 items-center">
                            <button
                              onClick={() => {
                                if (grup.items.length === 1) {
                                  handleBekleyenOde(grup.items[0].giderId, grup.items[0].kalanTutar || grup.items[0].amount);
                                } else {
                                  handleBekleyenOdeTumu(grup.items.map((o: any) => ({ giderId: o.giderId, tutar: o.kalanTutar || o.amount })));
                                }
                              }}
                              disabled={odemeYapiliyor}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40"
                              style={{ background: 'var(--app-accent)' }}
                            >
                              Öde
                            </button>
                            <button
                              onClick={() => {
                                setShowKismiOdemeDialog(grup.items[0]);
                                setKismiOdemeTutar('');
                                setKismiOdemeAciklama('');
                              }}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-300 border border-amber-400/30 bg-amber-400/10"
                            >
                              Kısmi Öde
                            </button>
                            <div className="flex-1" />
                            <button
                              onClick={() => { setShowKismiSilDialog({ items: grup.items, label: grup.label, toplam: grup.toplam }); setKismiSilTutar(''); }}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-red-400/50 border border-red-400/15 bg-red-400/5"
                            >
                              Kısmi Sil
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`${grup.label} komple silinecek. İGD'ye düzeltme kaydı eklenecek. Emin misiniz?`)) return;
                                try {
                                  await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/komple-sil`), {
                                    method: 'POST', headers: await authHeaders(),
                                    body: JSON.stringify({
                                      giderIds: grup.items.map((it: any) => it.giderId),
                                      tutar: grup.toplam,
                                      personelAdi: grup.items[0]?.personelAdi || '',
                                      category: grup.items[0]?.category || '',
                                      ay: selectedMonth,
                                    }),
                                  });
                                  fetchSirket();
                                } catch {}
                              }}
                              className="px-2 py-1.5 rounded-lg text-[10px] text-red-400/60 border border-red-400/20 bg-red-400/5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                            </>
                          )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })()}

        {/* Bekleyen Devirler — tarihe göre gruplanmış */}
        {bekleyenCount > 0 && (() => {
          // Tarihe göre grupla
          const grouped: Record<string, typeof d.bekleyenDevirler> = {};
          for (const devir of d.bekleyenDevirler) {
            if (!grouped[devir.tarih]) grouped[devir.tarih] = [];
            grouped[devir.tarih].push(devir);
          }
          const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
          const gunSayisi = sortedDates.length;

          // Toplu devret handler
          const devretTumu = async (tarih: string) => {
            if (!confirm(`${tarih} tarihli tüm vardiyaları devretmek istiyor musunuz?`)) return;
            try {
              const hdrs = await authHeaders();
              for (const devir of grouped[tarih]) {
                await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/devret`), {
                  method: 'POST', headers: hdrs,
                  body: JSON.stringify({ mekanId: devir.mekanId, tarih: devir.tarih }),
                });
              }
              fetchSirket();
            } catch {}
          };

          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              style={{ ...glass, borderColor: 'rgba(251,191,36,0.25)' }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setDevirlerOpen(p => !p)}
                  className="flex items-center gap-2 flex-1"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-300 font-medium text-sm">Bekleyen Devirler</span>
                  <span className="bg-amber-400/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">{bekleyenCount}</span>
                  <span className="text-white/20 text-[10px]">({gunSayisi} gün)</span>
                  {devirlerOpen ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
                </button>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Tüm bekleyen ${bekleyenCount} vardiyayı devretmek istiyor musunuz?`)) return;
                      try {
                        const hdrs = await authHeaders();
                        for (const devir of d.bekleyenDevirler) {
                          await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/devret`), {
                            method: 'POST', headers: hdrs,
                            body: JSON.stringify({ mekanId: devir.mekanId, tarih: devir.tarih }),
                          });
                        }
                        fetchSirket();
                      } catch {}
                    }}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shrink-0 ml-2"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    Tümünü Devret
                  </button>
                )}
              </div>
              <AnimatePresence>
                {devirlerOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      {sortedDates.map(tarih => {
                        const mekanlar = grouped[tarih];
                        const gunToplam = mekanlar.reduce((s, m) => s + (m.toplam || m.ciro || 0), 0);
                        const tarihObj = new Date(tarih + 'T00:00:00Z');
                        const tarihStr = tarihObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

                        return (
                          <div key={tarih} className="rounded-xl overflow-hidden" style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
                            {/* Gün başlığı */}
                            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(251,191,36,0.08)' }}>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-amber-400/60">📅</span>
                                <span className="text-xs font-bold text-amber-300">{tarihStr}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-amber-300">{formatMoney(gunToplam)}</span>
                                {isAdmin && (
                                  <button
                                    onClick={() => devretTumu(tarih)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                                    style={{ background: 'var(--app-accent)' }}
                                  >
                                    Tümünü Devret
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Mekanlar */}
                            <div className="px-3 py-2 space-y-1.5">
                              {mekanlar.map(devir => (
                                <div key={`${devir.mekanId}_${devir.tarih}`} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm">{devir.mekanEmoji}</span>
                                    <span className="text-xs text-white/70 truncate">{devir.mekanAdi}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-semibold text-white/50">{formatMoney(devir.toplam || devir.ciro || 0)}</span>
                                    {isAdmin && (
                                      <button
                                        onClick={() => { setShowDevretDialog(devir); setDevretGider(''); setDevretGiderAciklama(''); }}
                                        className="text-[9px] font-bold px-2 py-0.5 rounded text-ta border border-ta/30 bg-ta/10"
                                      >
                                        Devret
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })()}

        {/* İşlem Geçmişi — devirler + manuel işlemler birleşik */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs tracking-wider uppercase">İşlem Geçmişi</p>
            <button onClick={() => setIslemFiltreAcik(p => !p)}
              className="text-[10px] font-bold text-ta/70 flex items-center gap-1 px-2 py-1 rounded-lg bg-ta/5 border border-ta/15">
              <RefreshCw className="w-3 h-3" /> Filtre
            </button>
          </div>

          {/* Gün filtresi — seçili ayın günleri */}
          <AnimatePresence>
            {islemFiltreAcik && (() => {
              const [yil, ayNum] = selectedMonth.split('-').map(Number);
              const ayGun = new Date(yil, ayNum, 0).getDate();
              const gunler = Array.from({ length: ayGun }, (_, i) => i + 1);
              const basGun = islemFiltreBas ? parseInt(islemFiltreBas.split('-')[2]) : 0;
              const bitGun = islemFiltreBit ? parseInt(islemFiltreBit.split('-')[2]) : 0;
              const setGun = (tip: 'bas' | 'bit', gun: number) => {
                const tarih = gun > 0 ? `${selectedMonth}-${String(gun).padStart(2, '0')}` : '';
                if (tip === 'bas') setIslemFiltreBas(tarih);
                else setIslemFiltreBit(tarih);
                setIslemLimit(5);
              };
              return (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/30 w-12 shrink-0">Başla:</span>
                      <div className="flex-1 flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {gunler.map(g => (
                          <button key={g} onClick={() => setGun('bas', basGun === g ? 0 : g)}
                            className={`w-7 h-7 rounded-lg text-[10px] font-bold shrink-0 transition-all ${basGun === g ? 'bg-ta text-white' : 'bg-white/5 text-white/40'}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/30 w-12 shrink-0">Bitiş:</span>
                      <div className="flex-1 flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {gunler.map(g => (
                          <button key={g} onClick={() => setGun('bit', bitGun === g ? 0 : g)}
                            className={`w-7 h-7 rounded-lg text-[10px] font-bold shrink-0 transition-all ${bitGun === g ? 'bg-ta text-white' : 'bg-white/5 text-white/40'}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(islemFiltreBas || islemFiltreBit) && (
                      <button onClick={() => { setIslemFiltreBas(''); setIslemFiltreBit(''); setIslemLimit(5); }}
                        className="text-[10px] text-red-400/60 font-bold flex items-center gap-1">
                        <X className="w-3 h-3" /> Filtreyi temizle
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {(() => {
            // Devirleri işlem formatına çevir
            const devirIslemler = (d.devirler || []).map((dev: any) => ({
              id: `devir_${dev.mekanId}_${dev.tarih}`,
              tip: 'devir' as const,
              tutar: dev.ciro || 0,
              tarih: dev.tarih,
              aciklama: `${dev.mekanEmoji || '🏪'} ${dev.mekanAdi || dev.mekanId}`,
              kategori: 'Ciro Devir',
              mekanEmoji: dev.mekanEmoji,
              mekanAdi: dev.mekanAdi,
            }));
            // Manuel işlemleri normalize et
            const manuelIslemler = (d.islemler || []).map((i: any) => ({
              ...i,
              tip: i.tip || i.type,
              tutar: i.tutar || i.amount,
              tarih: i.tarih || i.date,
              aciklama: i.aciklama || i.description,
              kategori: i.kategori || i.category,
            }));
            // Ödenen işlemleri ekle
            const odemeIslemler = (d.opipienenIslemler || []).map((i: any) => ({
              ...i,
              id: i.id || `odeme_${i.tarih}_${Math.random()}`,
              tip: 'odeme' as const,
              tutar: i.tutar || i.amount || 0,
              tarih: i.tarih || i.date,
              aciklama: i.personelAdi ? `Ödeme: ${i.personelAdi}` : `Ödeme: ${i.aciklama || i.description || ''}`,
              kategori: i.kategori || i.category || 'Ödeme',
              giderId: i.giderId,
              odemeIndex: i.odemeIndex,
            }));
            let tumIslemler = [...devirIslemler, ...manuelIslemler, ...odemeIslemler].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));

            // Tarih filtresi uygula
            if (islemFiltreBas) tumIslemler = tumIslemler.filter(i => i.tarih >= islemFiltreBas);
            if (islemFiltreBit) tumIslemler = tumIslemler.filter(i => i.tarih <= islemFiltreBit);

            const toplamIslem = tumIslemler.length;
            const gosterilen = tumIslemler.slice(0, islemLimit);

            if (toplamIslem === 0) return <p className="text-white/30 text-sm text-center py-8">Bu ay için işlem bulunmuyor</p>;

            return (
              <>
                <div className="space-y-2">
                  {gosterilen.map((islem: any, i: number) => {
                    const borderColor = islem.tip === 'devir' ? '#34d399' : islem.tip === 'odeme' ? '#f97316' : islem.tip === 'silme' ? '#ef4444' : islem.tip === 'gelir' ? '#60a5fa' : '#f87171';
                    const label = islem.tip === 'devir'
                      ? `${islem.mekanEmoji || '🏪'} ${islem.mekanAdi || ''} · Ciro`
                      : islem.tip === 'odeme' ? (islem.personelAdi && islem.kategori ? `${islem.kategori.charAt(0).toUpperCase() + islem.kategori.slice(1)}: ${islem.personelAdi}` : islem.personelAdi || islem.kategori || islem.aciklama || 'Ödeme')
                      : islem.tip === 'silme' ? `📝 ${islem.aciklama || 'Silme/İndirim'}`
                      : islem.tip === 'gelir' ? 'Gelir' : 'Gider';

                    return (
                      <motion.div key={islem.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="py-2.5 border-b border-white/5 last:border-b-0">
                        {/* Tek satır */}
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 rounded-full shrink-0" style={{ background: borderColor }} />
                          <span className="text-[11px] font-medium truncate flex-1" style={{ color: borderColor }}>{label}</span>
                          <span className="text-[10px] text-white/25 shrink-0">
                            {islem.tip === 'odeme' && islem.giderTarih
                              ? `${islem.giderTarih} → ${islem.tarih}`
                              : islem.tarih}
                          </span>
                          <span className={`text-xs font-bold shrink-0 ${islem.tip === 'silme' ? 'text-red-500' : islem.tip === 'gider' ? 'text-red-400' : islem.tip === 'odeme' ? 'text-orange-400' : 'text-emerald-400'}`}>
                            {islem.tip === 'silme' ? '🗑️ -' : (islem.tip === 'gider' || islem.tip === 'odeme') ? '-' : '+'}{formatMoney(islem.tutar)}
                          </span>
                          {false && isAdmin && !d.ayKapatildi && islem.tip === 'odeme' && islem.giderId && (
                            <button onClick={async () => {
                              if (!confirm('Bu ödemeyi silmek istiyor musunuz?')) return;
                              try {
                                if (islem.odemeIndex !== undefined) {
                                  await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/odeme/${islem.giderId}/kismi/${islem.odemeIndex}`), { method: 'DELETE', headers: await authHeaders() });
                                } else {
                                  await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/odeme/${islem.giderId}`), { method: 'DELETE', headers: await authHeaders() });
                                }
                                fetchSirket();
                              } catch {}
                            }} className="p-1 rounded text-white/20 active:text-red-400 shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          {false && isAdmin && !d.ayKapatildi && islem.tip !== 'devir' && islem.tip !== 'odeme' && (
                            <button onClick={() => deleteIslem('sirket', islem.id)} className="p-1 rounded text-white/20 active:text-red-400 shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {/* Açıklama varsa alt satır */}
                        {islem.aciklama && islem.tip !== 'devir' && (
                          <p className="text-[10px] text-white/30 truncate ml-3 mt-0.5">{islem.aciklama}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                {/* Daha fazla göster / bilgi */}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-white/20">{gosterilen.length}/{toplamIslem} işlem</span>
                  {islemLimit < toplamIslem && (
                    <button onClick={() => setIslemLimit(l => l + 10)}
                      className="text-[10px] font-bold text-ta px-3 py-1.5 rounded-lg bg-ta/10 border border-ta/20 active:scale-95 transition-all">
                      +10 daha göster
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Ay Kapat butonu */}
        {isAdmin && !d.ayKapatildi && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <button
              onClick={async () => {
                if (!confirm(`${selectedMonth} ayını kapatmak istiyor musunuz? Bakiye sonraki aya devredilecek.`)) return;
                try {
                  await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ay-kapat`), {
                    method: 'POST', headers: await authHeaders(),
                    body: JSON.stringify({ ay: selectedMonth }),
                  });
                  fetchSirket();
                } catch {}
              }}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
            >
              <Lock className="w-4 h-4" />
              Kasayı Kapat & Devret — {selectedMonth}
            </button>
            <button
              onClick={async () => {
                if (!confirm(`${selectedMonth} kasasını devretmeden kapatmak istiyor musunuz? Bakiye sonraki aya aktarılmayacak.`)) return;
                try {
                  await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ay-kapat`), {
                    method: 'POST', headers: await authHeaders(),
                    body: JSON.stringify({ ay: selectedMonth, devretsiz: true }),
                  });
                  fetchSirket();
                } catch {}
              }}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
            >
              <Lock className="w-4 h-4" />
              Devretmeden Kapat — {selectedMonth}
            </button>
            <p className="text-[10px] text-white/20 text-center mt-1.5">Üst: bakiye sonraki aya devredilir · Alt: bakiye sıfırlanır</p>
          </motion.div>
        )}

        {/* FAB kaldırıldı — v2'de gider ekleme bekleyen ödemelerden yapılıyor */}
      </div>
    );
  };

  // ── TAB 2: Kişisel Kasa ───────────────────────────────────────────────
  const renderKisisel = () => {
    if (!isAdmin) return null;
    if (kisiselLoading) return <LoadingSpinner />;
    if (kisiselError) return <ErrorBox msg={kisiselError} retry={fetchKisisel} />;
    if (!kisiselData) return null;

    const d = kisiselData;

    return (
      <div className="space-y-4">
        {/* Balance */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={glass} className="p-5">
          <p className="text-white/40 text-xs tracking-wider uppercase mb-1">Kişisel Bakiye</p>
          <p className="text-3xl font-bold text-white mb-3">{formatMoney(d.bakiye)}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Gelir</p>
              <p className="text-emerald-400 font-semibold text-sm">{formatMoney(d.toplamGelir)}</p>
            </div>
            <div className="text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Gider</p>
              <p className="text-red-400 font-semibold text-sm">{formatMoney(d.toplamGider)}</p>
            </div>
          </div>
        </motion.div>

        {/* Add Button */}
        <button
          onClick={() => { resetForm(); setShowKisiselModal(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white border border-ta/30 bg-ta/10 active:bg-ta/20"
        >
          <Plus className="w-4 h-4" /> Gelir / Gider Ekle
        </button>

        {/* Transaction List */}
        <div>
          <p className="text-white/40 text-xs tracking-wider uppercase mb-3">İşlem Geçmişi</p>
          {d.islemler.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">Henüz işlem yok</p>
          ) : (
            <div className="space-y-2">
              {d.islemler.map((islem, i) => (
                <motion.div
                  key={islem.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  style={{ ...glass, borderLeft: `3px solid ${islem.tip === 'gelir' ? '#34d399' : '#f87171'}` }}
                  className="p-3 flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${islem.tip === 'gelir' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {islem.tip === 'gelir' ? 'Gelir' : 'Gider'}
                      </span>
                      {islem.kategori && <span className="text-white/30 text-[10px]">/ {islem.kategori}</span>}
                    </div>
                    {islem.aciklama && <p className="text-white/50 text-xs truncate mt-0.5">{islem.aciklama}</p>}
                    <p className="text-white/30 text-[10px] mt-0.5">{islem.tarih}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-semibold text-sm ${islem.tip === 'gider' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {islem.tip === 'gider' ? '-' : '+'}{formatMoney(islem.tutar)}
                    </span>
                    <button onClick={() => deleteIslem('kisisel', islem.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 active:bg-white/5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ── Kişisel Borçlar ── */}
        <div>
          <p className="text-white/40 text-xs tracking-wider uppercase mb-3">Borçlar / Alacaklar</p>

          {/* Özet */}
          {kisiselBorclar && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div style={glass} className="p-3 text-center">
                <p className="text-white/40 text-[10px] uppercase">Alacak</p>
                <p className="text-emerald-400 font-bold text-sm">{formatMoney(kisiselBorclar.toplamAlacak)}</p>
              </div>
              <div style={glass} className="p-3 text-center">
                <p className="text-white/40 text-[10px] uppercase">Verecek</p>
                <p className="text-red-400 font-bold text-sm">{formatMoney(kisiselBorclar.toplamVerecek)}</p>
              </div>
            </div>
          )}

          {/* Toggle */}
          <div className="flex gap-2 mb-3">
            {(['alacak', 'verecek'] as const).map(t => (
              <button key={t} onClick={() => setKisiselBorcListe(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${kisiselBorcListe === t ? (t === 'alacak' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border border-red-500/30 text-red-400') : 'bg-white/5 border border-white/10 text-white/40'}`}>
                {t === 'alacak' ? 'Alacaklar' : 'Verecekler'}
              </button>
            ))}
          </div>

          {/* Borç Ekle */}
          <button onClick={() => setShowKisiselBorcModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-white/60 border border-dashed border-white/15 active:bg-white/5 mb-3">
            <Plus className="w-3.5 h-3.5" /> Borç / Alacak Ekle
          </button>

          {/* Liste */}
          {(() => {
            const liste = kisiselBorcListe === 'alacak' ? (kisiselBorclar?.alacaklar || []) : (kisiselBorclar?.verecekler || []);
            if (liste.length === 0) return <p className="text-white/20 text-xs text-center py-6">Kayıt yok</p>;
            return (
              <div className="space-y-2">
                {liste.map((b: Borc) => {
                  const pct = b.tutar > 0 ? ((b.tutar - b.kalanTutar) / b.tutar) * 100 : 0;
                  const renk = b.yon === 'alacak' ? '#34d399' : '#f87171';
                  return (
                    <div key={b.id} style={{ ...glass, borderLeft: `3px solid ${renk}` }} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white">{b.kisi}</span>
                        <span className="text-sm font-bold" style={{ color: renk }}>{formatMoney(b.kalanTutar)}</span>
                      </div>
                      {b.aciklama && <p className="text-[10px] text-white/30 mb-1.5">{b.aciklama}</p>}
                      <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/8 mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: renk }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30">{formatMoney(b.tutar - b.kalanTutar)} / {formatMoney(b.tutar)}</span>
                        <div className="flex gap-1.5">
                          {b.kalanTutar > 0 && (
                            <button onClick={() => setShowKisiselOdemeDialog(b)}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: `${renk}15`, color: renk, border: `1px solid ${renk}30` }}>
                              Ödeme Yap
                            </button>
                          )}
                          <button onClick={async () => {
                            if (!confirm('Bu borç silinecek. Emin misiniz?')) return;
                            await fetch(appendGhostParam(`${API_BASE}/kasa/kisisel/borclar/${b.id}`), { method: 'DELETE', headers: await authHeaders() });
                            fetchKisisel();
                          }} className="p-1 rounded-lg text-white/20 active:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // ── TAB: Cariler ────────────────────────────────────────────────────
  const renderCariler = () => {
    if (cariLoading) return <LoadingSpinner />;

    const filtered = cariAra
      ? cariData.filter(c => c.kisi.toLowerCase().includes(cariAra.toLowerCase()))
      : cariData;

    const toplamKalan = filtered.reduce((s, c) => s + c.kalanBorc, 0);
    const toplamOdenen = filtered.reduce((s, c) => s + c.toplamOdpipipiienen, 0);

    return (
      <div className="space-y-4">
        {/* Özet */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={glass} className="p-4 text-center">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Toplam Kalan</p>
            <p className="text-amber-400 font-bold text-lg">{formatMoney(toplamKalan)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={glass} className="p-4 text-center">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Toplam Ödenen</p>
            <p className="text-emerald-400 font-bold text-lg">{formatMoney(toplamOdenen)}</p>
          </motion.div>
        </div>

        {/* Arama */}
        <div className="relative">
          <input
            value={cariAra}
            onChange={e => setCariAra(e.target.value)}
            placeholder="Cari ara..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-4 py-2.5 text-white text-sm outline-none focus:border-ta/50 placeholder-white/20"
          />
        </div>

        {/* Cari Listesi — kategori bazlı gruplanmış */}
        {filtered.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">Cari hesap bulunamadı</p>
        ) : (() => {
          // Kategoriye göre grupla
          const kategoriMap: Record<string, CariHesap[]> = {};
          for (const c of filtered) {
            const kat = c.tip === 'personel' ? 'Personel' : c.tip === 'kira' ? 'Kira' : c.tip === 'diger_gider' ? 'Diğer Giderler' : 'Tedarikçiler';
            if (!kategoriMap[kat]) kategoriMap[kat] = [];
            kategoriMap[kat].push(c);
          }
          const kategoriSira = ['Personel', 'Tedarikçiler', 'Kira', 'Diğer Giderler'];
          const kategoriEmoji: Record<string, string> = { Personel: '👤', Kira: '🏠', 'Tedarikçiler': '🏢', 'Diğer Giderler': '📋' };
          const kategoriRenk: Record<string, string> = { Personel: '#fbbf24', Kira: '#f97316', 'Tedarikçiler': 'var(--app-accent, #a855f7)', 'Diğer Giderler': '#6b7280' };

          return (
            <div className="space-y-4">
              {kategoriSira.filter(k => kategoriMap[k]?.length > 0).map(kat => {
                const cariler = kategoriMap[kat];
                const katKalan = cariler.reduce((s, c) => s + c.kalanBorc, 0);
                return (
                  <div key={kat}>
                    {/* Kategori başlığı — tıklanabilir */}
                    <button
                      onClick={() => setAcikKategori(acikKategori === kat ? null : kat)}
                      className="w-full flex items-center gap-2 mb-2 active:opacity-70 transition-all"
                    >
                      <span className="text-base">{kategoriEmoji[kat]}</span>
                      <span className="text-xs font-bold text-white/50 uppercase tracking-wider flex-1 text-left">{kat}</span>
                      <span className="text-[10px] text-white/30 mr-1">{cariler.length}</span>
                      <span className="text-xs font-bold" style={{ color: kategoriRenk[kat] }}>{formatMoney(katKalan)}</span>
                      <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${acikKategori === kat ? 'rotate-180' : ''}`} />
                    </button>
                    {acikKategori === kat && (
                    <div className="space-y-2">
                      {cariler.map(cari => {
              const isOpen = acikCari === cari.kisi;
              const pct = cari.toplamBorc > 0 ? ((cari.toplamOdpipipiienen / cari.toplamBorc) * 100) : 0;
              const tampiamOdendi = cari.kalanBorc <= 0;
              const renk = tampiamOdendi ? '#34d399' : cari.tip === 'personel' ? '#fbbf24' : cari.tip === 'kira' ? '#f97316' : 'var(--app-accent, #a855f7)';

              return (
                <motion.div key={cari.kisi} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-xl overflow-hidden" style={{ ...glass, borderColor: `${tampiamOdendi ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)'}` }}>

                  {/* Kart başlığı — tıklanabilir */}
                  <button onClick={() => setAcikCari(isOpen ? null : cari.kisi)} className="w-full p-4 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">{cari.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{cari.kisi}</p>
                        <p className="text-[10px] text-white/30">{cari.tip === 'personel' ? 'Personel' : cari.tip === 'kira' ? 'Kira' : cari.tip === 'tedarikci' ? 'Tedarikçi' : 'Cari'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {tampiamOdendi ? (
                          <span className="text-xs font-bold text-emerald-400">✅ Ödendi</span>
                        ) : (
                          <span className="text-sm font-bold" style={{ color: renk }}>{formatMoney(cari.kalanBorc)}</span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/8">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: tampiamOdendi ? '#34d399' : renk }} />
                      </div>
                      <span className="text-[9px] text-white/30 shrink-0">{formatMoney(cari.toplamOdpipipiienen)} / {formatMoney(cari.toplamBorc)}</span>
                    </div>
                  </button>

                  {/* Detay — açılır */}
                  {isOpen && (
                    <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Özet satır */}
                      <div className="flex justify-between py-2 text-[10px]">
                        <span className="text-white/30">Borç: {formatMoney(cari.toplamBorc)}</span>
                        <span className="text-emerald-400/70">Ödenen: {formatMoney(cari.toplamOdpipipiienen)}</span>
                        <span className="font-bold" style={{ color: renk }}>Kalan: {formatMoney(cari.kalanBorc)}</span>
                      </div>

                      {/* Hareketler — ay bazlı gruplanmış */}
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2 mt-1">Hareketler</p>
                      {(() => {
                        // Aya göre grupla
                        const ayMap: Record<string, typeof cari.hareketler> = {};
                        for (const h of cari.hareketler) {
                          const ay = h.tarih?.slice(0, 7) || 'bilinmiyor';
                          if (!ayMap[ay]) ayMap[ay] = [];
                          ayMap[ay].push(h);
                        }
                        const aylar = Object.keys(ayMap).sort((a, b) => b.localeCompare(a));
                        const mevcutAy = new Date().toISOString().slice(0, 7);

                        return (
                          <div className="space-y-2">
                            {aylar.map((ay, ayIdx) => {
                              const hareketler = ayMap[ay];
                              const ayAcik = acikCari === cari.kisi && (ay === mevcutAy || (acikCari + '_ay_' + ay) === (acikCari + '_ay_' + ay));
                              const ayToplam = hareketler.reduce((s, h) => s + (h.tip === 'borc' ? h.tutar : -h.tutar), 0);
                              const ayDate = new Date(ay + '-01T00:00:00Z');
                              const ayLabel = ayDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                              const ilkAy = ayIdx === 0; // en güncel ay açık başlar

                              return (
                                <div key={ay}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); const el = e.currentTarget.nextElementSibling; if (el) el.classList.toggle('hidden'); }}
                                    className="w-full flex items-center justify-between py-1.5 active:opacity-70"
                                  >
                                    <span className="text-[10px] font-bold text-white/40">📅 {ayLabel}</span>
                                    <span className="text-[10px] font-bold" style={{ color: ayToplam > 0 ? '#fbbf24' : '#34d399' }}>{ayToplam > 0 ? '+' : ''}{formatMoney(ayToplam)}</span>
                                  </button>
                                  <div className={ilkAy ? '' : 'hidden'}>
                                    {hareketler.map((h, i) => (
                                      <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div className="w-1 h-4 rounded-full shrink-0" style={{ background: h.tip === 'borc' ? '#f59e0b' : h.tip === 'odeme' ? '#34d399' : '#ef4444' }} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-white/60 truncate">{h.aciklama || (h.tip === 'borc' ? 'Borç' : h.tip === 'odeme' ? 'Ödeme' : 'Silme')}</p>
                                          <p className="text-[9px] text-white/25">{h.tarih}</p>
                                        </div>
                                        <span className={`text-[11px] font-bold shrink-0 ${h.tip === 'borc' ? 'text-amber-400' : h.tip === 'odeme' ? 'text-emerald-400' : 'text-red-400'}`}>
                                          {h.tip === 'borc' ? '+' : '-'}{formatMoney(h.tutar)}
                                        </span>
                                        {isAdmin && h.giderId && (
                                          <button onClick={async () => {
                                            const msg = h.tip === 'borc' ? 'Bu gider kaydını silmek istiyor musunuz?' : 'Bu ödemeyi geri almak istiyor musunuz?';
                                            if (!confirm(msg)) return;
                                            try {
                                              const hdrs = await authHeaders();
                                              if (h.giderId.startsWith('acilis_')) {
                                                const borcId = h.giderId.replace('acilis_', '');
                                                await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/acilis-borc/${borcId}`), { method: 'DELETE', headers: hdrs });
                                              } else if (h.tip === 'borc') {
                                                await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/komple-sil`), {
                                                  method: 'POST', headers: hdrs,
                                                  body: JSON.stringify({ giderIds: [h.giderId], tutar: h.tutar, personelAdi: cari.kisi, category: cari.tip, ay: selectedMonth }),
                                                });
                                              } else {
                                                await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/odeme/${h.giderId}`), { method: 'DELETE', headers: hdrs });
                                              }
                                              fetchCariler(); fetchSirket();
                                            } catch {}
                                          }} className="p-1 rounded text-white/15 active:text-red-400 shrink-0">
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            {/* Toplam ödenen — tüm zamanlar */}
                            <div className="pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-white/30">Toplam Ödenen (tüm zamanlar)</span>
                                <span className="text-[11px] font-bold text-emerald-400">{formatMoney(cari.toplamOdpipipiienen)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Ödeme butonları */}
                      {isAdmin && cari.kalanBorc > 0 && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={async () => {
                              const borclar = cari.hareketler.filter(h => h.tip === 'borc' && h.giderId);
                              if (borclar.length === 0) return;
                              try {
                                setOdemeYapiliyor(true);
                                const hdrs = await authHeaders();
                                for (const b of borclar) {
                                  await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ode`), {
                                    method: 'POST', headers: hdrs,
                                    body: JSON.stringify({ giderId: b.giderId, tutar: b.tutar, aciklama: `${cari.kisi} — tam ödeme`, borcTutar: b.tutar, personelAdi: cari.kisi, category: cari.tip }),
                                  });
                                }
                                fetchCariler();
                                fetchSirket();
                              } catch {} finally { setOdemeYapiliyor(false); }
                            }}
                            disabled={odemeYapiliyor}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: 'var(--app-accent)' }}
                          >
                            Tamamını Öde
                          </button>
                          <button
                            onClick={() => {
                              const ilkGider = cari.hareketler.find(h => h.tip === 'borc' && h.giderId);
                              if (ilkGider) { setShowKismiOdemeDialog({ giderId: ilkGider.giderId, kalanTutar: cari.kalanBorc, personelAdi: cari.kisi }); setKismiOdemeTutar(''); setKismiOdemeAciklama(''); }
                            }}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-300 border border-amber-400/30 bg-amber-400/10"
                          >
                            Kısmi Öde
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={() => {
                              const ilkGider = cari.hareketler.find(h => h.tip === 'borc' && h.giderId);
                              if (ilkGider) { setShowKismiSilDialog({ items: [{ giderId: ilkGider.giderId, personelAdi: cari.kisi, category: cari.tip }], label: cari.kisi, toplam: cari.kalanBorc }); setKismiSilTutar(''); }
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-red-400/50 border border-red-400/15 bg-red-400/5"
                          >
                            Kısmi Sil
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`${cari.kisi} — ₺${cari.kalanBorc.toLocaleString('tr-TR')} borç komple silinecek. Emin misiniz?`)) return;
                              try {
                                const hdrs = await authHeaders();
                                const borcGiderler = cari.hareketler.filter((h: any) => h.tip === 'borc' && h.giderId);
                                // Açılış borçlarını ayrı sil
                                const acilisBorclar = borcGiderler.filter((h: any) => h.giderId.startsWith('acilis_'));
                                const normalGiderler = borcGiderler.filter((h: any) => !h.giderId.startsWith('acilis_'));
                                // Açılış borçlarını sil
                                for (const ab of acilisBorclar) {
                                  const borcId = ab.giderId.replace('acilis_', '');
                                  await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/acilis-borc/${borcId}`), { method: 'DELETE', headers: hdrs });
                                }
                                // Normal giderleri komple sil
                                if (normalGiderler.length > 0) {
                                  await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/komple-sil`), {
                                    method: 'POST', headers: hdrs,
                                    body: JSON.stringify({
                                      giderIds: normalGiderler.map((h: any) => h.giderId),
                                      tutar: cari.kalanBorc,
                                      personelAdi: cari.kisi,
                                      category: cari.tip,
                                      ay: selectedMonth,
                                    }),
                                  });
                                }
                                fetchCariler();
                                fetchSirket();
                              } catch {}
                            }}
                            className="px-2 py-1.5 rounded-lg text-[10px] text-red-400/60 border border-red-400/20 bg-red-400/5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
          )}
                </div>
              );
            })}
          </div>
          );
        })()}
      </div>
    );
  };

  // ── TAB 3: Borçlar ────────────────────────────────────────────────────
  const renderBorclar = () => {
    if (borclarLoading) return <LoadingSpinner />;
    if (borclarError) return <ErrorBox msg={borclarError} retry={fetchBorclar} />;
    if (!borclarData) return null;

    const d = borclarData;
    const filteredBorclar = borcListeGoster === 'alacak' ? (d.alacaklar || []) : (d.verecekler || []);

    return (
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={glass} className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Toplam Alacak</p>
            <p className="text-emerald-400 font-bold text-lg">{formatMoney((d.alacaklar || []).reduce((s: number, b: any) => { const c = b.currency || 'TRY'; return s + (c === 'TRY' ? b.kalanTutar : b.kalanTutar * (kurlar[c as keyof typeof kurlar] || 1)); }, 0))}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={glass} className="p-4 text-center">
            <TrendingDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Toplam Verecek</p>
            <p className="text-red-400 font-bold text-lg">{formatMoney((d.verecekler || []).reduce((s: number, b: any) => { const c = b.currency || 'TRY'; return s + (c === 'TRY' ? b.kalanTutar : b.kalanTutar * (kurlar[c as keyof typeof kurlar] || 1)); }, 0))}</p>
          </motion.div>
        </div>

        {/* Toggle */}
        <div className="flex rounded-xl bg-white/5 p-1">
          {(['alacak', 'verecek'] as const).map(yon => (
            <button
              key={yon}
              onClick={() => setBorcListeGoster(yon)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                borcListeGoster === yon
                  ? yon === 'alacak' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-red-400/20 text-red-400'
                  : 'text-white/40'
              }`}
            >
              {yon === 'alacak' ? 'Alacaklar' : 'Verecekler'}
            </button>
          ))}
        </div>

        {/* Add Borç Button */}
        {isAdmin && (
          <button
            onClick={() => { setBorcYon(borcListeGoster); setBorcKisi(''); setBorcTutar(''); setBorcAciklama(''); setBorcTarih(todayStr()); setBorcParaBirimi('TRY'); setShowBorcModal(true); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white border border-ta/30 bg-ta/10 active:bg-ta/20"
          >
            <Plus className="w-4 h-4" /> Borç Ekle
          </button>
        )}

        {/* List */}
        {filteredBorclar.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">
            {borcListeGoster === 'alacak' ? 'Alacak kaydı yok' : 'Verecek kaydı yok'}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredBorclar.map((borc, i) => {
              const isAlacak = borc.yon === 'alacak';
              const accent = isAlacak ? '#34d399' : '#f87171';
              const paid = borc.tutar - borc.kalanTutar;
              const paidPct = borc.tutar > 0 ? (paid / borc.tutar) * 100 : 0;

              return (
                <motion.div
                  key={borc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{ ...glass, borderLeft: `3px solid ${accent}` }}
                  className="p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-medium text-sm">{borc.kisi}</p>
                      {borc.aciklama && <p className="text-white/40 text-xs mt-0.5">{borc.aciklama}</p>}
                      <p className="text-white/30 text-[10px] mt-0.5">{borc.tarih}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm" style={{ color: accent }}>{formatMoneyC(borc.tutar, borc.currency)}</p>
                      {borc.kalanTutar !== borc.tutar && (
                        <p className="text-white/40 text-[10px]">Kalan: {formatMoneyC(borc.kalanTutar, borc.currency)}</p>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-white/5 mb-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${paidPct}%`, background: accent }} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/30 text-[10px]">{paidPct.toFixed(0)}% ödendi</span>
                    <div className="flex items-center gap-2">
                      {isAdmin && borc.kalanTutar > 0 && (
                        <button
                          onClick={() => { setShowOdemeDialog(borc); setOdemeTutar(''); setOdemeAciklama(''); }}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-white"
                          style={{ background: accent }}
                        >
                          {isAlacak ? 'Tahsilat Yap' : 'Ödeme Yap'}
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => deletBorc(borc)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 active:bg-white/5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Pay Dağıtımı Handlers ─────────────────────────────────────────────
  const handlePayDagit = async () => {
    if (!payTutar || payOrtaklar.length === 0) return;
    setPaySaving(true);
    try {
      const hdrs = await authHeaders();
      const tutar = parseFloat(payTutar);
      const detay = payOrtaklar.map(o => ({ isim: o.isim, yuzde: o.yuzde, tutar: Math.round(tutar * o.yuzde / 100 * 100) / 100 }));

      // 1) İGD'ye tek satır gider olarak ekle
      const giderRes = await fetch(appendGhostParam(`${API_BASE}/isletme/giderler`), {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ category: 'pay-dagitimi', amount: tutar, description: `Pay Dağıtımı — ₺${tutar.toLocaleString('tr-TR')}`, date: new Date().toISOString().split('T')[0], currency: 'TRY' }),
      });
      // 2) Kasadan düş (ödendi olarak işaretle)
      if (giderRes.ok) {
        const giderData = await giderRes.json();
        const giderId = giderData?.gider?.id || giderData?.id || giderData?.giderId;
        if (giderId) {
          await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ode`), {
            method: 'POST', headers: hdrs,
            body: JSON.stringify({ giderId, tutar }),
          });
        }
      }
      // 3) Dağıtım detayını kaydet
      await fetch(appendGhostParam(`${API_BASE}/dagitim`), {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ toplamTutar: tutar, ortaklar: detay }),
      });

      setPayTutar('');
      fetchPayDagitimlar();
      fetchSirket();
    } catch {} finally { setPaySaving(false); }
  };

  const handleOrtakKaydet = async () => {
    setOrtakSaving(true);
    try {
      const ortaklar = ortakForm.filter(o => o.isim.trim()).map((o, i) => ({
        id: `ortak_${i}_${Date.now()}`,
        isim: o.isim.trim(),
        yuzde: parseFloat(o.yuzde) || 0,
      }));
      const res = await fetch(appendGhostParam(`${API_BASE}/ortaklar`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ ortaklar }),
      });
      if (res.ok) {
        setPayOrtaklar(ortaklar);
        setShowOrtakDuzenle(false);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Hata: ${res.status}`);
      }
    } catch (e: any) { alert(`Bağlantı hatası: ${e.message}`); } finally { setOrtakSaving(false); }
  };

  // ── Pay Dağıtımı Render ──────────────────────────────────────────────
  const renderPayDagitim = () => {
    const tutar = parseFloat(payTutar) || 0;
    const ortakToplamYuzde = payOrtaklar.reduce((s, o) => s + o.yuzde, 0);

    return (
      <AnimatePresence>
        {showPayDagitim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 overflow-y-auto"
          >
            <div className="min-h-screen px-5 py-6 pb-24">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setShowPayDagitim(false)} className="text-white/50 active:text-white flex items-center gap-1">
                  <ChevronDown className="w-5 h-5 rotate-90" />
                  <span className="text-sm">Geri</span>
                </button>
                <h2 className="text-white font-bold text-lg">Pay Dağıtımı</h2>
                <button onClick={() => { setOrtakForm(payOrtaklar.length > 0 ? payOrtaklar.map(o => ({ isim: o.isim, yuzde: String(o.yuzde) })) : [{ isim: '', yuzde: '' }]); setShowOrtakDuzenle(true); }}
                  className="p-2 rounded-lg text-white/40 active:bg-white/5">
                  <Settings className="w-5 h-5" />
                </button>
              </div>

              {/* Ortaklar */}
              {payOrtaklarLoading ? <LoadingSpinner /> : payOrtaklar.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm mb-3">Henüz ortak tanımlanmamış</p>
                  <button onClick={() => { setOrtakForm([{ isim: '', yuzde: '' }]); setShowOrtakDuzenle(true); }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-purple-500/20 border border-purple-500/30 active:bg-purple-500/30">
                    Ortak Ekle
                  </button>
                </div>
              ) : (
                <>
                  {/* Ortak Kartları */}
                  <div className="space-y-2 mb-5">
                    {payOrtaklar.map((o, i) => (
                      <motion.div key={o.id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        style={glass} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'rgba(168,85,247,0.3)' }}>
                            {o.isim.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-white text-sm font-medium">{o.isim}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-purple-400 font-bold text-sm">%{o.yuzde}</span>
                          {tutar > 0 && <p className="text-white/40 text-[10px]">{formatMoney(Math.round(tutar * o.yuzde / 100 * 100) / 100)}</p>}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Dağıtım Yap */}
                  <div style={glass} className="p-4 mb-5">
                    <label className="text-white/40 text-xs mb-2 block">Dağıtılacak Toplam Tutar (₺)</label>
                    <input
                      type="number"
                      value={payTutar}
                      onChange={e => setPayTutar(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-purple-500/50 mb-3"
                    />
                    {tutar > 0 && (
                      <div className="space-y-1.5 mb-4">
                        {payOrtaklar.map(o => (
                          <div key={o.id} className="flex items-center justify-between text-sm">
                            <span className="text-white/60">{o.isim} <span className="text-white/30">(%{o.yuzde})</span></span>
                            <span className="text-purple-400 font-bold">{formatMoney(Math.round(tutar * o.yuzde / 100 * 100) / 100)}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/10 pt-1.5 flex items-center justify-between text-sm">
                          <span className="text-white/60 font-medium">Toplam</span>
                          <span className="text-white font-bold">{formatMoney(tutar)}</span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handlePayDagit}
                      disabled={paySaving || !payTutar || tutar <= 0 || payOrtaklar.length === 0}
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
                    >
                      {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>💎</span>}
                      Dağıt
                    </button>
                  </div>

                  {/* Geçmiş Dağıtımlar */}
                  <div>
                    <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Geçmiş Dağıtımlar</h3>
                    {payDagitimlarLoading ? <LoadingSpinner /> : payDagitimlar.length === 0 ? (
                      <p className="text-white/30 text-sm text-center py-4">Henüz dağıtım yapılmamış</p>
                    ) : (
                      <div className="space-y-2">
                        {payDagitimlar.map((d: any) => (
                          <motion.div key={d.id} style={glass} className="overflow-hidden">
                            <button
                              onClick={() => setPayAccordionOpen(payAccordionOpen === d.id ? null : d.id)}
                              className="w-full p-3 flex items-center justify-between text-left"
                            >
                              <div>
                                <p className="text-white text-sm font-medium">{formatMoney(d.toplamTutar)}</p>
                                <p className="text-white/30 text-[10px]">{d.tarih} — {d.created_by}</p>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${payAccordionOpen === d.id ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                              {payAccordionOpen === d.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-3 space-y-1">
                                    {(d.ortaklar || []).map((o: any, i: number) => (
                                      <div key={i} className="flex items-center justify-between text-xs">
                                        <span className="text-white/50">{o.isim} <span className="text-white/30">(%{o.yuzde})</span></span>
                                        <span className="text-purple-400 font-medium">{formatMoney(o.tutar)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Ortak Düzenleme Modal */}
            <AnimatePresence>
              {showOrtakDuzenle && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-5"
                  onClick={() => setShowOrtakDuzenle(false)}>
                  <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                    className="w-full max-w-sm bg-[#1a1035] border border-white/10 rounded-2xl p-5"
                    onClick={e => e.stopPropagation()}>
                    <h3 className="text-white font-semibold mb-4">Ortakları Düzenle</h3>
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                      {ortakForm.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={o.isim}
                            onChange={e => { const f = [...ortakForm]; f[i] = { ...f[i], isim: e.target.value }; setOrtakForm(f); }}
                            placeholder="İsim"
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                          />
                          <input
                            type="number"
                            value={o.yuzde}
                            onChange={e => { const f = [...ortakForm]; f[i] = { ...f[i], yuzde: e.target.value }; setOrtakForm(f); }}
                            placeholder="%"
                            className="w-16 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none text-center"
                          />
                          <button onClick={() => setOrtakForm(ortakForm.filter((_, j) => j !== i))}
                            className="p-1.5 text-red-400/60 active:text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setOrtakForm([...ortakForm, { isim: '', yuzde: '' }])}
                      className="w-full py-2 rounded-lg text-sm text-purple-400 border border-purple-500/20 bg-purple-500/5 mb-4 active:bg-purple-500/10">
                      + Ortak Ekle
                    </button>
                    {(() => {
                      const toplam = ortakForm.reduce((s, o) => s + (parseFloat(o.yuzde) || 0), 0);
                      return toplam !== 100 && ortakForm.some(o => o.yuzde) ? (
                        <p className="text-red-400 text-xs mb-3">Toplam: %{toplam} — %100 olmalı</p>
                      ) : null;
                    })()}
                    <div className="flex gap-3">
                      <button onClick={() => setShowOrtakDuzenle(false)}
                        className="flex-1 py-2.5 rounded-xl text-white/60 text-sm bg-white/5 active:bg-white/10">İptal</button>
                      <button onClick={handleOrtakKaydet}
                        disabled={ortakSaving || ortakForm.filter(o => o.isim.trim()).length === 0 || Math.abs(ortakForm.reduce((s, o) => s + (parseFloat(o.yuzde) || 0), 0) - 100) > 0.01}
                        className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
                        {ortakSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Kaydet
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // ── Modals ────────────────────────────────────────────────────────────
  const renderIslemModal = (
    visible: boolean,
    onClose: () => void,
    onSubmit: () => void,
    title: string,
    showKategoriler?: string[]
  ) => (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#1a1035] border border-white/10 rounded-t-3xl p-5 pb-8"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">{title}</h3>
              <button onClick={onClose} className="p-2 rounded-xl text-white/40 active:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type Toggle */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-4">
              {(['gelir', 'gider'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFormTip(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    formTip === t
                      ? t === 'gelir' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-red-400/20 text-red-400'
                      : 'text-white/40'
                  }`}
                >
                  {t === 'gelir' ? 'Gelir' : 'Gider'}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">Tutar (₺)</label>
              <input
                type="number"
                value={formTutar}
                onChange={e => setFormTutar(e.target.value)}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-ta/50"
              />
            </div>

            {/* Category */}
            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">Kategori</label>
              {showKategoriler ? (
                <div className="flex flex-wrap gap-2">
                  {showKategoriler.map(k => (
                    <button
                      key={k}
                      onClick={() => setFormKategori(k)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        formKategori === k
                          ? 'border-ta/50 bg-ta/20 text-ta'
                          : 'border-white/10 bg-white/5 text-white/50'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  value={formKategori}
                  onChange={e => setFormKategori(e.target.value)}
                  placeholder="Kategori"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-ta/50"
                />
              )}
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">Açıklama</label>
              <input
                value={formAciklama}
                onChange={e => setFormAciklama(e.target.value)}
                placeholder="Açıklama (opsiyonel)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-ta/50"
              />
            </div>

            {/* Date */}
            <div className="mb-5">
              <label className="text-white/40 text-xs mb-1 block">Tarih</label>
              <input
                type="date"
                value={formTarih}
                onChange={e => setFormTarih(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-ta/50"
              />
            </div>

            <button
              onClick={onSubmit}
              disabled={formSaving || !formTutar}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'var(--app-accent)' }}
            >
              {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Kaydet
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderDevretDialog = () => (
    <AnimatePresence>
      {showDevretDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
          onClick={() => setShowDevretDialog(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1a1035] border border-white/10 rounded-2xl p-5"
          >
            <h3 className="text-white font-semibold mb-1">Devir Onayla</h3>
            <p className="text-white/50 text-sm mb-4">
              {showDevretDialog.mekanEmoji} {showDevretDialog.mekanAdi} - {formatMoney(showDevretDialog.ciro)}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDevretDialog(null)}
                className="flex-1 py-2.5 rounded-xl text-white/60 text-sm font-medium bg-white/5 active:bg-white/10"
              >
                İptal
              </button>
              <button
                onClick={handleDevret}
                disabled={formSaving}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'var(--app-accent)' }}
              >
                {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                Devret
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderBorcModal = () => (
    <AnimatePresence>
      {showBorcModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-8 overflow-y-auto"
          onClick={() => setShowBorcModal(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#1a1035] border border-white/10 rounded-t-3xl p-5 pb-8"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">Borç Ekle</h3>
              <button onClick={() => setShowBorcModal(false)} className="p-2 rounded-xl text-white/40 active:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direction Toggle */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-4">
              {(['alacak', 'verecek'] as const).map(y => (
                <button
                  key={y}
                  onClick={() => setBorcYon(y)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    borcYon === y
                      ? y === 'alacak' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-red-400/20 text-red-400'
                      : 'text-white/40'
                  }`}
                >
                  {y === 'alacak' ? 'Alacak' : 'Verecek'}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">Kişi Adı</label>
              <input
                value={borcKisi}
                onChange={e => setBorcKisi(e.target.value)}
                placeholder="İsim"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-ta/50"
              />
            </div>

            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">Tutar & Para Birimi</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={borcTutar}
                  onChange={e => setBorcTutar(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-ta/50"
                />
                <select
                  value={borcParaBirimi}
                  onChange={e => setBorcParaBirimi(e.target.value)}
                  className="w-20 bg-white/5 border border-white/10 rounded-xl px-2 py-3 text-white text-sm outline-none focus:border-ta/50 appearance-none text-center"
                >
                  <option value="TRY" className="bg-[#1a1035]">₺ TRY</option>
                  <option value="USD" className="bg-[#1a1035]">$ USD</option>
                  <option value="EUR" className="bg-[#1a1035]">€ EUR</option>
                  <option value="GBP" className="bg-[#1a1035]">£ GBP</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">Açıklama</label>
              <input
                value={borcAciklama}
                onChange={e => setBorcAciklama(e.target.value)}
                placeholder="Açıklama (opsiyonel)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-ta/50"
              />
            </div>

            <div className="mb-5">
              <label className="text-white/40 text-xs mb-1 block">Tarih</label>
              <input
                type="date"
                value={borcTarih}
                onChange={e => setBorcTarih(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-ta/50"
              />
            </div>

            <button
              onClick={handleBorcEkle}
              disabled={formSaving || !borcKisi || !borcTutar}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'var(--app-accent)' }}
            >
              {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Kaydet
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderOdemeDialog = () => (
    <AnimatePresence>
      {showOdemeDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
          onClick={() => setShowOdemeDialog(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1a1035] border border-white/10 rounded-2xl p-5"
          >
            <h3 className="text-white font-semibold mb-1">{showOdemeDialog.yon === 'alacak' ? 'Tahsilat Yap' : 'Ödeme Yap'}</h3>
            <p className="text-white/50 text-sm mb-4">
              {showOdemeDialog.kisi} - Kalan: {formatMoney(showOdemeDialog.kalanTutar)}
            </p>

            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">{showOdemeDialog.yon === 'alacak' ? 'Tahsilat' : 'Ödeme'} Tutarı (₺)</label>
              <input
                type="number"
                value={odemeTutar}
                onChange={e => setOdemeTutar(e.target.value)}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-ta/50"
              />
            </div>

            <div className="mb-5">
              <label className="text-white/40 text-xs mb-1 block">Açıklama</label>
              <input
                value={odemeAciklama}
                onChange={e => setOdemeAciklama(e.target.value)}
                placeholder="Açıklama (opsiyonel)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-ta/50"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowOdemeDialog(null)}
                className="flex-1 py-2.5 rounded-xl text-white/60 text-sm font-medium bg-white/5 active:bg-white/10"
              >
                İptal
              </button>
              <button
                onClick={handleOdeme}
                disabled={formSaving || !odemeTutar}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'var(--app-accent)' }}
              >
                {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {showOdemeDialog.yon === 'alacak' ? 'Tahsil Et' : 'Öde'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Kısmi Ödeme Dialog ──
  const renderKismiOdemeDialog = () => (
    <AnimatePresence>
      {showKismiOdemeDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
          onClick={() => setShowKismiOdemeDialog(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1a1035] border border-white/10 rounded-2xl p-5"
          >
            <h3 className="text-white font-semibold mb-1">Kısmi Ödeme</h3>
            <p className="text-white/50 text-sm mb-1">
              {showKismiOdemeDialog.personelAdi || showKismiOdemeDialog.description}
            </p>
            <p className="text-amber-400/70 text-xs mb-4">
              Kalan: {formatMoney(showKismiOdemeDialog.kalanTutar || showKismiOdemeDialog.amount)}
            </p>

            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">Ödeme Tutarı (TL)</label>
              <input
                type="number"
                value={kismiOdemeTutar}
                onChange={e => setKismiOdemeTutar(e.target.value)}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-ta/50"
              />
            </div>

            <div className="mb-5">
              <label className="text-white/40 text-xs mb-1 block">Açıklama</label>
              <input
                value={kismiOdemeAciklama}
                onChange={e => setKismiOdemeAciklama(e.target.value)}
                placeholder="Açıklama (opsiyonel)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-ta/50"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowKismiOdemeDialog(null)}
                className="flex-1 py-2.5 rounded-xl text-white/60 text-sm font-medium bg-white/5 active:bg-white/10"
              >
                İptal
              </button>
              <button
                onClick={handleKismiOdeme}
                disabled={odemeYapiliyor || !kismiOdemeTutar}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'var(--app-accent)' }}
              >
                {odemeYapiliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Öde
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Kişisel borç ekle ──
  const saveKisiselBorc = async () => {
    if (!borcKisi.trim() || !borcTutar) return;
    setFormSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/kisisel/borclar`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ yon: borcYon, kisi: borcKisi, tutar: Number(borcTutar), aciklama: borcAciklama, tarih: borcTarih, currency: borcParaBirimi }),
      });
      setShowKisiselBorcModal(false);
      setBorcKisi(''); setBorcTutar(''); setBorcAciklama('');
      fetchKisisel();
    } catch {} finally { setFormSaving(false); }
  };

  const payKisiselBorc = async () => {
    if (!showKisiselOdemeDialog || !odemeTutar) return;
    setFormSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa/kisisel/borclar/${showKisiselOdemeDialog.id}/odeme`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ tutar: Number(odemeTutar), aciklama: odemeAciklama }),
      });
      setShowKisiselOdemeDialog(null);
      setOdemeTutar(''); setOdemeAciklama('');
      fetchKisisel();
    } catch {} finally { setFormSaving(false); }
  };

  // ── Main Render ───────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}
    >
      {/* Page Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--app-accent-rgb),0.2)' }}>
            <Wallet className="w-5 h-5 text-ta" />
          </div>
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg">Kasa</h1>
            <p className="text-white/40 text-xs">{userName}</p>
          </div>
          <button
            onClick={() => setShowKasaGuide(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 8px rgba(251,191,36,0.2)' }}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-white/5 p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`${tab.key === 'borclar' ? 'px-3' : 'flex-1'} py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-ta/20 text-ta'
                  : 'text-white/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'sirket' && renderSirket()}
            {/* Kişisel kasa ayrı sayfaya taşınacak */}
            {activeTab === 'cariler' && renderCariler()}
            {activeTab === 'borclar' && renderBorclar()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modals */}
      {/* Şirket islem modalı kaldırıldı — v2'de gider ekleme bekleyen ödemelerden yapılıyor */}
      {renderDevretDialog()}
      {renderBorcModal()}
      {renderOdemeDialog()}
      {renderKismiOdemeDialog()}
      {isAdmin && renderPayDagitim()}

      {/* Kısmi Sil Dialog */}
      <AnimatePresence>
        {showKismiSilDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-5"
            onClick={() => setShowKismiSilDialog(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ ...glass, background: '#1a1a2e' }}
              onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-white">Kısmi Sil</h3>
              <p className="text-xs text-white/40">{showKismiSilDialog.label} — Toplam: {formatMoney(showKismiSilDialog.toplam)}</p>
              <input
                type="number"
                value={kismiSilTutar}
                onChange={e => setKismiSilTutar(e.target.value)}
                placeholder="Silinecek tutar (₺)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-red-400/50"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowKismiSilDialog(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/8 text-white/50 text-sm font-semibold">İptal</button>
                <button
                  disabled={!kismiSilTutar || Number(kismiSilTutar) <= 0}
                  onClick={async () => {
                    const tutar = Number(kismiSilTutar);
                    if (tutar <= 0) return;
                    try {
                      const hdrs = await authHeaders();
                      const item = showKismiSilDialog.items?.[0];
                      if (item?.giderId) {
                        await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/kismi-sil`), {
                          method: 'POST', headers: hdrs,
                          body: JSON.stringify({
                            giderId: item.giderId,
                            tutar,
                            aciklama: `${showKismiSilDialog.label} indirimi`,
                            personelAdi: item.personelAdi || '',
                            category: item.category || '',
                            ay: selectedMonth,
                          }),
                        });
                      }
                      setShowKismiSilDialog(null);
                      setKismiSilTutar('');
                      fetchSirket();
                    } catch {}
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-bold disabled:opacity-30 flex items-center justify-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> Sil
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kişisel kasa modalları kaldırıldı — ayrı sayfaya taşınacak */}

      {/* ── Para Girişi Modal ── */}
      <AnimatePresence>
        {showParaGirisi && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-5"
            onClick={() => setShowParaGirisi(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ ...glass, background: '#1a1a2e' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: '#34d399' }}>💰 Para Girişi</h3>
                <button onClick={() => setShowParaGirisi(false)} className="text-white/30"><X className="w-4 h-4" /></button>
              </div>
              <input type="number" value={aksiyonTutar} onChange={e => setAksiyonTutar(e.target.value)}
                placeholder="Tutar (₺)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-400/50" />
              {/* Ödeme yöntemi */}
              <div className="flex gap-2">
                {[{ key: 'cash', label: 'Nakit', color: '#22c55e' }, { key: 'card', label: 'Kart', color: '#f97316' }, { key: 'iban', label: 'İban', color: '#06b6d4' }].map(m => (
                  <button key={m.key} onClick={() => setAksiyonOdemeYontemi(m.key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${aksiyonOdemeYontemi === m.key ? 'text-white' : 'bg-white/5 border border-white/10 text-white/40'}`}
                    style={aksiyonOdemeYontemi === m.key ? { background: m.color, border: `1px solid ${m.color}` } : {}}>
                    {m.label}
                  </button>
                ))}
              </div>
              <input type="text" value={aksiyonAciklama} onChange={e => setAksiyonAciklama(e.target.value)}
                placeholder="Açıklama" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-400/50" />
              <input type="date" value={aksiyonTarih} onChange={e => setAksiyonTarih(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-400/50" />
              <div className="flex gap-2">
                <button onClick={() => setShowParaGirisi(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/8 text-white/50 text-sm font-semibold">İptal</button>
                <button onClick={handleParaGirisi} disabled={!aksiyonTutar || aksiyonSaving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #34d399, #059669)' }}>
                  {aksiyonSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Para Çıkışı Modal ── */}
      <AnimatePresence>
        {showParaCikisi && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-5"
            onClick={() => setShowParaCikisi(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ ...glass, background: '#1a1a2e' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: '#f87171' }}>💸 Para Çıkışı</h3>
                <button onClick={() => setShowParaCikisi(false)} className="text-white/30"><X className="w-4 h-4" /></button>
              </div>
              <input type="number" value={aksiyonTutar} onChange={e => setAksiyonTutar(e.target.value)}
                placeholder="Tutar (₺)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-red-400/50" />
              <select value={aksiyonKategori} onChange={e => setAksiyonKategori(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-red-400/50 appearance-none">
                <option value="" className="bg-[#1a1a2e]">Kategori seçin...</option>
                {GIDER_KATEGORILER.map(k => (
                  <option key={k} value={k} className="bg-[#1a1a2e]">{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
                {cariData.map(c => (
                  <option key={`cari-${c.kisi}`} value={c.kisi} className="bg-[#1a1a2e]">{c.emoji} {c.kisi}</option>
                ))}
              </select>
              {/* Ödeme yöntemi */}
              <div className="flex gap-2">
                {[{ key: 'cash', label: 'Nakit', color: '#22c55e' }, { key: 'card', label: 'Kart', color: '#f97316' }, { key: 'iban', label: 'İban', color: '#06b6d4' }].map(m => (
                  <button key={m.key} onClick={() => setAksiyonOdemeYontemi(m.key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${aksiyonOdemeYontemi === m.key ? 'text-white' : 'bg-white/5 border border-white/10 text-white/40'}`}
                    style={aksiyonOdemeYontemi === m.key ? { background: m.color, border: `1px solid ${m.color}` } : {}}>
                    {m.label}
                  </button>
                ))}
              </div>
              <input type="text" value={aksiyonAciklama} onChange={e => setAksiyonAciklama(e.target.value)}
                placeholder="Açıklama" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-red-400/50" />
              <input type="date" value={aksiyonTarih} onChange={e => setAksiyonTarih(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-red-400/50" />
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-white/50">Ödendi (kasadan)</span>
                <button onClick={() => setAksiyonOdendi(p => !p)}
                  className={`w-10 h-5 rounded-full transition-all ${aksiyonOdendi ? 'bg-emerald-500' : 'bg-white/15'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-all ${aksiyonOdendi ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowParaCikisi(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/8 text-white/50 text-sm font-semibold">İptal</button>
                <button onClick={handleParaCikisi} disabled={!aksiyonTutar || !aksiyonKategori || aksiyonSaving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #f87171, #dc2626)' }}>
                  {aksiyonSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Açılış Bakiye Modal ── */}
      <AnimatePresence>
        {showAcilisBakiye && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-5"
            onClick={() => setShowAcilisBakiye(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ ...glass, background: '#1a1a2e' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: '#60a5fa' }}>📋 Açılış Bakiyesi</h3>
                <button onClick={() => setShowAcilisBakiye(false)} className="text-white/30"><X className="w-4 h-4" /></button>
              </div>
              <input type="number" value={aksiyonTutar} onChange={e => setAksiyonTutar(e.target.value)}
                placeholder="Tutar (₺)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-400/50" />
              <input type="text" value={aksiyonAciklama} onChange={e => setAksiyonAciklama(e.target.value)}
                placeholder="Açıklama" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-400/50" />
              <div className="flex gap-2">
                <button onClick={() => setShowAcilisBakiye(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/8 text-white/50 text-sm font-semibold">İptal</button>
                <button onClick={handleAcilisBakiye} disabled={!aksiyonTutar || aksiyonSaving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #60a5fa, #2563eb)' }}>
                  {aksiyonSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Açılış Borcu Modal ── */}
      <AnimatePresence>
        {showAcilisBorc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-5"
            onClick={() => setShowAcilisBorc(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ ...glass, background: '#1a1a2e' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: '#fbbf24' }}>📋 Açılış Borcu</h3>
                <button onClick={() => setShowAcilisBorc(false)} className="text-white/30"><X className="w-4 h-4" /></button>
              </div>
              <input type="text" value={aksiyonKisi} onChange={e => setAksiyonKisi(e.target.value)}
                placeholder="Kişi / Firma adı" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-400/50" />
              <input type="number" value={aksiyonTutar} onChange={e => setAksiyonTutar(e.target.value)}
                placeholder="Tutar (₺)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-400/50" />
              <div className="space-y-1">
                <label className="text-[10px] text-white/40">Emoji (opsiyonel)</label>
                <div className="flex gap-2 flex-wrap">
                  {['🏢', '👤', '🏪', '🔧', '📦', '🚚', '🍽️', '💼'].map(em => (
                    <button key={em} onClick={() => setAksiyonEmoji(em)}
                      className={`text-lg p-1.5 rounded-lg transition-all ${aksiyonEmoji === em ? 'bg-amber-400/20 ring-1 ring-amber-400/40' : 'bg-white/5'}`}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <input type="text" value={aksiyonAciklama} onChange={e => setAksiyonAciklama(e.target.value)}
                placeholder="Açıklama" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-400/50" />
              <div className="flex gap-2">
                <button onClick={() => setShowAcilisBorc(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/8 text-white/50 text-sm font-semibold">İptal</button>
                <button onClick={handleAcilisBorc} disabled={!aksiyonKisi || !aksiyonTutar || aksiyonSaving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
                  {aksiyonSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Kasa Rehber Modalı */}
      <AnimatePresence>
        {showKasaGuide && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setShowKasaGuide(false)}>
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-ta" /> Kasa Rehberi
                </h3>
                <button onClick={() => setShowKasaGuide(false)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="p-4 space-y-4 text-[12px] leading-relaxed text-white/70">

                <div>
                  <h4 className="text-[13px] font-bold text-white mb-1.5">💰 Bakiye Kartı</h4>
                  <p>Üstteki ana kart şirketin güncel <span className="text-ta font-semibold">bakiyesini</span> gösterir.</p>
                  <p className="mt-1">• <span className="text-emerald-400 font-semibold">Alacak</span>: Tahsil edilmesi gereken tutar</p>
                  <p>• <span className="text-red-400 font-semibold">Verecek</span>: Ödenmesi gereken tutar</p>
                  <p>• <span className="text-purple-400 font-semibold">Net Bakiye</span>: Alacak − Verecek farkı</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">📊 Vardiya Devir · Ödenen · Bekleyen</h4>
                  <p>• <span className="text-ta font-semibold">Vardiya Devir</span>: Mekanlardan kasaya aktarılan toplam ciro</p>
                  <p>• <span className="text-emerald-400 font-semibold">Ödenen</span>: O ay içinde yapılan gider ödemeleri</p>
                  <p>• <span className="text-amber-400 font-semibold">Bekleyen</span>: Henüz ödenmemiş giderler</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">💳 Ödeme Dağılımı</h4>
                  <p>Kasaya giren paranın yöntemlere göre dağılımını gösterir:</p>
                  <div className="flex gap-2 mt-1.5">
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold">🟢 Nakit</span>
                    <span className="px-2 py-1 rounded-lg bg-orange-500/15 text-orange-400 text-[11px] font-bold">🟠 Kart</span>
                    <span className="px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-400 text-[11px] font-bold">🔵 İban</span>
                  </div>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">🔧 Aksiyonlar</h4>
                  <p>• <span className="text-emerald-400 font-semibold">💰 Para Girişi</span>: Kasaya manuel para ekleyin</p>
                  <p>• <span className="text-red-400 font-semibold">💸 Para Çıkışı</span>: Kasadan para çıkışı kaydedin</p>
                  <p>• <span className="text-blue-400 font-semibold">📋 Açılış Bakiye</span>: Ay başı açılış bakiyesini girin</p>
                  <p>• <span className="text-purple-400 font-semibold">📝 Açılış Borcu</span>: Mevcut borçları sisteme tanımlayın</p>
                  <p>• <span className="text-ta font-semibold">💎 Pay Dağıt</span>: Ortaklara kâr payı dağıtımı yapın</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">⏳ Bekleyen Ödemeler</h4>
                  <p>Ödenmemiş giderler kategoriye göre gruplanır.</p>
                  <p className="mt-1">• Tek tek veya <span className="text-ta font-semibold">Tümünü Öde</span> ile toplu ödeme yapabilirsiniz</p>
                  <p>• Kısmi ödeme desteklenir — kalan tutar takip edilir</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">👥 Cariler</h4>
                  <p>Tedarikçi ve iş ortaklarıyla olan hesap hareketlerini gösterir.</p>
                  <p className="mt-1">• Her cari için <span className="text-emerald-400 font-semibold">alacak</span> / <span className="text-red-400 font-semibold">verecek</span> bakiyesi takip edilir</p>
                  <p>• Detaya tıklayarak işlem geçmişini inceleyin</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">⚡ Önemli Kurallar</h4>
                  <p>• Kasaya yalnızca <span className="text-ta font-semibold">Yönetici</span> ve <span className="text-ta font-semibold">Üst Müdür</span> erişebilir</p>
                  <p>• Tüm para giriş/çıkış işlemleri kayıt altındadır</p>
                  <p>• Ay sonunda kasa kapatılabilir — kapatılan ay düzenlenemez</p>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Kasa;
