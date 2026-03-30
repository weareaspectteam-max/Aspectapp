import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Wifi, Camera, ShoppingBag, MapPin, ChevronDown, ChevronUp, TrendingUp, Clock, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedItem {
  type: 'satis' | 'kare';
  id: string;
  timestamp: string;
  kaydeden?: string;
  kaydedenId?: string;
  mekanId: string;
  mekanAdi: string;
  mekanEmoji: string;
  mekanColor: string;
  // Sadece satis
  items?: { product: string; quantity: number; unitPrice: number; color: string }[];
  totalPrice?: number;
  discount?: number;
  finalPrice?: number;
  paymentMethod?: 'cash' | 'iban' | 'card';
  currency?: string;
  currencyPrice?: number | null;
  iptal?: boolean;
  // Sadece kare
  photographerName?: string;
  photographerId?: string;
  frameCount?: number;
}

interface Mekan {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface LiveSalesFeedProps {
  userName?: string;
  userRole?: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
const REFRESH_INTERVAL = 15_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function productShort(items?: FeedItem['items']) {
  if (!items?.length) return '-';
  return items.map(i => (i.quantity > 1 ? `${i.quantity}× ` : '') + i.product).join(' + ');
}

function clockTime(ts: string) {
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function payLabel(p?: string) {
  if (p === 'cash') return { label: 'NAKİT', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (p === 'card') return { label: 'KART', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
  if (p === 'iban') return { label: 'IBAN', bg: 'bg-ta/20 text-ta border-ta/30' };
  return { label: '-', bg: 'bg-white/10 text-white/40 border-white/20' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
    </span>
  );
}

function StatChip({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0" style={{ backgroundColor: `${color}15`, borderColor: `${color}40` }}>
      <span style={{ color }}>{icon}</span>
      <div>
        <div className="text-xs font-bold text-white leading-none">{value}</div>
        <div className="text-[10px] text-white/40 leading-none mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function SatisBubble({ item }: { item: FeedItem }) {
  const pay = payLabel(item.paymentMethod);
  const originalPrice = (item.discount || 0) > 0 ? (item.finalPrice || 0) + (item.discount || 0) : null;
  const discountPct = originalPrice ? Math.round((item.discount! / originalPrice) * 100) : null;
  const mekanColor = item.mekanColor || '#9dd9ea';

  return (
    <div className={`flex gap-2.5 ${item.iptal ? 'opacity-40' : ''}`}>
      {/* zaman sütunu */}
      <div className="flex flex-col items-center w-10 shrink-0 pt-0.5">
        <span className="text-[10px] font-mono text-white/40">{clockTime(item.timestamp)}</span>
        <div className="w-px flex-1 mt-1" style={{ backgroundColor: `${mekanColor}40` }} />
      </div>
      {/* kart */}
      <div
        className="flex-1 mb-2.5 rounded-xl border px-3 py-2.5 relative overflow-hidden"
        style={{ backgroundColor: `${mekanColor}10`, borderColor: `${mekanColor}30` }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ backgroundColor: mekanColor }} />

        {/* Üst satır: ürün adı + ödeme metodu */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShoppingBag className="w-3 h-3 shrink-0" style={{ color: mekanColor }} />
            <span className="text-xs font-bold text-white truncate">{productShort(item.items)}</span>
            {item.iptal && (
              <span className="text-[9px] text-red-400 border border-red-400/50 rounded px-1 shrink-0">İPTAL</span>
            )}
          </div>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${pay.bg}`}>
            {pay.label}
          </span>
        </div>

        {/* Alt satır: mekan · satıcı + fiyat grubu */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[10px]">{item.mekanEmoji}</span>
            <span className="text-[10px] font-medium truncate" style={{ color: mekanColor }}>{item.mekanAdi}</span>
            <span className="text-[10px] text-white/25 shrink-0">·</span>
            <span className="text-[10px] text-white/40 truncate">{item.kaydeden}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {discountPct !== null && (
              <span className="text-[9px] font-bold text-orange-300 bg-orange-500/15 border border-orange-500/30 rounded px-1.5 py-0.5">
                %{discountPct} iskonto
              </span>
            )}
            {originalPrice !== null && (
              <span className="text-[10px] text-white/30 line-through">
                ₺{originalPrice.toLocaleString('tr-TR')}
              </span>
            )}
            <span className="text-sm font-bold text-white">
              ₺{(item.finalPrice || 0).toLocaleString('tr-TR')}
            </span>
          </div>
        </div>

        {/* Döviz bilgisi */}
        {item.currency && item.currency !== 'TRY' && item.currencyPrice && (
          <div className="text-[9px] text-white/30 mt-1 text-right">
            {item.currencyPrice} {item.currency}
          </div>
        )}
      </div>
    </div>
  );
}

function KareBubble({ item }: { item: FeedItem }) {
  const mekanColor = item.mekanColor || 'var(--app-accent, #a855f7)';
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center w-10 shrink-0 pt-0.5">
        <span className="text-[10px] font-mono text-white/40">{clockTime(item.timestamp)}</span>
        <div className="w-px flex-1 mt-1 bg-ta/30" />
      </div>
      <div className="flex-1 mb-2.5 rounded-xl border border-ta/25 px-3 py-2.5 bg-ta/8 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-ta" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Camera className="w-3 h-3 text-ta shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              {item.photographerName || item.kaydeden || 'Bilinmeyen'}
            </span>
            <span className="text-white/25 shrink-0 mx-0.5">·</span>
            <MapPin className="w-3 h-3 shrink-0" style={{ color: mekanColor }} />
            <span className="text-[10px] font-medium truncate" style={{ color: mekanColor }}>
              {item.mekanAdi}
            </span>
          </div>
          <span className="text-[10px] font-bold text-ta bg-ta/20 border border-ta/30 px-2.5 py-1 rounded-xl shrink-0">
            {item.frameCount} kare
          </span>
        </div>
      </div>
    </div>
  );
}

interface MekanPanelProps {
  mekan: Mekan;
  items: FeedItem[];
  defaultOpen?: boolean;
}

function MekanPanel({ mekan, items, defaultOpen = true }: MekanPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const sales = items.filter(i => i.type === 'satis' && !i.iptal);
  const kares = items.filter(i => i.type === 'kare');
  const rev = sales.reduce((s, i) => s + (i.finalPrice || 0), 0);
  const totalFrames = kares.reduce((s, i) => s + (i.frameCount || 0), 0);
  const lastItem = items[0];
  const minsAgoLast = lastItem
    ? Math.floor((Date.now() - new Date(lastItem.timestamp).getTime()) / 60_000)
    : null;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${mekan.color}35`, backgroundColor: 'rgba(255,255,255,0.04)' }}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 transition-all active:scale-[0.99]"
        style={{ backgroundColor: `${mekan.color}12` }}
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: `${mekan.color}25`, border: `1px solid ${mekan.color}40` }}
        >
          {mekan.emoji}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{mekan.name}</span>
            {minsAgoLast !== null && minsAgoLast < 10 && <PulseDot color={mekan.color} />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-white/40">{sales.length} satış</span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] text-white/40">{totalFrames} kare</span>
            {minsAgoLast !== null && (
              <>
                <span className="text-[10px] text-white/20">·</span>
                <span className="text-[10px] text-white/40">son: {minsAgoLast}dk önce</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold" style={{ color: mekan.color }}>
            ₺{rev.toLocaleString('tr-TR')}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pt-3 pb-1">
          {items.length === 0 ? (
            <div className="text-center py-6 text-xs text-white/30">Henüz kayıt yok</div>
          ) : (
            items.map(item =>
              item.type === 'satis'
                ? <SatisBubble key={item.id} item={item} />
                : <KareBubble key={item.id} item={item} />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ViewMode = 'mekan' | 'zaman';
type TypeFilter = 'all' | 'satis' | 'kare';

export function LiveSalesFeed({
  userName,
  userRole = 'yonetici',
  onLogout = () => {},
  onNavigate = () => {},
}: LiveSalesFeedProps = {}) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [mekanlar, setMekanlar] = useState<Mekan[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('mekan');
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pullDelta, setPullDelta] = useState(0);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80;

  const AUTO_INTERVAL = 30; // saniye

  const fetchFeed = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      let res = await fetch(`${BASE}/stok/canli-satis${ghostParams()}`, { headers });
      // 401 → token yenile ve bir kez daha dene
      if (res.status === 401) {
        console.warn('[LiveSalesFeed] 401 alındı, token yenileniyor...');
        await new Promise(r => setTimeout(r, 800));
        const freshHeaders = await authHeaders();
        res = await fetch(`${BASE}/stok/canli-satis`, { headers: freshHeaders });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setFeed(data.feed || data.satislar || []);
      setMekanlar(data.mekanlar || []);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('[LiveSalesFeed] fetch hatası:', err);
      setError(err.message || 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = () => {
    setSpinning(true);
    fetchFeed(false).finally(() => setSpinning(false));
  };

  useEffect(() => { fetchFeed(true); }, [fetchFeed]);

  useEffect(() => {
    const id = setInterval(() => fetchFeed(false), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchFeed]);

  // Auto-refresh kiosk modu
  useEffect(() => {
    if (!autoRefresh) { setCountdown(AUTO_INTERVAL); return; }
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchFeed(false);
          return AUTO_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchFeed]);

  // Reset countdown on manual refresh
  useEffect(() => {
    if (spinning) setCountdown(AUTO_INTERVAL);
  }, [spinning]);

  // Tick for relative time display
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const secsSinceUpdate = lastUpdate
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
    : null;
  const refreshLabel =
    secsSinceUpdate === null
      ? 'Yükleniyor…'
      : secsSinceUpdate < 5
      ? 'Az önce güncellendi'
      : `${secsSinceUpdate}sn önce`;

  const filtered = feed.filter(i => typeFilter === 'all' || i.type === typeFilter);
  const sales = filtered.filter(i => i.type === 'satis' && !i.iptal);
  const kares = filtered.filter(i => i.type === 'kare');
  const totalRev = sales.reduce((s, i) => s + (i.finalPrice || 0), 0);
  const totalFrames = kares.reduce((s, i) => s + (i.frameCount || 0), 0);

  // Mekan grouped (sırala: son kayıt en üste)
  const grouped = mekanlar
    .map(m => ({
      mekan: m,
      items: filtered
        .filter(i => i.mekanId === m.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    }))
    .filter(g => g.items.length > 0)
    .sort((a, b) => new Date(b.items[0].timestamp).getTime() - new Date(a.items[0].timestamp).getTime());

  // Zaman görünümü
  const timeSorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div
      ref={scrollRef}
      className={isFullscreen
        ? 'fixed inset-0 z-[90] overflow-y-auto flex flex-col font-sans'
        : 'min-h-screen pb-24 font-sans'
      }
      style={{
        background: 'var(--app-bg, linear-gradient(to bottom, #0a051e, #120830, #1a0a3c))',
        ...(isFullscreen && pullDelta > 0 ? {
        transform: `translateY(${Math.min(pullDelta * 0.45, 60)}px)`,
        borderRadius: `${Math.min(pullDelta * 0.3, 24)}px`,
        transition: pullDelta === 0 ? 'transform 0.3s ease, border-radius 0.3s ease' : 'none',
      } : {}),
      }}
      onTouchStart={isFullscreen ? (e) => {
        touchStartY.current = e.touches[0].clientY;
      } : undefined}
      onTouchMove={isFullscreen ? (e) => {
        const scrollTop = scrollRef.current?.scrollTop ?? 0;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (scrollTop === 0 && delta > 0) {
          e.preventDefault();
          setPullDelta(delta);
        }
      } : undefined}
      onTouchEnd={isFullscreen ? () => {
        if (pullDelta >= PULL_THRESHOLD) {
          setIsFullscreen(false);
        }
        setPullDelta(0);
      } : undefined}
    >
      {/* ── PULL-TO-DISMISS INDICATOR (fullscreen only) ── */}
      {isFullscreen && (
        <div
          className="flex flex-col items-center pt-2 pb-1 shrink-0 transition-all"
          style={{ opacity: Math.min(pullDelta / PULL_THRESHOLD, 1) }}
        >
          <div
            className="w-10 h-1 rounded-full transition-all"
            style={{
              backgroundColor: pullDelta >= PULL_THRESHOLD ? '#4ade80' : '#ffffff40',
              width: `${Math.min(40 + pullDelta * 0.3, 64)}px`,
            }}
          />
          {pullDelta > 20 && (
            <span className="text-[10px] mt-1.5 font-semibold tracking-wide" style={{
              color: pullDelta >= PULL_THRESHOLD ? '#4ade80' : '#ffffff50',
            }}>
              {pullDelta >= PULL_THRESHOLD ? '↑ Bırak — Çık' : '↓ Tam Ekrandan Çık'}
            </span>
          )}
        </div>
      )}

      {/* ── STATUS BAR ── */}
      <div className="border-b border-white/8 bg-[rgba(0,0,0,0.92)] backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <PulseDot color={error ? '#f87171' : '#4ade80'} />
            <span className="text-xs font-bold text-white tracking-wide">
              {error ? 'HATA' : 'CANLI'}
            </span>
            {!error && (
              <span className="text-[10px] text-white/30 ml-1">{refreshLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-emerald-400/70" />

            {/* ── FULLSCREEN TOGGLE ── */}
            <button
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? 'Normal görünüme dön' : 'Tam ekran'}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-90 ${
                isFullscreen
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/8 border-white/15 text-white/50 hover:bg-white/15 hover:text-white/80'
              }`}
            >
              {isFullscreen
                ? <Minimize2 className="w-3.5 h-3.5" />
                : <Maximize2 className="w-3.5 h-3.5" />
              }
            </button>

            {/* ── AUTO-REFRESH TOGGLE ── */}
            <button
              onClick={() => {
                setAutoRefresh(a => !a);
                setCountdown(AUTO_INTERVAL);
              }}
              title={autoRefresh ? 'Otomatik yenilemeyi durdur' : 'Otomatik yenilemeyi başlat'}
              className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 ${
                autoRefresh
                  ? 'bg-emerald-500/20 border border-emerald-500/40'
                  : 'bg-white/8 border border-white/15 hover:bg-white/15'
              }`}
            >
              {/* SVG geri sayım halkası */}
              <svg
                className="absolute inset-0 w-8 h-8 -rotate-90"
                viewBox="0 0 32 32"
              >
                {/* arka halka */}
                <circle
                  cx="16" cy="16" r="12"
                  fill="none"
                  stroke={autoRefresh ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth="2"
                />
                {/* ilerleme halkası */}
                {autoRefresh && (
                  <circle
                    cx="16" cy="16" r="12"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="75.4"
                    strokeDashoffset={75.4 * (countdown / AUTO_INTERVAL)}
                    style={{ transition: 'stroke-dashoffset 0.8s linear' }}
                  />
                )}
              </svg>
              {/* İkon veya sayı */}
              {autoRefresh ? (
                <span className="relative text-[10px] font-bold text-emerald-300 leading-none tabular-nums">
                  {countdown}
                </span>
              ) : (
                <RefreshCw className="relative w-3 h-3 text-white/50" />
              )}
            </button>

            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg bg-white/8 hover:bg-white/15 transition-all active:scale-95"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-white/60 ${spinning || loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4">
        {/* ── ERROR ── */}
        {error && (
          <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-300 flex-1">{error}</p>
            <button
              onClick={() => fetchFeed(true)}
              className="text-[10px] text-red-300 border border-red-400/40 px-2 py-1 rounded-lg shrink-0"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {/* ── COMPACT STAT CHIPS ── */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
          <StatChip
            icon={<ShoppingBag className="w-3 h-3" />}
            value={sales.length}
            label="satış"
            color="#4ade80"
          />
          <StatChip
            icon={<TrendingUp className="w-3 h-3" />}
            value={`₺${totalRev.toLocaleString('tr-TR')}`}
            label="gelir"
            color="#fbbf24"
          />
          <StatChip
            icon={<Camera className="w-3 h-3" />}
            value={totalFrames}
            label="kare"
            color="var(--app-accent, #a855f7)"
          />
          <StatChip
            icon={<Clock className="w-3 h-3" />}
            value={filtered.length}
            label="toplam"
            color="#60a5fa"
          />
        </div>

        {/* ── FILTER + VIEW TOGGLE ROW ── */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex bg-white/6 rounded-xl p-0.5 border border-white/10">
            {(['all', 'satis', 'kare'] as TypeFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  typeFilter === t ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t === 'all' ? 'Tümü' : t === 'satis' ? '💰 Satış' : '📷 Kare'}
              </button>
            ))}
          </div>

          <div className="flex bg-white/6 rounded-xl p-0.5 border border-white/10 ml-auto">
            <button
              onClick={() => setViewMode('mekan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                viewMode === 'mekan' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <MapPin className="w-3 h-3" /> Mekan
            </button>
            <button
              onClick={() => setViewMode('zaman')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                viewMode === 'zaman' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Clock className="w-3 h-3" /> Zaman
            </button>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <p className="text-xs text-white/30">Yükleniyor…</p>
            </div>
          ) : !error && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                {typeFilter === 'kare' ? '📷' : '🛒'}
              </div>
              <p className="text-sm text-white/30">Henüz kayıt yok</p>
            </div>
          ) : viewMode === 'mekan' ? (
            grouped.length > 0 ? (
              grouped.map((g, i) => (
                <MekanPanel
                  key={g.mekan.id}
                  mekan={g.mekan}
                  items={g.items}
                  defaultOpen={i === 0}
                />
              ))
            ) : (
              <div className="text-center py-12 text-sm text-white/30">Kayıt bulunamadı</div>
            )
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 pt-3 pb-1">
              {timeSorted.length === 0 ? (
                <div className="text-center py-10 text-xs text-white/30">Kayıt bulunamadı</div>
              ) : (
                timeSorted.map(item =>
                  item.type === 'satis'
                    ? <SatisBubble key={item.id} item={item} />
                    : <KareBubble key={item.id} item={item} />
                )
              )}
            </div>
          )}
        </div>
      </div>

      {!isFullscreen && (
        <NewBottomNav activeTab="live-feed" onTabChange={onNavigate} userRole={userRole} />
      )}
    </div>
  );
}