# GEX Map phone columns

Owner requests the same three saved GEX Map columns beside each other on the phone, compact and in order, rather than vertically stacked.

An older max-width 820px rule overrode the responsive map grid with a single column, automatic page height and tall rows. Removed that override. The existing saved panel count and DOM order now determine the grid at every width. Phone/small-tablet spacing tightens header padding, column gaps and strike cells; very narrow columns retain a 44px strike track beside their exposure. Desktop rules above 820px remain unchanged. No saved configuration or data calculation changes.

Verification: actual GexMapWorkspace rendered in isolated headless Chrome at widths 320, 390, 430, 844 and 1440. All three panels share the same top coordinate, fit horizontally, remain in SPX/SPY/QQQ order, and their dropdown buttons fit each panel. Changing the centre selector to NDX works independently and retains the three-column geometry. Zero browser errors. The prior compiled stylesheet fails the same-row assertion at 320px; the repaired production stylesheet passes. Screenshots were visually inspected. The fixture supplies explicitly synthetic local exposure rows; it makes no live provider calls and does not establish any live data parity.

Runner: `scripts/audits/gex-phone-layout-browser.cjs`; entry: `scripts/audits/gex-phone-fixture-entry.tsx`. `GEX_PHONE_CSS_ROOT` selects a production CSS directory; `KWANTDESK_PLAYWRIGHT_MODULE` can point to an installed playwright-core module. Local evidence: `tmp/gex-phone-before.log`, `tmp/gex-phone-after.log`, `tmp/gex-phone-layout-results.json`, `tmp/gex-phone-390.png` and other widths. Full isolated webpack production build passes TypeScript and 86 static pages.

The old `gex-map-responsive-columns.test.mjs` source-pattern test predates the existing variable panel-count grid and asserts that narrow layouts hide additional columns. It already contradicts the current grid and this explicit owner requirement; it is not evidence for this repair. The browser test checks the actual resulting geometry instead.

Release: scoped main-only Git integration, exact public commit verification, no gateway restart or owner-tab/workspace/account mutation.
