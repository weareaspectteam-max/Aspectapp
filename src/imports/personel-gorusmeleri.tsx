"Aspect Operations" adında turistik fotoğrafçılık işletmeleri için iOS mobil uygulaması geliştiriyorum. Uygulama koyu gradient arka plan (from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]) ve glassmorphism efektli kartlarla modern bir tasarıma sahip.

Rol tabanlı erişim var (Yönetici, Müdür, Operasyon Sorumlusu, Personel, İdari, Kullanıcı). Hamburger menüde "Müdür Raporları" ana kategorisi var ve altında 3 modül: Mekan Ziyaretleri, Müdür Raporları Detay ve Personel Görüşmeleri.

İSTEK
Personel Görüşmeleri sayfasını oluştur. Bu sayfada müdürler personelle yaptıkları birebir görüşmeleri kaydeder, performans değerlendirmeleri yapar ve görüşme geçmişini takip eder.

TASARIM GEREKSİNİMLERİ
1. Sayfa Başlığı ve Header
Sol üst: Geri buton (ArrowLeft ikonu, glassmorphism buton, w-10 h-10)
Başlık: "Personel Görüşmeleri" + 💬 emojisi (büyük, beyaz)
Alt başlık: "Müdür-personel birebir görüşme kayıtları" (küçük gri yazı, text-sm text-gray-400)
Sağ üst (alt başlık hizasında): "Yeni Ekle" butonu
Tasarım: Küçük, kompakt buton (px-3 py-1.5)
Yeşil tonlarda gradient arka plan (from-green-500/20 to-green-600/20)
Border (border-green-500/30)
Plus ikonu (küçük, w-4 h-4) + "Yeni Ekle" yazısı (text-xs)
Hover ve active animasyonları (hover:scale-105 active:scale-95)
2. Filtre Sistemi (Görüşme Tiplerine Göre)
Modern Grid Tasarım - Sağa-sola kayan tab YOK, grid yapısı kullan:

Container: Glassmorphism kart (backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-2xl p-4)

Grid Layout: 3 sütun (grid grid-cols-3 gap-3)

Filtre Butonları:

🔍 Tümü (tüm görüşmeleri göster)
📊 Performans (performance tipi)
💬 Geri Bildirim (feedback tipi)
🚀 Gelişim (development tipi)
⚠️ Sorun Çözme (problem-solving tipi, 2 sütun genişliğinde col-span-2)
Aktif Filtre: Parlak renkli arka plan + beyaz yazı + shadow

Tümü: bg-blue-500 shadow-lg shadow-blue-500/50
Performans: bg-purple-500 shadow-lg shadow-purple-500/50
Geri Bildirim: bg-blue-500 shadow-lg shadow-blue-500/50
Gelişim: bg-green-500 shadow-lg shadow-green-500/50
Sorun Çözme: bg-orange-500 shadow-lg shadow-orange-500/50
Pasif Filtre: Şeffaf arka plan + border + gri yazı (bg-white/5 border border-white/10 text-gray-400)

3. Görüşme Kartları (Liste)
Her görüşme kartı için:

Kart Container
Glassmorphism mavi gradient (from-blue-500/10 to-blue-600/10)
Border (border-2 border-blue-500/20)
Rounded (rounded-2xl)
Padding (p-5)
Üst Bölüm (Header)
Sol:
User ikonu + Personel adı (büyük, beyaz, bold)
Pozisyon badge (küçük pill, mavi tonlarda, örn: "Fotoğrafçı")
Alt:
MessageSquare ikonu + Müdür adı (küçük, gri)
Dikey ayırıcı çizgi
Calendar ikonu + Görüşme tarihi (örn: "05.03.2026")
Sağ üst: Ruh hali göstergesi
Pozitif: TrendingUp ikonu + "Pozitif" (yeşil)
Nötr: Minus ikonu + "Nötr" (sarı)
Negatif: TrendingDown ikonu + "Negatif" (kırmızı)
Bilgi Badge'leri
Horizontal sırada pill-shaped badge'ler:

📍 Lokasyon (örn: "Beach Club Antalya")
Görüşme tipi badge (emoji + label, renkli):
📊 Performans (mor)
💬 Geri Bildirim (mavi)
🚀 Gelişim (yeşil)
⚠️ Sorun Çözme (turuncu)
⏱️ Süre (örn: "30 dk")
Performans Değerlendirmesi Bölümü
Başlık: "⭐ Performans Değerlendirmesi"
Grid: 2x2 düzen
Her skor kartı:
Üstte kategori adı (küçük, gri, örn: "Satış")
Altta skor (büyük, bold, renkli, örn: "85/100")
Renk sistemi:
85-100: Yeşil (text-green-400)
70-84: Sarı (text-yellow-400)
0-69: Kırmızı (text-red-400)
Kategoriler:
Satış
Müşteri Hizmetleri
Ekip Çalışması
Devamsızlık
Görüşülen Konular
Başlık: "💭 Görüşülen Konular" (mavi)
Madde işaretli liste (mavi nokta işareti)
Her madde yeni satırda, açık gri yazı
Alınan Kararlar
Başlık: "✅ Alınan Kararlar" (yeşil)
Madde işaretli liste (yeşil nokta işareti)
Her madde yeni satırda, açık gri yazı
Alt Bilgi (Footer)
Sol: "Sonraki Görüşme: [tarih]" (küçük, gri)
Sağ: Görüşme konuları/başlıkları (küçük pill badge'ler, örn: "Satış Performansı", "Müşteri Geri Bildirimleri")
4. Yeni Görüşme Formu (Fullscreen)
"Yeni Ekle" butonuna tıklandığında açılan form:

Form Header
Sticky header (sticky top-0 z-10)
Geri butonu (ArrowLeft)
Plus ikonu (yeşil) + "Yeni Görüşme Kaydı" başlığı
"Personel görüşmesi detayları" alt başlık
Kaydet butonu (yeşil gradient, geniş, validasyon ile enable/disable)
Aktif: "✅ Görüşmeyi Kaydet"
Pasif: "⚠️ Gerekli Alanları Doldurun" (gri, disabled)
Form Alanları (Sırayla)
Müdür Adı (zorunlu *)

Text input
Glassmorphism kart içinde
👤 emoji başlık
Personel Bilgileri (zorunlu *, mavi renkli kart)

User ikonu başlık
2 input:
Personel adı
Pozisyon (placeholder: "Fotoğrafçı, Satış Danışmanı, vb.")
Lokasyon (zorunlu *)

MapPin ikonu (mor) + başlık
Text input
Tarih ve Süre (zorunlu *)

Grid 2 sütun:
Calendar ikonu + Tarih (text input, placeholder: "05.03.2026")
Clock ikonu + Süre (number input, dakika, default: 30)
Görüşme Tipi ve Ruh Hali

Grid 2 sütun
Görüşme Tipi (dropdown):
📊 Performans
💬 Geri Bildirim
🚀 Gelişim
⚠️ Sorun Çözme
Ruh Hali (dropdown):
😊 Pozitif
😐 Nötr
😟 Negatif
Performans Değerlendirmesi (mor renkli kart)

⭐ başlık
4 slider (range input, 0-100):
Satış
Müşteri Hizmetleri
Ekip Çalışması
Devamsızlık
Her slider üzerinde:
Sol: Kategori adı (gri)
Sağ: Skor değeri (renkli, dinamik)
Slider rengi: mor (accent-purple-500)
Görüşme Konuları (zorunlu *, dinamik liste)

🏷️ başlık
Her satır: input + X butonu (silmek için)
"+ Konu Ekle" butonu (gri)
En az 1 konu gerekli
Görüşülen Konular (zorunlu *, dinamik liste)

💭 başlık (mavi)
Her satır: input + X butonu
"+ Görüşme Konusu Ekle" butonu (mavi)
En az 1 konu gerekli
Alınan Kararlar (opsiyonel, dinamik liste)

✅ başlık (yeşil)
Her satır: input + X butonu
"+ Karar Ekle" butonu (yeşil)
Sonraki Görüşme Tarihi (opsiyonel)

Calendar ikonu (sarı)
Text input (placeholder: "05.04.2026")
Form Tasarım Kuralları
Her bölüm ayrı glassmorphism kart
Zorunlu alanlar * işareti ile belirtilmiş
Dinamik listeler: X butonu ile satır silebilme
X butonu: kırmızı, rounded, küçük
Input'lar: şeffaf arka plan, border, rounded, focus efekti
Dropdown'lar: colorScheme: 'dark' ayarı
Bottom padding (pb-6)
Validasyon
Müdür adı dolu olmalı
Personel adı dolu olmalı
Pozisyon dolu olmalı
Lokasyon dolu olmalı
Tarih dolu olmalı
En az 1 görüşme konusu olmalı
En az 1 görüşülen konu olmalı
Hepsi sağlandığında "Kaydet" butonu aktif olur
5. Mock Veriler
En az 5 örnek görüşme içeren mock data:

Örnek 1: (Performans - Pozitif)

Müdür: Ahmet Yılmaz
Personel: Mehmet Özkan (Fotoğrafçı)
Lokasyon: Beach Club Antalya
Tarih: 05.03.2026, 30 dk
Skorlar: Satış 85, Müşteri Hizmetleri 90, Ekip 88, Devamsızlık 95
Konular: Satış hedeflerini %120 aştı, müşteri memnuniyeti yüksek, liderlik gösteriyor
Kararlar: Terfi, mentor görevlendirilecek, %15 maaş artışı
Örnek 2: (Sorun Çözme - Nötr)

Müdür: Ayşe Demir
Personel: Zeynep Kaya (Satış Danışmanı)
Lokasyon: Marina Tekne Turu
Tarih: 03.03.2026, 45 dk
Skorlar: Satış 65, Müşteri Hizmetleri 70, Ekip 60, Devamsızlık 85
Konular: Müşteri şikayetleri arttı, stres yüksek, ekip iletişimi zayıf
Kararlar: Çalışma saatleri gözden geçirilecek, stres yönetimi eğitimi, 2 hafta sonra kontrol
Örnek 3: (Gelişim - Pozitif)

Müdür: Mehmet Kaya
Personel: Can Yıldız (Asistan Fotoğrafçı)
Lokasyon: Paradise Beach
Tarih: 01.03.2026, 40 dk
Skorlar: Satış 75, Müşteri Hizmetleri 80, Ekip 85, Devamsızlık 90
Konular: Profesyonel eğitim istiyor, video çekiminde yetenekli, drone öğrenmek istiyor
Kararlar: Fotoğrafçılık kursu, drone sertifikası, sosyal medya görevi, 6 ay sonra değerlendirme
Örnek 4: (Geri Bildirim - Pozitif)

Müdür: Zeynep Arslan
Personel: Elif Şahin (Fotoğrafçı)
Lokasyon: Sunset Restaurant
Tarih: 28.02.2026, 25 dk
Skorlar: Satış 80, Müşteri Hizmetleri 85, Ekip 90, Devamsızlık 88
Konular: İşinden memnun, çalışma saatleri uygun, komisyon sistemi şeffaf olmalı
Kararlar: Komisyon sistemi anlatılacak, performans raporları paylaşılacak
Örnek 5: (Performans - Nötr)

Müdür: Ahmet Yılmaz
Personel: Burak Demir (Satış Danışmanı)
Lokasyon: Beach Club Antalya
Tarih: 25.02.2026, 35 dk
Skorlar: Satış 55, Müşteri Hizmetleri 65, Ekip 70, Devamsızlık 75
Konular: Hedeflerin altında, kendine güven eksik, ürün bilgisi yetersiz
Kararlar: Yoğun ürün eğitimi, mentörlük, mini hedefler, 2 hafta sonra kontrol
TEKNİK GEREKSİNİMLER
React + TypeScript kullan
lucide-react ikonları kullan: ArrowLeft, Calendar, User, MessageSquare, Star, TrendingUp, TrendingDown, Minus, Plus, X, Clock, MapPin, FileText, Briefcase
Component adı: StaffInterviews olsun
Props: { onBack: () => void }
State yönetimi:
selectedType: Aktif filtre ('all' | 'performance' | 'feedback' | 'development' | 'problem-solving')
showNewInterviewForm: Form görünürlüğü (boolean)
interviews: Görüşme listesi (array)
newInterview: Form data (object)
Handler fonksiyonları:
Dinamik liste ekleme/silme/güncelleme (topics, discussionPoints, agreements)
Form kaydetme (validasyon ile)
Form iptal etme (state reset)
Interface:
interface Interview {
  id: string;
  managerName: string;
  staffName: string;
  staffRole: string;
  location: string;
  date: string;
  type: 'performance' | 'feedback' | 'development' | 'problem-solving';
  duration: number; // minutes
  topics: string[];
  staffPerformance: {
    salesScore: number;
    customerServiceScore: number;
    teamworkScore: number;
    attendanceScore: number;
  };
  discussionPoints: string[];
  agreements: string[];
  nextMeetingDate: string;
  mood: 'positive' | 'neutral' | 'negative';
}
ÖZEL DETAYLAR
Filtre seçilince görüşmeler filtrelenir
Kaydet butonu validasyon geçilince aktif olur
Form kaydedilince listeye en üste eklenir
Form iptal edilince state temizlenir
Bottom padding (pb-20) alt menü için
Sticky header (sticky top-0 z-10)
Info kartı (sayfanın sonunda):
ℹ️ ikonu
"💬 Görüşme Sistemi" başlık
Açıklama: "Müdürler personelle düzenli birebir görüşmeler yaparak performans, motivasyon, kariyer gelişimi ve sorunları takip ederler..."
RENK PALETİ
Mavi: blue-500/600 (ana renk, kartlar)
Mor: purple-500/600 (performans)
Yeşil: green-400/500/600 (pozitif, kararlar, kaydet butonu)
Turuncu: orange-400/500 (sorun çözme, uyarı)
Sarı: yellow-400/500 (nötr, orta skor)
Kırmızı: red-400/500 (negatif, düşük skor)
Gri: gray-400/500 (metinler, pasif butonlar)
Beyaz: white (başlıklar)
ANİMASYONLAR
Hover: hover:scale-105, hover:bg-white/10
Active: active:scale-95
Transition: transition-all
Shadow efektleri aktif filtrelerde
