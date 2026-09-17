import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  markPublishFailed,
  markPublished,
  type SourceRefreshPlan,
} from "./sourceSnapshot";

export async function publishLastGoodAtomic<T>(
  targetPath: string,
  plan: SourceRefreshPlan<T>,
): Promise<SourceRefreshPlan<T>> {
  if (!plan.publishAllowed || !plan.proposedLastGood || plan.proposedLastGood.snapshot.items.length === 0) {
    return markPublishFailed(plan, "refusing to publish an invalid or empty snapshot");
  }

  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(plan.proposedLastGood, null, 2)}\n`, {
      encoding: "utf-8",
      flag: "wx",
    });
    await rename(tempPath, targetPath);
    return markPublished(plan);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    const reason = error instanceof Error ? error.message : String(error);
    return markPublishFailed(plan, reason);
  }
}
