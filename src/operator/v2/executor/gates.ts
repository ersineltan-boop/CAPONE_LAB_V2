export const VALIDATION_GATES = [
  { name: "operator:test", argv: ["npm", "run", "operator:test"] as const, field: "qa" as const },
  { name: "test", argv: ["npm", "test"] as const, field: "tests" as const },
  { name: "typecheck", argv: ["npx", "tsc", "-b", "--pretty", "false"] as const, field: "typecheck" as const },
  { name: "build", argv: ["npm", "run", "build"] as const, field: "build" as const },
  { name: "git-diff-check", argv: ["git", "diff", "--check"] as const, field: "qa" as const },
] as const;
