# DeepCharts Average Daily Range Target audit — 2026-09-07

## Evidence used

- Official guide: <https://www.deepcharts.com/helpcenter/article/average-daily-range-target-(adr-target)>
- Installed licensed assembly public metadata:
  `C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll`
- Public settings contract: Daily/Weekly/Monthly length type, length, font
  size, left/right label alignment, background colour and text colour.
- Official settings and chart screenshots: defaults Daily, length 1, font 12,
  right aligned, black label background and white text. The visible target
  spacing supports the documented range projection described below.

No protected method body was copied. Exact protected formula and native pixel
parity are not claimed.

## Implemented contract

- Completed exchange periods are grouped by CME trading date, rolling at
  17:00 America/Chicago, or by the corresponding trading week/month.
- The average is the mean high-low range of the requested completed periods.
  The forming period never trains its own target and malformed/gapped candles
  are not silently folded across a data seam.
- Scaling is the forming period open. Primary, Secondary and Extension targets
  project symmetrically at 0.5x, 1x and 1.5x average range. This multiplier
  mapping is an evidence-backed interpretation of the official screenshot,
  not a claim that a protected implementation was decompiled.
- Seven dotted chart lines render only across the current period and carry
  left/right labels. Font size, theme/custom text and label-background colours
  participate in shared Save, templates, export/import and workspace restore.
- The study uses the deep-history candle path so weekly/monthly and long daily
  lengths are not restricted to the lightweight 1,500-bar tail.

## Verification

- `tests/average-daily-range-target.test.mjs`: six calculation, rollover,
  no-lookahead, settings, theme, persistence and registration tests pass.
- TypeScript passes without diagnostics.
- Scoped ESLint, shared indicator-template/theme tests and production build
  are release gates and are recorded in the prompt outcome.
- No market-open latency soak, authenticated cross-device persistence test or
  protected native pixel/formula equivalence is claimed.
