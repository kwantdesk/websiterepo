# KwantDesk Engineering Handoff

> Read this entire file before changing the repository. This is the operating memory for a temporary engineer working on KwantDesk. It describes the product, architecture, working rules, data ownership, quality bar, verification process, and current state as of **2026-08-18**.

## 1. Your role

You are acting as the second engineer on KwantDesk for a short handoff period. Work directly in this repository, preserve the existing product, diagnose the real cause of bugs, implement complete fixes, test them, commit them, and push them to `origin/main` so Vercel can deploy them.

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
