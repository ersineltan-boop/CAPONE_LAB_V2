import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertRefreshCoverage, buildRefreshCyclePlan } from "../refreshCycle";
import { transactionalRefreshLane } from "../transactionalLane";
import { registryEntryToUniverseEntry } from "../../registry/build/convertBrandUniverse";
import { brandEntries } from "../../registry/data/brands";

describe("complete automatic refresh", () => {
  it.each([true, false])("uses the current universe for a newly activated brand (supported: %s)", async (supported) => {
    const root = await mkdtemp(join(tmpdir(), "capone-future-brand-"));
    try {
      await mkdir(join(root, "data/registry"), { recursive: true });
      await mkdir(join(root, "data/brands/wave50/last-good"), { recursive: true });
      const entry = registryEntryToUniverseEntry(brandEntries.find(brand => brand.id === "cecilie-bahnsen")!);
      Object.assign(entry, { id: "future-brand", brand: "FUTURE BRAND", officialUrl: "https://future.example.com", isActive: true,
        discoverySources: [], collectionStatus: supported ? "READY_AUTOMATIC" : "NEEDS_CUSTOM_ADAPTER",
        collectorType: supported ? "SHOPIFY_PUBLIC" : "UNSUPPORTED" });
      await writeFile(join(root, "data/registry/brand-universe.json"), JSON.stringify({ version: 1, brands: [entry] }));
      await writeFile(join(root, "data/registry/marketplace-pilot.json"), JSON.stringify({ activeMarketplaceIds: [] }));
      if (supported) {
        const plan = await buildRefreshCyclePlan(root);
        expect(plan.activeBrands).toEqual(["future-brand"]);
        expect(plan.lanes.find(lane => lane.id === "cloud-brands")?.brands).toEqual(["future-brand"]);
      } else {
        await expect(buildRefreshCyclePlan(root)).rejects.toThrow("brand:future-brand");
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("covers every current active brand and marketplace without new brand activation", async () => {
    const plan = await buildRefreshCyclePlan(process.cwd());
    expect(plan.activeBrands).toHaveLength(82);
    expect(plan.activeMarketplaces).toHaveLength(6);
    expect(plan.lanes.flatMap((lane) => lane.scripts).some((args) => args.includes("--refresh-only"))).toBe(true);
    expect(() => assertRefreshCoverage([...plan.activeBrands, "future-brand"], plan.activeMarketplaces, plan.lanes)).toThrow("brand:future-brand");
    expect(() => assertRefreshCoverage(plan.activeBrands, [...plan.activeMarketplaces, "future-marketplace"], plan.lanes)).toThrow("marketplace:future-marketplace");
  });
  it("restores a failed collector while retaining earlier successful updates and continuing the next collector", async () => {
    const root = await mkdtemp(join(tmpdir(), "capone-cycle-test-"));
    try {
      await mkdir(join(root, "data"));
      await writeFile(join(root, "data/catalog.json"), "original");
      const paths = ["data"];
      expect(await transactionalRefreshLane(root, paths, async () => {
        await writeFile(join(root, "data/catalog.json"), "first-lane-success"); return true;
      })).toBe(true);
      expect(await transactionalRefreshLane(root, paths, async () => {
        await writeFile(join(root, "data/catalog.json"), "unsafe-second-lane");
        await writeFile(join(root, "data/unsafe-new-shard.json"), "partial"); return false;
      })).toBe(false);
      expect(await readFile(join(root, "data/catalog.json"), "utf8")).toBe("first-lane-success");
      await expect(readFile(join(root, "data/unsafe-new-shard.json"))).rejects.toThrow();
      expect(await transactionalRefreshLane(root, paths, async () => {
        await writeFile(join(root, "data/third.json"), "third-lane-success"); return true;
      })).toBe(true);
      expect(await readFile(join(root, "data/third.json"), "utf8")).toBe("third-lane-success");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("has one twice-weekly schedule, one publication gate and no automatic new-brand work", async () => {
    const workflow = await readFile(".github/workflows/capone-refresh-cycle.yml", "utf8");
    expect(workflow).toContain('cron: "0 3 * * 0,3"');
    expect(workflow.match(/run: npm test/g)).toHaveLength(1);
    expect(workflow.match(/run: npm run build/g)).toHaveLength(1);
    expect(workflow).toContain("bash scripts/publish-validated-automation-pr.sh");
    expect(workflow).toContain("inputs.dry_run != true");
    for (const name of ["brand-onboarding", "daily-refresh", "issue-91-refresh", "expansion-refresh", "priority-sources-refresh", "marketplace-refresh", "new-brand-onboarding"]) {
      const child = await readFile(`.github/workflows/capone-${name}.yml`, "utf8");
      expect(child).not.toMatch(/^  (schedule|push):/m);
      expect(child).toContain("workflow_dispatch:");
    }
  });
});
