# Drag lower indicator value axes

Owner request: the right-hand axis of CVD and other lower indicators should support click/hold/drag, like the normal chart price scale, as well as scrolling.

The old right-axis hit zone existed only for CVD and stopped pointer-down events without starting a gesture. It now appears for all expanded numeric-series panes, including Volume and RSI; table/statistics-only panes are excluded. Default drag stretches/compresses the indicator around its press-time value-domain center. The coefficient follows the installed Lightweight Charts native price-axis `_internal_scaleTo` algorithm. Shift-drag moves the domain vertically using the same convention as existing pane dragging. Wheel scaling and double-click reset remain available.

The gesture snapshots its starting domain, pointer position and pane dimensions, preventing cumulative per-event scaling and live-data drift. Pointer capture keeps the drag working outside the axis. Wrong-pointer events are ignored. Up, cancel, lost capture, replacement gestures and component disposal remove window listeners and release capture. Domain/scale state remains per pane and does not alter chart time navigation or input data.

Verification: 18 focused actual-renderer/axis-width/docking tests pass, including rendered CVD geometry versus the installed native axis calculation, repeated-position stability, unchanged horizontal alignment/source values, retained manual range after chart pan, Shift-drag without stretching, reset, independent Volume/RSI axes, table/collapsed exclusions and gesture cleanup. Scoped lint passes. Broader event-alignment tests retain one pre-existing naming-regex failure in `chartIndicatorEngine.ts`; that file and `Chart.tsx` are unchanged against HEAD. Verify production build, main-only deployment and actual release SHA before reporting live.

No feed, subscription, recording, indicator calculation, trade/account or VPS changes. Owner-browser pointer acceptance was not observed; tests execute the actual component event handlers and renderer with controlled pointer/window fixtures.
