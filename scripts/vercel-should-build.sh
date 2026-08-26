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

set -e

# No range to compare (first deploy, shallow clone, manual redeploy): build.
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ] || [ "$VERCEL_GIT_PREVIOUS_SHA" = "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "No previous commit to compare against — building."
  exit 1
fi

CHANGED=$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" 2>/dev/null || true)

# If git cannot answer, build rather than guess.
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
