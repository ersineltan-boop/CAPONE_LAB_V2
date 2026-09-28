import { spawnSync } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";

import { priorityRefreshBlocker } from "../src/refresh/prioritySourceGate";

const SOURCES = [
  { id: "massimo-dutti", file: "massimo-dutti", args: [] },
  { id: "ala-a", file: "luxury-ala-a", args: ["--source=ala-a", "--full"] },
  { id: "maison-margiela", file: "luxury-maison-margiela", args: ["--source=maison-margiela", "--full"] },
] as const;

function run(file: string, args: readonly string[]): boolean {
  const result = spawnSync(process.execPath, ["--import", "tsx", `scripts/${file}.ts`, ...args], {
    stdio: "inherit",
    timeout: 45 * 60 * 1000,
  });
  return result.status === 0;
}

const accepted: string[] = [];
const preserved: Array<{ id: string; reason: string }> = [];
for (const source of SOURCES) {
  const path = `data/onboarding/validated/${source.file}.json`;
  const before = await readFile(path, "utf8");
  const previous = JSON.parse(before) as { products?: unknown[] };
  const processSucceeded = source.id === "massimo-dutti"
    ? run("collect-massimo-staging", [])
    : run("collect-luxury-staging", source.args);
  let blocker = processSucceeded ? null : "Collector process failed";
  if (!blocker) {
    try {
      const current = JSON.parse(await readFile(path, "utf8")) as {
        products?: unknown[];
        collectedThisRun?: number;
        errors?: string[];
        coverage?: {
          acceptedFemaleFootwearProducts?: number;
          errors?: string[];
          sitemapTraversalExhausted?: boolean;
          bounded?: boolean;
        };
      };
      blocker = priorityRefreshBlocker({
        previousCount: previous.products?.length ?? 0,
        currentCount: current.products?.length ?? 0,
        freshCount: source.id === "massimo-dutti"
          ? current.collectedThisRun ?? 0
          : current.coverage?.acceptedFemaleFootwearProducts ?? 0,
        errors: source.id === "massimo-dutti" ? current.errors ?? [] : current.coverage?.errors ?? [],
        completed: source.id === "massimo-dutti"
          ? true
          : current.coverage?.sitemapTraversalExhausted === true && current.coverage?.bounded === false,
      });
    } catch (error) {
      blocker = `Unreadable collection: ${String(error)}`;
    }
  }
  if (blocker) {
    await writeFile(path, before);
    preserved.push({ id: source.id, reason: blocker });
    continue;
  }
  accepted.push(source.id);
}

if (accepted.length > 0 && !run("publish-priority-brands", accepted)) {
  throw new Error("Could not publish verified priority brand snapshots");
}
const report = { generatedAt: new Date().toISOString(), accepted, preserved, coverage: "PARTIAL" };
await mkdir("data/onboarding/staging/priority-refresh", { recursive: true });
await writeFile("data/onboarding/staging/priority-refresh/report.json", `${JSON.stringify(report, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `accepted_sources=${accepted.join(",")}\npreserved_sources=${preserved.map((x) => x.id).join(",")}\n`);
}
console.log(JSON.stringify(report, null, 2));
