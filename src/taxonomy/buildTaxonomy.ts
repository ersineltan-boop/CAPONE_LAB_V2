import type { RawAnalyzedProduct } from "../modelFamily/types";
import type { CategoryAssignmentInput } from "./assignCategory";
import { assignPrimaryCategory } from "./assignCategory";
import { applyCategoryDerivedFeatures } from "./categoryDerivedRules";
import { deriveStyleTags } from "./deriveStyleTags";
import {
  createEmptyGlobalFields,
  featureKnown,
  featureNotApplicable,
  featureUnknown,
  normalizeProductText,
  parseExplicitHeelHeightMm,
  textIncludesAny,
} from "./featureHelpers";
import type {
  ApronConstructionTaxonomy,
  BackConstructionTaxonomy,
  BootStyleFeature,
  FootwearTaxonomyCategoryFields,
  FootwearTaxonomyV1,
  HeelHeightClassTaxonomy,
  HeelTypeTaxonomy,
  LoaferDetailTaxonomy,
  PrimaryFootwearCategory,
  ShaftHeightTaxonomy,
  SneakerStyleArchetype,
  ToeOpeningTaxonomy,
  ToeShapeTaxonomy,
} from "./types";

function mapToeShape(value?: string): ToeShapeTaxonomy | null {
  switch (value) {
    case "POINTED":
      return "POINTED";
    case "ROUND":
      return "ROUND";
    case "SQUARE":
      return "SQUARE";
    default:
      return null;
  }
}

function mapHeelHeightClass(value?: string): HeelHeightClassTaxonomy | null {
  switch (value) {
    case "FLAT":
    case "LOW":
    case "MID":
    case "HIGH":
      return value;
    default:
      return null;
  }
}

function mapHeelType(value?: string): HeelTypeTaxonomy | null {
  switch (value) {
    case "FLAT":
      return "NONE";
    case "KITTEN":
      return "KITTEN";
    case "BLOCK":
      return "BLOCK";
    case "STILETTO":
      return "STILETTO";
    case "WEDGE":
      return "WEDGE";
    case "SCULPTURAL":
      return "SCULPTURAL";
    case "PLATFORM":
    case "OTHER":
      return "OTHER";
    default:
      return null;
  }
}

function resolveBackConstruction(product: RawAnalyzedProduct, text: string) {
  const construction = product.normalized.construction ?? [];

  if (
    construction.includes("SLINGBACK") ||
    textIncludesAny(text, ["slingback", "sling back", "sling-back"])
  ) {
    return featureKnown<BackConstructionTaxonomy>("SLINGBACK", "PRODUCT_TEXT");
  }

  if (
    construction.includes("BACKLESS") ||
    textIncludesAny(text, ["backless", " mule", "slide mule", "heeled mule"])
  ) {
    return featureKnown<BackConstructionTaxonomy>("BACKLESS", "PRODUCT_TEXT");
  }

  return featureUnknown<BackConstructionTaxonomy>();
}

function resolveToeOpening(product: RawAnalyzedProduct, text: string) {
  const construction = product.normalized.construction ?? [];

  if (construction.includes("PEEP_TOE") || textIncludesAny(text, ["peep toe"])) {
    return featureKnown<ToeOpeningTaxonomy>("PEEP", "PRODUCT_TEXT");
  }

  if (construction.includes("OPEN_TOE") || textIncludesAny(text, ["open toe"])) {
    return featureKnown<ToeOpeningTaxonomy>("OPEN", "PRODUCT_TEXT");
  }

  return featureUnknown<ToeOpeningTaxonomy>();
}

function buildGlobalFields(product: RawAnalyzedProduct, text: string) {
  const global = createEmptyGlobalFields();
  const construction = product.normalized.construction ?? [];

  const toe = mapToeShape(product.normalized.toeShape);
  global.toeShape = toe ? featureKnown(toe, "DERIVED") : featureUnknown();

  global.toeOpening = resolveToeOpening(product, text);
  global.backConstruction = resolveBackConstruction(product, text);

  const heelClass = mapHeelHeightClass(product.normalized.heelHeightGroup);
  global.heelHeightClass = heelClass
    ? featureKnown(heelClass, "DERIVED")
    : featureUnknown();

  const explicitMm = parseExplicitHeelHeightMm(
    `${product.productName} ${product.cleaned.heelHeight ?? ""}`,
  );
  global.heelHeightMm = explicitMm
    ? featureKnown(explicitMm, "PRODUCT_TEXT", 0.95)
    : featureUnknown();

  const heelType = mapHeelType(product.normalized.heelType);
  global.heelType = heelType ? featureKnown(heelType, "DERIVED") : featureUnknown();

  if (product.normalized.materialFamily && product.normalized.materialFamily !== "UNKNOWN") {
    global.materialFamily = featureKnown([product.normalized.materialFamily], "DERIVED");
  }
  if (product.normalized.colorFamily && product.normalized.colorFamily !== "UNKNOWN") {
    global.colorFamily = featureKnown([product.normalized.colorFamily], "DERIVED");
  }

  const strapFeatures: string[] = [];
  if (construction.includes("T_STRAP")) strapFeatures.push("T_STRAP");
  if (construction.includes("ANKLE_STRAP")) strapFeatures.push("ANKLE_STRAP");
  if (construction.includes("SLINGBACK")) strapFeatures.push("SLINGBACK");
  global.strapFeatures =
    strapFeatures.length > 0
      ? featureKnown(strapFeatures, "PRODUCT_TEXT")
      : featureUnknown();

  return global;
}

function buildCategorySpecificFields(
  category: PrimaryFootwearCategory,
  product: RawAnalyzedProduct,
  text: string,
): FootwearTaxonomyCategoryFields {
  const fields: FootwearTaxonomyCategoryFields = {};
  const construction = product.normalized.construction ?? [];

  const strapParts: string[] = [];
  if (construction.includes("SLINGBACK")) strapParts.push("SLINGBACK");
  if (construction.includes("T_STRAP")) strapParts.push("T_STRAP");
  if (construction.includes("ANKLE_STRAP")) strapParts.push("ANKLE_STRAP");
  if (textIncludesAny(text, ["instep strap", "mary jane"])) strapParts.push("SINGLE_INSTEP");

  if (
    category === "BALLET_FLAT" ||
    category === "PUMP" ||
    category === "SANDAL" ||
    category === "MULE"
  ) {
    fields.strapConfiguration =
      strapParts.length > 0
        ? featureKnown(strapParts.join("+"), "PRODUCT_TEXT")
        : featureUnknown();
  } else {
    fields.strapConfiguration = featureNotApplicable();
  }

  if (category === "LOAFER" || (category === "MULE" && textIncludesAny(text, ["loafer", "horsebit"]))) {
    const loaferDetails: LoaferDetailTaxonomy[] = [];
    if (textIncludesAny(text, ["horsebit"])) loaferDetails.push("HORSEBIT");
    if (textIncludesAny(text, ["penny"])) loaferDetails.push("PENNY_STRAP");
    if (textIncludesAny(text, ["tassel"])) loaferDetails.push("TASSEL");
    fields.loaferDetail =
      loaferDetails.length > 0
        ? featureKnown(loaferDetails, "PRODUCT_TEXT")
        : featureUnknown();
    fields.apronConstruction = textIncludesAny(text, ["apron", "moc toe"])
      ? featureKnown("APRON" as ApronConstructionTaxonomy, "PRODUCT_TEXT")
      : featureUnknown();
  }

  if (category === "BOOT") {
    const bootFeatures: BootStyleFeature[] = [];
    if (textIncludesAny(text, ["chelsea"])) bootFeatures.push("CHELSEA");
    if (textIncludesAny(text, ["biker", "moto"])) bootFeatures.push("BIKER");
    fields.bootStyleFeatures =
      bootFeatures.length > 0
        ? featureKnown(bootFeatures, "PRODUCT_TEXT")
        : featureUnknown();
    fields.shaftHeight = textIncludesAny(text, ["over the knee"])
      ? featureKnown("OVER_THE_KNEE" as ShaftHeightTaxonomy, "PRODUCT_TEXT")
      : textIncludesAny(text, ["knee high", "knee-high", " knee boot"])
        ? featureKnown("KNEE_HIGH" as ShaftHeightTaxonomy, "PRODUCT_TEXT")
        : textIncludesAny(text, ["mid calf", "mid-calf"])
          ? featureKnown("MID_CALF" as ShaftHeightTaxonomy, "PRODUCT_TEXT")
          : textIncludesAny(text, ["ankle boot", "ankle-boot", " bootie"])
            ? featureKnown("ANKLE" as ShaftHeightTaxonomy, "PRODUCT_TEXT")
            : featureUnknown();
  }

  if (category === "SNEAKER") {
    let archetype: SneakerStyleArchetype | null = null;
    if (textIncludesAny(text, ["court"])) archetype = "COURT";
    else if (textIncludesAny(text, ["runner", "running"])) archetype = "RETRO_RUNNER";
    else if (textIncludesAny(text, ["skate"])) archetype = "SKATE";
    else if (textIncludesAny(text, ["ballet sneaker"])) archetype = "BALLET_INSPIRED";
    fields.styleArchetype = archetype
      ? featureKnown(archetype, "PRODUCT_TEXT")
      : featureUnknown();
    fields.sneakerHeight = textIncludesAny(text, ["high top", "high-top"])
      ? featureKnown("HIGH_TOP", "PRODUCT_TEXT")
      : textIncludesAny(text, ["mid top", "mid-top"])
        ? featureKnown("MID_TOP", "PRODUCT_TEXT")
        : textIncludesAny(text, ["low top", "low-top"])
          ? featureKnown("LOW_TOP", "PRODUCT_TEXT")
          : featureUnknown();
  }

  if (category === "ESPADRILLE") {
    fields.espadrilleSoleHeight = textIncludesAny(text, ["wedge"])
      ? featureKnown("WEDGE", "PRODUCT_TEXT")
      : textIncludesAny(text, ["platform espadrille", "platform wedge"])
        ? featureKnown("PLATFORM", "PRODUCT_TEXT")
        : textIncludesAny(text, ["flat espadrille"])
          ? featureKnown("FLAT", "PRODUCT_TEXT")
          : featureUnknown();
  }

  if (category === "OXFORD_DERBY") {
    fields.lacingConstruction = textIncludesAny(text, ["derby"])
      ? featureKnown("DERBY", "PRODUCT_TEXT")
      : textIncludesAny(text, ["monk"])
        ? featureKnown("MONK", "PRODUCT_TEXT")
        : textIncludesAny(text, [" oxford", "oxford shoe", "wholecut"])
          ? featureKnown("OXFORD", "PRODUCT_TEXT")
          : featureUnknown();
  }

  if (category === "CLOG") {
    fields.baseConstruction = textIncludesAny(text, ["wood"])
      ? featureKnown("WOOD", "PRODUCT_TEXT")
      : featureUnknown();
  }

  return fields;
}

export function buildTaxonomyFromProduct(product: RawAnalyzedProduct): FootwearTaxonomyV1 {
  const text = normalizeProductText([
    product.productName,
    product.cleaned.heelHeight,
    product.material,
  ]);

  const assignmentInput: CategoryAssignmentInput = {
    productName: product.productName,
    legacyCategory: product.normalized.category ?? product.category,
    construction: product.normalized.construction,
    heelHeightGroup: product.normalized.heelHeightGroup,
    cleanedHeelHeight: product.cleaned.heelHeight,
    toeShape: product.normalized.toeShape,
    details: product.normalized.details,
    materialFamily: product.normalized.materialFamily,
    sourceCategoryText: [
      product.sourceCategoryName,
      product.sourceCategoryPath,
      product.collectionLabel,
      product.collectionPath,
      ...(product.sourceCategories ?? []).flatMap((category) => [
        category.categoryName,
        category.categoryPath,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  };

  const assignment = assignPrimaryCategory(assignmentInput);
  const global = buildGlobalFields(product, text);
  applyCategoryDerivedFeatures(assignment.primaryCategory, global);
  const categorySpecific = buildCategorySpecificFields(
    assignment.primaryCategory,
    product,
    text,
  );

  const derivedStyleTags = deriveStyleTags({
    primaryCategory: assignment.primaryCategory,
    hybridInfluences: assignment.hybridInfluences,
    strapConfiguration: categorySpecific.strapConfiguration?.value ?? null,
    loaferDetail: categorySpecific.loaferDetail?.value ?? null,
    bootStyleFeatures: categorySpecific.bootStyleFeatures?.value ?? null,
    productName: product.productName,
  });

  return {
    version: 1,
    primaryCategory: assignment.primaryCategory,
    hybridInfluences: assignment.hybridInfluences,
    categoryProvenance: assignment.provenance,
    categoryAssignmentReason: assignment.reason,
    global,
    categorySpecific,
    derivedStyleTags,
  };
}

export function buildTaxonomyFromAssignmentInput(
  input: CategoryAssignmentInput,
): FootwearTaxonomyV1 {
  const assignment = assignPrimaryCategory(input);
  const global = createEmptyGlobalFields();
  if (input.heelHeightGroup) {
    const cls = mapHeelHeightClass(input.heelHeightGroup);
    if (cls) global.heelHeightClass = featureKnown(cls, "DERIVED");
  }
  const mm = parseExplicitHeelHeightMm(
    `${input.productName} ${input.cleanedHeelHeight ?? ""}`,
  );
  if (mm) global.heelHeightMm = featureKnown(mm, "PRODUCT_TEXT", 0.95);

  applyCategoryDerivedFeatures(assignment.primaryCategory, global);

  return {
    version: 1,
    primaryCategory: assignment.primaryCategory,
    hybridInfluences: assignment.hybridInfluences,
    categoryProvenance: assignment.provenance,
    categoryAssignmentReason: assignment.reason,
    global,
    categorySpecific: {},
    derivedStyleTags: deriveStyleTags({
      primaryCategory: assignment.primaryCategory,
      hybridInfluences: assignment.hybridInfluences,
      productName: input.productName,
    }),
  };
}
