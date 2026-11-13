import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

type SourceRow = { source: string };
const sourceId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const digest = (body: string) => createHash("sha256").update(body).digest("hex");
const MAX_PART_BYTES = 8 * 1024 * 1024;

export async function writeSourceArchive<T extends SourceRow>(rows: readonly T[], root: string) {
  const groups = new Map<string, T[]>();
  // Keep ordering separately so an insertion in one source cannot rehash other sources.
  const order: string[] = [];
  for (const row of rows) {
    if (!sourceId.test(row.source)) throw new Error(`Invalid catalog source: ${row.source}`);
    const group = groups.get(row.source) ?? [];
    if (!groups.has(row.source)) groups.set(row.source, group);
    group.push(row);
    order.push(row.source);
  }
  const parts: Array<{ source: string; file: string; count: number; bytes: number }> = [];
  for (const [source, group] of groups) {
    const dir = join(root, source);
    await mkdir(dir, { recursive: true });
    let chunk: string[] = [], bytes = 2;
    const flush = async () => {
      if (!chunk.length) return;
      const body = `[${chunk.join(",")}]`;
      const file = `${source}/${digest(body)}.json`;
      const target = join(root, file);
      const tmp = `${target}.${randomUUID()}.tmp`;
      await writeFile(tmp, body, { flag: "wx" });
      await rename(tmp, target);
      parts.push({ source, file, count: chunk.length, bytes });
      chunk = [];
      bytes = 2;
    };
    for (const row of group) {
      const encoded = JSON.stringify(row);
      const rowBytes = Buffer.byteLength(encoded);
      if (rowBytes + 2 > MAX_PART_BYTES) throw new Error(`Oversized record for ${source}`);
      if (bytes + rowBytes + (chunk.length ? 1 : 0) > MAX_PART_BYTES) await flush();
      bytes += rowBytes + (chunk.length ? 1 : 0);
      chunk.push(encoded);
    }
    await flush();
  }
  const manifest = { schema: "capone.source-archive.v1", order, parts } as const;
  await mkdir(root, { recursive: true });
  const tmp = join(root, `manifest-${randomUUID()}.tmp`);
  await writeFile(tmp, JSON.stringify(manifest), { flag: "wx" });
  await rename(tmp, join(root, "manifest.json"));
  return manifest;
}

export async function readSourceArchive<T extends SourceRow>(root: string): Promise<T[]> {
  const manifest: Awaited<ReturnType<typeof writeSourceArchive>> = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  if (manifest.schema !== "capone.source-archive.v1" || !Array.isArray(manifest.order) ||
      !Array.isArray(manifest.parts)) throw new Error("Invalid source archive manifest");
  const groups = new Map<string, T[]>();
  for (const part of manifest.parts) {
    if (!sourceId.test(part.source) || !/^[a-z0-9-]+\/[a-f0-9]{64}\.json$/.test(part.file) ||
        !part.file.startsWith(`${part.source}/`)) throw new Error("Invalid source archive path");
    const body = await readFile(join(root, part.file), "utf8");
    if (!part.file.endsWith(`/${digest(body)}.json`) || Buffer.byteLength(body) !== part.bytes) {
      throw new Error(`Source archive integrity failure: ${part.file}`);
    }
    const chunk: T[] = JSON.parse(body);
    if (!Array.isArray(chunk) || chunk.length !== part.count) throw new Error("Invalid source archive part count");
    const group = groups.get(part.source) ?? [];
    if (chunk.some((row) => row?.source !== part.source)) throw new Error("Invalid source archive record source");
    for (const row of chunk) group.push(row);
    groups.set(part.source, group);
  }
  const offsets = new Map<string, number>();
  const rows = manifest.order.map((source) => {
    const offset = offsets.get(source) ?? 0;
    const row = groups.get(source)?.[offset];
    if (!row) throw new Error("Incomplete source archive");
    offsets.set(source, offset + 1);
    return row;
  });
  if ([...groups].some(([source, group]) => offsets.get(source) !== group.length)) throw new Error("Unreferenced source archive records");
  return rows;
}
