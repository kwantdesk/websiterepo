# Live-price motion and Chromey Mono price line

Date: 2026-09-04

## Prompt

> the live price feed candles are still moving weird, firstly chromey mono
> theme is just having the price line black then changing to green then black
> ... the price is not smooth ... it feels like a very low fps

## Diagnosis

- Lightweight Charts inherited the forming candle's body colour for its
  live-price line and scale label. Chromey Mono intentionally uses a black
  falling body on a black chart, so the line alternated between green and
  invisible whenever the forming candle crossed its open.
- A direct simultaneous production trace separated rendering cadence from
  source cadence. In 12 seconds, the NQ raw feed produced 151 instrument
  events (133 depth, 17 BBO and one execution) and the priority quote stream
  delivered 50 frames. Quote-frame timing tracked raw Rithmic event timing;
  no browser timer or two-second React refresh remained in the path.
- NQ's visible price can move only when its verified execution or best
  bid/ask changes. Filling quiet source intervals with invented intermediate
  prices would make the display look smoother while making it false, so no
  interpolation was introduced.

## Fix and outcome

- The live-price line now uses a stable theme accent resolved to at least
  4.5:1 contrast against the chart background.
- The explicit colour is applied both when the candle series is created and
  whenever candle/theme settings are reapplied, so a later theme change cannot
  restore the library's direction-dependent default.
- Candle body, wick and border choices remain unchanged. Chromey Mono keeps
  its intended hollow black falling bars while its live-price line remains
  visible green.

## Verification

- Candle-style regression passes, including first-paint and subsequent-theme
  update coverage.
- Every website theme's resolved live-price line meets the 4.5:1 contrast
  requirement.
- TypeScript passes.

