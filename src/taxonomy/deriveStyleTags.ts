import type { DerivedStyleTag, PrimaryFootwearCategory } from "./types";

export function deriveStyleTags(input: {
  primaryCategory: PrimaryFootwearCategory;
  hybridInfluences: string[];
  strapConfiguration?: string | null;
  loaferDetail?: string[] | null;
  bootStyleFeatures?: string[] | null;
  productName?: string;
}): DerivedStyleTag[] {
  const tags = new Set<DerivedStyleTag>();
  const text = (input.productName ?? "").toLowerCase();
  const strap = (input.strapConfiguration ?? "").toUpperCase();

  if (input.primaryCategory === "BALLET_FLAT" && strap.includes("INSTEP")) {
    tags.add("MARY_JANE");
  }
  if (text.includes("mary jane") || text.includes("mary-jane")) {
    tags.add("MARY_JANE");
  }

  if (
    input.primaryCategory === "LOAFER" ||
    (input.primaryCategory === "MULE" && input.hybridInfluences.includes("LOAFER"))
  ) {
    const details = input.loaferDetail ?? [];
    if (details.includes("HORSEBIT") || text.includes("horsebit")) {
      tags.add("HORSEBIT_LOAFER");
    }
  }

  if (input.primaryCategory === "BOOT") {
    const bootFeatures = input.bootStyleFeatures ?? [];
    if (bootFeatures.includes("BIKER") || text.includes("biker")) {
      tags.add("BIKER_BOOT");
    }
    if (bootFeatures.includes("CHELSEA") || text.includes("chelsea")) {
      tags.add("CHELSEA_BOOT");
    }
  }

  if (input.primaryCategory === "SNEAKER" && input.hybridInfluences.includes("BALLET")) {
    tags.add("BALLET_SNEAKER");
  }

  if (input.primaryCategory === "PUMP" && (text.includes("slingback") || strap.includes("SLINGBACK"))) {
    tags.add("SLINGBACK_PUMP");
  }

  if (input.primaryCategory === "SANDAL" && (text.includes("thong") || text.includes("flip flop"))) {
    tags.add("THONG_SANDAL");
  }

  if (
    input.primaryCategory === "OXFORD_DERBY" &&
    (text.includes("platform") || text.includes("flatform"))
  ) {
    tags.add("PLATFORM_DERBY");
  }

  if (
    input.primaryCategory === "ESPADRILLE" &&
    (text.includes("wedge") || text.includes("jute wedge"))
  ) {
    tags.add("ESPADRILLE_WEDGE");
  }

  return [...tags];
}
