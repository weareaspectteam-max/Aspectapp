import { Trophy, TrendingUp, Target, Award, Medal, Tag } from 'lucide-react';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';

interface StaffMember {
  rank: number;
  name: string;
  revenue: number;
  salesCount: number;
  performanceScore: number;
  discountRate: number;
  avatar: string;
}

interface LeaderboardProps {
  userName: string;
  userRole: 'admin' | 'staff';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function Leaderboard({ userName, userRole, onLogout, onNavigate }: LeaderboardProps) {
  const staffMembers: StaffMember[] = [
    {
      rank: 1,
      name: 'Ahmet Yılmaz',
      revenue: 42500,
      salesCount: 156,
      performanceScore: 98,
      discountRate: 8,
      avatar: '👨‍💼',
    },
    {
      rank: 2,
      name: 'Mehmet Kaya',
      revenue: 38200,
      salesCount: 142,
      performanceScore: 94,
      discountRate: 12,
      avatar: '👨',
    },
    {
      rank: 3,
      name: 'Ayşe Demir',
      revenue: 35800,
      salesCount: 128,
      performanceScore: 91,
      discountRate: 15,
      avatar: '👩',
    },
    {
      rank: 4,
      name: 'Zeynep Şahin',
      revenue: 31200,
      salesCount: 115,
      performanceScore: 87,
      discountRate: 18,
      avatar: '👩‍🦰',
    },
    {
      rank: 5,
      name: 'Can Özkan',
      revenue: 28900,
      salesCount: 102,
      performanceScore: 84,
      discountRate: 22,
      avatar: '👨‍🦱',
    },
    {
      rank: 6,
      name: 'Elif Yıldız',
      revenue: 24600,
      salesCount: 94,
      performanceScore: 79,
      discountRate: 25,
      avatar: '👩‍💼',
    },
  ];

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bg: 'bg-gradient-to-br from-[#ffe5b4] to-[#ffd89b]',
          border: 'border-[#ffe5b4]',
          icon: Trophy,
          shadow: 'shadow-xl shadow-[#ffe5b4]/20',
        };
      case 2:
        return {
          bg: 'bg-gradient-to-br from-[#d6e0ec] to-[#c1cede]',
          border: 'border-[#d6e0ec]',
          icon: Medal,
          shadow: 'shadow-lg shadow-[#d6e0ec]/20',
        };
      case 3:
        return {
          bg: 'bg-gradient-to-br from-[#ffcba4] to-[#ffb68f]',
          border: 'border-[#ffcba4]',
          icon: Award,
          shadow: 'shadow-lg shadow-[#ffcba4]/20',
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-[#b8d4f1] to-[#a7c7e7]',
          border: 'border-border',
          icon: Target,
          shadow: '',
        };
    }
  };

  const topThree = staffMembers.slice(0, 3);
  const others = staffMembers.slice(3);

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Sticky Top Bar */}
      {userRole === 'staff' && (
        <StaffTopBar
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          onNavigate={onNavigate}
          onBack={() => onNavigate('home')}
          showBackButton={true}
        />
      )}

      {/* Podium - Top 3 with summer vibes */}
      <div className="px-6 pt-6 mb-6">{/* Added pt-6 for spacing */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-end justify-center gap-4 mb-6">
            {/* 2nd Place */}
            <div className="flex-1 text-center">
              <div className="relative inline-block mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#d6e0ec] to-[#c1cede] flex items-center justify-center text-3xl border-4 border-white shadow-xl">
                  {topThree[1].avatar}
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-[#d6e0ec] to-[#c1cede] flex items-center justify-center border-2 border-white shadow-lg">
                  <span className="text-sm font-bold text-[#2d3748]">2</span>
                </div>
              </div>
              <div className="font-semibold text-sm text-white mb-1">{topThree[1].name}</div>
              <div className="text-3xl font-bold text-white mb-1">{topThree[1].salesCount}</div>
              <div className="text-xs text-gray-400">satış 🥈</div>
              {userRole === 'admin' && (
                <div className="text-sm font-bold text-[#a8e6cf] mt-1">
                  {topThree[1].revenue.toLocaleString('tr-TR')} ₺
                </div>
              )}
              <div className="flex items-center justify-center gap-1 text-xs font-semibold text-[#ffd4a3] mt-1">
                <Tag className="w-3 h-3" />
                %{topThree[1].discountRate}
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex-1 text-center -mt-8">
              <div className="relative inline-block mb-3">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ffe5b4] to-[#ffd89b] flex items-center justify-center text-4xl border-4 border-white shadow-2xl shadow-[#ffe5b4]/50 animate-pulse">
                  {topThree[0].avatar}
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <div className="text-4xl animate-bounce">👑</div>
                </div>
              </div>
              <div className="font-bold text-base text-white mb-1">{topThree[0].name}</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-[#ffe5b4] to-[#ffd89b] bg-clip-text text-transparent mb-1">{topThree[0].salesCount}</div>
              <div className="text-xs text-gray-400">satış 🏆</div>
              {userRole === 'admin' && (
                <div className="text-base font-bold text-[#a8e6cf] mt-1">
                  {topThree[0].revenue.toLocaleString('tr-TR')} ₺
                </div>
              )}
              <div className="flex items-center justify-center gap-1 text-xs font-semibold text-[#a8e6cf] mt-1">
                <Tag className="w-3 h-3" />
                %{topThree[0].discountRate}
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex-1 text-center">
              <div className="relative inline-block mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ffcba4] to-[#ffb68f] flex items-center justify-center text-3xl border-4 border-white shadow-xl">
                  {topThree[2].avatar}
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-[#ffcba4] to-[#ffb68f] flex items-center justify-center border-2 border-white shadow-lg">
                  <span className="text-sm font-bold text-[#744210]">3</span>
                </div>
              </div>
              <div className="font-semibold text-sm text-white mb-1">{topThree[2].name}</div>
              <div className="text-3xl font-bold text-white mb-1">{topThree[2].salesCount}</div>
              <div className="text-xs text-gray-400">satış 🥉</div>
              {userRole === 'admin' && (
                <div className="text-sm font-bold text-[#a8e6cf] mt-1">
                  {topThree[2].revenue.toLocaleString('tr-TR')} ₺
                </div>
              )}
              <div className="flex items-center justify-center gap-1 text-xs font-semibold text-[#ffd4a3] mt-1">
                <Tag className="w-3 h-3" />
                %{topThree[2].discountRate}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Other Rankings */}
      <div className="px-6 space-y-3">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          Diğer Sıralamalar
          <span>🌟</span>
        </h3>
        {others.map((member) => {
          const style = getRankStyle(member.rank);
          return (
            <div
              key={member.rank}
              className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3">
                {/* Rank Badge */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-md">
                  <span className="text-xl font-bold text-[#2d3748]">{member.rank}</span>
                </div>

                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center text-2xl border-2 border-white shadow-lg">
                  {member.avatar}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="font-semibold text-white">{member.name}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <span className="text-lg">🎯</span>
                    {member.salesCount} satış
                    {userRole === 'admin' && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="text-[#a8e6cf] font-semibold">{member.revenue.toLocaleString('tr-TR')} ₺</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <div className="text-3xl font-bold bg-gradient-to-r from-[#b8d4f1] to-[#9dd9ea] bg-clip-text text-transparent">
                    {member.salesCount}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-xs font-semibold text-[#ffd4a3]">
                    <Tag className="w-3 h-3" />
                    %{member.discountRate}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Motivational Banner - Summer vibes */}
      <div className="px-6 mt-6">
        <div className="bg-gradient-to-r from-[#ffd4a3] via-[#ffe5b4] to-[#9dd9ea] rounded-3xl p-6 text-[#2d3748] shadow-2xl border-2 border-white">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">☀️</span>
            <h3 className="font-bold text-xl">Harika Gidiyorsun!</h3>
          </div>
          <p className="text-sm opacity-95 leading-relaxed">
            Her satış seni zirveye bir adım daha yaklaştırıyor! Yaz sezonu daha yeni başladı, hedeflerine ulaşmak için enerjini koru! 🏖️🚀
          </p>
        </div>
      </div>

      {/* Bottom Navigation - Only for staff */}
      {userRole === 'staff' && (
        <NewBottomNav
          activeTab="leaderboard"
          onTabChange={onNavigate}
          userRole={userRole}
        />
      )}
    </div>
  );
}