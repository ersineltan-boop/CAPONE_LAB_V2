import type { BrandRegistryEntry } from "../types/brand";
import type { RegistryValidationError } from "../types";
import {
  BRAND_ROLES,
  BRAND_SEGMENTS,
  CLASSIFICATION_STATUSES,
  COLLECTION_STATUSES,
  COLLECTOR_TYPES,
  TRACKING_PRIORITIES,
} from "../types/brand";
import { isInRange, isNonEmptyString } from "./common";

export function validateBrandEntry(
  entry: BrandRegistryEntry,
): RegistryValidationError[] {
  const errors: RegistryValidationError[] = [];

  if (!isNonEmptyString(entry.id)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: "Marka id boş olamaz",
      id: entry.id,
    });
  }

  if (!isNonEmptyString(entry.brand)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Marka adı boş olamaz (${entry.id})`,
      id: entry.id,
    });
  }

  if (!BRAND_SEGMENTS.includes(entry.segment)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz segment: ${entry.segment} (${entry.id})`,
      id: entry.id,
    });
  }

  if (!BRAND_ROLES.includes(entry.role)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz role: ${entry.role} (${entry.id})`,
      id: entry.id,
    });
  }

  if (!TRACKING_PRIORITIES.includes(entry.trackingPriority)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz trackingPriority: ${entry.trackingPriority} (${entry.id})`,
      id: entry.id,
    });
  }

  if (!COLLECTOR_TYPES.includes(entry.collectorType)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz collectorType: ${entry.collectorType} (${entry.id})`,
      id: entry.id,
    });
  }

  if (!COLLECTION_STATUSES.includes(entry.collectionStatus)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz collectionStatus: ${entry.collectionStatus} (${entry.id})`,
      id: entry.id,
    });
  }

  if (!Number.isFinite(entry.productLimit) || entry.productLimit <= 0) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `productLimit pozitif olmalı (${entry.id})`,
      id: entry.id,
    });
  }

  if (!Array.isArray(entry.collectionPaths)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `collectionPaths dizi olmalı (${entry.id})`,
      id: entry.id,
    });
  }

  for (const field of [
    "footwearInfluence",
    "directionalInfluence",
    "commercialInfluence",
  ] as const) {
    if (!isInRange(entry[field], 0, 100)) {
      errors.push({
        code: "INVALID_INFLUENCE",
        message: `${field} 0–100 arasında olmalı (${entry.id})`,
        id: entry.id,
      });
    }
  }

  if (!Array.isArray(entry.discoverySources)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `discoverySources dizi olmalı (${entry.id})`,
      id: entry.id,
    });
  }

  if (!CLASSIFICATION_STATUSES.includes(entry.classificationStatus)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz classificationStatus: ${entry.classificationStatus} (${entry.id})`,
      id: entry.id,
    });
  }

  if (typeof entry.radarEligible !== "boolean") {
    errors.push({
      code: "INVALID_ENTRY",
      message: `radarEligible boolean olmalı (${entry.id})`,
      id: entry.id,
    });
  }

  return errors;
}

export function validateBrandEntries(
  entries: readonly BrandRegistryEntry[],
): RegistryValidationError[] {
  const errors: RegistryValidationError[] = [];

  for (const entry of entries) {
    errors.push(...validateBrandEntry(entry));
  }

  const ids = entries.map((e) => e.id.trim());
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push({
        code: "DUPLICATE_ID",
        message: `Yinelenen marka id: ${id}`,
        id,
      });
    }
    seen.add(id);
  }

  return errors;
}
