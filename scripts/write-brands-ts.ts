import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBrandRegistryFromUniverseData } from "../src/registry/build/buildBrandRegistry";
import { emptyProbeCache } from "../src/registry/build/probeCache";
import type { BrandProbeCacheFile, BrandUniverseFile } from "../src/registry/build/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function writeWithRetry(path: string, body: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await writeFile(tmp, body, "utf-8");
      try {
        await unlink(path);
      } catch {
        // ignore
      }
      await rename(tmp, path);
      return;
    } catch (error) {
      console.warn(`retry ${attempt + 1} ${path}: ${error instanceof Error ? error.message : error}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  await writeFile(path, body, "utf-8");
}

async function loadProbeCacheFile(path: string): Promise<BrandProbeCacheFile> {
  try {
    const raw = JSON.parse(await readFile(path, "utf-8")) as BrandProbeCacheFile;
    if (raw.version !== 1 || !raw.entries) return emptyProbeCache();
    return raw;
  } catch {
    return emptyProbeCache();
  }
}

const universe = JSON.parse(
  await readFile(join(ROOT, "data", "registry", "brand-universe.json"), "utf-8"),
) as BrandUniverseFile;
const probeCache = await loadProbeCacheFile(join(ROOT, "data", "registry", "brand-probe-cache.json"));
const result = buildBrandRegistryFromUniverseData({ universeFile: universe, probeCache });

console.log(`ok=${result.ok} entries=${result.registryCount} active=${result.report.activeBrands}`);
if (!result.ok || !result.brandsTsContent) {
  process.exit(1);
}

await writeWithRetry(join(ROOT, "src", "registry", "data", "brands.ts"), result.brandsTsContent);
try {
  await writeWithRetry(
    join(ROOT, "data", "registry", "brand-universe-report.json"),
    JSON.stringify(result.report, null, 2),
  );
} catch (error) {
  console.warn("report write failed", error);
}
console.log("wrote brands.ts");
