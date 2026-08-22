import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { PilotProduct } from "../collector/types";
import { stagingDirForBrand } from "./policy";
import type { ProbeResult } from "./types";
import type { QualityGateResult } from "./validate";

export interface StagingPayload {
  slug: string;
  brand: string;
  probedAt: string;
  probe: ProbeResult;
  products: PilotProduct[];
  quality?: QualityGateResult;
}

export async function writeStaging(
  root: string,
  payload: StagingPayload,
): Promise<string> {
  const dir = join(root, stagingDirForBrand(payload.slug));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "probe.json"), JSON.stringify(payload.probe, null, 2), "utf-8");
  await writeFile(join(dir, "products.json"), JSON.stringify(payload.products, null, 2), "utf-8");
  if (payload.quality) {
    await writeFile(join(dir, "quality.json"), JSON.stringify(payload.quality, null, 2), "utf-8");
  }
  return dir;
}

export async function cleanupStaging(root: string, slug?: string): Promise<void> {
  const target = slug ? join(root, stagingDirForBrand(slug)) : join(root, "data/onboarding/staging");
  await rm(target, { recursive: true, force: true });
}

export function probeSamplesToPilotProducts(input: {
  slug: string;
  brand: string;
  probe: ProbeResult;
}): PilotProduct[] {
  const discoveredAt = new Date().toISOString();
  return input.probe.products.map((sample) => ({
    source: input.slug,
    brand: input.brand,
    productName: sample.productName,
    productUrl: sample.productUrl,
    imageUrl: sample.imageUrl,
    images: sample.images,
    category: null,
    color: sample.color,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt,
    collectionPath: input.probe.footwearPaths[0] ?? null,
    sourceCategoryName: sample.sourceCategoryName,
    variants: [
      {
        title: sample.productName,
        color: sample.color,
        sku: sample.sku,
        imageUrl: sample.imageUrl,
        images: sample.images,
      },
    ],
  }));
}
