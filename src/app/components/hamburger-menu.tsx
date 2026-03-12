/**
 * HamburgerMenu — Bölüm başlıklı (OPERASYON, GENEL, HESAP) glassmorphism sağ panel.
 * Tüm itemlar role bazlı filtrelenir; aktif sekme vurgulanır.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Home, Zap, Activity, MapPin, RotateCcw, Camera,
  Trophy, Sparkles, MessageCircle, Bell, GraduationCap,
  Cake, User, Settings, LogOut, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserRole } from './login';

/* ─────────────────────── Types ─────────────────────── */
type IconComp = React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;

interface MenuItem {
  icon:    IconComp;
  label:   string;
  tab?:    string;
  action?: () => void;
  danger?: boolean;
  roles:   UserRole[];
}

interface Section {
  title: string;
  color: string;  // accent rengi
  items: MenuItem[];
}

/* ─────────────────────── Rol meta ──────────────────── */
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
  'operasyon': 'Operasyon Yön.',
  'personel':  'Personel',
  'idari':     'İdari Görevli',
  'bekleyen':  'Onay Bekliyor',
};

const ROLE_AVATARS: Record<UserRole, string> = {
  'yonetici':  '👑',
  'ust-mudur': '🏢',
  'mudur':     '💼',
  'operasyon': '⚡',
  'personel':  '📸',
  'idari':     '📋',
  'bekleyen':  '⏳',
};

function shortName(name: string) {
  const p = name.trim().split(' ');
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0];
}

/* ─────────────────────── Sections ──────────────────── */
function getSections(
  role: UserRole,
  onNavigate: (t: string) => void,
  onLogout: () => void,
  close: () => void,
  activeTab: string,
): Section[] {
  const go = (tab: string) => { onNavigate(tab); close(); };

  const all:  UserRole[] = ['yonetici','ust-mudur','mudur','operasyon','idari','personel','bekleyen'];
  const mgmt: UserRole[] = ['yonetici','ust-mudur','mudur','operasyon','idari'];
  const ops:  UserRole[] = ['yonetici','ust-mudur','mudur','operasyon'];

  const sections: Section[] = [
    {
      title: 'GENEL',
      color: '#a78bfa',
      items: [
        { icon: Home,          label: 'Dashboard',        roles: all,  action: () => go('dashboard')   },
        { icon: MessageCircle, label: 'Mesajlar',          roles: all,  action: () => go('messaging')   },
        { icon: Trophy,        label: 'Liderlik Tablosu',  roles: all,  action: () => go('leaderboard') },
        { icon: Sparkles,      label: 'Aspect AI',         roles: all,  action: () => go('aspect-ai')   },
      ],
    },
    {
      title: 'OPERASYON',
      color: '#fb923c',
      items: [
        { icon: Zap,          label: 'Hızlı Satış',   roles: ops,  action: () => go('quick-sales')     },
        { icon: Activity,     label: 'Canlı Feed',    roles: mgmt, action: () => go('live-feed')       },
        { icon: MapPin,       label: 'Mekanlar',      roles: mgmt, action: () => go('business-panel')  },
        { icon: RotateCcw,    label: 'Rotasyon',      roles: all,  action: () => go('rotation')        },
        { icon: Camera,       label: 'Kare Takibi',   roles: all,  action: () => go('frame-tracking')  },
      ],
    },
    {
      title: 'YÖNETİM',
      color: '#34d399',
      items: [
        { icon: Bell,          label: 'Duyurular',     roles: all,  action: () => go('announcements')      },
        { icon: GraduationCap, label: 'Akademi',       roles: all,  action: () => go('academy')            },
        { icon: Cake,          label: 'Doğum Günleri', roles: mgmt, action: () => go('birthday-calendar')  },
      ],
    },
    {
      title: 'HESAP',
      color: '#60a5fa',
      items: [
        { icon: User,    label: 'Profil',    roles: all, action: () => go('profile')  },
        { icon: Settings,label: 'Ayarlar',   roles: all, action: () => go('settings') },
        { icon: LogOut,  label: 'Çıkış Yap', roles: all, danger: true, action: () => { close(); onLogout(); } },
      ],
    },
  ];

  // Her section'daki itemları role göre filtrele, boş section'ları kaldır
  return sections
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(role)) }))
    .filter(s => s.items.length > 0);
}

/* ─────────────────────── Props ─────────────────────── */
interface HamburgerMenuProps {
  userName:   string;
  userRole:   UserRole;
  onLogout:   () => void;
  onNavigate: (tab: string) => void;
  activeTab?: string;
}

/* ─────────────────────── Component ─────────────────── */
export function HamburgerMenu({
  userName,
  userRole,
  onLogout,
  onNavigate,
  activeTab = '',
}: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  const sections  = getSections(userRole, onNavigate, onLogout, close, activeTab);
  const roleColor = ROLE_COLORS[userRole] ?? '#a855f7';
  const roleTitle = ROLE_TITLES[userRole] ?? '';
  const roleAvatar= ROLE_AVATARS[userRole] ?? '👤';

  return (
    <>
      {/* ── Trigger ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
        style={{
          width:          40,
          height:         40,
          background:     'rgba(10,5,30,0.92)',
          border:         '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(32px)',
        }}
      >
        {/* Üç çizgi (hamburger) */}
        <div className="flex flex-col gap-[5px] items-center justify-center">
          <div className="w-[15px] h-[1.5px] rounded-full bg-white/60" />
          <div className="w-[11px] h-[1.5px] rounded-full bg-white/40 self-start ml-[2px]" />
          <div className="w-[15px] h-[1.5px] rounded-full bg-white/60" />
        </div>
      </button>

      {createPortal(
        <>
          {/* ── Overlay ── */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={close}
                className="fixed inset-0 z-[9998]"
                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
              />
            )}
          </AnimatePresence>

          {/* ── Panel ── */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="fixed top-0 right-0 bottom-0 z-[9999] flex flex-col overflow-hidden"
                style={{
                  width:      272,
                  background: 'linear-gradient(170deg, #120830 0%, #1a0a3c 45%, #0f0620 100%)',
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {/* ── Header ── */}
                <div
                  className="px-4 pt-5 pb-4 flex-shrink-0"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Logo satırı + kapat */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                      >
                        <span style={{ fontSize: 11 }}>✦</span>
                      </div>
                      <span
                        className="font-black tracking-widest uppercase"
                        style={{ fontSize: 10, color: '#a78bfa', letterSpacing: '0.18em' }}
                      >
                        Aspect Ops
                      </span>
                    </div>
                    <button
                      onClick={close}
                      className="w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border:     '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      <X className="w-3.5 h-3.5 text-white/70" />
                    </button>
                  </div>

                  {/* Kullanıcı kartı */}
                  <div
                    className="flex items-center gap-3 rounded-2xl p-3"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border:     '1px solid rgba(255,255,255,0.09)',
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${roleColor}33, ${roleColor}18)`,
                        border:     `1px solid ${roleColor}30`,
                        boxShadow:  `0 0 14px ${roleColor}22`,
                      }}
                    >
                      {roleAvatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{shortName(userName)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: roleColor, boxShadow: `0 0 5px ${roleColor}` }}
                        />
                        <span
                          className="font-semibold truncate"
                          style={{ fontSize: 10, color: roleColor }}
                        >
                          {roleTitle}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Menü bölümleri ── */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
                  {sections.map((section) => (
                    <div key={section.title}>

                      {/* Bölüm başlığı */}
                      <div className="flex items-center gap-2 px-1 mb-1.5">
                        <div
                          className="h-px flex-1 rounded-full"
                          style={{ background: `linear-gradient(to right, ${section.color}40, transparent)` }}
                        />
                        <span
                          className="font-black tracking-widest flex-shrink-0"
                          style={{ fontSize: 9, color: section.color, letterSpacing: '0.15em', opacity: 0.8 }}
                        >
                          {section.title}
                        </span>
                        <div
                          className="h-px flex-1 rounded-full"
                          style={{ background: `linear-gradient(to left, ${section.color}40, transparent)` }}
                        />
                      </div>

                      {/* Bölüm itemları */}
                      <div className="space-y-1">
                        {section.items.map(item => {
                          const Icon = item.icon;
                          const isActive = item.tab
                            ? activeTab === item.tab
                            : false;

                          return (
                            <motion.button
                              key={item.label}
                              onClick={item.action}
                              whileTap={{ scale: 0.97 }}
                              className="w-full flex items-center gap-3 rounded-xl transition-all"
                              style={{
                                padding:    '9px 11px',
                                background: item.danger
                                  ? 'rgba(239,68,68,0.07)'
                                  : isActive
                                    ? `${section.color}15`
                                    : 'rgba(255,255,255,0.04)',
                                border: item.danger
                                  ? '1px solid rgba(239,68,68,0.18)'
                                  : isActive
                                    ? `1px solid ${section.color}35`
                                    : '1px solid rgba(255,255,255,0.06)',
                              }}
                            >
                              {/* İkon kabı */}
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: item.danger
                                    ? 'rgba(239,68,68,0.12)'
                                    : isActive
                                      ? `${section.color}25`
                                      : 'rgba(255,255,255,0.06)',
                                  border: item.danger
                                    ? '1px solid rgba(239,68,68,0.2)'
                                    : isActive
                                      ? `1px solid ${section.color}40`
                                      : '1px solid rgba(255,255,255,0.08)',
                                }}
                              >
                                <Icon
                                  style={{
                                    width:  14,
                                    height: 14,
                                    color:  item.danger ? '#f87171' : isActive ? section.color : 'rgba(255,255,255,0.45)',
                                  }}
                                  strokeWidth={isActive ? 2.2 : 1.8}
                                />
                              </div>

                              {/* Label */}
                              <span
                                className="flex-1 text-left font-semibold"
                                style={{
                                  fontSize: 13,
                                  color: item.danger
                                    ? '#f87171'
                                    : isActive
                                      ? '#fff'
                                      : 'rgba(226,232,240,0.85)',
                                  fontWeight: isActive ? 700 : 500,
                                }}
                              >
                                {item.label}
                              </span>

                              {/* Sağ ok / aktif nokta */}
                              {isActive ? (
                                <div
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: section.color, boxShadow: `0 0 6px ${section.color}` }}
                                />
                              ) : (
                                <ChevronRight
                                  style={{ width: 13, height: 13, flexShrink: 0 }}
                                  className={item.danger ? 'text-red-400/60' : 'text-white/20'}
                                />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Footer versiyon notu ── */}
                <div
                  className="px-4 py-3 flex-shrink-0 flex items-center justify-between"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>
                    ASPECT OPERATIONS
                  </span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>
                    v2.0
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </>
  );
}