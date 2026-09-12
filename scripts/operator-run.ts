import { execFileSync } from "node:child_process";

import { executeJob } from "../src/operator/v2/executor/run";
import { createGitSnapshot } from "../src/operator/v2/guard/mutation";
import { loadJob } from "../src/operator/v2/storage/jobStore";
import { createFsStore, ensureRuntimeDirs, REPO_ROOT } from "./operator-runtime";

const taskId = process.argv[2];
if (!taskId) {
  console.error("Usage: npm.cmd run operator:run -- <task-id>");
  process.exit(1);
}

await ensureRuntimeDirs();
const store = createFsStore();
const job = loadJob(store, taskId);
if (!job) {
  console.error(`Unknown task: ${taskId}`);
  process.exit(1);
}

const result = executeJob(job, store, {
  snapshotGit: () => {
    try {
      const raw = execFileSync("git", ["status", "--short"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
      return createGitSnapshot(raw);
    } catch {
      return createGitSnapshot("");
    }
  },
});

console.log(result.ownerSummary);
console.log("");
console.log(`task-id: ${result.job.id}`);
console.log(`ownerResult: ${result.job.ownerResult}`);
console.log(`productionDataModified: ${result.job.productionDataModified ? "yes" : "no"}`);
