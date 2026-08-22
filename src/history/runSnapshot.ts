import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalyzedProduct } from "../analysis/types";
import { buildSnapshotProducts, buildSnapshotSummary } from "./buildSnapshot";
import {
  buildInitialChangeReport,
  compareSnapshotData,
} from "./compareSnapshots";
import {
  buildPreviousSeenMap,
  getHistoryRoot,
  listSnapshotIds,
  loadPreviousSeenRecords,
  readSnapshotProducts,
  resolveUniqueSnapshotId,
} from "./listSnapshots";
import type { ChangeReport, SnapshotFiles } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const MULTIBRAND_ANALYZED = join(ROOT, "data", "multibrand", "analyzed-products.json");
const CHANGE_REPORT_FILE = join(getHistoryRoot(ROOT), "latest-change-report.json");

async function loadAnalyzedProducts(): Promise<AnalyzedProduct[]> {
  const raw = await readFile(MULTIBRAND_ANALYZED, "utf-8");
  return JSON.parse(raw) as AnalyzedProduct[];
}

export async function createSnapshotFromAnalyzedProducts(
  analyzedProducts: AnalyzedProduct[],
  collectedAt = new Date(),
): Promise<SnapshotFiles> {
  const historyRoot = getHistoryRoot(ROOT);
  const snapshotId = await resolveUniqueSnapshotId(historyRoot, collectedAt);
  const collectedAtIso = collectedAt.toISOString();
  const directory = join(historyRoot, snapshotId);

  const previousRecords = await loadPreviousSeenRecords(historyRoot);
  const previousSeen = buildPreviousSeenMap(previousRecords);
  const products = buildSnapshotProducts(analyzedProducts, collectedAtIso, previousSeen);
  const summary = buildSnapshotSummary(snapshotId, collectedAtIso, products);

  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "products.json"), JSON.stringify(products, null, 2), "utf-8");
  await writeFile(join(directory, "summary.json"), JSON.stringify(summary, null, 2), "utf-8");

  return { snapshotId, directory, products, summary };
}

export async function compareLatestSnapshots(): Promise<ChangeReport> {
  const historyRoot = getHistoryRoot(ROOT);
  const snapshotIds = await listSnapshotIds(historyRoot);
  const generatedAt = new Date().toISOString();

  if (snapshotIds.length === 0) {
    const report = buildInitialChangeReport(null, generatedAt);
    await mkdir(historyRoot, { recursive: true });
    await writeFile(CHANGE_REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
    return report;
  }

  if (snapshotIds.length === 1) {
    const report = buildInitialChangeReport(snapshotIds[0]!, generatedAt);
    await writeFile(CHANGE_REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
    return report;
  }

  const previousSnapshotId = snapshotIds[snapshotIds.length - 2]!;
  const currentSnapshotId = snapshotIds[snapshotIds.length - 1]!;

  const previousProducts = await readSnapshotProducts(historyRoot, previousSnapshotId);
  const currentProducts = await readSnapshotProducts(historyRoot, currentSnapshotId);
  const previousSummary = JSON.parse(
    await readFile(join(historyRoot, previousSnapshotId, "summary.json"), "utf-8"),
  );
  const currentSummary = JSON.parse(
    await readFile(join(historyRoot, currentSnapshotId, "summary.json"), "utf-8"),
  );

  const report = compareSnapshotData({
    previousSnapshotId,
    currentSnapshotId,
    previousSummary,
    currentSummary,
    previousProducts,
    currentProducts,
    generatedAt,
  });

  await writeFile(CHANGE_REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
  return report;
}

export async function runSnapshotPipeline(): Promise<{
  snapshot: SnapshotFiles;
  changeReport: ChangeReport;
}> {
  const analyzedProducts = await loadAnalyzedProducts();
  const snapshot = await createSnapshotFromAnalyzedProducts(analyzedProducts);
  const changeReport = await compareLatestSnapshots();
  return { snapshot, changeReport };
}

export async function runSnapshotCompareOnly(): Promise<ChangeReport> {
  return compareLatestSnapshots();
}
