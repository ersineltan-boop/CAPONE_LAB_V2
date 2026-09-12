import { loadJob } from "../src/operator/v2/storage/jobStore";
import { formatOwnerSummary } from "../src/operator/v2/report/ownerSummary";
import { createFsStore } from "./operator-runtime";

const taskId = process.argv[2];
if (!taskId) {
  console.error("Usage: npm.cmd run operator:status -- <task-id>");
  process.exit(1);
}

const job = loadJob(createFsStore(), taskId);
if (!job) {
  console.error(`Unknown task: ${taskId}`);
  process.exit(1);
}

console.log(formatOwnerSummary(job));
console.log("");
console.log(`state: ${job.state}`);
console.log(`template: ${job.template}`);
console.log(`source: ${job.source}`);
console.log(`executionMode: ${job.executionMode}`);
