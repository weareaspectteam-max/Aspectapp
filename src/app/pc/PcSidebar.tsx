import { Activity, ClipboardList, TrendingUp, FileBarChart, BarChart2, Target, Wallet, Package } from 'lucide-react';
import type { WindowKey } from './pc-windows';

interface Item {
  key: WindowKey;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
}

const ITEMS: Item[] = [
  { key: 'live-feed',             label: 'Canlı Feed',          Icon: Activity      },
  { key: 'personel-izin-cetveli', label: 'İzin Çizelgesi',      Icon: ClipboardList },
  { key: 'prim-takip',            label: 'Hakediş Takip',       Icon: TrendingUp    },
  { key: 'vardiya-raporlari',     label: 'Vardiya Raporları',   Icon: FileBarChart  },
  { key: 'isletme-genel-durum',   label: 'İşletme Genel Durum', Icon: BarChart2     },
  { key: 'hedef-takip',           label: 'Hedef Takibi',        Icon: Target        },
  { key: 'kasa',                  label: 'Kasa',                Icon: Wallet        },
  { key: 'tedarikci-yonetimi',    label: 'Tedarikçi Yönetimi',  Icon: Package       },
];

export function PcSidebar({ onOpen }: { onOpen: (key: WindowKey) => void }) {
  return (
    <aside className="pc-sidebar pc-sidebar-left">
      <div className="pc-sidebar-brand">
        <div style={{ fontSize: 22 }}>⚡</div>
        <div>
          <div className="pc-sidebar-brand-title">Aspect Panel</div>
          <div className="pc-sidebar-brand-subtitle">Hızlı Erişim</div>
        </div>
      </div>
      <div className="pc-sidebar-section-title">YÖNETİCİ HIZLI ERİŞİM</div>
      {ITEMS.map(it => (
        <button
          key={it.key}
          className="pc-sidebar-item"
          onClick={() => onOpen(it.key)}
        >
          <it.Icon size={15} />
          <span>{it.label}</span>
        </button>
      ))}
    </aside>
  );
}
