# KwantDesk Engineering Handoff

## 2026-10-27 Liquidity Map modal overlays and no focus outlines

All native map dialogs now drive the existing parent overlay suppression through `observeLiquidityMapModals`, not only inspector settings. Add Instrument/Help must hide parent Trade and watermark because iframe top layer cannot cover parent DOM. Focus outlines/rings removed in main globals and iframe site CSS per owner preference. Asset revision `20261027-modal-overlays`. See `docs/prompt-log/2026-10-27-liquidity-map-modal-overlays.md`; wider suite baseline has nine existing source-assertion failures unchanged by this task.


## 2026-10-27 Big Contracts live/sample stability

Fast admission rejects flow-only and unclassified records like the full pass, and uses canonical event IDs without a live prefix. Chart anchors arriving prints through the shared candle bucket/event-bar mapper and applies `mergeBigTradeLiveMarkers` for identity deduplication and the same per-bar display limit as sampling. Tests execute the actual Chart live handler with a manual minimum of 50, summary/unknown records, and stable minute coordinates. See `docs/prompt-log/2026-10-27-big-contracts-live-stability.md`. Preserve explicit clustering/session/adaptive settings; no VPS changes or trades.


## 2026-10-27 Additive drawing context menu

The clipboard hook must not replace normal Chart context actions. `data-chart-context-menu="full"` marks the existing owner; hook capture contributes callbacks via a WeakMap keyed by the original MouseEvent, then propagates to Chart. Chart includes Copy/Paste alongside all existing menu actions. Standalone drawing menus remain only for surfaces without a full chart menu. Regression in `tests/chart-drawing-clipboard.test.mjs` verifies actual listener delivery and callbacks; see `docs/prompt-log/2026-10-27-additive-chart-drawing-menu.md`.


## 2026-10-27 Liquidity Map bubble stability

Executed-volume bubbles default/reset to gross; owner live Differential checkbox switched off. Both clustering stages and initial frame grouping now isolate fixed 250 ms source-execution windows. Incremental renderer refresh expands to full windows, including cancelled groups missing from cache, preventing depth-only resurrection of a one-sided net bubble. Density/reference volumes are per window. Asset revision: `20261027-stable-trade-bubbles`. See `docs/prompt-log/2026-10-27-liquidity-map-bubble-stability.md` and regression tests. No provider/VPS changes or trades. Explicit net cancellation remains optional; rolling history and selected minimums still apply.


## 2026-10-27 — Red actual-entry arrows

- Filled entry markers are small red sideways arrows for both buy and sell.
  Their tip is the actual fill coordinate; the body sits 12px left of it.
  Manual drawing-tool colour/handle settings and existing exit markers remain.
- buildPaperFillMarkers uses actual ledger fills, exact fill prices, symbol
  filtering and a containing real candle. Missing/future clock buckets do not
  borrow an older candle. Event bars use source-execution starts and synthetic
  chart-axis mappings; ordinary clock charts ignore leftover event mappings.
- Marker hydration now depends on chartReadyRevision and includes directly
  observed candles before React history catches up. Existing marker hiding,
  selected-account filtering and ledger persistence still apply upstream.
- 28 targeted marker/execution/receipt tests, 13 manual-arrow checks and the
  focused fill integration check pass. Tests execute the actual canvas renderer
  and actual marker effect. No owner trade was placed or changed for testing.
- Receipt: docs/prompt-log/2026-10-27-red-entry-fill-arrows.md.


## 2026-10-27 — Big Blocks historical-marker finality

- Owner observed a block flickering about ten candles after its origin. Live
  decisions were already latched, but pre-existing snapshot/history decisions
  bypassed that authority and were replaced on every flow recalculation.
- Chart's snapshot paint now supplies candidate zones, minimum warm-up and
  live/replay mode to BigBlocksLiveState.synchronizeSnapshot. Closed historical
  bars with classified inputs join the existing confirmed/negative decision
  authority. Missing warm-up/classified data remains unknown until hydration.
- Once closed, origin/side/top/bottom persist across missing or conflicting
  recalculations. Existing right-edge projection expiry remains supported.
  Forming previews can still withdraw; replay snapshots bypass this live latch
  so rewinding never retains future blocks. Calculation-identity resets remain.
- Retention is chronological, not insertion order: an older history prepend
  must not evict a more recent live decision. Limits remain 120 zones/4096
  decisions, with the existing discarded-history exclusion.
- Three new regressions failed before the fix. 21 Big Blocks checks pass,
  including the actual Chart snapshot paint effect with a real calculated
  signal surviving 20 alternating flow recalculations and causal replay rewind.
- Receipt: docs/prompt-log/2026-10-27-big-blocks-closed-history-stability.md.


## 2026-10-27 — Drawing copy/paste across chart tool layers

- ChartDrawLayer now provides a themed right-click Drawing actions menu and
  document-capture Ctrl/Cmd+C/V through useChartDrawingClipboard. Routing is
  scoped to the last clicked chart/layer, respects text editors and ignores
  key repeats/modified browser shortcuts. A blank plot offers Paste after Copy.
- Detached clipboard snapshots preserve all styles/settings and prices. Pasted
  objects get new IDs and step sideways on each paste. SVG drawings move all
  time anchors together; precision drawings move both absolute time and logical
  index, including freehand paths. Precision alert IDs are regenerated.
- The shared hook also handles saved precision objects; real object hits take
  precedence over a different layer's empty-space menu. Right-drag measurement
  stays intact. Dormant precision grabs must ignore drawing UI/modern drawings.
- Professional registry and old SVG position drawings have context actions too;
  legacy shortcuts are focused-pane scoped and pasted risk prices stay exact.
- New copies enter existing commit/store paths for persistence and recalculated
  profiles. No backend/market-feed or owner account/order changes are involved.
- Receipt: docs/prompt-log/2026-10-27-drawing-copy-paste.md.


## 2026-10-27 — Closed candle background overwrite follow-up

- 8750a5c7 did not resolve the owner's reported closed-candle changes. Two
  remaining overwrite paths were reproduced: the routine four-minute heal
  replaced existing OHLC without completeness/correction evidence, then sent
  that snapshot through the verified-history override; a deferred React commit
  also copied older candles back into the synchronous CME execution writer.
- Routine healing now defaults explicitly to backfill-only: insert real absent
  closed buckets and repair flow without replacing existing OHLC. It no longer
  broadcasts an unverified snapshot as a verified closed-price correction.
  Deliberate correction utilities require the verified-correction policy.
- CME setters already write latestCandlesRef before setCandles. The render
  mirror must never copy an older React array back over that writer. Other
  adapters retain their React-driven fallback. Replay setters remain intact.
- Three regressions fail before the fix. 81 tests plus 8 explicit correction
  checks pass, including the actual background effect across 20 conflicting
  snapshots. Production build/scoped ESLint pass. A fresh VPS raw-tape sample
  (1,285 NQ executions; five closed minutes from 00:12 UTC on 27 October) matches
  the archive's OHLCV exactly. No provider restart or owner trade action.
- Receipt: docs/prompt-log/2026-10-27-closed-candle-background-stability.md.


## 2026-10-27 — Execution-authoritative futures candles

- Plain Databento/CME panes must subscribe to the shared Rithmic execution
  stream even without order-flow studies. Batched quote SSE retains only its
  last trade; it cannot reconstruct first/high/low prices. Quotes still update
  trading marks, but may not write futures OHLC or the startup candle cache.
- Populate the one-second startup cache once before execution fan-out. Reject
  midpoint/unclassified/cached quotes and aggregate flow records. Time-cache
  schema is time-v5 to discard old quote-built tails. Historical/event archives
  remain intact; no gateway restart or provider connection change was required.
- Closing-bar series.update must merge ObservedCandleHistory at paint time:
  React's prepared seriesCandles can predate the last direct wick/close update.
  Current clock bars also retain a source-end watermark against delayed prints.
- Three regressions failed before fixes.77 checks pass, including349 actual
  NQ executions matching archive OHLCV across six batch partitions. Build and
  scoped ESLint pass. A12-second live VPS probe returned128seed records and124
  incremental executions with a valid stream receipt. These observations do
  not prove every historical session has a complete raw execution archive.
- Receipt: docs/prompt-log/2026-10-27-execution-authoritative-candles.md.


## 2026-10-27 — Protection drag navigation regression

-3838acd6 saved references to Lightweight Charts' live interaction options.
  Its real boolean normalization/deep merge mutated those saved references to
  disabled flags, so restoring them left charts permanently locked after drag.
-Clone both option trees before disabling. Restore nested axis/touch/wheel
  preferences exactly. Do not revert to reference snapshots or a replacement-
  only option mock. Real installed library merge tests reproduced both failures
  before the fix;39drag/execution/receipt tests pass afterward.
-Receipt: docs/prompt-log/2026-10-27-protection-drag-navigation-restore.md.
  Existing locked chart instances require reload. Owner trades untouched.


## 2026-10-27 — Verified paper order receipts

-Order panel success requires matched ledger order/entry fill/open position and
  immediate durable save. Message reports actual side/size/price/account;
  pending orders stay “working”. Ticket changes clear stale notifications.
-Removed static/watchlist fake-fresh execution fallback. Validate both source
  and arrival timestamps. Live placement uses click time so pre-click ticks
  cannot instantly trigger a new position's protection; replay clock unchanged.
-Existing warmed execution fan-out publishes genuine last-trade simulation
  prices even without an open chart/position; seeds/summary rows never execute.
  No extra stream subscription or polling. Account restoration gates placement.
-39targeted tests, scoped lint and production build pass; no owner orders sent.
  Receipt: docs/prompt-log/2026-10-27-paper-order-fill-receipts.md.


## 2026-10-27 — TP/SL exact drag placement

-Stable plot captures protection drags with scaled chart coordinates/grab offset.
  Temporarily locks native gestures/autoscale; restores their prior settings.
  Active preview ref prevents stale per-frame DOM positioning. Final pointerup
  wins; cancel/blur/source disposal release capture and execution suspension.
-Workspace no longer silently re-clamps the released stop to a later quote:
  actual update is the preview's tick-snapped price. Release itself still only
  arms the stop; subsequent real execution events evaluate working protection.
-36scoped drag/execution/journal tests pass. No owner trades manipulated.
  Receipt: docs/prompt-log/2026-10-27-paper-protection-placement.md.


## 2026-10-27 — Durable demo journal recording

- Owner's “20 october” demo account preserved. Live Journal already had16rows,
  including26Oct; its P&L does not reconcile to the demo balance. Missing old
  cleared executions have not been recovered or invented.
- Closing fills now enter durable ledger journalFills evidence. Clear-fill,
  chart-history clear, demo reset and JSON hydration retain this evidence.
- Chart-side journal writer uploads new paper accounts/rows without opening
  Journal. Authenticated append-paper checks owner and ignores existing trade
  IDs, protecting reviews from stale device uploads. Focus/online retries.
-41targeted tests and14legacy checks pass; five old integration source-regex
  failures reproduce against unmodified HEAD. Receipt:
  docs/prompt-log/2026-10-27-demo-journal-durable-recording.md.


## 2026-10-26 — Big Contracts selected history

- Days to load now triggers bounded daily archive requests (two concurrent),
  preserving historical candidate executions separately from dense live tape.
  Sparse candidates feed only Big/Deep Contracts; never CVD or replay live data.
- Multi-day requests no longer lose their left edge to the archive's response
  ceiling or newest-only drawing limits. Drawing budgets distribute markers
  across the selected span, preserving both edges; not every low-threshold print
  is drawn when those budgets are exceeded. Longer periods extend price history
  without replacing visible candles. Calendar days retain their existing meaning.
- Recorded archive remains a strongest-executions sample, not a complete raw
  tape. Missing recording periods/weekends cannot be fabricated. No VPS restart.
- Receipt: docs/prompt-log/2026-10-26-big-contracts-selected-history.md.

## 2026-10-24 — Closed candle body integrity; gateway activation pending

- Four failing regressions reproduced initial seeded open changes after close,
  stale receipt-clock close rewinds, arrival-ordered archive OHLC and lost
  sub-ms ordering on restore. Browser buffer protects seeded closed opens and
  rejects cross-bucket receipt clocks without blocking a real exchange print.
  Unseeded first-bar history and unobserved archive corrections still work.
- FuturesBarArchive persists optional first/last source clocks and orders OHLC
  by microseconds, retaining true extremes/volume and six-column compatibility.
 69 focused tests plus19 authority intervals, scoped lint and build pass.
- VPS still runs old exact source5ee5eed775cc40deb4075744e7c03477dcbd1cd0b51e1900882d12f91d2d5074.
  DO NOT claim archive repair active until approved brief gateway-only restart.
  Preserve all existing vendor/book-store mounts, image, secrets and recordings.
  Old bad archive bodies require a separate source-backed reconciliation.
  Record: docs/prompt-log/2026-10-24-closed-candle-body-integrity.md.

## 2026-10-24 — LIQ Map protection dragging and normal-chart labels

- Stable plot owns pointer capture, not the moving/unmountable label. Final
  release coordinates, iframe scaling, pointer IDs and account/symbol scope
  are guarded; cancellation always releases protection suspension.
- TP/SL now match normal-chart label dimensions, typography, theme/candle
  contrast, signed size, tick precision, projected P&L and removal controls.
  Partial targets retain remaining quantity/target identity; shared ledger only.
-12 tests and scoped lint pass; isolated browser SL/TP and off-plot drops commit.
  Build/typecheck pass. No owner trade changed. See prompt-log/2026-10-24-liq-map-protection-drag.md
  under docs. Authentication middleware outage remains a separate production
  acceptance blocker; never claim a real-account drag test was performed.

## 2026-10-24 — Detailed Kwanty re-audit and demonstrated parity repairs

- Release04f85f5f is READY and public diagnostics report the exact SHA/gateway200;
  app21/new modules are served. Fresh signed-in `/kwanty` reload instead504s in
  middleware before shell. Other authenticated routes show the same25s timeout;
  configured Auth health with its public client key timed out7s then15s. Do NOT
  call production acceptance passed or bypass auth. Detailed local receipt is
  in the ledger below; no doc-only second deployment. Requires auth-service
  recovery and fresh signed-in UI acceptance, in addition to standing parity gates.
- Ledger: docs/KWANTY-DETAILED-REAUDIT-2026-10-24.md. Full vendor/live/all-tool
  acceptance remains OPEN; fresh reference controls, shipped-source evidence,
  real SPX archive lineage and isolated app QA are explicitly distinguished.
- Line price style no longer bypasses Orderflow interval aggregation. The
  observed SPX1m Net Convexity40-row minute now matches-26181.28 exactly.
  Classic's three history trails gain source-evidenced Scatter/Line(300MA),
  conversion-before-mean and bounded weak caches; null prices remain gaps.
- Historical Orderflow profile slots use exact-session manifests/lazy pages,
  bounded sharing, causal marker/replay selection and enabled-page playback
  readiness. Missing/incorrect pages stop replay; no invented profile surface.
  Added observed seven signed vertical-offset step actions.
- State/Orderflow target panel owns replay price cutoff. Classic/State/Flow
  validate every raw history row before latest-session merging can conceal a
  wrong date/category. Partial session cache can upgrade on existing coordinator;
  complete verified EOD stays cached, errors retain valid prior observations.
- Browser found Kwanty history504 MIDDLEWARE_INVOCATION_TIMEOUT, while direct
  VPS same archive returned200. Known GET operations skip duplicate middleware
  remote refresh only after valid site gate; route getRouteActor remains required.
-297 focused tests pass; scoped lint0errors/one existing cleanup-ref warning.
  Archive comparator matches15,739rows/251,824metricvalues and539 sampled full
  profiles each for Classic/Gamma/Charm. Not all pages/tickers/private frames.
- No cadence increase, new paid resource, provider socket negotiation or VPS
  restart.30s REST, classified-field gaps, historical futures-price bridge,
  full history breadth, alerts/pop-out and multi-panel live soak remain open.
  Standing gateway overload/recording/restore/capacity gates are not closed.

## 2026-10-24 — Detailed GEX Data re-audit (not blanket parity)

- Post-release signed-in QA revealed an independent blank startup gate:
  GEX host account identity waited behind potentially stalled cloud preference
  hydration. GEX now receives its own getUser-verified identity immediately;
  trading/journal hydration gates and API authorization are unchanged. Identity
  resets before a new verification; no username/local/anonymous fallback.
  Late cloud hydration preserves newly edited GEX storage only if its embedded
  accountKey exactly matches the verified user, with existing size/key bounds.
  Six new tests plus real deferred-hydration same/foreign-owner cases pass.
- Fresh sequential UI/source coverage of all22 current GEX Data tools against
  the signed-in reference. Ledger: docs/GEX-DATA-DETAILED-REAUDIT-2026-10-24.md.
  Exact row/cell checks and visual-only checks are deliberately distinguished.
- Fixed Net Drift clicked interval spanning missing buckets; equity LIT_POOL
  execution-side badges (never classify using later quotes); Date-column
  latest/historical order and saved layout preservation; table fill contrast;
  ranking/metric control sort ownership; line domain using invisible wicks;
  and successful primary map/exposure being discarded on auxiliary failure.
- MarketMap latest control now uses the dated verified SPY close boundary;
  no fictitious source minute/price/history is added. All modified module and
  iframe entry URLs are cache-busted, including normal-chart tool panels.
- Freshly observed unresolved discrepancies: consolidated API session totals
  versus private website totals, market-share group ordering, unavailable
  forecast adapter, missing standalone reference tools,30s refresh floor and
  full raw bucket/private/live completeness. Do not claim all tools/snapshots
  are1:1 merely because regression tests pass. No provider math offsets added.
- No gateway restart, new subscription/service or refresh-rate increase.
  Standing archive gaps, gateway overload/recorder soak and Kwanty parity
  issues in IMPORTANT-NOTES remain open; this task does not close them.

## 2026-10-24 — LIQ Map stalled-depth recovery and bubble paint cost

- Owner reports LIQ Map repeatedly freezing. Read-only gateway check showed
  connected/advancing messages, no current overload; lifetime50 trips/max1,306ms
  and MNQ dropped37,864 records remain separate backend limitations.
- Found browser recovery defect: lightweight price ticks reset depth freshness,
  masking a dead full-book stream. Only normalized real depth/history frames now
  reset it. Existing8s stale probe has4s body-aware deadline; a newer recovered
  book replaces the stranded SSE socket with the existing180ms reconnect/cursor.
  Same-book probes do not create fake market events. Late bootstrap responses
  cannot rewind newer accepted SSE depth. Reconnect scheduling avoids an extra
  immediate probe from the old request's finally block. Healthy cadence unchanged.
- Bubble paint and incremental refresh performed history.indexOf for every
  cluster/anchor boundary. One frame→index Map per paint now replaces these
  O(history × bubbles) scans, with exact rolling-window/removal semantics.
  No trades, settings, depth rows or history retention removed.
- Four new runtime tests cover tick/invalid-depth masking, actual socket repair,
  body timeout/single-flight release, late-probe rewind and2,500 bubble anchors
  against1,800 frames. Existing feed/anchors/performance/smooth-motion tests pass.
  Broad LIQ suite98/106 pass:8 legacy controls/assets source assertions fail on
  unchanged HEAD too; two intentional iframe cache-revision gates updated.
  Scoped ESLint and production build/typecheck pass. All changed module/iframe
  entry URLs cache-busted. No gateway restart or new paid service/poller.

## 2026-10-24 — History-fed wick retention and fresh repaint inputs

- Owner still reports printed historical candle wicks disappearing after feed
  restart. Reproduced two failures in ObservedCandleHistory: accepted history
  extended an observed bar but was not remembered, so the next stale response
  shrank it again; the first live tick lacked the history-seeded forming OHLC.
- The bounded, source-scoped buffer now seeds that first tick from the known
  history tail and remembers accepted history/live OHLC unions for observed
  bars. Unobserved archived bars remain provider-correctable; symbol/contract/
  interval/replay scope changes clear both history seed and observations.
- Chart full redraw and recreation now reconcile observations at the actual
  setData boundary. Memoized render arrays can predate imperative live ticks
  or a rollover. Recreating the series from that stale array erased printed
  wicks. Both setData paths use freshly reconciled data, including HA conversion;
  rendered-tail timestamps/counts follow the data actually painted.
- Added five regression tests, including executing actual Chart.tsx paint
  expressions against a stale render plus newer direct ticks. The original two
  new history-extrema tests failed before repair and pass afterward. This is
  targeted regression evidence, not certification of all vendor data accuracy.
  No provider cadence, paid resource, recorder retention or VPS restart changed.
- Verification:12 repaint tests plus4 render-continuity tests pass; live authority
  covers19 intervals, live path13 checks, Rithmic integrity2,650 combinations.
  Production build/typecheck passes. Full Chart.tsx ESLint exceeded its default
  4GB Node heap; do not report that lint run as a pass.

## 2026-10-24 — Gateway hot snapshot optimization activated with owner approval

- Freeze investigation continues: public health at14:04Z connected/authenticated,
  fresh source messages and QuantData snapshot success, but cumulative overload
  trips reached99 (max lag3,396ms). Recovery at one instant is not a soak pass.
- A bounded five-second host perf sample (no inspector, no feed restart) found
  network-write/compression and V8 allocation/marking pressure. Unsymbolized JIT
  samples do NOT identify one proven root-cause function.
- Concrete hot-path waste removed locally in book-store.mjs: depth1 snapshots
  select the best price without sorting full ladders; incremental trade snapshots
  walk only their bounded newest tail instead of filtering the retained ring.
  Normalized sequences increase on append; restored history has negative cursors.
  Full history, recording, exact trades and price ordering are unchanged.
- Tests cover old/new output equivalence, source immutability, bounded record
  reads and restored negative cursors. Related book/flow/replay/provider-stream
  suite passes43 tests, including the restored-history test.
- Owner explicitly approved restart (“YES GO”). Recreated only gateway at
  2026-10-23T14:19:27Z (24 October Brisbane), preserving the image and both vendor
  runtime overrides. Runtime baseline matched HEAD before replacement. Added
  one read-only book-store mount in /opt/kwantdesk/compose.yml; exact deployed
  SHA25676a27418b75b1a6a847511e45ac6859363ab97a6db5ba512d06797de9132fbc8.
- Rollback files on VPS: compose.before-hotpath-20261024.yml and runtime-overrides/
  book-store.before-hotpath-20261024.mjs. Removing this mount via the backup
  compose and recreating gateway restores the prior image implementation.
  Do NOT use legacy ship script over current production compose/credentials.
- Verified healthy/authenticated, advancing source and QuantData timestamps;
  NQ recorded count64k→101k→175k, no recorder errors/drops. Vendor override
  hashes still match their host files. No other service restarted or extra
  provider login was created. 43 focused local tests pass.
- NOT a full freeze-resolution acceptance: after startup observed5 overload
  trips, max851ms (prior max3,396ms; different observation windows, not a valid
  performance benchmark). Live ticks continued. Vendor edge also reported
  “The provider response is too large.” This remains to diagnose; do not remove
  response limits or pretend oversized option history is successful data.
  Follow-up14:22Z: recorder count NQ313k; MNQ reported14,056 dropped records
  after the initially clean checks. Count stayed unchanged on the next check,
  backlog drained below1MB and overload cleared. This is an explicit archive
  gap, not lossless history; do not conceal it or certify recording completeness.
  No additional Vercel build was triggered for this server-only activation.

## 2026-10-23 — GEX opening delivery and reachable-but-busy recovery

- Live owner report: first five opening minutes unavailable, then unreachable
  messages and options/GEX ticks freezing/recovering. Read-only VPS check found
  Rithmic connected/authenticated, but event-loop guard repeatedly overloaded
  (max observed lag 3,396ms, trip count rising 29→44). Main container healthy,
  restart count0/OOM false, started13:32:38Z; no restart was performed here.
  QuantData snapshots alternated aborted requests and successful live updates.
  This is real gateway load, NOT proof of a provider disconnection. Root VPS
  event-loop pressure is not resolved/certified by the delivery changes below.
- Institutional fetch now returns explicit JSON503 live_feed_priority without
  tripping the whole-origin breaker. Other 502/503/504/HTML failures retain
  their outage protection. Vendor transport preserves caller abort and deadline
  through response-body consumption, rather than replacing the caller signal
  and clearing its own deadline after headers. Explicit busy responses remain
  scoped; no error is relabelled as successful market data.
- GEX Map publishes healthy panels individually as soon as they settle; removes
  serial45s sibling retry barriers. Failed cycle retries after5s. Refresh delay
  is assigned outside React state updaters. Existing interval-map backoff is
  capped during the first five opening minutes, and closed-session timers wake
  at weekday09:30 New York (DST aware) rather than sleeping across it.
- During opening only, provider404/422 on minute-price/interval HISTORY cannot
  blank a genuine current strike ladder. No exposure remains an error; no fake
  interval frame or historical replay is generated. Partial history is marked
  historyPending and DELAYED; other auth/quota/transport errors remain errors.
- Six new recovery tests, existing deadline/failure isolation/loader checks
  pass. Five legacy hydration source gates fail on unchanged HEAD too; the
  serial retry gate is updated for the new publishing design, other four stale
  assertions are left alone. Build/typecheck passes; ESLint has one pre-existing
  ARIA slider warning. No new service, provider subscription, poller, spend-limit
  change, VPS mutation or market-data gateway restart.

## 2026-10-23 — Candle rollover and redraw integrity

- Reproduced mergeLiveMidIntoCandles deleting a genuine current bar when a
  previous-bucket delayed print arrived near rollover. A mislabelled history
  tail may now be trimmed only if ahead of wall-clock time, not merely ahead
  of an old packet timestamp. Delayed ticks cannot erase the new live candle.
- Explicitly isTrade=false futures packets retain trading mark dispatch but
  cannot paint trade OHLC. Legacy packets without a trade flag are unchanged.
- Renderer retains up to 2,048 observed clock bars per scoped pane/symbol/
  interval/provider/contract/live-replay identity; full history redraws cannot discard earlier
  observed extrema or omit an already observed latest bar. Older same-bar
  source times cannot rewind close; equal-ms prints retain arrival order.
  Startup partial bucket keeps archive-open authority. Unobserved historical
  bars and event-chart rebuild authority remain unchanged; scope switches clear
  retention and replay never reads live observations.
- Earlier OHLC corrections and batches of 2–5 new bars force actual series
  replacement; updating only the newest bar previously skipped these changes.
  Retention runs on existing React history commits, not a new per-tick full
  history render, subscription, poller or provider request. No VPS restart.
- Seven targeted tests cover rollover deletion, quote-only prints, closed wick
  retention, stale-close ordering, scope isolation, bounded storage and redraw
  detection. Existing 19 interval live-authority checks, 13 visual path checks,
  2,650 Rithmic instrument/interval combinations and 12 continuity/CVD/VWAP
  regressions passed. New helper lint passed; full chart files are build/type
  checked instead of invoking the previously memory-exhausting whole-chart lint.

## 2026-10-23 — Bulk Journal removal manager

- Journal header Manage journals opens a themed, searchable checkbox list of
  active and archived custom/demo/manual/imported journals. Select all shown
  adds only filtered results; Clear selection and selected count are explicit.
  ZYON/Overall built-ins cannot be removed through this workflow.
- Remove selected opens an exact-name review and typed DELETE N JOURNALS
  confirmation. It discloses permanent removal of journals, trades, imports,
  evidence, analysis and linked Socials posts; trading accounts/balances/fills/
  open positions and unselected journals are unaffected. No reset/delete was
  submitted against user data while implementing or testing.
- Reuses authenticated owned-account delete endpoint sequentially; no bulk SQL
  mutation or polling. Only server-confirmed successes get persistent deletion
  tombstones and functional current-state purges, preserving incoming live data.
  Failures remain selected with per-journal errors; successful deletes are not
  rolled back. Account switch stops new requests and keeps confirmed in-flight
  deletion tombstones under the original owner without mutating the new UI.
- Six bulk tests and fifteen adjacent reset/deletion/detail checks pass; scoped
  ESLint passes. Existing per-journal reset behavior is unchanged.

## 2026-10-23 — Expanded per-trade Journal execution details

- Clicking a trade now shows exact hold time (milliseconds/seconds, not rounded
  minutes), local entry/exit timestamps with timezone, recorded maximum gross
  unrealised profit/loss (MFE/MAE), gross profit giveback, peak capture percentage,
  direction-aware price movement and initial risk. Existing review/source fields
  remain. Scale-outs describe the record's closed quantity, not whole-position P&L.
- New pure journalTradeDetails helper computes like-for-like gross excursion
  metrics. Missing/invalid excursions stay Not recorded; no fabricated intratrade
  curve/high/low from entry/exit or post-trade candle history. Unknown timestamps
  cannot imply a duration; a genuinely recorded hold duration remains valid.
- Root cause fixed: /api/journal sanitizeTrade previously discarded both excursion
  fields during cloud sync. They now survive writes. Existing records whose
  metrics were never recorded cannot be reconstructed by this change.
- Demo close analytics include final realised gross P&L among excursion extrema,
  so an immediate manual exit without a prior quote cannot report MFE below its
  actual exit profit. Fill timing/prices and order matching are unchanged.
- Six detail tests (including actual demo open/close-to-journal bridge), eight
  protection checks and fourteen paper-journal checks pass. Scoped ESLint passes.
  No new live polling, provider request, subscription or VPS restart.

## 2026-10-23 — Individual journal reset controls

- User clarified: a reset option inside each journal, never a global reset.
  Journal header now exposes Reset journal for imported/manual/demo journals;
  existing ZYON reset remains separate. Overall Journal has no reset-all action.
- Exact typed confirmation names the target. Authenticated reset-account writes
  a private per-account timestamp in existing social_objects account metadata,
  preserving archive/order state. No deletion of account, trades, public posts,
  trading balances, fills or open positions. No reset was submitted during tests.
- Reporting excludes trades closed on/before cutoff (open date fallback), old
  imports/evidence and consolidated contributions. Older historical re-imports
  remain excluded; future closes continue. This is reporting reset, not erasure.
  Cloud GET, client projection, IndexedDB saves and stale hydrate guards enforce
  it, so demo ledger backfill cannot resurrect the old reporting history.
- Tests: 18 focused account reset/deletion/ZYON/demo-link checks pass; journal
  suite 28/29 with the already-documented stale equity palette source assertion.
  Scoped ESLint passes. No paid resource, stream, poller or VPS change.

## 2026-10-23 — GEX Vue snapshot lineage and causal replay

- Audit ledger: `docs/GEX-VUE-SNAPSHOT-PARITY-AUDIT-2026-10-23.md`.
  Bounded licensed REST comparisons: 3,992 frames / 740,253 call/put/net
  values across default SPXW/NDX/QQQ/SPY GAMMA front-expiry $1 selections
  and SPY all-expiry 1%, for Oct 16 and Oct 22. Do not turn this into a
  blanket private-website/live/all-Greeks certification; open rows are explicit.
- Compact live maps retain the actual first recorded opening surface (cache
  suffix compact-v2); content-sensitive ETags admit equal-total corrections.
  Replay must never advance the clock to future exposure or borrow latest spot.
- Bounce display heads/trails and request seek-generations are causal. Missing
  numeric query settings use defaults, not Number(null)=0. Dark Pool calibration
  samples and frozen receipts cannot be learned after the replay clock; no
  completed-session close fallback when historical prints are absent.
- Keep custom Bounce/dealer-inventory calculations distinct from raw structural
  OI. No additional live cadence, vendor login, VPS process or subscription.
- Focused regressions: 24/24. Bounded audit script requires explicit --run;
  it is not a background job. All-expiry full history exceeds Next's 2 MB
  persistent cache item limit; successful response is not cache certification.

## 2026-10-22 — Demo fast-wick TP/SL execution

- Gateway quote fan-out intentionally keeps only the last trade per quote batch.
  It is display data, not a lossless execution source: a TP/SL touch and reversal
  within one batch was invisible to the demo engine. Live futures fills now consume
  every actual print from the existing shared per-contract execution worker, in
  arrival order including equal-millisecond executions. Sampled futures quotes
  mark P&L only and cannot race ahead of the tape's protection watermark.
- Warm the selected futures symbol for saved demo accounts and retain subscriptions
  for all open positions/working orders, independent of selected/visible chart.
  Diff subscription keys; selecting another instrument must not reconnect existing
  protection. Reuse worker/fan-out, no new upstream vendor login or poller. The
  existing deployment-controlled stream transport is unchanged; this is not a
  claim that browser demo orders execute server-side while the browser is closed.
- Seeds are not newly executable orders. Aggregate flow/footprint summaries and
  invalid records cannot fill; delayed prints before a resting order's createdAt
  cannot enter it. Exact working stop/target fills retain their configured tick,
  first actual hit wins, partial quantities/OCO behavior and drag suspension remain.
- Flush admitted queued executions before reconnect: otherwise dedup discards the
  same recovered prints forever. Cached-history resting-order reconciliation now
  applies synchronously to the latest ref after I/O, never overwriting a live exit
  with its stale pre-await ledger. Journal/execution persistence remains shared.
- Tests: tests/paper-execution-tape.test.mjs (14), continuity (3), existing protection
  triggers (8), limit fills (8), limit-order ticket/engine/chart and stream watchdog.
  Legacy paper-trading-integration source gates have the same five failures on
  unchanged HEAD (16/21); baseline checked, not introduced by this repair.
  Receipt: docs/prompt-log/2026-10-22-demo-fast-wick-exits.md.

## 2026-10-22 — Demo account to Journal linkage

- Actual Accounts showed20 october with12 current exits; Journal had duplicate
  same-name cards labelled imported. Paper journal ids previously contained
  spaces while API cleanId stripped them; hydration treated local/cloud aliases
  as separate accounts. Cloud source was also downgraded to import.
- Paper ids now use the cloud-safe alphabet before local persistence; alias
  normalization coalesces identical cleaned ids and preserves trade arrays,
  archive metadata and ZYON reset cutoff. GET reconstructs paper source from
  reserved paper- ids without changing DB schema or requiring a migration.
- Journal boot reconciles actual locally saved demo accounts and real ledger
  exits, guarded by existing deletion tombstones. Empty demo journals can sync
  before a first trade. No balances/positions/fills are edited or reset; older
  journal records remain even when source fills were cleared in the past.
- Cards explicitly say Linked demo account; duplicate display names are not
  rendered twice.28 focused bridge/link/deletion/reset checks pass. Different
  account names that sanitize to one id fail closed instead of being merged.
  New id collisions use the actual demo account id as their unique suffix. No extra
  live poller, provider request or VPS restart was added.

## 2026-10-22 — ZYON performance Journal reset control

- Journal > ZYON Journal now exposes Reset journal with a theme-aware modal,
  exact typed confirmation and cancel. Adding the control does not reset data.
- ZYON performance is derived from reviewed social receipts, not journal_trades.
  Reset persists an authenticated private account-state marker in existing
  social_objects storage; no schema/purchase/new polling. It excludes receipts
  created on/before the server timestamp from ZYON and consolidated totals.
  Later edits cannot resurrect an old receipt. Future outcomes still appear.
- Original Gameplans, conversations, receipts and other/paper journals are not
  deleted or changed. Local IndexedDB and memory retain the cutoff; hydrate
  merges keep newest cloud/local cutoff and guard same-account reset races.
  Old in-flight outcome and analysis requests cannot repopulate cleared UI.
- Browser checked button location, disabled-until-typed confirmation and Cancel
  without submitting any reset.24 focused journal tests pass. Existing equity
  curve source test is stale (expects primary/danger instead of journal-win/loss)
  on unchanged HEAD as well; do not change palette code to satisfy it.

## 2026-10-22 — Drawing pan/zoom frame alignment

- Live `ChartDrawLayer` was scheduling rAF from the native repaint callback,
  delaying SVG geometry one paint behind candles. Its viewport projection now
  runs synchronously in that paint callback (four anchor lookups, no full React
  reconciliation). Keep empty-layer subscription guard and trailing zoom settle.
- Capture projection basis during render, not layout commit: React may yield
  while the native chart keeps moving. Layout commit re-aligns the rendered basis
  against the current viewport before paint rather than clearing compensation.
- Pane clip is stationary outside the transformed group; otherwise its boundary
  pans/scales into the axes. Descendant strokes explicitly stay non-scaling.
- Browser acceptance fixture `tests/fixtures/drawing-motion-audit.tsx` uses only
  synthetic candles and the real native chart/repaint/SVG components. Temporary
  local auth route is removed before release. 180-frame pan/zoom/autoscale plus
  concurrent React updates: delayed control failed at43.789px; patch <0.001px.
  No data-feed cadence, gateway, persisted anchors or drawing settings changed.

## 2026-10-22 — Classic/State exact paged profile history

- History was still sent to denied Quant history for Classic/State; previous
  EOD repair only handled Orderflow. Private relay now falls back on403/404
  only, exact package/category/date;401/429 remain failures. Five-minute
  denied-selection memo prevents repeated forbidden vendor reads during indexing.
- Classic/State EOD arrays exceed140MB. ZIP/CRC validation + bounded streaming
  JSON reader build atomic gzip pages (<=200 original rows/2MB) and a full
  second-resolution summary timeline. No resampling, interpolation or fake
  profiles. Metadata strips only strikes/mini_contracts, exact arrays lazy-load.
- Profiles index under /recordings/gexbot/profile-replay;2GiB root guard,
  1GiB free reserve,128MiB/category compressed budget, one build at a time.
  Cold indexing returns retryable503 after4s; request-driven browser retries
  only EOD_INDEX_BUSY/BUILDING for<=120s, cancellable; no permanent poller.
- State retains complete paged timelines rather than generic1200-row tails.
  Client shares exact pages by selection, max12 pages/two requests. Playback
  waits for its exact frame, restarts at beginning when Play is pressed at
  close; empty session cache can retry after30s on demand instead of forever.
- Verified real Oct21 QQQ Classic/GEX/Gamma/Delta22017 observations and SPX
  StateGEX15739 observations; preserve genuine source gaps. QQQ warm VPS
  manifest+last-page timings0.76–1.92s, not whole-browser latency claims.
- Only gexbot-relay sidecar recreated; Rithmic start time unchanged. Existing
  provider credentials/subscriptions/disk; no purchase or new provider session.
- OPEN: older dates not previously persisted are unavailable when source EOD
  returns a different/latest day; no arbitrary90day/full-universe history claim.
  Live30s positioning cadence, full parity, month archive and recovery gates
  remain open. Version standalone12/embedded13/app20/state3/session-history2.
- Receipt: docs/prompt-log/2026-10-22-kwanty-profile-history.md.

## 2026-10-22 — Orderflow full-session restoration and line-mode parity

- Previous native history403 does NOT establish all history is unavailable.
  Official `/v2/hist/eod/{ticker}` includes eligible existing-tier daily ZIP
  reports. QQQ Oct21 report verified: 22,017 native one-second observations,
  timestamps1792589480..1792612800, actual one-minute convexity extrema
  -211.33/+422.09. Preserve missing source intervals; never invent observations.
- Private VPS relay owns bounded, request-driven EOD download/cache/ZIP reader;
  exact filename/date/member/ticker/time and CRC validations, no redirects,
  128MiB download, 1GiB disk guard, hourly per-ticker retry hold. No new billing
  resource and no Rithmic gateway restart. Reports remain on included disk.
- Authenticated session API compresses raw arrays as gzip-base64 below4MB;
  browser bounded-decodes exact values and retains up to30k rows/40MB per active
  Orderflow source, three session jobs. Generic profile budget stays unchanged.
- Line mode does not bucket despite saved candle interval. Candle flow SUM,
  exposure MEAN, last price/major observations and post-bucket masks remain.
  Panel-owned model reuse avoids full session aggregation on pointer paints.
- Version chain standalone11/app19/orderflow4; embedded shell cache unchanged.
- OPEN: live REST acquisition remains30sec, not one-second parity. This change
  restores completed available reports, not unreceived live velocity spikes.
  EOD endpoint only supplies newest eligible report, not arbitrary90day history;
  reports must already be persisted for older-date replay. No blanket parity claim.
- Receipt: docs/prompt-log/2026-10-22-kwanty-convexity-session-repair.md.

## 2026-10-22 — KWANTY disappearing overlays

- Anchor default positioning windows to genuine positioning-session records,
  not overnight underlying prices. Classic/State share this session anchor;
  Orderflow resets only its affected pane's manual view/pins on source rollover.
- Live profile and Orderflow observations are independently timed. An unpinned
  live profile uses its own latest same-session source time, even if one second
  newer than Orderflow. Paused/replay/pinned profiles retain no-future cutoffs.
- Paint isolated genuine exposure observations across null/zero gaps. Enabling
  profiles preserves their price coordinate system when Spot drawing is hidden.
  Never interpolate missing metrics or treat raw exposure as price.
- Version chain: standalone index10/embedded12/app18/overlay and Orderflow3.
  No poll cadence, provider session, VPS restart, billing or account schema change.
- Current provider snapshot QQQ/SPX Oct21 close200 includes real overlay fields.
  QQQ Oct21 native history403 UPSTREAM_ENTITLEMENT_REQUIRED; legacy history401.
  Full-session curve/replay parity remains OPEN; this repair cannot recover
  unreceived history. Prior full-month, archive restore, capacity and live-soak
  gates remain open. Verification receipt is in the dated prompt log.

## 2026-10-21 — GEX Data queue and failure isolation repair

- Incident: provider headers19 remaining/reset55 caused the shared budget to
  delay every successful request by ~2.9s, exhausting multi-panel deadlines.
  Reset means full refill, not next token. Apply optional header pacing only
  below10 remaining, per provider guidance; preserve180/min,350ms spacing,
  concurrency2, real429/zero-token backoff and12MB response ceiling.
- Known request-scoped gateway failures now carry a fixed error-code header.
  The website preserves their real error response without poisoning the whole
  QuantData origin breaker. Unclassified transport failures still trip it.
- Six actual saved workspace provider reads returned200 in40–264ms individually.
  Scoped gateway runtime mounts deploy only the two repaired modules, not dirty
  unrelated gateway/socials/native work. Brief sole-collector reconnect required.
- Verification:457 gateway tests,3 website failure-isolation tests, scoped
  ESLint, TypeScript and84-page production build passed. Browser/deployment
  acceptance and measured VPS timings recorded in the incident prompt log.

## 2026-10-21 — All three provider API boundaries on VPS

- Owner clarified Gexbot/QuantData/Rithmic → VPS → website, independently of
  migrating website hosting/account DB. QuantData and Rithmic already used VPS;
  old Gexbot terminal/history, sponsorship Flow and VIX helpers still called
  vendors from Next. All now use gexBotGateway.server.ts, no website vendor key.
- Private read-only gexbot-relay sidecar8795 preserves the primary legacy API;
  native research reads reuse gateway8793's existing provider/cache. Caddy
  forwards both /v1/native-positioning/* and /v1/gexbot-legacy/* to the sidecar.
  Exact bearer, selection/storage-origin validation, fixed vendor origins,
  manual redirects, bounded payloads/concurrency/cache and429 hold are required.
- VPS-only signed history downloads never forward provider bearer to storage.
  Accepted native snapshots/history and legacy responses archive under separate
  /recordings/gexbot/exposure with real source times and no changing transport
  cache ages. This is request-driven capture, NOT unattended all-ticker replay.
- Deployed on existing private gateway image by scoped script mounts/Compose,
  without restarting sole Rithmic owner. Separate0600 sidecar env contains only
  existing Gexbot key + gateway bearer. Original main operator.env is untouched.
- VPS checks: native status authenticated, Classic/State/Orderflow200, primary
  legacy SPX200, QuantData QQQ interval map200/3.32MB, Rithmic timestamps advance,
  recordingtrue/no reported drops. Options source is the actual Oct20 close,
  not a claim of live RTH. Gexbot archive counts advance/no reported drops.
- Removed conventional GEXBOT_API_KEY and QUANTDATA_API_KEY from Vercel
  Production after successful VPS probes. Other target environments preserved.
  Website still uses authenticated Next delivery; direct browser stream remains
  disabled pending browser reachability. No zero-Vercel-cost or full hosting
  migration claim. Existing history/parity/capacity/restore gates remain open.
- Tests:455 gateway tests,23 routing/flow/env tests, scopedESLint, TypeScript
  and84-page production build pass. Release/runtime receipt:
  docs/prompt-log/2026-10-21-provider-vps-boundary.md.

## 2026-10-21 — VPS remainder audit and direct browser streams

- Runtime follow-up: direct edge was NOT accepted in actual in-app browser:
  feed HTTPS returned ERR_CONNECTION_REFUSED while pinned-IP server probes
  succeeded. Production rolled back to82691d1c; feature flag nowFALSE for
  subsequent builds. Keep current authenticated Vercel relay until actual
  browser reachability/reconnect checks pass. Never loosen CORS/TLS or bypass
  the browser's blocked DNS-cache-control surface to force acceptance.
- Website-hosting cutover is blocked by signed-out Squarespace and missing
  original production secrets (Vercel exports31 redacted placeholders). Do not
  disable site access, reset keys, or deploy a redacted env file. Existing
  Vultr backups now DAILY09:00UTC, no completed backup/restore proof yet.
- Owner explicitly requires nothing left behind. Component inventory and open
  acceptance gates: docs/prompt-log/2026-10-21-vps-remainder-audit.md.
- Direct stream edge permits only exact-Origin/exact-request,300s HMAC leases
  for quotes/trades/index/heatmap. New private read-only sidecar8794 keeps raw
  gateway bearer server-only. Caddy excludes ticket URLs from access logging.
- Existing authenticated API routes can issue307 via
  KWANTDESK_BROWSER_STREAM_DIRECT=true; no hidden Vercel body proxy fallback in
  that mode. Enable only after verified VPS edge rollout. Feature flag off
  preserves the old route until production/browser acceptance passes.
- Older archive transfer/restore, complete options capture, website hosting,
  account/database ownership and recovery drills remain separately tracked.
  Do not call the entire migration complete from successful SSE probes.

## 2026-10-21 — Permanent VPS live-owner cutover

- Owner explicitly requests all live services switched to the new Vultr VPS.
  New Chicago origin is `https://feed.kwantdesk.com`, IP `144.202.52.66`;
  Ubuntu24.04 LTS, key-only SSH, clean gateway image from3c712357.
- Laptop collector was closed through its existing awaited shutdown handler;
  its supervisor STOP marker remains. New VPS is the sole Rithmic owner.
  Temporary localhost bridge forwards old deployment-pinned requests to VPS;
  it has no provider connection and is NOT the permanent production origin.
- Essential archive and final delta SHA256 verified before extraction/start.
  Older raw/exposure bulk archive remains separately preserved/restoring;
  never overwrite current VPS append files with an older bulk archive.
- All URL/token/provider aliases, explicit futures snapshot settings and SSE
  override move together in16 production env entries. One main Git build is
  needed to activate them; verify deployment and actual website, not env alone.
- Recording mount is a110GiB ext4 allocation inside the INCLUDED VPS disk,
  not a separately purchased volume or independent backup. Mount dependency,
  bounded container/log memory, capacity monitor and unhealthy recovery exist.
- Migration notes/acceptance: docs/prompt-log/2026-10-21-permanent-vps-cutover.md.
  Do not claim zero gaps, complete month history, full GEX/KWANTY parity,
  independent restore/HA or zero Vercel stream-proxy costs from this cutover.

## 2026-10-21 — KWANTY parity audit: missing Orderflow restoration

- Owner requires sequential Classic/State/Orderflow check → repair → verify;
  ledger `docs/KWANTY-PARITY-AUDIT-2026-10-21.md`. Never declare full parity
  while its source, cadence, history or interaction gates remain open.
- Both standalone and grid request hosts omitted `/api/kwanty/session` from
  allowlists, silently defeating accepted-observation restoration. Permit only
  that existing authenticated operation; origin/operation restrictions remain.
- Negative profile Volume/OI/Greek sizes and Classic prior-marker sizes now
  affect their intended marks. Editor negative Greek default matches inherited
  render size so an untouched Save cannot shrink it. Isolated real Orderflow
  major observations paint dots, not invisible moveTo-only paths or fake trails.
- Historical403/404 can restore existing exact-session Orderflow observations;
  explicit observations-only provenance, no401/429 masking. Same source/request
  sharing, no poller/cadence increase, paid service or collector restart.
- OPEN: Classic history403, no full pre-page-load major trails, State private
  classified volume splits, historical drawStyle parity,30s REST vs fast native
  updates, full session replay and runtime/soak acceptance. Native entitlement
  reports websocketAllowed=true but stream not negotiated (shared API slot).
  Do not change shared slot or claim VPS alone repairs these source limits.
- Old owner tab ran index v4; ordinary reload brought current v8 before audit.
  This batch versions index9/app17 and embedded index11 for consistent assets.
 242 focused tests pass; release receipt and verification are in the ledger.

## 2026-10-20 — State normal-chart drawing tools

- Every State pane has a theme-linked left drawing rail backed by the existing
  ChartDrawLayer, ChartDrawSettings, tool catalogue/icons and emoji picker.
  Geometry is seconds/raw underlying price; State milliseconds, multiplier and
  offset are applied only at projection. Never anchor to exposure/strike rows.
- Host mount is lazy and shared by standalone KWANTY and embedded State tools.
  Drawings persist per panel/ticker in the existing workspace/template payload.
  Editing, handles, magnet strengths, undo/redo, deletion, text, settings and
  price/time zoom use the normal engine. P&L reads observed price without
  inventing a next candle. Iframe drags bind to their owning window, including
  cleanup after SVG ref removal.
- Fixed/anchored profiles request exact ES/NQ execution ranges through the
  existing coalesced gateway client after 300ms debounce, sequentially. No
  per-tick poller; inactive/no-geometry panes do not start range requests.
  Range signatures reject obsolete profile responses. GEX/OI exposure and OHLC
  distributions are NEVER substituted for execution VAP in State.
- OPEN data limitation: cash indices have no traded volume, and a generic
  equity/ETF/options-contract VAP adapter is not connected here. Their drawings
  and calculators work, but fixed profiles show an honest range/data caption;
  do not claim that all tickers now have exact VAP. Real provider bar volume is
  retained for anchored VWAP, which refuses missing-volume ranges.
- 232 KWANTY/reference tests, TypeScript and scoped lint pass; shared position
  resize/migration/crosshair scripts pass 23 checks. One existing broad custom
  profile script fails an outdated exact-string assertion in UNCHANGED
  ChartIndicatorsControl; confirmed identical on HEAD, not hidden as passed.
- Actual app/browser fixture verifies calculator placement/resize/style/P&L,
  zoom, ticker isolation/reload, and synthetic exact-profile POC/VAH/VAL output.
  This is not live provider/history proof. See
  docs/prompt-log/2026-10-20-kwanty-state-drawing-tools.md.

## 2026-10-20 — Square State candle bodies

- State price candles now use square Canvas rectangles instead of the rounded
  profile-bar helper. Exact OHLC, high/low wicks, theme colours, candle width and
  minimum one-pixel dojis are unchanged. Profile prior/skew circles and rounded
  exposure bars remain unchanged; Classic retains its existing renderer.
- Versioned the standalone and embedded KWANTY asset chain. No extra endpoints,
  polling, provider logins or market-data restarts.
- 224 KWANTY/reference tests pass; scoped lint passes. Isolated synthetic browser
  rendering visually checked in dark/light themes, without modifying user data.
- Record: docs/prompt-log/2026-10-20-kwanty-square-candles.md.

## 2026-10-20 — Multiple KWANTY State panels

- State has Add Chart, independent ticker/GEX-or-Greek/expiry/interval/type/style
  per panel, active-panel header/sidebar, resize separators, close/restore and
  the same account ticker favourites/search/recents as Orderflow. State panels,
  closed panels and active ID persist in the existing workspace/template payload.
  Legacy single State view migrates without discarding its settings or scope.
- Viewport links apply timeframe/type/ticker edits to linked peers only; metric
  selection and settings remain independent. Time bounds share across tickers;
  price bounds/crosshair prices share ONLY with matching ticker and conversion.
  Crosshair links are separate; other tickers project time without false prices.
- `state-sources.js`: one price controller per distinct ticker, one snapshot
  source per ticker/category, coalesced in-flight work, existing 30s refresh/60s
  error policy, maximum two concurrent snapshot requests. No per-panel timer,
  provider login or new Vercel endpoint. Removed sources abort/dispose promptly.
- State snapshots retain exact native inputs under the existing retention
  budget. Pending-profile price view uses an observed candle close, never 0..1;
  linked initial viewport waits for actual loaded profile/history. Price ticks
  only schedule canvas work, not repeated sidebar reconstruction. Offscreen
  panels skip canvas paints and scrolling requests a fresh paint.
- 222 KWANTY/reference tests pass, TypeScript passes, scoped lint has no errors
  (one unchanged OptionsFlowToolPanel cleanup warning). Actual-app browser fixture
  verifies 4 panels, independent and linked edits, settings isolation, favourites,
  persistence, close/restore and identical cursor labels499.93/11:30:57 GMT-4.
- Record: `docs/prompt-log/2026-10-20-kwanty-state-panels.md`.

## 2026-10-20 — KWANTY State normal chart axes

- State always has a right-hand price scale, independently of profile bar
  alignment. `priceAxisSide` drives gesture hit regions; Classic stays unchanged.
- `state-axes.js` paints decimal price ticks and clock-boundary bottom time ticks
  from the renderer's exact time/price transforms. Crosshair badges use cursor
  coordinates, not nearest candle/strike; timezone/DST/date/seconds are explicit,
  with milliseconds on tight views. IV/skew scale has a separate lower row.
- Pan, wheel, right-axis scaling and Ctrl+wheel continue through the existing
  viewport engine. No new acquisition, subscriptions, polling or fabricated bars.
- 209 KWANTY/reference tests pass; TypeScript passes. Browser fixture verifies
  exact cursor values, pan, independent price zoom, dark/light and 380px pane.
  Reproduce: `node scripts/serve-kwanty-state-axes-fixture.cjs`.
- Release record: `docs/prompt-log/2026-10-20-kwanty-state-axes.md`.

## 2026-10-20 — LIQ MAP motion stalls

- Camera easing must finish on display frames, not wait for another depth
  packet. Paint while dirty OR `renderer.cameraInMotion`; stop when settled.
  Preserve the inactive embedded-pane 50ms budget and never translate the whole
  canvas, append synthetic frames, interpolate feed prices or delay executions.
- `heat-raster.js` preserves the previous heat pixels exactly, computes row
  geometry once per row and writes cached native-endian packed RGBA colours.
  Palette storage is weakly keyed; no accumulating geometry/frame cache.
- Isolated 1800×1080 raster CPU benchmark: median 10.18→5.42ms, p95
  12.35→6.93ms (60 alternating samples). This is NOT full browser FPS or proof
  of end-to-end feed latency. No browser CDP endpoint was exposed in this run.
- Regression record: `docs/prompt-log/2026-10-20-liquidity-map-smooth-motion.md`.

## 2026-10-20 — LIQ MAP matches options-workspace chrome

- `public/heatmap-app/site.css` is the final presentation layer, matching GEX
  DATA/KWANTY: 38px rows, 28px outlined controls, Aleph 10px/600/.075em, 3px
  corners, 14px line icons, flat website-token backgrounds and theme active states.
  Do not revert to the old gradient toolbar, small text or pill-group controls.
- Settings fields, menus, selected rows, checkboxes, Depth/Signals cards, CVD
  buttons, instrument picker and injected Trade button follow the same language.
  Settings remains centred with the chart visible; no market rendering/feed rules
  changed. Preserve palette gradients that encode actual liquidity data.
- `site` stylesheet participates in the existing three-sheet readiness/retry
  handshake, including parent verification, so startup cannot flash legacy chrome.
  Narrow headers keep labelled icons accessible and the tool rail scrollable.
- 70 focused tests, scoped lint and TypeScript pass. Isolated actual-HTML/CSS
  browser checks verified 28px/10px/600/3px/.75px controls, dark/light themes,
  themed 12px/36px dropdown rows and a 360px pane. No owner settings changed.
  Reproduce locally with `node scripts/serve-liquidity-chrome-fixture.cjs`.
- Release record: `docs/prompt-log/2026-10-20-liquidity-map-workspace-chrome.md`.

## 2026-10-20 — Centred LIQ MAP settings

- LIQ MAP Display/settings (also Depth/Signals/CVD settings) uses a native centred
  dialog, not the old right-anchored inspector. Keep the same mounted controls,
  theme panel/border/text, 35% unblurred backdrop and unchanged live chart geometry.
- Dialog is viewport-bounded with scrolling and a sticky title/close row. Native
  focus containment is retained; ×, backdrop and Escape dismiss. Escape dismisses
  an expanded custom dropdown before the dialog. Chart shortcuts must not execute
  while dialog focus is active.
- Parent validates inspector state messages and hides/deactivates injected trade
  handles while settings is open. Trading bridge stays mounted so genuine quote
  processing continues; do not add another feed or reset market history on open.
- 64 focused map/paper tests, scoped lint and TypeScript pass. Browser fixture
  verified exact centring (620×672 at 330,24 in 1280×720), chart size unchanged,
  Escape dismissal and outside click. Release details:
  `docs/prompt-log/2026-10-20-liquidity-map-centered-settings.md`.

## 2026-10-20 — LIQ MAP shares the normal-chart trading ledger

- Standalone and embedded LIQ MAP expose the existing side order ticket, filled
  entries, working orders, draggable SL/TP (including multiple targets), add
  missing protection, close and cancel. All actions use the workspace's existing
  account ledger/handlers and chart-click confirmation; never create a second
  iframe ledger or submit broker orders from the read-only depth app.
- The ticket follows the active map's instrument, distinct minis/micros and
  selected paper account. Returning to a normal chart shows the same ledger.
  Existing verified-adapter gates remain: paper execution works, live broker
  submit/cancel/liquidate is NOT newly implemented by this change.
- Map geometry comes from the actual renderer plot and price range, excluding
  ladder/profile/axis. Protection drags use pointer capture, suspend the owner's
  protection checks until release, commit once, and release on cancel, lost
  capture, blur, account/symbol/replay change, removed order or unmount.
- Only fresh genuine book packets and genuine trade prints reach the existing
  synchronous execution arbiter. Historical and visual-hold frames never do;
  replay cannot place/edit map orders. No new feed, polling, provider session,
  Vercel endpoint or per-tick network fan-out was added. A same-timestamp actual
  print must not be deduplicated against a quote-only book with no last price.
- Tests: 59 focused tests pass; TypeScript and production build pass. Isolated
  browser QA verifies ticket opening, SL/TP drags, shared-ledger mirror and replay
  disabling; no owner trades submitted. Twelve older source-contract assertions
  fail identically against HEAD and are not claimed fixed. Detailed release
  record: `docs/prompt-log/2026-10-20-liquidity-map-shared-trading.md`.

## 2026-10-20 — Independent Orderflow panel tickers

- Owner clarified tickers must be independent when unlinked. Each persisted
  panel now owns `ticker`, migrating missing values from the existing workspace
  ticker. Active panel drives sidebar/favourites; ticker/futures/spot selection
  applies to active-only or its viewport-link group, retaining unrelated views.
- `orderflow-sources.js` owns one price/snapshot/session-history source per
  distinct visible ticker, coalesces same-ticker panels, rejects mismatches and
  drops stale/removed responses. One existing 30s coordinator, 60s error backoff;
  no per-panel polling. Hidden/disposed/removed resources release subscriptions.
- Render/cache keys include ticker+interval; each overlay/expiry/threshold uses
  its panel source. Historical data is scoped per ticker/session. Distinct
  tickers share linked time bounds but never another instrument's price scale.
- Record: docs/prompt-log/2026-10-20-kwanty-independent-tickers.md.
- Follow-up live QA: never seed linked viewport from a loading-only geometry.
  Wait for actual candle history and use ticker/session-stable seed keys. Ticker
  changes reset all target-group views even if one peer already has that ticker.

## 2026-10-20 — KWANTY Orderflow favourite ticker shortcuts

- Header next to timeframes shows the existing account dropdown instrument
  favourites, alphabetically, horizontally scrollable (no four-ticker cap).
  Stars add/remove shortcuts immediately via preference observers, no polling.
  Empty state opens the existing ticker picker for starring choices.
- Buttons dispatch through the existing ticker dropdown change path, synchronize
  selection/highlight and update recents. Current Orderflow architecture has one
  workspace-wide ticker (all panels including linked); this does not introduce
  per-panel ticker feeds or extra requests. Classic/State shortcut row is hidden.
- Record: docs/prompt-log/2026-10-20-kwanty-favourite-tickers.md.

## 2026-10-20 — Linked KWANTY toolbar controls follow the group

- Owner clarified Orderflow linking includes timeframe and line/candles, not
  just viewport. Toolbar dropdown and quick timeframe buttons apply to all
  viewportLinked panels when the active panel is linked; otherwise active only.
  Crosshair-only links do not join control updates. Unlinked edits remain local.
- Saved per-panel values persist as before. Same shared price aggregation;
  no extra provider history, live subscriptions or polling. Existing linked
  viewport/reset/cursor semantics remain intact.
- Record: docs/prompt-log/2026-10-20-kwanty-linked-toolbar.md.

## 2026-10-20 — GEX DATA tool actions beside filters

- Refresh/reset/filter/settings sit immediately after their tool's dropdowns,
  not against the far right. Match dropdown background/foreground/border/radius
  theme tokens, retaining accessible labels, focus and existing click handlers.
- Record: docs/prompt-log/2026-10-20-gex-data-inline-actions.md.

## 2026-10-20 — GEX DATA filter-row background and centering

- Tool filter rows use the exact website background, not the reference grey
  surface. Embedded controls/actions align vertically to the row center in a
  border-box 42px row; action buttons share 24px control height. Keep horizontal
  overflow and left-aligned filters/right-aligned actions intact.
- Record: docs/prompt-log/2026-10-20-gex-data-filter-row.md.

## 2026-10-20 — GEX DATA blank-tool regression repaired

- Removing the connection strip left two `.page-name` writes in `showTool` and
  `showBoard`. The absent label caused a null dereference before controls and
  data loading, blanking every embedded tool. Remove these obsolete writes;
  do not restore the unwanted banner or alter feed/polling behaviour.
- Regression tests execute actual tool/board navigation for all 22 catalogue
  entries with the banner absent, checking controls, load and board restoration.
- Record: docs/prompt-log/2026-10-20-gex-data-blank-tools.md.

## 2026-10-20 — KWANTY centered toolbar and independent linked panels

- Move sidebar-floating chart controls into the mode header's center; compact
  normal-chart quick timeframes and themed chart-type dropdown. Responsive header
  keeps the controls accessible at narrower sizes; fullscreen retains this bar.
- Orderflow click/focus selects a panel; timeframe and price style persist per
  panel, with package defaults for older saves. One shared underlying feed/history
  is locally aggregated; no per-panel vendor polling or extra gateway requests.
- Per-panel shared-viewport and crosshair buttons mirror normal charts. Share
  time and underlying-price bounds/cursor coordinates, never unrelated raw metric
  axes. Unlinked candle intervals remain independent; linked toolbar changes
  now follow the group (see later owner clarification above). Links and active-panel selection
  persist in existing templates; resets keep linked time/price views together.
- Record: docs/prompt-log/2026-10-20-kwanty-panel-toolbar-links.md.


## 2026-10-20 — KWANTY candles use theme up/down colours

- Classic/State/Orderflow candle defaults and renderer fallbacks use bullish/
  bearish theme roles, not generic blue/accent and grey/border mappings. Both
  bodies and wicks follow the active site's candle pair. Non-custom saved legacy
  spot_candle_up/down aliases refresh too; explicit custom colours and intentional
  Orderflow metric-colour mode remain supported. No price/data/feed changes.
- Record: docs/prompt-log/2026-10-20-kwanty-themed-candles.md.


## 2026-10-20 — GEX DATA connection-banner flash removed

- Remove the obsolete static status strip (CONNECTING/Connecting) rather than
  waiting for the dock runtime to hide it. Remove only its DOM-writing and
  refresh-button listeners; retain the status request, session/live eligibility,
  real tool errors and existing polling unchanged. Theme-first boot remains.
- Record: docs/prompt-log/2026-10-20-gex-data-connection-flash.md.


## 2026-10-20 — GEX DATA palette settings; retire GEX BOX page

- GEX DATA Settings → Colour palette reuses the full 30-preset GEX BOX picker,
  with live preview, Save/Discard and Follow website theme. Its account-scoped
  workspace value is included in existing workspace saves/imports/preferences.
- Only chart semantic colours/header/strike roles change; website backgrounds,
  fonts and toolbar colours remain theme-owned. Repaint cached chart data without
  new provider requests. Reset removes stale custom CSS palette variables.
- Remove the standalone GEX BOX navigation/workspace surface and redirect
  /gex-box, /gex-box/:surface and /gexbot to /gex-data. Preserve saved legacy
  workspaces, chart-grid GEX BOX tools and their shared backend/API routes.
- Record: docs/prompt-log/2026-10-20-gex-data-palette-migration.md.


## 2026-10-20 — KWANTY Orderflow visible readings and recorded-session restoration

- Native latest snapshots have real metric values, but frontend only retained
  observations collected since page load; latest-only marks were against the
  chart edge. Add latest-value labels and 4% default right time padding, preserving
  actual source timestamps and manual viewport overrides.
- Restore exact-instrument/New-York-session observations once per selection from
  the existing Supabase orderflow archive. Existing authenticated snapshot route
  best-effort records one genuine accepted observation per source minute via
  Next after(); minute-keyed archive identity deduplicates across instances.
  No new vendor polling; bounded reads/caches, failure backoff, no fake rows.
- This is recording of accepted requests, NOT an always-on collector. Stable VPS
  collection, paid provider history access and unrecorded past sessions remain
  separate unresolved requirements. Native NDX 2026-10-19 history returned403;
  old terminal API returned401. Do not mark those external faults fixed.
- Record: docs/prompt-log/2026-10-20-kwanty-orderflow-restoration.md.

## 2026-10-20 — KWANTY Ctrl-wheel vertical zoom correction

- Ctrl-wheel stays vertical over Classic/State plot and axes; never changes time
  or exposure. Orderflow plot Ctrl-wheel scales both vertical price/metric domains.
- Reference-style 10% wheel step, cursor anchored and reversible. Apply pending
  viewport overrides before each event so multiple events before repaint accumulate.
  Consume wheel events to avoid outer workspace scrolling/browser zoom.
- App script v5 and interaction module v2. No data/provider/polling changes.
- Record: docs/prompt-log/2026-10-20-kwanty-control-wheel.md.

## 2026-10-20 — Complete alphabetical KWANTY ticker directory

- Classic/State/Orderflow share the existing ticker selector. Preserve optional
  Recent/Favourite shortcuts, but All tickers (A–Z) must contain every ticker,
  including those shortcuts; never remove it from its alphabetic position.
- Ticker search is clearly labelled, case-insensitive, trimmed and returns one
  alphabetical result list without duplicate shortcuts. Favourites-only remains
  an explicit filter. Other dropdown grouping and GEX DATA are unchanged.
- Record: docs/prompt-log/2026-10-20-kwanty-ticker-directory.md.

## 2026-10-20 — KWANTY genuine underlying candles and chart interaction

- Classic, State and Orderflow now share genuine underlying OHLC history and
  the account-scoped existing live stream, independently of positioning snapshots.
  Candles/Line toolbar, real OHLC tooltips, time pan/zoom, independent Orderflow
  price-axis scaling and reset are covered. Embedded chart-grid tools share it.
- Never manufacture OHLC from sparse positioning spots or quote-only seeds.
  Quote-only feeds repair authoritative OHLC at shared minute boundaries; live
  quotes can update the line and existing source bars. Bounded caches/subscriptions.
- Gateway optional upstream OHLC forwarding is prepared/tested but requires a
  separately coordinated runtime activation; this change does not restart the
  owner's shared temporary Rithmic gateway. No new Vercel streaming/poll fan-out.
- 175 focused tests and recorded-session browser interactions verified. Full
  live/reference parity is NOT certified: reference was market-closed and full
  positioning history remains independently source-dependent.
- Evidence/checklist: docs/prompt-log/2026-10-20-kwanty-price-parity.md.

## 2026-10-20 — Delete retired KWANTY snapshot banner

- Owner still saw the snapshot/no-full-history/no-invented-curve banner.
  Remove its markup and health-update text generation entirely, not just hide it.
  New app startup also removes the node from any older cached shell.
- App script version3; primary KWANTY shell version3 and embedded KWANTY shell
  version5 invalidate old markup without changing GEX DATA URLs or preferences.
- Keep retention, source diagnostics, missing-history safeguards and retries.
- Record: docs/prompt-log/2026-10-20-remove-snapshot-banner.md.

## 2026-10-20 — Shared KWANTY dropdown recents and favourites

- All KWANTY native single-select dropdowns gain search, Recents first,
  favourite stars and All/Favourites only filters through the shared adapter.
- Ticker choices share one instruments list across Classic, State and Orderflow;
  dynamic Orderflow metrics/time windows share their own semantic groups.
  Unrelated settings stay separate. Recent choices are deduplicated, newest first.
- Persist through the existing account-backed bridge; workspace snapshots exclude
  these preferences and workspace restore preserves them. No new API calls,
  polling or market-data changes. GEX DATA keeps its existing non-opt-in menus.
- Record: docs/prompt-log/2026-10-20-kwanty-dropdown-favourites.md.

## 2026-10-20 — Quiet KWANTY provider/history notices

- Hide historyNotice, connection and freshnessDetails from first paint and
  accessibility announcements. Their real technical diagnostics remain hidden.
- Stop automatic snapshot/auth/gateway-error toasts; retain sourceError and
  retry/backoff unchanged. Empty failures say Data unavailable, without vendor
  internals. User-requested history failures keep a concise action response.
- Do not fabricate missing history or move unavailable historical markers.
  Actual source date/time and replay controls remain visible in the sidebar.
- Record: docs/prompt-log/2026-10-20-kwanty-quiet-notices.md.

## 2026-10-20 — Flat theme backgrounds in GEX DATA

- Empty dock slots, iframe frames, plot shells and populated visual/card surfaces
  use the exact live --site-background, not the reference app's gradient layers.
  Remove surface blur/shadows without flattening data-encoded canvas/heatmap/
  conic-statistic fills. Scoped final site.css override; stylesheet version5.
- Applies to embedded tools/popouts too, since they load the same index/style.
  No theme palette mapping, renderer logic, requests or saved layouts changed.
- Record: docs/prompt-log/2026-10-20-gex-data-flat-backgrounds.md.

## 2026-10-20 — Compact GEX BOT / GEX BOX command toolbar

- /gexbot and /gex-box use GexBoxDashboard (not the older Classic component).
  Live row was44px, buttons32px, generic site font13px/500. Match the shared
  36px shell height and28px/10px/600/.075em command-control contract instead.
- Remove bulky badge/subtitle; keep a single compact desktop title, responsive
  icon-only Settings on narrow screens. Preserve all workspace/tool/style actions.
- New toolbar-control CSS shares the same declaration as chart row/timezone
  controls so generic button styles cannot silently enlarge this page again.
- Record: docs/prompt-log/2026-10-20-gex-bot-toolbar-size.md.

## 2026-10-20 — GEX DATA timezone control parity

- Browser comparison found GEX DATA timezone trigger 172px/13px/500 versus
  GEX VUE 164px/10px/600. Root cause: command-deck CSS fixed generic button
  overrides only inside charts; data wrapper forced a wider full-width trigger.
- Both callers now use the same exported sizing class, compact component and
  menu heading. Compact timezone CSS contract applies outside command deck too.
- TimeZoneSelect ignores scroll originating inside its own menu so searching
  and scrolling choices do not dismiss it; outside scroll/resize still close.
- Preserve existing timezone persistence and data formatting; no extra fetches.
- Record: docs/prompt-log/2026-10-20-gex-data-time-control-parity.md.

## 2026-10-20 — News options/futures expiration calendars

- News order: Economic Calendar, Financial Info, Macroeconomics, Live Macro,
  Options Expiration Calendar, Futures Expiration Calendar. Removed KWANTY's
  calendar nav; old ?view=calendar bookmarks redirect to News options tab.
- Options component moved to components/news, keeping existing account-backed
  preference key, official Cboe verification and chart-grid tool compatibility.
- Futures uses verified CME published 2026–2028 U.S./Japanese equity-index
  expiration/roll table. June 2026 U.S. expiry is June 18, not generic Friday.
  Explicitly not energy/metals/rates, delivery/first-notice or live source sync.
  Full exchange calendar linked. CME blocks automated scraping; no scraper,
  paid service, new API polling or implied automatic verification was added.
- Record: docs/prompt-log/2026-10-20-news-expiration-calendars.md.

## 2026-10-20 — Quiet GEX DATA and expiration-calendar entry

- Owner no longer wants the opening/loading page splash for GEX DATA or the
  options expiration calendar. Both outer dynamic imports use a plain themed
  surface; the GEX DATA/KWANTY host setup and calendar chunk use no splash.
- Preserve real embedded chart loading/error states and calendar source checks.
  No data cadence, requests, auth, saved workspace or theme semantics changed.
- Record: docs/prompt-log/2026-10-20-quiet-options-page-entry.md.

## 2026-10-20 — Remove intrusive volume-profile history banner

- Owner requested removal of the daily-profile missing-history notification.
  Chart retains the real failure in a hidden diagnostic element, not a visible
  overlay or live announcement. Daily/weekly completeness gates, calculations,
  profile rendering and history requests are unchanged. This is NOT a history fix.
- Regression: tests/volume-profile-notification.test.mjs.
- Record: docs/prompt-log/2026-10-20-hide-profile-history-banner.md.

## 2026-10-20 — Separate temporary SSE transport from bulk history

- Quote delivery probe: local76quotes/14s (first40ms), current Quick Tunnel
  ZERO bytes/quotes in14s. Official Quick Tunnel docs explicitly exclude SSE.
  This is NOT a30s candle polling setting or the first-paint loading fix.
- Reuse the ALREADY running Tailscale Funnel for STREAMS ONLY. Public-DNS TLS
  probe (not tailnet/MagicDNS hairpin) delivered149quotes/14s, first1,677ms.
  Its bulk history took14.5s versus~1s Quick Tunnel, so REST stays on Quick.
- Server-only KWANTDESK_MARKET_DATA_STREAM_GATEWAY_URL selects quote, trade,
  index and heatmap streaming origin. Same collector, credentials, source and
  existing proxy/subscriptions; no new account/tunnel/service/purchase/restart.
  Invalid explicit override fails closed instead of silently using buffered SSE.
- IMPORTANT VPS CUTOVER: remove this override or set it to the supported VPS
  streaming origin when restoring Vultr. Leaving it points live streams at the
  laptop even after the ordinary REST URL aliases move. Laptop must stay online.
- This is a temporary transport repair, NOT zero Vercel cost or launch uptime.
  Existing stream proxy costs and proper authenticated direct VPS fanout remain
  OPEN. Full month history/recording, Asia gaps and live indicator soak remain.
- Verification/release: docs/prompt-log/2026-10-20-live-quote-delivery.md.

## 2026-10-20 — CME chart first-paint live-edge repair

- The candle/flow adapters still clipped the owned recorder's upper bound to
  floor(now minus one minute), a retired delayed-provider rule. Because the
  range is exclusive this removed the active AND last closed minute. The
  first-paint continuity gate then waited for separate seam HTTP work. Preserve
  the gateway's real archive-plus-forming edge and exact replay upper bounds.
- Nonempty stale/un-enriched caches now start/consume the same independent fast
  base OHLC path as cold charts. Do not make cached price wait for CVD/tape.
  Fresh verified full caches still skip it; no continuity/depth gates relaxed.
- CME browser reads now privately revalidate, with explicit refresh reloading.
  Timed-flow durable key v6 invalidates the old clipped-edge payload. No gateway
  restart, new polling cadence, infrastructure or paid service.
- Live gateway probes: 8,059 NQ minute bars in71ms local /1,068ms public relay.
  Old 1m cutoff required reconciliation; same gateway through now did not.
  Do not present these transport timings as signed-in full-chart paint timings.
- Tests, deployment and remaining gates:
  docs/prompt-log/2026-10-20-cme-chart-first-paint.md.

## 2026-10-20 — Vercel cost containment and owner-managed cap

- Owner authorises Spend Management automatic production pause at the cap,
  superseding the earlier keep-live rule for this specific cost safeguard.
  Owner subsequently confirmed they set the cap themselves. Agent did not
  configure/read back the numeric budget or pause switch; never claim otherwise.
- Shared workspace JSON requests must retain private browser ETags, revalidating
  on every refresh (`no-cache`), rather than defeating them with `no-store`.
  Explicit force refresh reloads the body; server calls remain `no-store`.
  Do not slow live cadence, share licensed responses publicly, or cache errors.
- Native-only commits do not ship the Next website: ignore them in the Vercel
  build gate and deployment input. Mixed web/native commits still build.
- Current-cycle baseline: about 75 GB origin transfer, 20 CPU hours, 732 build
  CPU minutes. These are gross usage, not proof of incremental billed overage;
  Pro credits and fixed subscription are separate. No measured dollar saving yet.
- Continuous market-data proxy/SSE costs remain OPEN until supported always-on
  gateway delivery replaces the temporary laptop/tunnel. Preserve recording,
  history/backfill and data accuracy. No new paid service authorised.
- Record: docs/prompt-log/2026-10-20-vercel-cost-containment.md.

## 2026-10-20 — Live theme colours across KWANTY and GEX DATA

- Live acceptance found this account's State background explicitly pinned to
  pale white while the main theme is black. Do not globally wipe user custom
  flags: KWANTY colour rows now offer a per-field Theme action, with an explicit
  Use theme background control. It unpins only that colour, immediately syncs,
  saves and redraws, preserving other styles. Owner requested this State repair.

- KWANTY's theme sync missed State Greek/major styles written by settings Save,
  and retained uncustomized Orderflow series colour snapshots. Complete fresh
  defaults plus theme-settings.js now relink these; explicit customization
  flags, visibility, widths, opacity, background and spot overrides survive.
- GEX DATA exposure legs/heat-map metric colours and empty option bars no
  longer capture the initial palette in module constants. Resolve on use.
- KWANTY shares its static colour download across theme changes; neither app
  lets that download failing prevent base palette changes or canvas repaint.
- Verification: docs/prompt-log/2026-10-20-workspace-live-theme.md. No data,
  polling, authentication, source values, saved layouts or gateway changes.

## 2026-10-20 — Standard loading presentation for KWANTY and GEX DATA

- Latest owner request supersedes GEX DATA's quiet-only startup presentation:
  both pages use the normal themed KwantLoader at React startup. GEX VUE's
  independently requested quiet startup is unchanged.
- Embedded apps share public/workspace-loading.js/css, visually aligned with
  compact KwantLoader (theme surface, sparkles emblem/halo/orbit, reduced motion).
  GEX DATA only covers an empty first tool load, never existing-chart refresh
  or pagination. KWANTY hides its loader for real data and shows actual errors.
- Removed licensed-data loading copy from initial chart, trades and profile
  pending states. Data/provider entitlement errors remain authoritative. No
  transport, authentication, feed timing, calculations or saved layout changes.
- Record: docs/prompt-log/2026-10-20-standard-workspace-loading.md.

## 2026-10-20 — GEX DATA toolbar matches the command rail

- Replaced prototype symbol glyphs with labelled stroked SVG icons; the top
  toolbar shares main-navigation 28px height, 3px radius, 10px Aleph type,
  .075em tracking, theme borders and restrained hover/focus states. Utility
  actions remain compact with accessible names; Workspaces gets a line icon.
- Preserved action titles/IDs, listeners, dialogs, workspace persistence and
  timezone reservation. Narrow screens retain horizontal overflow. No data,
  polling, auth, calculations or gateway change. Verification record:
  docs/prompt-log/2026-10-20-gex-data-toolbar.md.

## 2026-10-20 — GEX DATA quiet theme-first startup

- Both React startup stages now use the accessible quiet theme surface, without
  the animated loader or visible Opening GEX DATA text.
- The iframe's classic site-bootstrap.js runs before styles/modules and reads
  the existing same-origin account/tool host palette. Theme base variables and
  canvas background apply before the static colour-catalogue download; that
  download is shared across theme changes, with failures eligible for retry.
- Presentation only: auth, gateway, market-data errors, polling and calculations
  are unchanged. Record: docs/prompt-log/2026-10-20-gex-data-quiet-startup.md.
- Stable transport, rolling month history/recording, Asia tape, chart-indicator
  live soak and the GEX DATA parity/cadence gates remain OPEN.

## 2026-10-20 — GEX VUE quiet theme-coloured startup

- GEX VUE startup covers use KwantLoader's quiet presentation: themed surface,
  accessible busy status, no visible emblem/gradient/text/animation. Preserve
  chart history/visual-fit readiness and real errors; do not bypass them.
- Explicit quietLoading passes from the gamma workspace to its chart pane and
  Chart. It is intentionally separate from crosshair/link settings. Workspace
  background classes follow live theme CSS; custom chart backgrounds survive.
- Record and verification: docs/prompt-log/2026-10-20-gex-vue-quiet-startup.md.
- Presentation only; prior transport/history/Asia/CVD/footprint/profile and
  GEX DATA full-parity gates remain OPEN.

## 2026-10-20 — GEX DATA sequential catalogue pass; full parity still OPEN

- All22current catalogue tools inspected against the signed-in reference in
  order. Exact evidence and per-tool remaining gates are in
  docs/GEX-DATA-PARITY-CHECKLIST.md; do not collapse partial passes into DONE.
- Completed-session comparisons found/fixed request/filter/settings, precision,
  chart/navigator domains, exchange groups, pie labels and ETF snapshot-close
  semantics. Net Drift now drills down through the supported unconsolidated
  endpoint;25visible individual prints/all32fields match the tested minute.
-154focusedtests and26account-budgettests pass; scopedlint and84pagebuild pass.
- Shared provider-budget source is wired/tested but gateway NOT restarted or
  rolled out here. No new tunnel, provider account, DNS or paid infrastructure.
- Still open: licensed forecast output; private/public aggregated totals for
  ConsolidatedFlow/SPXGainers; fastlivecadence and full all-mode/bucket/soak
  acceptance. Do not increase per-tick Vercel traffic or invent missing values.
- Standing unresolved: stable Vultr transport, rolling month options/futures
  history and recording/backfill, Asia tape and footprint/weekly/CVD soak;
  shared acquisition/fanout must support the planned hundred-user release.

## 2026-10-20 — GEX DATA one-to-one audit started, NOT complete

- Acceptance ledger: docs/GEX-DATA-PARITY-CHECKLIST.md.22 tools inventoried;
  only Net Drift has a partial signed-in numerical/visual pass. Do not mark
  other tools, exact composing trades or live cadence as verified.
- SPY/all moneyness/2026-10-16 full session: both visible legends calls-16.41M,
  puts64.76M, spot762.74; curves/lower signed-volume shape align. Initial live
  discrepancy included ITM-vs-All settings and a stale reference connection,
  recovered by reloading the reference. No math/sign/offset changes made.
- Net Drift now updates compatible revisions/appended buckets in its existing
  canvas/navigator, preserving viewport; changed request/presentation or changed
  historical timeline rebuilds explicitly. Historical page/global overrides
  now pause polling, not just tool-local historical mode.107 regressions pass.
- Production acceptance caught a parent-storage echo after chart saves that
  still rebuilt tools. Ignore unchanged filter/presentation signatures while
  preserving real theme/configuration/filter updates. Synthetic browser QA with
  actual parent localStorage echoes proves canvas/navigator identity retained.
- Cadence remains OPEN:30s client/15s route/10s gateway caches. Official public
  API quota240/min shared; streaming listed Coming Soon. Do not increase
  per-tick polling through Vercel or promise website-private-stream parity.
  Need supported provider stream entitlement plus shared gateway fanout;
  returning VPS alone does not remove quota. Owner still waits for Vultr.
- Forecast endpoint not connected. All other standing transport/history/Asia
  tape/weekly/footprint/live-soak gates remain open. See ledger for boundaries.

## 2026-10-20 — GEX DATA timezone picker

- Reuses normal charts' TimeZoneSelect in top-right GEX DATA toolbar. Parent
  overlay has172px width; iframe reserves190px only with hostTimezone=1 so
  existing toolbar actions scroll instead of sitting underneath the picker.
- Account-scoped gex-data-timezone lives in existing GEX DATA preference blob,
  inheriting chart default until chosen. No mutation of normal-chart settings.
  Restore/hydration/storage listeners synchronize it; unchanged timezone does
  not repaint every child on unrelated preference writes.
- Broadcast timezone-only messages through nested frames. Cached tool plots,
  snapshot labels, tables/open detail tables and retrieval footer reformat
  without API requests, iframe remounts or new timers. Table listeners clean
  up on destroy. Keep exchange session/expiry dates and source epochs intact.
-100 focused/integration/reference tests pass, including7 timezone tests for
  real host persistence/account isolation, nested broadcast, cached repaint,
  NY DST, Brisbane midnight and source/footer invariance. No signed-in visual
  or cross-device cloud roundtrip claimed. Release record:
  docs/prompt-log/2026-10-20-gex-data-timezone.md.
- Standing supported transport/wait-for-Vultr, full history, missing Asia tape,
  weekly/footprint/live-soak issues remain OPEN.

## 2026-10-19 — GEX DATA silent refresh

- Removed the licensed-data loading screen and legacy panel loading overlay.
  Requests use nonvisual aria-busy state; existing chart/table stays present
  while fetching. Initial load and pagination also have no spinner overlay.
- Keep real errors and source/retrieval timestamps visible. Existing poll
  cadence, hidden/inactive/historical pauses, request abort/identity guards,
  auth/licensing and provider budgets unchanged. Applies to standalone and
  embedded Options Flow GEX DATA frames, which share the same app.
- Five new actual-loader regressions cover in-flight retention, errors,
  superseded responses, initial load/pagination and removal of overlay markup
  and CSS;93 focused/integration/reference tests pass. Release record:
  docs/prompt-log/2026-10-19-gex-data-silent-refresh.md.
- Existing temporary SSE transport blocker/wait-for-Vultr decision and full
  history/Asia/weekly/footprint verification remain OPEN; not data-feed fixes.

## 2026-10-19 — CVD execution handoff and delta coordinate repair

- FOLLOW-UP ROOT CAUSE VERIFIED: Cloudflare's official Quick Tunnel docs state
  Quick Tunnels do not support SSE. Sandbox tunnel docs explicitly describe
  trycloudflare.com buffering text/event-stream. This matches128KB public
  burst thresholds. A restart/smaller seed CANNOT solve unsupported transport.
  https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
  https://developers.cloudflare.com/sandbox/sdk/api/tunnels/
  Owner answered: "No / not sure—wait for Vultr". Do NOT proceed with another
  tunnel/account/DNS setup; wait for Vultr as requested. Do not purchase/signup/transfer DNS
  or create new infrastructure without that decision. Permanent supported
  gateway/named tunnel is required for reliable execution SSE.

- Live probe: local execution SSE delivered its ~6MB seed and530 trade batches
  in12s, but the public temporary tunnel delivered only786432 bytes and no
  complete seed. Browser now requests128 retained prints for live handoff;
  legacy clients retain25K. Archive history is separate, not replaced by a
  claim that128 prints represent a full session. Atomic seed/pending handoff
  is preserved. First partially covered clock bar keeps historical flow.
- Transport ready/heartbeat cannot declare connected before a valid seed.
  CVD translates proven session-offset delta OHLC into bar-relative coordinates
  and opens each cumulative candle at the previous verified close.
- Owner approved brief temporary gateway restart. Applied only the two scoped
  gateway files to the private runtime, preserving its unrelated differences;
  stopped only the verified supervised child, leaving supervisor/tunnel intact.
- IMPORTANT: public tunnel latency remains OPEN. Post-restart local seed67ms,
  first live batch112ms; public512-print seed did not complete in12s. Public
  128-print seed completed in10850ms with236 batches received during14s.
  Another64-print public probe received no body in14s. Do not claim end-to-end
  smoothness or signed-in chart acceptance. Permanent VPS/full month history,
  missing Asia opening tape, weekly/footprint acceptance remain OPEN.
- Tests/release: docs/prompt-log/2026-10-19-cvd-stream-handoff.md.

## 2026-10-19 — Remove workspace panel-count cap

- Removed12-panel add/docked-duplicate/floating-duplicate guards and disabled
  button/title states. Floating-window normalization now retains every valid
  unique window instead of silently truncating restore/save to12. No new count
  cap substitutes for12. Shared Charts/GEX VUE workspace shell behavior.
- Workspace locks, one-panel minimum, geometry validation, shared execution
  caches/request budgets and2MB backup-input safety remain unchanged. Per-tool
  GEX Map columns and number-of-saved-workspaces limits are different controls,
  not the workspace panel cap, and are not changed.
- Actual extracted handler tests add64 panes across scope identities, duplicate
  docked panels beyond12, round-trip31 floating windows and a52-pane backup/tree
  with independent settings. This is deterministic model verification, NOT a
  claim that64 live footprint/indicator panels fit the owner's browser memory.
-21 focused/adjacent tests,8 layout checks and test lint pass. Broader suite
  has3 pre-existing source-guard failures (lock click spelling, heavy reconcile
  interval, embedded-liquidity active expression); absent guards confirmed
  against unmodified HEAD. No unrelated behavior altered to satisfy them.
  Build/release record: docs/prompt-log/2026-10-19-workspace-panel-limit.md.
- Existing options delivery/full-history/Asia opening tape/permanent gateway/
  weekly/footprint/live soak issues remain OPEN.

## 2026-10-19 — Big Blocks (Options)

- New separate Options Flow indicator, ID big-blocks-options. Chart-native
  paired horizontal call/put bars dock right; priceToCoordinate anchors them
  through pan/zoom. Same-price qualifying orders aggregate without netting.
  Defaults100 contracts/order,150px maximum width,0.25 price bin. Configurable
  premium threshold, strike vs reported-underlying-price, premium vs contracts,
  rolling window, side visibility, opacity/height/width, theme/custom colours.
- Dedicated options tape/primitive/hook, not the futures effort calculation.
  Consolidated parent IDs deduplicate; revisions replace old contributions;
  comprising children/unknown types/missing prices/future rows are excluded.
  Multi-leg excluded by default.5K compact records/pane, max200 displayed levels.
  Session rollover clears old data. Replay and unverified futures mapping fail
  closed. Existing futures Big Blocks is unchanged.
- Snapshot feed shares one CONSOLIDATED100 request/ticker across panes,
  min3s cadence, hidden-tab pause, closed-market60s cadence, failure backoff,
  last-subscriber abort. Uses existing /api/gex-flow snapshot service, no new
  endpoint/provider credentials/per-tick streaming or provider fan-out.
  This does NOT prove complete exchange capture: latest100 per refresh plus
  observed retention only; disclose the limitation in settings/on-chart.
  No claims of resting orders/open interest/positions or call=bullish.
-31 focused/adjacent regressions, scoped lint and TypeScript pass. Existing
  indicator-settings-window footprint source guard already fails on HEAD
  (expects obsolete saveFootprintSettings(...validated)); not changed here.
  Public flow probe is access-gated; signed-in live/visual soak not verified.
  Release record: docs/prompt-log/2026-10-19-big-blocks-options.md.
- Permanent gateway/licensed full options capture/rolling-month history and
  prior missing Asia opening tape remain OPEN; no infrastructure changes.

## 2026-10-19 — Asia/London volume-profile availability

- Session variant planner now honours individual Asia/London/NY switches,
  includes the clock's current CME business date before candles backfill, and
  preserves mode none as whole-session (not silent RTH). Fixed session ends
  keep developing request keys stable. Unopened windows are not requested;
  standard daily profiles also skip unopened jobs.
- Owned-profile publication previously deleted EVERY profile of the same
  study on each arrival. Sibling session/month windows now survive cache and
  network arrival in any order; same-start replacements replace only their
  slot, removed session windows prune, other owners stay isolated.
- LIVE DATA BLOCKER, NOT FIXED: authenticated local gateway probes for the
  2026-10-19 Asia window [2026-10-18 22:00Z,2026-10-19 07:00Z) returned
  complete:false. NQZ6/ESZ6 coverage starts22:56Z; MNQZ6 starts23:00Z.
  Opening executions are missing. Keep exact completeness gates intact;
  do not relabel a partial profile as a complete Asia session. London has
  not opened at the probe time (~03UTC). Public historical adapter also
  reports cooldown/unusable. No gateway restart or infrastructure change.
-26 focused/adjacent tests plus7 session-selection checks and session-window
  script pass; scoped lint passes. Build/release evidence:
  docs/prompt-log/2026-10-19-asia-london-volume-profiles.md.

## 2026-10-19 — CVD freeze recovery and selected-input authority

- Reproduced anti-flash cache livelock: a shorter but newer verified series
  was rejected until its count reached95% of an old history window. Now accept
  advancing endpoints, rolling starts and changing same-bar OHLC/value before
  applying transient regression protection. Empty/older tails still retain the
  previous plot with explicit syncing status; do not invent missing executions.
- CVD cache identity includes sorted indicator settings and ID, not just pane
  key. Parent coordinate scope now includes instrument/timeframe/contract as
  well as pane/replay; the live pane ID alone survives symbol switches.
  Reset periods/input changes take effect; removed entries prune.
- CVD signed delta is canonical selected-input Ask minus Bid, not a possibly
  stale deltaClose cache. Aggregate-trade mode needs real side trade counts;
  missing counts do not become zero-volume fake flat candles. Volume mode and
  other studies keep their existing verified-volume admission contract.
- A lagging verified tail shows WAITING FOR EXECUTIONS; count input explains
  its missing counts. No new timers/provider reconnects/polling/subscriptions.
-55 CVD/live/continuity and Big Blocks regressions plus15 settings/candle
  checks pass; affected renderer/helper/test lint passes. Build/release record:
  `docs/prompt-log/2026-10-19-cvd-freeze-recovery.md`.
- Owner's exact session/signed-in live reproduction and feed/history/weekly/
  footprint prerequisites remain unverified. Do not call these data gaps fixed.

## 2026-10-19 — Big Blocks live preview and closed-bar decisions

- Forming Big Blocks now REPLACE their current decision: withdraw when no
  longer qualified, replace the side on reversal. Do not restore the old
  ever-qualified latch added to hide sampled-snapshot flashing.
- `BigBlocksLiveState` owns direct flow/candle authority and confirmed blocks
  independently of sampled React/history passes. Next-bar transition freezes
  final price/side/origin OR absence. Later snapshots cannot backdate an
  observed-live rejected candle into a signal. True unobserved gaps may backfill.
- Flush a pending closing observation before coalescing a new-bar event in
  the same animation frame. Ordinary same-bar bursts still calculate once/frame.
  Keep listener dependencies stable across indicator-object/theme updates.
- Identity includes pane, symbol, timeframe, tick, indicator instance, numeric
  calculation settings and replay mode. Style changes preserve decisions.
  Retain max240 source bars,120 visible/confirmed signals,4096 recent observed
  timestamps. Existing projection termination remains; no new stream/timer.
- Proprietary Deep Charts formula/native live parity remains unverified.
  Lifecycle fix does not restore the public feed/history prerequisites.
  Verification/release: `docs/prompt-log/2026-10-19-big-blocks-live-lifecycle.md`.

## 2026-10-19 — Ten additional single-family tonal themes

- Owner prefers Crimson Fade/Blue Lagoon's coherent hue families. Appended
  ten tonal themes,43 total; all previous33 names/colours/swatches are unchanged.
- Molten Copper, Amber Vault, Acid Gold, Lime Obsidian, Emerald Depths,
  Jade Current, Arctic Cyan, Indigo Night, Violet Noir and Magenta Ink.
  Each has one fixed hue across dark shell, controls, candles and five swatches.
- Hex tokens resolve once at module load; normal apply/save/custom semantics
  stay intact. No animation, polling, data-path or renderer changes.
-27 focused theme regressions plus14 candle/brand checks pass; scoped lint
  passes. Full build/release record:
  `docs/prompt-log/2026-10-19-tonal-themes.md`.

## 2026-10-19 — Six reference themes plus ten distinct mixed-colour themes

- Owner supplied six five-colour palette screenshots and requested matching
  themes plus ten non-monochrome extras. Added16 after the existing17,33 total.
  This supersedes ONLY the previous count cap, not the retained-theme colours.
- Sampled exact centre pixels; reference picker strips preserve their original
  five-colour order via optional ThemePreset.swatches. All source colours also
  participate in actual theme tokens. Dark/light ink may be derived for AA
  readability; Sunset Sorbet intentionally uses a darker primary text colour.
- Ten extras have20 unique primary/secondary colours and at least35° hue
  separation within each pair. Existing default, saved/custom colours and
  profile gradient settings are unchanged. No new feed, timer, CSS animation.
-25 focused plus14 hollow-candle/brand checks pass. Local16-theme token board
  visually inspected, not signed-in cloud-save or live multi-pane soak proof.
  Full build/release status: `docs/prompt-log/2026-10-19-reference-and-mixed-themes.md`.

## 2026-10-19 — Options Flow Tools in normal chart-grid panels

- Added an expandable Options Flow Tools group below Market & Order Flow in
  the existing panel-content picker:22 GEX DATA tools, KWANTY Classic/State/
  Orderflow/expiration calendar and25 GEX BOX tools. Source catalogue parity
  test requires exact IDs; new definitions must be added to the shared registry.
- Non-chart content kinds use `options-flow:<source>:<tool>`. Pane-owned
  `optionsFlowState` survives runtime/preset normalization and duplication.
  The Indicators library is unmounted/replaced by a disabled button on these
  panels. It must never install volume profiles over analytical tool panels.
- `OptionsFlowToolPanel` embeds actual static apps through frame-scoped host
  IDs, without replacing standalone singleton hosts. GEX BOX exports its actual
  ToolSurface/settings path; self-contained Flow and calendar own scoped saves.
  Account-scoped request pools coalesce duplicates, cap concurrency/retention,
  abort on final release and do not add a polling cadence or vendor login.
-100 source/model/regression tests plus15 GEX BOX and8 layout checks pass;
  Flow math/dashboard checks pass. Offline browser verified input/settings Save,
  State selection and theme propagation. Signed-in grid/cloud roundtrip/live
  soak and provider licensing/history/streaming limitations remain open.
- Full release/build verification: `docs/prompt-log/2026-10-19-options-flow-chart-panels.md`.

## 2026-10-18 — Cboe options expiration calendar in KWANTY

- KWANTY now has Positioning / Options Expiration Calendar page buttons; deep
  link `/kwanty?view=calendar`. Opening the calendar pauses positioning polling,
  and a direct calendar load does not initialise its market-data frame.
- Interactive year/month/agenda, product/search/legend filters, date details and
  account-tracked preferences. Dates stay in New York exchange time. Cboe legend
  colours intentionally remain fixed across themes, with readable themed chrome.
- 2026 dates and visible vector marks were read from the official Cboe PDF,
  visually checked, and compared to deterministic extraction tests. Do not replace
  them with a weekday rule: June monthly expiry is18th, VIX has five exception
  dates, September14 adds2029 LEAPS, and days can have several simultaneous marks.
- Shared six-hour Next data cache discovers published annual PDF links on Cboe's
  official hours page. SHA-based source revision, actual verification timestamp,
  conditional responses, strict URL/year/size limits and coalescing. Cached source
  revalidation/outages may keep an explicit stale state; retry15m, never pretend
  a failed check was current. Known PDF layouts auto-parse dates/colours; unknown
  geometry/legend/inks fail to the last verified snapshot rather than guessed data.
- Small31KB verified snapshot paints immediately while checking latest source.
  PDF.js5.6.205 is server-only, externalised with its worker traced; the browser
  never parses a PDF. No VPS/market-provider/key, cron or paid service is added.
- This annual schedule is not a live contract chain, broker cutoff service or
  complete stream of new product announcements. Keep the source links/disclaimer.
  Signed-in cross-device preference roundtrip and arbitrary future PDF redesigns
  remain unverified. Existing CME/auth/history/licensing gates below remain open.
- Record: `docs/prompt-log/2026-10-18-options-expiration-calendar.md`.

## 2026-10-18 — KWANTY integration (owner renamed new KWANT BOT request)

- New `/kwanty` navigation/workspace integrates the owned port4318 gexpage UI,
  defaulting to Orderflow; Classic and State remain selectable. This is NOT a
  rename/replacement of the existing KwantBot AI assistant or GEX BOX math.
- Aleph/live site palette, explicit custom colours, chart timezone, account-bound
  tracked preferences, named templates and real JSON file controls replace the
  prototype's independent skin/local server. Snapshot refresh is bounded30s,
  errors60s, paused when hidden/inactive; buffers/caches/queues have byte/count caps.
- New authenticated `/api/kwanty/{status,catalog,snapshot,history}` forwards only
  fixed operations to the shared gateway's `/v1/native-positioning/*`. Provider
  key exists only in private gateway environment/file, never browser/Vercel.
  GEX BOX and GEX DATA remain on their original provider/calculation boundaries.
- Live weekend REST checks return Friday19:59:59Z snapshots for all three views.
  Orderflow history returns403; no invented session curve/OHLC/replay. Native WS
  and web-only classified State splits are not implemented. Customer redistribution
  permission, live-RTH parity, multi-user capacity/cost and cross-device saves are
  OPEN launch gates, not implied by authenticated personal API access.
- Current temporary gateway2164 replaced13288; tunnel20608/URL unchanged.
  Private launcher uses `KWANTDESK_POSITIONING_KEY_FILE` pointing to private
  `positioning.env`; migrate as server-only `GEXBOT_API_KEY` on VPS, not into Git.
  IMPORTANT: after this one restart CME login returned13 permission denied and
  entered bounded backoff. Earlier successful CME probes below are historical,
  not current live-feed proof. Do not restart/hammer concurrent login owners.
- Record: `docs/prompt-log/2026-10-18-kwanty-integration.md`.

## 2026-10-18 — GEX DATA integration and history recovery verification

- New `/gex-data` workspace sits between GEX VUE and GEX BOX. Owner's local
  quantpage presentation/model source is integrated, not its server, credentials,
  Inter font or purple skin. Shared Aleph/theme/account preferences and existing
  authenticated gateway are the boundaries. GEX BOX calculations are untouched.
- Six-pane latest-session overview, docking/tabs, tool library, filters, chart
  navigators, named workspaces and versioned JSON import/export are preserved.
  Account-scoped storage is one tracked preference key; request/cache/queue and
  pane counts are bounded. Hidden workspace polling is paused.
- Fixed startup date pinning, snapshot timestamp persistence, live refresh timer
  starvation, zoom reset on append, single-strike extent, interval hover domain,
  final drill-down bucket width and OSI underlying selection. IV is explicitly a
  rolling series; unsupported forecast remains honestly unavailable.
- Browser QA loaded actual exposure, interval and drift data, verified immediate
  light/dark changes, tool chooser and saved template survival across reload.
  84 model/integration tests pass; TypeScript and scoped lint pass. Full live
  market-open parity/long soak and cross-device preference roundtrip remain open.
  Record: `docs/prompt-log/2026-10-18-gex-data-integration.md`.
- CME recovery deployment `42f5ffa699baacdb8c47c1b5fe26cfd0b790a19e` verified
  READY and at the public runtime: gateway authenticated/connected, SPX archive
  1,015 bars and public NQ history 6,900 bars. Execution-profile historical source
  still reports unavailable/cooling down: restored candles are NOT proof that
  exact footprint/CVD tape or full L3 history is restored.

## 2026-10-18 — Temporary laptop gateway recovery

- Later same day both processes were absent again without a Windows reboot.
  Restarted via hidden WMI-created processes (gateway13288, tunnel20608), whose
  parent is the Windows management host rather than the command runner. Public
  full-history and production URL cutover must be rechecked; no new paid VM.

- Blank futures/options charts traced to stopped laptop gateway and tunnel,
  not the Socials UI changes. Restarted existing private launch and QUIC tunnel
  hidden; connected/authenticated, recording enabled, no reported drops.
- Quick-tunnel URL changed. Four URL aliases on websiterepo-yfmi updated after
  full public NQ history (6,900 bars) and QQQ archive (406 bars) HTTP200 checks.
  Normal single main Git build applies environment changes; no paid resources.
- Computer must stay awake/online; stop laptop owner before VPS login resumes.
  Live SSE/RTH soak and standing history/VPS/capacity gaps remain unverified.
  Record: `docs/prompt-log/2026-10-18-temporary-gateway-recovery.md`.

## 2026-10-17 — Remove Socials identity banner

- Removed the complete redundant top Socials / Working title / tagline row,
  including icon/status dot and right-hand account badge. Preserve the existing
  WorkspaceSubnav and profile tab; do not retain an empty header-height spacer.
- JSX regression: `tests/socials-header.test.mjs`. Prompt record:
  `docs/prompt-log/2026-10-17-socials-header-removal.md`.

## 2026-10-17 — Profile calling-card quick picker

- Own profiles expose Change calling card with unlocked-only artwork choices,
  Active state and one-click account activation. The full collection reuses the
  same guarded save; failed writes retain the previous banner and show errors.
- POST friends calling-card checks the account's earned card (starter exempt),
  preserves the existing complete profile/row privacy, and changes only its card
  code and updated_at. No schema change, polling or market-data traffic.
- Seven new regressions / 27 combined pass. Signed-in browser/cross-device
  roundtrip remains open. Record:
  `docs/prompt-log/2026-10-17-profile-calling-card-picker.md`.

## 2026-10-17 — Account display-name consistency

- Profile-save events previously changed only the avatar in the workspace shell.
  Root now applies name/handle/avatar together. Settings and Socials successful
  saves publish an account-scoped identity snapshot; local subscribers plus an
  optional BroadcastChannel keep open sections/tabs aligned without polling.
- Cache equality preserves snapshot identity; stale startup reads cannot rewind
  a newer saved identity. Subscribers clean up on account changes/unmount and
  rehydrate cached identity when a hidden workspace's effects resume. Unsupported
  cross-tab transport cannot fail saving. Avatar-only writes preserve names.
- Render old Socials author labels from the matching current profile ID, never
  global string replacement or rewriting locked data. Filtered Gameplan/history
  GETs batch missing profile lookups (500 IDs/batch, existing RLS retained). Home
  reads the canonical account profile too. Display names and @handles stay distinct.
- Socials name changes must not reset/reload its complete workspace: its bootstrap
  effect depends on account ID, not the display-label prop. Trading payloads,
  content hashes, author IDs, user-written text and account/storage keys stay intact.
- Renaming also preserves existing profile privacy; the identity/presence upsert
  no longer resets an existing private/friends profile to community visibility.
- Thirty-eight identity/avatar/profile/Home regressions pass. Signed-in multi-device/browser
  verification remains open; prompt record:
  `docs/prompt-log/2026-10-17-account-name-consistency.md`.

## 2026-10-17 — Avatar selection tick foreground

- Shared Settings/Socials avatar buttons must allow overflow. Round only the
  image; keep the selected 20px tick badge on z-10 with a panel-colour ring.
  Clipping the button cuts the badge off against the circular edge.
- Twenty-eight focused avatar/profile tests pass, including actual picker JSX
  regression. Record: `docs/prompt-log/2026-10-17-avatar-selection-tick.md`.

## 2026-10-17 — Profile record and collection management

- Owner profile cards now expose Options for posts, Gameplans, liked, reposted
  and saved items. Unlike/Unsave resolve the viewer's reaction, never the source
  post. Delete asks confirmation; archives become private, leave the normal feed
  and can be restored from each section's Archived view with their saved audience.
- PATCH /api/socials is authenticated and owner-scoped. Audience writes use real
  row scopes (Public/Friends only/Only me), not cosmetic hiding. Collection audience
  updates are bounded bulk writes, not one Vercel request per reaction. Failures
  remain explicit; post editors do not close/report success on failed cloud saves.
- Gameplan profile notes are separate from locked trading fields. Migration
  `supabase/migrations/202610170001_social_profile_management.sql` permits only
  publication scope plus archive/profile-note metadata to change on locked rows;
  all thesis/prices/hash/timestamps/scores remain immutable. Owner confirmed
  running this migration on 2026-10-17. Recorded as owner-confirmed applied;
  independent database/function inspection and signed-in action checks are not
  yet verified. Website runtime remains verified at a5df0f884a667700d129083370627fadd44d90d2.
- Twenty-seven focused management/avatar tests pass; authenticated multi-user
  browser checks and live SQL migration verification remain open. Prompt record:
  `docs/prompt-log/2026-10-17-profile-item-management.md`.

## 2026-10-17 — Normal Settings shares the Socials avatar

- Settings → Public profile now embeds the same avatar/palette/upload/crop
  editor as Socials; Identity has a direct Change profile picture shortcut.
  Keep one implementation in `useProfileAvatarEditor`, not two divergent pickers.
- Settings loads the authenticated account's canonical Socials profile. Explicit
  Save picture uses the avatar-only friends action, preserving names, bio,
  unknown profile fields, visibility and presence. Store both rendered avatarUrl
  and editable avatarAppearance; uploaded photos explicitly clear old metadata.
- Successful writes update the account identity cache and profile-updated event.
  Already-mounted Socials receives the saved account-scoped profile object.
  Failed saves retain the editor; stale prepares and duplicate submits are guarded.
- Twenty focused avatar/settings tests pass. Signed-in browser/cross-device
  roundtrip remains unverified. Record:
  `docs/prompt-log/2026-10-17-settings-linked-avatar.md`.

## 2026-10-17 — Per-colour avatar customisation

- Every console avatar now owns a curated/extracted palette and offline colour
  map under `public/images/avatars/console-colour-maps-v1`. Keep source artwork
  unchanged. Every pixel has a two-colour assignment; delta blending preserves
  source shading/antialiasing and stock/reset is byte-identical across all 30.
- AvatarPaletteEditor shows background, outline and each paint colour with live
  circular canvas, stock swatch reset, recent swatches to the right and Reset All.
  Use the existing account-tracked `olisa-recent-colors`; do not add server-side
  image generation or per-swatch uploads. One selected source/map pair only.
- Save Profile awaits the latest palette snapshot before identity/profile writes;
  store a 500px WebP plus validated `avatarAppearance` version/presetId/hex colours
  in the profile payload. Reopen restores editable values. Uploaded photos clear
  this metadata, so old preset colours cannot replace a new photo accidentally.
- 15 focused tests pass, including real Save handler order/failure paths, renderer
  latest-state race, roundtrip/reset and all 30 maps. Local recolour kernel ~3–5ms
  per 500px avatar, not a browser/production capacity measurement. Signed-in
  cross-device save remains unverified. Record:
  `docs/prompt-log/2026-10-17-avatar-colour-editor.md`.

## 2026-10-17 — Social avatar picker and 500px crop

- Owner approved SIMPLE console-style non-human icons/mascots, not people.
  Thirty distinct image_gen avatars are in `public/images/avatars/console-v1`,
  500x500 WebP, 310,558 bytes total. Keep immutable artwork under existing
  middleware-excluded images path, not per-image authenticated/API processing.
- Picker stages the HTTPS avatar URL and preserves explicit Save Profile.
  Custom uploads output 500x500 with square editor/circle mask plus identical
  circular thumbnail, drag/zoom/reset/keyboard controls and focus containment.
  Guard stale decodes/encodes, revoke object URLs, cap source/encoded sizes.
- Eight focused crop/handler/asset/normalization tests pass; full isolated build
  and scoped lint (two existing unrelated img warnings) pass. Signed-in browser
  crop/save and cross-device roundtrip remain unverified. Record/prompts:
  `docs/prompt-log/2026-10-17-social-avatar-picker.md`, `docs/avatar-art/`.

## 2026-10-17 — Levels workspace controls

- Levels now uses a compact GEX VUE-style toolbar: five layout choices, +Panel,
  lock, matching-instrument/timeframe viewport link and named Workspaces with
  Save As/Quick Save/delete. Preserve the per-panel level-family dropdown and
  existing level calculations; this is a workspace-shell change, not a data fix.
- Panel grip supports drag/drop swaps and keyboard movement; panels can be
  maximized, duplicated and closed. Up to eight panels; column resizing updates
  a CSS variable during drag and commits state once at release. Stable panel IDs
  own chart/drawing identity. Do not add per-panel provider streams.
- `kwantdesk:levelz-workspaces:v1` participates in existing account preferences;
  restore on hydration/storage events and migrate old local layout once only.
  Persisted current desk is separate from named saved snapshots. Do not report
  success before a protected save succeeds or claim verified cloud roundtrip
  from local tests alone. Record: `docs/prompt-log/2026-10-17-levels-workspaces.md`.

## 2026-10-17 — GEX VUE screenshot workspace template

- Follow-up: the main layout toolbar now also offers `gexmap-quad`, with an
  explicit 2x2 + full-height right-map glyph. It uses the same 65/35 geometry,
  SPXW/NDX above QQQ/SPY, and persists/restores the layout key. First-run runtime
  now includes GEX QUAD + MAP too (previous early defaults returned only STANDARD).
- New built-in workspace `GEX QUAD + MAP` (`gex-quad-map`), available alongside
  GEX STANDARD only in the gamma/GEX VUE workspace picker. Do not replace the
  owner's active layout or overwrite an existing saved preset of that identity.
- Left65% is a 2x2 grid: SPXW/NDX above QQQ/SPY; right35% full-height GEX Map
  has SPXW/NDX/SPY/QQQ gamma columns. Charts use Market Index, 5m/5D, standard
  bounce-levels + dark-pool-gex overlays, theme-derived settings and linked views.
- Map starts Present/Structural/Front0DTE, one-minute step. Embedded map state
  now preserves horizon and exposure model through normalization/save/restore;
  old presets without a horizon retain their existing fallback behaviour.
- Record: `docs/prompt-log/2026-10-17-gex-vue-quad-map-template.md`.

## 2026-10-17 — GEX Map toolbar spacing

- Owner requested removal of the visible "OI model" label; it and its tooltip
  are removed. Structural/Dealer controls and all calculations are unchanged.
- Internal GEX Map rail now has 6px top/bottom padding and intrinsic height
  with a 48px minimum. Do not restore fixed 36px height: 28px controls plus
  a horizontal scrollbar consumed the content area and clipped the buttons.
- Preserve button/font sizes, horizontal scrolling and data behaviour. Record:
  `docs/prompt-log/2026-10-17-gex-map-toolbar-spacing.md`.

## 2026-10-17 — Partial options-underlying history must not blank charts

- A 3M SPY/QQQ request returned valid recent candles with `truncated: true`;
  the Next adapter threw away the entire result. Nonempty validated OHLC now
  loads with explicit coverage metadata and a scoped non-blocking chart notice.
  Empty, wrong-symbol and impossible OHLC responses still fail closed.
- Gateway serves available completed archives without synchronously fetching
  older missing days before its oldest archive. Preserve bounded provider
  fallback for recent gaps/live tail; older history belongs to the backfill.
  No unbounded per-user provider fan-out to satisfy a wide period selector.
- Local real 90-day requests: SPY 4,050 / QQQ 4,052 archived candles, Oct5–16,
  15/11ms and zero provider calls. This is partial history, not 3M or the required
  month restored. Tests: 12 focused frontend cases, 394 gateway tests, scoped
  lint and isolated build. Record:
  `docs/prompt-log/2026-10-17-underlying-partial-history.md`.

## 2026-10-17 — Footprint mode survives zoom/history hydration

- Native candle visibility and Footprint primitive publication must follow the
  selected Footprint indicator, not the 85% execution-coverage threshold. Zoom
  widens the candle window before its history arrives; using coverage as a mode
  switch flashed native candlesticks and discarded valid Footprint rows.
- Keep native OHLC series transparent (not invisible, preserving autoscale and
  attached overlays) while Footprint is enabled, including initial creation.
  Continue publishing known rows/real OHLC geometry during hydration. Retention
  is scoped by instrument/timeframe/contract, never another chart's old rows.
- Footprint tests 55/55 pass. Record:
  `docs/prompt-log/2026-10-17-footprint-zoom-mode.md`.

## Standing owner requirement — Historical coverage and unattended capture

- Explicitly reaffirmed for persistent memory on 2026-10-17: maintain at least
  one full rolling calendar month of futures and options history for every
  offered instrument, with unattended forward recording and gap backfill.
- Candle history, classified futures executions, option-contract trades/quotes/
  chains and raw depth/L3 are distinct requirements. Never claim coverage of
  one proves another, or that recorder-enabled proves connected and recording.
- Recover and verify old VPS archives/backups where possible, resolve provider
  access, and import real history rather than waiting a month or fabricating it.
  Verify upcoming Theta distribution rights and historical coverage first.
- Permanent collection belongs on the always-on VPS, with off-box backups,
  shared provider request budgets and live-feed priority. Temporary laptop
  capture is not a public-launch uptime solution. VPS restoration alone cannot
  repair entitlements or recreate unrecorded historical depth.
- Detailed current gaps and status: `docs/IMPORTANT-NOTES.md`, section
  "Launch requirement — At least one rolling month of real history". Preserve
  this constraint alongside the November multi-user launch requirement.

## 2026-10-17 — Footprint normal views must not require raw browser tapes

- A normal 160-minute NQ view contained 281,744 prints. The prior exact-window
  route rejected above 100,000 and returned no rows. Do not raise the browser
  tape ceiling or sample away trades to repair this.
- Clock Footprint history now POSTs candle boundaries and print-size filters
  to the existing tape route. The serialized archive worker produces exact
  per-candle/per-price bid/ask/unknown volume and integer trade counts plus
  filtered chronological delta extrema. The client verifies full OHLCV before
  accepting summaries, applies grouping/analytics locally and keeps live prints
  separate. Summaries are Footprint-only/flowOnly, never block-trade executions.
- Shared source-aware bounded cache/coalescing and at most eight pending compact
  jobs protect multi-user backend load. Limits: 1,000 bars, ten days, five million
  source prints and 30,000 price levels; overflow is explicit, never sampled.
- The render cache must atomically hydrate every closed bar when a new compact
  history generation arrives. Ordinary live updates retain incremental rebuilds.
  Failed refreshes preserve overlapping last-good same-contract rows.
- Public backend verified 160 NQ bars / 281,744 prints / 416,946-byte response
  and 160 ES bars / 553,424 prints / 93,445 bytes, with candle volume validation.
  Footprint 53/53, gateway 393/393, scoped lint and isolated production build pass.
- Broad indicator sweep: 143/153 pass. Ten existing Daily/Profile/TPO tests fail
  against the prior Chart source too; keep them open, do not call the whole
  library cleared. Event/sub-minute history and authenticated/live soak remain
  separate. Record: `docs/prompt-log/2026-10-17-footprint-loading-capacity.md`.

## 2026-10-17 — Provider transport and failed history-recovery checkpoints

- The configured provider hostname returns multiple IPs: some reset TLS before
  login while another completes certificate-verified TLS. Both live discovery/
  Ticker and History Plant now use bounded pre-authentication address failover.
  Keep the original URL/Host/SNI and certificate validation; never retry auth
  failures through this mechanism. No static IP or unverified endpoint is used.
- Up to eight fresh DNS candidates share the caller's total connection budget;
  each attempt is capped at three seconds. Successful address preference is
  memory-only, bounded, and must still be in fresh DNS before reuse.
- Incomplete import checkpoints containing zero prints are retried rather than
  cached forever. A full session still requires authoritative reconciliation
  before publishing. Nonempty checkpoints and transfer budget are preserved.
- Scoped backend modules deployed with a graceful temporary-gateway restart;
  health now connected/authenticated. Daily NQ complete, weekly NQ still lacks
  session-start Oct11. History Plant logged in but returned zero minute/VAP
  rows for Oct12 and Oct16 probe hours; missing imports remain provider-blocked.
  Do not claim that transport recovery restored missing data or all indicators.
- 393 gateway tests pass. Record:
  `docs/prompt-log/2026-10-17-indicator-recovery-transport.md`.

## Standing constraint — November 2026 multi-user launch

- Owner's 2026-10-17 direction: prepare for a few hundred platform users in
  approximately one month (around 2026-11-17). Plan for at least 100 concurrent
  users as a provisional validation target; total users and concurrency are
  different and the final peak target still needs confirmation.
- Make today's changes compatible with that direction; avoid disposable
  single-user fixes and unnecessary rewrites. The laptop gateway is temporary,
  not the launch architecture. Prefer shared provider ingestion/subscriptions,
  cached reusable history/calculations and bounded authenticated client fan-out
  over one vendor request/connection or full recalculation per user.
- Theta Data distribution is upcoming according to the owner, not verified
  active. Keep provider boundaries replaceable; confirm redistribution rights,
  exchange/user entitlements, quotas and required data coverage before cutover.
  Do not assume it supplies futures execution sides, depth or L3 needed by
  existing studies. No provider purchase or migration is authorized by this note.
- Before release, validate sustained concurrent chart/history/indicator load
  and market-open bursts, per-user isolation, recovery, bounded memory/queues,
  storage/retention/backups and provider/backend/Vercel cost limits. Do not claim
  capacity from user count alone; record measured latency, errors and costs.
- Carry this constraint into every backend/data/chart design decision without
  expanding unrelated fixes into a speculative infrastructure overhaul.

## 2026-10-17 — Invisible daily/weekly profiles across instruments

- Browser daily dates label the closing business date; archive sessions use
  the opening date. Daily requests now include explicit CME session boundaries
  while retaining the browser label for live-flow ownership. Do not repair this
  by changing every browser date label or guessing an exchange offset.
- Archived profiles no longer depend on a connected live contract resolver or
  book snapshot. Root-only requests select an unambiguous exact recorded
  contract in the requested window; mini/micro roots remain separate and
  ambiguous rollover identity is rejected. This is not a live front-month rule.
- Existing same-root valid profiles survive disconnected startup. Cash/options
  projection effects remain separate. Missing daily history now reports an error.
- Actual browser query builder through public gateway verified complete NQZ6
  and ESZ6 Friday daily profiles (3826/535 price levels). Weekly source sessions
  and other roots remain missing; authenticated UI soak is still unverified.
- Evidence: `docs/prompt-log/2026-10-17-profile-display-session-routing.md`.

## 2026-10-17 — Aleph website typography

- Owner supplied `Aleph_Fonts.zip` and requested every website text face be
  replaced while retaining sizes/formatting. Regular/Bold originals and OFL
  notices are self-hosted under `public/fonts/aleph`; no external font service.
- DOM/Tailwind, SVG, canvas indicators, chart libraries, persisted drawing
  paint and the static liquidity-map module graph use Aleph. Preserve emoji
  glyph faces. Numeric font sizes, weights, spacing and layout classes did
  not change; different glyph advances can naturally change text wrapping.
- Rollback: pushed tag `codex/pre-aleph-font-2026-10-17` points to `c1767932`.
  Revert the scoped font commit to undo it; do not reset unrelated local work.
- Checks/limits: `docs/prompt-log/2026-10-17-aleph-font.md`. The old drawing
  toolbar-size test already disagrees with baseline (57 vs expected 28.5);
  do not resize the toolbar as part of a font-only task.

## 2026-10-17 — Weekly profile unavailable is not perpetual loading

- Latest five-day NQ/ES weekly requests lack one/two execution sessions;
  the provider still resets the History Plant recovery connection. A fast
  incomplete result was being rejected silently. Do not call this repaired
  history or reduce the requested five-day window to make a profile appear.
- Profiles now identify missing interior CME session dates as well as their
  endpoints. Requests have a 15-second browser deadline, and weekly failure
  reaches the chart with scoped missing-history/unavailable text. Valid
  cached profiles remain painted; existing bounded retry backoff is unchanged.
- Tests/evidence: `docs/prompt-log/2026-10-17-weekly-profile-unavailable.md`.

## 2026-10-17 — Indicator history after temporary-backend recovery

- Candle-only backfill did not restore executions. The temporary gateway had
  almost no tape, so execution-backed profiles, CVD and Footprint were missing.
- Reconciled History Plant one-tick replay now restores exact prints, candles,
  minute flow and price-level folds. Completed replay replaces partial tapes;
  source-aware caches refresh rather than retaining the empty old reductions.
- Completed exact sessions reject stale root/live padding, including delayed
  snapshots during archive flush. Explicit contracts remain exact even when
  the live book is empty/root-only. Profiles never substitute mini for micro.
- Footprint gets a bounded, coalesced viewport execution window, not the
  strongest-trades sample. It validates candle volume, preserves unknown side
  and duplicate real prints, and fails closed above 100,000 prints. No per-tick
  Vercel polling was added. Broad windows still require zooming in.
- Seven NQ/ES sessions recovered (NQ session starts Oct12–15; ES Oct13–15).
  The remaining imports stopped on provider connection/permission failures;
  checkpoints and a conservative cumulative 36 GiB transfer ledger survive.
  Do not claim five complete sessions or all instruments restored yet.
- Latest-session public backend checks: NQ/ES each 1,380 candles with full
  flow coverage; exact Footprint windows reconcile. Authenticated UI/memory
  soak and next live-session verification remain open. Carry these changes
  and recovered archives to the replacement VPS before cutover.
- Evidence and limits: `docs/prompt-log/2026-10-17-indicator-history-recovery.md`.

## 2026-10-17 — Browser startup formatter churn

- Follow-up exact production profile column `0dxfzvbz_v-m8.js:1:312046`
  identifies the remaining full-history cash-close scan (73–78% CPU samples).
  `findCashCloseFuturesCandle` now binary-searches ordered history, preserving
  NY date/minute/tie semantics; workspace skips it while calibration is valid.
  Seven tests pass; 1,000 lookups through 120k bars measured 16ms. Do not
  restore a per-candle clock scan here. Post-deploy memory soak remains due.

- Production telemetry captured 14–20s Charts stalls, with 94–96% of samples
  in the indicator/configuration bundle. Gamma, sweep and profile clocks in
  that bundle constructed native ICU formatters per candle. Reuse module
  clocks; keep all timezones, DST rules and calculations unchanged.
- Three 6,900-bar cash-close scans: 20,700 constructors / 1,583ms before,
  zero constructors / 83ms after. Five runtime regression cases plus existing
  profile/sweep/exchange-clock/history checks pass. These are not signed-in
  browser startup measurements. Source columns now survive stall profiles
  so another anonymous/minified hotspot can be attributed precisely.
- Prompt/evidence/limits: `docs/prompt-log/2026-10-17-browser-startup-freeze.md`.
  Authenticated saved-workspace soak and last-used viewport restore remain open.

## 2026-10-17 — Chart-history startup latency

- Buffered gateway JSON/provider responses now negotiate asynchronous cached
  gzip; streams remain untouched. Historical dated options surfaces cache five
  minutes; live/current-session cadence remains unchanged.
- Ordinary futures candles no longer await the optional 120-second execution
  archive or IndexedDB writes; the independent flow hydrator remains active.
  Closed CME sessions skip live-seam requests. Valid OHLC can be cached without
  claiming missing aggressor fields exist; event geometry is unchanged.
- Options-underlying candles request the entire archived window once from the
  gateway and validate symbol/range/OHLC/truncation before accepting it.
- Public five-day backend reads measured roughly 0.4–1.1 seconds after the
  temporary gateway deployment. Carry these source changes to the restored VPS.
- Evidence/tests/limitations: `docs/prompt-log/2026-10-17-chart-loading-latency.md`.

## 2026-10-17 — Temporary gateway after Vultr account closure

- The old feed VPS is unreachable. The owner requested a temporary recovery
  until Vultr responds, with the latest five futures/options sessions.
- A committed-HEAD gateway runs at
  `%LOCALAPPDATA%/KwantDesk/temporary-market-gateway`, through the existing
  Tailscale Funnel. This computer must stay awake and online. Stop this owner
  before starting the same Rithmic login on a replacement VPS.
- Rithmic Ticker and History Plant logins are authenticated. Five-session
  NQZ6/ESZ6 minute imports each returned 6,900 valid bars. The offered-root
  import continues with checkpointing; provider-rejected roots remain explicit.
- Production gateway URL/token/provider aliases were updated on only
  `websiterepo-yfmi`. The scoped runtime-source comment commit intentionally
  applies those environment updates through the normal main-only Git build.
- QuantData's saved key returns 403 / active API subscription required. Owner
  verification of the renewed API entitlement/key is pending. Do not claim
  options are restored or enable retired providers as a substitute.
- Ten gateway environment-resolution tests pass. Final production deployment
  and endpoint verification are recorded in the prompt log. No live RTH claim.
- Prompt, data limits and VPS return procedure:
  `docs/prompt-log/2026-10-17-temporary-feed-recovery.md`.
- Follow-up: the renewed QuantData key is installed privately on the temporary
  backend and options snapshots authenticate. All 65 underlying sessions and
  49 of 53 futures roots imported. A detached QUIC relay replaced the unstable
  HTTP/2 relay; full public NQ/ES history reads pass in roughly 1–1.5 seconds.
  Return new recordings and these minute archives to the VPS before cutover.

## 2026-09-07 — GEX Levels production incident and rollback

- `be186dfc` caused production Charts to spin/crash during startup and was
  completely reverted by `f3f1858d`. Because Charts still failed, the two
  immediately preceding Speed of Tape Instant releases (`e3ed22eb`, `f37eb324`)
  were also reverted. Production was verified on exact SHA `d5312869`; the
  gateway stayed connected/authenticated.
- Do not reapply those batches. Capture the client exception and reintroduce
  GEX/Instant Tape pieces separately with an existing saved-workspace browser
  startup test before release.
- Incident record:
  `docs/prompt-log/2026-09-07-gex-levels-production-rollback.md`.

## 2026-09-07 — Volume profiles keep their last-good frame at candle boundaries

- Rolling Composite Volume Profile requests change range identity when a new
  candle opens. The workspace now retains the currently painted exact profile
  until the next exact execution-backed response is ready, then replaces it
  atomically instead of clearing the chart in between.
- This continuity rule also covers Daily, Weekly, Monthly, Session and Visible
  Range profile recalculations. It remains strict about symbol, contract,
  active trading dates, selected sessions and removed studies, so continuity
  cannot leak stale data into another scope.
- Prompt/outcome:
  `docs/prompt-log/2026-09-07-volume-profile-candle-boundary-continuity.md`.

## 2026-09-07 — Weekly and composite profiles no longer wait on the warmer clock

- A cold exact profile now wakes the serialized archive worker immediately;
  each missing session follows the previous fold without another 20-second
  interval gap.
- The gateway may wait up to eight seconds for that off-thread fold and answer
  the original request, avoiding the browser's additional 15-second retry.
- Heavy tape folding remains outside the quote/Rithmic event loop and pauses
  when the loop-load guard reports overload. Prompt/outcome:
  `docs/prompt-log/2026-09-07-volume-profile-load-latency.md`.

## 2026-09-07 — Journal account deletion is a permanent cascade

- Deleting a Journal now immediately purges its account, trades, imports,
  evidence and analysis from the visible state and durable browser store.
- Persistent local tombstones prevent stale IndexedDB/memory snapshots and
  the automatic paper-journal writer from recreating an explicitly deleted
  account. Explicitly creating/importing that account again clears the marker.
- Cloud deletion is idempotent for local-only/already-absent accounts and also
  removes linked Socials trade posts before the database account cascade.
  Prompt/outcome: `docs/prompt-log/2026-09-07-journal-account-deletion.md`.

## 2026-09-07 — New candles no longer flash the chart surface

- A one-bar live append is no longer misclassified as a historical hydration.
  Price still paints immediately through the direct chart event, while the
  expensive shared indicator snapshot is refreshed as interruptible work.
- All futures, cash-index and options live-boundary candle commits now use a
  React transition, preventing heavy indicators from blocking calculators,
  drawings and chart canvases at the opening of a new bucket.
- Real backfills, corrected history, replay movement and restored execution
  archives remain immediate. Prompt/outcome:
  `docs/prompt-log/2026-09-07-new-candle-render-continuity.md`.

## 2026-09-07 — Value Area levels restored from Rithmic History Plant

- KwantDesk Levels → Value Area now obtains both the prior-session and full
  prior-week volume-at-price profiles from Rithmic History Plant. It no longer
  depends on the retired historical provider for the weekly half of the
  overlay.
- History replay work is coalesced and serialized on the VPS. The raw-tape
  fallback now folds every trading-date file in a weekly window and correctly
  counts numeric GAP/DROPPED timestamps; compromised recordings remain
  rejected rather than producing confident trading levels.
- Live isolated NQU6 verification returned complete 1,379-minute daily and
  6,899-minute weekly profiles with zero reported integrity gaps. Prompt,
  diagnosis and outcome:
  `docs/prompt-log/2026-09-07-value-area-levels-data-path.md`.

## 2026-09-07 — Panel layout switches preserve live charts

- Workspace layout templates no longer render heavyweight charts directly in
  the recursive split tree. Each visible chart owns a stable portal host that
  is moved into the new geometry, so single/two/three/quad layout changes do
  not unmount and reconstruct existing canvases, history or indicators.
- A newly exposed pane still hydrates independently through the existing
  staggered loader; it cannot blank or block the chart already on screen.
- Pane activation continues at the portal boundary and deleted pane hosts are
  cleaned up. Prompt/outcome:
  `docs/prompt-log/2026-09-07-instant-workspace-layout-switches.md`.

## 2026-09-07 — Aggressive-flow CVD continuity

- Removed two silent 25,000-execution overflow paths between the market worker
  and chart pane. Real executions now drain FIFO without being deleted during
  an aggressive burst.
- Structured-clone work remains bounded to one in-flight batch per contract and
  at most 25,000 records per delivery, so correctness does not restore the old
  browser message flood.
- Stress coverage proves exact ordered delivery of 100,000 queued executions;
  CVD coverage proves a 5,000-bar aggressive sequence reaches its exact final
  cumulative value without an internal break. Prompt/outcome:
  `docs/prompt-log/2026-09-07-aggressive-flow-cvd-continuity.md`.

## 2026-09-07 — Cross-market candle integrity audit

- Futures event bars now have one construction contract in the browser and
  gateway. DeepCharts-style Vol Bars use the same target/reversal algorithm
  on both sides instead of the gateway silently treating them as range bars.
- Delayed cash/options history now reconciles the complete observed live tail,
  preserving every live high, low and close rather than replaying only the
  latest quote and erasing an earlier wick. The first live bucket keeps its
  authoritative historical open; fully observed later buckets keep their real
  first-trade open, including genuine market gaps.
- QuantData and cash-index history reject structurally impossible OHLC rows at
  the provider boundary. They are not widened into plausible-looking candles.
- Verification passed for 53 futures instruments across 50 intervals (2,650
  combinations), 14 options/cash symbols across 14 routed intervals (196
  combinations), plus archive, rollover, gap, wick, event-ownership, live seam,
  TypeScript and production-build suites. Prompt/outcome:
  `docs/prompt-log/2026-09-07-cross-market-candle-integrity.md`.

## 2026-09-07 — Liquidity-map live frame pacing

- Normal 20 FPS map paints no longer rebuild the complete 1,800-frame Signals
  analysis every 200 ms. The canvas consumes the already incremental session
  CVD; full order-flow analysis runs only when the Signals inspector requests it.
- Trade clustering now uses a screen-space spatial index, applies bounded
  density level-of-detail, and incrementally rebuilds only an overlapped live
  tail. Settled anchored bubbles are retained without rescanning their trades.
- A 90,000-print synthetic open measured the recurring cluster step at 13.2 ms
  after its one-time initial build, versus roughly 158 ms for every live rebuild
  on the former path. Feed/depth cadence and trade totals are unchanged.
- Prompt/outcome: `docs/prompt-log/2026-09-07-liquidity-map-frame-pacing.md`.

## 2026-09-07 — Liquidity-map bubbles keep their execution anchor

- Smart-cluster bubbles now retain the timestamp, price and frame of their
  first real execution. Later nearby trades can grow the bubble but cannot
  drag an already displayed bubble to another market point.
- Cached clusters resolve their retained frame against the current rolling
  history array on every paint. When an anchor rolls out it disappears instead
  of briefly jumping onto another column while the 100 ms cache refreshes.
- The static module graph was cache-busted as one version so production clients
  cannot mix the old renderer with the new cluster contract. Prompt/outcome:
  `docs/prompt-log/2026-09-07-liquidity-map-bubble-anchors.md`.

## 2026-09-07 — Forming candle wicks cannot shrink

- The final direct-render boundary now owns monotonic same-bar OHLC authority.
  Once a real forming candle has printed a high or low, a later stale/reconciled
  snapshot cannot erase that wick; the newest real close continues to move.
- Open, volume, trade counts and classified-flow counters also cannot rewind
  inside the same source bar. A new source timestamp starts a clean candle, so
  extrema never leak into the next bar or across chart scopes.
- Live visual-path tests pass 13/13 across out-and-back bursts and explicit
  stale-snapshot wick shrinkage; all 19 clock-interval authority cases and
  OHLC healing 7/7 pass. Prompt/outcome:
  `docs/prompt-log/2026-09-07-forming-wick-retention.md`.

## 2026-09-07 — CVD render continuity

- CVD history corrections are now committed atomically even when candle count
  and endpoints do not change. This prevents the periodic flow-heal pass from
  mixing an old indicator snapshot with corrected bar flow.
- Lower panes retain proven same-scope time coordinates while Lightweight
  Charts replaces its price-series map, and CVD retains its last complete frame
  across a transient empty, materially shorter or newly fragmented snapshot.
  Instrument/timeframe/replay scope changes clear both protections immediately.
- Focused CVD lifecycle, hydration, settings, session-gap and flow-heal tests,
  TypeScript and the complete production build pass. Live RTH soak remains an
  explicit item in `docs/IMPORTANT-NOTES.md`.
- Prompt, diagnosis, fix and outcome:
  `docs/prompt-log/2026-09-07-cvd-render-continuity.md`.

## 2026-09-07 — Weekly profile defaults to five trading days

- Weekly Volume Profile now starts as one rolling calculation across the latest
  five actual CME trading sessions, including the developing session. Candle
  trading dates make the window holiday-aware; a weekday fallback covers the
  initial history-hydration phase.
- Existing untouched/current-week profiles migrate to the new stock behaviour.
  Explicit previous-week profiles stay previous-week, and users can still
  choose rolling five, current calendar week or previous calendar week.
- Futures and projected cash/options profile requests use the same explicit
  window. Prompt, fix and outcome:
  `docs/prompt-log/2026-09-07-weekly-profile-five-days.md`.

## 2026-09-07 — Indicator frame-budget audit

- Fixed the reported navigation stalls in Imbalance Tracker, Daily Volume
  Profile, Big Blocks and Big Contracts. Offscreen zones are now indexed out,
  profile analytics are cached between data changes, dense contract labels use
  visual level-of-detail, and full Big Contracts tape reconciliation no longer
  follows every live candle tick. Its direct execution listener remains the
  immediate live path.
- Big Blocks coalesces repeated forming-candle work to one calculation per
  display frame. Empty native renderers across the broader indicator catalogue
  no longer join chart repaints.
- Production build, TypeScript, scoped lint, targeted live-edge tests and the
  new frame-budget regression gate pass. Prompt/outcome:
  `docs/prompt-log/2026-09-07-indicator-frame-budget.md`.
- Follow-up: forming-bar Big Blocks are now latched until a newer sampled bar
  can authoritatively accept or reject them. This removes the live/sampled
  writer race that made individual blocks flash off and back on.

## 2026-09-07 — Second-pass chart frame budget cleanup

- Follow-up after the first navigation fix: removed price-rail state work and
  P&L text formatting from viewport frames, made empty drawing layers cost
  nothing, and coalesced duplicate SVG/precision-canvas repaint notifications
  to one job per browser frame.
- No feed, candle, order or indicator calculation cadence changed. Prompt and
  outcome: `docs/prompt-log/2026-09-07-chart-navigation-frame-budget.md`.

## 2026-09-07 — Chart navigation regression removed

- Panning and zooming no longer force a reconciliation of the full React chart
  tree every 64 ms. Native chart canvases, drawings and paper-order overlays
  remain frame-driven; React coordinate overlays now perform one trailing
  settle after an interaction burst.
- Session/monthly profile variants and non-visible Profile Values modes no
  longer recalculate from ordinary viewport movement. Visible-range modes keep
  the required viewport dependency. No market-data cadence was changed.
- Prompt, diagnosis, fix and verification:
  `docs/prompt-log/2026-09-07-chart-navigation-regression.md`.

## 2026-09-07 — Public product description corrected

- Root browser metadata, PWA manifest and login copy now describe Kwant Desk
  as a professional trading platform, not a private quantitative research
  workspace. Prompt/outcome:
  `docs/prompt-log/2026-09-07-public-product-description.md`.

## 2026-09-07 — Chart emoji counts hidden

- Removed the total catalogue count from the picker heading and the filtered
  result count from its pager. Search, categories, paging and recent quick
  picks are unchanged. Prompt/outcome:
  `docs/prompt-log/2026-09-07-hide-chart-emoji-count.md`.

## 2026-09-07 — Session windows no longer overlap by default

- Sessions and Session Marker now use one New York exchange-time hand-off:
  Asia 16:00–03:00, London/Europe 03:00–09:30 and New York/USA 09:30–16:00.
- Boundary candles belong to the newly opened session only. If customised
  clocks overlap, the earlier window is clipped and its OHLC is recalculated;
  intentional overlap remains available behind an explicit setting.
- Session Highs & Lows now hands London to New York at 08:30 Chicago time.
  All three studies expose independent per-session on/off and start/end
  controls, while legacy stock clocks migrate without replacing real custom
  clocks. Prompt/outcome: `docs/prompt-log/2026-09-07-session-window-handoffs.md`.

## 2026-09-07 — KWANT Profile Values accuracy and settings overhaul

- Fixed the standalone level-only profile failing to activate its own exact
  Footprint/VAP source. It no longer depends on another order-flow study being
  open before POC, VAH, VAL, VWAP, peaks or valleys can calculate.
- Profile Values remains on the shared corrected Volume Profile value-area
  calculator and native level renderer. Positive-volume VAP holes now fail
  closed instead of joining a plausible-looking level set across missing data;
  genuine zero-volume bridge bars remain valid.
- Settings schema v2 adds independent POC, VAH/VAL, peak, valley and VWAP
  widths, developing VA Off/Dashed/Solid, level line styles and beside-profile/
  line-end labels. Old shared-width and developing-VA saves migrate intact.
- Aggregate Trades now combines same-time/price/side fragments before its
  execution-size filter; ordinary Volume continues to filter each print.
- Focused math/source/migration/gap/performance tests, numeric-slider checks,
  scoped ESLint and TypeScript pass. Prompt/outcome:
  `docs/prompt-log/2026-09-07-profile-values-overhaul.md`.

## 2026-09-07 — Session Marker converted from Pending

- Added real DST-aware Asian, Europe and USA windows over chart OHLCV, plus
  live high/low, first-N-minute imbalance, open/close, midpoint and optional
  per-session VWAP.
- Added public/DLL-backed clocks, styles, ranges, colours, theme ownership,
  Save/templates/export/import and saved normalization. The public guide's
  implausible `20` line-width typo is not reproduced; web width is safely 1–4.
- Four focused tests, source/test ESLint, TypeScript and the full 80-page build
  pass. Pending inventory is 16; production SHA verification follows push.
- Evidence: `docs/deepcharts-session-marker-audit.md`; prompt/outcome:
  `docs/prompt-log/2026-09-07-session-marker.md`.

## 2026-09-07 — Anchored VWAP catalogue entry activated

- The Pending Anchored VWAP library entry now arms the existing authoritative
  `ChartDrawLayer` implementation instead of creating an anchorless study.
- One chart click creates the live HLC3 VWAP; the existing drawing editor owns
  four sources, three optional deviation bands, fill/opacity, theme colours and
  drawing persistence. No duplicate calculator or static placeholder was added.
- Existing VWAP-family and drawing-system tests plus the catalogue audit are the
  release gate. Pending inventory is 17; production SHA
  `5948c5be81f17684fd4e38831ae7ddac29f0882d` is verified live.
- Prompt/outcome: `docs/prompt-log/2026-09-07-anchored-vwap-library.md`.

## 2026-09-07 — Price Movement Levels converted from Pending

- Added exchange-session Open and future-safe prior-Close anchors, percentage
  and true-instrument-tick steps, dynamic minimum levels, labels and separate
  support/resistance/zero plots.
- Added the complete public/DLL setting surface, custom exchange-time windows,
  theme/custom colours, deep history and saved/template normalization.
- Seven focused tests plus shared sliders/templates/theme, isolated browser QA,
  TypeScript and the 80-page production build pass. Pending inventory is 18.
  Production SHA `64c43cdc7ed0c1628a233610346808af84a1b22e` is verified live.
- Evidence and honest width/private-formula limits:
  `docs/deepcharts-price-movement-levels-audit.md`; prompt/outcome:
  `docs/prompt-log/2026-09-07-price-movement-levels.md`.

## 2026-09-07 — FVG Identifier converted from Pending

- Added standard future-safe three-candle bullish/bearish fair-value gaps with
  instrument-tick filters, close/wick mitigation, percentage breakout,
  session reset, finite/unlimited extension and no synthetic future time.
- Added the complete observed public/DLL settings contract in the official
  General, Plot settings and Extension sections, plus shared theme/custom
  colours, sliders, templates and saved normalization.
- Nine focused tests, the existing Gap Detector suite, slider/template/theme
  regressions, TypeScript, isolated browser plot/settings/Save/reload QA and
  the complete 80-page production build pass. Pending inventory is 19;
  production SHA verification is due.
- Protected formula/native-pixel parity limits:
  `docs/deepcharts-fvg-identifier-audit.md`; prompt/outcome:
  `docs/prompt-log/2026-09-07-fvg-identifier.md`.

## 2026-09-07 — Text on Chart converted from Pending

- Added the official four-setting fixed viewport note: font size, text colour,
  background colour and multiline text, with DLL-confirmed max size 50.
- The note is theme-aware, persisted/template-ready, bounded, and excluded
  from price autoscale. Five focused tests and isolated browser edit/Save/
  render QA pass. Pending inventory is 20; shared build/deploy gates are due.
- ADR Target remains Pending: public evidence omits the arithmetic for its six
  named target lines, so no speculative trading levels were enabled.
- Evidence: `docs/deepcharts-text-on-chart-audit.md`; prompt/outcome:
  `docs/prompt-log/2026-09-07-text-on-chart.md`.

## 2026-09-07 — Swing Point converted from Pending

- Implemented confirmed high/low horizontal segments with the public `2 / 2`
  lookback defaults, optional alternating filter and no future leakage.
- Added every public/DLL display and plot control, theme/custom colours, shared
  sliders/templates, saved normalization, deep history and a custom primitive.
- Invalid or out-of-order candles are hard boundaries; levels never bridge a
  suspect history gap. Explicit formula/tie/filter parity limits:
  `docs/deepcharts-swing-point-audit.md`.
- Nine focused and 39 combined tests, slider/template/theme checks, scoped
  ESLint, TypeScript, browser plot/settings/Save QA and the complete 80-page
  production build pass. Pending inventory is 21; production SHA verification
  is due after the scoped release push.
- Prompt and outcome: `docs/prompt-log/2026-09-07-swing-point.md`.

## 2026-09-07 — Regression Channel converted from Pending

- Owner request: continue the complete Pending-library overhaul one real study
  at a time, using DeepCharts/public DLL evidence and no cosmetic enablement.
- Added a separate Regression Channel overlay with current-window Bars mode,
  two Zig Zag anchor modes, three regression/deviation lines, gap-safe history,
  deep-history routing and complete public width/style/directional-colour
  controls. Existing Linear Regression was not changed.
- Public contract and explicit protected-parity limits:
  `docs/deepcharts-regression-channel-audit.md`.
- Prompt and outcome: `docs/prompt-log/2026-09-07-regression-channel.md`.
- Eight focused tests, shared slider/template/theme checks, scoped ESLint,
  TypeScript, the complete 80-page production build and synthetic browser
  plot/settings/Save-persistence QA pass. Production SHA verification is due.

## 2026-09-07 — Ichimoku Indicator converted from Pending

- Added the standard Tenkan/Kijun/Chikou and two forward Senkou plots with a
  real bullish/bearish Kumo primitive over chart candles.
- Public DeepCharts screenshot gives installed `9/26/52` defaults; licensed
  DLL public properties/bounds give the three `1..1000` period contracts.
- The article's contradictory third-period wording and the standards-backed
  resolution are explicit in `docs/deepcharts-ichimoku-indicator-audit.md`.
- Six focused tests, shared slider/template/theme checks, scoped ESLint,
  TypeScript and the complete 80-page production build pass. Isolated browser
  QA verifies plotted lines/cloud, sliders and Save/close/reopen. Production
  deployed-SHA verification is due.
- Pending inventory is 23.

## 2026-09-07 — Inverse Cyber Cycle converted from Pending

- Added the real two-window inverse-Fisher oscillator over an Ehlers Cyber
  Cycle, with observed 0.010 / 21 / 84 defaults and full-width 0 / ±0.60 levels.
- Added the complete public settings shape, theme/custom colours, auto-colour,
  labels, secondary scale, pane docking, deep history and saved normalization.
- Licensed DLL public metadata supplied exact properties/bounds; protected
  formula bodies were not inspected and exact vendor seed/pixel parity is not
  claimed. Seven focused tests, numeric-slider/template/theme/layout shared
  regressions, TypeScript and the complete 80-page production build pass.
  Isolated browser QA verified the pane/levels, exact numeric controls and
  Save/close/reopen persistence. Production deployment verification is due.
- Pending inventory is 24. Audit:
  `docs/deepcharts-inverse-cyber-cycle-audit.md`.

## 2026-09-07 — Zig Zag converted from Pending

- Added Highest lowest, Absolute reversal and real instrument-tick reversal,
  separate themed swing plots, a developing final leg and latest-swing
  38.2/50/61.8/75 retracement rendering with Extend right.
- DeepCharts public help and licensed DLL metadata define settings/defaults;
  protected tie/intrabar behavior is explicitly not claimed identical.
- Eight focused tests, TypeScript and isolated synthetic browser rendering/
  settings QA pass. Pending inventory is 25; scoped release verification due.

## 2026-09-07 — Auction Gap consumes the direct live execution seam

- Auction Gap now opts into the existing per-pane exact-execution fan-out and
  coalesces live calculations in its worker instead of moving work to React.
- Live calculation keeps compact history immutable, replaces its final seam
  bar from the retained exact tape, and appends newer time/event bars through
  the existing authoritative allocation logic. A partial/mismatched tape keeps
  the last proven frame rather than merging false rows or flashing blank.
- 108 Auction Gap tests, 51 gateway tests, TypeScript and scoped lint pass.
  Remaining: explicit live loss/coverage receipt propagation, unavailable UX,
  alerts and browser/live-market QA. Gate OFF/no push/deploy.

## 2026-09-07 — Auction Gap history reaches the chart primitive

- Active Auction Gap panes now pass their contract/timeframe-scoped compact
  history into Chart, calculate the lifecycle in the existing Web Worker and
  paint the resulting zones/markers with the native chart primitive.
- Added a fail-closed alignment boundary for history trimmed on the left or
  followed by a changed/developing live bar. Contract, unique timestamps,
  contiguity and exact volume must still match before rows can paint.
- 106 Auction Gap tests, 51 gateway tests, TypeScript and scoped lint pass.
  Remaining: incremental live execution continuation, live coverage receipts,
  user-visible unavailable state/alerts and browser QA. Gate OFF/no push/deploy.

## 2026-09-07 — Compact Auction Gap history feeds the study engine

- Added a v2 slice adapter that classifies each exchange minute with the real
  session clock, groups reset boundaries inside one chart candle, and keeps
  unfiltered raw rows separate from filtered detection rows for later retests.
- The existing worker study pipeline can now seed directly from compact history
  without rebuilding or transferring the raw execution archive.
- Adapter/study/session tests, TypeScript and scoped lint pass. Remaining:
  workspace-to-Chart worker/primitive wiring, event live continuation, live
  coverage receipts and browser QA. Gate OFF/no push/deploy.

## 2026-09-07 — Auction Gap v2 retains exact settings boundaries

- Compact rows now include ordered one-minute execution slices with their own
  source times, OHLC ticks and bid/ask/unknown rows for every time/event bar.
- This lets RTH/ETH/custom filters and session resets split long time, range,
  volume, trade, delta, Renko and P&F bars without raw-tape transfer or guesses.
- Web validation requires slices to recombine exactly to aggregate rows and
  candle geometry/volume. Durable cache versions were bumped for v2.
- 98 Auction Gap tests, 51 gateway tests, TypeScript and scoped lint pass.
  Remaining: slice-to-worker adapter, Chart primitive/live receipts/browser QA.
  Gate OFF/no push/deploy.

## 2026-09-07 — Active Auction Gap panes request and retain exact history

- The chart workspace requests compact rows only when Auction Gap is enabled;
  base/order-flow panes retain their existing payload and cache identity.
- Browser handoff rechecks contract, candle generation, row order and volume,
  copies accepted data and retains at most 32 contract/timeframe scopes.
- Replay and live initial hydration both opt in. 97 Auction Gap tests,
  TypeScript and scoped lint (pre-existing warnings only) pass.
- Remaining: settings-time segmentation, worker/primitive consumption, live
  coverage receipts and browser QA. Gate OFF/no push/deploy.

## 2026-09-07 — Auction Gap compact rows cross the web trust boundary

- Added a fail-closed web validator for the gateway's compact time/event rows.
  It reconciles exact contract, schema/provider, coverage/order proof, candle
  identity, tick geometry, sorted one-tick rows and total source volume.
- CME history now opts into `auctionGap=1`, validates beside the server-side
  candle decode, preserves the result through isolated durable/process caches,
  and exposes it only on explicitly requested public responses.
- 95 Auction Gap tests, 50 gateway tests, TypeScript and scoped lint pass.
  Remaining: browser request/state, settings-time segmentation, worker/Chart
  consumption, live coverage receipts and browser QA. Gate OFF/no deploy.

## 2026-09-07 — Auction Gap compact rows on all history chart families

- History `auctionGap=1` attaches compact proven rows to minute-and-higher
  canonical responses after exact tape OHLC/volume/coverage reconciliation.
- Sub-minute history aggregates the rows in its existing tape pass; no duplicate
  scan. Event support was already integrated. Ordinary requests are unchanged.
- Missing receipts, truncation, off-tick input or source mismatches return an
  explicit empty failure. 50 combined tests and scoped lint pass.
- Remaining: live coverage receipts, settings-time segmentation, web envelope
  validation, worker/primitive Chart wiring and browser QA. Gate OFF/no deploy.

## 2026-09-07 — Auction Gap rows in the existing event-history scan

- Event history accepts opt-in `auctionGap=1` and aggregates one-tick rows in
  its existing archive pass; it does not scan the tape twice.
- It verifies compact row volume and raw-receipt coverage for every resulting
  event bar. Success is a versioned Rithmic envelope; failure has empty rows and
  an explicit reason. Builder retention makes truncation fail closed.
- Base and gap requests have separate cache keys, preventing cache-order data
  omission/leakage. 31 tests and scoped lint pass. Time route/live/settings/
  Chart integration remain; gate OFF, no deployment.

## 2026-09-07 — Backfill coverage uses raw observation span

- Corrected receipt bounds from first/last trade to first/last observed raw
  recorder message in the actual pre-live-cutoff segment. Candle edges can now
  be proven without inventing session bounds.
- GAP/DROPPED after live takeover no longer poisons the backfill segment;
  in-segment or untimed loss still fails closed. Rows lacking `receivedAt`
  fall back only to their real execution time.
- Two end-to-end CLI fixtures and seven receipt tests pass; scoped lint passes.
  Existing receipts need regeneration. Route/live/Chart remain; gate OFF.

## 2026-09-07 — Gateway-side Auction Gap event-row fold

- Existing event builder now returns the sole owning bar for each accepted
  execution; current callers ignore the compatible return value.
- Compact rows now cover volume, trade, delta, range, Renko and point/figure.
  Allocation uses builder ownership, never synthetic chart time; unknown sides
  remain unknown and bridge bars receive no duplicated volume.
- Output is bounded only after stable absolute ownership. 49 combined tests and
  scoped lint pass. Route/coverage/settings-time/live/Chart work remains; gate
  OFF and no deploy.

## 2026-09-07 — Gateway-side Auction Gap time-row fold

- Added a pure gateway fold that assigns ordered exact prints into explicit
  half-open canonical time bars and emits compact one-tick bid/ask/unknown rows.
- Every nonempty bar reconciles exact volume and OHLC. Missing, extra,
  unassigned, reversed, off-tick or invalid-side execution input fails with no
  partial result; zero-volume synthetic bridges produce no fake rows.
- This is the intended cost boundary: raw tapes stay off Vercel/browser.
  34 archive/coverage/fold tests and scoped lint pass. Route, proof attachment,
  event-bar fold and Chart integration remain; gate OFF, no deploy.

## 2026-09-07 — Chart-interval trade-tape coverage proof

- Added multi-receipt proof over explicit chart-bar intervals. Healthy adjacent
  receipts can meet exactly; positive holes, damaged/malformed evidence and
  cross-contract receipts fail closed.
- Explicit intervals avoid pretending CME maintenance/weekend closures require
  executions while still requiring every real chart bar to be covered.
- 28 archive/coverage tests and scoped lint pass. Gateway compact-row fold and
  Chart integration remain; Auction Gap is still Pending and not deployed.

## 2026-09-07 — Coverage receipts exposed by bounded tape loader

- `TradeTapeArchive.load` now returns available raw per-session coverage
  receipts alongside its bounded exact prints.
- It intentionally does not add `coverageComplete`; callers must validate the
  receipts and requested market intervals. Missing evidence remains explicit.
- Existing time/event chart folds are unchanged. 25 archive/coverage tests and
  scoped lint pass. Multi-session proof and gateway-side compact Auction Gap
  folding still precede Chart wiring; Pending gate remains OFF, no deploy.

## 2026-09-07 — Persistent trade-tape coverage receipts

- Added `trade-tape-coverage.mjs`: versioned Rithmic coverage receipts retain
  exact exchange/contract/session observation bounds, print count, raw recorder
  GAP/DROPPED count and damaged gzip-member count.
- Existing backfill writes the receipt atomically beside each compact sidecar,
  including honest evidence for empty/failed-integrity extracts. It does not
  claim a damaged recording was repaired.
- A receipt proves only a same-contract request wholly inside its observed
  bounds with zero known gaps/damage and valid ordering. Missing or malformed
  receipts fail closed.
- 24 archive/coverage tests and scoped lint pass. This is source groundwork;
  multi-session/live coverage and Chart integration remain, gate OFF, no deploy.

## 2026-09-07 — Auction Gap exact-history envelope validator

- Added a fail-closed validator for the original Rithmic envelope: exact contract,
  v3/provider identity, full requested bounds, explicit historical/ordering
  completeness, no truncation, exact source count and valid atomic executions
  with v2 sides, allocation, identities and timestamp order are all mandatory.
- The current retained gateway tape is deliberately rejected because it says
  historicalAvailable=false; matching bounds and truncated=false alone do not
  prove the tape began at the requested start. Failed validation exposes no rows.
- Confirmed raw-archive backfill records GAP/DROPPED and damaged-member evidence
  but only extracts surviving prints, so it cannot turn a damaged recording into
  complete history. Add truthful coverage evidence or licensed exact-print
  backfill before connecting this source to Chart.
- 90 Auction Gap tests, tsc and scoped lint pass. Gate remains OFF: 28 Pending,
  no browser/runtime source proof, production push or deployment.

## 2026-09-07 — Auction Gap original history response handoff

- Found `compactIndicatorExecutionHistory` explicitly reduces older history to
  12 strongest prints/minute, recent tail to 25k and total to 50k. Its output
  cannot be Auction Gap's exact historical source. Existing indicators unchanged.
- Added no-cache/no-fetch scoped `auctionGapHistorySource`; existing institutional
  history fetch publishes original response after existing normalization and
  before persistence merging. Preserves raw contract/schema/flowOnly metadata;
  no consumer yet. Listener failure cannot fail shared history or other listeners.
  No added network/stream/timer, no retained response when consumers leave.
- 84 Auction Gap tests, tsc and scoped lint pass. Actual fetch hook is checked;
  subscription/contract isolation/error/release tests pass. No browser/runtime
  source proof yet. Keep Pending gate off; still 28 remaining, no deployment.
- Critical: gateway order-flow endpoint currently sets truncated=false on its
  retained book tape and historicalAvailable=false; that does NOT prove complete
  historical coverage. Consumer must verify independent chart/coverage evidence,
  not promote that flag. The original normalizer also drops flowOnly and rewrites
  legacy side semantics; raw envelope is intentionally preserved for explicit
  worker validation. Next connect scoped Chart consumer/worker source adapter,
  real source verification and render/alerts/browser QA.

## 2026-09-07 — Auction Gap settings and chart-owned primitive

- Added normalized settings/defaults and bounded numeric definitions; wired
  only Auction Gap into existing Inputs/Style/Alerts dialog and theme colour map.
  Generic sliders, colour toggles and existing templates/save plumbing reused.
  Gate remains OFF; do not imply the user can add it yet.
- Added logical-index/tick-cell plot models and own two-layer chart primitive:
  zones behind candles, markers above, projection every draw, no DOM/timer.
  Marker diamond, low-on-rising/high-on-falling convention and full-opacity
  defaults are explicit KwantDesk presentation choices, not native visual proof.
- Auction Gap suite: 80 tests pass including final SSR settings test. Full tsc
  and scoped lint pass. Real template suite 18/18.
  Broader plot-colour slot verifier fails on 11 pre-existing slot expectations
  (SAR/LR/SuperTrend/Difference/T3/KST), identically reproduced in detached
  293d23df release checkout. No changes made to those working studies/tests.
- Next actual Chart source/coverage adapter, worker scheduling, primitive attach/
  update/detach and source-timed alerts; browser bundle/render/full-depth QA still
  needed. New files isolated except narrow config/dialog wiring. No production
  push; still 28 Pending. Do not hide source failures as empty success.

## 2026-09-07 — Auction Gap event-bar incremental worker path

- Event allocation now returns validated unchanged-builder continuation; append
  allocation processes only prior tail + new prints, recovers global ownership,
  compares the complete affected candle span, rejects duplicate/older prints.
- Prepared study exposes executions/ownership/checkpoint. StudySession retains
  last-bar prints plus committed identity set, processes event deltas through
  exact allocation, raw rows/reset segments and incremental zones. Event worker
  operation/client exposed. Busy client rejects event deltas (caller retains or
  reseeds), never silently coalesces them like time-bar snapshots.
- 74 tests, full tsc and scoped lint pass. Seven event families compare real
  nonempty zones with complete reconstruction repeatedly; bridges/same-ms
  ownership, duplicate retry and identity-capacity failures covered. Identity
  retention defaults to explicit 1m cap; no silent eviction. Browser/source
  performance at real depth remains unproved, not a production-size guarantee.
- Still 28 Pending. Next actual Chart source/coverage adapter, settings/render/
  template/alerts and browser/bundled-worker/live QA. No gate/deployment yet.
  Historical corrections reseed; event deltas must include every intervening
  print and expected geometry from the previous last bar onward, with stable
  global IDs and explicit empty-bridge source/reset metadata.

## 2026-09-07 — Auction Gap worker history-to-live state

- Extracted validated `prepareAuctionGapStudy` stages; batch calculator retained.
  `AuctionGapStudySession` seeds incremental lifecycle from complete validated
  history, then accepts complete current time-bar snapshots (not tick deltas).
- Actual worker owns session state across messages. Client exposes time-tail
  requests. Changed scope/configuration, rewind, skipped bars or unfinalized
  prior bar require rebuild. Failed replacement history invalidates old seed.
  Tail OHLC/volume/source validation remains mandatory; no timestamp event proxy.
- 68 tests, scoped lint and full tsc pass. Actual separate-thread test now sends
  history then a corrected tail through the real entry; eight worker tests pass
  after that extension. No browser bundling/live-source/full-FPS claim.
- Still 28 Pending. Next exact incremental event-source allocation (or explicit
  history reconstruction path), actual Chart source/coverage adapter and controls/
  render/template/alert/browser QA. Current time-tail protocol requires finalizing
  old bar before advancing; skipped/coalesced closing updates must request history.
  Snapshot creation copies zones; don't call at execution cadence from UI.
  No production push for isolated foundation.

## 2026-09-07 — Auction Gap incremental zone lifecycle

- `AuctionGapLiveLifecycle` now replaces all reset segments of the forming
  chart bar from an active-zone checkpoint, without revisiting historical rows.
  Reuses the batch lifecycle transition. Retests/provisional gaps roll back;
  historical corrections or skipped chart bars explicitly require rebuild.
- Full validation precedes mutation. Retained segment/zone capacity is explicit
  (250k default), not silent eviction. Snapshot copies are separate from updates.
  64 combined tests, scoped lint and full tsc pass before final skipped-bar guard;
  seven incremental tests rerun after that guard. No existing indicator changed.
- Source integration check: Chart receives `marketTrades` plus a version, but
  no execution coverage envelope. Its indicator tape is timestamp-sliced;
  Footprint tape is viewport-limited and settings-dependent. Neither alone proves
  Auction Gap source ownership/completeness. Use the strict source/study pipeline
  and explicit provenance; do not flip its gate against display-filtered rows.
- Still 28 Pending. Next connect worker history state and validated live-tail
  processing, then actual chart source/settings/render/template/alert QA. Source
  validation/event ownership is not yet incremental; do not claim per-tick speed
  for the whole indicator. No production push for this isolated groundwork.

## 2026-09-07 — Auction Gap bounded history worker

- Added `auctionGap.worker.ts` and lazy `AuctionGapWorkerClient`: one active
  calculation plus one newest queued snapshot, scope-change cancellation,
  exact revision/worker identity checks, disposal and explicit failure states.
  No timers, new feed requests or main-thread calculation fallback.
- 57 Auction Gap tests pass, including real separate-thread entry execution
  with structured-cloned trades, callback reentrancy and clone failure/retry.
  Scoped source lint and full project tsc pass. Node thread test does not prove
  browser bundling or live performance; actual browser verification remains.
- Still 28 Pending; this is isolated groundwork, not a released indicator.
  Next: incremental forming-bar state, actual authoritative Chart source hookup,
  settings/render/template/alert integration and browser/build QA. Do not send
  a whole history snapshot on each tick. No production push for this foundation.

## 2026-09-07 — Auction Gap full pure calculation path

- `auctionGapStudy.ts` now joins source/clock/ownership/rows/lifecycle. Explicit
  unavailable reasons, candle/geometry validation and time-chart raw OHLC+volume
  reconciliation. Event-chart geometry follows unchanged event builder.
- Four end-to-end tests and full tsc pass. Combined 48 passed before extra OHLC
  rejection test. No production release: 28 Pending. Next worker/history and
  incremental live scheduling, then real Chart/settings/render/browser QA.

## 2026-09-07 — Auction Gap rows connected to lifecycle in tests

- `auctionGapRows.ts` materializes raw and filtered maps, preserves trade prices,
  splits reset subsegments, validates ownership and explicit empty-bar provenance.
- Lifecycle accepts detectionBar/chartIndex; subsegments no longer count as
  extra bars. Source/detector use minimal Footprint-compatible raw-bar shape.
- Actual filtered-detection/raw-retest integration test passes. Final row tests
  and project tsc pass. Still disconnected from live Chart/settings/renderer;
  all 28 remain Pending. Next worker/incremental pipeline and controls/visual QA.

## 2026-09-07 — Auction Gap time allocation foundation

- Added explicit half-open time-bar allocation with per-bar volume reconciliation;
  real session gaps, same-ms execution IDs and empty zero-volume bars preserved.
- 39 combined tests, scoped lint and full tsc pass (also covers latest event
  allocation tightening). No runtime integration/gate/deployment yet, 28 Pending.
- Next join prepared executions + time/event ownership into independent raw
  detection/retest rows and reset subsegments; then worker/live/settings/render.
  Expected intervals/volumes require authoritative source provenance, not guesses.

## 2026-09-07 — Auction Gap exact event allocation foundation

- New `auctionGapEventAllocation.ts` uses unchanged chart builder tail replay,
  recovers per-print bar index from volume increments and compares full seed
  expected timestamps/OHLC/volume. No timestamp guessing or bridge duplication.
- 34 tests pass across detector/lifecycle/clock/source/allocation; lint/tsc pass
  before final validation tightening, five allocation tests rerun after it.
- Retains tradeCount in validated executions. Event family tests include v/t/dv,
  range, Renko, PF and VB. No working source file changed except our new adapter.
- Still 28 Pending. Next actual rows/time allocation/reset subsegments. Beware
  synthetic bridge boundary versus real execution price; don't relocate prints.
  Existing builder rejects nonpositive price; adapter explicitly fails there.

## 2026-09-07 — Auction Gap source validation foundation

- `auctionGapExecutions.ts` validates provider execution response contract/
  coverage, exact ticks and volumes, record identity, replay cutoff and clock
  classification. Rejects aggregates and conflicting duplicates; preserves
  unknown-side volume. 29 tests, scoped lint and full tsc pass.
- Still not connected/enabled; 28 Pending. Next exact bar allocation is needed:
  existing Footprint builder maps timestamps and inherits display filters.
  Cannot silently use that for same-ms event bars or time-filter boundaries.
- Notes in auction audit. No production push for disconnected foundation;
  retain batching policy and preserve unrelated native/social work.

## 2026-09-06 — Auction Gap exchange-time policy foundation

- `auctionGapSessionClock.ts` requires explicit instrument timezone/calendar,
  classifies individual executions, supplies detection inclusion/reset keys,
  handles overnight windows and DST civil dates with bounded minute cache.
- 23 combined tests, scoped lint and full tsc pass. No UI/data connection or
  release yet; still 28 Pending. Caller must filter before aggregation, retain
  raw retest rows, handle bars crossing reset boundaries and replay cutoffs.
- Next: source adapter and incremental/worker lifecycle, then full settings,
  native reference semantics, renderer/theme/template/browser release checks.

## 2026-09-06 — Auction Gap lifecycle foundation

- Added `auctionGapLifecycle.ts` with actual-bar extensions, caller-provided
  exchange reset keys, actual-print retests, correction rebuilds and honest
  mixed/invalid/unavailable rejection. Native TriggerOnlyTouch mapping unproved;
  internal touch/cross and visibility conventions explicitly documented.
- 17 tests, scoped lint and full tsc pass. Single 20k-bar/1m-row rebuild 127.1ms:
  do not wire full rebuild on each UI tick. Worker history + incremental live,
  stable cancellation, full settings/render/session adapter still needed.
- No gate enabled/deployment: 28 Pending. Preserve working studies and keep
  exact raw one-tick dataset independent of Footprint display filters/grouping.

## 2026-09-06 — Auction Gap detector foundation (still Pending)

- `auctionGapTracker.ts`: raw unfiltered one-tick volume detector, inclusive
  thresholds, six DLL-evidenced location modes, honest unavailable/invalid
  states, no fabricated zeros from missing/unknown rows, provisional live runs.
- Nine tests and scoped lint pass; project tsc passed before final location-mode
  addition (rerun before release). Not wired/registered; all 28 remain Pending.
- Audit `docs/deepcharts-auction-gap-tracker-audit.md` includes actual official
  screenshots/defaults, ConfigurableWatcher enums and remaining full contract.
  Next lifecycle/session filters/renderer/settings/shared raw tape integration.
- Sprint DLL candidate and unknown formula recorded separately. Working studies
  untouched. Do not alias pending order-flow rows to existing studies.

## 2026-09-06 — ordinary tape enum evidence, no new release

- Added read-only `scripts/dotnet-contracts.py`: scalar getter signatures and
  actual enum constants; nine synthetic tests pass. Never executes vendor DLL.
- Ordinary candidate ReadableMatcherMapper: input Volume/Order; display
  Total/Counter; filter Automatic/None. Installed DLL version 16.0.9/hash in
  `docs/deepcharts-speed-of-tape-pending-audit.md`. Article differs from enum;
  Counter, order semantics and automatic baseline still unproved. Keep Pending.
- Instant candidate has similar input/display enums. Corrected overconfident
  reference claims in its audit, without modifying the working indicator.
- No new runtime changes, requests, deployment or feed login. Still 28 Pending.
  Continue evidence and engineering across the full remaining ledger; a single
  study's protected semantics are not proof the whole goal is blocked.

## 2026-09-06 — Super Trend pair release verified locally

Production follow-up: GitHub deployment status succeeded for `websiterepo-yfmi`
and live diagnostics returned exact SHA `18a17c4d5ba23233ae678c4a75e324f596f0927b`.
Deployment: https://vercel.com/kwant-desk/websiterepo-yfmi/FAzNsNGjgXbWMaceh4Ts5e84WjHo
Release is live. Follow-up documentation is held for the next batch push to
avoid another documentation-only production build. Ordinary Speed of Tape
reference screenshot defaults now recorded; native `sky.list_windows()` found
no DeepCharts window. Do not launch a possible second feed login to inspect it.

- Supersedes the older gated-status entries below. Both studies are now
  implemented and registered: 100 registered / 28 Pending / zero orphan gates.
- Isolated committed release tree at `293d23df` passed the normal Turbopack
  production build (TypeScript and 80 pages), 90 combined regression tests and
  18 template checks. No unrelated dirty native/social/gateway files included.
- Both studies use the existing 20,000-bar history path; live updates preserve
  that history. Browser synthetic live updates, settings/save/reload/export,
  pane placement and retained auto-centre-off scales were checked.
- One main-only Git release follows this note. Exact production SHA must be
  verified before reporting live. No native pixel/protected formula parity or
  market-open soak claim. Continue the 28-row pending ledger, not the old list.

## 2026-09-06 — Super Trend live plotting wired, release QA remains

- Incremental callback now drives both studies with alerts off as well. Shared
  point painter preserves previous-CANDLE slope colour, and series keys now
  include instance IDs. Native overlay updates direct; Difference uses pane-
  local frame-coalesced updates instead of the main Chart calculation tree.
- Bounded `SuperTrendPlotBuffer` and history/replay/style isolation implemented;
  22 Super Trend tests and scoped lint pass. Not a live-FPS/visual-parity claim.
- Both gates remain off: 30 Pending. Next actual reference/browser/audio/
  settings/template QA and full build, then batch local commits into one main
  push. Detailed sources/status in `docs/deepcharts-super-trend-audit.md`.

## 2026-09-06 — Super Trend incremental calculator and actual alerts

- Shared `advance` recurrence now powers batch and O(1) live forming-bar
  replacement/append; 19 Super Trend tests pass, scoped lint/TypeScript pass.
- Four existing candle publishers carry real provider `sourceTimestampMs`;
  no new feed or cadence change. Actual alert hook wired to Chart, freshness,
  replay/closed-market gates, popup and lazy audio (generic event had no listener).
- Still 30 Pending: browser/autoplay/reference screenshot checks, template
  roundtrip, live PLOT cadence (alerts alone now incremental), orientation and
  full build/release remain. See `docs/deepcharts-super-trend-audit.md`.

## 2026-09-06 — Super Trend labels and alert-source investigation

- New overlay-only `SuperTrendLabels` primitive is attached to the study's own
  series (secondary-axis safe), updates with colours, labels latest visible
  point, independent backgrounds and marker background. Native value badge
  disabled for this study; auto-centre true resets previous false override.
- 14 Super Trend tests, scoped lint and TypeScript pass. Still gated, 30 Pending.
- Alert integration cannot rely on candle-open or render time. Candle event
  lacks provider time; execution event exists only with footprint/instant tape.
  Four workspace candle publishers have source times available. Next: carry
  real source time, then bounded forming-candle update/alert dispatch, official
  screenshot/browser verification, full build and batch main push.

## 2026-09-06 — Super Trend integration in progress

- Both IDs now have real engine outputs and scalar settings/style UI/colour
  slots, but LIVE/RENDERED gates remain OFF (30 Pending). Name/background/
  marker controls still need rendering, alerts still need Chart dispatch.
- `SuperTrendAlertTracker` tests baseline suppression, dedup, stale/live gates
  and scope resets. Must wire real source trade time, not render/bar-open time.
- Difference histogram width needed optional `histogramBarWidth` support in
  both pane orientations; legacy candle widths unchanged. 19 combined tests
  pass, detailed in `docs/deepcharts-super-trend-audit.md`.
- Next: finish label/alert/orientation integration, browser settings/Save and
  full build before enabling and batching the pending main push.

## 2026-09-06 — Super Trend prerequisite, not released

- Shared `superTrend.ts` calculator implements explicit Wilder ATR seed,
  trailing bands, trend flips and price-minus-trend. Six independent/hand
  tests pass; 26 combined Super Trend/KST/T3/SAR tests and scoped lint pass.
- Official docs and DLL setting shapes audited, protected numerical seed
  unproved. Both entries remain Pending (30 total); no engine/gate changed.
- Next: actual UI/plots, labels/scale and deduplicated live-only alerts,
  persistence/browser/performance/build before enabling. Follow
  `docs/deepcharts-super-trend-audit.md`; batch push with complete integration.

## 2026-09-06 — KST integration batch

- KST now routes through real scalar settings, engine, dockable pane and deep
  history. New KST-only SVG painter covers line/points, slope colours, middle
  line, per-plot labels/backgrounds and auto-centre; old studies keep old paths.
- 52 combined tests and scoped lint pass. Browser verified settings changing
  geometry, points, name/value labels, Save/close/reload. Production build and
  deployment verification tracked in `docs/deepcharts-kst-audit.md`.
- 30 pending remain. Vendor seeds/pixel parity, authenticated cloud-template
  roundtrip and representative multi-pane live-market soak remain unproved.

## 2026-09-06 — KST prerequisite, not yet released

- `knowSureThing.ts` implements four weighted/smoothed ROC horizons and signal;
  six independent calculation tests pass. Actual DLL AvgType enum is Simple,
  Exponential, Triangular, Weighted; all four implemented (not Wilder).
- Official screenshots observed raw mode, averages 10/10/10/15, ROC
  10/15/20/30, signal 9. Protected seeds/signal-mode parity remain unproved.
- `docs/deepcharts-kst-audit.md` records complete evidence and remaining UI,
  pane styles/labels, deep-history, persistence and browser/performance work.
  Max configured signal warmup is 2999 bars: lite 1500 is insufficient.
- Scoped lint and TypeScript pass. No engine/gate enabled: 31 still pending.
  This prerequisite is not a release; batch its push with verified integration.

## 2026-09-06 — Tillson T3 pending-library batch

- Six EMA stages with explicit full-window SMA seeding; defaults 14 / 0.618 /
  Close, slope colours, all source/style controls and persisted short name in
  the active list. No recovery claim for protected DLL seed or visual parity.
- O(n) fixed rolling state; added only T3 to the existing 20k deep-history set
  because length 1000 needs 5995 valid bars. Volume source has separate scale
  and cash-index guard; factor is NOT executed-volume weighting.
- Seven T3 tests / 37 combined pass. Browser verified controls, geometry,
  colours, Save/close/reload and short name. `docs/deepcharts-tillson-t3-audit.md`.
- 31 pending remain. No full-library completion, cloud-template roundtrip or
  live-market soak claim. Continue the actual remaining checklist.

## 2026-09-06 — Linear Regression pending-library batch

- Rolling OLS endpoint, length 21 default, all OHLC/Volume sources, themes,
  direction colouring and styles. Real cash-index volume is unavailable, not
  substituted; volume uses an independent scale. No new feed/timers.
- Measured 20k-bar calculator p95 1.51ms at length 21. Added ONLY this new study
  to the existing deep-history set so a 10k length does not get 1.5k candles.
- Seven tests / 30 combined pass; browser verified length/source/Save/reload
  and Volume independent scale. `docs/deepcharts-linear-regression-audit.md`
  records endpoint conventions and reference/performance limitations.
- 32 pending remain. Regression Channel's Zig Zag modes are not this study;
  profiles and the rest of the checklist still need individual implementation.

## 2026-09-06 — Parabolic SAR pending-library batch

- Real high/low stop/reversal calculator, explicit seed and acceleration cap,
  points/line modes, directional/theme/custom colours, instance-specific scale.
  New point-rendering options are opt-in; existing overlays are unchanged.
- Seven SAR tests, 23 combined tests, scoped ESLint and production build pass.
  Real isolated browser verified dots/line, acceleration changes, clean Save,
  close and reload persistence. See `docs/deepcharts-parabolic-sar-audit.md`.
- 33 pending remain. No exact protected-DLL seed/parity or live-market-soak
  claim. Continue the full checklist; profiles still need actual integration.

## 2026-09-06 — ADX and owned-profile validation

- ADX now uses its own Wilder calculator, explicit 2N−1 warmup, three-line pane,
  period/style/width/colour controls, +DI/−DI visibility and existing templates.
  Actual settings/pane browser-tested with labelled synthetic input. Seed
  convention and vendor-parity limits: `docs/deepcharts-adx-audit.md`.
- Pending count is 34, not zero. Profile variants are still unfinished.
  `ownedVolumeProfiles.ts` adds source/window/settings/totals validation,
  cache/exact loading with invalidation and a clock-bounded live-fold helper.
  Seven fixture tests pass; it is not yet wired into the workspace.
- Monthly filtered history cannot be a single unfiltered gateway request.
  Current gateway lacks multi-session filter handling, and the proxy only
  narrows single-span requests. New owned loader refuses such flags until
  disjoint-window aggregation is implemented. No existing profile changed.

## 2026-09-06 — Pending profile-family prerequisite (not released)

- `profileVariantJobs.ts` plans bounded monthly/visible execution windows and
  owned, bounded-concurrency jobs with stale-result invalidation. Event slices
  sharing a source execution across viewport boundaries are refused until an
  allocation-aware data path is wired; never substitute timestamp-only totals.
- `volumeProfileOwnership.ts` and Chart renderer accept optional ownerInstanceId
  for new variants; legacy unowned profiles keep exact existing routing/IDs.
- Eleven tests cover calendar/DST/replay, source-time bounds, ambiguous slices,
  settings ownership and concurrency. Workspace/live/settings/cache integration
  is still unfinished; NO pending gate enabled. Continue from
  `docs/pending-profile-variants-audit.md`, do not call these profiles complete.

## 2026-09-06 — Absolute Levels, pending-library batch 2

- Added the actual two-price manual study with independent colour/style/width.
  Uses one real timestamp per level; horizontal price-line flags are opt-in
  and levels are excluded from candle autoscaling. Existing plots unchanged.
- Eight public settings confirmed in installed DLL metadata; official docs
  establish the manual-level contract. Defaults are KwantDesk choices, not
  claimed DLL defaults. See `docs/deepcharts-absolute-levels-audit.md`.
- Five calculator/renderer/persistence tests plus three registration tests;
  build passed. Isolated browser QA verified prices, full-width rendering,
  immediate saved status, clean close and fixture-local reload persistence.
- 35 rows remain. No blanket enablement, vendor call or paid infrastructure
  change. DeepCharts offline/replay side-by-side comparison remains open.

## 2026-09-06 — Pending library reopened: earlier inventory was incomplete

- Actual catalogue audit found 38 blocked entries, not zero. The earlier
  21-row overhaul covered only a subset; do not repeat its whole-library
  completion claim. Complete inventory and ongoing checklist:
  `docs/pending-indicator-library-2026-09-06.md`.
- Big Contracts and Liquidity Sweep had display-derived IDs disconnected
  from their already implemented engines/settings/renderers. Corrected their
  catalogue IDs and migrated saved aliases/favourites, without altering
  working calculations. 36 genuinely blocked rows remain for individual work.
- Run `node --import ./scripts/alias-hook.mjs scripts/audit-indicator-library.mjs`
  and the registration regression before every indicator release. Registered
  is not proof of formula/pixel/live-session parity.

## 2026-09-06 — Finer minimum volume-profile width

- Shared final-pixel scaling makes width 1 one-quarter of its former size,
  2 half, 3 three-quarters; 4+ and default widths unchanged. Applied after
  minimum-pixel floors across native and both draw-on VP renderers. Current
  and previous profiles use their own setting; level geometry shares the
  resulting width. Draw-on sliders now reach 1 in single-unit steps.
- Prompt, tests and visual-verification limit:
  `docs/prompt-log/2026-09-06-volume-profile-fine-width.md`.

## 2026-09-06 — Theme and chart palette stay together

- Shared saveTheme/resetTheme now commit chart colours and Charts/GEX VUE
  runtime palettes before the CSS theme event. The settings page passes exact
  chart overrides through that shared commit rather than owning a separate
  canvas-notification path. Named presets and custom indicator colours remain
  separate; candle border colours also survive chart-to-theme conversion.
- Preference hydration previously retained a local/chosen-during-load theme
  but could restore cloud chart colours alongside it. It now retains matching
  local palette/ownership fields in all three runtime chart-settings keys;
  non-colour preferences and existing account ownership selection are retained.
- Prompt, executable race tests and verification: `docs/prompt-log/2026-09-06-theme-chart-live-sync.md`.

## 2026-09-06 — VWAP collapse/flashing after close

- Removed the workspace candle timestamp normaliser's old-to-now fallback.
  Provider observations retain their real time; invalid/excessively future
  timestamps are rejected at chart merge/snapshot boundaries.
- Period VWAP, VWAP envelopes and rolling VWAP no longer emit unweighted
  quote-only points. Closed-session endpoints/bands remain unchanged when
  empty tails appear/disappear during hydration. Rolling bar-window counting
  is retained and actual reopening volume resumes the normal calculation.
- Prompt/tests/limits: `docs/prompt-log/2026-09-06-vwap-closed-market.md`.
  This completes the timestamp-path correction left separate by the countdown
  fix. No historical stored records were deleted or rewritten.

## 2026-09-06 — Candle countdown while closed

- Countdown no longer invents a new deadline from wall time after the actual
  candle expires. Inactive/unknown activity displays a dash and runs no badge
  interval; a genuinely active current candle resumes the countdown.
- Workspace activity uses unmodified provider observation timestamps. Old
  snapshots cannot reset activity just because they were received again;
  source time bypasses the existing candle-merging timestamp clamp.
- Prompt/tests/limits: `docs/prompt-log/2026-09-06-closed-market-countdown.md`.
  This is freshness gating, not a holiday-calendar implementation.

## 2026-09-06 — Closed-market indicator redraw loop

- Removed sampled candle output from the shared sampling effect dependencies;
  replay comparisons now read a committed snapshot ref. An imperative live tail
  ahead of candle props no longer re-arms sampling indefinitely with no trades.
- Big Contracts' lookback advances with execution time, not the wall clock or
  a six-hour closed-market switch. Unchanged tape retains identical markers.
- Direct live execution listeners and sampling intervals are unchanged.
- Tests, limits and owner prompt: `docs/prompt-log/2026-09-06-idle-indicator-flashing.md`.
  No signed-in visual reproduction was possible (browser had no open tabs).

## 2026-09-06 — Chart emoji catalogue and deployment confirmation

- Chart emoji flyout now lazy-loads all 3,979 Emojibase 17 entries, including
  skin-tone variants, with categories, keyword search and bounded 120-entry
  scrollable pages. Placement/persistence/zoom geometry is unchanged.
- Prompt and verification: `docs/prompt-log/2026-09-06-chart-emoji-catalogue.md`.
- Owner confirmed the duplicate Vercel Git integration is disconnected when
  asked explicitly to resume production pushes. The obsolete AGENTS.md hold
  has been lifted; keep only the existing live main-only Git deployment path.

> Read this entire file before changing the repository. This is the operating memory for a temporary engineer working on KwantDesk. It describes the product, architecture, working rules, data ownership, quality bar, verification process, and current state as of **2026-08-18**.

## 1. Your role

You are acting as the second engineer on KwantDesk for a short handoff period. Work directly in this repository, preserve the existing product, diagnose the real cause of bugs, implement complete fixes, test them, and commit scoped work locally.

> **Deployment restored — 2026-08-26.** The duplicate Vercel project is
> disconnected and the hold is lifted. `kwantdesk/websiterepo` is connected to
> **`websiterepo-yfmi` only** (the live project serving `www.kwantdesk.com`);
> the stale `websiterepo` project still exists but has no Git connection and
> must not be reconnected — that is what made every push build twice. Pushing
> `main` deploys, once. Verified: `e6d54422` built Ready in 1m40s as a single
> production deployment.
>
> **Cost.** The August infrastructure invoice was $224.76, dominated by Build
> CPU ($80.91, doubled by that second project) and Fast Origin Transfer
> ($48.68, from `no-store` market-data routes re-sending multi-MB surfaces per
> pane). Both are addressed in code — `vercel.json` carries an `ignoreCommand`
> that skips builds for commits touching only scripts/docs/tests, and the heavy
> routes revalidate via `src/lib/conditionalJson.ts`. Keep new market-data
> routes on that helper rather than `no-store`, and keep them `private`: they
> sit behind a session check and must never enter a shared cache.

Do not behave like a prototype generator. This is a live private market-analysis product used during real sessions. A visually plausible fake, delayed data presented as live, a fallback silently replacing authoritative data, or a patch that merely hides an error is a product failure.

The owner speaks quickly and often describes the desired behavior rather than file names. Translate the request into the smallest correct engineering change, inspect the existing implementation, and preserve everything outside that scope.

## 2. Product identity

KwantDesk is a private browser-native market intelligence, charting, order-flow, options/gamma, planning, journaling, social, and simulated-trading workspace. It is not simply a broker terminal and should not be described as one. Its value is the combined decision-support environment:

- live and historical futures charting;
- Rithmic order flow, depth, executions, footprint, profiles, and liquidity map;
- QuantData options exposure and gamma analytics;
- Databento historical CME data and server-side research inputs;
- Massive cash-index and VIX quotes through the VPS;
- GEX VUE, GEX Map, GEX Cal, GEX Flow, Gamma, Levels, and GEX BOX;
- Zyon market context and game-plan assistance;
- game plans, scoring, journals, social feeds, desks, messages, accounts, and paper trading;
- independent multi-panel workspaces with chart-local state.

The visual direction is a compact professional trading cockpit: thin square-edged controls, restrained typography, theme-aware colors, high information density, stable geometry, and no amateur fallback drawings. The landing page is separate and must not be redesigned unless explicitly requested.

## 3. Repository and deployment facts

- Repository: `C:\Users\Karen\Documents\QUANT DESK\kwantdesk-websiterepo`
- Remote: `https://github.com/kwantdesk/websiterepo.git`
- Production branch: `main`
- Frontend: Next.js 16 App Router, React 19, TypeScript
- Charting: `lightweight-charts` 5.x plus custom Canvas/primitive layers
- Persistence/auth/social data: Supabase
- Production hosting: Vercel, normally deployed by pushing `main`
- Always-on market-data service: `services/rithmic_gateway` on the VPS
- Separate native gamma service: `services/databento_gateway`
- User-owned/untracked directory: `ALGO/`

### Production deployment and cost policy

The owner wants the production website to remain live. Automatic production pushes are temporarily suspended because the repository is connected to two Vercel projects.

- Only the `main` branch may trigger a Vercel deployment. Preserve this exact intent in `vercel.json`:

  ```json
  "git": {
    "deploymentEnabled": {
      "*": false,
      "main": true
    }
  }
  ```

- Never change this to global `deploymentEnabled: true`, re-enable preview/branch deployments, or add another automatic deployment path unless the owner explicitly approves it.
- Work and verify locally. When a task is complete, stage only the scoped files, make one clean local commit, and push it — that push is the production deploy.
- Do not take the existing production site offline. The correct account-level repair is to disconnect only the stale `websiterepo` project from this Git repository while retaining `websiterepo-yfmi`.
- Continuous live market data, per-tick vendor traffic, replay generation, and long-running stream fan-out belong on the VPS gateway. Do not proxy or poll them continuously through Vercel functions.
- Main-only deployments reduce build churn; they do not make a live Vercel application free. Runtime, transfer, function, Fluid, and observability usage must still be designed and monitored deliberately.

### Never touch `ALGO/`

`ALGO/` is intentionally untracked and belongs to the owner. Do not stage it, delete it, move it, format it, or include it in commits unless the owner explicitly asks for work inside it.

### Current clean baseline

At handoff creation, the tracked worktree was clean and only `ALGO/` was untracked. The latest known commits were:

```text
cb07189d Add real candles to Classic replay
6d693311 Wire Classic candles to Rithmic executions
07d87660 Rebuild GEX BOX Classic session chart
cf23ae4f Migrate GEX BOX charts to Lightweight Charts
9461a900 Keep GEX VUE replay control visible
902b54ba Add synchronized GEX Vue session replay
0e3a3156 Project dark pool levels onto futures
76e5362e Center newly linked chart viewports
551c7488 Smooth linked chart crosshair rendering
7048cd6c Fix linked chart viewport synchronization
65df5341 Fix zero gamma line and options gamma environment
a99d30af Load SPXW GEX from the SPX provider surface
836f5686 Keep Rithmic charts live through reconnects
c958cb20 Enforce VPS-only market data routing
b223d343 Centralize index consumers on VPS
fb01ab02 Route Massive cash indices through VPS
d0401a3b Centralize live options underlyings on VPS
86045b6a Eliminate options quote feed stalls
64c9c1b4 Fix live options chart quote pipeline
```

Run `git status --short` and `git log -15 --oneline` at the start of every task. The owner or Codex may have returned and changed the baseline after this file was written.

## 4. Absolute engineering rules

1. **Diagnose before editing.** Trace the visible symptom to the data source, normalization, state boundary, subscription lifecycle, or renderer. Do not add another retry, timeout, fallback, error boundary, or loading message until the root cause is understood.
2. **Never fake market data.** No random data, illustrative values, synthetic candles presented as real, interpolated L3 gaps, or invented gamma history.
3. **Never expose credentials to the browser.** Provider keys, Rithmic credentials, and the gateway bearer token are server/VPS-only. They must never use `NEXT_PUBLIC_*`, appear in client code, logs, screenshots, commits, or chat replies.
4. **The browser does not connect directly to vendors.** Rithmic, Databento, QuantData, and Massive are centralized at the VPS/backend boundary. Do not create a second vendor session in a React component or Vercel function.
5. **One live source, many consumers.** Reuse shared streams and normalized caches. Four charts must not create four independent upstream connections or four expensive transforms.
6. **No silent authority downgrade.** If authoritative order-flow/profile data is absent, show an honest unavailable/loading state. Never fall back to the old `APPROX · OHLCV` profile or represent bar-volume inference as true bid/ask execution data.
7. **Every chart panel is independent unless explicitly linked.** Symbol, timeframe, indicators, drawings, settings, viewport, and lock state belong to that panel. Adding or removing an indicator on one chart must never mutate another chart.
8. **Linked charts are peer-to-peer.** In GEX VUE link mode, any linked chart can lead. Synchronize visible time range, relative/converted price range, centering, and crosshair without feedback loops.
9. **Screen-space UI stays fixed; price-space data stays anchored.** Toolbars, DOM shells, time axes, settings chrome, labels, and price scales must not wobble with chart panning. Levels, fills, bubbles, TPOs, and profiles must be anchored to actual time/price coordinates rather than pixel guesses.
10. **Do not change unrelated UI.** Preserve the owner’s current navigation order, dimensions, theme, workspaces, and behavior unless the request includes them.
11. **No broad repository cleanup during a focused task.** This codebase is large. Keep diffs scoped and reversible.
12. **Do not erase user work.** Never use `git reset --hard`, destructive checkout, broad deletion, or overwrite a dirty file without reviewing its diff.
13. **No “fixed” claim without verification.** State exactly what was tested. Production/live RTH verification is different from a local build.
14. **Completed work is committed and pushed.** The owner has explicitly asked that finished tasks be deployed. A task is not complete while the code only exists locally.

## 5. Market-data architecture

### Production flow

```text
Rithmic R|Protocol ─┐
Databento ──────────┤
QuantData ──────────┼─> always-on VPS gateway ─> authenticated Next.js API ─> browser shared streams
Massive indices ────┘

Supabase ─> auth, preferences, social/journal/drawing persistence
Anthropic ─> server-side Zyon/KwantBot requests enriched with KwantDesk context
```

The central rule is: **vendor credential and persistent connection at the VPS; normalized provider-neutral data at the website; shared bounded subscription in the browser.**

### Source responsibilities

| Source | Authoritative responsibility | Important limitation |
|---|---|---|
| Rithmic | Live CME futures trades, BBO, order book, MBO/L3 where entitled, execution-driven footprint/CVD/profiles/liquidity | One credential must not be logged in by competing gateway processes; historical full L3 cannot be reconstructed if it was not recorded |
| Databento | Historical CME bars/trades/definitions/statistics and native gamma inputs | Do not open per-browser streams; historical responses must be bounded and cached |
| QuantData | Options positioning, GEX/DEX/Vanna/Charm, gamma surfaces and related snapshots | Preserve real raw exposure values; respect quota and central request spacing/cache |
| Massive | Cash indices and VIX/underlying quote stream | Central VPS WebSocket only; do not pretend cash-index quotes came from Rithmic |
| Supabase | User/account/application persistence | Schema changes require an explicit migration; never assume a table exists in production |

### Gateway configuration

The website-side source of truth is `src/lib/marketDataGatewayEnv.ts`. Preferred server-only environment names are:

```text
KWANTDESK_MARKET_DATA_GATEWAY_URL
KWANTDESK_MARKET_DATA_GATEWAY_TOKEN
KWANTDESK_MARKET_DATA_PROVIDER
```

Legacy `KWANTIFY_*` aliases are accepted because old deployment variables still exist. Do not add a new spelling. On Vercel, loopback URLs are rejected and dead Tailscale origins are deprioritized behind the public collector.

The VPS owns provider secrets in its operator environment:

```text
DATABENTO_API_KEY
QUANTDATA_API_KEY
MASSIVE_API_KEY
RITHMIC_USER
RITHMIC_PASSWORD
KWANTIFY_MARKET_DATA_GATEWAY_TOKEN
```

Never copy actual values into this file or Git.

### Critical gateway files

- `services/rithmic_gateway/src/server.mjs` — HTTP/SSE gateway and route composition.
- `services/rithmic_gateway/src/rithmic-client.mjs` — R|Protocol connection and subscriptions.
- `services/rithmic_gateway/src/protocol.mjs` — protocol normalization.
- `services/rithmic_gateway/src/book-store.mjs` — live order-book state.
- `services/rithmic_gateway/src/recorder.mjs` — raw session recording and explicit gap records.
- `services/rithmic_gateway/src/archive-replay.mjs` — replay access.
- `services/rithmic_gateway/src/vendor-data-edge.mjs` — provider allowlist/proxy/cache boundary.
- `services/rithmic_gateway/src/databento-equities-stream.mjs` — Databento equity/index-related stream support.
- `services/rithmic_gateway/src/quantdata-market-snapshot-stream.mjs` — shared QuantData snapshot stream.
- `services/rithmic_gateway/src/massive-indices-stream.mjs` — shared Massive cash-index stream.
- `services/rithmic_gateway/deploy/DEPLOY.md` — VPS deployment and operational checks.
- `services/rithmic_gateway/deploy/ship-to-vm.ps1` — scoped VPS shipping helper.
- `src/lib/institutionalMarketData.server.ts` — server-side authenticated gateway client and last-good-origin selection.
- `src/app/api/institutional-market-data/[...path]/route.ts` — browser-facing provider-neutral proxy.
- `src/app/api/market-data/diagnostics/route.ts` — diagnostics surface.

### Live health is not an HTTP 200

For the VPS, `/health` is truly healthy only when:

- `connected === true`;
- `authenticated === true`;
- `lastMessageAt` advances between checks;
- expected instruments are present;
- provider configuration flags are true;
- recorder counts advance when the market is active.

`connected: true` with a frozen timestamp is a dead feed wearing a live label. Diagnose the upstream session and sequence/watchdog path rather than masking it in the UI.

### One Rithmic login rule

Do not run the laptop gateway and VPS gateway simultaneously with the same Rithmic credentials. Competing sessions can force-log each other out and look like random freezes. The production collector is the owner. The old RTrader Excel bridge is documented for historical context but is not the desired production architecture.

### Historical truth

The VPS recorder rotates on the CME trading-date boundary and writes normalized raw events plus explicit `GAP` records. Never interpolate an L3 gap. Historical time/volume bars may be fetched from Rithmic/Databento, but full historical depth-by-order only exists if the recorder captured it live.

## 6. Application map

### Shared shell and workspace engine

- `src/components/DashboardShell.tsx` — authenticated application shell and top-level navigation.
- `src/components/AppSidebar.tsx` — shared right-side rail.
- `src/components/WorkspaceHome.tsx` — home dashboard.
- `src/components/KwantifyWorkspace.tsx` — the main chart/workspace orchestrator. It is very large and high-risk. Read relevant regions before editing and avoid causing the entire workspace to rerender on every tick.
- `src/components/Chart.tsx` — core Lightweight Charts integration.
- `src/components/ChartIndicatorsControl.tsx` — chart indicator library/dropdown.
- `src/components/ChartIndicatorPanes.tsx` — attached lower/side panes.
- `src/components/DepthOfMarketPanel.tsx` — chart DOM panel.
- `src/components/ThemeProvider.tsx` — live theme application.
- `src/components/WorkspaceFailureBoundary.tsx` — last-resort isolation, not a substitute for fixing crashes.

### Primary application routes

| Product surface | Route source |
|---|---|
| Charts | `src/app/(workspace)/charts/page.tsx` |
| GEX VUE | `src/app/(workspace)/gamvue/page.tsx` |
| GEX Cal | `src/app/(workspace)/gex-cal/page.tsx` |
| GEX Flow | `src/app/(workspace)/gex-flow/page.tsx` |
| Gamma | `src/app/(workspace)/gamma/page.tsx` |
| GEX Map | `src/app/(workspace)/gexmap/page.tsx` |
| Liquidity Map | `src/app/(workspace)/liqmap/page.tsx` |
| GEX BOX | `src/app/(workspace)/gex-box/page.tsx` and `[surface]/page.tsx` |
| Levels | `src/app/(workspace)/levelz/page.tsx` |
| Gameplan | `src/app/(workspace)/gameplan/page.tsx` |
| Zyon | `src/app/(workspace)/zyon/page.tsx` |
| News | `src/app/(workspace)/news/page.tsx` |
| Socials | `src/app/(workspace)/socials/page.tsx` |
| Journal | `src/app/(workspace)/journal/page.tsx` |
| Backtesting | `src/app/(workspace)/backtesting/page.tsx` |
| Accounts | `src/app/accounts/page.tsx` |
| Settings | `src/app/settings/page.tsx` |

The `Charts` and `GEX VUE` workspaces are intentionally independent. They may reuse components, but must not mirror layouts, saved workspace IDs, indicators, or panel state. GEX VUE has its own default `GEX STANDARD` workspace behavior.

### Data and chart libraries

- `src/lib/rithmicIndicatorStream.ts` — shared live execution stream for chart indicators. Preserve bounded memory, batching, reconnect behavior, and reference-counted subscriptions.
- `src/lib/rithmicLiquidityStream.ts` — liquidity-map/order-book client stream.
- `src/lib/chartHistoryCache.ts`, `chartHistoryWindow.ts`, `workspaceDataCache.ts` — history and workspace caching.
- `src/lib/chartLiveEvents.ts`, `liveQuoteCache.ts`, `marketIndexLiveClient.ts` — live event/quote distribution.
- `src/lib/chartViewportSync.ts`, `chartCrosshairSync.ts`, `chartGammaConversion.ts` — linked-chart time, price, and crosshair behavior.
- `src/lib/chartIndicatorCatalog.ts`, `chartIndicatorConfig.ts`, `chartIndicatorEngine.ts`, `indicatorSourceAdapters.ts` — indicator registration/configuration/runtime boundaries.
- `src/lib/lightweightChartsCompat.ts` — compatibility layer for Lightweight Charts API differences.
- `src/chart/precision-tools/*` — current precision drawing engine, hit testing, rendering, persistence, and toolbar.
- `src/lib/professionalDrawingEngine.ts`, `tradingViewToolbarCatalog.ts` — older/shared drawing logic and catalog; inspect before duplicating behavior.

### Important analytical engines

- Volume/profile: `volumeProfileMath.ts`, `nativeVolumeProfilePrimitive.ts`, `volumeIntelligence.ts`.
- Footprint: `footprint*.ts`, `footprintPrimitive.ts`, `footprintRuntime.ts`.
- CVD/aggressor: `tradeAggressor.ts`, `liveExecutionTape.ts`, indicator adapters in the workspace.
- Big contracts/blocks: `bigTrades.ts`, `bigTradesPrimitive.ts`, `bigBlocksPrimitive.ts`.
- TPO/value area: `databentoTpo.server.ts`, `tpoLevels.ts`, `valueArea.ts`, `cmeProfileWindows.ts`.
- Gamma: `nativeGamma.ts`, `chartGammaLevels.ts`, `classicGexProfile.ts`, `gammaHeatmap.ts`, `zeroGammaLine.ts`.
- Bounce levels: `bounceLevels.ts`, `bounceLevelsPrimitive.ts`, `/api/bounce-levels`.
- Dark pool: `darkPoolMap.ts`, `darkPoolGex.ts`, `darkPoolGexPrimitive.ts`, `darkPoolReactionAnalytics.ts`.
- Options maps: `gexMap.ts`, `gexMapStar.ts`, `gexCalendar.ts`, `gexFlow.ts`, `gexIntervalMap.ts`.
- Order-flow detectors: absorption, pulling/stacking, stacked imbalance, iceberg/refresh, stop sweep, POC/auction, tape speed/burst.
- Paper trading: `paperAccounts.ts`, `paperTrading.ts`.
- Zyon: `zyon*.ts`, `zyonMarketContext.server.ts`, `historicalZyonContext.server.ts`, `macroIntelligence.server.ts`, `macroMemory.server.ts`.

### Supabase

Migrations are in `supabase/migrations`. Never make UI depend on a schema change without adding a migration and clearly noting that production must apply it. Existing areas include user preferences, Zyon journal/drafts, socials/desks/follows, activity streaks, macro memory, GEX BOX archive, section reads, emoji preferences, chart drawings, and precision-tool documents.

## 7. GEX BOX current state

This is the most recent active feature and must not regress.

### Truth boundary

- Exposure/snapshot data comes through the native KwantDesk GEX BOX API and QuantData-backed server path.
- It must not call the old GEXBot vendor API, use a GEXBot key, or show invented replay data.
- Live Classic futures candles use Rithmic executions:
  - `NQ_NDX` -> NQ Rithmic stream
  - `ES_SPX` -> ES Rithmic stream
- Replay Classic candles load real historical futures candles through `/api/cme-history` (`NQ.c.0` or `ES.c.0`, one-minute, bounded history), filter them to the recorded replay frame, and reveal them progressively with the replay clock.
- Exposure replay and candle replay share one clock. Do not let future candles leak into an earlier replay frame.

### Files

- `src/components/gexbot/GexBotWorkspace.tsx` — orchestration, live/replay state, controls.
- `src/components/gexbot/GexBotLightweightCharts.tsx` — Classic, State, and Order Flow Lightweight Charts rendering.
- `src/components/gexbot/GexBotCharts.tsx` — shared types/legacy helpers still used by the workspace.
- `src/lib/gex-box/*` — inspect this whole directory before changing GEX BOX math.
- `src/lib/gex-box/rithmicCandles.ts` — live execution-to-candle aggregation and replay candle helpers.
- `src/app/api/gex-box/catalog/route.ts`
- `src/app/api/gex-box/snapshot/route.ts`
- `src/app/api/gex-box/history/route.ts`
- `src/app/api/gex-box/research/route.ts`
- `scripts/test-gex-box.mjs` — required deterministic checks.

### Recent verified behavior

The last change added real historical candles to Classic replay after live candles had already been moved to Rithmic. At the last checkpoint:

```text
npm run test:gex-box
npx eslint <changed GEX BOX files>
npx tsc --noEmit
npm run build
```

all passed before commits `6d693311` and `cb07189d` were pushed. This is code/build verification, not proof of a full live New York-session production soak.

## 8. Chart and workspace invariants

### Drawing toolbar: which one is live

The chart has **three** drawing toolbars in the tree. Only one is mounted. This
has already cost several rounds of work landing on dead code, so check here
before touching anything toolbar-related.

| Toolbar | Tool list | Draws into | Status |
| --- | --- | --- | --- |
| `ChartDrawToolbar.tsx` | `src/lib/chartDrawTools.ts` | `ChartDrawLayer.tsx` | **LIVE — edit this one** |
| Left rail in `Chart.tsx` (`DRAWING_TOOLBAR_GROUPS`, `ACTIVE_DRAWING_TOOLBAR_GROUPS`, `tradingViewToolbarCatalog.ts`) | same file | `drawings` state | dead: `LEGACY_LEFT_TOOLBAR_ENABLED = false` |
| `PrecisionRail.tsx` / `precision-tools/` | `precision-tools/registry.ts` | own canvas | chrome hidden; layer mounted only so previously placed drawings still render |

Consequences to hold on to:

- **Adding or changing a tool** means editing `src/lib/chartDrawTools.ts`. Adding
  it to `DRAWING_TOOLBAR_GROUPS` in `Chart.tsx` changes nothing a user can see.
- The live rail renders **one button per group**; every other tool in that group
  is behind a flyout chevron. A tool that must be reachable in one click needs
  its own entry in `DRAW_TOOL_GROUPS`, not just a place in the list.
- **Drawing behaviour** (magnet, selection, dragging, hit testing, the position
  calculator's rendering) lives in `ChartDrawLayer.tsx`. The parallel
  implementations in `Chart.tsx` (`selectedTool`, `drawings`,
  `positionCalculatorPrimitive.ts`) belong to the dead rail.
- The live drawing state is `drawTool` / `chartingDrawings`. `selectedTool` /
  `drawings` are legacy.
- `npm run test:toolbar-single-source` fails if a tool is reachable only from the
  dead list, or if the pencil/eraser lose their own rail slot.

### Panel identity

Every panel must have a stable ID. Store panel-local state keyed by that ID. A duplicated panel copies the source snapshot once and then diverges independently. Switching a panel from Chart to Footprint/DOM/etc. replaces its previous content; it must not accidentally retain the old indicator stack.

### Resizing and docking

- Moving one wall resizes only the two adjacent panels.
- Other walls remain fixed.
- Detached panels move and resize without reflowing attached panels.
- Locking one panel only prevents that panel from being dragged.
- Resize observers and pointer handlers must be cleaned up.
- Do not put viewport dimensions into a global state update loop.

### Viewport and crosshair

- `End` returns the focused chart to the live edge.
- Scrolling the main price scale changes only the main chart price scale.
- Scrolling an indicator scale changes only that indicator.
- Volume panes remain fixed where specified.
- Linked charts share exact time window and normalized price view; apply changes with a reentrancy guard to prevent ping-pong.
- Crosshair synchronization must use `requestAnimationFrame`/imperative chart APIs, not React state on every pointer event.
- Current-price, fill, level, dark-pool, GEX, IB, TPO, and profile labels must not float when the viewport changes.

### Toolbar and overlays

- The left drawing toolbar is a fixed screen-space boundary. Chart content, labels, levels, and profiles start to its right and must never render underneath it.
- Dropdowns and indicator menus must render above workspace panels and close on outside click.
- Settings dialogs are movable, centered initially, do not blur the chart, and should permit live visual inspection.
- Modal control changes may preview imperatively, but persistence should be debounced or committed on save—not on every slider pixel.

## 9. Performance contract

The owner commonly runs four to six charts, footprint, GEX Map, GEX overlays, and liquidity/order-flow tools simultaneously. The page must remain interactive on an ordinary laptop. “Works with one empty chart” is not acceptance.

### Never do this on a live path

- `setState` for every tick, depth update, or crosshair movement;
- rebuild the full historical array for one latest-tick change;
- repeatedly sort the complete dataset during render;
- create one WebSocket/EventSource per chart for the same symbol/feed;
- parse or clone large payloads separately in every panel;
- unbounded arrays, maps, markers, DOM nodes, Canvas paths, or retained closures;
- animation loops that continue while hidden/unmounted;
- a new `ResizeObserver`, document listener, timer, or subscription without cleanup;
- remount an entire chart because the current price changed;
- use React keys that change with timestamps/data;
- refetch because the user panned or zoomed an already-loaded window;
- compute expensive indicators on the main thread every frame.

### Preferred pattern

1. One shared source subscription per provider/symbol/channel.
2. Normalize once.
3. Keep bounded ring buffers/caches.
4. Batch inbound updates.
5. Draw at most once per animation frame.
6. Use `series.update()` for the live item and `series.setData()` only for initial/reset/history replacement.
7. Keep Canvas/Lightweight primitives imperative and memoized.
8. Pause or reduce work for off-screen/hidden panels.
9. Cache server history with a stable request key and coalesce concurrent identical requests.
10. Measure before and after with a representative multi-panel workspace.

### Performance diagnosis checklist

- Chrome Performance: identify long tasks and scripting/layout/paint split.
- Chrome Memory: compare heap snapshots after repeated mount/unmount and 10+ minutes live.
- React Profiler: verify ticks do not rerender the full shell/workspace.
- Network: count SSE/WS/fetch connections and repeated history calls.
- Instrument subscriptions: log counts in development, not payload contents or secrets.
- Check `requestAnimationFrame`, timers, `ResizeObserver`, `EventSource`, WebSocket, and document handlers for matching cleanup.
- Inspect arrays/maps for upper bounds.
- Test four charts plus footprint plus heavy overlays, not a single chart.

An “Aw, Snap / out of memory / error code 5” report is usually a leak or runaway allocation until proven otherwise. Do not blame the user’s RAM first.

## 10. Data/visual correctness rules by feature

### Futures candles and non-time bars

- Time bars need contiguous market-time history and a correct live tail.
- The daily CME maintenance break is not a multi-candle visual hole. Use a logical index/time representation that compresses non-trading time where appropriate.
- Volume/range/Renko bars must be built deterministically from ordered trades, with one closed bar followed by exactly one next bar. Deduplicate events and preserve sequence across history/live handoff.
- Switching timeframe must not show only the current candle while history restores.
- Never join history and live data with a false gap or duplicated overlap.

### Footprint/CVD/profiles

- Bid/ask delta requires aggressor-side executions, not OHLCV inference.
- Historical and live calculations must use the same classification/math.
- Old closed footprint candles are immutable; only the current candle updates.
- Session CVD is a cumulative signed execution series over the intended session/window.
- Daily/weekly profiles must include the current building profile and prior completed profiles.
- A real volume profile is not a handful of chunky rectangles. Granularity, tick size, value area, POC, alignment, and delta backing must remain correct.
- Keep profiles behind candles when requested; pinning left/right changes screen placement, not profile width/math.

### Options/gamma

- Futures and cash/index symbols are different instruments. Map NQ/MNQ to NDX/QQQ context and ES/MES to SPX/SPY context through explicit conversion helpers.
- SPXW is an options-root alias/surface under SPX where supported; do not assume it has an independent cash quote.
- GEX Map center-price row and Star node are separate calculations.
- Star node uses the full filtered list and `max(abs(raw signedExposure))`, not rounded text, visible rows, current price, heat intensity, positive-only exposure, or one-minute change.
- “King” was renamed to **Star** in the UI. Do not reintroduce King labels in GEX features.
- Bounce levels and dark-pool GEX should project correctly to NQ/MNQ/ES/MES and options underlyings using explicit price conversion.
- Historical gamma visuals must use captured/historical frames. Do not apply today’s surface retrospectively and call it history.

### Levels

- Labels sit clear of the fixed toolbar and do not overlap each other.
- IB levels begin at the candle/time that established the interval and extend right; old duplicate versions are removed when a newer calculation supersedes them.
- Monday “previous day” value area means the previous completed trading session (Friday), not calendar Sunday.
- Level-loading delays must be solved via server/cache/request lifecycle, not by keeping stale levels forever without age metadata.

### Paper trading

- Sim orders must use current authoritative tradable price and the correct contract specification/tick value.
- NQ: 0.25 tick, $5/tick, $20/point per mini. MNQ: 0.25 tick, $0.50/tick, $2/point per micro.
- ES: 0.25 tick, $12.50/tick, $50/point per mini. MES: 0.25 tick, $1.25/tick, $5/point per micro.
- Open P&L in chart labels and trade panel must derive from the same position/mark source.
- TP/SL triggers compare the correct side and cannot fire merely because a handle is being dragged. While dragging, treat the order as temporarily unarmed; on drop, validate and arm at the dropped tick. If price is already beyond it, execute using explicit market semantics.
- Reset all trades/fills must also reset open and daily simulated P&L as requested.
- Never connect real order entry as a side effect of a market-data task.

## 11. UI and theme contract

- Use theme tokens from `src/lib/theme.ts`, `themePresets.ts`, and `ThemeProvider.tsx`; do not hard-code pink/green/blue unless the feature explicitly demands a semantic color.
- The selected global theme overrides normal workspace colors, except chart-specific colors intentionally customized and saved as a chart template/workspace override.
- `Mono Protocol` is the default theme for new users.
- All panel bars and controls should use the established compact cockpit typography and dimensions.
- Square or subtly rounded corners are intentional; do not reintroduce large pills where the current design uses boxes.
- Loading data surfaces show the standard loader rather than a blank black panel.
- Do not flash an old theme on hydration. Apply persisted theme before visible render where possible.
- Keep text readable and avoid stacked, clipped, duplicated, or excessively long labels.
- No “Databento fallback”, “derived”, “APPROX OHLCV”, or internal recovery jargon in normal user-facing labels.
- Product spelling is **KwantDesk**, **Kwant levels/zones** as currently named, and **Zyon** (not Zion/Xion/Sion).

## 12. Working procedure for every request

### A. Start safely

```powershell
Set-Location 'C:\Users\Karen\Documents\QUANT DESK\kwantdesk-websiterepo'
git status --short
git branch --show-current
git log -12 --oneline
```

If tracked changes already exist, inspect them. They belong to the owner or another engineer until proven otherwise. Work around them or coordinate; do not discard them.

### B. Find the real implementation

Use `rg` before guessing:

```powershell
rg -n "visible label|route name|component name" src services scripts tests
rg --files src\app\api src\components src\lib
git log --all --oneline -- path\to\suspect-file
git blame -L 100,180 path\to\suspect-file
```

For regressions, inspect the last known good implementation with `git show <commit>:<path>` and compare behavior. Do not wholesale revert unrelated commits.

When the owner supplies a prompt/spec file, read the entire file. Treat the owner’s current message as authoritative if it narrows or overrides the attached document. Reuse the existing tool ID/route/registration rather than creating a duplicate unless explicitly requested.

### C. Reproduce and trace

Trace this complete path:

```text
provider event -> VPS normalized event -> Next API route -> browser shared client -> panel state/cache -> indicator math -> renderer
```

Identify whether the fault is:

- provider entitlement/session;
- gateway route/allowlist/auth;
- stale or malformed normalized payload;
- history/live seam;
- duplicate subscription or reconnect loop;
- wrong symbol conversion;
- global state leakage between panels;
- coordinate-space error;
- runaway render/allocation;
- CSS stacking/overflow issue.

Do not stop at the first visible component if the data entering it is wrong.

### D. Implement narrowly

- Prefer adapting existing math, primitives, streams, and tokens.
- Keep live computation outside React render.
- Add deterministic pure helpers where logic is testable.
- Add or extend a focused test script for regressions.
- Preserve user settings and old persisted documents with backward-compatible defaults.
- Avoid changing generated files, `.next`, local caches, recordings, SDK vendor files, or secrets.

### E. Verify proportionately

Run the feature test first, then static checks, then the production build:

```powershell
npm run test:<feature>
npx eslint path\to\changed-file.ts path\to\changed-file.tsx
npx tsc --noEmit
npm run build
git diff --check
```

Relevant feature scripts are listed in `package.json`, including GEX BOX, GEX VUE replay, GEX Map Star, GEX Cal, GEX Flow, bounce levels, dark-pool features, IV rank, zero gamma, initial balance, and the order-flow detectors.

For gateway changes:

```powershell
Set-Location services\rithmic_gateway
npm test
```

Then return to the repo root for TypeScript/build checks.

### F. Commit only the task

```powershell
git status --short
git diff -- path\to\changed-files
git add -- path\to\changed-files
git diff --cached --check
git commit -m "Imperative description of the completed behavior"
git push origin main
```

Never run `git add .` in this repository because it can capture `ALGO/`, local caches, recordings, screenshots, secrets, or another engineer’s changes.

After pushing:

```powershell
git status --short
git log -1 --oneline
```

Expected normal residual status is `?? ALGO/` only.

### G. Report honestly

Tell the owner:

- the concrete outcome;
- the root cause;
- the important files changed;
- tests/build run and results;
- commit hash and that it was pushed;
- any live-session verification still outstanding.

Do not bury the outcome in process narration. Do not claim Vercel production is healthy solely because `git push` succeeded.

## 13. Deployment and operations

### Website

Pushing `main` normally triggers Vercel. If production behavior matters, verify the deployment and the actual route after it completes. Avoid using local `.env.local` as evidence that Vercel has the same configuration.

`middleware.ts` deliberately fast-paths read-only market APIs after the site-access gate. It also filters Supabase cookies to avoid Vercel `494 REQUEST_HEADER_TOO_LARGE` and `MIDDLEWARE_INVOCATION_FAILED`. Do not restore forwarding of every stale/chunked auth cookie.

The liquidity-map static bundle under `public/heatmap-app/` is excluded from middleware auth parsing because redirecting individual CSS/JS assets produces an unstyled raw HTML interface. Its live API data remains protected.

### VPS gateway

Read `services/rithmic_gateway/deploy/DEPLOY.md` before deployment. Use the existing scoped shipping helper. Do not copy `node_modules`; do not commit or publish licensed Rithmic proto files or `operator.env`.

After a gateway deployment, verify:

1. container is healthy;
2. only one Rithmic session owner is active;
3. `/health` timestamps advance;
4. expected symbols are subscribed;
5. provider flags are configured;
6. recorder counts advance;
7. a real website API probe returns current normalized data;
8. browser receives one shared stream without reconnect churn.

## 14. Known historical failure patterns

These failures have repeatedly occurred. Do not reintroduce them.

### Blank panels that later flash in

Usually caused by an initial empty render, stale cache replacing fresh state, failed provider request swallowed by a boundary, or a chart created before its container has a usable size. Use a real loading state, retain last-good data only with accurate age/status, and make chart initialization resize-safe.

### Price freezes after several minutes

Usually a dead SSE/WS connection, stale “connected” flag, competing Rithmic login, leaked listeners/timers, main-thread starvation from indicators, or a reconnect that did not restore subscriptions. A heartbeat must test advancing data, not merely socket state.

### Page freezes every few seconds / browser OOM

Historically associated with multiple charts plus heavy primitive overlays, repeated full-series replacement, unbounded arrays/markers, duplicated feeds, and chart-wide React rerenders. Profile the exact workspace. Do not add a timer or reduce the update rate as the “fix” without eliminating the underlying work/leak.

### Old fallback visuals appearing before real data

This is especially damaging for volume profiles and gamma. Do not render legacy approximation during authoritative loading. Start with a loader or a valid last-good authoritative snapshot, then atomically replace it.

### Indicators floating/wobbling

Caused by storing screen `y` positions rather than price/time anchors, mixing chart and viewport coordinate systems, or updating labels in a different frame from primitives. Use the chart coordinate API consistently and render label + line from the same anchor/frame.

### Cross-panel indicator leakage

Caused by global indicator arrays or shared keys based only on symbol. State keys need the panel/workspace ID. Shared **data** is correct; shared **UI selection/state** is not.

### History/live gap

Caused by slow gateway-origin selection, misaligned timestamps, history excluding the current tail, live data starting before history is committed, or overlap dedupe errors. Establish a single seam: load bounded history, buffer live events during load, merge/dedupe in timestamp/sequence order, then continue incremental updates.

### GEX/option symbol mismatch

Do not treat NQ, NDX, QQQ, MNQ, SPX, SPXW, SPY, ES, and MES as interchangeable strings. Use explicit context and conversion maps. The display symbol, price source, options root, and futures hedge symbol are separate fields.

### Vercel large headers / middleware crash

Do not write huge cookies or duplicate Supabase auth chunks. Middleware intentionally reads only the active Supabase project cookie and does not forward refresh writes. Client/callback routes own durable auth updates.

## 15. User interaction expectations

- Move forward autonomously on safe, scoped implementation work.
- If a decision changes product meaning, data authority, billing, provider entitlement, database schema deployment, or real-order execution, stop and ask.
- A complaint like “it still freezes” means the previous fix did not address the root cause. Reproduce and profile it; do not layer another emergency banner.
- The owner values speed, but correctness and production stability come first. Give concise progress updates during long work.
- Do not control desktop applications unless explicitly asked in that request.
- Never repeat a pasted secret. If a secret appears in chat, treat it as compromised and recommend rotation after completing the scoped wiring.

## 16. Documentation to read by task

- Footprint: `docs/FOOTPRINT_CHART_ENGINE.md`
- GEX Desk: `docs/gexdesk-product-spec.md`
- Rithmic indicators: `docs/RITHMIC_INDICATOR_SETUP.md`
- Structure levels: `docs/STRUCTURE_LEVELS_ENGINE.md`
- Social record layer: `docs/social-record-layer.md`
- VPS operations: `services/rithmic_gateway/README.md` and `deploy/DEPLOY.md`
- Native gamma service: `services/databento_gateway/README.md`
- Any owner-supplied prompt under `C:\Users\Karen\Downloads` or `C:\Users\Karen\Documents\KWANT`: read it fully, but do not copy it into production or treat screenshots as data.

## 17. Handoff log for the next engineer

Before returning the project, append a dated section here containing:

```markdown
## Temporary engineering log — YYYY-MM-DD

### Completed
- Behavior, root cause, important files.

### Commits pushed
- `<hash>` — `<subject>`

### Verification
- Exact test/lint/typecheck/build commands and results.

### Production/VPS actions
- What was deployed, how it was checked, and whether live RTH was observed.

### Remaining risks
- Anything not verified, any provider/session dependency, and the next exact diagnostic step.

### Worktree state
- Output summary of `git status --short`.
```

Do not hand back an unexplained dirty tree. Commit completed work; leave incomplete work uncommitted only when necessary and document every changed file and why.

## 18. Final pre-push checklist

- [ ] I read the latest `git status` and did not touch `ALGO/`.
- [ ] I traced the real data path instead of patching only the message/UI.
- [ ] No credentials or vendor SDK artifacts entered the diff.
- [ ] No fake/approximate data is presented as authoritative.
- [ ] State is panel-local and subscriptions are shared/bounded.
- [ ] Every listener, timer, observer, stream, animation loop, and chart instance is cleaned up.
- [ ] The change behaves with multiple panels and on a narrow/vertical viewport.
- [ ] Theme and loading states are correct.
- [ ] Focused tests, ESLint, TypeScript, build, and `git diff --check` passed.
- [ ] Only scoped files are staged.
- [ ] Commit is pushed to `origin/main`.
- [ ] Any live-session caveat is reported honestly.

This file is operational guidance, not permission to rewrite the platform. Preserve the product, fix the actual problem, and leave the next engineer a cleaner and more truthful system than you found.

## Temporary engineering log — 2026-08-18

### Completed
- Home launcher redesigned: theme-token 3D workspace renders, live NDX/SPX/VIX tape via the shared index client, side gutters, smaller tiles (`WorkspaceHome.tsx`, `home/HomeLivePreviews.tsx`, `globals.css`).
- Shared viewport linking (drag/zoom/crosshair peer sync) enabled on the Charts workspace with a charts-scoped sync group (`KwantifyWorkspace.tsx`).
- Zero Gamma Line repaired end to end: cash-calibrated cage flip/crossings now convert to futures scale; ±25%-of-spot outlier guard; `maxDuration = 120` on the route (the production 504 killer); pre-open session-boundary fix; server memo of completed sessions; fast-first paint then history; smooth dashed observation line (GEX BOX style) instead of carry-forward steps (`quantData.server.ts`, `zeroGammaLine*.ts`, `api/zero-gamma-line/route.ts`, `Chart.tsx`).
- Workspace persistence: Quick Save/Save As sync to the account immediately; sign-in hydration no longer rolls back newer unsynced local state (`userPreferences.ts`, `KwantifyWorkspace.tsx`; new `test:preference-hydration`). Presets now capture the overall theme + GEX Map palette and restore them on apply.
- CVD updates live: order-flow pane indicators join the throttled live-candle snapshot path (750ms cap); "Updating report..." toast removed (`Chart.tsx`, `KwantifyWorkspace.tsx`).
- Gamma heatmap obeys the GEX Vue replay clock (no lookahead; levels hidden in replay).
- GEX Map: replay empty-states name the exact cause; columns never auto-hide on shrink (X only); five-colour gradient palettes with nine curated presets, themed pickers, Save-to-persist, account sync (`gexMapPalette.ts`, `GexMapWorkspace.tsx`).
- Site-wide themed colour picker `ChartColorField` (HSV surface, hue rail, hex entry, click-to-copy, shared recents) replacing every native `type="color"`; always renders above host dialogs and never closes them mid-pick.
- New Options Delta pane indicator (`options-delta`): per-minute signed net DEX bars for the chart's own options family, sharing the GEX Map DELTA cache (`optionsDelta.ts`, registrations, `test:options-delta`).
- Browser OOM mitigations: options-delta series memoised per payload; order-flow live sampling capped at 750ms.
- Cash-index symbols (SPX/SPY/NDX/QQQ/VIX...) route to the Market Index feed on selection, and saved panes wrongly paired with the CME feed self-repair on load.

### Commits pushed
`8f8f8341` home tiles → `00377af2`, `1fdd42a9`, `ee27866d`, `7a53989b`, `bc70fbf9` (launcher series); `9dd22a6b` charts viewport linking; `92323263` zero gamma calibration; `5763ac7e` workspace sign-in persistence; `4b65c8c6` CVD live + toast; `c49aee60` heatmap replay sync; `5fe9373e` GEX Map replay diagnostics; `4ed23d64`, `ff3e04ef`, `aee4aeea` colour picker series; `9bc313f3` GEX Map column visibility; `6bb88b29` pickers everywhere + workspace themes; `36ca059c` zero gamma reliability; `480c728f` zero gamma line style; `85fce915`, `ead97019`, `880ffeb8` GEX Map palettes; `51cb2273` Options Delta; `fc586d87` allocation churn; `502a40f4` cash-index routing.

### Verification
Per change: relevant `npm run test:*` (gex-box, gex-vue-replay, gex-map-star, bounce-levels, zero-gamma-line, preference-hydration, options-delta), `npx eslint <changed files>`, `npx tsc --noEmit`, `npm run build` — all green before each push. Zero gamma and GEX Map replay data verified against the live VPS gateway via local dev (`KWANTIFY_DEV_AUTH_BYPASS`).

### Production/VPS actions
Website only (Vercel via `origin/main` pushes). No VPS/gateway deployments. Deployed CSS spot-checked once via the public landing bundle (GEX Map column fix confirmed live).

### Remaining risks
- Native gamma gateway env appears unconfigured (local `/api/native-gamma` → "not configured"); zero gamma/NQ-ES gamma runs on cash-calibrated QuantData. Verify Vercel env if native TRUE_OI is expected.
- SPX/SPY QuantData snapshots for 2026-08-14 and 08-17 are corrupted upstream (outlier guard drops them) — those sessions stay honestly absent.
- Browser OOM ("Aw, Snap" code 5): two churn sources fixed, but the pattern predates today; if it recurs, get workspace layout + time-to-crash + single-vs-all-tabs, then heap-profile that path.
- Live RTH soak of today's changes not yet observed; owner-side visual checks pending on several UI changes.
- `tmp/pdfs/*` modified/untracked files and `gexcal-*.png` in repo root belong to another workstream (owner/Codex licensing report) — untouched, left in the worktree.
- Interrupted investigation: owner reported the gamma environment indicator not mapping to the pane's asset; code review shows the direct path already resolves QQQ→QQQ etc. — needs the owner's exact repro before further work.

### Worktree state
`?? ALGO/`, `?? gexcal-*.png/tmp`, `M/?? tmp/pdfs/*` (other workstream) — no uncommitted engineering work.

## Temporary engineering log — 2026-08-19

### Completed
- QuantData quota burn stopped: zero-gamma completed-session points persist in the cross-instance data cache (`unstable_cache`), the recurring client refresh only re-requests the live session, default cadence 10s→30s (floor 15s), and the route coalesces bursts. Root cause: the 08-18 `maxDuration` fix let formerly-dying 5-session chains complete, polled at 10s per pane fleet-wide (`zeroGammaLine.server.ts`, `api/zero-gamma-line/route.ts`, `Chart.tsx`, `chartIndicatorConfig.ts`).
- Massive subscription ended (owner refunded): `/api/market-indices` now falls through the dead VPS/Massive proxy to the existing local provider chain (KwantData session tape for options underlyings + stocks, official Cboe EOD for VIX); browser client no longer polls the dead VPS index endpoints (one failing batch killed all quotes) and polls at 4s/15s against a 10s route cache (`api/market-indices/route.ts`, `marketIndexLiveClient.ts`). Verified live: SPX 5m returned 609 session candles; snapshot batch served all symbols. VXN/RUT/DJI and intraday VIX have no fallback provider.
- SPX pane fix preceding the entitlement discovery: cash-index symbols route to the Market Index feed on selection and saved panes self-repair (`502a40f4`).
- Aw-Snap mitigations: options-delta series memoised per payload; order-flow live sampling capped at 750ms (`fc586d87`).
- Options Delta pane indicator shipped (`51cb2273`); zero gamma drawn as smooth dashed observation line (`480c728f`); GEX Map five-colour gradient palettes (`880ffeb8`, `ead97019`).

### Commits pushed
`88f05d73` quota fix; `a11610cc` index ticker fallback chain; (plus late-08-18 tail: `51cb2273`, `fc586d87`, `502a40f4`, `e09caff3`).

### Verification
`test:zero-gamma-line` (extended), `test:options-delta`, eslint, `tsc --noEmit`, `npm run build` green before each push. Massive entitlement failure and QuantData fallback verified against live providers via local dev.

### Production/VPS actions
Website only. **Owner action pending:** remove `MASSIVE_API_KEY` from Vercel env and the VPS operator env once residual Massive quote access lapses — the code then skips Massive attempts entirely. The VPS `massive-indices-stream` is dead weight until an index entitlement returns.

### Remaining risks
- Residual Massive quote access may lapse at any moment; per-symbol fallback engages automatically but wastes failing-call latency until the env keys are removed.
- QuantData is now the primary index-quote source: watch its quota after a full RTH day with the fleet online.
- Intraday VIX/VXN/RUT/DJI unavailable without a new provider; VX futures via CME is the honest VIX proxy if wanted.
- Prior open items from 08-18 stand (native gamma env, SPX/SPY corrupted provider sessions, OOM tail, gamma-environment repro).

### Worktree state
`?? ALGO/`, `?? gexcal-*.png/tmp`, `M/?? tmp/pdfs/*` (other workstream) — no uncommitted engineering work.

### Later additions (owner-driven, same session)
- Star-relative scale refinement `5d62728a`; growth ticker beside strikes `763ade0a` capped to top-8 movers/side `51c5269c`; chart toolbar 2× with hover-reveal + right-click crosshair thickness/visibility `00e8dd17`; embedded GEX Map config saved per workspace pane `9133eb7a`; CVD Divergence indicator with tests `19db31e7`; gamma-environment colours/box-size/adaptive label `805f2dcc`; linked viewports saved in presets `697372b1`; GEX Map step-window anchored to newest frame + zero-call/zero-put strikes dropped + per-column compact headers `589bc784`. All verified live on production through the owner's Chrome (toolbar sizes, ticker data, zero-row removal confirmed empirically).

## Temporary engineering log — 2026-08-19 (later session)

### Completed
- Journal wins/losses paint fixed semantic green `#22C55E` / red `#EF4444` on every theme (calendar days, trade logs, LONG/SHORT chips, equity curve, metric cards). Display-only; no journal data touched (`journal/JournalWorkspace.tsx`).
- Buy/Sell Calculator restored to the original Kwantify SVG position engine (pill TP/SL/R:R labels, four resize handles, theme colours, double-click style panel with colour pickers, opacity, line style, labels toggle). Root cause: the 08-13 drawing refactor unbound the SVG overlay and 08-15 remapped the tools to the precision engine. Unmapped `longPosition`/`shortPosition` from `PRECISION_TOOL_BY_DRAWING_TOOL`, excluded them from the professional engine, rebound the overlay handlers, and added per-chart persistence (`kwantdesk:position-drawings:v1:*`, account-synced via a new tracked prefix). The kwantify-redesign repo's version was inspected and is an older, simpler cut — not imported (`Chart.tsx`, `userPreferences.ts`).
- Crosshair/select-tool hijack fixed: a dormant-grab edit of a precision object left the layer engaged in select mode with its canvas eating all chart events (frozen crosshair, dead panning). The grab is now tagged and releases chart interaction the moment the drag ends (`precision-tools/PrecisionToolsLayer.tsx`).
- Value-area levels on options index charts: NDX/QQQ derive from the NQ profile, SPX/SPY from ES, projected to cash scale via a live basis ratio (latest cash candle vs the NQ/ES 1-minute bar at the same minute, bounded `/api/cme-history` fetch, 2-min cache). Developing session profile resolves the front NQ/ES contract itself. Refuses to paint without a fresh ratio (>45-min gap) rather than draw futures prices on a cash chart; index panes skip the futures-priced cold-cache restore (`KwantifyWorkspace.tsx`).

- GEX Vue replay: revealed candle/trade sets are now derived by count so array identity only changes when a bar actually crosses the clock (was a full series replacement per 200ms tick per pane — the reason 15x looked broken); heat frames reveal up to the forming bar's close so exposure prints inline with price exactly like live (`KwantifyWorkspace.tsx`, `Chart.tsx`).
- **Browser OOM root cause found and fixed** (measured on live production through the owner's session): the Gamma Heatmap payload is ~8.4MB JSON per source (391×~280 bins mid-evening, growing to a 720-snapshot cap) and was refetched every 5s per pane while new columns only exist every 60s; the renderer repainted all ~108k bins with fresh temporaries on every chart invalidation (several/sec live). Fix: offscreen-canvas surface cache blitted per frame (re-rendered only when data/viewport/scale/size change), allocation-free max scan (the old `Math.max(...spread)` over 100k+ values was also a latent V8 argument-limit RangeError late in the session), palette parsed once per render, off-screen column culling, refresh default 5s→30s floor 15s (`gammaHeatmapPrimitive.ts`, `chartIndicatorConfig.ts`, `Chart.tsx`).

- GEX Map colour system rebuilt through three owner iterations, final model: one diverging ten-colour signed-exposure scale — slot 1 darkest = most extreme negative, middle = average noise, slot 10 lightest (bright tone lifted toward white) = most extreme positive; row opacity also grows with distance from the middle so both extremes render solid against washed-out noise. Log-scaled magnitude picks the slot ($11M vs $5B clearly separated). Ten editable slots (−100…+100) in Star view settings with a full-spectrum drag-bar picker (no popup); presets fill the scale and preview it; saved legacy palettes upgrade; theme mode derives the same shape from theme accents (`gexMapPalette.ts`, `GexMapWorkspace.tsx`).
- GEX Map node zoom: `− % +` clicker beside the frame-step buttons scales the strike ladder via CSS zoom (50–150%, 10%/click), persisted in `kwantdesk:gex-map-zoom:v1` and account-synced. Verified live: owner's own zoom clicks synced to a fresh session.

### Commits pushed
`376de191` journal semantic colours; `5b928b45` Kwantify P&L calculator + crosshair release; `c58b0110` index value-area derivation; `e7f534f5` GEX Vue replay speed/heat; `e82b9bb3` gamma heatmap OOM fix; `778d3cdb`/`5d436a07`/`498dbbb0`/`167e95cf` GEX Map colour-scale series; `947494d7` node zoom; `69a912c4` reference linear scale + Viridis preset + solid fills; `474e7038` twenty more palettes (30 total); `dfc75c28` zero pinned to scale middle (per-side linear to each extreme, $0 rows paint the average colour, legend −max·0·+max). Final model verified live: noise floor one quiet middle colour, biggest negative alone darkest, biggest positive alone lightest.

### Verification
Per change: `tests/precision-tools-system.test.mjs` + `tests/chart-drawing-system.test.mjs` (29/29; one pre-existing stale assertion repaired), `test:preference-hydration`, eslint on changed files (`NODE_OPTIONS=--max-old-space-size=8192` for the huge components), `npx tsc --noEmit`, `npm run build` — all green before each push.

### Remaining risks
- Index value-area conversion not yet observed against live RTH; owner check: Value Area on NDX beside NQ should mark the same market locations at cash prices.
- Restored SVG calculator drawings persist per chart instance via preference sync only (not the `/api/chart-drawings` document channel); precision calculator objects placed during the interim still render via the precision layer.
- Heatmap OOM fix needs a full-RTH multi-device soak to declare the Aw-Snap pattern closed; every open tab must be reloaded onto `e82b9bb3` first (deployment pinning). If crashes persist after that, the next step is a DevTools heap profile on the crashing workspace during RTH.
- Gamma heatmap surface re-renders once per new bar/pan frame — visually identical; if any heat visual difference is reported, compare against a pre-`e82b9bb3` deployment first.
- Prior open items from earlier 08-19/08-18 sections stand.

### Worktree state
`?? ALGO/`, `?? gexcal-*.png/tmp`, `M/?? tmp/pdfs/*` (other workstream) — no uncommitted engineering work.

## Temporary engineering log — 2026-08-19 (12-task autonomous run)

### Completed (one commit per task, all pushed)
1. `edb89279` command-deck empty space removed. 2. `264fabcc` GEX Map wheel steps one strike row. 3. toolbar Lock/Unlock pin (persisted `kwantdesk:chart-toolbar-pinned:v1`). 4. `6509faac` top-bar account button → profile avatar → `/socials/<handle>`; sign-out relocated to Settings → Account settings. 5. bare star glyph in contrast colour (no box). 6. `3aa03f4a` toolbar groups fan out on hover. 7. `d0872061` crosshair thickness/visibility moved out of the right-click menu into Chart Settings → Scales and lines (new shared `src/lib/crosshairStyle.ts`, live-applies to every chart via `kwantdesk:crosshair-style-change`). 8. `0c491684` per-panel meta row removed (greek · exp · STAR · Net) plus dead CSS/vars. 9. `3cc79139` GEXMAP title block removed. 10. `3d477e27` header actions trimmed to add / refresh / Replay (LIVE-chip + Provider-data removed; dead `lastSync`/`dataAsOf` cleaned). 11. `96a9ff33` bottom footer bar removed. 12. `5dd3cfed` price-lock button beside refresh: locked = both wheel handlers consumed, pointer/scrollbar scrolling off (`overflow-y-hidden`), `followingSpot` forced on so the existing centering effects pin spot mid-panel on every price move; persisted `kwantdesk:gex-map-price-lock:v1`, account-synced.

### Verification
Per task: eslint on changed files (heap-bumped for Chart/KwantifyWorkspace), `npx tsc --noEmit`, `npm run build`, `test:gex-map-star` where GEX Map touched — all green before each push. Live production spot-check pending owner reload (deployment-pinned tabs).

### Worktree state
`?? ALGO/`, `?? gexcal-*.png/tmp`, `M/?? tmp/pdfs/*` (other workstream) — no uncommitted engineering work.

## Temporary engineering log — 2026-08-19 (second 12-task autonomous run)

### Completed (one commit per task, all pushed)
1. `62fb27ce` TPO "Single Print quality" slider (0 = all, 100 = only the tallest; ranks zones by tick height) — `tpo/types|settings|engine`, both TPO config blocks; value participates in the calc cache key. 2. `e8c21088` duplicated charts always split to the RIGHT of their source. 3. `496c45b7` layout lock button shows CURRENT state (Lock when locked, LockOpen when unlocked). 4. `e5a5092f` IB levels gained "Fibonacci on the latest IB": 50/61.8/78.6% dotted lines across the most recent complete IBH/IBL pair, Long/Short mirroring, theme up/down colour (`chartIndicatorConfig`, `ChartIndicatorsControl`, `Chart.tsx` fib rows appended to sessionHighLowRenderData). 5. `82da18e9` index-feed indicator honesty (root causes from a full audit): VWAP/rolling-VWAP/envelopes/Chaikin silently degraded to typical-price lines on volumeless cash indices — now return nothing via a `volumeAvailable` guard; Volume/Chaikin panes show "This instrument publishes no traded volume."; CVD/delta panes on index symbols state the feed has no executed bid/ask volume instead of "Restoring…" forever. SPY/QQQ (real share volume) keep working. Never-fixable-honestly set documented in the audit (order-flow suite needs executions; SPX/NDX/VIX have no volume at all). 6. `342bd0b0` per-chart refresh button beside the viewport link (both header variants) — bumps a pane nonce keying `WorkspaceChartPane`, remounting only that pane (history + indicators). 7. `60b33f7d` pane drag-to-rearrange fixed: `beginWorkspacePaneDrag` still early-returned on stale per-pane `locked:true` flags (per-pane locks removed earlier; GEX Vue saved panes carried the flag) — check removed, workspace lock is the single gate. 8. `6cd90e3b` drop overlay redesigned: compact centred 5-cell cross with miniature layout glyphs + a translucent primary region previewing the REAL outcome (half-pane / swap outline). 9. `8c73ee72` GEX Cal: header row (title, EXPIRATION×STRIKE badge, status chip, help, refresh) deleted along with the help popup; JSON export replaced by the refresh button beside CSV; matrix columns divide across the actual expiration count and rows stretch when strikes underfill, so the surface always reaches right/bottom edges. 10. `30579ad5` new "columns" workspace layout (four panels side by side; nested x-splits 25/33.3/50), picker icon beside two-side-by-side, accepted by loader/cloud-sync normalizers. 11. `59fe9500` first mobile/tablet layer: explicit `viewport` export; ≤820px stacks GEX Map columns vertically; ≤640px: no horizontal body scroll, compact brand, command deck and pane headers scroll sideways, dialogs capped to the viewport. 12. `60400b1d` gamma environment badge offsets computed from measured chrome — right = live `nativePriceScaleWidth`+10, bottom = time axis 26+8, left = pinned toolbar button width+22 (else 12), divided by the badge `zoom` so screen offsets stay true.

### Verification
Per task: eslint on changed files (heap-bumped for Chart/KwantifyWorkspace), `npx tsc --noEmit`, `npm run build`; plus `test:initial-balance` (task 4), `test:cvd-divergence` (task 5), `test:gex-cal` (task 9), `test:gex-map-star` where GEX surfaces were touched — all green before each push.

### Remaining risks
- Mobile layer is a foundation, not full per-page phone design — needs a real phone pass with the owner's device for the next iteration.
- Index-feed audit follow-ups not yet built: candle-volume profile model for SPY/QQQ (execution-only profile intentionally untouched), live forming-bar volume for index snapshots, greying out unavailable indicators in the library itself.
- Task 7 diagnosis is code-level (stale locked flags); owner should confirm dragging now works on their saved GEX Vue workspace after a hard reload.
- Deployment-pinned tabs: every check needs Ctrl+Shift+R first.

### Worktree state
`?? ALGO/`, `?? gexcal-*.png/tmp`, `M/?? tmp/pdfs/*` (other workstream) — no uncommitted engineering work.

## Temporary engineering log — 2026-08-19 (9-task autonomous run)

### Completed (one commit per task, all pushed)
1+2 (duplicate items). `9410336b` toolbar pin is now PER CHART: key `kwantdesk:chart-toolbar-pinned:v1:<paneId>`, legacy global key seeds unchosen panes, prefix tracked for account sync; the cross-chart broadcast event removed. 3. `620a184c` candle-backed volume profiles on options tickers: revived the dormant `buildChartVolumeProfile` (provider "Chart", neutral delta, honest source text), new `isCandleBackedVolumeProfile` guard accepted by Chart.tsx + the profile primitive, and a market-index-pane effect building per-NY-date daily + weekly profiles from real provider bar volume (SPY/QQQ...). SPX/NDX/VIX and delta-labelled profile variants stay honestly absent. The execution-only guard is untouched. 4. `dcae759e` hovering the left toolbar no longer trips chart hover hit-tests underneath (pointer/mouse-move propagation stopped at the toolbar root; open bounce-level popups close on toolbar enter). 5. `60395420` GEX Map price lock: zoom changes ladder content height without resizing the scroll container, so no ResizeObserver fired and locked panels drifted out of frame — recenter effect on ladderZoom + priceLocked; engaging the lock always snaps price to centre. 6. `e7da4349` star settings: verified LIVE on production that sliders/checkboxes/persistence work (13→25 highlighted rows on slider change); real defects fixed — native Windows `<select>` replaced with the site's GexMapDropdown, portaled menu z bumped to 280 with a dialog outside-close whitelist (`data-gex-map-dropdown-menu`), and `kwantdesk:gex-map:star-preferences:v1` added to account sync. 7. `59765aba` "Load range" (1D/5D/1W/1M/3M/6M/1Y/All, standard 5D) added to the top of the interval picker, wired to handleChartPeriod for the active pane. 8. `1c5f72bb` GEX Map views moved into settings: `GexMapViewMode` is now full | ninja | star (raw→full, legacy star→star via `normalizeGexMapViewMode`); header Raw/Star toggle removed; default view = star (only the Star node highlighted; ninja = old structural view; full = old raw); Shift+V cycles all three. New `valueMode` (signed | star-percent) changes ONLY the numbers (right-side values + showRawValues text) to % of Star magnitude; the value heading renders directly above the spot price in each panel header and drives the column label. 9. `39c48dc6` GEX Vue watchlist froze because the live stream only runs for the ACTIVE pane's broker (Market Index panes → no CME stream; the effect bailed at `activeChartBrokerLabel === "Market Index"`); a bounded companion `/api/databento/live` EventSource now runs whenever the active feed is index-based and Databento symbols exist in the watchlist/panes, painting rows via `publishLiveWatchlistQuote`.

### Verification
Per task: eslint on changed files (heap-bumped for Chart/KwantifyWorkspace), `npx tsc --noEmit`, `npm run build`, plus `test:gex-map-star` for GEX Map changes — green before each push. Task 6 additionally verified live on production through the owner's Chrome session.

### Remaining risks
- Candle profiles on SPY/QQQ not yet visually inspected live; bin size is range/140 auto — owner may want grouping controls later.
- The companion watchlist stream duplicates the main stream when the user quickly switches between brokers (both effects re-run; each closes on cleanup so no leak, but watch for double ticks during transitions).
- GEX Map legacy stored viewMode "star" now loads as the NEW star (only Star highlighted) — owners wanting the old star view pick Ninja in settings.
- Deployment-pinned tabs: hard reload before checking.

### Worktree state
`?? ALGO/`, `?? gexcal-*.png/tmp`, `M/?? tmp/pdfs/*` (other workstream) — no uncommitted engineering work.

### Follow-up fixes (same day, owner-driven)
- `8de3a277` position calculator floated/vanished: `timeToX` only resolved exact visible bar times; moved anchors (arbitrary times, beyond last bar, session gaps) returned null and erased the drawing. Now interpolates between neighbouring bars on the logical scale and extrapolates past the ends.
- `9ce32123` GEX Map growth ticker: prior-magnitude floor at 0.5% of the Star node (dividing by near-zero priors manufactured 999% readings); >500% renders as ">500%" instead of a fabricated cap. Window remains step-anchored.
- `6da72b8b` on-chart 1D/5D/... load-range bar removed — the control lives only in the timeframe menu.
- `7b7db943` star node strike price: no pill/box, bare text in the star's contrast accent, both views, including star-at-current-price rows.
- GEX Map price lock verified live on production via the owner's Chrome (offset 1013px → 0 on lock press) — the owner's "not centring" report was a deployment-pinned tab.

### Options-ticker volume profiles — root cause and resolution
- Owner reported profiles still dead on options tickers after `620a184c`. Verified against LIVE providers: KwantData `/equities/tool/stock-price-over-time` returns OHLC ONLY (no volume field of any name — probed the raw gateway payload for SPY), so production serves `volume: 0` on every cash candle and the candle-profile path was correct code with no data. Databento equities datasets (EQUS.MINI, DBEQ.BASIC) return 402 insufficient funds through the gateway — no honest cash-volume source is configured.
- `2b5183dc` theme change now overrides the GEX Map palette (relink in saveTheme/resetTheme only — hydration paths untouched so refreshes can't wipe custom colours).
- `46982672` NDX/QQQ/SPX/SPY volume profiles now project the REAL NQ/ES execution profiles onto the cash scale via the existing value-area basis-ratio machinery (daily + weekly, real aggressor delta so ask/bid and delta modes work, 60s refresh, source labelled "projected from NQ/ES futures"). Candle-volume fallback retained for volume-bearing cash tickers outside the options family.
- **Owner action if native SPY/QQQ share-volume is wanted** (also unlocks VWAP/Volume on cash tickers): fund Databento equities (account 402s today); the parse path (`quantData.server.ts` volume mapping + client candle profiles) is already in place.
- Live RTH visual check of projected profiles pending owner reload.

## Temporary engineering log — 2026-08-20

### Completed (each pushed as its own commit)
- `862eedb0` CVD self-heal: measured live that closed candles carried ~70x true delta (client +25,820 vs gateway -123 for the same hour); recent candle flow now rebuilds from the deduped tape on bar close + 45s cadence; stream dedup tail floor 512→4096.
- `49ba2a65` old left drawing toolbar hidden behind `LEGACY_LEFT_TOOLBAR_ENABLED` (Chart.tsx) while the NEW top toolbar is developed; precision layer still renders existing drawings.
- `10bb0294` Trade menu portaled to document.body — it rendered inside the main column's `relative z-0` stacking context so the watchlist painted over it.
- `6a04e7e1` CVD display style + input data moved into the indicator settings dialog; on-pane dropdown/gear removed.
- `8cee352a`+`8cb7f795` Long/Short Position tools rebuilt TradingView-style (studied TV's docs + tutorial): one-click placement, pill-on-line layout, live Open P&L (points, from real last close) + R/R in a grey entry pill.
- `453a6602` GEX Vue replay: forming bar builds tick-by-tick from recorded executions; scrub commits coalesced to one per frame; backward scrubs ≤5 bars now force a redraw (ghost-bar fix). Liq map pane carries an explicit "Live depth · not part of replay" flag during replay.
- `f59b89b2` site-wide high-impact USD news countdown chip in the top bar (calendar API: TradingView primary, Forex Factory weekly feed fallback).
- Earlier same day: `a3072862` gamma-heatmap surface re-projection (the measured "Aw Snap" main-thread starvation fix), `b41b780e` TPO spread-RangeError + per-frame volume-profile recompute fixes.

### Remaining risks / next steps
- Liq map true L3 replay is NOT built — needs the gateway `archive-replay` book stream wired into `public/heatmap-app` (source is readable, `src/*.js`) plus clock sync with `gexVueReplay`.
- gamvue still has a ~30-60s main-thread stall at initial LOAD (separate from the fixed steady-state freeze).
- CVD reconcile + forming-bar replay verified by build/tests only; owner-side live RTH check pending (hard reload required — deployment-pinned tabs).
- Aw-Snap diagnosis method (event-loop lag sampler) recorded in the project memory: crash is main-thread starvation at low heap, NOT OOM.

### Worktree state
`?? ALGO/`, `gexcal-*.png/tmp`, `M tmp/pdfs/*` (other workstream) — no uncommitted engineering work.

### GEX Map Future view + CVD root cause + options profile anchor (2026-08-20, later)
- `151e7d03` Future matrix: per-side log-scaled gradient (full palette, solid fills, dark text on bright cells), per-expiration column-star rings, spot centring on load, left-gap cure; `1a41814b` centring made CSS-zoom-aware via `scrollIntoView` (offset math undershot by the zoom factor). Verified live: spot row centred, strike column flush left, gradient confirmed.
- **CVD "dots" root cause found** (`ed131189`): the route's flow-baked history (`orderFlow=1`) is complete (probed NQ.v.0 15m: 737 bars, 0 bare through RTH), but a pane consumed it exactly ONCE at load; closed bars afterwards get flow only from the live Rithmic SSE, which drops under RTH load (IDB flow runs measured fragmenting from the 08-19 13:15Z open; ES 1m record 100% bare). CVD skips unverified bars → sparse series → dots that worsen the longer the pane runs. Fix: 4-minute flow-heal loop per Databento pane refetching baked history (`exec=0` skips the multi-MB execution tuples server-side) and committing only when a previously-bare bar gains flow. NOTE the prior session's "16:10Z bare" probe was flawed (no orderFlow=1) — do not trust it.
- `fadc84bd` projected options volume profiles (NDX/QQQ/SPX/SPY) plotted "in a random spot": the futures profile's CME session anchors (22:00Z) don't exist on an RTH-only cash chart and the renderer's wall-clock fallback counted the overnight gap as bars. Profiles now re-anchor to the pane's own candle timeline (daily → that NY date's bars; weekly → last 5 NY dates; pre-open → pinned past the live edge); developingPoc filtered to the anchored window. Visual RTH verification pending (basis ratio needs a live cash quote).

### Eight-task batch (2026-08-20, later still — one commit each)
- `db679712` overlay clip: drawings/TPO-zones/Expected-Move SVGs now clip at the pane's right edge (shared per-chart `clipPath` sized by `nativePriceScaleWidth`) so position tools slide under the price scale like candles.
- `ae76b556` weekly TPO freeze: live tape/candle identity changes re-ran `buildTpoProfiles` (full weekly letter grid) several times a second; now a 5s trailing-throttle cache plus a models-signature gate on `primitive.setModels`.
- `93c3442b` indicator library: category counts removed; mojibake "Â·" (the "weird a") fixed across the control.
- `123e6ffb` search always spans the whole catalog regardless of the selected category tab.
- `5ca8db90` "NQ · 5m · this chart" meta row removed from the indicators dropdown header.
- `af64d704` every lower pane gains a recenter button under the minimize control (clears manual wheel-scale/drag/locked domain); CVD Divergence was fully built but missing from `LIVE_CHART_INDICATOR_IDS`, so the library showed a disabled "Pending" — now addable.
- `104a0d60` GEX Map STAR view previously lit only the Star node, silently no-opping Highlighted nodes / Selection strategy / Spot-proximity weighting / Minimum map control; the structural highlight set now renders in star view too.
- `997cbc6a` first CVD flow-heal pass at 60s after pane load (steady state 240s). RTH soak of the heal loop still pending.

### Footprint render cache (2026-08-20, latest)
- `8422c1ef` the footprint primitive repainted every visible cell — thousands of fillRect/fillText plus per-bar flatMap allocations and percentile sorts — on EVERY chart invalidation (crosshair moves, live ticks, sibling indicator updates), the reported "footprint lags the whole site". It now paints once into an offscreen canvas and re-projects with a single drawImage; repaints only on data/options/size/h-zoom change or a price rescale beyond 2% (same pattern as the gamma-heatmap `a3072862` fix). `renderVersion` on the primitive tracks staleness; surface released on detach. Verified live: cells/POC/value-area/live-bar outline render correctly on NQ 5m; console clean. RTH interaction soak pending (remote rAF sampling was background-throttled, so no jank numbers from here).

### IB fibs on every session (2026-08-21)
- `29d47e42` each fib set now terminates at the NEXT session's open (`endTime` on the render level, which the primitive already clips to) instead of extending right forever; the newest set stays open-ended to the live edge.
- `a3518106` IB Levels "Fibonacci" previously drew 50/61.8/78.6% on the MOST RECENT completed IB only; it now emits a set for every completed IBH/IBL pair on the chart (each session type × each lookback day), anchored at the bar that completed that pair, Long/Short mirroring unchanged. `test:initial-balance` green.

### Magnet snapping (2026-08-21)
- `22a101f9` Fib/trend anchors with the magnet on "glitched"/"spazzed": the magnet snapped unconditionally in PRICE space to the time-nearest candle's nearest OHLC (no distance limit, full candle scan per pointer move), so hovering anywhere yanked the anchor to far-off values and every drag pixel re-snapped. Now: pixel-space snap to the bar under the cursor only within 18px (binary-searched bar), placement clicks always lock (click the high, click the low), pointer moves/drags are velocity-aware (>0.9px/ms moves freely, snapping engages as the pointer slows) with 30px release hysteresis so a lock cannot flicker between neighbours.

### Fixed VP rework + Charts replay (2026-08-21)
- `a19b7bde` Fixed Range Volume Profile rebuilt: two-click wick-to-wick placement no longer glitches (the preview recomputed a full candle scan per mousemove; now memoized per bar crossed); granularity is settings-driven (Rows 20-200, default 80) with native-profile visuals (shared left spine, hairline rows, VA vs outside colours, POC row/line/label); double-click opens the settings dialog with a new Profile section (rows, value-area %, profile width %, POC toggle, outside colour) stored per drawing style (backward-compatible defaults); the profile body no longer drags — repositioning is only via the two anchor dots (body click selects).
- `0f6eb941` synchronized session replay enabled on the normal Charts workspace: replay gates generalized from gamma-only to gamma|charts, and the Replay toggle added right of the timezone control. Verified live: button present, replay bar engages on the latest completed session with candle reveal + pane sync.

### Renderer crash forensics (2026-08-21)
- `e94189fa` "Aw Snap while browsing" recurs with no evidence left behind, so every workspace page now runs `startRendererHealthRecorder` (mounted in AppSidebar): a 1s lag sampler + longtask observer + 5s localStorage snapshot (heap, worst stall, longest task, page, uptime, DOM nodes — describing the FINAL 5s window). A boot after an unclean end reports the snapshot to the browser console and POSTs it to `/api/telemetry/renderer` (Vercel function log, tag `[renderer-crash]`). Diagnosis rule: heapUsedMB near heapLimitMB ⇒ OOM; low heap + huge worstLagMs/longestTaskMs ⇒ main-thread starvation.
- Measured on a probe account: SPA browsing cycles (charts→gamvue→gexmap) oscillate heap 340-600MB with a baseline creeping ~+35-40MB per cycle — slow retention that, on the owner's five-pane workspace over hours, plausibly reaches the 4GB renderer ceiling. Naming the retainers needs a DevTools heap-snapshot diff across a navigation cycle (dev machine, not remote) — next diagnostic step if the crash reports show high heap.

### Replay live-tick gate (2026-08-21)
- `fb88b199` futures charts in GEX Vue replay didn't sync: every pane already receives the replay clock and reveals candles by it, but Chart's imperative live paths (LIVE_CHART_CANDLE_EVENT series.update + the live footprint execution handler) had no replay gate, so live Rithmic ticks kept painting today's forming bar over the replayed series. Both handlers now drop events while `replayTimestampMs` is active (ref-gated — no listener churn from the 200ms clock); setData resets the render refs on enter/exit so live resumes cleanly. `test:gex-vue-replay` green.

### GEX Map replay opening surface (2026-08-21)
- `93008b7e` "Replay is before the first recorded frame" on replay entry: the GEX Vue replay clock starts at the first candle while the first exposure bucket completes minutes later, and the 6h replay cache could also hold a partial live-session capture whose frames begin mid-day. ExposurePanel now clamps the replay clock to the session's first recorded frame (the opening surface paints from the very first replay bar — no lookahead beyond the opening frame), and when the recorded frames start >20min after the replay clock it requests ONE forced refetch per replay session (guarded set) to replace a stale partial capture with the complete archived session. Live view verified unregressed; owner-side GEX Vue replay check pending.

### Zero Gamma Bars + options-pane fixes (2026-08-20, latest)
- `8608a27c` new "Zero Gamma Bars" pane indicator: per-minute signed net dealer GAMMA of the chart's options family as a histogram (above zero = positive regime), reusing the Options Delta pipeline with the GEX Map GAMMA panel cache; registered in catalog/LIVE/RENDERED with "zgb" search alias. Same commit fixes Options Delta glitches: a frame-less panel refresh (session roll) can no longer blank the pane (payload retained until frames return), and both panes set `includeZeroInScale` so the zero baseline always stays in frame (bars previously drifted off-centre when the day ran one-signed).
- `f4456553` zero-gamma line was spreading candles apart: the per-minute trail times don't exist on a 5m (or any) chart's time scale, so Lightweight Charts inserted a whitespace slot per trail point. `paintZeroGammaLineOnBars` now resamples the trail onto the chart's own bar times (newest observation at or before each bar close) — zero extra slots on any timeframe including event charts. Verified: ZGB live in the library and addable; ZGB pane visual + spacing-under-line check owed at RTH (pre-open surfaces carry no buckets).

### Footprint incremental builds (2026-08-20, latest)
- `8ddbfb08` second half of the footprint freeze fix (first half: `8422c1ef` render surface cache). The DATA pipeline rebuilt every visible bar from the full RTH tape (100k+ prints) several times a second: the imperative live path every 500ms plus the React sampling path every ~1s, each twice over when per-bar profiles use their own grouping, plus the POC-auction grouping. New `buildFootprintBarsCached` (footprint.ts): closed bars are reused while the candle window and settings are unchanged; only the forming bar rebuilds from its own prints (binary-searched tape slice); full reconcile on window/settings change, bar roll, or 30s. Five call sites swapped, one cache per consumer per grouping. Verified live: footprint pane renders correctly on the new deployment; interaction responsive in remote screenshots. RTH jank numbers still owed (remote rAF sampling suspends in an occluded window).

### Zero Gamma intraday trail (2026-08-20, latest)
- `997e2fe6`+`60cd9bed`+`d3c37ba0`+`e907e4bb`+`9b2633c4`: the zero-gamma line previously carried ONE live point per poll with the intraday trace living only in client memory (refresh → straight segments between daily closes). It now derives one crossing per completed one-minute interval-map bucket via the same surface reconstruction GEX BOX uses (`nativeProfileFrames`→`zeroCrossing`), futures-mapped per minute through Databento 1m closes for NQ/ES and left on the option chain's own scale for NDX/QQQ/SPX/SPY. Guards: ≥20-strike surface + crossing within 10% of spot (early thin surfaces measured 13% off). Cost model: recurring 1-session poll fetches only the live trail (45s memo, RTH-gated); multi-session initial loads add the newest completed session's trail; cold builds race a budget and finish via `after()` so the 6h durable cache (`zero-gamma-trail-v2`) converges without holding responses.
- Verified live: trail content correct (468 pts over two sessions, NQ-mapped values beside spot); sessions=1 poll 1.9s. NOT yet verified: cold sessions≥2 latency — my own probe storm queued overlapping 300s background builds that congested the per-instance provider queue, and the day-before anchor's expired 6h cache also rebuilds on that path (pre-existing). If initial loads still crawl after queues drain, pull Vercel function logs for /api/zero-gamma-line before touching code. RTH check owed: line draws forward smoothly from the open on futures + options panes.

### LIQ MAP session replay (2026-08-20, later)
- `219886f1` gateway: HeatmapReplayStore distils a completed session's raw L3 archive (recorder NDJSON.gz) once into a replay pack — heatmap-shaped frames every 2s of market time, 30-min gzip chunks + manifest; routes `/v1/heatmap/replay` (manifest / building / honest 404) and `/v1/heatmap/replay/chunk`. Tests: heatmap-replay.test.mjs; suite 58/58.
- `240d5241` browser: heatmap-app replay mode (parent clock via postMessage, live feed stopped, bounded 4-chunk cache, scrub-back rebuild, per-asset packs on tab switch); LiquidityMapWorkspace forwards the GEX Vue clock at 1/s + status overlays; proxy allowlists the new paths.
- **OWNER ACTION: the gateway half needs a VPS deploy (`deploy/ship-to-vm.ps1`) before replay works end-to-end. Deploy outside RTH — restarting the collector writes a GAP marker into that session's archive.** First replay request per session/instrument triggers the one-time pack build (minutes); the UI reports build progress honestly.
- Replay coverage = whatever the recorder captured (NQ/ES etc. from its subscription list). No new data purchasable — Rithmic sells no L3 history; our archive is the only copy.

## Temporary engineering log — 2026-08-21 (volume profile ↔ DeepChart parity)

### Why
The owner wants the Daily Volume Profile to carry DeepChart's full `DP: DeltaVol`
settings surface so institutional users can tune it. DeepChart's parameters were
read out of its compiled assembly (`C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll`,
.NET 10, class `Deepchart.Collections.EnumeratorCalcMatcher`) with a metadata
parser: **107 direct properties + 36 in four nested settings classes = 143**.
Property signatures were decoded to resolve every dropdown's backing enum, so
the option lists are exact rather than inferred. Reference doc (artifact):
`DeltaVol Parameter Map`. Internally the feature is **VbP**, never "volume
profile" — searching the binary for the visible name finds nothing.

### Completed (each pushed as its own commit)
- `4fa05c67` **Data Settings tab.** `inputData` (Volume | Number of trades),
  `minTradeVolume`/`maxTradeVolume` (trade-size band), `groupingMode`,
  `autoGroupFactor`, `groupTicks`, with UI. Two real defects fixed: automatic
  tick grouping was hardcoded to **1 tick per row** (1,600 hairlines on a
  400-point NQ day) and now derives row height from the range the profile covers
  (`automaticVolumeProfileGroupTicks`, targets ~140 rows) × the factor; and
  `valueAreaPercent` was **discarded** in the render path, pinned to the 70%
  constant. Filters/manual ticks already existed server-side but had no defaults
  or UI, so they were permanently inert.
- `97a45234` **Peak and Valley, VWAP, Summary.** New pure module
  `src/lib/volumeProfileStructure.ts`: peak/valley detection over the grouped
  rows (sensitivity inverted into a comparison window, volume thresholds,
  exclude-high/low, outside-value-area filters, flat shelves collapse to one
  node), business zone = band between the outermost peaks, profile VWAP +
  volume-weighted standard-deviation envelopes, and summary totals. Rendered in
  `nativeVolumeProfilePrimitive.ts`; the renderer also stopped pinning the value
  area to 70%.
- `f8ca2763` **Developing POC.** The server already recorded POC per minute
  (`profile.developingPoc`, capped 2,000 points) but nothing drew it, so
  `showDevelopingPoc` was a dead switch. Drawn as a **step** trail — the POC
  holds a price until volume moves it, so interpolation would invent migration.

Settings schema is at `profileSettingsVersion: 8` with migrations that add new
keys only when absent, so saved workspaces keep their look. All new structure
features default **off**.

### Verification
`npm run test:volume-profile-data` and `test:volume-profile-structure` (both new:
grouping density, factor scaling, bin boundaries incl. negative ticks, filter
edges; peak/valley detection, thresholds, VA filters, shelf collapse, VWAP band
symmetry, degenerate input), plus `tests/chart-drawing-system.test.mjs` +
`precision-tools-system` 29/29, ESLint 0 errors, `tsc --noEmit`, `npm run build`
— green before each push. **No live RTH visual check yet.**

### Completed in the second pass
- `0fa2b306` **Filter/Split Time (server).** New pure `volumeProfileSessions.ts`:
  RTH, overnight, custom windows (including ones that wrap midnight) and a
  triple Asia/London/New York split. Windows resolve ONCE per profile and are
  compared numerically — asking Intl for the exchange-local time of every
  execution would run a timezone lookup hundreds of thousands of times a
  session. `sessionTradingDate` implements the end-session-as-start-day
  convention that puts an overnight profile on the date it finished on.
- `db43a404` **Filter/Split Time (client + UI)** wired through the profile
  request, with filter mode, window, custom session times and the trading-date
  convention exposed.
- `11812bea` **Plot Settings.** Extend modes (none / till-interaction /
  till-end-window), the five line-style dash patterns, and the Automatic /
  Solid / Hollow / Line / Combined histogram appearance plus border width.
  `till-interaction` stops a level at the first later bar whose range traded
  back through it.

**The value-area percentage was discarded in FOUR separate places** between the
settings dialog and the tape — the render path, the primitive, the API route and
the client fetch all pinned it to the 70% constant. All four now honour it.

Schema is at `profileSettingsVersion: 10`; every migration only fills absent
keys, and all new behaviour defaults to the previous look.

### Remaining (not started)
- **General tab** (`VbpPeriod` AllBars|MultipleProfile|VisibleBars|CustomTime|
  LastsProfile, `LengthType`/`LengthValue`, custom date range). Our profiles are
  built per CME trading date; arbitrary periods need the request layer to accept
  a span rather than a date, and `numberOfProfiles` is stored but not yet used to
  bound how many historical profiles render.
- `FilterMode` **Splitted/Triple currently filter rather than split** — the
  windows are resolved and applied, but one profile object is still produced per
  period, so the segments are not drawn as separate profiles. Selecting them
  behaves as Filter over the union of the windows. Splitting needs the request
  layer to emit one profile per segment.
- Plot width/offset (`WidthType`, current/previous offsets) beyond the existing
  width percentage.
- POC shifted-POC grouping + shift alerts.
- Nested dialogs not built: `ColorSettings` (12), `TextSettings` (4),
  `VWapDevSettings` (5 bands × 4 — we ship 3 simple σ bands instead).

### Concurrency note
Another engineer was working in this repo throughout. Their `KwantifyWorkspace.tsx`
(pane-header favourites) was left untouched and unstaged; every commit above was
staged file-by-file, never `git add .`. Note their commit `baa864e8` swept up an
uncommitted Chart.tsx profile-style block of mine — harmless, it is in main.

### Worktree state
`M src/components/KwantifyWorkspace.tsx` (theirs, in flight), plus the usual
`?? ALGO/`, `gexcal-*`, `tmp/pdfs/*` from other workstreams.

## Engineering handoff — 2026-08-22 — QuantData GEX BOX reconstruction

- Completed a signed-in, read-only product teardown of QuantData's dashboard,
  including its complete Options, Equities and News tool catalogue, panel
  actions, settings, page types, workspace behavior and customization model.
  The durable reconstruction audit is
  `docs/gex-box/QUANTDATA_RECONSTRUCTION_AUDIT.md`.
- Replaced the legacy hard-wired GEX BOX workspace loader with
  `src/components/gexbot/GexBoxDashboard.tsx`. The new dashboard has stable
  panel IDs, Grid and Infinite pages, a full Add Tool catalogue, panel-local
  settings, duplicate/maximize/delete actions, page-local persistence, and
  workspace import/export/reset.
- Browser panels use same-origin authenticated routes only. Core data-backed
  surfaces use the native QuantData/VPS adapters for interval exposure,
  GEX/DEX/VEX/CHEX, options flow, IV rank, dark-pool levels, equity prints,
  underlying prices and native GEX BOX frames. Unavailable normalized adapters
  show an explicit unavailable state and never substitute or fabricate data.
- Interval Map now accepts the observed QuantData aggregations (`1m`, `2m`,
  `3m`, `4m`, `5m`, `10m`, `15m`, `20m`, `30m`, `1h`, `2h`, `4h`) and Greek
  selection (`GEX`, `DEX`, `VEX`, `CHEX`) through the existing server adapter.
- Duplicated panels share request cache, in-flight requests and one polling
  timer per URL. The dashboard restores the previous completed New York RTH
  session by default and switches to existing live-ready server paths during
  session; it does not add a vendor connection or client credential.
- Verification: focused ESLint clean; `npx tsc --noEmit` passed;
  `npm run test:gex-box` passed 15/15; `node scripts/test-gex-box-dashboard.mjs`
  passed; production `npm run build` passed.

## Temporary engineering log — 2026-09-03 — live-feed outage containment

### Completed
- Confirmed the 2026-09-02 outage had two shared causes rather than three
  independent route bugs: whole-session archive work blocked the collector's
  single Node event loop, and the QuantData surface archive exhausted quota
  shared by every options/GEX request.
- Moved both bar-flow and session-profile folds into one serial worker-thread
  queue. Archive reading, sorting and aggregation no longer execute on the
  event loop that serves Rithmic ticks, SSE, options, GEX and `/health`.
- Replaced synchronous gzip/gunzip in those warmers with asynchronous zlib.
- Paused both archive warmers throughout the protected live options session,
  so their worker CPU cannot compete with the feed on the 1-vCPU collector.
- Made the optional QuantData archive incapable of polling during the live US
  options session, even if its environment flag is enabled accidentally.
- Added an event-loop load guard to `/health`; after a measured stall it sheds
  only deferrable archive/history routes for 30 seconds while live streams,
  snapshots and health retain priority.
- Hardened the Windows-to-Linux deploy helper: staged shell scripts are
  normalized to LF and any failed SSH, SCP or bootstrap step now aborts rather
  than printing a false successful-deployment message.

### Commit
- Current scoped local commit: `Keep archive work from freezing the live desk`.

### Verification
- Gateway suite: 300/300 passed.
- A real 250,000-print worker fold completed while a 5ms main-thread heartbeat
  remained below the 250ms failure ceiling.
- Scoped ESLint and `node --check` passed; `npx tsc --noEmit` passed; production
  `npm run build` passed.

### Production/VPS actions
- VPS gateway deployed outside RTH on 2026-09-03 from an isolated clean
  worktree; unrelated native and SOCIALS changes were not shipped.
- Post-deploy health was connected and authenticated, `lastMessageAt` and
  recorder counts advanced, 30 concurrent health requests returned 30/30
  HTTP 200, and the event-loop guard reported zero trips.
- No Vercel deployment was triggered, avoiding another billed build.
- Vercel `main` push remains subject to the explicit duplicate-project hold in
  `AGENTS.md`; do not bypass it.

### Remaining risks
- Production verification must check that `/health.eventLoop` is present,
  both archive statuses are present, `lastMessageAt` advances, expected
  instruments remain populated and recorder counts advance. A non-RTH
  deployment cannot prove live RTH behavior.

### Worktree state
- Numerous native rebuild, SOCIALS, PDF and local test artifacts belong to
  other workstreams. They were preserved and excluded from this task.

## Temporary engineering log — 2026-09-03 — position-tool handles welded to corners

### Product direction confirmed by owner
- The launch target is a professional multi-user release next month, with the
  website feeding the later .NET desktop conversion.
- Active market-data providers are Rithmic and QuantData. Databento is legacy
  and must not be treated as an active runtime dependency. QuantData is an
  interim non-redistributable source; a distributable provider such as Theta
  Data is planned subject to licensing.

### Completed
- Traced the moving Long/Short Position SL/TP handles to two competing screen
  geometries. The painted zones imposed a hidden 40px minimum width while the
  handles followed the real time anchors, so zooming or narrowing the tool
  made the dots slide inside the box.
- Added one shared `positionToolScreenGeometry` result for both painted zones
  and all four corner handles. Removed the visual width clamp; the drag model
  remains the authority for the minimum time span.
- Corrected two stale position-tool assertions left behind by the earlier
  colour override and legacy-toolbar removal changes.

### Verification
- Position resize regression: 9/9; generic handle-grab: 10/10; position
  colours: 7/7; migration: 7/7; default size: 5/5; primitive: 6/6; anchoring:
  7/7; magnet: 7/7; chart drawing + precision suites: 33/33.
- A temporary local render of the real `ChartDrawLayer` at a 12px projected
  width measured both painted zones at x=100..112 and all four handle centres
  exactly on x=100/112. The harness was removed after inspection.
- Scoped ESLint, `npx tsc --noEmit`, and the 80-page production build passed.

### Deployment
- No Vercel build or push was triggered. `AGENTS.md` still requires explicit
  owner confirmation that the duplicate `websiterepo` Vercel project is
  disconnected before `main` may be pushed; keep only `websiterepo-yfmi`.

## Temporary engineering log — 2026-09-03 — continuous archive truth audit

### Completed
- Verified the production recorder against advancing live VPS evidence rather
  than configuration alone.
- Fixed unmapped Rithmic templates losing their preserved wire bytes between
  protocol decoding and the recorder event.
- Made planned collector shutdowns write the same explicit GAP boundary used
  for unplanned feed loss before the recorder closes.
- Routed the direct QuantData snapshot, history and cash-session collectors
  into the central raw-response archive; vendor-edge requests were already
  covered.
- Added real archive-filesystem capacity to `/health` without making low disk
  trigger a destructive autoheal restart loop.
- Classified the standalone VPS gateway as unshipped website code in the
  Vercel ignored-build gate, with regression coverage.

### Verification
- Gateway suite: 309/309 passed after the final changes.
- Focused archive, QuantData and unmapped-wire tests plus `node --check`
  passed. Deploy-cost suite remains blocked by an unrelated stale Gamma
  Heatmap revision assertion that predates this task; the new build-gate case
  itself was also exercised with a synthetic Git range.

### Production/VPS actions
- Gateway deployed from an isolated clean worktree so the in-flight native and
  SOCIALS changes were not shipped.
- Production re-check: connected/authenticated, advancing timestamp and
  recorder counts, no writer drops, raw bytes present on newly arriving
  unmapped records, QuantData archive advancing, and archive storage reported
  critical at the real filesystem capacity.
- Main pushed; the Vercel ignored-build gate skips this gateway/docs/scripts
  only commit, avoiding a website build that cannot change production bytes.

### Remaining risks
- The VPS filesystem is 92% used: 52 GB of recordings on an 80 GB disk, only
  5.8 GB free. No off-box backup credentials, backup client or scheduled job
  exists. Indefinite retention is impossible until the owner supplies an
  S3-compatible object-store destination or a larger attached volume. Nothing
  was deleted.
- QuantData is request/response, not a push tape. Every response the gateway
  receives is now archived, but polling every endpoint continuously remains
  disabled in live hours because it previously exhausted the shared quota and
  froze GEX. More sampling requires an explicit quota/licensing decision.

### Worktree state
- Native rebuild, SOCIALS, PDF and local test artifacts from other workstreams
  remain dirty and were preserved. Only the scoped archive/gateway/cost files
  were staged.

## 2026-09-03 — Gateway deployment health probe

- Replaced the VM host's unreachable `127.0.0.1:8793` deployment probe with a
  probe executed inside the private gateway container network.
- Added a regression test so future deployments fail fast instead of waiting
  through a false 150-second health timeout and reporting a blank result.
- Removed Databento and Massive from the deploy credential-preservation list.
  They are retired production providers; only QuantData is preserved alongside
  VPS-owned internal-service credentials.
- Vercel's live deployment log showed `No comparable base in this shallow
  clone — building.` Its shared-IP GitHub REST fallback then hit a live 403.
  The final gate uses a validated, public, depth-two Git fetch with no REST
  quota; ambiguous history continues to build safely.
- The live hook also omitted repo owner/slug variables. The recovery URL is
  therefore fixed to this project's public `kwantdesk/websiterepo` `main`
  branch; `vercel.json` already disables deployments from other branches.
- Final live finding: `.vercelignore` removes `.git` before the hook. The gate
  now uses GitHub's non-REST public `.diff` transport, with strict size,
  truncation and path validation, and is tested from a non-Git directory.

## 2026-09-03 — Volume-profile level chaining

- VAH, POC and VAL now obey a structural geometry invariant: each level starts
  at its own profile, historical levels stop at the nearest newer profile, and
  the newest level reaches the chart pane's right edge.
- Removed candle-interaction shortening and the associated UI/config option;
  price crossing a level no longer causes arbitrary mid-chart cutoffs.
- Chronological ordering prevents older or same-session profile bodies from
  clipping newer levels. Vertically off-screen profile bodies remain valid
  chain boundaries so vertical panning cannot create overhangs.
- Removed the unused per-render candle-to-interaction-bar mapping and added
  focused regression coverage for the line-chain invariants.

## 2026-09-03 — Public launch direction and capacity charter

- The owner set an October 2026 paid website launch target. Product completion
  and professional-quality bug repair lead the month; the native
  .NET/Avalonia/Skia application follows the website launch.
- The durable owner-approved launch brief is
  `docs/PUBLIC_LAUNCH_ENGINEERING_CHARTER.md`. It records the quality standard,
  reported product acceptance requirements, provider/licensing boundaries,
  subscription sequence, 100-user launch architecture, 250-user sustained and
  500-user burst proof targets, latency objectives, reliability/chaos gates and
  the working USD 500-800 monthly launch budget with an $800 cap.
- Public customers bring their own Rithmic entitlement. QuantData is interim
  and non-redistributable. Subscriber options data must come from the separately
  licensed distributable source. Databento and Massive remain retired active
  production providers.
- One hundred users is the initial admitted load, not a design ceiling. The
  production system must scale by adding isolated session workers and stateless
  gateways rather than requiring an application rewrite.

### Verification

- Documentation-only change. No runtime code, provider connection, production
  service or customer data was changed.

## 2026-09-03 — Theme-aware scrollbar system

### Completed

- Replaced the global hard-coded black/dark-grey scrollbar colours with track,
  thumb and hover tokens derived from each theme's existing background, panel,
  surface, muted and primary colours.
- Applied the WebKit skin at document scope so first paint and workspace
  restoration cannot fall back to native dark chrome while the cockpit body
  class is absent. Removed native scrollbar arrow blocks, rounded the geometry
  and themed the corner where horizontal and vertical tracks meet.
- Removed GEX Calendar's feature-local scrollbar override so it inherits the
  same site-wide contract.
- Added a regression test that proves every current preset keeps both the
  resting and hover thumb at a minimum 3:1 contrast against its track.

### Verification

- `npm run test:theme-scrollbars`: 4/4 passed.
- `npm run test:themes`: 8/8 passed.
- Scoped ESLint passed; `npx tsc --noEmit` passed; the 80-page production build
  passed.
- Rendered the real local Settings workspace in Inverted Mono, Playdough Parade
  and Kwant Desk. Light and dark vertical scrollbars followed their themes,
  retained visible thumbs and no longer showed the black native track/arrow
  blocks from the owner screenshots. The overflowing chart/navigation header
  was also checked at a 1,111px viewport.

### Production/VPS actions

- Website-only change. No VPS or provider process changed.

## 2026-09-03 — Rithmic candle-history integrity overhaul

### Completed

- Removed the six-hour event-history clamp that made a five-session 40R chart
  look like roughly twenty minutes of history. Full requested windows now page
  through the compact Rithmic execution archive, with a dedicated bounded
  timeout sized from the measured production response time.
- Tape requests now use the contract's real CME, CBOT, COMEX or NYMEX venue.
  Micro contracts are resolved exactly and are never silently substituted with
  their parent mini.
- The gateway compact tape now follows every configured Rithmic subscription
  and allow-listed root instead of only NQ, ES and their micros. The offline
  backfill accepts an explicit root list for restoring pre-change sessions.
- Same-millisecond executions remain atomic across archive pagination. A page
  boundary can no longer lose legitimate prints or replay them twice.
- One-, five-, fifteen-, thirty- and forty-five-second candles are now folded
  directly from individual executions with exact OHLCV and aggressor flow.
  Minute bars are no longer relabelled as second bars. Daily bars follow the
  17:00 America/Chicago trading-session boundary; monthly intervals no longer
  parse as one minute.
- Rithmic quote/BBO midpoints no longer create or extend candle wicks. Removed
  heuristic wick clipping, body movement, despiking, re-anchoring and synthetic
  zero-volume gap candles; malformed OHLC is rejected instead of rewritten into
  plausible false data.
- Renko and range bridge geometry attributes each execution's volume/trades/
  delta exactly once. Point & Figure now preserves its box anchor, extends by
  complete boxes and requires its configured reversal distance.
- Default event-chart requests fail closed unless the returned candles cover
  at least five trading sessions. Partial history is explicit, never presented
  as a complete quiet market.

### Verification

- `npm run test:rithmic-candle-integrity`: 53 futures instruments x 50 interval
  definitions, 2,650 combinations passed with deterministic batch parity,
  tick alignment, structural OHLC and exact volume conservation.
- Rithmic gateway suite: 314/314 passed, including exact sub-minute bars,
  session boundaries and lossless page cutoffs.
- Event/history/gap/interval/execution regression suites passed; TypeScript and
  scoped ESLint passed with zero errors. The 80-page production build passed.

### Operational constraint

- The production recorder disk was observed at 92.7% used (5.84 GB free). No
  raw market data was deleted. Extending live capture beyond the currently
  configured/entitled Rithmic roots requires off-box backup or a larger volume;
  silently trading retention for breadth is prohibited.

## 2026-09-03 — Theme-aware quick measurement gesture

### Completed

- The transient right-drag chart ruler now derives its outline, fill and value
  label from the chart's current bullish/theme colour instead of fixed blue.
  The colour is adjusted only when necessary to retain 4.5:1 contrast against
  the actual chart background; elapsed-time text also follows that background.
- Fixed the Windows browser event-order bug where `mouseup` cleared the active
  drag before the subsequent `contextmenu` event arrived. A completed drag now
  carries a bounded, one-use release latch across that boundary and cannot open
  the standard chart menu when the trader lets go.
- A stationary right-click still opens the menu. Starting another deliberate
  right-click clears any stale latch, so suppression cannot leak into a later
  interaction.
- Tightened the shared contrast helper to test the final rounded CSS hex value.
  Its previous floating-point candidate could pass 4.5:1 and then round down to
  4.4908:1 when painted.

### Verification

- Quick-measure regression: 4/4, including every current theme palette.
- Theme suite: 12/12; chart drawing system: 18/18; candle context menu: 6/6.
- Scoped ESLint and `npx tsc --noEmit` passed.
- The 80-page production build passed.
- Local browser navigation reached the expected Google sign-in boundary; the
  local origin did not share an authenticated application session, so no live
  signed-in visual claim is made.

## 2026-09-03 — Bright theme signature on every KwantDesk mark

- Replaced the 76%-foreground logo mix that made every palette look grey with
  one shared brand-colour resolver. Neutral surfaces use the exact bright
  primary; coloured surfaces choose the exact primary/accent/secondary hue
  furthest from the background while retaining at least 3:1 graphical contrast.
- Shell and chart tokens are measured separately against `background` and
  `chartBackground`. Both are installed during first-paint bootstrap and live
  theme updates, preventing a neutral flash or hydration colour change.
- Applied the shared masked wordmark paint to the top-left header, standard
  charts, Liquidity Map and the large authenticated home-workspace mark.
  Public landing/auth branding was intentionally left outside the cockpit theme.
- Forest Fire explicitly resolves orange on green; Midnight resolves pink on
  black; Chromey resolves green on black; Tangerine resolves orange on teal.
- Verification: brand marks 9/9 across every current preset, wordmark geometry
  4/4, themes 12/12, first-click theme sync 5/5, scoped ESLint, TypeScript and
  the complete 80-page production build all passed.

## 2026-09-03 — Indicator Save restored to the dialog header

- The shared Save/Cancel row was accidentally rendered as a sibling of the
  settings window inside its centring overlay. Flex layout therefore placed it
  beside the modal and over the chart instead of inside the indicator dialog.
- Removed the floating footer and moved the catalogue-wide Save action into
  the fixed title bar immediately before Close. Long settings pages now scroll
  beneath fixed actions; long names truncate safely on narrow windows.
- The existing live preview, clean-baseline Save and close-time Save/Discard
  safety behavior are unchanged. Because all studies use this one dialog, the
  correction covers every current and future chart indicator rather than only
  Daily Volume Profile.
- Verification: indicator settings Save 11/11, scoped ESLint, TypeScript and
  the complete 80-page production build passed.

## 2026-09-03 — Catalogue-wide numeric indicator sliders

- Replaced native spinner-only and slider-only numeric settings with one shared
  editable numeric field and theme-native precision rail. Browser up/down
  spinner arrows are removed; users can drag, use the keyboard, click into the
  value, or double-click to select and type an exact number.
- Applied the shared control to all 300+ numeric definitions in the chart
  indicator catalogue, every purpose-built Daily/Session/Composite Volume
  Profile tab, Footprint, TPO, POC, Value Area, Gamma/VIX Environment and the
  separate Single Volume Profile/TPO workspaces. Drawing-tool geometry remains
  a separate subsystem.
- Every control clamps to its declared minimum/maximum and exact step. Very
  large positive ranges use a logarithmic rail, while large signed ranges use a
  symmetric logarithmic rail around zero, preserving usable precision without
  changing the value stored by the indicator.
- Gamma and VIX box scale is presented as an understandable 60–200 percent
  rather than exposing its internal 0.6–2 multiplier.
- Verification: slider contract 9/9, indicator Save 11/11, Volume Profile live
  settings 8/8, TPO wiring 6/6, Footprint chart types and theme suite 12/12 all
  passed. Scoped ESLint, TypeScript and the complete 80-page production build
  passed.

## 2026-09-03 — Candle-style transition buttons restored

- The Candles, Hollow Candles, Heikin Ashi and Heikin Ashi Hollow buttons were
  correctly saving and highlighting their style id, but the chart's incremental
  drawing guard did not treat every style selection as a full-series change.
- Leaving Heikin Ashi therefore replaced only the newest bar with real OHLC and
  left the historical chart averaged, making the selected button appear to do
  nothing. Every explicit style change now replaces the complete visible series
  once, while normal incoming candles retain the incremental path.
- Verification: candle style 11/11, context menu 6/6 and candle visibility 5/5
  passed; focused test lint, TypeScript and the complete 80-page production
  build passed. Direct ESLint parsing of the 18,000-line chart component exceeded
  Node's 8 GB heap; TypeScript and the production compiler both validated it.

## 2026-09-03 — Last-used quick action on the live drawing rail

- The mounted `ChartDrawToolbar` always fell back to the first tool in a group
  after a drawing completed. A separate last-used state existed in the hidden
  legacy toolbar but the live rail neither read nor wrote it.
- Every live rail group now validates and remembers its latest selection. An
  Extended Line selection immediately makes Extended Line the Lines button's
  visible one-click action after the active tool returns to Cursor.
- Recent tools are independent per group, synchronized between all mounted
  chart panes with a same-window event, synchronized between tabs with the
  storage event, and restored after reload. Invalid/stale cross-group values
  are rejected before they can replace a rail icon.
- Verification: recent-tool contract 5/5, single-toolbar audit 9/9, drawing
  anchoring 7/7, grab handles 10/10 and position-tool behaviour passed; scoped
  ESLint, TypeScript and the complete 80-page production build passed. The
  unrelated legacy drawing-selection source-shape assertion was confirmed
  already stale against the unchanged committed `ChartDrawLayer.tsx`.

## 2026-09-03 — Atomic chart history first paint

- The shared chart pane used to remove its loading cover when it found any
  cached rows. A stale, shallow or live-only cache could therefore appear as a
  field of one-price dots before the authoritative ES/NQ history replaced it.
- Readiness is now bound to the exact broker, instrument, timeframe, period and
  replay window. Changing any of them synchronously covers the previous series,
  before the loading effect gets a chance to clear old state.
- Cached rows remain useful merge input, but become visible only after freshness,
  required history depth and the live seam pass verification. A completed
  authoritative download also releases the cover atomically; broken seams stay
  covered through reconciliation.
- Failed requests show the provider's honest error instead of partial candles
  or an endless loader. The contract lives in the one workspace chart pane, so
  it applies to every supported instrument and time/event interval.
- Verification: hydration cover 6/6, chart-history failure state 4/4,
  event-bar first paint 7/7, candle-gap integrity 7/7, page loaders 5/5 and the
  Rithmic 53-instrument × 50-interval matrix (2,650 combinations) passed;
  focused ESLint, TypeScript and the complete 80-page production build passed.

## 2026-09-04 — Vercel volume-profile retry-storm containment

### Completed

- Vercel observability identified the dominant current-cycle leak: roughly
  274,000 `/api/institutional-market-data/v1/market-data/volume-profile`
  invocations in twelve hours, 98.5% failing.
- Root cause: one failed developing profile kept `currentDailyProfileLoaded`
  false, which re-requested every visible historical date/session for every
  pane every two seconds. Failed keys were not cached, so duplicate callers
  immediately repeated the same request.
- Completed sessions now load once, recover on a bounded five-minute cadence,
  and never join the live reconciliation loop. The developing profile
  reconciles once per minute while healthy and backs off from 15 seconds to
  five minutes during failure.
- Added a bounded per-request-key negative cache so concurrent panes and
  repeated effects respect the same exponential retry window.
- Removed the retired Databento execution-profile branch from the production
  market-data route. Volume profiles now have one active authority: the Rithmic
  execution archive on the VPS gateway.

### Verification

- Cost-containment regression: 8/8.
- Volume-profile session toggle 5/5, filter 5/5, split 7/7.
- Shared live-market routing regression passed.
- Scoped ESLint: zero errors (existing workspace warnings remain).
- `npx tsc --noEmit` passed and the complete 80-page production build passed.

### Worktree safety

- Existing native, SOCIALS, PDF and local test work remains untouched and
  unstaged. Only the route, shared profile client, workspace profile lifecycle,
  focused tests and this handoff entry belong to this change.

## 2026-09-04 — Liquidity Map Chromey contrast and live-chart continuity

- Fixed the Liquidity Map's misuse of Chromey Mono's black hollow-candle body
  as Sell/Ask UI ink. Bid/Buy remains bright green; Sell/Ask DOM values and
  trade bubbles now use a distinct pale green. Both market sides are resolved
  against chart and ladder surfaces at a 4.5:1 minimum across all 44 themes.
- Best-price labels now derive readable black/white ink from their actual fill,
  and the embedded module chain is cache-busted so an existing browser cannot
  retain the black-on-black palette.
- Diagnosed the reported Rithmic lag with a direct production-path sample:
  92 NQ/ES packets in 12 seconds, 117 ms average inter-packet gap. The gateway
  was live; the perceived refresh was a client continuity watchdog placing the
  loading cover over an already-settled chart during background seam repair.
- Runtime seam repair now stays silent and in-place while fresh Rithmic ticks
  continue painting. Initial instrument/timeframe loads remain atomically
  covered. The nested live dispatch guard now includes GEX Map as well.
- Verification: theme contrast 2/2, theme suite 12/12, Liquidity Map embed and
  volume colours 8/8, chart hydration 6/6, live-market routing passed, and the
  53-instrument x 50-interval Rithmic matrix passed. Scoped ESLint reported no
  errors (20 existing warnings remain). TypeScript and the full production
  build both pass.

## 2026-09-04 — Rithmic visible quote cadence

- A live NQ/ES trace proved the shared Rithmic book was reaching the browser
  without a two-second throttle: packets arrived as close as 20–50 ms apart
  and about 300 ms behind their provider timestamps. The apparent pause came
  from the chart deliberately painting only packets flagged as executions;
  during quiet Globex periods, executions arrived in multi-second clusters
  while genuine best-bid/best-ask updates continued between them.
- Every accepted Rithmic book packet now publishes a pane-scoped live quote
  event. Chart BID and ASK axis markers consume it directly through one
  animation-frame coalescer, bypassing React and updating without waiting for
  a trade. Candle bodies, closes, highs and lows remain execution-only, so the
  faster display cannot manufacture false wicks or traded prices.
- The routing regression and TypeScript checks pass. The gateway health audit
  also exposed a separate urgent capacity risk: `/recordings` is 97.7% full
  (about 1.8 GB free). No historical data was deleted.

## 2026-09-04 — Rithmic candle-cadence correction

- Trader verification rejected the ordinary-chart BID/ASK markers; they were
  the wrong UI and did not address the slow candle. The quote event, price-line
  listeners, marker refs and compatibility export have been removed. BID/ASK
  remain a Liquidity Map concern only.
- Root cause was the September 3 execution-only filter in the ordinary Rithmic
  time-chart path. It discarded accepted price packets between sparse packets
  tagged as trades, making NQ and Footprint appear to freeze for seconds.
- Ordinary time candles once again consume every validated Rithmic price packet
  through the existing animation-frame live-tail path. Execution-only event bars
  remain execution-only, and volume/delta/trade counts still require trade tags.
- Active Footprint delivery now matches the 40 ms execution-worker cadence;
  inactive panes remain bounded at 750 ms to protect multi-pane performance.
- Verification passed: live routing, the 2,650-combination Rithmic matrix,
  candle gap/gap-fill, event source/first-paint, Footprint bar window, execution
  worker backpressure, live chart memory, TypeScript and the 80-page build.

## 2026-09-04 — Remove periodic NQ chart refreshes

- The Rithmic quote path and the exact execution/Footprint path were both
  imperatively painting live data and also forcing the complete React candle
  array through the chart every two seconds. The duplicate full-state commits
  caused the visible periodic pulse/refresh and unnecessary indicator work.
- Both Rithmic paths now publish forming-bar updates only through their direct
  chart events. The complete candle array is committed to React only when a
  genuine new bar opens. Exact execution accumulation continues in refs, and
  active Footprint canvas delivery remains at 40 ms.
- Verification passed: live-routing anti-refresh contract, the 2,650-case
  Rithmic matrix, candle gap/gap-fill, Footprint bar-window, execution-worker
  backpressure, live-chart memory, TypeScript and the full 80-page build.

## 2026-09-04 — Stable live-price contrast and cadence audit

- Lightweight Charts was allowed to inherit the forming bar's body colour for
  its live-price line. Chromey Mono's intentional black falling body therefore
  made the line and price label alternate between green and black-on-black.
- The candlestick series now owns a stable live-price colour derived from the
  theme's bright/up ink and forced to 4.5:1 contrast against the chart. It is
  supplied on first creation and every later settings repaint; candle colours
  themselves remain untouched.
- A simultaneous 12-second production trace recorded 151 raw NQ events (133
  depth, 17 BBO, one trade) and 50 priority quote frames. Delivered frame gaps
  tracked the raw exchange-event gaps, confirming there is no remaining
  client FPS throttle or two-second chart refresh to remove. Quiet intervals
  were not padded with synthetic prices.
- Verification: candle-style regression and all-theme contrast checks pass;
  TypeScript passes.

## 2026-09-04 — Remove VWAP price-scale tabs

- VWAP, VWAP Envelopes and Rolling VWAP inherited the overlay renderer's
  default right-axis last-value label. The six upper/lower envelope plots made
  that especially noisy and appeared as a stack of anonymous coloured prices.
- Every session VWAP, Rolling VWAP and corresponding upper/lower band now sets
  `lastValueVisible: false`. Lines, calculations, crosshair values and scale
  participation remain unchanged; only the right-axis tabs are removed.
- Anchored, volume-profile and Footprint VWAPs already draw through custom
  SVG/canvas primitives and create no Lightweight Charts price tabs.
- Regression coverage now requires every generated plot in all three VWAP
  indicator families to keep its last-value tab disabled.

## 2026-09-04 — Chain IB levels at session boundaries

- IBH, IBL and the optional IB Fibonacci set were all open-ended, so every
  enabled historical session ran through later profiles to the live edge.
- A strict next-distinct-session resolver now gives historical IB levels the
  same hand-off geometry as volume-profile value-area levels: each old set
  stops exactly at the next enabled session start and only the newest set
  remains open to the right edge.
- The comparison is strict so multiple 15/30/45/60-minute balances sharing one
  session do not cut one another off. IB fibs consume the same boundary as
  their IBH/IBL pair, and end-anchored labels remain inside their own segment.
- Verification: IB duration/chain 8/8, Initial Balance calculation,
  timeframe-independence and Globex suites pass.

## 2026-09-04 — Dedicated Vultr recording storage

- The gateway's 80 GB root disk reached 98% usage because the 57 GB Rithmic
  archive lived in the Compose-managed `deploy_recordings` volume. It was a
  direct feed/recording outage risk, not Vercel storage.
- A dedicated 250 GB Chicago Vultr NVMe volume now mounts persistently at
  `/srv/kwantdesk-recordings`; Compose bind-mounts it at `/recordings`.
- Bootstrap fails closed when that filesystem is absent or unwritable, and a
  Docker systemd drop-in requires the mount before restart-policy containers
  can start after a reboot.
- The archive was copied live, checksum-synchronized, final-synchronized while
  the gateway was stopped, and matched at 877 files / 60,230,195,587 bytes.
  The controlled gateway cutover lasted about ten seconds. Only after live
  health and advancing recorder counters passed was the verified root-disk
  duplicate removed.
- Post-cutover: root disk 19% used with about 58 GiB free; recording disk 25%
  used with about 177 GiB free; Rithmic connected/authenticated, NQ and ES
  counters advancing, zero reported recorder drops, event loop not overloaded.
- This same-region block volume is not an off-box backup. Add nightly verified
  archival-object-storage replication before public launch.

## 2026-09-04 — Rithmic History Plant candle backfill

- Production History Plant entitlement was verified with `rp_code 0` on its
  independent infra-type-3 session; the live Ticker Plant remained connected.
- Added replay protocol coverage for time bars (202/203), tick bars (206/207)
  and volume-profile minute bars (208/209), plus a standalone heartbeat-aware
  one-request-at-a-time history client.
- A restart-safe importer now merges one-minute bars atomically into the
  permanent archive, rejects malformed OHLC and accounts response bytes under
  a hard 36 GiB weekly safety ceiling below Rithmic's 40 GB allowance.
- Rithmic rejects a single 20-month replay with code 12 (`output inhibited`),
  so imports run as independently committed seven-day windows. This bounds
  provider output and limits any reconnect/reboot retry to one week.
- The importer is installed as a boot-enabled systemd service with explicit
  Docker and `/srv/kwantdesk-recordings` mount dependencies. Its persisted
  window ledger skips completed work and resumes/catches up after maintenance.
- Historical continuous bars are requested by product root (`NQ`), not expired
  contract (`NQH5`). The January 2, 2025 NQ pilot returned 1,380 rows with zero
  invalid bars. Chart history falls back from the current exact contract to
  that same root only for sessions where the exact contract file is absent;
  exact live recordings win and micro/mini products remain separate.
- The queue covers all 53 enabled CME-group roots from January 1, 2025, with
  the liquid equity-index roots first. Minute history serves all intervals of
  one minute or greater. Tick/volume/range/Footprint history remains a separate
  trade-tick and volume-at-price import phase and is never fabricated from
  minute OHLC.

## 2026-09-04 — Fixed range volume-profile VAH and VAL

- The fixed/anchored drawing calculator already produced the correct value-area
  boundaries, but its dedicated SVG renderer threw them away and painted only
  POC. VAH and VAL now use those calculated prices and span the same selected
  profile range as POC.
- Both value-area levels carry their proper labels. The existing label switch
  controls all three level labels.
- The double-click drawing settings now expose a VAH/VAL visibility switch and
  independent POC and value-area line colour/width controls. Existing drawings
  default the missing VAH/VAL switch to on, so no workspace migration or redraw
  is required.
- Verification: focused fixed-profile regression and native-control audit
  passed; TypeScript and the complete 80-page production build passed.

## 2026-09-04 — Guard history coverage for every offered future

- The website catalogue and the Rithmic History Plant runner both currently
  contain the same 53 CME-group futures roots, including distinct mini and
  micro products.
- The futures routing regression now requires exact catalogue/queue equality
  and rejects omissions, extras, exchange mismatches and duplicates, so a new
  offered future cannot silently launch without historical-bar coverage.
- Production's restart-safe backfill service was verified active. At the audit
  snapshot 1,235 seven-day windows were complete and the remaining queue and
  failed checkpoints were still being processed/retried under the 36 GiB
  weekly safety ceiling.
- This covers authoritative minute bars from 2025-01-01 and aggregation to
  larger timeframes. Event-based chart history still requires the separate
  trade-tick/VAP import and is never synthesized from minute OHLC.

## 2026-09-04 — Options-underlying history and important-notes ledger

- `docs/IMPORTANT-NOTES.md` is the persistent high-priority launch ledger.
  Every task handoff must recap its still-open items briefly and update their
  status when work closes or discovers a new material dependency.
- QuantData production probes proved January-2025 minute bars for all 13
  physical targets behind the offered options underlyings plus VIX. VXN
  returned no data and the separate index provider is not configured, so VXN
  remains explicitly provider-blocked.
- Permanent session capture now covers every physical ticker behind all 13
  options-flow symbols (SPXW correctly aliases SPX), plus VIX. A dedicated,
  checkpointed service backfills from 2025-01-01 sequentially and stops during
  the US cash session so it cannot repeat the live-feed quota incident.
- Chart history reads the full local archive range before a tightly bounded
  provider fallback. Historical option chains/Greeks/trades remain distinct
  from underlying candles and are still an unresolved licensed-data task.
- Gateway Docker builds use lockfile-clean production installs without npm's
  optional audit/funding network calls; those calls stalled a live deployment
  while adding no runtime integrity beyond `npm ci` itself.

## 2026-09-04 — Big/Deep Contracts and Deep Effort live parity

- The installed licensed Deep Charts metadata separates marker-based Big
  Trades, box/projection-based Deep Trades and effort-versus-result Deep
  Effort. KWANTDESK keeps those calculations separate internally while Big
  Contracts presents simple `Show Big Contracts` and `Show Deep Contracts`
  controls in one settings panel.
- Deep Contracts uses only exact aggressive Rithmic executions, applies a real
  minimum size, clusters same-side nearby prints, keeps the box centred on the
  volume-weighted traded price and supports tick height, margin, opacity,
  border, projection length and close-cross termination.
- Big/Deep Contracts now paint directly from the execution event. Big Blocks
  paints directly from the forming Rithmic candle's executed ask/bid fields;
  neither waits for React's 750 ms indicator snapshot.
- Big Blocks now wires the exposed minimum/maximum delta percentage, maximum
  Delta Effort, minimum bars, average length, entry-zone range and maximum
  extension controls. Delta Effort uses the documented delta divided by bar
  width definition in contracts per tick.
- Focused regressions, existing Big Contracts/Big Blocks regressions,
  TypeScript and the complete 80-route production build passed. Interactive
  pixel parity remains explicitly open until safe native-window control is
  available.

## 2026-09-04 — Composite Volume Profile

- `composite-volume-profile` is active and uses one exact custom-period Rithmic
  execution request over the complete loaded candle range.
- It renders through `NativeVolumeProfilePrimitive`, is right-docked by default
  and develops from the shared immediate profile execution path.
- Keep Composite on the shared Volume Profile settings/template schema. Do not
  replace it with merged daily histograms or an OHLC volume-at-price proxy.
- The parity audit is `docs/deepcharts-composite-volume-profile-audit.md` and
  the prompt outcome is `docs/prompt-log/2026-09-04-25-composite-volume-profile.md`.

## 2026-09-04 — VWAP-family overhaul

- `src/lib/vwap.ts` is the shared deterministic VWAP calculator. Base VWAP is
  period-reset; VWAP Envelopes and Rolling VWAP are continuous and must not be
  reset at the CME reopen.
- Keep the five-band source/period/envelope settings backward-compatible via
  `normalizeStoredIndicator`. Old Rolling VWAP `length` migrates to
  `periodValue`; do not restore its removed session reset.
- The authoritative visible draw-on tool is `ChartDrawLayer`'s `anchoredVwap`,
  with settings in `ChartDrawSettings` and style persistence in
  `chartDrawTools`. Do not implement VWAP work only in the hidden precision
  rail or legacy `Chart.tsx` toolbar.
- Audit: `docs/deepcharts-vwap-family-audit.md`. Prompt outcome:
  `docs/prompt-log/2026-09-04-26-vwap-family-overhaul.md`.

## 2026-09-04 — Session Highs & Lows contract

- The study owns four DST-aware Chicago exchange-time windows: Globex
  17:00–16:00, Asia 17:00–02:00, London 02:00–10:00 and New York
  08:30–15:00. Do not relabel Sydney or a Tokyo-local window as either Globex
  or the defined Asia window.
- Draw the latest completed high and low for every enabled named session. The
  chart labels are names only (`Asia High`, for example): no `P1/P2/P3` rank
  and no numeric price suffix.
- Session Highs & Lows colours always come from `visibleIndicatorTheme` for
  the current chart. Do not restore the old Sessions-study colour link or
  persisted per-session swatches.
- Prompt outcome: `docs/prompt-log/2026-09-04-27-session-highs-lows.md`.

## 2026-09-04 — Contract rollover safety

- Never infer the active futures contract from the current calendar month.
  Resolve continuous roots through Rithmic front-month and keep exact contract
  symbols only for explicit replay/diagnostic requests.
- The collector owns a ten-minute, single-flight front-month cache. Continuous
  SSE leases resolve through it; the browser reconciles on mount, visibility,
  reconnect and the same cadence, then rotates shared futures streaming when
  a provider-confirmed contract changes.
- Keep mini/micro roots distinct. History Plant root minutes are canonical;
  locally recorded exact contracts may bridge a roll but must choose one
  highest-volume minute during overlap and never sum two contracts.
- Options roll by provider-listed expiration and New York session date, not a
  futures month code. Prompt outcome:
  `docs/prompt-log/2026-09-04-28-contract-rollovers.md`.

## 2026-09-07 — Session Imbalance

- `session-imbalance` is an independent 17:00 Chicago CME opening-range study,
  not an alias of `ib-levels`. Keep its developing range no-lookahead, its
  50/100% extensions exact, and historical hydration silent.

## 2026-09-07 — Auction Gap Tracker

- `auction-gap-tracker` is released only on complete classified one-tick rows
  with matching contract/bar geometry and continuous stream receipts. Keep its
  worker lifecycle fail-closed and its history/replay/closed-market alerts
  silent; never replace it with an OHLC opening-gap shortcut.

## 2026-09-07 — TPO catalogue alias

- `market-profile-tpo` is a legacy alias of `tpo-chart` / TPO Daily. Preserve
  canonical migration for old workspaces and favourites; never reintroduce it
  as a separate Pending catalogue row.

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

- `candlestick-bar` owns an independent Japanese-candle overlay with Minutes,
  Range and target/reversal `Vol Bars`. Despite the name, Vol Bars is not a
  fixed-volume threshold: Parameter 1 is target ticks and Parameter 2 is
  reversal ticks.
- Range/Vol Bars must use exact executions and remain empty without them;
  `flowOnly` history cannot reconstruct an intrabar price path. Preserve
  one-execution/one-bar order-flow accounting at reversals.

## 2026-09-07 — On Candle Stats

- `on-candle-stats` and `kwant-stats` share audited calculations but not
  presentation: the former is chart-anchored text, the latter remains a pane.
- COT, trade-side delta and price-level ratios require ordered executions and
  must remain blank when the tape is unavailable. Never infer those fields
  from OHLC direction.

## 2026-09-07 — Shift Candle

- `shift-candle` uses exact execution-derived one-tick footprint rows and a
  documented no-lookahead interpretation of the public Trinity controls. It
  must remain empty without POC/delta/imbalance evidence; never backfill those
  inputs from candle direction or total volume.
- The protected vendor trigger formula and pixel parity remain unclaimed.
  Alerts are live-new-confirmation only, never history/replay/closed market.

## 2026-09-07 — Annotations Overlay

- `annotations-overlay` is an in-memory, workspace-local mirror keyed by the
  source chart instance and source indicator instance/catalogue ID. Publish
  raw annotation timestamps and align only on the target chart.
- Never open a duplicate market-data connection for a mirror, mutate the
  source series, permit self-reference, or retain a source after unmount.

## 2026-09-07 — Important Levels

- `important-levels` groups periods from the 17:00 America/Chicago trading
  date. OHLC/midpoint/HLC3 VWAP may use authoritative candles; POC/VAH/VAL must
  use exact footprint rows and fail closed without them.
- Do not infer profile levels from total candle volume or call current-to-right
  label placement exact DeepCharts viewport parity without further evidence.

## 2026-09-07 — Speed of Tape

- Keep ordinary `speed-of-tape`, `speed-of-tape-instant` and
  `tape-speed-order-flow-burst` as separate studies.
- Ordinary Speed of Tape may aggregate exact execution Volume and Trades into
  fixed windows. Its Order database fails closed until true order-placement
  history is available; do not fake orders from prints.

## 2026-09-07 — Volume Swing

- `volume-swing` is a legacy alias for the working `deep-profile-swing` study.
  Keep one catalogue row, migrate old workspaces/favourites through
  `canonicalChartIndicatorId`, and preserve their instance settings.

## 2026-09-07 — Profile variants

- Monthly, Session and Visible Range profiles share the exact renderer and
  settings but every request/response is owned by its indicator instance.
- Coalesce visible-range changes, preserve event-candle execution bounds and
  discard stale jobs. Do not add one stream per profile; top up from the shared
  exact execution tape.
- Keep disjoint Monthly/Visible filtering and incomplete prior-contract months
  fail-closed until their exact data contracts exist.

## 2026-09-07 — Chart emoji quick picks

- The chart emoji flyout's top row is a global persisted 16-item recent list.
  Every chosen emoji moves to the front, duplicates collapse by presentation-
  neutral Unicode identity, and the oldest entry drops off.
- Keep the original 16 as first-run defaults and synchronize the list across
  every open chart. Prompt/outcome:
  `docs/prompt-log/2026-09-07-chart-emoji-quick-picks.md`.

## 2026-09-07 — Live time-candle authority

- A forming clock candle owns its open once its bucket began under continuous
  live observation. Delayed cache/history/React commits may widen verified
  extrema but must not replace that open or rewind the newest live close.
- The bucket in which a subscription starts may already be partial, so its
  historical open remains authoritative. This distinction preserves genuine
  gaps and avoids inventing previous-close continuity.
- The renderer retains direct live authority separately from React props.
  Event bars keep their execution-boundary authority and do not use this rule.
- Prompt, diagnosis, fix and outcome:
  `docs/prompt-log/2026-09-07-live-candle-open-authority.md`.

## 2026-09-07 — Live wick visual path

- Paper/broker protection consumes every authoritative packet immediately.
  Rendering may never be placed in that execution path or delay an SL/TP hit.
- Browser-frame candle compaction retains first/extrema/last in actual arrival
  order. Never reorder a burst as first/low/high/last because that invents a
  market path.
- Clock candles publish the retained real states and the chart paints a
  bounded four-state frame queue. Never interpolate fictional prices merely
  to make a move look smooth; a genuine exchange gap must still jump.
- Prompt, diagnosis, fix and outcome:
  `docs/prompt-log/2026-09-07-live-wick-visual-path.md`.

## 2026-09-07 — Closed candle wick integrity

- A body-only candle is valid when authoritative high/low equal the body ends;
  never manufacture a cosmetic minimum wick.
- Every normal Rithmic time chart periodically reconciles safely closed OHLC
  with History Plant bars, whether or not an order-flow study is attached.
- The forming edge remains stream-owned, and the first series paint uses the
  fully resolved theme/custom candle palette so a real wick is never hidden by
  stale raw colours.
- Prompt, diagnosis, fix and outcome:
  `docs/prompt-log/2026-09-07-closed-candle-wick-integrity.md`.

## 2026-09-07 — Volume profile stock width

- All fresh and restored-default volume-profile family indicators use width
  `2` for both the current and completed profiles. Do not reintroduce wider
  per-variant stock values that cover the chart.
- Preserve explicit user-saved current and previous widths during normalization
  and schema migration. Prompt/outcome:
  `docs/prompt-log/2026-09-07-volume-profile-stock-width.md`.

## 2026-09-07 — Public terminology privacy boundary

- The following implementation/provider names are private and must never be
  visible in the product UI: Menthroq, Trinity, Bookmap, QuantData, Databento,
  Rithmic and Skylit.
- Preserve internal provider identifiers and transport/API contracts. Route
  all rendered static/dynamic copy through the root terminology guard, and use
  whole-word replacement so `logarithmic` and similar legitimate words are not
  corrupted. Prompt/outcome:
  `docs/prompt-log/2026-09-07-private-terminology-scrub.md`.
