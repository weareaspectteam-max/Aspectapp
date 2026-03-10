 STOK DAĞILIMI PANELİ - DETAYLI PROMPT REHBERİ
🎯 HIZLI VERSİYON (Kopyala-Yapıştır):
Stok dağılım analiz paneli oluştur:

3 ANA BÖLÜM:
1. GENEL ALBÜM DAĞILIMI (Tüm lokasyonlar toplam)
2. MEKAN BAZLI KAĞIT STOKLARI (Her lokasyonda kaç adet kağıt var)
3. MEKAN BAZLI ALBÜM DAĞILIMI (Her lokasyonda albüm türlerine göre dağılım)

7 ALBÜM TİPİ:
- 3 Kare 📘 (#9dd9ea - Mavi)
- 5 Kare 📗 (#a8e6cf - Yeşil)
- 7 Kare 📙 (#ffd4a3 - Turuncu)
- 9 Kare 📕 (#ffb3ba - Pembe)
- 11 Kare 📔 (#d4a5ff - Mor)
- 13 Kare 📒 (#b8d4f1 - Açık Mavi)
- 15 Kare 📓 (#ffc78f - Koyu Turuncu)

LOKASYONLAR:
- ZOKA Beach
- Balık Hali
- Hamdi Kahvesi
- Tekne Turları
- Depo Stoğu (özel tasarım - border-2)

GENEL ALBÜM DAĞILIMI:
- Kompakt horizontal bar liste
- Her satır: İsim (14px) + Progress Bar + Miktar + Yüzde
- Renk kodlu progress bar
- Toplam hesaplaması

KAĞIT STOKLARI:
- Her lokasyon için kart
- Sol: 📄 Icon + Lokasyon adı
- Sağ: Adet (yeşil renk)
- Depo Stoğu: 🏪 icon, border-2 (özel)

MEKAN BAZLI DAĞILIM:
- Her lokasyon için accordion kart
- Header: Lokasyon adı + Satış sayısı
- Mini progress bar'lar (her albüm tipi için)
- Depo: border-2 (kalın border)

VERİ YAPISI:
interface AlbumItem {
  name: string;        // '3 Kare'
  value: number;       // 12
  color: string;       // '#9dd9ea'
}

TASARIM:
- Glassmorphism kartlar
- Recharts kullanma (sadece custom bar'lar)
- Embedded mod desteği
- Mobile responsive
- Koyu gradient arka plan

HESAPLAMALAR:
- Yüzde: (value / total) * 100
- Toplam: reduce((sum, item) => sum + item.value, 0)
🔥 TAM DETAYLI VERSİYON:
📌 1. MENÜ KARTI (Manager Hub)
const menuItems = [
  // ... diğer kartlar
  {
    id: 'album-distribution',
    title: 'Stok Dağılımı',
    description: 'Albüm ve baskı kağıdı stok analizi',
    icon: PieChart, // Lucide-react
    emoji: '📊',
    gradient: 'from-indigo-500/20 to-indigo-600/20',
    borderColor: 'border-indigo-500/30',
    iconColor: 'text-indigo-400',
  },
];
📊 2. DATA YAPISI
interface AlbumItem {
  name: string;        // '3 Kare', '5 Kare', vb.
  value: number;       // Miktar
  color: string;       // Hex renk kodu
}

interface ProjectPerformance {
  name: string;        // 'ZOKA Beach'
  sales: number;       // Satış sayısı
  revenue: number;     // Gelir
  staff: number;       // Personel sayısı
  efficiency: number;  // Verimlilik %
}

interface AlbumDistributionProps {
  userName?: string;
  userRole?: 'admin' | 'staff';
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  embedded?: boolean;  // Location Management içinde mi?
  onBack?: () => void;
}
Mock Data:

// Genel Albüm Dağılımı
const albumDistribution: AlbumItem[] = [
  { name: '3 Kare', value: 12, color: '#9dd9ea' },
  { name: '5 Kare', value: 18, color: '#a8e6cf' },
  { name: '7 Kare', value: 24, color: '#ffd4a3' },
  { name: '9 Kare', value: 20, color: '#ffb3ba' },
  { name: '11 Kare', value: 14, color: '#d4a5ff' },
  { name: '13 Kare', value: 8, color: '#b8d4f1' },
  { name: '15 Kare', value: 10, color: '#ffc78f' },
];

// Proje Listesi
const projectPerformance: ProjectPerformance[] = [
  { name: 'ZOKA Beach', sales: 32, revenue: 15600, staff: 4, efficiency: 96 },
  { name: 'Balık Hali', sales: 24, revenue: 11200, staff: 3, efficiency: 88 },
  { name: 'Hamdi Kahvesi', sales: 28, revenue: 13200, staff: 3, efficiency: 92 },
  { name: 'Tekne Turları', sales: 14, revenue: 5200, staff: 2, efficiency: 84 },
];

// Mekan Bazlı Kağıt Stokları
const projectPaperStock: Record<string, number> = {
  'ZOKA Beach': 287,
  'Balık Hali': 195,
  'Hamdi Kahvesi': 243,
  'Tekne Turları': 156,
  'Depo Stoğu': 420,
};

// Proje Bazlı Albüm Dağılımı
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
📈 3. BÖLÜM 1: GENEL ALBÜM DAĞILIMI
{/* Genel Albüm Dağılımı */}
<div className={embedded ? "mb-6" : "px-6 mb-6"}>
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
    <h3 className="font-semibold text-white mb-4">Genel Albüm Dağılımı</h3>
    
    {/* Compact Bar List */}
    <div className="space-y-2.5">
      {albumDistribution.map((item) => {
        const totalAlbums = albumDistribution.reduce((sum, i) => sum + i.value, 0);
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
                className="h-full rounded-md"
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
  </div>
</div>
Görsel:

Genel Albüm Dağılımı
┌────────────────────────────────────────────┐
│ 3 Kare   [████████████░░░░░░] 12    %11   │
│ 5 Kare   [█████████████████░] 18    %17   │
│ 7 Kare   [██████████████████] 24    %23   │
│ 9 Kare   [███████████████░░░] 20    %19   │
│ 11 Kare  [████████████░░░░░░] 14    %13   │
│ 13 Kare  [███████░░░░░░░░░░░]  8    %8    │
│ 15 Kare  [█████████░░░░░░░░░] 10    %9    │
└────────────────────────────────────────────┘
📄 4. BÖLÜM 2: MEKAN BAZLI KAĞIT STOKLARI
{/* Mekan Bazlı Albüm Kağıtı Stokları */}
<div className={embedded ? "mb-6" : "px-6 mb-6"}>
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
    <h3 className="font-semibold text-white mb-4">Mekan Bazlı Albüm Kağıtı Stokları</h3>
    
    <div className="space-y-2">
      {/* Lokasyonlar */}
      {projectPerformance.map((project) => {
        const paperStock = projectPaperStock[project.name] || 0;
        
        return (
          <div 
            key={project.name}
            className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center justify-between"
          >
            {/* Sol: Icon + Bilgi */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center">
                <span className="text-xs font-bold text-[#2d3748]">📄</span>
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
      <div className="bg-black/40 backdrop-blur-sm border-2 border-white/20 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/30 to-white/20 flex items-center justify-center">
            <span className="text-xs font-bold text-white">🏪</span>
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
Görsel:

Mekan Bazlı Albüm Kağıtı Stokları
┌────────────────────────────────────┐
│ [📄] ZOKA Beach           287 adet │
│      Albüm kağıdı stoğu            │
├────────────────────────────────────┤
│ [📄] Balık Hali           195 adet │
│      Albüm kağıdı stoğu            │
├────────────────────────────────────┤
│ [📄] Hamdi Kahvesi        243 adet │
│      Albüm kağıdı stoğu            │
├────────────────────────────────────┤
│ [📄] Tekne Turları        156 adet │
│      Albüm kağıdı stoğu            │
├════════════════════════════════════┤ (kalın border)
│ [🏪] Depo Stoğu           420 adet │
│      Merkez depo                   │
└────────────────────────────────────┘
📊 5. BÖLÜM 3: MEKAN BAZLI ALBÜM DAĞILIMI
{/* Mekan Bazlı Albüm Dağılımı */}
<div className={embedded ? "" : "px-6 mb-6"}>
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
                        className="h-full rounded"
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
                        className="h-full rounded"
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
Görsel:

Mekan Bazlı Albüm Dağılımı

┌─ ZOKA Beach ──────────────── 32 satış ─┐
│ 3 Kare   [███░░░░░░]  5    %15         │
│ 5 Kare   [█████░░░░]  8    %25         │
│ 7 Kare   [███████░░] 10    %31         │
│ 9 Kare   [████░░░░░]  6    %18         │
│ 11 Kare  [██░░░░░░░]  2    %6          │
│ 13 Kare  [█░░░░░░░░]  1    %3          │
│ 15 Kare  [░░░░░░░░░]  0    %0          │
└─────────────────────────────────────────┘

┌─ Balık Hali ──────────────── 24 satış ─┐
│ ...                                     │
└─────────────────────────────────────────┘

╔═ 🏪 Depo Stoğu ═══════════ 339 albüm ═╗ (kalın border)
║ 3 Kare   [████████░] 45    %13        ║
║ 5 Kare   [██████████] 62   %18        ║
║ ...                                    ║
╚════════════════════════════════════════╝
🎨 6. RENK PALETİ
const albumColors = {
  '3 Kare': '#9dd9ea',   // Mavi
  '5 Kare': '#a8e6cf',   // Yeşil
  '7 Kare': '#ffd4a3',   // Turuncu
  '9 Kare': '#ffb3ba',   // Pembe
  '11 Kare': '#d4a5ff',  // Mor
  '13 Kare': '#b8d4f1',  // Açık Mavi
  '15 Kare': '#ffc78f',  // Koyu Turuncu
};

const stockColors = {
  paperStock: '#a8e6cf',      // Yeşil (kağıt stok sayısı)
  depoBackground: 'from-white/30 to-white/20',
  locationBackground: 'from-[#ffd4a3] to-[#ffc78f]',
};
🧮 7. HESAPLAMALAR
// Toplam Hesaplama
const totalAlbums = albumDistribution.reduce((sum, item) => sum + item.value, 0);

// Yüzde Hesaplama
const percentage = ((item.value / totalAlbums) * 100).toFixed(0);

// Proje Toplam Hesaplama
const projectTotal = projectAlbums.reduce((sum, item) => sum + item.value, 0);

// Proje İçi Yüzde
const projectPercentage = projectTotal > 0 
  ? ((item.value / projectTotal) * 100).toFixed(0) 
  : '0';
📱 8. EMBEDDED MOD
// Koşullu Padding
<div className={embedded ? "mb-6" : "px-6 mb-6"}>
  {/* İçerik */}
</div>

// StaffTopBar/NewBottomNav Gizleme
{!embedded && (
  <StaffTopBar ... />
)}

{!embedded && (
  <NewBottomNav ... />
)}

// Geri Butonu (Sadece Embedded'de)
{embedded && (
  <button onClick={() => onNavigate('settings')}>
    <svg>...</svg>
    <span>Geri</span>
  </button>
)}
🎯 9. ÖZEL TASARIM: DEPO STOĞU
Kağıt Stokları Bölümünde:

border-2 (normal: border)
border-white/20 (normal: border-white/10)
🏪 emoji (diğerleri: 📄)
"Merkez depo" alt başlığı
Albüm Dağılımı Bölümünde:

border-2 border-white/20
🏪 emoji başlıkta
"X albüm" toplamı
{/* Depo - Özel Border */}
<div className="bg-black/40 backdrop-blur-sm border-2 border-white/20 rounded-xl p-4">
  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
    <div className="flex items-center gap-2">
      <span className="text-lg">🏪</span>
      <h4 className="font-bold text-white">Depo Stoğu</h4>
    </div>
    <span className="text-sm text-gray-400">{depoTotal} albüm</span>
  </div>
  {/* Bar'lar */}
</div>
📐 10. LAYOUT YAPISI
<div className={embedded ? "" : "pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen"}>
  {/* StaffTopBar (sadece standalone modda) */}
  {!embedded && <StaffTopBar ... />}

  {/* Header */}
  <div className="px-6 pt-6 pb-4">
    <div className="flex items-center gap-2 mb-2">
      <h1 className="text-3xl font-bold text-white">Stok Dağılımı</h1>
      <span className="text-3xl">📊</span>
    </div>
    <p className="text-sm text-gray-400">
      Genel albüm ve baskı kağıdı stok analizi • {new Date().toLocaleDateString('tr-TR')}
    </p>
  </div>

  {/* 1. Genel Albüm Dağılımı */}
  <div className={embedded ? "mb-6" : "px-6 mb-6"}>
    {/* Kart */}
  </div>

  {/* 2. Mekan Bazlı Kağıt Stokları */}
  <div className={embedded ? "mb-6" : "px-6 mb-6"}>
    {/* Kart */}
  </div>

  {/* 3. Mekan Bazlı Albüm Dağılımı */}
  <div className={embedded ? "" : "px-6 mb-6"}>
    {/* Kart */}
  </div>

  {/* NewBottomNav (sadece standalone modda) */}
  {!embedded && <NewBottomNav ... />}
</div>
🔗 11. KULLANIM (Location Management İçinde)
// Location Management içinde
<div className="mb-6 mt-12 pt-8 border-t-2 border-white/10">
  <div className="flex items-center gap-2 mb-2">
    <h2 className="text-2xl font-bold text-white">Stok Dağılımı</h2>
    <span className="text-2xl">📊</span>
  </div>
  <p className="text-sm text-gray-400">Albüm ve baskı kağıdı stok analizi</p>
</div>

<AlbumDistribution 
  embedded={true}
  userName={userName}
  userRole={userRole}
  onNavigate={onNavigate}
  onLogout={onLogout}
/>
✅ 12. ÖZET CHECKLIST
✅ 7 albüm tipi (3, 5, 7, 9, 11, 13, 15 Kare)
✅ Her albüm için hex renk kodu
✅ Genel dağılım: Kompakt horizontal bar liste
✅ Her satır: İsim (14px) + Progress + Miktar + Yüzde
✅ Kağıt stokları: Her lokasyon için kart
✅ 📄 icon + lokasyon + adet (yeşil)
✅ Depo: 🏪 icon + border-2
✅ Mekan bazlı dağılım: Her lokasyon için accordion
✅ Mini progress bar'lar (h-5)
✅ Satış sayısı başlıkta
✅ Depo: border-2, 🏪 emoji, toplam albüm
✅ Yüzde hesaplama: (value / total) * 100
✅ Embedded mod desteği
✅ Glassmorphism tasarım
✅ Koyu gradient arka plan
✅ Mobile responsive
✅ Türkçe etiketler
✅ Tarih gösterimi (header'da)