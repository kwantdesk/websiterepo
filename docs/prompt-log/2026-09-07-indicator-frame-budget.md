# Indicator frame-budget audit — 2026-09-07

## User prompt

The trader identified Imbalance Tracker, Daily Volume Profile, Big Blocks and
especially Big Contracts as the indicators making chart navigation lag, and
asked for the same issue to be checked across all indicators.

## Diagnosis

- Big Contracts recalculated against a sampled tape, but then re-anchored,
  regrouped and rebuilt every retained marker whenever the live candle array
  changed. A benchmark of the full calculation measured 19.21 ms at 20,000
  prints, 53.81 ms at 60,000 and 132.80 ms at 150,000, so allowing that work
  onto frequent render paths caused visible frame stalls as the session grew.
- Big Contracts also measured and painted every overlapping label at compressed
  zoom levels.
- Big Blocks and Imbalance Tracker iterated every historical zone and asked the
  chart to project it before rejecting offscreen geometry.
- Big Blocks recalculated the forming-bar study for every live candle event,
  including multiple intermediate updates inside one browser frame.
- Daily Volume Profile cached its grouped histogram rows but recalculated peak,
  valley, business-zone, VWAP-band and summary analytics during repaint.
- A catalogue-wide primitive audit found many attached but empty renderers still
  participating in chart repaints.

## Fix

- Big Contracts' immediate execution-event path remains unchanged. The full
  distribution reconciliation now settles on a five-second source-time key,
  and after initial/history/settings hydration its steady pass scans only the
  recent complete-tape window while retained qualifying history is revalidated.
  Historical anchoring uses the stable indicator snapshot instead of the
  continuously moving live candle array.
- Visible Big Contracts markers are binary-selected. Dense views deduplicate
  markers by resolvable screen cell, cap text layout, cache labels and measured
  widths, and use a compact dot for text-only markers until zoom restores room.
- Big Blocks, Imbalance Tracker and SMT Divergence sort once on model update and
  binary-select viewport-relevant intervals before coordinate projection.
- Big Blocks' live forming-candle calculation is animation-frame coalesced.
- Native Volume Profile caches structure, VWAP and summary derivations with the
  grouped profile result.
- Empty pane views are suppressed across 32 primitive paths, including chart
  sessions/levels/paper fills and footprint, TPO, gamma, DOM, POC, profile and
  order-flow primitives.

## Verification and outcome

- `node scripts/test-indicator-frame-budget.mjs` — pass.
- `npx tsc --noEmit` with a 12 GB Node heap — pass.
- Scoped ESLint across all changed library primitives — pass.
- `npm run test:big-trades-live-edge` — pass; live admission measured 0.0140 ms
  per batch of 40.
- `npm run bench:volume-profile-draw` — steady pan measured 0.69 ms/frame for
  seven profiles; cold live profile update measured 1.71 ms.
- `npm run build` — pass, all 80 static pages generated.
- `test:profile-indicator-parity` was also run and failed on an older source-text
  assertion for the custom-profile instance selector; this performance change
  did not touch that selector or profile calculation parity.

Expected outcome: the named indicator stack no longer scales navigation cost
with all retained zones/markers or schedules full Big Contracts history work on
each candle movement. Final perceived FPS must still be confirmed in the live
multi-chart workspace after production deployment.
