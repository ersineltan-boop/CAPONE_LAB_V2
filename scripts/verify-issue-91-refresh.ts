import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { retainedModelCountBlocker } from "../src/refresh/catalogRetention";

const BRANDS = [
  "isabel-marant", "yuul-yie", "le-silla", "k-jacques", "fly-london",
  "pretty-ballerinas", "mascar", "rouje", "repetto",
] as const;

function previousJson(path: string): unknown {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${path}`], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })) as unknown;
  } catch {
    throw new Error(`Last-good source missing from HEAD: ${path}`);
  }
}

async function currentJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function countFamilies(value: unknown, path: string): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object" && "families" in value && Array.isArray(value.families)) {
    return value.families.length;
  }
  throw new Error(`Invalid family shard: ${path}`);
}

const paths = BRANDS.map((slug) => `data/multibrand/model-families/brands/${slug}.json`);
paths.push("data/multibrand/model-families/marketplaces/browns.json");

const failures: string[] = [];
for (const path of paths) {
  const before = countFamilies(previousJson(path), path);
  const after = countFamilies(await currentJson(path), path);
  const blocker = retainedModelCountBlocker(before, after, path);
  if (blocker) failures.push(blocker);
  console.log(`${path}: ${before} -> ${after} model(s)`);
}
if (failures.length > 0) throw new Error(`Refusing reduced catalog delivery:\n${failures.join("\n")}`);
