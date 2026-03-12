import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, User, X,
  Save, Loader2, WifiOff, RefreshCw, AlertCircle,
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { UserRole } from './login';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

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
  olusturulmaTarihi?: string;
  guncellemeTarihi?: string;
}

interface Mekan {
  id: string;
  name: string;
  emoji: string;
  color?: string;
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
  { id: 'all',      label: 'Tümü',        icon: '📦', color: '#9ca3af' },
  { id: 'camera',   label: 'Kamera',      icon: '📷', color: '#d4b5f7' },
  { id: 'flash',    label: 'Flash',       icon: '⚡', color: '#ffd4a3' },
  { id: 'printer',  label: 'Yazıcı',      icon: '🖨️', color: '#9dd9ea' },
  { id: 'computer', label: 'Bilgisayar',  icon: '💻', color: '#a8e6cf' },
];

const DURUMLAR = [
  { id: 'all',         label: 'Tümü',     icon: '📋' },
  { id: 'working',     label: 'Çalışıyor', icon: '✅' },
  { id: 'broken',      label: 'Arızalı',   icon: '❌' },
  { id: 'maintenance', label: 'Bakımda',   icon: '🔧' },
];

const BOŞ_FORM = {
  category: 'camera' as Equipment['category'],
  brand: '',
  model: '',
  serialNumber: '',
  status: 'working' as Equipment['status'],
  locationType: 'diger' as 'mekan' | 'depo' | 'diger',
  locationId: '',
  locationText: '',
  flashId: '',
  notes: '',
};

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
const katRenk = (id: string) => KATEGORILER.find(k => k.id === id)?.color || '#9dd9ea';
const katIkon = (id: string) => KATEGORILER.find(k => k.id === id)?.icon || '📦';
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

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ mesaj, tip, onKapat }: { mesaj: string; tip: 'basarili'|'hata'; onKapat: () => void }) {
  useEffect(() => { const t = setTimeout(onKapat, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl border text-sm font-semibold shadow-2xl backdrop-blur max-w-xs text-center transition-all ${
      tip === 'basarili'
        ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-200'
        : 'bg-red-900/80 border-red-500/40 text-red-200'
    }`}>
      {mesaj}
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export function EquipmentPage({ userName, userRole, onLogout, onNavigate, embedded = false }: EquipmentPageProps) {
  const [liste, setListe] = useState<Equipment[]>([]);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [mekanlar, setMekanlar] = useState<Mekan[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hataVar, setHataVar] = useState(false);
  const [toast, setToast] = useState<{ mesaj: string; tip: 'basarili'|'hata' } | null>(null);

  // Filtreler
  const [katFilt, setKatFilt] = useState('all');
  const [durFilt, setDurFilt] = useState('all');
  const [zimFilt, setZimFilt] = useState('all');
  const [arama, setArama] = useState('');

  // Modallar
  const [modalAcik, setModalAcik] = useState(false);
  const [zimmetModal, setZimmetModal] = useState(false);
  const [duzenleHedef, setDuzenleHedef] = useState<Equipment | null>(null);
  const [zimmetHedef, setZimmetHedef] = useState<Equipment | null>(null);
  const [form, setForm] = useState({ ...BOŞ_FORM });
  const [gecmisForm, setGecmisForm] = useState<GecmisKayit[]>([]);
  const [yeniNot, setYeniNot] = useState('');
  const [yeniTarih, setYeniTarih] = useState(new Date().toISOString().split('T')[0]);
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [kayitYukleniyor, setKayitYukleniyor] = useState(false);
  const [modalHata, setModalHata] = useState('');

  // Yetkiler
  const canAdd   = ['admin','yonetici','ust-mudur','mudur','operasyon'].includes(userRole);
  const canEdit  = ['admin','yonetici','ust-mudur','mudur','operasyon'].includes(userRole);
  const canDel   = ['admin','yonetici','ust-mudur','mudur'].includes(userRole);
  const canAssign = ['admin','yonetici','ust-mudur','mudur'].includes(userRole);

  // ─── Veri Yükle ─────────────────────────────────────────────────────────────
  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHataVar(false);
    try {
      const h = await authHeaders();
      const [listeRes, kulRes, mekRes] = await Promise.all([
        fetch(`${API_BASE}/malzeme/liste`, { headers: h }),
        fetch(`${API_BASE}/auth/kullanicilar`, { headers: h }),
        fetch(`${API_BASE}/mekanlar`, { headers: h }),
      ]);
      const listeJson = await listeRes.json();
      const kulJson   = await kulRes.json();
      const mekJson   = await mekRes.json();
      if (listeJson.ekipmanlar) setListe(listeJson.ekipmanlar);
      if (kulJson.kullanicilar) setKullanicilar(kulJson.kullanicilar);
      if (mekJson.mekanlar) setMekanlar(mekJson.mekanlar);
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
    const katUygun  = katFilt === 'all' || eq.category === katFilt;
    const durUygun  = durFilt === 'all' || eq.status === durFilt;
    let zimUygun = true;
    if (zimFilt === 'unassigned') zimUygun = !eq.assignedTo;
    else if (zimFilt === 'assigned') zimUygun = !!eq.assignedTo;
    else if (zimFilt !== 'all') zimUygun = eq.assignedTo === zimFilt;
    return aramaUygun && katUygun && durUygun && zimUygun;
  });

  const stats = {
    toplam:  filtrelenmis.length,
    calisiyor: filtrelenmis.filter(e => e.status === 'working').length,
    arizali: filtrelenmis.filter(e => e.status === 'broken').length,
    bakimda: filtrelenmis.filter(e => e.status === 'maintenance').length,
  };

  // Flash dropdown: düzenlenen kameranın mevcut flashı da dahil, başka kameralara atanmış olanlar hariç
  const secilebilirFlashlar = liste.filter(eq => {
    if (eq.category !== 'flash') return false;
    if (duzenleHedef && eq.id === duzenleHedef.flashId) return true; // Bu kameranın mevcut flashı
    const atanmisIds = liste
      .filter(e => e.category === 'camera' && e.flashId && e.id !== duzenleHedef?.id)
      .map(e => e.flashId);
    return !atanmisIds.includes(eq.id);
  });

  // ─── Ekle / Güncelle ────────────────────────────────────────────────────────
  const modalKapat = () => {
    setModalAcik(false);
    setDuzenleHedef(null);
    setForm({ ...BOŞ_FORM });
    setGecmisForm([]);
    setYeniNot('');
    setYeniTarih(new Date().toISOString().split('T')[0]);
    setGecmisAcik(false);
    setModalHata('');
  };

  const duzenleBas = (eq: Equipment) => {
    setDuzenleHedef(eq);
    setForm({
      category: eq.category,
      brand: eq.brand,
      model: eq.model,
      serialNumber: eq.serialNumber,
      status: eq.status,
      locationType: (eq.locationType as any) || 'diger',
      locationId: eq.locationId || '',
      locationText: (!eq.locationType || eq.locationType === 'diger') ? eq.location : '',
      flashId: eq.flashId || '',
      notes: eq.notes || '',
    });
    setGecmisForm(eq.gecmis || []);
    setGecmisAcik(false);
    setModalAcik(true);
  };

  const kaydet = async () => {
    // Konum doğrulama + hesaplama
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
      const body = {
        category: form.category,
        brand: form.brand,
        model: form.model,
        serialNumber: form.serialNumber,
        status: form.status,
        location: konumStr,
        locationType: form.locationType,
        locationId: form.locationType === 'mekan' ? form.locationId : undefined,
        flashId: form.flashId || undefined,
        notes: form.notes || undefined,
        gecmis: gecmisForm,
        ...(duzenleHedef ? { id: duzenleHedef.id } : {}),
      };
      const url = duzenleHedef ? `${API_BASE}/malzeme/guncelle` : `${API_BASE}/malzeme/ekle`;
      const method = duzenleHedef ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: h, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);

      // ─── Flash konum senkronizasyonu ─────────────────────────────────────────
      // Kameraya atanan flash'ın konumunu kamerayla aynı yap
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
      // Eski flash varsa ve kaldırıldıysa konum değişmeden kalır (kullanıcı sonra ayarlar)

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
      const res = await fetch(`${API_BASE}/malzeme/sil/${eq.id}`, { method: 'DELETE', headers: h });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setToast({ mesaj: '🗑️ Ekipman silindi.', tip: 'basarili' });
      yukle();
    } catch (err: any) {
      setToast({ mesaj: err.message || 'Silme başarısız.', tip: 'hata' });
    }
  };

  // ─── Zimmet ─────────────────────────────────────────────────────────────────
  const zimmetBas = (eq: Equipment) => {
    setZimmetHedef(eq);
    setZimmetModal(true);
  };

  const zimmetAta = async (kul: Kullanici | null) => {
    if (!zimmetHedef) return;
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_BASE}/malzeme/zimmet`, {
        method: 'PUT',
        headers: h,
        body: JSON.stringify({
          id: zimmetHedef.id,
          assignedTo: kul?.ad || null,
          assignedToId: kul?.id || null,
        }),
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
    <div className="pb-24 min-h-screen bg-gradient-to-br from-[#0a051e] via-[#120830] to-[#1a0a3c]">

      {toast && <Toast mesaj={toast.mesaj} tip={toast.tip} onKapat={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-[rgba(10,5,30,0.92)] backdrop-blur-xl border-b border-white/10 px-4 pt-3 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(userRole === 'personel' ? 'dashboard' : (embedded ? 'resource-management' : 'resource-management'))}
            className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Malzeme Yönetimi</h1>
              <span className="text-base">📦</span>
            </div>
            <p className="text-[10px] text-white/30 mt-0.5">
              {yukleniyor
                ? 'Yükleniyor...'
                : hataVar
                ? 'Bağlantı hatası'
                : `${liste.length} ekipman · Supabase KV`}
            </p>
          </div>
          {canAdd && (
            <button
              onClick={() => { setDuzenleHedef(null); setForm({ ...BOŞ_FORM }); setModalAcik(true); }}
              className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
            </button>
          )}
          <button
            onClick={yukle}
            disabled={yukleniyor}
            className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 text-white/50 ${yukleniyor ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Yükleniyor */}
      {yukleniyor && liste.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-24 gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <span className="text-sm text-white/30">Ekipmanlar yükleniyor...</span>
        </div>
      )}

      {/* Hata */}
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
              { label: 'Toplam',    deger: stats.toplam,     renk: 'text-white',         bg: 'from-white/10 to-white/5',         border: 'border-white/15' },
              { label: 'Çalışıyor', deger: stats.calisiyor,  renk: 'text-emerald-400',   bg: 'from-emerald-500/15 to-emerald-600/10', border: 'border-emerald-500/25' },
              { label: 'Arızalı',   deger: stats.arizali,    renk: 'text-red-400',       bg: 'from-red-500/15 to-red-600/10',    border: 'border-red-500/25' },
              { label: 'Bakımda',   deger: stats.bakimda,    renk: 'text-amber-400',     bg: 'from-amber-500/15 to-amber-600/10','border-amber-500/25': 'border-amber-500/25' },
            ].map(({ label, deger, renk, bg, border }) => (
              <div key={label} className={`backdrop-blur rounded-xl p-3 flex flex-col items-center bg-gradient-to-br ${bg} border ${border || 'border-white/15'}`}>
                <div className={`text-2xl font-bold mb-0.5 ${renk}`}>{deger}</div>
                <div className="text-[10px] text-white/35">{label}</div>
              </div>
            ))}
          </div>

          {/* Filtreler */}
          <div className="rounded-2xl border border-white/10 bg-[rgba(10,5,30,0.55)] backdrop-blur p-4 space-y-3">

            {/* Kategori */}
            <div>
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Kategori</p>
              <div className="flex flex-wrap gap-1.5">
                {KATEGORILER.map(k => (
                  <button key={k.id} onClick={() => setKatFilt(k.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      katFilt === k.id
                        ? 'bg-white/12 border-white/25 text-white'
                        : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                    }`}>
                    <span>{k.icon}</span>{k.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Durum */}
            <div>
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Durum</p>
              <div className="flex flex-wrap gap-1.5">
                {DURUMLAR.map(d => (
                  <button key={d.id} onClick={() => setDurFilt(d.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      durFilt === d.id
                        ? 'bg-white/12 border-white/25 text-white'
                        : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                    }`}>
                    <span>{d.icon}</span>{d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zimmet */}
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
                      zimFilt === z.id
                        ? 'bg-white/12 border-white/25 text-white'
                        : 'bg-white/4 border-white/8 text-white/40 active:bg-white/8'
                    }`}>
                    <span>{z.icon}</span>{z.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Arama */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type="text" value={arama} onChange={e => setArama(e.target.value)}
                placeholder="Marka, model veya seri no..."
                className="w-full h-9 rounded-xl bg-white/6 border border-white/12 text-white text-xs pl-9 pr-3 outline-none placeholder-white/20 focus:border-violet-400/40"
              />
            </div>
          </div>

          {/* Liste */}
          {filtrelenmis.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[rgba(10,5,30,0.55)] p-8 text-center">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm font-semibold text-white mb-1">Ekipman bulunamadı</div>
              <div className="text-xs text-white/30">
                {liste.length === 0 ? 'Henüz ekipman eklenmemiş. + butonuna basın.' : 'Filtreleri değiştirin.'}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrelenmis.map(eq => {
                const catColor = katRenk(eq.category);
                const atanmisFlash = eq.flashId ? liste.find(e => e.id === eq.flashId) : null;
                // Flash için: hangi kameraya atandığını hesapla
                const atandigiMakina = eq.category === 'flash'
                  ? liste.find(e => e.category === 'camera' && e.flashId === eq.id)
                  : null;
                return (
                  <div key={eq.id}
                    className="rounded-2xl border border-white/12 bg-[rgba(10,5,30,0.6)] backdrop-blur p-4">

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
                      <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold shrink-0 ${durumClass(eq.status)}`}>
                        {durumLabel(eq.status)}
                      </div>
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
                      <div className="rounded-xl bg-violet-500/10 border border-violet-500/25 px-3 py-2 mb-3 flex items-center gap-2">
                        <span className="text-base">📷</span>
                        <div>
                          <p className="text-[10px] text-violet-300">Atandığı Makina</p>
                          <p className="text-xs font-bold text-white">{atandigiMakina.brand} {atandigiMakina.model}</p>
                          <p className="text-[10px] text-violet-200/50 font-mono">{atandigiMakina.serialNumber}</p>
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

                    {/* Geçmiş özeti — kayıt varsa */}
                    {eq.gecmis && eq.gecmis.length > 0 && (() => {
                      const son = [...eq.gecmis].sort((a, b) => b.tarih.localeCompare(a.tarih))[0];
                      return (
                        <div className="rounded-xl bg-violet-500/8 border border-violet-500/20 px-3 py-2 mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-violet-300/70 uppercase tracking-wider">📋 Geçmiş</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-400/25 text-violet-300">{eq.gecmis.length} kayıt</span>
                          </div>
                          <p className="text-xs text-white/60 leading-relaxed truncate">{son.not}</p>
                          <p className="text-[9px] text-violet-300/50 mt-0.5">
                            {new Date(son.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Notlar */}
                    {eq.notes && (
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 mb-3">
                        <p className="text-[10px] text-amber-300">💬 {eq.notes}</p>
                      </div>
                    )}

                    {/* Güncelleme tarihi */}
                    {eq.guncellemeTarihi && (
                      <p className="text-[9px] text-white/18 mb-3">
                        Son güncelleme: {new Date(eq.guncellemeTarihi).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
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
                          className="bg-violet-500/15 border border-violet-500/25 text-violet-400 font-semibold py-2 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1">
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
          <div className="w-full max-w-md bg-[#0e0826] border border-white/12 rounded-t-3xl overflow-hidden mb-16"
            style={{ maxHeight: '90vh' }}>
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

            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {/* Kategori */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Kategori</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {KATEGORILER.filter(k => k.id !== 'all').map(k => (
                    <button key={k.id} onClick={() => setForm(f => ({ ...f, category: k.id as any }))}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
                        form.category === k.id
                          ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
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
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-violet-400/50 placeholder-white/20" />
              </div>

              {/* Model */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Model *</label>
                <input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="Örn: EOS R5"
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-violet-400/50 placeholder-white/20" />
              </div>

              {/* Seri No */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Seri Numarası *</label>
                <input type="text" value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))}
                  placeholder="Örn: CN1234567"
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-violet-400/50 placeholder-white/20 font-mono" />
              </div>

              {/* Durum */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Durum</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'working',     label: 'Çalışıyor', icon: '✅' },
                    { id: 'broken',      label: 'Arızalı',   icon: '❌' },
                    { id: 'maintenance', label: 'Bakımda',   icon: '🔧' },
                  ].map(d => (
                    <button key={d.id} onClick={() => setForm(f => ({ ...f, status: d.id as any }))}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        form.status === d.id
                          ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
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

                {/* Tip seçici */}
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
                          ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                          : 'border-white/8 bg-white/4 text-white/40 active:bg-white/8'
                      }`}>
                      <span className="text-base">{tip.icon}</span>
                      <span>{tip.label}</span>
                    </button>
                  ))}
                </div>

                {/* Mekan seçimi */}
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
                              ? 'border-violet-400/50 bg-violet-500/15'
                              : 'border-white/8 bg-white/4 active:bg-white/8'
                          }`}>
                          <span className="text-lg w-7 text-center shrink-0">{m.emoji}</span>
                          <span className={`text-sm font-semibold ${form.locationId === m.id ? 'text-violet-200' : 'text-white/70'}`}>{m.name}</span>
                          {form.locationId === m.id && (
                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/30 border border-violet-400/40 text-violet-300">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                )}

                {/* Depo — otomatik, açıklama */}
                {form.locationType === 'depo' && (
                  <div className="rounded-xl bg-cyan-500/8 border border-cyan-500/20 px-3 py-3 flex items-center gap-2">
                    <span className="text-xl">🏭</span>
                    <p className="text-xs font-semibold text-cyan-300">Depo — Merkezi depo olarak kaydedilecek</p>
                  </div>
                )}

                {/* Diğer — serbest metin */}
                {form.locationType === 'diger' && (
                  <input type="text" value={form.locationText}
                    onChange={e => setForm(f => ({ ...f, locationText: e.target.value }))}
                    placeholder="Örn: Ofis katı 2, Araç, Kiralık depo..."
                    className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-violet-400/50 placeholder-white/20" />
                )}
              </div>

              {/* Flash ata (sadece kamera için) */}
              {form.category === 'camera' && (
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Flash Ata (opsiyonel)</label>

                  {/* Flash yok seçeneği */}
                  <button
                    onClick={() => setForm(f => ({ ...f, flashId: '' }))}
                    className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 mb-1.5 transition-all ${
                      form.flashId === ''
                        ? 'border-violet-400/50 bg-violet-500/15'
                        : 'border-white/8 bg-white/4 active:bg-white/8'
                    }`}>
                    <span className="text-lg w-7 text-center shrink-0">🚫</span>
                    <span className={`text-sm font-semibold ${form.flashId === '' ? 'text-violet-200' : 'text-white/50'}`}>Flash yok</span>
                    {form.flashId === '' && (
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/30 border border-violet-400/40 text-violet-300">✓</span>
                    )}
                  </button>

                  {/* Mevcut flashlar */}
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
                            form.flashId === fl.id
                              ? 'border-amber-400/50 bg-amber-500/10'
                              : 'border-white/8 bg-white/4 active:bg-white/8'
                          }`}>
                          <span className="text-lg w-7 text-center shrink-0">⚡</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${form.flashId === fl.id ? 'text-amber-200' : 'text-white/70'}`}>
                              {fl.brand} {fl.model}
                            </p>
                            <p className="text-[10px] text-white/30 font-mono">{fl.serialNumber}</p>
                          </div>
                          {form.flashId === fl.id && (
                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 border border-amber-400/40 text-amber-300 shrink-0">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {form.flashId && form.locationType !== 'diger' && (
                    <p className="text-[10px] text-amber-300/70 mt-2 px-1">
                      ⚡ Bu flash kaydedilince kamerayla aynı konuma taşınır.
                    </p>
                  )}
                </div>
              )}

              {/* Notlar */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Not (opsiyonel)</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Örn: Kağıt sıkışması, bakım gerekiyor"
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-violet-400/50 placeholder-white/20" />
              </div>

              {/* ─── Malzeme Geçmişi ─────────────────────────────────────────────── */}
              <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                {/* Başlık */}
                <button
                  onClick={() => setGecmisAcik(g => !g)}
                  className="w-full flex items-center justify-between px-4 py-3 active:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Malzeme Geçmişi</span>
                    {gecmisForm.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/25 border border-violet-400/30 text-violet-300">
                        {gecmisForm.length}
                      </span>
                    )}
                  </div>
                  <span className={`text-white/30 text-xs transition-transform ${gecmisAcik ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {gecmisAcik && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">

                    {/* Mevcut kayıtlar — yeniden eskiye */}
                    {gecmisForm.length === 0 ? (
                      <p className="text-xs text-white/25 text-center py-2">Henüz geçmiş kaydı yok.</p>
                    ) : (
                      <div className="space-y-2">
                        {[...gecmisForm].reverse().map((kayit, idx) => (
                          <div key={kayit.id} className="flex gap-3 items-start group">
                            {/* Timeline çizgisi */}
                            <div className="flex flex-col items-center shrink-0 pt-0.5">
                              <div className="w-2 h-2 rounded-full bg-violet-400/60 shrink-0" />
                              {idx < gecmisForm.length - 1 && (
                                <div className="w-px flex-1 bg-white/8 mt-1 min-h-[16px]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-violet-300/80 bg-violet-500/12 border border-violet-500/20 px-1.5 py-0.5 rounded">
                                  {new Date(kayit.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <p className="text-xs text-white/75 leading-relaxed">{kayit.not}</p>
                              {kayit.ekleyen && (
                                <p className="text-[9px] text-white/25 mt-0.5">— {kayit.ekleyen}</p>
                              )}
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

                    {/* Yeni kayıt ekle */}
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-violet-300/70 uppercase tracking-wider">➕ Yeni Kayıt</p>
                      <input
                        type="date"
                        value={yeniTarih}
                        onChange={e => setYeniTarih(e.target.value)}
                        className="w-full h-9 rounded-xl bg-black/30 border border-white/12 text-white text-xs px-3 outline-none focus:border-violet-400/50"
                        style={{ colorScheme: 'dark' }}
                      />
                      <textarea
                        value={yeniNot}
                        onChange={e => setYeniNot(e.target.value)}
                        placeholder="Örn: Tamire gönderildi, objektif değiştirildi, bakım yapıldı..."
                        rows={2}
                        className="w-full rounded-xl bg-black/30 border border-white/12 text-white text-xs px-3 py-2 outline-none focus:border-violet-400/50 placeholder-white/20 resize-none"
                      />
                      <button
                        onClick={() => {
                          if (!yeniNot.trim()) return;
                          const kayit: GecmisKayit = {
                            id: `gecmis_${Date.now()}`,
                            tarih: yeniTarih,
                            not: yeniNot.trim(),
                            ekleyen: userName,
                          };
                          setGecmisForm(g => [...g, kayit]);
                          setYeniNot('');
                          setYeniTarih(new Date().toISOString().split('T')[0]);
                        }}
                        disabled={!yeniNot.trim()}
                        className="w-full h-9 rounded-xl bg-violet-500/25 border border-violet-500/35 text-violet-200 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-30 active:scale-95 transition-all">
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

              <button onClick={kaydet} disabled={kayitYukleniyor}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500/80 to-purple-500/80 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40">
                {kayitYukleniyor
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />}
                {duzenleHedef ? 'Güncelle' : 'Ekipman Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Zimmet Modalı ─────────────────────────────────────────────────────── */}
      {zimmetModal && zimmetHedef && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setZimmetModal(false); setZimmetHedef(null); } }}>
          <div className="w-full max-w-md bg-[#0e0826] border border-white/12 rounded-t-3xl overflow-hidden mb-16"
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
              {/* Zimmet kaldır */}
              <button onClick={() => zimmetAta(null)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-white/4 text-left active:bg-white/8 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-base">📦</div>
                  <div>
                    <p className="text-sm font-semibold text-white">Genel Havuz</p>
                    <p className="text-[10px] text-white/30">Zimmeti kaldır</p>
                  </div>
                  {!zimmetHedef.assignedTo && (
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-500/30 text-violet-300">Mevcut</span>
                  )}
                </div>
              </button>

              {/* Kullanıcı listesi */}
              {kullanicilar.map(k => (
                <button key={k.id} onClick={() => zimmetAta(k)}
                  className="w-full px-4 py-3 rounded-xl border border-white/8 bg-white/4 text-left active:bg-white/8 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-base">👤</div>
                    <div>
                      <p className="text-sm font-semibold text-white">{k.ad}</p>
                      <p className="text-[10px] text-white/30">{k.rol}</p>
                    </div>
                    {zimmetHedef.assignedTo === k.ad && (
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-500/30 text-violet-300">Mevcut</span>
                    )}
                  </div>
                </button>
              ))}
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