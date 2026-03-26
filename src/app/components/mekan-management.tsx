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
  dailyCostPercentage: number;
  profitPercentage: number;
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

export interface KotaKademe {
  hedef: number;
  primTek: number;      // Solo prim (1 kişi)
  primFotograf: number; // Takım - Fotoğrafçı/Satışçı
  primBaski: number;    // Takım - Baskıcı
  primAlbum: number;    // Takım - Albümcü
  primCoklu?: number;   // Eski format uyumluluğu
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
  const [formYearlyRent, setFormYearlyRent] = useState('0');
  const [formDailyCost, setFormDailyCost] = useState('0');
  const [formProfit, setFormProfit] = useState('0');
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
          yearlyRent: parseFloat(formYearlyRent) || 0,
          dailyCostPercentage: parseFloat(formDailyCost) || 0,
          profitPercentage: parseFloat(formProfit) || 0,
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
          yearlyRent: parseFloat(formYearlyRent) || 0,
          dailyCostPercentage: parseFloat(formDailyCost) || 0,
          profitPercentage: parseFloat(formProfit) || 0,
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
    setFormYearlyRent((location.yearlyRent ?? 0).toString());
    setFormDailyCost((location.dailyCostPercentage ?? 0).toString());
    setFormProfit((location.profitPercentage ?? 0).toString());
    setFormPrintType(location.printType || 'yarim');
    setFormWorkingHoursStart(location.workingHours?.start || '09:00');
    setFormWorkingHoursEnd(location.workingHours?.end || '18:00');
    setFormKotaKademeleri(location.kotaKademeleri || []);
    setShowAddForm(false);
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingLocation(null);
    setFormName('');
    setFormEmoji('📍');
    setFormColor('#9dd9ea');
    setFormPhotoPrice('0');
    setFormYearlyRent('0');
    setFormDailyCost('0');
    setFormProfit('0');
    setFormPrintType('yarim');
    setFormWorkingHoursStart('09:00');
    setFormWorkingHoursEnd('18:00');
    setFormKotaKademeleri([]);
  };

  const calculateDailyExpectation = (yearlyRent: number, dailyCost: number, profit: number): number => {
    const dailyRent = yearlyRent / 365;
    const minDailyRevenue = dailyRent * (1 + dailyCost / 100); // Kira + ek maliyet (break-even)
    const dailyProfitTarget = (yearlyRent * (profit / 100)) / 365; // Yıllık kar hedefinin günlük payı
    return minDailyRevenue + dailyProfitTarget;
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return '0';
    return value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // ─── Erişim yok ekranı ──────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen flex items-center justify-center">
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
      <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-[#9dd9ea]/30 border-t-[#9dd9ea] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Mekanlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">

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

              {/* Fotoğraf Fiyatı */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">💰 1 Fotoğraf Fiyatı (₺)</label>
                <input
                  type="number"
                  value={formPhotoPrice}
                  onChange={(e) => setFormPhotoPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                  placeholder="200"
                />
                <p className="text-xs text-gray-400 mt-1">Albüm fiyatları bu değere göre</p>
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

              {/* Günlük Maliyet % */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Günlük Ek Maliyet (%)</label>
                <input
                  type="number"
                  value={formDailyCost}
                  onChange={(e) => setFormDailyCost(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                  placeholder="35"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Personel, elektrik vb. — Günlük kiraya oranla ek gider.
                  {parseFloat(formDailyCost) > 0 && parseFloat(formYearlyRent) > 0 && (
                    <span className="text-orange-300 ml-1">
                      Günlük ek: ₺{formatCurrency((parseFloat(formYearlyRent) / 365) * (parseFloat(formDailyCost) / 100))}
                    </span>
                  )}
                </p>
              </div>

              {/* Kar Beklentisi % */}
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Yıllık Kar Beklentisi (%)</label>
                <input
                  type="number"
                  value={formProfit}
                  onChange={(e) => setFormProfit(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                  placeholder="20"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Yıllık kira × % = Yıllık kar hedefi.
                  {parseFloat(formProfit) > 0 && parseFloat(formYearlyRent) > 0 && (
                    <span className="text-pink-300 ml-1">
                      ₺{formatCurrency(parseFloat(formYearlyRent) * parseFloat(formProfit) / 100)}/yıl
                    </span>
                  )}
                </p>
              </div>

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
              <div className="p-4 bg-gradient-to-br from-yellow-600/10 to-purple-600/10 border-2 border-yellow-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🏆</span>
                  <h5 className="text-sm font-bold text-yellow-300">Prim Kota Kademeleri</h5>
                  {formKotaKademeleri.length > 0 && (
                    <span className="text-xs bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 px-2 py-0.5 rounded-full">
                      {formKotaKademeleri.length} kademe
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Günlük ciro bu hedefleri geçince personele prim kazandırılır.
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
                              placeholder="₺ Solo prim"
                            />
                          </div>
                          {/* Takım primleri 3'lü grid */}
                          <div className="ml-0 mt-1 mb-1">
                            <span className="text-[9px] text-white/30 font-bold uppercase tracking-wide">Takım Primleri</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-green-400/70 font-bold text-center">📸 Fotoğraf</span>
                              <input
                                type="number"
                                value={kota.primFotograf || ''}
                                onChange={(e) => {
                                  const arr = [...formKotaKademeleri];
                                  arr[index] = { ...arr[index], primFotograf: parseFloat(e.target.value) || 0 };
                                  setFormKotaKademeleri(arr);
                                }}
                                className="w-full px-2 py-1.5 bg-white/10 border-2 border-green-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-all text-xs text-center"
                                placeholder="₺"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-orange-400/70 font-bold text-center">🖨️ Baskı</span>
                              <input
                                type="number"
                                value={kota.primBaski || ''}
                                onChange={(e) => {
                                  const arr = [...formKotaKademeleri];
                                  arr[index] = { ...arr[index], primBaski: parseFloat(e.target.value) || 0 };
                                  setFormKotaKademeleri(arr);
                                }}
                                className="w-full px-2 py-1.5 bg-white/10 border-2 border-orange-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 transition-all text-xs text-center"
                                placeholder="₺"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-pink-400/70 font-bold text-center">📒 Albüm</span>
                              <input
                                type="number"
                                value={kota.primAlbum || ''}
                                onChange={(e) => {
                                  const arr = [...formKotaKademeleri];
                                  arr[index] = { ...arr[index], primAlbum: parseFloat(e.target.value) || 0 };
                                  setFormKotaKademeleri(arr);
                                }}
                                className="w-full px-2 py-1.5 bg-white/10 border-2 border-pink-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-400 transition-all text-xs text-center"
                                placeholder="₺"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Kıdem Bazlı Prim Önizlemesi — sadece yönetici + üst-müdür */}
                        {canViewKidem && (kota.primTek > 0 || kota.primFotograf > 0 || kota.primBaski > 0 || kota.primAlbum > 0) && (
                          <div style={{ marginTop: 10, background: 'rgba(157,217,234,0.05)', border: '1px solid rgba(157,217,234,0.15)', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                              <span style={{ fontSize: 11 }}>🎖️</span>
                              <span style={{ color: '#9dd9ea', fontSize: 10, fontWeight: 800 }}>Kıdem Bazlı Prim</span>
                              <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, fontWeight: 700, background: 'rgba(157,217,234,0.1)', border: '1px solid rgba(157,217,234,0.2)', color: 'rgba(157,217,234,0.6)', marginLeft: 'auto' }}>
                                ×{kidemCarpanlar.kidemsiz.toFixed(2)} / ×{kidemCarpanlar.kidemli.toFixed(2)} / ×{kidemCarpanlar.kidemliPlus.toFixed(2)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {([
                                { rlabel: '👤 Solo', base: kota.primTek, color: '#a7c7e7' },
                                { rlabel: '📸 Fotoğraf/Satış', base: kota.primFotograf, color: '#9dd9ea' },
                                { rlabel: '🖨️ Baskı', base: kota.primBaski, color: '#ffd4a3' },
                                { rlabel: '📒 Albüm', base: kota.primAlbum, color: '#d4b5f7' },
                              ] as { rlabel: string; base: number; color: string }[]).filter(r => r.base > 0).map(({ rlabel, base, color }) => (
                                <div key={rlabel} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 700, minWidth: 92 }}>{rlabel}</span>
                                  <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                                    {([
                                      { ckey: 'kidemsiz', klabel: 'Kıdemsiz', carpan: kidemCarpanlar.kidemsiz },
                                      { ckey: 'kidemli', klabel: 'Kıdemli', carpan: kidemCarpanlar.kidemli },
                                      { ckey: 'kidemliPlus', klabel: 'Kıdemli+', carpan: kidemCarpanlar.kidemliPlus },
                                    ] as { ckey: string; klabel: string; carpan: number }[]).map(({ ckey, klabel, carpan }) => (
                                      <div key={ckey} style={{ flex: 1, textAlign: 'center', background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 7, padding: '3px 2px' }}>
                                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 7, fontWeight: 700, marginBottom: 1 }}>{klabel}</p>
                                        <p style={{ color, fontSize: 10, fontWeight: 900 }}>₺{Math.round(base * carpan).toLocaleString('tr-TR')}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {formKotaKademeleri.length < 6 ? (
                  <button
                    onClick={() => setFormKotaKademeleri([...formKotaKademeleri, { hedef: 0, primTek: 0, primFotograf: 0, primBaski: 0, primAlbum: 0 }])}
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
                    💡 Primler toplanarak işlenir — her geçilen kademenin primi bir üstekine eklenir
                  </p>
                )}
              </div>

              {/* Fiyat Önizleme */}
              {parseFloat(formPhotoPrice) > 0 && (
                <div className="p-4 bg-gradient-to-br from-pink-600/20 to-purple-600/20 border-2 border-pink-500/40 rounded-xl">
                  <h5 className="text-sm font-bold text-pink-300 mb-3">💰 Albüm Fiyatları Önizleme</h5>
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-3 gap-3">
                      {[3, 5, 7, 9, 11, 13, 15].map((n) => (
                        <div key={n} className="flex justify-between">
                          <span className="text-gray-300">{n}'li:</span>
                          <span className="font-bold text-white">₺{formatCurrency(parseFloat(formPhotoPrice) * n)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <span className="text-green-300">1 Fotoğraf:</span>
                        <span className="font-bold text-green-300">₺{formatCurrency(parseFloat(formPhotoPrice))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Hesaplama Özeti */}
              {parseFloat(formYearlyRent) > 0 && (() => {
                const yr = parseFloat(formYearlyRent) || 0;
                const dc = parseFloat(formDailyCost) || 0;
                const pr = parseFloat(formProfit) || 0;
                const dailyRent = yr / 365;
                const minDailyCiro = dailyRent * (1 + dc / 100);
                const annualProfit = yr * (pr / 100);
                const dailyProfit = annualProfit / 365;
                const dailyTarget = minDailyCiro + dailyProfit;
                const photosNeeded = parseFloat(formPhotoPrice) > 0 ? Math.ceil(dailyTarget / parseFloat(formPhotoPrice)) : null;
                return (
                  <div className="p-4 bg-gradient-to-br from-blue-600/20 to-green-600/20 border-2 border-blue-500/40 rounded-xl">
                    <h5 className="text-sm font-bold text-blue-300 mb-3">📊 Hesaplama Özeti</h5>
                    {/* Formül Açıklaması */}
                    <div className="mb-3 p-2 bg-white/5 rounded-lg text-[10px] text-gray-400 leading-relaxed space-y-0.5">
                      <p>📌 <span className="text-gray-300">Günlük Kira</span> = Yıllık Kira ÷ 365</p>
                      <p>📌 <span className="text-gray-300">Min. Günlük Ciro</span> = Günlük Kira × (1 + Ek Maliyet%)</p>
                      <p>📌 <span className="text-gray-300">Günlük Kar Hedefi</span> = Yıllık Kar ÷ 365</p>
                      <p>📌 <span className="text-blue-300 font-semibold">Günlük Gelir Hedefi</span> = Min. Ciro + Günlük Kar</p>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Günlük Kira:</span>
                        <span className="font-bold text-white">₺{formatCurrency(dailyRent)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-orange-300">Min. Günlük Ciro (break-even):</span>
                        <span className="font-bold text-orange-300">₺{formatCurrency(minDailyCiro)}</span>
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
                        <span className="text-pink-300 font-bold">Yıllık Kar Beklentisi:</span>
                        <span className="font-bold text-pink-300">₺{formatCurrency(annualProfit)}</span>
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
        <div className="backdrop-blur-xl bg-purple-700/20 border-2 border-purple-600/40 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-300" />
              <h3 className="font-semibold text-white">Mekanlar</h3>
              <span className="text-xs bg-purple-500/30 border border-purple-500/40 text-purple-200 px-2 py-0.5 rounded-full">
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
                const dailyExpectation = calculateDailyExpectation(
                  location.yearlyRent,
                  location.dailyCostPercentage,
                  location.profitPercentage,
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
                              <span className="text-green-400">Kar: %{location.profitPercentage}</span>
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
                                      background: i === 0 ? 'rgba(96,165,250,0.15)' : i === 1 ? 'rgba(168,85,247,0.15)' : 'rgba(251,191,36,0.15)',
                                      color: i === 0 ? '#93c5fd' : i === 1 ? '#c4b5fd' : '#fde68a',
                                      border: `1px solid ${i === 0 ? 'rgba(96,165,250,0.3)' : i === 1 ? 'rgba(168,85,247,0.3)' : 'rgba(251,191,36,0.3)'}`,
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
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
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