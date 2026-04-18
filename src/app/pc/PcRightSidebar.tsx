import {
  Activity, ClipboardList, TrendingUp, FileBarChart, BarChart2, Target, Wallet, Package,
  Home, MessageCircle, Trophy, Sparkles, GraduationCap,
  Zap, RotateCcw, Bell,
  CalendarDays,
  Gamepad2, Camera,
  User, Settings, LogOut, Check,
} from 'lucide-react';

// Şu an implement edilmiş PC ekranları (sonra kaldırılacak, hepsi aktif olunca check tamamen silinir)
const ACTIVE_KEYS = new Set(['dashboard-win', 'messaging', 'live-feed', 'rotation', 'leaderboard', 'academy', 'isletme-istatistikleri']);
import type { WindowKey } from './pc-windows';

interface Item {
  key?: WindowKey;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  onClick?: () => void;
  danger?: boolean;
}

interface Section {
  title: string;
  color: string;
  items: Item[];
}

interface Props {
  onOpen: (key: WindowKey) => void;
  onLogout: () => void;
  activeCenterView?: string;
  userRole?: string;
}

export function PcRightSidebar({ onOpen, onLogout, activeCenterView, userRole }: Props) {
  const isYonetici = userRole === 'yonetici';
  const sections: Section[] = [
    {
      title: 'YÖNETİCİ HIZLI ERİŞİM', color: '#34d399',
      items: [
        { key: 'live-feed',             label: 'Canlı Feed',          Icon: Activity,      color: '#34d399' },
        { key: 'personel-izin-cetveli', label: 'İzin Çizelgesi',      Icon: ClipboardList, color: '#a8e6cf' },
        { key: 'prim-takip',            label: 'Hakediş Takip',       Icon: TrendingUp,    color: '#34d399' },
        { key: 'vardiya-raporlari',     label: 'Vardiya Raporları',   Icon: FileBarChart,  color: '#93c5fd' },
        { key: 'isletme-genel-durum',   label: 'İşletme Genel Durum', Icon: BarChart2,     color: '#6ee7b7' },
        ...(isYonetici ? [{ key: 'isletme-istatistikleri' as WindowKey, label: 'İşletme İstatistikleri', Icon: BarChart2, color: '#a7c7e7' }] : []),
        { key: 'hedef-takip',           label: 'Hedef Takibi',        Icon: Target,        color: '#f9a8d4' },
        { key: 'kasa',                  label: 'Kasa',                Icon: Wallet,        color: '#fbbf24' },
        { key: 'tedarikci-yonetimi',    label: 'Tedarikçi Yönetimi',  Icon: Package,       color: '#38bdf8' },
      ],
    },
    {
      title: 'GENEL', color: '#a855f7',
      items: [
        { key: 'dashboard-win', label: 'Dashboard',       Icon: Home,          color: '#a855f7' },
        { key: 'messaging',     label: 'Mesajlar',        Icon: MessageCircle, color: '#9dd9ea' },
        { key: 'leaderboard',   label: 'Liderlik Tablosu',Icon: Trophy,        color: '#fbbf24' },
        { key: 'aspect-ai',     label: 'Aspect AI',       Icon: Sparkles,      color: '#c5a8f5' },
        { key: 'academy',       label: 'Akademi',         Icon: GraduationCap, color: '#60a5fa' },
      ],
    },
    {
      title: 'OPERASYON', color: '#fb923c',
      items: [
        { key: 'quick-sales',   label: 'Operasyon Paneli', Icon: Zap,       color: '#fb923c' },
        { key: 'rotation',      label: 'Rotasyon',         Icon: RotateCcw, color: '#fbbf24' },
        { key: 'announcements', label: 'Duyurular',        Icon: Bell,      color: '#f9a8d4' },
      ],
    },
    {
      title: 'MALZEME & STOK', color: '#38bdf8',
      items: [
        { key: 'equipment-page',     label: 'Malzeme Yönetimi', Icon: Package,   color: '#38bdf8' },
        { key: 'stock-distribution', label: 'Stok Dağılımı',    Icon: BarChart2, color: '#7dd3fc' },
      ],
    },
    {
      title: 'PERSONEL PANELİ', color: '#fbbf24',
      items: [
        { key: 'personel-prim-takip',  label: 'Hakedişlerim',           Icon: Wallet,       color: '#fbbf24' },
        { key: 'kisisel-izin-cetveli', label: 'Kişisel İzin Çizelgesi', Icon: CalendarDays, color: '#a8e6cf' },
      ],
    },
    {
      title: 'OYUN', color: '#22d3ee',
      items: [
        { key: 'aspect-runner', label: 'Aspect Runner',  Icon: Gamepad2, color: '#22d3ee' },
        { key: 'aspect-quest',  label: 'Aspect Quest',   Icon: Gamepad2, color: '#c5a8f5' },
        { key: 'xox-game',      label: 'Fotoğraf XOX',   Icon: Camera,   color: '#f9a8d4' },
        { key: 'foto-tkm',      label: 'Foto TKM',       Icon: Gamepad2, color: '#fbbf24' },
      ],
    },
    {
      title: 'HESAP', color: '#60a5fa',
      items: [
        { key: 'profile',  label: 'Profil',    Icon: User,     color: '#60a5fa' },
        { key: 'settings', label: 'Ayarlar',   Icon: Settings, color: '#9dd9ea' },
        { label: 'Çıkış Yap', Icon: LogOut, onClick: onLogout, danger: true, color: '#f87171' },
      ],
    },
  ];

  return (
    <aside className="pc-sidebar pc-sidebar-right">
      {sections.map(s => (
        <div key={s.title} className="pc-sidebar-section">
          <div className="pc-sidebar-section-title" style={{ color: s.color }}>{s.title}</div>
          {s.items.map((it, i) => {
            const isActive = it.key ? ACTIVE_KEYS.has(it.key) : false;
            const isCurrent = it.key === 'rotation' && activeCenterView === 'rotasyon-atama';
            return (
              <button
                key={it.key || `${s.title}-${i}`}
                className={`pc-sidebar-item ${it.danger ? 'pc-sidebar-item-danger' : ''}`}
                onClick={() => {
                  if (it.onClick) it.onClick();
                  else if (it.key) onOpen(it.key);
                }}
                style={{
                  ['--item-color' as any]: it.color,
                  ...(isCurrent ? { background: `color-mix(in srgb, ${it.color} 22%, transparent)`, borderColor: `color-mix(in srgb, ${it.color} 50%, transparent)`, color: '#fff' } : {}),
                }}
              >
                <span className="pc-sidebar-item-icon">
                  <it.Icon size={12} color={it.color} />
                </span>
                <span style={{ flex: 1 }}>{it.label}</span>
                {isActive && (
                  <span title="Aktif" style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 14, height: 14, borderRadius: '50%',
                    background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)',
                  }}>
                    <Check size={9} color="#34d399" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
