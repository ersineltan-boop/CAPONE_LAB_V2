import { formatDateTurkishShort } from "../presentation/turkishDates";
import type { MarketResearchPriceObservation } from "./types";

const CURRENCY_LOCALE = "tr-TR";

export function formatMarketResearchMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMarketResearchObservedAt(value: string): string {
  return formatDateTurkishShort(value);
}

export function formatMarketResearchPrice(observation: MarketResearchPriceObservation): {
  current: string | null;
  list: string | null;
  discount: string | null;
  observedAt: string;
} {
  return {
    current:
      observation.currentPrice != null
        ? formatMarketResearchMoney(observation.currentPrice, observation.currency)
        : null,
    list:
      observation.listPrice != null &&
      observation.currentPrice != null &&
      observation.listPrice > observation.currentPrice
        ? formatMarketResearchMoney(observation.listPrice, observation.currency)
        : null,
    discount: observation.discountPercent != null ? `%${observation.discountPercent}` : null,
    observedAt: formatMarketResearchObservedAt(observation.observedAt),
  };
}
