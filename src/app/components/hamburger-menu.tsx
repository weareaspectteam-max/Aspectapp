/**
 * HamburgerMenu — Bölüm başlıklı (OPERASYON, GENEL, HESAP) glassmorphism sağ panel.
 * Tüm itemlar role bazlı filtrelenir; aktif sekme vurgulanır.
 * yonetici rolü için altta "YÖNETİCİ AYARLARI" accordion bölümü gösterilir.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Home, Zap, Activity, MapPin, RotateCcw,
  Trophy, Sparkles, MessageCircle, Bell, GraduationCap,
  Cake, User, Settings, LogOut, ChevronRight, Package,
  BarChart2, ClipboardList, CalendarDays, FileBarChart, Wallet, Gamepad2,
  ChevronDown, Crown, Sliders, Brain, Globe, Loader2, Users, DollarSign, TrendingUp,
  AlertTriangle, Building2, Eye, ArrowLeftRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserRole } from './login';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

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
  'yonetici':   '#a855f7',
  'ust-mudur':  '#7c3aed',
  'mudur':      '#6366f1',
  'operasyon':  '#fb923c',
  'personel':   '#34d399',
  'idari':      '#60a5fa',
  'bekleyen':   '#9ca3af',
  'superadmin': '#fbbf24',
};

const ROLE_TITLES: Record<UserRole, string> = {
  'yonetici':   'Yönetici',
  'ust-mudur':  'Üst Müdür',
  'mudur':      'Müdür',
  'operasyon':  'Operasyon Yön.',
  'personel':   'Personel',
  'idari':      'İdari Görevli',
  'bekleyen':   'Onay Bekliyor',
  'superadmin': 'Süper Yönetici',
};

const ROLE_AVATARS: Record<UserRole, string> = {
  'yonetici':   '👑',
  'ust-mudur':  '🏢',
  'mudur':      '💼',
  'operasyon':  '⚡',
  'personel':   '📸',
  'idari':      '📋',
  'bekleyen':   '⏳',
  'superadmin': '⚡',
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
  companyId: string = 'aspect',
): Section[] {
  const go = (tab: string) => { onNavigate(tab); close(); };

  const all:  UserRole[] = ['yonetici','ust-mudur','mudur','operasyon','idari','personel','bekleyen','superadmin'];
  const mgmt: UserRole[] = ['yonetici','ust-mudur','mudur','operasyon','idari','superadmin'];
  const ops:  UserRole[] = ['yonetici','ust-mudur','mudur','operasyon','superadmin'];

  // Aspect AI yalnızca aspect şirketinde görünür
  const isAspect = companyId === 'aspect';

  const sections: Section[] = [
    {
      title: 'YÖNETİCİ HIZLI ERİŞİM',
      color: '#34d399',
      items: [
        { icon: Activity,      label: 'Canlı Feed',          roles: ['yonetici','ust-mudur'] as UserRole[],                                   action: () => go('live-feed')              },
        { icon: ClipboardList, label: 'İzin Çizelgesi',       roles: ['yonetici','ust-mudur','mudur','idari'] as UserRole[],                    action: () => go('personel-izin-cetveli')  },
        { icon: TrendingUp,    label: 'Prim Takip',           roles: ['yonetici','ust-mudur','mudur','idari'] as UserRole[],                    action: () => go('prim-takip')             },
        { icon: FileBarChart,  label: 'Vardiya Raporları',    roles: ['yonetici','ust-mudur','mudur','idari'] as UserRole[],                    action: () => go('vardiya-raporlari')      },
        { icon: BarChart2,     label: 'İşletme Genel Durum',  roles: ['yonetici','ust-mudur','mudur','idari'] as UserRole[],                    action: () => go('isletme-genel-durum')    },
      ],
    },
    {
      title: 'GENEL',
      color: '#a78bfa',
      items: [
        { icon: Home,          label: 'Dashboard',        roles: all,  action: () => go('dashboard')   },
        { icon: MessageCircle, label: 'Mesajlar',          roles: all,  action: () => go('messaging')   },
        { icon: Trophy,        label: 'Liderlik Tablosu',  roles: all,  action: () => go('leaderboard') },
        ...(isAspect ? [{ icon: Sparkles as IconComp, label: 'Aspect AI', roles: all as UserRole[], action: () => go('aspect-ai') } as MenuItem] : [] as MenuItem[]),
        { icon: GraduationCap, label: 'Akademi',           roles: all,  action: () => go('academy')     },
      ],
    },
    {
      title: 'OPERASYON',
      color: '#fb923c',
      items: [
        { icon: Zap,       label: 'Operasyon Paneli', roles: all, action: () => go('quick-sales')   },
        { icon: RotateCcw, label: 'Rotasyon',          roles: ['yonetici','ust-mudur','mudur','operasyon','idari','personel'] as UserRole[], action: () => go('rotation')       },
        { icon: Bell,      label: 'Duyurular',         roles: all,                                                              action: () => go('announcements') },
      ],
    },
    {
      title: 'MALZEME & STOK',
      color: '#38bdf8',
      items: [
        { icon: Package,   label: 'Malzeme Yönetimi', roles: all, action: () => go('equipment-page')      },
        { icon: BarChart2, label: 'Stok Dağılımı',    roles: all, action: () => go('stock-distribution') },
      ],
    },
    {
      title: 'PERSONEL PANELİ',
      color: '#fbbf24',
      items: [
        { icon: Wallet,       label: 'Primlerim',              roles: ['yonetici','ust-mudur','mudur','operasyon','idari','personel'] as UserRole[], action: () => go('personel-prim-takip')  },
        { icon: CalendarDays, label: 'İzin Talebi',            roles: ['operasyon','personel'] as UserRole[],                                        action: () => go('personel-izin-talebi') },
        { icon: CalendarDays, label: 'Kişisel İzin Çizelgesi', roles: ['yonetici','ust-mudur','mudur','operasyon','idari','personel'] as UserRole[], action: () => go('kisisel-izin-cetveli') },
      ],
    },
    {
      title: 'OYUN',
      color: '#22d3ee',
      items: [
        { icon: Gamepad2, label: 'Aspect Runner 🏃', roles: ['yonetici','ust-mudur','mudur','operasyon','idari','personel'] as UserRole[], action: () => go('aspect-runner') },
        { icon: Gamepad2, label: 'Aspect Quest 🗺️',  roles: ['yonetici','ust-mudur','mudur','operasyon','idari','personel'] as UserRole[], action: () => go('aspect-quest')  },
      ],
    },
    {
      title: 'HESAP',
      color: '#60a5fa',
      items: [
        { icon: User,     label: 'Profil',     roles: all, action: () => go('profile') },
        { icon: Settings, label: 'Ayarlar',    roles: all, action: () => go('settings') },
        { icon: LogOut,   label: 'Çıkış Yap',  roles: all, danger: true, action: () => { close(); onLogout(); } },
      ],
    },
  ];

  // Her section'daki itemları role göre filtrele, boş section'ları kaldır
  return sections
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(role)) }))
    .filter(s => s.items.length > 0);
}

/* ─────────────────── Toggle Switch ─────────────────── */
function ToggleSwitch({
  enabled,
  onToggle,
  loading = false,
  color = '#a855f7',
}: {
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
  color?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      disabled={loading}
      style={{
        width: 42,
        height: 24,
        borderRadius: 12,
        background: enabled ? color : 'rgba(255,255,255,0.12)',
        border: `1px solid ${enabled ? color + '60' : 'rgba(255,255,255,0.15)'}`,
        position: 'relative',
        transition: 'all 0.2s',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 3px',
        boxShadow: enabled ? `0 0 10px ${color}40` : 'none',
      }}
    >
      {loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.6)' }} className="animate-spin" />
        </div>
      ) : (
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
            transition: 'transform 0.2s',
            transform: enabled ? 'translateX(18px)' : 'translateX(0px)',
          }}
        />
      )}
    </button>
  );
}

/* ─────────────────────── Props ─────────────────────── */
interface HamburgerMenuProps {
  userName:          string;
  userRole:          UserRole;
  userId?:           string;
  onLogout:          () => void;
  onNavigate:        (tab: string) => void;
  activeTab?:        string;
  isSuperAdmin?:     boolean;
  ghostCompanyId?:   string | null;
  effectiveCompanyId?: string;
  onSwitchCompany?:  (companyId: string | null) => void;
}

/* ─────────────────────── Component ─────────────────── */
export function HamburgerMenu({
  userName,
  userRole,
  userId = '',
  onLogout,
  onNavigate,
  activeTab = '',
  isSuperAdmin = false,
  ghostCompanyId = null,
  effectiveCompanyId = 'aspect',
  onSwitchCompany,
}: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  /* ── Admin section state ── */
  const [adminOpen, setAdminOpen]             = useState(false);
  const [openSubSection, setOpenSubSection]   = useState<string | null>(null);
  const [aiPersonal, setAiPersonal]           = useState(true);
  const [aiYonetim, setAiYonetim]             = useState(true);
  const [aiIdari, setAiIdari]                 = useState(true);
  const [aiPersonel, setAiPersonel]           = useState(true);
  const [aiOperasyon, setAiOperasyon]         = useState(true);
  const [toggleLoading, setToggleLoading]     = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded]   = useState(false);

  const sections  = getSections(userRole, onNavigate, onLogout, close, activeTab, effectiveCompanyId);
  const roleColor = ROLE_COLORS[userRole] ?? '#a855f7';
  const roleTitle = ROLE_TITLES[userRole] ?? '';
  const roleAvatar= ROLE_AVATARS[userRole] ?? '👤';

  const isYonetici = userRole === 'yonetici';
  const showAdminPanel = userRole === 'yonetici' || userRole === 'ust-mudur' || userRole === 'mudur' || userRole === 'idari';

  /* ── Ayarları yükle (menü açılınca, yonetici ise) ── */
  useEffect(() => {
    if (!isOpen || !isYonetici || settingsLoaded) return;
    authHeaders().then(headers =>
      fetch(`${API_BASE}/ai/toggle-settings`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setAiPersonal(data.ai_personal_yonetici !== false);
            setAiYonetim(data.ai_yonetim_enabled !== false);
            setAiIdari(data.ai_idari_enabled !== false);
            setAiPersonel(data.ai_personel_enabled !== false);
            setAiOperasyon(data.ai_operasyon_enabled !== false);
          }
          setSettingsLoaded(true);
        })
        .catch(() => setSettingsLoaded(true))
    ).catch(() => {});
  }, [isOpen, isYonetici, settingsLoaded]);

  /* ── Toggle handler factory ── */
  const makeToggle = (
    key: string,
    val: boolean,
    setter: (v: boolean) => void,
  ) => async () => {
    const newVal = !val;
    setToggleLoading(key);
    setter(newVal);
    try {
      const headers = await authHeaders();
      await fetch(`${API_BASE}/ai/toggle-settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ [key]: newVal }),
      });
    } catch (e) {
      console.error(`AI toggle hatası (${key}):`, e);
      setter(!newVal);
    } finally {
      setToggleLoading(null);
    }
  };

  const handleTogglePersonal  = makeToggle('ai_personal_yonetici', aiPersonal,  setAiPersonal);
  const handleToggleYonetim   = makeToggle('ai_yonetim_enabled',   aiYonetim,   setAiYonetim);
  const handleToggleIdari     = makeToggle('ai_idari_enabled',      aiIdari,     setAiIdari);
  const handleTogglePersonel  = makeToggle('ai_personel_enabled',   aiPersonel,  setAiPersonel);
  const handleToggleOperasyon = makeToggle('ai_operasyon_enabled',  aiOperasyon, setAiOperasyon);

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

                  {/* ── YÖNETİCİ AYARLARI — sadece yonetici rolü ── */}
                  {/* moved to bottom — see below */}

                  {sections.filter(s => s.title !== 'HESAP').map((section) => (
                    <div
                      key={section.title}
                      style={
                        section.title === 'YÖNETİCİ HIZLI ERİŞİM'
                          ? {
                              background: `linear-gradient(135deg, ${section.color}08, ${section.color}04)`,
                              border: `1px solid ${section.color}22`,
                              borderLeft: `3px solid ${section.color}70`,
                              borderRadius: 14,
                              padding: '10px 8px 8px',
                            }
                          : undefined
                      }
                    >

                      {/* Bölüm başlığı */}
                      <div className="flex items-center gap-2 px-1 mb-1.5">
                        <div
                          className="h-px flex-1 rounded-full"
                          style={{ background: `linear-gradient(to right, ${section.color}40, transparent)` }}
                        />
                        <span
                          className="font-black tracking-widest flex-shrink-0"
                          style={{
                            fontSize: 9,
                            color: section.color,
                            letterSpacing: '0.15em',
                            background: `${section.color}18`,
                            border: `1px solid ${section.color}35`,
                            borderRadius: 20,
                            padding: '2px 8px',
                            boxShadow: `0 0 8px ${section.color}20`,
                          }}
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
                                    ? `${section.color}18`
                                    : `${section.color}07`,
                                border: item.danger
                                  ? '1px solid rgba(239,68,68,0.18)'
                                  : isActive
                                    ? `1px solid ${section.color}45`
                                    : `1px solid ${section.color}18`,
                              }}
                            >
                              {/* İkon kabı */}
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: item.danger
                                    ? 'rgba(239,68,68,0.12)'
                                    : isActive
                                      ? `${section.color}30`
                                      : `${section.color}18`,
                                  border: item.danger
                                    ? '1px solid rgba(239,68,68,0.2)'
                                    : isActive
                                      ? `1px solid ${section.color}55`
                                      : `1px solid ${section.color}35`,
                                  boxShadow: isActive ? `0 0 8px ${section.color}30` : 'none',
                                }}
                              >
                                <Icon
                                  style={{
                                    width:  14,
                                    height: 14,
                                    color: item.danger
                                      ? '#f87171'
                                      : isActive
                                        ? section.color
                                        : `${section.color}cc`,
                                  }}
                                  strokeWidth={isActive ? 2.2 : 1.8}
                                />
                              </div>

                              {/* Label */}
                              <span
                                className="flex-1 text-left"
                                style={{
                                  fontSize: 13,
                                  color: item.danger
                                    ? '#f87171'
                                    : isActive
                                      ? '#fff'
                                      : `${section.color}cc`,
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
                                  style={{
                                    width: 13, height: 13, flexShrink: 0,
                                    color: item.danger ? 'rgba(248,113,113,0.5)' : `${section.color}60`,
                                  }}
                                />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* ── SÜPER YÖNETİM — sadece superadmin görür, gizli bölüm ── */}
                  {isSuperAdmin && onSwitchCompany && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(251,191,36,0.04))',
                      border: '1px solid rgba(251,191,36,0.35)',
                      borderLeft: '3px solid rgba(251,191,36,0.80)',
                      borderRadius: 14,
                      padding: '10px 8px 10px',
                    }}>
                      <div className="flex items-center gap-2 px-1 mb-3">
                        <div className="h-px flex-1 rounded-full" style={{ background: 'linear-gradient(to right, #fbbf2440, transparent)' }} />
                        <span className="font-black tracking-widest flex-shrink-0" style={{
                          fontSize: 9, color: '#fbbf24', letterSpacing: '0.15em',
                          background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.40)',
                          borderRadius: 20, padding: '2px 8px', boxShadow: '0 0 10px rgba(251,191,36,0.25)',
                        }}>
                          ⚡ SÜPER YÖNETİM
                        </span>
                        <div className="h-px flex-1 rounded-full" style={{ background: 'linear-gradient(to left, #fbbf2440, transparent)' }} />
                      </div>
                      <p style={{ fontSize: 10, color: 'rgba(251,191,36,0.55)', margin: '0 4px 10px', lineHeight: 1.5 }}>
                        Ghost mod — şirket geçişleri kaydedilmez, kapayınca Aspect'e döner.
                      </p>
                      {(['aspect', 'frame', 'tetra'] as const).map(cId => {
                        const isActive = (ghostCompanyId ?? 'aspect') === cId;
                        const configs: Record<string, { emoji: string; label: string; color: string }> = {
                          aspect: { emoji: '✦', label: 'Aspect Agency',  color: '#a855f7' },
                          frame:  { emoji: '🖼', label: 'Frame Studios', color: '#9dd9ea' },
                          tetra:  { emoji: '🔷', label: 'Tetra Works',   color: '#34d399' },
                        };
                        const cfg = configs[cId];
                        return (
                          <motion.button
                            key={cId}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => { onSwitchCompany(cId === 'aspect' ? null : cId); close(); }}
                            className="w-full flex items-center gap-3 rounded-xl mb-1.5"
                            style={{
                              padding: '10px 12px',
                              background: isActive ? `linear-gradient(135deg, ${cfg.color}25, ${cfg.color}12)` : 'rgba(255,255,255,0.04)',
                              border: isActive ? `1px solid ${cfg.color}55` : '1px solid rgba(255,255,255,0.09)',
                              boxShadow: isActive ? `0 0 14px ${cfg.color}20` : 'none',
                              transition: 'all 0.2s',
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                              background: isActive ? `${cfg.color}30` : 'rgba(255,255,255,0.06)',
                              border: `1px solid ${isActive ? cfg.color + '50' : 'rgba(255,255,255,0.12)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 16, boxShadow: isActive ? `0 0 10px ${cfg.color}40` : 'none',
                              transition: 'all 0.2s',
                            }}>
                              {cfg.emoji}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p style={{ fontSize: 12, fontWeight: 700, color: isActive ? cfg.color : 'rgba(255,255,255,0.60)', margin: 0 }}>
                                {cfg.label}
                              </p>
                              <p style={{ fontSize: 9, color: isActive ? `${cfg.color}80` : 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                                {isActive ? '👁 İzleniyor' : 'Geçiş yap'}
                              </p>
                            </div>
                            {isActive
                              ? <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />
                              : <ArrowLeftRight style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                            }
                          </motion.button>
                        );
                      })}
                      {ghostCompanyId && (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { onSwitchCompany(null); close(); }}
                          className="w-full flex items-center justify-center gap-2 rounded-xl mt-2"
                          style={{
                            padding: '9px', fontSize: 11, fontWeight: 700,
                            background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)',
                            color: '#fbbf24', cursor: 'pointer',
                          }}
                        >
                          ↩ Aspect'e Dön (Ghost Çık)
                        </motion.button>
                      )}

                      {/* Şirket Yönetim Paneli butonu */}
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { onNavigate('super-admin'); close(); }}
                        className="w-full flex items-center gap-3 rounded-xl mt-2"
                        style={{
                          padding: '11px 12px',
                          background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.10))',
                          border: '1px solid rgba(251,191,36,0.50)',
                          boxShadow: '0 0 16px rgba(251,191,36,0.15)',
                        }}
                      >
                        <div style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: 'rgba(251,191,36,0.22)', border: '1px solid rgba(251,191,36,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                          🏢
                        </div>
                        <div className="flex-1 text-left">
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>Şirket Yönetim Paneli</p>
                          <p style={{ margin: 0, fontSize: 9, color: 'rgba(251,191,36,0.55)' }}>Şirket oluştur, kullanıcı ekle</p>
                        </div>
                        <Globe style={{ width: 14, height: 14, color: 'rgba(251,191,36,0.60)', flexShrink: 0 }} />
                      </motion.button>
                    </div>
                  )}

                  {/* ── YÖNETİCİ PANELİ — en alta, HESAP'ın üstü ── */}
                  {showAdminPanel && (
                    <div
                      style={{
                        marginTop: 0,
                        background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.04))',
                        border: '1px solid rgba(168,85,247,0.22)',
                        borderLeft: '3px solid rgba(168,85,247,0.65)',
                        borderRadius: 14,
                        padding: '10px 8px 8px',
                      }}
                    >

                      {/* Bölüm ayırıcı */}
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <div
                          className="h-px flex-1 rounded-full"
                          style={{ background: 'linear-gradient(to right, #a855f740, transparent)' }}
                        />
                        <span
                          className="font-black tracking-widest flex-shrink-0"
                          style={{
                            fontSize: 9,
                            color: '#a855f7',
                            letterSpacing: '0.15em',
                            background: 'rgba(168,85,247,0.18)',
                            border: '1px solid rgba(168,85,247,0.35)',
                            borderRadius: 20,
                            padding: '2px 8px',
                            boxShadow: '0 0 8px rgba(168,85,247,0.2)',
                          }}
                        >
                          YÖNETİCİ PANELİ
                        </span>
                        <div
                          className="h-px flex-1 rounded-full"
                          style={{ background: 'linear-gradient(to left, #a855f740, transparent)' }}
                        />
                      </div>

                      {/* YÖNETİCİ AYARLARI ana accordion */}
                      <div
                        className="rounded-2xl overflow-hidden"
                        style={{
                          background: adminOpen ? 'rgba(168,85,247,0.10)' : 'rgba(168,85,247,0.05)',
                          border: adminOpen ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(168,85,247,0.18)',
                          boxShadow: adminOpen ? '0 0 20px rgba(168,85,247,0.15)' : 'none',
                          transition: 'all 0.25s',
                        }}
                      >
                        {/* Accordion başlık butonu */}
                        <button
                          onClick={() => setAdminOpen(v => !v)}
                          className="w-full flex items-center gap-3 transition-all active:scale-[0.98]"
                          style={{ padding: '11px 13px' }}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: adminOpen ? 'rgba(168,85,247,0.30)' : 'rgba(168,85,247,0.18)',
                              border: adminOpen ? '1px solid rgba(168,85,247,0.60)' : '1px solid rgba(168,85,247,0.35)',
                              boxShadow: adminOpen ? '0 0 12px rgba(168,85,247,0.45)' : 'none',
                              transition: 'all 0.2s',
                            }}
                          >
                            <Crown style={{ width: 14, height: 14, color: adminOpen ? '#d8b4fe' : '#a855f7' }} strokeWidth={2} />
                          </div>
                          <span
                            className="flex-1 text-left font-bold"
                            style={{ fontSize: 13, color: adminOpen ? '#e9d5ff' : '#c084fc', transition: 'color 0.2s' }}
                          >
                            Yönetici Paneli
                          </span>
                          <ChevronDown
                            style={{
                              width: 15, height: 15,
                              color: adminOpen ? '#a855f7' : '#a855f780',
                              transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s, color 0.2s', flexShrink: 0,
                            }}
                          />
                        </button>

                        {/* Accordion içeriği */}
                        <AnimatePresence initial={false}>
                          {adminOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeInOut' }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{ borderTop: '1px solid rgba(168,85,247,0.15)', padding: '8px 8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>

                                {/* ── 1. Kullanıcı & Erişim ── */}
                                <SubAccordion
                                  id="kullanici"
                                  open={openSubSection === 'kullanici'}
                                  onToggle={() => setOpenSubSection(p => p === 'kullanici' ? null : 'kullanici')}
                                  icon="👥"
                                  label="Kullanıcı & Erişim"
                                  color="#a855f7"
                                >
                                  <NavItem icon={<Users style={{ width: 13, height: 13, color: '#c084fc' }} />} label="Kullanıcı Yönetimi" desc="Personel ve yöneticileri yönet" color="#a855f7" onClick={() => { onNavigate('user-management'); close(); }} />
                                </SubAccordion>

                                {/* ── 2. Raporlar & Analizler ── */}
                                <SubAccordion
                                  id="raporlar"
                                  open={openSubSection === 'raporlar'}
                                  onToggle={() => setOpenSubSection(p => p === 'raporlar' ? null : 'raporlar')}
                                  icon="📊"
                                  label="Raporlar & Analizler"
                                  color="#34d399"
                                >
                                  <NavItem icon={<FileBarChart style={{ width: 13, height: 13, color: '#34d399' }} />} label="Müdür Raporları" desc="Satış ve performans analizleri" color="#34d399" onClick={() => { onNavigate('manager-reports'); close(); }} />
                                  <NavItem icon={<BarChart2 style={{ width: 13, height: 13, color: '#a7c7e7' }} />} label="İşletme İstatistikleri" desc="Satış, anomali ve indirim verileri" color="#a7c7e7" onClick={() => { onNavigate('isletme-istatistikleri'); close(); }} />
                                </SubAccordion>

                                {/* ── 3. Muhasebe ── */}
                                <SubAccordion
                                  id="finans"
                                  open={openSubSection === 'finans'}
                                  onToggle={() => setOpenSubSection(p => p === 'finans' ? null : 'finans')}
                                  icon="🧾"
                                  label="Muhasebe"
                                  color="#60a5fa"
                                >
                                  <NavItem icon={<DollarSign style={{ width: 13, height: 13, color: '#60a5fa' }} />} label="Maliyet Yönetimi" desc="Maliyetleri takip et ve yönet" color="#60a5fa" onClick={() => { onNavigate('cost-management'); close(); }} />
                                  <NavItem icon={<TrendingUp style={{ width: 13, height: 13, color: '#34d399' }} />} label="Prim Takip" desc="Prim ve performans takibi" color="#34d399" onClick={() => { onNavigate('prim-takip'); close(); }} />
                                  <NavItem icon={<TrendingUp style={{ width: 13, height: 13, color: '#6ee7b7' }} />} label="İşletme Genel Durum" desc="Gelir, gider ve kar/zarar takibi" color="#6ee7b7" onClick={() => { onNavigate('isletme-genel-durum'); close(); }} />
                                  <NavItem icon={<FileBarChart style={{ width: 13, height: 13, color: '#93c5fd' }} />} label="Vardiya Raporları" desc="Günlük vardiya özet raporları" color="#93c5fd" onClick={() => { onNavigate('vardiya-raporlari'); close(); }} />
                                </SubAccordion>

                                {/* ── 4. Lokasyon & İşletme ── */}
                                <SubAccordion
                                  id="lokasyon"
                                  open={openSubSection === 'lokasyon'}
                                  onToggle={() => setOpenSubSection(p => p === 'lokasyon' ? null : 'lokasyon')}
                                  icon="📍"
                                  label="Lokasyon & İşletme"
                                  color="#a78bfa"
                                >
                                  <NavItem icon={<MapPin style={{ width: 13, height: 13, color: '#a78bfa' }} />} label="Mekan Yönetimi" desc="Proje mekanlarını yönet" color="#a78bfa" onClick={() => { onNavigate('mekan-management'); close(); }} />
                                </SubAccordion>

                                {/* ── 5. Malzeme & Stok ── */}
                                <SubAccordion
                                  id="malzeme"
                                  open={openSubSection === 'malzeme'}
                                  onToggle={() => setOpenSubSection(p => p === 'malzeme' ? null : 'malzeme')}
                                  icon="📦"
                                  label="Malzeme & Stok"
                                  color="#38bdf8"
                                >
                                  <NavItem icon={<Package style={{ width: 13, height: 13, color: '#38bdf8' }} />} label="Malzeme Yönetimi" desc="Ekipman ve malzemeleri yönet" color="#38bdf8" onClick={() => { onNavigate('equipment-page'); close(); }} />
                                  <NavItem icon={<BarChart2 style={{ width: 13, height: 13, color: '#7dd3fc' }} />} label="Stok Dağılımı" desc="Stok durumu ve dağılımı" color="#7dd3fc" onClick={() => { onNavigate('stock-distribution'); close(); }} />
                                </SubAccordion>

                                {/* ── 6. Sistem Ayarları (sadece yonetici) ── */}
                                {isYonetici && (
                                  <SubAccordion
                                    id="sistem"
                                    open={openSubSection === 'sistem'}
                                    onToggle={() => setOpenSubSection(p => p === 'sistem' ? null : 'sistem')}
                                    icon="⚙️"
                                    label="Sistem Ayarları"
                                    color="#818cf8"
                                    badge="SADECE YÖNETİCİ"
                                  >
                                    <AiToggleRow label="AI — Benim İçin" desc="Sadece yönetici" enabled={aiPersonal} loading={toggleLoading === 'ai_personal_yonetici'} color="#a855f7" onToggle={handleTogglePersonal} />
                                    <AiToggleRow label="AI — Yönetim İçin" desc="Üst müdür + müdür" enabled={aiYonetim} loading={toggleLoading === 'ai_yonetim_enabled'} color="#6366f1" onToggle={handleToggleYonetim} />
                                    <AiToggleRow label="AI — İdari İçin" desc="İdari görevliler" enabled={aiIdari} loading={toggleLoading === 'ai_idari_enabled'} color="#60a5fa" onToggle={handleToggleIdari} />
                                    <AiToggleRow label="AI — Personel İçin" desc="Personel rolü" enabled={aiPersonel} loading={toggleLoading === 'ai_personel_enabled'} color="#34d399" onToggle={handleTogglePersonel} />
                                    <AiToggleRow label="AI — Operasyon İçin" desc="Operasyon rolü" enabled={aiOperasyon} loading={toggleLoading === 'ai_operasyon_enabled'} color="#fb923c" onToggle={handleToggleOperasyon} />
                                  </SubAccordion>
                                )}

                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  {/* ── HESAP — en altta ── */}
                  {sections.filter(s => s.title === 'HESAP').map((section) => (
                    <div key={section.title}>
                      <div className="flex items-center gap-2 px-1 mb-1.5">
                        <div className="h-px flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${section.color}40, transparent)` }} />
                        <span
                          className="font-black tracking-widest flex-shrink-0"
                          style={{
                            fontSize: 9,
                            color: section.color,
                            letterSpacing: '0.15em',
                            background: `${section.color}18`,
                            border: `1px solid ${section.color}35`,
                            borderRadius: 20,
                            padding: '2px 8px',
                            boxShadow: `0 0 8px ${section.color}20`,
                          }}
                        >{section.title}</span>
                        <div className="h-px flex-1 rounded-full" style={{ background: `linear-gradient(to left, ${section.color}40, transparent)` }} />
                      </div>
                      <div className="space-y-1">
                        {section.items.map(item => {
                          const Icon = item.icon;
                          return (
                            <motion.button
                              key={item.label}
                              onClick={item.action}
                              whileTap={{ scale: 0.97 }}
                              className="w-full flex items-center gap-3 rounded-xl transition-all"
                              style={{
                                padding: '9px 11px',
                                background: item.danger ? 'rgba(239,68,68,0.07)' : `${section.color}07`,
                                border: item.danger ? '1px solid rgba(239,68,68,0.18)' : `1px solid ${section.color}18`,
                              }}
                            >
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: item.danger ? 'rgba(239,68,68,0.12)' : `${section.color}18`,
                                  border: item.danger ? '1px solid rgba(239,68,68,0.2)' : `1px solid ${section.color}35`,
                                }}
                              >
                                <Icon style={{ width: 14, height: 14, color: item.danger ? '#f87171' : `${section.color}cc` }} strokeWidth={1.8} />
                              </div>
                              <span
                                className="flex-1 text-left"
                                style={{ fontSize: 13, color: item.danger ? '#f87171' : `${section.color}cc`, fontWeight: 500 }}
                              >{item.label}</span>
                              <ChevronRight
                                style={{
                                  width: 13, height: 13, flexShrink: 0,
                                  color: item.danger ? 'rgba(248,113,113,0.5)' : `${section.color}60`,
                                }}
                              />
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

/* ─────────────────────── SubAccordion ──────────────────── */
function SubAccordion({
  id,
  open,
  onToggle,
  icon,
  label,
  color,
  badge,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: string;
  label: string;
  color: string;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      borderRadius: 14,
      overflow: 'hidden',
      border: open ? `1px solid ${color}55` : `1px solid ${color}20`,
      background: open ? `${color}0f` : `${color}07`,
      boxShadow: open ? `0 4px 20px ${color}18, inset 0 0 0 1px ${color}10` : 'none',
      transition: 'all 0.25s',
    }}>
      {/* Üst renkli şerit */}
      <div style={{
        height: open ? 2 : 0,
        background: `linear-gradient(to right, ${color}00, ${color}, ${color}00)`,
        transition: 'height 0.25s',
      }} />

      {/* Başlık butonu */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 transition-all"
        style={{
          padding: '9px 11px',
          background: open
            ? `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`
            : 'transparent',
          transition: 'background 0.25s',
        }}
      >
        {/* Sol renk çizgisi */}
        <div style={{
          width: 3, height: 28, borderRadius: 4,
          background: open ? `linear-gradient(to bottom, ${color}, ${color}80)` : `${color}40`,
          flexShrink: 0, transition: 'all 0.2s',
          boxShadow: open ? `0 0 10px ${color}90` : 'none',
        }} />

        {/* İkon */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: open
              ? `radial-gradient(circle at center, ${color}45, ${color}20)`
              : `${color}18`,
            border: `1px solid ${open ? color + '70' : color + '30'}`,
            boxShadow: open ? `0 0 14px ${color}55, inset 0 0 8px ${color}15` : 'none',
            transition: 'all 0.25s',
          }}
        >
          <span style={{ fontSize: 14, filter: open ? `drop-shadow(0 0 4px ${color})` : 'none', transition: 'filter 0.2s' }}>{icon}</span>
        </div>

        {/* Label */}
        <span
          className="flex-1 text-left"
          style={{
            fontSize: 12,
            color: open ? '#fff' : `${color}cc`,
            fontWeight: open ? 700 : 600,
            transition: 'color 0.2s',
            textShadow: open ? `0 0 12px ${color}60` : 'none',
          }}
        >
          {label}
        </span>

        {/* Badge */}
        {badge && (
          <span style={{
            fontSize: 8, fontWeight: 800, color: color,
            background: `${color}20`, border: `1px solid ${color}45`,
            borderRadius: 6, padding: '2px 6px', letterSpacing: '0.06em', flexShrink: 0,
            boxShadow: `0 0 8px ${color}25`,
          }}>
            {badge}
          </span>
        )}

        {/* Chevron */}
        <div style={{
          width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: open ? `${color}25` : 'transparent',
          border: open ? `1px solid ${color}40` : '1px solid transparent',
          transition: 'all 0.2s',
        }}>
          <ChevronDown
            style={{
              width: 12, height: 12,
              color: open ? color : `${color}55`,
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s, color 0.2s',
            }}
          />
        </div>
      </button>

      {/* Alt içerik */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '4px 8px 8px 8px',
              borderTop: `1px solid ${color}25`,
              background: `linear-gradient(to bottom, ${color}06, transparent)`,
            }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────── NavItem ──────────────────── */
function NavItem({
  icon,
  label,
  desc,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full flex items-center gap-2.5 rounded-xl transition-all"
      style={{
        padding: '8px 10px',
        background: `${color}12`,
        border: `1px solid ${color}30`,
      }}
    >
      {/* Sol ince accent bar */}
      <div style={{
        width: 2, height: 28, borderRadius: 4, flexShrink: 0,
        background: `linear-gradient(to bottom, ${color}, ${color}50)`,
        boxShadow: `0 0 6px ${color}60`,
      }} />

      {/* İkon kabı */}
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `${color}25`,
          border: `1px solid ${color}50`,
          boxShadow: `0 0 8px ${color}20`,
        }}
      >
        {icon}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0 text-left">
        <p style={{ fontSize: 12, fontWeight: 600, color: `${color}ee`, margin: 0 }}>{label}</p>
        <p style={{ fontSize: 9, color: `${color}70`, marginTop: 1 }}>{desc}</p>
      </div>

      {/* Sağ ok */}
      <ChevronRight style={{ width: 12, height: 12, color: `${color}80`, flexShrink: 0 }} />
    </motion.button>
  );
}

/* ─────────────────────── AiToggleRow ─────────────────── */
function AiToggleRow({
  label,
  desc,
  enabled,
  loading,
  color,
  onToggle,
}: {
  label: string;
  desc: string;
  enabled: boolean;
  loading: boolean;
  color: string;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl"
      style={{
        padding: '9px 11px',
        background: enabled
          ? `linear-gradient(135deg, ${color}20 0%, ${color}0a 100%)`
          : 'rgba(255,255,255,0.03)',
        border: enabled ? `1px solid ${color}45` : '1px solid rgba(255,255,255,0.07)',
        boxShadow: enabled ? `0 0 12px ${color}15` : 'none',
        transition: 'all 0.2s',
      }}
    >
      {/* Sol accent bar */}
      <div style={{
        width: 2, height: 26, borderRadius: 4, flexShrink: 0,
        background: enabled ? `linear-gradient(to bottom, ${color}, ${color}60)` : 'rgba(255,255,255,0.1)',
        boxShadow: enabled ? `0 0 8px ${color}70` : 'none',
        transition: 'all 0.2s',
      }} />

      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: enabled ? `${color}30` : 'rgba(255,255,255,0.06)',
          border: enabled ? `1px solid ${color}60` : '1px solid rgba(255,255,255,0.1)',
          boxShadow: enabled ? `0 0 10px ${color}40` : 'none',
          transition: 'all 0.2s',
        }}
      >
        <Brain style={{ width: 12, height: 12, color: enabled ? color : 'rgba(255,255,255,0.35)' }} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 11, fontWeight: 600, color: enabled ? `${color}ee` : 'rgba(226,232,240,0.45)', margin: 0, transition: 'color 0.2s' }}>{label}</p>
        <p style={{ fontSize: 9, color: enabled ? `${color}80` : 'rgba(255,255,255,0.25)', marginTop: 1, transition: 'color 0.2s' }}>{desc}</p>
      </div>
      <ToggleSwitch enabled={enabled} onToggle={onToggle} loading={loading} color={color} />
    </div>
  );
}