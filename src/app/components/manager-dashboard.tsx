import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  BarChart2, AlertTriangle, MapPin, FileText, TrendingUp,
  Camera, RefreshCw, ShoppingBag, Clock, ChevronRight,
  Star, Activity, Zap, Trophy, Users,
} from 'lucide-react';
import { CurrencyWidget } from './currency-widget';
import { getToken, buildHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/** Retry yardımcısı — TypeError (network) hatalarında tekrar dener */
async function fetchWithRetry(
  input: string,
  init: RequestInit,
  retries = 3,
  delayMs = 800,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(input, init);
      return res;
    } catch (err: any) {
      lastErr = err;
      // AbortError ise retry etme
      if (err?.name === 'AbortError') throw err;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

interface ManagerDashboardProps {
  userName: string;
  roleTitle: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface DashboardData {
  tarih: string;
  toplamCiro: number;
  toplamAdet: number;
  toplamKare: number;
  anomaliSayisi: number;
  aktifMekanSayisi: number;
  toplamMekanSayisi: number;
  aktifPersonelSayisi?: number;
  toplamPersonelSayisi?: number;
  gecGirisSayisi?: number;
  toplamBasilan?: number;
  toplamIadeFoto?: number;
  toplamIskonto?: number;
  toplamBrutCiro?: number;
  toplamDijitalAdet?: number;
  toplamFizikselAdet?: number;
  aktifPersonelDetay?: { name: string; mekan: string; checkinZamani: string }[];
  aktifMekanlar: {
    id: string;
    name: string;
    emoji: string;
    color: string;
    satisAdet: number;
    ciro: number;
    kare: number;
    acilisZamani: string;
  }[];
}

function formatTL(val: number): string {
  if (val >= 1_000_000) return `₺${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `₺${(val / 1_000).toFixed(1)}B`;
  return `₺${val.toLocaleString('tr-TR')}`;
}

/* ── Glassmorphism stili ── */
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};

const QUICK_ACTIONS = [
  { label: 'Vardiya Raporları', icon: FileText,        color: '#ffd4a3', tab: 'vardiya-raporlari', mudurHide: true },
  { label: 'Satış İstatistik',  icon: BarChart2,      color: '#9dd9ea', tab: 'satis-raporu' },
  { label: 'Anomali İstatistik',icon: AlertTriangle,   color: '#f87171', tab: 'anomali-panosu' },
  { label: 'Vardiya İstatistik',  icon: Clock,       color: '#a8e6cf', tab: 'vardiya-istatistikleri' },
  { label: 'İndirim İstatistik', icon: Star,        color: '#a855f7', tab: 'indirim-istatistik' },
  { label: 'Yön. Raporları',     icon: TrendingUp,  color: '#fb923c', tab: 'manager-reports' },
  { label: 'Hakediş Takip',      icon: Trophy,      color: '#fbbf24', tab: 'prim-takip', mudurHide: true },
] as const;

export function ManagerDashboard({ userName, roleTitle, onNavigate }: ManagerDashboardProps) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showAktifPersonel, setShowAktifPersonel] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const res = await fetchWithRetry(`${API_BASE}/manager/dashboard-summary${ghostParams()}`, {
        headers: buildHeaders(token),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sunucu hatası');
      setData(json);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('ManagerDashboard fetch error:', err);
      setError(err.message || 'Veri alınamadı');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isLoading = loading && !data;

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--app-bg, linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%))' }}>
      <div className="px-4 pt-4 space-y-4">

        {/* ── Başlık ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">Genel Durum</h1>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(var(--app-accent-rgb),0.5)' }}>
                {userName} · {roleTitle} · {new Date().toLocaleDateString('tr-TR')}
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{ ...glass, padding: 10, borderRadius: 14 }}
            >
              <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {lastRefresh && (
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Son güncelleme: {lastRefresh.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </motion.div>

        {/* ── Hata ── */}
        {error && (
          <div style={{ ...glass, padding: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)' }}>
            <p className="text-red-300 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════
            1. DASHBOARD KARTLARI — GERÇEK VERİ
            ══════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3"
        >
          {roleTitle === 'Müdür' ? (
          /* Müdür: Satış Adedi + Dijital/Fiziksel (ciro gizli) */
          <div style={{ ...glass, padding: 0, border: '1px solid rgba(157,217,234,0.25)', boxShadow: '0 4px 24px rgba(157,217,234,0.08)', display: 'flex' }}>
            <div style={{ flex: 1, padding: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <ShoppingBag className="w-4 h-4" style={{ color: '#9dd9ea' }} />
              </div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Satış Adedi</p>
              {isLoading ? <div className="h-5 w-12 rounded-lg bg-white/10 animate-pulse" />
                : <p className="text-lg font-black text-white leading-none">{data?.toplamAdet ?? 0}</p>}
              <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>bugün</p>
            </div>
            <div style={{ width: 1, background: 'rgba(157,217,234,0.15)', margin: '12px 0' }} />
            <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ marginBottom: 8 }}>
                <p className="text-[9px] font-medium" style={{ color: '#a8e6cf' }}>📦 Fiziksel</p>
                {isLoading ? <div className="h-4 w-10 rounded bg-white/10 animate-pulse mt-1" />
                  : <p className="text-base font-black leading-none mt-0.5" style={{ color: '#a8e6cf' }}>{data?.toplamFizikselAdet ?? 0}</p>}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                <p className="text-[9px] font-medium" style={{ color: '#c4b5fd' }}>📱 Dijital</p>
                {isLoading ? <div className="h-4 w-8 rounded bg-white/10 animate-pulse mt-1" />
                  : <p className="text-sm font-bold leading-none mt-0.5" style={{ color: '#c4b5fd' }}>{data?.toplamDijitalAdet ?? 0}</p>}
              </div>
            </div>
          </div>
          ) : (
          /* Üst Müdür: Günlük Ciro + İskonto */
          <div style={{ ...glass, padding: 0, border: '1px solid rgba(157,217,234,0.25)', boxShadow: '0 4px 24px rgba(157,217,234,0.08)', display: 'flex' }}>
            <div style={{ flex: 1, padding: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <BarChart2 className="w-4 h-4" style={{ color: '#9dd9ea' }} />
              </div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Günlük Ciro</p>
              {isLoading ? <div className="h-5 w-16 rounded-lg bg-white/10 animate-pulse" />
                : <p className="text-lg font-black text-white leading-none">{formatTL(data?.toplamCiro ?? 0)}</p>}
              <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{data?.toplamAdet ?? 0} ürün satıldı</p>
            </div>
            <div style={{ width: 1, background: 'rgba(157,217,234,0.15)', margin: '12px 0' }} />
            <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ marginBottom: 8 }}>
                <p className="text-[9px] font-medium" style={{ color: '#ffd4a3' }}>🏷️ İskonto</p>
                {isLoading ? <div className="h-4 w-12 rounded bg-white/10 animate-pulse mt-1" />
                  : <p className="text-base font-black leading-none mt-0.5" style={{ color: '#ffd4a3' }}>₺{(data?.toplamIskonto ?? 0).toLocaleString('tr-TR')}</p>}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                <p className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Oran</p>
                {isLoading ? <div className="h-4 w-8 rounded bg-white/10 animate-pulse mt-1" />
                  : <p className="text-sm font-bold leading-none mt-0.5" style={{ color: '#ffd4a3' }}>
                    %{(data?.toplamBrutCiro ?? 0) > 0 ? Math.round(((data?.toplamIskonto ?? 0) / (data?.toplamBrutCiro ?? 1)) * 100) : 0}
                  </p>}
              </div>
            </div>
          </div>
          )}

          {/* Aktif Mekan + Aktif Personel */}
          <div style={{ ...glass, padding: 0, border: '1px solid rgba(168,230,207,0.25)', boxShadow: '0 4px 24px rgba(168,230,207,0.08)', display: 'flex' }}>
            {/* Sol: Aktif Mekan → operasyon paneli */}
            <button onClick={() => onNavigate('quick-sales')} className="text-left transition-all active:scale-95" style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(168,230,207,0.15)', border: '1px solid rgba(168,230,207,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <MapPin className="w-4 h-4" style={{ color: '#a8e6cf' }} />
              </div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Aktif Mekan</p>
              {isLoading
                ? <div className="h-5 w-10 rounded-lg bg-white/10 animate-pulse" />
                : <p className="text-lg font-black text-white leading-none">{data?.aktifMekanSayisi ?? 0}</p>
              }
              <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>/ {data?.toplamMekanSayisi ?? 0} toplam</p>
            </button>
            {/* Dikey ayırıcı */}
            <div style={{ width: 1, background: 'rgba(168,230,207,0.15)', margin: '12px 0' }} />
            {/* Sağ: Aktif Personel → popup */}
            <button onClick={() => setShowAktifPersonel(!showAktifPersonel)} className="text-left transition-all active:scale-95" style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Users className="w-4 h-4" style={{ color: '#9dd9ea' }} />
              </div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Aktif Personel</p>
              {isLoading
                ? <div className="h-5 w-10 rounded-lg bg-white/10 animate-pulse" />
                : <p className="text-lg font-black text-white leading-none">{data?.aktifPersonelSayisi ?? 0}</p>
              }
              <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>/ {data?.toplamPersonelSayisi ?? 0} toplam</p>
            </button>
          </div>

          {/* Fotoğraf Karesi + Basılan/İade */}
          <div style={{ ...glass, padding: 0, border: '1px solid rgba(var(--app-accent-rgb),0.25)', boxShadow: '0 4px 24px rgba(var(--app-accent-rgb),0.08)', display: 'flex' }}>
            {/* Sol: Kare Sayısı */}
            <div style={{ flex: 1, padding: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--app-accent-rgb),0.15)', border: '1px solid rgba(var(--app-accent-rgb),0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Camera className="w-4 h-4" style={{ color: 'var(--app-accent, #a855f7)' }} />
              </div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Kare Sayısı</p>
              {isLoading ? <div className="h-5 w-12 rounded-lg bg-white/10 animate-pulse" />
                : <p className="text-lg font-black text-white leading-none">{(data?.toplamKare ?? 0).toLocaleString('tr-TR')}</p>}
              <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>bugün çekildi</p>
            </div>
            {/* Dikey ayırıcı */}
            <div style={{ width: 1, background: 'rgba(var(--app-accent-rgb),0.15)', margin: '12px 0' }} />
            {/* Sağ: Basılan + İade */}
            <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ marginBottom: 8 }}>
                <p className="text-[9px] font-medium" style={{ color: '#a8e6cf' }}>🖨️ Basılan</p>
                {isLoading ? <div className="h-4 w-10 rounded bg-white/10 animate-pulse mt-1" />
                  : <p className="text-base font-black leading-none mt-0.5" style={{ color: '#a8e6cf' }}>{(data?.toplamBasilan ?? 0).toLocaleString('tr-TR')}</p>}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                <p className="text-[9px] font-medium" style={{ color: (data?.toplamIadeFoto ?? 0) > 0 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>↩️ İade</p>
                {isLoading ? <div className="h-4 w-8 rounded bg-white/10 animate-pulse mt-1" />
                  : <p className="text-sm font-bold leading-none mt-0.5" style={{ color: (data?.toplamIadeFoto ?? 0) > 0 ? '#f87171' : 'rgba(255,255,255,0.5)' }}>{data?.toplamIadeFoto ?? 0}</p>}
              </div>
            </div>
          </div>

          {/* Anomali + Geç Giriş */}
          {(() => {
            const anomali = data?.anomaliSayisi ?? 0;
            const hasAnomali = anomali > 0;
            const gecGiris = data?.gecGirisSayisi ?? 0;
            const hasGecGiris = gecGiris > 0;
            return (
              <div style={{ ...glass, padding: 0, border: hasAnomali ? '1px solid rgba(248,113,113,0.3)' : hasGecGiris ? '1px solid rgba(255,180,50,0.3)' : '1px solid rgba(255,255,255,0.1)', display: 'flex' }}>
                {/* Sol: Anomali */}
                <button onClick={() => onNavigate('anomali-panosu')} className="text-left transition-all active:scale-95" style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: hasAnomali ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${hasAnomali ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: hasAnomali ? '#f87171' : 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Anomali</p>
                  {isLoading ? <div className="h-5 w-8 rounded-lg bg-white/10 animate-pulse" />
                    : <p className="text-lg font-black leading-none" style={{ color: hasAnomali ? '#f87171' : 'white' }}>{anomali}</p>}
                  <p className="text-[9px] mt-1" style={{ color: hasAnomali ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.3)' }}>
                    {hasAnomali ? 'detay →' : 'anomali yok'}
                  </p>
                </button>
                {/* Dikey ayırıcı */}
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '12px 0' }} />
                {/* Sağ: Geç Giriş */}
                <button onClick={() => onNavigate('vardiya-istatistikleri')} className="text-left transition-all active:scale-95" style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: hasGecGiris ? 'rgba(255,180,50,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${hasGecGiris ? 'rgba(255,180,50,0.4)' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Clock className="w-4 h-4" style={{ color: hasGecGiris ? '#fbbf24' : 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Geç Giriş</p>
                  {isLoading ? <div className="h-5 w-8 rounded-lg bg-white/10 animate-pulse" />
                    : <p className="text-lg font-black leading-none" style={{ color: hasGecGiris ? '#fbbf24' : 'white' }}>{gecGiris}</p>}
                  <p className="text-[9px] mt-1" style={{ color: hasGecGiris ? 'rgba(255,180,50,0.6)' : 'rgba(255,255,255,0.3)' }}>
                    {hasGecGiris ? 'detay →' : 'geç giriş yok'}
                  </p>
                </button>
              </div>
            );
          })()}
        </motion.div>

        {/* Döviz Widget */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <CurrencyWidget />
        </motion.div>

        {/* ══════════════════════════════════════════
            2. HIZLI ERİŞİM MENÜSÜ
            ══════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ ...glass, padding: 16 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4" style={{ color: '#ffd4a3' }} />
            <p className="text-sm font-bold text-white">Hızlı Erişim</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.filter(a => !(roleTitle === 'Müdür' && (a as any).mudurHide)).map((action) => (
              <button
                key={action.tab}
                onClick={() => onNavigate(action.tab)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all active:scale-95"
                style={{ background: `${action.color}10`, border: `1px solid ${action.color}25` }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{ width: 40, height: 40, borderRadius: 12, background: `${action.color}20`, border: `1px solid ${action.color}35` }}
                >
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <span className="text-[10px] font-bold text-center leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════
            3. SON VARDİYALAR / CANLI DURUM
            ══════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
            {roleTitle !== 'Müdür' && (
            <button
              onClick={() => onNavigate('isletme-genel-durum')}
              className="flex items-center gap-0.5 text-xs font-bold"
              style={{ color: '#9dd9ea' }}
            >
              Tümü <ChevronRight className="w-3 h-3" />
            </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
              ))}
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
                <div
                  key={mekan.id}
                  className="flex items-center gap-3 rounded-xl"
                  style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {/* Mekan ikonu */}
                  <div
                    className="flex items-center justify-center text-lg shrink-0"
                    style={{ width: 40, height: 40, borderRadius: 12, background: `${mekan.color}15`, border: `1px solid ${mekan.color}30` }}
                  >
                    {mekan.emoji}
                  </div>

                  {/* Bilgi */}
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
                  </div>

                  {/* Ciro — müdür görmez */}
                  <div className="text-right shrink-0">
                    {roleTitle !== 'Müdür' && <p className="text-sm font-black" style={{ color: '#34d399' }}>{formatTL(mekan.ciro)}</p>}
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px]" style={{ color: 'rgba(52,211,153,0.6)' }}>Açık</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </div>

      {/* Aktif Personel Modal */}
      {showAktifPersonel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowAktifPersonel(false)}>
          <div className="w-full max-w-sm bg-[#1a1a2e] rounded-3xl border border-white/10 shadow-2xl max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: '#9dd9ea' }} />
                <h3 className="text-base font-bold text-white">Aktif Personel</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(157,217,234,0.15)', color: '#9dd9ea' }}>{data?.aktifPersonelSayisi ?? 0} / {data?.toplamPersonelSayisi ?? 0}</span>
              </div>
              <button onClick={() => setShowAktifPersonel(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <span className="text-white/50 text-sm">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {(data?.aktifPersonelDetay?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">😴</p>
                  <p className="text-sm text-white/40">Şu an aktif personel yok</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data!.aktifPersonelDetay!.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-3 rounded-xl" style={{ background: 'rgba(157,217,234,0.06)', border: '1px solid rgba(157,217,234,0.12)' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#9dd9ea]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">👤</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                          {p.mekan && <p className="text-[10px] text-[#a8e6cf]">📍 {p.mekan}</p>}
                        </div>
                      </div>
                      {p.checkinZamani && (
                        <span className="text-[10px] text-white/30 flex-shrink-0">
                          🕐 {new Date(p.checkinZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}