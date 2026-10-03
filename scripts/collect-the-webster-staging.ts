import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectTheWebster,
  publishTheWebsterStaging,
} from "../src/collector/theWebster";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const staging = join(
  root,
  "data",
  "onboarding",
  "staging",
  "marketplaces",
  "the-webster",
);

// First-import staging remains a baseline; the scheduled marketplace cycle refreshes NEW.
const result = await collectTheWebster({ refresh: false });
const publish = await publishTheWebsterStaging(staging, result);

console.log(JSON.stringify({ coverage: result.coverage, publish }, null, 2));
if (result.coverage.status === "FAILED") process.exitCode = 1;
