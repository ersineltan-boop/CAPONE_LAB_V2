import { execFileSync } from "node:child_process";

import { createJobManifest } from "../src/operator/v2/job/create";
import { formatOwnerSummary } from "../src/operator/v2/report/ownerSummary";
import { envelopeFromLocalCli } from "../src/operator/v2/sources/intakeSource";
import { saveJob, saveReportJson } from "../src/operator/v2/storage/jobStore";
import { createGitSnapshot } from "../src/operator/v2/guard/mutation";
import { createFsStore, ensureRuntimeDirs, REPO_ROOT } from "./operator-runtime";

const instruction = process.argv.slice(2).join(" ").trim();
if (!instruction) {
  console.error('Usage: npm.cmd run operator:intake -- "Massimo Dutti\'yi Markalar\'a ekle"');
  process.exit(1);
}

await ensureRuntimeDirs();
const envelope = envelopeFromLocalCli(instruction);
const job = createJobManifest({
  rawInstruction: envelope.instruction,
  requestedBy: envelope.requestedBy,
  source: envelope.source,
});
const store = createFsStore();
saveJob(store, job);
saveReportJson(store, job.id, {
  parsedIntent: job.parsedIntent,
  ownerSummary: formatOwnerSummary(job),
});

try {
  execFileSync("git", ["status", "--short"], { cwd: REPO_ROOT, encoding: "utf8" });
  createGitSnapshot("");
} catch {
  // intake still succeeds if git inspect fails
}

console.log(formatOwnerSummary(job));
console.log("");
console.log(`task-id: ${job.id}`);
console.log(`template: ${job.template}`);
console.log(`domain: ${job.domain ?? "null"}`);
console.log(`destination: ${job.destination ?? "null"}`);
