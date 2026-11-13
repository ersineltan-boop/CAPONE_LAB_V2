import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CATALOG_SNAPSHOT_SCHEMA, parseCatalogSnapshotManifest, type CatalogSnapshotManifest } from "../src/catalog/snapshotManifest";
import { buildCatalogFrontend } from "./build-catalog-frontend";

export async function publishLocalCatalogSnapshot(input: string, store: string) {
  const paths = ["summary.json", "id-index.json", "visual-summary.json"];
  for (const dir of ["brands", "marketplaces", "visual"]) {
    for (const file of (await readdir(join(input, dir))).sort()) {
      if (file.endsWith(".json")) paths.push(`${dir}/${file}`);
    }
  }
  await mkdir(join(store, "objects"), { recursive: true });
  const files: CatalogSnapshotManifest["files"] = {};
  let written = 0, bytesWritten = 0, totalBytes = 0, largestBytes = 0;
  const put = async (body: Buffer) => {
    const digest = createHash("sha256").update(body).digest("hex");
    const key = `objects/${digest}.json`;
    totalBytes += body.length;
    largestBytes = Math.max(largestBytes, body.length);
    const target = join(store, key);
    const existing = await readFile(target).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (existing) {
      if (!existing.equals(body)) throw new Error(`Corrupt immutable catalog object: ${key}`);
      return key;
    }
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, body, { flag: "wx" });
    await rename(tmp, target);
    written++;
    bytesWritten += body.length;
    return key;
  };
  for (const path of paths) {
    const body = await readFile(join(input, path));
    if (!/^(brands|marketplaces|visual)\//.test(path)) {
      files[path] = await put(body);
      continue;
    }
    const field = path.startsWith("visual/") ? "cards" : "families";
    const data = JSON.parse(body.toString("utf8"));
    const rows: unknown[] = data[field];
    if (!Array.isArray(rows)) throw new Error(`Invalid catalog list: ${path}`);
    if (rows.length <= 256) {
      files[path] = await put(body);
      continue;
    }
    const parts: string[] = [];
    for (let i = 0; i < rows.length; i += 256) {
      const part = Buffer.from(JSON.stringify({ ...data, [field]: rows.slice(i, i + 256) }));
      if (part.length > 8 * 1024 * 1024) throw new Error(`Oversized catalog part: ${path}`);
      parts.push(await put(part));
    }
    files[path] = { field, parts };
  }
  const manifest = parseCatalogSnapshotManifest({ schema: CATALOG_SNAPSHOT_SCHEMA, files });
  const pointer = join(store, "manifest.json");
  const tmp = `${pointer}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(manifest), { flag: "wx" });
  await rename(tmp, pointer);
  return { manifest, written, bytesWritten, totalBytes, largestBytes };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/catalog-snapshot.ts")) {
  const output = process.argv[2];
  if (!output || !resolve(output).startsWith(`${resolve("logs/catalog-pilot")}/`)) {
    throw new Error("Choose a pilot store under logs/catalog-pilot/");
  }
  const input = join(resolve("logs/catalog-pilot"), `build-${randomUUID()}`);
  await buildCatalogFrontend({ outputDir: input });
  const { manifest, ...report } = await publishLocalCatalogSnapshot(input, output);
  console.log(JSON.stringify({ ...report, files: Object.keys(manifest.files).length }));
}
