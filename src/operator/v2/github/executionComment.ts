import type { ExecutionResult } from "../executor/types";
import type { JobManifest } from "../types";
import { OPERATOR_REPORT_MARKER } from "./constants";

function domainLabel(job: JobManifest | null): string {
  if (!job?.domain) return "Belirsiz";
  if (job.domain === "PRODUCT_RESEARCH") return "Product Research";
  if (job.domain === "MARKET_RESEARCH") return "Pazar Araştırması";
  if (job.domain === "QA") return "QA";
  if (job.domain === "PREVIEW") return "Preview";
  return "Belirsiz";
}

export function formatExecutionIssueComment(
  result: ExecutionResult,
  job: JobManifest | null,
): string {
  const readyLines =
    result.status === "READY"
      ? [
          `- Task branch: \`${result.branch ?? "unknown"}\``,
          `- PR: ${result.pullRequestUrl ?? "yok"} (#${result.pullRequestNumber ?? "?"})`,
          `- Changed files: ${result.changedPaths.length}`,
          `- QA: ${result.qa}`,
          `- Tests: ${result.tests}`,
          `- TypeScript: ${result.typecheck}`,
          `- Build: ${result.build}`,
        ]
      : [];

  return [
    OPERATOR_REPORT_MARKER,
    "",
    "## CAPONE Operator",
    "",
    `Durum: ${result.status}`,
    "",
    "Alan:",
    domainLabel(job),
    "",
    "Hedef:",
    job?.destination ?? "belirsiz",
    "",
    "Görev:",
    job?.targetName ?? job?.template ?? result.handler ?? "Phase 2B",
    "",
    "Handler:",
    result.handler ?? "yok",
    "",
    "Sonuç:",
    result.reason,
    "",
    ...(readyLines.length > 0 ? ["Hazır özet:", ...readyLines, ""] : []),
    ...(result.failedGate ? [`Başarısız kapı: ${result.failedGate}`, ""] : []),
    "Güvenlik:",
    `- Commit: ${result.committed ? "yapıldı (task branch)" : "yapılmadı"}`,
    `- Push: ${result.pushed ? "yalnızca task branch" : "yapılmadı"}`,
    "- Merge yapılmadı",
    "- Operator production deploy yapmaz. Mevcut Git/Vercel entegrasyonu task branch veya PR için preview oluşturabilir.",
    "",
    `task-id: \`${result.taskId ?? "yok"}\``,
  ].join("\n");
}
