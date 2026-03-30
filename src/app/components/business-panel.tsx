import { ArrowRight, FileText, BarChart3 } from 'lucide-react';

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
  const actions = [
    {
      title: 'Raporlar & Analizler',
      description: 'Satış, anomali, indirim ve vardiya istatistikleri',
      emoji: '📊',
      color: '#9dd9ea',
      action: () => onNavigate('isletme-istatistikleri'),
    },
    {
      title: 'Müdür Raporları',
      description: 'Ziyaret, haftalık/aylık ve personel görüşmeleri',
      emoji: '📋',
      color: 'var(--app-accent, #a855f7)',
      action: () => onNavigate('manager-reports'),
    },
  ];

  return (
    <div className="min-h-screen pb-28 px-4 pt-4 space-y-4" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>

      {/* Başlık */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-black text-white">Yönetici Paneli</h1>
          <span className="text-xl">⚙️</span>
        </div>
        <p className="text-xs font-medium" style={{ color: 'rgba(var(--app-accent-rgb),0.5)' }}>
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
                <p className="font-bold text-white leading-snug" style={{ fontSize: '1rem' }}>
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