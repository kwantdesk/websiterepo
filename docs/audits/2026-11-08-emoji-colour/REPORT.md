# Chart emoji colours

Emoji Style previously offered only size. Its SVG text had no fill, so monochrome
symbols (including the regional W) inherited SVG black regardless of theme.

Style now exposes Colour and Original emoji colours. Selecting a colour saves
the per-drawing override immediately and enables a local SVG colour-blend filter
for multicolour font glyphs, preserving their luminosity/shading and alpha rather
than replacing them with featureless silhouettes. Original colours restores native
font rendering. Explicit fill makes monochrome glyphs visible; new emoji drawings
follow the theme's drawing colour. Existing explicit style colours are preserved.
Anchor coordinates, saved pixel size, resize behavior and other tools are unchanged.

Validation:

- 31 focused emoji-colour, zoom-size and drawing-system checks pass. Six symbol
  types round-trip tint, original-colour choice, size and exact anchor coordinates.
- Isolated headless Chrome uses actual ChartDrawLayer and double-click settings:
  W starts white on black, picker changes to red, storage reload retains it,
  native face pixels change from red to blue, restoring Original removes tint.
  Raster alpha totals are identical before/after tint; no browser page errors.
- Scoped ESLint and whitespace checks pass. Full isolated production build and
  main-only deployment/exact public SHA are the release gates.
- The older chart-emoji-tool source-pattern suite has two pre-existing stale
  assertions: dynamic picker import (now static) and unguarded handles (now
  readOnly-guarded). Those assertions were not weakened or counted as passes.

Reproduce: `node scripts/audits/emoji-colour-browser.cjs`. Local detailed logs:
`tmp/emoji-colour-browser.log`, `tmp/emoji-colour-final-tests.log`,
`tmp/emoji-colour-lint.log`, `tmp/emoji-colour-build.log`.
No owner browser, feed, account, order or workspace operations were performed.
