İşte Müdür Raporları - Haftalık ve Aylık Periyodik Raporlar sayfası için ULTRA DETAYLI prompt:

MÜDüR RAPORLARI - HAFTALlK VE AYLIK PERİYODİK RAPORLAR SAYFASI
EKSİKSİZ TASARIM VE GELİŞTİRME DOKÜMANI
📋 PROJE BAĞLAMI
Uygulama Bilgileri
Uygulama Adı: Aspect Operations
Sektör: Turistik fotoğrafçılık işletmeleri
Platform: iOS mobil uygulama
Tasarım Dili: Modern, dark mode, glassmorphism
Tasarım Sistemi
Arka plan gradient:

background: linear-gradient(to bottom, #2a2a3a, #3a3a4e, #2f3439);
Tailwind: bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]

Glassmorphism efekt:

Backdrop blur: backdrop-blur-xl
Şeffaf arka plan: bg-white/5, bg-white/10
İnce border: border border-white/10
Rounded köşeler: rounded-2xl, rounded-xl
Kullanıcı Rolleri
6 farklı rol: Yönetici, Müdür, Operasyon Sorumlusu, Personel, İdari, Kullanıcı

Modül Konumu
Ana menüde "Müdür Raporları" kategorisi
Alt modüller: Mekan Ziyaretleri, Müdür Raporları, Personel Görüşmeleri
🎯 SAYFA AMACI VE İŞLEVSELLİK
Amaç
Müdürlerin haftalık ve aylık periyodik raporlarını kaydetmesi, görüntülemesi ve yönetmesi.

Temel Özellikler
Haftalık ve aylık raporları ayrı tab'lerde görüntüleme
Yeni rapor oluşturma (fullscreen form)
Rapor durumu takibi (Taslak, Teslim Edildi, Gecikmiş)
Çoklu lokasyon destegi
Öne çıkan başarılar ve zorluklar kaydetme
Tarih aralığı bazlı raporlama
🎨 SAYFA TASARIMI - DETAYLI BÖLÜMLER
1️⃣ SAYFA HEADER (STICKY BAŞLlK BÖLÜMÜ)
Teknik Özellikler
<div className="sticky top-0 z-10 backdrop-blur-xl bg-gradient-to-b from-[#2a2a3a]/95 via-[#2a2a3a]/90 to-transparent border-b border-white/10">
  <div className="px-6 py-4">
    {/* İçerik */}
  </div>
</div>
Layout - Üst Satır
Flex container: flex items-center justify-between mb-3

SOL TARAF - Geri Butonu:

<button className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95">
  <ArrowLeft className="w-5 h-5 text-white" />
</button>
Boyut: 40px × 40px
Köşe yuvarlaklığı: 12px (rounded-xl)
Arka plan: Şeffaf beyaz %10
Border: Şeffaf beyaz %20, 1px
İkon: Lucide-react ArrowLeft, 20px × 20px, beyaz renk
Hover: Arka plan %20'ye çıkar
Active: scale-95 (basıldığında küçülür)
Transition: Tüm değişiklikler animate olur
ORTA - Başlık Grubu:

<div className="flex items-center gap-2">
  <h1 className="text-2xl font-bold text-white">Müdür Raporları</h1>
  <span className="text-2xl">📊</span>
</div>
Flex gap: 8px (iki öğe arası)
Başlık font size: 24px (1.5rem)
Font weight: Bold (700)
Renk: Tam beyaz (#FFFFFF)
Emoji: 24px, chart emoji 📊
SAĞ TARAF - Yeni Rapor Butonu:

<button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 border-2 border-purple-400/30 shadow-lg shadow-purple-500/30 transition-all hover:scale-105 active:scale-95">
  <Plus className="w-5 h-5 text-white" />
  <span className="text-white font-semibold text-sm">Yeni Rapor</span>
</button>
Padding: Yatay 16px, Dikey 10px
Köşe: 12px yuvarlak
Arka plan: Mor gradient (soldan sağa)
Normal: #a855f7 → #9333ea
Hover: #9333ea → #7e22ce
Border: 2px, mor %30 opacity
Shadow: Geniş, mor glow efekti %30 opacity
İkon: Plus, 20px × 20px, beyaz
Yazı: Beyaz, semibold, 14px
Hover: %105 büyür
Active: %95 küçülür
Layout - Alt Satır
<p className="text-sm text-gray-400 ml-14">
  Haftalık ve aylık periyodik raporlar
</p>
Font size: 14px (0.875rem)
Renk: Gri (#9CA3AF - gray-400)
Sol margin: 56px (geri butonunun genişliği + gap = 40px + 16px)
Amaç: Geri butonunun sağına hizalanır
2️⃣ TAB SİSTEMİ (HAFTALlK / AYLIK)
Container
<div className="px-6 mt-6">
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-2xl p-4">
    <div className="grid grid-cols-2 gap-3">
      {/* Tab butonları */}
    </div>
  </div>
</div>
Dış padding: Yatay 24px
Üst margin: 24px
İç kart: Glassmorphism efekt
Kart padding: 16px
Grid: 2 sütun, 12px gap
HAFTALlK RAPORLAR TAB (Aktif Durum)
<button 
  onClick={() => setSelectedTab('weekly')}
  className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
    selectedTab === 'weekly'
      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/50 border-2 border-purple-400/30'
      : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
  }`}
>

  <span className="mr-2">📅</span>
  Haftalık Raporlar
</button>
Aktif Durum Özellikleri:

Arka plan: Mor gradient #a855f7 → #9333ea
Yazı rengi: Beyaz #FFFFFF
Shadow: Geniş mor glow, %50 opacity
Border: 2px kalın, mor %30 opacity
Font: Semibold, 14px
Padding: 16px yatay, 12px dikey
Emoji: 📅 (takvim), 2px sağ margin
Pasif Durum Özellikleri:

Arka plan: Şeffaf beyaz %5
Yazı rengi: Gri #9CA3AF
Border: 1px ince, beyaz %10 opacity
Hover: Arka plan %10'a çıkar
Shadow: Yok
AYLIK RAPORLAR TAB (Pasif Durum)
<button 
  onClick={() => setSelectedTab('monthly')}
  className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
    selectedTab === 'monthly'
      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/50 border-2 border-purple-400/30'
      : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
  }`}
>
  <span className="mr-2">📆</span>
  Aylık Raporlar
</button>
Aynı stil kuralları
Emoji: 📆 (takvim sayfası)
Tab Davranışı
State: const [selectedTab, setSelectedTab] = useState<'weekly' | 'monthly'>('weekly')
Tıklandığında: State güncellenir
Liste: filteredReports = reports.filter(r => r.type === selectedTab)
Animasyon: transition-all ile smooth geçiş
3️⃣ RAPOR KARTLARI (LİSTE GÖRÜNÜMÜ)
Liste Container
<div className="px-6 mt-6 space-y-4">
  {filteredReports.map((report) => (
    <div key={report.id}>
      {/* Rapor kartı */}
    </div>
  ))}
</div>
Padding: Yatay 24px
Üst margin: 24px
Kartlar arası boşluk: 16px (space-y-4)
RAPOR KARTI - DIŞ CONTAINER
<div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-500/20 rounded-2xl p-5 hover:scale-[1.02] transition-all duration-200">
  {/* İçerik */}
</div>
Tasarım Özellikleri:

Backdrop blur: Arka plan bulanıklığı efekti
Gradient arka plan: Sol üstten sağ alta mor gradient
Başlangıç: #a855f7 %10 opacity
Bitiş: #9333ea %10 opacity
Border: 2px kalın, mor renk %20 opacity
Köşe yuvarlaklığı: 16px (rounded-2xl)
İç padding: 20px her yönde
Hover efekti: %102 büyüme
Transition: 200ms süre
KART ÜST BÖLÜM (HEADER)
Layout:

<div className="flex items-start justify-between mb-4">
  <div className="flex-1">
    {/* Sol içerik */}
  </div>
  {/* Sağ durum badge */}
</div>
Flex direction: Yatay
Align: Üstten hizalama
Justify: İki uç arasında boşluk
Alt margin: 16px
SOL İÇERİK - Müdür Adı:

<h3 className="text-xl font-bold text-white mb-2">
  Ahmet Yılmaz
</h3>
Font size: 20px (1.25rem)
Font weight: Bold (700)
Renk: Beyaz
Alt margin: 8px
SOL İÇERİK - Tarih Aralığı:

<div className="flex items-center gap-2 text-sm text-gray-400">
  <Calendar className="w-4 h-4" />
  <span>1-7 Mart 2026</span>
</div>
Flex gap: 8px
Font size: 14px
Renk: Gri #9CA3AF
İkon boyutu: 16px × 16px
Tarih Formatları:

Haftalık: "1-7 Mart 2026" (başlangıç-bitiş gün, ay, yıl)
Aylık: "Mart 2026" (sadece ay ve yıl)
SAĞ ÜST - DURUM BADGE'LERİ
1. TESLİM EDİLDİ (Yeşil):

<div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full">
  <Check className="w-4 h-4 text-green-400" />
  <span className="text-xs text-green-400 font-semibold">Teslim Edildi</span>
</div>
Arka plan: Yeşil %20 opacity #22c55e
Border: Yeşil %30 opacity, 1px
Shape: Pill (tam yuvarlak kenarlar)
Padding: 12px yatay, 6px dikey
İkon: Check (✓), 16px, açık yeşil #4ade80
Yazı: 12px, semibold, açık yeşil
Gap: 6px ikon-yazı arası
2. TASLAK (Turuncu):

<div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-full">
  <Clock className="w-4 h-4 text-orange-400" />
  <span className="text-xs text-orange-400 font-semibold">Taslak</span>
</div>
Arka plan: Turuncu %20 opacity #f97316
Border: Turuncu %30 opacity
İkon: Clock (⏰), 16px, açık turuncu #fb923c
Yazı: 12px, semibold, açık turuncu
Diğer özellikler aynı
3. GECİKMİŞ (Kırmızı):

<div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
  <AlertTriangle className="w-4 h-4 text-red-400" />
  <span className="text-xs text-red-400 font-semibold">Gecikmiş</span>
</div>
Arka plan: Kırmızı %20 opacity #ef4444
Border: Kırmızı %30 opacity
İkon: AlertTriangle (⚠️), 16px, açık kırmızı #f87171
Yazı: 12px, semibold, açık kırmızı
LOKASYON BADGE'LERİ
<div className="flex flex-wrap gap-2 mt-4 mb-4">
  {report.locations.map((location, idx) => (
    <span 
      key={idx}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs font-medium text-purple-300"
    >
      <span>📍</span>
      {location}
    </span>
  ))}
</div>
Tasarım Detayları:

Container: Flex wrap (taşan alt satıra iner)
Gap: Badge'ler arası 8px
Margin: Üst 16px, alt 16px
Her Badge:

Arka plan: Mor %20 opacity
Border: Mor %30 opacity, 1px
Shape: Pill (yuvarlak kenarlar)
Padding: 12px yatay, 6px dikey
Font: 12px, medium weight
Renk: Açık mor #d8b4fe (purple-300)
Pin emoji: 📍, 1.5em boyut
Gap: Emoji-yazı arası 6px
Örnek Lokasyonlar:

"Beach Club Antalya"
"Sunset Restaurant"
"Marina Tekne Turu"
"Paradise Beach"
Alternatif Renk Varyasyonu (Opsiyonel):

Her lokasyona farklı renk:
lokasyon: Mor
lokasyon: Mavi (bg-blue-500/20)
lokasyon: Turkuaz (bg-cyan-500/20)
vb. (döngüsel)
ÖNE ÇIKANLAR BÖLÜMÜ
<div className="mt-5 mb-4">
  {/* Başlık */}
  <div className="flex items-center gap-2 mb-3">
    <CheckSquare className="w-5 h-5 text-green-400" />
    <h4 className="text-sm font-semibold text-green-400">Öne Çıkanlar</h4>
  </div>
  
  {/* Liste */}
  <ul className="space-y-1.5">
    {report.highlights.map((highlight, idx) => (
      <li 
        key={idx}
        className="text-sm text-gray-300 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-pink-400 before:font-bold"
      >
        {highlight}
      </li>
    ))}
  </ul>
</div>
Başlık Tasarımı:

Layout: Flex, ikon + yazı
Gap: 8px
İkon: CheckSquare (☑), 20px × 20px, açık yeşil #4ade80
Yazı: 14px, semibold, açık yeşil
Alt margin: 12px
Liste Tasarımı:

Container: Maddeler arası 6px boşluk
Her madde:
Font size: 14px
Renk: Açık gri #d1d5db (gray-300)
Sol padding: 16px (nokta için yer)
Position: Relative (pseudo-element için)
Nokta İşareti (Bullet Point):

Content: '•' (madde işareti)
Position: Absolute, sol 0
Renk: Pembe #f472b6 (pink-400)
Font weight: Bold
Örnek Maddeler:

"Beach Club'da haftalık satış hedefi %115 oranında aşıldı"
"Yeni eleman Mehmet başarılı adaptasyon gösterdi"
"Albüm stok sistemi optimize edildi"
"Sosyal medya takipçi sayısı 5.000'e ulaştı"
ZORLUKLAR BÖLÜMÜ
{report.challenges.length > 0 && (
  <div className="mt-4 mb-4">
    {/* Başlık */}
    <div className="flex items-center gap-2 mb-3">
      <AlertTriangle className="w-5 h-5 text-orange-400" />
      <h4 className="text-sm font-semibold text-orange-400">Zorluklar</h4>
    </div>
    
    {/* Liste */}
    <ul className="space-y-1.5">
      {report.challenges.map((challenge, idx) => (
        <li 
          key={idx}
          className="text-sm text-gray-300 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-orange-400 before:font-bold"
        >
          {challenge}
        </li>
      ))}
    </ul>
  </div>
)}
ÖNEMLİ: Koşullu Render

Eğer challenges array'i boşsa (length === 0), bu bölüm hiç gösterilmez
&& operatörü ile conditional rendering
Tasarım Farkları (Öne Çıkanlara Göre):

İkon: AlertTriangle (⚠️), turuncu
Başlık rengi: Turuncu #fb923c
Nokta rengi: Turuncu (yerine pembe)
Diğer tüm özellikler aynı
Örnek Maddeler:

"Hava şartları nedeniyle 2 gün fotoğraf çekimi durdu"
"Yeni yazıcıda teknik sorun yaşandı (giderildi)"
"Bir personel hastalık nedeniyle 1 hafta izin kullandı"
"Yazıcı bakım maliyetleri beklenenin üzerinde çıktı"
KART ALT BİLGİ (Footer - Opsiyonel)
<div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
  <span className="text-gray-500">Son düzenleme: 05.03.2026</span>
  <div className="flex items-center gap-2">
    <span className="px-2 py-0.5 bg-white/5 rounded text-gray-400">
      3 lokasyon
    </span>
    <span className="px-2 py-0.5 bg-white/5 rounded text-gray-400">
      4 öne çıkan
    </span>
  </div>
</div>
Tasarım:

Üst border: İnce çizgi, beyaz %10 opacity
Üst padding: 12px
Font size: 12px
Layout: Flex, iki uç
Sol: Son düzenleme tarihi (gri)
Sağ: İstatistik pill'leri
4️⃣ YENİ RAPOR FORMU (FULLSCREEN MODAL)
"Yeni Rapor" butonuna basıldığında açılan fullscreen form.

FORM OUTER CONTAINER
{showNewReportForm && (
  <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
    {/* Form içeriği */}
  </div>
)}
Özellikler:

Conditional render: showNewReportForm state true ise görünür
Fullscreen: Tüm ekranı kaplar, minimum yükseklik 100vh
Arka plan: Aynı gradient (tutarlılık için)
Alt padding: 80px (bottom navigation için)
FORM HEADER (STICKY)
<div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
  <div className="px-4 py-4">
    {/* Başlık satırı */}
    <div className="flex items-center gap-3 mb-3">
      {/* Geri butonu */}
      <button
        onClick={() => setShowNewReportForm(false)}
        className="w-10 h-10 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 flex items-center justify-center active:scale-95 transition-all"
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>
      
      {/* Başlık grubu */}
      <div className="flex-1">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Plus className="w-6 h-6 text-purple-400" />
          Yeni Rapor Kaydı
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Periyodik rapor detayları
        </p>
      </div>
    </div>
    
    {/* Kaydet butonu */}
    <button
      onClick={handleSaveReport}
      disabled={!canSave}
      className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
        canSave
          ? 'bg-gradient-to-r from-green-500 to-green-600 hover:scale-[1.02] active:scale-95'
          : 'bg-gray-600 opacity-50 cursor-not-allowed'
      }`}
    >
      {canSave ? '✅ Raporu Kaydet' : '⚠️ Gerekli Alanları Doldurun'}
    </button>
  </div>
</div>
Sticky Header Özellikleri:

Position: Sticky, top 0, z-index 10
Backdrop: Blur efekti
Arka plan: Koyu mor %95 opacity
Border: Alt çizgi, beyaz %10 opacity
Padding: 16px her yönde
Geri Butonu:

Aynı tasarım (ana sayfadaki gibi)
onClick: Form kapanır, state resetlenir
Başlık:

Font size: 20px (daha küçük, form olduğu için)
Plus ikonu: 24px, mor renk
Alt başlık: 14px, gri
Kaydet Butonu:

Tam genişlik: w-full
Padding: 12px dikey
Aktif durum (canSave = true):
Yeşil gradient: #22c55e → #16a34a
✅ emoji + "Raporu Kaydet"
Hover: %102 büyür
Active: %95 küçülür
Pasif durum (canSave = false):
Gri arka plan: #4b5563 (gray-600)
%50 opacity
Cursor: not-allowed
⚠️ emoji + "Gerekli Alanları Doldurun"
Tıklanamaz
FORM ALANLARI - DETAYLI TANIMLAR
Form alanları container:

<div className="px-6 mt-4 space-y-4 pb-6">
  {/* Tüm form alanları */}
</div>
Yatay padding: 24px
Üst margin: 16px
Alanlar arası boşluk: 16px
Alt padding: 24px
1. MÜDÜR ADI (Zorunlu)
<div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
  <label className="block text-sm font-semibold text-white mb-2">
    👤 Müdür Adı *
  </label>
  <input
    type="text"
    value={newReport.managerName}
    onChange={(e) => setNewReport({ ...newReport, managerName: e.target.value })}
    placeholder="Raporu hazırlayan müdür"
    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
  />
</div>
Kart Tasarımı:

Glassmorphism wrapper
Border radius: 16px
Padding: 20px
Label:

Display: Block
Font: 14px, semibold
Renk: Beyaz
Alt margin: 8px
İkon: 👤 emoji
Yıldız: Zorunlu alan işareti
Input:

Tam genişlik
Padding: 16px yatay, 12px dikey
Arka plan: Şeffaf beyaz %5
Border: Beyaz %10, 1px
Border radius: 12px
Yazı rengi: Beyaz
Placeholder: Gri #6b7280 (gray-500)
Focus state:
Outline: None (default border kaldırılır)
Border: Mor %50 opacity (parlak focus efekti)
Font size: 16px (iOS için 16px minimum, zoom önleme)
2. RAPOR TİPİ (Zorunlu)
<div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
  <label className="block text-sm font-semibold text-white mb-2">
    <FileText className="w-4 h-4 inline mr-2 text-purple-400" />
    Rapor Tipi *
  </label>
  <select
    value={newReport.type}
    onChange={(e) => setNewReport({ ...newReport, type: e.target.value as 'weekly' | 'monthly' })}
    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
    style={{ colorScheme: 'dark' }}
  >
    <option value="weekly" className="bg-[#2a2a3a] text-white">📅 Haftalık Rapor</option>
    <option value="monthly" className="bg-[#2a2a3a] text-white">📊 Aylık Rapor</option>
  </select>
</div>
Label İkonu:

Lucide FileText component
Boyut: 16px × 16px
Renk: Mor #c084fc (purple-400)
Inline display, 8px sağ margin
Dropdown (Select):

Aynı input stili
ÖNEMLİ: style={{ colorScheme: 'dark' }}
iOS/Safari dark mode dropdown için gerekli
Beyaz ok yerine siyah ok gösterir
Option arka planı: Koyu mor #2a2a3a
Option yazısı: Beyaz
Her option emoji ile başlar
3. TARİH ARALIĞI (Zorunlu)
<div className="grid grid-cols-2 gap-3">
  {/* Başlangıç Tarihi */}
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
    <label className="block text-sm font-semibold text-white mb-2">
      <Calendar className="w-4 h-4 inline mr-2 text-purple-400" />
      Başlangıç *
    </label>
    <input
      type="text"
      value={newReport.startDate}
      onChange={(e) => setNewReport({ ...newReport, startDate: e.target.value })}
      placeholder="01.03.2026"
      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
    />
  </div>

  {/* Bitiş Tarihi */}
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
    <label className="block text-sm font-semibold text-white mb-2">
      <Calendar className="w-4 h-4 inline mr-2 text-purple-400" />
      Bitiş *
    </label>
    <input
      type="text"
      value={newReport.endDate}
      onChange={(e) => setNewReport({ ...newReport, endDate: e.target.value })}
      placeholder="07.03.2026"
      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
    />
  </div>
</div>
Grid Layout:

2 sütun (yan yana)
Gap: 12px
Her Tarih Alanı:

Ayrı glassmorphism kart
Calendar ikonu (mor)
Text input (type="text", not "date" - custom format için)
Format: GG.AA.YYYY (01.03.2026)
4. LOKASYONLAR (Dinamik Liste, Zorunlu)
<div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-5">
  <label className="block text-sm font-semibold text-blue-400 mb-3">
    <MapPin className="w-4 h-4 inline mr-2" />
    Lokasyonlar *
  </label>
  
  {newReport.locations.map((location, index) => (
    <div key={index} className="flex gap-2 mb-2">
      <input
        type="text"
        value={location}
        onChange={(e) => handleLocationChange(index, e.target.value)}
        placeholder="Beach Club Antalya, Marina, vb."
        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
      />
      {newReport.locations.length > 1 && (
        <button
          onClick={() => handleRemoveLocation(index)}
          className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 transition-all"
        >
          <X className="w-4 h-4 text-red-400" />
        </button>
      )}
    </div>
  ))}
  
  <button
    onClick={handleAddLocation}
    className="w-full py-2 mt-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition-all"
  >
    + Lokasyon Ekle
  </button>
</div>
Kart Rengi:

Mavi gradient: from-blue-500/10 to-blue-600/10
Mavi border: border-blue-500/20
Bu alan önemli olduğu için renkli vurgulanmış
Label:

Mavi renk #60a5fa (blue-400)
MapPin ikonu
Dinamik Liste Mantığı:

State: locations: string[] (array)
Her eleman için bir input satırı
Index ile map edilir
Her Satır:

Flex layout: Input + Silme butonu
Gap: 8px
Input: Flex-1 (kalan alanı kaplar)
Silme butonu:
Boyut: 40px × 40px
Arka plan: Kırmızı %20 opacity
Border: Kırmızı %30 opacity
İkon: X, 16px, açık kırmızı
Gösterim koşulu: Minimum 1 lokasyon olmalı, bu yüzden length > 1 ise göster
Hover: Arka plan %30'a çıkar
Ekle Butonu:

Tam genişlik
Padding: 8px dikey
Üst margin: 8px
Mavi tonlarda
"+ Lokasyon Ekle" yazısı
onClick: Yeni boş string array'e eklenir
Handler Fonksiyonlar:

const handleAddLocation = () => {
  setNewReport({ 
    ...newReport, 
    locations: [...newReport.locations, ''] 
  });
};

const handleRemoveLocation = (index: number) => {
  setNewReport({ 
    ...newReport, 
    locations: newReport.locations.filter((_, i) => i !== index) 
  });
};

const handleLocationChange = (index: number, value: string) => {
  const updated = [...newReport.locations];
  updated[index] = value;
  setNewReport({ ...newReport, locations: updated });
};
5. ÖNE ÇIKANLAR (Dinamik Liste, Zorunlu)
<div className="backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-2xl p-5">
  <label className="block text-sm font-semibold text-green-400 mb-3">
    <CheckSquare className="w-4 h-4 inline mr-2" />
    ✅ Öne Çıkanlar *
  </label>
  
  {newReport.highlights.map((highlight, index) => (
    <div key={index} className="flex gap-2 mb-2">
      <textarea
        value={highlight}
        onChange={(e) => handleHighlightChange(index, e.target.value)}
        placeholder="Bu dönemde öne çıkan başarı, hedef aşımı, olumlu gelişme..."
        rows={2}
        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 resize-none"
      />
      {newReport.highlights.length > 1 && (
        <button
          onClick={() => handleRemoveHighlight(index)}
          className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 transition-all self-start"
        >
          <X className="w-4 h-4 text-red-400" />
        </button>
      )}
    </div>
  ))}
  
  <button
    onClick={handleAddHighlight}
    className="w-full py-2 mt-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-semibold hover:bg-green-500/30 transition-all"
  >
    + Öne Çıkan Ekle
  </button>
</div>
Kart Rengi:

Yeşil gradient (from-green-500/10 to-green-600/10)
Yeşil border
Pozitif vurgu için yeşil
Textarea:

<textarea> elementi (multi-line)
Rows: 2 (2 satır yükseklik)
Resize: None (kullanıcı boyutlandıramaz)
Diğer stiller input ile aynı
Focus border: Yeşil
Silme Butonu:

self-start: Textarea'nın üstüne hizalanır (flex alignment)
Diğer özellikler aynı
Ekle Butonu:

Yeşil tonlarda
"+ Öne Çıkan Ekle"
Handler Fonksiyonlar:

const handleAddHighlight = () => {
  setNewReport({ 
    ...newReport, 
    highlights: [...newReport.highlights, ''] 
  });
};

const handleRemoveHighlight = (index: number) => {
  setNewReport({ 
    ...newReport, 
    highlights: newReport.highlights.filter((_, i) => i !== index) 
  });
};

const handleHighlightChange = (index: number, value: string) => {
  const updated = [...newReport.highlights];
  updated[index] = value;
  setNewReport({ ...newReport, highlights: updated });
};
6. ZORLUKLAR (Dinamik Liste, Opsiyonel)
<div className="backdrop-blur-xl bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-2xl p-5">
  <label className="block text-sm font-semibold text-orange-400 mb-3">
    <AlertTriangle className="w-4 h-4 inline mr-2" />
    ⚠️ Zorluklar <span className="text-xs text-gray-500">(Opsiyonel)</span>
  </label>
  
  {newReport.challenges.map((challenge, index) => (
    <div key={index} className="flex gap-2 mb-2">
      <textarea
        value={challenge}
        onChange={(e) => handleChallengeChange(index, e.target.value)}
        placeholder="Karşılaşılan zorluk, problem, engel..."
        rows={2}
        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
      />
      <button
        onClick={() => handleRemoveChallenge(index)}
        className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 transition-all self-start"
      >
        <X className="w-4 h-4 text-red-400" />
      </button>
    </div>
  ))}
  
  <button
    onClick={handleAddChallenge}
    className="w-full py-2 mt-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm font-semibold hover:bg-orange-500/30 transition-all"
  >
    + Zorluk Ekle
  </button>
</div>
Kart Rengi:

Turuncu gradient
Negatif/uyarı vurgusu için turuncu
Label:

AlertTriangle ikonu
"(Opsiyonel)" eklentisi (küçük, gri)
Minimum Eleman:

Bu alan opsiyonel olduğu için başlangıçta boş array olabilir: challenges: []
Silme butonu her zaman gösterilir (minimum 0 eleman olabilir)
Handler Fonksiyonlar: Aynı mantık, challenges array'i ile

7. DURUM (Zorunlu)
<div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
  <label className="block text-sm font-semibold text-white mb-2">
    <Star className="w-4 h-4 inline mr-2 text-yellow-400" />
    Durum *
  </label>
  <select
    value={newReport.status}
    onChange={(e) => setNewReport({ ...newReport, status: e.target.value as Report['status'] })}
    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
    style={{ colorScheme: 'dark' }}
  >
    <option value="draft" className="bg-[#2a2a3a] text-white">📝 Taslak</option>
    <option value="submitted" className="bg-[#2a2a3a] text-white">✅ Teslim Edildi</option>
  </select>
</div>
Star İkonu:

Sarı renk #facc15 (yellow-400)
Dropdown Seçenekleri:

draft: Taslak (📝 emoji)
submitted: Teslim Edildi (✅ emoji)
NOT: "overdue" (Gecikmiş) kullanıcı tarafından seçilemez, sistem tarafından otomatik atanır (tarih geçmişse)
8. EK NOTLAR (Opsiyonel)
<div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
  <label className="block text-sm font-semibold text-white mb-2">
    📝 Ek Notlar <span className="text-xs text-gray-500">(Opsiyonel)</span>
  </label>
  <textarea
    value={newReport.notes}
    onChange={(e) => setNewReport({ ...newReport, notes: e.target.value })}
    placeholder="Ek açıklamalar, gözlemler, gelecek dönem planları..."
    rows={4}
    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
  />
</div>
Textarea:

4 satır yükseklik
Resize none
Uzun form metinleri için
5️⃣ FORM VALİDASYON VE KAYDETME
Validasyon Mantığı
const canSave = 
  newReport.managerName.trim() !== '' &&
  newReport.startDate.trim() !== '' &&
  newReport.endDate.trim() !== '' &&
  newReport.locations.some(loc => loc.trim() !== '') &&
  newReport.highlights.some(h => h.trim() !== '');
Kurallar:

Müdür adı dolu olmalı
Başlangıç tarihi dolu olmalı
Bitiş tarihi dolu olmalı
En az 1 lokasyon dolu olmalı
En az 1 öne çıkan madde dolu olmalı
Rapor tipi her zaman seçili (default: weekly)
Durum her zaman seçili (default: draft)
NOT: Zorluklar ve notlar opsiyonel

Kaydetme Fonksiyonu
const handleSaveReport = () => {
  if (!canSave) return;
  
  const newReportData: Report = {
    id: Date.now().toString(),
    managerName: newReport.managerName.trim(),
    type: newReport.type,
    startDate: newReport.startDate.trim(),
    endDate: newReport.endDate.trim(),
    locations: newReport.locations.filter(loc => loc.trim() !== ''),
    highlights: newReport.highlights.filter(h => h.trim() !== ''),
    challenges: newReport.challenges.filter(c => c.trim() !== ''),
    status: newReport.status,
    notes: newReport.notes.trim()
  };
  
  // Listeye ekle (en üste)
  setReports([newReportData, ...reports]);
  
  // Form kapat
  setShowNewReportForm(false);
  
  // State reset
  setNewReport({
    managerName: '',
    type: 'weekly',
    startDate: '',
    endDate: '',
    locations: [''],
    highlights: [''],
    challenges: [],
    status: 'draft',
    notes: ''
  });
};
Adımlar:

Validasyon kontrolü
Yeni rapor objesi oluştur
ID: Timestamp kullan
Boş elemanları filtrele (trim sonrası)
Reports array'inin başına ekle
Form kapat
State reset
6️⃣ INFO KARTI (SAYFA SONU)
<div className="px-6 mt-6 mb-6">
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
        <span className="text-xl">ℹ️</span>
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-white mb-2">📊 Periyodik Raporlama Sistemi</h4>
        <p className="text-sm text-gray-400">
          Müdürler haftalık ve aylık olarak lokasyonlardaki faaliyetleri, başarıları ve 
          karşılaşılan zorlukları raporlarlar. Bu raporlar performans takibi ve stratejik 
          karar alma süreçlerinde kullanılır.
        </p>
      </div>
    </div>
  </div>
</div>
Tasarım:

Glassmorphism kart
Flex layout: İkon + Metin
İkon container: 40px × 40px, mavi tonlarda, emoji içinde
Başlık: Beyaz, semibold
Açıklama: Gri, küçük font
🔧 TEKNİK DETAYLAR
TypeScript Interface'ler
interface Report {
  id: string;
  managerName: string;
  type: 'weekly' | 'monthly';
  startDate: string; // Format: "DD.MM.YYYY"
  endDate: string;   // Format: "DD.MM.YYYY"
  locations: string[];
  highlights: string[];
  challenges: string[];
  status: 'draft' | 'submitted' | 'overdue';
  notes: string;
}

interface ManagerReportsDetailProps {
  onBack: () => void;
}
State Tanımlamaları
const [selectedTab, setSelectedTab] = useState<'weekly' | 'monthly'>('weekly');
const [showNewReportForm, setShowNewReportForm] = useState(false);
const [reports, setReports] = useState<Report[]>(MOCK_REPORTS);
const [newReport, setNewReport] = useState({
  managerName: '',
  type: 'weekly' as Report['type'],
  startDate: '',
  endDate: '',
  locations: [''],
  highlights: [''],
  challenges: [],
  status: 'draft' as Report['status'],
  notes: ''
});
Filtreleme
const filteredReports = reports.filter(report => report.type === selectedTab);
📦 MOCK VERİLER (5 ÖRNEK)
const MOCK_REPORTS: Report[] = [
  {
    id: '1',
    managerName: 'Ahmet Yılmaz',
    type: 'weekly',
    startDate: '01.03.2026',
    endDate: '07.03.2026',
    locations: ['Beach Club Antalya', 'Sunset Restaurant'],
    highlights: [
      "Beach Club'da haftalık satış hedefi %115 oranında aşıldı",
      "Yeni eleman Mehmet başarılı adaptasyon gösterdi",
      "Albüm stok sistemi optimize edildi"
    ],
    challenges: [
      "Hava şartları nedeniyle 2 gün fotoğraf çekimi durdu",
      "Yeni yazıcıda teknik sorun yaşandı (giderildi)"
    ],
    status: 'submitted',
    notes: 'Genel olarak çok verimli bir hafta geçirdik.'
  },
  {
    id: '2',
    managerName: 'Ayşe Demir',
    type: 'weekly',
    startDate: '23.02.2026',
    endDate: '29.02.2026',
    locations: ['Marina Tekne Turu', 'Paradise Beach'],
    highlights: [
      "Marina'da günlük ortalama 45 fotoğraf satışı gerçekleşti",
      "Müşteri memnuniyet oranı %95'e yükseldi",
      "Yeni drone ekipmanı ile ilk çekimler başarıyla tamamlandı"
    ],
    challenges: [
      "Paradise Beach'te elektrik kesintisi yaşandı"
    ],
    status: 'draft',
    notes: ''
  },
  {
    id: '3',
    managerName: 'Mehmet Kaya',
    type: 'monthly',
    startDate: '01.02.2026',
    endDate: '28.02.2026',
    locations: ['Beach Club Antalya', 'Sunset Restaurant', 'Marina Tekne Turu'],
    highlights: [
      "Şubat ayında toplam 1.250 fotoğraf satışı yapıldı (%18 artış)",
      "2 yeni personel işe alındı ve eğitim tamamlandı",
      "Yeni drone ekipmanı ile hava çekimleri başlatıldı",
      "Sosyal medya takipçi sayısı 5.000'e ulaştı"
    ],
    challenges: [
      "Yazıcı bakım maliyetleri beklenenin üzerinde çıktı",
      "Bir personel hastalık nedeniyle 1 hafta izin kullandı"
    ],
    status: 'submitted',
    notes: 'Mart ayı için yeni hedefler belirlendi. Operasyonel verimliliği artırmak öncelik.'
  },
  {
    id: '4',
    managerName: 'Zeynep Arslan',
    type: 'weekly',
    startDate: '15.02.2026',
    endDate: '21.02.2026',
    locations: ['Paradise Beach'],
    highlights: [
      "Hafta sonu yoğunluğu rekor seviyede oldu (250+ fotoğraf)",
      "Yeni albüm tasarımları müşteriler tarafından çok beğenildi"
    ],
    challenges: [],
    status: 'overdue',
    notes: ''
  },
  {
    id: '5',
    managerName: 'Can Yıldız',
    type: 'monthly',
    startDate: '01.03.2026',
    endDate: '31.03.2026',
    locations: ['Sunset Restaurant', 'Beach Club Antalya'],
    highlights: [
      "Mart ayı devam ediyor - ara değerlendirme",
      "İlk 2 haftada hedefin %60'ı tamamlandı"
    ],
    challenges: [],
    status: 'draft',
    notes: 'Ay sonunda final rapor güncellenecek.'
  }
];
🎨 RENK PALETİ REFERANSI
Renk	Hex	Tailwind	Kullanım Alanı
Mor (Koyu)	#9333ea	purple-600	Gradient bitiş, aktif tab
Mor (Açık)	#a855f7	purple-500	Gradient başlangıç, butonlar
Mor (Çok Açık)	#c084fc	purple-400	İkonlar, border
Mor (Ultra Açık)	#d8b4fe	purple-300	Badge yazıları
Mavi (Koyu)	#2563eb	blue-600	Alternatif vurgular
Mavi (Açık)	#3b82f6	blue-500	Lokasyon kartları
Mavi (Çok Açık)	#60a5fa	blue-400	İkonlar
Yeşil (Koyu)	#16a34a	green-600	Kaydet butonu bitiş
Yeşil (Açık)	#22c55e	green-500	Kaydet butonu başlangıç
Yeşil (Çok Açık)	#4ade80	green-400	Teslim edildi, öne çıkanlar
Turuncu (Açık)	#f97316	orange-500	Taslak durumu
Turuncu (Çok Açık)	#fb923c	orange-400	Zorluklar, uyarılar
Kırmızı (Açık)	#ef4444	red-500	Gecikmiş durumu
Kırmızı (Çok Açık)	#f87171	red-400	Silme butonları
Pembe (Açık)	#f472b6	pink-400	Madde işaretleri
Sarı (Açık)	#facc15	yellow-400	Yıldız ikonu
Gri (Koyu)	#4b5563	gray-600	Disabled butonlar
Gri (Orta)	#6b7280	gray-500	Placeholder, alt bilgiler
Gri (Açık)	#9ca3af	gray-400	İkincil metinler
Gri (Çok Açık)	#d1d5db	gray-300	Liste metinleri
Beyaz	#ffffff	white	Başlıklar, ana yazılar
✨ ANİMASYON VE EFEKT DETAYLARI
Hover Efektleri
Butonlar: hover:scale-105 (5% büyüme)
Kartlar: hover:scale-[1.02] (2% büyüme)
Arka planlar: hover:bg-white/10 (opacity artışı)
Input'lar: focus:border-color-500/50 (parlak border)
Active Efektleri
Tüm tıklanabilir öğeler: active:scale-95 (basıldığında küçülme)
Transition
Global: transition-all (tüm değişiklikler animate)
Kartlar: transition-all duration-200 (200ms smooth)
Shadow Efektleri
Aktif tab: shadow-lg shadow-purple-500/50
Yeni rapor butonu: shadow-lg shadow-purple-500/30
Aktif durum badge'leri: Rengine göre shadow
🔌 LUCIDE-REACT İKONLARI
import { 
  ArrowLeft,      // Geri butonları
  Plus,           // Ekleme butonları
  Calendar,       // Tarih alanları
  MapPin,         // Lokasyonlar
  FileText,       // Rapor tipi
  CheckSquare,    // Öne çıkanlar başlık
  AlertTriangle,  // Zorluklar başlık, gecikmiş durum
  Check,          // Teslim edildi durum
  Clock,          // Taslak durum
  X,              // Silme butonları
  Star            // Durum alanı
} from 'lucide-react';
🚀 COMPONENT EXPORT
export function ManagerReportsDetail({ onBack }: ManagerReportsDetailProps) {
  // Component logic
}
✅ KONTROL LİSTESİ
 Sticky header çalışıyor
 Tab geçişi animasyonlu
 Liste tab'e göre filtreleniyor
 Durum badge'leri doğru renklerde
 Zorluklar boşsa gizli
 Form açılıyor/kapanıyor
 Dinamik listeler çalışıyor
 Validasyon doğru
 Kaydet butonu aktif/pasif oluyor
 Yeni rapor listeye ekleniyor
 State reset ediliyor
 Mobile responsive
 Dark mode uyumlu
 Glassmorphism efektler aktif
 Tüm animasyonlar smooth