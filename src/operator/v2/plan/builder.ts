import type { ApprovalGate, TaskState } from "../../types";
import type { JobStep, ParsedIntent, V2TemplateId } from "../types";

const VALID_TRANSITIONS: Record<TaskState, readonly TaskState[]> = {
  QUEUED: ["DISCOVERING", "VALIDATING", "REVIEW", "BLOCKED"],
  DISCOVERING: ["COLLECTING", "REVIEW", "BLOCKED", "FAILED"],
  COLLECTING: ["NORMALIZING", "REVIEW", "BLOCKED", "FAILED"],
  NORMALIZING: ["CLASSIFYING", "VALIDATING", "REVIEW", "BLOCKED", "FAILED"],
  CLASSIFYING: ["GROUPING", "VALIDATING", "REVIEW", "BLOCKED", "FAILED"],
  GROUPING: ["VALIDATING", "REVIEW", "BLOCKED", "FAILED"],
  VALIDATING: ["REVIEW", "BLOCKED", "READY", "FAILED"],
  REVIEW: [],
  BLOCKED: [],
  READY: [],
  FAILED: [],
};

export function isValidPlanTransition(from: TaskState, to: TaskState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertValidPlanSequence(steps: readonly JobStep[]): void {
  let previous: TaskState = "QUEUED";
  for (const step of steps) {
    if (!isValidPlanTransition(previous, step.state) && previous !== step.state) {
      throw new Error(`Invalid plan transition: ${previous} → ${step.state}`);
    }
    previous = step.state;
  }
}

function step(
  id: string,
  state: TaskState,
  title: string,
  detail: string,
  extras: Partial<Pick<JobStep, "auto" | "command" | "requiresOwnerApproval" | "approvalGates">> = {},
): JobStep {
  return {
    id,
    state,
    title,
    detail,
    auto: extras.auto ?? true,
    command: extras.command ?? null,
    requiresOwnerApproval: extras.requiresOwnerApproval ?? false,
    approvalGates: extras.approvalGates ?? [],
    status: "PENDING",
  };
}

const OWNER_GATES: ApprovalGate[] = [
  "COMMIT",
  "PUSH",
  "PR_MERGE",
  "WRITE_MAIN",
  "PRODUCTION_DEPLOY",
];

function productOnboardingPlan(intent: ParsedIntent): JobStep[] {
  const target = intent.targetName ?? "hedef";
  return [
    step("discover-source", "DISCOVERING", "Kaynak / locale keşfi", `${target} vitrin dili ve giriş noktaları planlanır`),
    step("discover-collector", "DISCOVERING", "Collector stratejisi", "HTTP → JSON-LD → storefront API → browser sırası"),
    step("discover-footwear", "DISCOVERING", "Footwear kapsamı", "Çanta/aksesuar sızması REVIEW; emin olunmayan silinmez"),
    step("discover-identity", "DISCOVERING", "Model / renk kimliği", "Aynı model renkleri birleşir; LUNA vs LUNA 2 ayrı kalır"),
    step("discover-gallery", "DISCOVERING", "Gallery stratejisi", "Hero + gerçek gallery; logo/badge/new/nav reddi"),
    step("discover-newness", "DISCOVERING", "New Arrival kaynak stratejisi", "collectedAt yeni sayılmaz; kaynak kanıtı gerekir"),
    step("collect-plan", "COLLECTING", "Collector komutları", "Phase 1: canlı collect yok; plan kaydedilir", {
      requiresOwnerApproval: true,
    }),
    step("normalize", "NORMALIZING", "Kaynak normalizasyonu", "URL, fiyat, varyant ve provenance korunur"),
    step("classify", "CLASSIFYING", "Locale-aware taxonomy", "Diğer final değil; evidence escalation zorunlu"),
    step("group", "GROUPING", "Model / renk gruplama", "Varyant price/currency/URL/images korunur"),
    step("validate-qa", "VALIDATING", "Görsel / kategori / sızıntı / new-arrival QA", "Domain sızıntısı ve boş collect koruması"),
    step("validate-tests", "VALIDATING", "Test / tsc / build planı", "Allowlist komutları; Phase 1 no-op", {
      command: ["npm", "run", "operator:test"],
    }),
  ];
}

function marketPlan(intent: ParsedIntent): JobStep[] {
  return [
    step("discover-market", "DISCOVERING", "Satış pazarı keşfi", `${intent.salesMarket ?? "ülke"} satış kanıtı; originCountry ayrıdır`),
    step("collect-plan", "COLLECTING", "Market collect planı", "Markalar/Pazaryerleri/Visual yazılmaz", {
      requiresOwnerApproval: true,
    }),
    step("normalize-prices", "NORMALIZING", "Fiyat normalizasyonu", "Price intel ayrı registry'de kalır"),
    step("validate-isolation", "VALIDATING", "Domain izolasyonu", "Market Research Product Research listelerine sızmaz"),
  ];
}

function qaPlan(detail: string): JobStep[] {
  return [
    step("validate-qa", "VALIDATING", "QA", detail, {
      command: ["npm", "run", "operator:check"],
    }),
  ];
}

export function buildExecutionPlan(intent: ParsedIntent): JobStep[] {
  if (intent.ambiguous || intent.injectionAttempt || !intent.domain) {
    return [
      step("review-ambiguous", "REVIEW", "Belirsiz görev", intent.reason, {
        auto: false,
        requiresOwnerApproval: true,
      }),
    ];
  }

  const plans: Record<V2TemplateId, () => JobStep[]> = {
    PRODUCT_RESEARCH_BRAND_ONBOARDING: () => productOnboardingPlan(intent),
    PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING: () => productOnboardingPlan(intent),
    PRODUCT_RESEARCH_REFRESH: () => productOnboardingPlan(intent),
    PRODUCT_RESEARCH_CATALOG_QA: () =>
      qaPlan("Kategori evidence zinciri + gallery reddi; uydurma sınıf yok"),
    PRODUCT_RESEARCH_NEW_ARRIVALS_QA: () =>
      qaPlan("New Arrival = kaynak kanıtı; collectedAt yeterli değil"),
    PRODUCT_RESEARCH_VISUAL_DEDUPE_QA: () =>
      qaPlan("Visual kanonik olabilir; brand + marketplace provenance silinmez"),
    MARKET_RESEARCH_BRAND_ONBOARDING: () => marketPlan(intent),
    MARKET_RESEARCH_BRAND_REFRESH: () => marketPlan(intent),
    MARKET_RESEARCH_COUNTRY_REFRESH: () => marketPlan(intent),
    MARKET_RESEARCH_PRICE_STATUS: () => marketPlan(intent),
    QA_ONLY: () => qaPlan("Operator policy check"),
    AMBIGUOUS_REVIEW: () => [
      step("review-ambiguous", "REVIEW", "Belirsiz görev", intent.reason, {
        auto: false,
        requiresOwnerApproval: true,
      }),
    ],
  };

  const steps = [...plans[intent.template](), step(
    "owner-gate",
    "REVIEW",
    "Owner onay kapısı",
    "Commit / push / deploy / canlı collect DENY",
    {
      auto: false,
      requiresOwnerApproval: true,
      approvalGates: OWNER_GATES,
    },
  )];
  assertValidPlanSequence(steps);
  return steps;
}
