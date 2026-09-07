# Footprint chart polish

## Requested

> Let's polish up our footprint chart. I feel like it's good, but I feel like
> we need to go over and polish it. You know, the volume profiles that are on
> the side, polish them, the numbers that appear, how quick they appear, what
> it actually shows, our presets, what they are, if we have all the best
> presets, if we need any more presets, if we've got all the, you know, the
> good ones, if, you know, delta and that is all populating correctly, make
> sure there's no bugs.

## Found

- Trade-count mode displayed trade counts but still classified imbalance rows
  from contract volume.
- Delta-percentage mode converted a ratio setting with an inaccurate shortcut:
  a 3:1 threshold qualified at 30% delta instead of the exact 50%.
- Positive/negative delta maximum markers could identify a row even when the
  bar contained no delta of that sign.
- Narrow Bid x Ask cells silently changed meaning and printed total volume.
- Sparse side-profile rows inferred their height from the first two prints,
  making isolated rows wider or taller than the selected tick grouping.
- Visible-region scaling sorted every price-cell metric during every paint,
  adding avoidable work while navigating a dense Footprint.
- The five visible presets omitted useful volume-heatmap and trade-count
  starting points, and partial preset application leaked settings from the
  previously selected preset.

## Fixed

- Volume and Trades inputs now drive their own POC, value area, maxima, VWAP
  and imbalance calculations consistently.
- Delta-percentage imbalance uses the exact ratio conversion and the selected
  input dataset.
- Opposite-sign maximum markers remain absent instead of labelling a false
  extreme.
- Bid x Ask numbers appear only when both sides fit; single-metric modes retain
  compact K/M formatting.
- Side profiles use the configured profile tick step for stable row geometry.
- The renderer uses exact linear-time quickselect rather than a full sort for
  visible scale percentiles.
- Seven described presets are visible: default, order flow + profiles,
  imbalance, delta, volume heatmap, trade count and minimal ladder. Presets now
  start from a clean stock configuration while preserving the user's palette
  and performance caps.
- User-facing Footprint help text no longer names a private feed/provider.

## Outcome

Footprint values and highlights now describe the selected dataset without
semantic fallbacks, side profiles hold a consistent shape, presets are useful
and repeatable, and dense pan/zoom paints do less main-thread work. Existing
direct execution-to-frame updates, bar retention, replay, profile row sizing,
theme palettes and native authority fixtures remain intact.

## Verification

- Footprint Node regressions: 47/47 passed.
- Focused bar-window, reconciliation, profile-row, chart-type, replay, native
  fixture, width, palette, flow-coverage and detail-hysteresis suites passed.
- TypeScript passed.
- Production build passed.
