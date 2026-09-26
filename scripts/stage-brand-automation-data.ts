import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { BRAND_AUTOMATION_REPORT_PATH } from "../src/brands/automation/run";

const MAX_BYTES = 90 * 1024 * 1024;
const SUBSTANTIVE = [
  "data/brands/wave50/last-good",
  "data/multibrand/model-families",
  "data/registry/brand-universe.json",
  "data/registry/brand-universe-report.json",
  "src/registry/data/brands.ts",
] as const;

function git(args: string[], capture = false): ReturnType<typeof spawnSync> {
  return spawnSync("git", args, { encoding: capture ? "utf8" : undefined, stdio: capture ? "pipe" : "inherit" });
}

const existing = SUBSTANTIVE.filter((path) => existsSync(path));
for (const path of existing) {
  if (statSync(path).isFile() && statSync(path).size >= MAX_BYTES) {
    throw new Error(`Refusing to stage oversized automation file: ${path}`);
  }
}
if (existing.length > 0) {
  const added = git(["add", "--", ...existing]);
  if (added.status !== 0) process.exit(added.status ?? 1);
}

const staged = git(["diff", "--cached", "--name-only"], true);
if (staged.status !== 0) process.exit(staged.status ?? 1);
const changed = String(staged.stdout ?? "").trim().split("\n").filter(Boolean);
if (changed.length === 0) {
  console.log(`No substantive brand automation change; ${BRAND_AUTOMATION_REPORT_PATH} remains artifact-only.`);
  process.exit(0);
}
console.log(`Staged ${changed.length} deterministic brand automation path(s).`);
for (const path of changed) console.log(`  ${path}`);
