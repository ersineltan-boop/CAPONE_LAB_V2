export type { SourceRole, TrendSourceConfig, SourceRegistry } from "./source";
export type {
  TrendSignalDimensions,
  SignalDimensionKey,
} from "./signal";
export { SIGNAL_DIMENSION_KEYS } from "./signal";
export type {
  TrendObservation,
  EvidenceIndependenceConfig,
} from "./observation";
export { DEFAULT_EVIDENCE_INDEPENDENCE } from "./observation";
export type { MarketSegment } from "./segment";
export { SEGMENT_LIFECYCLE, segmentIndex, normalizeMarketSegment } from "./segment";
export type { TrendStage, DedupeScope } from "./stage";
export type {
  TrendStrengthComponents,
  MomentumComponents,
  TrendEngineInput,
  TrendEngineResultV11,
  TrendScoreComponents,
  TrendScoreWeights,
  TrendScoreResult,
  TrendScoreInput,
} from "./metrics";
