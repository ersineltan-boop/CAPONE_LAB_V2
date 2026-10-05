# Otomatik ilerleme ve erişim bekleme süreleri

Mevcut tek yenileme turu Farfetch için `collectFarfetchProgress` kullanır. Ek program, e-posta veya hesap başvurusu oluşturmaz.

- Bir çağrı en fazla 800 sayfa ve 20 dakika çalışır. Kaynağın yanıt süresine göre bu bütçe tamamlanmayabilir. HTTP isteği 15 saniyeyle sınırlıdır; yeni istek için kalan süre kontrol edilir.
- Her doğrulanmış sayfa checksum ile yazılır; cursor yalnız sayfa dosyasından sonra atomik güncellenir. Bütçe dolduğunda veya erişim engelinde kısmi veriler yayına girmez.
- Kaynak toplamı, sayfa boyutu ve ilk sayfanın ürün kimlikleri değişmemişse taze kayıt kaldığı yerden devam eder. Kayıt **bir saatten eskiyse** yeniden başlanır. Bu nedenle günler arayla yapılan turların eski sayfaları güncel katalog diye birleştirilmez. Cache, kısa aralıkla yeniden çalışma/kurtarma için de kullanılır; haftalık turlar arasında devam garantisi yoktur.
- Tüm sayfa cursor'ları/toplamları, sayfa başına kart sayıları, checksum'lar ve benzersiz URL toplamı doğrulanır. Son kaynak kontrolü de geçmeden FULL oluşmaz. NEW kanıtı bu genel katalogdan üretilmez.
- HTTP 403 için otomatik yeniden deneme en erken yedi gün sonra; HTTP 429 için en erken bir saat sonra yapılabilir. Bunlar yeni program oluşturmaz; uygun mevcut turda tek deneme yapılır. Collector/şema hatası 403 gibi sınıflandırılmaz. Kayıt eski sağlam katalog değildir; sadece ilerleme/teşhis bilgisidir.
- Otomatik ve manuel kurtarma workflow'ları ilerleme/bekleme kayıtlarını `actions/cache` ile saklar. Aynı run tekrarında yeni cache anahtarı kullanılır. Cache yoksa güvenle yeni koleksiyon başlar. `--retry-blocked`, erişim düzeltildikten sonraki açık manuel kurtarma için bekleme süresini atlar; erişim engelini aşmaz.

Kapı raporundaki `collectionProgress` ve `retryWindow` alanları, bekletilen kaynağı yeni çalışmış gibi göstermeden son deneme ve tekrarın izin verildiği zamanı bildirir. `COLLECTED_PENDING_PUBLICATION` ve `FULL` yayın doğrulaması değildir; mevcut PR, test ve production doğrulama kapıları geçerlidir.
