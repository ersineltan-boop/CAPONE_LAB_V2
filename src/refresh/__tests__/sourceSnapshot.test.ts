import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createSourceRefreshPlan,
  type SourceCatalogItem,
  type SourceLastGoodState,
} from "../sourceSnapshot";
import { publishLastGoodAtomic } from "../sourceSnapshotStore";

const targetFor = (targetPath: string, sourceId = "free-people") => ({ targetPath, sourceId });

const at = "2026-09-17T08:00:00.000Z";

function item(
  identity: string,
  modelIdentity: string,
  colorIdentity: string,
  overrides: Partial<SourceCatalogItem> = {},
): SourceCatalogItem {
  return {
    identity,
    modelIdentity,
    colorIdentity,
    inStock: true,
    ...overrides,
  };
}

function plan(
  items: SourceCatalogItem[],
  previous: SourceLastGoodState | null = null,
  overrides: Partial<Parameters<typeof createSourceRefreshPlan>[0]> = {},
) {
  return createSourceRefreshPlan(
    {
      sourceId: "free-people",
      attemptedAt: at,
      runnerStarted: true,
      sourceAvailable: true,
      fullCatalog: true,
      sourceTotal: items.length,
      items,
      ...overrides,
    },
    previous,
  );
}

function publishedState(items: SourceCatalogItem[]): SourceLastGoodState {
  const result = plan(items);
  if (!result.proposedLastGood) throw new Error("fixture did not produce last-good state");
  return result.proposedLastGood;
}

describe("source snapshot diff", () => {
  it("treats the first healthy full catalog as BASELINE, never NEW_MODEL", () => {
    const result = plan([item("sku-a", "style-a", "black")]);
    expect(result.status).toBe("SUCCESS");
    expect(result.events.map((event) => event.type)).toEqual(["BASELINE"]);
    expect(result.health.coverage_percent).toBe(100);
  });

  it("separates new models, new colors, restocks and price changes", () => {
    const previous = publishedState([
      item("a-black", "a", "black", { inStock: false, price: 100, currency: "RON" }),
      item("removed", "removed-model", "black"),
    ]);
    const result = plan(
      [
        item("a-black", "a", "black", { inStock: true, price: 120, currency: "RON" }),
        item("a-red", "a", "red"),
        item("b-black", "b", "black", { newnessEvidence: "NEW_ARRIVALS_COLLECTION" }),
      ],
      previous,
      { maxDropPercent: 100 },
    );
    expect(result.events.map((event) => event.type)).toEqual([
      "RESTOCK",
      "PRICE_CHANGE",
      "NEW_COLOR",
      "NEW_MODEL",
      "REMOVED",
    ]);
    expect(result.events.find((event) => event.type === "NEW_MODEL")?.evidence).toEqual([
      "FULL_CATALOG_DIFF",
      "NEW_ARRIVALS_COLLECTION",
    ]);
  });

  it("classifies an historically seen item returning after absence as RESTOCK", () => {
    const baseline = publishedState([
      item("returning", "style-a", "black"),
      item("stays", "style-b", "tan"),
    ]);
    const missingPlan = plan([item("stays", "style-b", "tan")], baseline, {
      maxDropPercent: 100,
    });
    const missingState = missingPlan.proposedLastGood!;
    const returned = plan(
      [item("returning", "style-a", "black"), item("stays", "style-b", "tan")],
      missingState,
    );
    expect(returned.events.find((event) => event.identity === "returning")?.type).toBe("RESTOCK");
  });

  it("rejects a previous snapshot from another source before diffing", () => {
    const previous = publishedState([item("old", "old", "black")]);
    const foreignPrevious: SourceLastGoodState = {
      ...previous,
      snapshot: { ...previous.snapshot, sourceId: "level-shoes" },
    };
    const result = plan([item("new", "new", "red")], foreignPrevious);
    expect(result.status).toBe("VALIDATION_FAILED");
    expect(result.publishAllowed).toBe(false);
    expect(result.validationErrors).toEqual([
      "previous snapshot source level-shoes does not match input source free-people",
    ]);
    expect(result.health.previous_collected).toBe(0);
    expect(result.health.last_good_snapshot_id).toBeNull();
  });
});

describe("last-good safety", () => {
  it.each([
    ["runner", { runnerStarted: false }, "RUNNER_NOT_STARTED"],
    ["source", { sourceAvailable: false }, "SOURCE_UNAVAILABLE"],
    ["collector", { collectError: "timeout" }, "COLLECT_FAILED"],
    ["partial", { fullCatalog: false }, "VALIDATION_FAILED"],
  ])("does not propose a last-good update for %s failure", (_label, overrides, status) => {
    const previous = publishedState([item("old", "old", "black")]);
    const result = plan([item("new", "new", "red")], previous, overrides);
    expect(result.status).toBe(status);
    expect(result.publishAllowed).toBe(false);
    expect(result.proposedLastGood).toBeNull();
    expect(result.health.last_good_snapshot_id).toBe(previous.snapshot.snapshotId);
  });

  it("rejects empty and low-coverage collections and catastrophic drops", () => {
    const previous = publishedState(Array.from({ length: 10 }, (_, index) =>
      item(`sku-${index}`, `style-${index}`, "black"),
    ));
    const empty = plan([], previous, { sourceTotal: 10 });
    expect(empty.status).toBe("VALIDATION_FAILED");
    expect(empty.validationErrors).toContain("collection is empty");
    const partial = plan([item("sku-0", "style-0", "black")], previous, { sourceTotal: 10 });
    expect(partial.validationErrors.some((error) => error.includes("coverage"))).toBe(true);
    expect(partial.validationErrors.some((error) => error.includes("catalog drop"))).toBe(true);
  });

  it("atomically publishes only a valid non-empty last-good snapshot", async () => {
    const directory = await mkdtemp(join(tmpdir(), "capone-last-good-"));
    const target = join(directory, "last-good.json");
    try {
      const valid = plan([item("sku-a", "style-a", "black")]);
      const published = await publishLastGoodAtomic(targetFor(target), valid);
      expect(published.status).toBe("SUCCESS");
      expect(published.health.last_good_snapshot_id).toBe(valid.proposedLastGood?.snapshot.snapshotId);
      const before = await readFile(target, "utf-8");

      const invalid = plan([], valid.proposedLastGood, { sourceTotal: 1 });
      const rejected = await publishLastGoodAtomic(targetFor(target), invalid);
      expect(rejected.status).toBe("PUBLISH_FAILED");
      expect(await readFile(target, "utf-8")).toBe(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("binds a target to the plan source and leaves no artifacts on rejection", async () => {
    const directory = await mkdtemp(join(tmpdir(), "capone-source-binding-"));
    const target = join(directory, "last-good.json");
    try {
      const valid = plan([item("sku-a", "style-a", "black")]);
      const rejected = await publishLastGoodAtomic(targetFor(target, "level-shoes"), valid);
      expect(rejected.status).toBe("PUBLISH_FAILED");
      expect(rejected.health.failure_reason).toContain(
        "target source level-shoes does not match plan source free-people",
      );
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses optimistic version checks to reject a stale writer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "capone-version-"));
    const target = join(directory, "last-good.json");
    try {
      const baseline = plan([item("sku-a", "style-a", "black")]);
      expect((await publishLastGoodAtomic(targetFor(target), baseline)).status).toBe("SUCCESS");

      const first = plan(
        [item("sku-a", "style-a", "black"), item("sku-b", "style-b", "tan")],
        baseline.proposedLastGood,
        { attemptedAt: "2026-09-17T09:00:00.000Z" },
      );
      const stale = plan(
        [item("sku-a", "style-a", "black"), item("sku-c", "style-c", "red")],
        baseline.proposedLastGood,
        { attemptedAt: "2026-09-17T10:00:00.000Z" },
      );
      expect((await publishLastGoodAtomic(targetFor(target), first)).status).toBe("SUCCESS");

      const rejected = await publishLastGoodAtomic(targetFor(target), stale);
      expect(rejected.status).toBe("PUBLISH_FAILED");
      expect(rejected.health.failure_reason).toContain("version conflict");
      const stored = JSON.parse(await readFile(target, "utf-8")) as SourceLastGoodState;
      expect(stored.snapshot.snapshotId).toBe(first.proposedLastGood?.snapshot.snapshotId);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes concurrent writers and removes unique temp and lock files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "capone-concurrent-"));
    const target = join(directory, "last-good.json");
    try {
      const first = plan([item("sku-a", "style-a", "black")], null, {
        attemptedAt: "2026-09-17T11:00:00.000Z",
      });
      const second = plan([item("sku-b", "style-b", "tan")], null, {
        attemptedAt: "2026-09-17T12:00:00.000Z",
      });
      const results = await Promise.all([
        publishLastGoodAtomic(targetFor(target), first),
        publishLastGoodAtomic(targetFor(target), second),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([
        "PUBLISH_FAILED",
        "SUCCESS",
      ]);
      const stored = JSON.parse(await readFile(target, "utf-8")) as SourceLastGoodState;
      expect([
        first.proposedLastGood?.snapshot.snapshotId,
        second.proposedLastGood?.snapshot.snapshotId,
      ]).toContain(stored.snapshot.snapshotId);
      expect(await readdir(directory)).toEqual(["last-good.json"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
