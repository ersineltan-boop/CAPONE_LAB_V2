export type SourceRefreshStatus =
  | "RUNNER_NOT_STARTED"
  | "SOURCE_UNAVAILABLE"
  | "COLLECT_FAILED"
  | "VALIDATION_FAILED"
  | "PUBLISH_FAILED"
  | "SUCCESS";

export type SnapshotEventType =
  | "BASELINE"
  | "NEW_MODEL"
  | "NEW_COLOR"
  | "RESTOCK"
  | "PRICE_CHANGE"
  | "REMOVED"
  | "UNCHANGED";

export type DiffEvidenceType =
  | "FULL_CATALOG_DIFF"
  | "NEW_ARRIVALS_COLLECTION"
  | "NEW_BADGE"
  | "EXPLICIT_DATE";

export interface SourceCatalogItem<T = unknown> {
  /** Stable source-native style/model key. */
  modelIdentity: string;
  /** Stable source-native color key within the model. */
  colorIdentity: string;
  /** Stable listing/SKU identity. */
  identity: string;
  inStock: boolean;
  price?: number | null;
  currency?: string | null;
  newnessEvidence?: Exclude<DiffEvidenceType, "FULL_CATALOG_DIFF"> | null;
  payload?: T;
}

export interface SourceSnapshot<T = unknown> {
  snapshotId: string;
  sourceId: string;
  collectedAt: string;
  fullCatalog: true;
  items: SourceCatalogItem<T>[];
}

export interface SourceLastGoodState<T = unknown> {
  snapshot: SourceSnapshot<T>;
  seenModelIdentities: string[];
  seenColorIdentities: string[];
  seenItemIdentities: string[];
}

export interface SnapshotEvent<T = unknown> {
  type: SnapshotEventType;
  identity: string;
  modelIdentity: string;
  colorIdentity: string;
  evidence: DiffEvidenceType[];
  previous?: SourceCatalogItem<T>;
  current?: SourceCatalogItem<T>;
}

export interface SourceHealthRecord {
  source_total: number;
  collected: number;
  missing: number;
  coverage_percent: number;
  previous_collected: number;
  change_percent: number;
  last_attempt_at: string;
  last_success_at: string | null;
  last_good_snapshot_id: string | null;
  failure_stage: "RUNNER" | "SOURCE" | "COLLECT" | "VALIDATION" | "PUBLISH" | null;
  failure_reason: string | null;
}

export interface SourceRefreshInput<T = unknown> {
  sourceId: string;
  attemptedAt: string;
  runnerStarted: boolean;
  sourceAvailable: boolean;
  collectError?: string | null;
  /** Collector-confirmed full-catalog traversal, not merely a sample page. */
  fullCatalog: boolean;
  /** Source-reported or independently verified catalog total. */
  sourceTotal: number;
  items: SourceCatalogItem<T>[];
  minCoveragePercent?: number;
  maxDropPercent?: number;
}

export interface SourceRefreshPlan<T = unknown> {
  status: SourceRefreshStatus;
  health: SourceHealthRecord;
  validationErrors: string[];
  events: SnapshotEvent<T>[];
  proposedLastGood: SourceLastGoodState<T> | null;
  publishAllowed: boolean;
}

const round = (value: number): number => Math.round(value * 100) / 100;
const scopedModel = (sourceId: string, item: SourceCatalogItem): string =>
  `${sourceId}::${item.modelIdentity}`;
const scopedColor = (sourceId: string, item: SourceCatalogItem): string =>
  `${scopedModel(sourceId, item)}::${item.colorIdentity}`;
const scopedItem = (sourceId: string, item: SourceCatalogItem): string =>
  `${sourceId}::${item.identity}`;

function healthFor<T>(
  input: SourceRefreshInput<T>,
  previous: SourceLastGoodState<T> | null,
): SourceHealthRecord {
  const collected = input.items.length;
  const previousCollected = previous?.snapshot.items.length ?? 0;
  const coverage = input.sourceTotal > 0 ? (collected / input.sourceTotal) * 100 : 0;
  const change = previousCollected > 0
    ? ((collected - previousCollected) / previousCollected) * 100
    : 0;
  return {
    source_total: input.sourceTotal,
    collected,
    missing: Math.max(0, input.sourceTotal - collected),
    coverage_percent: round(coverage),
    previous_collected: previousCollected,
    change_percent: round(change),
    last_attempt_at: input.attemptedAt,
    last_success_at: previous?.snapshot.collectedAt ?? null,
    last_good_snapshot_id: previous?.snapshot.snapshotId ?? null,
    failure_stage: null,
    failure_reason: null,
  };
}

function failedPlan<T>(
  status: Exclude<SourceRefreshStatus, "SUCCESS">,
  stage: NonNullable<SourceHealthRecord["failure_stage"]>,
  reason: string,
  health: SourceHealthRecord,
  validationErrors: string[] = [],
): SourceRefreshPlan<T> {
  return {
    status,
    health: { ...health, failure_stage: stage, failure_reason: reason },
    validationErrors,
    events: [],
    proposedLastGood: null,
    publishAllowed: false,
  };
}

function validateItems<T>(
  input: SourceRefreshInput<T>,
  previous: SourceLastGoodState<T> | null,
): string[] {
  const errors: string[] = [];
  const minCoverage = input.minCoveragePercent ?? 95;
  const maxDrop = input.maxDropPercent ?? 40;

  if (!input.fullCatalog) errors.push("collector did not prove a full-catalog traversal");
  if (input.items.length === 0) errors.push("collection is empty");
  if (!Number.isInteger(input.sourceTotal) || input.sourceTotal <= 0) {
    errors.push("sourceTotal must be a positive integer");
  }
  if (input.sourceTotal < input.items.length) {
    errors.push("sourceTotal cannot be smaller than the collected count");
  }

  const identities = new Set<string>();
  for (const item of input.items) {
    if (!item.identity.trim()) errors.push("item identity is required");
    if (!item.modelIdentity.trim()) errors.push(`model identity is required for ${item.identity || "unknown item"}`);
    if (!item.colorIdentity.trim()) errors.push(`color identity is required for ${item.identity || "unknown item"}`);
    const key = scopedItem(input.sourceId, item);
    if (identities.has(key)) errors.push(`duplicate item identity: ${item.identity}`);
    identities.add(key);
    if (item.price != null && (!Number.isFinite(item.price) || item.price < 0)) {
      errors.push(`invalid price for ${item.identity}`);
    }
  }

  const coverage = input.sourceTotal > 0 ? (input.items.length / input.sourceTotal) * 100 : 0;
  if (coverage < minCoverage) {
    errors.push(`coverage ${round(coverage)}% is below the ${minCoverage}% publish threshold`);
  }

  const previousCount = previous?.snapshot.items.length ?? 0;
  if (previousCount > 0) {
    const drop = ((previousCount - input.items.length) / previousCount) * 100;
    if (drop > maxDrop) {
      errors.push(`catalog drop ${round(drop)}% exceeds the ${maxDrop}% safety threshold`);
    }
  }

  return [...new Set(errors)];
}

function buildEvents<T>(
  sourceId: string,
  items: SourceCatalogItem<T>[],
  previous: SourceLastGoodState<T> | null,
): SnapshotEvent<T>[] {
  if (!previous) {
    return items.map((current) => ({
      type: "BASELINE",
      identity: current.identity,
      modelIdentity: current.modelIdentity,
      colorIdentity: current.colorIdentity,
      evidence: [],
      current,
    }));
  }

  const priorById = new Map(
    previous.snapshot.items.map((item) => [scopedItem(sourceId, item), item]),
  );
  const currentById = new Map(items.map((item) => [scopedItem(sourceId, item), item]));
  const seenModels = new Set(previous.seenModelIdentities);
  const seenColors = new Set(previous.seenColorIdentities);
  const seenItems = new Set(previous.seenItemIdentities);
  const events: SnapshotEvent<T>[] = [];

  for (const current of items) {
    const itemKey = scopedItem(sourceId, current);
    const prior = priorById.get(itemKey);
    const evidence: DiffEvidenceType[] = ["FULL_CATALOG_DIFF"];
    if (current.newnessEvidence) evidence.push(current.newnessEvidence);

    if (!prior) {
      const type: SnapshotEventType = !seenItems.has(itemKey)
        ? !seenModels.has(scopedModel(sourceId, current))
          ? "NEW_MODEL"
          : !seenColors.has(scopedColor(sourceId, current))
            ? "NEW_COLOR"
            : "RESTOCK"
        : "RESTOCK";
      events.push({
        type,
        identity: current.identity,
        modelIdentity: current.modelIdentity,
        colorIdentity: current.colorIdentity,
        evidence,
        current,
      });
      continue;
    }

    let changed = false;
    if (!prior.inStock && current.inStock) {
      events.push({
        type: "RESTOCK",
        identity: current.identity,
        modelIdentity: current.modelIdentity,
        colorIdentity: current.colorIdentity,
        evidence,
        previous: prior,
        current,
      });
      changed = true;
    }
    if (
      prior.price != null &&
      current.price != null &&
      (prior.price !== current.price || prior.currency !== current.currency)
    ) {
      events.push({
        type: "PRICE_CHANGE",
        identity: current.identity,
        modelIdentity: current.modelIdentity,
        colorIdentity: current.colorIdentity,
        evidence,
        previous: prior,
        current,
      });
      changed = true;
    }
    if (!changed) {
      events.push({
        type: "UNCHANGED",
        identity: current.identity,
        modelIdentity: current.modelIdentity,
        colorIdentity: current.colorIdentity,
        evidence: [],
        previous: prior,
        current,
      });
    }
  }

  for (const prior of previous.snapshot.items) {
    if (currentById.has(scopedItem(sourceId, prior))) continue;
    events.push({
      type: "REMOVED",
      identity: prior.identity,
      modelIdentity: prior.modelIdentity,
      colorIdentity: prior.colorIdentity,
      evidence: ["FULL_CATALOG_DIFF"],
      previous: prior,
    });
  }
  return events;
}

export function createSourceRefreshPlan<T>(
  input: SourceRefreshInput<T>,
  previous: SourceLastGoodState<T> | null = null,
): SourceRefreshPlan<T> {
  const previousMatchesSource = !previous || previous.snapshot.sourceId === input.sourceId;
  const health = healthFor(input, previousMatchesSource ? previous : null);
  if (!previousMatchesSource) {
    const reason =
      `previous snapshot source ${previous?.snapshot.sourceId ?? "unknown"} does not match input source ${input.sourceId}`;
    return failedPlan("VALIDATION_FAILED", "VALIDATION", reason, health, [reason]);
  }
  if (!input.runnerStarted) {
    return failedPlan("RUNNER_NOT_STARTED", "RUNNER", "runner did not start", health);
  }
  if (!input.sourceAvailable) {
    return failedPlan("SOURCE_UNAVAILABLE", "SOURCE", "source is unavailable", health);
  }
  if (input.collectError) {
    return failedPlan("COLLECT_FAILED", "COLLECT", input.collectError, health);
  }

  const validationErrors = validateItems(input, previous);
  if (validationErrors.length > 0) {
    return failedPlan(
      "VALIDATION_FAILED",
      "VALIDATION",
      validationErrors.join("; "),
      health,
      validationErrors,
    );
  }

  const snapshot: SourceSnapshot<T> = {
    snapshotId: `${input.sourceId}:${input.attemptedAt}`,
    sourceId: input.sourceId,
    collectedAt: input.attemptedAt,
    fullCatalog: true,
    items: input.items,
  };
  const modelHistory = new Set(previous?.seenModelIdentities ?? []);
  const colorHistory = new Set(previous?.seenColorIdentities ?? []);
  const itemHistory = new Set(previous?.seenItemIdentities ?? []);
  for (const item of input.items) {
    modelHistory.add(scopedModel(input.sourceId, item));
    colorHistory.add(scopedColor(input.sourceId, item));
    itemHistory.add(scopedItem(input.sourceId, item));
  }

  return {
    status: "SUCCESS",
    health,
    validationErrors: [],
    events: buildEvents(input.sourceId, input.items, previous),
    proposedLastGood: {
      snapshot,
      seenModelIdentities: [...modelHistory].sort(),
      seenColorIdentities: [...colorHistory].sort(),
      seenItemIdentities: [...itemHistory].sort(),
    },
    publishAllowed: true,
  };
}

export function markPublishFailed<T>(
  plan: SourceRefreshPlan<T>,
  reason: string,
): SourceRefreshPlan<T> {
  return {
    ...plan,
    status: "PUBLISH_FAILED",
    health: { ...plan.health, failure_stage: "PUBLISH", failure_reason: reason },
    proposedLastGood: null,
    publishAllowed: false,
  };
}

export function markPublished<T>(plan: SourceRefreshPlan<T>): SourceRefreshPlan<T> {
  if (!plan.publishAllowed || !plan.proposedLastGood || plan.proposedLastGood.snapshot.items.length === 0) {
    return markPublishFailed(plan, "refusing to publish an invalid or empty snapshot");
  }
  return {
    ...plan,
    status: "SUCCESS",
    health: {
      ...plan.health,
      last_success_at: plan.proposedLastGood.snapshot.collectedAt,
      last_good_snapshot_id: plan.proposedLastGood.snapshot.snapshotId,
      failure_stage: null,
      failure_reason: null,
    },
  };
}
