import {
  dispatchTick,
  enqueueDispatcherInstruction,
  formatDispatcherList,
  loadDispatcherQueue,
  saveDispatcherQueue,
} from "../src/operator/v2/dispatcher";
import { createFsStore, ensureRuntimeDirs } from "./operator-runtime";

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argsAfter(name: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  const parts: string[] = [];
  for (let i = index + 1; i < process.argv.length; i += 1) {
    const item = process.argv[i] ?? "";
    if (item.startsWith("--")) break;
    parts.push(item);
  }
  return parts.join(" ").trim();
}

await ensureRuntimeDirs();
const store = createFsStore();
let queue = loadDispatcherQueue(store);
const json = hasFlag("--json");
const didEnqueue = hasFlag("--enqueue");
const didTick = hasFlag("--tick");

if (didEnqueue) {
  const instruction = argsAfter("--enqueue");
  if (!instruction) {
    console.error('Usage: npm.cmd run operator:dispatch -- --enqueue "Kategori ve görselleri QA et"');
    process.exit(1);
  }
  const enqueued = enqueueDispatcherInstruction(queue, instruction);
  queue = enqueued.queue;
  saveDispatcherQueue(store, queue);
  if (json) {
    console.log(JSON.stringify({ action: "enqueue", task: enqueued.task }, null, 2));
  } else {
    console.log(`enqueued: ${enqueued.task.id}`);
    console.log(`domain: ${enqueued.task.domain}`);
    console.log(`state: ${enqueued.task.state}`);
    console.log(`priority: ${enqueued.task.priority}`);
    console.log(`risk: ${enqueued.task.risk}`);
    console.log(`why: ${enqueued.task.why}`);
  }
}

if (didTick) {
  const tick = dispatchTick(queue);
  queue = tick.queue;
  saveDispatcherQueue(store, queue);
  if (json) {
    console.log(JSON.stringify({ action: "tick", tick }, null, 2));
  } else {
    console.log(`started: ${tick.started.join(", ") || "-"}`);
    console.log(`completed: ${tick.completed.join(", ") || "-"}`);
    console.log(`skipped-blocked: ${tick.skippedBlocked.join(", ") || "-"}`);
    console.log(`skipped-conflict: ${tick.skippedConflict.join(", ") || "-"}`);
  }
}

if (hasFlag("--list") || (!didEnqueue && !didTick)) {
  if (json && !didEnqueue && !didTick) {
    console.log(JSON.stringify(queue, null, 2));
  } else if (!json) {
    console.log(formatDispatcherList(queue));
  }
}
