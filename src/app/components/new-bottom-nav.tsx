/**
 * NewBottomNav — alt gezinme çubuğu.
 *
 * Görsel kaplama 2026-09: tam genişlik "dock", etiketli sekmeler, aktif sekmede
 * üstten ışık çizgisi + ikon parıltısı. Sekme listesi (ROLE_TABS), sıra ve
 * onNavigate davranışı DEĞİŞMEDİ; yalnızca görünüm. Stiller: src/styles/skin.css (.sk-dock*)
 */

import { Home, Zap, Trophy, MessageCircle, Users, Sparkles, Activity, Megaphone, Settings } from 'lucide-react';
// Trophy zaten import edildi — aspect-ai yerine kullanılacak
import { motion } from 'motion/react';
import type { UserRole } from './login';
import { skVars } from '../lib/skin';

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
    { key: 'dashboard', icon: Home,          color: 'var(--app-accent, #a855f7)' },
    { key: 'live-feed', icon: Activity,      color: '#34d399' },
    { key: 'aspect-ai', icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging', icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',  icon: Users,         color: '#fb923c' },
  ],
  'ust-mudur': [
    { key: 'dashboard', icon: Home,          color: 'var(--app-accent, #a855f7)' },
    { key: 'live-feed', icon: Activity,      color: '#34d399' },
    { key: 'aspect-ai', icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging', icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',  icon: Users,         color: '#fb923c' },
  ],
  'mudur': [
    { key: 'dashboard',   icon: Home,          color: 'var(--app-accent, #a855f7)' },
    { key: 'live-feed',   icon: Activity,      color: '#34d399' },
    { key: 'quick-sales', icon: Zap,           color: '#fb923c' },
    { key: 'aspect-ai',   icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging',   icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',    icon: Users,         color: '#fb923c' },
  ],
  'operasyon': [
    { key: 'dashboard',   icon: Home,          color: 'var(--app-accent, #a855f7)' },
    { key: 'quick-sales', icon: Zap,           color: '#fb923c' },
    { key: 'aspect-ai',   icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging',   icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',    icon: Users,         color: '#fb923c' },
  ],
  'idari': [
    { key: 'dashboard',     icon: Home,          color: 'var(--app-accent, #a855f7)' },
    { key: 'aspect-ai',     icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging',     icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'announcements', icon: Megaphone,     color: '#fb923c' },
    { key: 'rotation',      icon: Users,         color: '#fb923c' },
  ],
  'personel': [
    { key: 'dashboard',   icon: Home,          color: 'var(--app-accent, #a855f7)' },
    { key: 'quick-sales', icon: Zap,           color: '#fb923c' },
    { key: 'aspect-ai',   icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging',   icon: MessageCircle, color: '#60a5fa', badge: true },
    { key: 'rotation',    icon: Users,         color: '#34d399' },
  ],
  'tedarikci': [
    { key: 'dashboard', icon: Home,     color: '#f97316' },
    { key: 'settings',  icon: Settings, color: '#9ca3af' },
  ],
  'bekleyen': [
    { key: 'dashboard', icon: Home, color: 'var(--app-accent, #a855f7)' },
  ],
};

/* Sekme etiketleri — yalnızca görünüm; key'ler ve yönlendirme aynı */
const TAB_LABELS: Record<string, string> = {
  'dashboard':     'Ana',
  'live-feed':     'Feed',
  'quick-sales':   'Satış',
  'aspect-ai':     'AI',
  'messaging':     'Mesaj',
  'rotation':      'Rotasyon',
  'announcements': 'Duyuru',
  'settings':      'Ayarlar',
};

interface NewBottomNavProps {
  activeTab:           string;
  onTabChange?:        (tab: string) => void;
  onNavigate?:         (tab: string) => void;
  userRole:            UserRole;
  unreadMessages?:     number;
  effectiveCompanyId?: string;
}

export function NewBottomNav({ activeTab, onTabChange, onNavigate, userRole, unreadMessages = 0, effectiveCompanyId = 'aspect' }: NewBottomNavProps) {
  const handleNav  = onNavigate || onTabChange || (() => {});
  // AI tab'ı bekleyen hariç tüm rollerde ve tüm şirketlerde gösterilir
  const rawTabs    = ROLE_TABS[userRole] ?? ROLE_TABS['personel'];
  const tabs       = rawTabs;
  const few        = tabs.length <= 2;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ padding: '0 16px max(8px, env(safe-area-inset-bottom))' }}
    >
      <div className={`sk-dock${few ? ' sk-dock--few' : ''}`}>
        {tabs.map(tab => {
          const Icon     = tab.icon;
          const isActive = activeTab === tab.key || (!activeTab && tab.key === 'dashboard');
          const label    = TAB_LABELS[tab.key] ?? tab.key;
          const showBadge = tab.badge && unreadMessages > 0;

          return (
            <button
              key={tab.key}
              onClick={() => handleNav(tab.key)}
              className={`sk-dock__item${isActive ? ' sk-dock__item--on' : ''}`}
              style={skVars(tab.color)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <>
                  <motion.span
                    layoutId="dock-light"
                    className="sk-dock__light"
                    transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                  />
                  <span className="sk-dock__glow" />
                </>
              )}
              <Icon
                className="sk-dock__icon"
                style={{ width: 22, height: 22 }}
                strokeWidth={isActive ? 2.2 : 1.9}
              />
              <span>{label}</span>
              {showBadge && (
                <span className="sk-dock__badge">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
