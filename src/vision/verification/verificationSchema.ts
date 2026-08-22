import { z } from "zod";

const triState = z.enum(["YES", "NO", "UNKNOWN"]);

const featureResult = z.object({
  value: triState,
  confidence: z.number().min(0).max(100),
  evidenceImageIndexes: z.array(z.number().int().min(0)),
  reasoningShort: z.string(),
});

export const multiImageVisionSchema = z.object({
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

export type MultiImageVisionParsed = z.infer<typeof multiImageVisionSchema>;

export const verifierDecisionSchema = z.object({
  feature: z.string(),
  status: z.enum(["VERIFIED", "REJECTED", "UNCERTAIN"]),
  reasoningShort: z.string(),
  evidenceImageIndexes: z.array(z.number().int().min(0)),
});

export const verifierBatchSchema = z.object({
  decisions: z.array(verifierDecisionSchema),
});

export type VerifierBatchParsed = z.infer<typeof verifierBatchSchema>;
