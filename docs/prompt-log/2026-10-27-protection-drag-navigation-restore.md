# Protection drag navigation restoration — 27 October 2026

Owner reported chart movement/interaction permanently disabled after TP/SL drag.
This is a regression introduced by3838acd6, not a missing market feed or order.

Root cause: Lightweight Charts exposes its live options object. Disabling
handleScroll/handleScale normalizes boolean flags into nested option objects,
then recursively merges into the existing objects in place. The drag helper's
saved references therefore became the disabled objects; dispose restored false
flags, leaving panning/zooming/axis dragging disabled indefinitely.

Fix: structuredClone both interaction option trees BEFORE disabling them.
Dispose restores independent snapshots, including nested axis preferences and
intentionally disabled individual controls. Existing auto-scale restoration,
pointer cleanup, price projection, tick snapping and execution semantics stay
unchanged. No owner trades, prices or protection levels were manipulated.

Regression proof:
-Extract the installed library's actual migrateHandleScaleScrollOptions and
  merge functions into the TSX drag-handler harness; exercise release/cancel
  three times each with both enabled and deliberately disabled preferences.
-Before fix: the two real-library restoration tests fail (old10tests pass).
-After fix:39tests pass across drag restoration, Liquidity Map, order receipts
  and execution tape. The old geometry mock replaced option objects, which
  masked this defect. The new tests mutate the same objects as the real library.
-Scoped ESLint and production build checked before release.

An already-locked mounted chart needs a reload to rebuild its original options;
the fix prevents new drags from leaving that state behind.
