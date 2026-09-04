# KwantDesk Engineering Handoff

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
