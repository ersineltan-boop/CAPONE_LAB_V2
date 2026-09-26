import {
  isLikelyProductNamedCollection,
  isMixedCatalogPath,
  isPromoFootwearCollection,
  isWomensFootwearCollection,
} from "../../collector/shopifyCollectionFilter";

export interface ShopifyCollectionRecord {
  handle: string;
  title: string;
  productsCount: number;
}

const MEN = /\b(men'?s?|mens|homme)\b/i;
const WOMEN = /\b(women'?s?|womens|woman|ladies|femme)\b/i;

const FULL_CATALOG_HANDLES = [
  "view-all-womens",
  "view-all-women",
  "womens-view-all",
  "women-view-all",
  "all-womens-shoes",
  "all-women-shoes",
  "womens-shoes",
  "women-shoes",
  "womens-footwear",
  "women-footwear",
  "shop-all-shoes",
  "all-shoes",
];

const GENERIC_ROOT_HANDLES = new Set(["shoes", "footwear", "all", "shop-all"]);

export function collectionPath(handle: string): string {
  return `/collections/${handle}`;
}

export function isVerifiedFootwearCatalogPath(path: string): boolean {
  if (isMixedCatalogPath(path)) return false;
  const handle = path.replace(/^\/collections\//, "").split("/")[0]?.trim().toLowerCase() ?? "";
  if (!handle) return false;
  if (handle === "all" || handle === "shop-all") return false;
  return isWomensFootwearCollection(handle, handle);
}

export function isMensCollection(handle: string, title: string): boolean {
  const hay = `${handle} ${title}`.replace(/-/g, " ");
  if (WOMEN.test(hay)) return false;
  return MEN.test(hay);
}

export function isExcludedMerchCollection(handle: string, title: string): boolean {
  const hay = `${handle} ${title}`.toLowerCase().replace(/-/g, " ");
  if (isMensCollection(handle, title)) return true;
  return /\b(bags?|handbags?|jewelry|jewellery|sunglasses|underwear|socks?|shoe care|shoe accessories|hats?|apparel|clothing|activewear|swimwear|gift card|accessories)\b/.test(
    hay,
  );
}

const STRICT_NEW_ARRIVALS = /\b(new arrivals?|new in|just in|whats new)\b/i;
const NEW_ARRIVAL_ROOTS = new Set(["new-arrivals", "new-arrival", "new-in", "just-in", "whats-new"]);
const DEDICATED_FOOTWEAR_ROOTS = ["shoes", "footwear", "us-shoes", "womens-shoes", "women-shoes"];

export function isWomensNewArrivalsCollection(handle: string, title: string): boolean {
  if (isMensCollection(handle, title)) return false;
  if (isExcludedMerchCollection(handle, title)) return false;
  const hay = `${handle} ${title}`.replace(/-/g, " ");
  return STRICT_NEW_ARRIVALS.test(hay);
}

export interface CollectionPlan {
  catalogPaths: string[];
  newArrivalsPaths: string[];
  authoritative: boolean;
  reason: string | null;
}

export function planWomensCollections(
  collections: readonly ShopifyCollectionRecord[],
  seed?: { womenCollectionPath?: string; newArrivalsPath?: string },
): CollectionPlan {
  const byPath = new Map(
    collections.map((collection) => [collectionPath(collection.handle).toLowerCase(), collection]),
  );

  const newArrivalsPaths: string[] = [];
  const seenNew = new Set<string>();
  const pushNew = (path: string) => {
    const key = path.toLowerCase();
    if (seenNew.has(key)) return;
    seenNew.add(key);
    newArrivalsPaths.push(path);
  };

  if (seed?.newArrivalsPath) {
    pushNew(seed.newArrivalsPath);
  } else {
    const matching = collections.filter(
      (collection) =>
        isWomensNewArrivalsCollection(collection.handle, collection.title) && collection.productsCount > 0,
    );
    const roots = matching.filter((collection) => NEW_ARRIVAL_ROOTS.has(collection.handle.toLowerCase()));
    const chosen = roots.length > 0
      ? roots
      : matching.filter((collection) => !/drop\d+|second-drop|new-in-drop/i.test(collection.handle));
    for (const collection of chosen) pushNew(collectionPath(collection.handle));
  }

  if (seed?.womenCollectionPath) {
    return {
      catalogPaths: [seed.womenCollectionPath],
      newArrivalsPaths,
      authoritative: true,
      reason: null,
    };
  }

  const fullRoots = FULL_CATALOG_HANDLES
    .map((handle) => byPath.get(collectionPath(handle).toLowerCase()))
    .filter((collection): collection is ShopifyCollectionRecord => {
      if (!collection || collection.productsCount <= 0) return false;
      if (isMensCollection(collection.handle, collection.title)) return false;
      return !isExcludedMerchCollection(collection.handle, collection.title);
    })
    .sort((a, b) => b.productsCount - a.productsCount);

  if (fullRoots[0]) {
    return {
      catalogPaths: [collectionPath(fullRoots[0].handle)],
      newArrivalsPaths,
      authoritative: true,
      reason: null,
    };
  }

  const specific = collections.filter((collection) => {
    if (collection.productsCount <= 0) return false;
    if (GENERIC_ROOT_HANDLES.has(collection.handle.toLowerCase())) return false;
    if (isLikelyProductNamedCollection(collection.handle, collection.title, collection.productsCount)) {
      return false;
    }
    if (/-\d{2,3}$/.test(collection.handle) && collection.productsCount < 80) return false;
    if (isExcludedMerchCollection(collection.handle, collection.title)) return false;
    if (isPromoFootwearCollection(collection.handle, collection.title)) return false;
    if (isWomensNewArrivalsCollection(collection.handle, collection.title)) return false;
    if (collection.handle.toLowerCase().startsWith("geosort-")) return false;
    return isWomensFootwearCollection(collection.handle, collection.title);
  });

  const largestSpecific = specific.reduce((max, collection) => Math.max(max, collection.productsCount), 0);
  const dedicated = DEDICATED_FOOTWEAR_ROOTS
    .map((handle) => byPath.get(collectionPath(handle).toLowerCase()))
    .filter((collection): collection is ShopifyCollectionRecord => {
      if (!collection || collection.productsCount <= 0) return false;
      if (isMensCollection(collection.handle, collection.title)) return false;
      return !isExcludedMerchCollection(collection.handle, collection.title);
    })
    .sort((a, b) => b.productsCount - a.productsCount)[0];
  const dedicatedChildren = dedicated
    ? specific.filter(
        (collection) =>
          collection.handle.startsWith(`${dedicated.handle}-`) &&
          collection.productsCount <= dedicated.productsCount,
      )
    : [];
  const dedicatedChildSum = dedicatedChildren.reduce((sum, collection) => sum + collection.productsCount, 0);
  if (dedicated && dedicated.productsCount >= largestSpecific) {
    const catalogPaths = dedicatedChildren.length > 0 && dedicatedChildSum > dedicated.productsCount
      ? dedicatedChildren.map((collection) => collectionPath(collection.handle))
      : [collectionPath(dedicated.handle)];
    return {
      catalogPaths,
      newArrivalsPaths,
      authoritative: true,
      reason: null,
    };
  }

  const mixed = ["all", "shop-all"]
    .map((handle) => byPath.get(collectionPath(handle).toLowerCase()))
    .filter((collection): collection is ShopifyCollectionRecord => {
      if (!collection || collection.productsCount <= 0) return false;
      if (isMensCollection(collection.handle, collection.title)) return false;
      return !isExcludedMerchCollection(collection.handle, collection.title);
    })
    .sort((a, b) => b.productsCount - a.productsCount)[0];
  const broadCategory = /^(boots?|flats?|heels?|sandals?|pumps?|sneakers?|loafers?|mules?|brogues?|ballerinas?|espadrilles?|wedges?|clogs?|slippers?|slides?|oxfords?)$/i;
  const broadSpecific = specific.filter((collection) => broadCategory.test(collection.handle));
  if (
    broadSpecific.length > 0 &&
    broadSpecific.length === specific.length &&
    specific.length <= 8 &&
    mixed &&
    mixed.productsCount > largestSpecific * 2
  ) {
    const catalogPaths = specific.map((collection) => collectionPath(collection.handle));
    if (dedicated) {
      const root = collectionPath(dedicated.handle);
      if (!catalogPaths.some((path) => path.toLowerCase() === root.toLowerCase())) catalogPaths.push(root);
    }
    return {
      catalogPaths,
      newArrivalsPaths,
      authoritative: true,
      reason: null,
    };
  }

  const storewide = ["all", "shop-all", "shoes", "footwear"]
    .map((handle) => byPath.get(collectionPath(handle).toLowerCase()))
    .filter((collection): collection is ShopifyCollectionRecord => {
      if (!collection || collection.productsCount <= 0) return false;
      if (isMensCollection(collection.handle, collection.title)) return false;
      return !isExcludedMerchCollection(collection.handle, collection.title);
    })
    .sort((a, b) => b.productsCount - a.productsCount);
  const childSum = specific
    .filter((collection) => storewide[0] && collection.handle.startsWith(`${storewide[0].handle}-`))
    .reduce((sum, collection) => sum + collection.productsCount, 0);
  if (storewide[0] && largestSpecific > 0 && storewide[0].productsCount >= largestSpecific && childSum <= storewide[0].productsCount) {
    return {
      catalogPaths: [collectionPath(storewide[0].handle)],
      newArrivalsPaths,
      authoritative: true,
      reason: null,
    };
  }

  if (specific.length === 0) {
    const generic = [...GENERIC_ROOT_HANDLES]
      .map((handle) => byPath.get(collectionPath(handle).toLowerCase()))
      .filter((collection): collection is ShopifyCollectionRecord => {
        if (!collection || collection.productsCount <= 0) return false;
        if (isMensCollection(collection.handle, collection.title)) return false;
        return !isExcludedMerchCollection(collection.handle, collection.title);
      })
      .sort((a, b) => b.productsCount - a.productsCount);
    if (generic[0]) {
      return {
        catalogPaths: [collectionPath(generic[0].handle)],
        newArrivalsPaths,
        authoritative: true,
        reason: null,
      };
    }
    return {
      catalogPaths: [],
      newArrivalsPaths,
      authoritative: false,
      reason: "NO_AUTHORITATIVE_WOMENS_COLLECTION",
    };
  }

  return {
    catalogPaths: specific.map((collection) => collectionPath(collection.handle)),
    newArrivalsPaths,
    authoritative: true,
    reason: null,
  };
}
