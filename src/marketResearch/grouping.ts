import {
  canGroupAsColorVariants,
  modelsAreDistinctVersions,
} from "../operator/policies/onboardingQuality";
import type { ModelGroupingCandidate } from "../operator/types";
import type { MarketResearchModel, MarketResearchVariant } from "./types";

export function marketResearchModelsAreDistinct(leftName: string, rightName: string): boolean {
  return modelsAreDistinctVersions(leftName, rightName);
}

export function canGroupMarketResearchVariants(
  left: ModelGroupingCandidate,
  right: ModelGroupingCandidate,
): { merge: boolean; reason: string } {
  return canGroupAsColorVariants(left, right);
}

export function variantToGroupingCandidate(
  modelName: string,
  variant: Pick<MarketResearchVariant, "id" | "color">,
): ModelGroupingCandidate {
  return {
    normalizedModelName: modelName,
    color: variant.color,
    stableModelCode: modelName,
    sourceVariantGroup: modelName,
  };
}

export function assertDistinctModelNamesStaySeparate(names: readonly string[]): string[] {
  const collisions: string[] = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const left = names[i]!;
      const right = names[j]!;
      if (marketResearchModelsAreDistinct(left, right)) {
        collisions.push(`${left} <> ${right}`);
      }
    }
  }
  return collisions;
}

export function modelsShareExactName(left: MarketResearchModel, right: MarketResearchModel): boolean {
  return left.name.trim().toLowerCase() === right.name.trim().toLowerCase();
}
