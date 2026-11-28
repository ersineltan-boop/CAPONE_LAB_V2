import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadMarketplaceDeliveries } from "../src/collector/marketplaceDelivery";
import { loadModelFamilies } from "../src/modelFamily/dataset";

const root = process.cwd();
const audit = join(root, "logs/refresh-cycle");
const beforePath = join(audit, "before-products.json");
type Outcome = "tam güncellendi" | "kısmen güncellendi" | "eski veri korundu";
type Fingerprints = Record<string, Record<string, string>>;
type Product = {
  source?: string;
  productUrl?: string;
  productName?: string;
  imageUrl?: string | null;
  images?: string[];
  sourceModelCode?: string;
};
type Evidence = { outcome: Outcome; received: number | null; blocker: string | null };
const FULL = new Set(["success", "FULL", "FULL_PUBLISHED", "FULL_NO_CHANGE", "DRY_RUN_FULL"]);
const PARTIAL = new Set(["partial", "PARTIAL"]);

const fingerprint = (product: Product) => JSON.stringify([
  product.sourceModelCode ?? "",
  product.productName ?? "",
  product.imageUrl ?? "",
  ...(product.images ?? []),
]);
const readJson = async <T>(path: string, fallback: T): Promise<T> => {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
};
const asRecord = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    const parts = value.map((item) => {
      if (typeof item === "string") return item;
      const record = asRecord(item);
      return typeof record.reason === "string" ? record.reason : "";
    }).filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  return String(value);
};
const countOf = (row: Record<string, unknown>): number | null => {
  for (const key of ["parsedProducts", "fetchedProducts", "acceptedFootwear", "collected", "eligibleProducts", "rawCollected", "acceptedProductCount"]) {
    if (typeof row[key] === "number") return row[key];
  }
  return null;
};
const outcomeOf = (status: unknown, preserved: boolean): Outcome => {
  const name = String(status ?? "");
  if (preserved || name === "FAILED" || name === "failed" || name.endsWith("BLOCKED")) return "eski veri korundu";
  if (PARTIAL.has(name)) return "kısmen güncellendi";
  if (FULL.has(name)) return "tam güncellendi";
  return "eski veri korundu";
};

async function catalogFingerprints(): Promise<{ products: Fingerprints; families: Fingerprints; marketplaces: Fingerprints }> {
  const universe = await readJson<{ brands?: Array<{ id: string; brand: string }> }>(join(root, "data/registry/brand-universe.json"), {});
  const brandId = new Map((universe.brands ?? []).map((brand) => [brand.brand.trim().toUpperCase(), brand.id]));
  const products: Fingerprints = {};
  for (const product of await readJson<Product[]>(join(root, "data/multibrand/products.json"), [])) {
    const source = product.source?.trim();
    const url = product.productUrl?.trim();
    if (!source || !url) continue;
    (products[source] ??= {})[url] = fingerprint(product);
  }
  const families: Fingerprints = {};
  for (const family of await loadModelFamilies({ rootDir: join(root, "data/multibrand"), allowMonolithFallback: false }).catch(() => [])) {
    const source = brandId.get(family.brand.trim().toUpperCase());
    if (!source) continue;
    for (const variant of family.variants) {
      if (!variant.url) continue;
      (families[source] ??= {})[variant.url] = variant.images[0] ?? "";
    }
  }
  const marketplaces: Fingerprints = {};
  for (const delivery of await loadMarketplaceDeliveries(root).catch(() => [])) {
    const urls: Record<string, string> = {};
    for (const product of delivery.products) if (product.productUrl) urls[product.productUrl] = fingerprint(product);
    marketplaces[delivery.sourceId] = urls;
  }
  return { products, families, marketplaces };
}

async function snapshot() {
  await mkdir(audit, { recursive: true });
  await writeFile(beforePath, JSON.stringify(await catalogFingerprints()));
  console.log(`Saved the pre-refresh catalog index to ${beforePath}`);
}

async function report() {
  const before = await readJson<{ products: Fingerprints; families?: Fingerprints; marketplaces: Fingerprints }>(beforePath, { products: {}, families: {}, marketplaces: {} });
  const after = await catalogFingerprints();
  const plan = await readJson<{ activeBrands?: string[]; activeMarketplaces?: string[]; lanes?: Array<{ id: string; brands: string[]; marketplaces: string[] }> }>(join(audit, "plan.json"), {});
  const cycle = await readJson<{ outcomes?: Array<{ id: string; status: string }> }>(join(audit, "report.json"), {});
  const universe = await readJson<{ brands?: Array<{ id: string; brand: string }> }>(join(root, "data/registry/brand-universe.json"), {});
  const ids = new Map<string, string>();
  for (const brand of universe.brands ?? []) {
    ids.set(brand.id, brand.id);
    ids.set(brand.id.toUpperCase(), brand.id);
    ids.set(brand.brand.trim().toUpperCase(), brand.id);
  }
  const laneOf = new Map<string, string>();
  for (const lane of plan.lanes ?? []) {
    for (const id of [...lane.brands, ...lane.marketplaces]) laneOf.set(id, lane.id);
  }
  const laneFailed = new Set((cycle.outcomes ?? []).filter((lane) => lane.status === "FAILED_LAST_GOOD_PRESERVED").map((lane) => lane.id));
  const evidence = new Map<string, Evidence>();
  const remember = (id: string | null | undefined, next: Evidence) => {
    const resolved = id ? ids.get(id) ?? ids.get(id.toUpperCase()) ?? id : null;
    if (!resolved || evidence.has(resolved)) return;
    evidence.set(resolved, next);
  };
  // Only reports copied during this run. Committed report files can be from an older refresh.
  for (const file of (await readdir(audit).catch(() => [])).filter((name) => /^[a-z0-9-]+-\d+\.json$/.test(name))) {
    const lane = file.replace(/-\d+\.json$/, "");
    const body = await readJson<Record<string, unknown>>(join(audit, file), {});
    if (lane === "official-brands") {
      for (const row of (body.outcomes as Array<Record<string, unknown>> | undefined) ?? []) {
        remember(text(row.slug), { outcome: outcomeOf(row.status, row.lastGoodRetained === true), received: countOf(row), blocker: text(row.blocker) });
      }
    } else if (lane === "cloud-brands" && Array.isArray(body.sources)) {
      for (const row of body.sources as Array<Record<string, unknown>>) {
        remember(text(row.source), { outcome: outcomeOf(row.status, row.status === "failed"), received: countOf(row), blocker: text(row.errors) });
      }
    } else if (lane.startsWith("official-shopify")) {
      for (const row of (body.brands as Array<Record<string, unknown>> | undefined) ?? []) {
        remember(text(row.slug), { outcome: outcomeOf(row.status, row.lastGoodRetained === true || row.status !== "FULL"), received: countOf(row), blocker: text(row.blocker) });
      }
    } else if (lane === "browns") {
      remember("browns", { outcome: outcomeOf(body.status, body.published === false || body.status === "FAILED"), received: countOf(body), blocker: text(body.publishReason) ?? text(body.errors) });
    } else if (lane === "expansion" || lane === "priority") {
      for (const id of (body.accepted as string[] | undefined) ?? []) {
        remember(id, { outcome: lane === "expansion" ? "kısmen güncellendi" : "tam güncellendi", received: null, blocker: lane === "expansion" ? "Approved feed refreshed; complete source total remains unverified" : null });
      }
      for (const row of (body.preserved as Array<{ id?: string; reason?: string }> | undefined) ?? []) {
        remember(row.id, { outcome: "eski veri korundu", received: null, blocker: row.reason ?? "Last-good catalog retained" });
      }
    } else if (lane === "marketplaces") {
      for (const gate of (body.gates as Array<Record<string, unknown>> | undefined) ?? []) {
        const accepted = gate.accepted === true;
        remember(text(gate.sourceId), {
          outcome: outcomeOf(accepted ? gate.publicationCoverage : "FAILED", !accepted || gate.lastGoodPreserved === true),
          received: countOf(gate),
          blocker: accepted ? null : text(gate.reasons) ?? text(gate.collectorErrors),
        });
      }
    }
  }

  const examples: Array<{ kind: "yeni" | "değişen"; source: string; url: string }> = [];
  const pushExample = (kind: "yeni" | "değişen", source: string, url: string) => {
    if (examples.filter((item) => item.kind === kind).length >= 4) return;
    if (examples.some((item) => item.url === url)) return;
    examples.push({ kind, source, url });
  };
  const diffMaps = (previous: Record<string, string> = {}, current: Record<string, string> = {}, source: string) => {
    let added = 0;
    let changed = 0;
    for (const [url, hash] of Object.entries(current)) {
      if (!(url in previous)) { added += 1; pushExample("yeni", source, url); }
      else if (previous[url] !== hash) { changed += 1; pushExample("değişen", source, url); }
    }
    return { before: Object.keys(previous).length, after: Object.keys(current).length, added, changed };
  };

  const rows = [...(plan.activeBrands ?? []).map((id) => ({ id, kind: "brand" as const })), ...(plan.activeMarketplaces ?? []).map((id) => ({ id, kind: "marketplace" as const }))];
  const results = rows.map(({ id, kind }) => {
    const lane = laneOf.get(id) ?? "unknown";
    const productCatalog = diffMaps(before.products[id], after.products[id], id);
    const familyCatalog = diffMaps(before.families?.[id], after.families[id], id);
    const marketplaceCatalog = diffMaps(before.marketplaces[id], after.marketplaces[id], id);
    const catalog = kind === "marketplace"
      ? marketplaceCatalog
      : productCatalog.before + productCatalog.after >= familyCatalog.before + familyCatalog.after
        ? productCatalog
        : familyCatalog;
    const found = evidence.get(id);
    const failedLane = laneFailed.has(lane);
    const outcome: Outcome = failedLane ? "eski veri korundu" : found?.outcome ?? (catalog.added + catalog.changed > 0 ? "kısmen güncellendi" : "eski veri korundu");
    const blocker = failedLane
      ? [found?.blocker, "Lane rolled back; previous catalog retained"].filter(Boolean).join("; ")
      : found?.blocker ?? (found ? null : "No fresh source admission; previous catalog retained");
    return { id, kind, lane, outcome, received: found?.received, catalog, blocker };
  });
  const final = {
    publication: "not-authorized",
    permissions: "contents: read",
    brands: results.filter((row) => row.kind === "brand").length,
    marketplaces: results.filter((row) => row.kind === "marketplace").length,
    counts: {
      "tam güncellendi": results.filter((row) => row.outcome === "tam güncellendi").length,
      "kısmen güncellendi": results.filter((row) => row.outcome === "kısmen güncellendi").length,
      "eski veri korundu": results.filter((row) => row.outcome === "eski veri korundu").length,
    },
    examples,
    sources: results,
  };
  await mkdir(audit, { recursive: true });
  await writeFile(join(audit, "source-rehearsal.json"), JSON.stringify(final, null, 2));
  const lines = [
    "# Read-only live catalog rehearsal",
    "",
    `Brands: ${final.brands}; marketplaces: ${final.marketplaces}; publication: not authorized`,
    "",
    ...results.map((row) => `- ${row.id} (${row.kind}, ${row.lane}): ${row.outcome}; alınan ${row.received ?? "raporlanmadı"}; katalog ${row.catalog.before} -> ${row.catalog.after}; yeni ${row.catalog.added}; değişen ${row.catalog.changed}${row.blocker ? `; engel: ${row.blocker}` : ""}`),
    "",
    "## Örnekler",
    ...examples.map((item) => `- ${item.kind} ${item.source}: ${item.url}`),
    "",
  ];
  await writeFile(join(audit, "source-rehearsal.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

const action = process.argv[2];
if (action === "snapshot") await snapshot();
else if (action === "report") await report();
else throw new Error("Use refresh-live-rehearsal-report.ts snapshot|report");
