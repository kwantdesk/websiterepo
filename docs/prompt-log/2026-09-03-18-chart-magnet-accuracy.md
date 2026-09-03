# Chart magnet accuracy

## Prompt

> the magnet tool doesnt work properly, for every tool if that is on, it should be able to click near a wick and itll lock to it you know right now it doesnt do that, or it does but its very unnacurate and weak

## What was found

1. The default magnet captured only nine screen pixels, which was too narrow
   for a deliberate click near a thin wick.
2. The shared drawing layer chose one candle by timestamp and inspected only
   that candle. On compressed charts, a neighbouring candle could be visibly
   closer to the cursor and still be ignored.
3. A new anchor click could inherit the hover or previous-anchor hysteresis
   lock, pulling it back to the wrong candle.
4. Range, volume, tick, Renko, delta, volume-break and point-and-figure bars
   can complete multiple times in one source second. Their chart renderer gives
   each bar a unique display time, but the magnet collapsed them onto the same
   source-second coordinate.
5. The professional drawing candidate path looked up the event-time map using
   truncated seconds instead of the full source timestamp.

## Fix

- Increased the standard capture radius from 9px to 18px and strong from 26px
  to 36px, with proportional release radii for stable dragging.
- Added a shared screen-space candle resolver that inspects every candle inside
  the horizontal capture band and chooses the nearest OHLC point using true
  two-dimensional pixel distance. High/low wick extremes win exact ties.
- Made every placement click resolve afresh while retaining hysteresis for
  previews and dragging.
- Gave event-bar magnet targets the same unique monotonic times as their
  rendered candles.
- Corrected full-timestamp lookup for the professional drawing engine.
- Applied the behavior at the shared drawing layer, covering every fixed-point,
  multi-point, polyline, shape, Fibonacci, measurement, volume and position
  tool. Freehand strokes remain intentionally unsnapped because snapping every
  sampled point would corrupt the stroke.

## Verification

- `test:chart-magnet`: passed placement, stale-lock, adjacent-bar, event-time,
  velocity and hysteresis coverage.
- `test:magnet-snap`: integration contracts passed.
- Focused ESLint: passed.
- TypeScript: passed.
- Next production build: passed; all 80 static pages generated.

## Outcome

- Production code commit: `bfc76db65b57da58d5a7b5ff565b91f603277cdc`.
- Vercel deployment `7QTdxkUXXaFDgPWZJEurkc8Jsrez` completed successfully
  in the sole active `websiterepo-yfmi` project and is assigned to
  `www.kwantdesk.com`.
- Live production verification confirmed that the NQ chart restored its
  candles, the shared magnet control activates, and the deployed strength menu
  exposes `Standard magnet · 18px` and `Strong magnet · 36px`.
- No drawing was saved during production verification.
- Result: magnet placement now selects the nearest visible candle wick/body
  target across the shared non-freehand drawing-tool engine, including
  same-second event bars, with a practical standard capture range and a
  stronger optional mode.
