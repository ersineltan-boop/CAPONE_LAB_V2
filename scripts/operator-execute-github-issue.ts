import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { authorizeAndExecuteGitHubIssueText } from "../src/operator/v2/executor/execute";
import { createRealExecutionHost } from "../src/operator/v2/executor/realHost";
import { toExecutionArtifact } from "../src/operator/v2/executor/result";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

if (process.env.GITHUB_ACTIONS !== "true") {
  console.error("Live Phase 2B execute is disabled outside GitHub Actions.");
  process.exit(1);
}

const payloadArg = process.argv[2];
if (!payloadArg || payloadArg.startsWith("--")) {
  console.error("Usage: npm.cmd run operator:execute-github-issue -- <payload-file>");
  process.exit(1);
}

if (payloadArg.trim().startsWith("{") || payloadArg.includes("\n") || /[;&|]/.test(payloadArg)) {
  console.error("Payload argument must be a file path, not issue text or JSON.");
  process.exit(1);
}

const payloadPath = resolve(payloadArg);
const outputPath = resolve(argValue("--output") ?? "operator-execute-result.json");

let text: string;
try {
  text = readFileSync(payloadPath, "utf-8");
} catch {
  console.error(`Cannot read payload file: ${payloadPath}`);
  process.exit(1);
}

const result = authorizeAndExecuteGitHubIssueText(text, createRealExecutionHost());
const artifact = toExecutionArtifact(result);
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      ...artifact,
      comment: result.comment,
      failedGate: result.failedGate,
      executed: result.executed,
      committed: result.committed,
      pushed: result.pushed,
      productionDataModified: result.productionDataModified,
    },
    null,
    2,
  ),
  "utf-8",
);

if (result.status === "IGNORED") {
  console.log(`IGNORED: ${result.reason}`);
  process.exit(0);
}

if (result.comment) {
  console.log(result.comment);
}

console.log("");
console.log(`status: ${result.status}`);
console.log(`task-id: ${result.taskId ?? "none"}`);
console.log(`output: ${outputPath}`);

if (result.status === "BLOCKED" || result.status === "FAILED") {
  process.exit(1);
}
