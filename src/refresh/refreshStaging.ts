import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const REFRESH_MAX_FILE_BYTES = 90 * 1024 * 1024;

export function stageRefreshDelivery(root: string, allowlist: readonly string[]): void {
  const git = (args: string[]) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
    return result.stdout;
  };
  const validateIndex = () => {
    for (const path of git(["diff", "--cached", "--name-only", "--no-renames", "-z"]).split("\0").filter(Boolean)) {
      if (!allowlist.some(allowed => path === allowed || path.startsWith(`${allowed}/`))) {
        throw new Error(`Unexpected staged path: ${path}`);
      }
    }
  };
  const checkSize = (path: string): boolean => {
    const file = join(root, path);
    const info = lstatSync(file, { throwIfNoEntry: false });
    if (!info) return false;
    if (info.isDirectory()) {
      for (const entry of readdirSync(file)) checkSize(`${path}/${entry}`);
    } else if (info.isFile() && info.size >= REFRESH_MAX_FILE_BYTES) {
      throw new Error(`Oversized delivery: ${path}`);
    }
    return true;
  };
  // Check before Git writes anything, including files inside delivery directories.
  validateIndex();
  const present = allowlist.filter(checkSize);
  if (present.length) git(["add", "--", ...present]);
  validateIndex();
}
