import { evaluateFootwearProduct } from "./footwearGate";
import { fetchText, sleep } from "./http";
import { parseProductFieldsFromHtml } from "./parseHtmlFields";
import type { PilotProduct, PilotSourceConfig } from "./types";
import { fullModeIgnoresProductCap } from "./fullCoveragePaths";

type JsonLdNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function readType(node: JsonLdNode): string {
  const type = node["@type"];
  if (typeof type === "string") return type;
  if (Array.isArray(type) && typeof type[0] === "string") return type[0];
  return "";
}

function readImage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = readImage(item);
      if (image) return image;
    }
    return null;
  }
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

function flattenJsonLdNodes(input: unknown): JsonLdNode[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(flattenJsonLdNodes);
  if (typeof input !== "object") return [];

  const node = input as JsonLdNode;
  const graph = asArray(node["@graph"]);
  if (graph.length > 0) return graph.flatMap(flattenJsonLdNodes);

  const nodes = [node];
  if (typeof node["@id"] === "string") nodes.push(node);
  return nodes;
}

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      continue;
    }
  }

  return blocks;
}

function extractProductsFromNodes(nodes: JsonLdNode[]): JsonLdNode[] {
  const products: JsonLdNode[] = [];

  for (const node of nodes) {
    const type = readType(node);
    if (type === "Product") {
      products.push(node);
      continue;
    }

    if (type === "ItemList") {
      for (const item of asArray(node.itemListElement as JsonLdNode[] | undefined)) {
        const nested = item.item as JsonLdNode | undefined;
        if (nested && readType(nested) === "Product") products.push(nested);
      }
    }
  }

  return products;
}

function schemaProductToPilot(
  node: JsonLdNode,
  config: PilotSourceConfig,
  discoveredAt: string,
  fallbackUrl?: string,
): PilotProduct | null {
  const title = typeof node.name === "string" ? node.name : null;
  const url =
    (typeof node.url === "string" ? node.url : null) ??
    fallbackUrl ??
    null;

  if (!title || !url) return null;

  const handle = url.split("/products/")[1]?.split(/[?#]/)[0] ?? "";
  const tags: string[] = [];
  const productType =
    typeof node.category === "string"
      ? node.category
      : typeof node.productID === "string"
        ? node.productID
        : "";

  const gate = evaluateFootwearProduct({
    title,
    productType,
    tags,
    handle,
  });

  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) return null;

  const category = gate.category;

  const description =
    typeof node.description === "string" ? node.description : "";
  const parsed = parseProductFieldsFromHtml(description);
  const color =
    (typeof node.color === "string" ? node.color : null) ??
    parsed.color;

  return {
    source: config.id,
    brand: config.brand,
    productName: title,
    productUrl: url.split("?")[0].replace(/\/$/, ""),
    imageUrl: readImage(node.image),
    category,
    color,
    material:
      (typeof node.material === "string" ? node.material : null) ??
      parsed.material,
    toeShape: parsed.toeShape,
    heelType: parsed.heelType,
    heelHeight: parsed.heelHeight,
    details: parsed.details,
    discoveredAt,
    variants: [],
  };
}

export function mapSchemaProducts(
  html: string,
  config: PilotSourceConfig,
  discoveredAt: string,
  fallbackUrl?: string,
): PilotProduct[] {
  const products: PilotProduct[] = [];
  const seen = new Set<string>();

  for (const block of extractJsonLdBlocks(html)) {
    const nodes = flattenJsonLdNodes(block);
    for (const node of extractProductsFromNodes(nodes)) {
      const mapped = schemaProductToPilot(node, config, discoveredAt, fallbackUrl);
      if (!mapped) continue;
      const key = mapped.productUrl.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(mapped);
    }
  }

  return products;
}

export async function collectSchemaOrgProducts(
  config: PilotSourceConfig,
  collectionPaths: string[],
): Promise<{
  products: PilotProduct[];
  discoveredLinks: Set<string>;
  errors: string[];
}> {
  const discoveredLinks = new Set<string>();
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const discoveredAt = new Date().toISOString();
  const seen = new Set<string>();

  const ignoreProductCap = fullModeIgnoresProductCap(config.collectMode);

  for (const collectionPath of collectionPaths) {
    if (!ignoreProductCap && products.length >= config.maxProducts) break;

    const url = `${config.baseUrl.replace(/\/$/, "")}${collectionPath}`;
    const result = await fetchText(url, { delayMs: 1400 });
    if (!result.ok) {
      errors.push(`HTTP ${result.status} for ${url}`);
      continue;
    }

    const mapped = mapSchemaProducts(result.text, config, discoveredAt, url);
    for (const product of mapped) {
      discoveredLinks.add(product.productUrl);
      if (seen.has(product.productUrl)) continue;
      if (!ignoreProductCap && products.length >= config.maxProducts) break;
      seen.add(product.productUrl);
      products.push(product);
    }

    await sleep(1000);
  }

  return { products, discoveredLinks, errors };
}

export async function parseProductPageSchema(
  productUrl: string,
  config: PilotSourceConfig,
  discoveredAt: string,
): Promise<PilotProduct | null> {
  const result = await fetchText(productUrl, { delayMs: 1300 });
  if (!result.ok) return null;

  const mapped = mapSchemaProducts(result.text, config, discoveredAt, productUrl);
  if (mapped[0]) return mapped[0];

  const titleMatch = result.text.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  const imageMatch = result.text.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  );
  const title = titleMatch?.[1]?.trim();
  if (!title) return null;

  const handle = productUrl.split("/products/")[1]?.split(/[?#]/)[0] ?? "";
  const gate = evaluateFootwearProduct({
    title,
    productType: "",
    tags: [],
    handle,
  });
  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) return null;

  const category = gate.category;

  const parsed = parseProductFieldsFromHtml(result.text);
  return {
    source: config.id,
    brand: config.brand,
    productName: title,
    productUrl: productUrl.split("?")[0].replace(/\/$/, ""),
    imageUrl: imageMatch?.[1] ?? null,
    category,
    color: parsed.color,
    material: parsed.material,
    toeShape: parsed.toeShape,
    heelType: parsed.heelType,
    heelHeight: parsed.heelHeight,
    details: parsed.details,
    discoveredAt,
    variants: [],
  };
}
