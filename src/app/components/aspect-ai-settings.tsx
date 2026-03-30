import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Save, RotateCcw, Plus, Trash2, GripVertical,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader2,
  Eye, MessageSquare, Zap, ShieldOff, Shield,
  BarChart2, Users, AlertTriangle, ArrowLeft, Info
} from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface Chip {
  icon: string;
  label: string;
  q: string;
}

interface SerializableRoleConfig {
  welcomeTemplate: string;  // "{name}" placeholder içerir
  chips: Chip[];
  blockedKeywords: string[];
  blockedMessage: string;
  canSeeFinancials: boolean;
  canSeePersonnel: boolean;
  canSeeAnomalies: boolean;
  loadOzet: boolean;
}

type RoleName = 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'idari' | 'personel' | 'bekleyen';

const ROLES: { key: RoleName; label: string; icon: string; color: string }[] = [
  { key: 'yonetici',   label: 'Yönetici',   icon: '👑', color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30' },
  { key: 'ust-mudur',  label: 'Üst Müdür',  icon: '🎯', color: 'from-ta/20 to-ta/10 border-ta/30' },
  { key: 'mudur',      label: 'Müdür',       icon: '🏢', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30' },
  { key: 'operasyon',  label: 'Operasyon',   icon: '⚙️', color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30' },
  { key: 'idari',      label: 'İdari',       icon: '📋', color: 'from-green-500/20 to-green-600/10 border-green-500/30' },
  { key: 'personel',   label: 'Personel',    icon: '👤', color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30' },
  { key: 'bekleyen',   label: 'Bekleyen',    icon: '⏳', color: 'from-gray-500/20 to-gray-600/10 border-gray-500/30' },
];

// ─── Varsayılan config (fallback) ─────────────────────────────────────────────

const DEFAULT_CONFIG: Record<RoleName, SerializableRoleConfig> = {
  yonetici: {
    welcomeTemplate: 'Merhaba **{name}**! Ben Aspect AI. Tüm mekanların satış, kâr, stok ve personel verilerine erişimim var. Ne öğrenmek istersin?',
    chips: [
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '💰', label: 'Ciro & Kâr', q: 'Bugün toplam ciro ne kadar?' },
      { icon: '🏆', label: 'En İyi Mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
      { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
      { icon: '💳', label: 'Ödeme Dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
    ],
    blockedKeywords: [],
    blockedMessage: '',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: true,
    loadOzet: true,
  },
  'ust-mudur': {
    welcomeTemplate: 'Merhaba **{name}**! Ben Aspect AI. Operasyon geneli, mekan performansları ve anomali takibi için buradayım.',
    chips: [
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '🏆', label: 'En İyi Mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '💳', label: 'Ödeme Dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
    ],
    blockedKeywords: [],
    blockedMessage: '',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: true,
    loadOzet: true,
  },
  mudur: {
    welcomeTemplate: 'Merhaba **{name}**! Ben Aspect AI. Mekan yönetimi, stok takibi ve personel performansı konularında yardımcı olabilirim.',
    chips: [
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
    ],
    blockedKeywords: [],
    blockedMessage: '',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: true,
    loadOzet: true,
  },
  operasyon: {
    welcomeTemplate: 'Merhaba **{name}**! Ben Aspect AI. Saha koordinasyonu, stok durumu ve mekan anomalileri için buradayım.',
    chips: [
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
    ],
    blockedKeywords: ['kâr marjı', 'net kâr', 'brüt kâr'],
    blockedMessage: '🔒 Kâr/maliyet detaylarına erişim yetkiniz bulunmuyor.',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: true,
    loadOzet: true,
  },
  idari: {
    welcomeTemplate: 'Merhaba **{name}**! Ben Aspect AI. Ödeme dağılımları, ciro takibi ve personel verileri için buradayım.',
    chips: [
      { icon: '💳', label: 'Ödeme Dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
      { icon: '💰', label: 'Ciro & Kâr', q: 'Bugün toplam ciro ne kadar?' },
      { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
    ],
    blockedKeywords: [],
    blockedMessage: '',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: false,
    loadOzet: true,
  },
  personel: {
    welcomeTemplate: 'Merhaba **{name}**! Ben Aspect AI. Stok durumu, çekim teknikleri veya satış süreci hakkında sorularına yardımcı olabilirim!',
    chips: [
      { icon: '📦', label: 'Stok Sorgula', q: 'Stok durumu nedir?' },
      { icon: '📸', label: 'Çekim İpuçları', q: 'Portre çekim ipuçları ver' },
      { icon: '❓', label: 'Satış Kaydı', q: 'Nasıl satış kaydederim?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
    ],
    blockedKeywords: ['ciro', 'kâr', 'kar', 'kazandık', 'gelir', 'para', 'ödeme', 'nakit', 'kart', 'iban', 'döviz', 'anomali', 'özet', 'operasyon'],
    blockedMessage: '🔒 Bu bilgiye erişim yetkiniz bulunmuyor. Stok durumu, çekim ipuçları veya satış kayıt süreci hakkında yardımcı olabilirim!',
    canSeeFinancials: false,
    canSeePersonnel: false,
    canSeeAnomalies: false,
    loadOzet: false,
  },
  bekleyen: {
    welcomeTemplate: 'Merhaba **{name}**! Ben Aspect AI. Hesabın henüz onay aşamasında. Bu süreçte fotoğrafçılık ipuçları ve genel bilgiler için buradayım!',
    chips: [
      { icon: '📸', label: 'Çekim İpuçları', q: 'Portre çekim ipuçları ver' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '❓', label: 'Nasıl Başlarım?', q: 'Uygulamayı nasıl kullanabilirim?' },
    ],
    blockedKeywords: ['ciro', 'kâr', 'kar', 'satış', 'stok', 'mekan', 'anomali', 'personel', 'ödeme', 'gelir', 'operasyon', 'vardiya'],
    blockedMessage: '🔒 Hesabınız henüz onaylanmamış. Yönetici onayından sonra tüm özelliklere erişebilirsiniz.',
    canSeeFinancials: false,
    canSeePersonnel: false,
    canSeeAnomalies: false,
    loadOzet: false,
  },
};

// ─── Önerilen chip havuzu ──────────────────────────────────────────────────────
const CHIP_POOL: Chip[] = [
  { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
  { icon: '💰', label: 'Ciro & Kâr', q: 'Bugün toplam ciro ne kadar?' },
  { icon: '🏆', label: 'En İyi Mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
  { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
  { icon: '💳', label: 'Ödeme Dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
  { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
  { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
  { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
  { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
  { icon: '📸', label: 'Çekim İpuçları', q: 'Portre çekim ipuçları ver' },
  { icon: '❓', label: 'Satış Kaydı', q: 'Nasıl satış kaydederim?' },
  { icon: '📦', label: 'Stok Sorgula', q: 'Stok durumu nedir?' },
  { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AspectAISettingsProps {
  userRole: string;
  onBack: () => void;
  onSaved?: () => void;
}

// ─── Chip Editör ──────────────────────────────────────────────────────────────

function ChipEditor({
  chip,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  chip: Chip;
  index: number;
  total: number;
  onChange: (c: Chip) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="w-4 h-4 text-white/30 shrink-0" />
        <span className="text-base">{chip.icon}</span>
        <span className="text-sm text-white/80 flex-1 truncate">{chip.label}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5 text-white/60" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 text-white/60" />
          </button>
          <button
            onClick={() => setOpen(v => !v)}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5 text-ta" /> : <ChevronDown className="w-3.5 h-3.5 text-white/60" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-white/8 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="w-16">
              <label className="text-xs text-white/50 mb-1 block">İkon</label>
              <input
                value={chip.icon}
                onChange={e => onChange({ ...chip, icon: e.target.value })}
                className="w-full bg-white/8 border border-white/12 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-ta/60"
                maxLength={4}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-white/50 mb-1 block">Etiket</label>
              <input
                value={chip.label}
                onChange={e => onChange({ ...chip, label: e.target.value })}
                className="w-full bg-white/8 border border-white/12 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-ta/60"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Gönderilecek Soru / Komut</label>
            <input
              value={chip.q}
              onChange={e => onChange({ ...chip, q: e.target.value })}
              placeholder="örn: Bugün ciro ne kadar?"
              className="w-full bg-white/8 border border-white/12 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-ta/60"
            />
            {chip.q === '__MEKAN_DETAY_MODAL__' && (
              <p className="text-xs text-ta mt-1">⚡ Özel komut — Mekan Detay modalını açar</p>
            )}
            {chip.q === '__IZIN_GECMISIM__' && (
              <p className="text-xs text-indigo-400 mt-1">⚡ Özel komut — Kullanıcının son 30 gün izin & çalışma geçmişini çeker</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export function AspectAISettings({ userRole, onBack, onSaved }: AspectAISettingsProps) {
  const [selectedRole, setSelectedRole] = useState<RoleName>('personel');
  const [config, setConfig] = useState<Record<RoleName, SerializableRoleConfig>>(
    JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [showChipPool, setShowChipPool] = useState(false);
  const [previewName] = useState('Ahmet');

  const canEdit = userRole === 'yonetici';

  // Kayıtlı config'i yükle
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE}/ai/role-config`, { headers });
        const data = await res.json();
        if (data.config && typeof data.config === 'object') {
          // Varsayılanları koru, server'dan gelenleri merge et
          const merged = { ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), ...data.config };
          setConfig(merged);
        }
      } catch (e) {
        console.error('AI config yüklenemedi:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ai/role-config`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('ok', 'Ayarlar kaydedildi!');
        onSaved?.();
      } else {
        showToast('err', data.error || 'Kayıt başarısız.');
      }
    } catch (e) {
      showToast('err', `Bağlantı hatası: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
    showToast('ok', 'Tüm roller varsayılana sıfırlandı.');
  };

  const cur = config[selectedRole];
  const setCur = useCallback((partial: Partial<SerializableRoleConfig>) => {
    setConfig(prev => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], ...partial },
    }));
  }, [selectedRole]);

  // Chip işlemleri
  const updateChip = (i: number, chip: Chip) => {
    const chips = [...cur.chips];
    chips[i] = chip;
    setCur({ chips });
  };
  const deleteChip = (i: number) => {
    const chips = cur.chips.filter((_, idx) => idx !== i);
    setCur({ chips });
  };
  const moveChip = (i: number, dir: 'up' | 'down') => {
    const chips = [...cur.chips];
    const target = dir === 'up' ? i - 1 : i + 1;
    if (target < 0 || target >= chips.length) return;
    [chips[i], chips[target]] = [chips[target], chips[i]];
    setCur({ chips });
  };
  const addChipFromPool = (chip: Chip) => {
    setCur({ chips: [...cur.chips, { ...chip }] });
    setShowChipPool(false);
  };
  const addBlankChip = () => {
    setCur({ chips: [...cur.chips, { icon: '✨', label: 'Yeni Kestirme', q: '' }] });
  };

  // Keyword işlemleri
  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    setCur({ blockedKeywords: [...cur.blockedKeywords, newKeyword.trim().toLowerCase()] });
    setNewKeyword('');
  };
  const removeKeyword = (i: number) => {
    setCur({ blockedKeywords: cur.blockedKeywords.filter((_, idx) => idx !== i) });
  };

  // Karşılama önizleme
  const previewWelcome = cur.welcomeTemplate.replace('{name}', previewName);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-ta animate-spin" />
          <p className="text-white/60 text-sm">Ayarlar yükleniyor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/40 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/70" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-ta to-indigo-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Aspect AI Ayarları</h1>
            <p className="text-xs text-white/50">Rol bazlı yapılandırma</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 border border-white/12 text-white/60 text-xs hover:bg-white/12 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Sıfırla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ta/80 text-white text-xs hover:bg-ta transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Kaydet
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg transition-all
          ${toast.type === 'ok' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
          {toast.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Sadece okuma uyarısı */}
      {!canEdit && (
        <div className="mx-4 mt-4 flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200">Bu ayarları sadece <strong>Yönetici</strong> değiştirebilir. Salt okunur moddasın.</p>
        </div>
      )}

      <div className="px-4 mt-4 flex flex-col gap-4">

        {/* Rol Seçimi */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wider px-1">Rol Seç</p>
          <div className="grid grid-cols-4 gap-2">
            {ROLES.map(r => (
              <button
                key={r.key}
                onClick={() => setSelectedRole(r.key)}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all
                  ${selectedRole === r.key
                    ? `bg-gradient-to-b ${r.color} border-current scale-[1.03] shadow-lg`
                    : 'bg-white/5 border-white/10 hover:bg-white/8'}`}
              >
                <span className="text-xl">{r.icon}</span>
                <span className={`text-[10px] font-medium leading-tight text-center
                  ${selectedRole === r.key ? 'text-white' : 'text-white/50'}`}>
                  {r.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Seçili Rol Detay */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{ROLES.find(r => r.key === selectedRole)?.icon}</span>
            <h2 className="text-base font-semibold text-white">{ROLES.find(r => r.key === selectedRole)?.label}</h2>
          </div>

          {/* ── ERİŞİM HAKLARI ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Erişim Hakları</p>

            {[
              { flag: 'loadOzet' as const, icon: BarChart2, label: 'Brifing Paneli & Günlük Özet', desc: 'AI brifing kartı ve KV\'den günlük veri yüklenir' },
              { flag: 'canSeeFinancials' as const, icon: BarChart2, label: 'Finansal Veriler', desc: 'Ciro, kâr, ödeme dağılımı sorgularına erişim' },
              { flag: 'canSeePersonnel' as const, icon: Users, label: 'Personel Verileri', desc: 'Personel sıralaması ve performans verileri' },
              { flag: 'canSeeAnomalies' as const, icon: AlertTriangle, label: 'Anomali Verileri', desc: 'Stok uyumsuzlukları ve uyarılar' },
            ].map(({ flag, icon: Icon, label, desc }) => (
              <div key={flag} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                  ${cur[flag] ? 'bg-emerald-500/20' : 'bg-white/8'}`}>
                  <Icon className={`w-4 h-4 ${cur[flag] ? 'text-emerald-400' : 'text-white/30'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium">{label}</p>
                  <p className="text-xs text-white/40 truncate">{desc}</p>
                </div>
                <button
                  disabled={!canEdit}
                  onClick={() => setCur({ [flag]: !cur[flag] })}
                  className={`relative w-11 h-6 rounded-full transition-all duration-200 shrink-0
                    ${cur[flag] ? 'bg-emerald-500' : 'bg-white/15'}
                    ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200
                    ${cur[flag] ? 'left-5.5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          {/* ── KARŞILAMA MESAJI ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-ta" />
              <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Karşılama Mesajı</p>
            </div>
            <textarea
              value={cur.welcomeTemplate}
              onChange={e => setCur({ welcomeTemplate: e.target.value })}
              disabled={!canEdit}
              rows={3}
              placeholder="Merhaba **{name}**! Ben Aspect AI..."
              className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-ta/60 disabled:opacity-50"
            />
            <div className="flex items-start gap-2 px-3 py-2.5 bg-ta/10 border border-ta/20 rounded-xl">
              <Eye className="w-4 h-4 text-ta mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-ta font-medium mb-1">Önizleme</p>
                <p className="text-xs text-white/70 leading-relaxed">{previewWelcome}</p>
              </div>
            </div>
            <p className="text-xs text-white/35">
              <code className="bg-white/10 px-1 py-0.5 rounded">{'{name}'}</code> → kullanıcının adına dönüşür.
              &nbsp;<code className="bg-white/10 px-1 py-0.5 rounded">**metin**</code> → <strong>kalın</strong> görünür.
            </p>
          </div>

          {/* ── KESTİRMELER (CHIPS) ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Kestirmeler</p>
                <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{cur.chips.length}</span>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowChipPool(v => !v)}
                    className="flex items-center gap-1 text-xs text-ta hover:text-ta transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Havuzdan ekle
                  </button>
                  <span className="text-white/20">|</span>
                  <button
                    onClick={addBlankChip}
                    className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Boş
                  </button>
                </div>
              )}
            </div>

            {/* Chip Havuzu */}
            {showChipPool && (
              <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                <p className="text-xs text-white/50 mb-1">Eklemek istediğin kestirmeye dokun:</p>
                <div className="flex flex-wrap gap-2">
                  {CHIP_POOL.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => addChipFromPool(c)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/8 border border-white/12 rounded-xl text-xs text-white/70 hover:bg-ta/20 hover:border-ta/30 transition-all"
                    >
                      <span>{c.icon}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cur.chips.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-3">Henüz kestirme yok</p>
            ) : (
              <div className="flex flex-col gap-2">
                {cur.chips.map((chip, i) => (
                  <ChipEditor
                    key={i}
                    chip={chip}
                    index={i}
                    total={cur.chips.length}
                    onChange={c => updateChip(i, c)}
                    onDelete={() => deleteChip(i)}
                    onMoveUp={() => moveChip(i, 'up')}
                    onMoveDown={() => moveChip(i, 'down')}
                  />
                ))}
              </div>
            )}

            {/* Canlı önizleme */}
            {cur.chips.length > 0 && (
              <div className="mt-1">
                <p className="text-xs text-white/30 mb-2">Kullanıcının göreceği:</p>
                <div className="flex flex-wrap gap-1.5">
                  {cur.chips.map((c, i) => (
                    <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-white/8 border border-white/12 rounded-full text-xs text-white/70">
                      <span>{c.icon}</span>
                      <span>{c.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── ENGELLİ KELIMELER ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldOff className="w-4 h-4 text-red-400" />
              <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Engellenen Sorgular</p>
            </div>
            <p className="text-xs text-white/40">Bu kelimelerden herhangi birini içeren sorular engellenir ve aşağıdaki mesaj gösterilir.</p>

            {cur.blockedKeywords.length === 0 ? (
              <p className="text-xs text-white/30 italic">Engellenen kelime yok — tüm sorgulara yanıt verilir</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cur.blockedKeywords.map((kw, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-300">
                    {kw}
                    {canEdit && (
                      <button onClick={() => removeKeyword(i)} className="hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2">
                <input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addKeyword()}
                  placeholder="kelime ekle… (Enter)"
                  className="flex-1 bg-white/8 border border-white/12 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/40"
                />
                <button
                  onClick={addKeyword}
                  className="px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl text-sm hover:bg-red-500/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Engel mesajı */}
            <div className="mt-1">
              <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Engel Mesajı
              </label>
              <input
                value={cur.blockedMessage}
                onChange={e => setCur({ blockedMessage: e.target.value })}
                disabled={!canEdit}
                placeholder="🔒 Bu bilgiye erişim yetkiniz yok..."
                className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-ta/60 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}