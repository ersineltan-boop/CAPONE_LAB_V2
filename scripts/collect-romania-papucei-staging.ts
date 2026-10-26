import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { collectPapuceiStaging } from "../src/marketResearch/romania/collectors/papucei";
import type { RomaniaSourceStagingResult } from "../src/marketResearch/romania/collectors/types";
import {
  createPapuceiLegacyBaselinePlan,
  createPapuceiRefreshPlan,
  PAPUCEI_REFRESH_SOURCE_ID,
} from "../src/marketResearch/romania/refresh/papuceiRefresh";
import type { SourceLastGoodState } from "../src/refresh/sourceSnapshot";
import { publishLastGoodAtomic } from "../src/refresh/sourceSnapshotStore";

const stagingDir = path.join(process.cwd(), "data", "market-research", "romania", "staging");
const attemptPath = path.join(stagingDir, "papucei-attempt.json");
const legacyLastGoodPath = path.join(stagingDir, "papucei-last-good.json");
const refreshAttemptPath = path.join(stagingDir, "papucei-refresh-attempt.json");
const refreshLastGoodPath = path.join(stagingDir, "papucei-refresh-last-good.json");

async function readJson<T>(filePath: string): Promise<T | null> {
  try { return JSON.parse(await readFile(filePath, "utf8")) as T; } catch { return null; }
}

async function readRefreshLastGood(): Promise<SourceLastGoodState<RomaniaSourceStagingResult["products"][number]> | null> {
  const value = await readJson<SourceLastGoodState<RomaniaSourceStagingResult["products"][number]>>(refreshLastGoodPath);
  if (!value || value.snapshot?.sourceId !== PAPUCEI_REFRESH_SOURCE_ID || !Array.isArray(value.snapshot.items)) return null;
  return value;
}

async function writeJsonAtomic(destination: string, value: unknown): Promise<void> {
  const temporary = `${destination}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, destination);
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "CAPONE-LAB-Romania-Staging/1.0" }, signal: AbortSignal.timeout(60_000) });
      if (response.ok) return response.text();
      const error = new Error(`${response.status} ${response.statusText} at ${url}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) { lastError = error; }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

await mkdir(stagingDir, { recursive: true });
let previous = await readRefreshLastGood();
const legacy = previous ? null : await readJson<RomaniaSourceStagingResult>(legacyLastGoodPath);

// Migrate the old staging shape into the common #30 last-good format without deleting or
// overwriting the legacy file. This retains its galleries as history for later union merges.
if (!previous && legacy) {
  const baseline = createPapuceiLegacyBaselinePlan(legacy);
  const seeded = await publishLastGoodAtomic(
    { targetPath: refreshLastGoodPath, sourceId: PAPUCEI_REFRESH_SOURCE_ID },
    baseline,
  );
  if (seeded.status === "SUCCESS") previous = baseline.proposedLastGood;
}

const result = await collectPapuceiStaging({
  fetchHtml,
  previousLastSuccessAt: previous?.snapshot.collectedAt ?? legacy?.coverage.last_success_at,
  detailConcurrency: 4,
});
const plan = createPapuceiRefreshPlan(result, previous);

await writeJsonAtomic(attemptPath, result);
await writeJsonAtomic(refreshAttemptPath, {
  status: plan.status,
  health: plan.health,
  validationErrors: plan.validationErrors,
  events: plan.events,
});

const published = await publishLastGoodAtomic(
  { targetPath: refreshLastGoodPath, sourceId: PAPUCEI_REFRESH_SOURCE_ID },
  plan,
);
console.log(JSON.stringify(published.health, null, 2));
if (published.status !== "SUCCESS") {
  console.error(`Papucei refresh ${published.status}; common last-good was not replaced.`);
  process.exitCode = 1;
}
