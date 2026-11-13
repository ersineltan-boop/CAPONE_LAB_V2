export const CATALOG_SNAPSHOT_SCHEMA = "capone.catalog.snapshot.v1";

const catalogPath = /^(?:(?:summary|id-index|visual-summary)\.json|(?:brands|marketplaces|visual)\/[a-z0-9-]+\.json)$/;
const objectPath = /^objects\/[a-f0-9]{64}\.json$/;

export interface CatalogSnapshotManifest {
  schema: typeof CATALOG_SNAPSHOT_SCHEMA;
  files: Record<string, string | { field: "cards" | "families"; parts: string[] }>;
}

export function parseCatalogSnapshotManifest(value: unknown): CatalogSnapshotManifest {
  const data = value as Partial<CatalogSnapshotManifest> | null;
  if (!data || data.schema !== CATALOG_SNAPSHOT_SCHEMA || !data.files ||
      typeof data.files !== "object" || Array.isArray(data.files)) {
    throw new Error("Invalid catalog snapshot manifest");
  }
  for (const [path, object] of Object.entries(data.files)) {
    const valid = typeof object === "string" ? objectPath.test(object) : object &&
      object.field === (path.startsWith("visual/") ? "cards" : "families") &&
      /^(?:brands|marketplaces|visual)\//.test(path) && Array.isArray(object.parts) &&
      object.parts.length > 0 && object.parts.every((part) => typeof part === "string" && objectPath.test(part));
    if (!catalogPath.test(path) || !valid) {
      throw new Error(`Invalid catalog snapshot entry: ${path}`);
    }
  }
  for (const required of ["summary.json", "id-index.json", "visual-summary.json", "visual/tumu.json"]) {
    if (!Object.hasOwn(data.files, required)) throw new Error(`Missing catalog snapshot entry: ${required}`);
  }
  return { schema: CATALOG_SNAPSHOT_SCHEMA, files: data.files };
}
