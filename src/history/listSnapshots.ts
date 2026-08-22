import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ProductSeenRecord, SnapshotProduct } from "./types";
import { canonicalUrl } from "./buildSnapshot";

const SNAPSHOT_DIR_PATTERN = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}(?:-\d+)?$/;

export function getHistoryRoot(root: string): string {
  return join(root, "data", "history");
}

export async function listSnapshotIds(historyRoot: string): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(historyRoot);
  } catch {
    return [];
  }

  const ids: Array<{ id: string; mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!SNAPSHOT_DIR_PATTERN.test(entry)) continue;
    const fullPath = join(historyRoot, entry);
    const info = await stat(fullPath);
    if (!info.isDirectory()) continue;
    ids.push({ id: entry, mtimeMs: info.mtimeMs });
  }

  return ids.sort((a, b) => a.mtimeMs - b.mtimeMs).map((item) => item.id);
}

export async function readSnapshotProducts(
  historyRoot: string,
  snapshotId: string,
): Promise<SnapshotProduct[]> {
  const raw = await readFile(join(historyRoot, snapshotId, "products.json"), "utf-8");
  return JSON.parse(raw) as SnapshotProduct[];
}

export async function loadPreviousSeenRecords(
  historyRoot: string,
  excludeSnapshotId?: string,
): Promise<Map<string, ProductSeenRecord>> {
  const records = new Map<string, ProductSeenRecord>();
  const snapshotIds = await listSnapshotIds(historyRoot);

  for (const snapshotId of snapshotIds) {
    if (snapshotId === excludeSnapshotId) continue;

    const products = await readSnapshotProducts(historyRoot, snapshotId);
    for (const product of products) {
      const key = canonicalUrl(product.productUrl);
      const existing = records.get(key);
      if (!existing) {
        records.set(key, {
          productUrl: product.productUrl,
          firstSeen: product.firstSeen,
          lastSeen: product.lastSeen,
          brand: product.brand,
          productName: product.productName,
          imageUrl: product.imageUrl,
        });
        continue;
      }

      if (product.firstSeen < existing.firstSeen) existing.firstSeen = product.firstSeen;
      if (product.lastSeen > existing.lastSeen) existing.lastSeen = product.lastSeen;
    }
  }

  return records;
}

export function buildPreviousSeenMap(
  records: Map<string, ProductSeenRecord>,
): Map<string, { firstSeen: string; lastSeen: string }> {
  const map = new Map<string, { firstSeen: string; lastSeen: string }>();
  for (const [key, record] of records) {
    map.set(key, { firstSeen: record.firstSeen, lastSeen: record.lastSeen });
  }
  return map;
}

export function formatSnapshotId(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

export async function resolveUniqueSnapshotId(
  historyRoot: string,
  date: Date,
): Promise<string> {
  const baseId = formatSnapshotId(date);
  const existing = await listSnapshotIds(historyRoot);
  if (!existing.includes(baseId)) return baseId;

  let suffix = 1;
  while (existing.includes(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}
