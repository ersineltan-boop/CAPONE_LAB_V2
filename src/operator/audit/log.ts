import { OPERATOR_AUDIT_PATH } from "../constants";
import type { OperatorTextStore } from "../queue/store";
import type { AuditEvent } from "../types";

export type { OperatorTextStore } from "../queue/store";

function parseAuditLine(line: string): AuditEvent | null {
  try {
    const parsed = JSON.parse(line) as AuditEvent;
    if (!parsed.at || !parsed.taskId || !parsed.event || !parsed.why) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseAuditLog(raw: string | null): AuditEvent[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => parseAuditLine(line))
    .filter((event): event is AuditEvent => event !== null);
}

export function appendAuditEvent(
  store: OperatorTextStore,
  event: AuditEvent,
  path = OPERATOR_AUDIT_PATH,
): void {
  if (!store.write) {
    throw new Error("Audit store is read-only");
  }
  const existing = store.read(path) ?? "";
  const line = JSON.stringify({
    at: event.at,
    taskId: event.taskId,
    event: event.event,
    fromState: event.fromState,
    toState: event.toState,
    why: event.why,
  });
  const prefix = existing.replace(/\s*$/, "");
  store.write(path, prefix ? `${prefix}\n${line}\n` : `${line}\n`);
}

export function loadAuditLog(
  store: OperatorTextStore,
  path = OPERATOR_AUDIT_PATH,
): AuditEvent[] {
  return parseAuditLog(store.read(path));
}

export function createAuditEvent(
  taskId: string,
  event: string,
  why: string,
  states?: Pick<AuditEvent, "fromState" | "toState">,
  now = new Date(),
): AuditEvent {
  return {
    at: now.toISOString(),
    taskId,
    event,
    why,
    fromState: states?.fromState,
    toState: states?.toState,
  };
}
