import type { TrendSourceRegistryEntry } from "../types/source";
import type { RegistryValidationError } from "../types";
import {
  PRODUCTION_LAYER,
  PRODUCTION_SIGNAL_ROLE,
  SOURCE_ACCESS_MODES,
  SOURCE_LAYERS,
  SOURCE_ROLES,
} from "../types/source";
import { isInRange, isNonEmptyString } from "./common";

export function validateSourceEntry(
  entry: TrendSourceRegistryEntry,
): RegistryValidationError[] {
  const errors: RegistryValidationError[] = [];

  if (!isNonEmptyString(entry.id)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: "Kaynak id boş olamaz",
      id: entry.id,
    });
  }

  if (!isNonEmptyString(entry.name)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Kaynak adı boş olamaz (${entry.id})`,
      id: entry.id,
    });
  }

  if (!SOURCE_LAYERS.includes(entry.layer)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz layer: ${entry.layer} (${entry.id})`,
      id: entry.id,
    });
  }

  if (!SOURCE_ROLES.includes(entry.role)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz role: ${entry.role} (${entry.id})`,
      id: entry.id,
    });
  }

  if (!SOURCE_ACCESS_MODES.includes(entry.accessMode)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `Geçersiz accessMode: ${entry.accessMode} (${entry.id})`,
      id: entry.id,
    });
  }

  if (!isInRange(entry.weight, 0, 1)) {
    errors.push({
      code: "INVALID_WEIGHT",
      message: `weight 0–1 arasında olmalı (${entry.id})`,
      id: entry.id,
    });
  }

  if (!isNonEmptyString(entry.refreshCadence)) {
    errors.push({
      code: "INVALID_ENTRY",
      message: `refreshCadence boş olamaz (${entry.id})`,
      id: entry.id,
    });
  }

  const isProductionLayer = entry.layer === PRODUCTION_LAYER;
  const isProductionRole = entry.role === PRODUCTION_SIGNAL_ROLE;

  if (isProductionLayer !== isProductionRole) {
    errors.push({
      code: "PRODUCTION_LAYER_MISMATCH",
      message:
        `PRODUCTION layer yalnızca PRODUCTION_SIGNAL role ile eşleşir (${entry.id})`,
      id: entry.id,
    });
  }

  return errors;
}

export function validateSourceEntries(
  entries: readonly TrendSourceRegistryEntry[],
): RegistryValidationError[] {
  const errors: RegistryValidationError[] = [];

  for (const entry of entries) {
    errors.push(...validateSourceEntry(entry));
  }

  const ids = entries.map((e) => e.id.trim());
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push({
        code: "DUPLICATE_ID",
        message: `Yinelenen kaynak id: ${id}`,
        id,
      });
    }
    seen.add(id);
  }

  return errors;
}

/** Trend-market kaynakları PRODUCTION katmanına karışmamalı — ayrı listelerde tutulur */
export function partitionSourceEntries(
  entries: readonly TrendSourceRegistryEntry[],
): {
  trendMarket: TrendSourceRegistryEntry[];
  production: TrendSourceRegistryEntry[];
} {
  const trendMarket: TrendSourceRegistryEntry[] = [];
  const production: TrendSourceRegistryEntry[] = [];

  for (const entry of entries) {
    if (entry.layer === PRODUCTION_LAYER) {
      production.push(entry);
    } else {
      trendMarket.push(entry);
    }
  }

  return { trendMarket, production };
}
