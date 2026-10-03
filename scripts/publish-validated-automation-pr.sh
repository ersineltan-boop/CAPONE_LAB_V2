#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${AUTOMATION_BRANCH:?AUTOMATION_BRANCH is required}"
: "${AUTOMATION_COMMIT_MESSAGE:?AUTOMATION_COMMIT_MESSAGE is required}"
: "${AUTOMATION_PR_TITLE:?AUTOMATION_PR_TITLE is required}"
: "${AUTOMATION_PR_BODY:?AUTOMATION_PR_BODY is required}"

base_sha="$(git rev-parse HEAD)"
run_id="${GITHUB_RUN_ID:-manual}"
run_attempt="${GITHUB_RUN_ATTEMPT:-1}"
publish_branch="${AUTOMATION_BRANCH}-${run_id}-${run_attempt}"

require_unchanged_main() {
  git fetch origin main:refs/remotes/origin/main
  local current_main
  current_main="$(git rev-parse refs/remotes/origin/main)"
  if [[ "$current_main" != "$base_sha" ]]; then
    echo "Main moved during this automation run (${base_sha} -> ${current_main}); refusing stale proposal." >&2
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

if git ls-remote --exit-code --heads origin "refs/heads/${publish_branch}" >/dev/null 2>&1; then
  echo "Automation branch already exists; refusing to overwrite it: ${publish_branch}" >&2
  exit 1
fi

git switch -c "$publish_branch"
git commit -m "$AUTOMATION_COMMIT_MESSAGE"
git push --set-upstream origin "$publish_branch"
head_sha="$(git rev-parse HEAD)"

# The Vercel Git integration attaches this status to a branch preview. A
# generated delivery is never merged until its exact commit is READY.
VERCEL_URL=""
wait_for_vercel "$head_sha" "preview"
preview_status_url="$VERCEL_URL"

# Even with the shared workflow queue, a human merge can move main while a
# long collector is running. Never rebase generated data without rerunning its
# gates against the new base.
require_unchanged_main

pr_url="$(gh pr create \
  --draft \
  --base main \
  --head "$publish_branch" \
  --title "$AUTOMATION_PR_TITLE" \
  --body "$AUTOMATION_PR_BODY")"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "branch=$publish_branch"
    echo "head_sha=$head_sha"
    echo "merge_sha="
    echo "pr_url=$pr_url"
    echo "preview_status_url=$preview_status_url"
    echo "production_status_url="
    echo "merged=false"
  } >> "$GITHUB_OUTPUT"
fi
