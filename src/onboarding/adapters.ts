import type { OnboardingAdapterConfig } from "./types";

let testAdapters: Record<string, OnboardingAdapterConfig> | null = null;
const runtimeAdapters: Record<string, OnboardingAdapterConfig> = {};

export function setOnboardingAdaptersForTest(
  adapters: Record<string, OnboardingAdapterConfig> | null,
): void {
  testAdapters = adapters;
}

export function rememberOnboardingAdapter(
  slug: string,
  adapter: OnboardingAdapterConfig,
): void {
  runtimeAdapters[slug] = adapter;
}

export function getOnboardingAdapter(slug: string): OnboardingAdapterConfig | null {
  if (testAdapters) return testAdapters[slug] ?? null;
  return runtimeAdapters[slug] ?? null;
}

export function upsertAdapter(
  file: { version: 1; updatedAt: string; adapters: Record<string, OnboardingAdapterConfig> },
  slug: string,
  adapter: OnboardingAdapterConfig,
  now = new Date(),
): { version: 1; updatedAt: string; adapters: Record<string, OnboardingAdapterConfig> } {
  rememberOnboardingAdapter(slug, adapter);
  return {
    version: 1,
    updatedAt: now.toISOString(),
    adapters: { ...file.adapters, [slug]: adapter },
  };
}

export function parseInditexLocale(notes: string | null | undefined): string | null {
  const match = notes?.match(/\binditex-like-catalog(?:\s+locale=([a-z]{2}(?:\/[a-z]{2})?))?/i);
  if (!match) return null;
  return match[1] ?? "us/en";
}
