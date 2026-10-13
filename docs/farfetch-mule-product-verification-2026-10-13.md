# Farfetch Mule product verification, 13 October 2026

A rolling Mule listing can finish its pages and still fail final snapshot
reconciliation. Listing observations now discover URLs only. Each published
record independently matches its requested women's product ID to its own
public ProductGroup, women-linked variant offers and declared gallery. Images
from recommended products are excluded; no photo URL or NEW claim is invented.

## Verified delivery

- Discovered source URLs / distinct item IDs: 2,000 / 2,000; every URL checked.
- Independently verified product pages: 1,999.
- The old UGG URL for item 40230089 redirects to item 37884965, which is already
  independently verified in this cohort. Its different identity is not assigned
  to the old item. The source cohort has 1,999 current verified identities.
- Source root reported 62,811 footwear records at publication.
  This is context, not proof of whole-marketplace completeness.
- Policy exclusions: 32; quality-eligible fresh records: 1,967.
- Archived delivery products: 1,262 → 3,175;
  1,913 newly ready URLs, with existing products refreshed in place.
- Delivery model families: 1,261 → 3,169.
- Frontend Farfetch families: 1,169 → 3,077; zero previous visible IDs missing.
- Pending quality records: 761 → 754. Seven previously
  pending records are now eligible; their raw galleries and history survive.
- Missing previous URLs, gallery images or family IDs: **zero**. New ready
  records with an invented NEW badge: **zero**.

Publication remains explicitly PARTIAL. Other Farfetch categories, Level Shoes
and Free People are not declared complete by this cohort. No affiliate signup,
company messages or additional schedule is created.

## Bounded continuation

The existing refresh cycle allocates 8 minutes to categories and 12 minutes
to product pages. Product checks have at most two active requests, one shared
900 ms minimum between starts (including retries), a common product limit and
one deadline. Queued requests recheck access/budget immediately before starting.
Any access denial or visible human-verification page stops new requests and
rejects this source's publication. Active requests are drained before failure
returns. Root transport/ordinary server errors get one normal retry; root
access challenges are never retried.

Checksummed per-item records and confirmed 404/410 results are fresh for 24
hours. Unvisited URLs precede old attempts; published verification timestamps
still order work after cache loss but never replace fresh document proof.
Accepted document hashes, IDs and check dates are persisted in the report.
Archive preservation, image/taxonomy checks, brand exclusions, price hiding,
exact-head full CI, preview and production verification remain mandatory.

Validation: 1,101 tests / 135 files passed on the final delivery; TypeScript and
production build. Exact-head GitHub CI and preview must pass before merge,
then production HTTP/shard/UI checks verify the same delivery.
