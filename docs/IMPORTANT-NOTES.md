# KWANTDESK important notes

## 2026-09-07 — Volume-profile candle-boundary continuity follow-up

- Async indicator recalculation must be last-good-frame authoritative: a new
  request identity is not permission to clear the currently painted result.
  This is especially important for rolling Composite profiles because their
  requested start/end changes whenever a new chart candle opens.
- Retention is calculation-agnostic but scope-strict across Daily, Weekly,
  Composite, Monthly, Session and Visible Range profiles. A symbol/contract
  change, removed study, expired Daily date, or unticked Daily session still
  removes the old frame immediately.
- **Still open:** authenticated live-chart soak through several one-minute
  boundaries with Composite, Daily and Weekly profiles enabled together. The
  deterministic tests cover retention and isolation; the live soak verifies
  the full gateway/render timing under an active execution stream.

## 2026-09-07 — Weekly/composite profile latency follow-up

- Cold session-profile work is kicked immediately and drained serially in the
  shared archive worker. The 20-second interval is now only a recovery/safety
  tick, not the normal start mechanism.
- The volume-profile endpoint waits at most eight seconds for requested cold
  session folds. The work stays off the event loop so quote, options and GEX
  traffic are not blocked.
- **Still open:** authenticated production timing on a cold weekly and loaded-
  range composite profile for NQ and ES after the gateway deployment. The
  deterministic test proves first-request delivery without waiting for the
  safety interval; live archive size determines the actual milliseconds.

## 2026-09-07 — Journal deletion follow-up

- Journal account deletion is a full cascade: account, trades, imports,
  evidence/screenshots, quantitative analysis, archive metadata and linked
  trade posts. The database foreign key owns trade/import deletion; the route
  explicitly removes social-object records first.
- Browser deletion tombstones are required because paper journals and stale
  local snapshots can otherwise recreate a cloud-deleted account. An explicit
  create/import of the same account clears its tombstone.
- **Still open:** authenticated production smoke test deleting one empty manual
  Journal, one imported Journal, and one demo Journal, followed by refresh and
  workspace navigation. Automated coverage verifies the cascade contract and
  anti-resurrection state logic without touching the owner's real journal.

## 2026-09-07 — New-candle render continuity follow-up

- A normal `previous.length + 1` live bucket append must stay on the low-
  priority indicator sampler. Do not fold it back into immediate historical
  hydration: that synchronously recalculates every study at the bar boundary
  and makes chart drawings/panes appear to flash.
- Initial history, backfills, corrections, replay movement and newly restored
  execution archives still use the immediate hydration path.
- **Still open:** soak an authenticated, indicator-heavy NQ chart through
  several active one-minute boundaries. Deterministic tests cover the state
  classification and transition contract; only a live session can measure the
  final frame timing on the trader's browser/GPU.

## 2026-09-07 — Value Area levels follow-up

- Prior-day and prior-week Value Area levels now use Rithmic History Plant's
  exact volume-at-price minute profiles. Do not rebuild these levels from OHLCV
  candles: candles cannot reveal volume distribution by price.
- Raw weekly fallback must continue folding every included trading-date file,
  and archive GAP/DROPPED markers may be numeric epoch milliseconds.
- **Still open:** visually compare PD/PW VAH, POC and VAL on authenticated NQ
  and ES charts after production deployment. The live VPS source was verified
  directly, but the desktop browser check still requires the owner's signed-in
  chart state.

## 2026-09-07 — Workspace layout-switch follow-up

- Existing chart panes now retain their component, canvas, history and
  indicator state while a layout template changes the split-tree geometry.
  Do not move chart rendering back inside recursive layout nodes; a change in
  ancestry makes React remount the chart and recreates the reported 10-second
  calculation wait.
- **Still open:** visually soak single ↔ two-up ↔ quad with a heavy footprint,
  daily/weekly profiles, CVD and large-trade indicators during an active
  session. The deterministic preservation test, TypeScript and production
  build cover the code path, but only an interactive soak can quantify the
  final browser-frame timing on the trader's hardware.

## 2026-09-07 — Aggressive-flow CVD follow-up

- Worker and pane delivery are now lossless and FIFO during aggressive trade
  bursts. Never restore an overflow policy that silently discards the oldest
  execution: that directly creates false CVD gaps.
- Backpressure is retained as one in-flight structured-clone message per
  contract with bounded delivery chunks; pending records stay in the worker
  until acknowledged.
- **Still open:** during the next genuinely aggressive NQ/ES session burst,
  soak CVD and footprint together and confirm the tail keeps advancing without
  `SYNCING EXECUTIONS` becoming persistent. Deterministic tests cover a 100,000
  execution backlog and 5,000 consecutive aggressive CVD bars, but cannot
  manufacture a provider-side outage.

## 2026-09-07 — Cross-market candle integrity follow-up

- Futures time/event-bar geometry and the options/cash delayed-history seam are
  deterministic and covered across every exposed instrument/interval route.
  Impossible provider OHLC fails closed; no repair may invent a high or low.
- A time candle's open is its provider open or first real trade. Do not force it
  to the prior close: an overnight, session-boundary or illiquid-market gap can
  be genuine. Quiet in-session buckets may be shown as explicitly synthetic
  flat bars only under the existing session-aware gap policy.
- **Still open:** during the next active US session, capture and reconcile NQ,
  ES, one thin futures contract, SPX, NDX and two equity/ETF option underlyings
  against provider history across a live bucket boundary. Classify any remaining
  timestamp holes as exchange/session gaps, entitlement/coverage gaps or packet
  loss before changing the renderer. Deterministic suites cannot prove packets
  that the production provider has not delivered.

## 2026-09-07 — Liquidity-map frame-pacing follow-up

- The recurring full-tape Signals and trade-cluster rebuilds were removed from
  ordinary map paints; dense live cluster work now rebuilds only its overlapped
  tail and preserves exact accumulated trade totals/anchors.
- **Still open:** active-market visual soak on NQ/ES with Trades, DOM, SVP and
  CVD enabled, including several minutes across the 1,800-frame rollover. The
  deterministic dense-open benchmark and all focused regressions pass.

## 2026-09-07 — Liquidity-map bubble-anchor follow-up

- Trade bubbles are now fixed to their first actual execution price/time while
  their displayed volume may continue growing through smart clustering.
- **Still open:** visually soak the map during the next active futures session
  while the 1,800-frame window is rolling, with auto-centre both on and off.
  Deterministic cluster, rollover, performance and cache tests pass.

## 2026-09-07 — Forming-wick retention follow-up

- The renderer now prevents a later same-bar snapshot from shrinking an
  already observed high/low. This is enforced after every upstream publisher,
  at the final chart event boundary, and applies to time and event candles.
- **Still open:** visually confirm NQ and ES during the next liquid US session,
  including a fast out-and-back move and the subsequent candle close. The
  deterministic renderer/authority tests pass; the market is not currently
  supplying a representative live burst for an authenticated visual soak.

## 2026-09-07 — CVD continuity follow-up

- The periodic disappear/reappear and malformed interim-bar lifecycle is fixed
  in code: same-shape flow corrections commit atomically, the pane survives a
  temporary chart-coordinate outage, and a regressed CVD snapshot cannot
  replace the last proven frame in the same chart scope.
- **Still open:** run a representative live US-session soak after this build is
  deployed, covering NQ/ES 1m plus one event chart through at least one
  four-minute history-heal cycle. Confirm the `SYNCING EXECUTIONS` safeguard is
  exceptional rather than continuous; continuous display would identify an
  upstream coverage regression that must be repaired, not hidden.
- Keep this file as the durable unfinished-work ledger. Every prompt/fix/outcome
  note must add newly discovered open work here and close it only with evidence.

## 2026-09-07 — Weekly profile five-session invariant

- Stock Weekly Volume Profile is one rolling profile over the latest five real
  trading sessions, newest/developing session included. It is not five calendar
  days and must skip weekends and known exchange holidays.
- Use restored candle trading dates as the authoritative session list and the
  Chicago weekday fallback only while history is hydrating.
- Preserve user overrides: current calendar week and previous completed week
  remain selectable. Older explicit previous-week choices must not migrate.
- Futures and projected cash/options paths must send the same start/end window;
  the chart viewport must never silently shorten the requested calculation.

## 2026-09-07 — Indicator rendering frame budget

- Big Contracts must never re-anchor/regroup its retained history from every
  live candle movement. New qualifying executions paint through the direct live
  edge; the expensive authoritative distribution pass is a slower reconciliation
  and steady passes scan the recent complete tape, not all raw retained history.
- Zone studies must binary-select only viewport-relevant history before asking
  the chart for coordinates. Dense marker views must limit repeated font layout
  and overdraw without changing the underlying executions.
- Volume-profile derived analytics (structure, VWAP bands and summary) are
  data/settings results and must be cached across pan/zoom repaints.
- A primitive with no render model must return no pane view. This applies across
  footprint, TPO, gamma, DOM, POC, session, profile and order-flow studies.
- A forming-bar Big Block that qualifies on the direct live path must remain
  latched while sampled state is still on that same bar. It may only be removed
  once the sampled model advances to a newer bar and becomes authoritative.

## 2026-09-07 — Empty overlays must have zero viewport cost

- A mounted drawing system with no drawings must not subscribe to chart repaint
  events or allocate/repaint a backing canvas.
- Native repaint and time-scale notifications can describe the same visual
  frame. SVG and precision-canvas work must be animation-frame coalesced.
- Do not query/update the native price-rail width or format live P&L merely
  because the trader pans or zooms; neither value is changed by navigation.

## 2026-09-07 — Chart interaction performance invariant

- Never use continuous pan/zoom events to reconcile the full `Chart` React
  tree. Lightweight Charts and native primitives own frame-rate movement;
  drawings and paper-order labels are imperatively reprojected per frame, and
  React coordinate overlays settle once after the gesture pauses.
- Only genuinely viewport-defined calculations may depend on
  `viewportVersion`. In particular, session/monthly volume profiles and
  non-visible Profile Values modes must not rebuild while navigating a chart.
- This is an interaction/rendering rule and must not throttle, batch or alter
  the live Rithmic feed.

## 2026-09-07 — Public product description

- Browser metadata and the installable-app manifest describe Kwant Desk as a
  professional trading platform for charts, order flow, options analytics,
  market intelligence and execution. Do not revert this customer-facing copy
  to “private quantitative research workspace.”

## 2026-09-07 — Session-window ownership

- Session overlays are non-overlapping by default. Asia, London/Europe and
  New York/USA form a continuous exchange-time partition; a hand-off candle
  belongs to the session opening at that time, never both.
- User clocks and per-session visibility persist. An earlier customised
  window is clipped at the next enabled start unless `Allow custom overlaps`
  is explicitly enabled. Its OHLC must be recalculated after clipping.
- Session Highs & Lows intentionally keeps Globex as the full CME envelope;
  it may coexist with the independently toggleable Asia/London/New York
  subsets. London ends when New York starts at 08:30 Chicago time.

- **Pending indicator library:** the earlier 21-row checklist did not cover
  the whole catalogue. The September 6 audit found 38 blocked rows; two were
  broken catalogue IDs for existing Big Contracts/Liquidity Sweep engines.
  Those links are repaired; Absolute Levels is now implemented and locally
  verified (documented parity limits). ADX is also implemented and browser-tested
  with explicit Wilder seeds; Parabolic SAR is implemented with documented seed
  and browser-tested dots/settings. Linear Regression now has all five inputs,
  tested rolling math and deep-history routing. Tillson T3 now has six-stage
  smoothing, source/style/name controls and browser checks. KST now has all four
  DLL-confirmed smoothing modes, styled pane output and browser-verified save
  persistence (documented parity limits). Super Trend and Difference are now
  implemented and production-verified at `18a17c4d`, after an isolated build,
  90 combined tests and 18 template checks. Pivot Points and Gap Detector are
  released with explicit reference limits. Zig Zag now has all three observed
  modes, a live developing leg and retracements. Inverse Cyber Cycle now has
  its two real cycle plots, three levels and the public settings contract.
  Ichimoku now has its five standard displaced plots, two-colour Kumo and the
  observed public `9/26/52` contract. Regression Channel now has separate Bars
  and Zig Zag modes with three active standard-deviation lines. Swing Point
  now has future-safe confirmed high/low segments, all public display/style
  controls and hard history-gap boundaries.
  Their evidence and parity limits are tracked in the matching DeepCharts
  audits. Text on Chart now has a fixed multiline viewport overlay and the
  complete public settings contract. FVG Identifier now has future-safe
  three-candle zones, the complete observed public/DLL settings contract,
  bounded mitigation lookup and browser-verified Save/reload behavior. Price
  Movement Levels now has exchange-session Open/prior-Close anchors,
  percentage/true-tick spacing, complete support/resistance/zero styling and
  custom-time controls. The Pending Anchored VWAP entry now opens the already
  verified live draw-on implementation instead of remaining a dead duplicate.
  Session Marker now has real DST-aware Asian/Europe/USA windows, imbalance,
  OHLC/mid/VWAP levels and persisted theme/custom settings. 16 still require
  individual work. Monthly/Session/
  Visible profile data/settings integration remains unfinished, including exact
  multi-session filtering and event-allocation-aware visible boundaries.
  Track `docs/pending-indicator-library-2026-09-06.md`, not the old completion
  claim. Registration is not evidence of formula or visual parity.

- **ADR Target parity:** its public settings and defaults are recovered, but
  the official screenshot plots six named targets while the article omits
  their arithmetic. Keep it Pending until controlled DeepCharts value tracing
  establishes those levels; do not invent trading targets from the screenshot.

This is the persistent launch ledger for material work that is incomplete,
provider-blocked or unsafe to forget. Every task handoff should include a short
recap of the open items below and update this file when their state changes.

## 2026-09-07 — Standalone value-area levels

- `KWANT Profile Values` now owns its exact Rithmic VAP activation instead of
  relying on another order-flow indicator. It shares the corrected standard
  profile POC/VAH/VAL calculator, fails closed across positive-volume ladder
  holes, and exposes independently persisted level/developing/style/label
  controls. Live-market visual verification remains desirable; local
  deterministic calculation and integration gates pass.

## P0 — Historical market-data coverage

- **Options-underlying candles:** QuantData was directly verified on
  2026-09-04 to return real 2025-01-03 one-minute bars for all 13 physical
  targets: SPX, SPY, QQQ, NDX, IWM, AAPL, NVDA, TSLA, MSFT, AMZN, META, AMD
  and VIX. The checkpointed production VPS backfill is active and targets
  every physical options-underlying ticker from 2025-01-01. At the first
  post-deploy snapshot it had completed 88 of 113 attempted ticker/sessions,
  with 24 holiday/empty observations awaiting confirmation and one partial
  awaiting retry. It is intentionally blocked
  during the US cash session so history can never consume the quota needed by
  live GEX/tickers. Keep this item open until the production ledger proves all
  available sessions are complete.
- **VXN:** QuantData returned zero VXN rows for 2025-01-03 and the production
  Massive/index-provider credential is not configured. VXN live and intraday
  history therefore remain provider-blocked. Acquire an explicitly licensed
  VXN-capable source before presenting it as live or historically complete.
- **Historical option contracts/chains/tape:** underlying QQQ/META/VIX candles
  are not option-contract history. QuantData responses are archived from the
  day capture began, but January-2025 full chains, Greeks, open interest and
  trade tape have not been proven available. Confirm QuantData entitlement and
  retention or procure the planned licensed historical options source; never
  reconstruct past surfaces with future data.
- **Futures minute bars:** the Rithmic History Plant queue covers all 53 offered
  CME-group roots from 2025-01-01 and remains in progress/retry. Do not call it
  complete until its production ledger has no unresolved real-root windows.
- **Futures event charts:** historical tick, volume, range, Renko and Footprint
  require the separate trade-tick/VAP import. They must never be fabricated
  from minute OHLC.
- **Event-timeframe serving:** Range, volume, trade, delta, Renko, volume-bar
  and point/figure history is now folded on the Vultr recorder and returned as
  bounded candles plus a compact execution-flow tail. Never restore the old
  Vercel path that downloaded and parsed up to 1.5 million raw prints per pane.
  The 53-root × 50-interval deterministic matrix passes, but that proves logic,
  not archive existence: a root/session still needs recorded or backfilled
  executions. A first uncached ten-day NQ 40R fold is about 9–10 seconds; warm
  and concurrent requests share cache. Persistent precomputed indexes are the
  remaining route to sub-second first-ever loads for every combination.

## P0 — Launch reliability

- Preserve the live-feed priority rule: no bulk history, archive compaction or
  analytics work may compete with Rithmic or QuantData during the US market
  open. A healthy HTTP process is not sufficient; live timestamps and recorder
  counters must advance.
- The dedicated Vultr volume is primary recording storage, not an off-site
  backup. Add and restore-test nightly object-storage replication before the
  public launch.
- **Contract rollover monitoring:** continuous futures now resolve their exact
  active contract from Rithmic, re-check every ten minutes/visibility restore,
  and rotate the shared live stream plus contract-keyed pane data when the
  provider changes month. Keep an operational alert on a root whose resolved
  contract, live quote contract and recorder contract disagree. Options use
  provider-listed expiration dates and the New York session date rather than
  futures month codes; keep historical option-chain availability as the
  separate provider-blocked item above.

## P1 — Reference parity evidence

- **Big/Deep Contracts and Big Blocks:** calculation/settings/live-event
  contract parity has been audited against the installed Deep Charts assembly.
  Deep Contracts now lives inside Big Contracts and Big Blocks updates from
  the forming Rithmic bar. Capture a fresh interactive screenshot sweep when
  safe native-window control is available; the proprietary protected formula
  body is not inspectable, so do not call it pixel/formula identical without
  that evidence.
- **Imbalance Tracker:** the installed licensed Deep Charts assembly metadata,
  calculation fixtures and KWANTDESK renderer have been reconciled. The
  live-edge width, real opacity and saved-settings faults are fixed. Capture a
  fresh interactive Deep Charts/KWANTDESK screenshot pair when native-window
  control is available; do not describe pixel-level visual parity as complete
  until that final comparison is recorded.
- **Composite Volume Profile:** the installed assembly contract and official
  Volume Profile reference have been mapped to the live KWANTDESK engine. The
  indicator is calculation/settings complete, right-docked and execution-live.
  Capture the final side-by-side screenshot sweep when safe native-window
  control can expose Deep Charts; do not claim pixel-identical parity before
  that evidence is recorded.
- **VWAP family:** VWAP, continuous VWAP Envelopes, Rolling VWAP, Anchored VWAP
  drawing and Volume Profile VWAP now share an audited period/source/envelope,
  five-band, colour and persistence contract. Capture the final interactive
  Deep Charts/KWANTDESK screenshot sweep when native-window control is
  available. Also compare Orders-period VWAP directly on raw executions when a
  period boundary falls inside an aggregated candle; candle trade counts
  cannot split that candle exactly.

## 2026-09-04 — Composite Volume Profile

- Activated the existing catalogue entry as a live indicator. It requests one
  exact Rithmic execution profile over the complete loaded range, stays fixed
  to the right by default and develops from the direct execution path.
- It inherits the full tested Volume Profile contract: input/filter/grouping,
  style/width/offset, POC, value area, peak/valley, VWAP/envelopes, summary and
  session filtering. Focused regressions, TypeScript and the production build
  passed; only the interactive screenshot comparison remains open above.

## 2026-09-04 — VWAP family

- Corrected VWAP Envelopes and Rolling VWAP so their continuous windows no
  longer reset at the CME reopen. Base VWAP now supports documented trading-day,
  minute, second and order-count periods.
- Added four price sources, standard-deviation/percentage envelopes, five
  independently enabled bands and complete theme/custom colour controls.
- Anchored VWAP now renders live deviation bands and optional fill, and its
  settings survive drawing templates. Shared indicator templates continue to
  account-sync and import/export the complete VWAP settings record.
- Calculation, migration, theme, template, profile, TypeScript and production
  build checks passed. Evidence limits remain listed under Reference parity.

## 2026-09-04 — Futures and options rollover safety

- Removed the website's calendar guess for active futures contracts. A valid
  delivery-month code is not proof of the liquid/front contract; Rithmic's
  `RequestFrontMonthContract` response is now authoritative.
- The collector refreshes that answer every ten minutes and coalesces all
  simultaneous users into one provider request per exchange/root. On every
  new SSE lease, continuous symbols are bound to that resolved contract.
- The Rithmic wire identifiers are request `113`, response `114` and live
  update `159`; `154467` is the protobuf field number for `template_id`, not a
  template value. Keep a regression on all three because a wrong value fails
  by timeout and can otherwise leave an apparently healthy stale contract.
- On login and every ten minutes, configured subscriptions reconcile to an
  exact dated contract. Provider updates subscribe the replacement and remove
  the old contract. Never accept an undated root such as `MNQ` as a resolved
  contract.
- Each chart resolves immediately, on a ten-minute cadence, after reconnect
  and when the tab becomes visible. A changed contract invalidates the old
  contract identity, reloads contract-keyed seam/order-flow data and rotates
  the shared futures stream for every pane.
- Mini and micro roots remain distinct in the catalog and resolver. Exact
  contracts remain selectable for diagnostics/replay; only continuous roots
  auto-roll.
- Do not restore calendar-generated front-month labels as a fallback. Until a
  provider answer or exact live book exists, display the product root. `10Y`
  is a CBOT product; after correcting the former CME mapping, the production
  account still rejects its front-month request with code 7. Keep `10Y`
  provider entitlement/catalogue access open and never guess around it.
- Continuous history now reads all locally recorded contracts sharing the
  requested product root. Canonical History Plant root minutes remain the
  baseline; where only overlapping local contracts exist, one highest-volume
  minute is selected rather than adding or alternating contracts.
- QuantData options surfaces already select from provider-listed, non-expired
  dates and include the New York session date in cache identities. Options
  therefore advance by expiration/session date, not CME month-code logic.

## 2026-09-04 — CVD partial-history integrity

- Do not gate the entire CVD pane on near-total coverage of the visible candle
  window. Rithmic OHLCV history can extend behind the locally recorded
  aggressor-side execution archive, making such a gate impossible to complete.
- Render verified execution-backed CVD segments immediately. Exclude OHLCV-only
  candles, insert a hard break at every missing-flow region and reset the next
  segment instead of fabricating zero delta or carrying an unknown cumulative
  total across the gap.

## 2026-09-04 — Event-chart indicator time integrity

- Volume, Range, Trade, Delta, Renko, Volume Bar and Point & Figure candles can
  close many times inside one wall-clock second. Never align their indicators
  with a map keyed only by whole seconds; it overwrites real bars and makes
  studies disappear.
- Exact source milliseconds must map to the same unique synthetic chart slots
  as the price series. A whole-second fallback is safe only when exactly one
  source candle exists in that second.
- Indicator alignment must recompute when the price series installs its time
  map, not only when candles change. Otherwise first paint can remain blank
  until a later live event closes.
- CVD and other execution-dependent studies must use verified flow coverage.
  Preserve genuine archive gaps; never manufacture bid/ask flow from OHLCV.

## 2026-09-04 — Zero Gamma Line integrity

- Never mix true scenario-repriced Gamma roots and interval-map balance roots
  inside the same live series. The alternating methodologies create a false
  saw-tooth even when the structural boundary is stable.
- Live Zero Gamma is a causal history of successive Black-76/open-interest
  scenario roots. Do not smooth or force it toward price; that would fabricate
  a level. Price above the root is the positive-Gamma regime and price below it
  is the negative-Gamma regime.
- A completed-session reconstruction must freeze its strike universe and stay
  on the prior root branch. Re-selecting strikes or the nearest root every
  minute causes structural chatter unrelated to an options-positioning change.
- Never interpolate Zero Gamma across the New York options close into the next
  day. Paint each 09:30–16:00 ET session independently with an overnight gap.
- Cash-index/ETF roots must be calibrated to the NQ/ES futures price scale
  before entering a futures chart, and display scale must be part of every
  point/cache identity.

## 2026-09-04 — Weekly Volume Profile latency

- A developing profile's cache identity must describe its stable market
  window, not the pane's latest candle timestamp. The gateway can resolve the
  current end time while an exact durable snapshot paints immediately and is
  reconciled in the background.
- Changing chart timeframe must not refetch an unchanged weekly execution
  window.
- Completed session-profile folds must retain a materialised whole-session
  price histogram. Weekly profiles merge those compact immutable reductions;
  they must not rescan every minute/price row of five sessions per request.
- Cold restores of independent daily fold files may run concurrently, but raw
  tape folding remains off the request path and outside the live-feed event
  loop.

## 2026-09-04 — Footprint input and live-paint integrity

- The workspace is the only execution-packet batching boundary. Footprint
  charts consume that canonical tape through the shared animation-frame queue;
  do not add a second per-chart timeout between a packet and its row/POC paint.
- A Footprint's selected input is one calculation contract, not just a label.
  Volume mode uses contract volume; Trades mode uses execution count for cell
  numbers, POC, value area, exact-price VWAP, Delta POC, maxima and summary.
- Every named Footprint chart variant must survive settings validation and the
  final chart resolver. Keep `volume-trades` and `trades-histogram` in those
  allowlists and in regression coverage.
- Bid/Ask and Delta remain sourced only from classified Rithmic executions.
  Unknown executions may contribute to total/POC but must never be assigned a
  side from candle direction or price movement.

## 2026-09-04 — Chart interaction budget

- Pan, zoom and drag movement belongs on the native chart or imperative
  primitive path. Do not make pointer frequency equal whole-Chart React render
  frequency, indicator recalculation frequency or persistence frequency.
- A viewport-backed study should retain a prefetched coverage window and
  rebuild only near its edge. Never restore a trailing delay that can leave a
  Footprint visibly behind the viewport after a fast zoom.
- Drawing persistence must flush on gesture release, but exporting and
  JSON-comparing every drawing on every pointer sample is prohibited.
- Magnet lookup must be bounded by the pointer's logical/pixel neighbourhood
  and read current candle refs. Its cost must not grow linearly with months of
  loaded history.
- Smoothness work must not reduce market-data fidelity, execution admission or
  indicator calculation cadence. Optimise scheduling, projection and retained
  work before considering any lower-frequency data path.

## 2026-09-04 — Chart emoji drawings

- Emoji marks are chart drawings, never DOM stickers. Persist their emoji,
  time, price and pixel size through the same chart/workspace drawing store as
  lines and shapes so they remain attached during pan, zoom and reload.
- Keep the Emoji rail group directly below Measure and give it a scrollable
  picker that includes the magnet and the shared desk emoji catalogue.
- A selected emoji may be dragged or resized from 16–160 px. Clicking away
  hides its handle without moving or deleting it.

## 2026-09-04 — Pending indicator release gate

### Session Imbalance release contract — 2026-09-07

- Session Imbalance is separate from the multi-session IB Levels study. It
  owns a selected opening window inside the 17:00 Chicago CME trading session,
  and may start from a user-selected exchange clock.
- Its midpoint and ±50%/±100% extensions are derived from the observed opening
  range only. A developing range must never read a future candle, and loading
  history must never fire old popup/sound alerts.
- The public guide and DLL contract are recorded in
  `docs/deepcharts-session-imbalance-audit.md`. Do not invent the optional DLL
  volume-line formula while it remains undocumented.

### Auction Gap Tracker release contract — 2026-09-07

- Auction Gap is an exact classified one-tick volume-at-price study. It must
  fail closed on partial history, mismatched contracts/bar geometry or broken
  live-stream continuity; never substitute candle gaps or grouped Footprint.
- Its background worker and incremental lifecycle are the only released path.
  Preserve historical hydration, replay and closed-market alert silence.
- Full evidence and protected-parity limits remain in
  `docs/deepcharts-auction-gap-tracker-audit.md`.

### Market Profile TPO catalogue identity — 2026-09-07

- `market-profile-tpo` is a legacy display-derived alias for the complete
  `tpo-chart` / TPO Daily study, not a second formula. Keep it canonicalized
  for saved workspaces and favourites; do not restore a duplicate Pending row.

- The pending-indicator overhaul starts from the frozen 21-row inventory in
  `docs/deepcharts-pending-indicator-overhaul.md`. Existing addable indicators
  are out of scope and must not be changed to make a pending row appear done.
- Never remove **Pending / In development** merely because a catalogue id,
  placeholder, or related shared engine exists. A study becomes addable only
  after its real data contract, calculation, defaults, full settings,
  theme-aware renderer, persistence, loading/error states, performance and
  regression/visual checks are complete.
- DeepCharts' protected DLL exposes useful names and setting metadata but not
  trustworthy formula bodies. Record what is observable and what is inferred;
  never claim 1:1 formula parity from strings or a similar-looking plot.
- DeepCharts Ratio Highlight is an auction-extreme ratio, not Footprint's
  diagonal cell imbalance: High uses Ask at high-1 divided by Ask at the high;
  Low uses Bid at low+1 divided by Bid at the low. Its documented Bar mode
  selects High on bearish bars and Low on bullish bars.
- Stop Spotter must never infer its inputs from OHLC candles. Its delta,
  horizontal-delta and consecutive diagonal-imbalance gates require exact
  classified Rithmic executions at one-tick price rows; otherwise it must show
  `WAITING_FOR_VOLUME_AT_PRICE`. `Seconds to close` is permitted on a forming
  bar only when the chart has a deterministic clock-based close.
- Cumulative Iceberg/Stop is two signed cumulative series: Bid activity adds,
  Ask activity subtracts. Volume mode may use execution-confirmed replenishment
  and reference-crossing stop-sweep evidence; both limitations must remain
  visible because stop orders themselves are not published and DeepCharts'
  reconstruction is proprietary.
- Never label trade count, refresh-cycle count or price-level changes as the
  number of individual MBO orders. Until the Rithmic gateway exposes stable
  maker/order IDs, Cumulative Iceberg/Stop Order mode must remain an explicit
  `ORDER_IDS_REQUIRED` capability state.
- Book Speed means fully consumed book price levels, not message rate, changed
  depth or traded contracts. Count a Bid/Ask level only when it is exhausted
  with a matching aggressive execution at that exact price; never turn a pull,
  cancellation or partial reduction into consumption. Seconds and tick-reversal
  measurement windows must share the existing Rithmic stream and remain aligned
  to real chart bars on event-based charts.
- KWANT Delta must remain an execution-derived grouped delta study, separate
  from the already available Delta Bar and CVD. Volume/Aggregate inputs retain
  recorded signed volume and delta extremes; Trades/Order use signed execution
  counts and never pretend contract volume is an order count. Keep the forming
  partial group live, preserve stable plot/colour identities across
  Classic/Multi Range, and refuse feeds without classified Bid/Ask executions.
- KWANT Wall is deliberately ES/MES-family only, matching the observable
  DeepCharts scope. It must require classified Rithmic volume-at-price at a
  recent high/low and a confirmed rejection; never infer a passive wall from
  an OHLC wick, unclassified volume or a cancellation. Do not claim the
  protected reference formula was copied.
- KWANT V-Tracker must remain execution-backed. Acceleration, Exhaustion and
  Slowdown use classified Rithmic participation/delta, while Pressure and
  Absorption use exact volume-at-price rows; never synthesize them from an
  OHLC candle. Preserve its explicit `WAITING FOR VOLUME AT PRICE` state, the
  independently switchable modules and the `PC/PE/AC/AE` invalidation lifecycle.
- Custom Draw-On Volume Profile is a chart drawing action, not a saved
  zero-anchor indicator instance. Adding it must arm the selected chart's fixed
  range profile; the drawing owns persistence and templates. A committed range
  must replace its immediate candle-volume preview with exact custom-period
  Rithmic price rows, and anchor/setting changes must be debounced and protected
  against stale responses.
- KWANT Profile Swing must remain separate from the existing Daily, Weekly,
  Composite and fixed-range profile render paths. Its profiles require exact
  classified Rithmic volume-at-price; nonzero min/max filters apply to each
  execution before aggregation, flow-only summaries and OHLC direction are
  never substituted, and missing exact data must remain a visible waiting
  state. Preserve all four Swing/Stop detector modes and the VWAP min/max/break
  contract when evolving it.
- Event-chart profile ranges may contain an open-ended forming bar. Never pass
  `Infinity`, `NaN` or another non-finite boundary to Date serialization,
  Lightweight Charts time coordinates or a renderer; resolve it to the latest
  finite execution/bar timestamp first. This is covered by the KWANT Profile
  Swing regression added after the first production QA crash.
- KWANT Profile Values is a level-only profile, not a second histogram. Build
  POC/VA/VWAP/peak/valley reads only from exact classified Rithmic
  volume-at-price, and keep its primitive independent from existing Daily,
  Weekly, Composite and fixed-range profiles. Visible mode follows the native
  viewport; overnight Filter/Split windows must not break at calendar
  midnight. Historical Order input requires recorded resting-book-at-price
  snapshots and must remain `WAITING FOR ORDER HISTORY` until that capability
  exists—never relabel execution rows as orders.
- Profile Values execution-size filters are a single calculation contract:
  final POC/VA/VWAP and every developing trail must use the same accepted
  individual prints. Never let filtered developing levels fall back to the
  unfiltered bar ladder.
- Market Statistics is a frequency calibration study, not a substitute data
  feed. Trade Volume and Aggregate Trades must use exact Rithmic executions;
  POC and Delta POC bar inputs require exact price-level rows. Historical Order
  input remains `WAITING FOR ORDER HISTORY` until recorded resting-order events
  exist. Its documented `AVG` is mean daily range frequency and Quant Desk's
  `Dev` is the maximum observed daily frequency. `% Dev. Std.` broadens or
  narrows the admitted observations around the dataset mean using an explicit
  standard-score window; never claim the protected DeepCharts coefficients
  were recovered from metadata.
- Confluence Identifier clusters distinct profile, swing and retracement
  sources within an explicit tick radius; duplicated observations from one
  source must never inflate the confluence count. Its three VBP inputs inherit
  the exact Rithmic volume-at-price contract. Historical Orders must remain
  `WAITING FOR ORDER HISTORY` until recorded resting-book snapshots exist, and
  protected DeepCharts formula internals must not be claimed from metadata.
- Overlay Chart may own a different interval and secondary price scale;
  Overlay Symbol must inherit the host chart interval. Both use the shared
  Rithmic execution subscription and merge delayed history behind the live
  seam. Volume-based candle width is actual rendered width, never relabelled
  opacity, and an unavailable secondary feed must not disturb the main chart.
- Overlay Timeframe Candlestick derives only from the host chart's current
  authoritative candles and must update the forming aggregate immediately. Its
  painted body spans the real higher-timeframe interval; do not replace it with
  a narrow ordinary series candle or another network polling loop.
- KWANT-M IVB is an exchange-time RTH opening-range model. Its projections are
  explicitly estimated from prior completed loaded sessions with no lookahead;
  never claim unpublished DeepCharts historical coefficients or allow the
  forming session to train its own displayed levels.
- KWANT Pattern Builder conditions must fail closed when an operand requires
  classified bid/ask or price-level history that Rithmic has not supplied.
  Never substitute OHLC or total candle volume for bid/ask flow. Advanced
  expressions are parsed from C1-C4 and logical operators only; never evaluate
  user-authored code, and never let an indicator signal bypass order
  confirmation or place a trade.

## 2026-09-07 — Average Daily Range Target

- Average Daily Range Target trains only on completed CME trading periods;
  never include the forming period or bridge an invalid candle seam. Daily
  periods roll at 17:00 America/Chicago, with weekly/monthly keyed from that
  trading date. Scaling is the current period open and the visible 0.5x/1x/
  1.5x target mapping is a screenshot-supported interpretation, not claimed
  protected formula parity.

## 2026-09-07 — Volume/Delta Sprint

- Volume/Delta Sprint is a rolling classified-execution study, not Tape Speed
  and not a resting-book proxy. Volume uses aggressive Bid/Ask contracts;
  Trades uses classified execution counts. Missing classification must break
  the segment, never become a zero bar, and filters apply to the selected
  per-bar side values unless future provider evidence establishes a different
  protected allocation.

## 2026-09-07 — Overlay Timeframe Highlight

- Overlay Timeframe Highlight derives only from the host chart's authoritative
  ordered candles and owns no feed subscription. Invalid/duplicate/out-of-order
  input breaks a visual segment. Delta colour and Bid/Ask summaries require
  classified execution fields; never infer them from candle direction.

## 2026-09-07 — Candlestick Bar

- DeepCharts `Vol Bars` means target/reversal price bars: Parameter 1 is the
  target in ticks and Parameter 2 is the reversal in ticks. It is not a volume
  threshold. Keep it distinct from `500v` and other fixed-volume chart modes.
- Minute overlays may aggregate authoritative loaded OHLC. Range and Vol Bars
  require exact non-`flowOnly` executions and fail closed without them. A
  reversal print belongs to the new bar exactly once; never multiply its
  volume or delta across both bars.

## 2026-09-07 — On Candle Stats

- On Candle Stats uses the shared execution-sequenced KWANT Stats calculator
  but owns a separate chart-anchored text-box renderer; do not move KWANT Stats
  out of its existing pane or treat the two catalogue rows as aliases.
- COT High/Low/Bar, delta-trade and high/low ratios require ordered exact
  executions. When that sequence is unavailable, those cells remain absent;
  never derive them from candle direction or total OHLC volume.

## 2026-09-07 — Shift Candle

- DeepCharts' protected Trinity formula was not recoverable from readable DLL
  metadata. Quant Desk implements the complete public control contract with a
  documented no-lookahead reversal model; do not call it proprietary formula
  parity without additional evidence.
- Shift Candle requires exact execution-derived footprint POC, delta and
  imbalance rows. It must fail closed without them. Historical/replay/closed-
  market calculations never emit alerts; only a newly confirmed live bar may.

## 2026-09-07 — Annotations Overlay

- Annotations Overlay mirrors calculated indicator annotations between open
  charts in the same workspace runtime by Chart ID and indicator instance or
  catalogue ID. It must never create a second provider subscription or
  recompute/mutate the source indicator.
- Source unmount removes the registry entry; self-reference and absent source
  IDs fail closed. Cross-process windows and manual drawings are not covered.

## 2026-09-07 — Important Levels

- Important Levels uses the 17:00 Chicago trading date for daily/weekly/monthly
  grouping. OHLC and HLC3 VWAP use authoritative candles; POC and 70% value
  area require exact one-tick execution rows and disappear if those are absent.
- Average Value is implemented as period high/low midpoint. Current-to-Right
  and Current-to-Last retain their saved option but currently use right-edge
  label placement; do not claim exact vendor viewport anchoring.

## 2026-09-07 — Speed of Tape

- `speed-of-tape` is the ordinary fixed-window activity histogram, not
  `speed-of-tape-instant` and not `tape-speed-order-flow-burst`.
- Volume and Trades use exact non-flow-only executions. Order mode must fail
  closed until the web feed supplies historical order-placement events; never
  reinterpret executions as placed orders.
- A standard-deviation value of zero disables deviation filtering. Positive
  values use mean plus the selected population-standard-deviation multiple.

## 2026-09-07 — Volume Swing catalogue cleanup

- `volume-swing` was a duplicate display-name-derived ID for the complete
  `deep-profile-swing` study. Keep it as a migration alias only; do not restore
  a second library row or split saved settings between two IDs.

## 2026-09-07 — Monthly / Session / Visible Range profiles

- These are owner-keyed `custom` execution profiles. Never route an unowned
  custom response into them or let one variant evict another.
- Visible Range uses logical bar indices and source execution bounds; debounce
  interaction and reject ambiguous event-bar cuts instead of counting hidden
  executions.
- Session uses explicit DST-aware windows. Monthly and Visible filtering stays
  fail-closed until disjoint-window aggregation exists.
- A prior contract/month must have complete exact execution coverage. Never
  substitute current-contract or OHLCV distribution and call it historical
  volume-at-price.

## 2026-09-07 — Chart emoji quick picks

- The emoji picker's top row is a persisted, global 16-item recent list. A
  selected emoji moves to the front, is deduplicated by Unicode presentation
  identity, and the oldest item is evicted. Keep the original set as first-run
  defaults and synchronize changes across open charts.
- Keep the picker heading and pager clean: do not show the total catalogue or
  filtered-result emoji count.

## 2026-09-07 — Volume profile stock width

- Every fresh or reset volume-profile family indicator starts with current and
  previous width `2`. This includes Daily, Weekly, Composite, Monthly, Session,
  Visible Range, Draw-on, Ask/Bid and Delta profiles.
- Explicit saved widths belong to the user and must survive normalization and
  settings migrations. Prompt/outcome:
  `docs/prompt-log/2026-09-07-volume-profile-stock-width.md`.

## 2026-09-07 — Public terminology privacy boundary

- Never expose Menthroq, Trinity, Bookmap, QuantData, Databento, Rithmic or
  Skylit in rendered site copy, dynamic status/error messages, tooltips,
  accessibility labels or same-origin embedded applications.
- Keep internal provider enums, API paths and transport contracts intact; the
  root presentation guard is the final privacy boundary. Whole-word matching
  is mandatory so ordinary words such as `logarithmic` remain unchanged.
- Prompt/outcome:
  `docs/prompt-log/2026-09-07-private-terminology-scrub.md`.

## 2026-09-07 — CVD event-bar authority and historical coverage

- Range, volume, tick and Renko bars own their baked ask/bid/delta fields. A
  bounded indicator tape must never overwrite those values after construction.
- Aggregated `flowOnly` tuples must retain their eight-field wire shape and may
  not be reinterpreted as individual executions. They cannot repair event-bar
  CVD; only exact prints may fill a genuinely missing bar.
- Current production NQ flow is internally consistent, but the sampled prior
  seven-calendar-day archive classified 79.179% of total volume versus 99.752%
  in the current session. Do not claim exact historical CVD parity over an
  incompletely classified session and never infer the missing side.
- Exact History Plant tick-side backfill for incomplete older sessions remains
  the durable historical-CVD follow-up. Prompt/outcome:
  `docs/prompt-log/2026-09-07-volume-profile-cvd-institutional-audit.md`.
