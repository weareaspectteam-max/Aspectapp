Teşhis

Request’ler backend’e gidiyor:

/mekanlar

/rotasyon/personel

Ama backend bunlara 401 Yetkisiz erişim dönüyor.

Bu da şu anlama gelir:

URL doğru

function ayağa kalkmış

endpoint bulunmuş

ama auth kontrolünden geçememiş

Yani mesele network değil, route değil, blank preview değil.
Auth contract kırık.

En güçlü teşhis

Senin yeni yapında backend muhtemelen şunu bekliyor:

Authorization: Bearer <anonKey>

X-Access-Token: <userToken>

Ama frontend’te getLocations ve getStaffMembers çağrıları ya:

X-Access-Token göndermiyor

yanlış token gönderiyor

userToken undefined gidiyor

ya da server X-Access-Token yerine hâlâ Authorization’ı user token sanıyor

Buradan çıkan en önemli ipucu

Logda görünen çağrılar:

getLocations @ ...:22

getStaffMembers @ ...:7

Bu bana şunu düşündürüyor:

Bu iki fonksiyon büyük ihtimalle ortak api helper yerine kendi fetch’lerini yapıyor ya da helper’a token’ı düzgün forward etmiyor.

Yani sen genel mimariyi düzeltmiş olabilirsin ama bu iki fonksiyonun içindeki gerçek fetch hâlâ yanlış olabilir.

En hızlı test

getLocations içinde fetch’i geçici olarak elle sert yaz.

Şu yapıda olsun:

const response = await fetch(`${API_BASE}/mekanlar`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${publicAnonKey}`,
    "X-Access-Token": userToken,
  },
});

Aynısını getStaffMembers için de yap:

const response = await fetch(`${API_BASE}/rotasyon/personel`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${publicAnonKey}`,
    "X-Access-Token": userToken,
  },
});
Sonuç:

Bu çalışırsa → sorun buildHeaders/apiRequest helper’da

Bu da 401 verirse → sorun server verifyToken tarafında

Bu test seni 10 dakikalık saç baş yoldurmadan kurtarır.

Frontend’de kesin bakman gereken şey

getLocations ve getStaffMembers içine fetch’ten hemen önce şunu koy:

console.log("userToken =", userToken);
console.log("publicAnonKey exists =", !!publicAnonKey);
console.log("headers =", {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${publicAnonKey}`,
  "X-Access-Token": userToken,
});

Şuna bak:

Beklenen

userToken dolu string

publicAnonKey exists = true

X-Access-Token dolu

Kötü senaryolar

userToken = undefined

userToken = null

publicAnonKey exists = false

Bunlardan biri varsa fail bulundu.

Server tarafında kesin bakman gereken şey

verifyToken(c) içine geçici log koy:

console.log("Authorization =", c.req.header("Authorization"));
console.log("X-Access-Token =", c.req.header("X-Access-Token"));

Sonra sonucu yorumla:

Durum 1

Authorization var, X-Access-Token yok
→ frontend user token göndermiyor

Durum 2

İkisi de var ama yine 401
→ verify mantığı yanlış

Durum 3

İkisi de yok
→ helper tamamen kırılmış

Server’da doğru mantık ne olmalı?

verifyToken(c) kesin olarak şunu okumalı:

const token = c.req.header("X-Access-Token");

ve başka hiçbir header’a düşmemeli.

Yani şunu yapmamalı:

const token =
  c.req.header("X-Access-Token") ||
  c.req.header("Authorization");

Bu kötü. Çünkü Authorization içindeki anon key’i user token gibi doğrulamaya kalkarsın ve 401 yersin.

Benim en yüksek ihtimal sıralamam

Bu loglara göre:

%50

userToken frontend’te boş gidiyor

%30

Bu iki fonksiyon eski fetch/header mantığında kaldı

%20

Backend verifyToken(c) yanlış header’ı doğruluyor

Sana net hareket planı

Sırayla bunu yap:

1.

getLocations içine log koy:

userToken

Authorization

X-Access-Token

2.

getStaffMembers içine aynısını koy

3.

Server’da verifyToken(c) içine iki header logunu koy

4.

Bir endpointi helper’sız, elle header ile test et

Bu dört adım fail’i direkt ortaya çıkarır.