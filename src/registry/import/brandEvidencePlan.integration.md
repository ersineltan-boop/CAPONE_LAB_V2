# Brand evidence / source refresh integration

`brandEvidencePlan.ts` intentionally does not import `src/refresh/sourceSnapshot.ts` yet.
That module is introduced by draft PR #38 (`lane/30-new-arrivals`), while this branch
must remain independently reviewable.

The local `SourceRefreshPlanContract` is the narrow adapter boundary required from
PR #38's `SourceRefreshPlan`: status, health counts/attempt time, publish permission,
and the proposed product snapshot identity. `adaptSourceRefreshPlanToBrandEvidence`
maps that contract into brand evidence and preserves the caller's explicit channel:

- `official-brand` -> `OFFICIAL_BRAND`
- `marketplace` -> `MARKETPLACE`
- `market-research` -> `MARKET_RESEARCH`

Only `OFFICIAL_BRAND` evidence can enter the brand staging queue. The evidence
snapshot ID must equal the product refresh snapshot ID, so an unrelated evidence
record cannot activate a product snapshot.

After PR #38 is merged (or during the stacked integration pass), replace the local
structural contract with a type-only import of `SourceRefreshPlan`; keep the adapter
function and its routing/snapshot-binding tests unchanged.
