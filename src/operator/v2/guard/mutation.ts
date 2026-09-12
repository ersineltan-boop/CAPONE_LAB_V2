import type { GitSnapshot, MutationFinding } from "../types";
import { ALLOWED_WRITE_PREFIXES, PRODUCTION_DATA_PREFIXES } from "../storage/paths";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function parseGitStatusShort(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => normalizePath(line.replace(/^[A-Z?!]{1,2}\s+/, "").replace(/^.+ -> /, "")));
}

export function createGitSnapshot(raw: string): GitSnapshot {
  return { raw, paths: parseGitStatusShort(raw) };
}

export function pathIsAllowedWrite(path: string, extraAllowed: readonly string[] = []): boolean {
  const normalized = normalizePath(path);
  return (
    ALLOWED_WRITE_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    extraAllowed.some((prefix) => normalized.startsWith(normalizePath(prefix)))
  );
}

export function pathIsProductionData(path: string): boolean {
  const normalized = normalizePath(path);
  return PRODUCTION_DATA_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function detectMutations(
  before: GitSnapshot,
  after: GitSnapshot,
  extraAllowed: readonly string[] = [],
): MutationFinding {
  const beforeSet = new Set(before.paths);
  const newlyChanged = after.paths.filter((path) => !beforeSet.has(path));
  const unexpected = newlyChanged.filter((path) => !pathIsAllowedWrite(path, extraAllowed));
  const production = newlyChanged.filter((path) => pathIsProductionData(path));

  if (production.length > 0) {
    return {
      blocked: true,
      unexpected,
      production,
      reason: `Production data mutation is BLOCKED: ${production.join(", ")}`,
    };
  }

  if (unexpected.length > 0) {
    return {
      blocked: true,
      unexpected,
      production,
      reason: `Unexpected file mutation is BLOCKED: ${unexpected.join(", ")}`,
    };
  }

  return { blocked: false, unexpected: [], production: [], reason: null };
}
