# Independent catalog delivery pilot

The 11 November refresh collected data, passed tests and built the site, then stopped at the 90 MiB staging guard for `data/multibrand/products.json`. The existing collectors still have many direct readers/writers of that file. This pilot leaves them and the scheduled workflow intact while proving a migration path using real catalog data.

## Run it

From a clean checkout, run `npm ci`, then:

```sh
node --import tsx scripts/run-catalog-delivery-pilot.ts
VITE_CATALOG_SNAPSHOT_BASE=/pilot-store node node_modules/vite/bin/vite.js build --outDir logs/catalog-pilot/site
node --import tsx scripts/verify-catalog-delivery-pilot.ts logs/catalog-pilot/run-REPLACE_ME --http-only
```

Use the run directory printed in the report. Omit `--http-only` for Playwright after installing Chromium, or pass the executable path through `CATALOG_PILOT_CHROMIUM`. The HTTP test uses the actual catalog client against the local store; the browser test uses the built site. The app defaults to bundled data unless `VITE_CATALOG_SNAPSHOT_BASE` is configured. A configured client pins the manifest for its session; reopening the app reads a fresh manifest. Existing sessions require immutable parts to remain available.

## Measured on the 83-brand / six-marketplace baseline

| Check | Result |
| --- | --- |
| Raw products, round trip without row loss or reorder | 21,629 records, 92.12 MB original, 65 parts, largest 6.85 MB |
| Analyzed products, same round trip | 21,629 records, 77.79 MB original, 65 parts, largest 7.22 MB |
| Full readable catalog snapshot | 281.49 MB of uncompressed logical payload; largest object 4.14 MB; about 36 seconds locally |
| Replay one ALOHAS title edit while retaining Farfetch, BATA and Pretty Ballerinas | 2.07 MB of new objects, down from 72.68 MB without paging; about 33 seconds including regeneration |
| Scale replay: 160 raw brand buckets (61 present in the legacy raw file and 99 simulated) | 52,807 rows including existing marketplace rows, 186.12 MB, 164 parts, largest 6.85 MB; about 1.8 seconds to write locally |

The scale replay measures storage/serialization, not 160 live requests or source coverage. Existing independent brand archives mean the legacy raw file has fewer brand buckets than the live catalog. The separately estimated official-brand presentation payload at 160 brands is 153.55 MB, excluding marketplaces, Visual and old versions. Times are local and exclude collection and cloud transfers. The ALOHAS edit is synthetic and stored only under `logs/`; a rejected Farfetch candidate is modeled by retaining its exact last-good references. No new model, source approval or successful live refresh is claimed.

Publication writes hashed objects before atomically swapping the local manifest. A bad input leaves the old manifest readable. Fixed 256-row pages reduce rewrites for a title edit; an insertion may still shift later pages. The browser currently fetches all pages of a requested view, so splitting by itself does not reduce Visual transfer to a visitor. Next: measure request count and compressed transfer, use stable partition keys for inserts, and make Visual load progressively before increasing traffic.

## Production migration gates

1. Migrate legacy raw readers/writers to one source-aware archive interface; keep legacy read compatibility until all scheduled and manual collectors are verified. The current 90 MiB guard remains in place.
2. Wire approved per-source outputs into the existing coverage and last-good checks. Start with a few live source refreshes in a nonproduction store. Prioritize sources by freshness and maintain per-source lock, retry budget and cadence. This pilot does not change collection schedules.
3. Connect a dedicated nonproduction object store and a manifest write with a concurrency check (conditional update or serialized writer). Use separate write credentials, cache immutable objects, and retain previous snapshots for rollback. Only browser-deliverable catalog payload belongs in a public store; raw archives stay private. No provider or account was provisioned here.
4. Measure cloud transfer, CPU, requests and cache hit rate before choosing a provider. As a scenario, 100 GB of monthly billable Blob delivery at $0.05/GB is $5 in transfer alone before any plan allowance and other fees; region and actual traffic can change it. Cloudflare R2 Standard does not charge Internet egress and charges storage and requests. See [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Neither is an invoice estimate.
