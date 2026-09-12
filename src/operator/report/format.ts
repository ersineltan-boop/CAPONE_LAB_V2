import type { RunSummary } from "../types";

function metricLine(label: string, value: string | number | null): string {
  return `${label}: ${value ?? "n/a"}`;
}

export function formatOperatorReport(summary: RunSummary): string {
  const blockers = summary.blockers.length
    ? summary.blockers.map((blocker) => `- ${blocker.reason}`).join("\n")
    : "- none";

  return [
    "CAPONE OPERATOR REPORT",
    "",
    `Task: ${summary.taskTitle}`,
    `Domain: ${summary.domain}`,
    `Status: ${summary.status}`,
    "",
    metricLine("Discovery", summary.metrics.discovery),
    metricLine("Collector", summary.metrics.collector),
    metricLine("Locale", summary.metrics.locale),
    metricLine("Products", summary.metrics.products),
    metricLine("Models", summary.metrics.models),
    metricLine("Grouped color variants", summary.metrics.groupedColorVariants),
    metricLine("Images", summary.metrics.imageCoveragePercent === null
      ? null
      : `${summary.metrics.imageCoveragePercent}%`),
    metricLine("Unresolved category", summary.metrics.unresolvedCategory),
    metricLine("Non-footwear suspects", summary.metrics.nonFootwearSuspects),
    metricLine("Tests", summary.metrics.tests),
    metricLine("Build", summary.metrics.build),
    "",
    "Blockers:",
    blockers,
    "",
    `Production ready: ${summary.productionReady ? "YES" : "NO"}`,
    `Owner action required: ${summary.ownerActionRequired ?? "NONE"}`,
    "",
    `Why: ${summary.why}`,
  ].join("\n");
}

export function toMachineReadableReport(summary: RunSummary): string {
  return JSON.stringify(summary, null, 2);
}
