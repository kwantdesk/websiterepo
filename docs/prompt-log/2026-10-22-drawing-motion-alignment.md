# Drawing motion alignment

Request: drawings glitch when the chart is moved.

Root causes in the live shared SVG layer:

- Native repaint notifications scheduled another animation frame, so drawing
  coordinates trailed the canvas by a display frame.
- A yielded React render could commit old coordinates but capture a newer
  projection as its basis, baking drift into the next gesture.
- The pane clipping boundary was attached to the transformed group and moved
  with it, exposing drawings over axes or clipping them prematurely.

Repair: synchronous lightweight native-paint projection; render-time basis and
pre-paint alignment; stationary outer clip and explicit non-scaling strokes.
Empty drawings remain unsubscribed. No full chart reconciliation per frame,
no feed/gateway changes, no extra hosting requests, no persisted anchor rewrite.

Acceptance: local browser fixture with real Lightweight Charts, repaint notifier
and ChartDrawLayer; synthetic candles only, 180 pan/zoom/autoscale frames with
concurrent React updates. Delayed-frame control failed at43.7890px maximum
anchor error; final patch stays below0.001px. Fixture is retained under tests;
its temporary local route is removed before deployment.

Verification:56 drawing/geometry/State/VWAP/viewport tests and11 frame-budget
checks pass; scoped ESLint passes; production build and TypeScript pass with
84 generated pages. A stale generated development validator referencing the
removed temporary fixture route was cleared before the successful clean check.
