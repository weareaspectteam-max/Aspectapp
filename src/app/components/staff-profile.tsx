import { Package, TrendingUp, Tag, Calendar, Trophy, Target, GraduationCap, LogOut } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { NewBottomNav } from './new-bottom-nav';

interface StaffProfileProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function StaffProfile({ userName, userRole, onLogout, onNavigate }: StaffProfileProps) {
  const profileData = {
    name: userName,
    avatar: '👨‍💼',
    rank: 2,
    totalRevenue: 38200,
    totalSales: 142,
    weeklyPerformance: 94,
    estimatedBonus: 5730,
    discountRate: 12,
    totalDiscountGiven: 4800,
  };

  const weeklyData = [
    { day: 'Pzt', revenue: 4200 },
    { day: 'Sal', revenue: 5100 },
    { day: 'Çar', revenue: 6800 },
    { day: 'Per', revenue: 5900 },
    { day: 'Cum', revenue: 7200 },
    { day: 'Cmt', revenue: 4500 },
    { day: 'Paz', revenue: 4500 },
  ];

  const achievements = [
    { id: 1, name: 'İlk 100 Satış', icon: '🎯', unlocked: true },
    { id: 2, name: 'Haftalık Lider', icon: '👑', unlocked: true },
    { id: 3, name: 'Müşteri Favorisi', icon: '⭐', unlocked: true },
    { id: 4, name: 'Satış Rekoru', icon: '🔥', unlocked: false },
    { id: 5, name: 'Mükemmel Ay', icon: '💎', unlocked: false },
    { id: 6, name: 'Ekip Lideri', icon: '🏆', unlocked: false },
  ];

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Profile Card */}
      <div className="px-6 mb-6">{/* Removed pt-6 for staff role */}
        <div className="bg-gradient-to-br from-[#ffd4a3] via-[#ffe5b4] to-[#9dd9ea] rounded-3xl p-6 text-[#2d3748] shadow-2xl border-2 border-white/20">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white bg-opacity-20 backdrop-blur flex items-center justify-center text-4xl border-2 border-white shadow-xl">
                {profileData.avatar}
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">{profileData.name}</h2>
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <span className="text-lg">🏆</span>
                  <span>#{profileData.rank} Sırada</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white bg-opacity-15 backdrop-blur rounded-2xl p-4">
              <div className="text-sm opacity-80 mb-1 flex items-center gap-1">
                <span>Toplam Satış</span>
                <span className="text-base">🎯</span>
              </div>
              <div className="text-3xl font-bold">{profileData.totalSales}</div>
            </div>
            <div className="bg-white bg-opacity-15 backdrop-blur rounded-2xl p-4">
              <div className="text-sm opacity-80 mb-1 flex items-center gap-1">
                <span>Performans</span>
                <span className="text-base">⚡</span>
              </div>
              <div className="text-3xl font-bold">{profileData.weeklyPerformance}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center mb-3">
              <Package className="w-5 h-5 text-[#2d3748]" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{profileData.totalSales}</div>
            <div className="text-xs text-gray-400">Toplam Satış</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-[#2d3748]" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{profileData.weeklyPerformance}%</div>
            <div className="text-xs text-gray-400">Performans</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center mb-3">
              <Tag className="w-5 h-5 text-[#744210]" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">%{profileData.discountRate}</div>
            <div className="text-xs text-gray-400">İskonto Oranı</div>
          </div>
        </div>
      </div>

      {/* Weekly Performance Chart */}
      <div className="px-6 mb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#9dd9ea]" />
            Haftalık Performans
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height={192} minWidth={0}>
              <AreaChart data={weeklyData}>
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis key="xaxis" dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis key="yaxis" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  key="tooltip"
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    color: '#fff',
                  }}
                />
                <Area
                  key="area-revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#9dd9ea"
                  strokeWidth={3}
                  fill="#9dd9ea"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="px-6 mb-6">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#ffd4a3]" />
          Başarılar
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`rounded-2xl p-4 border-2 text-center transition-all ${
                achievement.unlocked
                  ? 'backdrop-blur-xl bg-gradient-to-br from-white/15 to-white/10 border-[#9dd9ea] shadow-md'
                  : 'backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/3 border-white/20 opacity-50'
              }`}
            >
              <div className="text-3xl mb-2">{achievement.icon}</div>
              <div className="text-xs font-semibold text-white leading-tight">
                {achievement.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="px-6">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-[#a8e6cf]" />
          Hedefler
        </h3>
        <div className="space-y-3">
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">Aylık Satış Hedefi</span>
              <span className="text-sm font-bold text-[#9dd9ea]">142/150</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] rounded-full transition-all"
                style={{ width: '95%' }}
              ></div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">Gelir Hedefi</span>
              <span className="text-sm font-bold text-[#a8e6cf]">₺38,200/₺40,000</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] rounded-full transition-all"
                style={{ width: '95.5%' }}
              ></div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">Müşteri Memnuniyeti</span>
              <span className="text-sm font-bold text-[#ffd4a3]">94/100</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f] rounded-full transition-all"
                style={{ width: '94%' }}
              ></div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 rounded-2xl p-4 border-2 border-[#ffd4a3]/30 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#ffd4a3]" />
                <span className="text-sm font-semibold text-white">İskonto Performansı</span>
              </div>
              <span className="text-sm font-bold text-[#ffd4a3]">%{profileData.discountRate}</span>
            </div>
            <div className="text-xs text-gray-400 mb-2">
              Toplam ₺{profileData.totalDiscountGiven.toLocaleString()} iskonto verildi
            </div>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f] rounded-full transition-all"
                style={{ width: `${profileData.discountRate}%` }}
              ></div>
            </div>
            <div className="text-xs text-[#a8e6cf] font-semibold mt-2">
              ✓ Hedef: %15 altında - Harika! 🎯
            </div>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="px-6 mt-6 pb-6">
        {/* Aspect Academy Button */}
        <button
          onClick={() => onNavigate('academy')}
          className="w-full bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] py-4 rounded-2xl font-bold text-base hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg mb-3"
        >
          <GraduationCap className="w-6 h-6" />
          <span>Aspect Akademi</span>
          <span className="text-lg">🎓</span>
        </button>
        
        <button
          onClick={onLogout}
          className="w-full bg-gradient-to-r from-destructive to-[#dc2626] text-white py-4 rounded-2xl font-semibold text-base hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg"
        >
          <LogOut className="w-5 h-5" />
          Çıkış Yap
        </button>
      </div>

      {/* Bottom Navigation - Only for staff */}
      {['personel', 'operasyon', 'bekleyen'].includes(userRole) && (
        <NewBottomNav
          activeTab="profile"
          onTabChange={onNavigate}
          userRole={userRole}
        />
      )}
    </div>
  );
}