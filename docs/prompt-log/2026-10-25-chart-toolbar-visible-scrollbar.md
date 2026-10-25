# Charts toolbar visible scrollbar — 2026-10-25

Owner follow-up: the toolbar now fits, but the horizontal scrollbar is missing.

The preceding fit repair explicitly hid the scrollbar. Restore the visible,
draggable horizontal bar instead of relying on wheel/trackpad or programmatic
scrolling. Remove the two contradictory hidden-scrollbar utility occurrences.

Actual Windows browser testing then exposed why simply restoring a 7px CSS
fallback was insufficient: native `scrollbar-width:thin` used 10px, leaving a
26px client area in the old 36px lane and clipping the 28px controls. Reserve
8px extra with a chart-toolbar-only 44px row token, applied consistently to
height/min/max and all named responsive grid rows. The header's content-box
keeps its border outside those rows so it cannot clip the final scrollbar.
Pane headers and other site bars remain unchanged. Theme scrollbar tokens,
natural-width tracks, safe alignment and document-body portal menus remain.

Verification:

- Regression fails before repair on hidden scrollbar; 20 focused toolbar,
  interval/control/timezone and master-replay tests pass after repair.
- Interval-menu script passes all 5 checks.
- Isolated browser fixture uses the actual globals.css, no market APIs or
  account data. All 11 widths (320, 480, 640, 641, 768, 890, 1024, 1279, 1280,
  1440, 1920) pass: lanes are 44px; client area is 34px with a scrollbar or
  44px without; scrollHeight equals clientHeight; all 28px buttons fit;
  overflow-y is hidden; header contains every lane and scrollbar.
- Actual thumb drag at 480px moves favourites scrollLeft from 0 to 335.33px;
  the final EUR/USD favourite becomes visible and its click works.
- Independent read-only final diff review found no actionable fault.
- Production build passes compilation, TypeScript and all84 static pages.
- Scoped workspace ESLint:0 errors,20 existing warnings.
- Evidence: C:/Users/Karen/.codex/visualizations/2026/09/02/01a06418-e374-7a73-bf53-3d3583cb166e/toolbar-fit/scrollbar-restored-480.png
- Geometry: same folder, scrollbar-geometry.json.
- This is CSS/interaction fixture evidence, not a signed-in chart/data test.

No market feed, indicator, replay, order/account handler, provider cadence,
VPS service or paid resource was changed. Production release receipt follows
after the single scoped main push.
