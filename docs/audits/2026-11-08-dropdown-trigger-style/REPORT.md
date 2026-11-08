# Unfilled dropdown triggers

Owner wants no grey tile/glow when a menu opens, while retaining meaningful
selected states on controls such as drawing Lock and shared-viewport Link.

A shared dropdown-only stylesheet now removes trigger background, shadow/filter
and background transitions. Chevron transitions remain. It is bundled into the
main site and linked into the separate GEX Data, Kwanty and Liquidity Map
documents. Existing menus, option selection, dimensions, borders and dismissal
logic remain intact. Buttons with `aria-pressed` are deliberately excluded.

The chart's instrument/timeframe triggers and chart/panel type triggers now
declare their popup state. The direct instrument/timeframe grey open class was
also removed. Indicator-library and drawing-menu triggers declare popup type
so the shared treatment applies consistently. None of these changes alter
Lock, Link, favourite intervals or selected Classic/State/Order Flow tabs.

The supplemental regression run passed four checks and failed four older
dropdown tests. Two hook harnesses depend on an outdated dismissal-listener
shape; two static adapter assertions expect former versioned URLs/dialog code.
The shared select/timezone hooks and themed-select adapter were not edited by
this patch. Those failures are retained in the log and not counted as passes;
the actual-browser open-state/chevron/toggle checks described below pass.

Validation: isolated headless Chrome mounts the real full workspace and shared
KwantSelect, TimeZoneSelect and GexMapDropdown. Native DOM click events exercise
open/close state for visual checks without depending on the fixture's chart-data
hydration overlay. Fifteen checks pass: main menus in dark/light theme, chevron
flips, actual Lock/Link selected fills, and the three embedded stylesheet stacks.
No browser page errors or non-loopback requests. This is a styling/component
check, not a production data-load or physical chart-interaction certification.

Scoped toolbar/fixture ESLint and whitespace checks pass. Full isolated
production build, scoped main Git release and exact live SHA/CSS verification
are required before reporting deployment complete.

Re-run `node scripts/audits/dropdown-trigger-browser.cjs`.
Local evidence: `tmp/dropdown-trigger-browser-results.json`,
`tmp/dropdown-trigger-browser.log`, `tmp/dropdown-trigger-regressions.log`,
`tmp/dropdown-trigger-lint.log`, `tmp/dropdown-trigger-build.log`.
No owner-tab, account/order/workspace or gateway operations were performed.
