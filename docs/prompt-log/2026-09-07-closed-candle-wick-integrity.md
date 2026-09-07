# Closed candle wick integrity

## Prompt

> some of our candles dont have a wick, this is an issue as i see some with
> bdy only so i think this is a bug that needs re assesing

## Diagnosis

Two different cases had been presented as the same visual result:

- A genuine exchange candle can have no upper or lower extension when its high
  and low are exactly the ends of its body. That is valid market data and must
  not be decorated with a fake wick.
- A candle assembled from an incomplete live sample can also close with its
  high and low clipped to the body. The code already had an authoritative
  closed-OHLC healer and a regression test for this case, but the workspace
  never invoked it. The only periodic history reconciliation was gated behind
  an attached order-flow study and healed flow fields only. Plain charts could
  therefore retain a truncated or body-only live-built bar indefinitely.

The primary candlestick series also started with raw saved wick colours and was
only changed to the fully resolved theme/custom candle palette by a later
effect. A valid wick could consequently be invisible on the initial paint or
during a theme transition.

## Fix

- Added one closed-candle integrity reconciler that always restores OHLC from
  authoritative Rithmic-baked history and optionally restores order flow when
  a consuming study is attached.
- Enabled that low-cadence reconciliation for every normal Rithmic time chart,
  not only charts carrying footprint/CVD-style studies.
- Kept the newest forming edge stream-owned so a partial provider response
  cannot rewind live price or erase a currently forming excursion.
- Initialized the primary candlestick series with the same resolved candle
  palette used by later updates, including wick visibility and theme-safe wick
  colours.
- Did not add cosmetic minimum wicks. If Rithmic reports high/low equal to the
  body endpoints, the candle remains accurately body-only.

## Verification and outcome

- Closed OHLC integrity regression: 7/7 passed, including a plain chart with no
  order-flow study and a deliberately truncated body-only bar.
- Live candle authority: all 19 clock intervals passed.
- Live wick visual path: 8/8 passed.
- Candle visibility: 5/5 passed.
- Hollow-theme rendering: 5/5 passed.
- TypeScript passed and the full production build completed successfully.
- Outcome: missing live samples are corrected after the bar closes and the
  complete Rithmic bar is available; genuine wickless bars are preserved.
