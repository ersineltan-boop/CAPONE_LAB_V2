export function normalizeBrandId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeBrandName(input: string): string {
  return input.trim().toUpperCase();
}

export function normalizeOfficialUrl(input: string): string {
  try {
    const url = new URL(input.trim());
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "") || ""}`.toLowerCase();
  } catch {
    return input.trim().toLowerCase().replace(/\/$/, "");
  }
}

export function isValidHttpUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
