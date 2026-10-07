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

let accepted: string[] = [];
const beforeSnapshots = new Map<string, string>();
const preserved: Array<{ id: string; reason: string }> = [];
for (const source of SOURCES) {
  const path = `data/onboarding/validated/${source.file}.json`;
  const before = await readFile(path, "utf8");
  beforeSnapshots.set(source.id, before);
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
        paginationExhausted?: boolean;
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
          ? current.paginationExhausted === true
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

if (accepted.length > 0) {
  const publishStarted = Date.now();
  run("publish-priority-brands", accepted);
  const delivery = JSON.parse(await readFile("data/onboarding/staging/priority-publication/report.json", "utf8").catch(() => "{}"));
  const delivered = new Set<string>(Date.parse(delivery.generatedAt ?? "") >= publishStarted ? delivery.accepted ?? [] : []);
  for (const id of accepted) if (!delivered.has(id)) {
    const source = SOURCES.find(source => source.id === id)!;
    await writeFile(`data/onboarding/validated/${source.file}.json`, beforeSnapshots.get(id)!);
    preserved.push({ id, reason: delivery.preserved?.find((row: { id: string }) => row.id === id)?.reason ?? "Delivery failed without fresh evidence" });
  }
  accepted = accepted.filter(id => delivered.has(id));
}
const report = { generatedAt: new Date().toISOString(), accepted, preserved, coverage: "PARTIAL" };
await mkdir("data/onboarding/staging/priority-refresh", { recursive: true });
await writeFile("data/onboarding/staging/priority-refresh/report.json", `${JSON.stringify(report, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `accepted_sources=${accepted.join(",")}\npreserved_sources=${preserved.map((x) => x.id).join(",")}\n`);
}
console.log(JSON.stringify(report, null, 2));
