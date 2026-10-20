# KWANTY chart toolbar / panel timeframes and links

## Request

Move the right-side floating chart controls to the middle of the Classic / State /
Orderflow header, style like normal chart timeframes, support different candle
intervals per selected Orderflow chart, and provide normal-style viewport/cursor
link buttons in each panel's top right.

## Implementation

- Compact 28px top controls: interval dropdown, quick 1m/3m/5m/15m/30m/1h,
  Candles/Line, sidebar toggle, fullscreen and image export. Modes remain left,
  templates right. Narrow windows use a second toolbar row. Theme tokens retained.
- Click/focus selects an Orderflow panel with a visible border. Each panel stores
  its candle interval and price style independently, using package defaults for
  legacy layouts. Panel headers display their own intervals. Fullscreen includes
  the controls rather than hiding them with the old floating chart-only toolbar.
- Reuse one price controller/feed/history, aggregate OHLC locally per interval,
  and share results across panels with matching intervals during each paint.
- Separate viewport and crosshair links, both opt-in per panel. Shared viewports
  copy time and underlying-price bounds only; raw metric scales remain local.
  Crosshairs project the same exact time and underlying price across differently
  sized/scaled panels; they never translate an indicator's raw value to another.
  Different candle intervals remain independent while linked. Clear cursors on
  leave and keep linked reset/session initialization aligned without feedback loops.
- Existing workspace/template persistence carries link flags, active panel and
  per-panel controls. Preserve indicators, source data and acquisition cadence.

## Verification

- 120 focused KWANTY/live-theme/chart-grid integration tests pass, including active-panel handlers,
  independent interval serialization, crosshair domain projection, exact-time
  canvas crosshair paint and linked reset without mixing metric axes.
- Isolated browser QA uses a real recorded NDX session with explicitly synthetic
  positioning fixtures, never production fallback data. Verified 1m versus 5m
  panel rendering, selection reflecting the right toolbar interval, both link
  toggles, synchronized zoom, matching crosshair timestamp/price and saved-template
  restoration of intervals/link flags. One shared history read before app reload.
- No new upstream requests, services, polling, gateway restarts or credentials.
- Production release verification pending. Existing Orderflow archive/history
  entitlement and stable transport blockers are unchanged.
