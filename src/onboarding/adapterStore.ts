import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { ADAPTERS_PATH } from "./policy";
import type { OnboardingAdapterFile } from "./types";

export async function loadAdapterFile(root: string): Promise<OnboardingAdapterFile> {
  try {
    const raw = JSON.parse(await readFile(join(root, ADAPTERS_PATH), "utf-8")) as OnboardingAdapterFile;
    if (raw.version !== 1 || !raw.adapters) {
      return { version: 1, updatedAt: new Date().toISOString(), adapters: {} };
    }
    return raw;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), adapters: {} };
  }
}

export async function saveAdapterFile(root: string, file: OnboardingAdapterFile): Promise<void> {
  const path = join(root, ADAPTERS_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(file, null, 2), "utf-8");
}
