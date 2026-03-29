import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  BarChart2, AlertTriangle, MapPin, FileText, TrendingUp,
  Camera, RefreshCw, ShoppingBag, Clock, ChevronRight,
  Star, Activity, Zap, Trophy,
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
  { label: 'Vardiya Raporları', icon: FileText,        color: '#ffd4a3', tab: 'vardiya-raporlari' },
  { label: 'Satış İstatistik',  icon: BarChart2,      color: '#9dd9ea', tab: 'satis-raporu' },
  { label: 'Anomali İstatistik',icon: AlertTriangle,   color: '#f87171', tab: 'anomali-panosu' },
  { label: 'Vardiya İstatistik',  icon: Clock,       color: '#a8e6cf', tab: 'vardiya-istatistikleri' },
  { label: 'İndirim İstatistik', icon: Star,        color: '#c4b5fd', tab: 'indirim-istatistik' },
  { label: 'Yön. Raporları',     icon: TrendingUp,  color: '#fb923c', tab: 'manager-reports' },
  { label: 'Hakediş Takip',      icon: Trophy,      color: '#fbbf24', tab: 'prim-takip' },
];

export function ManagerDashboard({ userName, roleTitle, onNavigate }: ManagerDashboardProps) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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
              <p className="text-xs mt-0.5" style={{ color: 'rgba(196,181,253,0.5)' }}>
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
          {/* Günlük Ciro */}
          <div style={{ ...glass, padding: 16, border: '1px solid rgba(157,217,234,0.25)', boxShadow: '0 4px 24px rgba(157,217,234,0.08)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <BarChart2 className="w-5 h-5" style={{ color: '#9dd9ea' }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Günlük Ciro</p>
            {isLoading
              ? <div className="h-6 w-20 rounded-lg bg-white/10 animate-pulse" />
              : <p className="text-xl font-black text-white leading-none">{formatTL(data?.toplamCiro ?? 0)}</p>
            }
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{data?.toplamAdet ?? 0} ürün satıldı</p>
          </div>

          {/* Aktif Mekan */}
          <div style={{ ...glass, padding: 16, border: '1px solid rgba(168,230,207,0.25)', boxShadow: '0 4px 24px rgba(168,230,207,0.08)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(168,230,207,0.15)', border: '1px solid rgba(168,230,207,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <MapPin className="w-5 h-5" style={{ color: '#a8e6cf' }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Aktif Mekan</p>
            {isLoading
              ? <div className="h-6 w-12 rounded-lg bg-white/10 animate-pulse" />
              : <p className="text-xl font-black text-white leading-none">{data?.aktifMekanSayisi ?? 0}</p>
            }
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>/ {data?.toplamMekanSayisi ?? 0} toplam</p>
          </div>

          {/* Fotoğraf Karesi */}
          <div style={{ ...glass, padding: 16, border: '1px solid rgba(196,181,253,0.25)', boxShadow: '0 4px 24px rgba(196,181,253,0.08)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(196,181,253,0.15)', border: '1px solid rgba(196,181,253,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Camera className="w-5 h-5" style={{ color: '#c4b5fd' }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Fotoğraf Karesi</p>
            {isLoading
              ? <div className="h-6 w-16 rounded-lg bg-white/10 animate-pulse" />
              : <p className="text-xl font-black text-white leading-none">{(data?.toplamKare ?? 0).toLocaleString('tr-TR')}</p>
            }
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>bugün çekildi</p>
          </div>

          {/* Anomali */}
          {(() => {
            const anomali = data?.anomaliSayisi ?? 0;
            const hasAnomali = anomali > 0;
            return (
              <button
                onClick={() => onNavigate('anomali-panosu')}
                className="w-full text-left transition-all active:scale-95"
                style={{
                  ...glass,
                  padding: 16,
                  border: hasAnomali ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  background: hasAnomali ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)',
                  boxShadow: hasAnomali ? '0 4px 24px rgba(248,113,113,0.15)' : '0 4px 24px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: hasAnomali ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${hasAnomali ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: hasAnomali ? '#f87171' : 'rgba(255,255,255,0.3)' }} />
                </div>
                <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Anomali</p>
                {isLoading
                  ? <div className="h-6 w-8 rounded-lg bg-white/10 animate-pulse" />
                  : <p className="text-xl font-black leading-none" style={{ color: hasAnomali ? '#f87171' : 'white' }}>{anomali}</p>
                }
                <p className="text-[10px] mt-1.5" style={{ color: hasAnomali ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.3)' }}>
                  {hasAnomali ? 'detay için tıkla →' : 'anomali yok'}
                </p>
              </button>
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
            {QUICK_ACTIONS.map((action) => (
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
            <button
              onClick={() => onNavigate('isletme-genel-durum')}
              className="flex items-center gap-0.5 text-xs font-bold"
              style={{ color: '#9dd9ea' }}
            >
              Tümü <ChevronRight className="w-3 h-3" />
            </button>
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

                  {/* Ciro */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: '#34d399' }}>{formatTL(mekan.ciro)}</p>
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
    </div>
  );
}