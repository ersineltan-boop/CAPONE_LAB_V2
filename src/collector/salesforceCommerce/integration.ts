import { defaultOnboardingHttp, type OnboardingHttp } from '../../onboarding/http';
import type { ProbeResult } from '../../onboarding/types';
import type { CollectionAttemptResult } from '../collectWithFallback';
import type { PilotProduct, PilotSourceConfig } from '../types';
import { collectCasadeiWomensShoes, CASADEI_SCOPE, parseCasadeiMobifySearch } from './casadei';
import { collectJilSanderWomensShoes, JIL_SANDER_SCOPE, parseJilSanderResultTotal, parseJilSanderTiles } from './jilSander';
import type { SalesforceCatalog, SalesforceHttp, SalesforceScope } from './types';

export function salesforceScope(slug: string): SalesforceScope | null {
  return slug === 'casadei' ? CASADEI_SCOPE : slug === 'jil-sander' ? JIL_SANDER_SCOPE : null;
}

export function sameSalesforceRequestScope(requested: string, resolved: string): boolean {
  try {
    const a = new URL(requested), b = new URL(resolved);
    if (a.protocol !== 'https:' || b.origin !== a.origin || b.pathname.replace(/\/$/, '') !== a.pathname.replace(/\/$/, '')) return false;
    for (const [key, value] of a.searchParams) if (b.searchParams.get(key) !== value) return false;
    return [...b.searchParams.keys()].every(key => a.searchParams.has(key));
  } catch { return false; }
}

function guardedHttp(http: OnboardingHttp, scope: SalesforceScope, errors: string[]): SalesforceHttp {
  let firstTotal: number | null = null;
  return { async fetchText(url) {
    const response = await http.fetchText(url, { delayMs: 150 });
    if (!response.ok) return response;
    if (!sameSalesforceRequestScope(url, response.url)) {
      errors.push('SALESFORCE_STOREFRONT_SCOPE_CHANGED');
      return { ...response, ok: false };
    }
    const total = scope.slug === 'casadei' ? parseCasadeiMobifySearch(response.text).total :
      new URL(url).pathname === new URL(scope.collectionUrl).pathname ? parseJilSanderResultTotal(response.text) : null;
    if (total !== null) {
      if (firstTotal !== null && total !== firstTotal) errors.push('SALESFORCE_SOURCE_TOTAL_CHANGED');
      firstTotal ??= total;
    }
    return response;
  } };
}

export function salesforceCatalogToAttempt(catalog: SalesforceCatalog): CollectionAttemptResult {
  const urls = new Set(catalog.scopeProductUrls);
  const classified = [...catalog.accepted, ...catalog.quarantined].map(p => p.productUrl);
  const errors = [...catalog.errors];
  if (new Set(classified).size !== urls.size || classified.some(url => !urls.has(url))) errors.push('SALESFORCE_URL_IDENTITY_MISMATCH');
  if (catalog.status !== 'FULL') errors.push(`SALESFORCE_${catalog.status}:${catalog.blocker}`);
  const exclusions = catalog.quarantined.filter(p => p.reason === 'mens' || p.reason === 'non-footwear').length;
  const products: PilotProduct[] = catalog.accepted.map(p => ({
    source: catalog.scope.slug, brand: catalog.scope.brand, productName: p.productName,
    productUrl: p.productUrl, imageUrl: p.images[0] ?? null, images: p.images,
    category: p.category, color: p.color, material: p.material, toeShape: null,
    heelType: null, heelHeight: null, details: p.sourceDescription ?? null, discoveredAt: catalog.collectedAt,
    sourceProductType: p.category?.replaceAll('_', ' '), sourceCategoryId: p.sourceCategoryId,
    sourceCategoryName: p.sourceCategoryName, collectionPath: new URL(catalog.scope.collectionUrl).pathname,
    collectionLabel: "Women's Shoes", isNewArrivalsCollection: false, hasNewBadge: false,
    sourceModelCode: p.modelCode, sourceSizes: p.sizes, sourceHsCode: p.sourceHsCode,
    variants: [{title: p.productName, color: p.color, sku: p.sku, imageUrl: p.images[0] ?? null, images: p.images}],
  }));
  return { products, errors, method: 'custom-adapter', discoveredLinks: new Set(products.map(p => p.productUrl)),
    rawProductUrlsDiscovered: urls.size, pagesTraversed: catalog.pagesVisited.length,
    paginationExhausted: catalog.paginationExhausted, hitCollectionCrawlCap: !catalog.paginationExhausted,
    sourceReportedProductCount: catalog.sourceReportedTotal === null ? null : catalog.sourceReportedTotal - exclusions,
    collectionsCrawled: [new URL(catalog.scope.collectionUrl).pathname],
  };
}

export async function collectVerifiedSalesforceCatalog(config: PilotSourceConfig, http: OnboardingHttp = defaultOnboardingHttp): Promise<SalesforceCatalog> {
  const scope = salesforceScope(config.id);
  if (!scope || new URL(config.baseUrl).origin !== scope.officialUrl) throw new Error('Salesforce collector requires the registered official HTTPS storefront');
  const errors: string[] = [];
  const guarded = guardedHttp(http, scope, errors);
  const catalog = await (config.id === 'casadei' ? collectCasadeiWomensShoes(guarded) : collectJilSanderWomensShoes(guarded));
  const final = await guarded.fetchText(scope.collectionUrl);
  const finalTotal = config.id === 'casadei' ? parseCasadeiMobifySearch(final.text).total : parseJilSanderResultTotal(final.text);
  if (!final.ok || finalTotal === null || finalTotal !== catalog.sourceReportedTotal) errors.push('SALESFORCE_FINAL_SOURCE_COUNT_UNVERIFIED');
  if (catalog.scope.storefrontCurrency !== 'USD') errors.push('SALESFORCE_US_CURRENCY_UNVERIFIED');
  const result = salesforceCatalogToAttempt(catalog);
  result.errors.push(...errors);
  if (result.errors.length) { catalog.status = catalog.status === "FULL" ? "PARTIAL" : catalog.status; catalog.blocker ??= result.errors[0]; }
  catalog.errors = result.errors;
  console.log(`[${config.id}] ${JSON.stringify({status: catalog.status, scope: catalog.scope, sourceTotal: catalog.sourceReportedTotal,
    scopeUrls: catalog.scopeProductUrls.length, accepted: catalog.accepted.length, excluded: catalog.quarantined,
    pages: catalog.pagesVisited.length, errors: result.errors})}`);
  return catalog;
}

export async function collectOfficialSalesforce(config: PilotSourceConfig, http: OnboardingHttp = defaultOnboardingHttp): Promise<CollectionAttemptResult> {
  return salesforceCatalogToAttempt(await collectVerifiedSalesforceCatalog(config, http));
}

export async function probeOfficialSalesforce(slug: string, http: OnboardingHttp): Promise<ProbeResult | null> {
  const scope = salesforceScope(slug);
  if (!scope) return null;
  const response = await http.fetchText(scope.collectionUrl);
  const scoped = response.ok && sameSalesforceRequestScope(scope.collectionUrl, response.url);
  const total = slug === 'casadei' ? parseCasadeiMobifySearch(response.text).total : parseJilSanderResultTotal(response.text);
  const products = (slug === 'casadei' ? parseCasadeiMobifySearch(response.text).hits : parseJilSanderTiles(response.text)).slice(0, 5).map(p => ({
    productUrl: p.productUrl, productName: p.productName, imageUrl: 'images' in p ? p.images[0] ?? null : p.imageUrl,
    images: 'images' in p ? p.images : p.imageUrl ? [p.imageUrl] : [], color: null, sku: null, sourceCategoryName: 'Shoes',
  }));
  const ready = scoped && total !== null && total > 0 && products.length > 0;
  return {platform: 'SALESFORCE COMMERCE', strategy: 'salesforce-public', status: ready ? 'VALIDATING' : 'PRIORITY_BLOCKED',
    sourceUrl: scope.officialUrl, collectionPaths: [new URL(scope.collectionUrl).pathname], footwearPaths: [new URL(scope.collectionUrl).pathname],
    products: ready ? products : [], blocker: ready ? null : `Official US listing unverified: HTTP ${response.status}`, notes: `US en-us ${scope.collectionId}; source total ${total}`};
}
