export interface OfficialCollectionTarget {
  handle: string;
}

export interface OfficialBrandTarget {
  slug: string;
  brand: string;
  /** Public storefront origin. Locale is part of collectionPath. */
  origin: string;
  /** Path prefix such as "/en" when the official hreflang catalog is localized. */
  localePath: string;
  collections: OfficialCollectionTarget[];
  refreshCommand?: string;
}

/**
 * Inactive women's footwear brands from issues #61 and #78 whose public
 * Shopify listing was reachable without a challenge. Luxury and fashion
 * shoe brands come before broader fashion brands. Sports brands are absent.
 */
export const OFFICIAL_SHOPIFY_BRAND_TARGETS: readonly OfficialBrandTarget[] = [
  {
    slug: "isabel-marant",
    brand: "ISABEL MARANT",
    origin: "https://isabelmarant.com",
    localePath: "/en",
    collections: [{ handle: "shoes-all" }],
  },
  {
    slug: "yuul-yie",
    brand: "YUUL YIE",
    origin: "https://yuulyie.com",
    localePath: "",
    collections: [{ handle: "shoes" }],
  },
  {
    slug: "le-silla",
    brand: "LE SILLA",
    origin: "https://www.lesilla.com",
    localePath: "",
    collections: [{ handle: "shoes" }],
  },
  {
    slug: "k-jacques",
    brand: "K.JACQUES",
    origin: "https://www.kjacques.fr",
    localePath: "",
    collections: [{ handle: "sandale-tropezienne-femme" }],
  },
  {
    slug: "sergio-rossi",
    brand: "SERGIO ROSSI",
    origin: "https://www.sergiorossi.com",
    localePath: "",
    collections: [{ handle: "womens-shoes" }],
  },
  {
    slug: "fly-london",
    brand: "FLY LONDON",
    origin: "https://shop-eu.flylondon.com",
    localePath: "",
    collections: [{ handle: "women-all-footwear" }],
  },
];

export const OFFICIAL_SHOPIFY_REFRESH_COMMAND = "npm run collect:official-shopify";

/**
 * Next verified public-Shopify women's footwear brands after the first group.
 * Nodaleto stays with the Codex catalog and is not collected here.
 */
export const NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND = "npm run collect:official-shopify-next";

export const NEXT_OFFICIAL_SHOPIFY_BRAND_TARGETS: readonly OfficialBrandTarget[] = [
  {
    slug: "pretty-ballerinas",
    brand: "PRETTY BALLERINAS",
    origin: "https://www.prettyballerinas.com",
    localePath: "",
    collections: [{ handle: "collection" }],
    refreshCommand: NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND,
  },
  {
    slug: "margaux",
    brand: "MARGAUX",
    origin: "https://www.margauxny.com",
    localePath: "",
    collections: [{ handle: "shop" }],
    refreshCommand: NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND,
  },
  {
    slug: "mascar",
    brand: "MASCARÓ",
    origin: "https://www.mascaro.com",
    localePath: "",
    collections: [{ handle: "collection" }],
    refreshCommand: NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND,
  },
  {
    slug: "rouje",
    brand: "ROUJE",
    origin: "https://www.rouje.com",
    localePath: "",
    collections: [{ handle: "shoes" }],
    refreshCommand: NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND,
  },
  {
    slug: "repetto",
    brand: "REPETTO",
    origin: "https://www.repetto.com",
    localePath: "",
    collections: [{ handle: "catalogue-femme-chaussures" }],
    refreshCommand: NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND,
  },
];
