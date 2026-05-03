#!/usr/bin/env bash
#
# Wait for E2E + merge PR via `gh api PUT` (workaround для gh pr merge
# stale-mergeStateStatus bug observed in W2-7+).
#
# Usage:
#   scripts/ci/wait-merge-pr.sh <PR_NUMBER> "<commit_title>"
#
# Example:
#   scripts/ci/wait-merge-pr.sh 33 "feat(catalog): seed Проволока — 161 SKU + 6 L3 (W2-16) (#33)"
#
# Bugfix history:
#   W2-16 (b8cor1lo4 task) — 30× PARSE_ERR loop because parser asked for
#   `conclusion` field which `gh pr checks --json` doesn't expose.
#   Correct fields: name, state (SUCCESS/FAILURE/PENDING), bucket
#   (pass/fail/pending/skipping/cancel).
#
#   Cleaner approach: `gh pr checks <PR> --watch --required` blocks until
#   all REQUIRED checks finish, exits 0 on all-pass, non-zero on any-fail.

set -e

PR="${1:?usage: $0 <PR_NUMBER> <commit_title>}"
TITLE="${2:?usage: $0 <PR_NUMBER> <commit_title>}"
REPO="${REPO:-investfreelife/metallportal}"

echo "Allowing CI workflows to register (~30s buffer)..."
# Bug fix (post-anchors PR #35): `gh pr checks --watch` exits when ALL
# зарегистрированные на момент start checks settle. Если CI workflows
# регистрируются ASYNC (Vercel сразу, playwright позже после triggering),
# watch может exit before late-registering check'и появятся → false-positive.
# Sleep даёт CI время зарегистрировать все expected checks.
sleep 30

echo "Waiting for ALL checks on PR #$PR to settle (including non-required)..."
# `--watch` polls every 10s; exits 0 if all pass, 1 if any fail.
# (Non-required checks like Vercel deploy still need to pass for our flow,
# so we drop --required and watch all.)
gh pr checks "$PR" --repo "$REPO" --watch --interval 15

echo ""
echo "✅ All checks passed. Attempting merge via gh api PUT..."

for i in 1 2 3; do
  RES=$(gh api -X PUT "repos/$REPO/pulls/$PR/merge" \
    -f commit_title="$TITLE" \
    -f merge_method=squash 2>&1) && echo "$RES" && break
  echo "merge attempt $i failed: $RES"
  sleep 15
done

if [[ "$RES" != *'"merged":true'* ]]; then
  echo "❌ merge did not confirm: $RES"
  exit 1
fi

echo ""
echo "Cleanup: switch to main + delete branch..."

# Capture current branch BEFORE switching
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

git checkout main && git pull --ff-only

if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "HEAD" ]]; then
  git branch -D "$CURRENT_BRANCH" 2>&1 || true
  git push origin --delete "$CURRENT_BRANCH" 2>&1 | tail -2 || true
fi

echo "✅ done"
