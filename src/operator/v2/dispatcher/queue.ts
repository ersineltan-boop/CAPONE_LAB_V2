import type { OperatorTextStore } from "../../queue/store";
import type { JobManifest } from "../types";
import { createDispatcherTask } from "./route";
import type { DispatcherQueueFile, DispatcherTask } from "./types";

export const DISPATCHER_QUEUE_PATH = ".operator/queue/phase3a-dispatcher.json";

export function emptyDispatcherQueue(now = new Date()): DispatcherQueueFile {
  return {
    version: 3,
    updatedAt: now.toISOString(),
    tasks: [],
  };
}

export function parseDispatcherQueue(raw: string | null): DispatcherQueueFile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DispatcherQueueFile;
    if (parsed.version !== 3 || !Array.isArray(parsed.tasks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadDispatcherQueue(
  store: OperatorTextStore,
  path = DISPATCHER_QUEUE_PATH,
): DispatcherQueueFile {
  return parseDispatcherQueue(store.read(path)) ?? emptyDispatcherQueue();
}

export function saveDispatcherQueue(
  store: OperatorTextStore,
  queue: DispatcherQueueFile,
  path = DISPATCHER_QUEUE_PATH,
): void {
  if (!store.write) {
    throw new Error("Dispatcher queue store is read-only");
  }
  store.write(path, JSON.stringify(queue, null, 2));
}

export function upsertDispatcherTask(
  queue: DispatcherQueueFile,
  task: DispatcherTask,
  now = new Date(),
): DispatcherQueueFile {
  return {
    version: 3,
    updatedAt: now.toISOString(),
    tasks: [...queue.tasks.filter((item) => item.id !== task.id), task],
  };
}

export function getDispatcherTask(
  queue: DispatcherQueueFile,
  taskId: string,
): DispatcherTask | null {
  return queue.tasks.find((task) => task.id === taskId) ?? null;
}

export function enqueueDispatcherInstruction(
  queue: DispatcherQueueFile,
  instruction: string,
  now = new Date(),
): { queue: DispatcherQueueFile; task: DispatcherTask } {
  const task = createDispatcherTask({ instruction, now });
  return { queue: upsertDispatcherTask(queue, task, now), task };
}

export function enqueueDispatcherJob(
  queue: DispatcherQueueFile,
  job: JobManifest,
  now = new Date(),
): { queue: DispatcherQueueFile; task: DispatcherTask } {
  const task = createDispatcherTask({
    instruction: job.rawInstruction,
    now,
    job,
    id: `disp-${job.id}`,
  });
  return { queue: upsertDispatcherTask(queue, task, now), task };
}

export function formatDispatcherList(queue: DispatcherQueueFile): string {
  if (queue.tasks.length === 0) return "CAPONE DISPATCHER QUEUE: empty";
  const lines = ["CAPONE DISPATCHER QUEUE"];
  for (const task of queue.tasks) {
    lines.push(
      `${task.id}  ${task.state}  ${task.priority}/${task.risk}  ${task.domain}  ${task.targetName ?? "-"}`,
    );
  }
  return lines.join("\n");
}
