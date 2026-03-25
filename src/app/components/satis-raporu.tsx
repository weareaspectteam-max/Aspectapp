import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, TrendingUp, ShoppingBag,
  Users, MapPin, BarChart3, CreditCard, ChevronDown, Calendar,
} from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { buildHeaders, getToken, appendGhostParam } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/* ── Glass stil ── */
const glass: React.CSSProperties = {
  background: 'rgba(10,5,30,0.72)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 16,
};

const COLORS = {
  violet:  '#a855f7',
  emerald: '#34d399',
  orange:  '#fb923c',
  blue:    '#60a5fa',
  pink:    '#f472b6',
  yellow:  '#fbbf24',
  teal:    '#2dd4bf',
};

/* ── Tarih yardımcıları ── */
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

type FilterKey = 'bugun' | 'bu-hafta' | 'bu-ay' | 'son-3-ay' | 'bu-yil' | 'ozel';

function getRange(key: FilterKey, customStart: string, customEnd: string): { baslangic: string; bitis: string } {
  const now = new Date();
  switch (key) {
    case 'bugun': {
      const t = formatDate(now);
      return { baslangic: t, bitis: t };
    }
    case 'bu-hafta': {
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((day + 6) % 7));
      return { baslangic: formatDate(mon), bitis: formatDate(now) };
    }
    case 'bu-ay': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { baslangic: formatDate(start), bitis: formatDate(now) };
    }
    case 'son-3-ay': {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      return { baslangic: formatDate(start), bitis: formatDate(now) };
    }
    case 'bu-yil': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { baslangic: formatDate(start), bitis: formatDate(now) };
    }
    case 'ozel':
      return { baslangic: customStart, bitis: customEnd };
  }
}

interface SatisRaporuProps {
  userName: string;
  userRole: string;
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface Mekan { id: string; name: string; emoji: string; color: string; ciro: number; satisAdet: number; iskonto: number; }
interface Personel { id: string; name: string; ciro: number; satisAdet: number; iskonto: number; }
interface Album { tip: string; adet: number; ciro: number; }
interface Odeme { yontem: string; adet: number; ciro: number; }

interface RaporData {
  toplamCiro: number;
  toplamSatisAdet: number;
  toplamIskonto: number;
  mekanlar: Mekan[];
  personeller: Personel[];
  albumler: Album[];
  odemeler: Odeme[];
}

/* ── Küçük özet kart ── */
function SummaryCard({ title, value, sub, icon, color }: {
  title: string; value: string; sub?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div style={{ ...glass, padding: 14, boxShadow: `0 4px 20px ${color}15`, border: `1px solid ${color}25` }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: `${color}20`, border: `1px solid ${color}40` }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <p className="text-[11px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{title}</p>
      <p className="text-lg font-black text-white leading-none">{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}
    </div>
  );
}

/* ── Bölüm başlığı ── */
function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4">
      <span className="text-base">{emoji}</span>
      <p className="text-sm font-black text-white">{title}</p>
    </div>
  );
}

/* ── Yüzde çubuğu satırı ── */
function BarRow({ label, value, max, color, right }: {
  label: string; value: number; max: number; color: string; right: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold shrink-0 w-28 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold shrink-0 text-right" style={{ color, minWidth: 72 }}>{right}</span>
    </div>
  );
}

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'bugun',    label: 'Bugün'     },
  { key: 'bu-hafta', label: 'Bu Hafta'  },
  { key: 'bu-ay',    label: 'Bu Ay'     },
  { key: 'son-3-ay', label: 'Son 3 Ay'  },
  { key: 'bu-yil',   label: 'Bu Yıl'    },
  { key: 'ozel',     label: 'Özel Tarih'},
];

const ODEME_LABEL: Record<string, string> = {
  card: '💳 Kart',
  cash: '💵 Nakit',
  transfer: '🏦 Havale',
  foreign: '💱 Döviz',
};

export function SatisRaporu({ onNavigate, accessToken }: SatisRaporuProps) {
  const [filterKey, setFilterKey]       = useState<FilterKey>('bu-ay');
  const [customStart, setCustomStart]   = useState('');
  const [customEnd, setCustomEnd]       = useState('');
  const [mekanlar, setMekanlar]         = useState<Mekan[]>([]);
  const [selectedMekan, setSelectedMekan] = useState('');
  const [loading, setLoading]           = useState(false);
  const [data, setData]                 = useState<RaporData | null>(null);
  const [error, setError]               = useState('');
  const [activeTab, setActiveTab]       = useState<'mekan' | 'personel' | 'album' | 'odeme'>('mekan');
  const [showMekanDrop, setShowMekanDrop] = useState(false);

  /* Mevcut mekanları yükle */
  useEffect(() => {
    (async () => {
      try {
        const token = accessToken || await getToken();
        const h = buildHeaders(token);
        const res = await fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers: h });
        if (res.ok) {
          const d = await res.json();
          setMekanlar(d.mekanlar || []);
        }
      } catch {}
    })();
  }, [accessToken]);

  const fetchRapor = useCallback(async () => {
    const { baslangic, bitis } = getRange(filterKey, customStart, customEnd);
    if (!baslangic || !bitis) return;

    setLoading(true);
    setError('');
    try {
      const token = accessToken || await getToken();
      const h = buildHeaders(token);
      let url = `${API_BASE}/isletme/satis-raporu?baslangic=${baslangic}&bitis=${bitis}`;
      if (selectedMekan) url += `&mekanId=${selectedMekan}`;
      const res = await fetch(url, { headers: h });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Veri alınamadı.'); return; }
      setData(json);
    } catch (err) {
      setError(`Bağlantı hatası: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [filterKey, customStart, customEnd, selectedMekan, accessToken]);

  useEffect(() => { fetchRapor(); }, [fetchRapor]);

  const avgSale = data && data.toplamSatisAdet > 0
    ? Math.round(data.toplamCiro / data.toplamSatisAdet)
    : 0;

  const topAlbum = data?.albumler[0]?.tip || '—';
  const { baslangic, bitis } = getRange(filterKey, customStart, customEnd);
  const selectedMekanName = mekanlar.find(m => m.id === selectedMekan)?.name || 'Tüm Mekanlar';

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => onNavigate('isletme-istatistikleri')}
            className="p-2 rounded-xl active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">Satış İstatistikleri</h1>
              <span className="text-lg">📈</span>
            </div>
            <p className="text-[10px] font-medium" style={{ color: 'rgba(196,181,253,0.5)' }}>
              Ciro · Personel · Albüm kırılımı
            </p>
          </div>
          <button onClick={fetchRapor} disabled={loading}
            className="p-2 rounded-xl active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {loading
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <RefreshCw className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      <div className="px-4 space-y-3">

        {/* ── Tarih Filtresi ── */}
        <div style={glass} className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5" style={{ color: COLORS.violet }} />
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>Tarih Aralığı</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map(opt => (
              <button key={opt.key}
                onClick={() => setFilterKey(opt.key)}
                className="px-3 py-1 rounded-lg text-xs font-bold transition-all active:scale-95"
                style={{
                  background: filterKey === opt.key ? COLORS.violet : 'rgba(255,255,255,0.06)',
                  color: filterKey === opt.key ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${filterKey === opt.key ? COLORS.violet : 'rgba(255,255,255,0.08)'}`,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          {filterKey === 'ozel' && (
            <div className="flex gap-2 mt-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="flex-1 text-xs rounded-lg px-2 py-1.5 text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
              <span className="text-white text-xs self-center">–</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="flex-1 text-xs rounded-lg px-2 py-1.5 text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
            </div>
          )}
          {/* Aktif aralık etiketi */}
          {baslangic && bitis && (
            <p className="text-[10px] mt-2" style={{ color: 'rgba(196,181,253,0.5)' }}>
              📅 {baslangic} — {bitis}
            </p>
          )}
        </div>

        {/* ── Mekan Filtresi ── */}
        <div className="relative">
          <button onClick={() => setShowMekanDrop(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: COLORS.orange }} />
              <span className="text-sm font-semibold text-white">{selectedMekanName}</span>
            </div>
            <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)', transform: showMekanDrop ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showMekanDrop && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: 'rgba(15,8,40,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {[{ id: '', name: 'Tüm Mekanlar', emoji: '🌍' }, ...mekanlar].map(m => (
                <button key={m.id}
                  onClick={() => { setSelectedMekan(m.id); setShowMekanDrop(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left active:scale-95 transition-all"
                  style={{ background: selectedMekan === m.id ? 'rgba(168,85,247,0.15)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-sm">{m.emoji}</span>
                  <span className="text-sm font-semibold" style={{ color: selectedMekan === m.id ? COLORS.violet : 'rgba(255,255,255,0.7)' }}>{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Hata ── */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.3)', color: '#fb7185' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Yükleniyor ── */}
        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: COLORS.violet }} />
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Veriler yükleniyor…</p>
            </div>
          </div>
        )}

        {/* ── Veri yok ── */}
        {!loading && data && data.toplamSatisAdet === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-5xl">📭</span>
            <p className="text-sm font-bold text-white">Bu aralıkta satış bulunamadı</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Farklı bir tarih aralığı veya mekan seçin</p>
          </div>
        )}

        {/* ── Özet Kartlar ── */}
        {data && data.toplamSatisAdet > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <SummaryCard
                title="Toplam Ciro"
                value={`₺${data.toplamCiro.toLocaleString('tr-TR')}`}
                sub={`${data.toplamSatisAdet} satış`}
                icon={<TrendingUp className="w-4 h-4" />}
                color={COLORS.emerald}
              />
              <SummaryCard
                title="Toplam Satış"
                value={data.toplamSatisAdet.toString()}
                sub={`₺${avgSale.toLocaleString('tr-TR')} ort.`}
                icon={<ShoppingBag className="w-4 h-4" />}
                color={COLORS.blue}
              />
              <SummaryCard
                title="Toplam İskonto"
                value={`₺${data.toplamIskonto.toLocaleString('tr-TR')}`}
                sub={`Cironun %${data.toplamCiro > 0 ? Math.round(data.toplamIskonto / (data.toplamCiro + data.toplamIskonto) * 100) : 0}'i`}
                icon={<BarChart3 className="w-4 h-4" />}
                color={COLORS.orange}
              />
              <SummaryCard
                title="En Çok Satan"
                value={topAlbum}
                sub={`${data.albumler[0]?.adet || 0} adet`}
                icon={<ShoppingBag className="w-4 h-4" />}
                color={COLORS.pink}
              />
            </div>

            {/* ── Sekme Seçici ── */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {([
                { key: 'mekan',    label: '📍 Mekan',    count: data.mekanlar.length },
                { key: 'personel', label: '👤 Personel', count: data.personeller.length },
                { key: 'album',    label: '📘 Albüm',    count: data.albumler.length },
                { key: 'odeme',    label: '💳 Ödeme',    count: data.odemeler.length },
              ] as const).map(tab => (
                <button key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                  style={{
                    background: activeTab === tab.key ? COLORS.violet : 'rgba(255,255,255,0.06)',
                    color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${activeTab === tab.key ? COLORS.violet : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {tab.label} <span className="opacity-60 ml-0.5">({tab.count})</span>
                </button>
              ))}
            </div>

            {/* ── MEKAN Kırılımı ── */}
            {activeTab === 'mekan' && (
              <div style={{ ...glass, padding: 16 }}>
                <SectionTitle emoji="📍" title="Mekan Bazlı Ciro" />
                <div className="space-y-3">
                  {data.mekanlar.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Veri yok</p>
                  )}
                  {data.mekanlar.map(m => (
                    <div key={m.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{m.emoji}</span>
                          <span className="text-xs font-bold text-white">{m.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black" style={{ color: COLORS.emerald }}>₺{m.ciro.toLocaleString('tr-TR')}</span>
                          <span className="text-[10px] ml-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.satisAdet} satış</span>
                        </div>
                      </div>
                      <BarRow
                        label=""
                        value={m.ciro}
                        max={data.mekanlar[0]?.ciro || 1}
                        color={m.color || COLORS.violet}
                        right=""
                      />
                    </div>
                  ))}
                </div>
                {/* Toplam */}
                <div className="flex justify-between items-center mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Toplam</span>
                  <span className="text-sm font-black" style={{ color: COLORS.emerald }}>₺{data.toplamCiro.toLocaleString('tr-TR')}</span>
                </div>
              </div>
            )}

            {/* ── PERSONEL Kırılımı ── */}
            {activeTab === 'personel' && (
              <div style={{ ...glass, padding: 16 }}>
                <SectionTitle emoji="👤" title="Personel Bazlı Performans" />
                <div className="space-y-3">
                  {data.personeller.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Veri yok</p>
                  )}
                  {data.personeller.map((p, i) => {
                    const rankColors = [COLORS.yellow, 'rgba(192,192,192,0.9)', '#cd7f32'];
                    const rc = rankColors[i] || 'rgba(255,255,255,0.2)';
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center justify-center text-xs font-black shrink-0"
                          style={{ width: 26, height: 26, borderRadius: 8, background: `${rc}20`, border: `1px solid ${rc}50`, color: rc }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{p.name}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.satisAdet} satış · İsk: ₺{p.iskonto.toLocaleString('tr-TR')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black" style={{ color: COLORS.emerald }}>₺{p.ciro.toLocaleString('tr-TR')}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            %{data.toplamCiro > 0 ? Math.round((p.ciro / data.toplamCiro) * 100) : 0}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ALBÜM Kırılımı ── */}
            {activeTab === 'album' && (
              <div style={{ ...glass, padding: 16 }}>
                <SectionTitle emoji="📘" title="Albüm Tipi Bazlı Satış" />
                <div className="space-y-2.5">
                  {data.albumler.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Veri yok</p>
                  )}
                  {data.albumler.map((a, i) => {
                    const colors = [COLORS.blue, COLORS.emerald, COLORS.orange, COLORS.pink, COLORS.violet, COLORS.yellow, COLORS.teal];
                    const c = colors[i % colors.length];
                    return (
                      <div key={a.tip}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{a.tip}</span>
                          <div className="text-right">
                            <span className="text-xs font-black" style={{ color: c }}>{a.adet} adet</span>
                            {a.ciro > 0 && <span className="text-[10px] ml-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>₺{a.ciro.toLocaleString('tr-TR')}</span>}
                          </div>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.round((a.adet / (data.albumler[0]?.adet || 1)) * 100)}%`, background: c }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Toplam Albüm</span>
                  <span className="text-sm font-black text-white">{data.albumler.reduce((s, a) => s + a.adet, 0)} adet</span>
                </div>
              </div>
            )}

            {/* ── ÖDEME Kırılımı ── */}
            {activeTab === 'odeme' && (
              <div style={{ ...glass, padding: 16 }}>
                <SectionTitle emoji="💳" title="Ödeme Yöntemi Kırılımı" />
                <div className="space-y-2.5">
                  {data.odemeler.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Veri yok</p>
                  )}
                  {data.odemeler.map(o => (
                    <div key={o.yontem} className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div>
                        <p className="text-sm font-bold text-white">{ODEME_LABEL[o.yontem] || o.yontem}</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{o.adet} işlem</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black" style={{ color: COLORS.teal }}>₺{o.ciro.toLocaleString('tr-TR')}</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          %{data.toplamCiro > 0 ? Math.round((o.ciro / data.toplamCiro) * 100) : 0}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}