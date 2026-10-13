# Supported taxonomy and thin refresh retention

The marketplace gate only accepted legacy categories. ESPADRILLE, OXFORD_DERBY
and CLOG are supported by the delivered primary taxonomy but can legitimately
have legacy OTHER_FOOTWEAR, so correctly classified products were held back.
The gate now admits these three categories only when the same product analyzer
and taxonomy builder used by delivery resolve them, and the stored footwear
gate accepts the item. Unknown silhouettes, bags, socks, missing images,
incomplete source coverage and policy exclusions remain blocked.

A further archive check found that thin listing cards erased omitted detail
attributes and a colour-only merge collapsed several size SKUs. The merge now
retains omitted attributes, real variant identities (SKU, colour and title),
and every size/SKU identity. Explicit current size evidence replaces matching
rows; older unmatched rows retain their identity with unknown selectability.
Thin cards preserve the preceding detail verification date rather than
pretending to recheck the product page. The publisher rejects URL, size or
variant identity loss before replacing the active delivery.

The first prepared Farfetch snapshot failed this additional metadata check and
was never released. The original archived delivery was restored, the corrected
merge reapplied, and all retention checks passed.

Fresh collection evidence: Farfetch completed espadrilles (496), slippers (613)
and Mule (2,009), checked between 17:28 and 17:31 UTC. Other categories changed,
overlapped or timed out and were held. These completed scopes yielded 3,102
unique records and 2,619 quality-eligible records. The preserving archive grows
from 3,175 to 3,504 products and 3,169 to 3,498 families. Its current pending
count falls from 754 to 446. Generated visible models: 3,077 to 3,406. Whole
Farfetch coverage remains explicitly PARTIAL; the 62,975 root total is context.

24S's first attempt stopped at a page-seven timeout and did not replace data.
One ordinary bounded retry completed all 828 records without errors. Pending
taxonomy falls from 38 to 26; archived products/families grow 826 to 837, and
visible models grow 809 to 820. Its publication remains PARTIAL because the
26 unresolved records were not guessed into categories.

Both archives have zero missing prior IDs, URLs, product/family images, size
SKUs or variant SKUs. New archive URLs have zero invented NEW flags. Structured
retention evidence is committed alongside this note. Existing refresh schedules
are unchanged; the owner's separately requested hourly repair task continues
work until they say stop.

Validation: focused taxonomy/merge/delivery tests and production build passed.
Full exact-head CI and READY Preview are required before production release.
