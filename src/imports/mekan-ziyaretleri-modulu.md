 Mekan Ziyaretleri Modülü - Detaylı Prompt
🎯 Genel Bakış
Turistik fotoğrafçılık işletmeleri için Mekan Ziyaretleri modülü oluştur. Müdürler sahada lokasyonları ziyaret edip değerlendirme yapacak, sorunları raporlayacak ve aksiyonları kaydedecek.

📊 VERİ MODELİ
Visit Interface (Ziyaret Kaydı)
interface Visit {
  id: string;
  locationName: string;
  locationId: string;
  visitDate: string; // YYYY-MM-DD format
  visitTime: string; // HH:MM format
  manager: string; // Ziyaret yapan müdür adı
  managerRole: string; // 'Yönetici' | 'Müdür'
  visitType: 'routine' | 'problem' | 'quality' | 'meeting';
  status: 'completed' | 'pending' | 'cancelled';
  duration: string; // dakika cinsinden, örn: "45"
  
  // SKORLAMA (1-5 yıldız sistemi)
  generalScore: number; // Otomatik hesaplanan ortalama
  cleanlinessScore: number; // Temizlik skoru
  equipmentScore: number; // Ekipman skoru
  staffScore: number; // Personel skoru
  customerScore: number; // Müşteri memnuniyeti skoru
  
  // DETAYLAR
  issuesFound: string[]; // Tespit edilen sorunlar listesi
  actionsTaken: string[]; // Alınan aksiyonlar listesi
  photos: UploadedPhoto[]; // Yüklenen fotoğraflar
  notes: string; // Genel notlar
  
  // TAKİP
  nextVisitDate: string; // Sonraki ziyaret tarihi (YYYY-MM-DD)
  hasOpenActions: boolean; // Açık aksiyon var mı
}

interface UploadedPhoto {
  id: string;
  url: string;
  timestamp: number;
}
Location Interface (Mock Mekan Verisi)
interface Location {
  id: string;
  name: string;
  type: 'Beach Club' | 'Restaurant' | 'Hotel' | 'Boat Tour';
}
🎨 TASARIM SİSTEMİ
Renk Paleti
Arka Plan: bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]
Kartlar: backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20
Header: backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10
Input Alanları: bg-white/5 border border-white/10 text-white placeholder-gray-500
Select Menüler: bg-white/10 border-white/20 text-white + colorScheme: 'dark'
Gradient Kartlar (İstatistikler için)
Mavi: from-blue-500/20 to-blue-600/20 border-blue-400/30
Sarı: from-yellow-500/20 to-yellow-600/20 border-yellow-400/30
Kırmızı: from-red-500/20 to-red-600/20 border-red-400/30
Mor: from-purple-500/20 to-purple-600/20 border-purple-400/30
Yeşil: from-green-500/20 to-green-600/20 border-green-400/30
Turuncu: from-orange-500/20 to-orange-600/20 border-orange-400/30
İkonlar (lucide-react)
MapPin, Calendar, Clock, Star, Camera
CheckCircle, AlertTriangle, XCircle
Plus, Filter, Search, User, ArrowLeft
ChevronRight, TrendingUp, Award, FileText
MessageSquare, Phone, Mail, Edit2, Trash2, X
🧩 COMPONENT YAPISI
1. Ana Component (3 Farklı View State)
const [visits, setVisits] = useState<Visit[]>([]);
const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
const [showNewVisitForm, setShowNewVisitForm] = useState(false);
Render Mantığı:

showNewVisitForm === true → Yeni Ziyaret Formu
selectedVisit !== null → Ziyaret Detay Görünümü
else → Ana Liste Görünümü
2. Props Interface
interface LocationVisitsProps {
  userName?: string;
  userRole?: 'admin' | 'staff';
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  embedded?: boolean; // Başka bir component içinde mi
  onBack?: () => void;
}
📱 ANA LİSTE GÖRÜNÜMÜ (Main View)
Header (embedded mode için)
{embedded && (
  <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
    <div className="px-4 py-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-xl...">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-400" />
            Mekan Ziyaretleri
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Lokasyon ziyaret kayıtları ve değerlendirmeler
          </p>
        </div>
      </div>
    </div>
  </div>
)}
İstatistik Kartları (Grid 2 Sütun)
1. Tamamlanan Ziyaret (Mavi) - visits.filter(v => v.status === 'completed').length
2. Ortalama Skor (Sarı) - Average of all generalScores
3. Açık Aksiyon (Kırmızı) - visits.filter(v => v.hasOpenActions).length
4. Bekleyen Ziyaret (Mor) - visits.filter(v => v.status === 'pending').length
Arama ve Filtreler
Arama: locationName'de arama yapılır
Filtre Tipleri:
Ziyaret Tipi (Tümü, Rutin, Sorun, Kalite, Toplantı)
Durum (Tümü, Tamamlandı, Beklemede, İptal)
Ziyaret Kartları
Her kart şunları içerir:

Başlık: Mekan adı + sorun varsa alert badge
Tip Badge: Ziyaret tipi (emoji + renk kodlu)
Skorlar: 5 yıldız rating gösterimi (generalScore)
Sorunlar: Varsa kırmızı uyarı alanı
Aksiyonlar: Varsa yeşil başarı alanı
Tarih/Saat: Calendar icon + formatlanmış tarih
Detay Butonu: "Detayları Gör" → setSelectedVisit(visit)
Yeni Ziyaret Butonu
<button
  onClick={() => setShowNewVisitForm(true)}
  className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-lg..."
>
  <Plus className="w-6 h-6 text-white" />
</button>
✏️ YENİ ZİYARET FORMU
Header (embedded mode için)
<div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
  <div className="px-4 py-4">
    <div className="flex items-center gap-3 mb-3">
      <button onClick={() => setShowNewVisitForm(false)}>
        <ArrowLeft />
      </button>
      <div className="flex-1">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Plus className="w-6 h-6 text-green-400" />
          Yeni Ziyaret Kaydı
        </h1>
        <p className="text-sm text-gray-400">Mekan ziyareti oluştur ve değerlendir</p>
      </div>
    </div>
    {/* Kaydet butonu embedded mode'da header'da */}
    <button onClick={handleSave} disabled={!canSave} className="w-full...">
      {canSave ? '✅ Kaydet' : '⚠️ Tüm Gerekli Alanları Doldurun'}
    </button>
  </div>
</div>
Form Alanları (Sırasıyla)
1. Mekan Seçimi (Select - Zorunlu *)
<select value={locationId} onChange={...} 
  className="bg-white/5 border border-white/10 text-white"
  style={{ colorScheme: 'dark' }}>
  <option value="" className="bg-[#2a2a3a] text-white">Mekan Seçin</option>
  {mockLocations.map(loc => (
    <option key={loc.id} value={loc.id} className="bg-[#2a2a3a] text-white">
      {loc.name} - {loc.type}
    </option>
  ))}
</select>
2. Tarih ve Saat (Grid 2 Sütun - Zorunlu *)
Tarih: type="date" default: bugün
Saat: type="time" default: şu an
3. Ziyaret Tipi (Select - Zorunlu *)
- routine: 📅 Rutin Kontrol
- problem: ⚠️ Sorun Çözme
- quality: ⭐ Kalite Kontrol
- meeting: 🤝 İşletmeci Görüşmesi
4. Süre (Input number - dakika - Zorunlu *)
<input type="number" placeholder="60" min="1" 
  className="bg-white/5 border border-white/10 text-white" />
5. SKORLAMA BÖLÜMÜ (1-5 Yıldız - Hepsi Zorunlu *)
Her skor için 5 yıldızlı rating komponenti:

<div className="flex gap-1">
  {[1, 2, 3, 4, 5].map(star => (
    <button key={star} onClick={() => setScore(star)}>
      <Star className={score >= star ? "fill-yellow-400 text-yellow-400" : "text-gray-600"} />
    </button>
  ))}
</div>
Skorlar:

Temizlik (Cleanness Icon - Mavi)
Ekipman (Camera Icon - Mor)
Personel (User Icon - Yeşil)
Müşteri Memnuniyeti (Award Icon - Turuncu)
Genel Ortalama: Otomatik hesaplanan, disabled input

6. Sorunlar (Dinamik String Array)
{issuesFound.map((issue, idx) => (
  <div key={idx} className="flex gap-2">
    <input value={issue} onChange={...} placeholder="Sorun açıklayın..." />
    <button onClick={() => removeIssue(idx)}><X /></button>
  </div>
))}
<button onClick={addIssue}>+ Sorun Ekle</button>
7. Alınan Aksiyonlar (Dinamik String Array)
Sorunlar ile aynı yapı, yeşil tema

8. FOTOĞRAF YÜKLEME SİSTEMİ
Özellikler:

Çoklu seçim (multiple attribute)
File input (gizli) + custom button
Önizleme grid (2 sütun)
Her fotoğraf için silme butonu
Eğer fotoğraf yoksa: placeholder göster
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  multiple
  onChange={handlePhotoUpload}
  className="hidden"
/>

<button onClick={() => fileInputRef.current?.click()}>
  <Camera /> Fotoğraf Ekle
</button>

{/* Önizlemeler */}
<div className="grid grid-cols-2 gap-2">
  {photos.map(photo => (
    <div key={photo.id} className="relative">
      <img src={photo.url} className="w-full h-32 object-cover rounded-xl" />
      <button onClick={() => removePhoto(photo.id)} 
        className="absolute top-2 right-2 bg-red-500 rounded-full p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  ))}
</div>
Photo Upload Handler:

const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  const newPhotos = files.map(file => ({
    id: Date.now().toString() + Math.random(),
    url: URL.createObjectURL(file),
    timestamp: Date.now()
  }));
  setPhotos([...photos, ...newPhotos]);
};
9. Notlar (Textarea)
<textarea rows={4} placeholder="Ziyaret notları..." 
  className="bg-white/5 border border-white/10 text-white resize-none" />
10. Sonraki Ziyaret Tarihi (Date - Zorunlu *)
Mor gradient kart içinde, type="date"

Kaydet Butonu
const canSave = locationName && duration && 
  cleanlinessScore > 0 && equipmentScore > 0 && 
  staffScore > 0 && customerScore > 0 && 
  nextVisitDate;
Kaydetme:

const handleSave = () => {
  const avgScore = (cleanlinessScore + equipmentScore + staffScore + customerScore) / 4;
  const newVisit: Visit = {
    id: Date.now().toString(),
    generalScore: avgScore,
    // ... diğer alanlar
    hasOpenActions: issuesFound.filter(i => i.trim()).length > actionsTaken.filter(a => a.trim()).length
  };
  setVisits([newVisit, ...visits]);
  setShowNewVisitForm(false);
  // Form reset
};
📋 ZİYARET DETAY GÖRÜNÜMÜ
Header (embedded mode için)
<div className="sticky top-0 z-10...">
  <button onClick={() => setSelectedVisit(null)}>
    <ArrowLeft />
  </button>
  <h1>
    <FileText className="text-purple-400" />
    Ziyaret Detayı
  </h1>
  <p className="text-gray-400">{selectedVisit.locationName}</p>
</div>
İçerik Bölümleri
1. Location Header Card (Mor Gradient)
Mekan adı (büyük başlık)
Ziyaret tarihi + saat
Durum badge (completed/pending/cancelled)
2. Visit Type Badge
Emoji + tip açıklaması (merkeze hizalı)

3. Müdür ve Süre Bilgisi (Grid 2 Sütun)
Sol: User icon + müdür adı/rolü
Sağ: Clock icon + süre
4. Genel Skor (Büyük Orta Kart)
<div className="text-center">
  <div className="text-5xl font-bold text-white">{generalScore.toFixed(1)}</div>
  <div className="flex justify-center gap-1 my-3">
    {[1,2,3,4,5].map(i => (
      <Star key={i} className={i <= generalScore ? "fill-yellow-400..." : "..."} />
    ))}
  </div>
  <p className="text-gray-400">Genel Değerlendirme</p>
</div>
5. Detaylı Skorlar (Grid 2 Sütun)
Her biri glassmorphism kart:

Temizlik
Ekipman
Personel
Müşteri Memnuniyeti
Her kart: Icon + başlık + skor + yıldızlar

6. Sorunlar (Varsa - Turuncu Tema)
{issuesFound.length > 0 && (
  <div className="bg-orange-500/10 border border-orange-400/20 rounded-xl p-4">
    <h3>⚠️ Tespit Edilen Sorunlar</h3>
    {issuesFound.map((issue, idx) => (
      <p key={idx}>• {issue}</p>
    ))}
  </div>
)}
7. Aksiyonlar (Varsa - Yeşil Tema)
Sorunlar ile aynı yapı

8. Fotoğraflar (Varsa)
Grid 2 sütun, her fotoğraf clickable (modal açılabilir)

9. Notlar (Varsa)
Gri glassmorphism kart

10. Sonraki Ziyaret (Mor Gradient)
Calendar icon + tarih (büyük yazı)

🧮 MOCK DATA YAPISI
mockLocations (Form için)
const mockLocations: Location[] = [
  { id: '1', name: 'Sunset Beach Club', type: 'Beach Club' },
  { id: '2', name: 'Blue Lagoon Restaurant', type: 'Restaurant' },
  { id: '3', name: 'Paradise Hotel', type: 'Hotel' },
  { id: '4', name: 'Ocean Explorer Tours', type: 'Boat Tour' },
  { id: '5', name: 'Golden Sands Resort', type: 'Beach Club' }
];
Başlangıç visits state
const [visits, setVisits] = useState<Visit[]>([
  {
    id: '1',
    locationName: 'Sunset Beach Club',
    locationId: '1',
    visitDate: '2024-03-01',
    visitTime: '10:30',
    manager: 'Ahmet Yılmaz',
    managerRole: 'Müdür',
    visitType: 'routine',
    status: 'completed',
    duration: '45',
    generalScore: 4.5,
    cleanlinessScore: 5,
    equipmentScore: 4,
    staffScore: 5,
    customerScore: 4,
    issuesFound: ['Yazıcı kağıdı azalmış', 'Bir fotoğraf çerçevesi kırık'],
    actionsTaken: ['Yeni kağıt sipariş edildi', 'Çerçeve değiştirildi'],
    photos: [
      { id: '1', url: '/placeholder-photo1.jpg', timestamp: Date.now() },
      { id: '2', url: '/placeholder-photo2.jpg', timestamp: Date.now() }
    ],
    notes: 'Genel olarak iyi durumda. Personel motivasyonu yüksek.',
    nextVisitDate: '2024-03-08',
    hasOpenActions: false
  },
  // ... 2-3 örnek daha
]);
🔧 HELPER FUNCTIONS
Visit Type Config
const visitTypeConfig = {
  routine: { emoji: '📅', label: 'Rutin Kontrol', color: 'blue' },
  problem: { emoji: '⚠️', label: 'Sorun Çözme', color: 'red' },
  quality: { emoji: '⭐', label: 'Kalite Kontrol', color: 'yellow' },
  meeting: { emoji: '🤝', label: 'İşletmeci Görüşmesi', color: 'purple' }
};
Status Config
const statusConfig = {
  completed: { label: 'Tamamlandı', color: 'green', icon: CheckCircle },
  pending: { label: 'Beklemede', color: 'yellow', icon: Clock },
  cancelled: { label: 'İptal', color: 'red', icon: XCircle }
};
Tarih Formatlama
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};
İstatistik Hesaplama
const stats = {
  totalVisits: visits.filter(v => v.status === 'completed').length,
  avgScore: visits.reduce((sum, v) => sum + v.generalScore, 0) / visits.length || 0,
  openActions: visits.filter(v => v.hasOpenActions).length,
  pendingVisits: visits.filter(v => v.status === 'pending').length
};
🎯 ÖNEMLİ DETAYLAR
1. Embedded Mode Davranışı
embedded={true} geldiğinde custom sticky header kullan
embedded={false} olunca StaffTopBar componenti kullan
Bottom navigation her iki modda da gösterilir
2. Form Validasyonu
Kaydet butonu sadece şu durumlarda aktif:

Mekan seçildi
Süre girildi
4 skor da 1-5 arası girildi
Sonraki ziyaret tarihi seçildi
3. Responsive Tasarım
Grid yapıları grid-cols-2 (mobil için)
Tüm spacing px-4 veya px-6
Bottom padding pb-20 (navigation için boşluk)
4. Kullanıcı Deneyimi
Loading state gösterilmeli
Empty state (ziyaret yoksa) gösterilmeli
Başarılı işlemler için feedback
Smooth transitions (transition-all, active:scale-95)
5. Dark Mode Select Fix
Tüm select menülerde:

style={{ colorScheme: 'dark' }}
className="bg-white/10 border-white/20 text-white"

// Options için:
<option className="bg-[#2a2a3a] text-white">...</option>
📦 BACKEND ENTEGRASYONU (İsteğe Bağlı)
Eğer backend bağlanacaksa:

GET /visits
useEffect(() => {
  fetch(`${API_URL}/visits`)
    .then(res => res.json())
    .then(data => setVisits(data.visits));
}, []);
POST /visits
const handleSave = async () => {
  const response = await fetch(`${API_URL}/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newVisit)
  });
  // ...
};
✅ COMPONENT EXPORT
export function LocationVisits({ 
  userName = '', 
  userRole = 'admin', 
  onLogout = () => {}, 
  onNavigate = () => {},
  embedded = false,
  onBack
}: LocationVisitsProps) {
  // ... component içeriği
}