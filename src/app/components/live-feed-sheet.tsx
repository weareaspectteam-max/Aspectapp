import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useDragControls } from 'motion/react';
import { X, RefreshCw, ShoppingBag, Camera, TrendingUp, Clock } from 'lucide-react';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface FeedItem {
  type: 'satis' | 'kare';
  id: string;
  timestamp: string;
  kaydeden?: string;
  mekanId: string;
  mekanAdi: string;
  mekanEmoji: string;
  mekanColor: string;
  items?: { product: string; quantity: number; unitPrice: number; color: string }[];
  totalPrice?: number;
  discount?: number;
  finalPrice?: number;
  paymentMethod?: 'cash' | 'iban' | 'card';
  currency?: string;
  currencyPrice?: number | null;
  iptal?: boolean;
  photographerName?: string;
  frameCount?: number;
}

interface LiveFeedSheetProps {
  mekanId: string;
  mekanName: string;
  mekanIcon: string;
  mekanColor: string;
  onClose: () => void;
}

function clockTime(ts: string) {
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function payLabel(p?: string) {
  if (p === 'cash') return { label: 'NAKİT', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (p === 'card') return { label: 'KART', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
  if (p === 'iban') return { label: 'IBAN', cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
  return { label: '-', cls: 'bg-white/10 text-white/40 border-white/20' };
}

function productShort(items?: FeedItem['items']) {
  if (!items?.length) return '-';
  return items.map(i => (i.quantity > 1 ? `${i.quantity}× ` : '') + i.product).join(' + ');
}

function PulseDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
    </span>
  );
}

export function LiveFeedSheet({ mekanId, mekanName, mekanIcon, mekanColor, onClose }: LiveFeedSheetProps) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dragY = useMotionValue(0);
  const dragControls = useDragControls();

  const fetchFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const headers = await authHeaders();
      let res = await fetch(`${BASE}/stok/canli-satis${ghostParams()}`, { headers });
      if (res.status === 401) {
        await new Promise(r => setTimeout(r, 800));
        const freshHeaders = await authHeaders();
        res = await fetch(`${BASE}/stok/canli-satis${ghostParams()}`, { headers: freshHeaders });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const allFeed: FeedItem[] = data.feed || [];
      // Sadece bu mekana ait + iptal olmayan kayıtları filtrele
      // mekanId ile eşleş; eşleşmezse mekanAdi ile de dene (yeni mekan geçiş güvenliği)
      const filtered = allFeed.filter(f =>
        (f.mekanId === mekanId || f.mekanAdi === mekanName) && !f.iptal
      );
      setFeed(filtered);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('LiveFeedSheet fetch error:', err);
      setError(err.message || 'Veri alınamadı');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mekanId, mekanName]);

  useEffect(() => {
    fetchFeed(false);
    const interval = setInterval(() => fetchFeed(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const satisList = feed.filter(f => f.type === 'satis');
  const kareList = feed.filter(f => f.type === 'kare');
  const toplamCiro = satisList.reduce((s, f) => s + (f.finalPrice ?? f.totalPrice ?? 0), 0);
  const toplamKare = kareList.reduce((s, f) => s + (f.frameCount ?? 0), 0);

  return (
    <AnimatePresence>
      {/* Sheet — üstten offset ile başlar, handle'dan sürükleyerek kapanır */}
      <motion.div
        key="sheet"
        className="fixed inset-x-0 bottom-0 z-[60] flex flex-col overflow-hidden rounded-t-3xl"
        style={{
          background: 'linear-gradient(to bottom, #1e1e2e, #2a2a3a)',
          top: 'calc(env(safe-area-inset-top, 44px) + 48px)',
          y: dragY,
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 400) {
            onClose();
          }
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="w-12 h-1.5 rounded-full bg-white/25" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 shrink-0 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mekan ikonu */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md"
                style={{ backgroundColor: mekanColor + '40' }}
              >
                {mekanIcon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base">{mekanName}</span>
                  <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5">
                    <PulseDot />
                    <span className="text-[10px] font-bold text-emerald-300 tracking-wide">CANLI</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-white/30" />
                  <span className="text-[10px] text-white/30">
                    {lastUpdated ? `Son güncelleme: ${clockTime(lastUpdated.toISOString())}` : 'Yükleniyor...'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchFeed(true)}
                disabled={refreshing}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all active:scale-90"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-white/70 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all active:scale-90"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-2 mt-3">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
              <ShoppingBag className="w-3.5 h-3.5 text-[#9dd9ea]" />
              <div>
                <div className="text-sm font-bold text-white">{satisList.length}</div>
                <div className="text-[9px] text-white/40">Satış</div>
              </div>
            </div>
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-[#d4b5f7]" />
              <div>
                <div className="text-sm font-bold text-white">{toplamKare}</div>
                <div className="text-[9px] text-white/40">Kare</div>
              </div>
            </div>
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#a8e6cf]" />
              <div>
                <div className="text-sm font-bold text-white">
                  {toplamCiro >= 1000 ? `${(toplamCiro / 1000).toFixed(1)}k` : toplamCiro}₺
                </div>
                <div className="text-[9px] text-white/40">Ciro</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feed list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
              <p className="text-sm text-white/40">Yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-3xl">⚠️</span>
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="text-5xl">📭</span>
              <p className="text-sm font-semibold text-white/50">Henüz kayıt yok</p>
              <p className="text-xs text-white/25">Bu mekan için bugün işlem yapılmamış</p>
            </div>
          ) : (
            feed.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                {item.type === 'satis' ? (
                  <SatisCard item={item} mekanColor={mekanColor} />
                ) : (
                  <KareCard item={item} mekanColor={mekanColor} />
                )}
              </motion.div>
            ))
          )}
          {/* Bottom padding for safe area */}
          <div className="h-6" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function SatisCard({ item, mekanColor }: { item: FeedItem; mekanColor: string }) {
  const pay = payLabel(item.paymentMethod);
  const discountPct = (item.discount || 0) > 0 && item.totalPrice
    ? Math.round((item.discount! / item.totalPrice) * 100)
    : null;

  return (
    <div
      className="rounded-xl border px-3.5 py-3 relative overflow-hidden"
      style={{ backgroundColor: `${mekanColor}0d`, borderColor: `${mekanColor}25` }}
    >
      {/* Sol bant */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ backgroundColor: mekanColor }} />

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <ShoppingBag className="w-3.5 h-3.5 shrink-0" style={{ color: mekanColor }} />
          <span className="text-xs font-bold text-white truncate">{productShort(item.items)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${pay.cls}`}>
            {pay.label}
          </span>
          <span className="text-[10px] font-mono text-white/35">{clockTime(item.timestamp)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-white/40 truncate">{item.kaydeden}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {discountPct !== null && (
            <span className="text-[9px] font-bold text-orange-300 bg-orange-500/15 border border-orange-500/30 rounded px-1.5 py-0.5">
              %{discountPct} ↓
            </span>
          )}
          <span className="text-sm font-bold" style={{ color: mekanColor }}>
            {(item.finalPrice ?? item.totalPrice ?? 0).toLocaleString('tr-TR')}₺
          </span>
        </div>
      </div>
    </div>
  );
}

function KareCard({ item, mekanColor }: { item: FeedItem; mekanColor: string }) {
  return (
    <div className="rounded-xl border px-3.5 py-3 relative overflow-hidden bg-[#d4b5f7]/[0.05] border-[#d4b5f7]/20">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-[#d4b5f7]" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Camera className="w-3.5 h-3.5 shrink-0 text-[#d4b5f7]" />
          <span className="text-xs font-bold text-white truncate">{item.photographerName}</span>
          <span className="text-xs text-[#d4b5f7] font-bold shrink-0">{item.frameCount} kare</span>
        </div>
        <span className="text-[10px] font-mono text-white/35 shrink-0">{clockTime(item.timestamp)}</span>
      </div>
    </div>
  );
}