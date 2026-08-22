import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isTrackedModelFamilyDatasetPath,
  loadModelFamilies,
  MODEL_FAMILY_MONOLITH_REPO,
  splitModelFamiliesIntoShards,
  writeModelFamilies,
} from "../dataset";
import type { ModelFamily } from "../types";

function family(id: string, extra = ""): ModelFamily {
  return {
    modelFamilyId: id,
    brand: "TEST",
    canonicalName: `Model ${id}${extra}`,
    category: "PUMP",
    representativeProductId: `https://example.com/${id}`,
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: [`https://example.com/${id}`],
    groupingConfidence: "HIGH",
    groupingReason: "test",
  };
}

describe("model family dataset shards", () => {
  it("does not treat the monolith as a tracked dataset path", () => {
    expect(isTrackedModelFamilyDatasetPath(MODEL_FAMILY_MONOLITH_REPO)).toBe(false);
    expect(isTrackedModelFamilyDatasetPath("data/multibrand/model-families/manifest.json")).toBe(
      true,
    );
    expect(isTrackedModelFamilyDatasetPath("data/multibrand/model-families/part-000.json")).toBe(
      true,
    );
    expect(isTrackedModelFamilyDatasetPath("data/multibrand/model-families/part-00a.json")).toBe(
      false,
    );
  });

  it("packs shards under the Git-safe byte target", () => {
    const families = Array.from({ length: 40 }, (_, index) =>
      family(`id-${String(index).padStart(3, "0")}`, "x".repeat(20_000)),
    );
    const shards = splitModelFamiliesIntoShards(families, 80_000);
    expect(shards.length).toBeGreaterThan(1);
    for (const shard of shards) {
      expect(Buffer.byteLength(JSON.stringify(shard), "utf8")).toBeLessThanOrEqual(80_000);
    }
    expect(shards.flat()).toHaveLength(families.length);
  });

  it("round-trips families through shards and ignores a stale monolith", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "capone-families-"));
    try {
      const original = [family("b-boot"), family("a-flat"), family("c-mule")];
      await writeFile(
        join(rootDir, "model-families.json"),
        JSON.stringify([family("stale-monolith")]),
        "utf-8",
      );
      const manifest = await writeModelFamilies(original, { rootDir });
      expect(manifest.totalFamilies).toBe(3);
      expect(manifest.shardCount).toBe(1);
      expect(manifest.shards[0]?.file).toBe("part-000.json");

      const loaded = await loadModelFamilies({ rootDir, allowMonolithFallback: false });
      expect(loaded.map((item) => item.modelFamilyId)).toEqual(["a-flat", "b-boot", "c-mule"]);

      const part = JSON.parse(
        await readFile(join(rootDir, "model-families", "part-000.json"), "utf-8"),
      ) as ModelFamily[];
      expect(part).toHaveLength(3);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("falls back to the local monolith only when shards are missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "capone-families-fallback-"));
    try {
      await writeFile(
        join(rootDir, "model-families.json"),
        JSON.stringify([family("legacy")]),
        "utf-8",
      );
      const loaded = await loadModelFamilies({ rootDir });
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.modelFamilyId).toBe("legacy");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("removes stale shard files when the shard count shrinks", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "capone-families-stale-"));
    try {
      const many = Array.from({ length: 12 }, (_, index) =>
        family(`id-${index}`, "y".repeat(8_000)),
      );
      await writeModelFamilies(many, { rootDir });
      const afterShrink = await writeModelFamilies([family("only")], { rootDir });
      expect(afterShrink.shardCount).toBe(1);
      const loaded = await loadModelFamilies({ rootDir, allowMonolithFallback: false });
      expect(loaded).toHaveLength(1);
      await expect(
        readFile(join(rootDir, "model-families", "part-001.json"), "utf-8"),
      ).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
