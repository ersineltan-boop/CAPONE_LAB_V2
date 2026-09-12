import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { processGitHubIssuePayloadText } from "../src/operator/v2/github/process";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const payloadArg = process.argv[2];
if (!payloadArg || payloadArg.startsWith("--")) {
  console.error("Usage: npm.cmd run operator:github-issue -- <payload-file>");
  process.exit(1);
}

if (payloadArg.trim().startsWith("{") || payloadArg.includes("\n") || /[;&|]/.test(payloadArg)) {
  console.error("Payload argument must be a file path, not issue text or JSON.");
  process.exit(1);
}

const payloadPath = resolve(payloadArg);
const outputPath = resolve(argValue("--output") ?? "operator-github-result.json");

let text: string;
try {
  text = readFileSync(payloadPath, "utf-8");
} catch {
  console.error(`Cannot read payload file: ${payloadPath}`);
  process.exit(1);
}

const result = processGitHubIssuePayloadText(text);
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      ignored: result.ignored,
      blocked: result.blocked,
      reason: result.reason,
      taskId: result.taskId,
      comment: result.comment,
      productionDataModified: result.productionDataModified,
      job: result.job
        ? {
            id: result.job.id,
            source: result.job.source,
            domain: result.job.domain,
            template: result.job.template,
            destination: result.job.destination,
            ownerResult: result.job.ownerResult,
            githubIssue: result.job.githubIssue,
          }
        : null,
    },
    null,
    2,
  ),
  "utf-8",
);

if (result.ignored) {
  console.log(`IGNORED: ${result.reason}`);
  process.exit(0);
}

if (!result.job) {
  console.error(`BLOCKED: ${result.reason}`);
  process.exit(1);
}

console.log(result.comment);
console.log("");
console.log(`task-id: ${result.taskId}`);
console.log(`output: ${outputPath}`);
