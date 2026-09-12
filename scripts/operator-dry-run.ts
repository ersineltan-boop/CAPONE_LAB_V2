import { formatOperatorReport, toMachineReadableReport } from "../src/operator/report/format";
import { runOperatorDryRun } from "../src/operator/runner/dryRun";
import type { TaskTemplateId } from "../src/operator/types";
import { TASK_TEMPLATE_IDS } from "../src/operator/types";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const templateRaw = argValue("--template") ?? "PRODUCT_RESEARCH_BRAND_ONBOARDING";
if (!(TASK_TEMPLATE_IDS as readonly string[]).includes(templateRaw)) {
  console.error(`Unknown template: ${templateRaw}`);
  console.error(`Use one of: ${TASK_TEMPLATE_IDS.join(", ")}`);
  process.exit(1);
}

const asJson = process.argv.includes("--json");
const example = process.argv.includes("--example");
const locale = argValue("--locale") ?? (example ? "ro" : null);
const title = argValue("--title") ?? (example ? "Add Brand X" : undefined);

const summary = runOperatorDryRun({
  templateId: templateRaw as TaskTemplateId,
  title,
  locale,
  target: example ? { name: "Brand X", originCountry: "ES" } : undefined,
  observations: example
    ? {
        locale: "ro",
        discovery: "PASS",
        collector: "PASS",
        products: 428,
        models: 176,
        groupedColorVariants: 252,
        imageCoveragePercent: 99.5,
        unresolvedCategory: 4,
        nonFootwearSuspects: 1,
        tests: "PASS",
        build: "PASS",
      }
    : undefined,
});

if (asJson) {
  console.log(toMachineReadableReport(summary));
} else {
  console.log(formatOperatorReport(summary));
}
