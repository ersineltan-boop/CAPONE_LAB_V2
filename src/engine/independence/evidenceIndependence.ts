import type { TrendObservation } from "../types";
import type { TrendSignalDimensions } from "../types";
import type { DedupeScope } from "../types/stage";
import {
  DEFAULT_EVIDENCE_INDEPENDENCE,
  type EvidenceIndependenceConfig,
} from "../types/observation";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

/** modelFamily yoksa siluet/form/category'den türet */
export function inferModelFamily(observation: TrendObservation): string {
  if (observation.modelFamily) {
    return normalizeToken(observation.modelFamily);
  }

  const { dimensions } = observation;
  const parts = [
    dimensions.silhouette,
    dimensions.category,
    dimensions.toeShape,
    dimensions.heelType,
  ]
    .filter(Boolean)
    .map((p) => normalizeToken(p!));

  return parts.join("|") || "unknown-model";
}

export function buildAdoptionUnitKey(
  observation: TrendObservation,
  scope: DedupeScope,
): string {
  const brandKey = observation.corporateGroup
    ? normalizeToken(observation.corporateGroup)
    : normalizeToken(observation.brand);

  const family = inferModelFamily(observation);

  if (scope === "color") {
    const color = observation.dimensions.color ?? observation.skuVariant ?? "unknown-color";
    return `${brandKey}::${family}::color::${normalizeToken(color)}`;
  }

  if (scope === "material") {
    const material =
      observation.dimensions.material ?? observation.skuVariant ?? "unknown-material";
    return `${brandKey}::${family}::material::${normalizeToken(material)}`;
  }

  return `${brandKey}::${family}`;
}

export function buildPublicationKey(observation: TrendObservation): string {
  const publication = observation.publicationId ?? observation.id;
  return `${observation.sourceId}::${normalizeToken(publication)}`;
}

export function buildIndependentEntityKey(
  observation: TrendObservation,
  config: EvidenceIndependenceConfig,
): string {
  if (config.useCorporateGroup && observation.corporateGroup) {
    return normalizeToken(observation.corporateGroup);
  }
  return normalizeToken(observation.brand);
}

export interface DedupedObservation extends TrendObservation {
  adoptionUnitKey: string;
  independentEntityKey: string;
  publicationKey: string;
}

export function dedupeObservations(
  observations: readonly TrendObservation[],
  config: EvidenceIndependenceConfig = DEFAULT_EVIDENCE_INDEPENDENCE,
): DedupedObservation[] {
  const grouped = new Map<string, DedupedObservation>();

  for (const obs of observations) {
    const adoptionUnitKey = buildAdoptionUnitKey(obs, config.dedupeScope);
    const publicationKey = buildPublicationKey(obs);
    const independentEntityKey = buildIndependentEntityKey(obs, config);

    const dedupeKey = config.dedupePublications
      ? `${adoptionUnitKey}::${publicationKey}`
      : adoptionUnitKey;

    const candidate: DedupedObservation = {
      ...obs,
      adoptionUnitKey,
      independentEntityKey,
      publicationKey,
    };

    const existing = grouped.get(dedupeKey);
    if (!existing || candidate.confidence > existing.confidence) {
      grouped.set(dedupeKey, candidate);
    }
  }

  return [...grouped.values()];
}

export function countAdoptionUnits(
  observations: readonly TrendObservation[],
  config?: EvidenceIndependenceConfig,
): number {
  const deduped = dedupeObservations(observations, config);
  return new Set(deduped.map((o) => o.adoptionUnitKey)).size;
}

export function countIndependentEntities(
  observations: readonly TrendObservation[],
  config?: EvidenceIndependenceConfig,
): number {
  const deduped = dedupeObservations(observations, config);
  return new Set(deduped.map((o) => o.independentEntityKey)).size;
}

export function filterSkuVariantsSameFamily(
  observations: readonly TrendObservation[],
  family: string,
): TrendObservation[] {
  const normalizedFamily = normalizeToken(family);
  return observations.filter(
    (obs) => inferModelFamily(obs) === normalizedFamily,
  );
}

export function dimensionsSignature(dimensions: TrendSignalDimensions): string {
  return [
    dimensions.silhouette,
    dimensions.toeShape,
    dimensions.heelType,
    dimensions.detail,
  ]
    .filter(Boolean)
    .join("|");
}
