import { buildExecutionPlan } from "../src/operator/v2/plan/builder";
import { loadJob, saveJob } from "../src/operator/v2/storage/jobStore";
import { createFsStore } from "./operator-runtime";

const taskId = process.argv[2];
if (!taskId) {
  console.error("Usage: npm.cmd run operator:plan -- <task-id>");
  process.exit(1);
}

const store = createFsStore();
const job = loadJob(store, taskId);
if (!job) {
  console.error(`Unknown task: ${taskId}`);
  process.exit(1);
}

const steps = buildExecutionPlan(job.parsedIntent);
saveJob(store, { ...job, steps, updatedAt: new Date().toISOString() });

console.log(`CAPONE OPERATOR PLAN ${job.id}`);
console.log(`template: ${job.template}`);
console.log(`domain: ${job.domain ?? "null"}`);
for (const step of steps) {
  console.log(`- [${step.state}] ${step.title}: ${step.detail}`);
}
