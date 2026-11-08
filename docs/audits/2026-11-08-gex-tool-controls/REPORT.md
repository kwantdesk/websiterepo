# GEX Data tool filter controls

IV Rank lookback/maturity were unrestricted numeric inputs although the actual public request contract accepts integers 1–365. They now use the shared themed dropdown, with an explicitly labelled option for every supported day. Defaults remain 365 and 30. Existing fixed-enum restoration rejects invalid saved/copied values, retaining a valid default; numeric request values remain unchanged.

Delta endpoints use 0.00–1.00 dropdowns with the existing bounded range sliders, and interval-map strike padding uses 0–100 selectable strikes. Actual contract strikes continue to come from observed strike inventories; hidden backing values and the observed-data-sized Dark Pool Top N slider were not replaced with arbitrary invented contracts or limits.

All tool-row single selects, multi-select summaries, observed contract/calendar buttons and action buttons share 28px height, Aleph 11px/500, 8px theme radius and consistent insets/gaps. One CSS chevron replaces mismatched text glyphs. Existing dropdown open-state transparency remains; real pressed toggles remain distinct. Controls remain horizontally scrollable in narrow panels rather than wrapping or shrinking into overlap.

## Checks

- Isolated headless Chrome executes the real makeControl/setControl and themed select code: all 15 rendered controls match height/font in dark and light themes; selecting 14 days updates the backing request control; invalid saved values are rejected; no number input is exposed in the tested toolbar.
- `tests/gex-data-numeric-controls.test.mjs`: both tests pass, including all 730 IV day choices checked against the real request validator.
- Additional request and request-contract tests: 20 pass.
- Full isolated production webpack build passed (including TypeScript/page generation).
- Older picker regression suite: 28 pass; 8 calendar checks remain blocked by the existing fake DOM missing classList.contains. Text-arrow expectations were updated to the CSS-chevron presentation. Those eight are not counted as passes.

Unrelated dirty GEX work remains unstaged. The release app.js was reconstructed from HEAD plus only this task's changes and the browser fixture rerun against that exact file. No provider polling, gateway, trading/account or workspace changes.
