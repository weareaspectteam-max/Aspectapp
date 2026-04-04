import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, User, X,
  Save, Loader2, WifiOff, RefreshCw, AlertCircle,
  Camera, ImageOff, Maximize2, Film, HelpCircle,
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { UserRole } from './login';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface GecmisKayit {
  id: string;
  tarih: string;
  not: string;
  ekleyen?: string;
}

interface Equipment {
  id: string;
  category: 'computer' | 'camera' | 'flash' | 'printer';
  brand: string;
  model: string;
  serialNumber: string;
  status: 'working' | 'broken' | 'maintenance';
  location: string;
  locationType?: 'mekan' | 'depo' | 'diger';
  locationId?: string;
  flashId?: string;
  notes?: string;
  gecmis?: GecmisKayit[];
  assignedTo?: string;
  assignedToId?: string;
  imagePath?: string;   // Storage'daki dosya yolu
  imageUrl?: string;    // Sunucudan gelen imzalı URL (geçici)
  olusturulmaTarihi?: string;
  guncellemeTarihi?: string;
  // Yazıcıya özgü alanlar
  ribonMevcut?: number;        // şu an içinde kaç ribon takımı var (manuel giriş)
  kagitTipiId?: string;        // Maliyet Yönetimi'ndeki kağıt ID'si
}

interface Mekan {
  id: string;
  name: string;
  emoji: string;
  color?: string;
}

interface PaperCost {
  id: string;
  name: string;
  boxPrice: number;
  currency: string;
  pcsPerBox: number;
  setsPerBox: number;
}

interface Kullanici {
  id: string;
  ad: string;
  rol: string;
  email: string;
}

interface EquipmentPageProps {
  userName: string;
  userRole: UserRole;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  embedded?: boolean;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const KATEGORILER = [
  { id: 'all',      label: 'Tümü',       icon: '📦', color: '#9ca3af' },
  { id: 'camera',   label: 'Kamera',     icon: '📷', color: '#d4b5f7' },
  { id: 'flash',    label: 'Flash',      icon: '⚡', color: '#ffd4a3' },
  { id: 'printer',  label: 'Yazıcı',     icon: '🖨️', color: '#9dd9ea' },
  { id: 'computer', label: 'Bilgisayar', icon: '💻', color: '#a8e6cf' },
];

const DURUMLAR = [
  { id: 'all',         label: 'Tümü',      icon: '📋' },
  { id: 'working',     label: 'Çalışıyor', icon: '✅' },
  { id: 'broken',      label: 'Arızalı',   icon: '❌' },
  { id: 'maintenance', label: 'Bakımda',   icon: '🔧' },
];

const BOŞ_FORM = {
  category:     'camera' as Equipment['category'],
  brand:        '',
  model:        '',
  serialNumber: '',
  status:       'working' as Equipment['status'],
  locationType: 'diger' as 'mekan' | 'depo' | 'diger',
  locationId:   '',
  locationText: '',
  flashId:      '',
  notes:        '',
  ribonMevcut:  '',
  kagitTipiId:  '',
};

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
const katRenk  = (id: string) => KATEGORILER.find(k => k.id === id)?.color || '#9dd9ea';
const katIkon  = (id: string) => KATEGORILER.find(k => k.id === id)?.icon || '📦';
const katLabel = (id: string) => {
  const map: Record<string, string> = { camera: 'Kameralar', flash: 'Flashlar', printer: 'Yazıcılar', computer: 'Bilgisayarlar' };
  return map[id] || id;
};
const durumClass = (s: string) => {
  if (s === 'working')     return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400';
  if (s === 'broken')      return 'bg-red-500/20 border-red-500/30 text-red-400';
  if (s === 'maintenance') return 'bg-amber-500/20 border-amber-500/30 text-amber-400';
  return 'bg-white/10 border-white/20 text-white/40';
};
const durumLabel = (s: string) => {
  if (s === 'working')     return 'Çalışıyor';
  if (s === 'broken')      return 'Arızalı';
  if (s === 'maintenance') return 'Bakımda';
  return s;
};

// Dosyayı base64 data URL'ye çevir
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ mesaj, tip, onKapat }: { mesaj: string; tip: 'basarili' | 'hata'; onKapat: () => void }) {
  useEffect(() => { const t = setTimeout(onKapat, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl border text-sm font-semibold shadow-2xl backdrop-blur max-w-xs text-center ${
      tip === 'basarili'
        ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-200'
        : 'bg-red-900/80 border-red-500/40 text-red-200'
    }`}>
      {mesaj}
    </div>
  );
}

// ─── Fotoğraf Bileşeni ───────────────────────────────────────────────────────
function EquipmentPhoto({ url, alt, className = '' }: { url: string; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return (
    <img
      src={url}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setErr(true)}
    />
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ url, alt, onKapat }: { url: string; alt: string; onKapat: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onKapat(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 backdrop-blur-md"
      onClick={onKapat}
    >
      <button
        onClick={onKapat}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center active:scale-90 transition-transform z-10"
      >
        <X className="w-5 h-5 text-white" />
      </button>
      <img
        src={url}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
        style={{ maxHeight: '90vh', maxWidth: '95vw' }}
        onClick={e => e.stopPropagation()}
      />
      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-white/40 text-center px-4">{alt}</p>
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export function EquipmentPage({ userName, userRole, onLogout, onNavigate, embedded = false }: EquipmentPageProps) {
  const [liste, setListe]             = useState<Equipment[]>([]);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [mekanlar, setMekanlar]       = useState<Mekan[]>([]);
  const [papers, setPapers]           = useState<PaperCost[]>([]);
  const [yukleniyor, setYukleniyor]   = useState(false);
  const [hataVar, setHataVar]         = useState(false);
  const [toast, setToast]             = useState<{ mesaj: string; tip: 'basarili' | 'hata' } | null>(null);

  // Filtreler
  const [katFilt, setKatFilt] = useState('all');
  const [durFilt, setDurFilt] = useState('all');
  const [zimFilt, setZimFilt] = useState('all');
  const [mekFilt, setMekFilt] = useState('all');
  const [arama, setArama]     = useState('');

  // Modallar
  const [modalAcik, setModalAcik]           = useState(false);
  const [showGuide, setShowGuide]           = useState(false);
  const [zimmetModal, setZimmetModal]       = useState(false);
  const [duzenleHedef, setDuzenleHedef]     = useState<Equipment | null>(null);
  const [zimmetHedef, setZimmetHedef]       = useState<Equipment | null>(null);
  const [form, setForm]                     = useState({ ...BOŞ_FORM });
  const [gecmisForm, setGecmisForm]         = useState<GecmisKayit[]>([]);
  const [yeniNot, setYeniNot]               = useState('');
  const [yeniTarih, setYeniTarih]           = useState(new Date().toISOString().split('T')[0]);
  const [gecmisAcik, setGecmisAcik]         = useState(false);
  const [kayitYukleniyor, setKayitYukleniyor] = useState(false);
  const [modalHata, setModalHata]           = useState('');

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');

  // Fotoğraf state
  const [fotoPreview, setFotoPreview]       = useState<string | null>(null); // önizleme (base64)
  const [fotoFile, setFotoFile]             = useState<File | null>(null);   // yüklenecek dosya
  const [mevcutFotoUrl, setMevcutFotoUrl]   = useState<string | null>(null); // mevcut imzalı URL
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
  const [fotoSil, setFotoSil]               = useState(false);               // mevcut fotoğrafı sil flag
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Yetkiler
  const canAdd    = ['admin','yonetici','ust-mudur','mudur','operasyon'].includes(userRole);
  const canEdit   = ['admin','yonetici','ust-mudur','mudur','operasyon'].includes(userRole);
  const canDel    = ['admin','yonetici','ust-mudur','mudur'].includes(userRole);
  const canAssign = ['admin','yonetici','ust-mudur','mudur'].includes(userRole);

  // ─── Veri Yükle ─────────────────────────────────────────────────────────────
  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHataVar(false);
    try {
      const h = await authHeaders();
      const [listeRes, kulRes, mekRes, maliyetRes] = await Promise.all([
        fetch(`${API_BASE}/malzeme/liste${ghostParams()}`,    { headers: h }),
        fetch(`${API_BASE}/auth/kullanicilar${ghostParams()}`, { headers: h }),
        fetch(`${API_BASE}/mekanlar${ghostParams()}`,          { headers: h }),
        fetch(`${API_BASE}/maliyetler${ghostParams()}`,          { headers: h }),
      ]);
      const listeJson   = await listeRes.json();
      const kulJson     = await kulRes.json();
      const mekJson     = await mekRes.json();
      const maliyetJson = await maliyetRes.json().catch(() => ({}));
      if (listeJson.ekipmanlar) setListe(listeJson.ekipmanlar);
      if (kulJson.kullanicilar) setKullanicilar(kulJson.kullanicilar);
      if (mekJson.mekanlar)     setMekanlar(mekJson.mekanlar);
      if (maliyetJson.papers)   setPapers((maliyetJson.papers as PaperCost[]).filter(p => p.pcsPerBox && p.setsPerBox));
    } catch (err) {
      console.error('[EquipmentPage] Veri yüklenemedi:', err);
      setHataVar(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  // ─── Filtrele ────────────────────────────────────────────────────────────────
  const filtrelenmis = liste.filter(eq => {
    const aramaUygun =
      eq.brand.toLowerCase().includes(arama.toLowerCase()) ||
      eq.model.toLowerCase().includes(arama.toLowerCase()) ||
      eq.serialNumber.toLowerCase().includes(arama.toLowerCase());
    const katUygun = katFilt === 'all' || eq.category === katFilt;
    const durUygun = durFilt === 'all' || eq.status === durFilt;
    let zimUygun = true;
    if (zimFilt === 'unassigned') zimUygun = !eq.assignedTo;
    else if (zimFilt === 'assigned') zimUygun = !!eq.assignedTo;
    else if (zimFilt !== 'all') zimUygun = eq.assignedTo === zimFilt;
    const mekUygun = mekFilt === 'all'
      ? true
      : mekFilt === 'diger'
        ? (!eq.locationType || eq.locationType !== 'mekan')
        : eq.locationId === mekFilt;
    return aramaUygun && katUygun && durUygun && zimUygun && mekUygun;
  });

  const stats = {
    toplam:    filtrelenmis.length,
    calisiyor: filtrelenmis.filter(e => e.status === 'working').length,
    arizali:   filtrelenmis.filter(e => e.status === 'broken').length,
    bakimda:   filtrelenmis.filter(e => e.status === 'maintenance').length,
  };

  const secilebilirFlashlar = liste.filter(eq => {
    if (eq.category !== 'flash') return false;
    if (duzenleHedef && eq.id === duzenleHedef.flashId) return true;
    const atanmisIds = liste
      .filter(e => e.category === 'camera' && e.flashId && e.id !== duzenleHedef?.id)
      .map(e => e.flashId);
    return !atanmisIds.includes(eq.id);
  });

  // ─── Modal Aç/Kapat ─────────────────────────────────────────────────────────
  const modalKapat = () => {
    setModalAcik(false);
    setDuzenleHedef(null);
    setForm({ ...BOŞ_FORM });
    setGecmisForm([]);
    setYeniNot('');
    setYeniTarih(new Date().toISOString().split('T')[0]);
    setGecmisAcik(false);
    setModalHata('');
    setFotoPreview(null);
    setFotoFile(null);
    setMevcutFotoUrl(null);
    setFotoSil(false);
  };

  const duzenleBas = (eq: Equipment) => {
    setDuzenleHedef(eq);
    setForm({
      category:     eq.category,
      brand:        eq.brand,
      model:        eq.model,
      serialNumber: eq.serialNumber,
      status:       eq.status,
      locationType: (eq.locationType as any) || 'diger',
      locationId:   eq.locationId || '',
      locationText: (!eq.locationType || eq.locationType === 'diger') ? eq.location : '',
      flashId:      eq.flashId || '',
      notes:        eq.notes || '',
      ribonMevcut:  eq.ribonMevcut !== undefined ? String(eq.ribonMevcut) : '',
      kagitTipiId:  eq.kagitTipiId || '',
    });
    setGecmisForm(eq.gecmis || []);
    setGecmisAcik(false);
    setFotoPreview(null);
    setFotoFile(null);
    setMevcutFotoUrl(eq.imageUrl || null);
    setFotoSil(false);
    setModalAcik(true);
  };

  // ─── Fotoğraf seç ───────────────────────────────────────────────────────────
  const handleFotoSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      setModalHata("Fotograf max 5MB olmalidir.");
      return;
    }
    setFotoFile(file);
    const base64 = await fileToBase64(file);
    setFotoPreview(base64);
    setMevcutFotoUrl(null);
    setFotoSil(false);
    setModalHata('');
  };

  const handleFotoKaldir = () => {
    setFotoPreview(null);
    setFotoFile(null);
    if (mevcutFotoUrl) setFotoSil(true);
    setMevcutFotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Fotoğraf Yükle (sunucuya) ──────────────────────────────────────────────
  const fotoYukle = async (equipmentId: string): Promise<string | null> => {
    if (!fotoFile || !fotoPreview) return null;
    setFotoYukleniyor(true);
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_BASE}/malzeme/foto-yukle`, {
        method:  'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageData: fotoPreview, equipmentId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Yükleme başarısız');
      return json.imagePath as string;
    } catch (err: any) {
      console.error('[EquipmentPage] fotoYukle:', err);
      setModalHata('Fotoğraf yüklenemedi: ' + (err.message || 'Sunucu hatası'));
      return null;
    } finally {
      setFotoYukleniyor(false);
    }
  };

  // ─── Ekle / Güncelle ────────────────────────────────────────────────────────
  const kaydet = async () => {
    let konumStr = '';
    if (form.locationType === 'depo') {
      konumStr = '🏭 Depo';
    } else if (form.locationType === 'mekan') {
      if (!form.locationId) { setModalHata('Lütfen bir mekan seçin.'); return; }
      const m = mekanlar.find(m => m.id === form.locationId);
      konumStr = m ? `${m.emoji} ${m.name}` : 'Bilinmeyen Mekan';
    } else {
      if (!form.locationText.trim()) { setModalHata('Konum girin.'); return; }
      konumStr = form.locationText.trim();
    }
    if (!form.brand || !form.model || !form.serialNumber) {
      setModalHata('Marka, model ve seri no zorunludur.');
      return;
    }

    setKayitYukleniyor(true);
    setModalHata('');

    try {
      const h = await authHeaders();

      // ── 1) Yeni ekipman için önce ID ile placeholder kaydet, sonra fotoğraf yükle ──
      // ── Alternatif: önce kaydet, ID al, fotoğraf yükle, imagePath ile güncelle ────
      let imagePath: string | undefined = duzenleHedef?.imagePath;

      // Eğer fotoSil flag'i varsa (mevcut fotoğraf kaldırıldı)
      if (fotoSil) imagePath = undefined;

      const body = {
        category:     form.category,
        brand:        form.brand,
        model:        form.model,
        serialNumber: form.serialNumber,
        status:       form.status,
        location:     konumStr,
        locationType: form.locationType,
        locationId:   form.locationType === 'mekan' ? form.locationId : undefined,
        flashId:      form.flashId || undefined,
        notes:        form.notes || undefined,
        gecmis:       gecmisForm,
        imagePath,
        // Yazıcıya özgü alanlar
        ribonMevcut: form.category === 'printer' && form.ribonMevcut !== ''
          ? Number(form.ribonMevcut) : undefined,
        kagitTipiId: form.category === 'printer' && form.kagitTipiId
          ? form.kagitTipiId : undefined,
        ...(duzenleHedef ? { id: duzenleHedef.id } : {}),
      };

      const url    = duzenleHedef ? `${API_BASE}/malzeme/guncelle` : `${API_BASE}/malzeme/ekle`;
      const method = duzenleHedef ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: h, body: JSON.stringify(body) });
      const json   = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);

      const savedId = json.ekipman?.id || duzenleHedef?.id;

      // ── 2) Fotoğraf seçilmişse yükle, ardından imagePath'i güncelle ─────────────
      if (fotoFile && fotoPreview && savedId) {
        const newPath = await fotoYukle(savedId);
        if (newPath) {
          // Ekipmanı imagePath ile güncelle
          await fetch(`${API_BASE}/malzeme/guncelle`, {
            method: 'PUT',
            headers: { ...h, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: savedId, imagePath: newPath }),
          });
        }
      }

      // ── Flash konum senkronizasyonu ────────────────────────────────────────────
      if (form.category === 'camera' && form.flashId) {
        try {
          await fetch(`${API_BASE}/malzeme/guncelle`, {
            method: 'PUT', headers: h,
            body: JSON.stringify({
              id: form.flashId,
              location: konumStr,
              locationType: form.locationType,
              locationId: form.locationType === 'mekan' ? form.locationId : undefined,
            }),
          });
        } catch (e) {
          console.warn('[EquipmentPage] Flash konum senkronizasyonu başarısız:', e);
        }
      }

      setToast({ mesaj: duzenleHedef ? '✅ Ekipman güncellendi.' : '✅ Ekipman eklendi.', tip: 'basarili' });
      modalKapat();
      yukle();
    } catch (err: any) {
      setModalHata(err.message || 'İşlem başarısız.');
    } finally {
      setKayitYukleniyor(false);
    }
  };

  // ─── Sil ────────────────────────────────────────────────────────────────────
  const sil = async (eq: Equipment) => {
    if (!window.confirm(`${eq.brand} ${eq.model} silinecek. Emin misiniz?`)) return;
    try {
      const h = await authHeaders();
      const res  = await fetch(`${API_BASE}/malzeme/sil/${eq.id}`, { method: 'DELETE', headers: h });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setToast({ mesaj: '🗑️ Ekipman silindi.', tip: 'basarili' });
      yukle();
    } catch (err: any) {
      setToast({ mesaj: err.message || 'Silme başarısız.', tip: 'hata' });
    }
  };

  // ─── Zimmet ─────────────────────────────────────────────────────────────────
  const zimmetBas = (eq: Equipment) => { setZimmetHedef(eq); setZimmetModal(true); };

  const zimmetAta = async (kul: Kullanici | null) => {
    if (!zimmetHedef) return;
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_BASE}/malzeme/zimmet`, {
        method: 'PUT',
        headers: h,
        body: JSON.stringify({ id: zimmetHedef.id, assignedTo: kul?.ad || null, assignedToId: kul?.id || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setToast({ mesaj: kul ? `✅ ${kul.ad}'a zimmetlendi.` : '✅ Zimmet kaldırıldı.', tip: 'basarili' });
      setZimmetModal(false);
      setZimmetHedef(null);
      yukle();
    } catch (err: any) {
      setToast({ mesaj: err.message || 'Zimmet başarısız.', tip: 'hata' });
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pb-24 min-h-screen" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #120830 50%, #1a0a3c 100%))' }}>
      {toast && <Toast mesaj={toast.mesaj} tip={toast.tip} onKapat={() => setToast(null)} />}

      {/* Lightbox */}
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} alt={lightboxAlt} onKapat={() => setLightboxUrl(null)} />
      )}

      {/* Header */}
      <div className="bg-[rgba(0,0,0,0.75)] backdrop-blur-xl border-b border-white/10 px-4 pt-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Malzeme Yönetimi</h1>
              <span className="text-base">📦</span>
            </div>
            <p className="text-[10px] text-white/30 mt-0.5">
              {yukleniyor ? 'Yükleniyor...' : hataVar ? 'Bağlantı hatası' : `${liste.length} ekipman · Supabase KV`}
            </p>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 8px rgba(251,191,36,0.2)' }}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>
          {canAdd && (
            <button
              onClick={() => { setDuzenleHedef(null); setForm({ ...BOŞ_FORM }); setModalAcik(true); }}
              className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
            </button>
          )}
          <button
            onClick={yukle} disabled={yukleniyor}
            className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 text-white/50 ${yukleniyor ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {yukleniyor && liste.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-24 gap-3">
          <Loader2 className="w-8 h-8 text-ta animate-spin" />
          <span className="text-sm text-white/30">Ekipmanlar yükleniyor...</span>
        </div>
      )}

      {hataVar && liste.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl border border-red-500/20 bg-red-500/8 px-5 py-6 text-center">
          <WifiOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <div className="text-sm font-semibold text-red-300 mb-1">Veri yüklenemedi</div>
          <button onClick={yukle}
            className="mt-3 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-300 active:scale-95 transition-transform">
            Tekrar Dene
          </button>
        </div>
      )}

      {!yukleniyor && !hataVar && (
        <div className="px-4 pt-4 space-y-4">

          {/* İstatistikler */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Toplam',    deger: stats.toplam,    renk: 'text-white',       bg: 'from-white/10 to-white/5',              border: 'border-white/15' },
              { label: 'Çalışıyor', deger: stats.calisiyor, renk: 'text-emerald-400', bg: 'from-emerald-500/15 to-emerald-600/10', border: 'border-emerald-500/25' },
              { label: 'Arızalı',   deger: stats.arizali,   renk: 'text-red-400',     bg: 'from-red-500/15 to-red-600/10',         border: 'border-red-500/25' },
              { label: 'Bakımda',   deger: stats.bakimda,   renk: 'text-amber-400',   bg: 'from-amber-500/15 to-amber-600/10',     border: 'border-amber-500/25' },
            ].map(({ label, deger, renk, bg, border }) => (
              <div key={label} className={`backdrop-blur rounded-xl p-3 flex flex-col items-center bg-gradient-to-br ${bg} border ${border}`}>
                <div className={`text-2xl font-bold mb-0.5 ${renk}`}>{deger}</div>
                <div className="text-[10px] text-white/35">{label}</div>
              </div>
            ))}
          </div>

          {/* Filtreler */}
          <div className="rounded-2xl border border-white/10 bg-[rgba(0,0,0,0.4)] backdrop-blur p-4 space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Kategori</p>
              <div className="flex flex-wrap gap-1.5">
                {KATEGORILER.map(k => (
                  <button key={k.id} onClick={() => setKatFilt(k.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      katFilt === k.id ? 'bg-white/12 border-white/25 text-white' : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                    }`}>
                    <span>{k.icon}</span>{k.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Durum</p>
              <div className="flex flex-wrap gap-1.5">
                {DURUMLAR.map(d => (
                  <button key={d.id} onClick={() => setDurFilt(d.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      durFilt === d.id ? 'bg-white/12 border-white/25 text-white' : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                    }`}>
                    <span>{d.icon}</span>{d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Zimmet</p>
              <div className="flex gap-1.5">
                {[
                  { id: 'all',        label: 'Tümü',      icon: '👥' },
                  { id: 'unassigned', label: 'Zimmetsiz', icon: '📦' },
                  { id: 'assigned',   label: 'Zimmetli',  icon: '👤' },
                ].map(z => (
                  <button key={z.id} onClick={() => setZimFilt(z.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      zimFilt === z.id ? 'bg-white/12 border-white/25 text-white' : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                    }`}>
                    <span>{z.icon}</span>{z.label}
                  </button>
                ))}
              </div>
            </div>
            {mekanlar.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Mekan</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setMekFilt('all')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      mekFilt === 'all' ? 'bg-white/12 border-white/25 text-white' : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                    }`}>
                    <span>🗺️</span>Tümü
                  </button>
                  {mekanlar.map(m => (
                    <button key={m.id} onClick={() => setMekFilt(m.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        mekFilt === m.id ? 'bg-white/12 border-white/25 text-white' : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                      }`}>
                      <span>{m.emoji}</span>{m.name}
                    </button>
                  ))}
                  <button onClick={() => setMekFilt('diger')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      mekFilt === 'diger' ? 'bg-white/12 border-white/25 text-white' : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                    }`}>
                    <span>📍</span>Diğer
                  </button>
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type="text" value={arama} onChange={e => setArama(e.target.value)}
                placeholder="Marka, model veya seri no..."
                className="w-full h-9 rounded-xl bg-white/6 border border-white/12 text-white text-xs pl-9 pr-3 outline-none placeholder-white/20 focus:border-ta/40"
              />
            </div>
          </div>

          {/* Liste */}
          {filtrelenmis.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[rgba(0,0,0,0.4)] p-8 text-center">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm font-semibold text-white mb-1">Ekipman bulunamadı</div>
              <div className="text-xs text-white/30">
                {liste.length === 0 ? 'Henüz ekipman eklenmemiş. + butonuna basın.' : 'Filtreleri değiştirin.'}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrelenmis.map(eq => {
                const catColor      = katRenk(eq.category);
                const atanmisFlash  = eq.flashId ? liste.find(e => e.id === eq.flashId) : null;
                const atandigiMakina = eq.category === 'flash'
                  ? liste.find(e => e.category === 'camera' && e.flashId === eq.id)
                  : null;
                return (
                  <div key={eq.id}
                    className="rounded-2xl border border-white/12 bg-[rgba(0,0,0,0.45)] backdrop-blur overflow-hidden">

                    {/* Fotoğraf şeridi (varsa) */}
                    {eq.imageUrl && (
                      <div className="relative w-full h-40 bg-black/40">
                        <EquipmentPhoto
                          url={eq.imageUrl}
                          alt={`${eq.brand} ${eq.model}`}
                          className="w-full h-full object-cover"
                        />
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.7)] via-transparent to-transparent" />
                        {/* Durum rozeti üstte */}
                        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${durumClass(eq.status)}`}>
                          {durumLabel(eq.status)}
                        </div>
                        {/* Büyüt butonu sağ alt */}
                        <button
                          onClick={() => { setLightboxUrl(eq.imageUrl!); setLightboxAlt(`${eq.brand} ${eq.model}`); }}
                          className="absolute bottom-3 right-3 w-8 h-8 rounded-xl bg-black/50 border border-white/20 flex items-center justify-center backdrop-blur-sm active:scale-90 transition-transform"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-white/80" />
                        </button>
                      </div>
                    )}

                    <div className="p-4">
                      {/* Üst satır */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${catColor}22`, border: `2px solid ${catColor}44` }}>
                          <span className="text-2xl">{katIkon(eq.category)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white text-base leading-tight">{eq.brand} {eq.model}</h3>
                          <p className="text-[11px] text-white/35 mt-0.5">{katLabel(eq.category)}</p>
                        </div>
                        {/* Durum (fotoğraf yoksa burada göster) */}
                        {!eq.imageUrl && (
                          <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold shrink-0 ${durumClass(eq.status)}`}>
                            {durumLabel(eq.status)}
                          </div>
                        )}
                      </div>

                      {/* Seri no */}
                      <div className="rounded-xl bg-black/30 border border-white/6 px-3 py-2 mb-3">
                        <p className="text-[10px] text-white/30 mb-0.5">Seri Numarası</p>
                        <p className="font-mono text-white text-xs font-semibold">{eq.serialNumber}</p>
                      </div>

                      {/* Lokasyon + Zimmet */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2">
                          <p className="text-[10px] text-white/30 mb-0.5">📍 Konum</p>
                          <p className="text-xs font-semibold text-white">{eq.location}</p>
                        </div>
                        <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2">
                          <p className="text-[10px] text-white/30 mb-0.5">👤 Zimmet</p>
                          <p className="text-xs font-semibold text-white truncate">{eq.assignedTo || 'Genel Havuz'}</p>
                        </div>
                      </div>

                      {/* Flash bağlantısı — kamera tarafı */}
                      {eq.category === 'camera' && atanmisFlash && (
                        <div className="rounded-xl bg-blue-500/10 border border-blue-500/25 px-3 py-2 mb-3 flex items-center gap-2">
                          <span className="text-base">⚡</span>
                          <div>
                            <p className="text-[10px] text-blue-300">Atanmış Flash</p>
                            <p className="text-xs font-bold text-white">{atanmisFlash.brand} {atanmisFlash.model}</p>
                            <p className="text-[10px] text-blue-200/50 font-mono">{atanmisFlash.serialNumber}</p>
                          </div>
                        </div>
                      )}

                      {/* Flash bağlantısı — flash tarafı */}
                      {eq.category === 'flash' && atandigiMakina && (
                        <div className="rounded-xl bg-ta/10 border border-ta/25 px-3 py-2 mb-3 flex items-center gap-2">
                          <span className="text-base">📷</span>
                          <div>
                            <p className="text-[10px] text-ta">Atandığı Makina</p>
                            <p className="text-xs font-bold text-white">{atandigiMakina.brand} {atandigiMakina.model}</p>
                            <p className="text-[10px] text-ta/50 font-mono">{atandigiMakina.serialNumber}</p>
                          </div>
                        </div>
                      )}
                      {eq.category === 'flash' && !atandigiMakina && (
                        <div className="rounded-xl bg-white/4 border border-white/8 px-3 py-2 mb-3 flex items-center gap-2">
                          <span className="text-base">📷</span>
                          <div>
                            <p className="text-[10px] text-white/25">Atandığı Makina</p>
                            <p className="text-xs font-semibold text-white/35">Henüz atanmadı</p>
                          </div>
                        </div>
                      )}

                      {/* Geçmiş özeti */}
                      {eq.gecmis && eq.gecmis.length > 0 && (() => {
                        const son = [...eq.gecmis].sort((a, b) => b.tarih.localeCompare(a.tarih))[0];
                        return (
                          <div className="rounded-xl bg-ta/8 border border-ta/20 px-3 py-2 mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-ta/70 uppercase tracking-wider">📋 Geçmiş</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ta/20 border border-ta/25 text-ta">{eq.gecmis.length} kayıt</span>
                            </div>
                            <p className="text-xs text-white/60 leading-relaxed truncate">{son.not}</p>
                            <p className="text-[9px] text-ta/50 mt-0.5">
                              {new Date(son.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Yazıcı: Kağıt Tipi bilgisi */}
                      {eq.category === 'printer' && (() => {
                        const paper = eq.kagitTipiId ? papers.find(p => p.id === eq.kagitTipiId) : null;
                        if (!paper) return null;
                        const kapasite = Math.round(Number(paper.pcsPerBox) / Number(paper.setsPerBox));
                        return (
                          <div className="rounded-xl bg-[#9dd9ea]/8 border border-[#9dd9ea]/20 px-3 py-2.5 mb-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="text-[11px]">🗂️</span>
                              <p className="text-[10px] font-bold text-[#9dd9ea]/70 uppercase tracking-wider">Kağıt Tipi</p>
                            </div>
                            <p className="text-sm font-bold text-[#9dd9ea]">{paper.name}</p>
                            <p className="text-[10px] text-white/30 mt-1">
                              {paper.pcsPerBox} adet / {paper.setsPerBox} takım · <span className="text-[#9dd9ea]/60">{kapasite} baskı/takım</span>
                            </p>
                            <p className="text-[10px] text-white/25 mt-0.5">
                              Tam boy: {kapasite} kare/takım · Yarım boy: {kapasite * 2} kare/takım
                            </p>
                          </div>
                        );
                      })()}

                      {/* Yazıcı: Ribon & Sayaç bilgisi */}
                      {eq.category === 'printer' && (
                        <div className="rounded-xl bg-[#d4b5f7]/8 border border-[#d4b5f7]/20 px-3 py-2.5 mb-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Film className="w-3 h-3 text-[#d4b5f7]" />
                            <p className="text-[10px] font-bold text-[#d4b5f7]/70 uppercase tracking-wider">Ribon & Sayaç</p>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <div className="bg-black/30 rounded-lg px-2.5 py-2 text-center">
                              <p className="text-[9px] text-white/30 mb-0.5">İçindeki Ribon</p>
                              <p className="text-base font-black text-[#d4b5f7]">
                                {eq.ribonMevcut !== undefined ? eq.ribonMevcut : '—'}
                              </p>
                              <p className="text-[8px] text-white/20">adet</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Notlar */}
                      {eq.notes && (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 mb-3">
                          <p className="text-[10px] text-amber-300">💬 {eq.notes}</p>
                        </div>
                      )}

                      {eq.guncellemeTarihi && (
                        <p className="text-[9px] text-white/18 mb-3">
                          Son güncelleme: {new Date(eq.guncellemeTarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}

                      {/* Butonlar */}
                      <div className={`grid gap-2 ${
                        canEdit && canAssign && canDel ? 'grid-cols-3' :
                        canEdit && canAssign ? 'grid-cols-2' :
                        canEdit || canAssign || canDel ? 'grid-cols-1' : 'grid-cols-1'
                      }`}>
                        {canEdit && (
                          <button onClick={() => duzenleBas(eq)}
                            className="bg-blue-500/15 border border-blue-500/25 text-blue-400 font-semibold py-2 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1">
                            <Edit2 className="w-3.5 h-3.5" />Düzenle
                          </button>
                        )}
                        {canAssign && (
                          <button onClick={() => zimmetBas(eq)}
                            className="bg-ta/15 border border-ta/25 text-ta font-semibold py-2 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1">
                            <User className="w-3.5 h-3.5" />Zimmet
                          </button>
                        )}
                        {canDel && (
                          <button onClick={() => sil(eq)}
                            className="bg-red-500/15 border border-red-500/25 text-red-400 font-semibold py-2 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1">
                            <Trash2 className="w-3.5 h-3.5" />Sil
                          </button>
                        )}
                        {!canEdit && !canAssign && !canDel && (
                          <div className="bg-white/5 border border-white/10 text-white/25 font-semibold py-2 rounded-xl text-xs flex items-center justify-center">
                            Görüntüleme Modu
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Ekle / Düzenle Modalı ────────────────────────────────────────────── */}
      {modalAcik && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) modalKapat(); }}>
          <div className="w-full max-w-md bg-[rgba(0,0,0,0.85)] border border-white/12 rounded-t-3xl overflow-hidden mb-16"
            style={{ maxHeight: '92vh' }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">{duzenleHedef ? '✏️' : '➕'}</span>
                <h2 className="text-sm font-bold text-white">
                  {duzenleHedef ? 'Ekipman Düzenle' : 'Yeni Ekipman Ekle'}
                </h2>
              </div>
              <button onClick={modalKapat}
                className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center active:scale-90">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: 'calc(92vh - 80px)' }}>

              {/* ── FOTOĞRAF SEKSİYONU ── */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">
                  📷 Ekipman Fotoğrafı
                </label>

                {/* Önizleme veya mevcut fotoğraf */}
                {(fotoPreview || mevcutFotoUrl) ? (
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-white/12 bg-black/40 mb-2">
                    <img
                      src={fotoPreview || mevcutFotoUrl!}
                      alt="Ekipman fotoğrafı"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Kaldır / Değiştir butonları */}
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 px-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ta/80 border border-ta/40 text-white text-xs font-semibold backdrop-blur active:scale-95 transition-all"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Değiştir
                      </button>
                      <button
                        onClick={handleFotoKaldir}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/80 border border-red-400/40 text-white text-xs font-semibold backdrop-blur active:scale-95 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        Kaldır
                      </button>
                    </div>

                    {/* Yükleniyor overlay */}
                    {fotoYukleniyor && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-ta animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fotoğraf seç butonu */
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-36 rounded-2xl border-2 border-dashed border-white/15 bg-white/3 hover:border-ta/40 hover:bg-ta/5 transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-ta/15 border border-ta/25 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-ta" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white/50">Fotoğraf Ekle</p>
                      <p className="text-[11px] text-white/25 mt-0.5">JPG, PNG · Max 5MB</p>
                    </div>
                  </button>
                )}

                {/* Gizli file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={handleFotoSec}
                  className="hidden"
                  capture="environment"
                />

                {fotoSil && !fotoPreview && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-red-500/8 border border-red-500/20">
                    <ImageOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-[11px] text-red-300">Mevcut fotoğraf kaydedince silinecek</span>
                  </div>
                )}
              </div>

              {/* Kategori */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Kategori</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {KATEGORILER.filter(k => k.id !== 'all').map(k => (
                    <button key={k.id} onClick={() => setForm(f => ({ ...f, category: k.id as any }))}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
                        form.category === k.id
                          ? 'border-ta/60 bg-ta/20 text-ta'
                          : 'border-white/8 bg-white/4 text-white/40'
                      }`}>
                      <span className="text-base">{k.icon}</span>
                      <span className="text-[10px]">{k.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Marka */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Marka *</label>
                <input type="text" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  placeholder="Örn: Canon, Sony"
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-ta/50 placeholder-white/20" />
              </div>

              {/* Model */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Model *</label>
                <input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="Örn: EOS R5"
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-ta/50 placeholder-white/20" />
              </div>

              {/* Seri No */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Seri Numarası *</label>
                <input type="text" value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))}
                  placeholder="Örn: CN1234567"
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-ta/50 placeholder-white/20 font-mono" />
              </div>

              {/* Durum */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Durum</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'working', label: 'Çalışıyor', icon: '✅' },
                    { id: 'broken', label: 'Arızalı', icon: '❌' },
                    { id: 'maintenance', label: 'Bakımda', icon: '🔧' },
                  ].map(d => (
                    <button key={d.id} onClick={() => setForm(f => ({ ...f, status: d.id as any }))}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        form.status === d.id
                          ? 'border-ta/60 bg-ta/20 text-ta'
                          : 'border-white/8 bg-white/4 text-white/40'
                      }`}>
                      {d.icon} {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Konum */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Konum *</label>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {([
                    { id: 'mekan', label: 'Mekan', icon: '📍' },
                    { id: 'depo',  label: 'Depo',  icon: '🏭' },
                    { id: 'diger', label: 'Diğer', icon: '📝' },
                  ] as const).map(tip => (
                    <button key={tip.id}
                      onClick={() => setForm(f => ({ ...f, locationType: tip.id, locationId: '' }))}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
                        form.locationType === tip.id
                          ? 'border-ta/60 bg-ta/20 text-ta'
                          : 'border-white/8 bg-white/4 text-white/40 active:bg-white/8'
                      }`}>
                      <span className="text-base">{tip.icon}</span>
                      <span>{tip.label}</span>
                    </button>
                  ))}
                </div>

                {form.locationType === 'mekan' && (
                  mekanlar.length === 0 ? (
                    <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-3 flex items-center gap-2">
                      <span className="text-sm">⚠️</span>
                      <p className="text-xs text-amber-300">Mekan Yönetimi'nde henüz mekan eklenmemiş.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {mekanlar.map(m => (
                        <button key={m.id}
                          onClick={() => setForm(f => ({ ...f, locationId: m.id }))}
                          className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                            form.locationId === m.id
                              ? 'border-ta/50 bg-ta/15'
                              : 'border-white/8 bg-white/4 active:bg-white/8'
                          }`}>
                          <span className="text-lg w-7 text-center shrink-0">{m.emoji}</span>
                          <span className={`text-sm font-semibold ${form.locationId === m.id ? 'text-ta' : 'text-white/70'}`}>{m.name}</span>
                          {form.locationId === m.id && (
                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-ta/30 border border-ta/40 text-ta">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                )}
                {form.locationType === 'depo' && (
                  <div className="rounded-xl bg-cyan-500/8 border border-cyan-500/20 px-3 py-3 flex items-center gap-2">
                    <span className="text-xl">🏭</span>
                    <p className="text-xs font-semibold text-cyan-300">Depo — Merkezi depo olarak kaydedilecek</p>
                  </div>
                )}
                {form.locationType === 'diger' && (
                  <input type="text" value={form.locationText}
                    onChange={e => setForm(f => ({ ...f, locationText: e.target.value }))}
                    placeholder="Örn: Ofis katı 2, Araç, Kiralık depo..."
                    className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-ta/50 placeholder-white/20" />
                )}
              </div>

              {/* Flash ata */}
              {form.category === 'camera' && (
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Flash Ata (opsiyonel)</label>
                  <button
                    onClick={() => setForm(f => ({ ...f, flashId: '' }))}
                    className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 mb-1.5 transition-all ${
                      form.flashId === '' ? 'border-ta/50 bg-ta/15' : 'border-white/8 bg-white/4 active:bg-white/8'
                    }`}>
                    <span className="text-lg w-7 text-center shrink-0">🚫</span>
                    <span className={`text-sm font-semibold ${form.flashId === '' ? 'text-ta' : 'text-white/50'}`}>Flash yok</span>
                    {form.flashId === '' && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-ta/30 border border-ta/40 text-ta">✓</span>}
                  </button>
                  {secilebilirFlashlar.length === 0 ? (
                    <div className="rounded-xl bg-white/4 border border-white/8 px-3 py-2.5 flex items-center gap-2">
                      <span className="text-sm">⚡</span>
                      <p className="text-xs text-white/35">Boşta flash yok — önce flash ekleyin</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {secilebilirFlashlar.map(fl => (
                        <button key={fl.id}
                          onClick={() => setForm(f => ({ ...f, flashId: fl.id }))}
                          className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                            form.flashId === fl.id ? 'border-amber-400/50 bg-amber-500/10' : 'border-white/8 bg-white/4 active:bg-white/8'
                          }`}>
                          <span className="text-lg w-7 text-center shrink-0">⚡</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${form.flashId === fl.id ? 'text-amber-200' : 'text-white/70'}`}>
                              {fl.brand} {fl.model}
                            </p>
                            <p className="text-[10px] text-white/30 font-mono">{fl.serialNumber}</p>
                          </div>
                          {form.flashId === fl.id && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 border border-amber-400/40 text-amber-300 shrink-0">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.flashId && form.locationType !== 'diger' && (
                    <p className="text-[10px] text-amber-300/70 mt-2 px-1">⚡ Bu flash kaydedilince kamerayla aynı konuma taşınır.</p>
                  )}
                </div>
              )}

              {/* Yazıcıya özgü: Kağıt Tipi */}
              {form.category === 'printer' && (
                <div className="rounded-2xl border border-[#9dd9ea]/25 bg-[#9dd9ea]/8 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🗂️</span>
                    <label className="text-[11px] font-semibold text-[#9dd9ea]/80 uppercase tracking-wider">
                      Kağıt Tipi
                    </label>
                  </div>
                  <p className="text-[10px] text-white/30 -mt-1">
                    Maliyet Yönetimi'ndeki fotoğraf kağıdı kaydıyla eşleştirin. Baskı maliyeti ve çıkış adedi bu kağıdın verilerine göre hesaplanır.
                  </p>
                  {papers.length === 0 ? (
                    <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-3 flex items-center gap-2">
                      <span className="text-sm">⚠️</span>
                      <p className="text-xs text-amber-300">Maliyet Yönetimi'nde henüz fotoğraf kağıdı tanımlanmamış.</p>
                    </div>
                  ) : (
                    <>
                      {/* Kağıt yok seçeneği */}
                      <button
                        onClick={() => setForm(f => ({ ...f, kagitTipiId: '' }))}
                        className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 mb-1.5 transition-all ${
                          form.kagitTipiId === '' ? 'border-[#9dd9ea]/50 bg-[#9dd9ea]/15' : 'border-white/8 bg-white/4 active:bg-white/8'
                        }`}
                      >
                        <span className="text-lg w-7 text-center shrink-0">🚫</span>
                        <span className={`text-sm font-semibold ${form.kagitTipiId === '' ? 'text-[#9dd9ea]' : 'text-white/50'}`}>Kağıt tipi yok</span>
                        {form.kagitTipiId === '' && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#9dd9ea]/30 border border-[#9dd9ea]/40 text-[#9dd9ea]">✓</span>}
                      </button>
                      <div className="space-y-1.5">
                        {papers.map(p => {
                          const kapasite = Math.round(Number(p.pcsPerBox) / Number(p.setsPerBox));
                          const selected = form.kagitTipiId === p.id;
                          return (
                            <button key={p.id}
                              onClick={() => setForm(f => ({ ...f, kagitTipiId: p.id }))}
                              className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                                selected ? 'border-[#9dd9ea]/50 bg-[#9dd9ea]/10' : 'border-white/8 bg-white/4 active:bg-white/8'
                              }`}
                            >
                              <span className="text-lg w-7 text-center shrink-0 mt-0.5">🖨️</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${selected ? 'text-[#9dd9ea]' : 'text-white/70'}`}>{p.name}</p>
                                <p className="text-[10px] text-white/30 mt-0.5">
                                  {p.pcsPerBox} adet / {p.setsPerBox} takım · {kapasite} baskı/takım · {p.currency} {Number(p.boxPrice).toLocaleString('tr-TR')}
                                </p>
                              </div>
                              {selected && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#9dd9ea]/30 border border-[#9dd9ea]/40 text-[#9dd9ea] shrink-0">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Yazıcıya özgü: İçindeki Ribon */}
              {form.category === 'printer' && (
                <div className="rounded-2xl border border-[#d4b5f7]/25 bg-[#d4b5f7]/8 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-[#d4b5f7]" />
                    <label className="text-[11px] font-semibold text-[#d4b5f7]/80 uppercase tracking-wider">
                      Şu An İçindeki Ribon
                    </label>
                  </div>
                  <p className="text-[10px] text-white/30 -mt-1">
                    Yazıcının kasasındaki kullanılmaya hazır ribon sayısı. Kapanış sırasında otomatik güncellenir, buradan elle de girilebilir.
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={form.ribonMevcut}
                    onChange={e => setForm(f => ({ ...f, ribonMevcut: e.target.value }))}
                    placeholder="0"
                    className="w-full h-11 rounded-xl bg-[#d4b5f7]/10 border border-[#d4b5f7]/25 text-white text-center text-lg font-bold px-3 outline-none focus:border-[#d4b5f7]/60 placeholder-white/20"
                  />
                </div>
              )}

              {/* Notlar */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Not (opsiyonel)</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Örn: Kağıt sıkışması, bakım gerekiyor"
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-ta/50 placeholder-white/20" />
              </div>

              {/* Malzeme Geçmişi */}
              <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                <button
                  onClick={() => setGecmisAcik(g => !g)}
                  className="w-full flex items-center justify-between px-4 py-3 active:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Malzeme Geçmişi</span>
                    {gecmisForm.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-ta/25 border border-ta/30 text-ta">
                        {gecmisForm.length}
                      </span>
                    )}
                  </div>
                  <span className={`text-white/30 text-xs transition-transform ${gecmisAcik ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {gecmisAcik && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
                    {gecmisForm.length === 0 ? (
                      <p className="text-xs text-white/25 text-center py-2">Henüz geçmiş kaydı yok.</p>
                    ) : (
                      <div className="space-y-2">
                        {[...gecmisForm].reverse().map((kayit, idx) => (
                          <div key={kayit.id} className="flex gap-3 items-start group">
                            <div className="flex flex-col items-center shrink-0 pt-0.5">
                              <div className="w-2 h-2 rounded-full bg-ta/60 shrink-0" />
                              {idx < gecmisForm.length - 1 && <div className="w-px flex-1 bg-white/8 mt-1 min-h-[16px]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-ta/80 bg-ta/12 border border-ta/20 px-1.5 py-0.5 rounded">
                                  {new Date(kayit.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <p className="text-xs text-white/75 leading-relaxed">{kayit.not}</p>
                              {kayit.ekleyen && <p className="text-[9px] text-white/25 mt-0.5">— {kayit.ekleyen}</p>}
                            </div>
                            <button
                              onClick={() => setGecmisForm(g => g.filter(k => k.id !== kayit.id))}
                              className="shrink-0 w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity active:scale-90">
                              <X className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded-xl border border-ta/20 bg-ta/5 p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-ta/70 uppercase tracking-wider">➕ Yeni Kayıt</p>
                      <input
                        type="date" value={yeniTarih} onChange={e => setYeniTarih(e.target.value)}
                        className="w-full h-9 rounded-xl bg-black/30 border border-white/12 text-white text-xs px-3 outline-none focus:border-ta/50"
                        style={{ colorScheme: 'dark' }}
                      />
                      <textarea
                        value={yeniNot} onChange={e => setYeniNot(e.target.value)}
                        placeholder="Örn: Tamire gönderildi, objektif değiştirildi..."
                        rows={2}
                        className="w-full rounded-xl bg-black/30 border border-white/12 text-white text-xs px-3 py-2 outline-none focus:border-ta/50 placeholder-white/20 resize-none"
                      />
                      <button
                        onClick={() => {
                          if (!yeniNot.trim()) return;
                          setGecmisForm(g => [...g, { id: `gecmis_${Date.now()}`, tarih: yeniTarih, not: yeniNot.trim(), ekleyen: userName }]);
                          setYeniNot('');
                          setYeniTarih(new Date().toISOString().split('T')[0]);
                        }}
                        disabled={!yeniNot.trim()}
                        className="w-full h-9 rounded-xl bg-ta/25 border border-ta/35 text-ta text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-30 active:scale-95 transition-all">
                        <Plus className="w-3.5 h-3.5" />Kayıt Ekle
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {modalHata && (
                <div className="rounded-xl bg-red-500/12 border border-red-500/20 px-4 py-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-xs text-red-300">{modalHata}</span>
                </div>
              )}

              <button onClick={kaydet} disabled={kayitYukleniyor || fotoYukleniyor}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-ta/80 to-ta/80 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40">
                {(kayitYukleniyor || fotoYukleniyor)
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{fotoYukleniyor ? 'Fotoğraf yükleniyor...' : 'Kaydediliyor...'}</>
                  : <><Save className="w-4 h-4" />{duzenleHedef ? 'Güncelle' : 'Ekipman Ekle'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Zimmet Modalı ─────────────────────────────────────────────────────── */}
      {zimmetModal && zimmetHedef && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setZimmetModal(false); setZimmetHedef(null); } }}>
          <div className="w-full max-w-md bg-[rgba(0,0,0,0.85)] border border-white/12 rounded-t-3xl overflow-hidden mb-16"
            style={{ maxHeight: '70vh' }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-sm font-bold text-white">Zimmet Ata</h2>
                <p className="text-[10px] text-white/30 mt-0.5">{zimmetHedef.brand} {zimmetHedef.model}</p>
              </div>
              <button onClick={() => { setZimmetModal(false); setZimmetHedef(null); }}
                className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center active:scale-90">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2" style={{ maxHeight: 'calc(70vh - 80px)' }}>
              <button onClick={() => zimmetAta(null)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-white/4 text-left active:bg-white/8 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-base">📦</div>
                  <div>
                    <p className="text-sm font-semibold text-white">Genel Havuz</p>
                    <p className="text-[10px] text-white/30">Zimmeti kaldır</p>
                  </div>
                  {!zimmetHedef.assignedTo && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md bg-ta/20 border border-ta/30 text-ta">Mevcut</span>}
                </div>
              </button>
              {kullanicilar.map(k => (
                <button key={k.id} onClick={() => zimmetAta(k)}
                  className="w-full px-4 py-3 rounded-xl border border-white/8 bg-white/4 text-left active:bg-white/8 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-ta/20 border border-ta/30 flex items-center justify-center text-base">👤</div>
                    <div>
                      <p className="text-sm font-semibold text-white">{k.ad}</p>
                      <p className="text-[10px] text-white/30">{k.rol}</p>
                    </div>
                    {zimmetHedef.assignedTo === k.ad && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md bg-ta/20 border border-ta/30 text-ta">Mevcut</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Rehber Modal ── */}
      {showGuide && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setShowGuide(false)}>
          <div
            className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-ta" /> Malzeme Yönetimi Rehberi
              </h3>
              <button onClick={() => setShowGuide(false)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-[12px] leading-relaxed text-white/70">

              <div>
                <h4 className="text-[13px] font-bold text-white mb-1.5">📦 Genel Bakış</h4>
                <p>Bu sayfa, şirkete ait tüm ekipmanları (kamera, flash, yazıcı, bilgisayar) merkezi olarak yönetir.</p>
                <p className="mt-1">• Her ekipman <span className="text-ta font-semibold">marka, model, seri numarası</span> ile kaydedilir</p>
                <p>• Ekipmanlar bir <span className="text-ta font-semibold">mekana</span> veya <span className="text-ta font-semibold">depoya</span> atanır</p>
                <p>• Bir personele <span className="text-ta font-semibold">zimmetlenebilir</span></p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">🏷️ Kategoriler</h4>
                <div className="space-y-1">
                  <p>• <span className="font-semibold text-white">📷 Kamera:</span> Fotoğraf makineleri</p>
                  <p>• <span className="font-semibold text-white">⚡ Flash:</span> Flaş üniteleri — bir kameraya bağlanabilir</p>
                  <p>• <span className="font-semibold text-white">🖨️ Yazıcı:</span> Baskı yazıcıları — ribon takımı ve kağıt tipi takibi yapılır</p>
                  <p>• <span className="font-semibold text-white">💻 Bilgisayar:</span> İş istasyonları ve laptoplar</p>
                </div>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">🚦 Durum Kodları</h4>
                <p>• <span className="text-emerald-400 font-semibold">✓ Çalışıyor:</span> Aktif kullanımda, sorun yok</p>
                <p>• <span className="text-red-400 font-semibold">✗ Arızalı:</span> Kullanılamaz durumda, onarım gerekli</p>
                <p>• <span className="text-amber-400 font-semibold">🔧 Bakımda:</span> Geçici olarak bakıma alınmış</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">➕ Ekipman Ekleme</h4>
                <p>Sağ üstteki <span className="text-emerald-400 font-semibold">+</span> butonuna basarak yeni ekipman ekleyin:</p>
                <p className="mt-1">• Kategori, marka, model ve seri numarası zorunludur</p>
                <p>• Konum seçin: hangi mekanda veya depoda</p>
                <p>• Fotoğraf çekip ekleyebilirsiniz</p>
                <p>• Yazıcılar için <span className="text-ta font-semibold">kağıt tipi</span> seçimi yapılır — bu maliyet hesabında kullanılır</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">✏️ Düzenleme & Geçmiş</h4>
                <p>• Ekipman kartına tıklayarak detaylarını görün ve düzenleyin</p>
                <p>• <span className="text-ta font-semibold">Geçmiş Kayıt</span> ekleyerek bakım, arıza, taşıma notlarını tutun</p>
                <p>• Konum değişikliği yapıldığında eski konumu not olarak kaydedin</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">🖨️ Yazıcıya Özel</h4>
                <p>• <span className="text-ta font-semibold">Ribon Mevcut:</span> Yazıcının içindeki mevcut ribon takım sayısı</p>
                <p>• <span className="text-ta font-semibold">Kağıt Tipi:</span> Maliyet Yönetimi'nde tanımlanan kağıt tipiyle eşleştirilir</p>
                <p>• Vardiya kapanışında yazıcı sayaçları bu kayıtla karşılaştırılır</p>
                <p>• Seri numarası, açılış/kapanışta yazıcıyı doğru eşleştirmek için kritiktir</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">🔍 Filtreleme</h4>
                <p>• <span className="text-ta font-semibold">Kategori:</span> Kamera, Flash, Yazıcı, Bilgisayar</p>
                <p>• <span className="text-ta font-semibold">Durum:</span> Çalışıyor, Arızalı, Bakımda</p>
                <p>• <span className="text-ta font-semibold">Zimmet:</span> Zimmetli veya zimmetsiz</p>
                <p>• <span className="text-ta font-semibold">Mekan:</span> Hangi lokasyonda</p>
                <p>• <span className="text-ta font-semibold">Arama:</span> Marka, model veya seri numarasına göre arama</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">⚡ Önemli Kurallar</h4>
                <p>• Sadece <span className="text-ta font-semibold">Yönetici</span> ekipman ekleyip silebilir</p>
                <p>• Yazıcı seri numarasını <span className="text-red-400 font-semibold">doğru girmeniz kritiktir</span> — vardiya açılış/kapanışında yazıcı eşleşmesi seri numarasına göre yapılır</p>
                <p>• Arızalı ekipman rotasyona dahil edilmez</p>
                <p>• Konum değişikliği yapıldığında ilgili mekan stokları etkilenebilir</p>
              </div>

            </div>
          </div>
        </div>
      )}

      {!embedded && (
        <NewBottomNav
          activeTab="resource-management"
          onNavigate={onNavigate}
          userRole={userRole}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}
