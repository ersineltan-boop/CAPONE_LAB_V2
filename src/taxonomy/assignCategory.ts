import type { FootwearCategory } from "../types/pilotProduct";
import type {
  CategoryAssignmentProvenance,
  HybridInfluence,
  PrimaryFootwearCategory,
} from "./types";
import { normalizeProductText, parseExplicitHeelHeightMm, textIncludesAny } from "./featureHelpers";

export interface CategoryAssignmentInput {
  productName: string;
  legacyCategory?: FootwearCategory | null;
  construction?: string[];
  heelHeightGroup?: string;
  cleanedHeelHeight?: string | null;
  toeShape?: string;
  details?: string[];
  materialFamily?: string;
  /** Optional source collection / category path text for evidence-aware precedence. */
  sourceCategoryText?: string | null;
}

export interface CategoryAssignmentResult {
  primaryCategory: PrimaryFootwearCategory;
  hybridInfluences: HybridInfluence[];
  reason: string;
  provenance: CategoryAssignmentProvenance;
}

function hasBackless(text: string, construction: string[]): boolean {
  return (
    textIncludesAny(text, ["backless", " mule", "slide mule", "heeled mule"]) ||
    construction.includes("BACKLESS")
  );
}

function hasSlingback(text: string, construction: string[]): boolean {
  return (
    textIncludesAny(text, ["slingback", "sling back", "sling-back"]) ||
    construction.includes("SLINGBACK")
  );
}

function isSneakerDominant(text: string): boolean {
  return textIncludesAny(text, [
    "sneaker",
    "trainer",
    "cupsole",
    "running shoe",
    "court shoe",
    "skate shoe",
    "tennis shoe",
    "tenis",
    "ténis",
  ]);
}

function hasMixedSapatilhaTenisCollection(text: string): boolean {
  return /sapatilhas?\s*e\s*t[eé]nis|t[eé]nis\s*e\s*sapatilhas?/i.test(text);
}

function hasSapatilhaOnlyTitle(text: string): boolean {
  return /\bsapatilha/.test(text) && !isSneakerDominant(text);
}

function isEspadrilleDominant(text: string): boolean {
  return textIncludesAny(text, [
    "espadrille",
    "jute sole",
    "jute wedge",
    "rope sole",
    "raffia sole",
  ]);
}

function isClogDominant(text: string): boolean {
  return textIncludesAny(text, [" clog", "clogs", "wooden clog", "molded clog"]);
}

function isOxfordDerbyDominant(text: string): boolean {
  return textIncludesAny(text, [
    " oxford",
    " derby",
    "brogue",
    "lace-up dress",
    "cap toe oxford",
    "wholecut",
  ]);
}

function isBootDominant(text: string, legacyCategory?: FootwearCategory | null): boolean {
  if (legacyCategory === "BOOT" || legacyCategory === "ANKLE_BOOT") return true;
  return textIncludesAny(text, [
    " boot",
    "bootie",
    "ankle boot",
    "knee boot",
    "chelsea boot",
    "combat boot",
    "biker boot",
    "riding boot",
  ]);
}

function hasConflictingSilhouette(text: string): boolean {
  return textIncludesAny(text, [
    "pump",
    "loafer",
    "ballet",
    "ballerina",
    "mule",
    "bootie",
    "sneaker",
    "trainer",
    "mary jane",
    "mary-jane",
    "clog",
    "oxford",
    "derby",
  ]);
}

function isExplicitPumpSilhouette(text: string): boolean {
  return /\bpumps?\b/.test(text);
}

function isOpenSandalEvidence(text: string, construction: string[]): boolean {
  return (
    textIncludesAny(text, [
      "thong",
      "flip flop",
      "flip-flop",
      "strappy",
      "t-strap",
      "ankle strap",
      "toe ring",
      "toe-post",
      "toe post",
      "slide sandal",
      "gladiator",
    ]) ||
    construction.includes("OPEN_TOE") ||
    construction.includes("TOE_POST") ||
    construction.includes("THONG")
  );
}

function shouldPreferMuleOverNamedSandal(
  text: string,
  construction: string[],
  legacyCategory?: FootwearCategory | null,
): boolean {
  if (!hasBackless(text, construction)) return false;
  if (isOpenSandalEvidence(text, construction)) return false;
  if (construction.includes("CLOSED_TOE")) return true;
  if (legacyCategory === "MULE") return true;
  return textIncludesAny(text, [" mule", "mules"]);
}

function isSandalDominant(
  text: string,
  construction: string[],
  legacyCategory?: FootwearCategory | null,
): boolean {
  if (isExplicitPumpSilhouette(text) && !textIncludesAny(text, [" sandal", "sandals"])) {
    return false;
  }
  if (shouldPreferMuleOverNamedSandal(text, construction, legacyCategory)) {
    return false;
  }
  const namedSandal = textIncludesAny(text, [
    " sandal",
    "slide sandal",
    "strappy sandal",
    " thong",
    "flip flop",
    "flip-flop",
    "t-strap sandal",
  ]);
  if (namedSandal) return true;
  if (hasConflictingSilhouette(text)) return false;
  return legacyCategory === "SANDAL" || legacyCategory === "THONG";
}

function isLoaferArchitecture(text: string): boolean {
  return textIncludesAny(text, [
    "loafer",
    "penny loafer",
    "horsebit",
    "tassel loafer",
    "moc toe",
    "moccasin",
    "apron toe loafer",
  ]);
}

function hasRaisedHeelPumpSignals(
  text: string,
  heelHeightGroup?: string,
  cleanedHeelHeight?: string | null,
): boolean {
  const mm = parseExplicitHeelHeightMm(`${text} ${cleanedHeelHeight ?? ""}`);
  if (mm !== null && mm >= 30) return true;
  if (heelHeightGroup === "MID" || heelHeightGroup === "HIGH") return true;
  return textIncludesAny(text, ["pump", " stiletto", " kitten heel", " heeled"]);
}

function isBalletFlatArchitecture(
  text: string,
  heelHeightGroup?: string,
  cleanedHeelHeight?: string | null,
): boolean {
  if (textIncludesAny(text, ["mary jane", "mary-jane", "maryjanes"])) return true;
  if (textIncludesAny(text, ["pointed-toe flat", "pointed toe flat", "pointed flat"])) {
    return true;
  }
  const mm = parseExplicitHeelHeightMm(`${text} ${cleanedHeelHeight ?? ""}`);
  if (mm !== null && mm <= 15) return true;
  if (heelHeightGroup === "FLAT" || heelHeightGroup === "LOW") {
    return textIncludesAny(text, ["ballet", "ballerina", "slipper flat", "flat shoe"]);
  }
  return textIncludesAny(text, [
    "ballet flat",
    "ballerina flat",
    "ballerina slipper",
    "ballet",
    "ballerina",
  ]);
}

function isCoveredVampMule(text: string): boolean {
  return (
    hasBackless(text, []) &&
    textIncludesAny(text, ["closed toe", "pointed mule", "covered vamp", "vamp mule"])
  );
}

export function assignPrimaryCategory(input: CategoryAssignmentInput): CategoryAssignmentResult {
  const text = normalizeProductText([
    input.productName,
    input.cleanedHeelHeight,
    input.toeShape,
    input.materialFamily,
    ...(input.details ?? []),
  ]);
  const sourceText = normalizeProductText([input.sourceCategoryText]);
  const construction = input.construction ?? [];
  const hybrid: HybridInfluence[] = [];

  // Product-title sneaker evidence only — collection "… e ténis" is not mass-sneaker proof.
  if (isSneakerDominant(text)) {
    if (textIncludesAny(text, ["ballet sneaker", "ballerina sneaker", "mary jane sneaker"])) {
      hybrid.push("BALLET");
    }
    return {
      primaryCategory: "SNEAKER",
      hybridInfluences: hybrid,
      reason: "sneaker-dominant-construction",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (isEspadrilleDominant(text)) {
    return {
      primaryCategory: "ESPADRILLE",
      hybridInfluences: hybrid,
      reason: "espadrille-sole-architecture",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (isClogDominant(text)) {
    return {
      primaryCategory: "CLOG",
      hybridInfluences: hybrid,
      reason: "clog-base-architecture",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (isOxfordDerbyDominant(text)) {
    if (textIncludesAny(text, ["derby"])) hybrid.push("DERBY");
    else hybrid.push("OXFORD");
    return {
      primaryCategory: "OXFORD_DERBY",
      hybridInfluences: hybrid,
      reason: "lace-up-dress-shoe",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (isBootDominant(text, input.legacyCategory) && !isSneakerDominant(text)) {
    return {
      primaryCategory: "BOOT",
      hybridInfluences: hybrid,
      reason: "boot-shaft-architecture",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (isSandalDominant(text, construction, input.legacyCategory)) {
    if (textIncludesAny(text, ["single band", "one band"]) && hasBackless(text, construction)) {
      // simple open backless band -> sandal not mule
    }
    return {
      primaryCategory: "SANDAL",
      hybridInfluences: hybrid,
      reason: "open-strap-footwear",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  const backless = hasBackless(text, construction);
  const loaferArch = isLoaferArchitecture(text);

  if (backless && loaferArch) {
    hybrid.push("LOAFER");
    return {
      primaryCategory: "MULE",
      hybridInfluences: hybrid,
      reason: "backless-loafer-architecture",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (backless && hasRaisedHeelPumpSignals(text, input.heelHeightGroup, input.cleanedHeelHeight)) {
    hybrid.push("PUMP");
    return {
      primaryCategory: "MULE",
      hybridInfluences: hybrid,
      reason: "backless-covered-vamp-heeled",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (backless && isBalletFlatArchitecture(text, input.heelHeightGroup, input.cleanedHeelHeight)) {
    hybrid.push("BALLET");
    return {
      primaryCategory: "MULE",
      hybridInfluences: hybrid,
      reason: "backless-ballet-upper",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (backless && (isCoveredVampMule(text) || input.legacyCategory === "MULE")) {
    return {
      primaryCategory: "MULE",
      hybridInfluences: hybrid,
      reason: "backless-covered-vamp",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (hasSlingback(text, construction)) {
    const mm = parseExplicitHeelHeightMm(`${text} ${input.cleanedHeelHeight ?? ""}`);
    if (mm !== null && mm <= 15) {
      return {
        primaryCategory: "BALLET_FLAT",
        hybridInfluences: hybrid,
        reason: "low-slingback-flat",
        provenance: "PRODUCT_EVIDENCE",
      };
    }
    if (hasRaisedHeelPumpSignals(text, input.heelHeightGroup, input.cleanedHeelHeight)) {
      return {
        primaryCategory: "PUMP",
        hybridInfluences: hybrid,
        reason: "slingback-pump",
        provenance: "PRODUCT_EVIDENCE",
      };
    }
    if (isBalletFlatArchitecture(text, input.heelHeightGroup, input.cleanedHeelHeight)) {
      return {
        primaryCategory: "BALLET_FLAT",
        hybridInfluences: hybrid,
        reason: "slingback-ballet-flat",
        provenance: "PRODUCT_EVIDENCE",
      };
    }
  }

  if (hasRaisedHeelPumpSignals(text, input.heelHeightGroup, input.cleanedHeelHeight)) {
    if (textIncludesAny(text, ["ballet", "ballerina"])) hybrid.push("BALLET");
    return {
      primaryCategory: "PUMP",
      hybridInfluences: hybrid,
      reason: "raised-heel-pump-upper",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (loaferArch && !backless) {
    return {
      primaryCategory: "LOAFER",
      hybridInfluences: hybrid,
      reason: "loafer-architecture",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  if (isBalletFlatArchitecture(text, input.heelHeightGroup, input.cleanedHeelHeight)) {
    return {
      primaryCategory: "BALLET_FLAT",
      hybridInfluences: hybrid,
      reason: "ballet-flat-architecture",
      provenance: "PRODUCT_EVIDENCE",
    };
  }

  // Legacy category fallback — deterministic, no fabrication
  const legacyMap = mapLegacyCategory(input.legacyCategory);
  if (legacyMap) {
    // Stored BALLERINA from generic Portuguese "sapatilha" is not trusted when the
    // source collection mixes sapatilhas + ténis and title lacks ballet evidence.
    if (
      (input.legacyCategory === "BALLERINA" || input.legacyCategory === "MARY_JANE") &&
      hasSapatilhaOnlyTitle(text) &&
      hasMixedSapatilhaTenisCollection(sourceText) &&
      !isBalletFlatArchitecture(text, input.heelHeightGroup, input.cleanedHeelHeight)
    ) {
      return {
        primaryCategory: "UNCLASSIFIED",
        hybridInfluences: hybrid,
        reason: "sapatilha-mixed-tenis-collection-conservative",
        provenance: "INSUFFICIENT",
      };
    }
    return {
      primaryCategory: legacyMap.category,
      hybridInfluences: [...legacyMap.hybrid, ...hybrid],
      reason: `legacy-category:${input.legacyCategory}`,
      provenance: "LEGACY_CATEGORY",
    };
  }

  return {
    primaryCategory: "UNCLASSIFIED",
    hybridInfluences: hybrid,
    reason: "insufficient-evidence",
    provenance: "INSUFFICIENT",
  };
}

export function mapLegacyCategory(
  legacy?: FootwearCategory | null,
): { category: PrimaryFootwearCategory; hybrid: HybridInfluence[] } | null {
  if (!legacy) return null;
  switch (legacy) {
    case "BALLERINA":
    case "MARY_JANE":
      return { category: "BALLET_FLAT", hybrid: legacy === "MARY_JANE" ? [] : [] };
    case "LOAFER":
      return { category: "LOAFER", hybrid: [] };
    case "PUMP":
    case "SLINGBACK":
      return { category: "PUMP", hybrid: legacy === "SLINGBACK" ? [] : [] };
    case "SANDAL":
    case "THONG":
      return { category: "SANDAL", hybrid: [] };
    case "MULE":
      return { category: "MULE", hybrid: [] };
    case "BOOT":
    case "ANKLE_BOOT":
      return { category: "BOOT", hybrid: [] };
    case "SNEAKER":
      return { category: "SNEAKER", hybrid: [] };
    case "WEDGE":
      return { category: "SANDAL", hybrid: [] };
    case "OTHER_FOOTWEAR":
      return null;
    default:
      return null;
  }
}
