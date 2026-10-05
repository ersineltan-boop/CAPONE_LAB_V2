import {classifyOfficialFootwear, legacyCategoryForPrimary} from '../brands/wave50/primaryCategory';
import type {PilotProduct} from './types';

/** Recover explicit retailer silhouette words omitted by the legacy category gate. */
export function withExplicitMarketplaceTaxonomy(product: PilotProduct): PilotProduct {
  if (product.category !== 'OTHER_FOOTWEAR' ||
    !/\b(?:derb(?:y|ies)|oxfords?|espadrilles?|slippers?|booties?|ballet)\b/i.test(product.productName)) return product;
  const primary = classifyOfficialFootwear({title: product.productName});
  return primary ? {...product, category: legacyCategoryForPrimary(primary)} : product;
}
