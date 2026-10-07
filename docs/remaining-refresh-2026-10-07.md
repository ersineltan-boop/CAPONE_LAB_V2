# Remaining refresh recovery — 7 October 2026

Massimo: live official grid reconciled at 117/117 with no collector errors. Two previously unmapped bundle products use a legacy /800 color key while their actual media group uses a seasonal path ending /800. Mapping now uses that exact color; galleries from other colors are not borrowed. The scheduled staging collector uses the shared bounded HTTP helper and checks actual pagination completion. FULL metadata is emitted only for a reconciled current grid; archived products remain retained separately.

Level Shoes: default maximum raised from 80 to 250 pages with a 20-minute budget and per-page cardinality checks. Official women-listing unisex products are accepted using explicit source gender rather than requiring a women token in every slug. Male/foreign/unknown-gender URLs stay rejected. Live first page returned 48/7414; later-page API returned HTTP403. This source remains incomplete; no Level delivery is published.

Casadei: 358 records across 15 source pages represent 357 distinct product IDs (330 footwear, 27 explicit non-footwear quarantines). Source repeats 1F916W120TCAMOS6809 on page 11. Preserve the last-good catalog; do not lower the source total or count a duplicate as a second product. Collector now records the exact repeated ID and rejects changing totals.

Schutz: 1048 footwear products, 1047 with galleries. The official product JSON and page for cloe-snake-embossed-sandal-f26-high-stiletto-s0206603060051 contain images: [] and featured_image: null. No substitute image is invented and its missing gallery remains a source blocker.

## Cursor continuation

User requested Cursor involvement. No agent has been started in this session: browser auto-review rejected access to authenticator.cursor.sh. After authorized sign-in, use one Cursor Cloud Agent on the current main/this PR, read this evidence and the latest scheduled run, and focus on Casadei pagination deduplication and source-specific partial record recovery for Schutz/Browns/Webster while preserving all old IDs, URLs, variant images, and exact NEW provenance. No access-block bypasses, emails, bulk deletion, or false FULL claims. Keep all follow-up work in a tested PR and avoid concurrent catalog writers.
