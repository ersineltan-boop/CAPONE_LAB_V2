import type { OwnedRecord } from "./roles";

export interface LocalClientRecord extends OwnedRecord {
  id: string;
  label: string;
}

/** Deterministic local records so role visibility can be verified without a backend. */
export const LOCAL_CLIENT_RECORDS: readonly LocalClientRecord[] = [
  {
    id: "demo-owner-record",
    userId: "user-owner",
    ownerUserId: "user-owner",
    createdAt: "2026-09-17T06:00:00.000Z",
    label: "Owner kaydı",
  },
  {
    id: "demo-partner-record",
    userId: "user-partner",
    ownerUserId: "user-partner",
    createdAt: "2026-09-17T06:01:00.000Z",
    label: "Partner kaydı",
  },
  {
    id: "demo-employee-record",
    userId: "user-employee",
    ownerUserId: "user-employee",
    createdAt: "2026-09-17T06:02:00.000Z",
    label: "Employee kaydı",
  },
  {
    id: "demo-producer-record",
    userId: "user-producer",
    ownerUserId: "user-producer",
    createdAt: "2026-09-17T06:03:00.000Z",
    label: "Producer kaydı",
  },
];
