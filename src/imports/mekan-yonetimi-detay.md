🔥 DETAYLI VERSİYON (Tam Özellikler):
## Proje: Mekan Yönetimi Sistemi

### GENEL TANIM:
Turistik fotoğrafçılık işletmeleri için mekan (lokasyon) yönetim paneli. 
Her mekan için finansal hesaplamalar, fiyatlandırma ve görsel özelleştirme yapılabilir.

---

### 1️⃣ MEKAN EKLE/DÜZENLE FORMU

**Açıklama:** Modal/dropdown formda yeni mekan ekle veya mevcut mekanı düzenle

**Form Alanları:**

1. **Mekan Adı:**
   - Text input
   - Placeholder: "örn: ZOKA Beach Club"

2. **💰 1 Fotoğraf Fiyatı (₺):**
   - Number input
   - Placeholder: "200"
   - Alt açıklama: "Albüm ve paspartu fiyatları bu değere göre hesaplanır"
   - ⚠️ ÖNEMLİ: Bu alan değişince aşağıdaki önizleme CANLI güncellenecek

3. **Emoji Seçici:**
   - 8x2 grid layout (16 emoji)
   - Emoji listesi: 🏖️ ☕ 🐟 ⛵ 🏪 🍽️ 🏨 🎪 🎭 🎨 🏝️ 🌊 🌅 🎵 🍹 📍
   - Seçili emoji: Pembe border + scale büyüme efekti
   - Label: "Emoji ve renk seç"

4. **Renk Seçici:**
   - 8x1 grid layout (8 renk)
   - Renk paleti:
     * #9dd9ea (Mavi)
     * #ffd4a3 (Turuncu)
     * #a8e6cf (Yeşil)
     * #d4b5f7 (Mor)
     * #ffb3d9 (Pembe)
     * #ffe5b4 (Sarı)
     * #b8d4f1 (Açık Mavi)
     * #ffc0cb (Pastel Pembe)
   - Seçili renk: Beyaz kalın border + scale efekti

5. **Yıllık Kira (TL):**
   - Number input
   - Placeholder: "örn: 15000"

6. **Günlük Maliyet Tahmini (%):**
   - Number input
   - Placeholder: "35"
   - Alt açıklama: "Kira + ek maliyetler (personel, elektrik vb.)"

7. **Yıllık Kar Beklentisi (%):**
   - Number input
   - Placeholder: "20"
   - Alt açıklama: "Hedef kar marjı"

**📊 CANLI HESAPLAMA ÖNİZLEMELERİ:**

A) **💰 Fiyat Önizlemesi** (Pembe gradient kutu):
   - Başlık: "💰 Fiyat Önizlemesi"
   - 2 sütun grid:
     * 3'lü Albüm: ₺(fotoPrice × 3)
     * 5'li Albüm: ₺(fotoPrice × 5)
     * 7'li Albüm: ₺(fotoPrice × 7)
     * 9'lu Albüm: ₺(fotoPrice × 9)
     * 11'li Albüm: ₺(fotoPrice × 11)
     * 15'li Albüm: ₺(fotoPrice × 15)
   - Border altında:
     * 1 Paspartu: ₺(fotoPrice) [Yeşil renk]
   - Gösterim şartı: photoPriceInput > 0

B) **📊 Hesaplama Özeti** (Mavi-yeşil gradient kutu):
   - Başlık: "📊 Hesaplama Özeti"
   - Satırlar:
     1. Günlük Kira: ₺(yearlyRent / 365)
     2. Minimum Günlük Ciro: ₺((yearlyRent/365) × (1 + dailyCost%/100)) [Turuncu]
     3. Günlük Kar Hedefi: ₺(minimumCiro × (profit%/100)) [Yeşil]
     4. Yıllık Kar Beklentisi: ₺(yearlyRent × (profit%/100)) [Pembe] [Border üstünde]
   - Gösterim şartı: yearlyRentInput > 0

**Butonlar:**
- [Ekle] veya [Güncelle] butonu (pembe gradient)
- [İptal] butonu (şeffaf beyaz border)

---

### 2️⃣ MEKAN LİSTESİ

**Her mekan kartı şunları içerir:**

[EMOJİ] MEKAN ADI Yıllık: ₺15,000 | Kar: %20 Günlük Hedef: ₺164 | Fotoğraf: ₺200 [✏️ Düzenle] [🗑️ Sil]


**Detaylar:**
- Sol: Emoji kutusu (seçili renkte, 48x48px, rounded-xl)
- Orta: 
  * Mekan adı (bold, beyaz)
  * İlk satır: Yıllık kira + Kar %
  * İkinci satır: Günlük hedef (mavi) + Fotoğraf fiyatı (pembe)
- Sağ: Düzenle (mavi) ve Sil (kırmızı) butonları
- Sadece admin görür edit/delete butonlarını

**Günlük Hedef Hesaplama:**
dailyRent = yearlyRent / 365 dailyCost = dailyRent × (1 + dailyCostPercentage / 100) dailyExpectation = dailyCost × (1 + profitPercentage / 100)


---

### 3️⃣ FOTOĞRAF FİYATI YÖNETİMİ (Ayrı Bölüm)

**Başlık:** 💰 1 Fotoğraf Fiyatı Ayarları

**Açıklama:** "Her mekan için birim fotoğraf fiyatını buradan belirleyin"

**Her mekan için kart:**
[EMOJİ] MEKAN ADI [200] ₺ [Kaydet] Mevcut: ₺200

3'lü: ₺600 | 5'li: ₺1,000 | 7'li: ₺1,400 9'lu: ₺1,800 | 11'li: ₺2,200 | Paspartu: ₺200


**Özellikler:**
- Sol: Emoji + mekan adı + mevcut fiyat
- Sağ: Number input + ₺ sembolü + Kaydet butonu (yeşil)
- Alt kısım: 3 sütun grid ile albüm fiyat önizlemesi
- Sadece admin görür bu bölümü

---

### 🎨 TASARIM ÖZELLİKLERİ:

**Arka Plan:**
```css
background: linear-gradient(to-b, #2a2a3a, #3a3a4e, #2f3439)
Kartlar:

backdrop-blur-xl
background: linear-gradient(to-br, white/10, white/5)
border: 2px solid white/20
border-radius: 24px
padding: 20px
Glassmorphism:

Tüm kartlar backdrop-blur-xl
Hover: border-color değişimi
Active: scale-95 efekti
Renkler:

Pembe vurgular: #ffb3d9
Mavi vurgular: #9dd9ea
Yeşil vurgular: #a8e6cf
Turuncu vurgular: #ffd4a3
Kırmızı: #ff6b6b
💾 DATA YAPISI:
interface Location {
  id: string;
  name: string;
  emoji: string; // 🏖️
  color: string; // #9dd9ea
  yearlyRent: number; // 15000
  dailyCostPercentage: number; // 35
  profitPercentage: number; // 20
  photoPrice: number; // 200
}
⚙️ FONKSİYONLAR:
1. Günlük Beklenti Hesaplama:

const calculateDailyExpectation = (yearlyRent, dailyCostPercentage, profitPercentage) => {
  const dailyRent = yearlyRent / 365;
  const dailyCost = dailyRent * (1 + dailyCostPercentage / 100);
  return dailyCost * (1 + profitPercentage / 100);
};
2. Albüm Fiyatı:

const albumPrice = (photoPrice, count) => photoPrice * count;
// 3'lü = photoPrice × 3
// Paspartu = photoPrice × 1
🎯 ÖZEL İSTEKLER:
✅ Form açıkken scroll edilebilir olsun (max-height: 600px)
✅ Input değişince önizleme ANINDA güncellensin (onChange)
✅ Fiyatlar Türk Lirası formatında: ₺15.000 (binlik ayırıcı nokta)
✅ Emoji ve renk seçiminde hover + active efektleri
✅ Admin kontrolü: Admin değilse edit/delete/fiyat yönetimi gizli
✅ Responsive: Mobile-first tasarım
✅ Smooth transitions (0.2s ease)
📱 LAYOUT:
[Başlık: Mekan Yönetimi 📍]

[Mekanlar Kartı]
  [+ Yeni Mekan] butonu (sadece admin)
  
  [Mekan Ekle Formu] (açıksa)
  
  [Mekan Listesi]
    - Mekan 1
    - Mekan 2
    - Mekan 3

[💰 Fotoğraf Fiyatı Ayarları] (sadece admin)
  - Mekan 1 fiyat inputu
  - Mekan 2 fiyat inputu
  - Mekan 3 fiyat inputu
🚀 ÖNCELİK SIRASI:
Mekan ekleme formu + önizlemeler
Mekan listesi + kartlar
Fiyat yönetimi bölümü
Glassmorphism efektleri
Responsive düzenlemeler

---

### 🔥 ÇOK HIZLI TEK SATIRLIK:

Mekan yönetimi: Emoji+renk seçici, 1 fotoğraf fiyatı inputu (albüm fiyatları otomatik hesaplansın: 3'lü=fiyat×3), yıllık kira+maliyet%+kar% ile günlük hedef hesaplama önizlemesi, mekan listesi kartları, inline fiyat düzenleme bölümü, glassmorphism tasarım


---

### 💡 PROMPT YAZARKEN DİKKAT ET:

✅ **MUTLAKA BELİRT:**
- "1 fotoğraf fiyatı inputu VAR, albümler otomatik hesaplansın"
- "Önizlemeler CANLI güncellensin (onChange)"
- "Günlük hedef FORMÜL: (yıllıkKira/365) × (1+maliyet%) × (1+kar%)"
- "Emoji 16 tane, renk 8 tane"
- "Fiyatlar Türk Lirası formatında binlik ayraçlı"

✅ **EKSTRA GÜÇLÜ YAPAN:**
- Exact renk kodlarını ver (#9dd9ea gibi)
- Hesaplama formüllerini JavaScript ile yaz
- "Glassmorphism", "backdrop-blur-xl" terimlerini kullan
- Interface/type tanımını ver

❌ **ASLA YAPMA:**
- "Güzel bir mekan sayfası yap" (belirsiz)
- Hesaplamaları açıklama (AI yanlış hesaplar)
- "Modern tasarım" (herkes farklı anlar)
🎁 BONUS: KOPYALA-YAPIŞTIR PROMPT
Mekan yönetimi sayfası oluştur:

1. MEKAN FORMU (Yeni Ekle / Düzenle):
   - Mekan adı input
   - Emoji seçici: 16 emoji grid (🏖️ ☕ 🐟 ⛵ 🏪 🍽️ 🏨 🎪 🎭 🎨 🏝️ 🌊 🌅 🎵 🍹 📍)
   - Renk seçici: 8 renk (#9dd9ea #ffd4a3 #a8e6cf #d4b5f7 #ffb3d9