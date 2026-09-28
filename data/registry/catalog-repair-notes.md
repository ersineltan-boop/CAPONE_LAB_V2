# Catalog delivery repair — 2026-09-28

PR #79 saved 668 Alexandre Birman products and activated the brand, but omitted all model-family delivery shards. `stage-brand-onboarding-data.ts` filters the allowlist through a file predicate; the model-families directory itself was rejected. The publication policy now accepts that explicitly allowed directory, and the frontend build rejects active brands with empty delivery shards.

The catalog was rebuilt from stored products while preserving historical wave delivery. Alexandre Birman yields 406 model cards.

4CCCCEES failed because its original Shopify product type and tags were discarded before a second footwear audit. Preserve those source fields and normalize internal category names when original evidence is absent. The official collection crawl found 193 accepted products / 151 families with no footwear leakage.

24S now has a paginated public-storefront collector and is included in marketplace refresh attempts. Run `npm run collect:24s-staging` to inspect its output. All 12 pages / 840 source entries were collected; 839 footwear records remain after excluding one explicitly mens-named item. No image URLs are invented and NEW is false for the initial baseline. Source coverage is FULL; publication is blocked by the existing taxonomy gate (712/839 classified). 24S remains inactive until that gate passes. Collection failure, duplicate pages, missing source state, missing images or incomplete pagination cannot replace last-good data.

Massimo Dutti remains in the adapter queue; its existing official-source 403/Akamai blocker is unchanged. Luxury brands are retained in both the onboarding queue and 24S collection.

Publication uses the existing `model-families/brands/` shard format. The seven original core shards and shared raw/analysis files remain byte-for-byte unchanged from main. The two new official-brand shards are appended to the manifest; the validated 4CCCCEES source snapshot is retained in `data/onboarding/validated/4ccccees.json`. Dataset rebuilds already preserve dedicated brand shards. This avoids retransmitting the 77–84 MB shared JSON files through the connector.
