# Aspect App — Sistem Referansi

Bu dosya projenin nasil calistigini aciklar. Her sayfa duzenlenmeden once buraya bakilmalidir.
Yeni bolumler ilgili sayfa duzenlenirken eklenir.

---

## Genel Mimari

- **Frontend:** Next.js 16 + React + TypeScript + Tailwind CSS + motion/react (framer-motion)
- **Backend:** Supabase Edge Functions (Hono framework) + KV (Key-Value) storage
- **API Base:** `https://{projectId}.supabase.co/functions/v1/make-server-4da0b637`
- **Auth:** Supabase Auth + JWT token (X-Access-Token header)
- **Roller:** yonetici, ust-mudur, mudur, personel, bekleyen

---

## Mekan Yonetimi

Mekanlar is yerlerini temsil eder (fotograf cekimi yapilan lokasyonlar).

**KV:** `mekan_{id}`

| Alan | Aciklama |
|---|---|
| `name` | Mekan adi |
| `emoji` | Mekan emojisi |
| `color` | Renk kodu |
| `printType` | `"tam"` veya `"yarim"` — baski boyutu |
| `kotaKademeleri[]` | Hakedis kota kademeleri (hedef, primTek, primCoklu, bantlar) |
| `yearlyRent` veya `yearlyRents[yil]` | Yillik kira (gunluk kira = yillik/365) |

**printType onemi:** Yarim boyda 1 fiziksel baski = 2 kare, tam boyda = 1 kare.

---

## Malzeme (Ekipman) Yonetimi

Yazicilar, kameralar, flashlar vb. ekipman kayitlari.

**Frontend:** `equipment-page.tsx`
**KV:** `ekipman_{id}`

### Yazici Kaydi
| Alan | Aciklama |
|---|---|
| `category` | `'printer'` |
| `brand`, `model` | Marka ve model (orn: Citizen Cx02) |
| `serialNumber` | Seri numarasi |
| `locationId` | Atandigi mekanin ID'si |
| `locationType` | `'mekan'`, `'depo'`, `'diger'` |
| `kagitTipiId` | Bagli kagit tipi ID'si (cost_paper_*) |
| `ribonMevcut` | Son kapanistaki sayac degeri (sonraki acilista oneri olarak gosterilir) |
| `status` | `'working'`, `'broken'`, `'maintenance'` |

### Mekana Yazici Atama Akisi
1. Malzeme yonetiminde yazici olusturulur
2. `locationId` ile mekana atanir
3. `kagitTipiId` ile kagit tipi baglnir
4. Bir mekana birden fazla yazici atanabilir
5. Her yazicinin farkli kagit tipi olabilir

---

## Maliyet Yonetimi

**Frontend:** `cost-management.tsx`

### Kagit Tipi
**KV:** `cost_paper_{id}`

| Alan | Aciklama |
|---|---|
| `name` | Kagit adi (orn: Mitsubishi CP-9800) |
| `boxPrice` | Kutu fiyati |
| `currency` | Para birimi (TRY, EUR, USD, GBP) |
| `pcsPerBox` | Kutu icindeki toplam baski adedi |
| `setsPerBox` | Kutu icindeki takim (ribon) sayisi |

**Hesaplamalar:**
- Takim basina kapasite: `pcsPerBox / setsPerBox`
- Birim fiyat (baski basi): `boxPrice / pcsPerBox`
- Doviz ise TL'ye cevrilir: `birimFiyat × kurCarpani`

### Album Fiyatlari
**KV:** `cost_albums`

Boyut bazli (3, 5, 7, 9, 11, 13, 15) tam boy ve yarim boy fiyatlari.
Para birimi ve doviz kuru destegi var.

**Vardiya raporunda album maliyet hesabi:**
1. Satislardan urun adlarini topla (iptal haric)
2. "paspartu", "1 fotograf", "1 " ile baslayan urunler album degil — atlanir
3. Urun adindan boyut cikarilir: "7 Fotograf" → 7 (`sizeFromName`)
4. `cost_albums` tablosundan o boyutun fiyati bulunur
5. Mekan `printType=tam` ise `tamBoy` fiyati, `yarim` ise `yarimBoy` fiyati secilir
6. Doviz ise TL'ye cevrilir
7. `albumMaliyeti = sum(adet × birimFiyat)`

### Doviz Kurlari
**KV:** `cost_exchange_rates`

```
{ EUR: 38, USD: 33, GBP: 41.20 }
```

---

## Operasyon — Acilis/Kapanis Akisi

**Frontend:** `quick-sales.tsx` (acilis + kapanis + satis — hepsi tek dosyada)
**Backend:** `POST /stok/acilis`, `POST /stok/kapanis`
**KV:** `stok_gunluk_{mekanId}_{tarih}`

### Acilis
1. Backend, mekana atanmis yazicilari otomatik listeliyor (`mekanYazicilari`):
   - `ekipman_*` KV'den `category=printer && locationId=mekanId && status!=broken`
   - Her yazici: ekipmanId, brand, model, serialNumber, kagitTipiId, ribonMevcut
2. Frontend her yazici icin ayri `startCounter` input gosteriyor
3. Onceki gunun kapanisindaki `ribonMevcut` degeri oneri olarak gosteriliyor
4. Acilis verileri `acilisYazicilar[]` olarak kaydediliyor
5. Sayac uyusmazligi varsa `acilisYaziciAnomali` olusturuluyor

### Kapanis
Her yazici icin personel giriyor:
- `endCounter` — kapanis sayaci
- `ribonDegisim` — degistirilen ribon takim sayisi
- `iadeFotograf` — iade edilen fotograf sayisi

Backend kapanista her yazici icin (`enrichedPrinterData`):
```
kapasitePerTakim = pcsPerBox / setsPerBox
kullanilanBaski = acilisSayac + (ribonDegisim × kapasitePerTakim) - kapanisSayac
cikisAdedi = kullanilanBaski × carpan     (yarim=2, tam=1)
satilanFotograf = cikisAdedi - iadeFotograf
birimMaliyet = (boxPrice / pcsPerBox) × kurCarpani
toplamMaliyet = kullanilanBaski × birimMaliyet
```

**Coklu yazici:** Her yazici kendi `kagitTipiId`'sinden kagit fiyatini bulur.
Iki farkli kagit tipi kullanan iki yazici farkli birim fiyatlarla hesaplanir.

### Vardiya Toplamlari
```
vardiyaToplam.toplamMaliyet = sum(her yazicinin toplamMaliyet'i)
vardiyaToplam.paperName = "Kagit A, Kagit B" (virgul ile)
```

### Anomali Tespiti
- **Stok anomalisi:** acilis sayimi vs onceki gun kapanis farki (album3-15, paspartu, ribon tip bazli)
  - Ribon anomali key'leri: `ribonlar.{kagitTipiId}` — raporda kagit tipi adina cevrilir (orn: "Ribon (Citizen): +2")
- **Yazici sayac anomalisi:** girilen acilis vs beklenen (ribonMevcut) farki
- **Kapanis yazici anomalisi:** net satilan fotograf vs satis kayitlari farki (±2 tolerans)

---

## Vardiya Raporlari

**Frontend:** `src/app/components/vardiya-raporlari/` (13 dosya)
**Detay:** `vardiya-raporlari/STRUCTURE.md`

### 3 Sekme
1. **Vardiya Bazli** — tek tek vardiya kartlari + detay sayfasi
2. **Gun Bazli** — gunluk ozet + mekan kirilimi
3. **Ay Bazli** — aylik ozet + mekan kirilimi

### API Endpointleri
| Endpoint | Metod | Aciklama |
|---|---|---|
| `/vardiya/raporlar?baslangic=&bitis=&mekanId=` | GET | Kapanmis vardiya listesi |
| `/vardiya/sil` | DELETE | Vardiya silme |
| `/vardiya/gun-raporu?baslangic=&bitis=` | GET | Gun listesi |
| `/vardiya/gun-raporu?tarih=` | GET | Tek gun detayi |
| `/vardiya/ay-raporu?yil=` | GET | Ay bazli rapor |

### Backend Veri Kaynaklari (vardiya/raporlar)
8 paralel KV sorgusu:

| KV | Ne icin |
|---|---|
| `stok_gunluk_*` | Ana veri: satislar, kare, yazici, anomali |
| `getMekanlarFor()` | Mekan bilgileri, printType, kota, kira |
| `cost_albums` | Album maliyet tablosu |
| `cost_exchange_rates` | Doviz kurlari |
| `cost_salary_*` | Personel maaslari |
| `rotation_task_*` | Rotasyon gorev atamalari |
| `hakedis_dahil` | Hakedise dahil personel listesi |
| `checkin_*` | Giris kayitlari (gec giris) |

### Kar/Zarar Hesabi
```
toplamMaliyet = albumMaliyeti + baskiMaliyeti + hakedisGideri + personelMaas + mekanKirasi
karZarar = toplamCiro - toplamMaliyet
```

**Not:** OzetKart'ta hakediş dahil degil, VardiyaDetay'da dahil.

### Vardiya Notlari
- `acilisNot` ve `kapanisNot` backend response'a dahil (stok_gunluk kaydından)
- Not varsa Ciro bolumunun altinda gosterilir, yoksa bolum gizli
- PDF export'ta da dahil

### Disa Aktarim (Export)
- **PDF:** jsPDF + jspdf-autotable. Turkce karakter destegi yok (helvetica), `tr()` ile ASCII'ye cevrilir
  - Baslik bandi: mekan adi, tarih (buyuk), saat, baski tipi, toplam ciro, brut kar
  - Ciro & Maliyet yan yana iki tablo
  - Album tek satir ozet
  - Personel tablosu: ad, kare, nakit, iban, kredi, toplam, iskonto, maas, hakedis, kazanc
  - Yazici tablosu: ad, seri no, kagit tipi, sayaclar, baski, cikis, ribon, maliyet
  - Hakedis ozeti: kota kademeleri + durum
  - Anomaliler ve vardiya notlari (varsa)
- **Excel:** xlsx kutuphanesi, 4 sayfa (Ozet, Personel, Yazicilar, Album)
- **Yazdir:** window.print()

### Ay Bazli Rapor Detaylari
- **Backend:** `GET /vardiya/ay-raporu?yil=` — 13 paralel KV sorgusu (+ rotation_leave_ izinler)
- **Hakedis:** Otomatik hesaplaniyor (vardiya/gun bazliyla ayni mantik — kota + rotasyon + kidem carpani). isletme_gider_ yerine otomatik hesaplanan kullaniliyor — odenip odenmemesi farketmez, hesaplandigi anda gidere dahil.
- **Ek gelir:** isletme_gelir_'den okuyor, ciroya ekleniyor (diger raporlarda yok)
- **Ekipman detayi:** ekipman_'dan yazici marka/model/seri no (diger raporlarda printerData'dan)
- **Maliyet kirilimi:** albumMaliyet, kiraMaliyeti, maasGideri, hakedisGideri mekan bazli ayri alanlar
- **Mekan detay:** acilir panel — urun dagilimi (bar grafik), baski detayi (yazicilar), gider kirilimi, personeller, vardiya sayisi, gec giris badge
- **Personel listesi:** ciro, kare, satis, vardiya sayisi, hakedis, izin gunu, gec giris, anomali sayisi. Yonetici rolu filtreleniyor (listUsers ile).
- **Anomali detay:** mekan + tarih + tip + aciklama + puan alan personeller (acilis → onceki gun, kapanis → ayni gun)
- **Satilan dagilimi:** tum urunler bar grafik (paspartu/1 Fotograf dahil), boyut sirasina gore

### Gun Bazli Rapor Detaylari
- **Backend:** `GET /vardiya/gun-raporu` — 10 paralel KV sorgusu (vardiya bazlinin 8'i + kidem_personel + kidem_carpanlari + isletme_gider)
- **Iki mod:** cok-gun (liste) ve tek-gun (detay)
- **Cok-gun listesi:** her gun icin ciro, kar/zarar, odeme dagilimi, mekan detay, anomali/gec giris sayisi
- **Tek-gun detayi:** ozet, maliyet, mekanlar, personeller, albumler, odemeler, anomaliler
- **Anomaliler:** mekan bazli, aciklama string olarak (kagit tipi adi cevrilmis, okunabilir)
- **Baski ozeti:** mekanlardan toplanan basilan/satilan/iade + kullanilanBaski + paperName + printType
- **PDF export:** vardiya bazliyla ayni stilde — baslik bandi, ciro&maliyet yan yana, baski ozeti (mekan bazli), album, mekan siralamasi, personel detayi, footer

### Personel Verileri
- Satis kayitlarindan: ciro, odeme yontemi, urun dokumu
- Kare kayitlarindan: fotografci bazli kare sayisi
- Maas: aylik / ayin gun sayisi / mekan sayisi
- Katki: ciroYuzde × 0.60 + kareYuzde × 0.40
- Kazanc: gunlukMaas + hakedis
- Iskonto: urun birimFiyat×adet toplami - gercek tahsilat (finalPrice)

**Odeme yontemi ayristirma (backend string matching):**
- `paymentMethod` icinde "iban/havale/transfer" → IBAN
- `paymentMethod` icinde "kredi/kart/card" → Kredi
- Geri kalan her sey → Nakit

---

## Hakedis Sistemi

**UI'da "Hakedis", backend key/route'larda "prim" olarak gecer.**

### Veri Kaynaklari
- `mekan.kotaKademeleri[]` — kota hedefleri ve bant tutarlari (mekan bazli)
- `rotation_task_*` — o gun o mekana atanan personel + gorev tipleri
- `hakedis_dahil` — hakedise dahil personel ID listesi (KV key)

### Backend Hesaplama (vardiya/raporlar icinde `primBilgi`)
1. Rotasyon gorevlerinden o tarih + o mekan icin personel bul
   - `rotation_task` status: "sent" veya "revised" olmali
   - `task.location === mekan.name` eslesme mekan adina gore
2. Sadece `hakedis_dahil` listesindeki personeller sayilir
3. Her personelin gorevi: fotograf-satis, baski, album, gozlemci
4. `toplamCiro >= kademe.hedef` kontrolu ile gecilen kademeler bulunur
5. Gecilen her kademe icin, gorev tipine gore bant tutari hesaplanir:
   - Solo (tek kisi, gorevsiz) → `primTek`
   - Coklu → gorev bantlarindan: `fotografBantlar`, `baskiBantlar`, `albumBantlar`, `gozlemciBantlar`
   - Bant: kisi sayisi min-max araligina duserse → tutar
6. Kidem carpani uygulanir: kidemsiz(1.0), kidemli(1.15), kidemliPlus(1.30)
   - KV: `kidem_personel_{userId}` → kidem seviyesi
   - KV: `kidem_carpanlari` → carpan degerleri
   - Hem vardiya bazli hem gun bazli raporda uygulanir (tutarli)
7. `toplamPrim = sum(her gecilen kademe × her personelin bant tutari × kidem carpani)`
8. Rotasyon bulunamazsa fallback: kare kayitlarindan fotografci sayisi + primTek/primCoklu (kidem uygulanamaz — kisi ID'si yok)

### primBilgi Response Yapisi
```
primBilgi: {
  kademeIndex: number    — en ust gecilen kademe index'i
  kademeHedef: number    — en ust gecilen kademe hedefi
  topKademePrim: number  — kisi basi ortalama (UI gosterim)
  toplamPrim: number     — toplam hakedis tutari
  toplamKademe: number   — gecilen kademe sayisi
  personelSayisi: number — hakedise dahil personel sayisi
  coklu: boolean         — birden fazla kisi mi
} | null                 — hic kademe gecilmediyse null
```

### Frontend Gosterim (vardiya-detay.tsx)
- `primBilgi` null ise: soluk gorunum + "1. Hakedis kotasina ₺X eksik kaldi"
- `primBilgi` varsa: mor/parlak gorunum + personel listesi (kisi basi tutar) + kota durumlari (✓/○) + toplam hakedis
- `kotaKademeleri` mekan ayarindan, `primBilgi` backend hesaplamasindan gelir
- `hakedisDahil === false` olan personelin hakedisi 0 gosterilir

---

## Personel Maas Hesabi

**KV:** `cost_salary_{id}`

```
aylikMaas = tutar × (1 + ekMaliyetYuzdesi/100)
frequency'ye gore ayliga cevir: gunluk×30, haftalik×4.33, yillik/12
gunlukMaas = aylikMaas / ayinGunSayisi
mekanBasi = gunlukMaas / oGunCalistigiMekanSayisi
```

---

## Kasa Sistemi

**Frontend:** `src/app/components/kasa.tsx`
**Backend:** Tum endpoint'ler `index.ts` icinde `/kasa/...` prefix'li

### Genel Mantik
Kasa = "cepte ne var" + "neyi odedik, neyi odemedik". IGD'deki giderler kasada bekleyen odeme olarak gorunur. Odeme yapilinca kasadan duser.

### KV Yapisi
| Key | Icerik |
|-----|--------|
| `kasa_devir_{mekanId}_{tarih}` | Ciro devir kaydi (nakit/kart/iban dagilimi) |
| `kasa_odeme_{giderId}` | Odeme durumu: odendi, odemeler[], silinenTutar |
| `kasa_ay_kapatis_{ay}` | Ay kapatis: bakiye, odenmemisler, devretsiz |
| `kasa_acilis_{ay}` | Acilis bakiyesi (IGD'ye yazmaz) |
| `kasa_acilis_borc_{id}` | Acilis borcu (IGD'ye yazmaz, carilerde gorunur) |
| `kasa_sirket_settings` | Gorunurluk: visibleUstMudur, visibleIdari |

### Bakiye Hesabi
```
Bakiye = DevirBakiye + AcilisBakiye + DevirCirolar - OdenenGiderler
```

### Ciro Devir Akisi
1. Vardiya kapanir → "Bekleyen Devirler" listesine duser
2. Yonetici "Devret" butonuna basar → ciro kasaya girer
3. Tarihe gore gruplanmis, "Tumunu Devret" butonu

### Bekleyen Odemeler
- IGD'deki otomatik maas + mekan kiralari + manuel giderler
- Her gider icin `kasa_odeme_` kontrol → odenmemis ise "bekleyen"
- Ode / Kismi Ode / Kismi Sil / Komple Sil butonlari
- Kismi Sil → IGD'ye negatif duzeltme kaydi (o ayin tarihine)

### Ay Kapatma
- "Kasayi Kapat & Devret" → bakiye sonraki aya devredilir
- "Devretmeden Kapat" → bakiye 0 olarak devredilir
- Kapanan ay: read-only, duzenleme yapilamaz
- Odenmemis giderler kapatis kaydina yazilir → sonraki ayda "Onceki Aydan Kalan" olarak gorunur

### Cariler Tabi
- Kisi/firma bazli borc takibi: Personel / Tedarikciler / Kira / Diger Giderler
- Her cari: toplam borc, odenen, kalan, progress bar
- Tiklayinca detay: ay bazli hareketler (acilir/kapanir)
- Tamamini Ode / Kismi Ode / Kismi Sil butonlari
- Odeme geri alma (sil butonu)
- En altta: Toplam Odenen (tum zamanlar)

### Hakedis-Kasa Senkronu
- Hakedis Takip sayfasi yuklenince → bekleyen hakedisler IGD'ye gider olarak yazilir (`prim_bekleyen`)
- Hakedis Takip'ten ode → kasada da odendi (`kasa_odeme_`)
- Kasadan ode → hakedis takipte de odendi (`prim_odendi_`)
- Iptal → her ikisinden de silinir

### Kur Farki
- IGD'de doviz gider girilince kasada TRY'ye cevrilir (`cost_exchange_rates`)
- Borc kapandiginda toplam odenen vs borc tutari karsilastirilir
- Fark >= 1 TL ise: fazla → kur farki gideri, az → kur farki geliri (IGD'ye otomatik)

### Gorunurluk
- Ust Mudur (UM) ve Idari (ID) icin ayri toggle
- Goz kapaliysa o rol kasaya erisemez (backend 403)

### Para Giris/Cikis
- Para Girisi → IGD'ye gelir + kasaya giris
- Para Cikisi → IGD'ye gider + odendi secenegi
- Acilis Bakiye → IGD'ye yazmaz, sadece kasa bakiyesine eklenir
- Acilis Borcu → IGD'ye yazmaz, carilerde gorunur

### Cari Hesap (Maliyet Yonetimi)
- `cost_cari_{id}` → tedarikci/firma tanimi
- IGD gider formunda kategori olarak secilir
- Kasada cariler tabinda ayri baslik altinda gorunur

---

## Akademi Sistemi

**Frontend:** `src/app/components/aspect-academy.tsx`

### KV Yapisi
| Key | Icerik |
|-----|--------|
| `academy_categories` | Sirket kategorileri |
| `academy_content_{id}` | Sirket icerigi |
| `academy_progress_{userId}` | Kullanici ilerlemesi |
| `academy_announcement` | Yonetici duyuru mesaji |
| `academy_hidden` | Gizlenen global icerik ID'leri |
| `academy_global_categories` | Global kategoriler (prefix'siz KV) |
| `academy_global_content_{id}` | Global icerikler (prefix'siz KV) |

### Icerik Tipleri
video (YouTube embed), text (yazi), pdf (dis link), gallery (resimler), quiz (coktan secmeli), link (dis baglanti)

### Global Icerik
- Yonetici global kategori/icerik olusturabilir → tum sirketler gorur
- Duzenleme/silme: sadece olusturan sirketin yoneticisi
- Gizleme: her yonetici kendi sirketinde gizleyebilir
- Globale tasi / globalden kaldir toggle

---

## Yapilacaklar (sonra)
- Mekan katkisi (ciro×0.60 + kare×0.40) backend'e kaydedilecek — kapanista hesaplanip KV'ye yazilacak. Sonra istatistik sayfasi + gun raporunda kullanilacak. Su an sadece vardiya bazlida frontend'de hesaplaniyor.

## Diger Bolumler (eklenecek)
- Rotasyon Sistemi
- Satis Akisi (quick-sales)
- Stok Takibi
- Hedef Takip
- Isletme Genel Durum
- Admin Dashboard
