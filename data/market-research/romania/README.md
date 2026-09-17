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
and price. It writes an attempt report under `staging/` and updates `papucei-last-good.json`
only when pagination is terminal and `missing === 0`.

This is deliberately staging-only. It does not publish `catalog.json`, and it does not claim
that the other Romania sources in Issue #18 are complete.
