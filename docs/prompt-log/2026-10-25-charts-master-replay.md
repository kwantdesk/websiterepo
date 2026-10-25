# Charts master replay — 2026-10-25

## Request

REPLAY beside Indicators, centred date/time picker, shared bottom scrubber for
the entire Charts grid (including GEX Map/options), quick history/timeframes,
and a verified previous week of saved history. Full-universe completion is NOT
claimed by this change.

## Implemented

- Charts now receives the existing replay clock, playback and bottom transport;
  Replay is usable even when a non-price tool is selected. Picker uses the
  site's date/select controls, keyboard dismissal, modal focus and explicit Go.
- Charts trading-date window is prior-evening Globex through venue close;
  GEX Vue retains RTH bounds. New York DST and evening date ownership tested.
- Every price pane gets the clock independently of viewport/link settings.
  Date requests are scoped/immutable; scrubbing does not reload a session.
  Bounded 12-entry/80k-bar, five-minute cache keeps repeated futures timeframe
  reads apart from live IndexedDB. Event-bar steps use recorded timeline marks.
- Embedded GEX Map and L3 replay receive the master clock. GEX DATA's four
  as-of snapshot tools use completed-minute cutoffs, never the next minute.
- KWANTY Classic/State/Orderflow embedded tools load selected session history,
  follow the external timestamp for prices/profiles/major levels, invalidate
  stale async selections and leave live pricing/polling. Origin/source checked.
- Normal Charts replay cannot mark/fill the live paper ledger. Existing live
  protections remain subscribed separately; live order markers are not shown
  on historical price. Backtesting execution logic unchanged.
- Forming time candles are folded only from recorded executions up to clock;
  no recorded prints means no made-up forming candle or future final wick.
  Event OHLC waits for its source end (or next recorded boundary).
- Overlay-symbol history follows session and cutoff with live subscriptions
  stopped. IB uses a separately loaded historical minute series, clipped to
  closed source minutes rather than borrowing coarse full-bar extremes.
- Current Gameplan/structure zones do not paint over historical price. Profiles
  whose end is later than the clock are not passed to the chart as past facts.

## Explicit remaining gates — do not describe as all tools working

- No full-week/all-instrument completeness certificate. Source archives have
  gaps, request-driven options captures are uneven, and some vendor EOD dates
  are absent. This UI cannot recover never-recorded history.
- Live-book indicator engines (Mini DOM, DOM Pro, Pulling/Stacking, Absorption,
  Iceberg/Refresh, Stop Sweep, cumulative Iceberg, Book Speed) have no causal
  master-clock adapter yet and are disabled only in the rendered replay copy.
  Big Blocks Options/current IV Rank, current Classic GEX/Expected Move/Gamma
  Environment chart-resource engines also remain unavailable in master replay.
  Current wrapper level toggles do not substitute today's levels for history;
  source-native timestamped KWANTY/GEX Map adapters are separate.
- Developing daily/weekly/composite exact-profile prefix playback needs a
  bounded archived-checkpoint adapter. Only end-time-safe completed profiles
  are admitted; there is no claim of intrabar full-distribution reconstruction.
- GEX DATA other than heat-map/exposure-strike/exposure-expiration/market-map,
  legacy GEX BOX tools, calendar and live-only embedded workspaces are explicit
  unavailable panels during replay rather than misleading live substitutes.
- L3 replay still depends on collector archive packs and their coverage; this
  task does not rebuild packs or recover missing depth. Source cadence remains
  the provider/archive cadence, not invented millisecond positioning updates.
- Signed-in integrated browser acceptance is OPEN: the connected browser is
  at login. Do not bypass auth, trade or alter the owner's ledger for a test.
- No gateway restart, new provider session, paid resource, background backfill,
  Vercel deployment command or per-tick upstream loop added.

## Read-only VPS inventory

Actual `/recordings/bars/{openingDate}/CME-{NQ,ES}Z6.json` row counts were equal
for NQ and ES: Oct18 1095; Oct19 1349; Oct20 1375; Oct21 1380; Oct22 1381.
Both instruments had compressed execution files for those opening dates.
Existence/count is not verified execution completeness, nor a claim that every
minute should trade. Canonical root History Plant bars may supplement contract
archives (the prior candle task verified one 1380-row NQ session).

Saved provider EOD ZIPs: NDX Oct22; QQQ Oct21/22; SPX Oct21. Profile-replay roots
observed for SPX and QQQ Classic/State. Options-tool exposure archives begin
Oct20 in this inventory and vary by tool/date. This is not a complete previous
week for all options tools.

## Verification

- 35 focused tests pass: new master model/wiring/causality, KWANTY profile pages
  and selection integrity, Bounce replay clock safety, drawing timeframe
  integrity. Master historical quotes are rejected in both workspace scopes;
  separate live protection execution stays enabled outside Backtesting.
- Existing GEX Vue replay clock tests pass. Public app JavaScript syntax passes.
- Scoped ESLint: zero errors (21 existing warnings). Typecheck/build and exact
  production release receipt recorded after final verification below.

Final local verification: `npm run build` passed compilation, TypeScript and
84 static pages (`tmp/workspace-replay-verified-build.log`). The subsequent
two-boolean quote/protection isolation adjustment also passed a fresh complete
`tsc --noEmit --incremental false` (exit0, empty
`tmp/workspace-replay-release-types.log`) and the 35-test suite. Both public
JavaScript apps pass `node --check`; `git diff --cached --check` is clean.
Production verification will compile the exact committed source through the
single main Git deployment; no separate CLI deploy is used.
