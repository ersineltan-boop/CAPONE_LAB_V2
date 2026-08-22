import type { CriticalVerificationFeature } from "./config";
import type { CriticalStrapFeature } from "./config";

export type TriState = "YES" | "NO" | "UNKNOWN";

export type VerifierStatus =
  | "VERIFIED"
  | "REJECTED"
  | "UNCERTAIN"
  | "SKIPPED";

export type FeatureSource = "TEXT" | "VISION" | "VERIFIED_VISION";

export type FeatureUsabilityStatus =
  | "RADAR_ELIGIBLE"
  | "VISION_UNCERTAIN"
  | "NOT_USABLE_FOR_RADAR"
  | "CONTRADICTION";

export type VisualFeatureKey =
  | "category"
  | "toeShape"
  | "heelType"
  | "heelHeightGroup"
  | "ankleStrap"
  | "slingback"
  | "backless"
  | "closedBack"
  | "thong"
  | "tStrap"
  | "maryJaneStrap"
  | "openToe"
  | "closedToe"
  | "laceUp"
  | "lowVamp"
  | "highVamp"
  | "platform"
  | "wedge"
  | "buckle"
  | "bow"
  | "metalHardware";

export interface VisualFeatureResult {
  value: TriState;
  confidence: number;
  evidenceImageIndexes: number[];
  reasoningShort: string;
  source: FeatureSource;
  verifierStatus: VerifierStatus;
  usabilityStatus: FeatureUsabilityStatus;
  radarEligible: boolean;
  contradictionFlag?: boolean;
}

export type VisualFeatureMap = Partial<
  Record<VisualFeatureKey, VisualFeatureResult>
>;

export interface PilotFamilyCandidate {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  category: string | null;
  representativeProductId: string;
  representativeImages: string[];
  selectionScore: number;
  selectionReasons: string[];
}

export interface VerificationPilotProductResult {
  brand: string;
  modelFamilyId: string;
  canonicalName: string;
  productUrl: string;
  productName: string;
  imageCount: number;
  imageUrls: string[];
  oldFeatures: VisualFeatureMap;
  newFeatures: VisualFeatureMap;
  verifierDecisions: VerifierDecision[];
  changedFeatures: ChangedFeature[];
  contradictions: ContradictionRecord[];
  radarEligibleFeatures: VisualFeatureKey[];
}

export interface VerifierDecision {
  feature: VisualFeatureKey;
  initialValue: TriState;
  initialConfidence: number;
  status: VerifierStatus;
  reasoningShort: string;
  evidenceImageIndexes: number[];
}

export interface ChangedFeature {
  feature: VisualFeatureKey;
  oldValue: TriState;
  newValue: TriState;
  oldConfidence: number;
  newConfidence: number;
  reason: string;
}

export interface ContradictionRecord {
  features: VisualFeatureKey[];
  message: string;
}

export interface ImportantCorrection {
  brand: string;
  canonicalName: string;
  productUrl: string;
  oldLabel: string;
  newLabel: string;
  reason: string;
  evidenceImageIndexes: number[];
}

export interface VerificationPilotSummary {
  analyzedModelFamilies: number;
  verifiedFeatures: number;
  rejectedOldFeatures: number;
  uncertainFeatures: number;
  contradictionCount: number;
  criticalLabelChanges: number;
  radarEligibleFeatureCount: number;
}

export interface VerificationPilotReport {
  generatedAt: string;
  model: string;
  verifierModel: string;
  mode: "live" | "offline";
  summary: VerificationPilotSummary;
  products: VerificationPilotProductResult[];
  mostImportantCorrections: ImportantCorrection[];
}

export interface MultiImageAnalysisInput {
  brand: string;
  productName: string;
  category: string | null;
  imageUrls: string[];
}

export interface VerifierFeatureInput {
  feature: CriticalVerificationFeature;
  value: TriState;
  confidence: number;
  reasoningShort: string;
  evidenceImageIndexes: number[];
}

export interface VerifierBatchInput {
  brand: string;
  productName: string;
  imageUrls: string[];
  features: VerifierFeatureInput[];
  strapElements?: StrapElement[];
}

export type StrapElementType =
  | "TOE_POST"
  | "FOREFOOT_STRAP"
  | "INSTEP_STRAP"
  | "MARY_JANE_STRAP"
  | "T_STRAP_VERTICAL"
  | "ANKLE_STRAP"
  | "ANKLE_WRAP_LACE"
  | "HEEL_SLING"
  | "BACK_STRAP"
  | "OTHER";

export type StrapLocation = "TOE" | "FOREFOOT" | "INSTEP" | "ANKLE" | "HEEL";

export type StrapWrapsAround = "NONE" | "FOOT" | "ANKLE" | "HEEL";

export type StrapClosure =
  | "BUCKLE"
  | "TIE"
  | "ELASTIC"
  | "SLIP_ON"
  | "UNKNOWN";

export interface StrapElement {
  type: StrapElementType;
  location: StrapLocation;
  wrapsAround: StrapWrapsAround;
  closure: StrapClosure;
  confidence: number;
  evidenceImageIndexes: number[];
}

export interface VerifierDecisionV2 extends VerifierDecision {
  anatomicalLocation: StrapLocation | "NONE";
  wrapsAround: StrapWrapsAround;
  closure: StrapClosure;
  topologyConfirmed: boolean;
}

export interface MultiStrapProductSummary {
  brand: string;
  canonicalName: string;
  productUrl: string;
  strapFeatures: Partial<Record<CriticalStrapFeature, TriState>>;
}

export type { CriticalStrapFeature } from "./config";

export interface AnkleStrapAuditEntry {
  brand: string;
  canonicalName: string;
  productUrl: string;
  value: TriState;
  confidence: number;
  evidenceImageIndexes: number[];
  strapLocation: StrapLocation | "NONE";
  wrapsAround: StrapWrapsAround;
  closure: StrapClosure;
  verifierStatus: VerifierStatus;
  topologyConfirmed: boolean;
  radarEligible: boolean;
  supportingElements: StrapElement[];
}

export interface VerificationPilotV2ProductResult
  extends VerificationPilotProductResult {
  strapElements: StrapElement[];
  verifierDecisionsV2: VerifierDecisionV2[];
}

export interface VerificationPilotV2Report extends VerificationPilotReport {
  version: "v2";
  summary: VerificationPilotSummary & {
    radarEligibleCriticalStrapFeatureCount: number;
    multiStrapProductCount: number;
    manualAuditProductCount: number;
  };
  products: VerificationPilotV2ProductResult[];
  ankleStrapAudit: AnkleStrapAuditEntry[];
  slingbackYesProducts: MultiStrapProductSummary[];
  thongYesProducts: MultiStrapProductSummary[];
  multiStrapProducts: MultiStrapProductSummary[];
  manualAuditProducts: Array<{
    brand: string;
    canonicalName: string;
    productUrl: string;
    reason: string;
  }>;
  v1LiveComparison?: {
    criticalStrapDeltas: Array<{
      brand: string;
      canonicalName: string;
      feature: CriticalStrapFeature;
      v1Value: TriState;
      v2Value: TriState;
    }>;
  };
  apiFailures?: string[];
}

export interface VerificationStabilityReport {
  generatedAt: string;
  version: "stability-v1";
  model: string;
  mode: "live" | "offline";
  expectedFamilyCount: number;
  runsCompleted: number;
  allRunsFullyCompleted: boolean;
  summary: {
    totalCriticalFeatureObservations: number;
    stableYes: number;
    stableNo: number;
    unstable: number;
    stableRadarEligible: number;
    featureStabilityRates: Array<{
      feature: string;
      stableYes: number;
      stableNo: number;
      unstable: number;
      stabilityPercent: number;
    }>;
    mostUnstableFeatures: Array<{
      feature: string;
      stableYes: number;
      stableNo: number;
      unstable: number;
      stabilityPercent: number;
    }>;
  };
  observations: import("./stabilityAnalysis").StabilityFeatureObservation[];
  unstableCombinations: Array<{
    brand: string;
    canonicalName: string;
    feature: string;
    runValues: Record<string, TriState>;
  }>;
  auditProductMatrices: Array<{
    brand: string;
    canonicalName: string;
    productUrl?: string;
    matched: boolean;
    matrix: Partial<Record<string, Record<string, TriState>>>;
  }>;
  runs: Array<{
    runId: string;
    completedAt: string;
    analyzedFamilies: number;
    apiFailures: string[];
  }>;
  apiFailures: string[];
}
