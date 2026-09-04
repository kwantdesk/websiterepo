# Deep Charts Composite Volume Profile audit

Date: 2026-09-04

## Reference contract

The official Volumetrica Volume Profile reference defines Composite as one
profile combining the complete range loaded on the chart. It also defines the
shared profile contract: Volume, Bid/Ask, Delta, Delta plus total volume and
Delta percentage; automatic/manual tick grouping; width and offsets; visual
style and right alignment; POC, value area, developing values, VWAP/envelopes,
peak/valley, summary and time filtering.

Reference: <https://help.volumetricatrading.com/en/support/solutions/articles/204000037289-volume-profile>

The locally installed licensed `Deepchart.dll` was inspected read-only. Its
profile contract exposes the corresponding `VbpPeriod`, `LengthType`,
`LengthValue`, custom dates, execution input filters, grouping, width/offset,
right alignment, always-visible behaviour, POC, value area, peak/valley,
VWAP/envelopes, summary and session-filter properties. This confirms Composite
uses the full Volume Profile engine rather than a reduced histogram.

## KWANTDESK implementation

- Stable indicator id: `composite-volume-profile`.
- Default range: complete loaded candle range, represented by one exact custom
  execution request so no already-binned daily profiles are merged.
- Default placement: right chart edge, facing into the chart.
- Source: Rithmic executions through the local gateway. The server request is
  always tick-resolution (`groupTicks=1`); display grouping is applied by the
  renderer so zooming can recover detail.
- Live development: the shared Rithmic execution batch updates the Composite
  model in the same immediate path as Daily and Weekly Volume Profile.
- Cash/options-underlying charts: the existing explicit source rules remain in
  force. Options-family indices use the real corresponding CME execution
  profile projected by live basis. Other cash tickers may use clearly marked
  provider bar-volume profiles; no bid/ask behaviour is invented from candles.
- Controls: the complete shared Volume Profile editor is enabled, including
  profile type, input data/trade-count mode, filters, grouping, themes and
  gradients, width/offset, POC, value area, peaks/valleys, VWAP/envelopes,
  summary and filter/session time.
- Saved settings and shareable Volume Profile templates use the existing
  normalized profile schema; missing Composite settings migrate to the
  right-docked loaded-range defaults.

## Verification

- Composite range/activation/exact-request/live-update regression passed.
- Volume Profile data, structure, grouping, docking and cross-profile parity
  regressions passed.
- TypeScript passed.
- Optimized production build passed for all 80 routes.
- Scoped lint passed for the new resolver, config, settings UI and tests.
  `KwantifyWorkspace.tsx` passed with pre-existing warnings only. The existing
  15k-line `Chart.tsx` exceeds ESLint's 8 GB parser heap in isolation, while
  TypeScript and the production compiler both passed it.

## Remaining visual evidence

The safe computer controller exposed no native Deep Charts window in this
session. A final side-by-side pixel/screenshot sweep is therefore still open;
calculation, settings and activation are complete, but pixel-identical parity
must not be claimed until that visual evidence can be captured.
