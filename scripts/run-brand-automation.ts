import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runBrandAutomation } from "../src/brands/automation/run";
import type { WaveHttp, WaveHttpResponse } from "../src/brands/wave50/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function liveHttp(): WaveHttp {
  return {
    async fetch(url: string): Promise<WaveHttpResponse> {
      try {
        let response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json,text/html;q=0.9,*/*;q=0.8" },
          redirect: "follow",
          signal: AbortSignal.timeout(25_000),
        });
        if (response.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 1_500));
          response = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json,text/html;q=0.9,*/*;q=0.8" },
            redirect: "follow",
            signal: AbortSignal.timeout(25_000),
          });
        }
        const text = await response.text();
        let data: unknown | null = null;
        const trimmed = text.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            data = JSON.parse(trimmed) as unknown;
          } catch {
            data = null;
          }
        }
        return { ok: response.ok, status: response.status, url: response.url, data, text };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          url,
          data: null,
          text: "",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const rawLimit = valueAfter("--limit");
const limit = rawLimit === undefined || rawLimit.trim() === "" ? undefined : Number.parseInt(rawLimit, 10);
if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) throw new Error(`Invalid --limit: ${rawLimit}`);
const only = (valueAfter("--only") ?? "").split(",").map((value) => value.trim()).filter(Boolean);

const report = await runBrandAutomation({
  root: ROOT,
  http: liveHttp(),
  dryRun: process.argv.includes("--dry-run"),
  refreshOnly: process.argv.includes("--refresh-only"),
  limit,
  only: only.length > 0 ? only : undefined,
});

console.log("=== CAPONE official-brand automation ===");
console.log(`candidates: ${report.candidates}`);
console.log(`full: ${report.summary.full}`);
console.log(`changed: ${report.summary.changed}`);
console.log(`blocked: ${report.summary.blocked}`);
console.log(`delivery families replaced: ${report.summary.deliveryFamiliesReplaced}`);
for (const outcome of report.outcomes) {
  console.log(`- ${outcome.slug}: ${outcome.status}${outcome.blocker ? ` / ${outcome.blocker}` : ""}`);
}
