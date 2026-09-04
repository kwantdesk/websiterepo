# Prompt 19 — DeepCharts Speed of Tape (Instant)

## Request

Add and fully wire DeepCharts' vertical Speed of Tape (Instant) indicator from
the existing placeholder. Match its calculation, colours, position and
settings, using the licensed DeepCharts DLL and supplied screenshots as the
reference.

## Work completed

- Confirmed the existing `Speed of Tape (Instant)` catalogue item had no live
  renderer or settings implementation.
- Added a deterministic execution-window calculator for Volume/Trades and
  Total/Buy/Sell/Delta modes.
- Added execution-size filters, window seconds, bar count, minimum scale, line
  width, reversal, SD references, theme linkage and independent colour slots.
- Added a dedicated vertical rail immediately behind the right price scale.
- Kept the advanced `Tape Speed & Order-Flow Burst` indicator unchanged.
- Connected the instant rail to the unsampled Rithmic tape revision and excluded
  aggregate `flowOnly` history.
- Added automated parity/regression coverage and ran the full production build.

## Outcome

The placeholder is now a working live indicator with saved settings and theme-
safe rendering. No OHLCV or fake order-count fallback is used when executions
are missing.

