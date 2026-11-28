#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
head_sha="${1:?Exact PR head SHA is required}"
dispatch_run_id="${2:-}"
if [[ -n "$dispatch_run_id" && ! "$dispatch_run_id" =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid workflow dispatch run ID." >&2
  exit 1
fi

# A successful collector workflow or Vercel build is not the PR test check.
# Never ignore a check that failed, needs approval, has no jobs, or belongs
# to another commit. Bounded waiting leaves the PR available for review.
for _attempt in $(seq 1 60); do
  if [[ -n "$dispatch_run_id" ]]; then
    run="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${dispatch_run_id}")"
    if ! jq -e --arg id "$dispatch_run_id" --arg sha "$head_sha" --arg repo "$GITHUB_REPOSITORY" '
      (.id | tostring) == $id and .head_sha == $sha and .event == "workflow_dispatch" and
      .path == ".github/workflows/capone-ci.yml" and .head_branch == "automation/complete-refresh" and
      .repository.full_name == $repo and .head_repository.full_name == $repo and .run_attempt == 1
    ' <<< "$run" >/dev/null; then
      echo "Dispatched CI run does not match the consolidated delivery; publication stopped." >&2
      exit 1
    fi
  else
    payload="$(gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/capone-ci.yml/runs?event=pull_request&head_sha=${head_sha}&per_page=100")"
    run="$(jq -c --arg sha "$head_sha" '[.workflow_runs[] | select(.head_sha == $sha and .event == "pull_request" and .path == ".github/workflows/capone-ci.yml")] | sort_by(.id) | last // null' <<< "$payload")"
  fi
  if [[ "$run" != "null" ]]; then
    status="$(jq -r '.status' <<< "$run")"
    conclusion="$(jq -r '.conclusion // ""' <<< "$run")"
    run_url="$(jq -r '.html_url' <<< "$run")"
    if [[ "$status" == "completed" ]]; then
      if [[ "$conclusion" != "success" ]]; then
        echo "PR CI did not pass (${conclusion}); publication stopped: ${run_url}. Check workflow approval and annotations." >&2
        exit 1
      fi
      run_id="$(jq -r '.id' <<< "$run")"
      jobs_url="repos/${GITHUB_REPOSITORY}/actions/runs/${run_id}"
      if [[ -n "$dispatch_run_id" ]]; then jobs_url+="/attempts/1"; fi
      jobs="$(gh api "$jobs_url/jobs")"
      if ! jq -e --arg sha "$head_sha" --arg dispatch_id "$dispatch_run_id" '
        [.jobs[] | select(.name == "Full tests and production build" and .head_sha == $sha)] |
        length == 1 and all(.[]; .status == "completed" and .conclusion == "success" and
          ($dispatch_id == "" or (
            (.run_id | tostring) == $dispatch_id and .run_attempt == 1 and
            .head_branch == "automation/complete-refresh" and .workflow_name == "CAPONE CI" and
            ([.steps[] | select((.name == "Checkout" or .name == "Full test suite" or .name == "Production build") and .conclusion == "success") | .name] | unique | length) == 3
          )))
      ' <<< "$jobs" >/dev/null; then
        echo "PR CI has no successful exact-head test/build job; publication stopped: ${run_url}" >&2
        exit 1
      fi
      echo "PR CI passed for ${head_sha}: ${run_url}"
      exit 0
    fi
    if [[ "$status" == "action_required" || "$conclusion" == "action_required" ]]; then
      echo "PR CI requires approval; publication stopped: ${run_url}" >&2
      exit 1
    fi
  fi
  sleep 15
done
echo "PR CI missing, pending, or awaiting approval for ${head_sha}; publication stopped after 15 minutes." >&2
exit 1
