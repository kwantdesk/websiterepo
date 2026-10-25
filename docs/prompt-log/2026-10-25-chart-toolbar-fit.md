# Charts toolbar fit — 2026-10-25

Request: timeframe/ticker area is clipped and does not fit its toolbar.

Root causes: global unlayered `* { scrollbar-width:thin }` overrode hidden
scrollbar utilities; x-scroll implicitly permitted vertical overflow in fixed
36px lanes; max-content groups competed for three narrow columns and the
end-justified action area could hide leading controls.

Fix: named scrollports with explicit x:auto/y:hidden and both scrollbar-hiding
contracts, natural-width 28px button tracks, safe auto-margin alignment and a
named inline-size shell. Actual workspace width drives one row at1280px+, two
rows at641–1279px, three at640px or below. Each lane stays36px. Mobile's old
whole-deck scroll rule is removed; menus retain their document-body portals.
No market data, indicators, replay semantics or trading/account state changed.

Verification:

-20 focused Node tests pass (layout/fit/control/timezone/master-replay
 contracts);5 interval-menu checks pass. Existing stale two-row-era tests and
 grouped timezone-selector assertions updated to test the current contract.
- Local production build passes compilation, TypeScript and84 static pages.
- Independent read-only agent review found no actionable cascade/layout fault.
- Isolated browser fixture served actual globals.css with representative
 toolbar markup at320,480,640,641,768,890,1024,1279,1280,1440,1920px. All11
 widths: each lane clientHeight=scrollHeight=36px, every button28px and inside
 lane bounds, overflow-y:hidden, scrollbar-width:none. Header heights108/72/36
 match the exact breakpoints. Last ticker and export remain clickable at320px
 after native horizontal scrolling. No market APIs or owner state used.
- Evidence: C:/Users/Karen/.codex/visualizations/2026/09/02/01a06418-e374-7a73-bf53-3d3583cb166e/toolbar-fit/toolbar-890.jpg
- This is computed CSS/fixture geometry evidence, not a signed-in chart/data
 acceptance test. Production release SHA/READY receipt follows after push.
