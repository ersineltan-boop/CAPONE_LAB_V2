import { cleanHeelHeight } from "../cleanText";
import type { HeelHeightGroup } from "../types";

function parseHeightCm(cleaned: string): number | null {
  const cmMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*cm/i);
  if (cmMatch) return parseFloat(cmMatch[1]);

  const mmMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*mm/i);
  if (mmMatch) return parseFloat(mmMatch[1]) / 10;

  const inMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?:in|inches|")/i);
  if (inMatch) return parseFloat(inMatch[1]) * 2.54;

  const inShort = cleaned.match(/^(\d+(?:\.\d+)?)\s*In$/i);
  if (inShort) return parseFloat(inShort[1]) * 2.54;

  return null;
}

export function normalizeHeelHeightGroup(
  rawHeelHeight: string | null,
  productName: string,
  material: string | null,
): { group: HeelHeightGroup; cleaned: string | null } {
  const cleaned =
    cleanHeelHeight(rawHeelHeight) ??
    cleanHeelHeight(material) ??
    cleanHeelHeight(productName);

  if (!cleaned) return { group: "UNKNOWN", cleaned: null };

  const cm = parseHeightCm(cleaned);
  if (cm === null) return { group: "UNKNOWN", cleaned };

  if (cm <= 2) return { group: "FLAT", cleaned };
  if (cm <= 5) return { group: "LOW", cleaned };
  if (cm <= 8) return { group: "MID", cleaned };
  return { group: "HIGH", cleaned };
}
