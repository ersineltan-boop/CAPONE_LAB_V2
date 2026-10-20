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
   Released via PR188: 1,149 local tests in 138 files and production build
   passed; exact-head full CI and same-SHA Preview READY passed before merge.
   Production is READY for merge
   `595555a65bdf2d2e79fc7fead18bb2b5e3bb4933`; live HTTP200 Farfetch data is
   byte-identical to the safe baseline (5,405 visible, ready 5,504, pending 0).
   This verifies the code release, not completion of the remaining source scope.
   The follow-up keeps source capture separate from taxonomy admission:
   structurally complete source observations with contradictory type names
   carry a null category into quarantine, retaining their actual URL and
   gallery. They are not admitted as footwear. Exact official Trainers and
   Ballerinas scopes resolve opaque titles only when no explicit silhouette
   was already classified. Fresh unchanged first pages can now resume across
   count drift, with an atomic cursor rollback/re-read of the old last page
   when necessary. A final count change gets at most one bounded tail
   reconciliation; changed identities, damaged/overlapping pages and stale
   epochs still block FULL. Source requests use the same official URLs and a
   standard cache-revalidation header, with no access bypass. Root completeness
   requires the final source count and full unique category union to agree;
   category epochs which expire during aggregation cannot certify FULL.
   Source page 262 returned complete valid data on a bounded diagnostic after
   an interrupted response, so no hard pagination ceiling has been established.
   On 19 October, a bounded 244-request follow-up completed seven official
   categories with fresh atomic/checksummed epochs: Pumps 6,257, Ballerinas
   2,622, Loafers 2,949, Mules 2,070, Oxford/Derby 549, Slippers 636 and
   Espadrilles 538. Final source rechecks ran from 14:15:04Z to 14:25:47Z;
   their union contains 15,576 distinct source products (15,473 policy-eligible).
   Publication accepted these seven independently verified scopes as PARTIAL,
   with zero pending. The preserving proposal grows the archive from 5,504
   products / 5,497 families to 17,350 products / 17,289 families. All previous
   product URLs, family IDs, real galleries, family variant URLs, sizes/SKUs,
   variant identities and NEW states are retained; none of the 11,846 additions
   is marked NEW. Full local validation passed: 1,156 tests in 138 files,
   catalog and market-research generation, TypeScript and Vite production build.
   Released through PR189. Exact-head full local validation and CI run
   39272098330 passed; Preview dpl_4L45JcRw2k6QUysFFmQDF7kdbCfb was READY
   for head 9dbaf43b6592977d020f729da2aa8f9653177db8 before merge against
   unchanged main. Production dpl_4aaRYd2S5dPQEX1Q2FNRA5fWcR53 is READY for
   merge ff617dc59a215e7468bc08f85fb0ceddfa0ef501. The live HTTP200 Farfetch
   shard is byte-identical to the prepared data: 17,197 visible families,
   PARTIAL / ready 17,350 / pending 0; SHA256
   e4563c41279abebded6c013cfa83c11b10d539737531b3fe1b04c0c846b11f6b.
   Every one of the 5,405 prior visible model IDs, galleries and variant URLs
   remains in the live shard. This verifies seven scopes, not the whole source.
   Four categories remain unverified: Trainers had a changed final-page card
   count; Boots, Sandals and Flip-flops/Slides had repeated/overlapping pages.
   Those epochs were withheld, not counted FULL. Offline review also found
   108 duplicate trainer URLs in the saved prefix. A later bounded source
   diagnostic returned HTTP200 and the correct 26-card page 309 against its
   then-current 29,594 total, so there is no demonstrated pagination ceiling
   or access denial. Rolling source pagination must reconcile unique URLs and
   counts before these remaining scopes or the whole marketplace can be FULL.
   The next fresh bounded traversal exposed seven source-listed boots falsely
   excluded by construction words: Prada boots/booties with pouch (17303590,
   37427485, 26345853, 33075116), Prada 40mm pouch boots (28538715), UGG Classic
   Sweater Letter boots (27668045), and Maison Mihara Yasuhiro quilted bag-detail
   boots (32566851). Narrow rules require Shoes type, verified collection and
   the exact official Boots scope, then strip only the observed construction
   phrase from classification signals. Actual names, URLs and galleries are
   untouched; independent bag/pouch/clothing evidence still excludes. Regression
   checks cover actual source styles and adversarial bags, pouches, sweaters,
   wrong collection evidence and stored-product review. This is a code-only
   follow-up, released via PR190. Exact-head 1,157 tests and production build,
   CI run 39274397903 and same-SHA Preview READY passed before merge. Production
   dpl_bUxvxRfPwuvto9mpKiBXUiG4WWFa is READY for merge
   e592411b71a79a41950c37e71cfdcd6c5b59b7a3. Live HTTP200 data retains the
   PR189 byte hash and 17,197 visible / ready 17,350 / pending 0 / PARTIAL.
   Remaining category collection and any new delivery need their own fresh
   completeness, retention, full-test/build and deployment gates.
   The 412-request bounded fresh follow-up verified Flip-flops/Slides (1,174
   source URLs; checked 14:52:41Z) and Boots (9,749; checked 14:56:57Z). Their
   10,923-product union has 10,774 policy-eligible rows. Reclassification from
   immutable checksummed source items recovers the seven real boots above;
   names, URLs and galleries remain original. The preserving proposal grows
   the archive from 17,350 products / 17,289 families to 27,136 products /
   27,068 families, pending zero. It adds 9,786 products without losing any old
   URL, model ID, real image, size/SKU, variant identity or NEW state. No new
   product is marked NEW. Prepared frontend: 26,974 visible models; all 17,197
   previous visible model IDs, galleries and variant URLs remain present.
   Marketplace coverage stays PARTIAL. Released through PR191 on 19 October:
   head 55f35e24a06e7b1913c0fd8a72dc22b64cf8451a passed all 1,161 tests in 138
   files, TypeScript and the production build; CI run 39279869419 succeeded and
   Preview dpl_7Y46kkMWLwFU2qKYWgj5zrPLGzGg was READY for the same SHA.
   Main was unchanged at e592411 before the authorized squash merge.
   Production dpl_21b1RkS6XZWVbu7BmCV3ANhfAwv2 is READY for exact merge
   8d4645f65c65b9874d6a6bd66252db417c6ce7b1. The public Farfetch catalog
   returned HTTP200 with SHA256
   b280a56d9014e67c58bea3e06a34f740d1d98ce46b33fa614810a934d0fd74cd:
   26,974 visible / ready 27,136 / pending 0 / PARTIAL. Live retention checks
   confirmed all 17,197 previous visible model IDs, real galleries and variant
   URLs, with zero losses. Sandals stopped at the bounded time budget;
   no partial rows were published.
   A fresh unchanged checkpoint with overlapping source pages can now rewind
   atomically to the earliest repeated card and recollect that range within
   the existing time/request limits. It never deduplicates a bad snapshot into
   FULL; changed first pages, expired epochs, corrupt parts, repeated cards,
   mismatched totals and access denials still prevent completeness. Rewinds
   are recorded in progress; failing source evidence is retained for review.
   Regression checks cover successful recollection, persistent overlap, page
   budget exhaustion, checksum damage and stale epochs. Exact official Trainers
   context also separates source-listed height/upper/material and quoted
   model/colorway names from real clothing, bags and cosmetics. Wrong scopes
   and independent non-footwear words still exclude; original source fields
   are preserved. Contradictory source titles such as actual sweater/sweatshirt
   wording remain unresolved rather than receiving an invented category.
   Trainers and Sandals remain unverified. On 19 October, two bounded traversals
   reproduced boundary repeats. A two-request diagnostic at 15:22Z found that
   the primary embedded catalog and JSON-LD matched exactly, and those same
   source page boundaries had since changed. A later range replay removed the
   trainer overlaps, but its final canonical first page reported 29,619 while
   the complete page union reported 29,622. The bounded tail recheck still
   disagreed, so those products were withheld. Do not bypass these source
   inconsistencies or mark the remaining scopes/the whole marketplace FULL.
   User-directed scope change (19 October): pause additional catalog expansion
   and repeated Farfetch source experiments while finishing the usable site.
   Cursor desktop delivered the four-file model-note edit/delete repair in
   draft PR193 (original head 708be4162655dc8f2986a1681ae8ffecda7a891f).
   Review confirmed the scope and merged current main into the repair branch
   without changing its catalog data. Linux passed all 1,168 tests in 139 files,
   including seven note regressions; the reported Windows import-path failure
   did not reproduce. Released via PR193, merge
   06da18547e4779a6c1f3d6a6a0514177adf76073. Exact-head CI 39288284540
   succeeded; Preview dpl_AsjuNuZVvRysmSgHEBFz3e35ZXVM and exact merge-SHA
   production dpl_GLrtP6EmZYzSi2pmj4o7PjkeAs7N were READY. Public-browser
   checks on actual Camille/Georgia models verified saving, unchanged blur,
   separate models, complete deletion, reopen and page reload. The temporary
   note was removed, restoring the original empty field. Farfetch live HTTP200
   retained the PR191 hash/counts. Cursor's note repair is complete and live.
   Keep Ponti and other source-quality issues pending unless new evidence appears.
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

Current user priority (19–20 October): finish a usable site before the China
trip. Pause additional catalog expansion and repeated source experiments.
Preserve independent verified deliveries; blocked sources do not hold site work.

20 October UI audit: Visual search for Pretty Ballerinas returned 216 models;
the Nicole detail opened with a real source URL, gallery and two color controls.
Escape from the detail note field did not close the drawer; PR195 subsequently
fixed and released that behavior (release evidence below).
Real mobile viewport testing and remaining site flows are unverified, not bugs
invented from a checklist.

User-reported gallery swipe repair is released via PR194, merge
ab8a01e1fcf258ebe5d4849555cfa0616d482876. Shared pointer gestures cover touch/pen/mouse in
inline and fullscreen galleries, preserve vertical scroll, reject pinch,
cancelled and zoomed gestures, and suppress the post-drag image click. Arrow
buttons remain independent; portal events cannot advance the parent gallery.
Eleven new gesture/handler regressions plus existing zoom/navigation tests
passed (18 focused checks), including portal isolation, controls and mouse
capture cancellation. The initial full run passed 1,175 tests; four added
handler tests also passed. Exact-head CI 39343737256 passed all 1,179 tests in
141 files and the production build. Preview dpl_AQ4g2uNUwik4MHsXFA2fU9F5LPG4
was READY for head 8dc25804ecaf1b2e3306e13e54ba20fc4b663028. Exact merge-SHA
production dpl_6AM4MnRicT86p6pLrkjqrqbywwDD was READY. Live browser comparison
reproduced the old 1/4-stuck drag and verified new card/detail 1/4 to 2/4 and
reverse, fullscreen 2/4 to 3/4, zoomed pan staying 3/4 at 110%, arrow to 4/4,
unchanged parent gallery index, and real color switching to its own 1/5 images.
Live Farfetch HTTP200 retained the PR191 hash/counts. User confirmed the swipe
fix at 03:47 Istanbul on 20 October. Physical iPhone gestures were not directly
tested by the agent.

20 October next bounded repair: product detail keyboard/focus behavior in
fix/detail-dialog-keyboard-20261020. Escape closes the detail; Tab wraps around
visible controls; initial/return focus is managed and background focus is
contained. Nested fullscreen galleries retain their own keyboard behavior.
The detail uses an independent document-element scroll lock so nested gallery
body locks cannot restore stale values. Composition, repeated Escape, browser
shortcuts and already-handled events are left alone. Six keyboard regressions
and seven note regressions passed. The full suite passed all 1,185 tests in
142 files. Released through PR195: exact head
999a78b06a274a7b247ca1389720dd3dd9b9f082 passed full CI39350281958 and
production build. Preview dpl_6z1no6vLC8eBW2z4vemdJ2QP7ntv was READY.
Production dpl_5kC9D5yr5GtWRPt8oEk2hvyLzSuV was READY for exact merge
d56bc55c98914453284e981e9104ad7060696020. Public browser confirmed initial
Close focus, Tab/Shift+Tab wrapping, Escape from notes restoring the model
opener and scroll locks, and nested gallery Escape closing only the gallery.
A temporary note saved on Escape and was then removed, restoring empty.
Live Farfetch HTTP200 retained the PR191 hash/counts. Physical mobile remains
unverified; do not duplicate the completed keyboard repair.

20 October owner priority: leave Automatic Upload dashboard repairs until last.
Its report is dated 3 October while promising "tonight", and hardcoded limit
copy says 5 although current queue policy is 25; no schedule change is authorized.

Saved-product brand filter repair: the previous filter omitted marketplace-only
brands. Live reproduction saved Farfetch Christian Louboutin 100mm Hot Chick
Pump: card appeared, but brand select had only the 82 registered brands.
Pretty Ballerinas save/reload/detail and combined Visual Premium/new/BABET/search
checks passed. Own temporary saves were removed; saved list returned zero.
The fix retains registered options and adds actual saved-family brands,
deduplicated and Turkish-sorted without changing exact brand values. Options
do not depend on the selected brand/source/search, so other saved brands remain
selectable. Catalog records, IDs, galleries, notes and schedules are unchanged.
Released via PR196, merge 6f768ec9cd5a0cc11d4f20236f24b64a9f8c41e2.
Head 3b57654f8e3d97f57ad3d00eed698e221b868f92 passed all 1,190 tests in 143
files and production build locally and in CI39374206512. Preview
dpl_5CRapGjDenS9YpAyQZqEoVAHk33i was READY for that head; production
dpl_HDpMbW65W4chLXVfNDJRDrSxXvR9 was READY for the exact merge. Public
browser checks confirmed Christian Louboutin appears in the dropdown, remains
selectable with another brand active, filters correctly with Farfetch/search,
and persists after reload. The temporary save was removed, restoring zero saved
products. Live Farfetch HTTP200 retained the PR191 hash/counts.

Saved empty-result repair: when saved products exist but none match a brand,
source or search filter, the saved grid incorrectly says no products have been
saved. Use the existing filter-empty message while any saved IDs exist; keep
the existing genuinely-empty message when there are no saved IDs. Verification
must cover no saves, a nonmatching filter, clearing filters and removing the
temporary save. Full tests/build, exact-head CI/Preview and exact merge-SHA
production/live checks passed for release PR197: head
56021de633cdf3ccfb2c9afdc1d919b43ab10dde, CI39384509011 (1,190 tests in 143
files and production build), Preview dpl_mun8XwLygTyfiLwWtCACAxfd6snK READY.
Production dpl_AovNsa4G7ZUVETRBazBq5UxAPUs7 was READY for exact merge
89172cf34c03b3661e17e9e305ab31d99218cd17. Public browser checks verified
brand/source/search empty results, clearing filters restoring the saved model,
and removing the temporary save restoring the genuine no-saves message.
Live Farfetch HTTP200 retained the PR191 hash/counts.

Current bounded repair: mobile touch targets. Existing card photo arrows were
about 17x21px, save18px high and color buttons32x32px, with the same sizing
below the mobile breakpoint. A shared CSS utility makes affected card, inline
photo, detail and fullscreen-gallery controls at least44x44px on narrow screens
or devices with a coarse primary pointer. Existing wrapping handles the larger
color/action controls. Carousel arrows remain visible under the same mobile/touch
conditions, including wide coarse-pointer screens otherwise using hover-only
desktop rules. Desktop fine-pointer sizing remains unchanged.
The cloud browser exposes no viewport/device emulation capability; DevTools
and zoom shortcuts left measured viewport1363x936. Do not claim physical-phone
or narrow-screen rendering was tested. Validate built CSS, full tests/build,
Preview and production commits and actual available live control behavior.
Automatic Upload remains last; no source collection or scheduler changes.

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
