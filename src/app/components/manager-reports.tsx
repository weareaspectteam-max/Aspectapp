import { useState } from 'react';
import { FileText, TrendingUp, ArrowLeft, Calendar, Users, ArrowRight, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LocationVisits } from './location-visits';
import { StaffInterviews } from './staff-interviews';
import { WeeklyMonthlyReports } from './weekly-monthly-reports';
import { UserRole } from './login';

interface ManagerReportsProps {
  userName?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  onBack?: () => void;
}

type ReportCategory = 'main' | 'location-visits' | 'weekly-monthly' | 'staff-interviews';

export function ManagerReports({ 
  userName = '', 
  userRole = 'yonetici', 
  onLogout = () => {}, 
  onNavigate = () => {},
  onBack = () => {}
}: ManagerReportsProps) {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('main');
  const [activeTab, setActiveTab] = useState('visits');
  const [triggerNewVisit, setTriggerNewVisit] = useState(false);

  // Ana kategoriye dön
  const handleBackToMain = () => {
    setSelectedCategory('main');
  };

  // Yeni ziyaret kaydı açılacak
  const handleNewVisitClick = () => {
    setTriggerNewVisit(true);
    // Reset trigger after it's used
    setTimeout(() => setTriggerNewVisit(false), 100);
  };

  // Eğer kategori seçilmişse, o kategoriyi göster
  if (selectedCategory === 'location-visits') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">
        {/* Header */}
        <div className="sticky top-0 z-[5] backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-4">
              <button 
                onClick={handleBackToMain}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">📍</span>
                  Mekan Ziyaretleri
                </h1>
                <p className="text-sm text-gray-400">Ziyaret kayıtları ve performans</p>
              </div>
              {/* Yeni Kayıt Ekle Button - Sadece Ziyaretler tab'ında görünür */}
              {activeTab === 'visits' && (
                <button
                  onClick={handleNewVisitClick}
                  className="px-4 py-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium shadow-lg hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Yeni Kayıt Ekle</span>
                </button>
              )}
            </div>

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-white/5 border border-white/10 p-1 rounded-xl">
                <TabsTrigger 
                  value="visits" 
                  className="flex items-center gap-2 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-white rounded-lg transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-xs sm:text-sm">Ziyaretler</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="performance" 
                  className="flex items-center gap-2 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-white rounded-lg transition-all"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs sm:text-sm">Performans</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Tabs Content */}
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="visits" className="m-0">
            <LocationVisits 
              userName={userName}
              userRole={userRole}
              onLogout={onLogout}
              onNavigate={onNavigate}
              embedded={true}
              onBack={() => {}}
              showOwnHeader={false}
              externalTriggerNewVisit={triggerNewVisit}
              onNewVisitFormOpen={() => {}}
            />
          </TabsContent>

          <TabsContent value="performance" className="m-0">
            <PerformanceTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Haftalık ve Aylık Raporlar kategorisi
  if (selectedCategory === 'weekly-monthly') {
    return (
      <WeeklyMonthlyReports 
        onBack={handleBackToMain}
        userName={userName}
        userRole={userRole}
      />
    );
  }

  // Personel Görüşmeleri kategorisi
  if (selectedCategory === 'staff-interviews') {
    return (
      <StaffInterviews 
        onBack={handleBackToMain} 
        userName={userName}
        userRole={userRole}
      />
    );
  }

  // Ana ekran - 3 kategori kartı
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Müdür Raporları
              </h1>
              <p className="text-sm text-gray-400">Müdür aktiviteleri ve raporlar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Kategori Kartları */}
      <div className="px-4 py-6 space-y-4">
        {/* Mekan Ziyaretleri Kartı - Sadece Yönetici, Üst Müdür ve Müdür görebilir */}
        {(userRole === 'yonetici' || userRole === 'ust-mudur' || userRole === 'mudur') && (
          <button
            onClick={() => setSelectedCategory('location-visits')}
            className="w-full backdrop-blur-xl bg-gradient-to-br from-indigo-600/30 to-indigo-700/20 border-2 border-indigo-500/40 rounded-2xl p-6 hover:scale-[1.02] transition-all active:scale-95"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Icon Circle */}
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/30 border-2 border-indigo-400/40 flex items-center justify-center shadow-lg">
                  <span className="text-3xl">📍</span>
                </div>

                {/* Text */}
                <div className="text-left">
                  <h3 className="text-xl font-bold text-white mb-1">Mekan Ziyaretleri</h3>
                  <p className="text-sm text-gray-300">Ziyaret kayıtları ve performans analizi</p>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight className="w-6 h-6 text-gray-300" />
            </div>
          </button>
        )}

        {/* Haftalık ve Aylık Raporlar Kartı */}
        <button
          onClick={() => setSelectedCategory('weekly-monthly')}
          className="w-full backdrop-blur-xl bg-gradient-to-br from-purple-600/30 to-purple-700/20 border-2 border-purple-500/40 rounded-2xl p-6 hover:scale-[1.02] transition-all active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Icon Circle */}
              <div className="w-16 h-16 rounded-2xl bg-purple-500/30 border-2 border-purple-400/40 flex items-center justify-center shadow-lg">
                <span className="text-3xl">📊</span>
              </div>

              {/* Text */}
              <div className="text-left">
                <h3 className="text-xl font-bold text-white mb-1">Haftalık ve Aylık Raporlar</h3>
                <p className="text-sm text-gray-300">Periyodik performans raporları</p>
              </div>
            </div>

            {/* Arrow */}
            <ArrowRight className="w-6 h-6 text-gray-300" />
          </div>
        </button>

        {/* Personel Görüşmeleri Kartı */}
        <button
          onClick={() => setSelectedCategory('staff-interviews')}
          className="w-full backdrop-blur-xl bg-gradient-to-br from-blue-600/30 to-blue-700/20 border-2 border-blue-500/40 rounded-2xl p-6 hover:scale-[1.02] transition-all active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Icon Circle */}
              <div className="w-16 h-16 rounded-2xl bg-blue-500/30 border-2 border-blue-400/40 flex items-center justify-center shadow-lg">
                <span className="text-3xl">👥</span>
              </div>

              {/* Text */}
              <div className="text-left">
                <h3 className="text-xl font-bold text-white mb-1">Personel Görüşmeleri</h3>
                <p className="text-sm text-gray-300">Müdür-personel görüşme kayıtları</p>
              </div>
            </div>

            {/* Arrow */}
            <ArrowRight className="w-6 h-6 text-gray-300" />
          </div>
        </button>
      </div>
    </div>
  );
}

// Performance Summary Tab
function PerformanceTab() {
  const performanceData = [
    {
      location: 'Sunset Beach Club',
      type: 'Beach Club',
      avgScore: 4.5,
      totalVisits: 12,
      lastVisit: '2024-03-01',
      trend: 'up',
      improvement: '+0.3',
      status: 'excellent'
    },
    {
      location: 'Blue Lagoon Restaurant',
      type: 'Restaurant',
      avgScore: 4.25,
      totalVisits: 8,
      lastVisit: '2024-03-03',
      trend: 'stable',
      improvement: '0.0',
      status: 'good'
    },
    {
      location: 'Paradise Hotel',
      type: 'Hotel',
      avgScore: 3.5,
      totalVisits: 15,
      lastVisit: '2024-03-05',
      trend: 'down',
      improvement: '-0.5',
      status: 'needsAttention'
    },
    {
      location: 'Ocean Explorer Tours',
      type: 'Boat Tour',
      avgScore: 4.8,
      totalVisits: 6,
      lastVisit: '2024-02-28',
      trend: 'up',
      improvement: '+0.2',
      status: 'excellent'
    },
    {
      location: 'Golden Sands Resort',
      type: 'Beach Club',
      avgScore: 4.0,
      totalVisits: 10,
      lastVisit: '2024-02-25',
      trend: 'stable',
      improvement: '0.0',
      status: 'good'
    }
  ];

  const statusConfig = {
    excellent: { label: 'Mükemmel', color: 'green', emoji: '🌟' },
    good: { label: 'İyi', color: 'blue', emoji: '✅' },
    needsAttention: { label: 'İyileştirme Gerekli', color: 'orange', emoji: '⚠️' }
  };

  const overallStats = {
    avgScore: 4.21,
    totalVisits: 51,
    activeLocations: 5,
    improvementRate: 78
  };

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="backdrop-blur-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 border border-indigo-400/30 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-white mb-1">{overallStats.avgScore}</div>
          <div className="text-xs text-gray-300">Ortalama Skor</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-white mb-1">{overallStats.totalVisits}</div>
          <div className="text-xs text-gray-300">Toplam Ziyaret</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-400/30 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-white mb-1">{overallStats.activeLocations}</div>
          <div className="text-xs text-gray-300">Aktif Mekan</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-400/30 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-white mb-1">%{overallStats.improvementRate}</div>
          <div className="text-xs text-gray-300">İyileşme Oranı</div>
        </div>
      </div>

      {/* Section Title */}
      <div className="pt-2">
        <h2 className="text-lg font-bold text-white mb-1">Mekan Performansları</h2>
        <p className="text-sm text-gray-400">Detaylı performans değerlendirmeleri</p>
      </div>

      {/* Location Performance Cards */}
      <div className="space-y-3">
        {performanceData.map((location, idx) => {
          const status = statusConfig[location.status as keyof typeof statusConfig];
          return (
            <div 
              key={idx}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-white font-bold mb-1">{location.location}</h3>
                  <p className="text-xs text-gray-400">{location.type}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium bg-${status.color}-500/20 text-${status.color}-300 border border-${status.color}-400/30 flex items-center gap-1`}>
                  <span>{status.emoji}</span>
                  <span>{status.label}</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">{location.avgScore}</div>
                  <div className="text-xs text-gray-400">Ort. Skor</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">{location.totalVisits}</div>
                  <div className="text-xs text-gray-400">Ziyaret</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold mb-1 ${
                    location.trend === 'up' ? 'text-green-400' : 
                    location.trend === 'down' ? 'text-red-400' : 
                    'text-gray-400'
                  }`}>
                    {location.improvement}
                  </div>
                  <div className="text-xs text-gray-400">Trend</div>
                </div>
              </div>

              {/* Last Visit */}
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400 text-center">
                Son Ziyaret: {new Date(location.lastVisit).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}