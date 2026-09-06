# Know Sure Thing — pending implementation audit, 2026-09-06

Status: calculator, scalar settings, actual engine and both pane orientations
are implemented. Local Add registration is enabled after the focused and
browser checks below; production commit verification is recorded separately.

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

## Integration verification — continuation

- Four settings tests cover every numeric bound, all horizon/mode routing,
  scalar roundtrip, independent slope colours, theme ownership and presentation.
- Five integration tests exercise the real engine/registration, stored instance
  normalization, actual deep-history membership and compiled real SVG painter:
  both orientations, full-pane reference, out-of-range clipping, hard breaks,
  points/line, labels and their independently controlled backgrounds. The actual
  pane domain function verifies KST-only opt-out without changing legacy scaling.
- Combined 52 indicator tests pass; scoped new-code/test ESLint passes.
- Browser fixture uses the real settings dialog, engine and pane renderer,
  labelled synthetic data, no feed. Verified changing Simple to Triangular and
  ROC1 10 to 5, visible coloured KST and dashed signal, full-width middle level,
  points-only mode, custom Momentum name/background, value label, clean Save,
  close without re-prompt, reload restoring every changed field.
- Fixed KST-specific dialog routing found in that test: section markers must
  surround the custom component at the dialog's collection boundary; markers
  inside a component are not visible to its tab collector. No working study's
  tab routing changed. Width/style switches route to Style; ROC and percent to
  Inputs. Both orientations use a KST-only painter; legacy pane paths untouched.
- KST owns its dual slope colours through the final engine boundary, avoiding
  a generic post-colour pass flattening both sides to one custom swatch.
- Middle reference participates in scaling even when its timestamp is outside
  the viewport, and each main/signal auto-centre switch independently opts out.

## Release checklist

- [x] Map flat persisted numeric fields and all four smoothing choices.
- [x] Wire separate KST/signal/middle line styles, colour ownership and labels.
- [x] Audit actual pane support for per-line auto-centre/labels/backgrounds;
  do not expose no-op controls or mutate working studies to fake parity.
- [x] Wire engine, actual pane renderer and deep-history membership together.
- [x] Test real scalar settings and stored indicator normalization.
- [x] Browser: rendering, selected controls, Save/close/reload; theme/custom
  ownership additionally checked by deterministic series tests.
- [x] Full production build: TypeScript and all 80 static pages passed.
- [ ] Deployment commit verification after push.
- [ ] Authenticated cloud-template import/export/account roundtrip and a
  representative multi-pane live-session performance soak remain unproved.

Integration conventions, not vendor parity claims: KwantDesk gives each
instance its own dockable pane rather than DeepCharts' arbitrary panel selector
and secondary-axis sharing. Name/value labels are clipped in the plot. The
marker-background toggle uses chart background instead of panel background;
its exact vendor geometry and non-simple signal seed remain unverified.

No feed/login/infrastructure changes or working-indicator formula changes.
