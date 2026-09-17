import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { collectPapuceiStaging } from "../src/marketResearch/romania/collectors/papucei";
import type { RomaniaSourceStagingResult } from "../src/marketResearch/romania/collectors/types";

const stagingDir = path.join(process.cwd(), "data", "market-research", "romania", "staging");
const attemptPath = path.join(stagingDir, "papucei-attempt.json");
const lastGoodPath = path.join(stagingDir, "papucei-last-good.json");

async function readLastGood(): Promise<RomaniaSourceStagingResult | null> {
  try {
    return JSON.parse(await readFile(lastGoodPath, "utf8")) as RomaniaSourceStagingResult;
  } catch {
    return null;
  }
}

async function writeJsonAtomic(destination: string, value: unknown): Promise<void> {
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "CAPONE-LAB-Romania-Staging/1.0" },
        signal: AbortSignal.timeout(60_000),
      });
      if (response.ok) return response.text();
      const error = new Error(`${response.status} ${response.statusText} at ${url}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

await mkdir(stagingDir, { recursive: true });
const previous = await readLastGood();
const result = await collectPapuceiStaging({
  fetchHtml,
  previousLastSuccessAt: previous?.coverage.last_success_at,
  detailConcurrency: 4,
});

await writeJsonAtomic(attemptPath, result);
if (result.publishable) await writeJsonAtomic(lastGoodPath, result);

console.log(JSON.stringify(result.coverage, null, 2));
if (!result.publishable) {
  console.error("Papucei staging is incomplete; last-good was not replaced.");
  process.exitCode = 1;
}
