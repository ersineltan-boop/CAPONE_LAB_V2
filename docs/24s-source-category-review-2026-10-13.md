# 24S exact source-category review — 2026-10-13

This checkpoint records a bounded refresh of the official 24S women's shoes
catalog. It does not infer a silhouette from a product name or from the generic
`Shoes` collection.

## Source evidence

- The fresh catalog traversal completed all 12 pages at
  `2026-10-13T19:49:04.864Z`: 828 raw source rows, 827 accepted footwear rows,
  one policy exclusion (`ROW7CAR6BCK`) and no collector error.
- The 26 previously unresolved products were checked against their own product
  breadcrumb, with a hard limit of 50 detail requests. The run used 26.
- Exact product breadcrumbs resolved 25 rows: 11 `Oxfords & Derbies`,
  11 `Sneakers`, two `Ballet pumps` and one `Loafers`.
- `ROWQKQT7BRW` (`Ponti slip-ons`) still exposes only the generic `Shoes`
  breadcrumb. It remains quarantined as `unresolved category`; no category was
  guessed.
- Product breadcrumb evidence has precedence over an ambiguous or conflicting
  title. For example, the two CELINE `Jazz shoe in leather` rows remain on
  their old stable model IDs but now use the source's exact `Sneakers`
  classification. `LV Oxford` likewise follows its exact `Loafers` breadcrumb.

## Proposed delivery

- Archive: 860 products and 860 stable families, up from 837/837.
- Catalog output: 843 visible families; coverage remains `PARTIAL`, with
  860 ready records and one pending record.
- Compared with the main-branch baseline, no product URL, model-family ID,
  real gallery image, source product link or SKU identity was lost.
- The 23 newly observed products have neither a source NEW badge nor a verified
  NEW-collection claim, so none was marked NEW.

The source traversal being complete does not make the publication FULL: the
single unresolved Ponti row keeps the delivery `PARTIAL`.

## Release verification

PR180 passed its exact-head full test/build job and the same-SHA Vercel Preview
was READY before merge. The production deployment for merge
`3e90291897c61231ede6d299b697fe2f481eeaf5` is READY. The production alias
returned the 24S catalog shard over HTTP with 843 visible families and coverage
`{status: PARTIAL, ready: 860, pending: 1}`. The two CELINE Jazz rows are live as
`SNEAKER` on their pre-existing model IDs; `LV Oxford` is live as `LOAFER`, and
the pending Ponti SKU is not in the visible shard.
