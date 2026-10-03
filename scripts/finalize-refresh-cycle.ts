import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";

await mkdir("logs/refresh-cycle", { recursive: true });
let report: Record<string, unknown> = {};
try { report = JSON.parse(await readFile("logs/refresh-cycle/report.json", "utf8")); }
catch { try { report = JSON.parse(await readFile("logs/refresh-cycle/plan.json", "utf8")); } catch { /* Preflight failed. */ } }
const env = process.env;
const gatesPassed = env.COLLECT_OUTCOME === "success" && env.TESTS_OUTCOME === "success" && env.BUILD_OUTCOME === "success";
const publication = !gatesPassed ? "FAILED_LAST_GOOD_PRESERVED"
  : env.DRY_RUN === "true" ? "DRY_RUN_NOT_PUBLISHED"
  : env.DATA_CHANGED === "false" ? "VALIDATED_NO_CHANGE"
  : env.MERGED === "true" && env.PUBLISH_OUTCOME === "success" ? "PUBLISHED_PRODUCTION_VERIFIED"
  : "PUBLICATION_FAILED_OR_UNVERIFIED";
const outcomes = (report.outcomes ?? []) as Array<{ id: string; status: string; reports: string[] }>;
const sourceEvidence: Record<string, unknown[]> = {};
for (const lane of outcomes) {
  sourceEvidence[lane.id] = [];
  for (const file of lane.reports) {
    const evidence = JSON.parse(await readFile(`logs/refresh-cycle/${file}`, "utf8"));
    const rows = evidence.outcomes ?? evidence.brands ?? evidence.gates ?? evidence.sources;
    if (Array.isArray(rows)) {
      sourceEvidence[lane.id].push(...rows.map((row: Record<string, unknown>) => ({
        source: row.slug ?? row.sourceId ?? row.id ?? row.source ?? row.brand,
        status: row.status ?? row.publicationCoverage,
        blocker: row.blocker ?? row.reason ?? row.reasons ?? row.errors,
        collectorErrors: row.collectorErrors ?? row.errors,
        collected: row.collected ?? row.acceptedFootwear ?? row.parsedProducts ?? row.collectedProducts,
        lastGoodRetained: row.lastGoodRetained ?? row.lastGoodPreserved,
      })));
    } else {
      const { successfulSources, partialSources, failedSources, skippedSources, accepted, preserved, acceptedSources, preservedSources, source, status, blocker } = evidence;
      sourceEvidence[lane.id].push({ successfulSources, partialSources, failedSources, skippedSources, accepted, preserved, acceptedSources, preservedSources, source, status, blocker });
    }
  }
}
const final = { ...report, completedAt: new Date().toISOString(), publication,
  runId: env.GITHUB_RUN_ID, prUrl: env.PR_URL ?? null, productionStatusUrl: env.PRODUCTION_STATUS_URL ?? null,
  gates: { collection: env.COLLECT_OUTCOME, tests: env.TESTS_OUTCOME, build: env.BUILD_OUTCOME, publication: env.PUBLISH_OUTCOME },
  sourceEvidence,
};
await writeFile("logs/refresh-cycle/report.json", JSON.stringify(final, null, 2));
const summary = ["## CAPONE complete refresh", `Publication: **${publication}**`,
  `Active brands: ${(report.activeBrands as unknown[] | undefined)?.length ?? "unknown"}; marketplaces: ${(report.activeMarketplaces as unknown[] | undefined)?.length ?? "unknown"}`,
  `PR: ${env.PR_URL || "none"}`, "", "| Collector lane | Collection result | Fresh evidence files |", "|---|---|---|",
  ...outcomes.map((lane) => `| ${lane.id} | ${lane.status} | ${lane.reports.length} |`), "",
  "Collection success is not a publication claim. Source reports record blocked/partial sources and retained last-good data.", ""].join("\n");
await writeFile("logs/refresh-cycle/summary.md", summary);
console.log(summary);
console.log(`CAPONE_REFRESH_RESULT ${JSON.stringify(final)}`);
if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, summary);
