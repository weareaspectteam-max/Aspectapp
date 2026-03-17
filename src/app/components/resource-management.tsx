import { ArrowLeft, MapPin, Package, Users, ArrowRight, DollarSign, BarChart3, AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react';

interface ResourceManagementProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function ResourceManagement({ userName, userRole, onLogout, onNavigate }: ResourceManagementProps) {
  const managementCards = [
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

  const isYonetici = ['yonetici', 'ust-mudur', 'mudur'].includes(userRole);

  // Personel İstatistikleri alt modülleri
  const personelIstatistikCards = [
    {
      title: 'Anomali Panosu',
      description: 'Stok fark kayıtlarında kimin kaç puan aldığı',
      emoji: '🚨',
      bgColor: 'bg-rose-900/40',
      borderColor: 'border-rose-700/50',
      iconBg: 'bg-rose-700/60',
      action: () => onNavigate('anomali-panosu'),
    },
    {
      title: 'İndirim İstatistikleri',
      description: 'Kimin ne kadar indirim yaptığı, uzun ve kısa dönem',
      emoji: '🏷️',
      bgColor: 'bg-amber-900/40',
      borderColor: 'border-amber-700/50',
      iconBg: 'bg-amber-700/60',
      action: () => onNavigate('indirim-istatistik'),
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
              <h1 className="text-2xl font-bold text-white">Yönetim Paneli</h1>
            </div>
            <p className="text-sm text-gray-400">Tüm kaynakları tek yerden yönetin</p>
          </div>
        </div>
      </div>

      {/* ── Ana Yönetim Kartları ── */}
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

      {/* ── Personel İstatistikleri (sadece yöneticiler) ── */}
      {isYonetici && (
        <div className="px-6 mt-8">
          {/* Bölüm başlığı */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 rounded-full bg-violet-500" />
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h2 className="text-base font-bold text-white">Personel İstatistikleri</h2>
            </div>
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-violet-400 font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30">
              YÖNETİCİ
            </span>
          </div>

          <div className="space-y-3">
            {personelIstatistikCards.map((item) => (
              <button
                key={item.title}
                onClick={item.action}
                className={`w-full backdrop-blur-xl ${item.bgColor} border-2 ${item.borderColor} rounded-2xl p-5 hover:scale-[1.02] transition-all active:scale-95`}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl ${item.iconBg} border-2 ${item.borderColor} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <span className="text-2xl">{item.emoji}</span>
                  </div>

                  {/* Text */}
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-bold text-white mb-0.5">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}