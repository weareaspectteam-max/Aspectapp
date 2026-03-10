Haklısınız, UI tasarımını yeterince detaylı anlatmadım. Şimdi dosyayı daha detaylı inceleyip, ekran görüntüsü alır gibi adım adım görsel yapıyı anlatayım.

Artık yeterli bilgiye sahibim. Çok detaylı bir görsel açıklama hazırlayacağım:

🎯 ROTASYON SİSTEMİ - DETAYLI GÖRSEL UI PROMPT
📱 EKRAN YAPISI
Ana Container
min-h-screen 
bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]
pb-20 (bottom navigation için boşluk)
🎨 HEADER (Sticky - Her Zaman Üstte)
┌─────────────────────────────────────────────┐
│  [🟦 LOGO]  Rotasyon Yönetimi              │
│             Günlük görev planlama           │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ [📋 Görev Planla] [📨 Rotasyonlar]   │ │
│  │        [🏖️ İzinler]                   │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
Detaylar:

Arka plan: sticky top-0 z-10 backdrop-blur-xl bg-white/10 border-b border-white/20
Logo kutusu:
w-12 h-12 rounded-2xl
bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd]
İçinde Users ikonu w-6 h-6 text-[#2d3748]
Başlık: text-xl font-black text-white
Alt başlık: text-xs text-gray-400
Tab Sistemi:

Container: bg-white/10 p-1.5 rounded-xl border border-white/20

AKTİF TAB:
- bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd]
- text-[#2d3748]
- shadow-lg

PASİF TAB:
- text-gray-400
- hover:text-white
📅 SEKME 1: GÖREV PLANLA
TARİH SEÇİCİ BÖLÜMÜ
┌─────────────────────────────────────────────┐
│  [◀ Dün]     [  Bugün  ]      [Yarın ▶]    │
│                                             │
│  ┌────────────────────────────────────────┐│
│  │ 📅 [2026-03-07 input]            🕐    ││
│  └────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
Buton Stilleri:

Dün/Yarın: bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 text-white text-xs
Bugün: bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] text-xs font-bold
Tarih input kutusu: bg-white/10 rounded-xl p-3 border border-white/20
LOKASYON KARTLARI (7 Adet Sabit Mekan)
📍 Sabit Mekanlar

┌─────────────────────────────────────────────┐ ─┐
│  [✅] 🏖️ ZOKA Beach Club • 🕐 09:00-17:00  │  │ DRAFT durumu
│       📌 Düzenli İş                         │  │ (Turuncu renk)
│                                             │  │
│       ┌─────────────────────────────────┐  │  │
│       │ 👥 Personel (3):                │  │  │
│       │  [👨 Ahmet] [👩 Ayşe] [👨‍🦱 Can]│  │  │
│       └─────────────────────────────────┘  │  │
│                                             │  │
│       📝 Yoğun mesai bekleniyor             │  │
│                                             │  │
│  [Düzenle] [Sil] [Gönder]                  │  │
└─────────────────────────────────────────────┘ ─┘

┌─────────────────────────────────────────────┐ ─┐
│  🍽️ Müjgan Restaurant • 🕐 10:00-18:00     │  │ SENT durumu
│     📌 Düzenli İş | Gönderim: 14:30  ✅ G.. │  │ (Yeşil renk)
│                                             │  │
│       ┌─────────────────────────────────┐  │  │
│       │ 👥 Personel (2):                │  │  │
│       │  [👩‍🦰 Zeynep] [👨‍🦲 Emre]      │  │  │
│       └─────────────────────────────────┘  │  │
│                                             │  │
│  [Düzenle] [İptal]                          │  │
└─────────────────────────────────────────────┘ ─┘

┌─────────────────────────────────────────────┐ ─┐  ┌─────────┐
│  ☕ Hayal Kahvesi • 🕐 12:00-20:00          │  │  │ Revize  │ <- SAĞ ÜST KÖŞEDE AMBER BADGE
│     📌 Düzenli İş | Gönderim: 09:15         │  │  │   3x    │
│                                             │  │  └─────────┘
│       ┌─────────────────────────────────┐  │  │ REVISED durumu
│       │ 👥 Personel (4):                │  │  │ (Turuncu renk)
│       │  [👨 Ali] [👩 Elif] ...         │  │  │
│       └─────────────────────────────────┘  │  │
│                                             │  │
│  [Düzenle] [İptal] [Gönder]                 │  │
└─────────────────────────────────────────────┘ ─┘

┌─────────────────────────────────────────────┐ ─┐
│  ⚓ Marina                                   │  │ BOŞ KART
│                                             │  │ (Beyaz/Gri)
│  [+ Görev Oluştur]                          │  │
└─────────────────────────────────────────────┘ ─┘
KART RENK KODLARI:

BOŞ: bg-white/10 border-white/20
DRAFT: bg-orange-500/10 border-orange-500/30 (Turuncu)
SENT: bg-green-500/10 border-green-500/40 (Yeşil)
REVISED: bg-orange-500/10 border-orange-500/30 (Turuncu)
CANCELLED: bg-red-500/10 border-red-500/40 (Kırmızı)
KART İÇERİĞİ YAPISI:

İlk satır: [Checkbox (sadece draft)] + [Icon] + [Lokasyon] + • + 🕐 + [Saat] + [Status Badge]
İkinci satır: 📌 Düzenli İş + | + Gönderim Saati (sent/revised/cancelled ise)
Personel kutusu: bg-white/10 rounded-xl p-2.5
Başlık: 👥 Personel (3):
Personel pilleri: bg-white/10 rounded-lg px-2.5 py-1.5 text-xs
Notlar (varsa): bg-white/10 rounded-lg px-3 py-2 text-xs
İptal nedeni (cancelled ise): bg-red-500/10 border border-red-500/30 text-red-300
Butonlar:
DRAFT: [Düzenle (mavi)] [Sil (kırmızı)] [Gönder (yeşil)]
SENT: [Düzenle (mavi)] [İptal (kırmızı)]
REVISED: [Düzenle (mavi)] [İptal (kırmızı)] [Gönder (yeşil)]
CANCELLED: [Reaktive Et (yeşil)] [Sil (kırmızı)]
BOŞ: [+ Görev Oluştur (yeşil gradient)]
REVİZE BADGE (Sağ üst köşe, kartın dışında):

┌─────────┐
│ Revize  │ <- bg-amber-600/90 border-2 border-amber-500
│   3x    │    absolute -top-3 -right-3
└─────────┘    rounded-xl shadow-lg z-10
GÖNDER BUTONLARI BÖLÜMÜ
┌─────────────────────────────────────────────┐
│  [✅ Tümünü Seç (5)]                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [□ Seçimi Temizle]                         │
└─────────────────────────────────────────────┘

┌──────────────────────┬──────────────────────┐
│   Seçili (3)  📤     │   Tümü (8)  📤       │
│   (mavi gradient)    │   (yeşil gradient)   │
└──────────────────────┴──────────────────────┘
Buton Detayları:

Tümünü Seç: bg-white/10 border border-white/20 text-white
Seçimi Temizle: bg-white/10 border border-white/20 text-white (sadece seçim varsa görünür)
Seçili: bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] disabled:opacity-50
Tümü: bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8]
EKSTRA & ÖZEL GÖREVLER BÖLÜMÜ
⚡ Ekstra & Özel Görevler

┌─────────────────────────────────────────────┐ ─┐
│  [✅] 🎭 Özel Etkinlik • 🕐 18:00-22:00     │  │ ÖZEL GÖREV
│       ⚡ Özel Görev | Gönderim: 15:00       │  │ (Mor renk)
│                                             │  │
│       👥 Personel (2): [👨 Ahmet] [👩 Selin]│  │
│       📝 Özel fotoğraf çekimi               │  │
│                                             │  │
│  [Düzenle] [Sil] [Gönder]                  │  │
└─────────────────────────────────────────────┘ ─┘

┌─────────────────────────────────────────────┐
│  [+ Ekstra Görev Ekle]                      │
└─────────────────────────────────────────────┘
Renk Farkları:

Özel Görev (special): bg-purple-500/10 border-purple-500/30 (Mor)
Ekstra İş (extra): bg-blue-500/10 border-blue-500/30 (Mavi)
İZİNLİ PERSONEL BÖLÜMÜ
🏖️ İzinli Personel (5)

┌─────────────────────────────────────────────┐
│  👥 Bugün İzinli Olanlar:                   │
│                                             │
│  [✅ 👨‍🦲 Can Yücel] 📌 SABİT               │ <- Checkbox disabled
│  [☐ 👩‍🦰 Zeynep] 📅 GÜN      [X]           │ <- Günlük izinli, X ile kaldır
│  [☐ 👨 Ahmet] 📅 GÜN         [X]           │
│                                             │
│  [Seçili (2) Beklemeye Al]                  │ <- Cyan buton
│  [Tümünü Beklemeye Al] [Güncelle]           │
└─────────────────────────────────────────────┘
Personel Pill Stilleri:

Seçili: bg-orange-500/30 border-2 border-orange-400 text-white
Seçili değil: bg-white/10 border border-white/20 text-gray-300
Sabit izinli: Checkbox disabled, mavi badge "📌 SABİT"
Günlük izinli: Kırmızı badge "📅 GÜN" + sağ üstte X butonu
BEKLEMEDE PERSONEL BÖLÜMÜ
⏳ Beklemede (12)

┌─────────────────────────────────────────────┐
│  [☐ 👨 Murat] [☐ 👩 Deniz] [☐ 👨‍🦱 Kerem]  │
│  [☐ 👩‍🦰 Seda] [☐ 👨‍🦲 Barış] ...          │
│                                             │
│  [Seçili (0) Göreve Ekle]                   │
│  [Tümünü Seç (12)] [Seçimi Temizle]         │
└─────────────────────────────────────────────┘
📨 SEKME 2: ROTASYONLAR
SON 3 GÜN GÖREVLERİ
📨 Gönderilen Rotasyonlar

┌─────────────────────────────────────────────┐
│  Bugün (7 Mar Cuma)                         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐ ┌──────┐
│  🕐 | 🏖️ ZOKA Beach Club • 🕐 09:00-17:00  │ │7 Mar │ <- SOL ÜST BADGE (mavi)
│      📌 Düzenli İş | Gönderim: 08:30        │ └──────┘
│                                             │   ┌──────┐
│      👥 Personel (3): [👨 Ahmet] [👩 Ayşe]  │   │Revize│ <- SAĞ ÜST (amber)
│      📝 Normal mesai                         │   │  2x  │
│                                             │   └──────┘
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  ✅ | 🏖️ Bugün İzinli Personel             │ <- ÖZEL KART
│      🏖️ İzinli Listesi | Dinamik Güncelleme│    (Pembe/rose renk)
│                                             │
│      👥 Personel (5): [👨‍🦲 Can] [👩 Zeynep]│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  ⏳ | Rotasyona Atanabilirsiniz Lütfen Haber│ <- ÖZEL KART
│      ⏳ Bekleme Listesi | Dinamik Güncelleme│    (Sarı renk)
│                                             │
│      👥 Personel (12): [👨 Murat] [👩 Deniz]│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Dün (6 Mar Per)                            │
└─────────────────────────────────────────────┘

... (aynı format)

┌─────────────────────────────────────────────┐
│  5 Mar Çar                                  │
└─────────────────────────────────────────────┘

... (aynı format)

┌─────────────────────────────────────────────┐
│         [+ Daha Fazla +10]                  │
└─────────────────────────────────────────────┘
KART ÖZELLİKLERİ:

Sol border: 4px kalın, renge göre (border-l-4)
Yeşil: Normal görev (sent)
Mor: Özel görev
Mavi: Ekstra görev
Pembe/Rose: İzinli listesi
Sarı: Bekleme listesi
Kırmızı: İptal edilmiş
Tarih badge (sol üst): absolute -top-3 -left-3 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd]
Revize badge (sağ üst): Aynı amber badge
Durum ikonu:
✅ Sent
🔄 Revised
❌ Cancelled
🏖️ SEKME 3: İZİNLER
🏖️ İzin Talepleri (2)

┌─────────────────────────────────────────────┐
│  [📊 Geçmişim]  [+ İzin Ekle]               │
└─────────────────────────────────────────────┘
KİŞİSEL GEÇMİŞ ACCORDION (Toggle ile açılır)
┌─────────────────────────────────────────────┐
│  📅 Çalışma Geçmişim        [15 kayıt]      │
│  [Bu Hafta] [Bu Ay] [Son 2 Ay]              │ <- FİLTRE BUTONLARI
│  ─────────────────────────────────────────  │
│                                             │
│  07 Mar | 🏖️ ZOKA Beach Club | 09:00-17:00│ <- Mavi arka plan
│  06 Mar | 🍽️ Müjgan Restaurant | 10:00-18:00│
│  05 Mar | 🐟 Balıkhali | 11:00-19:00       │
│  04 Mar | 🏖️ Yıllık İzin                   │ <- Turuncu arka plan
│  03 Mar | 🏖️ Yıllık İzin                   │
│  02 Mar | 🏖️ ZOKA Beach Club | 09:00-17:00│
│  ...                                        │
│                                             │
│  (max-height: 80, scroll)                   │
└─────────────────────────────────────────────┘
Filtre Butonları:

Aktif: bg-[#9dd9ea] text-[#2d3748] (Mavi)
Pasif: bg-white/10 text-gray-400 hover:bg-white/20
Liste Satırları:

Çalışma günü: bg-blue-500/10 hover:bg-blue-500/20
İzin günü: bg-orange-500/10 hover:bg-orange-500/20
İZİN TALEPLERİ LİSTESİ
┌─────────────────────────────────────────────┐
│  👨‍🦲 Can Yücel                              │
│  📅 10-14 Mar 2026 (5 gün)                  │
│  🏖️ Yıllık İzin                            │
│  📝 Yıllık izin - aile ziyareti             │
│  [✅ Onaylandı]                             │ <- Yeşil badge
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  👩‍🦰 Zeynep Şahin                          │
│  📅 15-18 Mar 2026 (4 gün)                  │
│  🏖️ Yıllık İzin                            │
│  [⏳ Beklemede]                             │ <- Amber badge
│  [Onayla] [Reddet]                          │
└─────────────────────────────────────────────┘
Durum Badge'leri:

Onaylandı: bg-green-500/30 text-green-200
Beklemede: bg-amber-500/30 text-amber-200
Reddedildi: bg-red-500/30 text-red-200
🎨 MODAL TASARIMLARI
GÖREV EKLEME/DÜZENLEME MODAL
┌─────────────────────────────────────────────┐
│  ✏️ Görev Düzenle                    [X]    │
│  ─────────────────────────────────────────  │
│                                             │
│  📍 Lokasyon                                │
│  [▼ ZOKA Beach Club              ]          │
│                                             │
│  👥 Personel (Çoklu seçim)                  │
│  ┌────────────────────────────────────────┐│
│  │ [☐ 👨 Ahmet Yılmaz]                   ││
│  │ [✅ 👩 Ayşe Demir]                     ││
│  │ [✅ 👨‍🦱 Mehmet Kaya]                  ││
│  │ [☐ 👩‍🦰 Zeynep Şahin] 🏖️ İZİNLİ ❌  ││ <- İzinli, seçilemez
│  │ ...                                    ││
│  └────────────────────────────────────────┘│
│                                             │
│  🕐 Çalışma Saatleri                        │
│  [09:00] - [17:00]                          │
│                                             │
│  📝 Notlar (opsiyonel)                      │
│  [                                    ]     │
│                                             │
│  [İptal]               [Kaydet]             │
└─────────────────────────────────────────────┘
İzinli Personel Gösterimi:

Kırmızı border: border-2 border-red-500
İzin ikonu: 🏖️
Disabled: pointer-events-none opacity-50
İPTAL MODAL
┌─────────────────────────────────────────────┐
│  ❌ Görev İptali                      [X]    │
│  ─────────────────────────────────────────  │
│                                             │
│  🏖️ ZOKA Beach Club                        │
│  🕐 09:00-17:00                             │
│  👥 3 Personel                              │
│                                             │
│  📝 İptal Nedeni *                          │
│  ┌────────────────────────────────────────┐│
│  │                                        ││
│  │  (zorunlu alan)                        ││
│  │                                        ││
│  └────────────────────────────────────────┘│
│                                             │
│  [Vazgeç]          [İptali Onayla]         │
└─────────────────────────────────────────────┘
🎯 ÖNEMLİ GÖRSEL DETAYLAR
Glassmorphism Efekti
backdrop-blur-xl
bg-white/10
border-2 border-white/20
rounded-2xl
Gradient Butonlar
/* Mavi */
bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd]
text-[#2d3748]

/* Yeşil */
bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8]
text-[#2d3748]
Checkbox Görünümü
Seçili: <CheckSquare className="w-5 h-5 text-[#a8e6cf]" />
Boş: <Square className="w-5 h-5 text-gray-400" />
Hover & Active Efektleri
transition-all
hover:bg-white/20
active:scale-95
hover:shadow-xl
Badge Pozisyonları
/* Tarih Badge (Sol Üst) */
absolute -top-3 -left-3

/* Revize Badge (Sağ Üst) */
absolute -top-3 -right-3
🔄 ANİMASYONLAR
// Sekme değişim animasyonu
<motion.div
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: 20 }}
>


// Kart girişi
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
>


// Modal açılma
<AnimatePresence>
  {showModal && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
  )}
</AnimatePresence>