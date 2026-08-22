import type {
  AnalyzedProduct,
  BrandBreakdown,
  MarketAnalysis,
  MarketSignal,
  TagCount,
} from "./types";

const SIGNAL_LABELS_TR: Record<string, string> = {
  BOOT: "BOT",
  ANKLE_BOOT: "BILEKLIK BOT",
  PUMP: "PUMP",
  SLINGBACK: "SLINGBACK",
  BALLERINA: "BALERİN",
  MARY_JANE: "MARY JANE",
  LOAFER: "LOAFER",
  MULE: "MULE",
  SANDAL: "SANDAL",
  THONG: "PARMAK ARASI",
  WEDGE: "WEDGE",
  SNEAKER: "SNEAKER",
  OTHER_FOOTWEAR: "DİĞER",
  BLACK: "SİYAH",
  WHITE: "BEYAZ",
  CREAM: "KREM",
  BEIGE: "BEJ",
  BROWN: "KAHVE",
  ESPRESSO: "ESPRESSO",
  TAN: "TAN",
  BURGUNDY: "BORDO",
  RED: "KIRMIZI",
  PINK: "PEMBE",
  ORANGE: "TURUNCU",
  YELLOW: "SARI",
  GREEN: "YEŞİL",
  BLUE: "MAVİ",
  PURPLE: "MOR",
  SILVER: "GÜMÜŞ",
  GOLD: "ALTIN",
  METALLIC_OTHER: "METALİK",
  MULTICOLOR: "ÇOK RENKLİ",
  LEATHER: "DERİ",
  NAPPA: "NAPPA",
  SUEDE: "SUEDE",
  NUBUCK: "NUBUCK",
  PATENT: "RUGAN",
  CROC_EFFECT: "KROKODİL",
  WOVEN_LEATHER: "ÖRGÜ DERİ",
  TEXTILE: "TEKSTİL",
  MESH: "MESH",
  SATIN: "SATEN",
  VINYL_TPU: "VİNİL/TPU",
  METALLIC_LEATHER: "METALİK DERİ",
  SYNTHETIC: "SENTETİK",
  OTHER: "DİĞER",
  FLAT: "DÜZ",
  KITTEN: "KİTTEN",
  BLOCK: "BLOCK",
  STILETTO: "STİLETTO",
  SCULPTURAL: "HEYKELSEL",
  PLATFORM: "PLATFORM",
  LOW: "ALÇAK TOPUK",
  MID: "ORTA TOPUK",
  HIGH: "YÜKSEK TOPUK",
  THONG_DETAIL: "PARMAK ARASI",
  BRAIDED: "ÖRGÜLÜ",
  WOVEN: "ÖRGÜ",
  FRINGE: "PÜSKÜL",
  BUCKLE: "TOKALI",
  BOW: "FİYONK",
  RUCHED: "BÜRGÜLÜ",
  FLOWER: "ÇİÇEK",
  PEARL: "İNCİ",
  STONE: "TAŞ",
  METAL_HARDWARE: "METAL AKSESUAR",
  CHAIN: "ZİNCİR",
  LACE_UP: "BAĞCIKLI",
  STUD: "STUD",
  CUT_OUT: "DEKOLTELİ",
  ASYMMETRIC: "ASİMETRİK",
  OPEN_TOE: "AÇIK BURUN",
  PEEP_TOE: "PEEP TOE",
  HIGH_VAMP: "YÜKSEK VAMP",
  LOW_VAMP: "DÜŞÜK VAMP",
  T_STRAP: "T-STRAP",
  ANKLE_STRAP: "BİLEK BANTLI",
  BACKLESS: "ARKASIZ",
  CLOSED_TOE: "KAPALI BURUN",
};

function countTags(
  products: AnalyzedProduct[],
  getTags: (product: AnalyzedProduct) => string[],
): TagCount[] {
  const map = new Map<string, Set<string>>();

  for (const product of products) {
    const tags = getTags(product);
    for (const tag of tags) {
      if (!map.has(tag)) map.set(tag, new Set());
      map.get(tag)!.add(product.brand);
    }
  }

  return [...map.entries()]
    .map(([tag, brands]) => ({
      tag,
      productCount: products.filter((p) => getTags(p).includes(tag)).length,
      brandCount: brands.size,
      brands: [...brands].sort(),
    }))
    .sort((a, b) => b.productCount - a.productCount || a.tag.localeCompare(b.tag));
}

function countSingle(
  products: AnalyzedProduct[],
  getTag: (product: AnalyzedProduct) => string,
): TagCount[] {
  return countTags(products, (p) => {
    const tag = getTag(p);
    return tag === "UNKNOWN" ? [] : [tag];
  });
}

function buildBrandBreakdown(products: AnalyzedProduct[]): BrandBreakdown[] {
  const brands = [...new Set(products.map((p) => p.brand))].sort();

  return brands.map((brand) => {
    const brandProducts = products.filter((p) => p.brand === brand);

    return {
      brand,
      productCount: brandProducts.length,
      topCategories: countSingle(brandProducts, (p) => p.normalized.category ?? "UNKNOWN").slice(0, 5),
      topColors: countSingle(brandProducts, (p) => p.normalized.colorFamily).slice(0, 5),
    };
  });
}

function buildTopSignals(products: AnalyzedProduct[]): MarketSignal[] {
  const buckets: Array<{
    dimension: MarketSignal["dimension"];
    counts: TagCount[];
  }> = [
    {
      dimension: "details",
      counts: countTags(products, (p) => p.normalized.details),
    },
    {
      dimension: "colorFamily",
      counts: countSingle(products, (p) => p.normalized.colorFamily),
    },
    {
      dimension: "materialFamily",
      counts: countSingle(products, (p) => p.normalized.materialFamily),
    },
    {
      dimension: "heelType",
      counts: countSingle(products, (p) => p.normalized.heelType),
    },
    {
      dimension: "category",
      counts: countSingle(products, (p) => p.normalized.category ?? "UNKNOWN"),
    },
    {
      dimension: "construction",
      counts: countTags(products, (p) => p.normalized.construction),
    },
    {
      dimension: "heelHeightGroup",
      counts: countSingle(products, (p) => p.normalized.heelHeightGroup),
    },
  ];

  const signals: MarketSignal[] = [];

  for (const { dimension, counts } of buckets) {
    for (const count of counts) {
      if (count.tag === "UNKNOWN" || count.tag === "OTHER") continue;
      signals.push({
        ...count,
        dimension,
        labelTr: SIGNAL_LABELS_TR[count.tag] ?? count.tag.replace(/_/g, " "),
      });
    }
  }

  return signals
    .sort((a, b) => b.productCount - a.productCount || b.brandCount - a.brandCount)
    .slice(0, 12);
}

export function buildMarketAnalysis(products: AnalyzedProduct[]): MarketAnalysis {
  const brands = new Set(products.map((p) => p.brand));

  return {
    totalProducts: products.length,
    totalBrands: brands.size,
    categories: countSingle(products, (p) => p.normalized.category ?? "UNKNOWN"),
    colors: countSingle(products, (p) => p.normalized.colorFamily),
    materials: countSingle(products, (p) => p.normalized.materialFamily),
    heelTypes: countSingle(products, (p) => p.normalized.heelType),
    heelHeightGroups: countSingle(products, (p) => p.normalized.heelHeightGroup),
    details: countTags(products, (p) => p.normalized.details),
    constructions: countTags(products, (p) => p.normalized.construction),
    brandBreakdown: buildBrandBreakdown(products),
    topSignals: buildTopSignals(products),
    unknownCounts: {
      colorFamily: products.filter((p) => p.normalized.colorFamily === "UNKNOWN").length,
      materialFamily: products.filter((p) => p.normalized.materialFamily === "UNKNOWN").length,
      heelType: products.filter((p) => p.normalized.heelType === "UNKNOWN").length,
      heelHeightGroup: products.filter((p) => p.normalized.heelHeightGroup === "UNKNOWN").length,
      toeShape: products.filter((p) => p.normalized.toeShape === "UNKNOWN").length,
    },
  };
}

export function labelTagTr(tag: string): string {
  return SIGNAL_LABELS_TR[tag] ?? tag.replace(/_/g, " ");
}
