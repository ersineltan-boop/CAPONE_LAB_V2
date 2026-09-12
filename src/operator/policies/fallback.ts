import { BLOCK_SIGNALS, COLLECT_ROUTE_ORDER } from "../constants";
import type { CollectEvidenceRoute } from "../types";

export type FallbackOutcome =
  | { status: "TRY_NEXT"; nextRoute: CollectEvidenceRoute; attempted: CollectEvidenceRoute[] }
  | { status: "REVIEW" | "BLOCKED"; reason: string; attempted: CollectEvidenceRoute[] };

export function classifyBlockSignal(message: string): (typeof BLOCK_SIGNALS)[number] | "unknown" {
  const lower = message.toLowerCase();
  if (lower.includes("cloudflare")) return "cloudflare";
  if (lower.includes("datadome")) return "datadome";
  if (lower.includes("429") || lower.includes("rate limit")) return "rate_limit";
  if (lower.includes("javascript") || lower.includes("js render")) return "javascript_rendering";
  if (lower.includes("api")) return "api_failure";
  if (lower.includes("markup") || lower.includes("selector")) return "changed_markup";
  return "unknown";
}

export function nextCollectRoute(
  attempted: readonly CollectEvidenceRoute[],
  failureMessage: string,
): FallbackOutcome {
  const used = [...attempted];
  const remaining = COLLECT_ROUTE_ORDER.filter((route) => !used.includes(route));
  if (remaining.length > 0) {
    return { status: "TRY_NEXT", nextRoute: remaining[0]!, attempted: used };
  }

  const signal = classifyBlockSignal(failureMessage);
  const reason = `All deterministic collect routes exhausted (${used.join(" → ")}). Signal: ${signal}. ${failureMessage}`;
  if (signal === "cloudflare" || signal === "datadome") {
    return { status: "BLOCKED", reason, attempted: used };
  }
  return { status: "REVIEW", reason, attempted: used };
}

export function mustNotLoopEndlessly(attempted: readonly CollectEvidenceRoute[]): boolean {
  return attempted.length <= COLLECT_ROUTE_ORDER.length &&
    new Set(attempted).size === attempted.length;
}
