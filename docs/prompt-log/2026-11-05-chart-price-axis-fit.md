# Price axis clipped in small chart panels

Owner screenshot shows the right price labels cut off at a narrow footprint panel's edge. The plot must end before its own right price scale, not behind a parent clipping edge.

The shared chart wrapper imposed a 520px minimum width on both the toolbar and chart body. A smaller docked/floating panel therefore clipped a correctly rendered price axis outside its visible boundary. The same wrapper scrolled the chart body with the header.

The chart body now measures the actual available panel width with no forced 520px minimum. Horizontal scrolling belongs exclusively to the header, whose control groups retain their natural width and spacing. Header height reserves a thin scrollbar gutter. A floating chart uses its full available height rather than reserving space for the former bottom scrollbar. No chart data, price calculation, scale precision or workspace preference changes.

Verification: actual shared Chart rendered inside the production wrapper classes, with normal and footprint indicator configurations, docked/floating layouts, and widths 800/500/400/260/180/600px. All 24 cases retain the real native price-scale canvas inside the panel; the chart's right edge stays at the panel edge; toolbar scrolling moves neither plot nor price scale. The old compiled stylesheet reproduces clipping at 500px; repaired production CSS passes. Zero page errors. Local synthetic candles and no live provider/owner requests. Screenshot inspected at 400px. Full isolated webpack build passes TypeScript and 86 static pages; the fixture additionally undergoes incremental TypeScript validation.

Browser runner: `scripts/audits/chart-axis-fit-browser.cjs`; entry: `scripts/audits/chart-axis-fit-fixture.tsx`. `CHART_AXIS_FIT_CSS_ROOT` selects the compiled CSS directory and `KWANTDESK_PLAYWRIGHT_MODULE` an installed browser module. Evidence remains local: `tmp/chart-axis-fit-before.log`, `tmp/chart-axis-fit-after.log`, `tmp/chart-axis-fit-results.json`, `tmp/chart-axis-fit-400.png`.

Broader existing resize/toolbar checks: 11 pass, one unchanged source-pattern assertion fails because it expects the pre-phone `<div className="kwant-chart-toolbar-shell shrink-0">` markup without `data-mobile-open`. KwantifyWorkspace.tsx is unchanged in this release; this is not an axis/layout runtime failure. The fixture also passes incremental TypeScript validation.

Release follows the existing main-only Git integration with public commit verification. No feed restart, account changes or owner tab refresh.
