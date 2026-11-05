# CVD/Delta live delivery and fixed-size chart emojis — 2026-11-05

Owner reports CVD and Delta Bar four candles behind, then asks emojis to retain their chosen size during zoom. Browser use prohibited; investigation used source and bounded read-only VPS health/execution-stream checks. No owner tabs, accounts, orders, gateway lifecycle or provider resets touched.

## Evidence and repair
- VPS health sample: connected/authenticated, NQZ6 and ESZ6 fresh, event-loop overload false at sampling. Bounded NQ execution SSE returned fresh trade batches during five seconds. This establishes healthy server delivery at that time, not browser receipt or the cause of the owner's exact stalled tab.
- Price paints imperatively, but CVD/Delta previously depended on parent Chart study sampling and React transitions. A busy parent can defer study updates independently of price. Added a local lower-pane subscriber to the same existing execution-backed candle events, with a coalesced 200 ms update; no new feeds, polling or paid calls. It keeps live candles across stale parent snapshots and reuses the existing indicator engine for session resets, filters, average/trade-count inputs and OHLC. Price/event time remapping preserved. Replay disables the live subscriber; scope changes clear state. Missing classified execution input remains unavailable.
- Emoji helper used time/price radii to scale font size with zoom. It now uses saved fontSize CSS pixels; historical radii remain readable but do not resize glyphs. Removed chart-span capture/migration and placement writes. Rendering, hit targets and resize handles all use the same fixed-size helper. Anchor time/price unchanged.

## Validation
- 50 targeted tests pass, including actual hook lifecycle with unchanged parent props across four candle boundaries, idle timer behavior, unrelated chart keys, replay disposal, contract scope changes, ordinary engine parity across settings, event time mapping, viewport following, CVD hydration/continuity and 125 emoji zoom/size combinations.
- Scoped lint passes for five smaller changed source files. Full Chart lint exceeded the existing parser heap; complete production build including TypeScript passes.
- Full isolated webpack production build: compiled, TypeScript complete,86 pages generated.
- Synthetic warm calculation sample: CVD plus Delta Bar on4,000 bars ~8 ms mean across25 warm repetitions. This is a local calculation measurement, not a production display latency claim.
- Two existing chart-emoji-tool source-pattern assertions (dynamic picker import and old handle guard spelling) fail against unchanged baseline patterns; no production behavior changed to satisfy them. Relevant fixed-size behavior tests pass.

Activation uses existing main-only Git integration. Receipt is retained locally after production verification. A current open browser document needs the new bundle before it can use the repair; no owner refresh performed. Actual owner-tab live cadence was not observed because browser access was prohibited.
