# Imbalance Tracker visibility and Deep Charts parity

## User request

Audit KWANTDESK's Imbalance Tracker against Deep Charts like for like, correct
its stock settings and appearance, and fix the case where adding it produces
nothing visible.

## Reference checked

- The installed licensed Deep Charts assembly was inspected for the tracker
  contract after the native desktop window was not exposed to this session's
  safe app controller.
- The reference fields already represented in KWANTDESK were retained:
  diagonal, horizontal and horizontal-delta modes; 400% threshold; zero-side
  handling; three consecutive levels; one-tick grouping; ten extended bars;
  zone padding; reset/trigger behavior; exchange-time filtering; colours,
  opacity, width and alerts.
- Visual and calculation parity is verified only for the behavior covered by
  the installed assembly metadata, deterministic fixtures and KWANTDESK's
  renderer. A fresh interactive Deep Charts screenshot comparison remains a
  useful follow-up when native-window control is available.

## Root causes

- The configured ten-bar extension was clamped to the final candle in memory.
  A zone detected on the forming candle therefore rendered only two pixels
  wide until future candles arrived.
- The renderer secretly multiplied the selected opacity by 14%. Even the
  advertised 100% stock setting was painted at 14% fill opacity.
- Previously saved version-two trackers did not pass through a complete
  settings normalizer, leaving missing/legacy values inconsistent with a new
  tracker.

## Engineering outcome

- Live-edge zones now project the unelapsed part of `Num. Extended Bars` using
  the chart's native bar spacing. Trigger and reset boundaries remain exact.
- Zone opacity is now the actual selected opacity. The stock value is 100%,
  while a current user's explicit custom opacity is preserved.
- Added version-three saved-settings migration with bounded numbers and valid
  enum values; the old stock 78% value upgrades to 100%.
- Aligned calculator fallbacks with the 400% / zero-minimum-delta reference
  defaults.
- Added regressions for the calculation modes, live-edge ten-bar width and
  old/current saved settings.

## Verification

- Imbalance Tracker fixture: 7 reference scenarios plus live-edge and saved
  settings checks passed.
- Scoped ESLint passed.
- TypeScript passed with no errors.
- Full optimized Next.js production build passed, including all 80 generated
  routes.
- Existing broader opacity and indicator-save checks still report unrelated
  pre-existing failures in volume-profile shifted-POC defaults and the dirty
  shared dialog header work; neither is changed by this prompt.
