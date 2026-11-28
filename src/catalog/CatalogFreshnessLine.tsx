import { formatDateTurkish } from "../presentation/turkishDates";
import type { CatalogSourceFreshness } from "./types";

interface CatalogFreshnessLineProps {
  freshness?: CatalogSourceFreshness;
  productCheckLabel: string;
}

export function CatalogFreshnessLine({ freshness, productCheckLabel }: CatalogFreshnessLineProps) {
  return (
    <p className="text-xs text-ink-muted">
      {freshness ? (
        <>
          {freshness.kind === "verified-update" ? "Son doğrulanmış güncelleme" : productCheckLabel}{" "}
          <time dateTime={freshness.at}>{formatDateTurkish(freshness.at, "Europe/Istanbul")}</time>
        </>
      ) : "Son doğrulanmış güncelleme tarihi bulunamadı."}
    </p>
  );
}
