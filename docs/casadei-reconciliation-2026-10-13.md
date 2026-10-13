# Casadei repeated listing slots

The official US shoes listing currently reports 356 slots across 15 pages.
Two independent complete traversals returned the same ordered product IDs and
URLs on every page: 355 unique products, including 329 eligible women's shoes
and 26 explicitly excluded bags. Product `1T831E1401T00059000` occurs at slot
191 on page 8 and slot 192 on page 9. This is one repeated source slot, not a
missing product. The source-reported total stays 356 in the catalog and audit.

The collector now reconciles repeated slots only when all raw records parse,
offsets are contiguous from zero to the exact source total, each repeated ID
keeps the same URL, and a second complete traversal returns identical ordered
identities. A final page-one check must also match. The eligible count used by
the publication gate is then 329, after proven duplicates and non-footwear
exclusions. Checksum evidence and both traversals are preserved in the adjacent
JSON audit. Duplicate galleries are merged rather than discarded.

Missing offsets, malformed rows, changed identities, changed totals, failed
requests, and incomplete replay retain PARTIAL. Source access blocks stop
further requests, including replay and final checks. The existing gallery,
size-SKU, taxonomy, currency, scope, and catastrophic-drop gates remain active.

This change fixes the regular registry collector used by the existing refresh
cycle. It does not create a second schedule or replace the archived catalog.
All 177 existing Casadei model families, their URLs, galleries, and NEW evidence
remain untouched. The live source was checked through ordinary public HTTP.

Validation: 30 Salesforce tests passed, including changed identity, missing
offset, malformed raw record, altered final check, and source-block cases.
Full test/build and exact-commit CI/Preview gates precede production release.
