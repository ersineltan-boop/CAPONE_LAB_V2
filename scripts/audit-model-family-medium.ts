import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadModelFamilies } from "../src/modelFamily/dataset";
import { extractStyleCode } from "../src/modelFamily/styleCode";
import { normalizeModelName } from "../src/modelFamily/normalizeModelName";
import type { ModelFamily, RawAnalyzedProduct } from "../src/modelFamily/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MULTIBRAND_DIR = join(__dirname, "..", "data", "multibrand");

interface AuditedProduct {
  originalTitle: string;
  productId: string;
  productUrl: string;
  representativeImageUrl: string | null;
  color: string | null;
  material: string | null;
  category: string | null;
  toeShape: string;
  heelType: string;
  heelHeightGroup: string;
  construction: string[];
  details: string[];
  extractedStyleCode: string | null;
  normalizedModelName: string;
}

interface StructuralConflicts {
  categoryConflict?: string[];
  heelConflict?: string[];
  toeConflict?: string[];
  constructionConflict?: string[];
  openClosedConflict?: string[];
  slingbackBacklessConflict?: string[];
}

interface MediumFamilyAuditEntry {
  brand: string;
  canonicalName: string;
  modelFamilyId: string;
  variantCount: number;
  groupingReason: string;
  structuralConflicts: StructuralConflicts;
  products: AuditedProduct[];
}

interface MediumFamilyAuditReport {
  generatedAt: string;
  mediumFamilyCount: number;
  familiesWithStructuralConflict: number;
  families: MediumFamilyAuditEntry[];
}

function uniqueNonUnknown(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          Boolean(value) && value !== "UNKNOWN" && value !== "OTHER",
      ),
    ),
  ];
}

function detectOpenClosedTag(product: RawAnalyzedProduct): string | null {
  const construction = product.normalized.construction;
  if (construction.includes("OPEN_TOE") || construction.includes("PEEP_TOE")) {
    return "OPEN";
  }
  if (construction.includes("CLOSED_TOE")) {
    return "CLOSED";
  }
  return null;
}

function detectSlingbackBacklessTag(product: RawAnalyzedProduct): string | null {
  const construction = product.normalized.construction;
  if (construction.includes("SLINGBACK")) return "SLINGBACK";
  if (construction.includes("BACKLESS")) return "BACKLESS";
  return null;
}

function detectStructuralConflicts(
  products: RawAnalyzedProduct[],
): StructuralConflicts {
  const conflicts: StructuralConflicts = {};

  const categories = uniqueNonUnknown(
    products.map((product) => product.normalized.category ?? product.category),
  );
  if (categories.length > 1) conflicts.categoryConflict = categories;

  const heels = uniqueNonUnknown(
    products.map(
      (product) =>
        `${product.normalized.heelType}/${product.normalized.heelHeightGroup}`,
    ),
  );
  if (heels.length > 1) conflicts.heelConflict = heels;

  const toes = uniqueNonUnknown(
    products.map((product) => product.normalized.toeShape),
  );
  if (toes.length > 1) conflicts.toeConflict = toes;

  const constructionSignatures = [
    ...new Set(
      products.map((product) =>
        [...product.normalized.construction].sort().join("|"),
      ),
    ),
  ].filter((signature) => signature.length > 0);
  if (constructionSignatures.length > 1) {
    conflicts.constructionConflict = constructionSignatures.map((signature) =>
      signature.replace(/\|/g, ", "),
    );
  }

  const openClosed = uniqueNonUnknown(products.map(detectOpenClosedTag));
  if (openClosed.length > 1) conflicts.openClosedConflict = openClosed;

  const slingbackBackless = uniqueNonUnknown(
    products.map(detectSlingbackBacklessTag),
  );
  if (slingbackBackless.length > 1) {
    conflicts.slingbackBacklessConflict = slingbackBackless;
  }

  return conflicts;
}

function hasAnyConflict(conflicts: StructuralConflicts): boolean {
  return Object.keys(conflicts).length > 0;
}

function toAuditedProduct(product: RawAnalyzedProduct): AuditedProduct {
  return {
    originalTitle: product.productName,
    productId: product.productUrl,
    productUrl: product.productUrl,
    representativeImageUrl: product.imageUrl,
    color: product.cleaned.color ?? product.color,
    material: product.material,
    category: product.normalized.category ?? product.category,
    toeShape: product.normalized.toeShape,
    heelType: product.normalized.heelType,
    heelHeightGroup: product.normalized.heelHeightGroup,
    construction: [...product.normalized.construction],
    details: [...product.normalized.details],
    extractedStyleCode: extractStyleCode(product),
    normalizedModelName: normalizeModelName(product.productName, {
      color: product.cleaned.color ?? product.color,
      colorFamily: product.normalized.colorFamily,
    }),
  };
}

export function buildMediumFamilyAudit(input: {
  families: ModelFamily[];
  products: RawAnalyzedProduct[];
}): MediumFamilyAuditReport {
  const productByUrl = new Map(
    input.products.map((product) => [product.productUrl, product]),
  );

  const mediumFamilies = input.families
    .filter((family) => family.groupingConfidence === "MEDIUM")
    .sort(
      (a, b) =>
        b.variantCount - a.variantCount ||
        a.canonicalName.localeCompare(b.canonicalName, "tr"),
    );

  const families: MediumFamilyAuditEntry[] = mediumFamilies.map((family) => {
    const familyProducts = family.sourceProductIds
      .map((productId) => productByUrl.get(productId))
      .filter((product): product is RawAnalyzedProduct => Boolean(product));

    return {
      brand: family.brand,
      canonicalName: family.canonicalName,
      modelFamilyId: family.modelFamilyId,
      variantCount: family.variantCount,
      groupingReason: family.groupingReason,
      structuralConflicts: detectStructuralConflicts(familyProducts),
      products: familyProducts.map(toAuditedProduct),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    mediumFamilyCount: families.length,
    familiesWithStructuralConflict: families.filter((family) =>
      hasAnyConflict(family.structuralConflicts),
    ).length,
    families,
  };
}

const families = await loadModelFamilies();
const products = JSON.parse(
  await readFile(join(MULTIBRAND_DIR, "analyzed-products.json"), "utf-8"),
) as RawAnalyzedProduct[];

const report = buildMediumFamilyAudit({ families, products });
const outputPath = join(MULTIBRAND_DIR, "model-family-medium-audit.json");

await writeFile(outputPath, JSON.stringify(report, null, 2), "utf-8");

const conflictNames = report.families
  .filter((family) => hasAnyConflict(family.structuralConflicts))
  .map((family) => `${family.brand} · ${family.canonicalName}`);

console.log(
  JSON.stringify(
    {
      mediumFamilyCount: report.mediumFamilyCount,
      familiesWithStructuralConflict: report.familiesWithStructuralConflict,
      conflictFamilyNames: conflictNames,
      first15Titles: report.families.slice(0, 15).map((family) => ({
        brand: family.brand,
        canonicalName: family.canonicalName,
        titles: family.products.map((product) => product.originalTitle),
      })),
      outputPath,
    },
    null,
    2,
  ),
);
