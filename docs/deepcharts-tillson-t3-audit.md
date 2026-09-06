# Tillson T3 — 2026-09-06

## Reference evidence

Official settings:
https://www.deepcharts.com/helpcenter/article/tillson-t3
and https://helpdesk.deepcharts.com/portal/en/kb/articles/tillson-t3
document length 14, factor 0.618, Close default with OHLC/Volume choices,
slope-based primary/secondary colours, line/solid/width 1, and short name.
Installed DLL public metadata exposes `IndicatorDescriptions.get_Tillson_T3`
(RVA 0x10890); its protected calculator/seed was not recovered.

Independent mathematical reference:
https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_T3.c
explains the three generalized double-EMA composition and six EMA states.
Its different default parameters are NOT used as DeepCharts defaults. Exact
DeepCharts seed, every renderer enum and pixel parity remain unverified.

## Calculation and integration

The new engine implements the six-state expansion of the three generalized
double-EMA stages. Each EMA seeds from its own full N-value mean; the first
output is at index 6(N−1), requiring 6(N−1)+1 valid bars. Length 1 is exactly
the input. Centering around the initial value and using a difference-form
combination preserves constants and reduces large-price cancellation.
This seed convention is explicit, not claimed to be recovered vendor logic.

The factor is a smoothing coefficient, not actual trade-volume weighting.
Volume source smooths genuine volume as its input and uses an independent
instance-specific scale. Cash-index volume is refused; absent volume is not
zero, while real zero volume is permitted. Price sources work without volume.
No future bars, wall-time extrapolation, new subscriptions or polling are added.
Invalid inputs/order reset all six seeds and break continuity; genuine market
closures retain the ordered-bar state without fabricating intervening samples.

Length 1–1000, factor 0–1 (step 0.001), width 1–4, five inputs, slope/none
colour mode, line/points/both and solid/dashed/dotted controls work. Theme and
custom/gradient colours are applied to the points themselves. Short name
changes the series label and active indicator list; this is KwantDesk's list,
not a claim that DeepCharts' on-canvas legend is reproduced. A colour-mode key
is deliberately not named like a colour value, avoiding a spurious picker.

The existing 20,000-bar deep-history route supplies this new study: length
1000 needs 5995 actual bars, which cannot fit the 1500-bar lite window.
O(n), constant six-stage rolling state plus output. A local Node 20k-bar check
before removing a per-bar temporary array measured length 14 median 1.77ms /
p95 5.13ms and length 1000 median 0.76ms / p95 1.08ms. These are calculator
measurements, not full-workspace FPS, concurrency or live-market guarantees.

## Verification

- Seven tests: documented defaults/full seeds and hand-calculated ramp;
  independent batch EMA/coefficient comparison for four lengths and three
  factors; identity/constants; all sources and volume guards; invalid-data
  resets/event times/causal prefixes; styles/colours/name/persistence; real
  chart deep-history routing and maximum-length warmup.
- 37 combined tests passed; scoped ESLint passed.
- Final production build passed, including TypeScript and all 80 static pages.
- Actual local browser with real settings and extracted production series
  options: visible default line/slope colours, length 14→5, factor 0.618→0.3,
  visibly changed geometry, custom name, immediate clean Save, close without
  another prompt, reload persistence and custom active-list name.
- Synthetic fixture only, no trading connection. Authenticated cloud-template
  roundtrip, exact vendor seed/visual parity and live-market soak not claimed.

Outcome: implemented T3; 31 pending library entries remain.

Production verification: commit `09e57921e7ec69b063312bb0b6f01889de96a0e8`
passed the existing `websiterepo-yfmi` Vercel deployment. The live
`www.kwantdesk.com/api/market-data/diagnostics` endpoint returned that exact
commit on 2026-09-06. No second deployment path was used.
