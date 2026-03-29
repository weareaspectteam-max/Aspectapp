import { BookOpen, Camera, TrendingUp, Smartphone, Award, ChevronRight, Play, CheckCircle } from 'lucide-react';

import { NewBottomNav } from './new-bottom-nav';
import { useState } from 'react';

interface AspectAcademyProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function AspectAcademy({ userName, userRole, onLogout, onNavigate }: AspectAcademyProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const categories = [
    {
      id: 'photography',
      title: 'Fotoğrafçılık Teknikleri',
      icon: Camera,
      color: '#9dd9ea',
      emoji: '📸',
      topics: [
        {
          title: 'Altın Saat Kullanımı',
          description: 'Gün batımı ve gün doğumunda en iyi fotoğraflar nasıl çekilir',
          completed: true,
        },
        {
          title: 'Pozlandırma Ayarları',
          description: 'ISO, diyafram ve obtüratör hızı dengesi',
          completed: true,
        },
        {
          title: 'Kompozisyon Kuralları',
          description: 'Üçte bir kuralı ve çerçeveleme teknikleri',
          completed: false,
        },
        {
          title: 'Portre Fotoğrafçılığı',
          description: 'Müşteri ile iletişim ve doğal pozlar',
          completed: false,
        },
        {
          title: 'Doğal Işık Kullanımı',
          description: 'Gölge ve aydınlatma kontrolü',
          completed: false,
        },
      ],
    },
    {
      id: 'sales',
      title: 'Satış Teknikleri',
      icon: TrendingUp,
      color: '#a8e6cf',
      emoji: '💰',
      topics: [
        {
          title: 'Müşteri Yaklaşımı',
          description: 'İlk temas ve güven oluşturma stratejileri',
          completed: true,
        },
        {
          title: 'Ürün Sunumu',
          description: 'Albüm ve çerçeve özelliklerini etkili anlatma',
          completed: false,
        },
        {
          title: 'Fiyat İletişimi',
          description: 'Paket fiyatlarını profesyonelce sunma',
          completed: false,
        },
        {
          title: 'İtiraz Yönetimi',
          description: '"Pahalı" itirazını fırsata çevirme',
          completed: false,
        },
        {
          title: 'Satış Kapama Teknikleri',
          description: 'Kararsız müşteriyi ikna etme yöntemleri',
          completed: false,
        },
      ],
    },
    {
      id: 'app',
      title: 'Uygulama Kullanımı',
      icon: Smartphone,
      color: '#ffd4a3',
      emoji: '📱',
      topics: [
        {
          title: 'Hızlı Satış Girişi',
          description: 'Satışları anında kaydetme ve stok güncelleme',
          completed: true,
        },
        {
          title: 'Vardiya Başlatma',
          description: 'Fotoğraf çekimi ve vardiya prosedürü',
          completed: true,
        },
        {
          title: 'Liderlik Tablosu',
          description: 'Performansını takip etme ve hedef belirleme',
          completed: false,
        },
        {
          title: 'Mesajlaşma Sistemi',
          description: '#general kanalı ve bildirimler',
          completed: false,
        },
        {
          title: 'Profil Yönetimi',
          description: 'İstatistikleri görüntüleme ve hedef takibi',
          completed: false,
        },
      ],
    },
    {
      id: 'tips',
      title: 'Pro İpuçları',
      icon: Award,
      color: '#d4b5f7',
      emoji: '✨',
      topics: [
        {
          title: 'Yüksek Satış Stratejileri',
          description: '15\'li paketleri teşvik etme yöntemleri',
          completed: false,
        },
        {
          title: 'Müşteri Deneyimi',
          description: 'Tekrar ziyaret sağlayan hizmet kalitesi',
          completed: false,
        },
        {
          title: 'Zaman Yönetimi',
          description: 'Yoğun saatlerde verimli çalışma',
          completed: false,
        },
        {
          title: 'Ekip Koordinasyonu',
          description: 'Meslektaşlarla etkili iş birliği',
          completed: false,
        },
        {
          title: 'Stres Yönetimi',
          description: 'Yoğun sezonlarda moral yüksek tutma',
          completed: false,
        },
      ],
    },
  ];

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="pb-20 min-h-screen" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      {/* Header Banner */}
      <div className="px-6 mb-6">{/* Removed pt-6 for staff role */}
        <div className="bg-gradient-to-br from-[#ffd4a3] via-[#ffe5b4] to-[#9dd9ea] rounded-3xl p-6 text-[#2d3748] shadow-2xl border-2 border-white/20">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-16 h-16 rounded-2xl bg-white/30 backdrop-blur flex items-center justify-center text-3xl border-2 border-white shadow-lg">
              🎓
            </div>
            <div>
              <h1 className="text-2xl font-black mb-1">Aspect Akademi</h1>
              <p className="text-sm opacity-90">Becerilerini geliştir, satışlarını artır!</p>
            </div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 backdrop-blur">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">İlerleme Durumu</span>
              <span className="font-bold">6/20 Tamamlandı</span>
            </div>
            <div className="w-full h-2.5 bg-white/30 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-gradient-to-r from-[#2a2a3a] to-[#3a3a4e] rounded-full transition-all"
                style={{ width: '30%' }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="px-6 space-y-4">
        {categories.map((category) => {
          const IconComponent = category.icon;
          const isExpanded = expandedSection === category.id;
          const completedCount = category.topics.filter(t => t.completed).length;

          return (
            <div key={category.id} className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl overflow-hidden shadow-lg">
              {/* Category Header */}
              <button
                onClick={() => toggleSection(category.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.emoji}
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-white text-base">{category.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <CheckCircle className="w-3.5 h-3.5 text-[#a8e6cf]" />
                      <span>{completedCount}/{category.topics.length} Tamamlandı</span>
                    </div>
                  </div>
                </div>
                <div className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
              </button>

              {/* Topics List */}
              {isExpanded && (
                <div className="border-t border-white/10 bg-white/5">
                  {category.topics.map((topic, index) => (
                    <div
                      key={index}
                      className="p-4 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {topic.completed ? (
                          <div className="w-8 h-8 rounded-lg bg-[#a8e6cf]/20 border border-[#a8e6cf]/40 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-[#a8e6cf]" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                            <Play className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className={`font-semibold text-sm mb-1 ${topic.completed ? 'text-white' : 'text-gray-300'}`}>
                            {topic.title}
                          </h4>
                          <p className="text-xs text-gray-400 leading-relaxed">{topic.description}</p>
                          {topic.completed && (
                            <div className="flex items-center gap-1 mt-2">
                              <span className="text-xs text-[#a8e6cf] font-semibold">✓ Tamamlandı</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Motivational Footer */}
      <div className="px-6 mt-6 pb-6">
        <div className="bg-gradient-to-r from-[#9dd9ea]/20 to-[#a8e6cf]/20 rounded-2xl p-5 border-2 border-[#9dd9ea]/30">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🚀</span>
            <div>
              <h3 className="font-bold text-white text-sm mb-1">Sürekli Gelişim</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Her yeni beceri seni daha başarılı bir fotoğrafçı yapıyor! Aspect Akademi ile kariyerini bir üst seviyeye taşı. 📚✨
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Only for staff */}
      {['personel', 'operasyon', 'bekleyen'].includes(userRole) && (
        <NewBottomNav
          activeTab="profile"
          onTabChange={onNavigate}
          userRole={userRole}
        />
      )}
    </div>
  );
}