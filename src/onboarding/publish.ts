import { stat } from "node:fs/promises";
import { join } from "node:path";

import {
  ONBOARDING_STORAGE_LIMIT_BYTES,
  canPublishOnboardingCommit,
  onboardingPublishAllowlist,
  shouldStageOnboardingPath,
  storageLimitStatus,
  exceedsGithubHardLimit,
  type PublishGateInput,
} from "./policy";

export { canPublishOnboardingCommit, shouldStageOnboardingPath, onboardingPublishAllowlist };

export async function inspectTrackedFileSizes(root: string): Promise<{
  productsBytes: number;
  analyzedBytes: number;
  storageStatus: "ok" | "STORAGE_LIMIT";
  trackedFileTooLarge: boolean;
  oversized: string[];
}> {
  const productsPath = join(root, "data/multibrand/products.json");
  const analyzedPath = join(root, "data/multibrand/analyzed-products.json");
  const productsBytes = await fileSize(productsPath);
  const analyzedBytes = await fileSize(analyzedPath);
  const oversized: string[] = [];
  if (exceedsGithubHardLimit(productsBytes)) oversized.push("data/multibrand/products.json");
  if (exceedsGithubHardLimit(analyzedBytes)) oversized.push("data/multibrand/analyzed-products.json");
  const storageStatus =
    productsBytes >= ONBOARDING_STORAGE_LIMIT_BYTES || analyzedBytes >= ONBOARDING_STORAGE_LIMIT_BYTES
      ? "STORAGE_LIMIT"
      : storageLimitStatus(Math.max(productsBytes, analyzedBytes));
  return {
    productsBytes,
    analyzedBytes,
    storageStatus,
    trackedFileTooLarge: oversized.length > 0,
    oversized,
  };
}

export function decidePublish(input: PublishGateInput): {
  publish: boolean;
  reason: string | null;
} {
  if (!input.testsPassed) return { publish: false, reason: "tests failed" };
  if (!input.buildPassed) return { publish: false, reason: "production build failed" };
  if (input.storageStatus === "STORAGE_LIMIT") return { publish: false, reason: "STORAGE_LIMIT" };
  if (input.trackedFileTooLarge) return { publish: false, reason: "tracked file exceeds GitHub 100 MB hard limit" };
  return { publish: true, reason: null };
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}
