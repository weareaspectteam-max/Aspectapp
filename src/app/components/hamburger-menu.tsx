/**
 * HamburgerMenu — Bölüm başlıklı (OPERASYON, GENEL, HESAP) glassmorphism sağ panel.
 * Tüm itemlar role bazlı filtrelenir; aktif sekme vurgulanır.
 * yonetici rolü için altta "YÖNETİCİ AYARLARI" accordion bölümü gösterilir.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Home, Zap, Activity, MapPin, RotateCcw,
  Trophy, Sparkles, MessageCircle, Bell, GraduationCap,
  Cake, User, Settings, LogOut, ChevronRight, Package,
  BarChart2, ClipboardList, CalendarDays, FileBarChart, Wallet, Gamepad2,
  ChevronDown, Crown, Sliders, Brain, Globe, Loader2, Users, DollarSign, TrendingUp,
  AlertTriangle, Building2, Eye, Camera, Target,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserRole } from './login';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';
import { THEMES, applyTheme, getThemeById, getAccentHex } from '../lib/themes';
import { Changelog } from './changelog';

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
  'ust-mudur':  '#a855f7',
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
  'superadmin': 'Yönetici',
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

  // Aspect AI artık tüm şirketlerde görünür — isAspect kısıtı kaldırıldı
  const aiLabel = companyId === 'frame' ? 'Frame AI' : companyId === 'tetra' ? 'Tetra AI' : 'Aspect AI';
  const nonBekleyen: UserRole[] = ['yonetici','ust-mudur','mudur','operasyon','idari','personel','superadmin'];

  const sections: Section[] = [
    {
      title: 'YÖNETİCİ HIZLI ERİŞİM',
      color: '#34d399',
      items: [
        { icon: Activity,      label: 'Canlı Feed',          roles: ['yonetici','ust-mudur'] as UserRole[],                                   action: () => go('live-feed')              },
        { icon: ClipboardList, label: 'İzin Çizelgesi',       roles: ['yonetici','ust-mudur','mudur','idari'] as UserRole[],                    action: () => go('personel-izin-cetveli')  },
        { icon: TrendingUp,    label: 'Hakediş Takip',        roles: ['yonetici','ust-mudur','mudur','idari'] as UserRole[],                    action: () => go('prim-takip')             },
        { icon: FileBarChart,  label: 'Vardiya Raporları',    roles: ['yonetici','ust-mudur','mudur','idari'] as UserRole[],                    action: () => go('vardiya-raporlari')      },
        { icon: BarChart2,     label: 'İşletme Genel Durum',  roles: ['yonetici','ust-mudur'] as UserRole[],                                    action: () => go('isletme-genel-durum')    },
        { icon: Target,        label: 'Hedef Takibi',         roles: ['yonetici','ust-mudur'] as UserRole[],                                      action: () => go('hedef-takip')            },
        { icon: Wallet,        label: 'Kasa',                 roles: ['yonetici','ust-mudur'] as UserRole[],                                      action: () => go('kasa')                   },
      ],
    },
    {
      title: 'GENEL',
      color: '#a855f7',
      items: [
        { icon: Home,          label: 'Dashboard',        roles: all,  action: () => go('dashboard')   },
        { icon: MessageCircle, label: 'Mesajlar',          roles: all,  action: () => go('messaging')   },
        { icon: Trophy,        label: 'Liderlik Tablosu',  roles: all,  action: () => go('leaderboard') },
        { icon: Sparkles as IconComp, label: aiLabel, roles: nonBekleyen as UserRole[], action: () => go('aspect-ai') } as MenuItem,
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
        { icon: Wallet,       label: 'Hakedişlerim',           roles: ['yonetici','ust-mudur','mudur','operasyon','idari','personel'] as UserRole[], action: () => go('personel-prim-takip')  },
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
        { icon: Camera,   label: 'Fotoğraf XOX 📷',  roles: ['yonetici','ust-mudur','mudur','operasyon','idari','personel'] as UserRole[], action: () => go('xox-game')      },
        { icon: Gamepad2, label: 'Foto TKM 💰',       roles: ['yonetici','ust-mudur','mudur','operasyon','idari','personel'] as UserRole[], action: () => go('foto-tkm')      },
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

  /* ── Logo easter egg (6x tap → super-admin) ── */
  const [logoTapCount, setLogoTapCount] = useState(0);
  const logoTapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = () => {
    if (!isSuperAdmin) return;
    const next = logoTapCount + 1;
    if (next >= 6) {
      setLogoTapCount(0);
      if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
      onNavigate('super-admin');
      close();
      return;
    }
    setLogoTapCount(next);
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    logoTapTimer.current = setTimeout(() => setLogoTapCount(0), 2000);
  };

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

  /* ── OpenAI Key state ── */
  const [companyKeyHas, setCompanyKeyHas]     = useState(false);
  const [companyKeyInput, setCompanyKeyInput] = useState('');
  const [companyKeySaving, setCompanyKeySaving] = useState(false);
  const [companyKeyDeleting, setCompanyKeyDeleting] = useState(false);
  const [companyKeyMsg, setCompanyKeyMsg]     = useState<{type: 'ok'|'err'; text: string} | null>(null);

  /* ── Telegram Config state ── */
  const [tgHasConfig, setTgHasConfig]         = useState(false);
  const [tgChatIdDisplay, setTgChatIdDisplay] = useState<string | null>(null);
  const [tgTokenInput, setTgTokenInput]       = useState('');
  const [tgChatIdInput, setTgChatIdInput]     = useState('');
  const [tgSaving, setTgSaving]               = useState(false);
  const [tgDeleting, setTgDeleting]           = useState(false);
  const [tgTesting, setTgTesting]             = useState(false);
  const [tgMsg, setTgMsg]                     = useState<{type: 'ok'|'err'; text: string} | null>(null);
  const [aiSectionOpen, setAiSectionOpen]     = useState(false);
  const [apiSectionOpen, setApiSectionOpen]   = useState(false);
  const [themeOpen, setThemeOpen]             = useState(false);
  const [activeTheme, setActiveTheme]         = useState(() => localStorage.getItem('aspect_theme') || 'mor-gece');
  const [themeSaving, setThemeSaving]         = useState(false);
  const [changelogOpen, setChangelogOpen]    = useState(false);

  const handleThemeChange = async (themeId: string) => {
    setActiveTheme(themeId);
    applyTheme(themeId);
    // Backend'e kaydet
    setThemeSaving(true);
    try {
      const headers = await authHeaders();
      await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ theme: themeId }),
      });
    } catch (e) {
      console.error('Tema kaydetme hatası:', e);
    } finally {
      setThemeSaving(false);
    }
  };

  const accentHex = getAccentHex();
  const rawSections = getSections(userRole, onNavigate, onLogout, close, activeTab, effectiveCompanyId);
  // GENEL section ve accent-bağımlı renkleri runtime hex ile override et
  const sections = rawSections.map(s =>
    s.color === '#a855f7' ? { ...s, color: accentHex } : s
  );
  const roleColor = (ROLE_COLORS[userRole] === '#a855f7' ? accentHex : ROLE_COLORS[userRole]) ?? accentHex;
  const roleTitle = ROLE_TITLES[userRole] ?? '';
  const roleAvatar= ROLE_AVATARS[userRole] ?? '👤';

  const isYonetici = userRole === 'yonetici';
  const showAdminPanel = userRole === 'yonetici' || userRole === 'ust-mudur' || userRole === 'mudur' || userRole === 'idari';

  /* ── Ayarları yükle (menü açılınca, yonetici ise) ── */
  useEffect(() => {
    if (!isOpen || !isYonetici || settingsLoaded) return;
    authHeaders().then(async headers => {
      try {
        const [toggleData, keyData, tgData] = await Promise.all([
          fetch(`${API_BASE}/ai/toggle-settings`, { headers }).then(r => r.ok ? r.json() : null),
          fetch(`${API_BASE}/ai/company-key`, { headers }).then(r => r.ok ? r.json() : null),
          fetch(`${API_BASE}/telegram/company-config`, { headers }).then(r => r.ok ? r.json() : null),
        ]);
        if (toggleData) {
          setAiPersonal(toggleData.ai_personal_yonetici !== false);
          setAiYonetim(toggleData.ai_yonetim_enabled !== false);
          setAiIdari(toggleData.ai_idari_enabled !== false);
          setAiPersonel(toggleData.ai_personel_enabled !== false);
          setAiOperasyon(toggleData.ai_operasyon_enabled !== false);
        }
        if (keyData) {
          setCompanyKeyHas(!!keyData.hasKey);
        }
        if (tgData) {
          setTgHasConfig(!!tgData.hasConfig);
          setTgChatIdDisplay(tgData.chatId || null);
        }
      } catch (e) {
        console.error('Ayarlar yüklenirken hata:', e);
      } finally {
        setSettingsLoaded(true);
      }
    }).catch(() => setSettingsLoaded(true));
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

  /* ── OpenAI Key handler'ları ── */
  const handleSaveCompanyKey = async () => {
    const trimmed = companyKeyInput.trim();
    if (!trimmed.startsWith('sk-')) {
      setCompanyKeyMsg({ type: 'err', text: "Key 'sk-' ile başlamalıdır." });
      return;
    }
    setCompanyKeySaving(true);
    setCompanyKeyMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ai/company-key`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await res.json();
      if (data.ok) {
        setCompanyKeyHas(true);
        setCompanyKeyInput('');
        setCompanyKeyMsg({ type: 'ok', text: 'OpenAI key başarıyla kaydedildi ✅' });
      } else {
        setCompanyKeyMsg({ type: 'err', text: data.error || 'Kaydetme hatası.' });
      }
    } catch (e) {
      setCompanyKeyMsg({ type: 'err', text: 'Bağlantı hatası.' });
    } finally {
      setCompanyKeySaving(false);
    }
  };

  const handleDeleteCompanyKey = async () => {
    setCompanyKeyDeleting(true);
    setCompanyKeyMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ai/company-key`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.ok) {
        setCompanyKeyHas(false);
        setCompanyKeyInput('');
        setCompanyKeyMsg({ type: 'ok', text: 'Key silindi. AI artık ücretsiz KV motorunu kullanır.' });
      } else {
        setCompanyKeyMsg({ type: 'err', text: data.error || 'Silme hatası.' });
      }
    } catch (e) {
      setCompanyKeyMsg({ type: 'err', text: 'Bağlantı hatası.' });
    } finally {
      setCompanyKeyDeleting(false);
    }
  };

  /* ── Telegram Config handler'ları ── */
  const handleSaveTgConfig = async () => {
    const token = tgTokenInput.trim();
    const chatId = tgChatIdInput.trim();
    if (!token || token.length < 10) {
      setTgMsg({ type: 'err', text: 'Bot Token gereklidir (örn: 1234567890:ABCDef...)' });
      return;
    }
    if (!chatId || chatId.length < 3) {
      setTgMsg({ type: 'err', text: 'Chat ID gereklidir (örn: -1001234567890)' });
      return;
    }
    setTgSaving(true);
    setTgMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/telegram/company-config`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token, chatId }),
      });
      const data = await res.json();
      if (data.ok) {
        setTgHasConfig(true);
        setTgChatIdDisplay(chatId);
        setTgTokenInput('');
        setTgChatIdInput('');
        setTgMsg({ type: 'ok', text: 'Telegram konfigürasyonu kaydedildi ✅' });
      } else {
        setTgMsg({ type: 'err', text: data.error || 'Kaydetme hatası.' });
      }
    } catch (e) {
      setTgMsg({ type: 'err', text: 'Bağlantı hatası.' });
    } finally {
      setTgSaving(false);
    }
  };

  const handleDeleteTgConfig = async () => {
    setTgDeleting(true);
    setTgMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/telegram/company-config`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.ok) {
        setTgHasConfig(false);
        setTgChatIdDisplay(null);
        setTgTokenInput('');
        setTgChatIdInput('');
        setTgMsg({ type: 'ok', text: 'Telegram konfigürasyonu silindi.' });
      } else {
        setTgMsg({ type: 'err', text: data.error || 'Silme hatası.' });
      }
    } catch (e) {
      setTgMsg({ type: 'err', text: 'Bağlantı hatası.' });
    } finally {
      setTgDeleting(false);
    }
  };

  const handleTestTgConfig = async () => {
    setTgTesting(true);
    setTgMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/telegram/company-config/test`, { method: 'POST', headers });
      const data = await res.json();
      if (data.ok) {
        setTgMsg({ type: 'ok', text: 'Test mesajı gönderildi! Telegram kanalınızı kontrol edin 📨' });
      } else {
        setTgMsg({ type: 'err', text: data.error || 'Test başarısız.' });
      }
    } catch (e) {
      setTgMsg({ type: 'err', text: 'Bağlantı hatası.' });
    } finally {
      setTgTesting(false);
    }
  };

  return (
    <>
      {/* ── Trigger ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
        style={{
          width:          40,
          height:         40,
          background:     'rgba(0,0,0,0.7)',
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
                  background: 'var(--app-bg, linear-gradient(170deg, #120830 0%, #1a0a3c 45%, #0f0620 100%))',
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
                        onClick={handleLogoTap}
                        style={{
                          background: logoTapCount > 0
                            ? `linear-gradient(135deg, #fbbf24, #f59e0b)`
                            : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                          cursor: isSuperAdmin ? 'pointer' : 'default',
                          transition: 'background 0.2s',
                        }}
                      >
                        <span style={{ fontSize: 11 }}>✦</span>
                      </div>
                      <span
                        className="font-black tracking-widest uppercase"
                        style={{ fontSize: 10, color: accentHex, letterSpacing: '0.18em' }}
                      >
                        {effectiveCompanyId.toUpperCase()}
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

                  {/* ── SÜPER YÖNETİM — sol üstteki ✦ logoya 6x tıklanınca açılır ── */}

                  {/* ── YÖNETİCİ PANELİ — en alta, HESAP'ın üstü ── */}
                  {showAdminPanel && (
                    <div
                      style={{
                        marginTop: 0,
                        background: 'linear-gradient(135deg, rgba(var(--app-accent-rgb),0.08), rgba(var(--app-accent-rgb),0.04))',
                        border: '1px solid rgba(var(--app-accent-rgb),0.22)',
                        borderLeft: '3px solid rgba(var(--app-accent-rgb),0.65)',
                        borderRadius: 14,
                        padding: '10px 8px 8px',
                      }}
                    >

                      {/* Bölüm ayırıcı */}
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <div
                          className="h-px flex-1 rounded-full"
                          style={{ background: 'linear-gradient(to right, var(--app-accent, #a855f7), transparent)' }}
                        />
                        <span
                          className="font-black tracking-widest flex-shrink-0"
                          style={{
                            fontSize: 9,
                            color: accentHex,
                            letterSpacing: '0.15em',
                            background: 'rgba(var(--app-accent-rgb),0.18)',
                            border: '1px solid rgba(var(--app-accent-rgb),0.35)',
                            borderRadius: 20,
                            padding: '2px 8px',
                            boxShadow: '0 0 8px rgba(var(--app-accent-rgb),0.2)',
                          }}
                        >
                          YÖNETİCİ PANELİ
                        </span>
                        <div
                          className="h-px flex-1 rounded-full"
                          style={{ background: 'linear-gradient(to left, var(--app-accent, #a855f7), transparent)' }}
                        />
                      </div>

                      {/* YÖNETİCİ AYARLARI ana accordion */}
                      <div
                        className="rounded-2xl overflow-hidden"
                        style={{
                          background: adminOpen ? 'rgba(var(--app-accent-rgb),0.10)' : 'rgba(var(--app-accent-rgb),0.05)',
                          border: adminOpen ? '1px solid rgba(var(--app-accent-rgb),0.35)' : '1px solid rgba(var(--app-accent-rgb),0.18)',
                          boxShadow: adminOpen ? '0 0 20px rgba(var(--app-accent-rgb),0.15)' : 'none',
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
                              background: adminOpen ? 'rgba(var(--app-accent-rgb),0.30)' : 'rgba(var(--app-accent-rgb),0.18)',
                              border: adminOpen ? '1px solid rgba(var(--app-accent-rgb),0.60)' : '1px solid rgba(var(--app-accent-rgb),0.35)',
                              boxShadow: adminOpen ? '0 0 12px rgba(var(--app-accent-rgb),0.45)' : 'none',
                              transition: 'all 0.2s',
                            }}
                          >
                            <Crown style={{ width: 14, height: 14, color: adminOpen ? '#a855f7' : '#a855f7' }} strokeWidth={2} />
                          </div>
                          <span
                            className="flex-1 text-left font-bold"
                            style={{ fontSize: 13, color: adminOpen ? '#a855f7' : '#a855f7', transition: 'color 0.2s' }}
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
                              <div style={{ borderTop: '1px solid rgba(var(--app-accent-rgb),0.15)', padding: '8px 8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>

                                {/* ── 1. Kullanıcı & Erişim ── */}
                                <SubAccordion
                                  id="kullanici"
                                  open={openSubSection === 'kullanici'}
                                  onToggle={() => setOpenSubSection(p => p === 'kullanici' ? null : 'kullanici')}
                                  icon="👥"
                                  label="Kullanıcı & Erişim"
                                  color={accentHex}
                                >
                                  <NavItem icon={<Users style={{ width: 13, height: 13, color: accentHex }} />} label="Kullanıcı Yönetimi" desc="Personel ve yöneticileri yönet" color={accentHex} onClick={() => { onNavigate('user-management'); close(); }} />
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
                                  {['yonetici','ust-mudur'].includes(userRole) && <NavItem icon={<Target style={{ width: 13, height: 13, color: accentHex }} />} label="Hedef Takibi" desc="Mekan bazlı ciro ve kâr hedefleri" color={accentHex} onClick={() => { onNavigate('hedef-takip'); close(); }} />}
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
                                  <NavItem icon={<TrendingUp style={{ width: 13, height: 13, color: '#34d399' }} />} label="Hakediş Takip" desc="Hakediş ve performans takibi" color="#34d399" onClick={() => { onNavigate('prim-takip'); close(); }} />
                                  {['yonetici','ust-mudur'].includes(userRole) && <NavItem icon={<TrendingUp style={{ width: 13, height: 13, color: '#6ee7b7' }} />} label="İşletme Genel Durum" desc="Gelir, gider ve kar/zarar takibi" color="#6ee7b7" onClick={() => { onNavigate('isletme-genel-durum'); close(); }} />}
                                  <NavItem icon={<FileBarChart style={{ width: 13, height: 13, color: '#93c5fd' }} />} label="Vardiya Raporları" desc="Günlük vardiya özet raporları" color="#93c5fd" onClick={() => { onNavigate('vardiya-raporlari'); close(); }} />
                                  {['yonetici','ust-mudur'].includes(userRole) && <NavItem icon={<Target style={{ width: 13, height: 13, color: accentHex }} />} label="Hedef Takibi" desc="Mekan bazlı ciro ve kar hedefleri" color={accentHex} onClick={() => { onNavigate('hedef-takip'); close(); }} />}
                                  {['yonetici','ust-mudur'].includes(userRole) && <NavItem icon={<Wallet style={{ width: 13, height: 13, color: '#fbbf24' }} />} label="Kasa" desc="Şirket ve kişisel kasa takibi" color="#fbbf24" onClick={() => { onNavigate('kasa'); close(); }} />}
                                </SubAccordion>

                                {/* ── 4. Lokasyon & İşletme ── */}
                                <SubAccordion
                                  id="lokasyon"
                                  open={openSubSection === 'lokasyon'}
                                  onToggle={() => setOpenSubSection(p => p === 'lokasyon' ? null : 'lokasyon')}
                                  icon="📍"
                                  label="Lokasyon & İşletme"
                                  color={accentHex}
                                >
                                  <NavItem icon={<MapPin style={{ width: 13, height: 13, color: accentHex }} />} label="Mekan Yönetimi" desc="Proje mekanlarını yönet" color={accentHex} onClick={() => { onNavigate('mekan-management'); close(); }} />
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
                                    {/* ── AI Ayarları — açılır bölüm ── */}
                                    <div style={{
                                      borderRadius: 14,
                                      background: 'rgba(255,255,255,0.04)',
                                      border: '1px solid rgba(var(--app-accent-rgb),0.25)',
                                      overflow: 'hidden',
                                    }}>
                                      <button
                                        onClick={() => setAiSectionOpen(p => !p)}
                                        style={{
                                          width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                                          padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                                        }}
                                      >
                                        <div style={{
                                          width: 26, height: 26, borderRadius: 8,
                                          background: 'rgba(var(--app-accent-rgb),0.18)',
                                          border: '1px solid rgba(var(--app-accent-rgb),0.3)',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 13,
                                        }}>🤖</div>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                          <div style={{ fontSize: 12, fontWeight: 600, color: '#d4b5f7' }}>AI Ayarları</div>
                                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                                            Rol bazlı AI erişim kontrolleri
                                          </div>
                                        </div>
                                        <span style={{
                                          fontSize: 9, padding: '2px 7px', borderRadius: 6,
                                          background: 'rgba(var(--app-accent-rgb),0.15)', border: '1px solid rgba(var(--app-accent-rgb),0.3)',
                                          color: accentHex, fontWeight: 700,
                                        }}>
                                          {[aiPersonal, aiYonetim, aiIdari, aiPersonel, aiOperasyon].filter(Boolean).length}/5 aktif
                                        </span>
                                        <ChevronDown style={{
                                          width: 14, height: 14, color: 'rgba(255,255,255,0.3)',
                                          transition: 'transform 0.2s',
                                          transform: aiSectionOpen ? 'rotate(180deg)' : 'none',
                                        }} />
                                      </button>
                                      {aiSectionOpen && (
                                        <div style={{ padding: '0 8px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                          <AiToggleRow label="AI — Benim İçin" desc="Sadece yönetici" enabled={aiPersonal} loading={toggleLoading === 'ai_personal_yonetici'} color={accentHex} onToggle={handleTogglePersonal} />
                                          <AiToggleRow label="AI — Yönetim İçin" desc="Üst müdür + müdür" enabled={aiYonetim} loading={toggleLoading === 'ai_yonetim_enabled'} color="#6366f1" onToggle={handleToggleYonetim} />
                                          <AiToggleRow label="AI — İdari İçin" desc="İdari görevliler" enabled={aiIdari} loading={toggleLoading === 'ai_idari_enabled'} color="#60a5fa" onToggle={handleToggleIdari} />
                                          <AiToggleRow label="AI — Personel İçin" desc="Personel rolü" enabled={aiPersonel} loading={toggleLoading === 'ai_personel_enabled'} color="#34d399" onToggle={handleTogglePersonel} />
                                          <AiToggleRow label="AI — Operasyon İçin" desc="Operasyon rolü" enabled={aiOperasyon} loading={toggleLoading === 'ai_operasyon_enabled'} color="#fb923c" onToggle={handleToggleOperasyon} />
                                        </div>
                                      )}
                                    </div>

                                    {/* ── API & Entegrasyonlar — açılır bölüm ── */}
                                    <div style={{
                                      marginTop: 10,
                                      borderRadius: 14,
                                      background: 'rgba(255,255,255,0.04)',
                                      border: '1px solid rgba(96,165,250,0.25)',
                                      overflow: 'hidden',
                                    }}>
                                      <button
                                        onClick={() => setApiSectionOpen(p => !p)}
                                        style={{
                                          width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                                          padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                                        }}
                                      >
                                        <div style={{
                                          width: 26, height: 26, borderRadius: 8,
                                          background: 'rgba(96,165,250,0.18)',
                                          border: '1px solid rgba(96,165,250,0.3)',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 13,
                                        }}>🔑</div>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                          <div style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>API & Entegrasyonlar</div>
                                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: companyKeyHas ? '#22c55e' : '#ef4444', display: 'inline-block', boxShadow: companyKeyHas ? '0 0 4px #22c55e' : 'none' }} />OpenAI</span> · <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: tgHasConfig ? '#22c55e' : '#ef4444', display: 'inline-block', boxShadow: tgHasConfig ? '0 0 4px #22c55e' : 'none' }} />Telegram</span>
                                          </div>
                                        </div>
                                        <ChevronDown style={{
                                          width: 14, height: 14, color: 'rgba(255,255,255,0.3)',
                                          transition: 'transform 0.2s',
                                          transform: apiSectionOpen ? 'rotate(180deg)' : 'none',
                                        }} />
                                      </button>
                                      {apiSectionOpen && (
                                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

                                          {/* ── OpenAI API Key ── */}
                                          <div style={{ marginTop: 10 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                              <span style={{ fontSize: 12 }}>🔑</span>
                                              <span style={{ fontSize: 11, fontWeight: 700, color: '#d4b5f7' }}>OpenAI API Key</span>
                                              <div style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
                                                padding: '1px 7px', borderRadius: 10,
                                                background: companyKeyHas ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                                                border: `1px solid ${companyKeyHas ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.12)'}`,
                                              }}>
                                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: companyKeyHas ? '#22c55e' : '#6b7280' }} />
                                                <span style={{ fontSize: 9, color: companyKeyHas ? '#86efac' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                                                  {companyKeyHas ? 'Aktif' : 'Yok'}
                                                </span>
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                              <input
                                                type="password"
                                                placeholder="sk-proj-..."
                                                value={companyKeyInput}
                                                onChange={e => { setCompanyKeyInput(e.target.value); setCompanyKeyMsg(null); }}
                                                style={{
                                                  width: '100%', borderRadius: 10, border: '1px solid rgba(var(--app-accent-rgb),0.3)',
                                                  background: 'rgba(0,0,0,0.25)', color: '#fff',
                                                  padding: '8px 10px', fontSize: 11, outline: 'none',
                                                  fontFamily: 'monospace', boxSizing: 'border-box',
                                                }}
                                              />
                                              <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                  onClick={handleSaveCompanyKey}
                                                  disabled={companyKeySaving || !companyKeyInput.trim()}
                                                  style={{
                                                    flex: 1, borderRadius: 10, border: '1px solid rgba(var(--app-accent-rgb),0.4)',
                                                    background: companyKeySaving || !companyKeyInput.trim() ? 'rgba(var(--app-accent-rgb),0.1)' : 'rgba(var(--app-accent-rgb),0.3)',
                                                    color: '#d4b5f7', padding: '8px', fontSize: 11,
                                                    fontWeight: 700, cursor: companyKeySaving || !companyKeyInput.trim() ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                  }}
                                                >
                                                  {companyKeySaving ? <><Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> Kaydediliyor...</> : '💾 Kaydet'}
                                                </button>
                                                {companyKeyHas && (
                                                  <button
                                                    onClick={handleDeleteCompanyKey}
                                                    disabled={companyKeyDeleting}
                                                    style={{
                                                      borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)',
                                                      background: 'rgba(239,68,68,0.07)', color: '#f87171',
                                                      padding: '8px 12px', fontSize: 11, fontWeight: 600,
                                                      cursor: companyKeyDeleting ? 'not-allowed' : 'pointer',
                                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                    }}
                                                  >
                                                    {companyKeyDeleting ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : '🗑️ Sil'}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                            {companyKeyMsg && (
                                              <div style={{
                                                marginTop: 6, borderRadius: 8, padding: '5px 10px', fontSize: 10,
                                                background: companyKeyMsg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                border: `1px solid ${companyKeyMsg.type === 'ok' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                                color: companyKeyMsg.type === 'ok' ? '#86efac' : '#fca5a5',
                                              }}>{companyKeyMsg.text}</div>
                                            )}
                                          </div>

                                          {/* Ayırıcı */}
                                          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

                                          {/* ── Telegram Bağlantısı ── */}
                                          <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                              <span style={{ fontSize: 12 }}>✈️</span>
                                              <span style={{ fontSize: 11, fontWeight: 700, color: '#7dd3fc' }}>Telegram Bağlantısı</span>
                                              <div style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
                                                padding: '1px 7px', borderRadius: 10,
                                                background: tgHasConfig ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                                                border: `1px solid ${tgHasConfig ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.12)'}`,
                                              }}>
                                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: tgHasConfig ? '#22c55e' : '#6b7280' }} />
                                                <span style={{ fontSize: 9, color: tgHasConfig ? '#86efac' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                                                  {tgHasConfig ? 'Bağlı' : 'Yok'}
                                                </span>
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                              <input
                                                type="password"
                                                placeholder="Bot Token (1234567:ABCDef...)"
                                                value={tgTokenInput}
                                                onChange={e => { setTgTokenInput(e.target.value); setTgMsg(null); }}
                                                style={{
                                                  width: '100%', borderRadius: 10, border: '1px solid rgba(29,161,242,0.3)',
                                                  background: 'rgba(0,0,0,0.25)', color: '#fff',
                                                  padding: '8px 10px', fontSize: 11, outline: 'none',
                                                  fontFamily: 'monospace', boxSizing: 'border-box',
                                                }}
                                              />
                                              <input
                                                type="text"
                                                placeholder="Chat ID (örn: -1001234567890)"
                                                value={tgChatIdInput}
                                                onChange={e => { setTgChatIdInput(e.target.value); setTgMsg(null); }}
                                                style={{
                                                  width: '100%', borderRadius: 10, border: '1px solid rgba(29,161,242,0.3)',
                                                  background: 'rgba(0,0,0,0.25)', color: '#fff',
                                                  padding: '8px 10px', fontSize: 11, outline: 'none',
                                                  fontFamily: 'monospace', boxSizing: 'border-box',
                                                }}
                                              />
                                              <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                  onClick={handleSaveTgConfig}
                                                  disabled={tgSaving || !tgTokenInput.trim() || !tgChatIdInput.trim()}
                                                  style={{
                                                    flex: 1, borderRadius: 10, border: '1px solid rgba(29,161,242,0.4)',
                                                    background: tgSaving || !tgTokenInput.trim() || !tgChatIdInput.trim() ? 'rgba(29,161,242,0.08)' : 'rgba(29,161,242,0.25)',
                                                    color: '#7dd3fc', padding: '8px', fontSize: 11,
                                                    fontWeight: 700, cursor: tgSaving || !tgTokenInput.trim() || !tgChatIdInput.trim() ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                  }}
                                                >
                                                  {tgSaving ? <><Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> Kaydediliyor...</> : '💾 Kaydet'}
                                                </button>
                                                {tgHasConfig && (
                                                  <>
                                                    <button
                                                      onClick={handleTestTgConfig}
                                                      disabled={tgTesting}
                                                      style={{
                                                        borderRadius: 10, border: '1px solid rgba(29,161,242,0.3)',
                                                        background: 'rgba(29,161,242,0.12)', color: '#7dd3fc',
                                                        padding: '8px 10px', fontSize: 11, fontWeight: 600,
                                                        cursor: tgTesting ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                      }}
                                                    >
                                                      {tgTesting ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : '📨 Test'}
                                                    </button>
                                                    <button
                                                      onClick={handleDeleteTgConfig}
                                                      disabled={tgDeleting}
                                                      style={{
                                                        borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)',
                                                        background: 'rgba(239,68,68,0.07)', color: '#f87171',
                                                        padding: '8px 10px', fontSize: 11, fontWeight: 600,
                                                        cursor: tgDeleting ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                      }}
                                                    >
                                                      {tgDeleting ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : '🗑️ Sil'}
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                            {tgMsg && (
                                              <div style={{
                                                marginTop: 6, borderRadius: 8, padding: '5px 10px', fontSize: 10,
                                                background: tgMsg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                border: `1px solid ${tgMsg.type === 'ok' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                                color: tgMsg.type === 'ok' ? '#86efac' : '#fca5a5',
                                              }}>{tgMsg.text}</div>
                                            )}
                                          </div>

                                        </div>
                                      )}
                                    </div>
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
                        {section.items.filter(i => !i.danger).map(item => {
                          const Icon = item.icon;
                          return (
                            <motion.button
                              key={item.label}
                              onClick={item.action}
                              whileTap={{ scale: 0.97 }}
                              className="w-full flex items-center gap-3 rounded-xl transition-all"
                              style={{
                                padding: '9px 11px',
                                background: `${section.color}07`,
                                border: `1px solid ${section.color}18`,
                              }}
                            >
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: `${section.color}18`,
                                  border: `1px solid ${section.color}35`,
                                }}
                              >
                                <Icon style={{ width: 14, height: 14, color: `${section.color}cc` }} strokeWidth={1.8} />
                              </div>
                              <span
                                className="flex-1 text-left"
                                style={{ fontSize: 13, color: `${section.color}cc`, fontWeight: 500 }}
                              >{item.label}</span>
                              <ChevronRight
                                style={{
                                  width: 13, height: 13, flexShrink: 0,
                                  color: `${section.color}60`,
                                }}
                              />
                            </motion.button>
                          );
                        })}

                        {/* ── Tema Rengi ── */}
                        <div style={{
                          borderRadius: 14,
                          overflow: 'hidden',
                          border: themeOpen ? `1px solid ${section.color}45` : `1px solid ${section.color}18`,
                          background: themeOpen ? `${section.color}10` : `${section.color}07`,
                          transition: 'all 0.25s',
                          marginTop: 4,
                        }}>
                          <button
                            onClick={() => setThemeOpen(p => !p)}
                            className="w-full flex items-center gap-3 transition-all"
                            style={{ padding: '9px 11px' }}
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${section.color}18`, border: `1px solid ${section.color}35` }}>
                              <span style={{ fontSize: 14 }}>🎨</span>
                            </div>
                            <span className="flex-1 text-left" style={{ fontSize: 13, color: `${section.color}cc`, fontWeight: 500 }}>
                              Tema Rengi
                            </span>
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                              {getThemeById(activeTheme).name}
                            </span>
                            <ChevronDown style={{
                              width: 13, height: 13, flexShrink: 0,
                              color: `${section.color}60`,
                              transform: themeOpen ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.2s',
                            }} />
                          </button>
                          {themeOpen && (
                            <div style={{ padding: '4px 10px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                                {THEMES.map(t => {
                                  const isActive = activeTheme === t.id;
                                  return (
                                    <button
                                      key={t.id}
                                      onClick={() => handleThemeChange(t.id)}
                                      style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                        padding: '6px 2px', borderRadius: 10, cursor: 'pointer',
                                        background: isActive ? `${t.accent}20` : 'transparent',
                                        border: isActive ? `1.5px solid ${t.accent}` : '1.5px solid transparent',
                                        transition: 'all 0.2s',
                                      }}
                                    >
                                      <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: t.bg,
                                        border: `2px solid ${t.accent}`,
                                        boxShadow: isActive ? `0 0 10px ${t.accent}60` : 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      }}>
                                        {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent }} />}
                                      </div>
                                      <span style={{
                                        fontSize: 7, fontWeight: 700, textAlign: 'center', lineHeight: 1.1,
                                        color: isActive ? t.accent : 'rgba(255,255,255,0.35)',
                                      }}>{t.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {themeSaving && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6 }}>
                                  <Loader2 style={{ width: 10, height: 10, color: 'rgba(255,255,255,0.3)' }} className="animate-spin" />
                                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Kaydediliyor...</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ── Çıkış Yap (en son) ── */}
                        {section.items.filter(i => i.danger).map(item => {
                          const Icon = item.icon;
                          return (
                            <motion.button
                              key={item.label}
                              onClick={item.action}
                              whileTap={{ scale: 0.97 }}
                              className="w-full flex items-center gap-3 rounded-xl transition-all"
                              style={{
                                padding: '9px 11px',
                                background: 'rgba(239,68,68,0.07)',
                                border: '1px solid rgba(239,68,68,0.18)',
                              }}
                            >
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
                              >
                                <Icon style={{ width: 14, height: 14, color: '#f87171' }} strokeWidth={1.8} />
                              </div>
                              <span className="flex-1 text-left" style={{ fontSize: 13, color: '#f87171', fontWeight: 500 }}>{item.label}</span>
                              <ChevronRight style={{ width: 13, height: 13, flexShrink: 0, color: 'rgba(248,113,113,0.5)' }} />
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                </div>

                {/* ── Footer versiyon notu ── */}
                <div
                  className="px-4 py-3 flex-shrink-0 flex items-center gap-3"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {['yonetici', 'ust-mudur'].includes(userRole) ? (
                    <button
                      onClick={() => setChangelogOpen(true)}
                      style={{
                        fontSize: 9, color: 'rgba(255,255,255,0.25)', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                        transition: 'all 0.2s',
                      }}
                    >
                      v4.3
                    </button>
                  ) : (
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>
                      v4.3
                    </span>
                  )}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>
                    {effectiveCompanyId.toUpperCase()} OPERATIONS
                  </span>
                </div>
                <Changelog isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} userName={userName} userRole={userRole} userId={userId} isSuperAdmin={isSuperAdmin} />
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