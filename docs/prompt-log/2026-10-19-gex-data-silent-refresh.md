# GEX DATA silent refresh — 2026-10-19

Request: stop repeatedly displaying "loading license data"; refresh quietly
without a loading screen.

## Implementation

- The actual tool loader unconditionally revealed #toolLoading on every poll,
  manual refresh, filter/snapshot change and pagination. Removed that overlay
  markup/CSS and its spinner. Replaced visibility changes with nonvisual
  aria-busy state. Last rendered data is retained until a current response is
  accepted. Rendering already happens after request completion.
- Legacy board loadPanel also uses aria-busy instead of .loading::after.
- Actual error messages and source-time footer remain intact. Poll intervals,
  request cancellation/identity, hidden/inactive/historical pauses and data
  contracts/budgets are unchanged. Same app powers embedded GEX DATA tools.
- Bumped static app entry query to v3 so updated HTML loads the changed module.

## Verification

- Five new tests execute the actual extracted loader against deferred requests:
  existing chart retention, genuine error reporting/old timestamp retention,
  out-of-order response rejection, initial/pagination behavior and paused view.
  Also guard overlay removal in both markup and stylesheet.
-93 new/integration/reference tests pass. JavaScript syntax and test lint pass.
- Full84-page production build including TypeScript passed. Release verification
  recorded below when complete.
- No signed-in visual/live feed acceptance claimed. Existing supported-SSE
  transport, wait-for-Vultr decision, full history, missing Asia opening tape
  and weekly/footprint/live-soak issues remain OPEN.
