import { z } from "zod";

export const taxonomyVisionProposalSchema = z.object({
  field: z.string(),
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().nullable(),
  imageIndexes: z.array(z.number().int().nonnegative()).nullable(),
});

export const taxonomyVisionResponseSchema = z.object({
  proposals: z.array(taxonomyVisionProposalSchema),
});

export type TaxonomyVisionProposal = z.infer<typeof taxonomyVisionProposalSchema>;
export type TaxonomyVisionResponse = z.infer<typeof taxonomyVisionResponseSchema>;
