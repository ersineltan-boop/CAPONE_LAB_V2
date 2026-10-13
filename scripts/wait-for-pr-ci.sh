#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
head_sha="${1:?Exact PR head SHA is required}"

# A successful collector workflow or Vercel build is not the PR test check.
# Never ignore a check that failed, needs approval, has no jobs, or belongs
# to another commit. Bounded waiting leaves the PR available for review.
for _attempt in $(seq 1 60); do
  payload="$(gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/capone-ci.yml/runs?event=pull_request&head_sha=${head_sha}&per_page=100")"
  run="$(jq -c --arg sha "$head_sha" '[.workflow_runs[] | select(.head_sha == $sha and .event == "pull_request" and .path == ".github/workflows/capone-ci.yml")] | sort_by(.id) | last // null' <<< "$payload")"
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
      jobs="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${run_id}/jobs")"
      if ! jq -e --arg sha "$head_sha" '[.jobs[] | select(.name == "Full tests and production build" and .head_sha == $sha)] | length == 1 and all(.[]; .status == "completed" and .conclusion == "success")' <<< "$jobs" >/dev/null; then
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
