# PR CI approval and publication gate

The 2026-10-11 refresh run 38129102196 passed 1,041 tests in 130 files,
the production build, exact-commit Vercel preview, and production verification.
PR #168's separate CI run 38131274128 had no jobs. Its GitHub annotation says:
“This workflow run required approval but was not approved before it expired.”
This was not a failing test suite. The publisher nevertheless did not wait for
that separate PR control before merging.

The publisher now requires the latest CAPONE CI pull-request run for the exact
head commit to finish successfully, including its full test/build job. Missing,
pending, approval-required, failed, cancelled, skipped, and mismatched-commit
checks cannot authorize publication. Waiting is bounded to 15 minutes and
failure leaves the PR open. Each merge retry checks CI and unchanged main again;
the existing expected-head merge and Vercel gates remain in place.

Publication workflows receive only Actions read permission to inspect checks.
No workflow approval settings, branch protection, credentials, or catalog data
are changed. GitHub approval requirements may still require owner action; this
change prevents publication from proceeding while that requirement is unmet.

Validation includes shell syntax checks and executable mocked GitHub responses
for delayed discovery, success, failures, absent jobs, approval waits, latest
reruns, and commit mismatches, plus the full test suite and production build.
