# Pending Massimo and Level fixes on current main

Port only Massimo and Level implementation/test changes from PR #167 onto
main after PR #169. Retain the October 11 catalog while adding fresh Massimo
source evidence; do not restore old branch data over the current catalog.
Casadei diagnostics and old October 7 catalog artifacts are outside this step.

Massimo now matches seasonal color gallery paths ending in the exact color ID,
uses the shared bounded HTTP client, and retries transient response failures
once. Real pagination completion is required by the priority refresh gate;
FULL metadata additionally requires matching fresh count and no errors.

Level supports up to 250 pages with a 20-minute budget, validates cardinality,
and accepts source-confirmed female/unisex footwear while rejecting men and
foreign hosts. The automatic runner no longer forces the old 80-page cap.

Live Massimo probe on October 13 reconciled 116/116 shoes. The bare official
New In route returned 404; its official parameterized collection link
(`celement=2284080`) returned 200 and a 60-element collection grid. Use that
link for source-backed NEW membership. The final fresh collection was FULL
with no errors. Merge the current catalog archive without dropping preceding
IDs, URLs or gallery images. Level access remains a separate source limitation.

Validation: full tests, TypeScript/build, exact-head GitHub CI and Vercel
Preview before merge; verify production commit afterward. No old IDs, URLs,
variant images or source badges are replaced by stale branch artifacts.
