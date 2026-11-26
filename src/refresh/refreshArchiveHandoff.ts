import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { createLegacyProductCatalogStore, createShardedProductCatalogStore } from "../collector/sourceProductArchive";
import { CYCLE_DELIVERY_PATHS } from "./refreshCycle";
import { stageRefreshDelivery } from "./refreshStaging";

const dataPath = "data/multibrand";
export const refreshArchivePath = `${dataPath}/source-archive`;
const kinds = ["products", "analyzed-products"] as const;
const legacyPaths = new Set<string>(kinds.map(kind => `${dataPath}/${kind}.json`));
const exists = async (path: string) => {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return false; }
};
const digest = (rows: readonly unknown[]) => {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(`${JSON.stringify(row)}\n`);
  return hash.digest("hex");
};

export async function hydrateRefreshArchive(root: string) {
  const dir = join(root, refreshArchivePath);
  const legacy = createLegacyProductCatalogStore(join(root, dataPath));
  if (!await exists(dir)) {
    for (const kind of kinds) await stat(join(root, dataPath, `${kind}.json`));
    return { source: "legacy baseline" as const };
  }
  const archive = createShardedProductCatalogStore(dir);
  // Resolve both snapshots before changing the working files. A missing or
  // corrupt half is an error, never permission to start from stale data.
  const products = await archive.read("products");
  const analyzed = await archive.read("analyzed-products");
  await legacy.write("products", products);
  await legacy.write("analyzed-products", analyzed);
  return { source: "archive" as const, products: products.length, analyzed: analyzed.length };
}

export async function refreshCatalogDigests(root: string) {
  const legacy = createLegacyProductCatalogStore(join(root, dataPath));
  return Object.fromEntries(await Promise.all(kinds.map(async kind => [kind, digest(await legacy.read(kind))])));
}

export async function stageRefreshArchive(root: string) {
  const parent = join(root, dataPath);
  const dir = join(root, refreshArchivePath);
  const pending = await mkdtemp(join(parent, ".source-archive-pending-"));
  const backup = join(parent, `.source-archive-backup-${randomUUID()}`);
  const legacy = createLegacyProductCatalogStore(parent);
  const archive = createShardedProductCatalogStore(pending);
  let backedUp = false;
  let replaced = false;
  try {
    const reports = [];
    for (const kind of kinds) {
      const rows = await legacy.read(kind);
      const before = digest(rows);
      const manifest = await archive.write(kind, rows);
      if (before !== digest(await archive.read(kind))) throw new Error(`Refresh round trip failed for ${kind}`);
      reports.push({ kind, rows: rows.length, digest: before, parts: manifest.parts.length,
        originalBytes: (await stat(join(parent, `${kind}.json`))).size,
        maxPartBytes: Math.max(0, ...manifest.parts.map(part => part.bytes)) });
    }
    if (await exists(dir)) { await rename(dir, backup); backedUp = true; }
    await rename(pending, dir); replaced = true;
    const paths = [...CYCLE_DELIVERY_PATHS.filter(path => !legacyPaths.has(path)), refreshArchivePath];
    stageRefreshDelivery(root, paths);
    return reports;
  } catch (error) {
    if (replaced) await rm(dir, { recursive: true, force: true });
    if (backedUp) { await rename(backup, dir); backedUp = false; }
    throw error;
  } finally {
    await rm(pending, { recursive: true, force: true });
    if (backedUp && replaced) await rm(backup, { recursive: true, force: true });
  }
}
