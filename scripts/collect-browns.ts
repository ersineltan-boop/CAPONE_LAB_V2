import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectBrowns, publishBrownsCatalog } from "../src/collector/browns";
import { readMarketplaceDelivery } from "../src/collector/marketplaceDelivery";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(root, "data/registry/issue-91-browns-marketplace.json");

let refresh = false;
try {
  const previous = await readMarketplaceDelivery(join(root, "data/multibrand/model-families/marketplaces/browns.json"));
  if (Array.isArray(previous)) {
    const core = JSON.parse(await readFile(join(root, "data/multibrand/products.json"), "utf8").catch((error) => { throw new Error(`Browns prior core catalog unavailable: ${String(error)}`); })) as { source: string }[];
    refresh = core.some((product) => product.source.toLowerCase() === "browns");
  } else {
    if (!Array.isArray(previous.products)) throw new Error("Invalid Browns last-good delivery");
    refresh = previous.products.length > 0;
  }
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
const result = await collectBrowns({ refresh });
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
