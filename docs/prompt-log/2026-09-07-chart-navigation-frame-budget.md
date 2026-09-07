# Chart navigation frame-budget follow-up — 2026-09-07

## Prompt

After the first navigation deployment, the user reported that movement was only
slightly better and still felt like a 10 FPS monitor.

## Finding

The removed React reconciliation was not the only viewport cost. Each pan frame
still queried the native price rail and invoked a React state setter, refreshed
paper-trade P&L text even though navigation cannot change P&L, and notified two
drawing systems. Empty drawing layers were still subscribed, and the precision
canvas repainted synchronously inside the native chart paint callback. The SVG
drawing layer could also receive the same frame through both time-scale and
native-repaint notifications.

## Fix

- Removed price-rail state synchronization and P&L formatting from the viewport
  frame callback. Their existing initialization, resize, quote and position
  paths remain authoritative.
- Skip drawing-layer projection when the SVG group is empty and skip paper
  overlay positioning when there are no paper labels.
- Do not subscribe the legacy or precision drawing layer to viewport paint when
  it contains no visible content.
- Coalesce duplicate drawing notifications so each active overlay performs at
  most one projection/repaint per browser frame, outside the native chart's
  synchronous paint callback.

## Outcome

Navigation no longer spends frame time servicing empty overlays or unrelated
state/text work, and active drawing overlays cannot repaint more than once in a
browser frame. The live data feed, candle construction, orders and indicator
sampling were not changed. Focused navigation, drawing, precision-tool,
lifetime and anchoring tests plus TypeScript and scoped lint pass. The current
automation surface could not access the user's authenticated trading tab, so
the improvement is code-path verified rather than presented as a measured FPS.
