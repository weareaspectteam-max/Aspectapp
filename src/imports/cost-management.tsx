MALİYET YÖNETİMİ MODÜLÜ - DETAYLI PROMPT
## ARKA PLAN
"Aspect Operations" adında turistik fotoğrafçılık işletmeleri için iOS mobil uygulaması geliştiriyorum. 
Uygulama beach club, tekne, restoran ve turistik mekanlarda çalışan fotoğraf ekipleri tarafından 
günlük satışları, albüm stoklarını, yazıcı kullanımını ve finansal performansı takip etmek için kullanılacak. 
Koyu gradient arka plan ve glassmorphism efektli kartlarla modern bir tasarıma sahip ve tüm Supabase 
backend bağlantıları koparılarak tam mock/demo moduna çevrildi.

## İSTEK
Hamburger menüye "Maliyet Yönetimi" modülünü eksiksiz olarak ekle. Bu modül, işletmenin tüm sabit 
maliyetlerini yönetmek için kullanılacak.

## DOSYA YAPISI
- `/src/app/components/cost-management.tsx` dosyasını oluştur
- Hamburger menüden bu sayfaya navigasyon ekle

## TASARIM SİSTEMİ
### Renk Paleti:
- Arka plan: `bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]`
- Kartlar: `backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20`
- Başlık: `backdrop-blur-xl bg-gradient-to-r from-[#2a2a3a]/95 to-[#3a3a4e]/95`
- Kur yönetimi rengi: `#9dd9ea` (açık mavi)
- Ürün maliyetleri rengi: `#9dd9ea` (açık mavi)
- Düzenli giderler rengi: `#ffd4a3` (turuncu)
- Personel maaşları rengi: `#a8e6cf` (yeşil)
- Mekan kiraları rengi: `#d4b5f7` (mor)

### Tipografi:
- Ana başlık: `text-2xl font-black text-white`
- Alt başlık: `text-sm text-gray-400`
- Kart başlıkları: `font-bold text-white text-lg`
- Fiyatlar: `text-white font-bold`

## MODÜL YAPISı

### 1. ANA SAYFA
Üst kısımda:
- Geri butonu (sol üst)
- Başlık: "💰 Maliyet Yönetimi"
- Alt başlık: "Sabit maliyetlerinizi yönetin"

İçerik bölümü (yukarıdan aşağıya):

#### A. KUR YÖNETİMİ KARTI
- Başlık: "💱 Döviz Kurları"
- **Toggle Switch:**
  - Sol: "Manuel Giriş"
  - Sağ: "Otomatik API"
  - Toggle aktif olunca renk: `#9dd9ea`
  - Toggle kapalıyken: `bg-gray-600`

- **Manuel Mod:**
  - 3 satır input:
    - 🇪🇺 EUR: [input] TL
    - 🇺🇸 USD: [input] TL
    - 🇬🇧 GBP: [input] TL
  - Input style: `bg-white/10 border border-white/20 rounded-xl`

- **Otomatik Mod:**
  - Sadece gösterim (readonly):
    - EUR, USD, GBP değerlerini göster
  - Buton: "🔄 Kurları Güncelle"
    - `bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd]`
    - API'den kur çeksin: `https://api.exchangerate-api.com/v4/latest/TRY`

#### B. TOPLAM MALİYET ÖZETİ KARTI
- Arka plan: `bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 border border-[#ffd4a3]/30`
- Üst satır: "Toplam Aylık Sabit Maliyet" (küçük gri)
- Ortada BÜYÜK: "₺XX,XXX" (4xl font, beyaz, bold)
- Alt satır: "Giderler + Maaşlar + Kiralar" (çok küçük gri)

#### C. KATEGORİ KARTLARI (4 adet clickable kart)

**1. Ürün Maliyetleri Kartı**
- İkon: 📸 (mavi gradient arka plan `#9dd9ea`)
- Başlık: "Ürün Maliyetleri"
- Alt metin: "6 albüm • X kağıt tipi"
- Sağda ok ikonu
- Tıklayınca → Albümler ve Kağıtlar sayfası

**2. Düzenli Giderler Kartı**
- İkon: 🏢 (turuncu gradient arka plan `#ffd4a3`)
- Başlık: "Düzenli Giderler"
- Alt metin: "X gider • ₺X,XXX/ay"
- Sağda ok ikonu
- Tıklayınca → Düzenli Giderler sayfası

**3. Personel Maaşları Kartı**
- İkon: 👥 (yeşil gradient arka plan `#a8e6cf`)
- Başlık: "Personel Maaşları"
- Alt metin: "X personel • ₺X,XXX/ay"
- Sağda ok ikonu
- Tıklayınca → Personel Maaşları sayfası

**4. Mekan Kiraları Kartı**
- İkon: 📍 (mor gradient arka plan `#d4b5f7`)
- Başlık: "Mekan Kiraları"
- Alt metin: "X mekan • ₺X,XXX/ay"
- Sağda ok ikonu
- Tıklayınca → Mekan Kiraları sayfası

---

### 2. ÜRÜN MALİYETLERİ SAYFASI

**ÜST BÖLÜM: ALBÜMLER**
- Başlık: "📸 ALBÜMLER"
- 6 adet albüm kartı (3'lü, 5'li, 7'li, 9'lı, 11'li, 15'li)
- Her kart:
  - Sol: "X'li Albüm" (başlık)
  - Orta: [input number] (fiyat)
  - Sağ: [dropdown] (TRY/EUR/USD/GBP)
  - Eğer para birimi TRY değilse:
    - Alt satırda göster: "TL Karşılığı: X EUR × 35.50 = ₺XXX.XX"
    - Format: `tutar × kur = sonuç`

**ALT BÖLÜM: FOTOĞRAF KAĞITLARI**
- Başlık: "📄 FOTOĞRAF KAĞITLARI"
- Eğer liste boşsa:
  - Mesaj: "Henüz kağıt tipi eklenmemiş"
  - Buton: "➕ İlk Kağıdı Ekle"

- Eğer liste doluysa:
  - Her kağıt kartı:
    - Başlık: Kağıt ismi (örn: "Premium Mat Kağıt")
    - Sağ üst: Edit ve Delete butonları
    - Gösterim satırları:
      - "Kutu Fiyatı: X EUR"
      - "Kutu İçi: 500 adet"
      - Çizgi
      - "Birim Maliyet: 0.15 EUR/adet"
      - Eğer dövizli: "0.15 × 35.50 = 5.32 TL/adet"
      - "Kutu TL: ₺2,660.00"
      - Eğer dövizli: "75 EUR × 35.50 = ₺2,660.00"
  - En altta: "➕ Yeni Kağıt Tipi Ekle" butonu

**KAĞIT EKLEME/DÜZENLEME FORMU:**
Inputlar:
1. "Kağıt Türü / Marka:" [text input] (placeholder: "Örn: Premium Mat Kağıt")
2. "Kutu Fiyatı:" [number input]
3. "Para Birimi:" [dropdown: TRY/EUR/USD/GBP]
4. "Kutu İçi Adet:" [number input] (placeholder: "Örn: 500")

Preview kutusu (mavi arka plan):
- "📊 Hesaplanan Değerler:"
- "Birim Maliyet: 0.15 EUR/adet"
- Eğer dövizli: "(0.15 EUR × 35.50 = 5.32 TL/adet)"
- "Toplam Kutu: ₺2,660.00"
- Eğer dövizli: "(75 EUR × 35.50 = ₺2,660.00)"

Butonlar:
- "💾 Kaydet" (yeşil gradient)
- "❌ İptal" (gri transparent)

---

### 3. DÜZENLİ GİDERLER SAYFASI

**BAŞLIK:**
- "🏢 Düzenli Giderler"
- Alt: "Toplam Aylık: ₺X,XXX"

**LİSTE BOŞSA:**
- Mesaj: "Henüz gider eklenmemiş"
- Buton: "➕ İlk Gideri Ekle"

**LİSTE DOLUYSA:**
Her gider kartı:
- Başlık: 🏢 [Gider Adı]
- Alt: "X TRY / Ay"
- Sağ üst: Edit ve Delete butonları
- Turuncu arka planlı kutu:
  - "Aylık Maliyet: ₺X,XXX"
  - Eğer dövizli: "X EUR × 35.50 = ₺XXX / Ay"

En altta: "➕ Yeni Gider Ekle" butonu

**GİDER EKLEME/DÜZENLEME FORMU:**
Inputlar:
1. "Gider Adı:" [text] (placeholder: "Örn: Ofis Kirası")
2. "Tutar:" [number]
3. "Para Birimi:" [dropdown: TRY/EUR/USD/GBP]
4. "Periyot:" [4 buton grid]
   - Günlük / Haftalık
   - Aylık / Yıllık
   - Seçili olan: turuncu arka plan `#ffd4a3`
   - Seçili olmayan: transparent + border

Preview kutusu (turuncu arka plan):
- "📊 Aylık Maliyet:"
- Büyük: "₺X,XXX"
- Eğer dövizli: "(X EUR × 35.50 = XXX.XX TL / Ay)"

Butonlar:
- "💾 Kaydet" (yeşil)
- "❌ İptal" (gri)

---

### 4. PERSONEL MAAŞLARI SAYFASI

**BAŞLIK:**
- "👥 Personel Maaşları"
- Alt: "Toplam Aylık: ₺X,XXX"

**LİSTE BOŞSA:**
- Mesaj: "Henüz personel eklenmemiş"
- Buton: "➕ İlk Personeli Ekle"

**LİSTE DOLUYSA:**
Her personel kartı:
- Başlık: 👤 [Personel Adı]
- Alt: "Maaş: X TRY / Ay"
- Sağ üst: Edit ve Delete butonları
- Yeşil arka planlı kutu:
  - "Toplam Maliyet (Ek Gider %15):"
  - "₺X,XXX/ay"
  - Eğer dövizli: "X EUR × 35.50 = ₺XXX + %15"

En altta: "➕ Yeni Maaş Ekle" butonu

**MAAŞ EKLEME/DÜZENLEME FORMU:**
Inputlar:
1. "Personel Adı:" [text] (placeholder: "Örn: Ahmet Yılmaz")
2. "Maaş:" [number]
3. "Para Birimi:" [dropdown: TRY/EUR/USD/GBP]
4. "Ek Gider Oranı (%):" [number] (min: 0, max: 100)
   - Bu SGK, sigorta, vs. gibi ek maliyetler için
5. "Periyot:" [4 buton grid]
   - Günlük / Haftalık
   - Aylık / Yıllık
   - Seçili olan: yeşil arka plan `#a8e6cf`

Preview kutusu (yeşil arka plan):
- "📊 Toplam Maliyet:"
- "Maaş: ₺X,XXX"
- "Ek Gider (%15): ₺XXX"
- Çizgi
- Büyük: "₺X,XXX/ay"
- Eğer dövizli: "(X EUR × 35.50 = ₺XXX / Ay)"

Butonlar:
- "💾 Kaydet" (yeşil)
- "❌ İptal" (gri)

---

### 5. MEKAN KİRALARI SAYFASI

**ÖNEMLİ:** Bu sayfa READ-ONLY! Veriler `/src/app/components/locations-page.tsx` dosyasındaki mekan listesinden otomatik olarak gelir.

**BAŞLIK:**
- "📍 Mekan Kiraları"
- Alt: "Toplam Aylık: ₺X,XXX"

**TOPLAM ÖZET KARTI:**
- Mor gradient arka plan: `from-[#d4b5f7]/20 to-[#c49fef]/10 border border-[#d4b5f7]/30`
- İki kolon:
  - Sol: 
    - "Toplam Yıllık Kira" (küçük gri)
    - "₺XX,XXX" (3xl, beyaz, bold)
  - Sağ:
    - "Aylık Maliyet" (küçük gri)
    - "₺X,XXX" (2xl, mor `#d4b5f7`, bold)

**MEKAN LİSTESİ:**
- Başlık: "📍 MEKANLAR"
- Eğer liste boşsa:
  - Mesaj: "Henüz mekan eklenmemiş"
  - Alt mesaj: "Mekanlar, Mekan Yönetimi'nden otomatik olarak alınır"

- Eğer liste doluysa:
  Her mekan kartı:
  - Border rengi: mekanın color değeri (40% opacity)
  - Sol üst:
    - Mekan emoji'si (12x12 rounded box, gradient arka plan mekanın rengi)
    - Mekan adı (bold, büyük)
    - Alt: "Yıllık Kira: ₺X,XXX"
  - Alt kısım (2 kolon grid):
    - Sol kutu: "Aylık Kira" → "₺X,XXX"
    - Sağ kutu: "Günlük Kira" → "₺XXX"

**NOT KUTUSU (en alta):**
- Mavi arka plan: `bg-[#9dd9ea]/10 border border-[#9dd9ea]/30`
- İçerik:
  "💡 Not: Mekanlar ve kiraları, Mekan Yönetimi sayfasından otomatik olarak yüklenir. 
  Yeni mekan eklemek veya kira tutarlarını değiştirmek için Mekan Yönetimi'ne gidin."

---

## HESAPLAMA MANTIĞI

### Kur Çevirme:
convertToTRY(amount, currency) { if (currency === 'TRY') return amount; return amount * exchangeRates[currency]; }


### Periyot Çevirme (Aylığa):
convertToMonthly(amount, frequency) { switch (frequency) { case 'daily': return amount * 30; case 'weekly': return amount * 4; case 'monthly': return amount; case 'yearly': return amount / 12; } }


### Toplam Aylık Maliyet:
toplam = 0;

// Düzenli Giderler recurringCosts.forEach(cost => { amountTRY = convertToTRY(cost.amount, cost.currency); toplam += convertToMonthly(amountTRY, cost.frequency); });

// Personel Maaşları salaries.forEach(salary => { salaryTRY = convertToTRY(salary.amount, salary.currency); extraCost = salaryTRY * (salary.extraCostPercentage / 100); totalSalary = salaryTRY + extraCost; toplam += convertToMonthly(totalSalary, salary.frequency); });

// Mekan Kiraları (yıllık -> aylık) locationRents.forEach(location => { toplam += location.yearlyRent / 12; });

return toplam;


### Mekan Kiraları için:
monthlyRent = yearlyRent / 12; dailyRent = monthlyRent / 30;


---

## DATA YÖNETİMİ

### LocalStorage Keys:
- `aspect_exchange_rates` → Kur bilgileri
- `aspect_album_costs` → Albüm fiyatları
- `aspect_paper_costs` → Kağıt listesi
- `aspect_recurring_costs` → Düzenli giderler
- `aspect_salaries` → Personel maaşları
- `aspect_location_rents` → Mekan kiraları (locations-page'den sync)

### Default Değerler:

**Kurlar (Manuel mod):**
EUR: 35.50 USD: 32.80 GBP: 41.20


**Albümler:**
3'lü: 25 TRY 5'li: 35 TRY 7'li: 45 TRY 9'lu: 55 TRY 11'li: 65 TRY 15'li: 85 TRY


**Mekanlar (locations-page'den):**
{id: 'location:1', name: 'ZOKA Restaurant', emoji: '🏖️', color: '#9dd9ea', yearlyRent: 15000} {id: 'location:2', name: 'Balık Hali', emoji: '🐟', color: '#a8e6cf', yearlyRent: 12000} {id: 'location:3', name: 'Tekne Turu', emoji: '⛵', color: '#ffd4a3', yearlyRent: 8000} {id: 'location:4', name: 'Beach Club Alaçatı', emoji: '🏖️', color: '#d4b5f7', yearlyRent: 20000}


---

## ÖZEL NOTLAR

1. **Döviz gösterimlerinde:**
   - MUTLAKA "tutar × kur = sonuç" formatı kullan
   - Örnek: "75 EUR × 35.50 = ₺2,660.00"
   - Bu kullanıcının hesaplamayı görmesini sağlar

2. **Number formatları:**
   - Türkçe format: `toLocaleString('tr-TR', { maximumFractionDigits: 0 })`
   - ₺ sembolü her yerde TL tutarlarında kullanılsın

3. **Glassmorphism efektler:**
   - Her kart: `backdrop-blur-xl`
   - Border: `border-white/20`
   - Arka plan: `from-white/10 to-white/5`

4. **Butonlar:**
   - Active state: `active:scale-95`
   - Hover: `hover:shadow-lg`
   - Transition: `transition-all`

5. **Mekan Kiraları senkronizasyonu:**
   - locations-page.tsx'den veri al
   - Kullanıcı location-management'dan mekan eklerse/değiştirirse
   - cost-management otomatik güncellenmeli (localStorage üzerinden)

6. **Form validasyonları:**
   - Boş alan kontrolü
   - Silme onayı: `confirm()` kullan
   - Başarılı kayıt: alert veya toast

---

## ÖRNEKLENMİŞ SENARYOLAR

**Senaryo 1:** Kullanıcı 75 EUR'luk kağıt ekliyor, kutu içi 500 adet
- Kur: 35.50 TL
- Birim maliyet gösterimi: "0.15 EUR/adet"
- Altında: "(0.15 EUR × 35.50 = 5.32 TL/adet)"
- Kutu toplam: "₺2,660.00"
- Altında: "(75 EUR × 35.50 = ₺2,660.00)"

**Senaryo 2:** Personel 2000 EUR maaş alıyor, aylık, %15 ek gider
- Kur: 35.50 TL
- Maaş TL: 2000 × 35.50 = 71,000 TL
- Ek gider: 71,000 × 0.15 = 10,650 TL
- Toplam aylık: 81,650 TL
- Gösterim: "₺81,650/ay"
- Altında: "(2000 EUR × 35.50 = ₺71,000 + %15)"

**Senaryo 3:** Mekan ZOKA, yıllık kira 15,000 TL
- Aylık: 15,000 / 12 = 1,250 TL
- Günlük: 1,250 / 30 = 42 TL
- Kartlarda göster: "Aylık: ₺1,250" ve "Günlük: ₺42"

---

Tüm bu detayları eksiksiz şekilde uygula. Dosya adı: `/src/app/components/cost-management.tsx`