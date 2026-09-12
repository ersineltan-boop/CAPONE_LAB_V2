import { tasksConflict } from "./conflicts";
import { phase3ACompletionState } from "./safety";
import type {
  DispatcherQueueFile,
  DispatcherState,
  DispatcherTask,
  DispatcherTickResult,
} from "./types";

const PRIORITY_RANK: Record<DispatcherTask["priority"], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const VALID_TRANSITIONS: Record<DispatcherState, readonly DispatcherState[]> = {
  READY: ["RUNNING", "REVIEW", "BLOCKED", "FAILED"],
  RUNNING: ["DONE", "REVIEW", "BLOCKED", "FAILED"],
  REVIEW: [],
  BLOCKED: [],
  FAILED: [],
  DONE: [],
};

export function isValidDispatcherTransition(
  from: DispatcherState,
  to: DispatcherState,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function compareDispatcherOrder(left: DispatcherTask, right: DispatcherTask): number {
  const byPriority = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
  if (byPriority !== 0) return byPriority;
  if (left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? -1 : 1;
  }
  return left.id < right.id ? -1 : 1;
}

function replaceTask(
  queue: DispatcherQueueFile,
  task: DispatcherTask,
  now: Date,
): DispatcherQueueFile {
  return {
    version: 3,
    updatedAt: now.toISOString(),
    tasks: queue.tasks.map((item) => (item.id === task.id ? task : item)),
  };
}

export function selectNextTasks(
  queue: DispatcherQueueFile,
  limit = Number.POSITIVE_INFINITY,
): DispatcherTask[] {
  const running = queue.tasks.filter((task) => task.state === "RUNNING");
  const ready = queue.tasks
    .filter((task) => task.state === "READY")
    .slice()
    .sort(compareDispatcherOrder);
  const selected: DispatcherTask[] = [];
  for (const task of ready) {
    const occupied = [...running, ...selected];
    if (occupied.some((other) => tasksConflict(task, other))) continue;
    selected.push(task);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function startDispatcherTask(
  queue: DispatcherQueueFile,
  taskId: string,
  now = new Date(),
): DispatcherQueueFile {
  const task = queue.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Unknown dispatcher task: ${taskId}`);
  if (!isValidDispatcherTransition(task.state, "RUNNING")) {
    throw new Error(`Cannot start ${task.state} task ${taskId}`);
  }
  const running = queue.tasks.filter((item) => item.state === "RUNNING");
  if (running.some((other) => tasksConflict(task, other))) {
    throw new Error(`Task ${taskId} conflicts with a running task`);
  }
  const iso = now.toISOString();
  return replaceTask(
    queue,
    {
      ...task,
      state: "RUNNING",
      updatedAt: iso,
      timestamps: { ...task.timestamps, startedAt: iso },
    },
    now,
  );
}

export function completeDispatcherTask(
  queue: DispatcherQueueFile,
  taskId: string,
  to: Exclude<DispatcherState, "READY" | "RUNNING">,
  now = new Date(),
  why?: string,
): DispatcherQueueFile {
  const task = queue.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Unknown dispatcher task: ${taskId}`);
  if (!isValidDispatcherTransition(task.state, to)) {
    throw new Error(`Invalid dispatcher transition: ${task.state} → ${to}`);
  }
  const iso = now.toISOString();
  const ownerResult =
    to === "DONE" ? "PASS" : to === "BLOCKED" ? "BLOCKED" : to === "FAILED" ? "FAILED" : "REVIEW";
  return replaceTask(
    queue,
    {
      ...task,
      state: to,
      updatedAt: iso,
      ownerResult,
      why: why ?? task.why,
      productionDataModified: false,
      liveCollectorStarted: false,
      autoMerge: false,
      autoDeploy: false,
      timestamps: { ...task.timestamps, finishedAt: iso },
    },
    now,
  );
}

export function dispatchTick(
  queue: DispatcherQueueFile,
  now = new Date(),
): DispatcherTickResult {
  const skippedBlocked = queue.tasks
    .filter((task) => task.state === "BLOCKED")
    .map((task) => task.id);
  const ready = queue.tasks
    .filter((task) => task.state === "READY")
    .slice()
    .sort(compareDispatcherOrder);
  const selected = selectNextTasks(queue);
  const selectedIds = new Set(selected.map((task) => task.id));
  const skippedConflict = ready
    .filter((task) => !selectedIds.has(task.id))
    .map((task) => task.id);

  let next = queue;
  const started: string[] = [];
  const completed: string[] = [];

  for (const task of selected) {
    next = startDispatcherTask(next, task.id, now);
    started.push(task.id);
    const running = next.tasks.find((item) => item.id === task.id);
    if (!running) continue;
    const outcome = phase3ACompletionState(running);
    next = completeDispatcherTask(next, task.id, outcome, now, running.why);
    completed.push(task.id);
  }

  return {
    queue: next,
    started,
    completed,
    skippedBlocked,
    skippedConflict,
  };
}
