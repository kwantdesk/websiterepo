# TP/SL drag placement — 27 October 2026

Owner reported moving protection handles on an active trade glitches and places
them away from the chosen price. No owner order/position was moved for testing.

Causes found:
-Drag converted client pixels directly to chart coordinates, ignoring CSS scale.
-Picking up an off-centre label discarded the grab offset and moved its price.
-Autoscale/chart gestures could change the coordinate mapping during a drag.
-Per-frame overlay repositioning read an older DOM price during React updates.
-Workspace silently re-clamped a released stop against a later executable quote,
  so its saved price could differ from the preview.

Changes:
-Shared gesture projection uses chart pixel dimensions and retains grab offset.
-Persistent plot owns pointer capture; scroll/scale gestures and price autoscale
  are suspended during the gesture and their previous settings restored exactly.
-Active price ref keeps imperative chart re-projection on the current preview.
-Release samples the final pointer coordinate even before a pending animation
  frame. Existing/new stops and targets and resting-entry handles share this path.
-Cancel, lost capture, blur, instrument/timeframe change and chart disposal clean
  up without committing or leaving protection execution suspended.
-Workspace stores the same tick-snapped update as the preview. It no longer
  silently moves a stop to a newer quote on release; placing a stop still does
  not replay the release quote into an immediate exit. Subsequent real market
  events continue processing working protection. Shared handler also fixes the
  hidden release adjustment for Liquidity Map orders.

Verification:36tests pass covering the real TSX drag handlers at0.75x/1x/2x,
existing and newly added protection, final-pointerup placement, pointer identity,
capture loss/blur/source cancellation, restoring manual and automatic scales,
tick persistence, Liquidity Map compatibility, execution tape and journal safety.
Scoped helper lint passes; production build checked before release. Geometry
tests use isolated simulated positions; live owner TP/SL were never manipulated.
