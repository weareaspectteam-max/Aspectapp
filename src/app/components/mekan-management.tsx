import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit2, X, Save, ArrowLeft, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { buildHeaders, appendGhostParam } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface MekanManagementProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export interface Location {
  id: string;
  name: string;
  emoji: string;
  color: string;
  yearlyRent: number;
  dailyCostPercentage?: number; // eski, artık kullanılmıyor
  profitPercentage?: number;    // eski, geriye uyumluluk
  profitTarget?: number;        // yıllık kar hedefi ₺
  photoPrice: number;
  printType?: 'tam' | 'yarim';
  workingHours?: {
    start: string;
    end: string;
  };
  kotaKademeleri?: KotaKademe[];
  created_at?: string;
  updated_at?: string;
}

export interface GorevBanti {
  min: number;
  max: number;
  tutar: number;
}

export interface KotaKademe {
  hedef: number;
  primTek: number;        // Solo hakediş (görevsiz tek kişi)
  // Bantlı görevler (yeni)
  fotografBantlar?: GorevBanti[];
  baskiBantlar?: GorevBanti[];
  albumBantlar?: GorevBanti[];
  gozlemciBantlar?: GorevBanti[];
  // Eski sabit alanlar (geriye uyumluluk — bantlar tanımsızsa kullanılır)
  primFotograf: number;
  primBaski: number;
  primAlbum: number;
  primGozlemci: number;
  primCoklu?: number;
}

type UserRole =
  | 'yonetici'
  | 'ust-mudur'
  | 'mudur'
  | 'operasyon'
  | 'personel'
  | 'idari'
  | 'bekleyen';

export function MekanManagement({ userRole, accessToken, onNavigate }: MekanManagementProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Tanı / diagnostik state ──────────────────────────────────
  const [diagStatus, setDiagStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [diagDetail, setDiagDetail] = useState('');
  const [diagHttpCode, setDiagHttpCode] = useState<number | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmoji, setFormEmoji] = useState('📍');
  const [formColor, setFormColor] = useState('#9dd9ea');
  const [formPhotoPrice, setFormPhotoPrice] = useState('0');
  const [formPriceCurrency, setFormPriceCurrency] = useState('TRY');
  const [formYearlyRent, setFormYearlyRent] = useState('0');
  const [formProfitTarget, setFormProfitTarget] = useState('0'); // yıllık kar hedefi ₺
  const [formYearlyRents, setFormYearlyRents] = useState<Record<string, string>>({}); // yıl bazlı kiralar
  const [formProfitTargets, setFormProfitTargets] = useState<Record<string, string>>({}); // yıl bazlı hedefler
  const [yilEkleAcik, setYilEkleAcik] = useState(false);
  const [yilInput, setYilInput] = useState(String(new Date().getFullYear() - 1));
  const [formPrintType, setFormPrintType] = useState<'tam' | 'yarim'>('yarim');
  const [formWorkingHoursStart, setFormWorkingHoursStart] = useState('09:00');
  const [formWorkingHoursEnd, setFormWorkingHoursEnd] = useState('18:00');

  // Price editing states
  const [editingPrices, setEditingPrices] = useState<{ [key: string]: string }>({});

  // Kota kademeleri form state
  const [formKotaKademeleri, setFormKotaKademeleri] = useState<KotaKademe[]>([]);

  // Kıdem çarpanları (yönetici + üst-müdür için mekan yönetiminde de gösterilir)
  const canViewKidem = ['yonetici', 'ust-mudur'].includes(userRole);
  const [kidemCarpanlar, setKidemCarpanlar] = useState({ kidemsiz: 1.0, kidemli: 1.15, kidemliPlus: 1.30 });

  // Access control
  const currentUserRole = userRole as UserRole;
  const hasAccess = currentUserRole !== 'personel' && currentUserRole !== 'bekleyen';
  const canEdit = currentUserRole === 'yonetici';
  const canViewNumbers = currentUserRole !== 'operasyon';

  const emojiOptions = ['🏖️', '☕', '🐟', '⛵', '🏪', '🍽️', '🏨', '🎪', '🎭', '🎨', '🏝️', '🌊', '🌅', '🎵', '🍹', '📍', '🌈', '🌸', '💎', '🎀', '🥥', '🌴', '🌺', '🐚'];
  const colorOptions = [
    '#a8d8ea', '#b8e6d5', '#ff7675', '#fab1a0', '#d4b5f7', '#ffeaa7', '#ffb6b9',
    '#00f5ff', '#ff0080', '#00ff88', '#b84fff', '#ffae42', '#fffc00', '#ff77ff', '#4d4dff',
    '#0984e3', '#fd79a8', '#00b894', '#6c5ce7', '#fdcb6e', '#74b9ff', '#55efc4',
    '#a29bfe', '#81ecec',
  ];

  // authHeaders artık ../lib/api'den geliyor

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 4000);
  };

  // ─── Mekanları yükle ────────────────────────────────────────
  const loadMekanlar = async () => {
    setLoading(true);
    setError('');
    setDiagStatus('idle');
    setDiagDetail('');
    setDiagHttpCode(null);
    try {
      const headers = buildHeaders(accessToken);
      const hasToken = !!(headers['X-Access-Token']);
      console.log('[MekanMgmt] Token mevcut:', hasToken, '| accessToken uzunluğu:', accessToken?.length ?? 0, '| Endpoint:', `${API_BASE}/mekanlar`);

      const res = await fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }

      setDiagHttpCode(res.status);

      if (!res.ok) {
        const errMsg = data.error || 'Mekanlar yüklenemedi.';
        const fullMsg = `HTTP ${res.status}: ${errMsg}`;
        console.error('[MekanMgmt] API hatası:', fullMsg, '| Token vardı:', hasToken);
        setDiagStatus('error');
        setDiagDetail(`HTTP ${res.status} — ${errMsg}${!hasToken ? ' (⚠️ Token eksik!)' : ''}`);
        showError(fullMsg);
        return;
      }

      const list: Location[] = data.mekanlar || [];
      console.log('[MekanMgmt] Yüklendi. Mekan sayısı:', list.length);
      setDiagStatus('ok');
      setDiagDetail(`${list.length} mekan başarıyla yüklendi.`);
      setLocations(list);
    } catch (err) {
      console.error('[MekanMgmt] Ağ/parse hatası:', err);
      setDiagStatus('error');
      setDiagDetail(`Ağ hatası: ${err}`);
      setDiagHttpCode(null);
      showError('Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      loadMekanlar();
      if (canViewKidem) loadKidemCarpanlar();
    } else {
      setLoading(false);
    }
  }, []);

  const loadKidemCarpanlar = async () => {
    try {
      const res = await fetch(appendGhostParam(`${API_BASE}/kidem/carpanlar`), { headers: buildHeaders(accessToken) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.carpanlar) setKidemCarpanlar(data.carpanlar);
    } catch (err) {
      console.error('loadKidemCarpanlar error:', err);
    }
  };


  // ─── Mekan ekle ─────────────────────────────────────────────
  const handleAddLocation = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/mekanlar`, {
        method: 'POST',
        headers: buildHeaders(accessToken),
        body: JSON.stringify({
          name: formName.trim(),
          emoji: formEmoji,
          color: formColor,
          photoPrice: parseFloat(formPhotoPrice) || 0,
          priceCurrency: formPriceCurrency,
          yearlyRent: parseFloat(formYearlyRent) || 0,
          profitTarget: parseFloat(formProfitTarget) || 0,
          yearlyRents: Object.fromEntries(Object.entries(formYearlyRents).filter(([,v]) => parseFloat(v) > 0).map(([k,v]) => [k, parseFloat(v)])),
          profitTargets: Object.fromEntries(Object.entries(formProfitTargets).filter(([,v]) => parseFloat(v) > 0).map(([k,v]) => [k, parseFloat(v)])),
          printType: formPrintType,
          workingHours: { start: formWorkingHoursStart, end: formWorkingHoursEnd },
          kotaKademeleri: formKotaKademeleri,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'Mekan eklenemedi.'); return; }
      setLocations(prev => [...prev, data.mekan]);
      showSuccess(`✅ "${data.mekan.name}" eklendi.`);
      resetForm();
    } catch (err) {
      console.error('handleAddLocation error:', err);
      showError('Sunucuya bağlanılamadı.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Mekan güncelle ─────────────────────────────────────────
  const handleUpdateLocation = async () => {
    if (!editingLocation || !formName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/mekanlar/${editingLocation.id}`, {
        method: 'PUT',
        headers: buildHeaders(accessToken),
        body: JSON.stringify({
          name: formName.trim(),
          emoji: formEmoji,
          color: formColor,
          photoPrice: parseFloat(formPhotoPrice) || 0,
          priceCurrency: formPriceCurrency,
          yearlyRent: parseFloat(formYearlyRent) || 0,
          profitTarget: parseFloat(formProfitTarget) || 0,
          yearlyRents: Object.fromEntries(Object.entries(formYearlyRents).filter(([,v]) => parseFloat(v) > 0).map(([k,v]) => [k, parseFloat(v)])),
          profitTargets: Object.fromEntries(Object.entries(formProfitTargets).filter(([,v]) => parseFloat(v) > 0).map(([k,v]) => [k, parseFloat(v)])),
          printType: formPrintType,
          workingHours: { start: formWorkingHoursStart, end: formWorkingHoursEnd },
          kotaKademeleri: formKotaKademeleri,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'Mekan güncellenemedi.'); return; }
      setLocations(prev => prev.map(l => l.id === editingLocation.id ? data.mekan : l));
      showSuccess(`✅ "${data.mekan.name}" güncellendi.`);
      resetForm();
    } catch (err) {
      console.error('handleUpdateLocation error:', err);
      showError('Sunucuya bağlanılamadı.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Mekan sil ──────────────────────────────────────────────
  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Bu mekanı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`${API_BASE}/mekanlar/${id}`, {
        method: 'DELETE',
        headers: buildHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'Mekan silinemedi.'); return; }
      setLocations(prev => prev.filter(l => l.id !== id));
      showSuccess(`🗑️ ${data.message}`);
    } catch (err) {
      console.error('handleDeleteLocation error:', err);
      showError('Sunucuya bağlanılamadı.');
    }
  };

  // ─── Fotoğraf fiyatı güncelle ───────────────────────────────
  const handleUpdatePhotoPrice = async (locationId: string) => {
    const newPrice = parseFloat(editingPrices[locationId] || '0');
    const location = locations.find(l => l.id === locationId);
    if (!location) return;
    try {
      const res = await fetch(`${API_BASE}/mekanlar/${locationId}`, {
        method: 'PUT',
        headers: buildHeaders(accessToken),
        body: JSON.stringify({ ...location, photoPrice: newPrice }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'Fiyat güncellenemedi.'); return; }
      setLocations(prev => prev.map(l => l.id === locationId ? data.mekan : l));
      const newEditingPrices = { ...editingPrices };
      delete newEditingPrices[locationId];
      setEditingPrices(newEditingPrices);
      showSuccess('✅ Fiyat güncellendi.');
    } catch (err) {
      console.error('handleUpdatePhotoPrice error:', err);
      showError('Sunucuya bağlanılamadı.');
    }
  };

  // ─── Form yardımcıları ──────────────────────────────────────
  const startEdit = (location: Location) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormEmoji(location.emoji);
    setFormColor(location.color);
    setFormPhotoPrice((location.photoPrice ?? 0).toString());
    setFormPriceCurrency((location as any).priceCurrency || 'TRY');
    setFormYearlyRent((location.yearlyRent ?? 0).toString());
    // profitTarget varsa onu kullan, yoksa eski profitPercentage'den hesapla (geriye uyumluluk)
    const pt = location.profitTarget ?? (location.profitPercentage && location.yearlyRent
      ? Math.round(location.yearlyRent * (location.profitPercentage / 100))
      : 0);
    setFormProfitTarget(pt.toString());
    setFormPrintType(location.printType || 'yarim');
    setFormWorkingHoursStart(location.workingHours?.start || '09:00');
    setFormWorkingHoursEnd(location.workingHours?.end || '18:00');
    setFormKotaKademeleri(location.kotaKademeleri || []);
    // Yıl bazlı kiralar/hedefler
    const yr = (location as any).yearlyRents || {};
    const pt2 = (location as any).profitTargets || {};
    setFormYearlyRents(Object.fromEntries(Object.entries(yr).map(([k, v]) => [k, String(v)])));
    setFormProfitTargets(Object.fromEntries(Object.entries(pt2).map(([k, v]) => [k, String(v)])));
    setShowAddForm(false);
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingLocation(null);
    setFormName('');
    setFormEmoji('📍');
    setFormColor('#9dd9ea');
    setFormPhotoPrice('0');
    setFormPriceCurrency('TRY');
    setFormYearlyRent('0');
    setFormProfitTarget('0');
    setFormYearlyRents({});
    setFormProfitTargets({});
    setFormPrintType('yarim');
    setFormWorkingHoursStart('09:00');
    setFormWorkingHoursEnd('18:00');
    setFormKotaKademeleri([]);
  };

  const calculateDailyExpectation = (yearlyRent: number, profitTarget: number): number => {
    const dailyRent = yearlyRent / 365;
    const dailyProfitTarget = profitTarget / 365;
    return dailyRent + dailyProfitTarget;
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return '0';
    return value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // ─── Erişim yok ekranı ──────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="pb-20 min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
        <div className="px-6 max-w-md">
          <div className="backdrop-blur-xl bg-red-700/20 border-2 border-red-600/40 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Erişim Reddedildi</h2>
            <p className="text-gray-300 mb-6">Mekan Yönetimi sayfasına erişim yetkiniz bulunmamaktadır.</p>
            <button
              onClick={() => onNavigate('resource-management')}
              className="w-full py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
            >
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Yükleniyor ekranı ──────────────────────────────────────
  if (loading) {
    return (
      <div className="pb-20 min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-[#9dd9ea]/30 border-t-[#9dd9ea] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Mekanlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>

      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => onNavigate('resource-management')}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 border-2 border-white/20 hover:bg-white/20 transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-3xl font-bold text-white">Mekan Yönetimi</h1>
          <span className="text-3xl">📍</span>
          <button
            onClick={loadMekanlar}
            className="ml-auto flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 border-2 border-white/20 hover:bg-white/20 transition-all active:scale-95"
            title="Yenile"
          >
            <RefreshCw className="w-4 h-4 text-gray-300" />
          </button>
        </div>
        <p className="text-sm text-gray-400 ml-[52px]">
          {locations.length} mekan kayıtlı
        </p>
      </div>

      {/* ─── API Tanı Kartı ─────────────────────────────────── */}
      {diagStatus !== 'idle' && (
        <div className="px-6 mb-2">
          <button
            onClick={() => setShowDiag(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              diagStatus === 'ok'
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>{diagStatus === 'ok' ? '✅' : '❌'}</span>
              <span>Supabase Bağlantısı: {diagStatus === 'ok' ? 'Başarılı' : 'Hatalı'}</span>
              {diagHttpCode && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  diagStatus === 'ok'
                    ? 'bg-green-500/20 border-green-500/40 text-green-200'
                    : 'bg-red-500/20 border-red-500/40 text-red-200'
                }`}>
                  HTTP {diagHttpCode}
                </span>
              )}
            </span>
            <span className="text-gray-400">{showDiag ? '▲' : '▼'}</span>
          </button>
          {showDiag && (
            <div className={`mt-1 px-4 py-3 rounded-xl border text-xs font-mono leading-relaxed ${
              diagStatus === 'ok'
                ? 'bg-green-500/5 border-green-500/20 text-green-300'
                : 'bg-red-500/5 border-red-500/20 text-red-300'
            }`}>
              <p className="text-gray-400 mb-1">📡 Endpoint: <span className="text-gray-200">{API_BASE}/mekanlar</span></p>
              <p>🔎 Detay: {diagDetail}</p>
            </div>
          )}
        </div>
      )}

      {/* Bildirim Alanı */}
      <div className="px-6 space-y-2 mb-2">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/40 rounded-xl text-green-300 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      <div className="px-6 space-y-4">

        {/* ─── Ekle / Düzenle Formu ─────────────────────────── */}
        {(showAddForm || editingLocation) && (
          <div className="backdrop-blur-xl bg-pink-700/20 border-2 border-pink-600/40 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✏️</span>
                <h3 className="font-semibold text-white">
                  {editingLocation ? 'Mekan Düzenle' : 'Yeni Mekan Ekle'}
                </h3>
              </div>
              <button
                onClick={resetForm}
                className="w-10 h-10 rounded-xl bg-white/10 border-2 border-white/20 hover:bg-white/20 flex items-center justify-center transition-all active:scale-95"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Mekan Adı */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Mekan Adı</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                  placeholder="örn: ZOKA Beach Club"
                />
              </div>

              {/* Fotoğraf Fiyatı + Para Birimi */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">💰 1 Fotoğraf Fiyatı</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formPhotoPrice}
                    onChange={(e) => setFormPhotoPrice(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                    placeholder="200"
                  />
                  <select
                    value={formPriceCurrency}
                    onChange={(e) => setFormPriceCurrency(e.target.value)}
                    className="w-24 px-2 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-pink-400 transition-all"
                  >
                    <option value="TRY" className="bg-gray-900">₺ TRY</option>
                    <option value="EUR" className="bg-gray-900">€ EUR</option>
                    <option value="USD" className="bg-gray-900">$ USD</option>
                    <option value="GBP" className="bg-gray-900">£ GBP</option>
                  </select>
                </div>
                <p className="text-xs text-gray-400 mt-1">Albüm fiyatları bu değere göre{formPriceCurrency !== 'TRY' ? ` (${formPriceCurrency} — raporlar TL'ye çevrilir)` : ''}</p>
              </div>

              {/* Baskı Tipi */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">🖨️ Baskı Tipi</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['tam', 'yarim'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormPrintType(type)}
                      className={`py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                        formPrintType === type
                          ? 'bg-pink-500/40 border-2 border-pink-400 text-white'
                          : 'bg-white/10 border-2 border-white/20 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {type === 'tam' ? 'Tam Boy' : 'Yarım Boy'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji ve Renk Seçici */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Emoji ve Renk Seç</label>
                <div className="grid grid-cols-8 gap-2 mb-3">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setFormEmoji(emoji)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                        formEmoji === emoji
                          ? 'bg-pink-500/40 border-2 border-pink-400 scale-110'
                          : 'bg-white/10 border-2 border-white/20 hover:bg-white/20'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormColor(color)}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        formColor === color
                          ? 'border-4 border-white scale-110'
                          : 'border-2 border-white/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Yıllık Kira */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Yıllık Kira (₺)</label>
                <input
                  type="number"
                  value={formYearlyRent}
                  onChange={(e) => setFormYearlyRent(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                  placeholder="örn: 150000"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Günlük kira = Yıllık kira ÷ 365
                  {parseFloat(formYearlyRent) > 0 && (
                    <span className="text-blue-300 ml-1">
                      → ₺{formatCurrency(parseFloat(formYearlyRent) / 365)}/gün
                    </span>
                  )}
                </p>
              </div>

              {/* Yıllık Kar Hedefi ₺ */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Yıllık Kar Hedefi (₺)</label>
                <input
                  type="number"
                  value={formProfitTarget}
                  onChange={(e) => setFormProfitTarget(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                  placeholder="1000000"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Doğrudan yıllık kar hedefi tutarı.
                  {parseFloat(formProfitTarget) > 0 && (
                    <span className="text-pink-300 ml-1">
                      Günlük: ₺{formatCurrency(parseFloat(formProfitTarget) / 365)}
                    </span>
                  )}
                </p>
              </div>

              {/* Yıl Bazlı Kira & Hedef */}
              {Object.keys(formYearlyRents).length > 0 || Object.keys(formProfitTargets).length > 0 ? (
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">📅 Yıl Bazlı Kira & Hedef</label>
                  <p className="text-xs text-gray-500 mb-2">Farklı yıllar için özel kira/hedef. Yukarıdaki varsayılan değerlerden farklı olan yılları ekleyin.</p>
                  <div className="space-y-2">
                    {Object.keys({ ...formYearlyRents, ...formProfitTargets }).sort().map(yilStr => (
                      <div key={yilStr} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/50 font-medium">{yilStr}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormYearlyRents(prev => { const n = { ...prev }; delete n[yilStr]; return n; });
                              setFormProfitTargets(prev => { const n = { ...prev }; delete n[yilStr]; return n; });
                            }}
                            className="text-red-400/60 hover:text-red-400 text-xs"
                          >Kaldır</button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={formYearlyRents[yilStr] || ''}
                            onChange={(e) => setFormYearlyRents(prev => ({ ...prev, [yilStr]: e.target.value }))}
                            className="flex-1 min-w-0 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400"
                            placeholder="Kira ₺"
                          />
                          <input
                            type="number"
                            value={formProfitTargets[yilStr] || ''}
                            onChange={(e) => setFormProfitTargets(prev => ({ ...prev, [yilStr]: e.target.value }))}
                            className="flex-1 min-w-0 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-pink-400"
                            placeholder="Hedef ₺"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {!yilEkleAcik ? (
                <button type="button" onClick={() => setYilEkleAcik(true)}
                  className="text-xs text-blue-400/70 hover:text-blue-300 underline">
                  + Geçmiş yıl bazlı kira/hedef ekle
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={yilInput}
                    onChange={(e) => setYilInput(e.target.value)}
                    className="w-20 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    placeholder="2025"
                    min="2020" max="2035"
                    autoFocus
                  />
                  <button type="button" onClick={() => {
                    if (/^\d{4}$/.test(yilInput.trim())) {
                      setFormYearlyRents(prev => ({ ...prev, [yilInput.trim()]: prev[yilInput.trim()] || '' }));
                      setYilEkleAcik(false);
                    }
                  }} className="px-3 py-2 bg-blue-500/30 hover:bg-blue-500/50 text-blue-300 text-xs rounded-lg font-medium">Ekle</button>
                  <button type="button" onClick={() => setYilEkleAcik(false)}
                    className="text-white/30 hover:text-white/60 text-xs">Vazgeç</button>
                </div>
              )}

              {/* Çalışma Saatleri */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">🕐 Çalışma Saatleri</label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={formWorkingHoursStart}
                    onChange={(e) => setFormWorkingHoursStart(e.target.value)}
                    className="w-28 px-3 py-2 bg-white/10 border-2 border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-400 transition-all"
                  />
                  <span className="text-white font-semibold">–</span>
                  <input
                    type="time"
                    value={formWorkingHoursEnd}
                    onChange={(e) => setFormWorkingHoursEnd(e.target.value)}
                    className="w-28 px-3 py-2 bg-white/10 border-2 border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-400 transition-all"
                  />
                </div>
              </div>

              {/* ── Kota Kademeleri ── */}
              <div className="p-4 bg-gradient-to-br from-yellow-600/10 to-ta/10 border-2 border-yellow-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🏆</span>
                  <h5 className="text-sm font-bold text-yellow-300">Hakediş Kota Kademeleri</h5>
                  {formKotaKademeleri.length > 0 && (
                    <span className="text-xs bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 px-2 py-0.5 rounded-full">
                      {formKotaKademeleri.length} kademe
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Günlük ciro bu hedefleri geçince personele hakediş kazandırılır.
                </p>

                <div className="space-y-3">
                  {formKotaKademeleri.map((kota, index) => {
                    const TROPHY_POOL = ['🎖️', '🥉', '🥈', '🏆', '💎', '👑'];
                    const total = formKotaKademeleri.length;
                    const fromEnd = (total - 1) - index;
                    const poolIdx = Math.max(0, TROPHY_POOL.length - 1 - fromEnd);
                    const kadeEmoji = TROPHY_POOL[poolIdx];
                    return (
                      <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        {/* Kademe başlığı */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{kadeEmoji}</span>
                            <span className="text-xs font-bold text-white/70">{index + 1}. Kademe</span>
                          </div>
                          <button
                            onClick={() => {
                              const arr = [...formKotaKademeleri];
                              arr.splice(index, 1);
                              setFormKotaKademeleri(arr);
                            }}
                            className="p-1.5 bg-red-600/30 border border-red-500/30 rounded-lg text-red-300 hover:scale-110 transition-all active:scale-95"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {/* 5 field: hedef + 4 prim */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-yellow-400/70 font-bold w-20 flex-shrink-0">🎯 Ciro Hedefi</span>
                            <input
                              type="number"
                              value={kota.hedef || ''}
                              onChange={(e) => {
                                const arr = [...formKotaKademeleri];
                                arr[index] = { ...arr[index], hedef: parseFloat(e.target.value) || 0 };
                                setFormKotaKademeleri(arr);
                              }}
                              className="flex-1 min-w-0 px-3 py-1.5 bg-white/10 border-2 border-yellow-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-all text-sm"
                              placeholder="₺ Hedef"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-400/70 font-bold w-20 flex-shrink-0">👤 Solo</span>
                            <input
                              type="number"
                              value={kota.primTek || ''}
                              onChange={(e) => {
                                const arr = [...formKotaKademeleri];
                                arr[index] = { ...arr[index], primTek: parseFloat(e.target.value) || 0 };
                                setFormKotaKademeleri(arr);
                              }}
                              className="flex-1 min-w-0 px-3 py-1.5 bg-white/10 border-2 border-blue-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 transition-all text-sm"
                              placeholder="₺ Solo hakediş"
                            />
                          </div>
                          {/* Görev bazlı hakediş bantları */}
                          <div className="mt-2 space-y-2">
                            <span className="text-[9px] text-white/30 font-bold uppercase tracking-wide">Görev Bazlı Hakediş Bantları</span>
                            {([
                              { key: 'fotografBantlar', label: '📸 Fotoğrafçı', color: 'green', fallbackKey: 'primFotograf' },
                              { key: 'baskiBantlar', label: '🖨️ Baskıcı', color: 'orange', fallbackKey: 'primBaski' },
                              { key: 'albumBantlar', label: '📒 Albümcü', color: 'pink', fallbackKey: 'primAlbum' },
                              { key: 'gozlemciBantlar', label: '👁️ Gözlemci', color: 'cyan', fallbackKey: 'primGozlemci' },
                            ] as { key: string; label: string; color: string; fallbackKey: string }[]).map(({ key, label, color, fallbackKey }) => {
                              const bantlar: GorevBanti[] = (kota as any)[key] || [];
                              const hasBantlar = bantlar.length > 0;
                              return (
                                <div key={key} className={`rounded-lg border border-${color}-500/20 bg-${color}-500/5 p-2`}
                                  style={{ borderColor: `var(--tw-${color}, rgba(255,255,255,0.1))`, background: 'rgba(255,255,255,0.02)' }}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`text-[9px] font-bold`} style={{ color: color === 'green' ? '#4ade80' : color === 'orange' ? '#fb923c' : color === 'pink' ? '#f472b6' : '#22d3ee' }}>{label}</span>
                                    {!hasBantlar && (
                                      <button type="button" onClick={() => {
                                        const arr = [...formKotaKademeleri];
                                        (arr[index] as any)[key] = [{ min: 1, max: 1, tutar: (kota as any)[fallbackKey] || 0 }];
                                        setFormKotaKademeleri(arr);
                                      }} className="text-[8px] text-blue-400/60 hover:text-blue-300 underline">Bant ekle</button>
                                    )}
                                  </div>
                                  {hasBantlar ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 px-0.5">
                                        <span className="text-[7px] text-white/25 w-[52px] text-center">Kişi Aralığı</span>
                                        <span className="text-[7px] text-white/25 w-16 text-center ml-auto">Hakediş ₺</span>
                                        <span className="w-3"></span>
                                      </div>
                                      {bantlar.map((bant, bi) => {
                                        // Çakışma kontrolü
                                        const cakisiyor = bantlar.some((other, oi) =>
                                          oi !== bi && bant.min <= other.max && bant.max >= other.min
                                        );
                                        return (
                                        <div key={bi} className="flex items-center gap-1">
                                          <input type="number" value={bant.min || ''} onChange={(e) => {
                                            const arr = [...formKotaKademeleri];
                                            const b = [...((arr[index] as any)[key] || [])];
                                            b[bi] = { ...b[bi], min: parseInt(e.target.value) || 0 };
                                            (arr[index] as any)[key] = b;
                                            setFormKotaKademeleri(arr);
                                          }} className={`w-10 px-1 py-1 bg-white/10 border rounded text-white text-[10px] text-center ${cakisiyor ? 'border-red-500/50' : 'border-white/15'}`} placeholder="Min" />
                                          <span className="text-[9px] text-white/20">—</span>
                                          <input type="number" value={bant.max || ''} onChange={(e) => {
                                            const arr = [...formKotaKademeleri];
                                            const b = [...((arr[index] as any)[key] || [])];
                                            b[bi] = { ...b[bi], max: parseInt(e.target.value) || 0 };
                                            (arr[index] as any)[key] = b;
                                            setFormKotaKademeleri(arr);
                                          }} className={`w-10 px-1 py-1 bg-white/10 border rounded text-white text-[10px] text-center ${cakisiyor ? 'border-red-500/50' : 'border-white/15'}`} placeholder="Max" />
                                          <span className="text-[9px] text-white/20">→</span>
                                          <input type="number" value={bant.tutar || ''} onChange={(e) => {
                                            const arr = [...formKotaKademeleri];
                                            const b = [...((arr[index] as any)[key] || [])];
                                            b[bi] = { ...b[bi], tutar: parseFloat(e.target.value) || 0 };
                                            (arr[index] as any)[key] = b;
                                            setFormKotaKademeleri(arr);
                                          }} className="w-16 px-1 py-1 bg-white/10 border border-white/15 rounded text-white text-[10px] text-center" placeholder="₺" />
                                          <button type="button" onClick={() => {
                                            const arr = [...formKotaKademeleri];
                                            const b = [...((arr[index] as any)[key] || [])];
                                            b.splice(bi, 1);
                                            (arr[index] as any)[key] = b;
                                            setFormKotaKademeleri(arr);
                                          }} className="text-red-400/40 hover:text-red-400 text-[10px]">✕</button>
                                          {cakisiyor && <span className="text-[7px] text-red-400">!</span>}
                                        </div>
                                        );
                                      })}
                                      <button type="button" onClick={() => {
                                        const arr = [...formKotaKademeleri];
                                        const b = [...((arr[index] as any)[key] || [])];
                                        const lastMax = b.length > 0 ? b[b.length - 1].max : 0;
                                        b.push({ min: lastMax + 1, max: 99, tutar: 0 });
                                        (arr[index] as any)[key] = b;
                                        setFormKotaKademeleri(arr);
                                      }} className="text-[8px] text-blue-400/50 hover:text-blue-300 underline">+ Bant ekle</button>
                                    </div>
                                  ) : (
                                    <input type="number" value={(kota as any)[fallbackKey] || ''} onChange={(e) => {
                                      const arr = [...formKotaKademeleri];
                                      (arr[index] as any)[fallbackKey] = parseFloat(e.target.value) || 0;
                                      setFormKotaKademeleri(arr);
                                    }} className="w-full px-2 py-1 bg-white/10 border border-white/15 rounded-lg text-white text-xs text-center" placeholder="₺ Sabit tutar" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Kıdem Bazlı Hakediş Önizlemesi — sadece yönetici + üst-müdür */}
                        {canViewKidem && (() => {
                          // Önizleme satırları: solo + bantlı görevler + fallback sabitler
                          const rows: Array<{ label: string; base: number; color: string; bandInfo?: string }> = [];
                          // Solo
                          if (kota.primTek > 0) rows.push({ label: '👤 Solo', base: kota.primTek, color: '#a7c7e7' });
                          // Bantlı görevler
                          const gorevler = [
                            { key: 'fotografBantlar', fallback: 'primFotograf', emoji: '📸', name: 'Fotoğrafçı', color: '#4ade80' },
                            { key: 'baskiBantlar', fallback: 'primBaski', emoji: '🖨️', name: 'Baskıcı', color: '#fb923c' },
                            { key: 'albumBantlar', fallback: 'primAlbum', emoji: '📒', name: 'Albümcü', color: '#f472b6' },
                            { key: 'gozlemciBantlar', fallback: 'primGozlemci', emoji: '👁️', name: 'Gözlemci', color: '#22d3ee' },
                          ];
                          for (const g of gorevler) {
                            const bantlar: GorevBanti[] = (kota as any)[g.key] || [];
                            if (bantlar.length > 0) {
                              for (const b of bantlar) {
                                if (b.tutar > 0) {
                                  const bandLabel = b.min === b.max ? `${b.min} kişi` : b.max >= 99 ? `${b.min}+ kişi` : `${b.min}-${b.max} kişi`;
                                  rows.push({ label: `${g.emoji} ${g.name}`, base: b.tutar, color: g.color, bandInfo: bandLabel });
                                }
                              }
                            } else if ((kota as any)[g.fallback] > 0) {
                              rows.push({ label: `${g.emoji} ${g.name}`, base: (kota as any)[g.fallback], color: g.color });
                            }
                          }
                          if (rows.length === 0) return null;
                          return (
                          <div style={{ marginTop: 10, background: 'rgba(157,217,234,0.05)', border: '1px solid rgba(157,217,234,0.15)', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                              <span style={{ fontSize: 11 }}>🎖️</span>
                              <span style={{ color: '#9dd9ea', fontSize: 10, fontWeight: 800 }}>Kıdem Bazlı Hakediş</span>
                              <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, fontWeight: 700, background: 'rgba(157,217,234,0.1)', border: '1px solid rgba(157,217,234,0.2)', color: 'rgba(157,217,234,0.6)', marginLeft: 'auto' }}>
                                ×{kidemCarpanlar.kidemsiz.toFixed(2)} / ×{kidemCarpanlar.kidemli.toFixed(2)} / ×{kidemCarpanlar.kidemliPlus.toFixed(2)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {rows.map((r, ri) => (
                                <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <div style={{ minWidth: 80 }}>
                                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 700 }}>{r.label}</span>
                                    {r.bandInfo && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 7, marginLeft: 3 }}>({r.bandInfo})</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                                    {([
                                      { klabel: 'Kıdemsiz', carpan: kidemCarpanlar.kidemsiz },
                                      { klabel: 'Kıdemli', carpan: kidemCarpanlar.kidemli },
                                      { klabel: 'Kıdemli+', carpan: kidemCarpanlar.kidemliPlus },
                                    ]).map(({ klabel, carpan }) => (
                                      <div key={klabel} style={{ flex: 1, textAlign: 'center', background: `${r.color}08`, border: `1px solid ${r.color}20`, borderRadius: 7, padding: '3px 2px' }}>
                                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 7, fontWeight: 700, marginBottom: 1 }}>{klabel}</p>
                                        <p style={{ color: r.color, fontSize: 10, fontWeight: 900 }}>₺{Math.round(r.base * carpan).toLocaleString('tr-TR')}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {formKotaKademeleri.length < 6 ? (
                  <button
                    onClick={() => setFormKotaKademeleri([...formKotaKademeleri, { hedef: 0, primTek: 0, primFotograf: 0, primBaski: 0, primAlbum: 0, primGozlemci: 0 }])}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-yellow-600/30 border border-yellow-500/40 rounded-xl text-yellow-200 text-sm font-semibold hover:bg-yellow-600/50 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    {formKotaKademeleri.length === 0 ? 'İlk Kademeyi Ekle' : `${formKotaKademeleri.length + 1}. Kademe Ekle`}
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-500 text-sm">
                    <span>👑</span>
                    <span>Maksimum 6 kademe tanımlanabilir</span>
                  </div>
                )}

                {formKotaKademeleri.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-2">
                    💡 Hakedişler toplanarak işlenir — her geçilen kademenin hakedişi bir üstekine eklenir
                  </p>
                )}
              </div>

              {/* Fiyat Önizleme */}
              {parseFloat(formPhotoPrice) > 0 && (
                <div className="p-4 bg-gradient-to-br from-pink-600/20 to-ta/20 border-2 border-pink-500/40 rounded-xl">
                  <h5 className="text-sm font-bold text-pink-300 mb-3">💰 Albüm Fiyatları Önizleme</h5>
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-3 gap-3">
                      {[3, 5, 7, 9, 11, 13, 15].map((n) => (
                        <div key={n} className="flex justify-between">
                          <span className="text-gray-300">{n}'li:</span>
                          <span className="font-bold text-white">{formPriceCurrency === 'EUR' ? '€' : formPriceCurrency === 'USD' ? '$' : formPriceCurrency === 'GBP' ? '£' : '₺'}{formatCurrency(parseFloat(formPhotoPrice) * n)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <span className="text-green-300">1 Fotoğraf:</span>
                        <span className="font-bold text-green-300">{formPriceCurrency === 'EUR' ? '€' : formPriceCurrency === 'USD' ? '$' : formPriceCurrency === 'GBP' ? '£' : '₺'}{formatCurrency(parseFloat(formPhotoPrice))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Hesaplama Özeti */}
              {parseFloat(formYearlyRent) > 0 && (() => {
                const yr = parseFloat(formYearlyRent) || 0;
                const pt = parseFloat(formProfitTarget) || 0;
                const dailyRent = yr / 365;
                const dailyProfit = pt / 365;
                const dailyTarget = dailyRent + dailyProfit;
                const photosNeeded = parseFloat(formPhotoPrice) > 0 ? Math.ceil(dailyTarget / parseFloat(formPhotoPrice)) : null;
                return (
                  <div className="p-4 bg-gradient-to-br from-blue-600/20 to-green-600/20 border-2 border-blue-500/40 rounded-xl">
                    <h5 className="text-sm font-bold text-blue-300 mb-3">📊 Hesaplama Özeti</h5>
                    <div className="mb-3 p-2 bg-white/5 rounded-lg text-[10px] text-gray-400 leading-relaxed space-y-0.5">
                      <p>📌 <span className="text-gray-300">Günlük Kira</span> = Yıllık Kira ÷ 365</p>
                      <p>📌 <span className="text-gray-300">Günlük Kar Hedefi</span> = Yıllık Kar Hedefi ÷ 365</p>
                      <p>📌 <span className="text-blue-300 font-semibold">Günlük Gelir Hedefi</span> = Günlük Kira + Günlük Kar</p>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Günlük Kira:</span>
                        <span className="font-bold text-white">₺{formatCurrency(dailyRent)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-300">Günlük Kar Hedefi:</span>
                        <span className="font-bold text-green-300">₺{formatCurrency(dailyProfit)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-blue-500/30">
                        <span className="text-blue-200 font-bold">Günlük Gelir Hedefi:</span>
                        <span className="font-bold text-blue-200">₺{formatCurrency(dailyTarget)}</span>
                      </div>
                      {photosNeeded && (
                        <div className="flex justify-between">
                          <span className="text-cyan-300">Gerekli Fotoğraf/Gün:</span>
                          <span className="font-bold text-cyan-300">~{photosNeeded} adet</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-blue-500/30">
                        <span className="text-pink-300 font-bold">Yıllık Kar Hedefi:</span>
                        <span className="font-bold text-pink-300">₺{formatCurrency(pt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Butonlar */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={editingLocation ? handleUpdateLocation : handleAddLocation}
                  disabled={saving || !formName.trim()}
                  className="flex-1 py-3 bg-pink-600/60 border-2 border-pink-500/50 rounded-xl text-white font-semibold hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Kaydediliyor...</span></>
                  ) : (
                    <span>{editingLocation ? 'Güncelle' : 'Ekle'}</span>
                  )}
                </button>
                <button
                  onClick={resetForm}
                  className="px-6 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Mekan Listesi ───────────────────────────────────── */}
        <div className="backdrop-blur-xl bg-ta/20 border-2 border-ta/40 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-ta" />
              <h3 className="font-semibold text-white">Mekanlar</h3>
              <span className="text-xs bg-ta/30 border border-ta/40 text-ta px-2 py-0.5 rounded-full">
                {locations.length}
              </span>
            </div>
            {canEdit && (
              <button
                onClick={() => { setShowAddForm(true); setEditingLocation(null); }}
                className="flex items-center gap-1 px-3 py-2 bg-pink-600/60 border-2 border-pink-500/50 rounded-xl text-white text-sm font-semibold hover:scale-105 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Yeni Mekan
              </button>
            )}
          </div>

          {locations.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">📍</div>
              <p className="text-gray-400 text-sm">Henüz mekan eklenmemiş.</p>
              {canEdit && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-3 px-4 py-2 bg-pink-600/40 border border-pink-500/40 rounded-xl text-pink-300 text-sm hover:bg-pink-600/60 transition-all"
                >
                  İlk mekanı ekle
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {locations.map((location) => {
                const profitTgt = location.profitTarget || (location.profitPercentage ? Math.round(location.yearlyRent * (location.profitPercentage / 100)) : 0);
                const dailyExpectation = calculateDailyExpectation(
                  location.yearlyRent,
                  profitTgt,
                );
                const isBeingEdited = editingLocation?.id === location.id;

                return (
                  <div
                    key={location.id}
                    className={`backdrop-blur-xl bg-white/5 border-2 rounded-xl p-4 hover:border-white/30 transition-all ${
                      isBeingEdited ? 'border-pink-400/60' : 'border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Emoji Box */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border-2"
                        style={{ backgroundColor: location.color + '33', borderColor: location.color + '88' }}
                      >
                        {location.emoji}
                      </div>

                      {/* İçerik */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white mb-1 truncate">{location.name}</h4>
                        {canViewNumbers ? (
                          <div className="text-xs text-gray-400 space-y-0.5">
                            <div className="flex gap-3 flex-wrap">
                              <span>Kira: ₺{formatCurrency(location.yearlyRent)}/yıl</span>
                              <span className="text-green-400">Kar Hedefi: ₺{formatCurrency(location.profitTarget || (location.profitPercentage ? Math.round(location.yearlyRent * (location.profitPercentage / 100)) : 0))}</span>
                            </div>
                            <div className="flex gap-3 flex-wrap">
                              <span className="text-blue-300">Günlük Hedef: ₺{formatCurrency(dailyExpectation)}</span>
                              <span className="text-pink-300">📸 ₺{formatCurrency(location.photoPrice)}</span>
                            </div>
                            {location.workingHours && (
                              <div className="flex items-center gap-1 text-[#a8e6cf]">
                                <span>🕐</span>
                                <span className="font-semibold">{location.workingHours.start} – {location.workingHours.end}</span>
                              </div>
                            )}
                            {location.printType && (
                              <span className="text-amber-300">
                                🖨️ {location.printType === 'tam' ? 'Tam Boy' : 'Yarım Boy'}
                              </span>
                            )}
                            {/* Kota özeti */}
                            {location.kotaKademeleri && location.kotaKademeleri.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                <span className="text-yellow-400">🏆</span>
                                {[...location.kotaKademeleri].sort((a, b) => Number(a.hedef) - Number(b.hedef)).map((k, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                                    style={{
                                      background: i === 0 ? 'rgba(96,165,250,0.15)' : i === 1 ? 'rgba(var(--app-accent-rgb),0.15)' : 'rgba(251,191,36,0.15)',
                                      color: i === 0 ? '#93c5fd' : i === 1 ? 'var(--app-accent, #a855f7)' : '#fde68a',
                                      border: `1px solid ${i === 0 ? 'rgba(96,165,250,0.3)' : i === 1 ? 'rgba(var(--app-accent-rgb),0.3)' : 'rgba(251,191,36,0.3)'}`,
                                    }}
                                  >
                                    {i + 1}. {k.hedef >= 1000 ? `₺${(k.hedef / 1000).toFixed(0)}B` : `₺${k.hedef}`}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">Mekan bilgileri gizli</div>
                        )}
                      </div>

                      {/* Düzenle / Sil Butonları */}
                      {canEdit && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => startEdit(location)}
                            className={`p-2 border-2 rounded-lg text-white hover:scale-110 transition-all active:scale-95 ${
                              isBeingEdited
                                ? 'bg-pink-600/60 border-pink-400'
                                : 'bg-blue-600/60 border-blue-500/50'
                            }`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(location.id)}
                            className="p-2 bg-red-600/60 border-2 border-red-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Fotoğraf Fiyat Yönetimi ─────────────────────────── */}
        {canEdit && !showAddForm && !editingLocation && locations.length > 0 && (
          <div className="backdrop-blur-xl bg-emerald-700/20 border-2 border-emerald-600/40 rounded-2xl p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💰</span>
                <h3 className="font-semibold text-white">1 Fotoğraf Fiyatı Ayarları</h3>
              </div>
              <p className="text-xs text-gray-400">Her mekan için birim fotoğraf fiyatını hızlıca güncelleyin</p>
            </div>

            <div className="space-y-3">
              {locations.map((location) => {
                const isEditing = editingPrices[location.id] !== undefined;
                const currentPrice = isEditing
                  ? editingPrices[location.id]
                  : (location.photoPrice ?? 0).toString();

                return (
                  <div key={location.id} className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl border-2"
                          style={{ backgroundColor: location.color + '33', borderColor: location.color + '88' }}
                        >
                          {location.emoji}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{location.name}</h4>
                          <p className="text-xs text-gray-400">Mevcut: ₺{formatCurrency(location.photoPrice)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={currentPrice}
                          onChange={(e) => setEditingPrices({ ...editingPrices, [location.id]: e.target.value })}
                          className="w-24 px-3 py-2 bg-white/10 border-2 border-white/20 rounded-lg text-white text-center focus:outline-none focus:border-emerald-400 transition-all text-sm"
                        />
                        <span className="text-white font-semibold text-sm">₺</span>
                        <button
                          onClick={() => handleUpdatePhotoPrice(location.id)}
                          className="flex items-center gap-1 px-3 py-2 bg-emerald-600/60 border-2 border-emerald-500/50 rounded-lg text-white text-sm font-semibold hover:scale-105 transition-all active:scale-95"
                        >
                          <Save className="w-4 h-4" />
                          Kaydet
                        </button>
                      </div>
                    </div>

                    {/* Albüm Fiyatları */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[3, 5, 7, 9, 11, 13, 15].map((n) => (
                        <div key={n} className="flex justify-between bg-white/5 rounded-lg px-2 py-1">
                          <span className="text-gray-400">{n}'li</span>
                          <span className="text-white font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0') * n)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between bg-green-500/10 rounded-lg px-2 py-1">
                        <span className="text-green-400">1'li</span>
                        <span className="text-green-300 font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0'))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Bilgi Kartı ──────────────────────────────────────── */}
        <div className="mb-6">
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-ta/20 border border-ta/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">ℹ️</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-2">📍 Mekan Yönetimi Yetki Sistemi</h4>
                <div className="space-y-1.5 text-sm text-gray-400">
                  <p><span className="text-red-300 font-medium">🛡️ Yönetici:</span> Ekleyebilir, düzenleyebilir, silebilir.</p>
                  <p><span className="text-indigo-300 font-medium">👤 Üst-Müdür, Müdür, İdari:</span> Tüm detayları görebilir.</p>
                  <p><span className="text-blue-300 font-medium">⚙️ Operasyon:</span> Sadece mekan adlarını görebilir.</p>
                  <p><span className="text-gray-500 font-medium">❌ Personel, Bekleyen:</span> Erişim yok.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}