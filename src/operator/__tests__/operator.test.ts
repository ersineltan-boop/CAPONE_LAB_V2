import { describe, expect, it } from "vitest";

import { PRIMARY_NAV_ITEMS } from "../../navigation/primaryNav";
import { loadBrandRegistry } from "../../registry/data";
import { browsableMarketplaces } from "../../registry/data/marketplaces";
import { appendAuditEvent, createAuditEvent, loadAuditLog } from "../audit/log";
import { runOperatorCheck } from "../check";
import {
  assertNoMarketResearchLeak,
  assertRegistriesIsolated,
  canGroupAsColorVariants,
  canPlaceRecordOnRegistry,
  canReplaceExistingDataset,
  classifyFootwearCategory,
  collectedAtDoesNotImplyNewArrival,
  DomainIsolationError,
  evaluateApproval,
  evaluateFootwearGate,
  isSourceNewArrival,
  liveProductResearchBrandIds,
  modelsAreDistinctVersions,
  mustNotLoopEndlessly,
  nextCollectRoute,
  originCountryIsNotSalesMarket,
  preserveValidDataset,
  productionActionsDeniedByDefault,
  registriesShareUserFacingSurface,
  retainDualSourceOccurrences,
  sameBrandMayExistInBothDomains,
  visualMayDeduplicateAcrossSources,
} from "../policies";
import { createMemoryStore, emptyQueue, enqueueTask, loadQueue, saveQueue } from "../queue/store";
import { formatOperatorReport, toMachineReadableReport } from "../report/format";
import { runOperatorDryRun } from "../runner/dryRun";
import { createTaskFromTemplate, TASK_TEMPLATES } from "../templates/definitions";
import type { DomainRecord } from "../types";

describe("Operator domain isolation", () => {
  it("does not let Product Research and Market Research share a user-facing registry", () => {
    expect(registriesShareUserFacingSurface("MARKALAR", "SALES_MARKET_BRANDS")).toBe(false);
    expect(() => assertRegistriesIsolated("MARKALAR", "SALES_MARKET_BRANDS")).toThrow(
      DomainIsolationError,
    );
    expect(() => assertRegistriesIsolated("PAZARYERLERI", "PRICE_INTEL")).toThrow(
      DomainIsolationError,
    );
    expect(() => assertRegistriesIsolated("MARKALAR", "PAZARYERLERI")).not.toThrow();
  });

  it("keeps Market Research records out of Markalar and Pazaryerleri", () => {
    const marketRecord: DomainRecord = {
      id: "mr-ro-massimo-dutti",
      name: "MASSIMO DUTTI",
      domain: "MARKET_RESEARCH",
      registry: "SALES_MARKET_BRANDS",
    };
    expect(canPlaceRecordOnRegistry(marketRecord, "MARKALAR")).toBe(false);
    expect(canPlaceRecordOnRegistry(marketRecord, "PAZARYERLERI")).toBe(false);
    expect(canPlaceRecordOnRegistry(marketRecord, "SALES_MARKET_BRANDS")).toBe(true);

    const productIds = [
      ...liveProductResearchBrandIds(),
      ...browsableMarketplaces().map((entry) => entry.id),
    ];
    expect(productIds).not.toContain(marketRecord.id);
    expect(() => assertNoMarketResearchLeak(productIds, [marketRecord])).not.toThrow();
    expect(() =>
      assertNoMarketResearchLeak(productIds, [{ ...marketRecord, registry: "MARKALAR" }]),
    ).toThrow(DomainIsolationError);

    expect(PRIMARY_NAV_ITEMS.some((item) => item.label === "MARKALAR")).toBe(true);
    expect(PRIMARY_NAV_ITEMS.some((item) => /pazar araştırm/i.test(item.label))).toBe(false);
  });

  it("allows the same brand name in both domains as separate records", () => {
    const product = loadBrandRegistry().all().find((entry) => entry.brand === "ZARA");
    expect(product).toBeTruthy();
    const allowed = sameBrandMayExistInBothDomains(
      {
        id: product!.id,
        name: product!.brand,
        domain: "PRODUCT_RESEARCH",
        registry: "MARKALAR",
      },
      {
        id: "mr-ro-zara",
        name: "ZARA",
        domain: "MARKET_RESEARCH",
        registry: "SALES_MARKET_BRANDS",
      },
    );
    expect(allowed).toBe(true);
    expect(originCountryIsNotSalesMarket("ES", ["RO"])).toBe(true);
  });

  it("keeps the same product in brand and marketplace source data", () => {
    const occurrences = retainDualSourceOccurrences([
      {
        productKey: "luna",
        sourceKind: "BRAND",
        sourceId: "massimo-dutti",
        sourceUrl: "https://www.massimodutti.com/luna-black",
      },
      {
        productKey: "luna",
        sourceKind: "MARKETPLACE",
        sourceId: "farfetch",
        sourceUrl: "https://www.farfetch.com/luna-black",
      },
    ]);
    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((item) => item.sourceKind).sort()).toEqual(["BRAND", "MARKETPLACE"]);
  });

  it("allows Visual to canonicalize without dropping source provenance", () => {
    const visual = visualMayDeduplicateAcrossSources([
      {
        productKey: "luna",
        sourceKind: "BRAND",
        sourceId: "massimo-dutti",
        sourceUrl: "https://www.massimodutti.com/luna-black",
      },
      {
        productKey: "luna",
        sourceKind: "MARKETPLACE",
        sourceId: "farfetch",
        sourceUrl: "https://www.farfetch.com/luna-black",
      },
    ]);
    expect(visual.canonicalKey).toBe("visual:luna");
    expect(visual.sourceCount).toBe(2);
    expect(visual.sourcesPreserved).toHaveLength(2);
  });
});

describe("Operator onboarding quality", () => {
  it("does not treat collected today as New Arrival", () => {
    const collectedAt = "2026-09-12T12:00:00.000Z";
    expect(collectedAtDoesNotImplyNewArrival(collectedAt)).toBe(true);
    expect(
      isSourceNewArrival({
        sourceNewArrival: false,
        collectedAt,
      }),
    ).toBe(false);
    expect(
      isSourceNewArrival({
        sourceNewArrival: true,
        collectedAt,
        sourceCollection: "/noutati",
      }),
    ).toBe(true);
  });

  it("requires locale before locale-sensitive classification", () => {
    const withoutLocale = classifyFootwearCategory({
      locale: null,
      sourceCategory: "botine",
      titleName: "Botine piele",
    });
    expect(withoutLocale.status).toBe("REVIEW");
    expect(withoutLocale.category).toBeNull();
    expect(withoutLocale.reason).toMatch(/locale/i);
  });

  it("interprets Romanian evidence as Romanian and does not English-guess", () => {
    const resolved = classifyFootwearCategory({
      locale: "ro",
      sourceCategory: "Botine",
      titleName: "Botine piele neagra",
    });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.category).toBe("Bot");

    const englishGuessBlocked = classifyFootwearCategory({
      locale: "en",
      titleName: "sandale de piele",
    });
    expect(englishGuessBlocked.status).toBe("REVIEW");
    expect(englishGuessBlocked.category).toBeNull();
  });

  it("turns unresolved category into REVIEW instead of a fake class", () => {
    const decision = classifyFootwearCategory({
      locale: "ro",
      titleName: "Articol special",
    });
    expect(decision.status).toBe("REVIEW");
    expect(decision.qaState).toBe("unresolved");
    expect(decision.category).toBeNull();
    expect(decision.reason).toMatch(/Diğer/);
  });

  it("merges color variants but keeps distinct model versions separate", () => {
    expect(modelsAreDistinctVersions("LUNA", "LUNA 2")).toBe(true);
    expect(modelsAreDistinctVersions("LINDA", "LINDA I")).toBe(true);
    expect(
      canGroupAsColorVariants(
        { styleCode: "LUNA", normalizedModelName: "LUNA", color: "Black" },
        { styleCode: "LUNA", normalizedModelName: "LUNA", color: "Beige" },
      ).merge,
    ).toBe(true);
    expect(
      canGroupAsColorVariants(
        { normalizedModelName: "LUNA", color: "Black" },
        { normalizedModelName: "LUNA 2", color: "Black" },
      ).merge,
    ).toBe(false);
  });

  it("reviews uncertain non-footwear instead of deleting silently", () => {
    expect(evaluateFootwearGate({ title: "City Tote", categoryText: "Handbags" }).decision).toBe(
      "EXCLUDE",
    );
    expect(evaluateFootwearGate({ title: "Unknown item" }).decision).toBe("REVIEW");
    expect(evaluateFootwearGate({ title: "Luna loafer" }).decision).toBe("ACCEPT");
  });
});

describe("Operator approval and collect safety", () => {
  it("requires owner approval for production deploy", () => {
    expect(productionActionsDeniedByDefault()).toBe(true);
    expect(evaluateApproval("PRODUCTION_DEPLOY").allowed).toBe(false);
    expect(
      evaluateApproval("PRODUCTION_DEPLOY", {
        gates: ["PRODUCTION_DEPLOY"],
        approvedBy: "ersin",
      }).allowed,
    ).toBe(true);
  });

  it("requires owner approval for push and main mutation", () => {
    expect(evaluateApproval("PUSH").allowed).toBe(false);
    expect(evaluateApproval("WRITE_MAIN").allowed).toBe(false);
    expect(
      evaluateApproval("PUSH", { gates: ["PUSH"], approvedBy: "ersin" }).allowed,
    ).toBe(true);
    expect(
      evaluateApproval("WRITE_MAIN", { gates: ["WRITE_MAIN"], approvedBy: "ersin" }).allowed,
    ).toBe(true);
  });

  it("does not let a failed empty collect replace valid data", () => {
    const existing = { label: "massimo-dutti", productCount: 428, valid: true };
    const incoming = { label: "massimo-dutti", productCount: 0, valid: false };
    const denied = canReplaceExistingDataset(existing, incoming);
    expect(denied.allowed).toBe(false);
    expect(preserveValidDataset(existing, incoming)).toEqual(existing);
    expect(
      preserveValidDataset(existing, incoming, {
        gates: ["REPLACE_VALID_DATASET_WITH_EMPTY"],
        approvedBy: "ersin",
      }),
    ).toEqual(incoming);
  });

  it("stops after deterministic collect routes instead of looping", () => {
    const first = nextCollectRoute([], "HTTP 403 Cloudflare");
    expect(first.status).toBe("TRY_NEXT");
    const exhausted = nextCollectRoute(
      ["HTTP", "JSON_LD", "EMBEDDED_APP_STATE", "KNOWN_STOREFRONT_API", "BROWSER_COLLECTOR"],
      "Cloudflare challenge",
    );
    expect(exhausted.status).toBe("BLOCKED");
    expect(
      mustNotLoopEndlessly([
        "HTTP",
        "JSON_LD",
        "EMBEDDED_APP_STATE",
        "KNOWN_STOREFRONT_API",
        "BROWSER_COLLECTOR",
      ]),
    ).toBe(true);
  });
});

describe("Operator dry-run, queue, report", () => {
  it("plans a brand onboarding task without touching production data", () => {
    const summary = runOperatorDryRun({
      templateId: "PRODUCT_RESEARCH_BRAND_ONBOARDING",
      title: "Add Massimo Dutti to Markalar",
      locale: "ro",
      target: { name: "MASSIMO DUTTI", originCountry: "ES" },
      now: new Date("2026-09-12T12:00:00.000Z"),
      taskId: "task-massimo-dry-run",
    });
    expect(summary.domain).toBe("PRODUCT_RESEARCH");
    expect(summary.dryRun).toBe(true);
    expect(summary.productionDataModified).toBe(false);
    expect(summary.productionReady).toBe(false);
    expect(summary.steps.some((step) => step.state === "CLASSIFYING")).toBe(true);
    expect(summary.safetyGates.every((gate) => gate.defaultDecision === "DENY")).toBe(true);
    expect(summary.qaRequirements.some((item) => /Locale/.test(item))).toBe(true);
  });

  it("formats the owner-facing report and machine-readable JSON", () => {
    const summary = runOperatorDryRun({
      templateId: "PRODUCT_RESEARCH_BRAND_ONBOARDING",
      title: "Add Brand X",
      locale: "ro",
      observations: {
        discovery: "PASS",
        collector: "PASS",
        products: 428,
        models: 176,
        groupedColorVariants: 252,
        imageCoveragePercent: 99.5,
        unresolvedCategory: 4,
        nonFootwearSuspects: 1,
        tests: "PASS",
        build: "PASS",
      },
    });
    const text = formatOperatorReport(summary);
    expect(text).toContain("CAPONE OPERATOR REPORT");
    expect(text).toContain("Task: Add Brand X");
    expect(text).toContain("Domain: PRODUCT_RESEARCH");
    expect(text).toContain("Products: 428");
    expect(text).toContain("Unresolved category: 4");
    expect(text).toContain("Production ready: NO");
    const json = JSON.parse(toMachineReadableReport(summary));
    expect(json.status).toBe("REVIEW");
    expect(json.metrics.models).toBe(176);
  });

  it("keeps a local file-based queue and secret-free audit log", () => {
    const store = createMemoryStore();
    const task = createTaskFromTemplate("QA_ONLY", {
      title: "QA current Operator policies",
      now: new Date("2026-09-12T12:00:00.000Z"),
      id: "task-qa-1",
    });
    saveQueue(store, enqueueTask(emptyQueue(), task));
    expect(loadQueue(store).tasks).toHaveLength(1);
    appendAuditEvent(
      store,
      createAuditEvent("task-qa-1", "queued", "Owner asked for a QA-only dry-run", {
        fromState: "QUEUED",
        toState: "QUEUED",
      }),
    );
    const events = loadAuditLog(store);
    expect(events[0]?.why).toMatch(/QA-only/);
    expect(JSON.stringify(events)).not.toMatch(/api[_-]?key|secret|token|password/i);
  });

  it("exposes all seven safe templates and passes operator check", () => {
    expect(TASK_TEMPLATES.map((item) => item.id)).toEqual([
      "PRODUCT_RESEARCH_BRAND_ONBOARDING",
      "PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING",
      "PRODUCT_RESEARCH_REFRESH",
      "MARKET_RESEARCH_BRAND_ONBOARDING",
      "MARKET_RESEARCH_COUNTRY_REFRESH",
      "QA_ONLY",
      "PREVIEW_READY_CHECK",
    ]);
    const market = TASK_TEMPLATES.find((item) => item.id === "MARKET_RESEARCH_BRAND_ONBOARDING");
    expect(market?.writeTargets).not.toContain("MARKALAR");
    const check = runOperatorCheck();
    expect(check.ok).toBe(true);
  });
});
