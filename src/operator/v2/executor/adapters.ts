import type { JobManifest, JobStep, StepExecutionResult } from "../types";

export function simulateStage(job: JobManifest, step: JobStep): StepExecutionResult {
  if (job.executionMode === "OWNER_APPROVED_PRODUCTION") {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "Phase 1 cannot enter OWNER_APPROVED_PRODUCTION writes",
      notes: ["Production mode is not enabled in V2 Phase 1"],
      blockers: [
        {
          code: "PRODUCTION_MODE_DISABLED",
          reason: "OWNER_APPROVED_PRODUCTION writes are not enabled in Phase 1",
          severity: "BLOCKED",
        },
      ],
    };
  }

  if (step.requiresOwnerApproval && step.state === "COLLECTING") {
    return {
      exitCode: 0,
      stdout: "collector planned, not executed",
      stderr: "",
      notes: ["Canlı collector bağlı değil", "Collector planı hazır"],
      blockers: [
        {
          code: "COLLECTOR_NOT_WIRED",
          reason: "Canlı collector Phase 1'de çalıştırılmaz; owner onayı gerekir",
          severity: "REVIEW",
        },
      ],
    };
  }

  if (step.state === "REVIEW") {
    return {
      exitCode: 0,
      stdout: "owner gate",
      stderr: "",
      notes: ["Owner onay kapısına gelindi"],
      blockers: [],
    };
  }

  return {
    exitCode: 0,
    stdout: `${step.id} simulated`,
    stderr: "",
    notes: [step.title],
    blockers: [],
  };
}
