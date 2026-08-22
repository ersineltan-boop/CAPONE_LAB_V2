export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function findDuplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    const normalized = id.trim();
    if (seen.has(normalized)) {
      duplicates.add(normalized);
    } else {
      seen.add(normalized);
    }
  }

  return [...duplicates];
}

export function assertUniqueIds(
  entries: ReadonlyArray<{ id: string }>,
  entityLabel: string,
): void {
  const duplicates = findDuplicateIds(entries.map((e) => e.id));
  if (duplicates.length > 0) {
    throw new Error(
      `${entityLabel} registry: yinelenen id — ${duplicates.join(", ")}`,
    );
  }
}
