/**
 * NewBottomNav — demo PillBottomNav ×1.56 ölçek
 * (mockup 240px → gerçek 375px = ×1.56)
 *
 * Demo → Gerçek:
 *   pill: px-2 py-1 gap-0.5  →  px-3 py-1.5 gap-1
 *   circle: w-7 h-7 = 28px   →  44px
 *   icon: w-3.5 h-3.5 = 14px →  18px
 *   badge: top-0.5 right-0.5 w-1.5 h-1.5  →  top:3 right:3 w:8 h:8
 */

import { Home, Zap, Trophy, MessageCircle, Users, Sparkles, Activity, Megaphone } from 'lucide-react';
import { motion } from 'motion/react';
import type { UserRole } from './login';

type IconComp = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

interface Tab {
  key:    string;
  icon:   IconComp;
  color:  string;
  badge?: boolean;
}

const ROLE_TABS: Record<string, Tab[]> = {
  'yonetici': [
    { key: 'dashboard', icon: Home,          color: '#a78bfa' },
    { key: 'live-feed', icon: Activity,      color: '#34d399' },
    { key: 'aspect-ai', icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging', icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',  icon: Users,         color: '#fb923c' },
  ],
  'ust-mudur': [
    { key: 'dashboard', icon: Home,          color: '#a78bfa' },
    { key: 'live-feed', icon: Activity,      color: '#34d399' },
    { key: 'aspect-ai', icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging', icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',  icon: Users,         color: '#fb923c' },
  ],
  'mudur': [
    { key: 'dashboard', icon: Home,          color: '#a78bfa' },
    { key: 'live-feed', icon: Activity,      color: '#34d399' },
    { key: 'aspect-ai', icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging', icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',  icon: Users,         color: '#fb923c' },
  ],
  'operasyon': [
    { key: 'dashboard',   icon: Home,          color: '#a78bfa' },
    { key: 'quick-sales', icon: Zap,           color: '#fb923c' },
    { key: 'aspect-ai',   icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging',   icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',    icon: Users,         color: '#fb923c' },
  ],
  'idari': [
    { key: 'dashboard',     icon: Home,          color: '#a78bfa' },
    { key: 'aspect-ai',     icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging',     icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'announcements', icon: Megaphone,     color: '#fb923c' },
    { key: 'rotation',      icon: Users,         color: '#fb923c' },
  ],
  'personel': [
    { key: 'dashboard',   icon: Home,          color: '#a78bfa' },
    { key: 'quick-sales', icon: Zap,           color: '#fb923c' },
    { key: 'aspect-ai',   icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging',   icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',    icon: Users,         color: '#34d399' },
  ],
  'bekleyen': [
    { key: 'dashboard', icon: Home, color: '#a78bfa' },
  ],
};

interface NewBottomNavProps {
  activeTab:    string;
  onTabChange?: (tab: string) => void;
  onNavigate?:  (tab: string) => void;
  userRole:     UserRole;
  unreadMessages?: number;
}

export function NewBottomNav({ activeTab, onTabChange, onNavigate, userRole, unreadMessages = 0 }: NewBottomNavProps) {
  const handleNav = onNavigate || onTabChange || (() => {});
  const tabs      = ROLE_TABS[userRole] ?? ROLE_TABS['personel'];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {/*
       * Demo pill: flex items-center rounded-full border border-white/15 px-2 py-1 gap-0.5
       * Gerçek (×1.56): px-3 py-1.5 gap-1
       */}
      <div
        className="flex items-center rounded-full border border-white/15"
        style={{
          padding:              '6px 12px',
          gap:                  4,
          background:           'rgba(10,5,30,0.92)',
          backdropFilter:       'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          boxShadow:            '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {tabs.map(tab => {
          const Icon     = tab.icon;
          const isActive = activeTab === tab.key || (!activeTab && tab.key === 'dashboard');

          return (
            /* Demo: relative flex items-center justify-center — NO labels */
            <button
              key={tab.key}
              onClick={() => handleNav(tab.key)}
              className="relative flex items-center justify-center transition-all active:scale-90"
            >
              {isActive ? (
                /*
                 * Demo active: motion.div w-7 h-7 (28px) rounded-full
                 *   bg color+'22'  border color+'45'  shadow color+'40'
                 *   icon w-3.5 h-3.5 (14px) strokeWidth 2.2
                 * Gerçek (×1.56): 44px, icon 18px
                 */
                <motion.div
                  layoutId="pill-nav-active"
                  className="relative flex items-center justify-center rounded-full"
                  style={{
                    width:     44,
                    height:    44,
                    background: tab.color + '22',
                    border:    `1px solid ${tab.color}45`,
                    boxShadow: `0 0 10px ${tab.color}40`,
                  }}
                  transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                >
                  <Icon
                    style={{ width: 18, height: 18, color: tab.color }}
                    strokeWidth={2.2}
                  />
                  {tab.badge && unreadMessages > 0 && (
                    /* Demo: top-0.5 right-0.5 w-1.5 h-1.5 bg-rose-500 border-[#0a051e] */
                    <span
                      className="absolute rounded-full bg-rose-500 border border-[#0a051e] flex items-center justify-center"
                      style={{ top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px', fontSize: 9, color: 'white', fontWeight: 900 }}
                    >
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </motion.div>
              ) : (
                /*
                 * Demo inactive: div w-7 h-7 rounded-full
                 *   icon w-3.5 h-3.5 text-gray-600 strokeWidth 1.8
                 * Gerçek: 44px, icon 18px
                 */
                <div
                  className="relative flex items-center justify-center rounded-full"
                  style={{ width: 44, height: 44 }}
                >
                  <Icon
                    className="text-gray-600"
                    style={{ width: 18, height: 18 }}
                    strokeWidth={1.8}
                  />
                  {tab.badge && unreadMessages > 0 && (
                    <span
                      className="absolute rounded-full bg-rose-500 border border-[#0a051e] flex items-center justify-center"
                      style={{ top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px', fontSize: 9, color: 'white', fontWeight: 900 }}
                    >
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}