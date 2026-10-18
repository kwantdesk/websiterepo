# GEX DATA workspace integration — 2026-10-18

## Owner request

Bring the local prototype from the chat “Inspect and run rea” into KwantDesk as
GEX DATA, between GEX VUE and GEX BOX. Reuse the layout/tools/interactions, but
use KwantDesk fonts, theme, account persistence and backend. Also restore CME
history, which went down during this task.

## Source and implementation boundary

Owned prototype: `KESREPO/kwantdesk/quantpage` under the earlier QuantDesk tree,
served locally on port 4317. Imported only UI/model assets and pure model tests.
Do not run its server or open another provider login. The import script refuses
to overwrite the integrated source without an explicit destructive-import flag.

The workspace uses an account-bound React host and same-origin presentation
frames. Fonts are the existing Aleph assets; CSS and canvas colours resolve
through the live site palette. Chart/table time uses the site's chart timezone.
The original purple/Inter skin, vendor server and fixed October 8 startup query
are not used. Default six panels have balanced widths rather than the prototype's
accidental 59-pixel middle column.

Twenty allow-listed REST tool endpoints route through the existing authenticated
shared gateway. No API key is bundled into browser code. Identical requests are
coalesced; caches/queues, request sizes, dates and filters are bounded. Polling is
at least 30 seconds and pauses for inactive/hidden surfaces. Status checks do not
reset data refresh indefinitely; final-close reconciliation is scheduled.

Named layouts and controls are stored in an account-owned tracked preference
key, with protected writes. JSON exports have a versioned real-file format and
imports use a file input with validation. Tabs/docking/configuration/filter
groups, exposure snapshots, horizontal/vertical navigators and wheel/pan models
remain available. Unsupported IV snapshots/filter groups and forecast data are
not disguised as supported provider capabilities.

## Corrections during integration

- Latest session resolves using New York trading dates/holidays/early closes;
  unknown calendar years disable automatic market-open claims.
- Snapshot share/persistence uses timestamps, not an array index.
- Manual chart windows survive new bars; interval hover shares the rendered
  time domain, and single/sub-dollar strike geometry uses actual spacing.
- Drill-down final bucket respects aggregation period. Exact OSI underlying
  selection is independent of a stale ticker; conflicting global overrides
  produce an explicit error. Automatic contract discovery respects contract
  fields rather than choosing any unrelated recent trade.
- Request errors remain errors and do not turn into fake LIVE status. Retrieval
  time is distinguished from source-event time.

## Verification

- 77 imported pure model tests and seven new integration tests: 84 pass.
- Full repository TypeScript check; scoped ESLint: zero errors (two existing
  AppSidebar image warnings).
- Hidden localhost browser, actual host/Next route/gateway, no mock market data:
  six exposure/interval/drift plots populated, light/dark palette changed without
  refresh, tool chooser opened, named template survived reload, no console errors.
- Local preview-only route is removed before the optimized build. Stale dev-only
  generated route types are excluded only in the isolated build directory;
  production route types are still checked. No auth-bypass fixture is shipped.
- Production deployment must be verified READY and its exact public runtime SHA
  before claiming the integration live.

## Data outage and unresolved work

The laptop gateway/tunnel had stopped, not a chart-layout fault. Detached hidden
process recovery, shared gateway env cutover and deployment `42f5ffa6` restored
public candle requests: NQ 6,900 bars, SPX archive 1,015 bars. The current execution
profile source still reports unavailable/cooling down; do not claim footprint,
CVD tape or full L3 repaired by that candle check.

Still open: complete rolling month for every offered instrument, exact tape/
options/depth coverage, unattended recording coverage, durable VPS/off-box backup,
live-market soak and memory/capacity/cost testing. The prototype audit's Net Drift
vendor parity is not certified. Every optional tool/endpoint/filter combination
and cloud cross-device save are not fully exercised by this weekend QA.
