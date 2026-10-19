# KWANTY State and workspace live theme colours

Request: State remains white after changing the theme; fix similar theme-lock
problems across KWANTY and GEX DATA, retaining explicitly customized colours.

Causes and changes:

- KWANTY's fresh settings lacked delta/gamma/vanna/charm, negative Greek styles,
  major long/short/call/put gamma and profile time marker. Opening/saving their
  settings persisted resolved colours, even without a custom colour choice, so
  the old sync skipped them. Fresh defaults now cover all these fields and the
  shared synchronization helper updates only theme-linked colours. Existing
  size, visibility, opacity and genuinely custom styles remain unchanged.
- Saved Orderflow series colours were snapshots too. Non-custom positive and
  negative overrides are independently removed so existing live renderer
  defaults apply. Explicit per-sign customization flags remain authoritative.
- GEX DATA exposure/heat-map CALL/PUT constants and option empty-bar colour
  froze module-startup colours. Lazy resolution now follows each current theme.
- KWANTY no longer re-downloads the static colour catalogue on every event.
  Both theme installers set the base palette before awaiting it; a failed
  catalogue fetch permits repaint and a later retry instead of blocking the
  runtime's theme notification. No feed, market calculation or polling change.

Verification:

- 250 existing workspace/reference/loading regressions pass. Four new tests
  cover actual State defaults, all Greeks/major fields, saved series colours,
  custom styles, retained GEX metric objects across dark/light palettes and
  static-catalogue failure/retry behavior (254 total).
- Scoped runtime/helper/model/test lint passes.
- Local browser with real completed-session SPY exposure: changed dark violet
  to light cyan via isolated QA controls. Background, labels, bars, controls
  and navigator repaint without a page reload; numerical data stays unchanged.
- Full production build passes (84 pages, including TypeScript). Production
  receipt recorded after completion.

Standing unresolved: stable VPS transport; full-month futures/options recording,
history/backfill and offline gaps; Asia tape; weekly/footprint/CVD live soak;
GEX DATA forecast/aggregate/cadence parity; 100+ user capacity/shared acquisition
and cost. This closes colour synchronization defects, not those data gates.
