# KwantDesk live renderer memory diagnosis

## Outcome

The Chrome `Aw, Snap! — Out of Memory` failure is caused by a live repaint-to-React feedback path in the main chart, not by ordinary workstation RAM pressure.

The chart repaint primitive notified the React viewport state whenever the live price auto-scale moved by a visible pixel. With several charts open, that converted live market paints into repeated full `Chart` component reconciliations. The browser continually allocated event-listener and React work objects faster than garbage collection could keep the renderer stable.

## Evidence

Source trace: `C:\Users\Karen\Downloads\Trace-20260825T072646.json.gz`

| Signal | Trace result | Interpretation |
| --- | ---: | --- |
| Trace duration | about 149 seconds | Long enough to capture the live degradation and repeated garbage collection |
| React scheduler work-loop calls | 4,330 | About 29 React work loops per second |
| React scheduler work-loop time | 50.9 seconds | About 11.8 ms per work loop, before canvas and browser work |
| Event-listener object growth | roughly 1,800–2,400 per second during live periods | Repeated React/listener allocation on the live repaint path |
| Minor garbage collections | 1,384 | Continuous allocation pressure |
| Renderer heap | repeatedly exceeded about 1.1–1.3 GB before collection | Renderer heap exhaustion pattern |
| Dropped frames | 13,544 of 17,921 | About 75.6% of captured frames dropped |
| Main-thread `RunTask` time | 231.8 seconds of aggregate task time | Main thread was severely oversubscribed |
| Lightweight Charts paint work | about 3.23 ms per measured paint chunk | Native chart painting was not the primary failure; the React bridge amplified it |

DOM-node counts stayed comparatively flat while listener objects climbed rapidly. That rules out a simple ever-growing DOM tree and points to repeated listener/closure allocation caused by chart-tree reconciliation.

## Root cause

`src/components/Chart.tsx` subscribed `scheduleViewportRefresh` indirectly to every chart repaint using `refreshOnRepaint`. `scheduleViewportRefresh` increments React `viewportVersion`, so a live auto-scale repaint forced the complete chart React tree to reconcile.

The path was originally added to keep price-coordinate overlays fixed while the vertical scale moved. KwantDesk now has imperative repaint subscriptions for drawing and precision layers, and Lightweight Charts primitives redraw natively, so the whole React tree no longer needs to participate in every live paint.

## Repair

- Removed the main chart repaint-to-React subscription and its projection probes.
- Kept deliberate pan and zoom connected to the throttled React viewport refresh.
- Kept drawing and precision-tool vertical projection on their imperative repaint subscriptions.
- Added a source-level regression test that fails if a live repaint is wired back into the main React viewport state.

## Verification

- Overlay repaint-boundary regression: passed.
- Overlay in-frame painting: passed.
- Overlay clipping and re-projection: passed.
- Deep-history indicator performance: passed, 11.42 ms total for five studies across 20,000 bars.
- TypeScript: passed.
- Next.js production build: passed, including all 85 static pages.

An existing precision repaint test is currently incompatible with separate, pre-existing local changes to `PrecisionToolsLayer`; this repair does not modify that file.

## Production acceptance check

Run the same multi-chart live workspace for at least 15 minutes and capture a second Chrome performance trace. The repair is confirmed when:

1. Event-listener counts plateau instead of rising by roughly 2,000 per second.
2. Renderer heap settles after garbage collection instead of repeatedly climbing toward the renderer limit.
3. React scheduler work no longer runs at approximately 29 full chart commits per second.
4. Chart drawings remain anchored during pan, zoom, and live auto-scale.
5. The page stays responsive without an `Aw, Snap!` renderer termination.
