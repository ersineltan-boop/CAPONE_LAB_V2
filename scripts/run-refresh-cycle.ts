import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildRefreshCyclePlan } from "../src/refresh/refreshCycle";
import { transactionalRefreshLane } from "../src/refresh/transactionalLane";
import { cycleCatalogSnapshot } from "../src/refresh/cycleCatalogSnapshot";

const root = process.cwd();
const audit = join(root, "logs/refresh-cycle");
await mkdir(audit, { recursive: true });
const plan = await buildRefreshCyclePlan(root);
await writeFile(join(audit, "plan.json"), JSON.stringify(plan, null, 2));
if (process.argv.includes("--plan-only")) {
  console.log(`All ${plan.activeBrands.length} brands and ${plan.activeMarketplaces.length} marketplaces are covered.`);
  process.exit(0);
}
const baseline = await cycleCatalogSnapshot(root);
await writeFile(join(audit, "baseline.json"), JSON.stringify(baseline));
// Preserve the preceding lanes' successful work when an individual process fails.
const protectedPaths = ["data/multibrand", "data/brands/wave50/last-good", "data/onboarding/validated", "data/registry", "src/registry/data/brands.ts"];
// Leave time for the single test/build and guarded Preview/Production publication.
const collectionDeadline = Date.now() + 210 * 60 * 1000;
function run(args: string[], env: Record<string, string> = {}): boolean {
  const remaining = collectionDeadline - Date.now();
  if (remaining <= 0) { console.error("Cycle collection budget exhausted; preserve this lane's last-good."); return false; }
  const result = spawnSync(process.execPath, ["--import", "tsx", `scripts/${args[0]}`, ...args.slice(1)], {
    cwd: root, stdio: "inherit", timeout: Math.min(45 * 60 * 1000, remaining),
    env: { ...process.env, ...env, CAPONE_REFRESH_MARKETPLACES: "false" },
  });
  return result.status === 0;
}
const outcomes: Array<{ id: string; startedAt: string; finishedAt: string; status: string; reports: string[] }> = [];
for (const lane of plan.lanes) {
  console.log(`\nCAPONE refresh lane: ${lane.id}`);
  const startedAt = new Date().toISOString();
  const freshReports: string[] = [];
  const succeeded = await transactionalRefreshLane(root, protectedPaths, async () => {
    let succeeded = true;
    for (const command of lane.scripts) {
      if (!run(command)) { succeeded = false; break; }
    }
    // Marketplace collection stages raw products; rebuild its accepted deliveries once.
    if (succeeded && lane.id === "marketplaces") {
      const report = JSON.parse(await readFile(join(root, lane.reports[0]!), "utf8"));
      if (report.acceptedSources.length) {
        for (const script of ["analyze-multibrand.ts", "build-model-families.ts", "source-coverage.ts", "taxonomy-qa.ts"]) {
          if (!run([script], { CAPONE_AUTHORITATIVE_MARKETPLACE_SOURCES: report.acceptedSources.join(",") })) { succeeded = false; break; }
        }
      }
    }
    for (const [index, path] of lane.reports.entries()) {
      try {
        const body = await readFile(join(root, path), "utf8");
        const report = JSON.parse(body);
        const timestamp = report.generatedAt ?? report.startedAt ?? report.runStartedAt ?? report.collectedAt;
        if (!timestamp || !Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) < Date.parse(startedAt)) continue;
        const name = `${lane.id}-${index}.json`;
        await writeFile(join(audit, name), body);
        freshReports.push(name);
      } catch { /* Missing evidence is explicitly reported, never treated as fresh. */ }
    }
    return succeeded;
  });
  outcomes.push({ id: lane.id, startedAt, finishedAt: new Date().toISOString(), status: succeeded ? "COLLECTED_PENDING_PUBLICATION" : "FAILED_LAST_GOOD_PRESERVED", reports: freshReports });
  const report = { ...plan, finishedAt: new Date().toISOString(), publication: "PENDING_VALIDATION", outcomes };
  await writeFile(join(audit, "report.json"), JSON.stringify(report, null, 2));
}
console.log(`Cycle collected: ${outcomes.filter((lane) => lane.status.startsWith("COLLECTED")).length}/${plan.lanes.length} lanes. Publication requires tests, build and Vercel verification.`);
const candidate = await cycleCatalogSnapshot(root);
const previousIds = new Set(baseline.modelIds);
const retainedIds = new Set(candidate.modelIds);
const catalog = {
  before: { totalModels: baseline.totalModels, verifiedNewModels: baseline.verifiedNewModels, visualModels: baseline.visualModels, visualVerifiedNewModels: baseline.visualVerifiedNewModels, sourceNew: baseline.sourceNew },
  candidate: { totalModels: candidate.totalModels, verifiedNewModels: candidate.verifiedNewModels, visualModels: candidate.visualModels, visualVerifiedNewModels: candidate.visualVerifiedNewModels, sourceNew: candidate.sourceNew },
  addedModels: candidate.modelIds.filter((id) => !previousIds.has(id)).length,
  missingPreviousModels: baseline.modelIds.filter((id) => !retainedIds.has(id)),
};
const report = { ...plan, finishedAt: new Date().toISOString(), publication: "PENDING_VALIDATION", outcomes, catalog };
await writeFile(join(audit, "report.json"), JSON.stringify(report, null, 2));
if (catalog.missingPreviousModels.length) throw new Error(`Refusing delivery: ${catalog.missingPreviousModels.length} archived model identities missing.`);
