import {
  Activity, ClipboardList, TrendingUp, FileBarChart, BarChart2, Target, Wallet, Package,
  Home, MessageCircle, Trophy, Sparkles, GraduationCap,
  Zap, RotateCcw, Bell,
  CalendarDays,
  Gamepad2, Camera,
  User, Settings, LogOut, Check,
} from 'lucide-react';

// Şu an implement edilmiş PC ekranları (sonra kaldırılacak, hepsi aktif olunca check tamamen silinir)
const ACTIVE_KEYS = new Set(['dashboard-win', 'messaging']);
import type { WindowKey } from './pc-windows';

interface Item {
  key?: WindowKey;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
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
}

export function PcRightSidebar({ onOpen, onLogout }: Props) {
  const sections: Section[] = [
    {
      title: 'YÖNETİCİ HIZLI ERİŞİM', color: '#34d399',
      items: [
        { key: 'live-feed',             label: 'Canlı Feed',          Icon: Activity      },
        { key: 'personel-izin-cetveli', label: 'İzin Çizelgesi',      Icon: ClipboardList },
        { key: 'prim-takip',            label: 'Hakediş Takip',       Icon: TrendingUp    },
        { key: 'vardiya-raporlari',     label: 'Vardiya Raporları',   Icon: FileBarChart  },
        { key: 'isletme-genel-durum',   label: 'İşletme Genel Durum', Icon: BarChart2     },
        { key: 'hedef-takip',           label: 'Hedef Takibi',        Icon: Target        },
        { key: 'kasa',                  label: 'Kasa',                Icon: Wallet        },
        { key: 'tedarikci-yonetimi',    label: 'Tedarikçi Yönetimi',  Icon: Package       },
      ],
    },
    {
      title: 'GENEL', color: '#a855f7',
      items: [
        { key: 'dashboard-win', label: 'Dashboard',       Icon: Home           },
        { key: 'messaging',     label: 'Mesajlar',         Icon: MessageCircle  },
        { key: 'leaderboard',   label: 'Liderlik Tablosu', Icon: Trophy         },
        { key: 'aspect-ai',     label: 'Aspect AI',        Icon: Sparkles       },
        { key: 'academy',       label: 'Akademi',          Icon: GraduationCap  },
      ],
    },
    {
      title: 'OPERASYON', color: '#fb923c',
      items: [
        { key: 'quick-sales',   label: 'Operasyon Paneli', Icon: Zap      },
        { key: 'rotation',      label: 'Rotasyon',         Icon: RotateCcw },
        { key: 'announcements', label: 'Duyurular',        Icon: Bell     },
      ],
    },
    {
      title: 'MALZEME & STOK', color: '#38bdf8',
      items: [
        { key: 'equipment-page',     label: 'Malzeme Yönetimi', Icon: Package   },
        { key: 'stock-distribution', label: 'Stok Dağılımı',    Icon: BarChart2 },
      ],
    },
    {
      title: 'PERSONEL PANELİ', color: '#fbbf24',
      items: [
        { key: 'personel-prim-takip',  label: 'Hakedişlerim',           Icon: Wallet       },
        { key: 'kisisel-izin-cetveli', label: 'Kişisel İzin Çizelgesi', Icon: CalendarDays },
      ],
    },
    {
      title: 'OYUN', color: '#22d3ee',
      items: [
        { key: 'aspect-runner', label: 'Aspect Runner',  Icon: Gamepad2 },
        { key: 'aspect-quest',  label: 'Aspect Quest',   Icon: Gamepad2 },
        { key: 'xox-game',      label: 'Fotoğraf XOX',   Icon: Camera   },
        { key: 'foto-tkm',      label: 'Foto TKM',       Icon: Gamepad2 },
      ],
    },
    {
      title: 'HESAP', color: '#60a5fa',
      items: [
        { key: 'profile',  label: 'Profil',    Icon: User     },
        { key: 'settings', label: 'Ayarlar',   Icon: Settings },
        { label: 'Çıkış Yap', Icon: LogOut, onClick: onLogout, danger: true },
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
            return (
              <button
                key={it.key || `${s.title}-${i}`}
                className={`pc-sidebar-item ${it.danger ? 'pc-sidebar-item-danger' : ''}`}
                onClick={() => {
                  if (it.onClick) it.onClick();
                  else if (it.key) onOpen(it.key);
                }}
              >
                <it.Icon size={14} />
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
