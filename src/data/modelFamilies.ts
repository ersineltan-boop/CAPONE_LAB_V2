import type { ModelFamily } from "../modelFamily/types";

export const modelFamilies: ModelFamily[] = [];

export const modelFamilyById = new Map<string, ModelFamily>();

export const modelFamilyByProductId = new Map<string, ModelFamily>();
