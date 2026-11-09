# Embedded chart panel formatting

## Change

Embedded workspace tools now use the normal Charts panel shell: the same header height, spacing, horizontal overflow and sticky close action. Floating tools use one outer header instead of nesting another header inside it.

The embedded liquidity map has its instrument selector, Trade and Controls actions in that header. Its original extra instrument/action/tool rows are removed from the plot area. Controls opens the existing named controls drawer, retaining the original buttons and event handlers. Instrument selection opens the original supported-instrument dialog. Trade opens the standard inline chart ticket. This mode is explicitly scoped to `workspacePane=1`; the standalone liquidity map retains its native bars. The new pane stylesheet participates in the existing stylesheet readiness/retry guard.

No market renderer, depth calculations, provider subscriptions, account data or execution rules changed. No live feed restart or owner-browser operation.

## Verification

- Isolated headless Chrome: eight checks passed with zero page errors. Real Workspace, LiquidityMapWorkspace and map HTML/CSS/controls; market renderer/data and account transport are stubbed. The image is a layout fixture, not evidence of live heatmap rendering.
- Normal and embedded headers both measured 44px and aligned vertically. Map content starts at iframe y=0 without extra bars.
- Controls retain click handlers; instrument picker opens; inline trade ticket pushes the chart left; close stays within narrow panels; detached map has one header and working controls; standalone map retains its app bar.
- JavaScript syntax and scoped LiquidityMapWorkspace ESLint pass.
- Related test suites: 37/43 pass. The six failures also fail on unchanged HEAD (obsolete GAMMA label/cache assertions and duplicate test harness missing `workspaceDuplicateSeeds`). Unchanged HEAD was 36/43: its stylesheet readiness source assertion now passes with this change.
- Broader liquidity controls/trading suites: 23/38 pass; all 15 failure names match unchanged HEAD. These existing failures were not changed or represented as passing.
- Full isolated webpack production build passed, including TypeScript and page generation.

Browser harness: `scripts/audits/embedded-chart-panel-chrome-browser.cjs`. Requires local Playwright/Chrome via KWANTDESK_PLAYWRIGHT_MODULE / KWANTDESK_CHROME_EXECUTABLE and the existing isolated release build CSS.
