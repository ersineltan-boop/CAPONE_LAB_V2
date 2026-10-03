import { cp, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

/** A failed lane restores its starting data, including earlier successful lanes. */
export async function transactionalRefreshLane(root: string, paths: readonly string[], collect: () => Promise<boolean>): Promise<boolean> {
  const snapshot = await mkdtemp(join(tmpdir(), "capone-refresh-"));
  const present: string[] = [];
  try {
    for (const path of paths) {
      if (await stat(join(root, path)).then(() => true, () => false)) {
        present.push(path);
        await mkdir(dirname(join(snapshot, path)), { recursive: true });
        await cp(join(root, path), join(snapshot, path), { recursive: true });
      }
    }
    let succeeded = false;
    try { succeeded = await collect(); }
    catch (error) { console.error("Lane failed; restoring preceding validated data:", error); }
    if (!succeeded) {
      for (const path of paths) {
        await rm(join(root, path), { recursive: true, force: true });
        if (present.includes(path)) {
          await mkdir(dirname(join(root, path)), { recursive: true });
          await cp(join(snapshot, path), join(root, path), { recursive: true });
        }
      }
    }
    return succeeded;
  } finally { await rm(snapshot, { recursive: true, force: true }); }
}
