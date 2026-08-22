import {
  BRAND_ROLES,
  BRAND_SEGMENTS,
  CLASSIFICATION_STATUSES,
  COLLECTION_STATUSES,
  COLLECTOR_TYPES,
  TRACKING_PRIORITIES,
} from "../types/brand";
import { isValidHttpUrl, normalizeBrandName, normalizeOfficialUrl } from "./normalize";
import type { BrandUniverseEntry, BrandUniverseValidationIssue } from "./types";

export function validateBrandUniverseEntries(
  entries: BrandUniverseEntry[],
): BrandUniverseValidationIssue[] {
  const issues: BrandUniverseValidationIssue[] = [];
  const seenIds = new Map<string, string>();
  const seenNames = new Map<string, string>();
  const seenUrls = new Map<string, string>();

  for (const entry of entries) {
    const id = entry.id?.trim();
    const brand = entry.brand?.trim();

    if (!brand) {
      issues.push({
        level: "error",
        code: "MISSING_BRAND",
        message: "Marka adı (brand) zorunlu",
        brandId: id,
      });
    }

    if (!id) {
      issues.push({
        level: "error",
        code: "MISSING_ID",
        message: `Normalize edilmiş brand id zorunlu (${brand ?? "?"})`,
      });
      continue;
    }

    if (!entry.officialUrl?.trim()) {
      issues.push({
        level: "error",
        code: "MISSING_URL",
        message: "officialUrl zorunlu",
        brandId: id,
      });
    } else if (!isValidHttpUrl(entry.officialUrl)) {
      issues.push({
        level: "error",
        code: "INVALID_URL",
        message: `Geçersiz officialUrl: ${entry.officialUrl}`,
        brandId: id,
      });
    }

    if (!entry.country?.trim()) {
      issues.push({
        level: "error",
        code: "MISSING_COUNTRY",
        message: "country zorunlu",
        brandId: id,
      });
    }

    if (!BRAND_SEGMENTS.includes(entry.segment)) {
      issues.push({
        level: "error",
        code: "INVALID_SEGMENT",
        message: `Geçersiz segment: ${entry.segment}`,
        brandId: id,
      });
    }

    if (!BRAND_ROLES.includes(entry.influenceRole)) {
      issues.push({
        level: "error",
        code: "INVALID_ROLE",
        message: `Geçersiz influenceRole: ${entry.influenceRole}`,
        brandId: id,
      });
    }

    if (!TRACKING_PRIORITIES.includes(entry.trackingPriority)) {
      issues.push({
        level: "error",
        code: "INVALID_PRIORITY",
        message: `Geçersiz trackingPriority: ${entry.trackingPriority}`,
        brandId: id,
      });
    }

    if (!COLLECTOR_TYPES.includes(entry.collectorType)) {
      issues.push({
        level: "error",
        code: "INVALID_COLLECTOR_TYPE",
        message: `Geçersiz collectorType: ${entry.collectorType}`,
        brandId: id,
      });
    }

    if (!COLLECTION_STATUSES.includes(entry.collectionStatus)) {
      issues.push({
        level: "error",
        code: "INVALID_COLLECTION_STATUS",
        message: `Geçersiz collectionStatus: ${entry.collectionStatus}`,
        brandId: id,
      });
    }

    if (!CLASSIFICATION_STATUSES.includes(entry.classificationStatus)) {
      issues.push({
        level: "error",
        code: "INVALID_CLASSIFICATION_STATUS",
        message: `Geçersiz classificationStatus: ${entry.classificationStatus}`,
        brandId: id,
      });
    }

    if (entry.classificationStatus === "UNREVIEWED" && entry.radarEligible) {
      issues.push({
        level: "error",
        code: "UNREVIEWED_RADAR_ELIGIBLE",
        message: "UNREVIEWED marka radarEligible=true olamaz",
        brandId: id,
      });
    }

    if (
      entry.classificationStatus === "UNREVIEWED" &&
      (entry.segment !== "UNCLASSIFIED" || entry.influenceRole !== "UNCLASSIFIED")
    ) {
      issues.push({
        level: "error",
        code: "UNREVIEWED_MUST_BE_UNCLASSIFIED",
        message: "UNREVIEWED markalar segment/influenceRole UNCLASSIFIED olmalı",
        brandId: id,
      });
    }

    if (entry.sourceType !== "BRAND") {
      issues.push({
        level: "error",
        code: "INVALID_SOURCE_TYPE",
        message: `sourceType yalnızca BRAND olabilir (${entry.sourceType})`,
        brandId: id,
      });
    }

    if (entry.womenFootwearRelevant === false) {
      issues.push({
        level: "warning",
        code: "NOT_WOMEN_FOOTWEAR",
        message: "womenFootwearRelevant=false — registry dışı bırakılabilir",
        brandId: id,
      });
    }

    if (seenIds.has(id)) {
      issues.push({
        level: "error",
        code: "DUPLICATE_ID",
        message: `Yinelenen brand id: ${id} (${seenIds.get(id)} ile çakışıyor)`,
        brandId: id,
      });
    } else {
      seenIds.set(id, brand ?? id);
    }

    if (brand) {
      const normalizedName = normalizeBrandName(brand);
      if (seenNames.has(normalizedName)) {
        issues.push({
          level: "error",
          code: "DUPLICATE_BRAND",
          message: `Yinelenen marka adı: ${brand} (${seenNames.get(normalizedName)} ile çakışıyor)`,
          brandId: id,
        });
      } else {
        seenNames.set(normalizedName, id);
      }
    }

    if (entry.officialUrl?.trim()) {
      const normalizedUrl = normalizeOfficialUrl(entry.officialUrl);
      if (seenUrls.has(normalizedUrl)) {
        issues.push({
          level: "warning",
          code: "DUPLICATE_URL",
          message: `Yinelenen officialUrl: ${entry.officialUrl} (${seenUrls.get(normalizedUrl)} ile aynı)`,
          brandId: id,
        });
      } else {
        seenUrls.set(normalizedUrl, id);
      }
    }
  }

  return issues;
}

export function hasBlockingValidationErrors(
  issues: BrandUniverseValidationIssue[],
): boolean {
  return issues.some((issue) => issue.level === "error");
}
