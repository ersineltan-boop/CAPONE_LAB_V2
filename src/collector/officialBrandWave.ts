import { parseStorefrontProductCount } from '../brands/officialShopify/storefrontCount';
import { defaultOnboardingHttp, type OnboardingHttp } from '../onboarding/http';
import type { ProbeResult } from '../onboarding/types';
import type { CollectionAttemptResult } from './collectWithFallback';
import { evaluateFootwearProduct, inferFootwearCategoryFromSignals } from './footwearGate';
import { shopifyProductToPilot } from './shopify';
import { normalizeProductImageUrls } from '../images/resolveImageQuality';
import type { FootwearCategory, PilotSourceConfig } from './types';

type RawProduct = Parameters<typeof shopifyProductToPilot>[0];
export const OFFICIAL_BRAND_WAVE = {
  coperni: { origin: 'https://coperni.com', path: '/collections/all-shoes', label: "Women's Shoes", proof: 'count' },
  'paloma-wool': { origin: 'https://palomawool.com', path: '/collections/shoes', label: "Women's Shoes", proof: 'count' },
  pazzion: { origin: 'https://www.pazzion.com', path: '/collections/shoes', label: "Women's Shoes", proof: 'count' },
  'moon-boot': { origin: 'https://www.moonboot.com', path: '/en-eu/collections/woman-fall-winter-2026', label: "Women's Shoes", proof: 'cards' },
  'pedro-miralles': { origin: 'https://pedromiralles.com', path: '/collections/ver-todo-calzado', label: "Women's Shoes", proof: 'cards' },
} as const;

export function officialWaveScope(slug: string) {
  return OFFICIAL_BRAND_WAVE[slug as keyof typeof OFFICIAL_BRAND_WAVE] ?? null;
}

/** Shopify's explicit country selector prevents IP-based market redirects. */
export function officialWaveUrl(slug: string, path: string, params: Record<string, string> = {}): string {
  const scope = officialWaveScope(slug);
  if (!scope) throw new Error('Unknown official wave source');
  const url = new URL(path, scope.origin);
  const country = ({ coperni: 'FR', pazzion: 'SG', 'moon-boot': 'DE' } as Record<string, string>)[slug];
  if (country) url.searchParams.set('country', country);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
}

/** Opaque model titles need the official product type / description, not guessed names. */
export function officialWaveProductCategory(raw: RawProduct): FootwearCategory | undefined {
  const description = (raw.body_html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().split(/[.!?]/)[0] ?? '';
  return inferFootwearCategoryFromSignals({
    title: description.replace(/\bboots\b/gi, 'boot'),
    productType: (raw.product_type ?? '').replace(/\bboots\b/gi, 'boot'),
    tags: rawTags(raw),
    handle: raw.handle.replaceAll('-', ' ').replace(/\bboots\b/gi, 'boot'),
  }) ?? undefined;
}

export function sameOfficialWaveScope(requested: string, resolved: string): boolean {
  try {
    const a = new URL(requested), b = new URL(resolved);
    if (a.protocol !== 'https:' || b.protocol !== 'https:' || a.hostname.replace(/^www\./, '') !== b.hostname.replace(/^www\./, '') || a.port !== b.port) return false;
    if (a.pathname.replace(/\/$/, '') !== b.pathname.replace(/\/$/, '')) return false;
    const keys = [...a.searchParams.keys(), ...b.searchParams.keys()];
    return keys.every(key => a.searchParams.getAll(key).join('\0') === b.searchParams.getAll(key).join('\0'));
  } catch { return false; }
}

export function parseWaveCount(html: string): number | null {
  // Pin dedicated counters before examining labels in color/size filter facets.
  const counts = [...html.matchAll(/<[^>]*\bid=["']ProductCount(?:Mobile)?["'][^>]*>\s*(\d+)\s+products?\s*</gi)]
    .map(m => Number(m[1]));
  if (counts.length) return new Set(counts).size === 1 ? counts[0]! : null;
  return parseStorefrontProductCount(html);
}

function attribute(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return m?.[2]?.replace(/&amp;/g, '&') ?? null;
}

/** Only product cards in the actual collection listing; ignore cart/recommendations. */
export function parseWaveStorefrontCards(html: string, slug: string, pageUrl: string): { handles: Set<string>; next: string | null; valid: boolean } {
  const handles = new Set<string>();
  let section: string | null = null;
  if (slug === 'moon-boot') section = html.match(/<collection-component\b[\s\S]*?<\/collection-component>/i)?.[0] ?? null;
  if (slug === 'pedro-miralles') {
    const start = html.search(/<div\b[^>]*class=["'][^"']*\bcollection-listing\b/i);
    if (start >= 0) section = html.slice(start).split(/<div\b[^>]*class=["'][^"']*\bpagination\b/i)[0] ?? null;
  }
  if (section === null) return { handles, next: null, valid: false };
  const cards = slug === 'moon-boot'
    ? [...section.matchAll(/<grid-item\b[^>]*>/gi)].map(m => attribute(m[0], 'data-url'))
    : [...section.matchAll(/<product-block\b[\s\S]*?<\/product-block>/gi)].map(m => m[0].match(/href=["']([^"']*\/products\/[^"']+)["']/i)?.[1] ?? null);
  for (const value of cards) {
    if (!value) continue;
    const url = new URL(value.replace(/&amp;/g, '&'), pageUrl);
    if (url.origin !== new URL(pageUrl).origin) return { handles, next: null, valid: false };
    const handle = url.pathname.match(/\/products\/([^/]+)$/)?.[1];
    if (handle) handles.add(handle);
  }
  let next: string | null = null;
  for (const tag of html.match(/<(?:a|link)\b[^>]*>/gi) ?? []) {
    if (attribute(tag, 'rel')?.split(/\s+/).includes('next') || attribute(tag, 'class')?.split(/\s+/).includes('pagination__next')) {
      const href = attribute(tag, 'href');
      if (href) next = new URL(href, pageUrl).href;
    }
  }
  return { handles, next, valid: true };
}

const SPANISH_FOOTWEAR: Record<string, string> = {
  BOTINES: 'Ankle Boot', BOTAS: 'Boot', 'ZAPATILLAS DEPORTIVAS': 'Sneakers',
  MULES: 'Mules', MOCASINES: 'Loafers', 'ZAPATOS DE TACÓN': 'Pumps',
  BAILARINAS: 'Ballerinas', 'SANDALIAS TACÓN': 'Sandals', 'SANDALIAS PLANAS': 'Sandals',
  'ZAPATOS PLANOS': 'Flats', CUÑAS: 'Wedges', ZUECOS: 'Clogs',
  'ZAPATOS TACÓN': 'Pumps', 'SANDALIA TACÓN': 'Sandals', 'SANDALIAS DE TACÓN': 'Sandals',
};

function rawTags(raw: RawProduct): string[] {
  return Array.isArray(raw.tags) ? raw.tags : (raw.tags ?? '').split(',').map(tag => tag.trim());
}

function pedroFootwearType(raw: RawProduct): string | undefined {
  // Flat-shoe product types are broad; use the source's explicit ballerina tag.
  if (raw.product_type?.toUpperCase().trim() === 'ZAPATOS PLANOS' && rawTags(raw).some(tag => tag.toUpperCase() === 'BAILARINAS')) return 'Ballerinas';
  if (raw.product_type?.toUpperCase().trim() === 'ZAPATOS PLANOS' && /\bmocas[ií]n\b/i.test((raw.body_html ?? '').replace(/<[^>]+>/g, ' '))) return 'Loafers';
  const direct = SPANISH_FOOTWEAR[raw.product_type?.toUpperCase().trim() ?? ''];
  if (direct) return direct;
  // Category tags are retained by the official source even when product_type is empty.
  if (raw.product_type?.trim()) return undefined;
  for (const tag of rawTags(raw)) {
    for (const [category, translated] of Object.entries(SPANISH_FOOTWEAR)) {
      if (tag.toUpperCase() === category || tag.toUpperCase().startsWith(category + ' ')) return translated;
    }
  }
  return undefined;
}

/** A Shopify video-only product can have real preview images only in its PDP schema. */
export function parseOfficialProductGallery(html: string, productUrl: string): string[] {
  const images: string[] = [];
  for (const script of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    if (attribute(script.slice(0, script.indexOf('>') + 1), 'type') !== 'application/ld+json') continue;
    let data: unknown;
    try { data = JSON.parse(script.slice(script.indexOf('>') + 1).replace(/<\/script>$/i, '')); } catch { continue; }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const product = node as Record<string, unknown>;
      if (!['Product', 'ProductGroup'].includes(String(product['@type'])) || typeof product['@id'] !== 'string') continue;
      try {
        const identity = new URL(product['@id'], productUrl); identity.hash = '';
        if (!sameOfficialWaveScope(productUrl, identity.href)) continue;
      } catch { continue; }
      const variants = Array.isArray(product.hasVariant) ? product.hasVariant : [];
      for (const item of [product, ...variants]) {
        if (!item || typeof item !== 'object') continue;
        const value = (item as Record<string, unknown>).image;
        for (const image of Array.isArray(value) ? value : [value]) {
          if (typeof image === 'string') {
            try { images.push(new URL(image, productUrl).href); } catch { /* Invalid source URL is not gallery evidence. */ }
          }
        }
      }
    }
  }
  return normalizeProductImageUrls(images);
}

function explicitExclusion(raw: RawProduct, slug: string): string | null {
  if (slug === 'pazzion' && /^kids?$/i.test(raw.product_type ?? '')) return 'kids';
  if (slug === 'pedro-miralles') {
    if (/^(?:bolsos?(?:\s.*)?|bandoleras?|cintur[oó]n|collares?|monederos?|llaveros?|velas?|accesorios)$/i.test(raw.product_type ?? '')) return 'non-footwear';
    if (!raw.product_type?.trim() && rawTags(raw).some(tag => /^(?:VER TODO ACCESORIOS|VER TODO BOLSOS)$/i.test(tag))) return 'non-footwear';
    if (raw.handle === 'rifa-01-colabora' && rawTags(raw).includes('RIFA') && /sorteo solidario/i.test(raw.body_html ?? '')) return 'non-footwear';
  }
  if (slug === 'coperni' && raw.handle === 'barreletics' && /^Barreletics x Coperni Grip Sock$/i.test(raw.title)) return 'non-footwear';
  // A conflicting word in a shoe name is not sufficient proof of an exclusion.
  const gate = evaluateFootwearProduct({ title: '', productType: raw.product_type });
  return gate.decision === 'EXCLUDE_NON_FOOTWEAR' ? 'non-footwear' : null;
}

export async function collectOfficialBrandWave(config: PilotSourceConfig, http: OnboardingHttp = defaultOnboardingHttp): Promise<CollectionAttemptResult> {
  const scope = officialWaveScope(config.id);
  if (!scope || !sameOfficialWaveScope(scope.origin, new URL(config.baseUrl).origin)) throw new Error('Unregistered official wave source');
  const rootUrl = officialWaveUrl(config.id, scope.path);
  const errors: string[] = [];
  let pagesTraversed = 0;
  const fetchScoped = async (url: string) => {
    let response = await http.fetchText(url, { delayMs: 150 });
    pagesTraversed++;
    // One bounded retry for transport/server failures; challenge responses stay blocked.
    if (response.status === 0 || [502, 503, 504].includes(response.status)) {
      response = await http.fetchText(url, { delayMs: 1000 }); pagesTraversed++;
    }
    if (!response.ok || !sameOfficialWaveScope(url, response.url)) errors.push(`WAVE_SCOPE_OR_HTTP:${url}:${response.status}:resolved=${response.url}`);
    return { ...response, ok: response.ok && sameOfficialWaveScope(url, response.url) };
  };
  const first = await fetchScoped(rootUrl);
  const sourceCount = first.ok ? parseWaveCount(first.text) : null;
  const storefrontHandles = new Set<string>();
  let storefrontExhausted = scope.proof === 'count' && sourceCount !== null;
  let firstCards: Set<string> | null = null;
  if (scope.proof === 'cards') {
    let response = first, pageUrl = rootUrl;
    for (let page = 1; page <= 80; page++) {
      if (!response.ok) break;
      const cards = parseWaveStorefrontCards(response.text, config.id, pageUrl);
      firstCards ??= cards.handles;
      if (!cards.valid || cards.handles.size === 0) { errors.push('WAVE_STOREFRONT_CARDS_MISSING'); break; }
      const before = storefrontHandles.size;
      for (const handle of cards.handles) storefrontHandles.add(handle);
      if (storefrontHandles.size === before) { errors.push('WAVE_STOREFRONT_REPEATED_PAGE'); break; }
      if (!cards.next) { storefrontExhausted = true; break; }
      const expected = new URL(rootUrl); expected.searchParams.set('page', String(page + 1));
      const next = new URL(cards.next);
      // Pagination links may omit the explicitly selected country. Carry it
      // forward, but never overwrite a conflicting country or another filter.
      const country = expected.searchParams.get('country');
      if (country && !next.searchParams.has('country')) next.searchParams.set('country', country);
      if (!sameOfficialWaveScope(expected.href, next.href)) { errors.push('WAVE_STOREFRONT_NEXT_SCOPE_CHANGED'); break; }
      pageUrl = next.href; response = await fetchScoped(pageUrl);
    }
  } else if (sourceCount === null) errors.push('WAVE_STOREFRONT_COUNT_UNKNOWN');

  const rawById = new Map<number, RawProduct>();
  let jsonExhausted = false;
  for (let page = 1; page <= 40; page++) {
    const url = officialWaveUrl(config.id, `${scope.path}/products.json`, { limit: '250', page: String(page) });
    const response = await fetchScoped(url);
    if (!response.ok) break;
    let batch: RawProduct[];
    try { batch = JSON.parse(response.text).products; } catch { errors.push('WAVE_JSON_INVALID'); break; }
    if (!Array.isArray(batch)) { errors.push('WAVE_JSON_PRODUCTS_MISSING'); break; }
    if (batch.length === 0) { jsonExhausted = true; break; }
    const before = rawById.size;
    for (const raw of batch) {
      if (!Number.isSafeInteger(raw.id) || !raw.handle || !raw.title) { errors.push('WAVE_PRODUCT_IDENTITY_MISSING'); continue; }
      const prior = rawById.get(raw.id);
      if (prior && prior.handle !== raw.handle) errors.push('WAVE_PRODUCT_IDENTITY_CHANGED');
      rawById.set(raw.id, raw);
    }
    if (rawById.size === before) { errors.push('WAVE_JSON_REPEATED_PAGE'); break; }
  }
  const handles = new Set([...rawById.values()].map(raw => raw.handle));
  if (handles.size !== rawById.size) errors.push('WAVE_DUPLICATE_HANDLE');
  const expected = scope.proof === 'count' ? sourceCount : storefrontHandles.size;
  if (expected === null || expected !== handles.size) errors.push(`WAVE_SOURCE_COUNT_MISMATCH:${handles.size}/${expected}`);
  if (scope.proof === 'cards' && (storefrontHandles.size !== handles.size || [...handles].some(handle => !storefrontHandles.has(handle)))) errors.push('WAVE_STOREFRONT_URL_IDENTITY_MISMATCH');
  const final = await fetchScoped(rootUrl);
  if (scope.proof === 'count' && (!final.ok || parseWaveCount(final.text) !== sourceCount)) errors.push('WAVE_SOURCE_TOTAL_CHANGED');
  if (scope.proof === 'cards') {
    const finalCards = parseWaveStorefrontCards(final.text, config.id, rootUrl);
    if (!final.ok || !finalCards.valid || !firstCards || finalCards.handles.size !== firstCards.size || [...firstCards].some(h => !finalCards.handles.has(h))) errors.push('WAVE_STOREFRONT_CHANGED');
  }
  const products: CollectionAttemptResult['products'] = [];
  const excluded: Array<{ url: string; reason: string; sourceType: string }> = [];
  const scopedConfig = { ...config, baseUrl: scope.origin, collectionPaths: [scope.path], verifiedFootwearPaths: [scope.path] };
  for (const original of rawById.values()) {
    let raw = original;
    const reason = explicitExclusion(raw, config.id);
    if (reason) { excluded.push({ url: `${scope.origin}/products/${raw.handle}`, reason, sourceType: raw.product_type ?? '' }); continue; }
    if (config.id === 'pedro-miralles' && !raw.images?.length) {
      const url = `${scope.origin}/products/${raw.handle}`;
      const detail = await fetchScoped(url);
      const images = detail.ok ? parseOfficialProductGallery(detail.text, url) : [];
      if (images.length) raw = { ...raw, images: images.map(src => ({ src })) };
    }
    const tags = rawTags(raw);
    const coperniType = tags.includes('BALLERINAS') ? 'Ballerinas' : tags.includes('BOOTS') ? 'Boots' : tags.includes('SANDALS/FLIPFLOPS') ? 'Sandals' : tags.includes('MOCASSINS') ? 'Loafers' : undefined;
    const translation = config.id === 'pedro-miralles' ? pedroFootwearType(raw) : config.id === 'coperni' ? coperniType : undefined;
    const category = config.id === 'paloma-wool' ? officialWaveProductCategory(raw) : undefined;
    const product = shopifyProductToPilot(translation ? { ...raw, product_type: translation } : raw, scopedConfig, new Date().toISOString(), scope.path, scope.label, category);
    if (!product || !product.images?.length) { errors.push(`WAVE_INCOMPLETE_FOOTWEAR:${raw.handle}`); continue; }
    if (translation) product.sourceProductType = `${raw.product_type} (${translation})`;
    product.sourceProductTags = tags;
    const sizeIndex = (raw.options ?? []).findIndex(option => /^(?:shoe size|size|talla)$/i.test(option.name));
    if (sizeIndex >= 0 && sizeIndex < 3) {
      product.sourceSizes = (raw.variants ?? []).flatMap(variant => {
        const size = [variant.option1, variant.option2, variant.option3][sizeIndex];
        return size ? [{ size, displaySize: size, sku: variant.sku ?? null, selectable: variant.available ?? null }] : [];
      });
    }
    // Initial delivery is a baseline, even if source tags say NEWIN.
    product.hasNewBadge = false; product.isNewArrivalsCollection = false;
    products.push(product);
  }
  const paginationExhausted = jsonExhausted && storefrontExhausted;
  if (!paginationExhausted) errors.push('WAVE_PAGINATION_NOT_EXHAUSTED');
  console.log(`[${config.id}]`, JSON.stringify({ officialScope: rootUrl, proof: scope.proof, sourceCount: expected, sourceUrls: handles.size, accepted: products.length, excluded, paginationExhausted, errors }));
  return { products, errors, method: 'custom-adapter', discoveredLinks: new Set([...rawById.values()].map(raw => `${scope.origin}/products/${raw.handle}`)),
    pagesTraversed, rawProductUrlsDiscovered: handles.size, paginationExhausted, hitCollectionCrawlCap: !paginationExhausted,
    sourceReportedProductCount: expected === null ? null : expected - excluded.length, collectionsCrawled: [scope.path] };
}

export async function probeOfficialBrandWave(slug: string, brand: string, http: OnboardingHttp): Promise<ProbeResult> {
  const scope = officialWaveScope(slug);
  if (!scope) throw new Error('Unknown official wave source');
  const url = officialWaveUrl(slug, `${scope.path}/products.json`, { limit: '8', page: '1' });
  const response = await http.fetchText(url);
  let raws: RawProduct[] = [];
  try { raws = JSON.parse(response.text).products ?? []; } catch { /* Report unavailable source. */ }
  const ready = response.ok && sameOfficialWaveScope(url, response.url) && Array.isArray(raws) && raws.length > 0;
  const products = ready ? raws.map(raw => shopifyProductToPilot(raw, { id: slug, brand, baseUrl: scope.origin, collectionPaths: [scope.path], verifiedFootwearPaths: [scope.path], maxProducts: 8 }, new Date().toISOString(), scope.path, scope.label)).filter(p => p !== null).slice(0, 5) : [];
  return { platform: 'SHOPIFY', strategy: 'shopify-public', status: ready ? 'VALIDATING' : 'PRIORITY_BLOCKED', sourceUrl: scope.origin,
    collectionPaths: [scope.path], footwearPaths: [scope.path], products: products.map(p => ({ productUrl: p.productUrl, productName: p.productName, imageUrl: p.imageUrl, images: p.images ?? [], color: p.color, sku: null, sourceCategoryName: p.sourceCategoryName ?? null })),
    blocker: ready ? null : `Official collection unavailable: HTTP ${response.status}`, notes: `Pinned official collection; ${scope.proof} proof required before FULL` };
}
