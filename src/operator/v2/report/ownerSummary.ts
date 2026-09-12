import type { JobManifest } from "../types";

function destinationLabel(job: JobManifest): string {
  if (job.destination === "MARKALAR") return "Markalar";
  if (job.destination === "PAZARYERLERI") return "Pazaryerleri";
  if (job.destination === "VISUAL") return "Visual";
  if (job.destination === "NEW_ARRIVALS") return "New Arrivals";
  if (job.destination === "SALES_MARKET_BRANDS") return "Pazar Araştırması markaları";
  if (job.destination === "COUNTRY_MARKETS") return "Ülke pazarı";
  if (job.destination === "PRICE_INTEL") return "Fiyat istihbaratı";
  return job.destination ?? "belirsiz hedef";
}

function completedLines(job: JobManifest): string[] {
  const ran = job.steps.filter((step) => step.status === "RAN");
  if (ran.length === 0) {
    return job.steps
      .filter((step) => step.state !== "REVIEW")
      .slice(0, 4)
      .map((step) => `✓ ${step.title}`);
  }
  return ran.map((step) => `✓ ${step.title}`);
}

function reviewLines(job: JobManifest): string[] {
  if (job.parsedIntent.injectionAttempt) {
    return ["- Görev metninde kabuk/komut enjeksiyonu var", "- Hiçbir kabuk komutu çalıştırılmadı"];
  }
  if (job.parsedIntent.ambiguous) {
    return ["- Görev belirsiz; domain tahmin edilmedi"];
  }
  const lines = job.blockers.map((blocker) => `- ${blocker.reason}`);
  if (job.template.includes("ONBOARDING") || job.template.includes("REFRESH")) {
    lines.push("- Canlı collector Phase 1'de bağlı değil");
    lines.push("- Browser/collector ancak owner onayıyla çalışır");
  }
  return lines.length > 0 ? lines : ["- Owner incelemesi bekleniyor"];
}

export function formatOwnerSummary(job: JobManifest): string {
  const target = job.targetName ?? "hedef";
  const dest = destinationLabel(job);
  const ownerAction =
    job.parsedIntent.ambiguous || job.parsedIntent.injectionAttempt
      ? "Talimatı netleştir"
      : job.template.includes("QA")
        ? "QA raporunu incele"
        : "Collector çalıştırılmasına onay ver";

  return [
    "CAPONE OPERATOR",
    "",
    "İş:",
    `${target} → ${dest}`,
    "",
    "Durum:",
    job.ownerResult,
    "",
    "Tamamlanan:",
    ...completedLines(job),
    "",
    "Kontrol gereken:",
    ...reviewLines(job),
    "",
    "Production değişikliği:",
    job.productionDataModified ? "VAR" : "YOK",
    "",
    "Senden gereken:",
    ownerAction,
  ].join("\n");
}

export function ownerSummaryIsTurkish(text: string): boolean {
  return (
    text.includes("CAPONE OPERATOR") &&
    text.includes("İş:") &&
    text.includes("Durum:") &&
    text.includes("Production değişikliği:") &&
    text.includes("Senden gereken:")
  );
}
