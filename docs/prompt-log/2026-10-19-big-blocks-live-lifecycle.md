# Big Blocks live preview / candle-close authority — 2026-10-19

## Owner request

Make Big Blocks behave live like the reference: appear while qualifying,
withdraw if not triggered, retain a valid block when the candle closes, and
do not first add it several bars later.

## Faults and implementation

- Prior provisional map latched every side that had ever qualified intrabar;
  failed previews could not disappear. It then discarded them at sampled
  rollover and allowed a fresh full scan to replace/backdate their decisions.
- Snapshot effect also replaced the direct source with sampled candles, and
  latest-only frame coalescing could discard the last closing observation
  when a new bar arrived in that same frame.
- Added per-chart/calculation `BigBlocksLiveState`. Replace forming positives
  and negatives, freeze final origin/side/price bounds on next-bar transition,
  and block sampled rewriting of observed-live decisions. Maintain right-edge
  projection expiry/cross behaviour separately. Unobserved reconnect gaps can
  still backfill normally; missing warm-up/classified flow is unknown, not a
  frozen rejection. First-load historical signals are not suppressed. Event/
  volume-chart synthetic coordinates can reproject to the same source bars
  after hydration without changing the confirmed block's side/price bounds.
- Direct candle source merges protect newer closes/flow from older samples.
  Flush a closing pending candle before accepting the new timestamp; same-bar
  bursts still coalesce to one animation frame. No provider polling/timers.
- Scope includes pane, instrument, timeframe, tick, instance, numeric settings
  and replay-mode boundary. Theme/opacity/object-identity changes do not reset
  decisions or repeatedly resubscribe the live handler. Disabling/removing the
  indicator or calculation changes recalculate normally, not permanent signals.
- Bounded240 source bars,120 retained/visible blocks and4096 observed timestamp
  decisions. Older discarded live decisions stay excluded from late samples.
  This is runtime authority, not a new persisted trade/signal history service.

## Reference boundary

Used reverse-engineer-anything skill and execution-free REA inspection. Current
Deepchart.dll16.0.9.0 has partial/obfuscated managed metadata, unknown MVID;
exact artifact digest/Evidence IDs are in the updated comparison audit. No
private formula reconstruction or live native replay was established. Official
Deep Charts source calls DeepM Effort proprietary. Existing transparent effort
formula/thresholds and user settings are unchanged. Exact vendor numerical/
pixel/market-open parity remains OPEN; this fix implements the owner's explicit
lifecycle requirement rather than falsely claiming proprietary formula identity.

## Verification

-13 new tests exercise preview withdrawal/reversal, positive/negative close,
  frozen geometry, projection termination, no late sampled admission, genuine
  gap backfill, unknown inputs, event-axis remapping, stale/older input,
  bounded5000-bar retention and identity scope.
- Actual Chart live effect is transpiled/executed with deterministic event/RAF
  adapters and the real calculator: immediate preview, final reject/qualify
  rollover inside one frame,200-update burst coalescing, wrong-pane/replay
  isolation and cleanup. This is not a signed-in browser/provider soak.
- Existing underlay/native width, effort/filter, colour override, frame-budget,
  new-candle continuity, profile-boundary and chart theme checks run separately.
  All29 combined tests pass; effort/filter/performance script,8 width checks,
  colour override and frame-budget scripts also pass.
  Updated stale source guards: settings schema3→existing5; cached bar-spacing
  variable width assertion; old ever-qualified latch guards replaced with the
  new preview/close contract. No production thresholds changed to pass tests.
- New helper/tests and affected small scripts pass scoped ESLint. Full Chart
  lint exceeded Node's4GB heap; this is a local lint limitation, not a browser
  runtime finding. Extracted changed hook regions also lint with zero errors
  (two pre-existing redundant dependency warnings). Do not claim full-file
  lint passed. Final build/TypeScript and production release identity recorded
  after completion. Intermediate build caught branded chart-Time typing on
  the event-axis mapping; explicit Time-boundary casts correct that type.
- Final stable-source production build passes, including TypeScript and all84
  static pages. The29-test suite and four supporting scripts pass on the final
  source. Production deployment identity will be appended after verification.

Standing public streaming, full historical coverage, weekly completeness,
footprint and signed-in/live multi-pane acceptance gaps remain OPEN. This
cannot make unavailable/delayed provider executions instant. No gateway
restart, new provider session, paid resource, theme or native/ALGO changes.
