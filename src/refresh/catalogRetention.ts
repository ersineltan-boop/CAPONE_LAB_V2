import type { PilotProduct } from "../collector/types";

export const MINIMUM_RETAINED_MODELS = 0.6;

export function retainedModelCountBlocker(previous: number, proposed: number, source: string): string | null {
  if (!Number.isInteger(previous) || !Number.isInteger(proposed) || previous < 0 || proposed < 0) {
    return `${source}: invalid model count`;
  }
  if (previous > 0 && proposed < Math.ceil(previous * MINIMUM_RETAINED_MODELS)) {
    return `${source}: ${proposed} models would replace ${previous} last-good models`;
  }
  return null;
}

/** A failed membership check must retain the pre-run source, including NEW evidence. */
export function preserveSourceBeforeFailedMembership(
  catalog: readonly PilotProduct[],
  previous: readonly PilotProduct[],
  source: string,
): PilotProduct[] {
  return [
    ...catalog.filter((product) => product.source !== source),
    ...previous.filter((product) => product.source === source),
  ];
}
