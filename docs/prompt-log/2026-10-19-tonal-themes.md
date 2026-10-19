# Ten additional tonal themes — 2026-10-19

Owner likes Crimson Fade and Blue Lagoon's single-colour-family palettes and
requested ten more distinct colour families, rather than five unrelated colours.
This is additive; no instruction to remove the existing mixed palettes.

## Implementation

- Appended Molten Copper (24°), Amber Vault (42°), Acid Gold (64°), Lime
  Obsidian (95°), Emerald Depths (146°), Jade Current (174°), Arctic Cyan
  (196°), Indigo Night (230°), Violet Noir (270°), Magenta Ink (314°).
- Each palette uses one fixed hue across dark shell surfaces, bright accents,
  text, muted controls, borders and distinguishable bright/tinted candles.
  Five picker swatches run from luminous colour into the darkest shade.
- HSL shades resolve once to ordinary saved hex tokens, not per-render random
  colours. No new render loops, effects, data requests, dependencies or CSS.
- Existing apply/save/custom-override semantics, default and font/layout sizes
  unchanged. A fingerprint guards all previous33 resolved presets and swatches.

## Verification

-27 focused tests pass across tonal/reference/feminine/deep-dark presets,
  action contrast, scrollbars, live chart sync, Liquidity Map contrast and VP
  gradient catalogue tests. Text≥4.5:1 on all shell surfaces; candles≥3:1 on
  chart background; one hue family per theme, ten distinct dominant hues.
- Hollow-candle5 checks and brand-mark9 checks pass. Scoped ESLint passes.
- Complete84-page production build, including TypeScript, passes. Production
  release identity will be appended after the single normal main push.
- These are token/model/source checks, not signed-in visual/cloud-save or
  market-open multi-chart soak acceptance. No gateway/provider changes.

Standing historical coverage, public streaming, weekly completeness, footprint
and live-grid/cloud-save/soak gaps remain OPEN. Unrelated native/ALGO and other
dirty worktree changes must stay unstaged. One scoped main push only.
