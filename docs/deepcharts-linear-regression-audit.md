# Linear Regression — 2026-09-06

## Reference evidence

https://www.deepcharts.com/helpcenter/article/linear-regression documents a
21-bar default length, Close/Open/High/Low/Volume inputs, line and secondary
colours, display style, line style/width and optional secondary axis.
Installed DLL metadata contains `IndicatorDescriptions.get_Linear_Regression`
(RVA 0x10780); no executable protected regression body was recovered. The public
page does not settle every rendering enum or exact startup/display convention.
No protected-formula or pixel parity claimed.

## Actual calculation and data contract

At each genuine source bar, fit ordinary least squares to x=0…N−1 across its
complete trailing window and plot the fitted value at x=N−1. This is a rolling
endpoint, not a future forecast and not a single retrospective repaint across
all history. N=1 equals the input. Missing/invalid inputs or out-of-order bars
reset the window and mark the next output as discontinuous; a valid closure
time gap preserves the ordered-bar calculation. Fractional-second event times
are preserved, and changing the current bar does not change older outputs.

Every source reads that actual candle field. Undefined volume is not zero;
cash-index volume is rejected using the existing instrument classifier. Native
zero volume is legitimate. Volume uses a per-instance independent scale so
contracts/shares cannot squeeze the price axis; the UI explains this override.
Regression of nonnegative volume may itself be negative: it is an unconstrained
statistical fit, not an invented negative executed-volume candle.

The bounded ring buffer centers values and rebuilds its sums once per N slides
to limit cancellation/drift. Amortized O(n), O(N) rolling state plus output.
The chart routes this study to its existing 20,000-bar deep-history window,
supporting the selectable maximum length of 10,000 without a hidden 1,500-bar
lite cutoff. Missing actual history still cannot be manufactured.

Settings include all five sources, length 1–10,000, width 1–4, points/line/both,
solid/dashed/dotted, optional negative-slope colour, theme/custom/gradient
colours and per-instance secondary axis. Close, line, solid, width 1 and the
negative-slope colour convention are explicit KwantDesk defaults/semantics,
not all confirmed DeepCharts defaults. Only length 21 is documented there.

## Verification

- Seven tests: hand math/full warmup, independent centered least-squares
  comparison across five lengths, large-offset precision, all input data and
  unsupported volume, gaps/event time/causality, theme/settings/persistence,
  and actual chart deep-history routing plus maximum-length output.
- Combined LR/SAR/ADX/Absolute/registration suite: 30 passed. Scoped ESLint passed.
- Final production build passed, including TypeScript and all 80 static pages.
- Real isolated browser settings and production chart-options fixture showed
  the rolling line, length 21→5, source Close→High, immediate clean Save,
  close without another prompt and persistence after reload. Volume selected
  successfully without changing candle-price scale. Synthetic fixture only;
  no trading connection or live data was used.
- Node-only 20,000-bar benchmark: length 21 median 0.612ms / p95 1.509ms;
  length 10,000 median 0.559ms / p95 0.801ms, 30 measured iterations after 10
  warmups. Not a browser-FPS or full-workspace latency guarantee.
- No authenticated cloud-template roundtrip, DeepCharts side-by-side pixel
  comparison or live-market soak claimed. Regression Channel remains separate
  and pending: it includes Zig Zag-driven modes, not just this rolling line.

Outcome: implemented Linear Regression; full-library goal remains open.
Release `b8e245334f2e77fee8db9de4eede006c6016962a` was pushed through main.
Vercel reported success for websiterepo-yfmi. After the domain promotion delay,
the live diagnostics endpoint returned that exact commit; no duplicate deploy.
