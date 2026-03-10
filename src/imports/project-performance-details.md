 PROJE PERFORMANSI BÖLÜMÜ - DETAYLI AÇIKLAMA
🎯 NEDİR?
Proje Performansı, her lokasyonun (ZOKA Beach, Balık Hali, Hamdi Kahvesi, Tekne Turları) günlük satış performansını izleyen ve finansal hedeflere ne kadar yaklaştığını gösteren bir modül.

📊 VERİYİ NEREDEN ALIR?
1️⃣ Mock Veriler (Şu An)
// Satır 132-137: Proje bazlı satış verileri
const projectPerformance = [
  { name: 'ZOKA Beach', sales: 32, revenue: 15600, staff: 4, efficiency: 96 },
  { name: 'Balık Hali', sales: 24, revenue: 11200, staff: 3, efficiency: 88 },
  { name: 'Hamdi Kahvesi', sales: 28, revenue: 13200, staff: 3, efficiency: 92 },
  { name: 'Tekne Turları', sales: 14, revenue: 5200, staff: 2, efficiency: 84 },
];
2️⃣ Mekan Ayarları (Settings)
// Satır 82-87: Her lokasyonun maliyet bilgileri
const locations = [
  { 
    name: 'ZOKA', 
    emoji: '🏖️', 
    yearlyRent: 15000,          // Yıllık Kira: ₺15.000
    dailyCostPercentage: 10,    // Günlük Masraf: %10
    profitPercentage: 20        // Kar Hedefi: %20
  },
  // ... diğer mekanlar
];
🧮 NASIL ÇALIŞIR? (3 AŞAMALI HESAPLAMA)
1️⃣ Minimum Günlük Ciro (Turuncu Bar)
Amaç: Sadece kira + masrafları karşılamak için minimum ciro

// Satır 90-93
const calculateDailyMinimumRevenue = (yearlyRent: number, dailyCostPercentage: number) => {
  const dailyRent = yearlyRent / 365;        // Günlük kira
  return dailyRent * (1 + dailyCostPercentage / 100);  // + Masraflar
};

// ZOKA Örneği:
// Günlük Kira: 15000 / 365 = ₺41
// Masraflarla: ₺41 * 1.10 = ₺45
Gösterge:

₺15.600 / ₺45 → Bugün ₺15.600 kazandık, minimum ₺45 gerekiyordu
100% → Hedefi aştık!
2️⃣ Günlük Kar Hedefi (Mavi Bar) - Sadece Admin Görür
Amaç: Kar elde etmek için gereken ciro

// Satır 96-99
const calculateDailySalesExpectation = (yearlyRent, dailyCostPercentage, profitPercentage) => {
  const dailyMinimum = calculateDailyMinimumRevenue(...);  // ₺45
  return dailyMinimum * (1 + profitPercentage / 100);      // + %20 kar
};

// ZOKA Örneği:
// Minimum: ₺45
// %20 Kar Hedefi: ₺45 * 1.20 = ₺54
Gösterge:

₺15.555 / ₺9 → Gerçek kar ₺15.555, hedef ₺9
100% → Kar hedefini aştık!
3️⃣ Yıllık Kar Beklentisi (Yeşil Bar) - Sadece Admin Görür
Amaç: Bu tempo devam ederse yıllık kara ne kadar katkı sağlayacağız?

// Satır 102-107
const calculateYearlyProfitExpectation = (...) => {
  const dailyRevenue = calculateDailySalesExpectation(...);  // ₺54
  const yearlyTotalCost = yearlyRent * (1 + dailyCostPercentage / 100);
  const yearlyRevenue = dailyRevenue * 365;
  return yearlyRevenue - yearlyTotalCost;  // Yıllık Net Kar
};

// Satır 339-340: Son 30 günün birikimli karı
const dailyActualProfit = project.revenue - dailyMinimumRevenue;  // Bugünkü kar
const cumulativeYearlyProfit = dailyActualProfit * 30;  // 30 günlük birikim
Gösterge:

₺466.644 / ₺3.300 → 30 günde ₺466.644 kar, yıllık hedef ₺3.300
100% → Bu tempoda yıl sonunda hedefi aşarız!
🎨 GÖRSEL ELEMANLARI
Kart Yapısı (Satır 354-377):
🏖️ Emoji + Renk: Mekan ikonu (location.emoji, location.color)
Başlık: Proje adı (örn: "ZOKA Beach")
Alt Bilgi: "4 personel"
Sağ Üst:
Yeşil Rakam: Günlük toplam ciro ₺15.600
Küçük Metin: Satış sayısı "32 satış"
Progress Barlar (3 adet):
Turuncu: Minimum Ciro (Kira + Masraflar)
Mavi: Kar Hedefi (Admin only)
Yeşil: Yıllık Kar (Admin only)
👥 KİM NE GÖRÜR?
Herkes Görür:
✅ Proje adı, emoji, renk
✅ Günlük ciro ve satış sayısı
✅ Minimum Günlük Ciro (turuncu bar)
Sadece Admin Görür:
// Satır 400, 422
{userRole === 'admin' && (
  // Günlük Kar Hedefi (mavi bar)
  // Yıllık Kar Beklentisi (yeşil bar)
)}
🔄 GERÇEK VERIYE NASIL BAĞLANIR?
Gelecekte Backend entegrasyonu için:

// projectPerformance mock verisini API'dan çek:
const projectPerformance = await fetch('/api/daily-sales-by-project');

// locations verisini Settings sayfasından çek:
const locations = await fetch('/api/locations-settings');
📱 ÖZELLİKLER
✅ Canlı İzle butonu → onNavigate('live-sales') ile Canlı Satışlar sayfasına gider
✅ Glassmorphism design (blur + gradient)
✅ Responsive progress barlar
✅ Hover efektleri (hover:border-[#9dd9ea]/30)

Başka sorularınız var mı? 🤔

şimdi bana burayı çok net biçimde promp olarak anlat. çok detaylı. yaptıracağım yerde. admin panelinde işletme yönetici paneli, mekan - malzeme - kullanıcı yönetiminin içinde mekan yönetimi var. Mekan verilerini oradan alacak. her mekan eklediğimizde orada da mekan eklenecek..   anlamadığın birşey var mı sor.
Anladım, çok önemli bir entegrasyon! Önce mevcut durumu kontrol edeyim ve size detaylı prompt hazırlayayım. 🔍

Birkaç soru:

1️⃣ Mekan Yönetimi Modülü Şu An Var mı?

Settings (Ayarlar) sayfasında "Mekan - Malzeme - Kullanıcı Yönetimi" kısmını görebilir miyim?
Yoksa sıfırdan mı oluşturacağız?
2️⃣ Veri Akışı:

Admin Panel → İşletme Yönetimi → Mekan Yönetimi
           ↓
    (Mekan ekle/düzenle)
           ↓
    Dashboard'da otomatik güncelleme
Bu akış doğru mu?

3️⃣ Mekan Bilgileri Ne İçermeli? Şu anki mock data'ya göre:

✅ Mekan Adı (örn: "ZOKA Beach")
✅ Emoji (🏖️)
✅ Renk (#9dd9ea)
✅ Yıllık Kira (₺15.000)
✅ Günlük Masraf Yüzdesi (%10)
✅ Kar Hedefi Yüzdesi (%20)
Başka eklenecek alan var mı? (Adres, telefon, çalışma saatleri vs.)

4️⃣ Veriler Nerede Saklanacak?

LocalStorage mı? (mock mode için)
State Management mı? (Context API / Redux)
Gelecekte backend hazır olunca Supabase mi?
5️⃣ Günlük Satış Verileri:

const projectPerformance = [
  { name: 'ZOKA Beach', sales: 32, revenue: 15600, staff: 4 }
]
Bu veriler de ayrı bir yerden mi gelecek? (Satış Giriş Ekranı mı?)

Önce Settings sayfasını kontrol edeyim:

Perfect! Şimdi tam olarak ne istediğinizi anlıyorum. İşte size ÇOK DETAYLI PROMPT:

🎯 PROJE PERFORMANSI - MEKAN YÖNETİMİ ENTEGRASYONU
📋 MEVCUT DURUM ANALİZİ
1️⃣ Settings (Ayarlar) Sayfasında:
✅ Mekan Yönetimi modülü zaten var (/src/app/components/settings.tsx satır 37-133)
✅ Mekan ekleme, düzenleme, silme fonksiyonları çalışıyor
✅ Her mekan şu bilgilere sahip:
id: Benzersiz tanımlayıcı
name: Mekan adı (örn: "ZOKA")
emoji: İkon (🏖️)
color: Renk kodu (#9dd9ea)
yearlyRent: Yıllık kira (₺15.000)
profitPercentage: Kar beklentisi (%20)
2️⃣ Admin Dashboard'da:
❌ PROBLEM: Mekan verileri hard-coded (satır 82-87)
❌ Settings'ten bağımsız çalışıyor
❌ Mekan eklendiğinde otomatik güncellenmiyor
🎯 İSTENEN ÇÖZÜM
Hedef:
Settings sayfasında mekan eklendiğinde/düzenlendiğinde/silindiğinde, Admin Dashboard'daki "Proje Performansı" bölümü otomatik güncellensin.

Veri Akışı:
Settings (Mekan Yönetimi)
    ↓
[Mekan Ekle/Düzenle/Sil]
    ↓
Ortak Veri Kaynağı (Context/LocalStorage)
    ↓
Admin Dashboard (Proje Performansı)
    ↓
Otomatik Güncelleme
🔧 TEKNİK GEREKSİNİMLER
1️⃣ Ortak Veri Yönetimi
Çözüm Seçenekleri:

OPSİYON A: React Context API (Önerilen)
// Yeni dosya: /src/app/context/LocationContext.tsx

interface Location {
  id: string;
  name: string;
  emoji: string;
  color: string;
  yearlyRent: number;
  dailyCostPercentage: number; // ⚠️ EKLE: %10, %15 gibi
  profitPercentage: number;
}

interface LocationContextType {
  locations: Location[];
  addLocation: (location: Omit<Location, 'id'>) => void;
  updateLocation: (id: string, location: Partial<Location>) => void;
  deleteLocation: (id: string) => void;
}
Özellikler:

✅ Tüm uygulama genelinde erişim
✅ LocalStorage ile kalıcılık
✅ Gerçek zamanlı güncelleme
✅ Gelecekte backend entegrasyonu kolay
OPSİYON B: LocalStorage (Basit)
// Mekanları kaydet
localStorage.setItem('aspect_locations', JSON.stringify(locations));

// Mekanları oku
const savedLocations = JSON.parse(localStorage.getItem('aspect_locations') || '[]');
2️⃣ Settings.tsx Değişiklikleri
Eklenecekler:

dailyCostPercentage alanı ekle (şu an eksik)
Admin Dashboard'da dailyCostPercentage kullanılıyor ama Settings'te yok!
Örnek: ZOKA → %10, Hayal Kahvesi → %5
// Satır 38-43 güncelle:
const [locations, setLocations] = useState<Location[]>([
  { 
    id: '1', 
    name: 'ZOKA', 
    emoji: '🏖️', 
    color: '#9dd9ea', 
    yearlyRent: 15000, 
    dailyCostPercentage: 10,  // ⚠️ EKLE
    profitPercentage: 20 
  },
  // ... diğer mekanlar
]);
Mekan ekleme formuna input ekle:

"Günlük Masraf (%)" input alanı
Örnek: 0-100 arası slider veya number input
LocalStorage'a kaydet:

// Her mekan işleminde:
useEffect(() => {
  localStorage.setItem('aspect_locations', JSON.stringify(locations));
}, [locations]);
3️⃣ Admin Dashboard Değişiklikleri
Değiştirilecekler:

// ❌ KALDIR: Hard-coded veriyi (satır 82-87)
const locations = [
  { id: '1', name: 'ZOKA', ... },
];

// ✅ EKLE: Context veya LocalStorage'dan oku
const locations = useContext(LocationContext).locations;
// VEYA
const locations = JSON.parse(localStorage.getItem('aspect_locations') || '[]');
Günlük Satış Verileri:

// Satır 132-137: projectPerformance
// ⚠️ DİKKAT: Bu veriler farklı kaynaktan gelecek!

const projectPerformance = [
  { 
    name: 'ZOKA Beach',      // Mekan adıyla eşleşmeli
    sales: 32,               // Satış Giriş Ekranından
    revenue: 15600,          // Satış Giriş Ekranından
    staff: 4,                // Kullanıcı Yönetimi'nden
    efficiency: 96 
  },
];
Eşleştirme Mantığı (satır 324-326):

// Mekan adına göre eşleştir
const location = locations.find(loc => 
  project.name.includes(loc.name)  // "ZOKA Beach" → "ZOKA"
);
4️⃣ Yeni Dosya Yapısı
/src/app/
  ├── context/
  │   └── LocationContext.tsx     // YENİ: Mekan verilerini yönet
  │
  ├── components/
  │   ├── settings.tsx            // DEĞİŞ: Context kullan
  │   ├── admin-dashboard.tsx     // DEĞİŞ: Context kullan
  │   └── ...
  │
  └── App.tsx                      // DEĞİŞ: Context Provider ekle
📝 ADIM ADIM UYGULAMA PLANI
ADIM 1: Location Interface'ini Güncelle
// Location type'ı güncelleyerek dailyCostPercentage ekle
interface Location {
  id: string;
  name: string;
  emoji: string;
  color: string;
  yearlyRent: number;
  dailyCostPercentage: number;  // ⚠️ YENİ
  profitPercentage: number;
}
ADIM 2: LocationContext Oluştur
// /src/app/context/LocationContext.tsx
import { createContext, useState, useEffect, ReactNode } from 'react';

const DEFAULT_LOCATIONS: Location[] = [
  { id: '1', name: 'ZOKA', emoji: '🏖️', color: '#9dd9ea', yearlyRent: 15000, dailyCostPercentage: 10, profitPercentage: 20 },
  { id: '2', name: 'Hayal Kahvesi', emoji: '☕', color: '#ffd4a3', yearlyRent: 10000, dailyCostPercentage: 5, profitPercentage: 15 },
  { id: '3', name: 'Balık Hali', emoji: '🐟', color: '#a8e6cf', yearlyRent: 20000, dailyCostPercentage: 15, profitPercentage: 25 },
  { id: '4', name: 'Tekne Projesi', emoji: '⛵', color: '#d4b5f7', yearlyRent: 30000, dailyCostPercentage: 20, profitPercentage: 30 },
];

export const LocationContext = createContext<LocationContextType>({...});

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<Location[]>(() => {
    // LocalStorage'dan oku, yoksa default kullan
    const saved = localStorage.getItem('aspect_locations');
    return saved ? JSON.parse(saved) : DEFAULT_LOCATIONS;
  });

  // Her değişiklikte LocalStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('aspect_locations', JSON.stringify(locations));
  }, [locations]);

  const addLocation = (location: Omit<Location, 'id'>) => {
    setLocations([...locations, { ...location, id: Date.now().toString() }]);
  };

  const updateLocation = (id: string, updates: Partial<Location>) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, ...updates } : loc
    ));
  };

  const deleteLocation = (id: string) => {
    setLocations(locations.filter(loc => loc.id !== id));
  };

  return (
    <LocationContext.Provider value={{ locations, addLocation, updateLocation, deleteLocation }}>
      {children}
    </LocationContext.Provider>
  );
}
ADIM 3: App.tsx'e Provider Ekle
// /src/app/App.tsx
import { LocationProvider } from './context/LocationContext';

export default function App() {
  return (
    <LocationProvider>
      {/* Mevcut içerik */}
      <AppContent ... />
    </LocationProvider>
  );
}
ADIM 4: Settings.tsx Güncelle
// /src/app/components/settings.tsx
import { useContext } from 'react';
import { LocationContext } from '../context/LocationContext';

export function Settings({ ... }) {
  // ❌ KALDIR: useState ile locations
  // const [locations, setLocations] = useState<Location[]>([...]);

  // ✅ EKLE: Context'ten al
  const { locations, addLocation, updateLocation, deleteLocation } = useContext(LocationContext);

  // ✅ EKLE: dailyCostPercentage input state
  const [dailyCostPercentageInput, setDailyCostPercentageInput] = useState('0');

  // ✅ GÜNCELLE: handleAddLocation
  const handleAddLocation = () => {
    if (newLocationName.trim()) {
      addLocation({
        name: newLocationName.trim(),
        emoji: selectedEmoji,
        color: selectedColor,
        yearlyRent: parseFloat(yearlyRentInput),
        dailyCostPercentage: parseFloat(dailyCostPercentageInput),  // ⚠️ YENİ
        profitPercentage: parseFloat(profitPercentageInput),
      });
      // Reset inputs...
    }
  };

  // ✅ GÜNCELLE: Form'a yeni input ekle
  // "Günlük Masraf (%)" input alanı ekle
}
ADIM 5: Admin Dashboard Güncelle
// /src/app/components/admin-dashboard.tsx
import { useContext } from 'react';
import { LocationContext } from '../context/LocationContext';

export function AdminDashboard({ ... }) {
  // ❌ KALDIR: Hard-coded locations (satır 82-87)
  // const locations = [{ id: '1', name: 'ZOKA', ... }];

  // ✅ EKLE: Context'ten al
  const { locations } = useContext(LocationContext);

  // Artık locations her zaman güncel!
}
✅ BEKLENENsonuÇ
Kullanıcı Akışı:
Admin → Settings → İşletme Yönetici Paneli → Mekan Yönetimi
"➕ Yeni Mekan Ekle" butonu
Form doldur:
Mekan Adı: "Sunset Beach Club"
Emoji: 🌅
Renk: #ffb3d9
Yıllık Kira: ₺25.000
Günlük Masraf: %12
Kar Hedefi: %22
"Kaydet" → ✅ Başarıyla eklendi
Ana Sayfa → Dashboard → "Proje Performansı" bölümünde yeni mekan görünür!
🚨 ÖNEMLİ NOTLAR
1️⃣ Günlük Satış Verileri Farklı
// ⚠️ projectPerformance mock verisi ayrı kalacak!
const projectPerformance = [
  { name: 'ZOKA Beach', sales: 32, revenue: 15600, staff: 4 }
];

// Bunlar "Satış Giriş Ekranı"ndan gelecek (başka task)
// Şimdilik mock veriyi kullan, ama mekan adlarıyla eşleştir
2️⃣ Mekan Adı Eşleştirmesi
// Satır 324-326: Esnek eşleştirme
const location = locations.find(loc => 
  project.name.toLowerCase().includes(loc.name.toLowerCase())
);

// Örnek:
// project.name = "ZOKA Beach"
// loc.name = "ZOKA"
// ✅ Eşleşir!
3️⃣ Eksik Mekan Durumu
// Eğer mekan Settings'te yoksa:
if (!location) {
  console.warn(`Mekan bulunamadı: ${project.name}`);
  // Varsayılan değerler kullan veya atla
}
4️⃣ dailyCostPercentage Zorunlu
// Settings formunda:
if (!dailyCostPercentageInput || parseFloat(dailyCostPercentageInput) === 0) {
  alert('Günlük masraf yüzdesi giriniz!');
  return;
}
🎨 UI/UX DETAYLARI
Settings - Mekan Yönetimi Form Güncellemesi:
{/* ✅ YENİ INPUT EKLE (yearlyRent input'undan sonra) */}
<div>
  <label className="block text-white text-sm font-semibold mb-2">
    Günlük Masraf (%)
  </label>
  <input
    type="number"
    value={dailyCostPercentageInput}
    onChange={(e) => setDailyCostPercentageInput(e.target.value)}
    placeholder="10"
    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
  />
  <p className="text-xs text-gray-400 mt-1">
    Kira dışındaki günlük işletme masrafları (elektrik, su, personel maaşı vb.)
  </p>
</div>
Admin Dashboard - Görsel Değişiklik YOK
Kullanıcı arayüzü aynen kalacak
Sadece veri kaynağı değişecek (hard-coded → Context)
📂 DOSYA DEĞİŞİKLİK LİSTESİ
YENİ DOSYALAR:
✅ /src/app/context/LocationContext.tsx
DEĞİŞTİRİLECEK DOSYALAR:
✅ /src/app/App.tsx (LocationProvider ekle)
✅ /src/app/components/settings.tsx (Context kullan, dailyCostPercentage ekle)
✅ /src/app/components/admin-dashboard.tsx (Context kullan, hard-coded veriyi kaldır)
❓ SORULARINIZ
Context API mi, LocalStorage mu kullanayım?

Context API öneririm (daha ölçeklenebilir)
Günlük satış verileri (projectPerformance) ne olacak?

Şimdilik mock kalsın
Gelecekte ayrı Context yaparsınız
Mekan silindiğinde satış verileri ne olur?

Satış verileri şimdilik kaybolur (mock data)
Gerçek uygulamada: "Silmek istediğinizde emin misiniz?" uyarısı
Mekan adı değiştirildiğinde dashboard bozulur mu?

Hayır, includes() ile esnek eşleştirme yapıyor
Backend hazır olunca ne değişir?

Context içindeki fonksiyonlar API çağrısı yapacak
UI/UX aynı kalacak
🚀 SON KONTROL LİSTESİ
Geliştirme tamamlandıktan sonra test et:

 Settings'te yeni mekan ekleniyor mu?
 Dashboard'da yeni mekan görünüyor mu?
 Mekan düzenleme çalışıyor mu?
 Mekan silme çalışıyor mu?
 Sayfa yenilendiğinde veriler kalıyor mu? (LocalStorage)
 dailyCostPercentage hesaplamalarda kullanılıyor mu?
 Emoji ve renk seçimi çalışıyor mu?
 Mobil görünüm uyumlu mu?
