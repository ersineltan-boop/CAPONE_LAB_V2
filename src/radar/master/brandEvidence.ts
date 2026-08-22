import { brandEntries } from "../../registry/data/brands";
import type { BrandRegistryEntry } from "../../registry/types/brand";
import type {
  BrandEvidenceProfile,
  CommercialRadarStage,
  EarlyRadarStage,
  RadarStage,
} from "./types";

const registryByBrand = new Map(
  brandEntries.map((entry) => [entry.brand.toUpperCase(), entry]),
);

export function isBrandRadarEligible(entry: BrandRegistryEntry): boolean {
  if (entry.classificationStatus !== "REVIEWED") return false;
  if (!entry.radarEligible) return false;
  if (entry.segment === "UNCLASSIFIED" || entry.role === "UNCLASSIFIED") return false;
  return true;
}

export function resolveBrandEvidence(brand: string): BrandEvidenceProfile {
  const entry = registryByBrand.get(brand.toUpperCase());
  if (!entry || !isBrandRadarEligible(entry)) {
    return {
      brand,
      segment: "UNKNOWN",
      role: "UNKNOWN",
      directionalInfluence: 0,
      commercialInfluence: 0,
      footwearInfluence: 0,
    };
  }

  return {
    brand: entry.brand,
    segment: entry.segment,
    role: entry.role,
    directionalInfluence: entry.directionalInfluence,
    commercialInfluence: entry.commercialInfluence,
    footwearInfluence: entry.footwearInfluence,
  };
}

export function isDirectionalBrand(profile: BrandEvidenceProfile): boolean {
  if (profile.segment === "UNKNOWN" || profile.role === "UNKNOWN") return false;
  return (
    (profile.segment === "DIRECTIONAL" || profile.segment === "LUXURY") &&
    (profile.role === "LEADER" || profile.role === "EARLY_ADOPTER")
  );
}

export function isPremiumIndependentBrand(profile: BrandEvidenceProfile): boolean {
  if (profile.segment === "UNKNOWN") return false;
  return (
    profile.segment === "DIRECTIONAL" ||
    profile.segment === "LUXURY" ||
    profile.segment === "PREMIUM" ||
    profile.segment === "CONTEMPORARY"
  );
}

export function isCommercialBrand(profile: BrandEvidenceProfile): boolean {
  if (profile.segment === "UNKNOWN") return false;
  return (
    profile.segment === "CONTEMPORARY" ||
    profile.segment === "PREMIUM" ||
    profile.segment === "MASS_MARKET"
  );
}

export function isMassMarketBrand(profile: BrandEvidenceProfile): boolean {
  if (profile.segment === "UNKNOWN") return false;
  return profile.segment === "MASS_MARKET";
}

export function assignFamilyStage(
  profile: BrandEvidenceProfile,
): RadarStage | null {
  if (profile.segment === "UNKNOWN" || profile.role === "UNKNOWN") {
    return null;
  }

  if (isMassMarketBrand(profile)) return "DOYGUN_GEC";
  if (profile.segment === "MASS_MARKET") return "NUMUNEYE_GIR";
  if (
    profile.segment === "CONTEMPORARY" &&
    (profile.role === "MARKET" || profile.role === "RETAIL")
  ) {
    return "NUMUNEYE_GIR";
  }
  if (isCommercialBrand(profile) && profile.commercialInfluence >= 55) {
    return "HAZIRLAN";
  }
  if (isDirectionalBrand(profile) && profile.directionalInfluence >= 60) {
    return "COK_ERKEN";
  }
  if (isPremiumIndependentBrand(profile) && profile.directionalInfluence >= 45) {
    return "ERKEN_SINYAL";
  }

  return null;
}

export function stageToRadarType(stage: RadarStage): "EARLY" | "COMMERCIAL" {
  if (stage === "COK_ERKEN" || stage === "ERKEN_SINYAL") return "EARLY";
  return "COMMERCIAL";
}

export function earlyStageRank(stage: EarlyRadarStage): number {
  return stage === "COK_ERKEN" ? 0 : 1;
}

export function commercialStageRank(stage: CommercialRadarStage): number {
  if (stage === "HAZIRLAN") return 0;
  if (stage === "NUMUNEYE_GIR") return 1;
  return 2;
}

export function averageBrandQuality(profiles: BrandEvidenceProfile[]): number {
  if (profiles.length === 0) return 0;
  const total = profiles.reduce(
    (sum, profile) =>
      sum +
      Math.max(profile.directionalInfluence, profile.commercialInfluence),
    0,
  );
  return total / profiles.length;
}
