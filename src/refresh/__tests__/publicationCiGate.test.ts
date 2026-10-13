import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const sha = "a".repeat(40);
const run = { id: 42, head_sha: sha, event: "pull_request", path: ".github/workflows/capone-ci.yml", status: "completed", conclusion: "success", html_url: "https://github.com/example/repo/actions/runs/42" };
const job = { name: "Full tests and production build", head_sha: sha, status: "completed", conclusion: "success" };

function gate(runs: unknown[], jobs: unknown[], delayed = false) {
  const root = mkdtempSync(join(tmpdir(), "capone-ci-gate-"));
  try {
    writeFileSync(join(root, "runs.json"), JSON.stringify({ workflow_runs: runs }));
    writeFileSync(join(root, "jobs.json"), JSON.stringify({ jobs }));
    writeFileSync(join(root, "gh"), `#!/usr/bin/env bash
case "$2" in
  */jobs) cat "$MOCK_ROOT/jobs.json" ;;
  *)
    if [[ "$DELAYED" == 1 && ! -f "$MOCK_ROOT/seen" ]]; then
      touch "$MOCK_ROOT/seen"
      echo '{"workflow_runs":[]}'
    else cat "$MOCK_ROOT/runs.json"; fi ;;
esac
`, { mode: 0o755 });
    writeFileSync(join(root, "sleep"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
    writeFileSync(join(root, "seq"), "#!/usr/bin/env bash\nprintf '1\\n2\\n3\\n'\n", { mode: 0o755 });
    return spawnSync("bash", [resolve("scripts/wait-for-pr-ci.sh"), sha], { encoding: "utf8", env: { ...process.env, PATH: `${root}:${process.env.PATH}`, MOCK_ROOT: root, DELAYED: delayed ? "1" : "0", GH_TOKEN: "test-placeholder", GITHUB_REPOSITORY: "example/repo" }, timeout: 10000 });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe("exact-head PR CI publication gate", () => {
  it("accepts the successful test/build job after initial run discovery delay", () => {
    expect(gate([run], [job], true).status).toBe(0);
  });
  it.each(["failure", "cancelled", "skipped", "timed_out", "action_required"])("refuses %s rather than relying on successful preview", conclusion => {
    expect(gate([{ ...run, conclusion }], [job]).status).toBe(1);
  });
  it("refuses a successful run with no jobs or a skipped test/build job", () => {
    expect(gate([run], []).status).toBe(1);
    expect(gate([run], [{ ...job, conclusion: "skipped" }]).status).toBe(1);
  });
  it("refuses another commit, pending approval, and missing CI within a bounded wait", () => {
    expect(gate([{ ...run, head_sha: "b".repeat(40) }], [job]).status).toBe(1);
    expect(gate([{ ...run, status: "action_required", conclusion: null }], []).status).toBe(1);
    expect(gate([], []).status).toBe(1);
  }, 30000);
  it("uses the latest rerun and rejects mismatched job commit identity", () => {
    expect(gate([run, { ...run, id: 43, conclusion: "failure" }], [job]).status).toBe(1);
    expect(gate([run], [{ ...job, head_sha: "b".repeat(40) }]).status).toBe(1);
  });
  it("keeps CI and unchanged-main checks before every guarded merge attempt", () => {
    const script = readFileSync("scripts/publish-validated-automation-pr.sh", "utf8");
    const loop = script.slice(script.indexOf("for _attempt in $(seq 1 12)"));
    expect(loop.indexOf("wait-for-pr-ci.sh")).toBeLessThan(loop.indexOf("gh pr merge"));
    expect(loop.indexOf("require_unchanged_main")).toBeLessThan(loop.indexOf("gh pr merge"));
    expect(script).toContain('--match-head-commit "$head_sha"');
  });
});
