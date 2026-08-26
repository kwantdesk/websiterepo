#!/bin/sh
# Vercel "Ignored Build Step": exit 1 to BUILD, exit 0 to SKIP.
#
# Build CPU was the single largest line on the August invoice — $80.91 for
# sixteen days of it — because every push compiled the whole app, including
# pushes that cannot change a single byte of what is served. Test scripts,
# docs, the engineering log and scratch files under tmp/ are not shipped: the
# .vercelignore already excludes tmp/, and nothing under scripts/ or docs/ is
# imported by the app.
#
# Anything touching real source still builds. When in doubt this builds — a
# wrongly skipped deploy is worse than a wasted one.

# Deliberately NOT `set -e`. Every step below handles its own failure and ends
# in an explicit exit, and an abort part-way through would leave the exit code
# to chance — on a gate whose two outcomes are "skip the build" and "build",
# an accidental 0 would silently drop a real deploy.

# No range to compare (first deploy, shallow clone, manual redeploy): build.
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ] || [ "$VERCEL_GIT_PREVIOUS_SHA" = "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "No previous commit to compare against — building."
  exit 1
fi

# Vercel clones SHALLOW, so the previous deployment's commit is usually not in
# the checkout and `git diff` against it silently produces nothing. Measured on
# the first live run: the gate logged "Could not read the changed files" and
# built every time, which would have made it useless. Fetch just that one
# commit before comparing.
if ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  # Deepening is plainly supported by every server; asking for one arbitrary
  # SHA needs uploadpack.allowReachableSHA1InWant, which not every remote
  # enables. Try the reliable one first.
  git fetch --deepen=25 --quiet >/dev/null 2>&1 || true
fi
if ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  git fetch --depth=1 origin "$VERCEL_GIT_PREVIOUS_SHA" >/dev/null 2>&1 || true
fi

# Still not there — compare against HEAD's own parent instead, which a
# depth-2 clone can answer.
if git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  BASE="$VERCEL_GIT_PREVIOUS_SHA"
elif git cat-file -e "HEAD^{commit}" 2>/dev/null && git cat-file -e "HEAD^^{commit}" 2>/dev/null; then
  BASE="HEAD^"
else
  echo "No comparable base in this shallow clone — building."
  exit 1
fi

CHANGED=$(git diff --name-only "$BASE" "$VERCEL_GIT_COMMIT_SHA" 2>/dev/null || true)

# An empty diff here means git could not answer, not that nothing changed —
# a real no-op push does not produce a deployment. Build rather than guess.
if [ -z "$CHANGED" ]; then
  echo "Could not read the changed files — building."
  exit 1
fi

# Paths that never reach the deployed application.
SHIPPED=$(printf '%s\n' "$CHANGED" | grep -vE '^(scripts/|docs/|tmp/|tests/|\.github/|CLAUDE\.md$|AGENTS\.md$|README\.md$|.*\.md$)' || true)

if [ -z "$SHIPPED" ]; then
  echo "Only unshipped paths changed — skipping the build:"
  printf '%s\n' "$CHANGED" | sed 's/^/  /'
  exit 0
fi

echo "Shipped files changed — building:"
printf '%s\n' "$SHIPPED" | sed 's/^/  /'
exit 1
