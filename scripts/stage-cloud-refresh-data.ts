import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  CLOUD_REFRESH_CORE_DATA_PATHS,
  CLOUD_REFRESH_MODEL_FAMILY_DIR,
  CLOUD_REFRESH_TRACKED_DATA_PATHS,
  shouldStageCloudRefreshPath,
} from "../src/refresh/refreshPolicy";

function existingAllowed(paths: readonly string[]): string[] {
  return paths.filter((path) => existsSync(path) && shouldStageCloudRefreshPath(path));
}

function git(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("git", args, { stdio: "inherit" });
}

const untrackMonolith = git([
  "rm",
  "-f",
  "--cached",
  "--ignore-unmatch",
  "--",
  "data/multibrand/model-families.json",
]);
if (untrackMonolith.status !== 0) {
  console.error("Failed to untrack model-families.json from the Git index.");
  process.exit(untrackMonolith.status ?? 1);
}

const familyDirExists = existsSync(CLOUD_REFRESH_MODEL_FAMILY_DIR);
if (familyDirExists) {
  const familyAdd = git(["add", "-A", "--", CLOUD_REFRESH_MODEL_FAMILY_DIR]);
  if (familyAdd.status !== 0) {
    console.error("Failed to stage Model Family shards.");
    process.exit(familyAdd.status ?? 1);
  }
}

const corePaths = existingAllowed(CLOUD_REFRESH_CORE_DATA_PATHS);
if (corePaths.length === 0 && !familyDirExists) {
  console.log("No core CAPONE catalog files to stage.");
  process.exit(0);
}

if (corePaths.length > 0) {
  const result = git(["add", "--", ...corePaths]);
  if (result.status !== 0) {
    console.error("Failed to stage core CAPONE catalog files.");
    process.exit(result.status ?? 1);
  }
}

const inspectPaths = [
  ...corePaths,
  ...(familyDirExists ? [CLOUD_REFRESH_MODEL_FAMILY_DIR] : []),
];
const coreDiff = spawnSync("git", ["diff", "--cached", "--quiet", "--", ...inspectPaths]);
if (coreDiff.status === 0) {
  git(["restore", "--staged", "--", ...inspectPaths]);
  console.log("Core catalog data unchanged; skipping timestamp-only report commits.");
  process.exit(0);
}
if (coreDiff.status !== 1) {
  console.error("Failed to inspect staged CAPONE catalog changes.");
  process.exit(coreDiff.status ?? 1);
}

const remaining = existingAllowed(CLOUD_REFRESH_TRACKED_DATA_PATHS);
if (remaining.length > 0) {
  const result = git(["add", "--", ...remaining]);
  if (result.status !== 0) {
    console.error("Failed to stage CAPONE refresh data files.");
    process.exit(result.status ?? 1);
  }
}

console.log(
  `Staged ${remaining.length} refresh data file(s)${familyDirExists ? ` plus ${CLOUD_REFRESH_MODEL_FAMILY_DIR}` : ""}.`,
);
if (familyDirExists) console.log(`  ${CLOUD_REFRESH_MODEL_FAMILY_DIR}/`);
for (const path of remaining) {
  console.log(`  ${path}`);
}
