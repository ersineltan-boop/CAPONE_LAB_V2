# Marketplace access recovery, 13 October

Only the third priority item is addressed here. No emails, signup requests,
credential changes, access-control bypasses, or taxonomy guesses were made.

## Current source evidence

| Source | Result | Publication |
| --- | --- | --- |
| 24S | All 12 pages, 829 raw records, 828 footwear records, no collector errors | 790 quality-eligible fresh records merged with the preserved archive; 38 current quarantine rows remain |
| Level Shoes | 48/7,523; subsequent public storefront API returns HTTP 403 and `Please contact the site owner for access.` | Preserve last-good; complete refresh blocked by source permission |
| Farfetch | Pages 1 and 2 validated against 62,572 source records; page 3 returned total 62,571 | Preserve last-good; rolling pagination changed during collection; saved progress is not published |
| Free People | Official shoes collection returned HTTP 403 / anti-bot evidence | Preserve last-good; stop this collection attempt |

24S deliveries retain 826 archived/current products and model families,
previously 822. All prior IDs, URLs and images remain. Historical quarantine
evidence is stored separately from current pending rows, including a withdrawn
source product. NEW labels are retained from prior evidence; this generic 24S
collection is not newness proof. The remaining 38 silhouettes belong to the
separate taxonomy-quality task.

## External access findings

Level's public partner documentation (https://api-docs.levelshoes.com/) describes
stock-push and order integration, not a read feed for the whole footwear
catalog. It is not substituted for the blocked storefront listing API.
Free People's official affiliate page
(https://www.freepeople.com/help/affiliates/) points to approval through Rakuten
Advertising. No approved account or product feed was connected in this session;
affiliate membership alone is not evidence of complete gallery/catalog access.

The existing bounded Sunday/Wednesday refresh remains the retry mechanism.
Source permission, anti-bot blocks and a changing source snapshot are not
resolved by relaxing completeness or inventory-retention checks. The third
priority item is therefore only partially resolved by the 24S recovery.

Validation: full tests, TypeScript/production build, exact-head GitHub CI and
Vercel Preview before merge; verify live 24S shard after production deployment.
