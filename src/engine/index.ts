export * from "./types";
export * from "./constants/markets";
export * from "./constants/roles";
export * from "./scoring";
export * from "./scoring/v11";
export {
  dedupeObservations,
  countAdoptionUnits,
  countIndependentEntities,
  buildAdoptionUnitKey,
  inferModelFamily,
} from "./independence/evidenceIndependence";
export {
  createSourceRegistry,
  getActiveSources,
  getSourcesByRole,
  getProductionSignalSources,
} from "./sources/registry";
export { seedSources } from "./sources/seedSources";
export { deriveCaponeDecisionFromEngine } from "./decision/caponeDecisionFromEngine";
export type {
  EngineCaponeDecisionInput,
  EngineCaponeDecisionResult,
} from "./decision/caponeDecisionFromEngine";
export { deriveCaponeDecisionFromMetrics } from "./decision/caponeDecisionFromMetrics";
export type {
  CaponeDecisionMetricsInput,
  CaponeDecisionMetricsResult,
} from "./decision/caponeDecisionFromMetrics";
export { summarizeProductionSignals } from "./production/productionSignal";
export type { ProductionSignalSummary } from "./production/productionSignal";
export { createObservation, filterObservationsForTrendScore } from "./observations/helpers";
export {
  computeTrendMetrics,
  countAdoptionUnitsInContext,
  createScoringContext,
} from "./scoring/v11";
