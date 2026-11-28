const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{2,31}$/;

export function normalizeTeamUsername(value: string): string | null {
  const username = value.trim();
  return USERNAME_PATTERN.test(username) ? username.toLowerCase() : null;
}

export function teamLoginAddress(username: string): string {
  return `${username}@accounts.capone.invalid`;
}

export function isNewTeamPassword(value: string): boolean {
  return [...value].length >= 12 && new TextEncoder().encode(value).length <= 72;
}
