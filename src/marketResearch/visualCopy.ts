import { UI_COPY } from "../presentation/turkishLabels";
import type { MarketResearchVisualStatus } from "./types";

export function marketResearchVisualLabel(
  status: MarketResearchVisualStatus | undefined,
  note?: string,
): string {
  if (status === "source_unavailable") {
    return note ? `${UI_COPY.marketResearchSourceUnavailable}: ${note}` : UI_COPY.marketResearchSourceUnavailable;
  }
  if (status === "model_unavailable" || status === "no_models") {
    return note ?? UI_COPY.marketResearchModelUnavailable;
  }
  return UI_COPY.noImage;
}

export function isIncompleteMarketResearchVisual(status: MarketResearchVisualStatus | undefined): boolean {
  return status === "source_unavailable" || status === "model_unavailable" || status === "no_models";
}
