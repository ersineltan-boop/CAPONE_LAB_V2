import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  CLOUD_REFRESH_CORE_DATA_PATHS,
  CLOUD_REFRESH_TRACKED_DATA_PATHS,
  shouldStageCloudRefreshPath,
} from "../src/refresh/cloudRefresh";

function existingAllowed(paths: readonly string[]): string[] {
  return paths.filter((path) => existsSync(path) && shouldStageCloudRefreshPath(path));
}

function git(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("git", args, { stdio: "inherit" });
}

const corePaths = existingAllowed(CLOUD_REFRESH_CORE_DATA_PATHS);
if (corePaths.length === 0) {
  console.log("No core CAPONE catalog files to stage.");
  process.exit(0);
}

let result = git(["add", "--", ...corePaths]);
if (result.status !== 0) {
  console.error("Failed to stage core CAPONE catalog files.");
  process.exit(result.status ?? 1);
}

const coreDiff = spawnSync("git", ["diff", "--cached", "--quiet", "--", ...corePaths]);
if (coreDiff.status === 0) {
  git(["restore", "--staged", "--", ...corePaths]);
  console.log("Core catalog data unchanged; skipping timestamp-only report commits.");
  process.exit(0);
}
if (coreDiff.status !== 1) {
  console.error("Failed to inspect staged CAPONE catalog changes.");
  process.exit(coreDiff.status ?? 1);
}

const remaining = existingAllowed(CLOUD_REFRESH_TRACKED_DATA_PATHS);
result = git(["add", "--", ...remaining]);
if (result.status !== 0) {
  console.error("Failed to stage CAPONE refresh data files.");
  process.exit(result.status ?? 1);
}

console.log(`Staged ${remaining.length} refresh data file(s).`);
for (const path of remaining) {
  console.log(`  ${path}`);
}
