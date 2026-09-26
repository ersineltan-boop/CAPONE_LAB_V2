import { useMemo, useState } from "react";

import universe from "../../../data/registry/brand-universe.json";
import queue from "../../../data/registry/brand-onboarding-queue.json";
import report from "../../../data/registry/brand-onboarding-report.json";
import discovery from "../../../data/registry/brand-discovery-report.json";
import {
  buildBrandOnboardingDashboard,
  statusLabel,
  type DashboardFilter,
} from "../../brandOnboarding/dashboard";
import type { BrandDiscoveryReport } from "../../onboarding/discovery";
import type { BrandOnboardingQueueFile, BrandOnboardingReportFile } from "../../onboarding/types";
import type { BrandUniverseFile } from "../../registry/build/types";

const FILTERS: Array<{ id: DashboardFilter; label: string }> = [
  { id: "ALL", label: "Tüm adaylar" },
  { id: "PRIORITY", label: "Öncelikli markalar" },
  { id: "TONIGHT", label: "Bu gece" },
  { id: "READY", label: "Hazır / eklendi" },
  { id: "PARTIAL", label: "Eksik kapsam" },
  { id: "CUSTOM_ADAPTER_REQUIRED", label: "Özel adaptör" },
  { id: "BLOCKED", label: "Engelli" },
  { id: "DISCOVERED", label: "Yeni keşfedilen" },
];

function formatDate(value: string | null): string {
  if (!value) return "Henüz yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

export default function BrandOnboardingDashboard() {
  const dashboard = useMemo(
    () =>
      buildBrandOnboardingDashboard(
        universe as BrandUniverseFile,
        queue as BrandOnboardingQueueFile,
        report as BrandOnboardingReportFile,
        discovery as BrandDiscoveryReport,
      ),
    [],
  );
  const [filter, setFilter] = useState<DashboardFilter>("ALL");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

  const visibleBrands = dashboard.brands.filter((entry) => {
    if (normalizedQuery && !`${entry.brand} ${entry.country}`.toLocaleLowerCase("tr-TR").includes(normalizedQuery)) {
      return false;
    }
    if (filter === "ALL") return !entry.isActive;
    if (filter === "PRIORITY") return entry.isPriority && !entry.isActive;
    if (filter === "TONIGHT") return entry.isTonight;
    if (filter === "READY") return entry.status === "READY" || entry.status === "ACTIVE";
    if (filter === "PARTIAL") return entry.status === "PARTIAL";
    if (filter === "CUSTOM_ADAPTER_REQUIRED") return entry.status === "CUSTOM_ADAPTER_REQUIRED";
    if (filter === "BLOCKED") {
      return ["BLOCKED", "PRIORITY_BLOCKED", "FAILED", "STORAGE_LIMIT"].includes(entry.status);
    }
    return false;
  });
  const visibleDiscoveries = filter === "DISCOVERED"
    ? dashboard.discoveries.filter((entry) =>
        !normalizedQuery || entry.brand.toLocaleLowerCase("tr-TR").includes(normalizedQuery),
      )
    : [];

  const cards = [
    ["Aktif marka", dashboard.summary.active],
    ["Aday havuzu", dashboard.summary.candidatePool],
    ["Bu gece denenecek", dashboard.summary.tonight],
    ["Hazır / eklenen", dashboard.summary.readyOrActivated],
    ["Özel adaptör", dashboard.summary.customAdapter],
    ["Engelli / başarısız", dashboard.summary.blocked],
    ["Yeni keşfedilen", dashboard.summary.discovered],
  ] as const;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="border-b border-line pb-6">
        <p className="text-[10px] uppercase tracking-[0.24em] text-ink-muted">Kontrol merkezi</p>
        <h2 className="mt-2 font-serif text-3xl tracking-wide sm:text-5xl">Otomatik Marka Yükleme</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-muted">
          Sistem her gece resmi kaynaklı adayları sırayla dener. Yalnız tam kadın ayakkabısı
          kataloğu, görsel ve kategori kontrollerinin tamamını geçen markalar otomatik eklenir.
          Eksik veya engelli kaynaklar mevcut sağlam veriyi değiştiremez.
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-ink-muted">
          Massimo Dutti ve seçili lüks markalar öncelikli takipte. Özel adaptör gerekenler bu listede
          görünür; doğrulanmış resmî katalog sağlandığında yükleme kapısına geçer.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 py-5 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(([label, value]) => (
          <article key={label} className="border border-line bg-white/35 p-3">
            <p className="text-2xl font-medium tabular-nums">{value}</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-ink-muted">{label}</p>
          </article>
        ))}
      </div>

      <div className="mb-5 border border-line bg-cream-dark/50 p-4 text-xs leading-5 text-ink-muted sm:flex sm:items-center sm:justify-between">
        <p><span className="font-medium text-ink">Son çalışma:</span> {formatDate(dashboard.lastRunAt)}</p>
        <p><span className="font-medium text-ink">Otomatik çalışma:</span> {dashboard.nextRunLabel}</p>
        <p><span className="font-medium text-ink">Sınır:</span> 5 deneme · en fazla 3 yeni marka</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Marka veya ülke ara"
          className="min-h-11 border border-line bg-white/60 px-3 text-sm outline-none focus:border-ink"
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as DashboardFilter)}
          className="min-h-11 border border-line bg-cream px-3 text-xs uppercase tracking-wider"
        >
          {FILTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>

      {filter === "DISCOVERED" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDiscoveries.map((entry) => (
            <article key={entry.id} className="border border-line bg-white/35 p-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-ink-muted">Resmî kaynak bekliyor</p>
              <h3 className="mt-1 font-serif text-xl">{entry.brand}</h3>
              <p className="mt-3 text-xs text-ink-muted">
                {entry.productCount} ürün kanıtı · {entry.marketplaceSources.join(", ")}
              </p>
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                Resmî marka sitesi doğrulanmadan otomatik yüklenmez.
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBrands.map((entry) => (
            <article key={entry.id} className={`border p-4 ${entry.isTonight ? "border-ink bg-white/70" : "border-line bg-white/35"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-ink-muted">
                    {entry.isPriority ? "Öncelikli takip" : entry.isTonight ? "Bu gece denenecek" : statusLabel(entry.status)}
                  </p>
                  <h3 className="mt-1 font-serif text-xl">{entry.brand}</h3>
                  <p className="text-xs text-ink-muted">{entry.country || "Ülke belirtilmemiş"}</p>
                </div>
                <span className="border border-line px-2 py-1 text-[9px] uppercase tracking-wide">
                  {statusLabel(entry.status)}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-ink-faint">Deneme</dt><dd>{entry.attempts}</dd></div>
                <div><dt className="text-ink-faint">Bulunan ürün</dt><dd>{entry.productsFound}</dd></div>
                <div className="col-span-2"><dt className="text-ink-faint">Son deneme</dt><dd>{formatDate(entry.lastAttemptAt)}</dd></div>
                {entry.platform ? <div className="col-span-2"><dt className="text-ink-faint">Kaynak</dt><dd>{entry.platform}</dd></div> : null}
              </dl>
              {(entry.blocker || entry.status === "CUSTOM_ADAPTER_REQUIRED") ? (
                <p className="mt-3 border-t border-line-light pt-3 text-xs leading-5 text-ink-muted">
                  {entry.status === "CUSTOM_ADAPTER_REQUIRED"
                    ? "Resmî ayakkabı kataloğunu doğrulamak için özel kaynak adaptörü gerekiyor."
                    : entry.blocker}
                </p>
              ) : null}
              {entry.officialUrl ? (
                <a href={entry.officialUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[10px] uppercase tracking-[0.15em] underline underline-offset-4">
                  Resmî siteyi aç
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {(filter === "DISCOVERED" ? visibleDiscoveries : visibleBrands).length === 0 ? (
        <p className="border border-line p-6 text-sm text-ink-muted">Bu filtrede kayıt bulunamadı.</p>
      ) : null}
    </section>
  );
}
