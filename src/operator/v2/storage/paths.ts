export const OPERATOR_RUNTIME_ROOT = ".operator";

export const OPERATOR_RUNTIME_DIRS = {
  queue: ".operator/queue",
  runs: ".operator/runs",
  reports: ".operator/reports",
  artifacts: ".operator/artifacts",
} as const;

export const PRODUCTION_DATA_PREFIXES = [
  "data/multibrand/",
  "data/market-research/",
  "public/data/",
] as const;

export const ALLOWED_WRITE_PREFIXES = [
  ".operator/",
] as const;

export function queuePath(jobId: string): string {
  return `${OPERATOR_RUNTIME_DIRS.queue}/${jobId}.json`;
}

export function runPath(jobId: string): string {
  return `${OPERATOR_RUNTIME_DIRS.runs}/${jobId}.json`;
}

export function reportPath(jobId: string): string {
  return `${OPERATOR_RUNTIME_DIRS.reports}/${jobId}.json`;
}

export function summaryPath(jobId: string): string {
  return `${OPERATOR_RUNTIME_DIRS.reports}/${jobId}.md`;
}

export const JOB_MANIFEST_SAMPLE = {
  id: "job-sample-not-runtime",
  createdAt: "2026-09-12T15:00:00.000Z",
  requestedBy: "owner",
  rawInstruction: "Massimo Dutti'yi Markalar'a ekle",
  template: "PRODUCT_RESEARCH_BRAND_ONBOARDING",
  domain: "PRODUCT_RESEARCH",
  destination: "MARKALAR",
  executionMode: "LOCAL_SAFE",
  note: "Tracked schema sample only. Runtime jobs live under .operator/ and are gitignored.",
} as const;
