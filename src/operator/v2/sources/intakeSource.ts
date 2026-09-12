import type { TaskSource } from "../types";
import { TASK_SOURCES } from "../types";

export interface IncomingTaskEnvelope {
  source: TaskSource;
  requestedBy: string;
  instruction: string;
  externalId?: string;
}

export function isTaskSource(value: string): value is TaskSource {
  return (TASK_SOURCES as readonly string[]).includes(value);
}

export function acceptTaskEnvelope(envelope: IncomingTaskEnvelope): IncomingTaskEnvelope {
  if (!isTaskSource(envelope.source)) {
    throw new Error("Unknown task source");
  }
  if (!envelope.instruction.trim()) {
    throw new Error("Task envelope has no instruction");
  }
  return {
    source: envelope.source,
    requestedBy: envelope.requestedBy.trim() || "unknown",
    instruction: envelope.instruction,
    externalId: envelope.externalId,
  };
}

/** V3 can map GitHub Issue / schedule / agent payloads into this envelope. No secrets. */
export function envelopeFromLocalCli(instruction: string, requestedBy = "owner"): IncomingTaskEnvelope {
  return acceptTaskEnvelope({
    source: "LOCAL_CLI",
    requestedBy,
    instruction,
  });
}
