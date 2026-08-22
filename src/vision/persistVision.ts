import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeUsage } from "./openaiVision";
import type { TokenUsage, VisionAnalysisFile, VisionProductRecord } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const VISION_FILE = join(ROOT, "data", "pilot", "vision-analysis.json");

export async function loadVisionFile(): Promise<VisionAnalysisFile | null> {
  try {
    const raw = await readFile(VISION_FILE, "utf-8");
    return JSON.parse(raw) as VisionAnalysisFile;
  } catch {
    return null;
  }
}

export async function upsertVisionRecords(
  records: VisionProductRecord[],
  usageDelta?: TokenUsage,
): Promise<VisionAnalysisFile> {
  const existing = await loadVisionFile();
  const map = new Map<string, VisionProductRecord>();

  for (const record of existing?.products ?? []) {
    map.set(record.productUrl, record);
  }

  for (const record of records) {
    map.set(record.productUrl, record);
  }

  const output: VisionAnalysisFile = {
    runStartedAt: existing?.runStartedAt ?? new Date().toISOString(),
    runFinishedAt: new Date().toISOString(),
    model: records[0]?.model ?? existing?.model ?? "gpt-5.6-terra",
    products: [...map.values()],
    usage: usageDelta
      ? mergeUsage(existing?.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, usageDelta)
      : (existing?.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
  };

  await mkdir(dirname(VISION_FILE), { recursive: true });
  await writeFile(VISION_FILE, JSON.stringify(output, null, 2), "utf-8");
  return output;
}

export function isSuccessfulVisionRecord(
  record: VisionProductRecord | undefined,
): boolean {
  return Boolean(record && !record.error);
}
