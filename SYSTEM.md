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
- **Yazici sayac anomalisi:** girilen acilis vs beklenen (ribonMevcut) farki (±2 tolerans — test baskisi/servis kaymalari sayilmaz)
- **Kapanis yazici anomalisi:** net satilan fotograf vs satis kayitlari farki (±2 tolerans). Dijital satislar (item.dijital) fiziksel baski olmadigi icin hesaba KATILMAZ (2026-07-22 fix — sahte anomali kaynagiydi)
- **Anomali gerekce:** acilis/kapanis payload'inda `anomaliNeden` → `acilisAnomaliNeden` / `kapanisAnomaliNeden` olarak kaydedilir (max 500 kr). Anomali panosu detaylarinda, anomali-raporu ve operasyon dashboard anomali listelerinde `neden` alaninda gosterilir
- **Tek anomali tanimi:** tum ekranlar (manager dashboard, liderlik, mekan anomali listesi, pano, raporlar) stok + yazici anomalilerini birlikte sayar
- **acilis-sifirla:** yazici anomali alanlari dahil tum anomali alanlarini temizler + SQL'e (daily_stock) senkron yazar (yazilmazsa raporlarda hayalet anomali kaliyordu)
- **Ekstra is:** urun eslestirme bastaki sayi ile TAM eslesir (includes() "13'lu"→album3 sahte anomali yaratiyordu), dijital atlanir. Mekan kaynak/iade stoku suffix'li (album{n}_tam/_yarim) alanlara yazilir; acilista alinan tipler `tipDusum` olarak kaydedilir, iade ayni tiplere doner

---

## Bozuk Albüm Sistemi

Bozulan/hasarli albumler satilabilir stoktan dusulup ayri "bozuk" kutusunda **birikimli mevcut bakiye** olarak tutulur. Imha/iade ile dusurulur.

### KV Yapisi
| Key | Icerik |
|-----|--------|
| `depo_stok.bozuk` | Depo bozuk bakiyesi: `{ album3_tam, album3_yarim, ..., album15_yarim }` |
| `mekan_bozuk_{mekanId}` | Mekan bozuk birikimli bakiye: `{ mekanId, album{n}_tam/_yarim, guncellenmeTarihi }` |
| `bozuk_hareket_{ts}` | Mekan imha/iade log (`tip:"mekan_bozuk_cikar"`, sebep) |
| `depo_hareket_{ts}` | Depo bozuk log (`tip:"bozuk"` / `"bozuk_cikar"`, sebep) |

### Kapanis Entegrasyonu (`/stok/kapanis`)
- Payload'a `bozuk: Record<string,number>` (suffix'li, frontend printType'a gore ayirir)
- `beklenen[alan] -= bozuk[alan]` → bozuk eksik/anomali sayilmaz
- `kayit.kapanisBozuk` kaydedilir (denetim + idempotency baseline)
- `mekan_bozuk_{mekanId}` idempotent guncellenir: `delta = yeni - eski(kayittan)`, re-close'da cift saymaz
- `/stok/acilis-sifirla`: `kapanisBozuk` katkisi geri alinir (reverse)
- `GET /stok/gunluk` yaniti `mekanBozuk` doner (album* alanlari, >0 olanlar) — acilis ekraninda "bozuklari sayima KATMAYIN" uyarisi gosterilir (bozuklar fiziksel mekanda kaldigi icin sabah sayilirsa sahte +anomali cikiyordu)

### Bozuk Boru Hatti (2026-07-22): Mekan → Depo → Tedarikci (imha yok)
- UI'dan imha kaldirildi; akis tek yon. Fiziksel olayla eszamanli basilir: bozuldu→girildi, toplandi→aktarildi, gonderildi→iade edildi
- **Adim 1:** Kapanista bozuk girilir → mekanda birikir (mevcut sistem)
- **Adim 2:** `POST /bozuk/depoya-tasi` { mekanId, kalemler[] } — mekan bakiyesinden düser, `depo_stok.bozuk`a girer, `bozuk_hareket` (tip: depoya_tasima) loglanir. UI: Stok Dagilimi → Bozuk Albumler karti → mekan satiri "Depoya Aktar" (kismi veya tumu)
- **Adim 3:** `POST /tedarikci/iade` { cariId, kalemler[] } — depo bozuktan düser, `tedarikci_iade_{id}` kaydi + **0 TL "iadeKarsiligi" degisim siparisi** (status: gonderildi) acilir, tedarikciye bildirim gider. Urun adi tedarikci fiyat listesinden eslesir (boyut + tam/yarim), fallback "13 Kare Yarim" formati. UI: ayni kartin Depo satiri "Tedarikciye Iade"
- **Telafi:** normal teslimat FIFO akisi degisim siparisini doldurur → yeni albumler depo satilabilir stoga girer. totalAmount 0 → cari borc/odeme FIFO'su ETKILENMEZ (gider sadece odeme aninda kurali korunur)
- `GET /tedarikci/iadeler?cariId=` → iade listesi + telafiAdet/bekleyenAdet (bagli siparisin deliveredQuantity toplami). UI: Tedarikci Yonetimi → tedarikci karti → "Iadeler" sekmesi
- Anomali etkisi yok: tum boru hatti satilabilir stok disinda akar

### Endpoint'ler (roller: yonetici/ust-mudur/mudur/operasyon)
| Metod | Route | Aciklama |
|-------|-------|----------|
| POST | `/depo/bozuk` | Depo satilabilirden dus → bozuk kutusuna |
| POST | `/depo/bozuk-cikar` | Depo bozuk imha/iade (satilabilire geri EKLENMEZ) |
| POST | `/bozuk/mekan-cikar` | Mekan bozuk imha/iade |

### Frontend
- **quick-sales kapanis:** "Bozuk Albumler" acilir bolumu (reyona bagli degil), boyut bazli giris
- **stok-dagilimi:** "Bozuk Albumler" karti (depo + her mekan, boyut bazli) + DepoModal "Bozuk" tab + mekan imha/iade modali
- `/stok/genel-durum`: `depo.bozuk` + her `mekanOzet.bozuk` doner

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

## Kapanis Bildirimleri (Tahsilat Popup)

Vardiya kapaninca yonetici tarafindan secilmis kisilere tahsilat raporu popup'i duser.
Amac: aksam tahsilatinda "kimden ne kadar nakit alinacak" karisikligini onlemek.

**Frontend:** `kapanis-bildirim-modal.tsx` (popup + paylasilan `KapanisRaporDetay` bileseni), `kapanis-bildirimleri.tsx` (gecmis liste + yonetici yetki paneli)
**Mount:** App.tsx ve PcApp.tsx (UrgentMessageModal yaninda), 20 sn poll

### Yetki Modeli (kisi basina 3 seviye, hepsi varsayilan KAPALI)
1. **Config'de kayitli olmak** → menu + gecmis liste erisimi (scope'taki mekanlarla sinirli)
2. **`bildirim: true`** → kapanista popup duser (bekleyen kaydi olusur)
3. **`teslimYetkisi: true`** → "Teslim Aldim" isaretleyebilir
Yonetici menu girisini her zaman gorur; digerleri sadece config'de kayitliysa.

### KV Yapisi
| Key | Icerik |
|-----|--------|
| `kapanis_bildirim_config` | `{ kisiler: [{userId, ad, rol, scope: 'all' veya mekanId[], bildirim, teslimYetkisi}] }` |
| `kapanis_rapor_{mekanId}_{tarih}` | Rapor snapshot — re-close ayni ID'ye yazar (cift popup olmaz) |
| `kapanis_bekleyen_{userId}_{raporId}` | Okunmamis popup isareti — X'e basinca silinir |

### Uretim (`/stok/kapanis` icinde, non-fatal try)
- Config'de mekani kapsayan kisi varsa rapor uretilir; bekleyen (popup) SADECE bildirim:true olanlara yazilir
- Kisi bazli satis kirilimi: nakit/iban/kredi (odeme siniflandirmasi `/vardiya/raporlar` ile ayni string matching), urun satirlari, iskonto
- Ozet: toplamCiro, nakit/iban/kredi, iade, cikis, satilanFotograf, musteriSayisi
- **"Elden alinacak" = sadece nakit** — kart + IBAN sirket hesabina gider, bilgi amacli gosterilir

### Teslim Sistemi (Faz 2)
- Popup TAHSILAT ONCELIKLI: kisi + 3 kalem (nakit/kart/iban) + Teslim/Kismi dugmeleri direkt ustte;
  urun dokumu + ciro ozeti "Rapor Detayi" acilir bolumunde
- Popup'ta SADECE teslim bekleyenler listelenir (sadeceBekleyen prop) — biri teslim aldiginda
  o kisi herkesin popup'indan duser; rapor tamamlaninca popup herkeste otomatik kapanir
- Geri alma gecmis listesinden (Kapanis Bildirimleri sayfasi — tum isaretler orada gorunur)
- Acik Takip'te kayit basina "✓ Odendi" (tek dokunus + 2 asamali onay, kalani kapatir) ve "Kismi" tahsil
- Popup davranisi: her mekanin kapanisi kendi zamaninda duser, yeni kapanan ACIK gelir,
  teslimi bitmemis onceki mekanlar ayni popup'ta KAPALI kart (akordeon) olarak birikir
- X / kucult → sag altta amber rozet ("N teslim · ₺X"); rozet tum nakit teslimleri bitene kadar kalir
- Kisi basina "Teslim Aldim · ₺X" dugmesi (sadece nakit>0) + "Hepsini Teslim Aldim"
- Tekrar basinca geri alinir; her islem log'a yazilir (kim, kimden, ne kadar, ne zaman)
- Teslim durumu RAPORA bagli ve ortak — tum gorenler ayni isaretleri gorur
- Teslim yetkisi ayri ayar: config kisi.teslimYetkisi (yetki panelinde "💰 Teslim Aldim isaretleyebilir" toggle)
- Rapor tamamlaninca (nakitli herkes isaretli) TUM kullanicilarin bekleyen isaretleri silinir → rozetler duser
- Nakitsiz/tamamlanmis rapor: kucultunce okundu cagrilir, listeden duser
- Gecmis listede "n/m teslim" rozeti + liste basinda "Eksik teslimatlar" ozeti (30 gun)
- KV: `kapanis_teslim_{raporId}` → `{ kisiler: {personelId: {alindi, alanId, alanAd, zaman}}, log: [] }`
- Ileride: teslim log'u yeni kasa hareket defterine "teslimat girisi" olarak baglanabilir

### Acik Sistemi (kismi teslim + acik takibi)
- "Teslim Aldim" = TAM teslim (tek dokunus). Yaninda "➗ Kismi" dugmesi:
  nakit/kart/iban AYRI AYRI alinan girilir, beklenen ile fark aninda gosterilir
- Fark pozitif = ACIK (eksik), negatif = FAZLA — ikisi de kaydedilir
- Acik kaydi: `kapanis_acik_{personelId}_{raporId}` → beklenen/alinan/acik (3 kalem), acikToplam, kalanAcik, tahsilatlar[]
- Tam teslim veya geri alma → o kisinin acik kaydi silinir (tutarlilik)
- Sonradan odeme: "Tahsil Et" (kismi/tam) → tahsilatlar[]'a eklenir, kalanAcik duser
- Kismi teslimde numpad (kasa tarzi, cihaz klavyesi yok) + fark varsa "onayliyor musun?" onay adimi
- KAPANAN acik gorunmez: /acik'ta kalanAcik>0 veya son 30 gun fazla; /acigim'da sadece kalanAcik>0 (kayitlar KV'de arsivde durur)
- **Acik Takip (admin)** (`acik-panel.tsx`, YONETICI HIZLI ERISIM): SADECE yonetici+ust-mudur,
  tum personelin acik/eksik/fazlasi, "✓ Odendi" + "Kismi" tahsilat
- **Acik Takip (personel)** (`acik-takip.tsx`, GENEL menusu — mudur/operasyon/idari/personel):
  herkes YALNIZCA kendini gorur, islem yapamaz (beklenen/alinan tutarlar sunucudan gonderilmez)
- Ortak satir bileseni: `AcikSatir` (acik-panel.tsx icinden export)
- **KASA ENTEGRASYONU:** kasa2 nakit bakiyesi hesaplanirken kalan acik dusulur, fazla eklenir
  (milat sonrasi kapanis_acik_ kayitlari) — kasa fiilen eldeki parayi gosterir; tahsilat yapilinca
  kalan duser, kasa kendiliginden yukselir. Nakit Kasa kartinda "Teslimat acigi −X" bilgi satiri.
- **Kapanis Bildirimleri sayfasi** (liste + yetki paneli): SADECE yonetici, YONETICI HIZLI ERISIM menusunde

### Gun Kapatma (mor rozet, sol) — ikinci teslimat halkasi
- Sari (sag) = personelden toplama; MOR (sol) = toplayicilardan gun kapaticiya teslim
- Teslim isaretleyen kisi, FIILEN topladigi nakit kadar `gun_kapatma_{tarih}` kaydinda borclanir
  (kismi aldiysa aldigi kadar — personelin acigi toplayiciya YUKLENMEZ); geri alma dusurur
- Mor rozet config kisi.gunKapatma=true olanlarda cikar; acik gunler GUN GUN birikir (30 gune kadar),
  kapatilmadikca listede kalir; rozet toplami tum acik gunlerin toplamidir
- Gun kapatici toplayici basina "Teslim Aldim" / "Kismi" (numpad + acik onayi — acigi kim olursa olsun yazilir:
  `kapanis_acik_{toplayiciId}_gun_{tarih}`, mekan "🌙 Gun Kapatma")
- Tum toplayicilar teslim edince "Gunu Kapat" + onay → gun kapanir (kapandi=true, log); kapanmis gune
  gec teslim dusersa gun otomatik yeniden acilir

### Endpoint'ler
| Metod | Route | Aciklama |
|-------|-------|----------|
| POST | `/kapanis-bildirim/gun-teslim` | Body `{tarih, toplayiciId, islem, alinan?}` — gunKapatma yetkisi |
| POST | `/kapanis-bildirim/gun-kapat` | Body `{tarih}` — tum teslimler tamamsa gunu kapatir |
| GET | `/kapanis-bildirim/config` | Yetki matrisi oku (yonetici) |
| POST | `/kapanis-bildirim/config` | Yetki matrisi kaydet (yonetici) — kisi: userId, ad, rol, scope, bildirim, teslimYetkisi |
| GET | `/kapanis-bildirim/durum` | Popup poll: `{ yetkili, canTeslim, bekleyenler(+teslim) }` |
| POST | `/kapanis-bildirim/okundu` | Body `{raporId}` — bekleyen isaretini sil |
| POST | `/kapanis-bildirim/teslim` | Body `{raporId, personelId\|'hepsi', islem:'teslim'\|'geri', kismi?:{nakit,kart,iban}}` — teslimYetkisi gerekli |
| GET | `/kapanis-bildirim/liste` | Son 30 gun raporlari + teslim durumu (scope filtreli; 60+ gun lazy temizlik) |
| GET | `/kapanis-bildirim/acik` | TUM acik kayitlari (SADECE yonetici + ust-mudur) |
| GET | `/kapanis-bildirim/acigim` | Kullanicinin SADECE kendi acik kayitlari |
| POST | `/kapanis-bildirim/acik-tahsil` | Body `{acikId, tutar}` — yonetici/ust-mudur veya teslimYetkisi |
| POST | `/kapanis-bildirim/test` | Yonetici: dunun kapanislarini kendine popup gonderir (X-Migration-Key alternatif auth) |

### Menu Gorunurlugu
- Hamburger > GENEL > "Kapanis Bildirimleri": yonetici her zaman gorur; digerleri config'de kayitliysa gorur
- Modal her poll'da `aspect_kapanis_bildirim_yetkili` localStorage bayragini gunceller, menu bu bayragi okur
- `aspect_kapanis_seen` localStorage: daha once popup olarak gosterilen rapor ID'leri (yeniden tam ekran acilmaz)

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
Bakiye = DevirBakiye + AcilisBakiye + DevirCirolar + ParaGirisleri - OdenenGiderler
```
**ParaGirisleri:** `isletme_gelir_` kayitlarindan ay filtreli toplam
**OdenenGiderler:** `kasa_odeme_` kayitlarinda odpiendi=true olanlar

### IGD-Kasa Senkronu
- IGD'de gider tutari duzenlenince → `kasa_odeme_` da guncellenir
- Kasadan odeme silinince → `isletme_gider_` da silinir (komple-sil, kismi-sil)
- Acilis borcu odenince → IGD'ye gider + kasada odendi
- Para Cikisi → borcTutar gonderilmezse otomatik odpiendi=true

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

## Manuel Borclar (Kasadan Bagimsiz)

**Tab:** Kasa icinde 3. tab (📝 ikonu)
**KV:** `kasa_borc_{id}` → `{ id, yon: "alacak"/"verecek", kisi, tutar, kalanTutar, currency, aciklama, tarih, odemeler: [{tutar, tarih, aciklama}] }`

- Kasa ile entegre — borc eklenince/silinince kasaya yansiyor, tahsilat/odeme kasayi etkiliyor
- Alacaklarda "Tahsilat Yap" (kasaya giris), Vereceklerde "Odeme Yap" (kasadan cikis)
- IGD'de "Borclar — ..." aciklamasiyla gorunur
- Doviz destegi: TRY, USD, EUR, GBP
- Kismi/tam odeme yapilabilir
- Kasa bakiyesini etkilemez

---

## Fabrika Sifirlamasi

**Endpoint:** `POST /sistem/fabrika-sifirla`
**Konum:** Ayarlar → Fabrika Sifirlamasi

- Sirketin TUM KV verilerini siler (mekanlar, ekipmanlar, vardiyalar, satislar, kasa, hakedis, akademi, mesajlar, izinler vs.)
- Yonetici haric tum kullanicilari Supabase Auth'dan siler
- Cift dogrulama: sirket adi + sirket kodu
- Sadece yonetici yapabilir, baska sirketlere dokunamaz
- Geri alinamaz

---

## Tedarikci Portali

**Frontend:** `src/app/components/tedarikci-portal.tsx` (tedarikci), `tedarikci-yonetimi.tsx` (admin)
**Backend:** Tum endpoint'ler `index.ts` icinde `/tedarikci/...` prefix'li

### Genel Mantik
Tedarikci (albumcu, malzeme saglayici vb.) kendi sifresiyle giris yapar, siparislerini/teslimatlarini/odemelerini takip eder. Admin siparis olusturur, teslimat onaylar, odeme kaydeder.

**Cok sirketli model:** Tedarikci birden fazla sirkete hizmet verebilir. `company_id: "__tedarikci__"` ozel degeri ile kayit olur, `linkedCompanies` array'i ile sirketlere baglanir.

### Roller
- `tedarikci` rolu: hierarchy 0.5 (personel altinda)
- Admin rolleri (yonetici, ust-mudur, mudur): siparis/teslimat/odeme yonetimi
- operasyon: parasal-veri-siz teslimat onayi gorunumu (OperasyonTeslimatView)
- **Kisi bazli yetki** (`tedarikci_yetkili` KV, yonetici panel basligindaki 🔒 dugmesiyle secer):
  listedeki kisi KISITLI panel gorur — siparis verir + teslimat onaylar/reddeder;
  Odemeler/Bakiye/Fiyatlar sekmeleri ve Odeme Yap/Iptal butonlari YOK, sunucu da
  odemeler/fiyatMap gondermez (ozet + siparis detayinda bos). Menu girisi GENEL'de,
  `aspect_tedarikci_yetkili` localStorage bayragi ile (kapanis-bildirim durum poll'u yazar).
  Endpoint'ler: GET/POST `/tedarikci/yetki` (yonetici)

### KV Yapisi
| Key | Icerik |
|-----|--------|
| `cost_cari_{id}` | Cari: linkedUserId, linkedUserEmail, supplierType, stokGorunur |
| `siparis_{id}` | Siparis: cariId, items, status, totalAmount, teklifFiyat, teklifDurum, teklifler[], loglar[], uretimDurum |
| `teslimat_{id}` | Teslimat: siparisId, lines, status, reviewedBy |
| `tedarikci_odeme_{id}` | Odeme: siparisId, amount, supplierConfirmed |
| `tedarikci_fiyat_{cariId}` | Anlasma fiyatlari: items[{productName, fiyat, currency}] |
| `tedarikci_fiyat_talep_{cariId}` | Bekleyen fiyat guncelleme talebi: items, gonderen, durum |

### Siparis Durumu (State Machine)
```
taslak → gonderildi → onaylandi → kismen_teslim → teslim_edildi → tamamlandi
                                                                    (odeme tamamlaninca)
Herhangi asamada → iptal (admin)
```

### Teslimat Akisi (FIFO dagitim — 2026-07-21)
1. Tedarikci "Teslimat Bildir" → `teslimat_` kaydi (status: beklemede)
2. Admin "Onayla" → her kalem EN ESKI acik siparisten (gonderildi/onaylandi/kismen_teslim, createdAt sirali)
   FIFO duser; artan sonraki siparise gecer. Teslimatin hangi siparise bildirildigi onemsiz.
   - Tam dolan siparis → "tamamlandi" (odeme beklenmez, cari bakiyede ayri takip)
   - Dagitim `teslimat.dagitim`'a yazilir; dokunulan her siparise ACIKLAYICI log
     ("bu siparisten dusen: 15× 7 Kare Yarim — en eski siparis once kurali") → iki taraf da gorur
3. **Siparis disi kalem** (hicbir sipariste yok / toplami asiyor): backend `fazlaOnayGerekli` doner,
   admin dialog'da karar verir (sadece yonetici/ust-mudur/mudur karar verebilir):
   - `fazlaKarar: 'kabul'` → otomatik "Siparis Disi Teslimat" kaydi (siparisDisi: true, status tamamlandi,
     fiyat: anlasma listesi > cost_albums kur cevrili — `tedarikciUrunFiyat` helper) → depoya girer + bakiyeye borc
   - `fazlaKarar: 'haric'` → o kalemler islenmez, depoya da girmez
4. Depo girisi: dagitilan + kabul edilen kalemler (paspartu haric); haric tutulan girmez
5. Tedarikciye aciklayici bildirim: dagitim ozeti + siparis disi karari
6. Admin "Reddet" → sebep yazilir, tedarikci bilgilendirilir

### Sayim Duzeltme Akisi (2026-07-22)
- Alici (yonetici/mudur/operasyon/yetkili) beklemedeki teslimatta "Sayim Farkli" der → gercek alinan
  adetleri girer (+not) → PUT `/teslimatlar/:id/duzelt` → status: `duzeltme_bekliyor`, `teslimat.duzeltme` kaydi,
  tedarikciye bildirim. Bu durumda onay/red kilitli.
- Tedarikci portalda kabul/red: POST `/teslimatlar/:id/duzeltme-yanit` {karar}
  - **kabul** → `orijinalLines` saklanir, `lines` = duzeltilmis; teslimat OTOMATIK islenir (`teslimatCommit`
    helper — onayla ile ayni FIFO+depo mantigi). Siparis disi kalem cikarsa otomatik islenmez,
    duzeltilmis adetlerle "beklemede"ye doner (fazlaKarar'i yonetici panelden verir)
  - **red** → status "beklemede"ye doner (orijinal adetler), `duzeltmeRed` kaydi; alici orijinalle karar verir
- `teslimatCommit` helper: FIFO dagitim + siparis guncelleme + siparis disi + depo girisi + bildirim tek fonksiyon;
  PUT onayla ve duzeltme-kabul ayni kodu kullanir

### Operasyon Parasiz Siparis (2026-07-22)
- POST `/tedarikci/siparisler` operasyon rolune acildi: istemciden gelen fiyat/teklif YOK SAYILIR,
  birim fiyatlar backend'de `tedarikciUrunFiyat` ile doldurulur (kayitta gercek fiyat durur),
  operasyon yanitinda parasal alanlar sifirlanir
- UI: OperasyonTeslimatView'a "Yeni Siparis Olustur" bolumu — tedarikci sec + urun adetleri (fiyat gorunmez)

### Odeme-Kasa Entegrasyonu (TEK NOKTA + FIFO — 2026-07-21)
- Odeme SADECE Bakiye sekmesindeki "Odeme Yap" ile yapilir (siparis karti odemesi kaldirildi,
  eski "On Odeme Yap" bu dugmeye donustu). Endpoint: POST `/tedarikci/odeme-genel` {cariId, amount, aciklama}
- FIFO: en eski acik siparisin borcunu kapatir (tedarikci_odeme_ kaydi siparis basina bolunur, tip:"fifo"),
  artan tum borclar kapaninca ON ODEME/alacak olur (tip:"on_odeme", siparisId:null)
- Odeme tipi SORULMAZ — kasa2'den otomatik: ONCE BANKA, yetmezse kalan NAKIT (pot bazli 2 hareket)
- Tek `isletme_gider_` (toplam) + kasa2 cikis hareketleri; eski kasa (kasa_odeme_) YAZILMAZ
- Teklif kabulunde de gider YAZILMAZ (cift gider fixi) — gider yalnizca odeme aninda
- Dokunulan siparislere log; tedarikciye aciklayici bildirim; tedarikci odemeyi panelinden onaylar
- Siparis tamamlanmasi odemeden bagimsizdir (teslimatla tamamlanir); bakiye = siparis toplami − odemeler (+/−)

### API Endpoint'leri
| Metod | Route | Aciklama |
|-------|-------|----------|
| POST | `/tedarikci/davet` | Tedarikci hesabi olustur/bagla |
| GET | `/tedarikci/sirketlerim` | Tedarikci: bagli sirketler |
| GET | `/tedarikci/portal` | Tedarikci: ozet + siparisler |
| GET | `/tedarikci/ozet` | Admin: genel ozet |
| GET/POST | `/tedarikci/siparisler` | Listele / olustur |
| GET | `/tedarikci/siparisler/:id` | Detay + teslimatlar + odemeler |
| PUT | `/tedarikci/siparisler/:id` | Guncelle (taslak iken) |
| POST | `/tedarikci/siparisler/:id/gonder` | Tedarikciye gonder |
| POST | `/tedarikci/siparisler/:id/onayla` | Tedarikci kabul |
| POST | `/tedarikci/siparisler/:id/iptal` | Iptal |
| POST | `/tedarikci/teslimat` | Tedarikci: teslimat bildir |
| GET | `/tedarikci/teslimatlar` | Admin: tum teslimatlar |
| PUT | `/tedarikci/teslimatlar/:id/onayla` | Admin: onayla |
| PUT | `/tedarikci/teslimatlar/:id/reddet` | Admin: reddet |
| PUT | `/tedarikci/teslimatlar/:id/duzelt` | Alici: sayim duzeltmesi oner (tedarikci onayina) |
| POST | `/tedarikci/teslimatlar/:id/duzeltme-yanit` | Tedarikci: duzeltme kabul/red |
| POST | `/tedarikci/iade` | Bozuk iade → 0 TL degisim siparisi |
| GET | `/tedarikci/iadeler` | Iade listesi + telafi durumu |
| POST | `/tedarikci/odemeler` | Admin: odeme kaydet |
| GET | `/tedarikci/odemeler` | Listele |
| POST | `/tedarikci/odemeler/:id/onayla` | Tedarikci: odemeyi onayladi |
| POST | `/tedarikci/teklif` | Tedarikci: teklif/siparis olustur |
| POST | `/tedarikci/siparisler/:id/teklif` | Karsilikli teklif (kabul/red/karsi teklif) |
| POST | `/tedarikci/siparisler/:id/durum` | Tedarikci: uretim durumu bildir |
| GET/PUT | `/tedarikci/fiyat/:cariId` | Fiyat listesi oku/guncelle |
| POST | `/tedarikci/fiyat-talep/:cariId` | Fiyat guncelleme talebi gonder |
| POST | `/tedarikci/fiyat-talep/:cariId/kabul` | Talebi kabul et (+ cost_albums yansitma) |
| POST | `/tedarikci/fiyat-talep/:cariId/red` | Talebi reddet |

### Tedarikci Tipi
- `cost_cari_{id}.supplierType`: 'album' (album+paspartu) veya 'ribon' (ribon/kagit)
- Siparis formunda tipine gore urun listesi otomatik gelir
- `cost_cari_{id}.stokGorunur`: tedarikci stoku gorebilir mi (admin toggle)

### Fiyat Listesi
- `tedarikci_fiyat_{cariId}`: anlasilmis fiyatlar (urun bazli)
- `tedarikci_fiyat_talep_{cariId}`: bekleyen fiyat guncelleme talebi
- Siparis fiyatlari: tedarikci_fiyat varsa oradan, yoksa cost_albums'dan default

### Teklif/Pazarlik
- siparis.teklifFiyat, teklifDurum, teklifler[] — karsilikli teklif gecmisi
- teklifDurum: teklif_verildi | karsi_teklif | tedarikci_teklifi | kabul_edildi | reddedildi

### Aktivite Loglari
- siparis.loglar[] — her islem log olarak kaydedilir
- Her iki tarafta "Son Aktiviteler" paneli

### Admin Tedarikci Yonetimi Yapisi
- Ilk ekran: tedarikci listesi (kartlar + davet et)
- Tedarikciye tikla → o tedarikcinin ekrani (loglar + Siparisler/Fiyatlar/Bakiye tab'lari)
- Her tedarikci icin ayri ekran (tedarikci portalinin admin versiyonu)

### Teslimat → Depo Stok
- Teslimat onaylaninca depo_stok otomatik artar (paspartu haric)
- Paspartu depoya eklenmez, fiyati toplam tutar olarak girilir (carpma yok)

### Depo & Mekan Stok: Tam Boy / Yarim Boy Ayrimi
- **depo_stok** ve **mekan stoklari** tam/yarim formatta: `album3_tam`, `album3_yarim`, ..., `album15_tam`, `album15_yarim`
- Eski format (album3, album5 vb.) lazy migration ile yarim boy'a tasinir (`migrateMekanStok`, `migrateDepoStok`)
- Mekanlar da tam/yarim tutuyor — depodan tam boy album aktarilabilir
- Tedarikci siparisleri: urun adlari "3 Kare Tam", "3 Kare Yarim" seklinde
- Transfer: alan direkt aktarilir (album3_tam → album3_tam), donusum yok
- Maliyet hesabi: mekan.printType ile tamBoy/yarimBoy fiyat secilir. Kendi tipi bittiyse diger tipten dusulur ve o tipin fiyatiyla hesaplanir
- Kapanis: satis album dusumu once mekanin printType'indan, bittiyse diger tipten yapilir. Farkli tip kullanimi `farkliTipKullanim` olarak kaydedilir

---

### Mekan Bazli Doviz Destegi
- Mekan kaydinda `priceCurrency` alani: `'TRY' | 'USD' | 'EUR' | 'GBP'` (varsayilan: TRY)
- Satis ekraninda urun fiyatlari mekanin para birimiyle gosterilir (€, $, £, ₺)
- Satis kaydedilirken: `currency` = mekan para birimi, `currencyPrice` = doviz tutari, `finalPrice` = doviz × kur → TL
- Raporlar, ciro, hakedis hep TL bazinda calisir (degismez)
- Doviz widget: mekanin kendi para birimi haric diger 3 dovizi gosterir
- Mevcut mekanlar etkilenmez (priceCurrency undefined = TRY)

---

## Guncelleme Notlari

### 04.04.2026 (2. guncelleme)
- **Depo Stok Tam/Yarim Ayrimi:** Depo stoku `album3_tam`, `album3_yarim` formatinda. Tedarikci siparisleri "3 Kare Tam" / "3 Kare Yarim" olarak. Teslimat onayinda depoya dogru alana eklenir.
- **Mekan Bazli Doviz Destegi:** Mekan kaydina `priceCurrency` alani eklendi. Satis ekraninda urun fiyatlari mekanin para birimiyle gosterilir. Kayit TL'ye cevrilir.
- **Akademi Uygulama Rehberi:** `POST /academy/seed-guide` endpoint'i — Vardiya Acilis & Kapanis, Kare Sistemi, Satis Girisi rehber icerikleri. "Rehber" butonu ile yukle.
- **Sayfa Ici Rehber Butonlari:** Tum ana sayfalara ? butonu + detayli rehber modal eklendi (toplam 15 sayfa — detay asagidaki tabloda).

### 04.04.2026
- **Borclar — Kasa Entegrasyonu:** Borclar sekmesi kasayla entegre edildi. Alacaklarda "Tahsilat Yap" (kasaya giris), Vereceklerde "Odeme Yap" (kasadan cikis). Borc eklenince/silinince kasa + IGD etkileniyor. Aciklama: "Borclar — Tahsilat/Odeme/Verilen Borc/Alinan Borc — kisi adi"
- **Pay Dagitimi:** Sirket kasasina "Pay Dagit" butonu eklendi. Ortaklari tanimla (isim + yuzde), toplam tutar gir, otomatik bol. Kasadan duser, IGD'de tek satir gorunur. Gecmis dagitimlar accordion ile listelenir. Sadece yonetici erisir. Endpoint'ler: `/ortaklar` (GET/POST), `/dagitim` (POST), `/dagitimlar` (GET). KV: `pay_ortaklar`, `pay_dagitim_{id}`
- **Bekleyen Odemeler Accordion:** Kategori bazli gruplanip accordion olarak gosteriliyor. Personeller tek "Personel" basligi altinda toplanip, acilinca alt personeller ayri ayri gorunuyor.
- **Bakiye Kartinda Alacak/Verecek:** Sirket kasasi bakiye kartinin sag ustunde alacak (yesil) ve verecek (kirmizi) toplamlari, altinda "Net Bakiye" gosteriliyor. Doviz borclar guncel kurla TRY'ye cevriliyor.
- **Doviz Destegi Borclar:** Borc kartlarinda para birimi semboluyle gosteriliyor ($, EUR, £). Toplam alacak/verecek TRY'ye cevrili.
- **Mekan Stok Tam/Yarim Ayrimi:** Mekan stoklari artik depo gibi `album3_tam`, `album3_yarim` formatinda tutuluyor. Lazy migration: eski `album3` → `album3_yarim` olarak tasinir. Acilis/kapanis, transfer, stok guncelle, genel stok dagilimi, anomali panosu tam/yarim destekliyor. Kapanis album dusumunde once mekanin kendi tipinden dusulur, bittiyse diger tipten dusulur ve maliyet o tipin fiyatiyla hesaplanir.

---

## Sayfa Ici Rehber Butonlari (?)

Yonetici/mudur sayfalarinda amber renkli `?` (HelpCircle) butonlari eklenmistir. Basinca o sayfaya ozel aciklama modali acilir.

| Sayfa | Dosya | Konum |
|---|---|---|
| Rotasyon — Gorev Planla | `rotation-system.tsx` | "Sabit Mekanlar" basliginin yaninda |
| Rotasyon — Rotasyonlar | `rotation-system.tsx` | "Gonderilen Rotasyonlar" basliginin yaninda |
| Canli Akis | `live-sales-feed.tsx` | Stat chip'lerin (satis/gelir/kare/toplam) yaninda |
| Vardiya Raporlari | `vardiya-raporlari/vardiya-raporlari.tsx` | Refresh butonunun solunda |
| Hakedis Takip | `prim-takip.tsx` | Refresh butonunun solunda |
| Hedef Takip | `hedef-takip.tsx` | Refresh butonunun solunda |
| Izin Cizelgesi | `personel-izin-cetveli.tsx` | Refresh butonunun solunda |
| Malzeme Yonetimi | `equipment-page.tsx` | + butonunun solunda |
| Hakedislerim (personel) | `personel-prim-takip.tsx` | Refresh butonunun solunda |
| Rotasyon — Izinler | `rotation-system.tsx` | Izin Talepleri sayac yaninda |
| Kasa | `kasa.tsx` | Baslik sag tarafi |
| Isletme Genel Durum | `isletme-genel-durum.tsx` | Refresh butonunun solunda |
| Tedarikci Yonetimi | `tedarikci-yonetimi.tsx` | Refresh butonunun solunda |
| Kisisel Izin Cizelgesi | `kisisel-izin-cetveli.tsx` | Refresh butonunun solunda |
| Liderlik Tablosu | `leaderboard.tsx` | Refresh butonunun solunda |
| Gorev Secim (Mekan) | `project-selector.tsx` | Baslik sag ustu |

Stil: `background: rgba(251,191,36,0.15)`, `border: 1px solid rgba(251,191,36,0.4)`, `boxShadow: 0 0 8px rgba(251,191,36,0.2)`, ikon: `text-amber-400`

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
