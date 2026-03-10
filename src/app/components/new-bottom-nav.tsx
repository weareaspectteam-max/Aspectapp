import { Home, Zap, Trophy, MessageCircle, User, Users, Sparkles, Activity } from 'lucide-react';

interface NewBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'admin' | 'staff';
}

export function NewBottomNav({ activeTab, onTabChange, userRole }: NewBottomNavProps) {
  const tabs = userRole === 'admin' 
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'live-feed', label: 'Canlı', icon: Activity },
        { id: 'aspect-ai', label: 'Aspect AI', icon: Sparkles },
        { id: 'messaging', label: 'Mesajlar', icon: MessageCircle },
        { id: 'rotation', label: 'Rotasyon', icon: Users },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'quick-sales', label: 'Operasyon', icon: Zap },
        { id: 'leaderboard', label: 'Liderlik', icon: Trophy },
        { id: 'aspect-ai', label: 'Aspect AI', icon: Sparkles },
        { id: 'messaging', label: 'Mesajlar', icon: MessageCircle },
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-gradient-to-b from-[#2a2a3a] to-[#2f3439] border-t border-white/10 z-50 max-w-[480px] mx-auto safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all ${
                isActive
                  ? 'bg-gradient-to-b from-[#9dd9ea]/20 to-transparent'
                  : 'hover:bg-white/10'
              }`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] shadow-lg shadow-[#9dd9ea]/30 scale-110'
                    : 'bg-transparent'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-[#2d3748]' : 'text-gray-400'
                  }`}
                />
              </div>
              <span
                className={`text-xs font-semibold transition-colors ${
                  isActive ? 'text-[#9dd9ea]' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}