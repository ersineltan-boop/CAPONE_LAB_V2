# Kaydedilen araştırmaların güvenli cihaz eşitlemesi

Issue: [#205](https://github.com/ersineltan-boop/CAPONE_LAB_V2/issues/205)
Durum: tasarım. Bu belge uygulama kodu, hesap açılışı, ücretli servis veya canlı yayın değildir.
Tarih: 2026-11-10
Taban: `origin/main` @ `26e770a`

Otomatik eşitleme bugün çalışmıyor. Arayüz de bunu söylüyor. Bu belge, kişisel favori ve notları oturumsuz bir buluta yazmadan önce gereken en küçük güvenli yolu sabitler. Onay gelmeden uygulama kodu yazılmaz, servis açılmaz, `main` birleştirilmez ve production deploy edilmez.

## Mevcut sistem

Kayıtlar yalnızca tarayıcının `localStorage` alanındadır. Telefon ve bilgisayar ayrı depolardır; Vercel deploy'u bu veriyi taşımaz.

| Veri | Anahtar | Şekil |
| --- | --- | --- |
| Kaydedilen ürün, incelendi, not | `capone-lab-v2-research-state-v1` | `{ version: 1, updatedAt, states: { [modelFamilyId]: { modelFamilyId, savedAt, reviewedAt, note } } }` |
| Favori marka | `capone-lab-v2-brand-favorites-v1` | `{ version: 1, updatedAt, brands: { [brandId]: { brandId, savedAt } } }` |

Yazan kod: `src/research/researchStateRepository.ts`, `src/research/brandFavoritesRepository.ts`. Okuyan ekran: `src/components/saved/SavedProducts.tsx`.

JSON yedek (PR #200, `src/research/portableBackup.ts`) korunur. Biçim `capone-research-backup` sürüm 1'dir. Dışa aktarma yalnızca `savedAt`, `reviewedAt` veya `note` dolu ürünleri ve kayıtlı markaları yazar. İçe aktarma birleştirmesi eklemelidir:

- Üründe `savedAt` ve `reviewedAt` için yerel değer doluysa gelen değer yok sayılır (`??`). Yerel boşsa gelen kabul edilir.
- Notta yerel metin varsa gelen metin atılır. Arayüz kaç notun yerelde kaldığını sayar; gelen metni saklamaz.
- Markada aynı `brandId` varsa gelen kayıt atlanır.
- Aynı dosyanın ikinci içe aktarımı yeni satır açmaz. Kimlik, `modelFamilyId` / `brandId` alanıdır.

Bu birleştirme silmeyi taşımaz. `savedAt: null` hem "hiç kaydedilmedi" hem "kayıt kaldırıldı" demektir. Marka favorisinde kaldırma, anahtarı siler. Yedek dosyasında tombstone yoktur. Bu yüzden mevcut JSON aktarımı otomatik eşitlemenin yerine geçmez ve olduğu gibi kalır.

Kimlik doğrulama yoktur. `package.json` içinde hesap kütüphanesi yok. `api/`, `supabase/` veya kullanıcı oturumu yoktur. `src/operator/v2/executor/authorization.ts` operatör politikasıdır; son kullanıcı hesabı değildir.

Deploy statiktir. `vercel.json` production komutu `npm test && npm run build` çalıştırır. `README.md`: site GitHub `main` üzerinden Vercel'e gider. Günlük veri yenilemesi GitHub Actions'tadır ve katalog verisi içindir. `OPENAI_API_KEY` yalnızca yerel CLI'da kullanılır. Kullanıcı kaydı için sunucu, veritabanı veya gizli anahtar yoktur.

Arayüz metni doğru: "Kayıtlar bu tarayıcıda saklanır. Başka cihazda görmek için yedeği o cihazda içe aktarın." Eşitleme çalışmadığı sürece bu cümle "eşitlendi" diye değişmez.

## Neden şimdi kod yazılmıyor

Kabul kriteri aynı hesabın iki cihazda aynı kayıtları görmesi ve farklı hesapların birbirini görmemesidir. Bunu sağlayacak oturum yok.

Oturumsuz yazılabilecek yerler güvenli değildir:

- Repoya veya herkese açık bir JSON dosyasına yazmak kayıtları herkese açar.
- İstemciye gömülü bir yazma anahtarı, anahtarı ele geçiren herkese yazma verir.
- Tek paylaşılan parola veya bağlantı, "farklı hesaplar birbirini görmez" ve "yeniden giriş" kriterini karşılamaz.
- Vercel production'a kişisel not basmak, günlük katalog yenilemesiyle aynı yolu kullanır ve geri alınması zordur.

Bu yüzden bulut yazan kod, hesap ve satır düzeyi erişim onayı olmadan eklenmez.

## Önerilen en küçük yol

Supabase, ücretsiz planda: e-posta ile giriş, Postgres, satır düzeyi güvenlik. Uygulama Vercel'de statik kalır. İstemci yalnızca herkese açık anon anahtarı görür. Servis rolü anahtarı, veritabanı parolası ve JWT sırrı repoya ve tarayıcıya girmez. Bunlar Supabase proje ayarında ve gerekirse Vercel ortam değişkeninde durur; bu PR hiçbir ortam değişkeni eklemez.

Tek tablo yeter. Katalog, marka toplayıcıları, BOBBIES ve JONAK bu tablonun dışındadır.

```sql
create table public.research_documents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  document jsonb not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.research_documents enable row level security;

create policy research_documents_own
  on public.research_documents
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`anon` ve `authenticated` dışında tabloya yetki verilmez. Politikayı ikinci bir test kullanıcısıyla doğrulamadan önizleme başarılı sayılmaz.

Belge şekli, yerel v1 kaydının üstüne saat ve silme izi ekler. Kimlikler değişmez.

```ts
interface ResearchSyncDocument {
  format: "capone-research-sync";
  version: 1;
  products: Array<{
    modelFamilyId: string;
    savedAt: string | null;
    unsavedAt: string | null;
    reviewedAt: string | null;
    unreviewedAt: string | null;
    note: string | null;
    noteUpdatedAt: string | null;
    noteConflict: string | null;
  }>;
  brands: Array<{
    brandId: string;
    savedAt: string | null;
    unsavedAt: string | null;
  }>;
}
```

`revision` tablo sütunundadır. Yazma, `update ... where user_id = auth.uid() and revision = beklenen` ile olur. Eşleşme yoksa istemci yeniden okur, birleştirir ve tekrar dener. Sessiz üstüne yazma yoktur.

### Çevrimdışı ve çevrimiçi

Yerel kopya önce yazılır. Ağ yokken kayıt ekranı çalışır. Durum metni "Eşitleme bekliyor — kayıtlar bu cihazda duruyor" olur. Başarı metni yalnızca sunucunun yeni `revision` değerini okuması sonrası gösterilir.

Çevrimiçi akış: yerel değişiklik, uzak belgeyi çek, alan birleştir, revision tutuyorsa yaz. Ağ hatası yerel kaydı silmez ve başarı göstermez. Üst üste iki cihaz yazdıysa ikinci yazma revision şartında düşer; düşen cihaz birleştirip yeniden yazar.

Oturum yokken metin bugünkü cümle olarak kalır. JSON yedekle ve içe aktar düğmeleri durur.

### Çakışma

Alan saatine göre son yazan kazanır. Eşit saatte kayıt korunur: kaydetme, kaldırmaya; incelendi, incelenmediye üstün gelir. Böylece belirsiz saatte veri kaybı, kaydı silmek yönünde olmaz.

Not ayrıdır. İki cihaz aynı notu, son ortak revizyondan sonra değiştirdiyse metinlerden biri seçilip diğeri atılmaz. Daha yeni `noteUpdatedAt` görünen not olur, diğeri `noteConflict` alanında kalır. Arayüz iki metni gösterir ve kullanıcı seçene kadar eşitleme "çözülmedi" der. Seçim yeni bir `noteUpdatedAt` yazar ve `noteConflict` alanını boşaltır.

Marka favorisi de `savedAt` / `unsavedAt` saatiyle birleşir. Kaldırma, anahtarı yok etmek yerine `unsavedAt` bırakır. Böylece diğer cihazdaki eski "favori" geri gelmez.

JSON v1 içe aktarma bu PR'da değişmez. Sonraki uygulama PR'ında içe aktarma, aynı alan birleştirmesini kullanır. Bugün düşen gelen not, `noteConflict` olarak tutulur. v1 dosyasını okuyan `parsePortableBackup` aynı hatalarla reddetmeye devam eder. İkinci içe aktarma, aynı kimlik ve aynı alanlarda kayıt sayısını artırmaz.

### İlk taşıma

Taşıma tekrar çalıştırılabilir.

1. Kullanıcı bu tarayıcıda ilk kez giriş yapınca sorulur: "Bu cihazdaki mevcut kayıtlar bu hesaba taşınsın mı?"
2. Ret: anonim `localStorage` anahtarları durur, buluta yazılmaz, hesap belgesi ayrı bir anahtara iner.
3. Kabul ve bulut boş: v1 kayıtlar belgeye çevrilip bir kez yazılır. Not saati, v1'de alan saati olmadığı için dosyanın `updatedAt` değeridir. Bu sınır belgede durur; sonraki düzenlemeler kendi saatini yazar.
4. Kabul ve bulutta kayıt var: alan birleştirme uygulanır, sonra tek yazma yapılır. Yerel veri silinmez.
5. Başarılı yazmadan sonra `capone-lab-v2-research-sync-upload-v1:{userId}` işaretlenir. İşaret, yazma başarısızsa konmaz. İşaret varken aynı yerel kayıt yeniden eklenmez. Kimlik zaten `modelFamilyId` / `brandId` olduğu için işaret bozulsa bile ikinci taşıma yeni satır açmaz; alan birleştirir.
6. Hesap değişince önceki hesabın önbelleği gösterilmez. Anahtar `capone-lab-v2-research-state-v2:{userId}` olur. Eski v1 anahtarları silinmez.
7. Çıkış ve yenileme yerel hesabı ve bulut kaydını silmez.

Boş v1 satırları (kayıt, inceleme ve not yok) taşınmaz. Yedek dosyasının 5 MB ve 50.000 kayıt tavanı, bulut belgesi için de geçerlidir. Tavan aşılırsa yazma yapılmaz, yerel kayıt durur, arayüz hata gösterir.

### Maliyet

Tek kullanıcı ve birkaç megabaytlık belge Supabase ücretsiz kotasının içindedir: 500 MB veritabanı, 5 GB çıkış, 50.000 aylık aktif kullanıcı. Beklenen maliyet 0 ABD doları / ay. Pro plan yaklaşık 25 ABD doları / ay'dır ve bu iş için açılmaz. Kota dolarsa uygulama durur; ücretli plana kendiliğinden geçilmez. Vercel tarafında yeni ücretli kaynak yoktur.

### Gizlilik ve geri alma

- Anon anahtar tarayıcıda olabilir. İşe yarar çünkü politika `auth.uid() = user_id` şartını zorlar.
- Servis rolü anahtarı istemciye, Git'e ve bu PR'a girmez.
- `research_documents` dışında katalog veya toplayıcı tablosu açılmaz.
- Bayrak `VITE_RESEARCH_SYNC` varsayılanı kapalıdır. Kapalıyken ağ çağrısı yoktur.
- Bayrağı kapatmak veya tabloyu düşürmek `localStorage` kayıtlarını silmez.
- JSON yedek, bulut kapalıyken de çalışır.
- v1 anahtarlarının silinmesi ayrı bir iştir ve iki başarılı eşitlemeden önce yapılmaz.
- Geri alma: bayrağı kapat, preview'i doğrula, production'a ancak bundan sonra ayrıca onayla. Bu PR production'a gitmez.

## Bilinçli olarak yapılmayanlar

- Ortak parola, herkese açık dosya, GitHub issue veya katalog JSON'u içinde kişisel not.
- İstemcide gizli anahtar.
- Mevcut marka toplayıcıları, registry, scheduler, katalog verisi, BOBBIES (#204) ve JONAK (#201).
- PR #200 yedek biçimini bozmak.
- Eşitleme yokken arayüzde başarı iddiası.
- Onaysız Supabase projesi, Vercel ortam değişkeni, merge veya production deploy.

## Onay bekleyen kararlar

Uygulama kodu bu kararlardan sonra, ayrı bir PR'da başlar.

1. Ücretsiz Supabase projesi açılsın mı? Başka bir sağlayıcı isteniyorsa bu belgedeki RLS, tombstone ve revision şartları onda da aranır.
2. Giriş e-posta sihirli bağlantı mı olsun, e-posta ve parola mı?
3. İlk girişte bu tarayıcıdaki eski kayıtlar hesaba sorularak taşınsın mı?
4. Çakışan notlar otomatik silinmesin ve kullanıcı seçene kadar iki metin de tutulsun mu?
5. Preview doğrulaması production'dan ayrı mı kalsın? Bu belgenin varsayılanı: evet.

## Sonraki PR'ın kabul testleri

Bu PR bu testleri çalıştırmaz; sonraki uygulama PR'ı çalıştırır.

- Alan birleştirme: çevrimdışı kaydetme, diğer cihazda kaldırma, aynı notun iki değişikliği, eşit saatte kaydın korunması.
- İlk taşıma iki kez çalışınca çift kayıt olmaması. v1 JSON içe aktarmanın hâlâ v1 dosyayı kabul etmesi.
- Ağ kesilince yerel kaydın durması ve arayüzün başarı yazmaması.
- İki hesapla RLS: her hesap yalnızca kendi satırını okur ve yazar.
- Yenileme ve yeniden giriş veriyi tutar. Çıkış diğer hesabın önbelleğini göstermez.
- `npm test` ve `npm run build` geçer.
- Preview'de telefon ve bilgisayar aynı hesapla, canlı uçtan uca, production'a alınmadan doğrulanır.
