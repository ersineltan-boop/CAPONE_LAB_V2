import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    expect(isTrackedModelFamilyDatasetPath("data/multibrand/model-families/brands/test-brand.json")).toBe(
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

  it("preserves deterministic brand shards and does not duplicate their IDs in core shards", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "capone-families-brand-shard-"));
    try {
      const initial = await writeModelFamilies([family("core"), family("brand-owned")], { rootDir });
      const dir = join(rootDir, "model-families");
      await mkdir(join(dir, "brands"), { recursive: true });
      const brandFamilies = [family("brand-owned")];
      const body = JSON.stringify(brandFamilies);
      await writeFile(join(dir, "brands", "approved.json"), body, "utf-8");
      initial.shards.push({
        file: "brands/approved.json",
        familyCount: 1,
        bytes: Buffer.byteLength(body, "utf8"),
      });
      initial.totalFamilies += 1;
      initial.shardCount += 1;
      await writeFile(join(dir, "manifest.json"), JSON.stringify(initial), "utf-8");

      const next = await writeModelFamilies([family("core"), family("brand-owned")], { rootDir });
      expect(next.shards.some((shard) => shard.file === "brands/approved.json")).toBe(true);
      expect(next.totalFamilies).toBe(2);
      const loaded = await loadModelFamilies({ rootDir, allowMonolithFallback: false });
      expect(loaded.filter((item) => item.modelFamilyId === "brand-owned")).toHaveLength(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("updates marketplace evidence inside a brand-owned card without losing official data", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "capone-families-bidirectional-"));
    try {
      const dir = join(rootDir, "model-families");
      const initial = await writeModelFamilies([family("core")], { rootDir });
      await mkdir(join(dir, "brands"), { recursive: true });
      const official = {
        ...family("brand-owned"),
        canonicalName: "Official Model",
        representativeProductId: "https://approved.test/products/model",
        representativeImage: "https://img.test/official.jpg",
        representativeImages: ["https://img.test/official.jpg"],
        variantCount: 2,
        variants: [
          {
            productId: "https://approved.test/products/model",
            title: "Official Model",
            url: "https://approved.test/products/model",
            color: "Black",
            material: null,
            images: ["https://img.test/official.jpg"],
          },
          {
            productId: "https://market.test/items/old",
            title: "Old Market Listing",
            url: "https://market.test/items/old",
            color: "Black",
            material: null,
            images: ["https://img.test/market-old.jpg"],
          },
        ],
        allImages: ["https://img.test/official.jpg", "https://img.test/market-old.jpg"],
        sourceProductIds: [
          "https://approved.test/products/model",
          "https://market.test/items/old",
        ],
        sourceSightings: [
          {
            sourceId: "approved",
            sourceLabel: "Approved",
            sourceKind: "BRAND_OFFICIAL" as const,
            firstSeenAt: "2026-09-01T00:00:00.000Z",
            lastSeenAt: "2026-09-01T00:00:00.000Z",
          },
          {
            sourceId: "the-webster",
            sourceLabel: "The Webster",
            sourceKind: "LUXURY_MARKETPLACE" as const,
            firstSeenAt: "2026-09-01T00:00:00.000Z",
            lastSeenAt: "2026-09-01T00:00:00.000Z",
          },
        ],
        sourceCategoryRefs: [
          { sourceId: "approved", categoryId: "shoes", categoryName: "Shoes" },
          { sourceId: "the-webster", categoryId: "pumps-old", categoryName: "Pumps Old" },
        ],
      } satisfies ModelFamily;
      const brandBody = JSON.stringify([official]);
      await writeFile(join(dir, "brands", "approved.json"), brandBody, "utf-8");
      initial.shards.push({
        file: "brands/approved.json",
        familyCount: 1,
        bytes: Buffer.byteLength(brandBody, "utf8"),
      });
      initial.totalFamilies += 1;
      initial.shardCount += 1;
      await writeFile(join(dir, "manifest.json"), JSON.stringify(initial), "utf-8");

      const marketplace = {
        ...family("brand-owned"),
        canonicalName: "Marketplace Label",
        representativeProductId: "https://approved.test/products/stale",
        representativeImage: "https://img.test/stale-official.jpg",
        representativeImages: ["https://img.test/stale-official.jpg"],
        variantCount: 2,
        variants: [
          {
            productId: "https://approved.test/products/stale",
            title: "Stale Official Product",
            url: "https://approved.test/products/stale",
            color: "Black",
            material: null,
            images: ["https://img.test/stale-official.jpg"],
          },
          {
            productId: "https://market.test/items/new",
            title: "New Market Listing",
            url: "https://market.test/items/new",
            color: "Black",
            material: null,
            images: ["https://img.test/market-new.jpg"],
          },
        ],
        allImages: ["https://img.test/stale-official.jpg", "https://img.test/market-new.jpg"],
        sourceProductIds: [
          "https://approved.test/products/stale",
          "https://market.test/items/new",
        ],
        sourceSightings: [
          {
            sourceId: "approved",
            sourceLabel: "Approved",
            sourceKind: "BRAND_OFFICIAL" as const,
            firstSeenAt: "2026-08-01T00:00:00.000Z",
            lastSeenAt: "2026-09-27T00:00:00.000Z",
          },
          {
            sourceId: "the-webster",
            sourceLabel: "The Webster",
            sourceKind: "LUXURY_MARKETPLACE" as const,
            firstSeenAt: "2026-09-01T00:00:00.000Z",
            lastSeenAt: "2026-09-27T00:00:00.000Z",
          },
        ],
        sourceCategoryRefs: [
          { sourceId: "approved", categoryId: "stale", categoryName: "Stale" },
          { sourceId: "the-webster", categoryId: "pumps-new", categoryName: "Pumps New" },
        ],
      } satisfies ModelFamily;

      const authoritativeMarketplaceSources = [{
        sourceId: "the-webster",
        origin: "https://market.test",
      }];
      await writeModelFamilies([family("core"), marketplace], {
        rootDir,
        authoritativeMarketplaceSources,
      });
      const loaded = await loadModelFamilies({ rootDir, allowMonolithFallback: false });
      const stored = loaded.find((item) => item.modelFamilyId === "brand-owned");
      expect(loaded.filter((item) => item.modelFamilyId === "brand-owned")).toHaveLength(1);
      expect(stored?.canonicalName).toBe("Official Model");
      expect(stored?.variants.map((variant) => variant.url)).toEqual([
        "https://approved.test/products/model",
        "https://market.test/items/new",
      ]);
      expect(stored?.variants.map((variant) => variant.url)).not.toContain(
        "https://approved.test/products/stale",
      );
      expect(stored?.variants.flatMap((variant) => variant.images)).toContain(
        "https://img.test/market-new.jpg",
      );
      expect(stored?.sourceSightings?.map((sighting) => [sighting.sourceId, sighting.lastSeenAt])).toEqual([
        ["approved", "2026-09-01T00:00:00.000Z"],
        ["the-webster", "2026-09-27T00:00:00.000Z"],
      ]);
      expect(stored?.sourceCategoryRefs).toEqual([
        { sourceId: "approved", categoryId: "shoes", categoryName: "Shoes" },
        { sourceId: "the-webster", categoryId: "pumps-new", categoryName: "Pumps New" },
      ]);

      await writeModelFamilies([family("core")], {
        rootDir,
        authoritativeMarketplaceSources,
      });
      const afterRemoval = await loadModelFamilies({ rootDir, allowMonolithFallback: false });
      const officialOnly = afterRemoval.find((item) => item.modelFamilyId === "brand-owned");
      expect(afterRemoval.filter((item) => item.modelFamilyId === "brand-owned")).toHaveLength(1);
      expect(officialOnly?.variants.map((variant) => variant.url)).toEqual([
        "https://approved.test/products/model",
      ]);
      expect(officialOnly?.sourceSightings?.map((sighting) => sighting.sourceId)).toEqual([
        "approved",
      ]);
      expect(officialOnly?.sourceCategoryRefs).toEqual([
        { sourceId: "approved", categoryId: "shoes", categoryName: "Shoes" },
      ]);
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
