# DeepCharts Overlay Timeframe Highlight audit — 2026-09-07

## Evidence used

- Official guide: <https://www.deepcharts.com/helpcenter/article/overlay-timeframe-highlight>
- Installed licensed DeepCharts DLL public metadata was used only as settings
  evidence. No protected method body was copied or treated as a formula.
- The public contract specifies higher-timeframe aggregation, price-chart
  highlighting, Minute/Hour/Day parameters, delta/fixed/fading colours,
  body/shadow opacity, range background, high/low targets and optional
  volume/trade/Bid/Ask summaries.

## Implemented contract

- The study is distinct from `overlay-timeframe-candlestick`. It owns one
  chart primitive and does not add another network subscription or polling
  loop; it aggregates the host chart's authoritative ordered candles.
- Minute, Hour and Day multiples are bounded and the forming higher-timeframe
  bucket updates whenever the host candle updates. OHLC is preserved and
  volume, trade count and classified Bid/Ask volume are summed.
- Invalid, duplicate or out-of-order source bars start a new visual segment;
  they are never joined into a false higher-timeframe candle.
- Fixed colours follow price direction. Optional delta colouring uses only
  classified executions; Fading scales opacity by deviation sensitivity.
- Body, wick/shadow, range background and border have independent documented
  controls. Optional high/low targets support colour, line style/width, text
  size and left extension.
- Summary text is bounded to the newest requested higher-timeframe candles and
  can independently show volume and trade counts. Ask/Bid rows only appear
  when classified volume exists.
- All numeric controls use the shared slider/type-input component. Theme mode,
  custom colours, Save, account templates, JSON export/import and workspace
  restoration use the shared indicator infrastructure.

## Deliberate limits

- The web chart supports the documented horizontal price-chart presentation.
  The vendor guide describes Vertical as conditional (“if supported”); no fake
  vertical pane mode is exposed.
- `Parameter 2` is described as optional without public semantics for the
  supported Minute/Hour/Day modes, so no inert control is displayed.
- Exact protected bucketing edge rules and native pixels are not claimed.
  No market-open latency soak or authenticated cross-device template test is
  claimed by the local release gates.

## Verification

- `tests/overlay-timeframe-highlight.test.mjs`: five interval, OHLC/summary,
  seam, theme/model and settings/persistence/renderer tests pass.
- TypeScript passes with no diagnostics. Scoped source lint and the full
  80-page production build are release gates recorded in the prompt outcome.
