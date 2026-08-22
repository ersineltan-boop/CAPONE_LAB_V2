export type {
  BrandSegment,
  BrandRole,
  TrackingPriority,
  BrandRegistryEntry,
} from "./brand";
export {
  BRAND_SEGMENTS,
  BRAND_ROLES,
  TRACKING_PRIORITIES,
} from "./brand";
export type {
  SourceLayer,
  SourceRegistryRole,
  SourceAccessMode,
  TrendSourceRegistryEntry,
} from "./source";
export {
  SOURCE_LAYERS,
  SOURCE_ROLES,
  SOURCE_ACCESS_MODES,
  PRODUCTION_LAYER,
  PRODUCTION_SIGNAL_ROLE,
  isProductionRegistrySource,
  isTrendMarketRegistrySource,
} from "./source";

export interface RegistryValidationError {
  code:
    | "DUPLICATE_ID"
    | "INVALID_ENTRY"
    | "PRODUCTION_LAYER_MISMATCH"
    | "INVALID_INFLUENCE"
    | "INVALID_WEIGHT";
  message: string;
  id?: string;
}

export class RegistryValidationException extends Error {
  readonly errors: RegistryValidationError[];

  constructor(errors: RegistryValidationError[]) {
    super(errors.map((e) => e.message).join("; "));
    this.name = "RegistryValidationException";
    this.errors = errors;
  }
}
