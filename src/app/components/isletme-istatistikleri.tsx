import { ArrowLeft, ArrowRight } from 'lucide-react';

interface IsletmeIstatistikleriProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

const glass: React.CSSProperties = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         20,
};

export function IsletmeIstatistikleri({ userName, userRole, onNavigate }: IsletmeIstatistikleriProps) {
  const isYonetici = ['yonetici', 'ust-mudur', 'mudur'].includes(userRole);

  const cards = [
    {
      emoji:       '📈',
      title:       'Satış İstatistikleri',
      description: 'Günlük ciro, satış adedi ve albüm kırılımı',
      color:       '#9dd9ea',
      tab:         'satis-raporu',
      show:        true,
    },
    {
      emoji:       '🚨',
      title:       'Anomali İstatistikleri',
      description: 'Stok fark kayıtlarında kimin kaç puan aldığı',
      color:       '#f87171',
      tab:         'anomali-panosu',
      show:        isYonetici,
    },
    {
      emoji:       '🏷️',
      title:       'İndirim İstatistikleri',
      description: 'Kimin ne kadar indirim yaptığı, uzun ve kısa dönem',
      color:       '#ffd4a3',
      tab:         'indirim-istatistik',
      show:        isYonetici,
    },
    {
      emoji:       '⏱️',
      title:       'Vardiya İstatistikleri',
      description: 'Aylık check-in, geç giriş ve bildirim takibi',
      color:       '#d4b5f7',
      tab:         'vardiya-istatistikleri',
      show:        isYonetici,
    },
    {
      emoji:       '📊',
      title:       'Personel Performans İstatistikleri',
      description: 'Çekim & baskı dönüşüm analizi, performans yüzdeleri',
      color:       '#4ade80',
      tab:         'kare-istatistik',
      show:        isYonetici,
    },
    {
      emoji:       '🏪',
      title:       'Mekan İstatistikleri',
      description: 'Aylık ciro, müşteri, iade, kâr eşiği ve karşılaştırma',
      color:       '#7ec8dd',
      tab:         'mekan-istatistikleri',
      show:        ['yonetici', 'ust-mudur'].includes(userRole),
    },
  ].filter(c => c.show);

  return (
    <div className="min-h-screen pb-28 px-4 pt-4 space-y-4" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>

      {/* Başlık */}
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">İşletme İstatistikleri</h1>
              <span className="text-xl">🏢</span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'rgba(var(--app-accent-rgb),0.5)' }}>
              {userName} · Satış, anomali ve indirim verileri
            </p>
          </div>
        </div>
      </div>

      {/* Kartlar */}
      <div className="space-y-3">
        {cards.map((item) => (
          <button
            key={item.tab}
            onClick={() => onNavigate(item.tab)}
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