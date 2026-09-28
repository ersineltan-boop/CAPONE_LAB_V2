export function priorityRefreshBlocker(input: {
  previousCount: number;
  currentCount: number;
  freshCount: number;
  errors: readonly string[];
  completed: boolean;
}): string | null {
  if (!input.completed) return "Source pagination or sitemap traversal did not finish";
  if (input.errors.length > 0) return `Source reported ${input.errors.length} error(s)`;
  if (input.freshCount <= 0) return "No fresh products verified";
  if (input.freshCount < input.previousCount * 0.8) return "Fresh products fell below 80% of last-good";
  if (input.currentCount < input.previousCount) return "Last-good products were removed";
  return null;
}
