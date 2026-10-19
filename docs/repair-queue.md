# CAPONE repair queue

The owner requested autonomous continuation until they say stop, on
13 October 2026. Keep fixes in separate branches/PRs. Merge only after full
tests and production build pass on the exact PR head and Vercel Preview is
READY. Verify production READY for the merge SHA and the relevant live data.
Preserve every archived family ID, product URL and real gallery. Do not create
NEW claims from collection time. Do not sign up for affiliates, email firms,
change secrets, bypass access controls or use force-push. Cursor must remain
on the queue, but an unavailable Cursor session must not stop independent work.

## Original priorities

1. Publication/CI gate: fixed in PR169. Exact-head full CI is mandatory.
2. Massimo Dutti: fixed and published in PR170, 116 fresh products and 119
   archived/live models. Level Shoes pagination/budget logic fixed; full
   refresh remains blocked by source HTTP403.
3. Marketplace completeness: category admission and thin-refresh archive
   retention are fixed and live in PR178 (merge
   `127a2253178473a9e36e2440dbdf240eb041c6e2`). Exact-head 1,128 tests in 138
   files and production build passed; Preview and production are READY for the
   corresponding SHAs. Live HTTP200 shards match the prepared files exactly:
   Farfetch 3,406 visible models, 3,504 archived products, 3,498 families and
   446 pending; 24S 820 visible models, 837 archived products/families and
   26 pending. Both remain PARTIAL. Zero old IDs, URLs, gallery images or
   size/SKU identities were lost; no NEW claim was invented.
   Farfetch's bounded 17:28–17:48 UTC collection completed espadrilles (496),
   slippers (613) and mules (2,009). Remaining scopes failed reconciliation,
   overlapped or timed out and were not admitted. No collector is still running.
   A fresh bounded 24S follow-up at `2026-10-13T19:49:04.864Z` completed all
   12 source pages (828 raw, 827 accepted, one policy exclusion, no collector
   error) and checked the 26 product pages. Exact product breadcrumbs resolved
   25 rows; the proposed archive is 860 products/families and the built catalog
   has 843 visible families. `Ponti slip-ons` (`ROWQKQT7BRW`) exposes only the
   generic `Shoes` breadcrumb and remains the sole pending row, so publication
   remains PARTIAL. The 837-row baseline lost no URL, model ID, gallery, source
   product link or SKU identity, and none of the 23 new rows was marked NEW.
   This follow-up is live via PR180 (merge
   `3e90291897c61231ede6d299b697fe2f481eeaf5`): exact-head full CI and Preview
   passed, the merge-SHA production deployment is READY, and the production
   alias returned the 24S shard with 843 visible families and coverage
   `PARTIAL / ready 860 / pending 1`. The corrected Jazz and LV Oxford rows use
   the exact source categories while retaining their old IDs; Ponti is absent
   from the visible shard.
   A fresh bounded Farfetch follow-up at `2026-10-13T20:41:56.567Z` completed
   the official Slippers (614/614) and Espadrilles (496/496) scopes with no
   collector or access error. The missing rule was deterministic: exact
   official Farfetch category paths were not being used when an opaque product
   title omitted the silhouette. The prepared delivery now has 3,950 products,
   3,944 families and zero pending rows while remaining honestly PARTIAL for
   the marketplace as a whole. Compared with the 3,504-product/3,498-family
   baseline, it loses zero archived URL, family ID, real image, size/SKU or
   variant identity; no old NEW flag changed and no new row was marked NEW.
   Full validation passes (1,140 tests in 138 files and production build).
   This follow-up is live via PR182 (merge
   `1393c7e676ba252ffece1429c8632d11a6243695`): exact-head CI and the same-SHA
   Vercel Preview passed before merge, and the merge-SHA production deployment
   is READY. The production alias returned the Farfetch shard over HTTP with
   3,852 visible families and coverage `PARTIAL / ready 3950 / pending 0`.
   On 14 October, a fresh bounded Oxford/Derby traversal identified why this
   small scope previously failed reconciliation: the George Cox
   `17598550` D-ring creepers were incorrectly excluded as a ring, leaving
   536 converted products for 537 source cards. A narrow footwear vocabulary
   fix recognizes creepers while regression tests continue excluding real
   rings and bags. A new atomic/checksummed epoch at
   `2026-10-14T08:17:54.328Z` reconciled 537 unique URLs and 537 products over
   six listing pages plus the final unchanged first-page/count check, with no
   access or collector errors. The accepted PARTIAL marketplace proposal has
   4,487 archived products, 4,481 families and zero pending. The 3,950-product
   baseline loses no URL, family ID, gallery image, size/SKU, variant identity
   or NEW state; none of the 537 additions was marked NEW. Full local tests:
   1,141 in 138 files; catalog, TypeScript and Vite production build passed.
   The prepared Farfetch shard contains 4,389 visible families with
   `PARTIAL / ready 4487 / pending 0`.
   Released through PR184: exact-head CI and same-SHA Preview READY passed
   before merge. Production is READY for merge
   `827d37905652bfe4175e5c898cf25765ab112d63`. The live HTTP200 Farfetch shard
   is byte-identical to the prepared shard: 4,389 visible families,
   `PARTIAL / ready 4487 / pending 0`. Recovered George Cox `17598550` is
   visible as OXFORD_DERBY with both actual source images. Remaining source
   scopes are still incomplete; do not label the whole marketplace FULL.
   On 14 October, a bounded official Flip-flops/Slides traversal saw 1,145
   source cards over 12 pages. Two source-listed products (`Havaianas`
   `39058882` and `Coperni` `33883777`) were initially excluded because
   their real footwear titles include `Top` and `belt`. The narrow footwear
   title support now recognizes flip-flops and retains the clothing/accessory
   exclusions. A fresh atomic/checksummed epoch at
   `2026-10-14T13:21:17.214Z` reconciled 1,145 source URLs to 1,145
   products and rechecked unchanged count/first-page identity without access
   errors. Policy excludes 116 items; the verified category has 1,029
   eligible rows. The preserving proposal grows the Farfetch archive from
   4,487 products / 4,481 families to 5,504 products / 5,497 families,
   pending zero. It adds 1,017 archived products without losing any previous
   URL, family ID, real image, size/SKU or NEW state; no addition is marked NEW.
   Released via PR186. Exact-head full CI (1,142 tests and production build)
   and same-SHA Preview READY passed before merge. Production is READY for
   merge `ec65c699ebf5b4d6c501658ebe4769f623922fb5`. The live production
   alias returned the Farfetch shard with HTTP200, byte-identical to the
   prepared shard: 5,405 visible families, `PARTIAL / ready 5504 / pending 0`.
   Both recovered source products are present. Only this category is FULL;
   the marketplace remains PARTIAL.
   On 19 October, the official root advertised 64,338 products but the
   current reader returned zero cards: Farfetch now wraps the 96-card
   ItemList in JSON-LD `@graph`. Support for that observed structure retains
   the old direct-ItemList format and ignores breadcrumbs. Actual source
   observations also exposed false exclusions for Lipstick loafers/ballet
   flats, Jil Sander ring ballerinas, the `Jeans` word in brand URL prefixes,
   and a bag-shaped ornament on explicitly named pumps. Narrow evidence rules
   keep the original names, brands, URLs and actual images while continuing
   to reject real clothing, cosmetics, bags and jewellery. Brand-prefix review
   keeps a full URL so `Baguette` styles do not trigger a bag-handle shortcut.
   New checksummed page parts retain actual source items, reclassify them
   with current rules and preserve a conversion-failed epoch for review;
   stale epochs, mismatched source URLs, overlapping pages and damaged parts
   still cannot publish. Stored source reviews retain the exact official
   category evidence. This code repair contains no new catalog delivery.
   Bounded fresh category follow-up is staged separately; source counts have
   moved during traversal, and whole-marketplace completeness is unverified.
   Local validation passed: 1,149 tests in 138 files, catalog/market-research
   build, TypeScript and Vite production build. Exact-head CI, Preview and
   production verification remain pending.
   Next independent work: keep Ponti pending unless stronger exact source
   evidence appears, then continue the remaining bounded Farfetch scopes
   without treating stale checkpoints as fresh proof.
   Free People remains blocked by its official source access check.
4. Casadei count mismatch: fixed and live in PR176 (merge
   `13744a808b3e3f96e4e7a2a375f9b9b1f4d70521`). Two complete identical traversals
   account for 356 source slots, 355 identities, one duplicate, 329 eligible
   footwear products and 26 bags. Exact-head 1,110 tests/build and Preview passed.
5. Source quality: current Schutz public catalog has no missing-gallery row.
   Webster Tyler was reviewed against its exact own gallery, corrected to BOOT,
   and its preserving full refresh is live in PR177 (merge
   `c3fce3af8e7e8d5709255309c898956216666b62`): 269 visible models, no pending rows,
   1,118 passing tests, full staging/CI/Preview and production READY; live shard
   HTTP200 with the original Tyler ID now BOOT and its three images. Browns Autry
   `autry-medalist-low-sneakers-in-leather-olsaw2600174895` still has zero source
   images and no manufacturer style/color identity; do not substitute a similar
   Medalist. Source quality reviews and retention proof are recorded separately.
6. Cursor: the current cloud browser reaches a persistent Cloudflare security
   verification at `authenticator.cursor.sh`; one reload failed. No agent was
   started. Do not retry, create keys, expand permissions, request passwords or
   evade this block. It requires an authorized, usable session to continue.

## Continue safely

Read fresh main, open PRs and the latest queue/docs/reports first. Finish an
existing validated repair before opening a duplicate. Keep each collection
bounded, use shared source retry windows and atomic checksummed progress.
HTTP401/403 and visible human verification stop that source; do not retry
before the recorded seven-day window, including the 13 October Level/Free
People block. HTTP429 waits at least one hour. Skip unavailable sources and
continue independently repairable work. No newly observed blocked/preserved
source can be claimed as refreshed or FULL. Old progress is not fresh proof.

Report in short plain Turkish, one concrete result or blocker at a time.
Do not repeatedly report the same unchanged block. Update this queue after a
verified release; leave blocked and partially completed work explicit. Existing
Sunday/Wednesday data refresh schedules are separate from repair work.
