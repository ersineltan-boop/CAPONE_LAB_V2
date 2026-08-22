import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { inspectTrackedFileSizes, shouldStageOnboardingPath } from "../src/onboarding/publish";
import { onboardingPublishAllowlist } from "../src/onboarding/policy";

function git(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("git", args, { stdio: "inherit" });
}

const sizes = await inspectTrackedFileSizes(process.cwd());
if (sizes.storageStatus === "STORAGE_LIMIT" || sizes.trackedFileTooLarge) {
  console.error("STORAGE_LIMIT: refusing to stage onboarding publication.");
  console.error(`products.json=${sizes.productsBytes} analyzed-products.json=${sizes.analyzedBytes}`);
  process.exit(2);
}

const allow = onboardingPublishAllowlist().filter(
  (path) => existsSync(path) && shouldStageOnboardingPath(path),
);
if (allow.length === 0) {
  console.log("No onboarding files to stage.");
  process.exit(0);
}

const result = git(["add", "--", ...allow]);
if (result.status !== 0) {
  console.error("Failed to stage onboarding allowlist.");
  process.exit(result.status ?? 1);
}

console.log(`Staged ${allow.length} onboarding/catalog path(s).`);
for (const path of allow) console.log(`  ${path}`);
