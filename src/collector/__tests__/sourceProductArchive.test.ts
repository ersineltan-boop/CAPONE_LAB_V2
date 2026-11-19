import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createShardedProductCatalogStore } from "../sourceProductArchive";

it("keeps unrelated source objects stable and leaves the last-good manifest intact when a write fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "capone-source-archive-"));
  try {
    const store = createShardedProductCatalogStore(root);
    const initial = [{ source: "brand-a", title: "İlk bot", gallery: ["first", "second"] },
      { source: "brand-b", title: "Süet", gallery: ["original"] }];
    const old = await store.write("products", initial);
    const changed = await store.write("products", [{ ...initial[0]!, title: "Yeni başlık" }, initial[1]!]);
    expect(changed.parts.find(p => p.source === "brand-b")).toEqual(old.parts.find(p => p.source === "brand-b"));
    const pointer = join(root, "products/manifest.json");
    const lastGood = await readFile(pointer, "utf8");
    await expect(store.write("products", [{ source: "brand-a", title: "x".repeat(8 * 1024 * 1024) }])).rejects.toThrow("Oversized record");
    expect(await readFile(pointer, "utf8")).toBe(lastGood);
    expect(await store.read("products")).toEqual([{ ...initial[0]!, title: "Yeni başlık" }, initial[1]!]);
    await writeFile(join(root, "products", changed.parts[1]!.file), "[]");
    await expect(store.read("products")).rejects.toThrow("integrity failure");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
