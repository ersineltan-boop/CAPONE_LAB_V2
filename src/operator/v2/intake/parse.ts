import type { ParsedIntent, V2TemplateId } from "../types";

const SHELL_INJECTION =
  /(?:[;&|`]|\$\(|&&|\|\||>>?|git\s+push|git\s+reset|rm\s+-rf|curl\s+|wget\s+|Invoke-Expression)/i;

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSuffixes(name: string): string {
  return name
    .replace(/\s+(markas[ıi]n[ıi]|markas[ıi]|ürünlerini|ürünleri|kaynağ[ıi]n[ıi])$/i, "")
    .replace(/[''](?:y[iı]|i|ı)$/i, "")
    .trim();
}

function intent(
  partial: Omit<ParsedIntent, "ownerApprovalRequired">,
): ParsedIntent {
  return { ...partial, ownerApprovalRequired: true };
}

function review(reason: string, extras: Partial<ParsedIntent> = {}): ParsedIntent {
  return intent({
    template: extras.template ?? "AMBIGUOUS_REVIEW",
    domain: extras.domain ?? null,
    targetType: extras.targetType ?? "UNKNOWN",
    targetName: extras.targetName ?? null,
    destination: extras.destination ?? null,
    salesMarket: extras.salesMarket ?? null,
    sourceUrls: extras.sourceUrls ?? [],
    ambiguous: true,
    injectionAttempt: extras.injectionAttempt ?? false,
    reason,
  });
}

function resolved(
  template: V2TemplateId,
  fields: Omit<ParsedIntent, "template" | "ownerApprovalRequired" | "ambiguous" | "injectionAttempt" | "reason"> & {
    reason: string;
  },
): ParsedIntent {
  return intent({
    template,
    ambiguous: false,
    injectionAttempt: false,
    sourceUrls: fields.sourceUrls,
    domain: fields.domain,
    targetType: fields.targetType,
    targetName: fields.targetName,
    destination: fields.destination,
    salesMarket: fields.salesMarket,
    reason: fields.reason,
  });
}

function extractQuoted(text: string): string | null {
  const match = text.match(/"([^"]+)"|'([^']+)'/);
  return match?.[1] ?? match?.[2] ?? null;
}

function salesMarketFromText(text: string): string | null {
  if (/\bromanya\b|\bromania\b|\bro\b/i.test(text)) return "RO";
  const iso = text.match(/\bmarket(?:\s+country)?\s*[:=]\s*([A-Z]{2})\b/);
  return iso?.[1] ?? null;
}

export function containsShellInjection(text: string): boolean {
  return SHELL_INJECTION.test(text);
}

export function parseOperatorIntake(rawInstruction: string): ParsedIntent {
  const original = normalize(rawInstruction);
  if (!original) {
    return review("Empty instruction — do not guess");
  }

  if (containsShellInjection(original)) {
    return review("Task text contains a shell/command injection attempt — never executed", {
      injectionAttempt: true,
      template: "AMBIGUOUS_REVIEW",
    });
  }

  const text = original.toLowerCase();
  const quoted = extractQuoted(original);

  const marketDomain =
    /pazar araştırm|market research|satış pazar|sales[- ]market|ülke pazar|price(?:\/|\s+)?status|fiyat/.test(
      text,
    );
  const productDomain =
    /markalar|pazaryer|visual|ürün araştırm|product research|new arrival|yeni gelen|yeni ürün|kategori ve görsel/.test(
      text,
    );

  if (marketDomain && productDomain && /markalar/.test(text) && /pazar araştırm/.test(text)) {
    return review("Instruction mixes Product Research and Market Research — REVIEW, do not guess");
  }

  const romaniaMarketAdd = original.match(
    /(?:romanya|romania|ro)\s+pazar araştırmas[ıi]na\s+(.+?)(?:\s+markas|\s+ekle|$)/i,
  );
  if (romaniaMarketAdd || (/pazar araştırm/.test(text) && /ekle/.test(text) && !/markalar/.test(text))) {
    const name = stripSuffixes(
      romaniaMarketAdd?.[1] ??
        original.match(/pazar araştırmas[ıi]na\s+(.+?)(?:\s+markas|\s+ekle|$)/i)?.[1] ??
        quoted ??
        "",
    );
    if (!name) {
      return review("Market Research add requested but brand name is missing", {
        domain: "MARKET_RESEARCH",
        destination: "SALES_MARKET_BRANDS",
        salesMarket: salesMarketFromText(text),
      });
    }
    return resolved("MARKET_RESEARCH_BRAND_ONBOARDING", {
      domain: "MARKET_RESEARCH",
      targetType: "BRAND",
      targetName: name,
      destination: "SALES_MARKET_BRANDS",
      salesMarket: salesMarketFromText(text),
      sourceUrls: [],
      reason: "Add brand to a sales-market registry, not Markalar",
    });
  }

  if (/pazar araştırm/.test(text) && /(yenile|refresh|güncelle)/.test(text) && /(ülke|country|romanya|romania)/.test(text)) {
    return resolved("MARKET_RESEARCH_COUNTRY_REFRESH", {
      domain: "MARKET_RESEARCH",
      targetType: "COUNTRY",
      targetName: salesMarketFromText(text) === "RO" ? "Romanya" : "sales market",
      destination: "COUNTRY_MARKETS",
      salesMarket: salesMarketFromText(text),
      sourceUrls: [],
      reason: "Refresh a sales-market country",
    });
  }

  if (/pazar araştırm/.test(text) && /(yenile|refresh|güncelle)/.test(text)) {
    const name = stripSuffixes(
      original.match(/(?:marka(?:s[ıi])?)\s+(.+)$/i)?.[1] ??
        original.match(/^(.+?)\s+(?:pazar|market)/i)?.[1] ??
        quoted ??
        "",
    );
    return resolved("MARKET_RESEARCH_BRAND_REFRESH", {
      domain: "MARKET_RESEARCH",
      targetType: "BRAND",
      targetName: name || null,
      destination: "SALES_MARKET_BRANDS",
      salesMarket: salesMarketFromText(text),
      sourceUrls: [],
      reason: "Refresh a Market Research brand record",
    });
  }

  if (/(fiyat|price).*(araştır|research|status)|price\/status/.test(text) && !/markalar/.test(text)) {
    return resolved("MARKET_RESEARCH_PRICE_STATUS", {
      domain: "MARKET_RESEARCH",
      targetType: salesMarketFromText(text) ? "COUNTRY" : "BRAND",
      targetName: quoted ?? (salesMarketFromText(text) === "RO" ? "Romanya" : null),
      destination: "PRICE_INTEL",
      salesMarket: salesMarketFromText(text),
      sourceUrls: [],
      reason: "Price/status research stays in Market Research",
    });
  }

  if (/visual/.test(text) && /(dedupe|tekilleştir|kanonik|canonical)/.test(text)) {
    return resolved("PRODUCT_RESEARCH_VISUAL_DEDUPE_QA", {
      domain: "PRODUCT_RESEARCH",
      targetType: "VISUAL",
      targetName: quoted ?? "Visual",
      destination: "VISUAL",
      salesMarket: null,
      sourceUrls: [],
      reason: "Visual dedupe QA — marketplace provenance must remain",
    });
  }

  if (
    /(new arrival|yeni gelen|yeni ürün)/.test(text) &&
    /(kontrol|check|qa|doğrula)/.test(text)
  ) {
    return resolved("PRODUCT_RESEARCH_NEW_ARRIVALS_QA", {
      domain: "PRODUCT_RESEARCH",
      targetType: "NEW_ARRIVALS",
      targetName: quoted ?? ( /pazaryer/.test(text) ? "Pazaryerleri" : "New Arrivals"),
      destination: "NEW_ARRIVALS",
      salesMarket: null,
      sourceUrls: [],
      reason: "New Arrivals QA uses source evidence, not collectedAt",
    });
  }

  if (/(kategori ve görsel|catalog qa|katalog qa|görselleri qa)/.test(text)) {
    return resolved("PRODUCT_RESEARCH_CATALOG_QA", {
      domain: "PRODUCT_RESEARCH",
      targetType: "CATALOG",
      targetName: quoted ?? "Catalog",
      destination: "QA",
      salesMarket: null,
      sourceUrls: [],
      reason: "Catalog QA for categories and images",
    });
  }

  const markalarAdd =
    original.match(/^(.+?)\s+markalar['']?a\s+ekle/i) ??
    original.match(/add\s+(.+?)\s+to\s+markalar/i);
  if (markalarAdd || (/markalar/.test(text) && /(ekle|add)/.test(text) && !/pazar araştırm/.test(text))) {
    const name = stripSuffixes(markalarAdd?.[1] ?? quoted ?? "");
    if (!name) {
      return review("Markalar add requested but brand name is missing", {
        domain: "PRODUCT_RESEARCH",
        destination: "MARKALAR",
      });
    }
    return resolved("PRODUCT_RESEARCH_BRAND_ONBOARDING", {
      domain: "PRODUCT_RESEARCH",
      targetType: "BRAND",
      targetName: name,
      destination: "MARKALAR",
      salesMarket: null,
      sourceUrls: [],
      reason: "Add official brand to Product Research Markalar",
    });
  }

  const marketplaceAdd = original.match(/^(.+?)\s+pazaryer/i);
  if ((/pazaryer/.test(text) && /ekle/.test(text)) || /add .+ to pazaryer/i.test(original)) {
    const name = stripSuffixes(marketplaceAdd?.[1] ?? quoted ?? "");
    if (!name) {
      return review("Pazaryerleri add requested but marketplace name is missing", {
        domain: "PRODUCT_RESEARCH",
        destination: "PAZARYERLERI",
      });
    }
    return resolved("PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING", {
      domain: "PRODUCT_RESEARCH",
      targetType: "MARKETPLACE",
      targetName: name,
      destination: "PAZARYERLERI",
      salesMarket: null,
      sourceUrls: [],
      reason: "Add marketplace to Product Research Pazaryerleri",
    });
  }

  if (/(güncelle|yenile|refresh)/.test(text) && /pazaryer/.test(text)) {
    const name = stripSuffixes(
      original.match(/^(.+?)\s+(?:ürün|pazaryer)/i)?.[1] ?? quoted ?? "Pazaryerleri",
    );
    return resolved("PRODUCT_RESEARCH_REFRESH", {
      domain: "PRODUCT_RESEARCH",
      targetType: "MARKETPLACE",
      targetName: name,
      destination: "PAZARYERLERI",
      salesMarket: null,
      sourceUrls: [],
      reason: "Refresh an existing Product Research marketplace source",
    });
  }

  if (/(güncelle|yenile|refresh)/.test(text) && !/pazar araştırm/.test(text)) {
    const name = stripSuffixes(
      original.match(/^(.+?)\s+(?:ürünlerini|ürünleri|kaynağ|marka|güncelle|yenile|refresh)/i)?.[1] ??
        quoted ??
        "",
    );
    if (!name) {
      return review("Refresh requested but target name is missing", {
        domain: "PRODUCT_RESEARCH",
      });
    }
    return resolved("PRODUCT_RESEARCH_REFRESH", {
      domain: "PRODUCT_RESEARCH",
      targetType: /pazaryer|free people|farfetch|mytheresa|level shoes/i.test(name)
        ? "MARKETPLACE"
        : "BRAND",
      targetName: name,
      destination: /pazaryer|free people|farfetch|mytheresa|level shoes/i.test(name)
        ? "PAZARYERLERI"
        : "MARKALAR",
      salesMarket: null,
      sourceUrls: [],
      reason: "Refresh an existing Product Research source",
    });
  }

  if (/qa/.test(text) && !marketDomain) {
    return resolved("QA_ONLY", {
      domain: "QA",
      targetType: "CATALOG",
      targetName: quoted ?? "QA",
      destination: "QA",
      salesMarket: null,
      sourceUrls: [],
      reason: "QA-only Operator check",
    });
  }

  return review("Ambiguous instruction — REVIEW, do not guess domain or destination");
}
