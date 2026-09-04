# Deep Charts VWAP-family audit — 2026-09-04

## Evidence boundary

The installed licensed `Deepchart.dll` contract and Volumetrica's official VWAP
documentation were available. Safe native-window control did not expose a Deep
Charts window in this session, so this audit does not claim a fresh pixel-level
side-by-side comparison.

Reference pages:

- https://help.volumetricatrading.com/en/support/solutions/articles/204000014225-vwap
- https://help.volumetricatrading.com/en/support/solutions/articles/204000014946-vwap-envelopes
- https://help.volumetricatrading.com/en/support/solutions/articles/204000037289-volume-profile

## Result

| Variant | Before | Implemented contract | Verification |
| --- | --- | --- | --- |
| VWAP | Session-only HLC3 line; no period or envelope controls | Day/Minutes/Seconds/Orders periods; HLC3/HL2/OHLC4/Close sources; SD or percentage envelopes; five independently enabled bands; line width/style, colours and optional current value | Exact source, reset, band, persistence and renderer fixtures |
| VWAP Envelopes | Session-reset VWAP with three permanently drawn SD bands | Continuous Days/Minutes window; SD or percentage mode; five independently enabled bands; full line/style/colour controls | Continuous session-boundary and window-eviction fixtures |
| Rolling VWAP | Bar window was cleared at every CME reopen | Continuous Bars/Minutes/Days window; source/mode/five-band contract; old `length` settings migrate to `periodValue` | Migration and no-session-reset fixtures |
| Anchored VWAP drawing | One HLC3 line only | Four sources, three independently enabled deviation bands, separate upper/lower colours, first-envelope fill and opacity; all fields saved by drawing templates | Drawing normalization and renderer contract fixtures |
| Volume Profile VWAP | Existing shared profile VWAP implementation | Retained: enable/highlight/line/developing/extensions/envelopes use the shared exact execution-profile engine | Volume-profile structure and profile-parity suites |

## Accuracy notes

- All calculations use volume weighting and population weighted variance.
- A VWAP period break is emitted to the chart so unrelated reset windows are
  never connected by a false diagonal line.
- Continuous Envelopes and Rolling VWAP do not reset at midnight or the CME
  reopen; only observations outside their selected window are evicted.
- The Orders period uses each candle's authoritative Rithmic trade count. A
  candle that crosses an order-count boundary cannot be split without the raw
  execution stream, so exact within-candle order-period parity remains part of
  the final live Deep Charts/execution-tape comparison.
- Indicator templates already persist and account-sync the complete settings
  record; drawing templates persist the complete drawing style record.

## Tests

- `npm run test:vwap-family` — 9/9
- `npm run test:volume-profile-structure` — passed
- `npm run test:profile-indicator-parity` — passed
- `npm run test:indicator-templates` — 16/16
- `npx tsc --noEmit --pretty false` — passed
- `npm run build` — passed, 80 static pages

