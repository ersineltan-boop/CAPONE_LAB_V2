# Farfetch category collection, 13 October 2026

Priority 3 continues without affiliate enrollment or contacting companies.

The automated Farfetch adapter now follows supported footwear category links
advertised by its official root listing. Each category has an isolated,
checksummed, atomic checkpoint, the existing one-hour freshness limit and
strict page/card/total/final-source reconciliation. Old root checkpoints cannot
be joined to category checkpoints, even when their first products match.

Temporary transport failures (HTTP 0) and server failures (5xx) get at most one
retry within the existing time budget. HTTP 403/429 stops the entire source;
the adapter does not probe another category after an access denial. The source
run remains bounded to 20 minutes. Saved progress is collection evidence,
not a publishable incomplete catalog.

Category overlaps are deduplicated by product URL. All discovered supported
categories must complete, their URL union must equal the authoritative root
total, and the final root count/first-page identity must still match. Otherwise
the adapter returns PARTIAL with no publishable products and preserves the
previous catalog. Marketplace publication quality/retention gates are unchanged.

## Live evidence

- Espadrilles: six listing pages plus final source check; **489/489 products**,
  FULL for this category, zero errors (09:45:56–09:46:21 UTC).
- Ballerinas: eight pages persisted, **768 cards**; page 9 changed the total
  from 2,513 to 2,512. PARTIAL, no catalog publication. A temporary page-8
  timeout recovered with the single bounded retry.
- Previous all-shoes crawl: page 1 total 62,607 versus page 7 total 62,600.

This demonstrates an independently complete small category, not complete
Farfetch coverage. Priority 3 remains open until the whole source reconciles;
Level Shoes and Free People access restrictions remain unresolved.

Validation: 1,065 tests across 132 files and production build passed locally.
Exact-head GitHub CI and Vercel preview must pass before merge.
