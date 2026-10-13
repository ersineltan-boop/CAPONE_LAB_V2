# Otomatik ilerleme ve erişim bekleme süreleri

Mevcut tek yenileme turu Farfetch kategorileri için `collectFarfetchProgress`, Mule listesindeki ürünler için bağımsız ürün sayfası doğrulaması kullanır. Ek program, e-posta veya hesap başvurusu oluşturmaz.

- Bir çağrı en fazla 800 sayfa ve 20 dakika çalışır. Kaynağın yanıt süresine göre bu bütçe tamamlanmayabilir. HTTP isteği 15 saniyeyle sınırlıdır; yeni istek için kalan süre kontrol edilir.
- Her doğrulanmış sayfa checksum ile yazılır; cursor yalnız sayfa dosyasından sonra atomik güncellenir. Bütçe dolduğunda eksik kategori sayfaları yayına girmez. Ayrı ürün sayfası kanıtları, arşiv koruyan ve açıkça PARTIAL kalan yayın kapısından geçebilir. Erişim engelinde bu kaynağa yeni istek yapılmaz.
- Kaynak toplamı, sayfa boyutu ve ilk sayfanın ürün kimlikleri değişmemişse taze kayıt kaldığı yerden devam eder. Kayıt **bir saatten eskiyse** yeniden başlanır. Bu nedenle günler arayla yapılan turların eski sayfaları güncel katalog diye birleştirilmez. Cache, kısa aralıkla yeniden çalışma/kurtarma için de kullanılır; haftalık turlar arasında devam garantisi yoktur.
- Tüm sayfa cursor'ları/toplamları, sayfa başına kart sayıları, checksum'lar ve benzersiz URL toplamı doğrulanır. Son kaynak kontrolü de geçmeden FULL oluşmaz. NEW kanıtı bu genel katalogdan üretilmez.
- HTTP 403 için otomatik yeniden deneme en erken yedi gün sonra; HTTP 429 için en erken bir saat sonra yapılabilir. Bunlar yeni program oluşturmaz; uygun mevcut turda tek deneme yapılır. Collector/şema hatası 403 gibi sınıflandırılmaz. Kayıt eski sağlam katalog değildir; sadece ilerleme/teşhis bilgisidir.
- Otomatik ve manuel kurtarma workflow'ları ilerleme/bekleme kayıtlarını `actions/cache` ile saklar. Aynı run tekrarında yeni cache anahtarı kullanılır. Cache yoksa güvenle yeni koleksiyon başlar. `--retry-blocked`, erişim düzeltildikten sonraki açık manuel kurtarma için bekleme süresini atlar; erişim engelini aşmaz.

Kapı raporundaki `collectionProgress` ve `retryWindow` alanları, bekletilen kaynağı yeni çalışmış gibi göstermeden son deneme ve tekrarın izin verildiği zamanı bildirir. `COLLECTED_PENDING_PUBLICATION` ve `FULL` yayın doğrulaması değildir; mevcut PR, test ve production doğrulama kapıları geçerlidir.

## Farfetch ürün sayfası doğrulaması

- Otomatik tur kategori koleksiyonuna 8 dakika, bağımsız Mule ürün sayfalarına 12 dakika ayırır. Gerekirse Mule URL keşfi ayrıca en fazla 3 dakika sürer. Manuel ürün kontrolü en fazla 20 dakika ve 2.500 yeni ürün denetler; 15 saniyelik HTTP timeout ve tek geçici hata tekrarı korunur. En fazla iki sayfa aynı anda kontrol edilir; tekrarlar dahil tüm gerçek istek başlangıçları arasında ortak 900 ms sınır uygulanır. Kuyrukta bekleyen isteğin süresi/erişim engeli başlangıçtan hemen önce yeniden kontrol edilir.
- Liste gözlemleri yalnız URL keşfidir. Başka ürüne yönlenen sayfa, farklı ürün kimliği, yalnız erkek ürünü teklifi veya eksik ürün metadatası yayına giremez. Tamamlanmamış listenin kendisi FULL olamaz.
- Her yayımlanan ürünün kendi ProductGroup kimliği, kadın ürün URL'si, gerçek kaynak görselleri, doğrulama tarihi ve HTML SHA-256 kanıtı bulunur. Tavsiye edilen ürünlerin görselleri alınmaz. Beden stok bilgisi yoksa bilinmiyor bırakılır.
- Doğrulanan ürünler ve 404/410 sonuçları 24 saat taze sayılır. Cache checksum ile korunur. Cache kaybolursa arşivdeki eski ürün doğrulama tarihleri yalnız sıralama için kullanılır; taze ürün sayfası kanıtı yerine geçmez. Denenmemiş URL'ler önce kontrol edilir; haftalık turlarda eski ilk kayıtların süresi dolsa bile sıranın sonu sürekli geride kalmaz. Süresi geçmiş kayıt yeni doğrulanmış diye yayımlanmaz.
- Başarılı kategoriler ve ürünler ayrı arşiv eklemeleriyle yazılır. Ürün yayını her eski ürün URL'sini, model kimliğini, galeriyi ve dokunulmayan inceleme kaydını korur. İncelemeden çıkan ürünün eski ham galerisi ve inceleme geçmişi de saklanır.
- HTTP 401/403/429 veya HTTP 200/5xx ile gelen görünür insan doğrulama ekranı tüm Farfetch denemesini durdurur. İnsan doğrulamasında 5xx yeniden denenmez; kategori/ürün adresi değiştirilerek devam edilmez. Ortak bekleme süresi mevcut otomatik turda uygulanır.
- Ek program, affiliate başvurusu veya şirket mesajı oluşturulmaz. Bu adım bütün Farfetch kataloğunun veya yeni sezon iddiasının doğrulanması değildir.
