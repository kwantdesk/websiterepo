# Aleph site-wide typography — 2026-10-17

## Request

Use every font from the supplied Aleph ZIP across the website, retaining the
existing sizes and formatting; save/push a rollback checkpoint and the change.

## Changes and checkpoint

- `codex/pre-aleph-font-2026-10-17` points to verified production `c1767932`.
  The font release is scoped separately from prior market-data work. Unrelated
  dirty native, API, ALGO and local files are preserved and excluded.
- Extracted exactly Regular, Bold and the notice from the supplied archive;
  the two TrueType name tables identify Aleph Regular/Bold. Original binaries
  are unchanged. Included the supplied attribution plus the standard SIL OFL
  1.1 license text. Assets are self-hosted, preloaded, and accessible before
  login without weakening protected API routes.
- Replaced existing family names in DOM/SVG/canvas, UI and indicator labels,
  GEX/social/chart libraries and drawing defaults. Saved drawing painting
  overrides only family, preserving stored size/weight/line-height. All stock
  charts explicitly select Aleph, including ones formerly using library defaults.
- Static liquidity-map CSS and JS use the same assets. Its complete versioned
  module graph is cache-busted; old font faces are no longer loaded. Emoji
  and icons are not typography substitutes and keep their glyph rendering.
- No data subscriptions, provider credentials, indicator math, chart sizes,
  font sizes, weights, letter spacing or layout classes were changed. Aleph
  is proportional: exact pixel width/wrapping cannot equal the old fonts.

## Validation and limits

- Font coverage/assets/entry-point, persisted drawing style and numeric/JSX
  formatting audits: four tests pass. The numeric audit compares this font
  release with its checkpoint, not future legitimate UI changes.
- Drawing system and precision tool suites: 33 tests pass. Separate toolbar
  size assertion fails before AND after this change: baseline is 57/19.8,
  test expects 28.5/9.9. Left unchanged to honor the size constraint.
- Production build/typecheck and scoped lint checked locally; deployed assets
  and production SHA checked after the main-only Git release. No new runtime
  font CDN or deployment path was introduced.
- Signed-in multi-panel visual/wrapping review remains due. No claim that
  font replacement resolves the existing memory/history/provider issues.
