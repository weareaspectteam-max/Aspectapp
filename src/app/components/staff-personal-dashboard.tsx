import { TrendingUp, Zap, Target, Award, DollarSign, Percent } from 'lucide-react';
import { StaffTopBar } from './staff-top-bar';
import { CurrencyWidget } from './currency-widget';

interface StaffPersonalDashboardProps {
  userName: string;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

export function StaffPersonalDashboard({ userName, onLogout = () => {}, onNavigate = () => {} }: StaffPersonalDashboardProps) {
  // Mock data - In a real app, this would come from props or API
  const todayStats = {
    totalSales: 12,
    discountRate: 8.5,
    revenue: 8400,
  };

  const monthlyStats = {
    performanceScore: 87.3, // Calculated from discount % and revenue ratio
    salesCount: 156,
    targetRevenue: 120000,
    actualRevenue: 104760,
    averageDiscount: 9.2,
  };

  // Calculate revenue percentage
  const revenuePercentage = (monthlyStats.actualRevenue / monthlyStats.targetRevenue) * 100;

  // Performance score breakdown
  const discountScore = Math.max(0, 100 - (monthlyStats.averageDiscount * 5)); // Lower discount = better score
  const revenueScore = revenuePercentage;
  const performanceScore = (discountScore * 0.4 + revenueScore * 0.6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-32">
      {/* Staff Top Bar */}
      <StaffTopBar
        userName={userName}
        userRole="personel"
        onLogout={onLogout}
        onNavigate={onNavigate}
      />
      
      {/* Header with Greeting */}
      <div className="px-6 pt-24 pb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center text-3xl shadow-lg border-2 border-white/20">
              😊
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Merhaba, {userName}! 👋</h1>
              <p className="text-sm text-gray-400 mt-1">Bugünkü performansın harika gidiyor!</p>
            </div>
          </div>
          
          {/* Today's Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="backdrop-blur-xl bg-gradient-to-br from-[#9dd9ea]/20 to-transparent border border-[#9dd9ea]/30 rounded-2xl p-3 text-center">
              <Zap className="w-5 h-5 text-[#9dd9ea] mx-auto mb-1" />
              <div className="text-xl font-black text-white">{todayStats.totalSales}</div>
              <div className="text-[10px] text-gray-400 font-semibold">Satış</div>
            </div>
            
            <div className="backdrop-blur-xl bg-gradient-to-br from-[#ffd4a3]/20 to-transparent border border-[#ffd4a3]/30 rounded-2xl p-3 text-center">
              <Percent className="w-5 h-5 text-[#ffd4a3] mx-auto mb-1" />
              <div className="text-xl font-black text-white">%{todayStats.discountRate}</div>
              <div className="text-[10px] text-gray-400 font-semibold">İskonto</div>
            </div>
            
            <div className="backdrop-blur-xl bg-gradient-to-br from-[#a8e6cf]/20 to-transparent border border-[#a8e6cf]/30 rounded-2xl p-3 text-center">
              <DollarSign className="w-5 h-5 text-[#a8e6cf] mx-auto mb-1" />
              <div className="text-xl font-black text-white">₺{todayStats.revenue.toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 font-semibold">Ciro</div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Performance Score */}
      <div className="px-6 pb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-[#2d3748]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Aylık Performans Oranı</h2>
              <p className="text-xs text-gray-400">Şubat 2026 Değerlendirmesi</p>
            </div>
          </div>

          {/* Performance Score Circle */}
          <div className="relative w-48 h-48 mx-auto mb-6">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
              {/* Background Circle */}
              <circle
                cx="100"
                cy="100"
                r="85"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="20"
                fill="none"
              />
              {/* Progress Circle */}
              <circle
                cx="100"
                cy="100"
                r="85"
                stroke="url(#gradient)"
                strokeWidth="20"
                fill="none"
                strokeDasharray={`${(performanceScore / 100) * 534} 534`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9dd9ea" />
                  <stop offset="50%" stopColor="#a8e6cf" />
                  <stop offset="100%" stopColor="#ffd4a3" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Center Score */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-5xl font-black text-white">{performanceScore.toFixed(1)}</div>
              <div className="text-sm text-gray-400 font-semibold">/ 100</div>
              <div className="text-xs text-[#a8e6cf] font-bold mt-1">
                {performanceScore >= 90 ? '🏆 Mükemmel' : performanceScore >= 75 ? '⭐ Harika' : performanceScore >= 60 ? '👍 İyi' : '📈 Gelişebilir'}
              </div>
            </div>
          </div>

          {/* Performance Breakdown */}
          <div className="space-y-3">
            {/* Discount Score */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#ffd4a3]" />
                  <span className="text-sm font-bold text-white">İskonto Performansı</span>
                </div>
                <span className="text-sm font-black text-[#ffd4a3]">{discountScore.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f] rounded-full transition-all duration-1000"
                  style={{ width: `${discountScore}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Ortalama İskonto: <span className="font-bold text-white">%{monthlyStats.averageDiscount}</span>
              </p>
            </div>

            {/* Revenue Score - REMOVED */}
          </div>
        </div>
      </div>

      {/* Monthly Stats Cards */}
      <div className="px-6 pb-6">
        <h3 className="text-lg font-black text-white mb-3">📊 Aylık Özet</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="backdrop-blur-xl bg-gradient-to-br from-[#9dd9ea]/20 to-transparent border border-[#9dd9ea]/30 rounded-2xl p-4 shadow-lg">
            <TrendingUp className="w-6 h-6 text-[#9dd9ea] mb-2" />
            <div className="text-2xl font-black text-white mb-1">{monthlyStats.salesCount}</div>
            <div className="text-xs text-gray-400 font-semibold">Toplam Satış</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-[#ffd4a3]/20 to-transparent border border-[#ffd4a3]/30 rounded-2xl p-4 shadow-lg">
            <Award className="w-6 h-6 text-[#ffd4a3] mb-2" />
            <div className="text-2xl font-black text-white mb-1">{monthlyStats.averageDiscount.toFixed(1)}%</div>
            <div className="text-xs text-gray-400 font-semibold">Ortalama İskonto</div>
          </div>
        </div>
      </div>

      {/* Currency Widget */}
      <div className="px-6 pb-6">
        <CurrencyWidget />
      </div>

      {/* Performance Tips */}
      <div className="px-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-[#ffd4a3]/20 to-transparent border border-[#ffd4a3]/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Performans İpucu</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                {performanceScore >= 85 
                  ? 'Harika gidiyorsun! Bu performansı sürdürürsen bu ayın yıldız personeli olabilirsin! 🌟'
                  : monthlyStats.averageDiscount > 10
                  ? 'İskonto oranını %10\'un altına çekersen performans puanın artacak. Müşterileri ikna etmeye çalış! 💪'
                  : monthlyStats.salesCount < 150
                  ? 'Satış sayını artırırsan daha yüksek performans puanı alabilirsin. 15\'li albüm satışlarına odaklan! 📸'
                  : 'Harika performans! İskonto oranın dengeli. Böyle devam! 🚀'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}