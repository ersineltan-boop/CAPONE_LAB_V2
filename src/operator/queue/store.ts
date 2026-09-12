import { OPERATOR_QUEUE_PATH } from "../constants";
import type { OperatorQueueFile, OperatorTask } from "../types";

export interface OperatorTextStore {
  read(path: string): string | null;
  write?(path: string, contents: string): void;
}

export function createMemoryStore(initial: Record<string, string> = {}): OperatorTextStore {
  const files = { ...initial };
  return {
    read(path: string) {
      return files[path] ?? null;
    },
    write(path: string, contents: string) {
      files[path] = contents;
    },
  };
}

export function emptyQueue(now = new Date()): OperatorQueueFile {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    tasks: [],
  };
}

export function parseQueue(raw: string | null): OperatorQueueFile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OperatorQueueFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadQueue(
  store: OperatorTextStore,
  path = OPERATOR_QUEUE_PATH,
): OperatorQueueFile {
  return parseQueue(store.read(path)) ?? emptyQueue();
}

export function saveQueue(
  store: OperatorTextStore,
  queue: OperatorQueueFile,
  path = OPERATOR_QUEUE_PATH,
): void {
  if (!store.write) {
    throw new Error("Queue store is read-only");
  }
  store.write(path, JSON.stringify(queue, null, 2));
}

export function enqueueTask(
  queue: OperatorQueueFile,
  task: OperatorTask,
  now = new Date(),
): OperatorQueueFile {
  const without = queue.tasks.filter((item) => item.id !== task.id);
  return {
    version: 1,
    updatedAt: now.toISOString(),
    tasks: [...without, task],
  };
}

export function getTask(queue: OperatorQueueFile, taskId: string): OperatorTask | null {
  return queue.tasks.find((task) => task.id === taskId) ?? null;
}
