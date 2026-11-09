# Liquidity bubble sizing at time-axis limits

Root cause: the map positions the available frames across its data width, with a minimum 30-column viewport. Bubble size used the requested column width even when changing that value did not change the displayed frame spacing. This allowed scroll/drag input at an effective zoom boundary to resize bubbles while the chart remained fixed.

Bubble time scaling now compares realised frame spacing at the requested zoom against realised spacing at the normal reference zoom. Both use the renderer’s existing loaded-history bound and minimum-window rule. The layout publishes the actual history length. Scrolling while all available data already fits cannot change bubble size; real horizontal/vertical stretches still scale it. Execution prices, times, quantities, palettes and clustering are unchanged.

Validation: 28 focused tests pass, including history lengths 1–60, repeated ineffective time zoom, genuine horizontal stretch, compressed-history and minimum-window limits, independent vertical zoom, execution centres, pan, rolling history and cluster stability. Scoped ESLint passes. Static JavaScript module release only; no backend, provider, account or workspace changes. Existing unrelated dirty depth-engine changes excluded.
