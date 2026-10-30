# Fixed-range drawing: normal profile renderer and delta settings

Owner requests that the drawn fixed VP look like the normal volume profile and provide delta behind it and comparable appearance settings.

## Implementation

The old fixed-range SVG histogram used a simplified volume-only bin DTO and hardcoded row fills. Exact gateway profiles already carry volume, bid volume, ask volume and signed delta. The drawing now sends that original exact profile to the **same `NativeVolumeProfilePrimitive`** used by normal volume profiles. Its path factory is injectable; normal charts still use native Path2D, while drawings use a local SVG output surface. No global Path2D patch or independent histogram/delta rendering algorithm was introduced. The SVG surface transports native rounded paths, contours, gradients, alpha, clip regions, dashes and labels, retaining existing drawing selection/hit testing and viewport infrastructure.

Fixed drawing Style settings now provide:

- Volume, Delta and total volume, Ask/Bid, Delta, Delta percentage.
- Automatic, Solid, Hollow, Line and Combined appearance; line mode retains every selected measurement contour.
- Delta visibility; profile opacity; theme-derived volume/value-area, outside-VA, ask/positive-delta and bid/negative-delta colours; shared gradient schemes. Active gradients disable overridden colour controls.
- Profile spine; POC highlight; automatic/manual tick grouping; width; existing execution-size filters; value-area percentage; POC/VA lines, colours, weights and labels.
- Level extension to the selected range, the window edge or none. New `to-profile-end` native option is used only by fixed drawings; existing normal profile extension behavior is unchanged.

Fixed profiles request exact 1-tick rows once per range/filter signature, then use the normal painter's display grouping and VA calculation. Appearance edits reuse the completed local result rather than requerying the recorder. Fixed drawings no longer temporarily paint an OHLC-distributed approximation while exact executions load. Existing saved styles/anchors/templates remain; missing new fields use theme defaults and standard 70% VA. Explicit saved VA settings are honored. Anchored drawing requests and legacy routing are preserved; strict exact-only options workspaces remain strict.

Also fixed signature cleanup to compare against the captured prior signature, preventing deferred React state updates from retaining old-range data under a new anchor signature.

## Evidence

- 254 focused drawing/profile/clipboard/persistence/painted-hit/State regressions pass, including actual fixed SVG rendering across all 25 profile-type/appearance combinations, signed aggressor sides, line-mode delta retention, template/style normalization, level termini, and execution-only fallback guards.
- A headless Chrome comparison used controlled fixtures and the actual native painter's canvas instructions versus the actual fixed drawing component's SVG output. All 25 combinations had zero pixels exceeding a 16/255 per-channel difference threshold over each 600×320 image. This is an isolated visual comparison, not a live owner-session/provider-parity certification. Evidence: `tmp/draw-vp-canvas-svg.png`, `tmp/draw-vp-pixel-results.json`, script `tmp/draw-vp-browser.mjs`.
- One separately run older timeframe harness test raises `ReferenceError: alignFixedMarkers is not defined`; it reproduces against unchanged HEAD in `tmp/draw-vp-head-baseline.test.mjs`. Do not claim the entire legacy suite passes.
- Scoped lint, TypeScript and full production builds pass. Large Chart/DrawLayer compiler lint is not claimed following previous repository OOM history. Main-only deployment and actual live SHA verification remain the release gate.

No execution values or aggressor sides are synthesized, no gateway/subscription/restart, recording, account/trade, theme catalog or normal-profile data changes. Archive availability still determines whether a selected range can display an exact profile; missing data stays unavailable.
