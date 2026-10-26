import { describe, expect, it } from "vitest";

import { LocalBrandFavoriteRepository } from "../brandFavoritesRepository";
import { createPortableBackup, importPortableBackup, parsePortableBackup } from "../portableBackup";
import { LocalResearchStateRepository } from "../researchStateRepository";

describe("portable research backup", () => {
  it("moves product notes, saved/reviewed dates and favorite brands to another device", () => {
    const source = new LocalResearchStateRepository();
    const brands = new LocalBrandFavoriteRepository();
    source.mergeImported([{ modelFamilyId: "family-1", savedAt: "2026-10-20T00:00:00.000Z", reviewedAt: "2026-10-21T00:00:00.000Z", note: "Numune al" }]);
    brands.mergeImported([{ brandId: "pretty-ballerinas", savedAt: "2026-10-20T00:00:00.000Z" }]);
    const file = createPortableBackup(source, brands);
    const destination = new LocalResearchStateRepository();
    const destinationBrands = new LocalBrandFavoriteRepository();
    expect(importPortableBackup(parsePortableBackup(file), destination, destinationBrands)).toEqual({ products: 1, brands: 1, keptLocalNotes: 0 });
    expect(destination.get("family-1")).toEqual(source.get("family-1"));
    expect(destinationBrands.getAll()).toEqual(brands.getAll());
  });

  it("keeps existing local notes and merges missing saved information", () => {
    const local = new LocalResearchStateRepository();
    local.setNote("family-1", "Telefondaki not");
    const brands = new LocalBrandFavoriteRepository();
    brands.setSaved("existing-brand", true);
    const backup = parsePortableBackup(JSON.stringify({
      format: "capone-research-backup", version: 1, createdAt: "2026-10-26T00:00:00Z",
      products: [{ modelFamilyId: "family-1", savedAt: "2026-10-20T00:00:00Z", reviewedAt: null, note: "Bilgisayardaki not" }],
      brands: [{ brandId: "new-brand", savedAt: "2026-10-20T00:00:00Z" }],
    }));
    expect(importPortableBackup(backup, local, brands)).toEqual({ products: 1, brands: 1, keptLocalNotes: 1 });
    expect(local.get("family-1").note).toBe("Telefondaki not");
    expect(local.get("family-1").savedAt).toBe("2026-10-20T00:00:00Z");
    expect(brands.getAll().map((brand) => brand.brandId)).toContain("existing-brand");
    expect(importPortableBackup(backup, local, brands)).toEqual({ products: 0, brands: 0, keptLocalNotes: 1 });
  });

  it("rejects malformed and duplicate records before import", () => {
    const valid = { format: "capone-research-backup", version: 1, createdAt: "2026-10-26T00:00:00Z", products: [], brands: [] };
    expect(() => parsePortableBackup("not JSON")).toThrow("JSON");
    expect(() => parsePortableBackup(JSON.stringify({ ...valid, products: [{ modelFamilyId: "__proto__", savedAt: null, reviewedAt: null, note: "x" }] }))).toThrow("geçersiz ürün");
    expect(() => parsePortableBackup(JSON.stringify({ ...valid, brands: [{ brandId: "same", savedAt: "2026-10-20T00:00:00Z" }, { brandId: "same", savedAt: "2026-10-20T00:00:00Z" }] }))).toThrow("geçersiz marka");
    expect(() => parsePortableBackup(JSON.stringify({ ...valid, products: [{ modelFamilyId: "x", savedAt: "invalid", reviewedAt: null, note: null }] }))).toThrow("geçersiz ürün");
  });
});
