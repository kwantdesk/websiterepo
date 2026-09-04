# DeepCharts Speed of Tape (Instant) parity audit

## Reference contract

The implementation was checked against the supplied DeepCharts screenshots,
the installed protected `Deepchart.dll` metadata, and Volumetrica's public
Speed of Tape documentation.

DeepCharts exposes:

- a vertical chart-area presentation docked beside the price scale;
- Volume/Trades input, minimum and maximum execution-size filters;
- Total, Buy, Sell and Delta display values;
- a configurable number of seconds;
- bars to show, minimum scale, line width and plot reversal;
- positive/negative candle border and fill colours;
- text enabled, text size and text colour controls;
- standard-deviation reference levels.

## KwantDesk implementation

`Speed of Tape (Instant)` is now a real order-flow study, distinct from the
larger `Tape Speed & Order-Flow Burst` research tool.

- The calculator consumes direct Rithmic executions and rejects `flowOnly`
  aggregate history. It does not synthesize tape speed from OHLCV.
- Each column is one non-overlapping N-second exchange window.
- Volume counts executed contracts. Trades counts the execution count supplied
  by the feed. Buy, Sell and Delta use aggressor classification.
- The rail consumes the unsampled execution revision so a live print can update
  it immediately rather than waiting for the heavy-indicator batching timer.
- The rail is exactly the native price-scale width and docks immediately to its
  left. When Mini DOM is present it moves left instead of drawing underneath it.
- The bar height uses the selected display metric. Positive/negative colour is
  determined by the execution delta of that window, matching DeepCharts'
  `Delta Positive` and `Delta Negative` paint roles.
- Theme colours are passed through the chart's visibility/separation resolver,
  preventing black-on-black or same-colour positive/negative bars.
- SD+1 and SD+2 are calculated from the configured trailing window and share
  the same vertical scale as the visible bars.
- The meter plot now uses one shared coordinate area for both columns and SD
  levels, reserves the same footer-height strip for the `S-T(10) V` caption,
  and leaves a ten-percent auto-scale margin above the largest bar/reference.
  This prevents SD+2 from sticking to the top border and removes the former
  level-to-column alignment error.
- Deep Charts' exposed stock settings were checked directly from the installed
  16.0.9 assembly and supplied settings screenshots: Volume, filter 1/0,
  Total, 10 seconds, three bars, scale minimum 0, line width 1 and plot reverse
  off. Those remain KWANTDESK's defaults.

## Honest boundary

The installed DLL is protected and cannot be legally or technically
disassembled into readable calculation code. Its exposed metadata and UI
contract are available. KwantDesk therefore implements the observable,
documented execution-window semantics and tests them deterministically rather
than claiming copied proprietary internals.

An `Order` database choice is not exposed until the indicator receives a
lossless order-lifecycle stream with stable order identity. Counting trade
prints as placed orders would be a false implementation.

The vendor's published Speed of Tape documentation defines the calculation as
tick-by-tick market intensity over the selected seconds and distinguishes
Volume, Orders and Trades. KWANTDESK exposes only the lossless execution-backed
choices it currently owns; that data-integrity boundary is intentionally not
weakened for visual parity.

## Verification

- `npm run test:speed-of-tape-instant`
- `npm run test:tape-speed-order-flow-burst`
- `npm run build`
