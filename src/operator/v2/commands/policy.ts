import type { CommandEvaluation } from "../types";

const ALLOWED_NPM_SCRIPTS = new Set([
  "test",
  "test:watch",
  "operator:check",
  "operator:dry-run",
  "operator:test",
  "operator:intake",
  "operator:plan",
  "operator:run",
  "operator:status",
  "operator:list",
  "build",
]);

const READ_ONLY_GIT = new Set([
  "status",
  "diff",
  "rev-parse",
  "branch",
  "log",
  "show",
]);

function normalizeArgv(argv: readonly string[]): string[] {
  return argv.map((part) => part.trim()).filter(Boolean);
}

export function evaluateAllowlistedCommand(argv: readonly string[]): CommandEvaluation {
  const parts = normalizeArgv(argv);
  if (parts.length === 0) {
    return { decision: "DENY", reason: "Empty command" };
  }

  const [bin, ...rest] = parts;
  const binary = (bin ?? "").replace(/\.cmd$/i, "").toLowerCase();

  if (binary === "git") {
    const sub = (rest[0] ?? "").toLowerCase();
    if (sub === "push" && rest.some((item) => item === "--force" || item === "-f" || item === "--force-with-lease")) {
      return { decision: "DENY", reason: "Force push is denied" };
    }
    if (sub === "reset" && rest.includes("--hard")) {
      return { decision: "DENY", reason: "git reset --hard is denied" };
    }
    if (sub === "clean" && rest.some((item) => item === "-xfd" || item === "-fd" || item === "-df")) {
      return { decision: "DENY", reason: "Destructive git clean is denied" };
    }
    if (sub === "push") {
      return { decision: "REQUIRE_OWNER_APPROVAL", reason: "git push requires owner approval" };
    }
    if (sub === "commit") {
      return { decision: "REQUIRE_OWNER_APPROVAL", reason: "git commit requires owner approval" };
    }
    if (sub === "checkout" && rest.some((item) => item === "main" || item === "master")) {
      return { decision: "DENY", reason: "Direct write/switch onto main is denied from Operator" };
    }
    if (READ_ONLY_GIT.has(sub)) {
      if (sub === "diff" && (rest.includes("--check") || rest.length >= 1)) {
        return { decision: "ALLOW", reason: "Read-only git inspection" };
      }
      return { decision: "ALLOW", reason: "Read-only git inspection" };
    }
    return { decision: "DENY", reason: `git ${sub || "(missing)"} is not allowlisted` };
  }

  if (binary === "gh") {
    if (rest[0] === "pr" && rest[1] === "create") {
      return { decision: "REQUIRE_OWNER_APPROVAL", reason: "PR creation requires owner approval" };
    }
    return { decision: "DENY", reason: "Unlisted gh command is denied" };
  }

  if (binary === "npx") {
    if (rest[0]?.replace(/\.cmd$/i, "") === "tsc" && rest.includes("-b")) {
      return { decision: "ALLOW", reason: "Typecheck is allowlisted" };
    }
    return { decision: "DENY", reason: "Unlisted npx command is denied" };
  }

  if (binary === "npm") {
    if (rest[0] === "run" && rest[1] && ALLOWED_NPM_SCRIPTS.has(rest[1])) {
      return { decision: "ALLOW", reason: `npm script ${rest[1]} is allowlisted` };
    }
    if (rest[0] === "test") {
      return { decision: "ALLOW", reason: "npm test is allowlisted" };
    }
    if (rest[0] === "ci" || rest[0] === "install") {
      return { decision: "DENY", reason: "Dependency install is not an Operator task command" };
    }
    return { decision: "DENY", reason: "Unlisted npm command is denied" };
  }

  if (binary === "tsx") {
    const script = rest[0] ?? "";
    if (script.startsWith("scripts/operator-") && script.endsWith(".ts")) {
      return { decision: "ALLOW", reason: "Known Operator tsx script" };
    }
    return { decision: "DENY", reason: "Unlisted tsx script is denied" };
  }

  if (binary === "rm" || binary === "del" || binary === "rmdir") {
    return { decision: "DENY", reason: "Arbitrary delete is denied" };
  }

  if (binary === "vercel" || rest.some((item) => /deploy/i.test(item))) {
    return { decision: "REQUIRE_OWNER_APPROVAL", reason: "Deploy requires owner approval" };
  }

  return { decision: "DENY", reason: "Arbitrary shell command is denied" };
}

export function commandFromUntrustedTaskText(_taskText: string): never {
  throw new Error("Task text must never become raw shell input");
}

export function isProductionCommandBlocked(argv: readonly string[]): boolean {
  const result = evaluateAllowlistedCommand(argv);
  return result.decision !== "ALLOW";
}
