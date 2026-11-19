import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, truncate, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runMultibrandAnalysis } from "../src/analysis/runMultibrandAnalysis";
import type { AnalyzedProduct } from "../src/analysis/types";
import { createLegacyProductCatalogStore, createShardedProductCatalogStore, type ProductCatalogKind, type writeSourceArchive } from "../src/collector/sourceProductArchive";
import type { PilotProduct } from "../src/collector/types";
import { CYCLE_DELIVERY_PATHS } from "../src/refresh/refreshCycle";
import { REFRESH_MAX_FILE_BYTES, stageRefreshDelivery } from "../src/refresh/refreshStaging";
import { transactionalRefreshLane } from "../src/refresh/transactionalLane";

const input = resolve("data/multibrand");
const runs = resolve("logs/refresh-cycle-rehearsal");
await mkdir(runs, { recursive: true });
const root = await mkdtemp(join(runs, "run-"));
console.log(`Isolated refresh staging: ${root}`);
const git = (args: string[]) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
git(["init", "-q"]);
const data = join(root, "data/multibrand");
const original = createLegacyProductCatalogStore(input);
const legacy = createLegacyProductCatalogStore(data);
const archivePath = "data/multibrand/source-archive";
const archiveRoot = join(root, archivePath);
const archive = createShardedProductCatalogStore(archiveRoot);
const allowlist = [...CYCLE_DELIVERY_PATHS.filter(path => !["data/multibrand/products.json", "data/multibrand/analyzed-products.json"].includes(path)), archivePath];
const raw = await original.read<PilotProduct>("products");
const analyzed = await original.read<AnalyzedProduct>("analyzed-products");
const source = "alohas";
const sample = raw.filter(row => row.source === source);
assert(sample.length, `No ${source} baseline records`);
// Replay growth with copies of existing rows and unique synthetic URLs. The rows
// stay in this nested test repository, which has no remote or publication step.
// The checked-in input can use different whitespace than the current writer.
let projectedBytes = 3 + raw.reduce((bytes, row) => bytes + Buffer.byteLength(JSON.stringify(row)) + 2, 0);
const added: PilotProduct[] = [];
for (let i = 0; projectedBytes < REFRESH_MAX_FILE_BYTES + 1024 * 1024; i++) {
  const row = sample[i % sample.length]!;
  const url = new URL(row.productUrl);
  url.searchParams.set("capone-rehearsal", String(i));
  const replay = { ...row, productUrl: url.href };
  added.push(replay);
  projectedBytes += Buffer.byteLength(JSON.stringify(replay)) + 2;
}
assert(added.length);
const candidate = [...raw, ...added];
await legacy.write("products", candidate);
const legacyPath = join(data, "products.json");
const legacyBytes = (await stat(legacyPath)).size;
assert(legacyBytes >= REFRESH_MAX_FILE_BYTES);
const old = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), resolve("scripts/stage-refresh-cycle.ts")], {
  cwd: root, encoding: "utf8", timeout: 30_000,
});
assert.equal(old.status, 1, old.stderr);
assert.match(old.stderr, /Oversized delivery: data\/multibrand\/products\.json/);
assert.equal(git(["ls-files"]), "", "Rejected legacy delivery changed the index");

const rawBefore = await archive.write("products", raw);
const analyzedBefore = await archive.write("analyzed-products", analyzed);
stageRefreshDelivery(root, allowlist);
const baselineTree = git(["write-tree"]);
const manifest = (kind: ProductCatalogKind) => readFile(join(archiveRoot, kind, "manifest.json"), "utf8");
const before = await Promise.all([manifest("products"), manifest("analyzed-products")]);
const rolledBack = !(await transactionalRefreshLane(root, [archivePath], async () => {
  await archive.write("products", candidate);
  assert.notEqual(await manifest("products"), before[0]);
  return false; // Simulate the analysis step failing after the raw manifest swap.
}));
assert(rolledBack);
assert.deepEqual(await Promise.all([manifest("products"), manifest("analyzed-products")]), before);
const hashRows = (rows: readonly unknown[]) => {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(JSON.stringify(row) + "\n");
  return hash.digest("hex");
};
assert.equal(hashRows(await createShardedProductCatalogStore(archiveRoot).read("products")), hashRows(raw));
assert.equal(hashRows(await createShardedProductCatalogStore(archiveRoot).read("analyzed-products")), hashRows(analyzed));

const rawAfter = await archive.write("products", candidate);
await runMultibrandAnalysis({ directory: data, catalog: archive, sourceIds: new Set([source]) });
const analyzedAfter = JSON.parse(await manifest("analyzed-products")) as Awaited<ReturnType<typeof writeSourceArchive>>;
for (const [previous, current] of [[rawBefore, rawAfter], [analyzedBefore, analyzedAfter]]) {
  assert.deepEqual(current.parts.filter(part => part.source !== source), previous.parts.filter(part => part.source !== source));
  assert.equal(current.order.length, previous.order.length + added.length);
}
assert.equal(hashRows(await archive.read("products")), hashRows(candidate));
await writeFile(join(root, "outside-allowlist.txt"), "must not be staged");
stageRefreshDelivery(root, allowlist);
const delta = git(["diff", "--cached", "--name-only", baselineTree, "--"]).split("\n");
assert(delta.length > 0 && delta.every(path => ["market-analysis.json", "manifest.json"].some(file => path.endsWith(`/${file}`)) || path.includes(`/${source}/`)), delta.join("\n"));
const staged = git(["ls-files"]).split("\n");
assert(staged.every(path => path.startsWith(`${archivePath}/`) || path === "data/multibrand/market-analysis.json"));
const largestStagedBytes = Math.max(...await Promise.all(staged.map(async path => (await stat(join(root, path))).size)));
assert(largestStagedBytes < REFRESH_MAX_FILE_BYTES);
const goodTree = git(["write-tree"]);
const oversized = join(archiveRoot, "oversized-test");
await writeFile(oversized, "");
await truncate(oversized, REFRESH_MAX_FILE_BYTES);
try {
  assert.throws(() => stageRefreshDelivery(root, allowlist), /Oversized delivery: data\/multibrand\/source-archive\/oversized-test/);
  assert.equal(git(["write-tree"]), goodTree);
} finally { await rm(oversized); }

const report = { legacyBytes, limitBytes: REFRESH_MAX_FILE_BYTES, legacyRejected: true, source, originalRows: raw.length,
  addedReplayRows: added.length, stagedFiles: staged.length, changedFiles: delta.length, largestStagedBytes,
  unrelatedSourcesUnchanged: true, rolledBack, nestedOversizedRejected: true };
await writeFile(join(root, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
