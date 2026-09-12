import type { DispatcherDomain, DispatcherTask } from "./types";

export function normalizeDispatcherPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

export function normalizeDispatcherTarget(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function dispatcherPathsOverlap(left: string, right: string): boolean {
  const a = normalizeDispatcherPath(left);
  const b = normalizeDispatcherPath(right);
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export function targetFilesOverlap(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.some((item) => right.some((other) => dispatcherPathsOverlap(item, other)));
}

export function lockKeysOverlap(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const seen = new Set(left);
  return right.some((key) => seen.has(key));
}

export function buildLockKeys(input: {
  domain: DispatcherDomain;
  targetName: string | null;
  targetFiles: readonly string[];
}): string[] {
  const keys: string[] = [];
  const target = input.targetName?.trim() ? normalizeDispatcherTarget(input.targetName) : "";
  if (target) {
    keys.push(`target:${input.domain}:${target}`);
  }
  for (const file of input.targetFiles) {
    const normalized = normalizeDispatcherPath(file);
    if (normalized) keys.push(`file:${normalized}`);
  }
  return keys;
}

export function tasksConflict(left: DispatcherTask, right: DispatcherTask): boolean {
  if (left.id === right.id) return false;
  if (targetFilesOverlap(left.targetFiles, right.targetFiles)) return true;
  return lockKeysOverlap(left.lockKeys, right.lockKeys);
}

export function conflictingRunningTasks(
  candidate: DispatcherTask,
  others: readonly DispatcherTask[],
): DispatcherTask[] {
  return others.filter(
    (item) => item.state === "RUNNING" && tasksConflict(candidate, item),
  );
}
