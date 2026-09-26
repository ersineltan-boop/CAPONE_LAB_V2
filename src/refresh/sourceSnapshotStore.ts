import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  markPublishFailed,
  markPublished,
  type SourceLastGoodState,
  type SourceRefreshPlan,
} from "./sourceSnapshot";

export interface SourceSnapshotTarget {
  targetPath: string;
  sourceId: string;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

async function readCurrentState(targetPath: string): Promise<SourceLastGoodState | null> {
  let raw: string;
  try {
    raw = await readFile(targetPath, "utf-8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("snapshot" in parsed) ||
    typeof parsed.snapshot !== "object" ||
    parsed.snapshot === null ||
    !("sourceId" in parsed.snapshot) ||
    typeof parsed.snapshot.sourceId !== "string" ||
    !("snapshotId" in parsed.snapshot) ||
    typeof parsed.snapshot.snapshotId !== "string"
  ) {
    throw new Error("target does not contain a valid last-good snapshot");
  }
  return parsed as SourceLastGoodState;
}

function assertTargetVersion<T>(
  target: SourceSnapshotTarget,
  plan: SourceRefreshPlan<T>,
  current: SourceLastGoodState | null,
): void {
  const proposed = plan.proposedLastGood;
  if (!proposed) throw new Error("plan has no proposed last-good snapshot");
  if (proposed.snapshot.sourceId !== target.sourceId) {
    throw new Error(
      `target source ${target.sourceId} does not match plan source ${proposed.snapshot.sourceId}`,
    );
  }

  const expectedPreviousSnapshotId = plan.health.last_good_snapshot_id;
  if (!current) {
    if (expectedPreviousSnapshotId !== null) {
      throw new Error(
        `version conflict: expected previous snapshot ${expectedPreviousSnapshotId}, but target is missing`,
      );
    }
    return;
  }
  if (current.snapshot.sourceId !== target.sourceId) {
    throw new Error(
      `target contains source ${current.snapshot.sourceId}, not bound source ${target.sourceId}`,
    );
  }
  if (current.snapshot.snapshotId !== expectedPreviousSnapshotId) {
    throw new Error(
      `version conflict: expected previous snapshot ${expectedPreviousSnapshotId ?? "none"}, found ${current.snapshot.snapshotId}`,
    );
  }
}

export async function publishLastGoodAtomic<T>(
  target: SourceSnapshotTarget,
  plan: SourceRefreshPlan<T>,
): Promise<SourceRefreshPlan<T>> {
  if (!target.sourceId.trim()) {
    return markPublishFailed(plan, "target sourceId is required");
  }
  if (!plan.publishAllowed || !plan.proposedLastGood || plan.proposedLastGood.snapshot.items.length === 0) {
    return markPublishFailed(plan, "refusing to publish an invalid or empty snapshot");
  }

  const { targetPath } = target;
  const lockPath = `${targetPath}.lock`;
  let lockOwned = false;
  let lockHandle: Awaited<ReturnType<typeof open>> | null = null;
  let tempPath: string | null = null;

  try {
    await mkdir(dirname(targetPath), { recursive: true });
    lockHandle = await open(lockPath, "wx");
    lockOwned = true;
    await lockHandle.writeFile(
      `${JSON.stringify({ pid: process.pid, token: randomUUID(), sourceId: target.sourceId })}\n`,
      "utf-8",
    );
    await lockHandle.close();
    lockHandle = null;

    const current = await readCurrentState(targetPath);
    assertTargetVersion(target, plan, current);

    tempPath = `${targetPath}.tmp-${process.pid}-${randomUUID()}`;
    await writeFile(tempPath, `${JSON.stringify(plan.proposedLastGood, null, 2)}\n`, {
      encoding: "utf-8",
      flag: "wx",
    });
    await rename(tempPath, targetPath);
    tempPath = null;
    return markPublished(plan);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return markPublishFailed(plan, reason);
  } finally {
    if (lockHandle) await lockHandle.close().catch(() => undefined);
    if (tempPath) await rm(tempPath, { force: true }).catch(() => undefined);
    if (lockOwned) await rm(lockPath, { force: true }).catch(() => undefined);
  }
}
