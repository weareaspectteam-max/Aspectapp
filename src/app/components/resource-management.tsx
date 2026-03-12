import { ArrowLeft, MapPin, Package, Users, ArrowRight, DollarSign, BarChart3 } from 'lucide-react';

interface ResourceManagementProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function ResourceManagement({ userName, userRole, onLogout, onNavigate }: ResourceManagementProps) {
  const managementCards = [
    {
      title: 'Mekan Yönetimi',
      description: 'Proje mekanlarını yönetin',
      icon: MapPin,
      emoji: '📍',
      bgColor: 'bg-purple-700/40',
      borderColor: 'border-purple-600/50',
      iconBg: 'bg-purple-600/60',
      action: () => onNavigate('mekan-management'),
    },
    {
      title: 'Malzeme Yönetimi',
      description: 'Ekipman ve malzemeleri yönetin',
      icon: Package,
      emoji: '📦',
      bgColor: 'bg-lime-700/40',
      borderColor: 'border-lime-600/50',
      iconBg: 'bg-lime-600/60',
      action: () => onNavigate('equipment-page'),
    },
    {
      title: 'Kullanıcı Yönetimi',
      description: 'Personel ve yöneticileri yönetin',
      icon: Users,
      emoji: '👥',
      bgColor: 'bg-orange-800/40',
      borderColor: 'border-orange-700/50',
      iconBg: 'bg-orange-700/60',
      action: () => onNavigate('user-management'),
    },
    {
      title: 'Maliyet Yönetimi',
      description: 'Maliyetleri takip edin ve yönetin',
      icon: DollarSign,
      emoji: '💰',
      bgColor: 'bg-blue-700/40',
      borderColor: 'border-blue-600/50',
      iconBg: 'bg-blue-600/60',
      action: () => onNavigate('cost-management'),
    },
    {
      title: 'Satış Raporu',
      description: 'Ciro, personel ve albüm kırılımı',
      icon: BarChart3,
      emoji: '📈',
      bgColor: 'bg-teal-700/40',
      borderColor: 'border-teal-600/50',
      iconBg: 'bg-teal-600/60',
      action: () => onNavigate('satis-raporu'),
    },
  ];

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => onNavigate('business-panel')}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">Mekan - Malzeme - Kullanıcı - Maliyet - Satış Raporu</h1>
            </div>
            <p className="text-sm text-gray-400">Tüm kaynakları tek yerden yönetin</p>
          </div>
        </div>
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