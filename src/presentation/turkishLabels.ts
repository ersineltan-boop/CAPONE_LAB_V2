import type {
  DerivedStyleTag,
  PrimaryFootwearCategory,
  TaxonomyEvidenceSource,
  TaxonomyFieldStatus,
} from "../taxonomy/types";

/** Primary category → Turkish UI label (canonical enum unchanged). */
const CATEGORY_LABELS: Record<PrimaryFootwearCategory, string> = {
  BALLET_FLAT: "Babet",
  LOAFER: "Loafer",
  PUMP: "Topuklu",
  SANDAL: "Sandal",
  MULE: "Mule",
  BOOT: "Bot / Çizme",
  SNEAKER: "Sneaker",
  ESPADRILLE: "Espadril",
  OXFORD_DERBY: "Oxford / Derby",
  CLOG: "Clog",
  UNCLASSIFIED: "Diğer",
};

/** Taxonomy field keys → Turkish UI label. */
const FEATURE_LABELS: Record<string, string> = {
  toeShape: "Burun Şekli",
  toeLength: "Burun Uzunluğu",
  toeOpening: "Burun Açıklığı",
  backConstruction: "Arka Yapı",
  vampHeight: "Vamp Yüksekliği",
  heelHeightClass: "Topuk Yüksekliği",
  heelHeightMm: "Topuk Yüksekliği (mm)",
  heelType: "Topuk Tipi",
  soleProfile: "Taban Profili",
  platformConstruction: "Platform Yapısı",
  closureFeatures: "Kapama",
  strapFeatures: "Bant Yapısı",
  sideConstruction: "Yan Yapı",
  hardwareType: "Metal / Aksesuar",
  hardwareIntensity: "Aksesuar Yoğunluğu",
  embellishmentFeatures: "Dekoratif Detaylar",
  materialFamily: "Materyal",
  colorFamily: "Renk",
  surfacePattern: "Yüzey / Desen",
  shaftHeight: "Konç Yüksekliği",
  shaftFit: "Konç Formu",
  shaftShape: "Konç Şekli",
  bootStyleFeatures: "Bot Stili",
  sneakerHeight: "Sneaker Yüksekliği",
  styleArchetype: "Stil Ailesi",
  apronConstruction: "Ön Saya / Apron Yapısı",
  loaferDetail: "Loafer Detayı",
  throatShape: "Ağız Kesimi",
  toplineConstruction: "Üst Kenar Yapısı",
  strapConfiguration: "Bant Yapılandırması",
  outsoleConstruction: "Dış Taban Yapısı",
  upperCoverage: "Üst Kaplama",
  ankleCoverage: "Ayak Bileği Kaplama",
  soleShape: "Taban Şekli",
  upperProfile: "Üst Profil",
  panelComplexity: "Panel Karmaşıklığı",
  outsoleVisualWeight: "Dış Taban Görsel Ağırlığı",
  upperConstruction: "Üst Yapı",
  espadrilleSoleHeight: "Espadril Taban Yüksekliği",
  lacingConstruction: "Bağcık Yapısı",
  toeConstruction: "Burun Yapısı",
  broguingLevel: "Brogue Detayı",
  baseConstruction: "Taban Yapısı",
};

const VALUE_LABELS: Record<string, string> = {
  // Toe shape
  POINTED: "Sivri Burun",
  ALMOND: "Badem Burun",
  ROUND: "Yuvarlak Burun",
  SQUARE: "Kare Burun",
  CHISEL: "Keskin Kare Burun",
  // Toe length
  SHORT: "Kısa",
  STANDARD: "Standart",
  ELONGATED: "Uzatılmış",
  // Toe opening
  CLOSED: "Kapalı Burun",
  PEEP: "Peep Toe",
  OPEN: "Açık Burun",
  // Back construction (CLOSED overlaps toe opening — chip context uses backConstruction values)
  SLINGBACK: "Arkası Bantlı",
  BACKLESS: "Arkası Açık",
  // Vamp height
  LOW: "Düşük Vamp",
  HIGH: "Yüksek Vamp",
  // Heel height class
  FLAT: "Düz",
  MID: "Orta Topuk",
  // Heel type
  NONE: "Topuksuz / Düz",
  KITTEN: "Kitten Topuk",
  STILETTO: "İnce Topuk / Stiletto",
  BLOCK: "Blok Topuk",
  CONE: "Koni Topuk",
  FLARED: "Dışa Açılan Topuk",
  SCULPTURAL: "Heykelsi Topuk",
  WEDGE: "Dolgu Topuk",
  CUBAN: "Küba Topuk",
  OTHER: "Diğer",
  // Sole profile
  THIN: "İnce Taban",
  CHUNKY: "Kalın Taban",
  LUGGED: "Dişli Taban",
  // Platform
  FRONT_PLATFORM: "Ön Platform",
  FULL_PLATFORM: "Tam Platform",
  FLATFORM: "Düz Platform",
  // Side construction
  FULL_SIDE: "Tam Kapalı Yan",
  DORSAY: "D'Orsay",
  CUTOUT: "Kesik / Açık Yan",
  // Boot shaft
  ANKLE: "Bilek",
  MID_CALF: "Baldır Ortası",
  KNEE_HIGH: "Diz Altı / Diz Hizası",
  OVER_THE_KNEE: "Diz Üstü",
  // Shaft fit
  TIGHT: "Dar / Ayağa Oturan",
  WIDE: "Geniş",
  SLOUCHY: "Büzgülü / Salaş",
  // Boot styles
  CHELSEA: "Chelsea",
  BIKER: "Biker",
  MOTO: "Moto",
  COMBAT: "Combat",
  WESTERN: "Western / Kovboy",
  RIDING: "Binici",
  SOCK: "Çorap Bot",
  HIKING_INSPIRED: "Hiking Esintili",
  // Loafer details
  PLAIN: "Sade",
  PENNY_STRAP: "Penny Bant",
  HORSEBIT: "Horsebit",
  TASSEL: "Püsküllü",
  KILTIE: "Kiltie",
  CHAIN: "Zincir",
  BUCKLE: "Tokalı",
  FRINGE: "Saçaklı",
  // Apron
  APRON: "Apron",
  MOC_TOE: "Moc Burun",
  RAISED_APRON: "Yükseltilmiş Apron",
  // Sneaker
  LOW_TOP: "Düşük Bilek",
  MID_TOP: "Orta Bilek",
  HIGH_TOP: "Yüksek Bilek",
  COURT: "Court",
  RETRO_RUNNER: "Retro Koşu",
  TECH_RUNNER: "Teknik Koşu",
  FOOTBALL_INSPIRED: "Futbol Esintili",
  BOXING_INSPIRED: "Boks Esintili",
  SKATE: "Skate",
  BALLET_INSPIRED: "Balet Esintili",
  MINIMAL: "Minimal",
  // Lacing / brogue
  OXFORD: "Oxford",
  DERBY: "Derby",
  MONK: "Monk",
  SEMI: "Yarı Brogue",
  FULL: "Tam Brogue",
  // Hardware / panel
  MODERATE: "Orta",
  STATEMENT: "Belirgin",
  COMPLEX: "Karmaşık",
  LIGHT: "Hafif",
  HEAVY: "Ağır",
  // Clog base
  WOOD: "Ahşap",
  EVA: "EVA",
  RUBBER: "Kauçuk",
  MOLDED: "Kalıplanmış",
};

/** backConstruction CLOSED differs from toe CLOSED — override for back context. */
const BACK_CONSTRUCTION_LABELS: Record<string, string> = {
  CLOSED: "Arkası Kapalı",
  SLINGBACK: "Arkası Bantlı",
  BACKLESS: "Arkası Açık",
};

/** heelHeightClass LOW/HIGH share keys with other enums — context-specific overrides. */
const HEEL_HEIGHT_CLASS_LABELS: Record<string, string> = {
  FLAT: "Düz",
  LOW: "Alçak Topuk",
  MID: "Orta Topuk",
  HIGH: "Yüksek Topuk",
};

/** vampHeight LOW/HIGH share keys — context-specific overrides. */
const VAMP_HEIGHT_LABELS: Record<string, string> = {
  LOW: "Düşük Vamp",
  STANDARD: "Standart Vamp",
  HIGH: "Yüksek Vamp",
};

const PLATFORM_LABELS: Record<string, string> = {
  NONE: "Platform Yok",
  FRONT_PLATFORM: "Ön Platform",
  FULL_PLATFORM: "Tam Platform",
  FLATFORM: "Düz Platform",
};

const STATUS_LABELS: Record<TaxonomyFieldStatus, string> = {
  KNOWN: "Biliniyor",
  UNKNOWN: "Belirlenemedi",
  NOT_APPLICABLE: "Uygulanamaz",
};

const EVIDENCE_SOURCE_LABELS: Record<TaxonomyEvidenceSource, string> = {
  PRODUCT_PAGE: "Ürün Sayfası",
  STRUCTURED_DATA: "Yapılandırılmış Veri",
  PRODUCT_TEXT: "Ürün Açıklaması",
  COLLECTION_TAG: "Koleksiyon / Etiket",
  IMAGE: "Görsel Analiz",
  DERIVED: "Sistem Tarafından Türetildi",
  UNKNOWN: "Kaynak Belirsiz",
};

const DERIVED_STYLE_TAG_LABELS: Record<DerivedStyleTag, string> = {
  MARY_JANE: "Mary Jane",
  HORSEBIT_LOAFER: "Horsebit Loafer",
  BIKER_BOOT: "Biker Bot",
  BALLET_SNEAKER: "Balet Sneaker",
  SLINGBACK_PUMP: "Slingback Pump",
  THONG_SANDAL: "Parmak Arası Sandal",
  CHELSEA_BOOT: "Chelsea Bot",
  PLATFORM_DERBY: "Platform Derby",
  ESPADRILLE_WEDGE: "Espadril Dolgu Topuk",
};

export type NewArrivalsPeriodId = "24H" | "7D" | "30D" | "90D";

export function getCategoryLabel(
  category: PrimaryFootwearCategory | string | null | undefined,
): string {
  if (!category) return CATEGORY_LABELS.UNCLASSIFIED;
  return CATEGORY_LABELS[category as PrimaryFootwearCategory] ?? category;
}

/** Hide UNCLASSIFIED on product cards per presentation rules. */
export function getCategoryLabelForCard(
  category: PrimaryFootwearCategory | string | null | undefined,
): string | null {
  if (!category || category === "UNCLASSIFIED") return null;
  return getCategoryLabel(category);
}

export function getFeatureLabel(field: string): string {
  return FEATURE_LABELS[field] ?? field;
}

export function getStatusLabel(status: TaxonomyFieldStatus | string): string {
  return STATUS_LABELS[status as TaxonomyFieldStatus] ?? status;
}

export function getEvidenceSourceLabel(
  source: TaxonomyEvidenceSource | string,
): string {
  return EVIDENCE_SOURCE_LABELS[source as TaxonomyEvidenceSource] ?? source;
}

export interface TaxonomyValueLabelContext {
  field?: string;
}

export function getTaxonomyValueLabel(
  value: string | null | undefined,
  context?: TaxonomyValueLabelContext,
): string | null {
  if (!value) return null;

  if (context?.field === "backConstruction" && BACK_CONSTRUCTION_LABELS[value]) {
    return BACK_CONSTRUCTION_LABELS[value];
  }
  if (context?.field === "heelHeightClass" && HEEL_HEIGHT_CLASS_LABELS[value]) {
    return HEEL_HEIGHT_CLASS_LABELS[value];
  }
  if (context?.field === "vampHeight" && VAMP_HEIGHT_LABELS[value]) {
    return VAMP_HEIGHT_LABELS[value];
  }
  if (context?.field === "platformConstruction" && PLATFORM_LABELS[value]) {
    return PLATFORM_LABELS[value];
  }

  const categoryLabel = CATEGORY_LABELS[value as PrimaryFootwearCategory];
  if (categoryLabel) return categoryLabel;

  const derivedLabel = DERIVED_STYLE_TAG_LABELS[value as DerivedStyleTag];
  if (derivedLabel) return derivedLabel;

  if (VALUE_LABELS[value]) return VALUE_LABELS[value];

  return null;
}

/** Resolve a taxonomy chip canonical value to a Turkish label. */
export function getChipLabel(
  canonicalValue: string,
  context?: TaxonomyValueLabelContext,
): string {
  const label = getTaxonomyValueLabel(canonicalValue, context);
  if (label) return label;
  return canonicalValue.replace(/_/g, " ");
}

const BACK_CONSTRUCTION_VALUES = new Set(["CLOSED", "SLINGBACK", "BACKLESS"]);
const TOE_SHAPE_VALUES = new Set([
  "POINTED",
  "ALMOND",
  "ROUND",
  "SQUARE",
  "CHISEL",
]);

/** Label chips from buildTaxonomyChips() without leaking raw enums. */
export function getTaxonomyChipLabel(
  chip: string,
  primaryCategory?: string | null,
): string | null {
  if (chip === "UNCLASSIFIED") return null;
  if (primaryCategory && chip === primaryCategory) {
    return getCategoryLabelForCard(chip);
  }
  if (BACK_CONSTRUCTION_VALUES.has(chip)) {
    return getTaxonomyValueLabel(chip, { field: "backConstruction" });
  }
  if (TOE_SHAPE_VALUES.has(chip)) {
    return getTaxonomyValueLabel(chip, { field: "toeShape" });
  }
  return getChipLabel(chip);
}

export function getPeriodLabel(
  period: NewArrivalsPeriodId,
  options?: { compact?: boolean },
): string {
  if (options?.compact) {
    const compact: Record<NewArrivalsPeriodId, string> = {
      "24H": "24 Saat",
      "7D": "7 Gün",
      "30D": "30 Gün",
      "90D": "90 Gün",
    };
    return compact[period];
  }

  const full: Record<NewArrivalsPeriodId, string> = {
    "24H": "Son 24 Saat",
    "7D": "Son 7 Gün",
    "30D": "Son 30 Gün",
    "90D": "Son 90 Gün",
  };
  return full[period];
}

export const UI_COPY = {
  newArrivalsTitle: "YENİ GELENLER",
  newArrivalsSubtitle:
    "Kaynak sitenin gerçekten yeni olarak gösterdiği ürünler",
  newArrivalsDiscoveredTitle: "CAPONE'A YENİ EKLENENLER",
  newArrivalsDiscoveredSubtitle:
    "CAPONE'un kataloğa ilk kez aldığı modeller — kaynak doğrulaması gerekmez",
  newArrivalsVerifiedTab: "Kaynakta Yeni",
  newArrivalsDiscoveredTab: "CAPONE'a Yeni Eklenenler",
  verifiedNewBadge: "YENİ",
  verifiedNewEvidence: "Yeni kanıtı",
  verifiedNewAt: "Yeni olarak doğrulandı",
  sourceNewLabel: "Kaynakta yeni",
  categoriesTitle: "KATEGORİLER",
  categoriesSubtitle:
    "Onaylı ayakkabı takonomisine göre model aileleri · Araştırma odaklı görünüm",
  otherCategories: "Diğer Kategoriler",
  filtersTitle: "FİLTRELER",
  limitedDataFilters: "Eksik Verili Kırılımlar",
  clearFilters: "Filtreleri Temizle",
  allModels: "Tüm Modeller",
  categoryNewArrivals: "Yeni Gelenler",
  unreviewedTab: "İncelenmemiş",
  savedTab: "Kaydettiklerim",
  emptyCategory: "Bu kategoride henüz ürün bulunmuyor.",
  sortNewest: "En Yeni",
  sortBrandAz: "Marka A–Z",
  sortUnreviewedFirst: "İncelenmemiş Önce",
  searchPlaceholder: "Marka veya model ara",
  viewVisual: "Görsel",
  viewCompact: "Sıkı",
  loadMore: "Daha Fazla Göster",
  firstSeen: "İlk Görülme",
  caponeDiscovered: "CAPONE keşfi",
  source: "Kaynak",
  category: "Kategori",
  emptyNewArrivals: "Bu tarih aralığında kaynakta doğrulanmış yeni ürün bulunamadı.",
  emptyDiscovered: "Bu tarih aralığında yeni keşfedilen model bulunamadı.",
  emptyUnreviewed: "Tüm modeller incelendi.",
  emptySaved: "Henüz kaydedilmiş ürün yok.",
  emptyFilters: "Seçtiğiniz filtrelere uygun ürün bulunamadı.",
  loading: "Yükleniyor...",
  noImage: "Görsel yok",
  modelsCount: (count: number) => `${count} model`,
  modelsWithUnreviewed: (total: number, unreviewed: number) =>
    `${total} model · ${unreviewed} incelenmemiş`,
  verifiedNewCount: (count: number) => `Yeni: ${count}`,
  backToCategories: "Kategorilere Dön",
  changeCategory: "Kategori Değiştir",
  dataCoverage: "Veri Kapsamı",
  dataCoverageInfo: "Veri Kapsamı ⓘ",
  coverageLabel: (known: number, applicable: number, percent: number) =>
    `Bilgi kapsamı: ${known} / ${applicable} (%${percent.toLocaleString("tr-TR")})`,
  productDetail: "Ürün Detayı",
  productGallery: "Ürün Galerisi",
  closeGallery: "Galeriyi kapat",
  nextPhoto: "Sonraki fotoğraf",
  prevPhoto: "Önceki fotoğraf",
  galleryPhotoCount: (current: number, total: number) => `${current} / ${total}`,
  galleryZoomHint: "Kaydırarak yakınlaştır · sürükleyerek gez",
  galleryPinchHint: "İki parmakla yakınlaştır",
  galleryZoomControls: "Yakınlaştırma kontrolleri",
  zoomIn: "Yakınlaştır",
  zoomOut: "Uzaklaştır",
  resetZoom: "Yakınlaştırmayı sıfırla",
  galleryStatus: (
    current: number,
    total: number,
    color: string | null,
    zoomPercent: number,
  ) =>
    `${color ? `Renk: ${color}. ` : ""}Fotoğraf ${current} / ${total}. Yakınlaştırma yüzde ${zoomPercent}.`,
  openAtSource: "Ürünü Kaynağında Aç",
  dataSource: "Veri Kaynağı",
  confidence: "Güven",
  visualAnalysis: "Görsel Analiz",
  markReviewed: "İnceledim",
  reviewed: "İncelendi ✓",
  save: "Kaydet ♡",
  saved: "Kaydedildi ♥",
  productNote: "Ürün Notum",
  addNote: "Not Ekle",
  nextUnreviewed: "Sonraki İncelenmemiş →",
  savedProductsTitle: "KAYDETTİKLERİM",
  savedProductsSubtitle: "Ürün geliştirme için kaydettiğiniz modeller",
  brandsTitle: "MARKALAR",
  brandsSubtitle: "Resmi marka sitelerinden toplanan kadın ayakkabısı modelleri",
  backToBrands: "Markalara Dön",
  allProducts: "Tüm Ürünler",
  sourceCategories: "Kategoriler",
  sourceCategory: "Kaynak kategorisi",
  noVerifiedNewAtSource: "Bu kaynakta doğrulanmış Yeni Gelenler bölümü bulunamadı.",
  noSourceCategories: "Bu kaynak için kategori bilgisi henüz yok.",
  marketplacesTitle: "PAZARYERLERİ",
  marketplacesSubtitle: "Lüks çok markalı perakende kaynakları",
  marketplaceAllModels: "Tüm Modeller",
  marketplaceBrands: "Markalar",
  backToMarketplaces: "Pazaryerlerine Dön",
  productsCount: (count: number) => `${count} ürün`,
  newCount: (count: number) => `${count} yeni`,
  allCountries: "TÜMÜ",
  marketplacePending: "Bağlantı bekleniyor",
  marketplaceEmpty: "Henüz bağlanmış bir pazaryeri yok.",
  appLoading: "CAPONE yükleniyor…",
  catalogLoading: "Ürünler yükleniyor…",
  catalogLoadError: "Ürün verisi yüklenemedi.",
  retry: "Yeniden dene",
  brandAllProducts: "TÜM ÜRÜNLER",
  brandNewArrivals: "YENİ GELENLER",
  categoryAllChip: "TÜMÜ",
  categoriesHeading: "KATEGORİLER",
  visualTitle: "VISUAL",
  visualOnlyNew: "Sadece yeni gelenler",
  visualNewFirst: "Kaynakta yeni olanlar önce",
  visualSubtitle: "Toplanan kadın ayakkabıları — temel kategori duvarı",
  allBrands: "TÜM MARKALAR",
  savedBrandsFilter: "KAYDETTİĞİM MARKALAR",
  saveBrand: "♡ MARKAYI KAYDET",
  savedBrand: "♥ KAYDEDİLDİ",
  savedPageProducts: "ÜRÜNLER",
  savedPageBrands: "MARKALAR",
  emptySavedBrands: "Henüz kaydedilmiş marka yok.",
  colorsHeading: "RENKLER",
  colorsCount: (count: number) => `${count} RENK`,
  sourceCategoriesDrawer: "KAYNAK KATEGORİLERİ",
  marketResearchTitle: "PAZAR ARAŞTIRMASI",
  marketResearchSubtitle: "Satış pazarında hangi marka ve modelin kaça satıldığını izler",
  marketResearchRomania: "ROMANYA",
  marketResearchOrigin: "Menşei",
  marketResearchSalesMarket: "Satış pazarı",
  marketResearchSoldInMarket: "Romanya'da satılıyor",
  marketResearchNotSoldInMarket: "Romanya satış kaydı yok",
  marketResearchSources: "Kaynaklar",
  marketResearchObservedAt: "Gözlem",
  marketResearchPricePending: "Fiyat gözlemlenmedi",
  marketResearchSnapshotNote: "Güvenli snapshot — canlı collect bu görünümü ezmez",
  backToMarketResearch: "Pazar Araştırmasına Dön",
  marketResearchEmptyBrand: "Bu marka için henüz ürün snapshot'ı yok.",
  marketResearchSourceUnavailable: "Kaynak görseli alınamadı",
  marketResearchModelUnavailable: "Bu model için kaynak görseli yok",
  marketResearchVisualIncomplete: "Görsel tamamlanmadı",
} as const;
