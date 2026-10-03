import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { buildBrandRegistryFromUniverseData } from "../build/buildBrandRegistry";
import { registryEntryToUniverseEntry, universeEntryToRegistryEntry } from "../build/convertBrandUniverse";
import { brandToPilotSourceConfig } from "../collection/brandToCollector";
import { brandEntries } from "../data/brands";
import type { BrandRegistryEntry } from "../types/brand";
import type { BrandUniverseFile } from "../build/types";

function loadGeneratedRegistry(universe: BrandUniverseFile): BrandRegistryEntry[] {
  const built = buildBrandRegistryFromUniverseData({ universeFile: universe });
  expect(built.ok).toBe(true);
  const output = ts.transpileModule(built.brandsTsContent!, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: { brandEntries?: BrandRegistryEntry[] } = {};
  // Execute only this trusted generated fixture, so assertions exercise the
  // actual emitted registry rather than matching snippets of source text.
  new Function("exports", output)(exports);
  return exports.brandEntries!;
}

const pinned = {
  newArrivalCollectionHandles: ["new-in"],
  newArrivalUrls: ["https://ceciliebahnsen.com/collections/new-in"],
  newArrivalDiscoveryStatus: "VERIFIED" as const,
  newArrivalEvidenceStrategy: 'Official "New In" collection',
};

describe("refresh preserves official NEW configuration", () => {
  it.each(["VERIFIED", "NEEDS_PROBE", "NOT_SUPPORTED"] as const)("retains %s metadata across migration and registry generation", (status) => {
    const original = { ...brandEntries.find(entry => entry.id === "cecilie-bahnsen")!, ...pinned, newArrivalDiscoveryStatus: status };
    const universe = registryEntryToUniverseEntry(original);
    const restored = universeEntryToRegistryEntry(universe);
    const generated = loadGeneratedRegistry({ version: 1, brands: [universe] })[0]!;
    for (const entry of [restored, generated]) {
      expect(entry.newArrivalCollectionHandles).toEqual(pinned.newArrivalCollectionHandles);
      expect(entry.newArrivalUrls).toEqual(pinned.newArrivalUrls);
      expect(entry.newArrivalDiscoveryStatus).toBe(status);
      expect(entry.newArrivalEvidenceStrategy).toBe(pinned.newArrivalEvidenceStrategy);
      expect(brandToPilotSourceConfig(entry)?.verifiedNewArrivalPaths).toEqual(status === "VERIFIED" ? ["/collections/new-in"] : undefined);
    }
  });
  it("keeps Cecilie pinned after repeated full-catalog registry rebuilds used by other source deliveries", () => {
    let universe = JSON.parse(readFileSync("data/registry/brand-universe.json", "utf8")) as BrandUniverseFile;
    const originalIds = universe.brands.map(entry => entry.id);
    const activeIds = universe.brands.filter(entry => entry.isActive).map(entry => entry.id);
    for (let iteration = 0; iteration < 3; iteration++) {
      const generated = loadGeneratedRegistry(universe);
      expect(generated.map(entry => entry.id)).toEqual(originalIds);
      expect(generated.filter(entry => entry.isActive).map(entry => entry.id)).toEqual(activeIds);
      expect(brandToPilotSourceConfig(generated.find(entry => entry.id === "cecilie-bahnsen")!)?.verifiedNewArrivalPaths).toEqual(["/collections/new-in"]);
      universe = { version: 1, brands: generated.map(registryEntryToUniverseEntry) };
    }
  });
  it("does not invent a NEW configuration for a source without evidence", () => {
    const original = { ...brandEntries[0] };
    delete original.newArrivalCollectionHandles;
    delete original.newArrivalUrls;
    delete original.newArrivalDiscoveryStatus;
    delete original.newArrivalEvidenceStrategy;
    const generated = loadGeneratedRegistry({ version: 1, brands: [registryEntryToUniverseEntry(original)] })[0]!;
    expect(generated.newArrivalDiscoveryStatus).toBeUndefined();
    expect(brandToPilotSourceConfig(generated)?.verifiedNewArrivalPaths).toBeUndefined();
  });
});
