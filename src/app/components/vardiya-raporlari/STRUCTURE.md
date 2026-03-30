# Vardiya Raporlari — Dosya Yapisi

## Genel
Yonetici/Mudur icin kapanmis vardiya raporlari sayfasi.
3 sekme: Vardiya Bazli, Gun Bazli, Ay Bazli.

## Dosyalar

### Ana
| Dosya | Satirlar | Aciklama |
|---|---|---|
| `index.ts` | 1 | Re-export. App.tsx `'./components/vardiya-raporlari'` ile import eder |
| `vardiya-raporlari.tsx` | ~323 | Ana shell: tum state, fetch fonksiyonlari, sekme switcher |
| `types.ts` | ~102 | Tum tipler: VardiyaKayit, PersonelSatis, YaziciSayac, Anomali, UrunSatir, FiltreProps, Props |
| `helpers.ts` | ~27 | API_BASE, tr() (PDF icin Turkce→ASCII), trRow(), formatTarih(), tl() |

### Vardiya Bazli Sekmesi
| Dosya | Satirlar | Aciklama |
|---|---|---|
| `tabs/vardiya-tab.tsx` | ~108 | Vardiya listesi + detay gecisi (AnimatePresence) |
| `filtre-paneli.tsx` | ~79 | Tarih araligi + mekan filtresi (acilir-kapanir panel) |
| `ozet-kart.tsx` | ~172 | Liste gorunumundeki vardiya karti: ciro, odeme cubugu, kar/zarar, anomali badge, personel katkilari |
| `vardiya-detay.tsx` | ~817 | Detay sayfasi: Ciro&KarZarar, Album, Baski Maliyet, Hakedis, Personel Detayi, Excel/PDF/Yazdir export |
| `silme-onay-dialog.tsx` | ~89 | Vardiya silme onay modali (sadece yonetici) |

### Gun Bazli Sekmesi
| Dosya | Satirlar | Aciklama |
|---|---|---|
| `tabs/gun-tab.tsx` | ~590 | Gun listesi + gun detay gorunumu (mekan kirilimi, personel, baski, odemeler, anomaliler) |
| `gun-export-excel.ts` | ~124 | Gun raporu Excel export (7 sayfa: ozet, mekan, personel, baski, urun, odeme, anomali) |
| `gun-export-pdf.ts` | ~155 | Gun raporu PDF export (dual-column layout) |

### Ay Bazli Sekmesi
| Dosya | Satirlar | Aciklama |
|---|---|---|
| `tabs/ay-tab.tsx` | ~444 | Ay listesi + ay detay gorunumu (yil secici, mekan kirilimi, odeme dagilimi) |

## API Endpointleri

| Endpoint | Metod | Kullanan Dosya | Aciklama |
|---|---|---|---|
| `/vardiya/raporlar?baslangic=&bitis=&mekanId=` | GET | `vardiya-raporlari.tsx` | Kapanmis vardiya listesi (VardiyaKayit[]) |
| `/vardiya/sil` | DELETE | `vardiya-raporlari.tsx` | Vardiya silme (body: mekanId + tarih) |
| `/vardiya/gun-raporu?baslangic=&bitis=` | GET | `vardiya-raporlari.tsx` | Gun listesi (tarih araligi) |
| `/vardiya/gun-raporu?tarih=` | GET | `vardiya-raporlari.tsx` | Tek gun detayi |
| `/vardiya/ay-raporu?yil=` | GET | `vardiya-raporlari.tsx` | Ay bazli rapor (yillik) |

## Backend Veri Kaynaklari (server/index.ts)
Vardiya raporlar endpointi 8 paralel KV sorgusundan veri ceker:

| KV Key/Prefix | Ne icin |
|---|---|
| `stok_gunluk_*` | Ana veri: satislar, kare kayitlari, yazici verileri, anomaliler |
| `getMekanlarFor()` | Mekan adi, emoji, renk, printType, kotaKademeleri, kira |
| `cost_albums` | Album boyut/fiyat tablosu → album maliyeti |
| `cost_exchange_rates` | Doviz kurlari (EUR/USD/GBP) → maliyet TL cevrimi |
| `cost_salary_*` | Personel maaslari → gunluk maas hesabi |
| `rotation_task_*` | Rotasyon gorev atamalari → hakedis personel listesi |
| `hakedis_dahil` | Hakedise dahil personel ID listesi |
| `checkin_*` | Giris kayitlari → gec giris tespiti |

## Onemli Hesaplamalar

### Kar/Zarar (OzetKart + VardiyaDetay)
```
toplamMaliyet = albumMaliyeti + baskiMaliyeti + personelMaasGideri + mekanGunlukKira + hakedisGideri
karZarar = toplamCiro - toplamMaliyet
marj = (karZarar / toplamCiro) * 100
```

### Personel Mekan Katkisi (OzetKart)
```
mekanKatkisi = ciroYuzde * 0.60 + kareYuzde * 0.40
```

### Hakedis (Backend)
Bantli kota kademesi sistemi:
- Rotasyon personeli + gorev bazli (fotograf-satis, baski, album, gozlemci)
- Her gorev icin kisi sayisi bandi → tutar
- Solo ise primTek, coklu ise gorev bantlarindan hesaplama
- UI'da "prim" yerine "Hakedis" gosteriliyor (backend key'leri hala "prim")

### Gunluk Maas (Backend)
```
aylikMaas = amount * (1 + extraCostPercentage/100)
gunlukMaas = aylikMaas / ayinGunSayisi / oGunCalistigiMekanSayisi
```

### Album Maliyeti (Backend)
```
urunAdindan boyut cikar → cost_albums'den birim fiyat bul
albumMaliyeti = adet * birimFiyat (printType'a gore tam/yarim)
```
