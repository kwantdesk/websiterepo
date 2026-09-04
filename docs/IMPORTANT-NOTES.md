# KWANTDESK important notes

This is the persistent launch ledger for material work that is incomplete,
provider-blocked or unsafe to forget. Every task handoff should include a short
recap of the open items below and update this file when their state changes.

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
