import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectBrowns, publishBrownsCatalog } from "../src/collector/browns";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(root, "data/registry/issue-91-browns-marketplace.json");

const result = await collectBrowns();
const publish = await publishBrownsCatalog(root, result);
const report = {
  ...result.coverage,
  modelFamilies: publish.modelFamilies || result.coverage.modelFamilies,
  published: publish.published,
  publishReason: publish.reason,
  quarantinedSample: result.quarantined.slice(0, 40),
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (result.coverage.status === "FAILED") process.exitCode = 1;
