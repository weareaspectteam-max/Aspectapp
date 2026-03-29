import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp, DollarSign, Package, BarChart3,
  BarChart2, AlertTriangle, MapPin, FileText,
  Camera, RefreshCw, ShoppingBag, Clock, ChevronRight,
  Star, Activity, Zap, Users, Settings as SettingsIcon, AlertCircle,
  Trophy,
} from 'lucide-react';
import { StaffPerformanceList } from './staff-performance-list';
import { CurrencyWidget } from './currency-widget';
import { getToken, buildHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface AdminDashboardProps {
  userName: string;
  userRole: string;
  accessToken?: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface MekanDurum {
  id: string;
  name: string;
  emoji: string;
  color: string;
  satisAdet: number;
  ciro: number;
  kare: number;
  acilisZamani: string;
  kotaKademeleri?: { hedef: number; primTek: number; primCoklu: number }[];
}

interface DashboardData {
  tarih: string;
  toplamCiro: number;
  toplamAdet: number;
  toplamKare: number;
  anomaliSayisi: number;
  aktifMekanSayisi: number;
  toplamMekanSayisi: number;
  aktifMekanlar: MekanDurum[];
  saatlikData: { saat: string; adet: number; ciro: number }[];
  albumDagilimi: { tip: string; adet: number }[];
  mekanCiroList: { id: string; name: string; emoji: string; color: string; ciro: number; adet: number }[];
  personelPerformans: { id: string; name: string; ciro: number; satisAdet: number; mekan: string }[];
}

interface ChartPoint {
  saat: string;
  adet: number;
  ciro: number;
  _idx: number;
  ciroNorm: number;
}

function formatTL(val: number): string {
  if (val >= 1_000_000) return `₺${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `₺${(val / 1_000).toFixed(1)}B`;
  return `₺${val.toLocaleString('tr-TR')}`;
}

const glass: React.CSSProperties = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         20,
};

const COLORS = {
  violet:  '#a855f7',
  emerald: '#34d399',
  orange:  '#fb923c',
  blue:    '#60a5fa',
  pink:    '#f472b6',
  yellow:  '#fbbf24',
  fuchsia: '#e879f9',
  red:     '#f87171',
};

const ALBUM_COLORS = [
  COLORS.blue, COLORS.emerald, COLORS.orange, COLORS.pink,
  COLORS.violet, COLORS.yellow, COLORS.fuchsia,
];

const QUICK_ACTIONS = [
  { label: 'Vardiya Raporları',  icon: FileText,      color: '#ffd4a3', tab: 'vardiya-raporlari'    },
  { label: 'Satış İstatistik', icon: BarChart2,     color: '#9dd9ea', tab: 'satis-raporu'         },
  { label: 'Anomali İstatistik', icon: AlertTriangle, color: '#f87171', tab: 'anomali-panosu'       },
  { label: 'Vardiya İstatistik', icon: Clock,         color: '#a8e6cf', tab: 'vardiya-istatistikleri' },
  { label: 'İndirim İstatistik', icon: Star,          color: '#c4b5fd', tab: 'indirim-istatistik'   },
  { label: 'Yön. Raporları',     icon: TrendingUp,    color: '#fb923c', tab: 'manager-reports'      },
  { label: 'Hakediş Takip',      icon: Trophy,        color: '#fbbf24', tab: 'prim-takip'           },
];

// ── Custom SVG Chart — Recharts kaldırıldı (iç SVG key çakışması) ──
function SaatlikChart({ data }: { data: ChartPoint[] }) {
  const [tooltip, setTooltip] = useState<{ idx: number; item: ChartPoint } | null>(null);

  const VW = 320;
  const VH = 140;
  const PL = 28;
  const PR = 6;
  const PT = 6;
  const PB = 22;
  const cW = VW - PL - PR;
  const cH = VH - PT - PB;

  const n = data.length;
  if (n === 0) return null;

  const maxAdet = Math.max(...data.map(d => d.adet), 1);
  const maxCiro = Math.max(...data.map(d => d.ciro), 1);

  const slotW = cW / n;
  const bW = Math.max(slotW * 0.32, 1);

  const toX = (i: number) => PL + i * slotW + slotW / 2;
  const toYadet = (v: number) => PT + cH - (v / maxAdet) * cH;
  const toYciro = (v: number) => PT + cH - (v / maxCiro) * cH;

  const yTicks = [0, Math.round(maxAdet / 2), maxAdet];
  const labelSet = new Set<number>([0, n - 1]);
  if (n > 5) labelSet.add(Math.round(n / 2));

  const tooltipItem = tooltip ? data[tooltip.idx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick, ti) => {
          const y = toYadet(tick);
          return (
            <line
              key={`g${ti}`}
              x1={PL} y1={y} x2={VW - PR} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3"
            />
          );
        })}

        {/* Y-axis tick labels */}
        {yTicks.map((tick, ti) => (
          <text
            key={`yt${ti}`}
            x={PL - 3}
            y={toYadet(tick) + 3}
            textAnchor="end"
            fontSize={8}
            fill="rgba(167,139,250,0.7)"
          >{tick}</text>
        ))}

        {/* Bars: adet (violet, left) */}
        {data.map((d, i) => {
          const bh = Math.max((d.adet / maxAdet) * cH, d.adet > 0 ? 2 : 0);
          const x = toX(i) - bW - 0.5;
          const y = PT + cH - bh;
          return (
            <rect
              key={`va${i}`}
              x={x} y={y} width={bW} height={bh}
              fill="rgba(168,85,247,0.5)"
              stroke="rgba(168,85,247,0.85)"
              strokeWidth={0.5}
              rx={2}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setTooltip({ idx: i, item: d })}
            />
          );
        })}

        {/* Bars: ciro (emerald, right) */}
        {data.map((d, i) => {
          const bh = Math.max((d.ciro / maxCiro) * cH, d.ciro > 0 ? 2 : 0);
          const x = toX(i) + 0.5;
          const y = PT + cH - bh;
          return (
            <rect
              key={`vc${i}`}
              x={x} y={y} width={bW} height={bh}
              fill="rgba(52,211,153,0.4)"
              stroke="rgba(52,211,153,0.75)"
              strokeWidth={0.5}
              rx={2}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setTooltip({ idx: i, item: d })}
            />
          );
        })}

        {/* X-axis base line */}
        <line
          x1={PL} y1={PT + cH} x2={VW - PR} y2={PT + cH}
          stroke="rgba(255,255,255,0.08)"
        />

        {/* X-axis tick labels */}
        {data.map((d, i) => {
          if (!labelSet.has(i)) return null;
          return (
            <text
              key={`xl${i}`}
              x={toX(i)}
              y={VH - 5}
              textAnchor="middle"
              fontSize={8}
              fill="rgba(255,255,255,0.35)"
            >{d.saat}</text>
          );
        })}

        {/* Hover crosshair */}
        {tooltip && (
          <line
            x1={toX(tooltip.idx)} y1={PT}
            x2={toX(tooltip.idx)} y2={PT + cH}
            stroke="rgba(255,255,255,0.12)"
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Tooltip overlay */}
      {tooltip && tooltipItem && (
        <div style={{
          position: 'absolute',
          left: `clamp(8px, calc(${(toX(tooltip.idx) / VW) * 100}% - 54px), calc(100% - 112px))`,
          top: 0,
          background: 'rgba(8,4,24,0.96)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 10,
          padding: '7px 11px',
          pointerEvents: 'none',
          zIndex: 20,
          minWidth: 108,
        }}>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 5, fontWeight: 600 }}>
            {tooltipItem.saat}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#a855f7' }} />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Satış:</span>
            <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{tooltipItem.adet}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Ciro:</span>
            <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>₺{tooltipItem.ciro.toLocaleString('tr-TR')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminDashboard({ userName, userRole, accessToken, onNavigate }: AdminDashboardProps) {
  const [data, setData]         = useState<DashboardData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showPerformanceList, setShowPerformanceList] = useState(false);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      // Token al — yoksa kısa bekleme + retry
      let finalToken = accessToken || await getToken();
      if (!finalToken) {
        await new Promise(r => setTimeout(r, 1500));
        finalToken = await getToken();
        if (!finalToken) throw new Error('Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın.');
      }

      // Retry mantığı: en fazla 3 deneme, 1s / 2s bekleme
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (signal?.aborted) return; // Bileşen unmount oldu, dur
        if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 1000));
        try {
          const res = await fetch(`${API_BASE}/manager/dashboard-summary${ghostParams()}`, {
            headers: buildHeaders(finalToken),
            signal,
          });
          if (signal?.aborted) return;
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || `Sunucu hatası (${res.status})`);
          setData(json);
          setLastRefresh(new Date());
          setError(null);
          return; // Başarılı
        } catch (e: any) {
          if (e?.name === 'AbortError') return; // İptal — hata gösterme
          lastErr = e;
        }
      }
      throw lastErr ?? new Error('Veri alınamadı');
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // İptal — hata gösterme
      console.error('AdminDashboard fetch error:', err);
      setError(err.message || 'Veri alınamadı');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 120_000);
    return () => {
      controller.abort(); // Unmount veya dep değişimi → uçuşta olan isteği iptal et
      clearInterval(interval);
    };
  }, [fetchData]);

  const isLoading  = loading && !data;
  const roleLabel  = userRole === 'yonetici' ? 'Yönetici' : userRole === 'ust-mudur' ? 'Üst Müdür' : 'Müdür';
  const anomali    = data?.anomaliSayisi ?? 0;
  const hasAnomali = anomali > 0;
  const totalAlbums = (data?.albumDagilimi || []).reduce((s, i) => s + i.adet, 0);

  const saatlikData = (data?.saatlikData ?? []).reduce<{ saat: string; adet: number; ciro: number }[]>(
    (acc, item) => {
      const existing = acc.find(x => x.saat === item.saat);
      if (existing) { existing.adet += item.adet; existing.ciro += item.ciro; }
      else acc.push({ ...item });
      return acc;
    },
    [],
  );

  const maxAdet = Math.max(...saatlikData.map(d => d.adet), 1);
  const maxCiro = Math.max(...saatlikData.map(d => d.ciro), 1);
  const chartData: ChartPoint[] = saatlikData.map((item, idx) => ({
    ...item,
    _idx: idx,
    ciroNorm: (item.ciro / maxCiro) * maxAdet,
  }));

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      <div className="px-4 pt-4 space-y-4">

        {/* ── Başlık ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-2xl font-black text-white">Genel Durum</h1>
                <span className="text-xl">📊</span>
              </div>
              <p className="text-xs font-medium" style={{ color: 'rgba(196,181,253,0.5)' }}>
                {userName} · {roleLabel} · {new Date().toLocaleDateString('tr-TR')}
              </p>
            </div>
            <button
              onClick={() => fetchData()}
              disabled={loading}
              style={{ ...glass, padding: 10, borderRadius: 14 }}
            >
              <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Son güncelleme: {lastRefresh.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </motion.div>

        {/* ── Hata ── */}
        {error && (
          <div style={{ ...glass, padding: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)' }}>
            <p className="text-red-300 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* ══════════════════════════════════
            1. DASHBOARD KARTLARI
            ══════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3"
        >
          {/* Günlük Ciro */}
          <div style={{ ...glass, padding: 16, border: '1px solid rgba(52,211,153,0.25)', boxShadow: '0 4px 24px rgba(52,211,153,0.08)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <DollarSign className="w-5 h-5" style={{ color: COLORS.emerald }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Günlük Ciro</p>
            {isLoading ? <div className="h-6 w-20 rounded-lg bg-white/10 animate-pulse" />
              : <p className="text-xl font-black text-white leading-none">{formatTL(data?.toplamCiro ?? 0)}</p>}
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{data?.toplamAdet ?? 0} ürün satıldı</p>
          </div>

          {/* Aktif Mekan */}
          <button
            onClick={() => onNavigate('isletme-genel-durum')}
            className="w-full text-left transition-all active:scale-95"
            style={{ ...glass, padding: 16, border: '1px solid rgba(168,230,207,0.25)', boxShadow: '0 4px 24px rgba(168,230,207,0.08)' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(168,230,207,0.15)', border: '1px solid rgba(168,230,207,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <MapPin className="w-5 h-5" style={{ color: '#a8e6cf' }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Aktif Mekan</p>
            {isLoading ? <div className="h-6 w-12 rounded-lg bg-white/10 animate-pulse" />
              : <p className="text-xl font-black text-white leading-none">{data?.aktifMekanSayisi ?? 0}</p>}
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>/ {data?.toplamMekanSayisi ?? 0} toplam</p>
          </button>

          {/* Fotoğraf Karesi */}
          <div style={{ ...glass, padding: 16, border: '1px solid rgba(196,181,253,0.25)', boxShadow: '0 4px 24px rgba(196,181,253,0.08)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(196,181,253,0.15)', border: '1px solid rgba(196,181,253,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Camera className="w-5 h-5" style={{ color: '#c4b5fd' }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Fotoğraf Karesi</p>
            {isLoading ? <div className="h-6 w-16 rounded-lg bg-white/10 animate-pulse" />
              : <p className="text-xl font-black text-white leading-none">{(data?.toplamKare ?? 0).toLocaleString('tr-TR')}</p>}
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>bugün çekildi</p>
          </div>

          {/* Anomali */}
          <button
            onClick={() => onNavigate('anomali-panosu')}
            className="w-full text-left transition-all active:scale-95"
            style={{
              ...glass,
              padding: 16,
              border: hasAnomali ? '1px solid rgba(248,113,113,0.45)' : '1px solid rgba(255,255,255,0.1)',
              background: hasAnomali ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)',
              boxShadow: hasAnomali ? '0 4px 24px rgba(248,113,113,0.18)' : 'none',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: hasAnomali ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${hasAnomali ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <AlertTriangle className="w-5 h-5" style={{ color: hasAnomali ? '#f87171' : 'rgba(255,255,255,0.3)' }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Anomali</p>
            {isLoading ? <div className="h-6 w-8 rounded-lg bg-white/10 animate-pulse" />
              : <p className="text-xl font-black leading-none" style={{ color: hasAnomali ? '#f87171' : 'white' }}>{anomali}</p>}
            <p className="text-[10px] mt-1.5" style={{ color: hasAnomali ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.3)' }}>
              {hasAnomali ? 'detay için tıkla →' : 'anomali yok'}
            </p>
          </button>
        </motion.div>

        {/* ── Döviz Widget ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <CurrencyWidget />
        </motion.div>

        {/* ══════════════════════════════════
            2. HIZLI ERİŞİM MENÜSÜ
            ══════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{ ...glass, padding: 16 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4" style={{ color: '#ffd4a3' }} />
            <p className="text-sm font-bold text-white">Hızlı Erişim</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.tab}
                onClick={() => onNavigate(action.tab)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all active:scale-95"
                style={{ background: `${action.color}10`, border: `1px solid ${action.color}25` }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${action.color}20`, border: `1px solid ${action.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <span className="text-[10px] font-bold text-center leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ══════════════════════════════════
            3. CANLI DURUM
            ══════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          style={{ ...glass, padding: 16 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm font-bold text-white">Canlı Durum</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                {data?.aktifMekanSayisi ?? 0} açık
              </span>
            </div>
            <button onClick={() => onNavigate('isletme-genel-durum')} className="flex items-center gap-0.5 text-xs font-bold" style={{ color: '#9dd9ea' }}>
              Tümü <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : !data?.aktifMekanlar || data.aktifMekanlar.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Activity className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.15)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Bugün açık vardiya yok</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>Açılış yapılan mekanlar burada listelenir</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.aktifMekanlar.map((mekan) => (
                <div key={mekan.id} className="flex items-center gap-3 rounded-xl" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-center text-lg shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: `${mekan.color}15`, border: `1px solid ${mekan.color}30` }}>
                    {mekan.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{mekan.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <ShoppingBag className="w-2.5 h-2.5" />{mekan.satisAdet} ürün
                      </span>
                      <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <Camera className="w-2.5 h-2.5" />{mekan.kare} kare
                      </span>
                      {mekan.acilisZamani && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(mekan.acilisZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {mekan.kotaKademeleri && mekan.kotaKademeleri.length > 0 && (
                      <KotaBar ciro={mekan.ciro} kademeler={mekan.kotaKademeleri} />
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: '#34d399' }}>{formatTL(mekan.ciro)}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px]" style={{ color: 'rgba(52,211,153,0.6)' }}>Açık</span>
                    </div>
                    {mekan.kotaKademeleri && (() => {
                      const sorted = [...mekan.kotaKademeleri].sort((a, b) => Number(a.hedef) - Number(b.hedef));
                      const idx = [...sorted].map((k, i) => ({ k, i })).reverse().find(({ k }) => mekan.ciro >= k.hedef)?.i;
                      if (idx === undefined) return null;
                      const colors = ['#60a5fa', '#a855f7', '#fbbf24'];
                      const emojis = ['🥉', '🥈', '🥇'];
                      return (
                        <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 6, background: `${colors[Math.min(idx, 2)]}20`, border: `1px solid ${colors[Math.min(idx, 2)]}40` }}>
                          <span style={{ fontSize: 9 }}>{emojis[Math.min(idx, 2)]}</span>
                          <span style={{ color: colors[Math.min(idx, 2)], fontSize: 8, fontWeight: 800 }}>PRİM</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Prim Takip Banner ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <button
            onClick={() => onNavigate('prim-takip')}
            className="w-full text-left transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(251,191,36,0.12) 100%)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 16, padding: '14px 16px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏆</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ color: 'white', fontSize: 13, fontWeight: 800 }}>Hakediş Takip</span>
                  <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 6, color: '#fbbf24', fontWeight: 900 }}>YENİ</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Aylık kota hakedişlerini yönet · Toplu ödeme →</p>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: 'rgba(168,85,247,0.7)', flexShrink: 0 }} />
            </div>
          </button>
        </motion.div>

        {/* ── Saatlik Satış & Ciro Trendi (Custom SVG) ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ ...glass, padding: 16 }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-white">Saatlik Satış & Ciro Trendi</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS.violet }} />
                <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>Satış</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS.emerald }} />
                <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>Ciro</span>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="h-44 flex items-center justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          ) : !chartData || chartData.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center gap-2">
              <BarChart3 className="w-8 h-8 text-white/20" />
              <p className="text-white/30 text-sm">Henüz satış verisi yok</p>
              <p className="text-white/20 text-xs">Bugün satış yapıldığında grafik oluşacak</p>
            </div>
          ) : (
            <SaatlikChart data={chartData} />
          )}
        </motion.div>

        {/* ── Mekan Ciro Sıralaması ── */}
        {data && data.mekanCiroList && data.mekanCiroList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            style={{ ...glass, padding: 16 }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-white">🏆 Mekan Ciro Sıralaması</p>
              <button onClick={() => onNavigate('isletme-genel-durum')} className="text-xs font-bold" style={{ color: COLORS.yellow }}>
                Tümü →
              </button>
            </div>
            <div className="space-y-2">
              {data.mekanCiroList.map((mekan, i) => {
                const maxC = data.mekanCiroList[0].ciro || 1;
                const pct = Math.round((mekan.ciro / maxC) * 100);
                const rankColors = [COLORS.yellow, '#94a3b8', '#cd7f32', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'];
                return (
                  <div key={mekan.id} className="flex items-center gap-3" style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-center text-xs font-black shrink-0" style={{ width: 28, height: 28, borderRadius: 8, background: `${rankColors[i]}20`, border: `1px solid ${rankColors[i]}50`, color: rankColors[i] }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span>{mekan.emoji}</span>
                        <p className="text-sm font-bold text-white truncate">{mekan.name}</p>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: mekan.color || COLORS.emerald }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black" style={{ color: COLORS.emerald }}>{formatTL(mekan.ciro)}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{mekan.adet} ürün</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Albüm Dağılımı ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          style={{ ...glass, padding: 16 }}
        >
          <p className="text-sm font-bold text-white mb-3">Bugünkü Satış Dağılımı</p>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-5 rounded-lg bg-white/10 animate-pulse" />)}
            </div>
          ) : !data?.albumDagilimi || data.albumDagilimi.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-4">Henüz albüm satışı yok</p>
          ) : (
            <>
              <div className="space-y-2">
                {data.albumDagilimi.map((item, idx) => {
                  const pct = totalAlbums > 0 ? Math.round((item.adet / totalAlbums) * 100) : 0;
                  const color = ALBUM_COLORS[idx % ALBUM_COLORS.length];
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-semibold w-16 shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.tip}</span>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs font-bold w-6 text-right text-white">{item.adet}</span>
                      <span className="text-[10px] w-8 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>%{pct}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Toplam Albüm</span>
                <span className="text-sm font-black text-white">{totalAlbums}</span>
              </div>
            </>
          )}
        </motion.div>

        {/* ── En İyi Performans ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          style={{ ...glass, padding: 16 }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">🏆 En İyi Performans</p>
            <button onClick={() => setShowPerformanceList(true)} className="text-xs font-bold" style={{ color: COLORS.yellow }}>
              Tümünü Gör
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0,1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : !data?.personelPerformans || data.personelPerformans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Trophy className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.15)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Henüz satış verisi yok</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>Bugün satış yapıldığında burada görünür</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.personelPerformans.slice(0, 5).map((p, i) => {
                const rankColors = [COLORS.yellow, '#94a3b8', '#cd7f32', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'];
                const rankEmojis = ['🥇', '🥈', '🥉', '', ''];
                const maxC = data.personelPerformans[0]?.ciro || 1;
                const pct = Math.round((p.ciro / maxC) * 100);
                return (
                  <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-3" style={{ padding: '10px 12px' }}>
                      <div className="flex items-center justify-center text-xs font-black shrink-0" style={{ width: 28, height: 28, borderRadius: 8, background: `${rankColors[i]}20`, border: `1px solid ${rankColors[i]}50`, color: rankColors[i] }}>
                        {rankEmojis[i] || i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{p.name}</p>
                        <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.mekan}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black" style={{ color: COLORS.emerald }}>{formatTL(p.ciro)}</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.satisAdet} satış</p>
                      </div>
                    </div>
                    <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? 'linear-gradient(90deg,#34d399,#fbbf24)' : COLORS.emerald, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Diğer İşlemler ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
        >
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(196,181,253,0.5)' }}>
            Diğer İşlemler
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Canlı Feed', icon: Activity,     color: COLORS.emerald, tab: 'live-feed'  },
              { label: 'Rotasyon',   icon: Users,         color: COLORS.orange,  tab: 'rotation'  },
              { label: 'Mesajlar',   icon: AlertCircle,   color: COLORS.blue,    tab: 'messaging' },
              { label: 'Ayarlar',    icon: SettingsIcon,  color: COLORS.violet,  tab: 'settings'  },
            ].map(({ label, icon: Icon, color, tab }) => (
              <button
                key={tab}
                onClick={() => onNavigate(tab)}
                className="flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
                style={{ ...glass, padding: '14px 8px', border: `1px solid ${color}30`, boxShadow: `0 4px 20px ${color}10` }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

      </div>

      <StaffPerformanceList
        isOpen={showPerformanceList}
        onClose={() => setShowPerformanceList(false)}
        onSendMessage={() => { setShowPerformanceList(false); onNavigate('messaging'); }}
        liveData={data?.personelPerformans}
      />
    </div>
  );
}

// ── Çok kademeli kota progress bar ──────────────────────────
function KotaBar({ ciro, kademeler }: { ciro: number; kademeler: { hedef: number; primTek: number; primCoklu: number }[] }) {
  if (!kademeler || kademeler.length === 0) return null;
  const sorted = [...kademeler].sort((a, b) => Number(a.hedef) - Number(b.hedef));
  const maxHedef = sorted[sorted.length - 1].hedef;
  const barFill = Math.min(ciro / maxHedef, 1.0);

  const enYuksekAsildi = [...sorted].reverse().find(k => ciro >= k.hedef);
  const barColor = enYuksekAsildi
    ? (sorted.indexOf(enYuksekAsildi) === sorted.length - 1 ? '#fbbf24'
      : sorted.indexOf(enYuksekAsildi) === 1 ? '#a855f7'
      : '#60a5fa')
    : '#f87171';

  return (
    <div style={{ marginTop: 7 }}>
      <div style={{ position: 'relative', height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0,
          height: '100%', borderRadius: 99,
          width: `${Math.min(barFill * 100, 100)}%`,
          background: enYuksekAsildi
            ? (sorted.length >= 3 && sorted.indexOf(enYuksekAsildi) >= 2
              ? 'linear-gradient(90deg,#60a5fa,#a855f7,#fbbf24)'
              : sorted.length >= 2 && sorted.indexOf(enYuksekAsildi) >= 1
              ? 'linear-gradient(90deg,#60a5fa,#a855f7)'
              : '#60a5fa')
            : barColor,
          boxShadow: enYuksekAsildi ? `0 0 8px ${barColor}80` : 'none',
          transition: 'width 0.5s ease',
        }} />
        {sorted.map((k, i) => {
          const pos = k.hedef / maxHedef;
          const achieved = ciro >= k.hedef;
          const dotColor = i === 0 ? '#60a5fa' : i === 1 ? '#a855f7' : '#fbbf24';
          return (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: `${pos * 100}%`,
              transform: 'translate(-50%,-50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: achieved ? dotColor : 'rgba(255,255,255,0.15)',
              border: `1.5px solid ${achieved ? dotColor : 'rgba(255,255,255,0.2)'}`,
              boxShadow: achieved ? `0 0 8px ${dotColor}90` : 'none',
              transition: 'all 0.4s ease',
              zIndex: 2,
            }} />
          );
        })}
      </div>
      <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
        {sorted.map((k, i) => {
          const pos = k.hedef / maxHedef;
          const achieved = ciro >= k.hedef;
          const dotColor = i === 0 ? '#60a5fa' : i === 1 ? '#a855f7' : '#fbbf24';
          const label = k.hedef >= 1000 ? `₺${(k.hedef / 1000).toFixed(0)}B` : `₺${k.hedef}`;
          return (
            <span key={i} style={{
              position: 'absolute',
              left: `${pos * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: 8, fontWeight: 800,
              color: achieved ? dotColor : 'rgba(255,255,255,0.2)',
              transition: 'color 0.4s',
              whiteSpace: 'nowrap',
            }}>{achieved ? '✓' : label}</span>
          );
        })}
      </div>
    </div>
  );
}