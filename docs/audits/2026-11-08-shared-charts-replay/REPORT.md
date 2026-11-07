# Shared Charts replay alignment

## Scope and result

Checked the normal Charts workspace's shared replay timestamp into price/footprint
panes, GEX Map, GEX Vue-style Bounce, volume, CVD, delta and recorded profile jobs.
This is a replay-engine and component audit using deterministic isolated data;
it is **not** certification that every production instrument/date has complete
recordings or that every catalogue study has an archival adapter.

The host already passes the same absolute millisecond timestamp to chart panes
and `WorkspaceGexMapPane`. Viewport linking is independent from the replay clock:
all replay panes follow the clock even when their zoom/pan links are off. The
selected display zone formats instants; exchange session dates remain unchanged.

## Repairs

1. GEX Map's historical spot selector used a minute OHLC's final close immediately
   at the bar's opening timestamp. It now uses that minute's known open until its
   close boundary. A completed preceding minute can supply its close. The shared
   selector also drives Bounce classifications; the live spot path is untouched.
2. An unfinished replay candle now explicitly rejects footprint-summary reductions
   as well as flow-only buckets. Neither is an individual timestamped execution.
   This prevents final-bar volume, prices and wicks leaking into a forming candle.
3. Extracted the existing chart replay candle cut into `replayCandlesAtClock`,
   consumed by the real workspace and the integration checks. Time bars build
   from executions; event bars reveal at their recorded completion; no-data
   forming bars remain absent rather than receiving synthetic price paths.
4. GEX Map's internal playback timer cannot run while the host supplies its clock.
5. The Future-expiry matrix's current-only endpoint has no recorded as-of reader.
   Replay now prevents it from mounting/polling live data and explains that limit.
   Present replay remains available and saved horizon/settings are preserved.

## Checks

- 126 focused Node checks pass: shared replay, timezone/DST, Map compaction and
  reconstruction, Bounce projection and rewind, footprint, owned profiles,
  retained history, drawing persistence and playback cadence.
- The new shared-engine checks cover Brisbane, New York, UTC, Auckland and London,
  on both sides of US DST; forward/repeated/backward seeks; direct QQQ and mapped
  NQ/MNQ Bounce versus Map; exact candle/footprint/volume/delta totals; CVD presence;
  bounded profile jobs; summary poisoning; event-bar closing timestamps.
- Isolated headless Chrome mounts real `Chart` price and footprint components,
  the real `WorkspaceGexMapPane`/Map and the real Bounce hook. Six transitions
  verify forward/rewind, three display-zone changes and the Future replay guard.
  All observations pass, zero page errors. Map and Bounce coalesce one session
  archive HTTP request across seeks and zone changes. No Future live requests.
- Scoped ESLint, whitespace checks and full isolated production build pass.
  Production activation still requires the scoped main release and live-SHA check.

Local evidence: `tmp/shared-replay-browser-results.json`,
`tmp/shared-replay-forward.png`, `tmp/shared-replay-final-tests.log`,
`tmp/shared-replay-lint.log`, `tmp/shared-replay-build.log`.
Re-run `node scripts/audits/shared-replay-browser.cjs` for component checks.
Only loopback fixture responses are used; no provider calls or owner tabs.

## Existing broader-suite failures

The initial wider baseline already had four failures: the catalogue fingerprint
has not followed recent requested removals, and three source-pattern assertions
still expect older inline code instead of current helpers/guards. The separate
`bounce-futures-mapping-window` route harness has ten failures because its mocked
chart-interval module lacks `supportsChartInterval`. Its production route and
mapping hook are unchanged by this patch. These failures are not reported as
passes and no assertions were weakened to conceal them.

## Limits that remain explicit

- Replay only shows owned recordings actually available for the chosen source,
  session and cutoff. Missing archives are not backfilled with invented data.
- Exposure advances when a recorded exposure frame exists. Minute-only OHLC
  cannot prove an intraminute underlying price; replay does not interpolate it.
- Developing archived volume-profile checkpoints are minute-bounded. Exact
  execution-derived footprint, volume, CVD and delta can advance within a bar
  when individual recorded executions are available.
- Current-book/current-only studies without a verified replay adapter remain
  disabled under the existing safety policy. Future-expiry replay is one such
  gap, now explicitly guarded rather than silently live.
- This patch does not restart the gateway, change subscriptions, mutate user
  drawings/workspaces/orders/accounts, or establish production archive coverage.
