import { z } from "zod";

const triState = z.enum(["YES", "NO", "UNKNOWN"]);

const featureResult = z.object({
  value: triState,
  confidence: z.number().min(0).max(100),
  evidenceImageIndexes: z.array(z.number().int().min(0)),
  reasoningShort: z.string(),
});

export const strapElementSchema = z.object({
  type: z.enum([
    "TOE_POST",
    "FOREFOOT_STRAP",
    "INSTEP_STRAP",
    "MARY_JANE_STRAP",
    "T_STRAP_VERTICAL",
    "ANKLE_STRAP",
    "ANKLE_WRAP_LACE",
    "HEEL_SLING",
    "BACK_STRAP",
    "OTHER",
  ]),
  location: z.enum(["TOE", "FOREFOOT", "INSTEP", "ANKLE", "HEEL"]),
  wrapsAround: z.enum(["NONE", "FOOT", "ANKLE", "HEEL"]),
  closure: z.enum(["BUCKLE", "TIE", "ELASTIC", "SLIP_ON", "UNKNOWN"]),
  confidence: z.number().min(0).max(100),
  evidenceImageIndexes: z.array(z.number().int().min(0)),
});

export const multiImageVisionV2Schema = z.object({
  strapElements: z.array(strapElementSchema),
  category: featureResult,
  toeShape: featureResult,
  heelType: featureResult,
  heelHeightGroup: featureResult,
  ankleStrap: featureResult,
  slingback: featureResult,
  backless: featureResult,
  closedBack: featureResult,
  thong: featureResult,
  tStrap: featureResult,
  maryJaneStrap: featureResult,
  openToe: featureResult,
  closedToe: featureResult,
  laceUp: featureResult,
  lowVamp: featureResult,
  highVamp: featureResult,
  platform: featureResult,
  wedge: featureResult,
  buckle: featureResult,
  bow: featureResult,
  metalHardware: featureResult,
});

export type MultiImageVisionV2Parsed = z.infer<typeof multiImageVisionV2Schema>;
export type StrapElementParsed = z.infer<typeof strapElementSchema>;

export const verifierDecisionV2Schema = z.object({
  feature: z.string(),
  status: z.enum(["VERIFIED", "REJECTED", "UNCERTAIN"]),
  reasoningShort: z.string(),
  evidenceImageIndexes: z.array(z.number().int().min(0)),
  anatomicalLocation: z.enum(["TOE", "FOREFOOT", "INSTEP", "ANKLE", "HEEL", "NONE"]),
  wrapsAround: z.enum(["NONE", "FOOT", "ANKLE", "HEEL"]),
  closure: z.enum(["BUCKLE", "TIE", "ELASTIC", "SLIP_ON", "UNKNOWN"]),
  topologyConfirmed: z.boolean(),
});

export const verifierBatchV2Schema = z.object({
  decisions: z.array(verifierDecisionV2Schema),
});

export type VerifierBatchV2Parsed = z.infer<typeof verifierBatchV2Schema>;
