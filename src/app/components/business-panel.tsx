import { MapPin, Users, Briefcase, Package, BarChart3, DollarSign, FileText, ArrowRight } from 'lucide-react';

interface BusinessPanelProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function BusinessPanel({ userName, onNavigate }: BusinessPanelProps) {
  const managementCards = [
    {
      title: 'İşletme Genel Durum',
      description: 'Gelir, gider ve kar/zarar takibi',
      icon: Briefcase,
      emoji: '💼',
      bgColor: 'bg-stone-700/40',
      borderColor: 'border-stone-600/50',
      iconBg: 'bg-stone-600/60',
      action: () => onNavigate('isletme-genel-durum'),
    },
    {
      title: 'Stok Dağılımı',
      description: 'Albüm ve baskı kağıdı stok analizi',
      icon: BarChart3,
      emoji: '📊',
      bgColor: 'bg-pink-700/40',
      borderColor: 'border-pink-600/50',
      iconBg: 'bg-pink-600/60',
      action: () => onNavigate('stock-distribution'),
    },
    {
      title: 'Mekan - Malzeme - Kullanıcı - Maliyet Yönetimi',
      description: 'Tüm kaynakları tek yerden yönetin',
      icon: DollarSign,
      emoji: '⚙️',
      bgColor: 'bg-green-700/40',
      borderColor: 'border-green-600/50',
      iconBg: 'bg-green-600/60',
      action: () => onNavigate('resource-management'),
    },
    {
      title: 'Müdür Raporları',
      description: 'Müdür ziyaretleri ve faaliyetleri',
      icon: FileText,
      emoji: '📋',
      bgColor: 'bg-indigo-700/40',
      borderColor: 'border-indigo-600/50',
      iconBg: 'bg-indigo-600/60',
      action: () => onNavigate('manager-reports'),
    },
  ];

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold text-white">Yönetici Paneli</h1>
          <span className="text-3xl">⚙️</span>
        </div>
        <p className="text-sm text-gray-400">İşletme yönetim araçları</p>
      </div>

      {/* Menu Cards */}
      <div className="px-6 space-y-4">
        {managementCards.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.title}
              onClick={item.action}
              className={`w-full backdrop-blur-xl ${item.bgColor} border-2 ${item.borderColor} rounded-2xl p-6 hover:scale-[1.02] transition-all active:scale-95`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Icon Circle */}
                  <div className={`w-16 h-16 rounded-2xl ${item.iconBg} border-2 ${item.borderColor} flex items-center justify-center shadow-lg`}>
                    <span className="text-3xl">{item.emoji}</span>
                  </div>

                  {/* Text */}
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-6 h-6 text-gray-400" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}