import { listJobs } from "../src/operator/v2/storage/jobStore";
import { createFsStore, listQueuedJobIds } from "./operator-runtime";

const ids = await listQueuedJobIds();
const jobs = listJobs(createFsStore(), ids);

if (jobs.length === 0) {
  console.log("CAPONE OPERATOR QUEUE: empty");
  process.exit(0);
}

console.log("CAPONE OPERATOR QUEUE");
for (const job of jobs) {
  console.log(
    `${job.id}  ${job.ownerResult}  ${job.domain ?? "-"}  ${job.targetName ?? "-"} → ${job.destination ?? "-"}`,
  );
}
