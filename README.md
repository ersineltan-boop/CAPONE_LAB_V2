# CAPONE LAB

Kadın ayakkabısına özel global trend istihbarat platformu.

Vite + React + TypeScript frontend. Arayüz verisi `data/` altındaki JSON dosyalarından gelir. Collector, analiz ve vision işlemleri Node CLI scriptleri olarak local çalışır; OpenAI secret yalnızca bu CLI tarafından kullanılır.

## Local development

```bash
npm install
npm run dev
```

Tarayıcı: http://localhost:5173

## Production build

```bash
npm run build
```

Çıktı: `dist/`

Frontend statik olarak deploy edilebilir (ör. Vercel). `.env` GitHub’a gönderilmez.

## Cloud daily refresh

Production, GitHub `main` üzerinden Vercel’e bağlanır. Günlük veri yenilemesi GitHub Actions ile çalışır; `OPENAI_API_KEY` gerekmez. Radar, OpenAI Vision ve taxonomy vision bu pipeline’da çalışmaz.

```bash
npm run refresh:cloud
```

Schedule: her gün 07:00 Türkiye saati (`cron: 0 4 * * *`, UTC+3). Manuel koşum: Actions → **CAPONE daily refresh** → Run workflow.

Refresh + `npm test` + `npm run build` başarılı olursa bot `chore(data): automatic CAPONE daily refresh` commit’ini `main`’e push eder. Test veya production build düşerse commit/push yapılmaz; mevcut Vercel production değişmez.

### Storage scale

`data/multibrand/model-families.json` şu anda ~55 MB. Bu görev Git LFS veya yeni bir storage tasarımı eklemez. CAPONE yüzlerce marka/marketplace’e ölçeklenmeden önce üretilen katalog ve collector state Git history’den durable cloud/object storage’a taşınmalıdır; aksi halde repo şişer ve clone/CI yavaşlar.
