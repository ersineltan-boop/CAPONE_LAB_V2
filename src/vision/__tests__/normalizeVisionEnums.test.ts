import { describe, expect, it } from "vitest";
import { normalizeHeelTypeValue, normalizeRawVision } from "../normalizeVisionEnums";
import { footwearVisionSchema } from "../visionSchema";

describe("normalizeVisionEnums", () => {
  it("maps STILETTTO typo to STILETTO", () => {
    expect(normalizeHeelTypeValue("STILETTTO")).toBe("STILETTO");
  });

  it("rejects invalid heel type values via schema after normalization", () => {
    const raw = normalizeRawVision({
      toeShape: { value: "ROUND", confidence: 0.9 },
      heelType: { value: "STILETTTO", confidence: 0.9 },
      details: [],
      construction: [],
      surfaceEffects: [],
    });

    const parsed = footwearVisionSchema.parse(raw);
    expect(parsed.heelType.value).toBe("STILETTO");
  });

  it("schema rejects unknown enum values", () => {
    expect(() =>
      footwearVisionSchema.parse({
        toeShape: { value: "NOT_A_TOE", confidence: 0.5 },
        heelType: { value: "STILETTO", confidence: 0.5 },
        details: [],
        construction: [],
        surfaceEffects: [],
      }),
    ).toThrow();
  });
});
