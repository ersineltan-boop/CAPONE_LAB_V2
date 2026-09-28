import { extractJsonLdBlocks } from '../collector/schemaOrg';
import { evaluateFootwearProduct } from '../collector/footwearGate';
import type { PilotProduct } from '../collector/types';

type Node = Record<string, unknown>;
const text = (value: unknown): string => typeof value === 'string' ? value : '';
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object') return [];
  const node = value as Node;
  return node['@graph'] ? nodes(node['@graph']) : [node];
}
function hasType(node: Node, type: string): boolean {
  return (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).includes(type);
}
function absolute(value: unknown, base: string): string | null {
  try { const url = new URL(text(value), base); return text(value) && /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
}
/** ProductGroup pages must stay one colour/model record, never one card per size. */
export function parseLuxuryStructuredPage(html: string, input: {
  source: string; brand: string; productUrl: string; discoveredAt: string;
}): PilotProduct[] {
  const all = extractJsonLdBlocks(html).flatMap(nodes);
  const breadcrumbs = all.filter(n => hasType(n, 'BreadcrumbList')).flatMap(n => nodes(n.itemListElement));
  const labels = breadcrumbs.map(n => text(n.name) || text((n.item as Node)?.name));
  const paths = breadcrumbs.map(n => typeof n.item === 'string' ? n.item : text((n.item as Node)?.['@id']));
  const breadcrumbEvidence = [...labels, ...paths].join(' ');
  const groups = all.filter(n => hasType(n, 'ProductGroup'));
  const candidates = groups.length ? groups : all.filter(n => hasType(n, 'Product'));
  return candidates.flatMap(node => {
    const audience = text((node.audience as Node)?.audienceType);
    if (/\bmen\b|\bmale\b/i.test(breadcrumbEvidence + ' ' + audience)) return [];
    if (!/\bwomen\b|\bwoman\b|\bfemale\b/i.test(breadcrumbEvidence + ' ' + audience)) return [];
    const name = text(node.name);
    const gate = evaluateFootwearProduct({ title: name, productType: labels.join(' '), handle: input.productUrl });
    if (gate.decision !== 'ACCEPT_FOOTWEAR' || !gate.category) return [];
    const images = (Array.isArray(node.image) ? node.image : [node.image]).map(i => absolute(i, input.productUrl)).filter((i): i is string => !!i);
    const productUrl = absolute(node.url || input.productUrl, input.productUrl);
    if (!name || !images.length || !productUrl || new URL(productUrl).origin !== new URL(input.productUrl).origin) return [];
    const companion = all.find(n => hasType(n, 'Product') && text(n.name) === name);
    const color = text(node.color) || text(companion?.color) || null;
    return [{ source: input.source, brand: input.brand, productName: name,
      productUrl: productUrl.split(/[?#]/)[0], imageUrl: images[0], images,
      category: gate.category, color, material: text(node.material) || null,
      toeShape: null, heelType: null, heelHeight: null, details: text(node.description) || null,
      discoveredAt: input.discoveredAt, sourceCategoryName: labels.at(-1) || null,
      sourceCategoryPath: labels.join(' > '), sourceCategoryUrl: absolute(paths.at(-1), input.productUrl),
      variants: [{ title: name, color, sku: text(node.productGroupID) || text(node.sku) || null, imageUrl: images[0], images }],
    }];
  });
}
