#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${AUTOMATION_BRANCH:?AUTOMATION_BRANCH is required}"
: "${AUTOMATION_COMMIT_MESSAGE:?AUTOMATION_COMMIT_MESSAGE is required}"
: "${AUTOMATION_PR_TITLE:?AUTOMATION_PR_TITLE is required}"
: "${AUTOMATION_PR_BODY:?AUTOMATION_PR_BODY is required}"

base_sha="$(git rev-parse HEAD)"
dispatch_ci="${AUTOMATION_DISPATCH_CI:-false}"
if [[ "$dispatch_ci" == "true" ]] && [[
  "$AUTOMATION_BRANCH" != "automation/complete-refresh" ||
  "${GITHUB_WORKFLOW_REF:-}" != "$GITHUB_REPOSITORY/.github/workflows/capone-refresh-cycle.yml@refs/heads/main" ||
  "${GITHUB_REF:-}" != "refs/heads/main"
]]; then
  echo "Only the consolidated workflow on main can dispatch publication CI." >&2
  exit 1
fi

require_unchanged_main() {
  git fetch origin main:refs/remotes/origin/main
  local current_main
  current_main="$(git rev-parse refs/remotes/origin/main)"
  if [[ "$current_main" != "$base_sha" ]]; then
    echo "Main moved during this automation run (${base_sha} -> ${current_main}); refusing stale merge." >&2
    return 1
  fi
}

wait_for_vercel() {
  local sha="$1"
  local target="$2"
  local state="missing"
  local target_url=""
  local payload=""
  for _attempt in $(seq 1 120); do
    payload="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${sha}/status")"
    state="$(jq -r '[.statuses[] | select(.context == "Vercel")][0].state // "missing"' <<< "$payload")"
    target_url="$(jq -r '[.statuses[] | select(.context == "Vercel")][0].target_url // ""' <<< "$payload")"
    case "$state" in
      success)
        echo "Vercel ${target} is ready: ${target_url:-status target unavailable}"
        VERCEL_URL="$target_url"
        return 0
        ;;
      error|failure)
        echo "Vercel ${target} failed for ${sha}: ${target_url:-no target URL}" >&2
        return 1
        ;;
    esac
    sleep 15
  done
  echo "Timed out waiting for Vercel ${target} for ${sha} (last state: ${state})." >&2
  return 1
}

if git ls-remote --exit-code --heads origin "refs/heads/${AUTOMATION_BRANCH}" >/dev/null 2>&1; then
  git fetch origin "refs/heads/${AUTOMATION_BRANCH}:refs/remotes/origin/${AUTOMATION_BRANCH}"
fi

git switch -C "$AUTOMATION_BRANCH"
git commit -m "$AUTOMATION_COMMIT_MESSAGE"
head_sha="$(git rev-parse HEAD)"
if [[ "$dispatch_ci" == "true" ]] && ! git diff --quiet "$base_sha" "$head_sha" -- .github/workflows/capone-ci.yml; then
  echo "Refusing to dispatch a CI workflow modified by the generated delivery." >&2
  exit 1
fi
git push --force-with-lease --set-upstream origin "$AUTOMATION_BRANCH"

# The Vercel Git integration attaches this status to a branch preview. A
# generated delivery is never merged until its exact commit is READY.
VERCEL_URL=""
wait_for_vercel "$head_sha" "preview"
preview_status_url="$VERCEL_URL"

# Even with the shared workflow queue, a human merge can move main while a
# long collector is running. Never rebase generated data without rerunning its
# gates against the new base.
require_unchanged_main

pr_url="$(gh pr list \
  --head "$AUTOMATION_BRANCH" \
  --base main \
  --state open \
  --json url \
  --jq '.[0].url // ""')"
if [[ -z "$pr_url" ]]; then
  pr_url="$(gh pr create \
    --base main \
    --head "$AUTOMATION_BRANCH" \
    --title "$AUTOMATION_PR_TITLE" \
    --body "$AUTOMATION_PR_BODY")"
else
  pr_number="${pr_url##*/}"
  gh api "repos/${GITHUB_REPOSITORY}/pulls/${pr_number}" \
    --method PATCH \
    -f title="$AUTOMATION_PR_TITLE" \
    -f body="$AUTOMATION_PR_BODY" >/dev/null
fi

pr_number="${pr_url##*/}"
ci_args=("$head_sha")
if [[ "$dispatch_ci" == "true" ]]; then
  require_unchanged_main
  pr="$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${pr_number}")"
  if ! jq -e --arg sha "$head_sha" --arg base "$base_sha" --arg branch "$AUTOMATION_BRANCH" --arg repo "$GITHUB_REPOSITORY" '
    .state == "open" and .head.sha == $sha and .head.ref == $branch and .head.repo.full_name == $repo and
    .base.sha == $base and .base.ref == "main" and .base.repo.full_name == $repo
  ' <<< "$pr" >/dev/null; then
    echo "Pull request does not match the consolidated delivery; publication stopped." >&2
    exit 1
  fi
  # GITHUB_TOKEN-created pull requests can require a human to start their CI.
  # Request the same test/build workflow explicitly and validate that run alone.
  dispatch_payload="$(gh api --method POST -H 'X-GitHub-Api-Version: 2026-03-10' \
    "repos/${GITHUB_REPOSITORY}/actions/workflows/capone-ci.yml/dispatches" -f "ref=$AUTOMATION_BRANCH")"
  dispatch_run_id="$(jq -er '.workflow_run_id | select(type == "number" and . > 0 and . == floor)' <<< "$dispatch_payload")"
  ci_args+=("$dispatch_run_id")
fi
bash "$(dirname "${BASH_SOURCE[0]}")/wait-for-pr-ci.sh" "${ci_args[@]}"
require_unchanged_main
merged="false"
for _attempt in $(seq 1 12); do
  # Recheck on retries: approvals/check reruns can change while merging waits.
  bash "$(dirname "${BASH_SOURCE[0]}")/wait-for-pr-ci.sh" "${ci_args[@]}"
  require_unchanged_main
  if gh pr merge "$pr_url" \
    --squash \
    --delete-branch \
    --match-head-commit "$head_sha"; then
    merged="true"
    break
  fi
  sleep 10
done
if [[ "$merged" != "true" ]]; then
  echo "Validated PR could not be merged automatically: $pr_url" >&2
  exit 1
fi

merge_sha="$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${pr_number}" --jq '.merge_commit_sha // ""')"
if [[ -z "$merge_sha" ]]; then
  echo "Merged PR has no merge commit SHA: $pr_url" >&2
  exit 1
fi

# Failed Vercel production builds do not replace its last-good deployment.
VERCEL_URL=""
wait_for_vercel "$merge_sha" "production"
production_status_url="$VERCEL_URL"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "branch=$AUTOMATION_BRANCH"
    echo "head_sha=$head_sha"
    echo "merge_sha=$merge_sha"
    echo "pr_url=$pr_url"
    echo "preview_status_url=$preview_status_url"
    echo "production_status_url=$production_status_url"
    echo "merged=true"
  } >> "$GITHUB_OUTPUT"
fi
