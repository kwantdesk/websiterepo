# Know Sure Thing — pending implementation audit, 2026-09-06

Status: calculator implemented and tested; **still Pending**. No catalogue,
engine, settings or renderer gate has been enabled. Do not call this released.

## Evidence

- Official reference: https://www.deepcharts.com/helpcenter/article/know-sure-thing
- Conventional weighted ROC formula reference:
  https://www.tradingview.com/support/solutions/43000502329-know-sure-thing-kst/
- Licensed installed `Deepchart.dll`, metadata only, no binary redistribution.
  Description getter `get_Know_Sure_Thing` RVA `0x10778`.
  `VolAnalysis.Collections.DictionaryManager` exposes UsePercent, AvgType,
  Avg1Period–Avg4Period, SignalPeriod, Period1–Period4, MiddleLineLevel,
  MiddleLineColor and LevelWidth. Its protected constructor at `0x22918`
  yielded no usable numerical constants; factory defaults/math are not proved.
- AvgType getter `0x22758` signature is `20 00 11 92 e4`; decoded
  TypeDefOrRef `0x12e4` resolves TypeDef 1209 `SelectorSelectorProcType`.
  Actual fields: **Simple, Exponential, Triangular, Weighted**. Wilder is NOT
  offered by this enum and was removed from the initial local draft.

## Observed reference controls (not asserted factory defaults)

All six linked official screenshots were opened directly and visually read.
Simple; averages 10/10/10/15; ROC 10/15/20/30; signal 9; percent off.
Middle 0, width 1. KST: Line/Slope/Solid/2, short name KST. Signal:
Line/None/Dash/1, short name Sig. Both have two colours, name/value labels,
background toggles, marker colour and auto-centre inclusion. Horizontal pane
selected; secondary axis off. KwantDesk should use theme colours by default.

Screenshot URLs, retained as evidence rather than copied vendor assets:

- General: https://framerusercontent.com/images/mRT82BLXLlWwv2NujkqMMh72Y.png
- Average: https://framerusercontent.com/images/6wHDDJOQXzjMo5qTgIuzuv7Y2zA.png
- ROC: https://framerusercontent.com/images/23sf3DciTkxEjfJ2PDU6Kouc.png
- Level: https://framerusercontent.com/images/MvdEsCaLNip5sqhkUef1qnpBjD8.png
- KST: https://framerusercontent.com/images/IUwJJAetBr35tSunFglyz4xZIGE.png
- Signal: https://framerusercontent.com/images/xpN7XBbJJjW54GEwyht1IvuVZc.png

## Calculator contract

`src/lib/knowSureThing.ts`: four close-price ROC components, separately
smoothed and weighted 1/2/3/4, followed by a signal smoother. Raw differences
or percentage changes, never volume-derived momentum. Each smoother requires
its complete seed. Exponential alpha is 2/(N+1); weighted favours the newest
sample; triangular composes two simple averages whose lengths sum to N+1.
Signal currently uses the chosen smoothing method too: an explicit convention,
not recovered protected DLL behavior. Verify against offline reference before
claiming vendor parity for non-simple signal modes.

Fixed rings and amortized constant work per sample, with rolling-sum rebasing.
Invalid close or non-increasing/invalid timestamp resets the calculation and
breaks the next plot. Zero denominator in percent mode invalidates that ROC
window and signal, not a fabricated zero. Negative/zero raw prices are valid.
Closed-market wall time has no effect. Real event-bar timestamps are retained.

Lengths bounded 1–1000. Maximum readiness requires 2999 valid bars for signal,
so integration must add ONLY KST to the existing deep-history path; the 1500
lite window is insufficient. No data is fetched by this module.

## Verification so far

- Six tests: hand ramp and warmups, independent batch references across all
  four smoothing modes and odd/even lengths, percent/raw, causal prefixes and
  changing forming bar, invalid data/time resets, zero denominator, max bounds.
- Scoped ESLint passed. Combined 43-test indicator suite passed before the
  enum correction; the final corrected KST six-test suite passed again.
- `npx tsc --noEmit` passed with the corrected four-mode implementation.
- Node-only synthetic 20k bars, 10 warmups/30 measured runs: median/p95 ms
  Simple 4.00/8.14; Exponential 2.68/4.53; Triangular 6.46/14.04;
  Weighted 4.17/9.17. These are calculator timings, NOT browser FPS or a
  multi-pane/live-market soak. Avoid unconditionally rebuilding 20k points
  at live frame cadence; measure real integration before release.

## Remaining release checklist

- [ ] Map flat persisted numeric fields and all four smoothing choices.
- [ ] Wire separate KST/signal/middle line styles, colour ownership and labels.
- [ ] Audit actual pane support for per-line auto-centre/labels/backgrounds;
  do not expose no-op controls or mutate working studies to fake parity.
- [ ] Wire engine, actual pane renderer and deep-history membership together.
- [ ] Test real settings/template normalization and multiple instances.
- [ ] Browser: rendering, all controls, theme/custom, Save/close/reload.
- [ ] Integration performance and full production build.
- [ ] Only then enable Add, update count, commit/push and verify production.

No feed/login/infrastructure changes. No production behavior changed by this
prerequisite. T3 remains the latest verified live indicator release.
