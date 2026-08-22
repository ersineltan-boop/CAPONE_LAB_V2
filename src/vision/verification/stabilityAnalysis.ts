import {
  CRITICAL_STRAP_FEATURES,
  STABILITY_CRITICAL_FEATURES,
  type StabilityCriticalFeature,
  type StabilityRunId,
} from "./config";
import { getMinRadarConfidence, isCriticalStrapFeature } from "./radarEligibility";
import { topologySupportsFeature } from "./strapTopology";
import type {
  StrapElement,
  TriState,
  VerifierStatus,
  VerificationPilotV2ProductResult,
  VisualFeatureKey,
} from "./types";

export type FeatureStabilityClass =
  | "STABLE_YES"
  | "STABLE_NO"
  | "UNSTABLE"
  | "INCOMPLETE_RUN";

export interface StabilityFeatureObservation {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  productUrl: string;
  feature: StabilityCriticalFeature;
  stabilityClass: FeatureStabilityClass;
  runValues: Record<StabilityRunId, TriState | "MISSING">;
  runConfidences: Record<StabilityRunId, number | null>;
  runVerifierStatuses: Record<StabilityRunId, VerifierStatus | "MISSING">;
  runPresent: Record<StabilityRunId, boolean>;
  stabilityRadarEligible: boolean;
  stabilityStatus: "STABLE_RADAR_ELIGIBLE" | "STABILITY_UNCERTAIN";
}

export interface StabilityRunSnapshot {
  runId: StabilityRunId;
  completedAt: string;
  products: VerificationPilotV2ProductResult[];
  apiFailures: string[];
}

function getFeatureSnapshot(
  product: VerificationPilotV2ProductResult,
  feature: StabilityCriticalFeature,
) {
  const result = product.newFeatures[feature as VisualFeatureKey];
  return {
    value: result?.value ?? ("UNKNOWN" as TriState),
    confidence: result?.confidence ?? 0,
    evidenceImageIndexes: result?.evidenceImageIndexes ?? [],
    verifierStatus: result?.verifierStatus ?? ("SKIPPED" as VerifierStatus),
    radarEligible: result?.radarEligible ?? false,
  };
}

export function classifyFeatureStability(
  runValues: Record<StabilityRunId, TriState | "MISSING">,
  runPresent: Record<StabilityRunId, boolean>,
): FeatureStabilityClass {
  if (!Object.values(runPresent).every(Boolean)) return "INCOMPLETE_RUN";

  const values = Object.values(runValues).filter(
    (value): value is TriState => value !== "MISSING",
  );
  if (values.length !== Object.keys(runPresent).length) return "INCOMPLETE_RUN";
  if (values.every((value) => value === "YES")) return "STABLE_YES";
  if (values.every((value) => value === "NO")) return "STABLE_NO";
  return "UNSTABLE";
}

export function isStabilityRadarEligible(input: {
  feature: StabilityCriticalFeature;
  runSnapshots: Array<{
    value: TriState;
    confidence: number;
    evidenceImageIndexes: number[];
    verifierStatus: VerifierStatus;
  }>;
  strapElementsByRun: StrapElement[][];
}): boolean {
  const minConfidence = getMinRadarConfidence(input.feature as VisualFeatureKey);

  for (let index = 0; index < input.runSnapshots.length; index += 1) {
    const snapshot = input.runSnapshots[index];
    if (snapshot.value !== "YES") return false;
    if (snapshot.confidence < minConfidence) return false;
    if (snapshot.evidenceImageIndexes.length < 1) return false;
    if (snapshot.verifierStatus !== "VERIFIED") return false;

    if (isCriticalStrapFeature(input.feature as VisualFeatureKey)) {
      const elements = input.strapElementsByRun[index] ?? [];
      if (!topologySupportsFeature(input.feature as (typeof CRITICAL_STRAP_FEATURES)[number], elements)) {
        return false;
      }
    }
  }

  return true;
}

export function analyzeStabilityAcrossRuns(
  runs: StabilityRunSnapshot[],
  expectedFamilies?: Array<{
    modelFamilyId: string;
    brand: string;
    canonicalName: string;
    productUrl: string;
  }>,
): StabilityFeatureObservation[] {
  if (runs.length === 0) return [];

  const familyRefs =
    expectedFamilies ??
    [
      ...new Map(
        runs
          .flatMap((run) => run.products)
          .map((product) => [
            product.modelFamilyId,
            {
              modelFamilyId: product.modelFamilyId,
              brand: product.brand,
              canonicalName: product.canonicalName,
              productUrl: product.productUrl,
            },
          ]),
      ).values(),
    ];

  const observations: StabilityFeatureObservation[] = [];

  for (const familyRef of familyRefs) {
    const perRunProducts = runs.map((run) =>
      run.products.find((product) => product.modelFamilyId === familyRef.modelFamilyId),
    );
    const reference = perRunProducts.find(Boolean);

    const runPresent = Object.fromEntries(
      runs.map((run, index) => [run.runId, Boolean(perRunProducts[index])]),
    ) as Record<StabilityRunId, boolean>;

    for (const feature of STABILITY_CRITICAL_FEATURES) {
      const runValues = Object.fromEntries(
        runs.map((run, index) => {
          const product = perRunProducts[index];
          if (!product) return [run.runId, "MISSING" as const];
          return [run.runId, getFeatureSnapshot(product, feature).value];
        }),
      ) as Record<StabilityRunId, TriState | "MISSING">;

      const runConfidences = Object.fromEntries(
        runs.map((run, index) => {
          const product = perRunProducts[index];
          if (!product) return [run.runId, null];
          return [run.runId, getFeatureSnapshot(product, feature).confidence];
        }),
      ) as Record<StabilityRunId, number | null>;

      const runVerifierStatuses = Object.fromEntries(
        runs.map((run, index) => {
          const product = perRunProducts[index];
          if (!product) return [run.runId, "MISSING" as const];
          return [run.runId, getFeatureSnapshot(product, feature).verifierStatus];
        }),
      ) as Record<StabilityRunId, VerifierStatus | "MISSING">;

      const stabilityClass = classifyFeatureStability(runValues, runPresent);

      const runSnapshots = runs.map((_, index) => {
        const product = perRunProducts[index];
        if (!product) return null;
        return getFeatureSnapshot(product, feature);
      });
      const strapElementsByRun = perRunProducts.map((product) => product?.strapElements ?? []);

      const allRunsPresent = Object.values(runPresent).every(Boolean);
      const stabilityRadarEligible =
        allRunsPresent &&
        stabilityClass === "STABLE_YES" &&
        runSnapshots.every((snapshot) => snapshot !== null) &&
        isStabilityRadarEligible({
          feature,
          runSnapshots: runSnapshots as Array<{
            value: TriState;
            confidence: number;
            evidenceImageIndexes: number[];
            verifierStatus: VerifierStatus;
          }>,
          strapElementsByRun,
        });

      observations.push({
        modelFamilyId: familyRef.modelFamilyId,
        brand: reference?.brand ?? familyRef.brand,
        canonicalName: reference?.canonicalName ?? familyRef.canonicalName,
        productUrl: reference?.productUrl ?? familyRef.productUrl,
        feature,
        stabilityClass,
        runValues,
        runConfidences,
        runVerifierStatuses,
        runPresent,
        stabilityRadarEligible,
        stabilityStatus: stabilityRadarEligible
          ? "STABLE_RADAR_ELIGIBLE"
          : "STABILITY_UNCERTAIN",
      });
    }
  }

  return observations;
}

export function summarizeStability(observations: StabilityFeatureObservation[]) {
  const completeObservations = observations.filter(
    (item) => item.stabilityClass !== "INCOMPLETE_RUN",
  );
  const stableYes = completeObservations.filter(
    (item) => item.stabilityClass === "STABLE_YES",
  ).length;
  const stableNo = completeObservations.filter(
    (item) => item.stabilityClass === "STABLE_NO",
  ).length;
  const unstable = completeObservations.filter(
    (item) => item.stabilityClass === "UNSTABLE",
  ).length;
  const incompleteRun = observations.filter(
    (item) => item.stabilityClass === "INCOMPLETE_RUN",
  ).length;
  const stableRadarEligible = observations.filter((item) => item.stabilityRadarEligible).length;

  const familiesWithCompleteTripleRun = new Set(
    completeObservations.map((item) => item.modelFamilyId),
  ).size;

  const byFeature = new Map<StabilityCriticalFeature, {
    total: number;
    stableYes: number;
    stableNo: number;
    unstable: number;
  }>();

  for (const feature of STABILITY_CRITICAL_FEATURES) {
    byFeature.set(feature, { total: 0, stableYes: 0, stableNo: 0, unstable: 0 });
  }

  for (const observation of completeObservations) {
    const bucket = byFeature.get(observation.feature)!;
    bucket.total += 1;
    if (observation.stabilityClass === "STABLE_YES") bucket.stableYes += 1;
    if (observation.stabilityClass === "STABLE_NO") bucket.stableNo += 1;
    if (observation.stabilityClass === "UNSTABLE") bucket.unstable += 1;
  }

  const featureStabilityRates = [...byFeature.entries()]
    .map(([feature, stats]) => ({
      feature,
      stableYes: stats.stableYes,
      stableNo: stats.stableNo,
      unstable: stats.unstable,
      stabilityPercent: stats.total
        ? Math.round(((stats.stableYes + stats.stableNo) / stats.total) * 100)
        : 0,
    }))
    .sort((a, b) => a.stabilityPercent - b.stabilityPercent);

  const mostUnstableFeatures = featureStabilityRates
    .slice()
    .sort((a, b) => b.unstable - a.unstable)
    .slice(0, 5);

  const unstableCombinations = completeObservations
    .filter((item) => item.stabilityClass === "UNSTABLE")
    .map((item) => ({
      brand: item.brand,
      canonicalName: item.canonicalName,
      feature: item.feature,
      runValues: item.runValues,
    }));

  return {
    totalCriticalFeatureObservations: observations.length,
    completeObservations: completeObservations.length,
    incompleteRunObservations: incompleteRun,
    familiesWithCompleteTripleRun,
    stableYes,
    stableNo,
    unstable,
    stableRadarEligible,
    featureStabilityRates,
    mostUnstableFeatures,
    unstableCombinations,
  };
}

export function buildAuditProductMatrix(
  runs: StabilityRunSnapshot[],
  auditProducts: ReadonlyArray<{ brand: string; canonicalName: string }>,
) {
  return auditProducts.map((audit) => {
    const matched = runs[0].products.find(
      (product) =>
        product.brand === audit.brand &&
        product.canonicalName.toLowerCase().includes(audit.canonicalName.toLowerCase()),
    );

    if (!matched) {
      return {
        brand: audit.brand,
        canonicalName: audit.canonicalName,
        matched: false as const,
        matrix: {},
      };
    }

    const matrix: Record<
      StabilityCriticalFeature,
      Record<StabilityRunId, TriState | "MISSING">
    > = {} as Record<StabilityCriticalFeature, Record<StabilityRunId, TriState | "MISSING">>;

    for (const feature of STABILITY_CRITICAL_FEATURES) {
      matrix[feature] = Object.fromEntries(
        runs.map((run) => {
          const product = run.products.find(
            (item) => item.modelFamilyId === matched.modelFamilyId,
          );
          const value = product?.newFeatures[feature as VisualFeatureKey]?.value ?? "MISSING";
          return [run.runId, value];
        }),
      ) as Record<StabilityRunId, TriState | "MISSING">;
    }

    return {
      brand: matched.brand,
      canonicalName: matched.canonicalName,
      productUrl: matched.productUrl,
      matched: true as const,
      matrix,
    };
  });
}


export function runsFullyCompleted(
  runs: StabilityRunSnapshot[],
  expectedFamilyCount: number,
): boolean {
  return (
    runs.length === 3 &&
    runs.every(
      (run) =>
        run.products.length === expectedFamilyCount &&
        run.apiFailures.length === 0,
    )
  );
}
