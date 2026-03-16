import { ArrowRight, TrendingUp, BarChart3, Settings, FileText } from 'lucide-react';

interface BusinessPanelProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};

export function BusinessPanel({ userName, onNavigate }: BusinessPanelProps) {
  const managementCards = [
    {
      title: 'İşletme Genel Durum',
      description: 'Gelir, gider ve kar/zarar takibi',
      Icon: TrendingUp,
      emoji: '💼',
      color: '#34d399',
    },
    {
      title: 'Stok Dağılımı',
      description: 'Albüm ve baskı kağıdı stok analizi',
      Icon: BarChart3,
      emoji: '📊',
      color: '#ffd4a3',
    },
    {
      title: 'Mekan - Malzeme - Kullanıcı - Maliyet Yönetimi',
      description: 'Tüm kaynakları tek yerden yönetin',
      Icon: Settings,
      emoji: '⚙️',
      color: '#c4b5fd',
    },
    {
      title: 'Müdür Raporları',
      description: 'Müdür ziyaretleri ve faaliyetleri',
      Icon: FileText,
      emoji: '📋',
      color: '#9dd9ea',
    },
  ];

  const actions = [
    { ...managementCards[0], action: () => onNavigate('isletme-genel-durum') },
    { ...managementCards[1], action: () => onNavigate('stock-distribution') },
    { ...managementCards[2], action: () => onNavigate('resource-management') },
    { ...managementCards[3], action: () => onNavigate('manager-reports') },
  ];

  return (
    <div className="min-h-screen pb-28 px-4 pt-4 space-y-4">

      {/* Başlık */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-black text-white">Yönetici Paneli</h1>
          <span className="text-xl">⚙️</span>
        </div>
        <p className="text-xs font-medium" style={{ color: 'rgba(196,181,253,0.5)' }}>
          {userName} · İşletme yönetim araçları
        </p>
      </div>

      {/* Kartlar */}
      <div className="space-y-3">
        {actions.map((item) => (
          <button
            key={item.title}
            onClick={item.action}
            className="w-full text-left transition-all active:scale-[0.98]"
            style={{
              ...glass,
              padding: 16,
              border: `1px solid ${item.color}bb`,
              boxShadow: `0 4px 32px ${item.color}50`,
            }}
          >
            <div className="flex items-center gap-4">
              {/* İkon kutusu */}
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: `${item.color}26`,
                border: `1px solid ${item.color}4d`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 22 }}>{item.emoji}</span>
              </div>

              {/* Metin */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white leading-snug"
                  style={{ fontSize: item.title.length > 30 ? '0.88rem' : '1rem' }}>
                  {item.title}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {item.description}
                </p>
              </div>

              {/* Ok */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: `${item.color}55`,
                border: `1px solid ${item.color}aa`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ArrowRight style={{ width: 15, height: 15, color: item.color }} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}