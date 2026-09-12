import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { OperatorTextStore } from "../src/operator/queue/store";
import { OPERATOR_RUNTIME_DIRS } from "../src/operator/v2/storage/paths";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function createFsStore(root = REPO_ROOT): OperatorTextStore {
  return {
    read(path: string) {
      try {
        return readFileSync(join(root, path), "utf-8");
      } catch {
        return null;
      }
    },
    write(path: string, contents: string) {
      const full = join(root, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents, "utf-8");
    },
  };
}

export async function ensureRuntimeDirs(root = REPO_ROOT): Promise<void> {
  for (const dir of Object.values(OPERATOR_RUNTIME_DIRS)) {
    await mkdir(join(root, dir), { recursive: true });
  }
}

export async function listQueuedJobIds(root = REPO_ROOT): Promise<string[]> {
  try {
    const files = await readdir(join(root, OPERATOR_RUNTIME_DIRS.queue));
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
