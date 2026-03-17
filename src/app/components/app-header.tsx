/**
 * AppHeader — demo header-bar-demo.tsx PhoneContent + VarA
 * Ölçek: telefon mockup 240px → gerçek 375px = ×1.56
 *
 * Demo orijinal değerleri → gerçek değerler:
 *   header:      px-2.5 pt-2 pb-1.5 gap:4  →  px-3 pt-2.5 pb-2 gap:6
 *   pill:        gap-1.5 pl-1 pr-2 py-1     →  gap:6px pl:4px pr:8px py:4px (Tailwind birebir)
 *   icon circle: w-6 h-6 = 24px             →  36px
 *   icon:        w-3 h-3 = 12px             →  16px
 *   name:        text-[8px] font-black       →  13px
 *   role:        text-[6.5px] font-bold      →  10px
 *   ASPECT:      fontSize:11 ls:0.15em       →  14px (aynı kalır, zaten küçük)
 *   sub-label:   text-[6px]                  →  9px
 *   bell+menu:   w-7 h-7 = 28px             →  40px
 *   gap sağ:     gap-1                       →  gap-1.5
 */

import { BellRing, Bell, Shield, ArrowLeft, Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { HamburgerMenu } from './hamburger-menu';
import type { UserRole } from './login';

const PAGE_LABELS: Record<string, string> = {
  'dashboard':           'Dashboard',
  'home':                'Dashboard',
  'quick-sales':         'Operasyon',
  'live-feed':           'Canlı Feed',
  'leaderboard':         'Liderlik',
  'messaging':           'Mesajlar',
  'rotation':            'Rotasyon',
  'rotation-system':     'Rotasyon',
  'profile':             'Profil',
  'settings':            'Ayarlar',
  'academy':             'Akademi',
  'aspect-ai':           'Aspect AI',
  'aspect-ai-page':      'Aspect AI',
  'business-panel':      'İşletme',
  'mekan-management':    'Mekan Yönetimi',
  'user-management':     'Kullanıcılar',
  'isletme-genel-durum': 'Genel Durum',
  'equipment-page':      'Ekipman',
  'stock-distribution':  'Stok Dağılımı',
  'resource-management': 'Kaynaklar',
  'cost-management':     'Giderler',
  'location-visits':     'Ziyaretler',
  'manager-reports':     'Raporlar',
  'birthday-calendar':   'Doğum Günleri',
  'announcements':       'Duyurular',
  'frame-tracking':      'Kare Takibi',
  'operations-demo':     'Demo',
  'header-demo':         'Demo',
};

const PAGE_COLORS: Record<string, string> = {
  'quick-sales':         '#fb923c',
  'live-feed':           '#34d399',
  'leaderboard':         '#fbbf24',
  'messaging':           '#60a5fa',
  'rotation':            '#fb923c',
  'rotation-system':     '#fb923c',
  'profile':             '#a78bfa',
  'settings':            '#94a3b8',
  'academy':             '#f472b6',
  'aspect-ai':           '#f472b6',
  'aspect-ai-page':      '#f472b6',
  'business-panel':      '#60a5fa',
  'mekan-management':    '#34d399',
  'user-management':     '#a78bfa',
  'isletme-genel-durum': '#fb923c',
  'equipment-page':      '#60a5fa',
  'stock-distribution':  '#34d399',
  'resource-management': '#fbbf24',
  'cost-management':     '#fb923c',
  'location-visits':     '#60a5fa',
  'manager-reports':     '#a78bfa',
  'birthday-calendar':   '#f472b6',
  'announcements':       '#fb923c',
  'frame-tracking':      '#60a5fa',
};

const ROLE_COLORS: Record<UserRole, string> = {
  'yonetici':  '#a855f7',
  'ust-mudur': '#7c3aed',
  'mudur':     '#6366f1',
  'operasyon': '#fb923c',
  'personel':  '#34d399',
  'idari':     '#60a5fa',
  'bekleyen':  '#9ca3af',
};

const ROLE_TITLES: Record<UserRole, string> = {
  'yonetici':  'Yönetici',
  'ust-mudur': 'Üst Müdür',
  'mudur':     'Müdür',
  'operasyon': 'Operasyon',
  'personel':  'Personel',
  'idari':     'İdari Görevli',
  'bekleyen':  'Bekleyen',
};

interface AppHeaderProps {
  userName:         string;
  userRole:         UserRole;
  userId?:          string;
  activeTab:        string;
  onNavigate:       (tab: string) => void;
  onLogout:         () => void;
  hasNotification?: boolean;
  onBellClick?:     () => void;
  notificationCount?: number;
}

export function AppHeader({
  userName,
  userRole,
  userId = '',
  activeTab,
  onNavigate,
  onLogout,
  hasNotification = true,
  onBellClick,
  notificationCount = 0,
}: AppHeaderProps) {
  const isDash    = !activeTab || activeTab === 'dashboard' || activeTab === 'home';
  const pageLabel = PAGE_LABELS[activeTab] ?? 'Dashboard';
  const pageColor = PAGE_COLORS[activeTab] ?? ROLE_COLORS[userRole] ?? '#a855f7';
  const roleColor = ROLE_COLORS[userRole]  ?? '#a855f7';
  const roleTitle = ROLE_TITLES[userRole]  ?? 'Kullanıcı';
  const c         = isDash ? roleColor : pageColor;

  /* "Özgür Durmuş" → "Özgür D." */
  const parts       = userName.trim().split(' ');
  const displayName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0] || 'Kullanıcı';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50"
    >
      {/*
       * Demo: px-2.5 pt-2 pb-1.5 gap:4
       * Gerçek (×1.56): px-4 pt-3 pb-2.5 gap:6
       */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
          alignItems:          'center',
          gap:                 6,
          padding:             '10px 14px 8px',
        }}
      >

        {/* ── SOL: VarA Pill ── */}
        <div className="flex items-center overflow-hidden">
          {/*
           * Demo pill: gap-1.5 pl-1 pr-2 py-1 (gap:6 pl:4 pr:8 py:4)
           * Gerçek (×1.56): gap:6 pl:4 pr:10 py:4  ← demo ile neredeyse aynı
           */}
          <div
            className="flex items-center flex-shrink-0"
            style={{
              gap:                  6,
              padding:              '4px 10px 4px 4px',
              borderRadius:         9999,
              background:           'rgba(10,5,30,0.9)',
              border:               `1px solid ${c}40`,
              backdropFilter:       'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow:            `0 0 12px ${c}25`,
            }}
          >
            {/*
             * Demo icon dairesi: w-6 h-6 = 24px, icon w-3 h-3 = 12px
             * Gerçek (×1.5): 36px, icon 16px
             */}
            <button
              onClick={isDash ? undefined : () => onNavigate('dashboard')}
              className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
              style={{
                width:     36,
                height:    36,
                borderRadius: 9999,
                background: `${c}20`,
                border:    `1.5px solid ${c}55`,
                boxShadow: isDash ? 'none' : `0 0 8px ${c}50`,
                cursor:    isDash ? 'default' : 'pointer',
              }}
            >
              {/* Demo: conditional render, NO animation */}
              {isDash
                ? <Shield   size={16} style={{ color: c }} strokeWidth={2.5} />
                : <ArrowLeft size={16} style={{ color: c }} strokeWidth={2.5} />
              }
            </button>

            {/* Demo: flex flex-col leading-none */}
            <div className="flex flex-col leading-none">
              {/* Demo: text-[8px] font-black white → 13px */}
              <span className="text-white font-black" style={{ fontSize: 13 }}>
                {displayName}
              </span>
              {/* Demo: text-[6.5px] font-bold color:c → 10px */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={activeTab || 'dash'}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="font-bold"
                  style={{ fontSize: 10, color: c, marginTop: 1 }}
                >
                  {isDash ? roleTitle : pageLabel}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── ORTA: ASPECT + sayfa adı ── */}
        {/*
         * Demo: ASPECT fontSize:11 ls:0.15em
         *       sub-label text-[6px] font-semibold
         * Gerçek: 14px / 9px (görsel olarak demo ile orantılı)
         */}
        <div className="flex flex-col items-center flex-shrink-0">
          <span
            className="font-black leading-none"
            style={{
              fontSize:             20,
              letterSpacing:        '0.15em',
              background:           'linear-gradient(90deg,#c084fc,#e879f9,#818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}
          >
            ASPECT
          </span>
        </div>

        {/* ── SAĞ: Zil + Menü ── */}
        {/* Demo: flex items-center justify-end gap-1 → gerçek gap-1.5 */}
        <div className="flex items-center justify-end" style={{ gap: 6 }}>

          {/*
           * Demo bell: w-7 h-7 = 28px, dark bg, orange border+icon, orange dot
           * Gerçek (×1.5): 40px
           */}
          <button
            className="relative flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
            onClick={onBellClick}
            style={{
              width:          40,
              height:         40,
              borderRadius:   9999,
              background:     'rgba(10,5,30,0.9)',
              border:         (hasNotification || notificationCount > 0)
                                ? '1px solid rgba(251,146,60,0.5)'
                                : '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(32px)',
            }}
          >
            {(hasNotification || notificationCount > 0)
              ? <BellRing size={16} style={{ color: '#fb923c' }} />
              : <Bell     size={16} className="text-gray-600" />
            }
            {notificationCount > 0 && (
              <span
                className="absolute rounded-full bg-orange-400 border border-[#0a051e] flex items-center justify-center"
                style={{
                  top: notificationCount > 9 ? 2 : 4,
                  right: notificationCount > 9 ? 2 : 4,
                  minWidth: notificationCount > 9 ? 16 : 12,
                  height: notificationCount > 9 ? 16 : 12,
                  fontSize: 8,
                  fontWeight: 700,
                  color: '#0a051e',
                  paddingInline: notificationCount > 9 ? 2 : 0,
                }}
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
            {notificationCount === 0 && (hasNotification) && (
              <span
                className="absolute rounded-full bg-orange-400 border border-[#0a051e]"
                style={{ top: 5, right: 5, width: 7, height: 7 }}
              />
            )}
          </button>

          {/*
           * Demo menu: w-7 h-7 = 28px, dark bg, white/15 border, Menu icon text-white/55
           * Gerçek (×1.5): 40px
           */}
          <HamburgerMenu
            userName={userName}
            userRole={userRole}
            userId={userId}
            onLogout={onLogout}
            onNavigate={onNavigate}
            activeTab={activeTab}
          />
        </div>
      </div>
    </div>
  );
}