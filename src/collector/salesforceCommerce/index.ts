export { assessSalesforceCatalog, decideSalesforcePublish } from "./coverage";
export { collectCasadeiWomensShoes, parseCasadeiMobifySearch, casadeiListingUrl, CASADEI_SCOPE } from "./casadei";
export {
  collectJilSanderWomensShoes,
  parseJilSanderTiles,
  parseJilSanderVariation,
  parseJilSanderResultTotal,
  jilSanderListingUrl,
  jilSanderModelCode,
  JIL_SANDER_SCOPE,
} from "./jilSander";
export {
  collectJacquemusWomensShoes,
  isJacquemusStorefrontBlocked,
  JACQUEMUS_PROBE_URLS,
  JACQUEMUS_SCOPE,
} from "./jacquemus";
export { groupColorwaysIntoModelCards } from "./families";

/**
 * Codex integration patch. Original Cursor handoff plus verified Codex integration.
 * Do not apply it by editing production catalogs in this change.
 */
export const SALESFORCE_INTEGRATION_PATCH = [
  "src/onboarding/collect.ts, src/onboarding/probe.ts, and src/registry/collection/collectByType.ts now use the guarded official US Salesforce integration.",
  "Casadei refresh: collectCasadeiWomensShoes. Scope is the US en-us storefront, cgid=shoes, public mobify-data search state, page query pagination.",
  "Jil Sander refresh: collectJilSanderWomensShoes. Scope is the US en-us storefront, cgid=jilsander-woman-other-shoes, Search-ShowAjax plus Product-Variation.",
  "Jacquemus stays unpublished. Official pages returned HTTP 403 maintenance/failover; do not open an empty collection and do not mark the source FULL.",
  "First catalogs are baselines. Do not set isNew, hasNewBadge, or inNewArrivals on the initial import.",
  "Publish last-good only when status is FULL. PARTIAL, BLOCKED, FAILED, and empty results must retain the previous last-good.",
  "Do not display prices. Keep every accepted colourway gallery and size SKU. Group colourways of one model onto one card; the cover image is a product photo.",
  "Suggested registry patch after a FULL catalog exists: collectorType CUSTOM_ADAPTER for casadei and jil-sander only. Leave jacquemus inactive.",
  "Refresh command: npm run collect:salesforce-womens-footwear. Activated casadei and jil-sander also use the existing daily official-source refresh.",
].join("\n");
