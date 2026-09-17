import type { OwnedRecord } from "./roles";

export interface LocalClientRecord extends OwnedRecord {
  id: string;
  label: string;
}

/** Deterministic local records so role visibility can be verified without a backend. */
export const LOCAL_CLIENT_RECORDS: readonly LocalClientRecord[] = [
  { id: "demo-owner-record", ownerUserId: "user-owner", label: "Owner kaydı" },
  { id: "demo-partner-record", ownerUserId: "user-partner", label: "Partner kaydı" },
  { id: "demo-employee-record", ownerUserId: "user-employee", label: "Employee kaydı" },
  { id: "demo-producer-record", ownerUserId: "user-producer", label: "Producer kaydı" },
];
