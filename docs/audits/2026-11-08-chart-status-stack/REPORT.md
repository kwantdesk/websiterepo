# Indicator status popups: top-right stack

Classic GEX used a fixed 104px top / 70px right offset. Other studies used their own fixed/manual offsets, which neither tracked actual badge heights nor reserved the measured price-axis width.

A chart-scoped status provider now routes 28 existing status/header render sites into the shared top-right corner host. Content, visibility conditions, freshness/error values and data logic are unchanged. The host uses normal flex layout and an 8px gap, starts 12px inside the chart's top edge, and sits 10px left of the measured price axis plus any Mini DOM reserved area. Width is constrained to the chart and the stack is clipped above docked lower panes. Individual old absolute offsets are overridden at the status component boundary. Each chart owns its own provider/host; there is no global cross-chart target or timer.

Gamma/VIX environment badges keep their explicit position settings and share the stack when positioned top-right. Bottom-corner countdown placement stays unchanged. Price-anchored labels, drawing geometry, hover tooltips and the temporary centered TPO drawing instruction were not moved.

The full isolated production build (`next build --webpack`), TypeScript and route generation pass.

Validation: 5 corner/status tests pass, including docked-right clearance and existing countdown regressions. Isolated headless Chrome mounted the actual Chart and passed 12 layouts across dark/light shell variables, 900/400/260px widths and single/multiple status cases: top-corner anchoring, vertical non-overlap and price-axis clearance all passed, with zero page errors. External/API requests were blocked; fixture statuses were not live-provider evidence. The generated 28-site inventory and geometry results are local at tmp/chart-status-stack-inventory.json and tmp/chart-status-stack-browser.json; tmp/chart-status-stack-260.png was visually inspected. Scoped corner component lint passes. No accounts, orders, owner tabs, gateway, feed subscriptions or recorded data were changed.
