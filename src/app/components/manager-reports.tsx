import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, TrendingUp, ArrowLeft, ArrowRight, Calendar, Users, Plus, Star, MapPin, Camera, User, Award, Loader2, TrendingDown, Minus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LocationVisits } from './location-visits';
import { StaffInterviews } from './staff-interviews';
import { WeeklyMonthlyReports } from './weekly-monthly-reports';
import { UserRole } from './login';
import { getToken, buildHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         20,
};

interface ManagerReportsProps {
  userName?: string;
  userRole?: UserRole;
  accessToken?: string;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  onBack?: () => void;
}

type ReportCategory = 'main' | 'location-visits' | 'weekly-monthly' | 'staff-interviews';

export function ManagerReports({ 
  userName = '', 
  userRole = 'yonetici',
  accessToken = '',
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
              accessToken={accessToken}
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
            <PerformanceTab accessToken={accessToken} />
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
        accessToken={accessToken}
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
        accessToken={accessToken}
      />
    );
  }

  // Ana ekran - 3 kategori kartı
  return (
    <div className="min-h-screen pb-28 px-4 pt-4 space-y-4">

      {/* Başlık — business-panel ile birebir */}
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <button
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16, color: 'white' }} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">Müdür Raporları</h1>
              <span className="text-xl">📋</span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'rgba(196,181,253,0.5)' }}>
              {userName} · Müdür aktiviteleri ve raporlar
            </p>
          </div>
        </div>
      </div>

      {/* Kartlar — business-panel ile birebir aynı stil */}
      <div className="space-y-3">
        {[
          ...(userRole === 'yonetici' || userRole === 'ust-mudur' || userRole === 'mudur'
            ? [{
                emoji: '📍',
                title: 'Mekan Ziyaretleri',
                description: 'Ziyaret kayıtları ve performans analizi',
                color: '#9dd9ea',
                cat: 'location-visits' as ReportCategory,
              }]
            : []),
          {
            emoji: '📊',
            title: 'Haftalık ve Aylık Raporlar',
            description: 'Periyodik performans raporları',
            color: '#d4b5f7',
            cat: 'weekly-monthly' as ReportCategory,
          },
          {
            emoji: '👥',
            title: 'Personel Görüşmeleri',
            description: 'Müdür-personel görüşme kayıtları',
            color: '#ffd4a3',
            cat: 'staff-interviews' as ReportCategory,
          },
        ].map((item) => (
          <button
            key={item.cat}
            onClick={() => setSelectedCategory(item.cat)}
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

// Performance Summary Tab
function PerformanceTab({ accessToken = '' }: { accessToken?: string }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const h = buildHeaders(await getToken());
        const res = await fetch(`${API_BASE}/ziyaretler`, { headers: h });
        if (res.ok) { const d = await res.json(); setVisits(d.ziyaretler || []); }
      } catch (e) { console.log('PerformanceTab fetch error:', e); }
      finally { setIsLoading(false); }
    };
    load();
  }, []);

  // Lokasyon bazlı gruplama ve istatistik hesaplama
  const locationMap = new Map<string, any[]>();
  visits.forEach(v => {
    const key = v.locationName || 'Bilinmeyen';
    if (!locationMap.has(key)) locationMap.set(key, []);
    locationMap.get(key)!.push(v);
  });

  const performanceData = Array.from(locationMap.entries()).map(([locName, locVisits]) => {
    const completed = locVisits.filter(v => v.status === 'completed');
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const avgScore = avg(completed.map(v => v.generalScore ?? 0));
    const avgCleanliness = avg(completed.map(v => v.cleanlinessScore ?? 0));
    const avgEquipment = avg(completed.map(v => v.equipmentScore ?? 0));
    const avgStaff = avg(completed.map(v => v.staffScore ?? 0));
    const avgCustomer = avg(completed.map(v => v.customerScore ?? 0));

    // Trend: son 3 ile önceki 3 karşılaştır
    const sorted = [...completed].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
    const recent = avg(sorted.slice(0, 3).map(v => v.generalScore ?? 0));
    const older  = avg(sorted.slice(3, 6).map(v => v.generalScore ?? 0));
    const diff = older > 0 ? recent - older : 0;
    const trend = diff > 0.1 ? 'up' : diff < -0.1 ? 'down' : 'stable';

    const lastVisit = sorted[0]?.visitDate ?? null;
    const status = avgScore >= 4.5 ? 'excellent' : avgScore >= 3.5 ? 'good' : 'needsAttention';

    return { locName, totalVisits: locVisits.length, avgScore, avgCleanliness, avgEquipment, avgStaff, avgCustomer, trend, diff, lastVisit, status };
  }).sort((a, b) => b.avgScore - a.avgScore);

  const overallAvg = performanceData.length ? performanceData.reduce((s, l) => s + l.avgScore, 0) / performanceData.length : 0;
  const totalVisits = visits.length;
  const excellentCount = performanceData.filter(l => l.status === 'excellent').length;
  const attentionCount = performanceData.filter(l => l.status === 'needsAttention').length;

  const statusConfig = {
    excellent:       { label: 'Mükemmel',          color: 'green',  emoji: '🌟' },
    good:            { label: 'İyi',                color: 'blue',   emoji: '✅' },
    needsAttention:  { label: 'İyileştirme Gerekli', color: 'orange', emoji: '⚠️' }
  };

  const ScoreBar = ({ label, score, color }: { label: string; score: number; color: string }) => (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-bold text-white">{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-${color}-400 transition-all duration-700`}
          style={{ width: `${(score / 5) * 100}%` }}
        />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (performanceData.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Henüz ziyaret verisi yok</p>
        <p className="text-sm text-gray-500 mt-1">Mekan ziyaretleri eklendikçe performans analizi burada görünecek.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="backdrop-blur-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 border border-indigo-400/30 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-white mb-1">{overallAvg.toFixed(2)}</div>
          <div className="text-xs text-gray-300">Genel Ort. Skor</div>
          <div className="flex justify-center gap-0.5 mt-1">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-3 h-3 ${i <= Math.round(overallAvg) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`} />
            ))}
          </div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-white mb-1">{totalVisits}</div>
          <div className="text-xs text-gray-300">Toplam Ziyaret</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-400/30 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-white mb-1">{excellentCount}</div>
          <div className="text-xs text-gray-300">🌟 Mükemmel Mekan</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-400/30 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-white mb-1">{attentionCount}</div>
          <div className="text-xs text-gray-300">⚠️ Dikkat Gereken</div>
        </div>
      </div>

      {/* Section Title */}
      <div className="pt-2">
        <h2 className="text-lg font-bold text-white mb-1">Mekan Performansları</h2>
        <p className="text-sm text-gray-400">Ziyaret kayıtlarından hesaplanan canlı veriler</p>
      </div>

      {/* Location Performance Cards */}
      <div className="space-y-3">
        {performanceData.map((loc, idx) => {
          const status = statusConfig[loc.status as keyof typeof statusConfig];
          return (
            <div key={idx} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-all">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <h3 className="text-white font-bold text-sm">{loc.locName}</h3>
                  </div>
                  <div className="flex items-center gap-3 ml-6">
                    <span className="text-xs text-gray-400">{loc.totalVisits} ziyaret</span>
                    {loc.lastVisit && (
                      <span className="text-xs text-gray-500">
                        Son: {new Date(loc.lastVisit).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-medium bg-${status.color}-500/20 text-${status.color}-300 border border-${status.color}-400/30 flex items-center gap-1 flex-shrink-0`}>
                  <span>{status.emoji}</span>
                </div>
              </div>

              {/* Genel skor + trend */}
              <div className="flex items-center justify-between mb-3 bg-white/5 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">{loc.avgScore.toFixed(2)}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(loc.avgScore) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`} />
                    ))}
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  loc.trend === 'up' ? 'text-green-400' : loc.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {loc.trend === 'up'     ? <TrendingUp   className="w-4 h-4" /> :
                   loc.trend === 'down'   ? <TrendingDown className="w-4 h-4" /> :
                                            <Minus        className="w-4 h-4" />}
                  <span>{loc.diff > 0 ? '+' : ''}{loc.diff.toFixed(1)}</span>
                </div>
              </div>

              {/* Alt skorlar — bar chart */}
              <div className="space-y-2">
                <ScoreBar label="🧹 Temizlik"  score={loc.avgCleanliness} color="blue"   />
                <ScoreBar label="📷 Ekipman"   score={loc.avgEquipment}   color="purple" />
                <ScoreBar label="👤 Personel"  score={loc.avgStaff}       color="green"  />
                <ScoreBar label="😊 İşletme Memnuniyeti" score={loc.avgCustomer} color="orange" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}