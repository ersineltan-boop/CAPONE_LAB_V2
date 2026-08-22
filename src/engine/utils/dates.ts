const MS_PER_DAY = 86_400_000;

export function parseIsoDate(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Geçersiz ISO tarih: ${iso}`);
  }
  return date;
}

export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

export function isWithinDays(
  observedAt: string,
  reference: Date,
  days: number,
): boolean {
  const observed = parseIsoDate(observedAt);
  const diff = daysBetween(observed, reference);
  return diff >= 0 && diff <= days;
}

export function isInWindow(
  observedAt: string,
  reference: Date,
  startDaysAgo: number,
  endDaysAgo: number,
): boolean {
  const observed = parseIsoDate(observedAt);
  const diff = daysBetween(observed, reference);
  return diff >= endDaysAgo && diff <= startDaysAgo;
}
