# KwantDesk phone layout audit — 4 November 2026

## Findings and changes

The desktop layout was being compressed into a phone viewport. In the isolated
390 × 844 Chrome baseline, the restored watchlist and side rail left the main
workspace only about 66px wide. The chart still demanded a 520px surface and
the command toolbar expanded to three rows. This was a layout fault, not a
reason to alter market data, chart calculations or server infrastructure.

The phone presentation now uses:

- A floating bottom-left menu opening a labelled side drawer, using the same
  routes, account actions and trading actions as the desktop navigation.
- A compact chart header with visible instrument/timeframe selectors.
- Chart controls, indicators and replay in an on-demand drawer.
- Drawing tools hidden initially, with an explicit Show drawing tools action.
- Watchlist and other side panels closed initially on phones, regardless of
  the restored desktop preference. Opening them overlays the chart.
- One selected chart at a time, with all saved panes available in the menu.
  Desktop split ratios and layout remain stored unchanged.
- Phone controls drawers and a panel selector for embedded KWANTY and GEX Data.
  Original controls are moved with their event handlers intact, then restored
  to their original DOM positions when returning to desktop width.
- Liquidity Map controls moved into its drawer; no heatmap, depth, palette,
  execution, clustering or trading-engine calculations were changed.

Phone styles apply below 768px, or to short landscape touch viewports. Larger
desktop layouts retain their existing controls. The embedded-page mutation
observer is disconnected on desktop. No provider calls, polling or API routes
were added by this change.

## Verification

- 18 actual React/workspace checks and 14 actual public-page checks passed,
  with no uncaught browser errors. Data and identity responses were isolated
  fixtures; no logged-in production workspace was operated.
- Widths: 320, 390, 430, 740, 768 and 1440px; touch landscape 844 × 390.
- After: the chart pane measures 388 × 806px in a 390 × 844px viewport, with
  desktop navigation and the three-row command toolbar taking zero layout space.
- Tested menu open/close/Escape, original indicator controls, drawing rail,
  watchlist overlay, multi-pane selection, light theme, News, Journal and
  Backtesting route entry.
- Two desktop panes become one full-width selected phone pane. Returning to
  desktop restores both panes with byte-identical stored tree/layout values.
- KWANTY's actual timeframe button updates its original interval input. GEX
  Data's saved panels remain selectable, with one full-width tool visible.
- All three embedded pages restore original desktop control DOM positions.
- Full Next production build and final TypeScript check passed. Scoped lint
  passed with two existing AppSidebar image-optimization warnings.

## Evidence and limits

`baseline.json`, `workspace-checks.json` and `embedded-checks.json` contain the
measurements and named checks. PNGs show isolated fixture UI, not live prices.

This validates responsive layout/control behaviour, not market-data accuracy,
real-order execution, every individual indicator setting, or every page's data
state. It was tested in headless Chrome with phone viewport/touch emulation;
the owner's physical phone was not connected. Physical iOS/Android keyboard,
browser chrome and accessibility combinations still merit device testing.
No VPS, gateway, terminal or market subscriptions were restarted.

TradingView research: its documented mobile approach supports switching between
charts and full-screen viewing, and hiding drawing controls. KwantDesk uses the
owner's requested side menu rather than introducing a second trading engine:
[mobile chart switching](https://www.tradingview.com/blog/en/multi-chart-view-on-a-mobile-screen-10924/),
[drawing toolbar visibility](https://www.tradingview.com/support/solutions/43000512928-how-can-i-enable-disable-the-drawings-toolbar/).

## Repeat the isolated checks

Install Playwright in an isolated tool directory, set `KWANTDESK_PLAYWRIGHT_MODULE`
to that module path and optionally `KWANTDESK_CHROME_EXECUTABLE` to local Chrome.
Then run `node scripts/audits/phone-workspace-browser.cjs` and
`node scripts/audits/phone-embedded-browser.cjs` from the repository root.
The workspace harness uses Next's bundled webpack, TypeScript and the real
React components with explicit test-only auth/navigation/data fixtures.
The embedded harness serves committed public modules plus the phone stylesheet
and script. Both restrict browser network access to their local fixture server.
