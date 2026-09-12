import type { OperatorTextStore } from "../../queue/store";
import type { JobManifest } from "../types";
import { queuePath, reportPath, runPath } from "./paths";

export function saveJob(store: OperatorTextStore, job: JobManifest): void {
  if (!store.write) throw new Error("Job store is read-only");
  store.write(queuePath(job.id), JSON.stringify(job, null, 2));
}

export function loadJob(store: OperatorTextStore, jobId: string): JobManifest | null {
  const raw = store.read(queuePath(jobId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JobManifest;
  } catch {
    return null;
  }
}

export function saveRun(store: OperatorTextStore, job: JobManifest): void {
  if (!store.write) throw new Error("Job store is read-only");
  store.write(runPath(job.id), JSON.stringify(job, null, 2));
}

export function saveReportJson(store: OperatorTextStore, jobId: string, report: unknown): void {
  if (!store.write) throw new Error("Job store is read-only");
  store.write(reportPath(jobId), JSON.stringify(report, null, 2));
}

export function listJobs(store: OperatorTextStore, ids: readonly string[]): JobManifest[] {
  return ids
    .map((id) => loadJob(store, id))
    .filter((job): job is JobManifest => job !== null);
}

export function runtimePathsForJob(jobId: string): string[] {
  return [queuePath(jobId), runPath(jobId), reportPath(jobId)];
}

export function isRuntimeStoragePath(path: string): boolean {
  return path.replace(/\\/g, "/").startsWith(".operator/");
}
