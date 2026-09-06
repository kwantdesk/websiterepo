# Theme changes leave chart colours behind — 2026-09-06

## Owner prompt

“bug when i change the theme colour the chart sstill sstayed the same as the theme befor,e fix this, third time ive asked you to do this.... it mde me refresh the whole website to change over, fix this...”

## Findings and fix

- Website CSS and canvas ChartSettings were separate update paths. The settings page emitted both, but shared saveTheme/resetTheme did not publish a canvas palette or relink inactive chart runtimes. Moved that responsibility to the shared commit, which publishes the chart payload before the CSS theme event. Both Charts and GEX VUE runtime settings are updated without modifying named workspace presets.
- Settings-page commits pass their complete explicit ChartSettings to the shared function so independent wick/border choices are not lost in theme conversion. Added candle border fields to chart-to-theme conversion. Existing per-indicator/per-candle explicit custom ownership is unchanged.
- Identified a separate real hydration race: hydrateUserPreferences retained a locally owned or newly clicked olisa-theme while leaving the selected cloud olisa-chart-settings and two scoped chart-runtime palettes unchanged. A late response could therefore combine the new website palette with old chart colours. Retain the matching local colour and themeLinked fields whenever that existing theme-retention branch is chosen. Preserve non-colour preferences from the selected snapshot and existing cross-account ownership decisions.
- No new data requests, timers, renderer remount logic, reload calls or market-feed changes.

## Verification

- Five new executable integration tests passed, including all theme presets through actual saveTheme/event/storage calls, canvas event before CSS event, both inactive chart runtimes, reset, explicit wick/border and custom candle colour retention, same-owner hydration, and a deferred cloud response arriving after a theme click. Named preset storage is unchanged and cloud non-colour settings remain respected.
- Existing first-click sync 5/5 and theme account sync 6/6 passed; global theme/chart ownership and preference hydration suites passed.
- Scoped ESLint passed for all changed implementation and test files.
- Full production build/type checking passed (80 static pages); deployment is verified separately after push. No authenticated on-screen chart visual verification is claimed.

## Existing open launch notes

History backfill/tick-VAP coverage; VXN/options history licensing; off-site restore-tested backups; market-open reliability; final DeepCharts visual parity.
