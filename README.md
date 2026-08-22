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
