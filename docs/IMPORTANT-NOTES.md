# KWANTDESK important notes

## 2026-10-31 — Replay drawing persistence and normal clear

Replay already uses the normal pane drawing document; harden durability instead of adding date-scoped stores. Commit edits/clears to the existing account-tracked key immediately, with canonical refs, explicit empty pane retention, stale passive-save guards and duplicate-write suppression. Ordinary edits avoid full-document merge when storage matches; external changes and stale rendered callbacks use existing ID-aware merge, preserving newer tools and preventing cleared-tool resurrection. Same pane/absolute timestamps survive replay exit/day changes/reload.50 focused source-callback/replay/persistence/clipboard/account checks, scoped helper lint and full build pass. Old immediate-navigation callback performed zero writes before passive effects. Clear remains all saved dates for the active pane, other panes preserved. No viewport/data/trade/account/feed/recording changes. Details/limits: docs/prompt-log/2026-10-31-replay-drawing-persistence.md. Verify main-only deployment and live SHA.

## 2026-10-30 — Fixed drawing VP uses normal profile painter

Fixed-range drawing now sends original exact gateway rows to NativeVolumeProfilePrimitive via an injected local SVG path/output surface; normal charts retain default Path2D. Same five data modes/five appearance styles, signed delta behind volume (including line), gradients/theme colours/opacity/spine/POC/grouping/VA and range/window/none level extension. Fixed drawings fetch1-tick rows, group in shared painter, cache completed range/filter results for appearance edits, and require exact executions instead of transient OHLC proxy. Capture prior request signatures before deferred cleanup. Anchored request/legacy fallback preserved; strict State options remain exact.254 focused tests,25 actual native-canvas vs actual-component SVG browser cases (zero pixels beyond16/255/channel threshold), scoped lint, TypeScript/full production builds pass. One older affine harness ReferenceError alignFixedMarkers reproduces unchanged on HEAD. No source values/trading/accounts/recordings/feed/VPS changes. Detail/evidence: docs/prompt-log/2026-10-30-fixed-drawing-profile-parity.md. Verify actual production SHA after main-only release.

## 2026-10-30 — Liquidity settings/control synchronization

Fixed model/UI mismatches: legacy zero contract filters rendered range thumbs at1 (first increment2), saved false Trades/Heatmap/Profile still looked enabled, Trails/Grid still checked, and disabled CVD had a lit/nonresponsive first toggle. Explicit0=all filters now retain size1 at1; shared30-control normalization uses native bounds/steps/enum/boolean contracts on init/reset. CVD/DOM lights and aria reflect actual visibility; numeric blanks preserve prior values.29 focused tests, all30 actual isolated-app event bindings, actual renderer threshold0/1/2/16/1 totals18/18/17/0/18, scoped lint/JS syntax/full build pass.41/48 broader checks pass; same7 legacy failures reproduced from HEAD. No clustering/source/trade/feed/recording/VPS changes. Owner exact state not observed; existing inclusive arithmetic was correct. One currentNQ sample2459/2500 size1; min2 legitimately removes most. Details: docs/prompt-log/2026-10-30-liquidity-settings-contracts.md. Revision20261030-settings-contracts; verify production SHA/static hashes.

## 2026-10-30 — Bid/ask historical stroke overlap

Fixed compressed-scale ink overlap: BBO trails/extensions now fit thickness to the smallest positive visible quote gap (0.5–3px), keeping all prices/time coordinates exact; no fake minimum spread. Prior inside-market drawing unchanged by CVD-only release. Read-only VPS4 samples/root: valid BBO NQ3–4ticks, ES1tick; not a certification of all historical data/current owner viewport.15 actual-trail/zoom/CVD/bubble checks, JS syntax, host lint and full build pass. Revision20261030-bbo-trace-strokes; verify public asset hashes and production SHA. CVD line-only stays intact. No feed/reset/recording/trade/VPS changes. Details and acceptance limits: docs/prompt-log/2026-10-30-bid-ask-trace-strokes.md.

## 2026-10-30 — Liquidity-map CVD line only

Removed CVD Bars choice and renderer branch; saved bars/candles normalize to line. Split lines, exact history, live easing and scale modes retained. Bumped iframe and changed public-module revisions to20261030-cvd-line-only.9 focused actual-CVD/presentation/bubble checks, JS syntax, host lint and full build pass. Verify four public asset hashes with actual production SHA. No heatmap/DOM/bubble/feed/recording/trade/VPS changes. Details: docs/prompt-log/2026-10-30-liquidity-cvd-line-only.md.

## 2026-10-30 — TPO visible-left-edge replacement

TPO now receives the drawing-toolbar plot inset. Its one-wall-profile election per study, anchors, clip and hit testing use the visible edge with inclusive contact; newer drawable profile replaces the old profile and all its layers/hit bounds. Native paint drives handoff; pan back restores prior wall owner without deleting history. Right-docked old profiles fully beyond the left edge are culled. Independent studies retained.43 TPO tests (7 new actual-renderer cases), scoped primitive lint and full production build pass. No calculation/data/feed/recording/trade/VPS changes. Details: docs/prompt-log/2026-10-30-tpo-left-edge-handoff.md. Owner-browser screenshot acceptance not observed.

## 2026-10-30 — Lower indicator right-axis drag gestures

All expanded numeric lower panes now have a right-axis drag control (previously CVD-only wheel/no-op pointer-down). Drag scales the press-time domain using the installed native LWC price-axis coefficient; Shift-drag moves vertically; wheel/reset retained. Table/collapsed panes excluded. Per-pane domain remains stable through chart pan. Pointer capture and cleanup on up/cancel/lost capture/new gesture/unmount prevent stranded drag listeners.18 actual-renderer/native-coefficient/axis/docking tests, scoped lint and full production build pass. One broader pre-existing indicator-engine CVD naming-regex failure is unchanged; do not claim the entire legacy suite passes. No data/feed/recording/trade/VPS changes. Details: docs/prompt-log/2026-10-30-indicator-axis-drag.md. Owner-browser drag acceptance not observed.

## 2026-10-30 — Opaque indicator panes above chart content

Indicator dock root now z40 above price drawings24/trade labels31–32; raising child surfaces alone cannot escape the old root z9. Horizontal/side background rectangles are opaque. Drawing placement target now shares existing price-pane clip bounds, excluding lower/top indicators and price axis.21 pane/drawing regressions, scoped lint and full build pass. Actual-component headless Chrome fixture with compiled CSS reproduces old overlay/3% bleed/click interception; dark/light after fixtures have8 exact background pixel checks and4 correct pane hit targets; price drawing capture confined. Calculations, data, recordings, trades and gateway untouched. Details/evidence: docs/prompt-log/2026-10-30-indicator-pane-occlusion.md. Owner browser not inspected; do not claim its screenshot was observed.

## 2026-10-30 — Uniform calendar impact filter selection

High/Medium/Low economic-calendar filters now share static theme-primary selected text/dot/background/border and a dim unselected state. Reserved border sizing prevents shifts; aria-pressed matches selection. Filter logic and event badges preserved. Actual JSX callback checked across all8 selection combinations/24 buttons;11 News/navigation regressions and scoped lint pass; full production build passed. No provider/feed/recording changes. Details: docs/prompt-log/2026-10-30-calendar-impact-filter-style.md.

## 2026-10-30 — Internal workspace navigation CPU and loading

Shared timezone controls no longer construct the world menu while closed; bounded timezone validation/Intl formatter caches preserve exact-date DST offsets. News day-key formatter reuse removes per-event Intl construction. Actual isolated measurements vs6d22ea26: three closed controls426.41→2.45ms (5064→2 constructions);2000 date keys272.81→8.63ms (4000→1). News controls/structure render before remote calendar responses; saved payload initializes first render, placeholder only in event rows, missing totals use dashes. Normal requests honor private HTTP caching; manual Refresh reloads. Macro/Financial Info lazy-loaded. Authenticated workspace serially warms code in idle time, pauses hidden, respects data saver/2G, cancels on unmount; no page mounting, API/RSC prefetch or feed startup.20 focused tests, scoped lint and full build pass; one existing obsolete liquidity iframe-version pin remains unchanged. No VPS/feed/recording/trade changes. Browser end-to-end timing unmeasured; do not turn isolated CPU gains into a whole-site speed claim. Details: docs/prompt-log/2026-10-30-workspace-navigation-speed.md.

## 2026-10-30 — Chart overlays follow viewport anchors

Removed edge-pinning of off-screen session/IB/profile labels and fixed-range profile geometry. Session labels cull off-screen anchors and collision placements; profile captions retain nullable index alignment and omit off-screen/crowded labels; custom profiles translate by their real time coordinates. Matching label clamps removed from calculator, GEX/dark-pool, SMT, ZigZag, HTF, hedge, expected-move and chart-zone overlays. Explicit profile snap modes and forward level termini remain. Seven actual-renderer/placement regressions pass, scoped primitive lint and production build pass. Eight older source-contract test failures reproduced unchanged against isolated HEAD; do not claim the entire legacy suite passes. No feed, candle, execution or account changes/restart. Browser acceptance not observed: active signed-in chart surface unavailable. Details: docs/prompt-log/2026-10-30-chart-overlay-viewport.md.

## 2026-10-30 — NQ execution-path readiness bottleneck

Replaced full candle-history filter/allocation on every live execution flush with an equivalent allocation-free readiness helper; common hydrated history reads about60 candles rather than20000. 24 focused tests (400 randomized equivalence histories, source authority, rollover, actual same-frame series updates), scoped helper lint and production build pass. Benchmark5000 calls:1231.83ms→2.64ms for this check only. A15s VPS sample delivered identical76 execution packets internally/public HTTPS, reported timestamp ages6/29ms median/P95, no current overload; laptop health RTT278–299ms. Provider timestamp fallback and source sample completeness are not certified. No active browser/Deep Charts runtime exposed, so final paint latency/parity remains unverified. No gateway reset or synthetic prices. Details and limitations: docs/prompt-log/2026-10-30-nq-feed-latency.md. Do not describe this as a complete Deep Charts parity fix.

## 2026-10-30 — Economic Calendar provider badge

Removed the TradingView/provider status badge from our calendar toolbar per owner screenshot. Event-level provenance, time/timezone/refresh controls and feed behavior retained. Existing calendar-sharing check, scoped lint and production build pass. No backend/provider changes. Details: docs/prompt-log/2026-10-30-calendar-provider-badge.md.

## 2026-10-30 — Liquidity Map CVD startup scaling

CVD line/bar bounds now follow plotted cumulative values rather than hidden seed-bucket OHLC extremes. Bars also ignore hidden buy/sell split lines. Explicit zero/symmetric modes retained; no source values/history rewritten or peaks fabricated. 24 focused checks, scoped lint and production build pass; actual canvas fixture confirms visible peaks despite distant seed extrema. No gateway change. Details: docs/prompt-log/2026-10-30-cvd-startup-scale.md.

## 2026-10-30 — Source-time smart clustering

Smart-cluster distances now use execution time rather than depth-packet indexes; stronger bounded curve and nested windows up to 8s (default52=2s), with differential cancellation still250ms. Both merge stages enforce a full price envelope up to8 ticks; zero disables proximity merging. Growing groups retain first-execution identity/time/price, including ID9→10. Unrelated large prints no longer shrink merge reach and split existing groups. 41 focused checks, scoped lint and production build pass. A local28800-execution/84000-contract fixture reduces bubbles60→30 at default,15→8 at maximum without changing volume; incremental median1.34ms. These are synthetic measurements, not complete vendor parity. Existing saved settings retained; no gateway activation. Details: docs/prompt-log/2026-10-30-smart-clustering.md.

## 2026-10-30 — Liquidity Map Trade toolbar placement

Moved the map-specific floating Trade button into the existing command toolbar immediately before Depth; shared styling and existing order ticket preserved. Same-origin/source/instrument/scope checked iframe request activates the host pane and opens its ticket. Hidden until the trading-host handshake. 13 existing chrome/trading checks, scoped lint and production build pass; actual CSS headless layout confirms same row and 28px height. No gateway changes. Details: docs/prompt-log/2026-10-30-liquidity-trade-toolbar.md.

## 2026-10-30 — Liquidity execution anchors and theme action contrast

Liquidity bubbles now project real execution timestamps/prices rather than packet-arrival columns; late genuine history is sorted/bounded and invalidates positional caches, and presentation holds cannot rewrite book timestamps. Gateway inside trails use valid provider snapshot quotes without altering L3 orders/depth/trades. Guarded gateway-only activation preserved 14 mounts and other services; three same-time quote comparisons match, 12 sampled books valid, and live SSE delivered 69 valid frames/322 executions. Persistent override SHA f4e775c85a5b9a5550bd9f03b93510283150cb7d52e888182bf7bd4d33f61669; backups in /opt/kwantdesk/staging/bubble-source-time-20261030/. GEX filled controls now use synchronous readable on-primary/on-danger ink; 13 React danger labels and Replay Go use shared contrast roles. 43 focused bubble/quote tests, 545 complete gateway tests, 13 theme checks, 473 actual CSS checks across 43 palettes, scoped lint, TypeScript and production build pass. One known unrelated initial-background fixture remains pre-existing after appearance rollback; do not change the restored map to satisfy it. No old history fabricated, no extra provider session or paid service. Evidence and limits: docs/prompt-log/2026-10-30-liquidity-bubble-time-and-theme-contrast.md. Broader vendor parity/history tasks remain separate.

## 2026-10-30 - Routing middleware timeout / navigation verification

Owner supplied504 MIDDLEWARE_INVOCATION_TIMEOUT fromsyd1. Middleware awaited unbounded Supabase getUser on navigation; this was a separate fault from Options request sharing. VPS was connected/authenticated, QQQreads200 in220-319ms, ~2.8/7.9GiB RAM/5.1GiB available andno current loop overload. Public Auth key read timed out8s in one sample, later health/key reads returned200 in1.35/2.74s withES256. GET/HEAD navigation and exact Options read endpoints now use SDK getClaims (cryptographic signature/expiry and shared JWK cache); other APIs and all writes retain remote getUser plus existing handler checks. JWT reads reflect a valid signed token until expiry, not a fresh per-navigation account/revocation lookup. A5s total SDK/fetch budget aborts body/lock waits, stops expired-budget refresh retries and returns503 without clearing cookies or redirecting valid users tologin on dependency failure. Site-access, OAuth, active-cookie filtering and no middleware cookie-write rules remain.31 checks pass including actual SDK ES256 signing/tamper/expiry/JWK reuse. No owner account mutations or gateway restart. See docs/prompt-log/2026-10-30-routing-middleware-timeout.md. Larger exact-history/parity/off-box backup/unattended execution gates remain open.


## 2026-10-30 - Options workspace timeout and pending-request duplication

The Options page used a20s browser deadline despite FULL's two provider phases and25s interval-map budget. Both server caches expired4/5s TTL entries while still pending, duplicating slow dashboard/provider reads; zero-TTL rejection cleanup also produced an unhandled finally rejection. In-flight promises now remain shared until settlement; genuine successful responses start the existing TTL then, failures release only their own slot, and zero-TTL jobs release on both outcomes. Options alone uses bounded30s CORE/60s FULL budgets; CORE-first display, cadence, strict freshness, source values and visible error/last-good rules stay intact. Eight of11 actual-function regressions fail on61417325;32 focused checks/scoped lint pass. Real VPS reads were healthy; an actual FULL request joined after4.5s returned the same frame at11.8s with346gamma strikes/116candles and no panel errors. No VPS restart, provider setting, credential, auth, trading or recording change. See docs/prompt-log/2026-10-30-options-workspace-timeout.md. Signed-in owner-browser timeout was not independently replayed; no blanket uptime/parity claim. Standing exact-history, off-box backup, unattended execution and full-session parity gates remain open.


## 2026-10-30 - Closed trade phantom protective exit and fill resurrection

Reproduced sync fault after manual close + Remove all fills: stale peer SL/TP shared the exit fill ID, a raw conflicting visible fill survived canonical admission, and no-local-change/storage hydration paths could restore old open state. Added sorted per-account clearedFillIds tombstones with legacy journal inference; journal facts beat visible duplicates, first/committed exits stay canonical, and PnL corrections cannot become bogus cash adjustments. Merge terminal positions, exited quantity and filled/cancelled/rejected orders even when local matches baseline; actual storage/hydration handlers reconcile against the current live ref. Partial protections, real new fills, explicit resets/balance changes and journals remain valid. Initial7/8 repros failed before; final94 tests plus8 trigger/14 journal checks pass. Scoped libs/test lint, full1536MiB build and final TypeScript pass; large workspace compiler lint not claimed. Frontend only, no gateway/provider or owner-data changes. See docs/prompt-log/2026-10-30-closed-trade-phantom-exit.md. Do not manufacture corrections to prior fills without execution evidence.

## 2026-10-29 - Entry/Exit drawings 40 percent smaller

Manual entry/exit arrows now render geometry and stroke at 0.6 scale, including existing and legacy drawings. Saved dimensions/anchors are preserved; legacy capture remains unscaled. Resize converts displayed deltas back to saved units, preventing shrink-on-grab or compounding across refresh. Fixed-screen-size viewport compensation remains intact. Automatic trade-fill markers/icons unchanged. Updated existing affine, persistence, legacy and actual resize callback regressions pass; entry/exit13 checks pass. Scoped lint/full build/TypeScript pass. See docs/prompt-log/2026-10-29-entry-exit-40-percent-smaller.md. Frontend only.

## 2026-10-29 - Liquidity CVD controls/live edge and zoom-stable bubbles

CVD now offers Line/Bars only (legacy candles normalize to Line). Removed its settings/Live/NET-LOADED header controls and all DOM writers. Fixed latest-point width mismatch: CVD and price use the same data edge before the live gap; align margin before canvas fitting. Presentation-only live tip/range easing redraws CVD alone, leaves source/history totals intact, settles and snaps in paused/replay/session changes. Bubble grouping/cache no longer depends on zoom/visible start; per-book reference geometry keeps identities, volumes, buy/sell colours and market anchors stable while projection/size changes. Prior notes confirmed full rollback removed fixed execution-time windows/volume sizing: restored only the 77-line bubble-engine safeguard diff from 3767618f, with whole-window incremental boundaries, fixed 100-contract sphere sizing and explicit saved differential choices preserved (new/reset gross default). 55 focused tests pass; broader UI controls 27 pass/7 fail identically on isolated HEAD baseline. Syntax/scoped lint/full build/TypeScript pass; 50k-print fixture preserves 197k contracts. Frontend only, no gateway restart/provider polling/accounts/trades/recordings changes. New cache graph revision 20261029-cvd-bubble-presentation. See docs/prompt-log/2026-10-29-liquidity-cvd-and-bubble-zoom.md; owner-tab visual acceptance not claimed.

## 2026-10-29 - CVD price divergences retain history and native anchors

Price chart was still using the retracting latest-only detector and an SVG drawing layer while the CVD pane used the historical multi-segment detector. Removed that separate scan/overlay. The unchanged pane calculation now exposes its exact segments as metadata; a native candle-series primitive paints all segments within the selected lookback from their original time/wick-price anchors in each chart paint. Uses pane-resolved plot colours/width, fixed screen-size dots/labels, visible-range culling without deleting history, and proper disable/recreate/teardown handling. Multiple instances work by group key. Tests cover actual engine and renderer: historical retention after recovery, replay causality, pan/zoom, culling and teardown; existing 6 historical checks, 10 CVD settings checks and 11 flow/scale/viewport tests pass. Scoped new-module lint, full production build and TypeScript pass; full large-Chart React-compiler lint not rerun after prior documented OOM. Frontend-only, no gateway restart or feed/recording/account changes. See docs/prompt-log/2026-10-29-cvd-price-divergence-history.md. Owner-tab visual acceptance not claimed.

## 2026-10-29 - Liquidity source clears and execution delivery

Exact presentation rollback did not repair the live source. Captured timestamped zero-size/zero-order Rithmic level clears were ignored in L3, retaining stale orders and crossing books. Applied explicit clears with source ordering/indexes, protected newer snapshot/delta orders, and kept execution cursor/pending order events through invalid frames. No L2 substitution or quote-based pruning. Gateway-only reconnect activated reviewed, hash-guarded persistent overrides with backups and other services/recordings/accounts/settings preserved. Frontend keeps restored presentation; shared price scale fixes controller/renderer mismatch and parent catalog excludes micro-contract overwrite. 541 gateway tests, 35 frontend checks, scoped lint and full production build pass. First 40 live samples per NQ/ES/MNQ/MES all valid; live NQ stream 67/67 valid frames and real executions delivered. Captured-wire comparison improves 1969 crossed samples to 10; do not claim perfect parity or zero transient crossings. Existing derived archive packs not regenerated. Full evidence/activation paths: docs/prompt-log/2026-10-29-liquidity-source-clear-integrity.md. Earlier broader parity/history/performance work remains open.

## 2026-10-29 - Full liquidity-map rollback to before standalone Replay

Owner rejected patches and mixed-version restoration. Restored ALL26 public heatmap assets and both map React components byte-for-byte from2bd8ac0140011f29d078f5c941dcc6c8bfaf1c57 (25Oct16:20Brisbane, before standalone shared Replay). Restored the exact standalone map branch and removed its added master Replay UI/clock/readiness/step integration, preserving other workspace features. This intentionally removes later ES-scale, palette, modal and loading-Trade changes too; do not silently layer them back on. Legacy embedded archive-message support already present in the target remains. Historical tests restored:102checks pass,9historical/shared-label assertions fail and are documented; build/TypeScript and scoped component lint pass. Hash manifest and full scope/limits: docs/prompt-log/2026-10-29-liquidity-full-pre-replay-rollback.md and adjacent manifest JSON. Accounts/recordings/shared gateway preserved; separate crossed-depth fault remains unverified. Verify all26 published asset hashes after deployment; no claim of live visual/data acceptance.

## 2026-10-29 - Hide liquidity Trade overlay while the map loads

LiquidityMapWorkspace now shares `mapLoading` between the loader and trading-overlay visibility/interaction. The z20 Trade button no longer floats over the z10 loading mask on refresh. Keep LiquidityMapTrading mounted while hidden so its iframe bridge remains connected. Inspector and replay loading rules are preserved; no feed restart or trading-state changes. See docs/prompt-log/2026-10-29-liquidity-loading-trade-button.md.

## 2026-10-29 - Big Contracts receives and paints live executions independently

Fixed workspace execution-event gate omitting `big-trades` unless Footprint/Instant Tape/Auction Gap was also enabled. Big Contracts now receives the frame-batched stream alone. Historical/live clustering share an incremental aggregation rule with stable first-execution IDs; same-millisecond records dedupe by identity, and sampled snapshots catch up before replacing newer live markers. Handles first-ever print and a pending cluster across sampled rebases. Execution events share canonical candle boundaries after their update; optional Deep Contracts uses each execution's candle rather than the latest candle. Actual publisher/listener/full-pass callback fixtures,120 live/history batch-prefix comparisons, bounded25k-tape suffix reads and existing targeted regressions pass. See docs/prompt-log/2026-10-29-big-contracts-immediate-delivery.md for validation, release and limits. No new polling/Vercel tick traffic or gateway restart; separate depth integrity fault remains open.

## 2026-10-29 - Volume profiles paint above chart drawings

User wants all drawing tools, including Long/Short calculators, behind volume profiles. Native studies paint on the LWC foreground canvas, SVG drawings on z24: native zOrder alone cannot cross those DOM layers. A conditional foreground presentation primitive now copies the completed native foreground once into a non-interactive z25 canvas before browser paint. Original bitmap remains the native input target at opacity0 only after successful copy; no duplicated profile alpha or moved event handlers. Includes all native foreground study/real-fill ordering, with controls/tooltips still above it. Active only with both profiles and drawings/placement tool; no extra frame loop, market requests or profile calculation. Manual fixed/anchored profiles render after other drawings and placement previews. Unit lifecycle/failure/coalescing checks and actual isolated Chromium/LWC pixel/input tests at DPR1/2 pass; profile above green SVG yields128/76/128, no-drawing baseline128/0/128 (single alpha). Drawing/native clicks, wheel, resize, toggle, teardown pass. Position-colour and fixed-arrow regressions, scoped lint and full1536MiB production build/TypeScript pass. See docs/prompt-log/2026-10-29-profile-drawing-layer-order.md. No VPS/data/trading-state changes; earlier depth integrity fault remains open.

## 2026-10-29 - Entry/Exit arrows retain CSS-pixel size through viewport changes

Manual Entry Arrow/Exit Arrow drawings now persist fillMarkerHalfWidthPx/fillMarkerHalfHeightPx. New arrows get9x6half-extents; legacy drawings capture their first ready projected size once, then persist it without changing anchor points. Resizing updates only pixel dimensions with no initial tip-height jump. SVG drawing-layer affine zoom is counter-scaled around each arrow anchor, including body/label/hit shape/resize handle, so it does not stretch during the gesture or after settling. Node list cached at commit; no per-frame DOM query. Existing real fill markers and other drawing geometry unchanged. Fixed-size matrix/anchor/persistence/legacy-cache and actual resize-callback checks,13entry/exit checks,7position-colour checks, scoped lint and full1536MiB production build/TypeScript pass. Existing draw-layer-anchoring and drawing-selection scripts fail outdated source assertions identically on HEAD before changes; do not claim they pass. See docs/prompt-log/2026-10-29-entry-exit-fixed-screen-size.md. Separate live depth-source integrity fault remains open.

## 2026-10-29 - Position calculators use fixed green profit/red loss

Long/Short Position tools now default to semantic green (#089981) profit and red (#F23645) loss across every theme. Explicit per-drawing colours/templates still win. Shared constants drive the live SVG drawing, settings swatches/reset, and the canvas/legacy position path. Clearing overrides now says Reset to green / red. No saved drawings, geometry, prices or trading state changed. Existing7colour checks and6primitive checks pass, full1536MiB production build/TypeScript passes; scoped draw layer/settings/style lint passes. Linting the giant Chart.tsx with the full React compiler rules exhausted4GiB; do not claim that lint passed (whole Chart typechecks in production build). See docs/prompt-log/2026-10-29-position-semantic-colours.md. Earlier depth reset is complete but source integrity remains unresolved as documented; this colour release does not repair it.

## 2026-10-29 - Owner authorized reset; depth integrity still unresolved

Owner finished trading and authorized reset. NQ/ES subscription refresh initially clean, then both crossed again. Activated only tested gateway modules, with existing overrides/recordings/other services preserved. Atomic snapshot now preserves interleaved deltas/cancels; ticker login explicitly encodes aggregatedQuotes=false; crossed books are invalid/non-full-depth and bounded same-socket recovery requests fresh baselines. Actual 532 gateway tests/scoped lint/runtime syntax pass. A trial decrementing resting orders from trades did not prove a sustained fix and was removed entirely. Final live NQ still crossed 3/15 samples, ES1/15, no stale samples; gateway connected/authenticated/recording, no event-loop overload. DO NOT claim liquidity fixed or visually restored. Level totals match order map; trace exact missing order lifecycle semantics in recorded wire before more changes. No owner trades/preferences/display changes, no VPS/relay/history restart. Earlier performance/history/parity/Footprint/unattended-execution tasks remain open. See docs/prompt-log/2026-10-29-crossed-liquidity-book.md; this supersedes older explicit-wait entries for this reset only.

## 2026-10-29 - Undo imposed LIQ display defaults; recover actual backup

Owner still reports one-colour sides/incorrect heat. Crossed source repair is STILL UNACTIVATED by explicit wait while trading. Separate self-introduced issue: prior rollback helper overwrote selected palette/display options with stock defaults. Stop doing that. New helper never changes untouched custom settings; only marked old-reset records restore scalar display fields from the exact backup when current field still equals the imposed default. Preserve later non-default edits and original backup; mark restoration once. Unknown/corrupt/missing backup or write failure leaves state unchanged, no guessed settings. Restore all original palette IDs/selector options so a restored Footprint preset does not silently resolve to kwantify fallback.20 targeted tests pass; full production build/TypeScript and scoped lint pass. No further renderer geometry/data/order changes, no live subscription refresh. See docs/prompt-log/2026-10-29-liquidity-saved-display-restore.md. Same-as-default intentional later edits are indistinguishable; exact owner visuals/preferences unverified. Standing crossed/performance activation, Footprint/parity/archive/backup/unattended-execution work stays open.

## 2026-10-29 - Immediate durable SL/TP edits

Owner reports old SL executed two minutes after moving it. Reproduced local persistence gap: handlePaperProtectionUpdate changed ref/UI only; a genuine tick could supersede the rendered ledger before passive save, which intentionally skips stale state. Storage/cloud could retain the old stop and later hydrate it. Operator protection update now commits and saves synchronously in the same handler, including resting order exits, SL/TP moves/removals. Failed durable save reports explicit error but retains in-memory protection; no silent success.87 targeted checks pass (actual handler, tick interleave, reload, old-level non-fill and exact new-level fill for buy/sell/TP); full production build/TypeScript pass (1536MiB cap). No owner trades altered/reconstructed and no universal diagnosis of individual fill. Separate stale-browser execution authority remains an architecture limit; prior field merge fix not changed. See docs/prompt-log/2026-10-29-stop-move-immediate-persistence.md. Crossed NQ/ES depth repair remains LOCAL/UNACTIVATED: owner explicitly said wait until trading ends; do not refresh subscriptions or gateway. Standing parity/archive/Footprint/backup/unattended-execution items remain open.

## 2026-10-29 - Broader LIQ MAP presentation rollback supersedes narrow revert

Owner reports 6396118f looked unchanged; stop claiming the earlier history-only rollback fixed the reported visuals. Restore Oct25 (4065cc10) renderer/DOM paint, palettes, bubble engine/settings controls and site styling; remove Oct27/28 palette/clustering feature tests with those retired features. Retain ES tick-scale/product identity/modal ownership and stable theme/font bootstrap fixes. All changed entry/module URLs use20261029-oct25-rollback. New one-time display rollback backs up raw saved map settings before restoring Oct25 DISPLAY defaults including bid/ask trails and DOM columns; marker persists in existing account preference value, later explicit display choices survive. Backup/storage failure leaves prior preferences intact. This is restored default appearance, not recovered original custom choices.38 focused checks pass (actual DOM/trail methods equal Oct25); full production build/TypeScript and scoped lint pass. No browser inspection after owner said stop, no owner trades/provider/gateway changes. See docs/prompt-log/2026-10-29-liquidity-map-broader-visual-rollback.md. Older differential bubble semantics return by explicit rollback; owner visual acceptance and standing feed/archive/backup/unattended-execution work remain open.

## 2026-10-29 - Owner-requested exact liquidity map rollback

Owner rejected the pause/history presentation and explicitly said "Just revert it" and stop browser inspection. Restore entire public/heatmap-app tree and LiquidityMapWorkspace to 11fc3ac8^ (2a57b333), including prior toolbar/layout, settings behavior, rendering imports and hidden playback controls. Delete new browser history helper/tests and restore previous controls/replay tests. No new pause UI in this rollback. Actual renderer/palettes already matched that baseline; no guessed settings reset or colour changes. Keep isolated VPS archive service and recordings intact; no gateway restart.37 focused regressions pass; full build/TypeScript pass. Seven old controls source assertions and one inspector source assertion remain baseline failures. See docs/prompt-log/2026-10-29-liquidity-map-owner-rollback.md. Owner signed-in visual result unverified; standing feed/Footprint/archive/parity/backup/unattended-execution items remain open.

## 2026-10-28 - Stop loss survives concurrent account updates

- Reproduced a whole-position sync conflict overwriting a new stop with baseline null during concurrent target changes/partial fills. Protection intent now merges field-wise; explicit removal and fill/reset authority remain.81 focused tests and scoped lint pass. Receipt: docs/prompt-log/2026-10-28-active-stop-persistence.md.
- Already-lost stops are not recreated at guessed prices. Owner active-trade visual acceptance unverified; no test trades or gateway restart. Prior deferred backend/Footprint/vendor/archive/backup/browser-owned unattended-execution items remain open.

## 2026-10-28 - NQ stalled-execution recovery

- Missing execution seed cannot remain masked by heartbeats. A same-contract confirmed fresh trade quote can detect a delivered-execution watermark stall and reconnect the existing engine after grace, rate-limited and lossless. Existing in-place history repair is notified. No invented prices, quote-mid OHLC, pending-print loss or live gateway restart. 52 tests/full build and a real-feed isolated headless recovery fixture pass. Receipt: docs/prompt-log/2026-10-28-nq-stalled-execution-recovery.md.
- OPEN: owner's actual trading tab/full indicator workspace was not accessible for visual verification. This is a tested recovery fault fix, not a millisecond/FPS or all-stalls-eliminated claim. Prior backend performance activation remains deferred; original Footprint transient and other existing parity/archive dependencies remain open.


## 2026-10-28 - LIQ MAP historical navigation and isolated archive service

- Pause / six-hour timeline / minute steps / LIVE are visible at the bottom. Dragging works with price auto-centering, paused display no longer gets evicted, live execution quotes continue, loaded books are reused and CVD/tape remain causal. First unprepared archive windows can take minutes; recorded depth is two-second snapshots. 36 targeted checks, full build/lint and desktop/mobile headless fixture QA pass; real NQ/ES history and signed VPS CORS/auth verified. Receipt: docs/prompt-log/2026-10-28-liquidity-map-pause-history.md.
- Keep the new heatmap-history service in /opt/kwantdesk/compose.yml, /opt/kwantdesk/heatmap-history modules, restricted bearer-only env file and Caddy /liquidity-history route/log exclusion. One worker, 0.5 CPU / 768MiB, raw archive mounted read-only; immutable derived generations refresh only on demand. No new VPS/provider login; no live gateway restart. Do not put large history bodies back through Vercel or enlarge the 1800-book browser buffer.
- Separate open items remain: live CVD/QuantStats freeze acceptance, original Footprint opening transient, owner-deferred main gateway activation and existing parity/archive/off-box/unattended-execution dependencies.

## 2026-10-28 — Navigation and separate frozen-study fault

- Home/native navigation intent prepares destination code only; primary navigation can mount before the trading bundle. Unrelated startup/provider warmups removed and two dead Home launch routes corrected. 17 checks/full build pass; physical signed-in navigation latency remains unmeasured. Receipt: docs/prompt-log/2026-10-28-navigation-cold-entry.md.
- OPEN: CVD/QuantStats live data reportedly stopped hours earlier. VPS probe received fresh classified NQ executions (latest about 60ms old); browser acceptance was blocked by the computer-use URL safety check. Do not describe the prior pan/zoom fix as a fix for this live-data fault. Deferred backend activation, original Footprint opening transient and existing parity/archive/off-box/unattended-execution dependencies remain open.


## 2026-10-28 — CVD / QuantStats viewport tracking

- Pane-only native viewport subscription restores frame-coalesced chart alignment without full Chart renders during pan/zoom. 27 focused checks and the full build pass; renderer regression reproduces the former missing updates. Source receipt: docs/prompt-log/2026-10-28-cvd-quantstats-viewport-follow.md.
- OPEN: signed-in physical session/FPS acceptance; deferred backend activation (owner is trading), original Footprint opening transient, vendor parity/archive completeness/off-box backups and browser-owned unattended demo execution remain separate dependencies.


## 2026-10-27 — Cross-device sync / unattended demo execution

- Account/workspace state now uses conflict-aware database revisions and live change hints; see the cross-device-account-state receipt. No per-tick cloud replication.
- OPEN: demo execution/protection remains browser-owned, requiring a connected execution workspace. State synchronization does not establish server-side fills while all clients are closed. Physical-phone acceptance, provider parity, archive completeness and off-box backups remain open.

## 2026-10-20 — Live quote burst transport and VPS cutover warning

- Current Quick Tunnel returned no live quote bytes in14s while local gateway
  returned76updates. Existing PUBLIC Funnel delivered149updates in14s; use it
  for streams only, keeping faster REST/history on the current bulk relay.
- New server-only KWANTDESK_MARKET_DATA_STREAM_GATEWAY_URL must be REMOVED or
  moved to the VPS origin when Vultr returns. Otherwise live feed stays tied to
  this laptop despite a normal gateway URL cutover. No new service purchased,
  tunnel created, capture restarted or provider credentials changed.
- Evidence/release: docs/prompt-log/2026-10-20-live-quote-delivery.md.
- Permanent authenticated direct gateway delivery/cost, month history and
  capture, Asia gaps and full profile/CVD/footprint live soak remain OPEN.

## 2026-10-20 — Slow CME chart startup: artificial live-edge gap removed

- Owned recorded history must include its real forming edge. Removed obsolete
  delayed-vendor cutoff that discarded the latest two minutes and forced the
  initial continuity gate to wait for a separate seam request. Replay bounds
  and real-gap/depth validation remain strict.
- Stale/non-flow-ready cached charts now use independent fast candle refresh
  too; CVD/order-flow restoration cannot hold their price bootstrap behind it.
- Local/public relay history timings were71ms/1,068ms for8,059 NQ1m bars,
  not a measured whole-browser paint. Receipt:
  docs/prompt-log/2026-10-20-cme-chart-first-paint.md.
- Permanent transport, rolling-month history/capture, missing Asia executions,
  full profile/footprint/CVD soak, GEX parity and shared multi-user costs remain
  OPEN. Owner reports having set Vercel cap; no new paid services authorised.

## 2026-10-20 — GEX VUE startup presentation

- Removed the extra animated startup presentation from GEX VUE's charting
  loading stages; theme surfaces remain visible and readiness/errors stay
  authoritative. Record: docs/prompt-log/2026-10-20-gex-vue-quiet-startup.md.
- This does not close the stable gateway/Vultr transport, month-long history /
  recording/backfill, missing Asia tape or CVD/footprint/profile soak issues.
- Latest GEX DATA acceptance is docs/GEX-DATA-PARITY-CHECKLIST.md, which
  supersedes the earlier first-tool-only audit note below. Forecast, aggregate
  source discrepancies and live cadence remain OPEN.

## 2026-10-20 — GEX DATA parity audit (incomplete)

- Running22-tool checklist: docs/GEX-DATA-PARITY-CHECKLIST.md. First Net Drift
  completed-session SPY check matches rounded calls-16.41M/puts64.76M/spot762.74
  and curve/volume shape. Exact buckets/trades and live cadence NOT signed off.
- Net Drift canvas/navigator reuse, historical override polling and no-op save
  echo guards have107 passing regressions; no math or faster-polling change.
- Live parity still blocked by current30s refresh/cache policy and the shared
  public API240/min quota; private website stream entitlement not established.
  Do not promise1ms updates or spend quota/Vercel charges polling every panel.
- Remaining21 tools not live-audited; forecast feed unavailable. Supported
  transport/wait for Vultr, month history, Asia tape, weekly/footprint/live-soak
  issues remain OPEN. VPS alone does not unlock a faster provider API.

## 2026-10-20 — GEX DATA time zone

- Added the same searchable/device timezone picker used on normal charts,
  top-right; saved for the account's GEX DATA workspace. Cached axes, tables,
  snapshot labels and retrieved times repaint immediately, without refetching.
  Exchange session/expiry dates and timestamps are unchanged.
-100 regressions pass. Record: docs/prompt-log/2026-10-20-gex-data-timezone.md.
- Still OPEN: supported live transport (wait for Vultr), full rolling-month
  history, missing Asia opening tape, weekly/footprint/live-soak acceptance.

## 2026-10-19 — GEX DATA refresh presentation

- Removed repeated loading screens, including embedded tools and legacy board
  panels. Data remains visible while requests run; actual errors and source
  timestamps stay visible. Poll rate and licensing/data guards unchanged.
-93 focused/integration/reference tests pass. Record:
  docs/prompt-log/2026-10-19-gex-data-silent-refresh.md.
- Still OPEN: supported live transport (owner chose wait for Vultr), full
  rolling-month history, missing Asia opening tape, weekly/footprint/live soak.

## 2026-10-19 — CVD live stream: fixes and unresolved transport delay

- VERIFIED transport blocker: official Cloudflare Quick Tunnel documentation
  says Quick Tunnels do NOT support SSE; trycloudflare.com buffers the stream.
  A smaller seed/restart is not an end-to-end solution. Need a supported named
  tunnel (existing Cloudflare account/DNS access) or permanent VPS connection.
  Owner decision: "No / not sure—wait for Vultr". Do not set up another tunnel,
  account or DNS route. No new paid services or DNS transfers authorized. Source:
  https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

- Fixed premature execution readiness, oversized browser seed (now128 prints),
  partial-seed replacement of full historical bar flow, and cumulative delta
  offset rendering. This is not a substitute for exact historical backfill.
- Owner-authorized temporary gateway restart completed. Local stream tested
  seed67ms / first trade112ms. Public tunnel remains unreliable:128-print
  seed10850ms,64-print probe no body in14s. Still OPEN; no claim that CVD is
  fully responsive in the owner's browser. Full month history/permanent VPS/
  missing Asia opening tape/weekly/footprint live acceptance remain OPEN.
- Record: docs/prompt-log/2026-10-19-cvd-stream-handoff.md.

## 2026-10-19 — Workspace panel count

- Removed the12-panel cap from add/duplicate controls and floating restore.
  No replacement fixed panel-count limit. Saved valid floating windows are
  no longer silently discarded beyond12.
-21 tests plus8 layout checks pass, including a64-pane model and31 floating
  windows restored. These are model tests, not a64-live-chart performance soak.
  Browser RAM/CPU still impose practical limits; existing cache/request/backup
  safeguards retained. All standing feed/history/Asia/weekly/footprint issues
  remain OPEN. Record: docs/prompt-log/2026-10-19-workspace-panel-limit.md.

## 2026-10-19 — Big Blocks (Options)

- Separate indicator added under Options Flow for underlying charts (QQQ,
  SPY, SPX, NDX, supported equities). Right-edge call/put size bars grouped
  by reported underlying price or strike, with numbers and adjustable inputs.
  Futures Big Blocks unchanged; no unverified futures/option-premium mapping.
- Real consolidated executions, not resting orders/positions. Latest100 prints
  per shared snapshot; only observed flow accumulates, max5K compact records.
  Not complete session capture. Three-second minimum refresh is NOT tick-live
  or a promise of provider latency. Signed-in live/visual acceptance remains OPEN.
-31 regressions/lint/TypeScript pass. Existing feed/history/Asia/weekly/
  footprint and permanent gateway issues remain OPEN. Record:
  docs/prompt-log/2026-10-19-big-blocks-options.md.

## 2026-10-19 — Asia/London profiles: code fixes and missing opening tape

- Fixed session variant flags/current-date planning and one profile arrival
  erasing sibling sessions/months. Unfiltered is whole-session, not RTH;
  unopened sessions do not issue empty requests. Exact-data gates unchanged.
- STILL OPEN: today's Asia opening executions are absent. Live gateway
  probes: NQ/ES first coverage22:56UTC, MNQ23:00UTC vs22:00UTC Globex open
  (2026-10-18). All three report complete:false, so full Asia profiles cannot
  honestly render yet. London opens07:00UTC, not during the ~03UTC probe.
-26 tests,7 session-selection checks, session-window script and scoped lint
  pass. VPS/full history/public streaming/weekly/footprint/live soak remain
  open. Record: docs/prompt-log/2026-10-19-asia-london-volume-profiles.md.

## 2026-10-19 — CVD flat/frozen display faults

- Reproduced and corrected stale render-cache rejection of shorter NEWER CVD
  snapshots, and stale deltaClose overriding current classified side totals.
  Settings/symbol/timeframe/contract changes cannot pin the previous plot.
- Unknown trade-count inputs/gaps are unavailable/segmented, not fake zeros;
  genuine feed waits remain explicit. Removed CVD caches are pruned.
-55 focused/adjacent regressions and15 settings/candle checks pass. This is
  deterministic model/render-path verification, not owner-side live soak.
  Full history, public streaming, weekly, footprint and exact Deep Charts
  live parity remain OPEN. No VPS/provider/resource changes.
  Record: `docs/prompt-log/2026-10-19-cvd-freeze-recovery.md`.

## 2026-10-19 — Big Blocks preview/close lifecycle

- Removed the incorrect intrabar latch: live previews can withdraw/reverse;
  final qualifying close freezes the block, final non-qualifying close stays
  empty. Later sampled passes cannot add delayed signals to observed-live bars.
- Same-frame bar rollover settles the closing observation first; bounded
  screen-frame updates, no new feed/polling. Existing settings/math preserved.
- Deep Charts exact proprietary formula and real live side-by-side acceptance
  remain OPEN. Targeted model/actual-effect tests are not live provider proof.
  Existing full history, public streaming, weekly and footprint gaps stay OPEN.
  Record: `docs/prompt-log/2026-10-19-big-blocks-live-lifecycle.md`.

## 2026-10-19 — Ten tonal theme additions

- Added ten single-colour-family themes as requested,43 total. Existing33
  themes remain byte-identical in resolved tokens/swatches. The earlier mixed
  themes are not removed; this request adds cleaner tonal alternatives.
- Molten Copper / Amber Vault / Acid Gold / Lime Obsidian / Emerald Depths /
  Jade Current / Arctic Cyan / Indigo Night / Violet Noir / Magenta Ink.
-27 focused tests plus14 candle/brand checks and scoped lint pass. Existing
  historical coverage, public streaming, weekly completeness and footprint/
  live-grid/cloud-save soak issues remain OPEN, unrelated to theme additions.
  Record: `docs/prompt-log/2026-10-19-tonal-themes.md`.

## 2026-10-19 — Six sampled reference themes and ten mixed palettes

- Owner's new request adds16 themes after the kept17; it does not remove or
  recolour those17 or restore the earlier rejected batches.33 total themes.
- Exact sampled five-colour strips: Deep Sea, Blue Lagoon, Sunflower Fields,
  Midnight Sky, Crimson Fade (unnamed red image), Sunset Sorbet (unnamed warm
  image). Picker strips retain the exact source order. UI ink may be derived
  for contrast; every sampled colour is also used in actual theme tokens.
- Ten additional palettes each have unique cross-hue primary/secondary pairs,
  not ten blue/pink monochrome variations. Existing default, current/custom
  appearance, account save/apply semantics and VP gradients stay unchanged.
-25 focused tests plus14 hollow-candle/brand checks pass. All16 local token
  previews visually inspected; signed-in cross-device theme saves not verified.
  Existing history/streaming/weekly/footprint/grid-live soak gaps remain OPEN.
  Record: `docs/prompt-log/2026-10-19-reference-and-mixed-themes.md`.

## 2026-10-19 — Options Flow Tools inside chart-grid panels

- Charts/GEX VUE panel picker now has an expandable Options Flow Tools section
  below Market & Order Flow:22 GEX DATA tools, four KWANTY views (including
  expiration calendar) and25 GEX BOX tools. Use the original source renderers,
  settings, controls and data paths, not a second implementation of their math.
- These are non-price-chart panels. Normal Indicators is a native disabled
  button, not a clickable/focusable hidden library. Existing price-chart studies
  remain unchanged. Settings snapshots travel with pane/workspace save/duplicate.
- Frame-scoped hosts prevent two embedded tools overwriting each other's
  settings or the standalone page. Account-scoped bounded request sharing,
  cleanup and original cadence/visibility gates avoid a new vendor connection.
  GEX BOX's self-contained Flow and calendar retain pane-owned settings too.
-100 focused/source-model tests,15 GEX BOX tests,8 layout checks and Flow/
  dashboard scripts pass. Offline browser verified IV Rank input, original
  KWANTY settings/Save/State selection and live theme propagation. This was
  bridge/UI-fixture QA, not signed-in live chart-grid or cloud-save proof.
- Unsupported licensed adapters remain honestly unavailable, including GEX
  DATA Exposure Forecast. Existing historical coverage, public streaming,
  weekly completeness and live multi-panel/footprint soak remain OPEN.
  Record: `docs/prompt-log/2026-10-19-options-flow-chart-panels.md`.

## 2026-10-19 — Volume-profile appearance must retain selected data

- Line used to trace total volume regardless of selected mode, then skip all
  delta/bid/ask paths. Shared renderer now traces each selected component using
  exactly the Solid geometry. Delta-only and delta-percent no longer substitute
  a volume silhouette; combined volume+delta retains both. Level attachment is
  mode-owned, not appearance-owned. Zero delta must not invent a docked mark.
- Covers the common Daily/Weekly/Composite/Monthly/Session/Visible renderer and
  Ask/Bid/Delta variants. Independent TPO and SVG draw-on paths were inspected;
  they do not share this suppression gate. Swing/Values currently force Solid.
-21 focused tests pass, including600 renderer combinations and225 stored
  mode/style pairs. Local synthetic Solid/Line previews checked visually.
  One existing chart-width source-pattern assertion fails in unchanged code.
- Historical coverage, stable public streaming, weekly completeness and actual
  signed-in footprint/profile soak remain OPEN; not solved by a paint fix.
  Record: `docs/prompt-log/2026-10-19-volume-profile-style-combinations.md`.

## 2026-10-19 — Owner-curated seventeen themes (supersedes expansion batches)

- Keep only the owner's17 named presets, in request order. Remove the other58
  from the website picker, including the recent20 and profile-gradient themes.
  Exact canonical names are in KEPT_THEME_NAMES / the prompt record below.
- All17 resolved palettes match the previous release exactly; default Mono
  Protocol, existing saved/custom colours and account/theme application stay
  intact. Removing picker entries does not erase user colour snapshots.
- Daily/Weekly Volume Profile gradient controls retain all12 schemes and Off;
  this directive removes WEBSITE THEMES, not indicator settings or colours.
-27 focused tests plus14 hollow-candle/brand checks pass. Removed Chromey Mono
  lives only as a legacy test fixture, not a selectable preset. Previous
  catalogues recoverable through Git. Existing workspace source-pattern,
  history, streaming, footprint/soak and weekly completeness gaps remain OPEN.
- Record: `docs/prompt-log/2026-10-19-curated-theme-prune.md`.

## 2026-10-19 — Profile gradient colours available as themes

- Every one of the12 Daily Volume Profile schemes now has a named theme:
  existing Chromey Mono plus11 new exact-labelled pairs. Off stays a control.
  Source endpoints and card gradients come from VOLUME_PROFILE_GRADIENTS,
  not copied hex constants.75 total themes; previous64 colour palettes intact.
- Raw chart candle colours retain the pair; UI ink/outline contrast may be
  lifted for dark endpoints. Black→White has visible outlined dark candles.
  Profile gradient selections/custom colours and current theme are not reset.
-29 focused checks pass; scoped lint passes; all12 local token previews
  visually checked. Signed-in Settings/cloud roundtrip remains unverified.
- Existing history/streaming/footprint acceptance/weekly completeness and
  workspace source-pattern regression remain OPEN. Record:
  `docs/prompt-log/2026-10-19-profile-gradient-themes.md`.

## 2026-10-19 — Correct dark-theme colour diversity

- Owner rejected the purple-heavy20-theme batch. Purple was an example, not
  the collection's governing colour. Revised20 now span ruby, cobalt/copper,
  chrome/emerald, orange/lime, pine/gold, yellow/blue, cyan, teal, copper/jade,
  acid, gold, ember, red/white, coral, fuchsia, pink, lime and turquoise/amber.
  Only Velvet Voltage retains purple accents/surfaces in the new collection.
- Renamed changed palettes to match actual identities. Original44 themes and
  current/custom saved palette snapshots remain unchanged; select a revised
  preset to apply it. No new renderer work or changes to theme-save semantics.
-26 focused checks pass, including a purple-exclusivity and broad hue-family
  guard; all20 visually inspected together in a local token-preview board.
  Existing workspace source-pattern failure, missing history, live streaming,
  footprint acceptance/soak and weekly/profile gaps remain OPEN.
- Supersedes the purple-heavy initial batch below. Record:
  `docs/prompt-log/2026-10-19-dark-theme-diversity-correction.md`.

## 2026-10-19 — Twenty deep-dark themes

- Owner preference: clean, deep, colourful dark themes with vivid purple/neon
  accents; no pastel/tacky styling. Added20 palettes after the four foundation
  cards, preserving all44 existing palettes and the default/current selection.
- Theme tokens only; existing apply/save/chart/indicator theme pipeline stays
  unchanged. No animated glows, filters, new polling or renderer work.
- New20 pass dark-shell, saturation, distinctness and text/action contrast
  checks. Scoped theme checks25/25; wider suite29/30 (existing workspace source
  assertion fails in unchanged code). Full84-page build and lint pass; local
  browser palette previews inspected, not signed-in settings/roundtrip proof.
- Ongoing exact-history, stable-streaming, footprint UI/soak, weekly aggregate
  completeness and existing daily-profile regressions remain OPEN.
  Record: `docs/prompt-log/2026-10-19-deep-dark-themes.md`.

## 2026-10-19 — Footprint partially populated / recovery

- A single missing/mismatched candle previously rejected every exact historical
  footprint bar. The UI path now validates the entire payload, paints only bars
  whose full OHLCV reconciles, and reports the missing count. Corrupt payloads,
  wrong identity, impossible levels/totals remain rejected; no synthetic cells.
- Partial responses never enter the completed warm cache. Up to three backoff
  retries recover the same viewport after a transient failure without user input;
  scope changes/unmount abort work. This is bounded, not continuous polling.
- Real local pipeline check: 81/81 settled NQ and ES bars built with rows and
  exactly matching candle volumes (17,655 / 20,453). Public compact POST ~649ms.
  64 footprint tests pass. Signed-in screenshot reproduction remains unverified:
  this session exposes no Chrome tab, and a bare production API request is401.
- Missing archives, stable live streaming, all-indicator UI/soak and existing
  daily-profile regression gaps remain OPEN. Record:
  `docs/prompt-log/2026-10-19-footprint-partial-recovery.md`.

## 2026-10-19 — Shared indicator loading and footprint requests

- Request deadlines now cover response-body downloads, not just headers.
  Shared workspace JSON retries use one total timeout budget, rather than two
  consecutive full budgets. Explicit historical backfill limits remain intact.
- Identical exact-footprint windows share one validated request across panes.
  Successful results have a 60-second cache capped at four windows / 50,000
  decoded records total. Empty/error responses are not cached; candle/filter/
  contract changes cannot reuse another result. Last-owner cancellation aborts.
- 27 targeted tests passed; scoped lint and the production build passed (84
  pages). This is not all-indicator UI certification or restored provider data.
- Still OPEN: stable streaming origin, missing exact sessions, aggregate
  completeness bug, and signed-in all-indicator/timeframe loading/soak checks.
  Record: `docs/prompt-log/2026-10-19-shared-indicator-loading.md`.

## 2026-10-19 — Chart first-load concurrency

- Removed the optional live-seam network call from the candle/cache bootstrap
  barrier. Cold ordinary-time OHLC starts immediately, shared/reused while
  cache/flow/seam hydrate independently. Browser cache waits capped250ms.
- Late seam commits remain scope/cancellation/continuity checked; event geometry
  and missing-flow fail-closed behaviour unchanged.21 focused tests pass.
- This is NOT a repair of the quick-tunnel SSE limitation or missing tape.
  Actual signed-in startup timing/all-symbol QA remain unverified. Record:
  `docs/prompt-log/2026-10-19-chart-first-load-concurrency.md`.

## 2026-10-19 — Market-open L3 is active; all indicators NOT verified

- Ten subscribed futures have valid live L3 books; raw recording and exact
  trade-tape counts advance, with no reported drops. This is not proof of all
  instruments or missing history. NQ current profile grows but lacks22:00–22:56Z.
- Five-session aggregate reports complete even though the current individual
  session is incomplete: per-session completeness needs fixing before trust.
- Local SSE delivers live trade batches; public quick tunnel delivers only its
  initial seed during a20s check. Website historical execution-profile source
  remains503/cooling down. Do not call footprint/CVD/weekly fully restored.
- Details: `docs/prompt-log/2026-10-19-live-l3-indicator-audit.md`. Stable streaming
  origin/VPS, exact opening backfill and end-to-end indicator checks remain OPEN.

- Follow-up latency diagnosis: Cloudflare officially documents Quick Tunnels
  as NOT supporting SSE (the live quote/execution transport). Replace the
  temporary trycloudflare origin with a verified stable streaming origin, not
  faster per-user polling. Sample1m/5m/15m/1h histories load publicly in400–976ms;
  the reported40s signed-in startup remains unreproduced/unisolated. Record:
  `docs/prompt-log/2026-10-19-chart-load-and-stream-latency.md`.

## 2026-10-18 — GEX DATA instrument/time dropdowns

- Instrument fields are selects backed by the site's offered options
  underlyings (VIX included; SPXW alias/VXN are not invented API roots).
  Existing saved/imported symbols remain visible as saved selections; no
  account preferences, defaults or page/global precedence are discarded.
- Page/global instrument filters and known Filter Group ticker/enumeration
  values use checkbox dropdowns, preserving multi-value OR selections. Dates
  have native calendar pickers (legacy multi-date expressions preserved),
  numeric/custom fields remain editable. Unknown provider enums are not guessed.
- Snapshot time has a dropdown built only from returned timeline timestamps,
  synchronized with the existing slider/latest action. No extra feed, metadata
  endpoint, polling or provider credential was introduced. Static entry points
  are versioned so old cached text controls are not mixed with the new UI.
- 81 GEX DATA model tests plus seven integration tests, scoped lint and the
  optimized production build pass. Local browser verified SPY/5m selection and
  reload, snapshot dropdown/slider sync, multi-symbol page filters and clear
  restoring each panel's own instrument. Browser data was explicitly synthetic;
  signed-in production data/market-open soak is not claimed by this UI change.

## 2026-10-18 — Expiration calendar date clarity

- Today and the selected date now have separate full-date labels. Today has a
  strong outline and TODAY caption; selection has a fill/marker. Weekday labels
  are Sun–Sat, not ambiguous initials. Past dates are dimmed, never disabled,
  in year/month grids and the unfiltered historical agenda. Selected past dates
  stay easier to read; hover/keyboard focus restores contrast.
- Past/today comparisons use America/New_York dates, not device midnight.
  Source expiry dates, semantic colour values, filters and data requests are
  unchanged. Fourteen calendar tests include actual server-rendered views and
  New York midnight/year-boundary checks.

## 2026-10-18 — Financial Info in NEWS (connection pending)

- Financial Info is a separate NEWS tab with original timestamped headlines,
  timezone, source categories/search, details, pause/resume and scroll-safe
  updates. Existing economic calendar and macro sections stay intact.
- Specified Apify Actor scrapes RSS, not the premium instant FinancialJuice
  stream. Owner has NOT set up Apify yet. No account, subscription, paid run or
  schedule was created. Do not claim live 24/7 news is connected.
- Shared read-only gateway adapter polls completed successful Actor datasets;
  browser requests NEVER start paid runs. Requires private APIFY_API_TOKEN and
  FINANCIAL_INFO_ENABLED=1, plus separately approved scheduled Actor runs,
  actual pricing/spend cap and source redistribution permission. Vercel only
  serves authenticated cached snapshots; this is not zero-cost hosting.
- Current temporary market collector is left running unchanged: no needless
  feed restart for an unconfigured news source. Carry new service/server wiring
  to the VPS at the planned cutover, or deploy it once credentials are ready.
- REA inspected the requested public page but found a Cloudflare blocked page;
  no security bypass or exact-layout/parity claim. Setup, sources and evidence:
  `docs/financial-info-setup.md`. Live ingestion and signed-in UI soak remain OPEN.

## 2026-10-18 — Options gateway restored with process-exit supervision

- Found the temporary gateway absent and its existing public tunnel returning
  502. The private QuantData credential was valid; this was not a key renewal
  failure. There is no durable exit record proving why the former process died.
- Restored one hidden supervisor2988 / gateway22020 at 11:33 UTC. Local and
  unchanged public tunnel returned HTTP200 with nonempty QQQ minute history and
  SPX/QQQ/SPY/NDX gamma surfaces. Production diagnostics returned gateway200,
  connected/authenticated true and SPX archived history1015 bars. This supersedes
  the offline and CME permission-denied observations below; not a live-RTH soak.
- New `services/rithmic_gateway/scripts/supervise-background.mjs` owns output
  pipes, bounded rotating private logs, exclusive PID lock, port ownership check,
  bounded exit-only restarts and a ten-start/hour ceiling. All412 gateway tests
  pass, including four supervisor tests. No duplicate feed owner was launched.
- Private launcher preflight now catches network failures instead of preventing
  HTTP startup; known401/403 still disables unauthorized provider polling.
  No keys were changed in Git/Vercel and no provider streams moved to Vercel.
- Private state: `%LOCALAPPDATA%/KwantDesk/temporary-market-gateway/supervised-runtime`.
  For a planned VPS cutover create its `STOP` file BEFORE stopping the laptop
  gateway/supervisor; otherwise process-exit recovery may start it again. Stop
  the old owner before starting a new Rithmic session. Never kill it just to test.
- Laptop must remain awake/online. This is not boot startup, tunnel supervision
  or VPS uptime. Autonomous QuantData surface polling reports disabled; requested
  successful surfaces are archived, but continuous/month-complete capture is NOT
  proven. Missing archives, execution-profile provider503, full-month history,
  redistribution and VPS migration remain OPEN. Do not call all pages verified:
  checks covered public API paths, not every signed-in UI surface.

## 2026-10-18 — Options expiration calendar

- Post-push operational check: localhost8793 refused the health connection and
  temporary gateway2164 was absent; tunnel20608 remained. This supersedes the
  previous permission-denied-only status. No gateway restart was attempted by
  the calendar task. Calendar source checks do not depend on that market feed.

- KWANTY calendar uses Cboe's actual published date/colour markers, not inferred
  contract expirations. Opening it needs no market-data gateway. Six-hour shared
  source cache; source revision/time and explicit stale status are visible.
- Unknown PDF layouts/colours must fail to the last verified calendar and flag
  review. New annual links in the supported official format are discovered;
  format redesigns are not silently guessed. Cached revalidation and outages can
  delay a newly published revision; do not describe this as instantaneous push.
- Calendar dates are New York dates even on a Brisbane device. Last trading days,
  actual expiries, exchange holidays and LEAPS listing dates are distinct. It is
  not a live options chain or proof every product lists every marked expiry.
- Standing CME login, denied Orderflow history, full-month recording/archive,
  redistribution licensing, VPS and capacity/cost issues remain OPEN below.

## 2026-10-18 — KWANTY and current CME authentication blocker

- Owner chose KWANTY for the new Classic/State/Orderflow page, distinct from the
  existing KwantBot assistant. Personal API authentication and actual Friday
  snapshots work through the shared gateway. Orderflow historical access403,
  native streaming, web-only classified splits, future customer redistribution
  licensing and live-RTH/capacity/cost verification remain OPEN. No invented curve.
- The single temporary gateway was restarted once to load its server-only
  adapter. CME subsequently returned login13 permission denied and backed off;
  this supersedes earlier connected/authenticated recovery evidence below.
  Do not present gateway HTTP health or enabled recorder as capturing live tape
  while CME is unauthenticated. Stop this laptop login owner before VPS takeover.
- Private positioning credential is outside Git in temporary gateway storage;
  VPS migration needs the same server-only credential/configuration and archives.
  Month-long complete history/recording and archive recovery remain unresolved.

## 2026-10-18 — Current temporary data status and GEX DATA limitations

- Laptop gateway and tunnel recovered again using detached hidden processes;
  public production runtime verified authenticated/connected at recovery SHA
  `42f5ffa699baacdb8c47c1b5fe26cfd0b790a19e`. NQ candle history and SPX archived
  candles responded successfully. Keep the computer awake/online until the VPS
  migration. Stop this login owner before starting its replacement.
- Exact execution-profile source currently reports unavailable/cooling down.
  Candle availability must not be described as restored footprint/CVD tape or
  full L3. Month-long complete catalogue history, comprehensive options recording,
  VPS/archive recovery and capacity/memory/cost validation remain OPEN below.
- GEX DATA uses real licensed gateway responses, not the prototype server or
  vendor credentials in the browser. Exposure Forecast is not supplied by this
  API and stays explicitly unavailable. Net Drift vendor visual/math parity,
  live market-open soak, every optional tool's full endpoint/filter matrix and
  cloud cross-device workspace-save roundtrip are not certified by 84 passing
  model/integration tests and six-panel weekend browser QA.

## 2026-10-17 — Profile management database prerequisite

- Owner confirmed running `supabase/migrations/202610170001_social_profile_management.sql`
  on 2026-10-17. Recorded as owner-confirmed applied, not independently inspected.
  It permits archive/audience/profile notes on locked Gameplan Socials records
  while keeping trading data immutable. No additional website deployment needed.
- Signed-in archive/restore/note and owner/friend/stranger privacy checks remain
  unverified; do not mark the complete end-to-end workflow verified yet.

## 2026-10-17 — SPY/QQQ blank on wide history request

- Fixed entire-chart rejection when a 3M request has valid recent candles but
  incomplete older coverage. Show verified available bars plus an explicit
  partial-history notice; do not silently present them as the full range.
- Chart startup no longer fans out to the provider for old gaps before its
  available archive. Recent gap/live-tail fallback remains bounded.
- One-month history requirement is still OPEN: current SPY/QQQ archives cover
  Oct5–16 only. This repair does not import the missing month/three months.
- Record: `docs/prompt-log/2026-10-17-underlying-partial-history.md`.

## 2026-10-17 — Footprint zoom mode

- Fixed coverage-dependent fallback to native candlesticks during zoom/history
  expansion. Footprint stays the selected mode, retaining proven rows and real
  OHLC geometry; native candle colours also start transparent on first paint.
- 55 Footprint tests pass. Missing source history and the broader unresolved
  indicator/provider/recording issues remain open; this is a presentation fix.
- Record: `docs/prompt-log/2026-10-17-footprint-zoom-mode.md`.

## Launch requirement — At least one rolling month of real history

- Owner's 2026-10-17 requirement: at least one full rolling calendar month of
  futures and options history, with continuing unattended recording/backfill.
  Underlying candles, option-contract trades/quotes/chains, exact futures tape
  and raw depth/L3 are distinct coverage contracts; do not equate their presence.
- Current read-only audit: temporary gateway runs on the laptop, raw recorder
  enabled but provider disconnected (configured Paper Trading system absent
  from discovery). Zero futures records since the latest process start.
  Configured startup subscriptions are only NQZ6/ESZ6, not the whole catalogue.
- Options response archiver is enabled and has saved successful current-process
  payloads. Automatic full-surface polling is OFF intentionally for quota safety;
  request-driven payload capture is not unattended comprehensive options capture.
  Cash-underlying automatic completed-session archiving remains wired to start.
- File inventory only, not full candle/receipt validation: futures bars cover
  Oct10–16; cash-underlying files Oct5–16; exposure files Oct16 only. Reconciled
  exact completed tapes: NQ session-start Oct12–15, ES Oct13–15. Some other roots
  have partial tapes; this is NOT a month or full L3 coverage.
- Required next work: recover old VPS disk/backups if available; resolve current
  provider discovery/history access; checkpoint/backfill one month per offered
  instrument under existing budgets; verify Theta distribution historical rights,
  coverage and credentials; build quota-shared unattended options collection;
  migrate verified archives to always-on VPS plus off-box backup. A VPS alone
  cannot repair source entitlements or recreate unrecorded historical depth.

## 2026-10-17 — Footprint loading regression

- Fixed normal clock-chart views being rejected at the 100,000 raw-print cap:
  the backend now sends exact compact price-level/count/delta-path reductions,
  validated against actual candle OHLCV. No trade sampling or increased raw
  browser tape cap. New history hydrates all closed bars immediately.
- Real public NQ/ES 160-minute views validate; Footprint 53/53 and gateway
  393/393 tests pass, plus scoped lint and isolated production build.
- Still open: ten pre-existing profile/TPO test failures in the wider indicator
  sweep (143/153 pass), missing weekly source sessions, other futures' missing
  tape, event/sub-minute history, authenticated UI/memory/live-session soak and
  VPS migration. Do not claim every indicator is verified working.
- Evidence: `docs/prompt-log/2026-10-17-footprint-loading-capacity.md`.

## 2026-10-17 — Login reliability / missing weekly history follow-up

- Fixed pre-login TLS failure on individual provider DNS addresses with bounded,
  certificate-verified failover shared by live/history connections. Backend is
  connected/authenticated again. Empty failed-recovery chunks no longer remain
  permanent negative checkpoints; exact reconciliation still gates publishing.
- Not resolved: provider currently returns empty History Plant minute/VAP
  responses, including a known previously recovered recent hour. Missing weekly
  NQ Oct11 and ES Oct11/12 cannot yet be recovered. Provider availability/history
  access needs confirmation; the cause of empty responses is not established.
- Daily NQ remained complete after graceful restart; weekly remained explicitly
  incomplete. 393 gateway tests pass. Do not promise all indicators work at every
  login until data coverage and signed-in/live-session soak are verified.
- Record: `docs/prompt-log/2026-10-17-indicator-recovery-transport.md`.

## Priority — A few hundred users around November 2026

- Recorded 2026-10-17: owner targets a few hundred users in roughly one month
  (around November 17). Keep at least 100 concurrent users as a provisional
  load-test target; confirm expected peak concurrency before sizing production.
- Upcoming Theta Data distribution must inform provider/backend design, but
  its activation, licensed redistribution, entitlements and exact coverage are
  not verified. Do not assume it replaces futures tape/depth/L3.
- Avoid throwaway single-user work: shared upstream ingestion, reusable cached
  history/calculations, bounded client fan-out and a migration-safe provider
  boundary. Temporary laptop hosting is not release-ready infrastructure.
- Launch gates still required: concurrent/market-open load and memory tests,
  isolation, reconnect/recovery, durable storage/backups and measured cost caps.
  This is a standing constraint, not a claim that capacity is already achieved.

## 2026-10-17 — Profiles enabled but invisible on all instruments

- Fixed shared daily session-boundary mismatch and removed the live-feed
  connection prerequisite for archived profiles. Exact archived identity is
  required; no mini/micro substitution or guessed rollover contract.
- Verified complete Friday NQ/ES daily profiles against the real gateway using
  the browser request builder. This does not prove all instruments have history.
- Still open: missing NQ session-start Oct11 and ES Oct11/12, exact tape for
  other futures, authenticated chart/memory soak and VPS migration. Weekly
  profiles cannot be called restored until all required history is recovered.
- Evidence: `docs/prompt-log/2026-10-17-profile-display-session-routing.md`.

## 2026-10-17 — Font rollback checkpoint

- Website typography now uses the supplied Aleph Regular/Bold. Font sizes,
  weights, tracking and layout classes remain unchanged. Emoji/icon glyphs
  retain their appropriate rendering. Check wrapping on the signed-in dense
  workspace: Aleph is not the old monospaced face and glyph advances differ.
- Pre-font production is saved at tag `codex/pre-aleph-font-2026-10-17`
  (`c1767932`). Weekly history/provider recovery, browser-memory soak and VPS
  migration remain open; this typography change does not fix those blockers.

## 2026-10-17 — Missing execution-backed indicators

- Weekly follow-up: the requested five-day NQ/ES profiles are unavailable,
  not still calculating: one/two source sessions are missing. Recovery retry
  still failed at TLS connection. Explicit chart errors and a 15-second
  request deadline replace silent waiting; missing interior sessions now
  prevent a false complete profile. Full weekly data recovery remains open.

- Temporary candle history alone was insufficient: restored exact NQ/ES
  executions now feed profiles, minute delta and bounded Footprint history.
  Fixed stale source caches, completed-session snapshot overwrites and exact
  contract routing during a disconnected/root-only live-book startup.
- **Still open:** finish ES session-start Oct12 and both Oct11 imports; the
  provider began refusing/resetting connections. Seven sessions completed and
  checkpoints preserved. Other offered futures lack recovered exact tape.
- **Still open:** wide Footprint windows above 100,000 prints require zoom-in;
  event-chart Footprint remains on its separate path. No claim of complete
  L3 recovery, continuous-stream receipt coverage or all-indicator parity.
- **Still open:** authenticated chart/browser-memory soak and live-session
  feed verification. The temporary laptop gateway must remain awake; migrate
  code, minute folds and raw recovered tapes to the replacement VPS.
- Record: `docs/prompt-log/2026-10-17-indicator-history-recovery.md`.

## 2026-10-17 — Recurring browser freeze / last chart viewport

- Follow-up precise stall columns identified gamma cash-close calibration's
  full-history scan at 73–78% of sampled CPU. It now uses bounded binary
  lookups and skips work for a still-valid calibration. Owner observed ~1 GB
  Chrome footprint / 94.4% CPU. Sustained memory and CPU recovery on the
  authenticated workspace is not yet verified; keep the incident open.

- Removed per-candle native timezone-formatter construction in gamma,
  sweep references and profile calendar calculations after production
  telemetry captured 14–20s stalls in their bundle. Clock allocation,
  DST and real calculation regressions pass. No user data was reset.
- **Still open:** authenticated saved-workspace startup/soak on the new
  deployment; bundle-only attribution does not establish every crash's cause.
  Source columns are now retained in opt-in stall profiles.
- **Still open:** restore each account/pane's last chart viewport rather
  than opening too zoomed in. The browser-freeze incident superseded that task.
- Evidence: `docs/prompt-log/2026-10-17-browser-startup-freeze.md`.

## 2026-09-09 — Multi-screen options/GEX gateway freeze recovery

- The production outage was server-side, not a browser or monitor fault. On
  restart the gateway scanned the current multi-gigabyte raw L3 archive on its
  HTTP event loop. It reached 2.4 GB RSS, stopped answering `/health`, and made
  every QuantData-backed options/GEX request fail or wait behind the freeze.
- Production now restores the exact execution tail from the existing compact
  trade tape instead. The verified restart read 11 files and merged 273,077
  historical trades in about 18 seconds while `/health` remained responsive;
  RSS settled near 340 MB. The live execution ring is capped at 25,000 per
  contract and trims in batches so a full ring cannot shift 100,000 objects on
  every new print.
- Container health now treats an event-loop/HTTP hang separately from a normal
  disconnected session: a hang reaches autoheal in roughly two minutes, while
  a responsive Rithmic reconnect retains its deliberate ten-minute grace.
- The raw L3 recorder's former 384 MiB backlog allowance was per instrument;
  with 11 subscribed contracts it could retain more than the VM's total RAM.
  Production now caps each gzip queue at 16 MiB and reports pending bytes plus
  explicit dropped-message counts in `/health` rather than freezing the desk.
- Options positioning and GEX Map structural refreshes are limited to 15
  seconds, with a 25-second budget only for the measured large interval-map
  response. The separate live-price pulse keeps sub-second quote cadence.
- **Still open:** run a production-authenticated three-screen soak with OBS and
  the capture card active through several structural refreshes. Confirm RSS,
  event-loop lag, provider quota, all four SPX/SPY/QQQ/NDX panels and advancing
  recorder counters; the deterministic and direct endpoint checks do not
  reproduce the user's full GPU/display workload.

## 2026-09-07 — GEX Levels release reverted after chart startup incident

- The entire `be186dfc` GEX Levels release was reverted by `f3f1858d` after
  production Charts spun/crashed on load. When that was insufficient, both
  immediately preceding Speed of Tape Instant releases were also reverted.
  Production was verified on exact SHA `d5312869` while the gateway remained
  connected/authenticated.
- **Still open:** capture the client exception and reintroduce GEX/Instant Tape
  changes one at a time behind production-like saved-workspace startup QA. Do
  not cherry-pick or repeat any reverted batch.

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

- **2026-10-17 chart loading:** gateway buffered history/options surfaces use
  async cached gzip, and completed-session options responses cache five minutes.
  Futures first paint is independent of the optional execution archive and
  IndexedDB writes; options history uses one normalized window request. Deploy
  the same response helper/server/vendor changes when returning to the VPS.
  Backend timings improved to roughly 0.4–1.1 seconds in the measured probes;
  signed-in browser load and market-open streaming remain separate checks.

- **2026-10-17 temporary recovery:** Vultr account closure has made the old
  collector unreachable. The temporary committed gateway runs on the owner's
  Windows computer through Tailscale Funnel; keep it awake/online and stop it
  before restoring the same Rithmic login to a VPS. New recordings are under
  `%LOCALAPPDATA%/KwantDesk/temporary-market-gateway/services/rithmic_gateway/recordings`.
  Last week's minute-bar import is separate from unavailable exact tick/L3
  history. The renewed QuantData key is now installed on the temporary backend;
  all 65 last-week underlying sessions imported successfully. Futures history
  passed for 49 roots; QM, UB, 10Y and SR3 remain provider-reference blocked.
  A detached QUIC HTTPS relay replaced the unstable HTTP/2 relay. Vercel's
  duplicate project is disconnected; the overall spend cap remains unconfirmed.
  Quick-tunnel HTTP history passed, but its SSE initial-frame probe timed out:
  restore the VPS streaming origin before live trading. Vercel billing reports
  overdue; no payment or spending-limit mutation was made by this recovery.
  See `docs/prompt-log/2026-10-17-temporary-feed-recovery.md`.

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

## 2026-09-07 — Footprint chart polish

- A Footprint's selected input owns every related calculation. Trades mode
  must use trade counts for POC, value area, VWAP, maxima and imbalance; never
  display trade counts while classifying the row from contract volume.
- A ratio `R` maps to delta percentage `(R - 1) / (R + 1)`. Do not restore the
  old `R * 10` shortcut. Positive/negative maximum markers must fail closed
  when that sign does not exist.
- Bid x Ask cells never collapse into an unlabelled total. Hide the figures
  until the pair fits. Side-profile row geometry comes from its configured
  grouped tick step, not the distance between sparse prints.
- The seven visible stock presets are deterministic starting points and retain
  the user's palette/performance caps. Prompt/outcome:
  `docs/prompt-log/2026-09-07-footprint-polish.md`.

## 2026-09-07 — Market-index live first paint

- A verified live SPX/NDX/SPY/QQQ frame must make its chart usable immediately;
  full historical hydration is not a prerequisite for clearing the spinner.
- History continues independently and merges behind the live candle when ready.
  Never invent history to achieve first paint.
- A gateway overload can delay history without stopping an already hydrated
  symbol. Keep backend overload diagnosis separate from this client loading
  invariant. Prompt/outcome:
  `docs/prompt-log/2026-09-07-market-index-live-first-paint.md`.
