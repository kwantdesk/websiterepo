# Chart X must remain visible when narrow

Owner reports that shrinking a chart hides the X needed to remove it.

Moved the docked and floating close buttons out of their scrolling action groups and made each an opaque, sticky right-edge header control. Other controls still scroll horizontally; the X remains visible and hit-testable above them. Existing close handlers, layout locks and the last-pane guard remain unchanged. Shared chart sizing/price-axis repair is preserved.

Actual Workspace browser regression uses isolated local history/auth fixtures with no live provider or owner requests. Verified both headers at workspace widths 1100/800/600/400px, each at start/middle/end of horizontal scrolling, plus phone-width presentation. `elementFromPoint` confirms the X is the topmost clickable control. Clicking closes the intended docked panel. A detached window narrowed to 240px also retains its X across scrolling and actually closes. Zero browser errors; screenshot visually inspected. Full isolated webpack production build, TypeScript and 86 static pages pass.

Runner: `scripts/audits/chart-close-control-browser.cjs`; `CHART_CLOSE_CSS_ROOT` selects compiled CSS, with the existing `KWANTDESK_PLAYWRIGHT_MODULE` / `KWANTDESK_CHROME_EXECUTABLE` browser overrides. Local results: `tmp/chart-close-results.json`, `tmp/chart-close-after.log`, `tmp/chart-close-pinned.png`.

Release follows main-only Git integration and exact public commit verification. No gateway restart, live subscription change, account mutation or owner-tab refresh.
