import { readFile } from "node:fs/promises";
import type { ProductDateEnrichmentSidecar } from "./types";

export async function loadProductDateEnrichment(
  path: string,
): Promise<ProductDateEnrichmentSidecar> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as ProductDateEnrichmentSidecar;
  } catch {
    return {};
  }
}
