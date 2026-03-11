import { useState, useEffect, useCallback } from 'react';
import { Filter, TrendingUp, DollarSign, Package, Clock, Tag, RefreshCw, AlertCircle } from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

// VardiyaSatis yapısı + mekan bilgisi
interface CanliSatis {
  id: string;
  items: { product: string; quantity: number; unitPrice: number; color: string }[];
  totalPrice: number;
  discount: number;
  finalPrice: number;
  paymentMethod: 'cash' | 'iban' | 'card';
  currency: string;
  currencyPrice?: number | null;
  timestamp: string;
  kaydeden?: string;
  kaydedenId?: string;
  iptal: boolean;
  // Mekan bilgisi (server tarafından eklenir)
  mekanId: string;
  mekanAdi: string;
  mekanEmoji: string;
  mekanColor: string;
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
const REFRESH_INTERVAL = 30_000; // 30 saniye

/** items[] dizisini görüntü metnine çevirir: "3'lü", "2× 5'li + Paspartu" */
function formatProduct(items: CanliSatis['items']): string {
  if (!items?.length) return '-';
  return items
    .map((item) => {
      const qty = item.quantity > 1 ? `${item.quantity}× ` : '';
      return `${qty}${item.product}`;
    })
    .join(' + ');
}

/** Ana ürün adına göre gradient rengi */
function getProductColor(items: CanliSatis['items']): string {
  const first = items?.[0]?.product || '';
  const colors: Record<string, string> = {
    "3'lü": 'from-[#9dd9ea] to-[#7ec8dd]',
    "5'li": 'from-[#b8d4f1] to-[#9cc0e8]',
    "7'li": 'from-[#d4b5f7] to-[#c79ff0]',
    "9'lu": 'from-[#ffb3d9] to-[#ff99cc]',
    "11'li": 'from-[#ffe5b4] to-[#ffd89b]',
    "13'lü": 'from-[#c8f0a0] to-[#b0e080]',
    "15'li": 'from-[#a8e6cf] to-[#8dd9b8]',
    Paspartu: 'from-[#ffd4a3] to-[#ffc78f]',
  };
  return colors[first] || 'from-gray-500 to-gray-600';
}

/** timestamp'ten "şimdi / 5 dk önce / 2 sa önce" döndürür */
function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}

export function LiveSalesFeed({
  userName,
  userRole = 'yonetici',
  onLogout = () => {},
  onNavigate = () => {},
}: LiveSalesFeedProps = {}) {
  const [satislar, setSatislar] = useState<CanliSatis[]>([]);
  const [mekanlar, setMekanlar] = useState<Mekan[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchSatislar = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE}/stok/canli-satis`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSatislar(data.satislar || []);
      setMekanlar(data.mekanlar || []);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('[LiveSalesFeed] fetch hatası:', err);
      setError(err.message || 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yükleme
  useEffect(() => {
    fetchSatislar(true);
  }, [fetchSatislar]);

  // 30 saniyede bir otomatik yenile
  useEffect(() => {
    const interval = setInterval(() => fetchSatislar(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSatislar]);

  // Filtrelenmiş satışlar
  const filteredSatislar = satislar.filter((s) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'son1saat') {
      return Date.now() - new Date(s.timestamp).getTime() <= 3_600_000;
    }
    return s.mekanId === selectedFilter;
  });

  const stats = {
    totalSales: filteredSatislar.length,
    totalRevenue: filteredSatislar.reduce((sum, s) => sum + s.finalPrice, 0),
    averagePrice:
      filteredSatislar.length > 0
        ? Math.round(
            filteredSatislar.reduce((sum, s) => sum + s.finalPrice, 0) / filteredSatislar.length
          )
        : 0,
  };

  // Filtre listesi: sabit "Tümü" + her mekan + "Son 1 Saat"
  const filters = [
    { label: 'Tümü', value: 'all', emoji: null, color: null },
    ...mekanlar.map((m) => ({ label: m.name, value: m.id, emoji: m.emoji, color: m.color })),
    { label: 'Son 1 Saat', value: 'son1saat', emoji: '⏱', color: null },
  ];

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Canlı Satışlar</h1>
            <span className="text-3xl">⚡</span>
          </div>
          <button
            onClick={() => fetchSatislar(true)}
            className="p-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all active:scale-95"
            title="Yenile"
          >
            <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-gray-400">
          Ekip performansını anlık takip edin 📈
        </p>
        {lastUpdate && !loading && (
          <p className="text-xs text-gray-500 mt-1">
            Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>

      {/* Hata durumu */}
      {error && (
        <div className="px-6 mb-4">
          <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-300 font-medium">Veriler yüklenemedi</p>
              <p className="text-xs text-red-400 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => fetchSatislar(true)}
              className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-300 text-xs rounded-lg hover:bg-red-500/30 transition-all"
            >
              Tekrar dene
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center">
                <Package className="w-4 h-4 text-[#2d3748]" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalSales}</div>
            <div className="text-xs text-gray-400">Satış</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-[#2d3748]" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">₺{stats.totalRevenue.toLocaleString('tr-TR')}</div>
            <div className="text-xs text-gray-400">Toplam</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#744210]" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">₺{stats.averagePrice.toLocaleString('tr-TR')}</div>
            <div className="text-xs text-gray-400">Ortalama</div>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="px-6 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((f) => {
            const isActive = selectedFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setSelectedFilter(f.value)}
                className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#9dd9ea] text-[#2d3748] shadow-lg'
                    : 'bg-white/10 text-white border border-white/20 hover:border-[#9dd9ea]/60'
                }`}
                style={
                  !isActive && f.color
                    ? { borderColor: f.color + '80', color: f.color }
                    : {}
                }
              >
                {f.emoji && <span>{f.emoji}</span>}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* İçerik */}
      <div className="px-6 space-y-3">
        {/* Yükleniyor */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 border-2 border-[#9dd9ea] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Satışlar yükleniyor…</p>
          </div>
        )}

        {/* Boş durum */}
        {!loading && !error && filteredSatislar.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
              🛒
            </div>
            <p className="text-white font-semibold">Henüz satış yok</p>
            <p className="text-sm text-gray-400 text-center px-8">
              {selectedFilter === 'all'
                ? 'Bugün için henüz kayıtlı satış bulunmuyor.'
                : selectedFilter === 'son1saat'
                ? 'Son 1 saatte satış kaydedilmemiş.'
                : 'Bu mekanda bugün satış kaydedilmemiş.'}
            </p>
          </div>
        )}

        {/* Satış kartları */}
        {!loading &&
          filteredSatislar.map((satis, index) => {
            const productLabel = formatProduct(satis.items);
            const productGradient = getProductColor(satis.items);
            const timeLabel = formatRelativeTime(satis.timestamp);
            const staffInitial = satis.kaydeden?.charAt(0)?.toUpperCase() || '?';

            return (
              <div
                key={satis.id}
                className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 hover:shadow-md transition-all animate-in slide-in-from-right"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {/* Üst satır: personel + mekan + zaman */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center text-[#2d3748] font-bold text-sm shrink-0">
                    {staffInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">
                      {satis.kaydeden || 'Bilinmeyen'}
                    </div>
                    <div className="text-xs flex items-center gap-1 mt-0.5">
                      <span>{satis.mekanEmoji}</span>
                      <span style={{ color: satis.mekanColor || '#9dd9ea' }} className="truncate">
                        {satis.mekanAdi}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <Clock className="w-3 h-3" />
                    {timeLabel}
                  </div>
                </div>

                {/* Alt satır: ürün etiketi + fiyat */}
                <div className="flex items-center justify-between">
                  <div
                    className={`px-4 py-2 rounded-xl bg-gradient-to-r ${productGradient} text-white font-bold text-sm shadow-md max-w-[60%] truncate`}
                  >
                    {productLabel}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      ₺{satis.finalPrice.toLocaleString('tr-TR')}
                    </div>
                    {satis.discount > 0 && (
                      <div className="flex items-center gap-1 text-xs font-semibold text-[#ffd4a3] justify-end mt-0.5">
                        <Tag className="w-3 h-3" />
                        ₺{satis.discount.toLocaleString('tr-TR')} iskonto
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Canlı göstergesi */}
      <div className="fixed top-20 right-6 z-20">
        <div className="backdrop-blur-xl bg-white/10 rounded-full px-4 py-2 shadow-lg border border-white/20 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-400' : 'bg-[#a8e6cf] animate-pulse'}`} />
          <span className="text-xs font-semibold text-white">
            {error ? 'HATA' : 'CANLI'}
          </span>
        </div>
      </div>

      <NewBottomNav activeTab="live-feed" onTabChange={onNavigate} userRole={userRole} />
    </div>
  );
}
