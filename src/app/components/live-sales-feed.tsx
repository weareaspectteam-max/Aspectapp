import { useState, useEffect } from 'react';
import { Filter, TrendingUp, DollarSign, Package, Clock, Tag, ArrowLeft } from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';

interface LiveSale {
  id: string;
  staff: string;
  project: string;
  product: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  time: string;
  timestamp: Date;
}

interface LiveSalesFeedProps {
  userName?: string;
  userRole?: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

export function LiveSalesFeed({ userName, userRole = 'yonetici', onLogout = () => {}, onNavigate = () => {} }: LiveSalesFeedProps = {}) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [locationData, setLocationData] = useState<{ [key: string]: { emoji: string; color: string } }>({});
  const [sales, setSales] = useState<LiveSale[]>([
    {
      id: '1',
      staff: 'Ahmet Yılmaz',
      project: 'ZOKA Beach Club',
      product: "3'lü",
      price: 600,
      originalPrice: 600,
      discount: 0,
      time: 'şimdi',
      timestamp: new Date(),
    },
    {
      id: '2',
      staff: 'Mehmet Kaya',
      project: 'Balık Hali',
      product: "2× 5'li",
      price: 1800,
      originalPrice: 2000,
      discount: 200,
      time: '2 dk önce',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
    },
    {
      id: '3',
      staff: 'Ayşe Demir',
      project: 'ZOKA Beach Club',
      product: "7'li",
      price: 1100,
      originalPrice: 1400,
      discount: 300,
      time: '5 dk önce',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
    },
    {
      id: '5',
      staff: 'Ahmet Yılmaz',
      project: 'Tekne Turu',
      product: "9'lu",
      price: 2000,
      originalPrice: 2000,
      discount: 0,
      time: '12 dk önce',
      timestamp: new Date(Date.now() - 12 * 60 * 1000),
    },
    {
      id: '6',
      staff: 'Mehmet Kaya',
      project: 'Balık Hali',
      product: "11'li + Paspartu",
      price: 2400,
      originalPrice: 2900,
      discount: 500,
      time: '15 dk önce',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
    },
  ]);

  // localStorage kaldırıldı - KV store entegrasyonu yapılacak
  useEffect(() => {
    // Boş başlıyoruz - mekan verisi KV store'dan gelecek
    if (false) {
      const locations: any[] = [];
      const data: { [key: string]: { emoji: string; color: string } } = {};
      locations.forEach((loc: any) => {
        data[loc.name] = { emoji: loc.emoji, color: loc.color };
        // Also add short names for backward compatibility
        if (loc.name.includes('Beach')) {
          data['ZOKA'] = { emoji: loc.emoji, color: loc.color };
        }
      });
      setLocationData(data);
    }
  }, []);

  const getLocationInfo = (projectName: string) => {
    return locationData[projectName] || { emoji: '📍', color: '#9dd9ea' };
  };

  const liveSales: LiveSale[] = sales;

  const stats = {
    totalSales: liveSales.length,
    totalRevenue: liveSales.reduce((sum, sale) => sum + sale.price, 0),
    averagePrice: liveSales.length > 0 
      ? Math.round(liveSales.reduce((sum, sale) => sum + sale.price, 0) / liveSales.length)
      : 0,
  };

  const handleResetSales = () => {
    if (window.confirm('Tüm satışları sıfırlamak istediğinizden emin misiniz?')) {
      setSales([]);
    }
  };

  const filters = [
    { label: 'Tümü', value: 'tümü' },
    { label: 'ZOKA', value: 'zoka' },
    { label: 'Balık Hali', value: 'balık hali' },
    { label: 'Hayal Kahvesi', value: 'hayal kahvesi' },
    { label: 'Son 1 Saat', value: 'son 1 saat' },
  ];

  const getProductColor = (product: string) => {
    const colors: { [key: string]: string } = {
      "3'lü": 'from-[#9dd9ea] to-[#7ec8dd]',
      "5'li": 'from-[#b8d4f1] to-[#9cc0e8]',
      "7'li": 'from-[#d4b5f7] to-[#c79ff0]',
      "9'lu": 'from-[#ffb3d9] to-[#ff99cc]',
      "11'li": 'from-[#ffe5b4] to-[#ffd89b]',
      "15'li": 'from-[#a8e6cf] to-[#8dd9b8]',
      Paspartu: 'from-[#ffd4a3] to-[#ffc78f]',
    };
    return colors[product] || 'from-gray-500 to-gray-600';
  };

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Canlı Satışlar</h1>
            <span className="text-3xl">⚡</span>
          </div>
          {['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(userRole) && (
            <button
              onClick={handleResetSales}
              className="px-4 py-2 bg-gradient-to-br from-[#ff5555] to-[#ff3333] text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-white/20"
            >
              Satışları Sıfırla
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400">Ekip performansını anlık takip edin 📈</p>
      </div>

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
            <div className="text-2xl font-bold text-white">₺{stats.totalRevenue}</div>
            <div className="text-xs text-gray-400">Toplam</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#744210]" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">₺{stats.averagePrice}</div>
            <div className="text-xs text-gray-400">Ortalama</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter) => {
            const locationInfo = getLocationInfo(filter.label);
            const isActive = selectedFilter === filter.value;
            
            return (
              <button
                key={filter.value}
                onClick={() => setSelectedFilter(filter.value)}
                className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#9dd9ea] text-[#2d3748] shadow-lg'
                    : 'bg-white/10 text-white border border-white/20 hover:border-[#9dd9ea]'
                }`}
                style={
                  !isActive && filter.label !== 'Tümü' && filter.label !== 'Son 1 Saat'
                    ? { borderColor: locationInfo.color + '80' }
                    : {}
                }
              >
                {filter.label !== 'Tümü' && filter.label !== 'Son 1 Saat' && (
                  <span>{locationInfo.emoji}</span>
                )}
                <span
                  style={
                    !isActive && filter.label !== 'Tümü' && filter.label !== 'Son 1 Saat'
                      ? { color: locationInfo.color }
                      : {}
                  }
                >
                  {filter.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Sales Feed */}
      <div className="px-6 space-y-3">
        {liveSales.map((sale, index) => {
          const locationInfo = getLocationInfo(sale.project);
          
          return (
            <div
              key={sale.id}
              className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 hover:shadow-md transition-all animate-in slide-in-from-right"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center text-[#2d3748] font-bold">
                  {sale.staff.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{sale.staff}</div>
                  <div className="text-xs flex items-center gap-1">
                    <span>{locationInfo.emoji}</span>
                    <span style={{ color: locationInfo.color }}>{sale.project}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {sale.time}
                </div>
              </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`px-4 py-2 rounded-xl bg-gradient-to-r ${getProductColor(
                    sale.product
                  )} text-white font-bold text-sm shadow-md`}
                >
                  {sale.product}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">₺{sale.price}</div>
                {sale.discount && sale.discount > 0 && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-[#ffd4a3] justify-end mt-1">
                    <Tag className="w-3 h-3" />
                    ₺{sale.discount} iskonto
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Live Indicator */}
      <div className="fixed top-20 right-6 z-20">
        <div className="backdrop-blur-xl bg-white/10 rounded-full px-4 py-2 shadow-lg border border-white/20 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#a8e6cf] animate-pulse"></div>
          <span className="text-xs font-semibold text-white">CANLI</span>
        </div>
      </div>

      {/* Bottom Navigation */}
      <NewBottomNav
        activeTab="live-feed"
        onTabChange={onNavigate}
        userRole={userRole}
      />
    </div>
  );
}