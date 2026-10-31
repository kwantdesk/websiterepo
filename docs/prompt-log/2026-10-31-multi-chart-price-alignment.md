# Multi-chart linking: shared vertical reference and resize stability

Owner reports three/four linked SPY, SPXW, QQQ and NDX charts still look wrong. They clarify the primary issue is SPY sitting lower vertically. Preserve that clarification; time/cursor matching alone does not satisfy it.

## Reproduced causes

1. Every pane used its own latest stored candle close as the price anchor. Different feed tails and restored/newer data therefore compared prices from different moments. The source could retain its prior absolute scale while followers re-centered on later quotes. A controlled four-pane native-chart test reproduces a 16.1% pane-height discrepancy at a common candle timestamp before the vertical fix.
2. Adding panes/resizing the grid or widening a price-axis label changes native plot width. Lightweight Charts preserves bar spacing, changing each pane's visible time window independently. The viewport effect observed user gestures but not plot-size changes. The same real native four-pane test reproduces up to18.6% plot-width discrepancy after a follower resize before the resize fix. Earlier two-pane fixed-size checks missed this.

## Changes

- Clock-chart snapshots now record a real `anchorTimestamp` with the source price. Choose an actual candle at/before the visible window's midpoint, retaining that candle's exact timestamp (also across overnight gaps). Every receiver looks up its own candle at that same instant, preserving the percentage scale offsets. This changes viewport normalization only, never OHLC, instrument prices, candle positions in time or indicators.
- Target lookup is causal and bounded to the clock candle interval. If a required reference candle is absent, time linking still runs but no different minute/future candle silently substitutes for the vertical anchor. Legacy snapshots without a timestamp and event bars retain latest-price fallback behaviour.
- Subscribe to native time-scale size changes, coalesce restoration to one animation frame and reapply the shared snapshot after layout, including for its original source pane. An active pointer/wheel owner publishes its current view instead of being reset. Unsubscribe/cancel queued resize work on cleanup; independent panes have no added work.

## Verification

- Nineteen viewport/anchor tests plus five tests executing the production effect cover own-leader restore, resize bursts, active gestures, cleanup and independent panes. All24 pass. Source-anchor tests verify differing tails, missing/future/invalid references, exact timestamps, unchanged data and overnight gaps.
- Eleven isolated real Lightweight Charts browser scenarios use the actual viewport effect/crosshair handlers extracted from Chart AST. Three panes and the fourth joining, a common candle's vertical position, follower/full-grid resize, wider SPXW labels, either leader, actual native rendered crosshair time labels and newer-tail restoration pass with zero page errors. Common reference height and time coordinates meet0.2% pane/plot tolerance. Prior implementation fails the resize test; resize-only fix still fails the price test. Controlled fixtures are not a vendor-price or owner-tab audit.
- All15 prior two-pane browser scenarios pass, including wheel, late data, rebase, unlink/relink, missing cursor candle, replay date and live return. Existing crosshair/reset, seven GEX Map replay-settings and six timezone tests pass. Scoped library/tests lint and final production build pass. Do not standalone lint the huge Chart component.
- Ignored evidence: `tmp/linked-chart-multi-before.log`, `tmp/linked-chart-multi-price-before.log`, `tmp/linked-chart-multi-browser.log`, `tmp/linked-chart-multi-browser.png`, `tmp/linked-chart-browser.log`, `tmp/linked-chart-multi-tests.log`, `tmp/linked-chart-multi-build.log`.

Different instruments retain their actual relative movements; this provides a shared comparison point rather than forcing identical price paths. No new polling, gateway/provider restart, recordings/preferences/accounts/trades reset or new service. Preserve GEX Map timezone work and the cancelled Bounce source patch. One scoped main-only release through `websiterepo-yfmi` and verify exact live SHA.
