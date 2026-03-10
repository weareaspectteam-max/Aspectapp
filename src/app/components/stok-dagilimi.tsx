import { ArrowLeft, FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { UserRole } from './login';

interface AlbumItem {
  name: string;
  value: number;
  color: string;
}

interface ProjectPerformance {
  name: string;
  sales: number;
  revenue: number;
  staff: number;
  efficiency: number;
}

interface StokDagilimiProps {
  userName: string;
  userRole: UserRole;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function StokDagilimi({ userName, userRole, onLogout, onNavigate }: StokDagilimiProps) {
  // Mock Data - Genel Albüm Dağılımı
  const albumDistribution: AlbumItem[] = [
    { name: '3 Kare', value: 12, color: '#9dd9ea' },
    { name: '5 Kare', value: 18, color: '#a8e6cf' },
    { name: '7 Kare', value: 24, color: '#ffd4a3' },
    { name: '9 Kare', value: 20, color: '#ffb3ba' },
    { name: '11 Kare', value: 14, color: '#d4a5ff' },
    { name: '13 Kare', value: 8, color: '#b8d4f1' },
    { name: '15 Kare', value: 10, color: '#ffc78f' },
  ];

  // Mock Data - Proje Listesi
  const projectPerformance: ProjectPerformance[] = [
    { name: 'ZOKA Beach', sales: 32, revenue: 15600, staff: 4, efficiency: 96 },
    { name: 'Balık Hali', sales: 24, revenue: 11200, staff: 3, efficiency: 88 },
    { name: 'Hamdi Kahvesi', sales: 28, revenue: 13200, staff: 3, efficiency: 92 },
    { name: 'Tekne Turları', sales: 14, revenue: 5200, staff: 2, efficiency: 84 },
  ];

  // Mock Data - Mekan Bazlı Kağıt Stokları
  const projectPaperStock: Record<string, number> = {
    'ZOKA Beach': 287,
    'Balık Hali': 195,
    'Hamdi Kahvesi': 243,
    'Tekne Turları': 156,
    'Depo Stoğu': 420,
  };

  // Mock Data - Proje Bazlı Albüm Dağılımı
  const projectAlbumDistribution: Record<string, AlbumItem[]> = {
    'ZOKA Beach': [
      { name: '3 Kare', value: 5, color: '#9dd9ea' },
      { name: '5 Kare', value: 8, color: '#a8e6cf' },
      { name: '7 Kare', value: 10, color: '#ffd4a3' },
      { name: '9 Kare', value: 6, color: '#ffb3ba' },
      { name: '11 Kare', value: 2, color: '#d4a5ff' },
      { name: '13 Kare', value: 1, color: '#b8d4f1' },
      { name: '15 Kare', value: 0, color: '#ffc78f' },
    ],
    'Balık Hali': [
      { name: '3 Kare', value: 3, color: '#9dd9ea' },
      { name: '5 Kare', value: 6, color: '#a8e6cf' },
      { name: '7 Kare', value: 8, color: '#ffd4a3' },
      { name: '9 Kare', value: 5, color: '#ffb3ba' },
      { name: '11 Kare', value: 2, color: '#d4a5ff' },
      { name: '13 Kare', value: 0, color: '#b8d4f1' },
      { name: '15 Kare', value: 0, color: '#ffc78f' },
    ],
    'Hamdi Kahvesi': [
      { name: '3 Kare', value: 2, color: '#9dd9ea' },
      { name: '5 Kare', value: 3, color: '#a8e6cf' },
      { name: '7 Kare', value: 4, color: '#ffd4a3' },
      { name: '9 Kare', value: 7, color: '#ffb3ba' },
      { name: '11 Kare', value: 8, color: '#d4a5ff' },
      { name: '13 Kare', value: 4, color: '#b8d4f1' },
      { name: '15 Kare', value: 0, color: '#ffc78f' },
    ],
    'Tekne Turları': [
      { name: '3 Kare', value: 2, color: '#9dd9ea' },
      { name: '5 Kare', value: 1, color: '#a8e6cf' },
      { name: '7 Kare', value: 2, color: '#ffd4a3' },
      { name: '9 Kare', value: 2, color: '#ffb3ba' },
      { name: '11 Kare', value: 2, color: '#d4a5ff' },
      { name: '13 Kare', value: 3, color: '#b8d4f1' },
      { name: '15 Kare', value: 2, color: '#ffc78f' },
    ],
    'Depo Stoğu': [
      { name: '3 Kare', value: 45, color: '#9dd9ea' },
      { name: '5 Kare', value: 62, color: '#a8e6cf' },
      { name: '7 Kare', value: 78, color: '#ffd4a3' },
      { name: '9 Kare', value: 53, color: '#ffb3ba' },
      { name: '11 Kare', value: 38, color: '#d4a5ff' },
      { name: '13 Kare', value: 28, color: '#b8d4f1' },
      { name: '15 Kare', value: 35, color: '#ffc78f' },
    ],
  };

  // Toplam hesaplama
  const totalAlbums = albumDistribution.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button 
            onClick={() => onNavigate('business-panel')}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-3xl font-bold text-white">Stok Dağılımı</h1>
          <span className="text-3xl">📊</span>
        </div>
        <p className="text-sm text-gray-400 ml-[52px]">
          Genel albüm ve baskı kağıdı stok analizi • {new Date().toLocaleDateString('tr-TR')}
        </p>
      </div>

      {/* 1. GENEL ALBÜM DAĞILIMI */}
      <div className="px-6 mb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Genel Albüm Dağılımı</h3>
          
          {/* Compact Bar List */}
          <div className="space-y-2.5">
            {albumDistribution.map((item) => {
              const percentage = ((item.value / totalAlbums) * 100).toFixed(0);
              
              return (
                <div key={item.name} className="flex items-center gap-2">
                  {/* İsim (Sabit Genişlik) */}
                  <div className="w-14 text-xs text-gray-300 font-medium">
                    {item.name}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="flex-1 h-6 bg-black/40 rounded-md overflow-hidden border border-white/10">
                    <div
                      className="h-full rounded-md transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  
                  {/* Miktar */}
                  <div className="w-12 text-right text-xs text-white font-bold">
                    {item.value}
                  </div>
                  
                  {/* Yüzde */}
                  <div className="w-10 text-right text-xs text-gray-400">
                    %{percentage}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Toplam */}
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
            <span className="text-sm text-gray-400">Toplam Albüm</span>
            <span className="text-lg font-bold text-white">{totalAlbums}</span>
          </div>
        </div>
      </div>

      {/* 2. MEKAN BAZLI KAĞIT STOKLARI */}
      <div className="px-6 mb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Mekan Bazlı Albüm Kağıtı Stokları</h3>
          
          <div className="space-y-2">
            {/* Lokasyonlar */}
            {projectPerformance.map((project) => {
              const paperStock = projectPaperStock[project.name] || 0;
              
              return (
                <div 
                  key={project.name}
                  className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center justify-between hover:bg-black/40 transition-all"
                >
                  {/* Sol: Icon + Bilgi */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
                      <span className="text-lg">📄</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{project.name}</h4>
                      <p className="text-xs text-gray-400">Albüm kağıdı stoğu</p>
                    </div>
                  </div>
                  
                  {/* Sağ: Miktar */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#a8e6cf]">{paperStock}</div>
                    <div className="text-xs text-gray-400">adet</div>
                  </div>
                </div>
              );
            })}
            
            {/* Depo Stoğu - Özel Tasarım (Kalın Border) */}
            <div className="bg-black/40 backdrop-blur-sm border-2 border-white/20 rounded-xl p-3 flex items-center justify-between hover:bg-black/50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/30 to-white/20 flex items-center justify-center shadow-lg">
                  <span className="text-lg">🏪</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Depo Stoğu</h4>
                  <p className="text-xs text-gray-400">Merkez depo</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[#a8e6cf]">{projectPaperStock['Depo Stoğu']}</div>
                <div className="text-xs text-gray-400">adet</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MEKAN BAZLI ALBÜM DAĞILIMI */}
      <div className="px-6 mb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Mekan Bazlı Albüm Dağılımı</h3>
          
          <div className="space-y-5">
            {/* Her Lokasyon İçin Kart */}
            {projectPerformance.map((project) => {
              const projectAlbums = projectAlbumDistribution[project.name] || [];
              const projectTotal = projectAlbums.reduce((sum, item) => sum + item.value, 0);
              
              return (
                <div 
                  key={project.name}
                  className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4"
                >
                  {/* Header: Lokasyon + Satış Sayısı */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <h4 className="font-bold text-white">{project.name}</h4>
                    <span className="text-sm text-gray-400">{project.sales} satış</span>
                  </div>

                  {/* Mini Progress Bar'lar */}
                  <div className="space-y-1.5">
                    {projectAlbums.map((item) => {
                      const percentage = projectTotal > 0 
                        ? ((item.value / projectTotal) * 100).toFixed(0) 
                        : '0';
                      
                      return (
                        <div key={item.name} className="flex items-center gap-2">
                          {/* İsim */}
                          <div className="w-12 text-xs text-gray-300">{item.name}</div>
                          
                          {/* Mini Progress Bar */}
                          <div className="flex-1 h-5 bg-black/40 rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-300"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                          
                          {/* Miktar */}
                          <div className="w-8 text-right text-xs text-white font-bold">
                            {item.value}
                          </div>
                          
                          {/* Yüzde */}
                          <div className="w-9 text-right text-xs text-gray-400">
                            %{percentage}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {/* Depo Stoğu - Özel Tasarım */}
            {(() => {
              const depoAlbums = projectAlbumDistribution['Depo Stoğu'] || [];
              const depoTotal = depoAlbums.reduce((sum, item) => sum + item.value, 0);
              
              return (
                <div className="bg-black/40 backdrop-blur-sm border-2 border-white/20 rounded-xl p-4">
                  {/* Header: 🏪 Icon + Toplam */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏪</span>
                      <h4 className="font-bold text-white">Depo Stoğu</h4>
                    </div>
                    <span className="text-sm text-gray-400">{depoTotal} albüm</span>
                  </div>

                  {/* Album Bars */}
                  <div className="space-y-1.5">
                    {depoAlbums.map((item) => {
                      const percentage = ((item.value / depoTotal) * 100).toFixed(0);
                      
                      return (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-12 text-xs text-gray-300">{item.name}</div>
                          <div className="flex-1 h-5 bg-black/40 rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-300"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                          <div className="w-8 text-right text-xs text-white font-bold">
                            {item.value}
                          </div>
                          <div className="w-9 text-right text-xs text-gray-400">
                            %{percentage}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-3 gap-3">
          {/* PDF Button */}
          <button
            onClick={() => console.log('PDF export başlatılıyor...')}
            className="bg-[#7dd3d0] hover:bg-[#6ac5c2] rounded-2xl px-4 py-3 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <FileDown className="w-4 h-4 text-[#2a2a3a]" />
            <span className="font-semibold text-[#2a2a3a] text-sm">PDF</span>
          </button>

          {/* CSV Button */}
          <button
            onClick={() => console.log('CSV export başlatılıyor...')}
            className="bg-[#4a9d7e] hover:bg-[#428a6e] rounded-2xl px-4 py-3 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span className="font-semibold text-white text-sm">CSV</span>
          </button>

          {/* Yazdır Button */}
          <button
            onClick={() => console.log('Yazdırma başlatılıyor...')}
            className="bg-[#8b6bb7] hover:bg-[#7a5ca5] rounded-2xl px-4 py-3 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4 text-white" />
            <span className="font-semibold text-white text-sm">Yazdır</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <NewBottomNav 
        activeTab="business-panel"
        onNavigate={onNavigate}
        userRole={userRole}
      />
    </div>
  );
}
