# CAPONE Operator

Operator, CAPONE LAB işlerini sahibi (owner) her adımı elle yönetmeden yürütebilmek için kurulan güvenli orkestrasyon katmanıdır. V1 yalnızca planlar, kuralları kodlar, kuyruğu tutar ve dry-run raporu üretir. Yeni marka eklemez, katalog verisini değiştirmez, commit/push/deploy yapmaz.

Windows’ta PowerShell execution policy takılırsa komutları `npm.cmd` ile çalıştırın:

```text
npm.cmd run operator:check
npm.cmd run operator:dry-run
npm.cmd run operator:test
```

## Operator ne yapar?

- Görevi kuyruğa alır (`QUEUED` → … → `READY` / `REVIEW` / `BLOCKED` / `FAILED`)
- Domain, adımlar, QA ve onay kapılarını önceden gösterir
- Dry-run ile “ne yapılacak?” raporunu üretir
- Neden `REVIEW` / `BLOCKED` / `FAILED` olduğunu kaydeder
- Üretim yazımını varsayılan olarak reddeder

## Product Research vs Market Research

Bunlar iki ayrı iş alanıdır. Aynı marka adı her iki alanda da durabilir; kayıtlar karışmaz.

**Product Research / Ürün Araştırması**

- Sayfalar: Markalar, Pazaryerleri, Visual, New Arrivals
- Amaç: model/ürün keşfi
- Bir ayakkabı hem marka sitesinde hem pazaryerinde durabilir; biri diğerini silmez
- Markalar ve Pazaryerleri birleştirilmez
- Visual, aynı modeli kanonik tek karta toplayabilir; kaynak URL’leri saklanır
- New Arrival = kaynaktaki “yeni” kanıtı. Bugün toplandı diye yeni sayılmaz

**Market Research / Pazar Araştırması**

- Amaç: “Romanya’da hangi marka/model kaça satılıyor?”
- Satış pazarı (`markets`) ≠ marka menşei (`originCountry`)
- Fiyatlar önde durur
- Markalar / Pazaryerleri / Visual listelerine yazılmaz
- Visual/Product Research hattı değildir

## AUTO işler / OWNER APPROVAL işler

**AUTO (V1 planlar, ileride çalıştırabilir)**

- araştırma, repo okuma
- collector çalıştırma
- deterministik dönüşüm
- test, QA, rapor
- preview hazırlığı

**OWNER APPROVAL olmadan DENY**

- commit, push, PR merge
- `main`’e yazmak
- production deploy
- force işlemler
- yıkıcı toplu silme
- sağlam veri setini boş/başarısız collect ile ezmek

## Görev durumları

`QUEUED` → `DISCOVERING` → `COLLECTING` → `NORMALIZING` → `CLASSIFYING` → `GROUPING` → `VALIDATING` → `REVIEW` / `BLOCKED` / `READY` / `FAILED`

Sahibe sade sonuç: `PASS` | `REVIEW` | `BLOCKED` | `FAILED` + gerekçe.

## Diğer kategorisi

“Diğer” normal/final bir ürün kategorisi değildir.

Diğer yalnızca QA/error state olarak kullanılabilir:

- unresolved
- insufficient evidence
- non-footwear suspect

Operator, kategori atamadan önce şu evidence escalation sırasını dener:

1. source category
2. breadcrumb
3. product type
4. structured data
5. title/name
6. URL/slug
7. product attributes
8. product description
9. detail page evidence

Yeterli kanıt yoksa ürün uydurma bir kategoriye atanmaz. Sonuç `REVIEW` veya `BLOCKED` olur.

Final hedef taxonomy:

- Babet
- Loafer
- Mule
- Sandalet
- Topuklu
- Sneaker
- Bot
- Çizme

## Image / gallery kuralları

Her gerçek ürün/varyant için erişilebilen tüm gerçek ürün galerisi görselleri korunur.

- hero image korunur
- tüm gerçek ürün gallery images tutulur
- logo reddedilir
- badge reddedilir
- “new” etiketi görseli reddedilir
- navigation image reddedilir
- recommendation image reddedilir
- placeholder reddedilir
- unrelated image reddedilir

Renk/varyant değiştiğinde o varyantın kendi gallery’si kullanılır.

AI / generated / invented product image kullanılmaz.

## Color grouping

Aynı modelin farklı renkleri tek model/card altında toplanabilir.

Her grupta varyant bazında korunur:

- variant/color bilgisi
- price
- original/list price
- currency
- source URL
- images

Ayrı modeller merge edilmez. Örnek:

- LUNA vs LUNA 2
- LINDA vs LINDA I

## Yeni marka görevi nasıl işler?

Örnek: “Massimo Dutti’yi Markalara ekle”

1. Template: `PRODUCT_RESEARCH_BRAND_ONBOARDING`
2. `npm.cmd run operator:dry-run -- --template PRODUCT_RESEARCH_BRAND_ONBOARDING --title "Add Massimo Dutti to Markalar" --locale es`
3. Operator locale, collect yolları, kategori, renk gruplama, footwear gate ve onay kapılarını raporlar
4. Canlı collect / commit / deploy bu V1’de çalışmaz
5. Sahip raporu inceler; üretim adımı ayrıca onay ister

Pazar araştırması örneği (“Romanya satış pazarı markası ekle”) ayrı template kullanır ve Markalar’a yazmaz.

## Cloudflare / block olursa

Sıra: normal HTTP → JSON-LD → gömülü state → bilinen vitrin API → mevcut browser collector.

Tükenince sonsuz deneme yok. Sonuç `REVIEW` veya `BLOCKED` + tam neden (Cloudflare, DataDome, rate limit, JS, API, markup).

Boş/başarısız collect, daha önce geçerli veri setinin üstüne yazılmaz.

## Gece otomasyonu sonra nasıl çalışır?

V2’de kuyruk dosyası (`data/operator/queue.json`) zamanlanmış job ile okunur. Job sadece AUTO adımları çalıştırır, dry-run/rapor üretir, sahip onay kapısına takılır. Commit/deploy otomatik olmaz.

## Cursor Cloud Agent / GitHub / Vercel sonra nasıl oturur?

- GitHub issue/comment → Operator template’e çevrilir, kuyruğa girer
- Cursor Cloud Agent repo okur, dry-run ve test çalıştırır, preview PR hazırlar
- Vercel preview AUTO olabilir; production deploy sahip onayı ister
- Bildirim: `REVIEW` / `BLOCKED` özeti sahip’e gider

## Komutlar

```text
npm.cmd run operator:check
npm.cmd run operator:dry-run -- --template QA_ONLY
npm.cmd run operator:dry-run -- --example
npm.cmd run operator:dry-run -- --json
npm.cmd run operator:test
```

`--example` yalnızca rapor formatını gösterir; collect çalıştırmaz.
