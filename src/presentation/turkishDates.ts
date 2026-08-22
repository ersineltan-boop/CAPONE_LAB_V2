const TR_LOCALE = "tr-TR";

export function formatDateTurkish(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString(TR_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTurkishShort(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString(TR_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeDateTurkish(
  value: string,
  referenceDate: string = new Date().toISOString(),
): string {
  const parsed = Date.parse(value);
  const ref = Date.parse(referenceDate);
  if (Number.isNaN(parsed) || Number.isNaN(ref)) return value;

  const seen = new Date(parsed);
  const refDay = new Date(ref);
  seen.setHours(0, 0, 0, 0);
  refDay.setHours(0, 0, 0, 0);

  const dayDiff = Math.round((refDay.getTime() - seen.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff <= 0) return "Bugün";
  if (dayDiff === 1) return "Dün";
  if (dayDiff <= 7) return `${dayDiff} gün önce`;

  return formatDateTurkishShort(value);
}
