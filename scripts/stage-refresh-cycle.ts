import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { CYCLE_DELIVERY_PATHS } from "../src/refresh/refreshCycle";

const paths = CYCLE_DELIVERY_PATHS.filter((path) => existsSync(path));
for (const path of paths) {
  if (statSync(path).isFile() && statSync(path).size >= 90 * 1024 * 1024) throw new Error(`Oversized delivery: ${path}`);
}
const result = spawnSync("git", ["add", "--", ...paths], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
// Staging, logs, frontend bundles and secrets are deliberately artifact-only.
const staged = spawnSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" });
if (staged.status !== 0) process.exit(staged.status ?? 1);
for (const path of staged.stdout.trim().split("\n").filter(Boolean)) {
  if (!CYCLE_DELIVERY_PATHS.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))) throw new Error(`Unexpected staged path: ${path}`);
}
