# Romania market research snapshot

This directory is the Market Research sales-market dataset for Romania.

- `salesMarket` / `markets` = Romania (`RO`)
- `originCountry` is a separate field and is never treated as the sales market
- Retailers such as OTTER are evidence sources, not brand cards
- The current production catalog remains a dated seed/snapshot (`observedAt`)
- A failed or empty collect must not overwrite published or last-good data
- Product images are a dated observation map (`src/marketResearch/romania/observedImages.ts`)
- See `image-coverage.md` for brands/models with images vs documented source failures

## Papucei staging collector

`npm run collect:romania:papucei-staging` traverses every reachable page of the Papucei
women's footwear category, then visits every distinct product/color URL for the full gallery
and price. It writes an attempt report under `staging/` and publishes
`papucei-refresh-last-good.json` only through the common Issue #30 validation and atomic store.

The independently validated 60-product run establishes a conservative 50-product catalog
floor. A parser regression that incorrectly reports the first page as 20/20 is therefore
rejected even on a fresh machine; later catastrophic drops are also rejected against the
previous snapshot. Existing `papucei-last-good.json` remains untouched and is safely seeded
into the common format so PR #17 galleries are retained and unioned with later observations.

This is deliberately staging-only. It does not publish `catalog.json`, and it does not claim
that the other Romania sources in Issue #18 are complete.
