# Prompt

Add an Emoji section directly below Measure in the chart tools. Give it a
large scrollable choice of emojis (including a magnet), click-to-place on the
chart, chart anchoring, selection, resizing, clean deselection and persistence.

# Fix

- Added Emoji as a first-class one-point drawing tool and its own rail group
  immediately after Measure.
- Added a scrollable, accessible emoji grid using the existing desk emoji
  catalogue plus chart-specific markers, including the magnet.
- Persisted the chosen emoji and remembered the last picker choice locally.
- Rendered the emoji from its saved time/price coordinate so panning, zooming,
  range charts and volume charts move it with chart content rather than UI.
- Added a large body hit area, whole-emoji dragging, a diagonal resize handle,
  16–160 px bounds and a matching settings slider.
- Kept resize handles selection-only, so clicking empty chart restores the
  clean presentation.
- Added regression coverage for rail order, picker wiring, persistence,
  chart-coordinate rendering and resizing.

# Outcome

Traders can open Emoji beneath Measure, choose an emoji, click the chart to
place it, then move or resize it. The mark remains attached to its market
time/price and survives the normal workspace drawing save/load path.
