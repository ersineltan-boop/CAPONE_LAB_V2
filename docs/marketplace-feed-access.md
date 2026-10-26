# Kalan üç platform: otomatik veri erişimi

Kontrol tarihi: 5 Ekim 2026. Bu dosya erişim ve bağlantı hazırlığıdır; üç platformun yenilendiğini veya yeni bağlantıların etkin olduğunu göstermez. Mevcut collector ve sağlam kataloglar korunur. Makine tarafından okunabilen durum: `data/registry/marketplace-feed-access.json`.

## Farfetch — ilk uygulanacak bağlantı

[Resmî ortaklık sayfası](https://www.farfetch.com/id/pag1987.aspx) günlük ürün veri akışını açıkça sunuyor. Başvuru kanalı `affiliates@farfetch.com`; site adı ve URL isteniyor. CAPONE sitesi: https://capone-lab-v2.vercel.app.

Bağlantı için gerekenler: CAPONE adına onaylı erişim, akış adresi, kimlik doğrulama yöntemi, gerçek veri örneği/şeması, ülke ve kadın ayakkabı kapsamı, eksiksiz kaynak toplamı. Sağlayıcı belli olmadan Awin/Rakuten şeması veya kimlik bilgisi varsayılmaz.

Uygulama sırası: onaylı akışı indir, gerçek şemaya göre eşle, kadın ayakkabı/politika filtrelerini uygula, kaynak toplamını ve dosya bütünlüğünü doğrula, mevcut kalite ve arşiv koruma kapısından geçir. Eksik veya başarısız indirme yayına girmez. Akışın kendisi NEW kanıtı değildir.

## Free People — Rakuten katalog erişimini doğrula

[Free People](https://www.freepeople.com/fpmovement/help/affiliates/) resmî programını Rakuten Advertising üzerinden yürütüyor. [Rakuten Product Catalog](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/4412243880333-Download-Product-Catalog-Data-Feed-Files) SFTP ile otomatik indirilebilir; erişim başvuru ve onay gerektirir. [Kurulum açıklaması](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/32202924750989-Request-Access-to-Advertisers-Product-Feeds-Video) teknik hesap kurulumuna ek olarak her reklamveren için ayrı katalog onayı gerektiğini belirtiyor.

Önce yayıncı hesabı, Free People ortaklık onayı ve bu hesapta Free People Product Catalog bulunup bulunmadığı doğrulanır. Ardından SFTP erişimi, reklamveren kimliği, dosya kapsamı ve gerçek şema alınır. Ortaklık programının bulunması, katalog akışının bu hesap için kullanılabilir olduğu anlamına gelmez. Rakuten sunucusu `aftp.linksynergy.com`; ikili aktarım ve en fazla beş eşzamanlı bağlantı kuralı geçerlidir.

## Level Shoes — önceki API adayını düzelt

[Resmî partner dokümanı](https://api-docs.levelshoes.com/) stok gönderimi (`POST stock-push`) ve sipariş/iptal/iade bilgilerinin partner sistemine iletilmesini anlatıyor. Tüm mağaza kataloğunu okuyacak bir GET API bu dokümanda doğrulanmış değil. Bu yazma uçları collector için kullanılmaz.

`integration@levelshoes.com` üzerinden CAPONE için salt okunur ürün kataloğu/akışı olup olmadığı, kadın ayakkabı ve ülke kapsamı, erişim şartları, şema, sayfalama ve toplam sayının teyidi gerekir. Mevcut storefront sayfalama API'sindeki HTTP 403, stok API anahtarıyla çözülebilecekmiş gibi sunulmaz.

## Erişim durumu ve kabul kapısı

Bu çalışma ortamında bu üç kaynağa ait veri akışı erişim değişkenleri bulunmadı. GitHub bağlayıcısı secret listesini okuyamadı; depoda credential bulunmadığı sonucuna varılamaz. Secret değerleri okunmadı ve bu belgelere yazılmadı. Başvuru, hesap oluşturma veya üçüncü kişilere mesaj gönderme yapılmadı.

Erişim sağlandıktan sonra gerçek örneğe göre adapter yazılır. Tam kapsam, model/renk kimliği, ürün URL'leri, gerçek görseller ve kaynak toplamı doğrulanır. Aynı modelin renkleri yalnız desteklenen stil kimliğiyle birleştirilir; başlık eşitliği tek başına yeterli değildir. NEW yalnız açık kaynak etiketi veya gerçek NEW koleksiyonu ile doğrulanır. Başarısız veya eksik akış eski sağlam veriyi değiştirmez. Fiyatlar raporlanmaz. Mevcut tek yenileme turuna bağlanır; ek bir program oluşturulmaz.
