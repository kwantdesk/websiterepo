# Prompt

Double-check DeepCharts' CVD / delta cumulative candlestick settings, verify KwantDesk has the correct controls, and make sure the controls genuinely work, including line presentation, zero line, average length/type, filters and time/reset behaviour.

# Fixed

- Audited all three related DeepCharts studies rather than treating Cumulative Delta, Delta Cumulative Candlestick and Cumulative Volume Delta as one menu.
- Added the missing Volumes / Aggregate Trades control to the dedicated cumulative studies.
- Made `Reset to session` affect the calculation; it was previously ignored by the engine.
- Added real Simple and Exponential average calculations plus an average line-style selector.
- Added Candlestick, OHLC and Candle Body plot modes for delta cumulative candles.
- Restored real day/minute/second period mode and value controls to general CVD.
- Wired custom series name, heading visibility and value visibility.
- Preserved hard gaps across resets for the main CVD, average, deviations, bid/ask totals and filtered CVD.
- Kept order-count periods out of the UI until the execution-level engine can reset at the exact Nth print.

# Outcome

The default volume-based cumulative candles remain unchanged, while every newly exposed control changes the calculation or renderer contract immediately. Focused CVD settings tests pass, existing CVD candle-direction and session-sampling regressions pass, and the full Next.js production build succeeds.

