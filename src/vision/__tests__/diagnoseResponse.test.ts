import { describe, expect, it } from "vitest";
import { diagnoseResponse, extractTextFromOutput } from "../diagnoseResponse";

describe("diagnoseResponse", () => {
  it("reports status, output types, refusal, and parsed flags", () => {
    const diagnostic = diagnoseResponse({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "cannot analyze" }],
        },
        { type: "reasoning" },
      ],
    });

    expect(diagnostic).toContain("status=incomplete");
    expect(diagnostic).toContain("output_types=[message, reasoning]");
    expect(diagnostic).toContain("refusal=true");
    expect(diagnostic).toContain("output_parsed_absent");
  });
});

describe("extractTextFromOutput", () => {
  it("reads nested output_text blocks when output_text helper is absent", () => {
    const text = extractTextFromOutput({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ toeShape: { value: "ROUND", confidence: 0.8 } }),
            },
          ],
        },
      ],
    });

    expect(text).toContain("ROUND");
  });
});
