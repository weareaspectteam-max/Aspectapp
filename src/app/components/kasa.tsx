import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet, Plus, Trash2, ChevronLeft, ChevronRight, Eye, EyeOff,
  Loader2, RefreshCw, AlertTriangle, ArrowRightLeft, TrendingUp,
  TrendingDown, CreditCard, Banknote, Building2, X, Check,
  ChevronDown, ChevronUp, CircleDollarSign, Lock, CheckCircle
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

type TabKey = 'sirket' | 'kisisel' | 'borclar';

const KISISEL_KATEGORILER = ['Maaş', 'Kira', 'Market', 'Fatura', 'Yatırım', 'Diğer'];

// ── Helpers ────────────────────────────────────────────────────────────
const formatMoney = (n: number | undefined | null) => `₺${(n ?? 0).toLocaleString('tr-TR')}`;

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
  const isAdmin = userRole === 'yonetici';

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sirket', label: 'Şirket Kasası' },
    // Kişisel kasa ayrı sayfaya taşınacak
    { key: 'borclar', label: 'Borçlar' },
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
  const [showKismiOdemeDialog, setShowKismiOdemeDialog] = useState<any>(null);
  const [kismiOdemeTutar, setKismiOdemeTutar] = useState('');
  const [kismiOdemeAciklama, setKismiOdemeAciklama] = useState('');
  const [odemeYapiliyor, setOdemeYapiliyor] = useState(false);
  const [showKismiSilDialog, setShowKismiSilDialog] = useState<any>(null); // {giderId, label, toplam}
  const [kismiSilTutar, setKismiSilTutar] = useState('');

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
  const [borcAciklama, setBorcAciklama] = useState('');
  const [borcTarih, setBorcTarih] = useState(todayStr());

  // ─ Ödeme Form ─
  const [odemeTutar, setOdemeTutar] = useState('');
  const [odemeAciklama, setOdemeAciklama] = useState('');

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

  useEffect(() => {
    if (activeTab === 'sirket') fetchSirket();
    else if (activeTab === 'kisisel') fetchKisisel();
    else if (activeTab === 'borclar') fetchBorclar();
  }, [activeTab, fetchSirket, fetchKisisel, fetchBorclar]);

  // ── Actions ───────────────────────────────────────────────────────────
  const toggleGorunurluk = async () => {
    if (!isAdmin || !sirketData) return;
    try {
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/sirket/ayarlar`),
        {
          method: 'PUT',
          headers: await authHeaders(),
          body: JSON.stringify({ gorunurluk: !sirketData.gorunurluk }),
        }
      );
      setSirketData({ ...sirketData, gorunurluk: !sirketData.gorunurluk });
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
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/borclar`),
        {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            yon: borcYon,
            kisi: borcKisi,
            tutar: parseFloat(borcTutar),
            aciklama: borcAciklama,
            tarih: borcTarih,
          }),
        }
      );
      setBorcKisi('');
      setBorcTutar('');
      setBorcAciklama('');
      setBorcTarih(todayStr());
      setShowBorcModal(false);
      fetchBorclar();
    } catch {
    } finally {
      setFormSaving(false);
    }
  };

  const handleOdeme = async () => {
    if (!showOdemeDialog || !odemeTutar) return;
    setFormSaving(true);
    try {
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/borclar/${showOdemeDialog.id}/odeme`),
        {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            tutar: parseFloat(odemeTutar),
            aciklama: odemeAciklama,
          }),
        }
      );
      setShowOdemeDialog(null);
      setOdemeTutar('');
      setOdemeAciklama('');
      fetchBorclar();
    } catch {
    } finally {
      setFormSaving(false);
    }
  };

  const deletBorc = async (id: string) => {
    try {
      await fetch(
        appendGhostParam(`${API_BASE}/kasa/borclar/${id}`),
        { method: 'DELETE', headers: await authHeaders() }
      );
      fetchBorclar();
    } catch {}
  };

  const resetForm = () => {
    setFormTip('gelir');
    setFormTutar('');
    setFormKategori('');
    setFormAciklama('');
    setFormTarih(todayStr());
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
            <button onClick={toggleGorunurluk} className="p-2 rounded-xl bg-white/5 text-white/60 active:bg-white/10">
              {d.visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
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
          <p className="text-white/40 text-xs tracking-wider uppercase mb-1">Bakiye</p>
          <p className="text-3xl font-bold text-white mb-4">{formatMoney(d.bakiye)}</p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Devir Ciro</p>
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
          // Grup: personelAdi veya category bazlı
          const grouped: Record<string, { label: string; items: any[]; toplam: number }> = {};
          for (const o of odemeler) {
            const key = o.personelAdi || o.category || 'Diğer';
            if (!grouped[key]) grouped[key] = { label: key, items: [], toplam: 0 };
            grouped[key].items.push(o);
            grouped[key].toplam += (o.kalanTutar || o.amount || 0);
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
                      {gruplar.map(grup => (
                        <div key={grup.label} className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-amber-300">{grup.label}</span>
                            <span className="text-sm font-bold text-amber-300">{formatMoney(grup.toplam)}</span>
                          </div>
                          <p className="text-[10px] text-white/30 mb-2">{grup.items.length} adet bekleyen ödeme
                            {grup.items.some((it: any) => it.odpienenTutar > 0) && ` · ${formatMoney(grup.items.reduce((s: number, it: any) => s + (it.odpienenTutar || 0), 0))} kısmi ödendi`}
                          </p>

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
                            {/* Sol: Öde butonları */}
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
                            {/* Sağ: Sil butonları */}
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
                        </div>
                      ))}
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
                      : islem.tip === 'odeme' ? (islem.aciklama || 'Ödeme')
                      : islem.tip === 'silme' ? `📝 ${islem.aciklama || 'Silme/İndirim'}`
                      : islem.tip === 'gelir' ? 'Gelir' : 'Gider';

                    return (
                      <motion.div key={islem.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="py-2.5 border-b border-white/5 last:border-b-0">
                        {/* Tek satır */}
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 rounded-full shrink-0" style={{ background: borderColor }} />
                          <span className="text-[11px] font-medium truncate flex-1" style={{ color: borderColor }}>{label}</span>
                          <span className="text-[10px] text-white/25 shrink-0">{islem.tarih}</span>
                          <span className={`text-xs font-bold shrink-0 ${islem.tip === 'silme' ? 'text-red-500' : islem.tip === 'gider' ? 'text-red-400' : islem.tip === 'odeme' ? 'text-orange-400' : 'text-emerald-400'}`}>
                            {islem.tip === 'silme' ? '🗑️ -' : (islem.tip === 'gider' || islem.tip === 'odeme') ? '-' : '+'}{formatMoney(islem.tutar)}
                          </span>
                          {isAdmin && !d.ayKapatildi && islem.tip === 'odeme' && islem.giderId && (
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
                          {isAdmin && !d.ayKapatildi && islem.tip !== 'devir' && islem.tip !== 'odeme' && (
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
            <p className="text-emerald-400 font-bold text-lg">{formatMoney(d.toplamAlacak)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={glass} className="p-4 text-center">
            <TrendingDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Toplam Verecek</p>
            <p className="text-red-400 font-bold text-lg">{formatMoney(d.toplamVerecek)}</p>
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
            onClick={() => { setBorcYon(borcListeGoster); setBorcKisi(''); setBorcTutar(''); setBorcAciklama(''); setBorcTarih(todayStr()); setShowBorcModal(true); }}
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
                      <p className="font-bold text-sm" style={{ color: accent }}>{formatMoney(borc.tutar)}</p>
                      {borc.kalanTutar !== borc.tutar && (
                        <p className="text-white/40 text-[10px]">Kalan: {formatMoney(borc.kalanTutar)}</p>
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
                          Ödeme Yap
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => deletBorc(borc.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 active:bg-white/5">
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
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
              <label className="text-white/40 text-xs mb-1 block">Tutar (₺)</label>
              <input
                type="number"
                value={borcTutar}
                onChange={e => setBorcTutar(e.target.value)}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-ta/50"
              />
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
            <h3 className="text-white font-semibold mb-1">Ödeme Yap</h3>
            <p className="text-white/50 text-sm mb-4">
              {showOdemeDialog.kisi} - Kalan: {formatMoney(showOdemeDialog.kalanTutar)}
            </p>

            <div className="mb-3">
              <label className="text-white/40 text-xs mb-1 block">Ödeme Tutarı (₺)</label>
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
                Öde
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
        body: JSON.stringify({ yon: borcYon, kisi: borcKisi, tutar: Number(borcTutar), aciklama: borcAciklama, tarih: borcTarih }),
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
          <div>
            <h1 className="text-white font-bold text-lg">Kasa</h1>
            <p className="text-white/40 text-xs">{userName}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-white/5 p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
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
    </div>
  );
}

export default Kasa;
