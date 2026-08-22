import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildMasterRadar, buildRadarSignalAudit } from "../src/radar/master/buildMasterRadar";
import type { RawAnalyzedProduct } from "../src/modelFamily/types";
import type { ModelFamily } from "../src/modelFamily/types";
import type { ChangeReport } from "../src/history/types";
import { buildProvenanceMap } from "../src/radar/productProfile";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const analyzed = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/analyzed-products.json"), "utf-8"),
) as RawAnalyzedProduct[];
const families = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/model-families.json"), "utf-8"),
) as ModelFamily[];
const changeReport = JSON.parse(
  await readFile(join(ROOT, "data/history/latest-change-report.json"), "utf-8"),
) as ChangeReport;

const provenanceMap = buildProvenanceMap([]);
for (const product of analyzed) {
  provenanceMap.set(product.productUrl.toLowerCase(), {
    text: true,
    vision: false,
  });
}

const result = buildMasterRadar({
  products: analyzed,
  families,
  changeReport,
  provenanceMap,
  collectedAt: changeReport.generatedAt,
});

const audit = buildRadarSignalAudit(result, result.excludedGlobal);
const outDir = join(ROOT, "data/radar");
await mkdir(outDir, { recursive: true });
await writeFile(
  join(outDir, "radar-signal-audit.json"),
  JSON.stringify(audit, null, 2),
  "utf-8",
);

console.log("\n=== CAPONE LAB Radar Signal Audit ===");
console.log(`Signals: ${audit.totalSignals}`);
console.log(`Excluded candidates: ${audit.excludedGlobal.length}`);
console.log(`Written: data/radar/radar-signal-audit.json`);
