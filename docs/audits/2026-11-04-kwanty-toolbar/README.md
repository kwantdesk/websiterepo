# Kwanty toolbar alignment — 4 November 2026

The desktop command row used an older 38px height, 5px spacing, narrow select triggers and background colouring distinct from Charts. It now follows the Charts command deck's 44px content rows plus 1px border, 28px controls, themed panel background, 3px radii, 10px semibold action text, and 8px action spacing. Instrument/interval controls remain left, mode tabs remain centered, and workspace actions remain right. Narrower desktop widths use two rows at the same rhythm; control groups scroll horizontally instead of compressing buttons. Layout labels have room for Side by side. The More menu sits outside the scrollport so its options remain visible.

Only desktop Kwanty CSS changes are released. Existing phone drawer rules, chart engines, trading, history, data subscriptions, indicators and normal Charts source are unchanged.

Validation:
- Headless Chrome at widths 1920, 1440, 1280, 1024 and 768: measured 45px desktop / 89px two-row headers and 28px controls; no document overflow.
- Instrument and layout dropdown selections work, More opens below the bar, phone drawer opens at 390px. Dark and light toolbar screenshots included. Fixture market data is synthetic; no external/provider requests or owner tabs used.
- Focused existing regression suite: 29/30 pass. The existing remaining assertion counts exactly three `ownerDocument.defaultView` references in ChartIndicatorPanes.tsx; the committed HEAD already has four. This source-count failure is unrelated to the CSS change and is left untouched.
- Production build checked before scoped main-only deployment; deployed revision and CSS content hash checked after release.

Browser reproduction: scripts/audits/kwanty-toolbar-browser.cjs. Source dimensions: src/app/globals.css, Charts command deck rules around lines 1574–1664 and 1763–1793.
