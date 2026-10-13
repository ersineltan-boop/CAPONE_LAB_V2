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
   This is not live until the exact PR head also has green CI and a READY
   Preview, followed by merge-SHA production and live Farfetch shard checks.
   Next independent work after release: keep Ponti pending unless stronger
   exact source evidence appears, then continue the remaining bounded Farfetch
   scopes without treating stale checkpoints as fresh proof.
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
