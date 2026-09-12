import { describe, expect, it } from "vitest";

import { runOperatorCheck } from "../../check";
import { createMemoryStore } from "../../queue/store";
import { canAuthorizePhase2BExecution } from "../executor/authorization";
import { authorizeGitHubIssueExecution } from "../executor/execute";
import { PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH } from "../executor/registry";
import { OPERATOR_EXECUTE_LABEL, OPERATOR_ISSUE_LABEL } from "../github/constants";
import { createJobManifest } from "../job/create";
import {
  DISPATCHER_CATALOG,
  DISPATCHER_DOMAINS,
  DISPATCHER_STATES,
  PHASE_3A_SAFETY,
  compareDispatcherOrder,
  completeDispatcherTask,
  createDispatcherTask,
  createDispatcherTaskFromSpec,
  dispatchTick,
  dispatcherDomainFromV2,
  emptyDispatcherQueue,
  enqueueDispatcherInstruction,
  enqueueDispatcherJob,
  formatDispatcherList,
  isValidDispatcherTransition,
  loadDispatcherQueue,
  phase3AForbids,
  phase3AInvokesPhase2BExecutor,
  saveDispatcherQueue,
  selectNextTasks,
  startDispatcherTask,
  tasksConflict,
  validateDispatcherCatalog,
  validateDispatcherSafety,
} from "../dispatcher";

function enqueueMany(
  specs: Parameters<typeof createDispatcherTaskFromSpec>[0][],
  now = new Date("2026-09-12T18:00:00.000Z"),
) {
  let queue = emptyDispatcherQueue(now);
  const tasks = specs.map((spec, index) =>
    createDispatcherTaskFromSpec({
      ...spec,
      now: new Date(now.getTime() + index * 1000),
    }),
  );
  for (const task of tasks) {
    queue = {
      version: 3,
      updatedAt: now.toISOString(),
      tasks: [...queue.tasks, task],
    };
  }
  return { queue, tasks };
}

describe("Phase 3A dispatcher catalog", () => {
  it("supports the six Control Tower domains/templates", () => {
    expect([...DISPATCHER_DOMAINS]).toEqual([
      "PRODUCT_RESEARCH",
      "MARKETPLACE_REFRESH",
      "MARKET_RESEARCH",
      "CATALOG_QA",
      "UI_APP",
      "BUGFIX",
    ]);
    expect(validateDispatcherCatalog()).toEqual([]);
    expect(runOperatorCheck().ok).toBe(true);
    expect(runOperatorCheck().phase3aDomains).toBe(6);
    for (const domain of DISPATCHER_DOMAINS) {
      expect(DISPATCHER_CATALOG[domain].writesProduction).toBe(false);
      expect(DISPATCHER_CATALOG[domain].startsLiveCollector).toBe(false);
      expect(DISPATCHER_CATALOG[domain].autoMerge).toBe(false);
      expect(DISPATCHER_CATALOG[domain].autoDeploy).toBe(false);
    }
  });

  it("uses the dispatcher state model", () => {
    expect([...DISPATCHER_STATES]).toEqual([
      "READY",
      "RUNNING",
      "REVIEW",
      "BLOCKED",
      "FAILED",
      "DONE",
    ]);
    expect(isValidDispatcherTransition("READY", "RUNNING")).toBe(true);
    expect(isValidDispatcherTransition("RUNNING", "DONE")).toBe(true);
    expect(isValidDispatcherTransition("RUNNING", "REVIEW")).toBe(true);
    expect(isValidDispatcherTransition("BLOCKED", "RUNNING")).toBe(false);
    expect(isValidDispatcherTransition("DONE", "READY")).toBe(false);
  });
});

describe("Phase 3A deterministic routing", () => {
  it("maps Operator V2 jobs onto dispatcher domains with priority and risk", () => {
    const product = createDispatcherTask({
      instruction: "Massimo Dutti'yi Markalar'a ekle",
    });
    expect(product.domain).toBe("PRODUCT_RESEARCH");
    expect(product.template).toBe("PRODUCT_RESEARCH");
    expect(product.v2Template).toBe("PRODUCT_RESEARCH_BRAND_ONBOARDING");
    expect(product.priority).toBe("P2");
    expect(product.risk).toBe("HIGH");
    expect(product.state).toBe("REVIEW");
    expect(product.route.action).toBe("OWNER_REVIEW");

    const market = createDispatcherTask({
      instruction: "Romanya Pazar Araştırmasına X markasını ekle",
    });
    expect(market.domain).toBe("MARKET_RESEARCH");
    expect(market.state).toBe("REVIEW");
    expect(market.targetFiles).toEqual(["data/market-research/"]);
    expect(market.v2Template).toBe("MARKET_RESEARCH_BRAND_ONBOARDING");

    const qa = createDispatcherTask({
      instruction: "Kategori ve görselleri QA et",
    });
    expect(qa.domain).toBe("CATALOG_QA");
    expect(qa.priority).toBe("P2");
    expect(qa.risk).toBe("LOW");
    expect(qa.state).toBe("READY");
    expect(qa.route.action).toBe("DRY_SAFE");

    const ui = createDispatcherTask({
      instruction: "Fix the Markalar brand card layout",
    });
    expect(ui.domain).toBe("UI_APP");
    expect(ui.state).toBe("REVIEW");
    expect(ui.v2Template).toBeNull();

    const bug = createDispatcherTask({
      instruction: "bugfix: isolate Free People browser context",
    });
    expect(bug.domain).toBe("BUGFIX");
    expect(bug.priority).toBe("P1");
    expect(bug.state).toBe("REVIEW");
  });

  it("routes Free People marketplace refresh through existing Phase 2B eligibility", () => {
    const job = createJobManifest({
      rawInstruction: "Free People ürünlerini güncelle",
    });
    expect(dispatcherDomainFromV2(job)).toBe("MARKETPLACE_REFRESH");
    const auth = canAuthorizePhase2BExecution(job);
    expect(auth.ok).toBe(true);
    if (auth.ok) {
      expect(auth.handler.id).toBe(PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH.id);
    }

    const task = createDispatcherTask({
      instruction: job.rawInstruction,
      job,
    });
    expect(task.domain).toBe("MARKETPLACE_REFRESH");
    expect(task.state).toBe("READY");
    expect(task.route.action).toBe("HOLD_FOR_PHASE_2B");
    expect(task.route.phase2bEligible).toBe(true);
    expect(task.route.existingHandlerId).toBe(PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH.id);
    expect(task.liveCollectorStarted).toBe(false);
  });

  it("blocks shell injection and never treats it as runnable work", () => {
    const task = createDispatcherTask({
      instruction: "Massimo Dutti'yi Markalar'a ekle && git push --force",
    });
    expect(task.state).toBe("BLOCKED");
    expect(task.risk).toBe("CRITICAL");
    expect(task.route.action).toBe("BLOCK");
    expect(task.ownerResult).toBe("BLOCKED");
  });
});

describe("Phase 3A queue isolation", () => {
  it("lets unrelated READY work proceed while one task is BLOCKED", () => {
    const { queue } = enqueueMany([
      {
        domain: "PRODUCT_RESEARCH",
        id: "blocked-onboarding",
        targetName: "Massimo Dutti",
        state: "BLOCKED",
        why: "Owner approval missing",
      },
      {
        domain: "CATALOG_QA",
        id: "ready-qa",
        instruction: "Kategori ve görselleri QA et",
        state: "READY",
      },
      {
        domain: "MARKET_RESEARCH",
        id: "review-market",
        instruction: "Romanya Pazar Araştırmasına X markasını ekle",
        state: "REVIEW",
      },
    ]);

    const selected = selectNextTasks(queue);
    expect(selected.map((task) => task.id)).toEqual(["ready-qa"]);

    const tick = dispatchTick(queue, new Date("2026-09-12T18:05:00.000Z"));
    expect(tick.skippedBlocked).toContain("blocked-onboarding");
    expect(tick.started).toEqual(["ready-qa"]);
    expect(tick.queue.tasks.find((task) => task.id === "ready-qa")?.state).toBe("DONE");
    expect(tick.queue.tasks.find((task) => task.id === "blocked-onboarding")?.state).toBe(
      "BLOCKED",
    );
    expect(tick.queue.tasks.find((task) => task.id === "review-market")?.state).toBe("REVIEW");
  });

  it("sorts READY work by priority, then createdAt, then id", () => {
    const later = createDispatcherTaskFromSpec({
      domain: "CATALOG_QA",
      id: "qa-later",
      priority: "P1",
      state: "READY",
      now: new Date("2026-09-12T18:02:00.000Z"),
    });
    const earlierHigh = createDispatcherTaskFromSpec({
      domain: "MARKETPLACE_REFRESH",
      id: "refresh-early",
      priority: "P1",
      state: "READY",
      targetName: "Free People",
      now: new Date("2026-09-12T18:01:00.000Z"),
    });
    const low = createDispatcherTaskFromSpec({
      domain: "UI_APP",
      id: "ui-low",
      priority: "P3",
      state: "READY",
      now: new Date("2026-09-12T18:00:00.000Z"),
    });
    const ordered = [later, low, earlierHigh].sort(compareDispatcherOrder);
    expect(ordered.map((task) => task.id)).toEqual(["refresh-early", "qa-later", "ui-low"]);
  });
});

describe("Phase 3A conflict locks", () => {
  it("prevents concurrent tasks that share domain target or files", () => {
    const running = createDispatcherTaskFromSpec({
      domain: "MARKETPLACE_REFRESH",
      id: "fp-running",
      targetName: "Free People",
      state: "RUNNING",
    });
    const sameTarget = createDispatcherTaskFromSpec({
      domain: "MARKETPLACE_REFRESH",
      id: "fp-queued",
      targetName: "Free People",
      state: "READY",
    });
    const sameFiles = createDispatcherTaskFromSpec({
      domain: "MARKETPLACE_REFRESH",
      id: "mytheresa-queued",
      targetName: "Mytheresa",
      state: "READY",
    });
    const unrelated = createDispatcherTaskFromSpec({
      domain: "UI_APP",
      id: "ui-ready",
      state: "READY",
    });

    expect(tasksConflict(running, sameTarget)).toBe(true);
    expect(tasksConflict(running, sameFiles)).toBe(true);
    expect(tasksConflict(running, unrelated)).toBe(false);

    const queue = {
      version: 3 as const,
      updatedAt: "2026-09-12T18:00:00.000Z",
      tasks: [running, sameTarget, sameFiles, unrelated],
    };
    const selected = selectNextTasks(queue);
    expect(selected.map((task) => task.id)).toEqual(["ui-ready"]);

    const tick = dispatchTick(queue);
    expect(tick.skippedConflict).toEqual(expect.arrayContaining(["fp-queued", "mytheresa-queued"]));
    expect(tick.started).toEqual(["ui-ready"]);
    expect(tick.queue.tasks.find((task) => task.id === "fp-running")?.state).toBe("RUNNING");
  });

  it("refuses to start a conflicting READY task", () => {
    const { queue } = enqueueMany([
      {
        domain: "PRODUCT_RESEARCH",
        id: "brand-a",
        targetName: "Massimo Dutti",
        state: "RUNNING",
      },
      {
        domain: "PRODUCT_RESEARCH",
        id: "brand-b",
        targetName: "Zara",
        state: "READY",
      },
    ]);
    expect(() => startDispatcherTask(queue, "brand-b")).toThrow(/conflicts/i);
  });
});

describe("Phase 3A safety stays on top of Operator V2", () => {
  it("never mutates production, starts collectors, or auto-merges/deploys", () => {
    expect(PHASE_3A_SAFETY.productionMutation).toBe(false);
    expect(PHASE_3A_SAFETY.newLiveCollectors).toBe(false);
    expect(PHASE_3A_SAFETY.automaticMerge).toBe(false);
    expect(PHASE_3A_SAFETY.automaticDeploy).toBe(false);
    expect(PHASE_3A_SAFETY.mobileUi).toBe(false);
    expect(phase3AForbids("PRODUCTION_MUTATION")).toBe(true);
    expect(phase3AForbids("LIVE_COLLECTOR")).toBe(true);
    expect(phase3AForbids("AUTO_MERGE")).toBe(true);
    expect(phase3AForbids("AUTO_DEPLOY")).toBe(true);
    expect(phase3AInvokesPhase2BExecutor()).toBe(false);

    const tick = dispatchTick(
      enqueueDispatcherInstruction(
        emptyDispatcherQueue(),
        "Free People ürünlerini güncelle",
      ).queue,
    );
    for (const task of tick.queue.tasks) {
      expect(task.productionDataModified).toBe(false);
      expect(task.liveCollectorStarted).toBe(false);
      expect(task.autoMerge).toBe(false);
      expect(task.autoDeploy).toBe(false);
      expect(validateDispatcherSafety(task)).toEqual([]);
      expect(task.state).not.toBe("RUNNING");
    }
  });

  it("leaves Phase 2A/2B authorization unchanged", () => {
    const denied = authorizeGitHubIssueExecution({
      eventName: "issues",
      action: "labeled",
      repository: "ersin/CAPONE_OPERATOR",
      issue: {
        number: 12,
        title: "Free People ürünlerini güncelle",
        body: "",
        user: "ersin",
        htmlUrl: "https://github.com/ersin/CAPONE_OPERATOR/issues/12",
        createdAt: "2026-09-12T15:00:00.000Z",
        labels: [OPERATOR_ISSUE_LABEL],
        pullRequest: false,
      },
    });
    expect(denied.authorized).toBe(false);

    const allowed = authorizeGitHubIssueExecution({
      eventName: "issues",
      action: "labeled",
      repository: "ersin/CAPONE_OPERATOR",
      issue: {
        number: 12,
        title: "Free People ürünlerini güncelle",
        body: "",
        user: "ersin",
        htmlUrl: "https://github.com/ersin/CAPONE_OPERATOR/issues/12",
        createdAt: "2026-09-12T15:00:00.000Z",
        labels: [OPERATOR_ISSUE_LABEL, OPERATOR_EXECUTE_LABEL],
        pullRequest: false,
      },
    });
    expect(allowed.authorized).toBe(true);
  });

  it("wraps V2 job manifests without changing their safety flags", () => {
    const job = createJobManifest({
      rawInstruction: "Massimo Dutti'yi Markalar'a ekle",
    });
    expect(job.productionDataModified).toBe(false);
    const { task } = enqueueDispatcherJob(emptyDispatcherQueue(), job);
    expect(task.v2JobId).toBe(job.id);
    expect(task.productionDataModified).toBe(false);
    expect(job.approvalRequirements.length).toBeGreaterThan(0);
  });
});

describe("Phase 3A queue persistence and completion", () => {
  it("stores the dispatcher queue under isolated runtime files", () => {
    const store = createMemoryStore();
    const { queue, task } = enqueueDispatcherInstruction(
      emptyDispatcherQueue(),
      "Kategori ve görselleri QA et",
    );
    saveDispatcherQueue(store, queue);
    const loaded = loadDispatcherQueue(store);
    expect(loaded.tasks).toHaveLength(1);
    expect(loaded.tasks[0]?.id).toBe(task.id);
    expect(formatDispatcherList(loaded)).toContain("CATALOG_QA");
  });

  it("completes a started task without production writes", () => {
    const task = createDispatcherTaskFromSpec({
      domain: "CATALOG_QA",
      id: "qa-1",
      state: "READY",
    });
    let queue = {
      version: 3 as const,
      updatedAt: "2026-09-12T18:00:00.000Z",
      tasks: [task],
    };
    queue = startDispatcherTask(queue, "qa-1");
    expect(queue.tasks[0]?.state).toBe("RUNNING");
    queue = completeDispatcherTask(queue, "qa-1", "DONE");
    expect(queue.tasks[0]?.state).toBe("DONE");
    expect(queue.tasks[0]?.ownerResult).toBe("PASS");
    expect(queue.tasks[0]?.productionDataModified).toBe(false);
  });
});
