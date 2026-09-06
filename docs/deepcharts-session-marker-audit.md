# DeepCharts Session Marker audit — 2026-09-07

## Evidence used

- Official guide: <https://www.deepcharts.com/helpcenter/article/session-marker>
- Installed licensed assembly public metadata:
  `C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll`
- Public type: `Deepchart.Roles.RoleSolverContainer`. Its settings-bound
  properties expose exchange/local time reference, line/text styling,
  Asian/Europe/USA enable and clocks, session and imbalance colours,
  open/close, midprice, per-session VWAP and open-marker colours.

No protected method body was copied and no private formula parity is claimed.

## Implemented contract

- Three independent, DST-aware windows: Asian `15:00–03:00`, Europe
  `03:00–11:00`, USA `09:30–16:00`, interpreted in New York exchange time by
  default. Local-time mode and custom start/end clocks are available.
- Session high/low, open, live close, midpoint and first-N-minute imbalance
  high/low are calculated directly from ordered chart OHLCV candles.
- Each session can enable its own VWAP. VWAP is HLC3 weighted by the real bar
  volume; bars with no usable volume do not receive invented weight.
- Session and imbalance ranges have independent backgrounds. Lines have
  bounded width/opacity/style, optional labels and a separate text colour.
- The opening marker colours the open by the real gap direction versus the
  immediately preceding candle. Theme mode follows the active chart; choosing
  a colour creates an instance override.
- Settings participate in the shared Save/close guard, user templates,
  JSON export/import and workspace restoration.

## Reference discrepancy and deliberate limits

- The public article prints line width default `20`; the visual control and
  normal chart geometry indicate a likely missing decimal. KwantDesk uses a
  safe visible default of `2` and exposes `1–4`. It does not render a dangerous
  20-pixel market level merely to repeat a documentation typo.
- DeepCharts' guide describes only a session start control, while the public
  DLL contract contains explicit start and end properties. KwantDesk exposes
  both because a deterministic window cannot be defined by a start alone.
- Exact native pixels and protected implementation details remain unverified.
  No market-open latency soak is claimed in this release.

## Verification

- `tests/session-marker.test.mjs`: four calculation, normalization,
  persistence and catalogue-gate tests pass.
- TypeScript passes with no diagnostics.
- New source/test scoped ESLint passes.
- Complete Next.js production build passes, including all 80 static pages.
- Catalogue audit: 128 total, 112 registered, 16 pending, zero orphan engines
  and zero orphan renderers.
