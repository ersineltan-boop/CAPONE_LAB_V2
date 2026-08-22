/** Radar / vision doğruluk eşikleri — tek kaynak. */
export const VISION_VERIFICATION_THRESHOLDS = {
  /** Radar evidence için minimum güven (0–100) */
  radarEligibleMinConfidence: 85,
  /** Critical strap features için Radar minimum güven */
  criticalStrapMinConfidence: 90,
  /** 70–84: VISION_UNCERTAIN */
  visionUncertainMinConfidence: 70,
  /** Verifier tetikleme eşiği (ilk pass YES) */
  verifierTriggerMinConfidence: 70,
  /** Representative ürün başına max görsel */
  maxEvidenceImages: 6,
  pilotFamilyCount: 30,
  maxFamiliesPerBrand: 2,
} as const;

/** Anatomik strap feature'ları — 90 confidence + topology + verifier gerekir */
export const CRITICAL_STRAP_FEATURES = [
  "ankleStrap",
  "slingback",
  "thong",
  "maryJaneStrap",
  "tStrap",
] as const;

export type CriticalStrapFeature = (typeof CRITICAL_STRAP_FEATURES)[number];

export const CRITICAL_VERIFICATION_FEATURES = [
  "ankleStrap",
  "slingback",
  "thong",
  "maryJaneStrap",
  "backless",
  "closedBack",
  "tStrap",
  "openToe",
  "closedToe",
] as const;

export type CriticalVerificationFeature =
  (typeof CRITICAL_VERIFICATION_FEATURES)[number];

/** Stability test — 3-run karşılaştırma feature seti */
export const STABILITY_CRITICAL_FEATURES = [
  "category",
  "ankleStrap",
  "slingback",
  "thong",
  "maryJaneStrap",
  "tStrap",
  "backless",
  "closedBack",
  "openToe",
  "closedToe",
  "wedge",
  "platform",
] as const;

export type StabilityCriticalFeature = (typeof STABILITY_CRITICAL_FEATURES)[number];

export const STABILITY_RUN_IDS = ["V2_RUN_A", "V2_RUN_B", "V2_RUN_C"] as const;
export type StabilityRunId = (typeof STABILITY_RUN_IDS)[number];

export const STABILITY_AUDIT_PRODUCTS = [
  { brand: "CHRISTEN", canonicalName: "Helix Thong Sandal" },
  { brand: "CHRISTEN", canonicalName: "Edge Thong Sandal" },
  { brand: "HEREU", canonicalName: "Sardana - Lace-up Slingback Sandal" },
  { brand: "STUDIO AMELIA", canonicalName: "Flip Flop 75 Heel" },
  { brand: "STUDIO AMELIA", canonicalName: "Cross Front Flat" },
  { brand: "JEFFREY CAMPBELL", canonicalName: "Faery" },
  { brand: "STEVE MADDEN", canonicalName: "Viable" },
  { brand: "TONY BIANCO", canonicalName: "Suave" },
  { brand: "SCHUTZ", canonicalName: "Lyra Sandal" },
  { brand: "MARAY", canonicalName: "Tuesday Sandal" },
] as const;
