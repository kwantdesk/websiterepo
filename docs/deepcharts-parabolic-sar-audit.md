# Parabolic SAR — 2026-09-06

## Evidence and limits

- Official settings: https://www.deepcharts.com/helpcenter/article/parabolic-sar
  documents acceleration step 0.02, maximum 0.20, colour, secondary colour,
  display/line style, width and secondary axis. All have corresponding controls.
- Read-only installed Deepchart.dll metadata exposes
  `VolAnalysis.Properties.IndicatorDescriptions.get_Parabolic_SAR` (RVA 0x10800),
  but the protected calculator and startup defaults were not recovered.
- Independent algorithm reference consulted:
  https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_SAR.c
  explicitly explains the ambiguity of startup direction/extremes. This is
  not evidence that DeepCharts uses the identical seed.

## Calculation contract

Use high/low from supplied genuine candles. First directional movement chooses
the initial trend (ties long); seed the stop with the first bar's opposite
extreme. Emit the first value on the second bar. A touch/cross reverses direction,
resets acceleration, and moves the stop to the previous trend extreme constrained
by current/prior prices. New trend extremes increment acceleration up to Maximum;
project the next stop using the two most recent extremes. Step above Maximum is
capped; zero is supported. UI explicitly states the cap.

Invalid or out-of-order source bars reset seeding and break plotted continuity.
Normal market closures preserve state without inserting fake candles. Event
timestamps keep sub-second distinctions. No wall clock, future candles, provider
calls, new timers or additional subscriptions are used. Work is O(n), with
constant rolling state plus the output points.

Default display is points, width 1, primary theme colour, secondary colouring
and secondary axis off. These visual choices are explicit KwantDesk defaults;
only step/maximum are verified vendor defaults. Optional secondary colour marks
the downward state. Points, line, line+points, line styles, size, theme/custom
colours and gradient schemes are supported. Secondary axis is instance-specific
and warns that its independent scaling is not directly comparable to candles.

## Verification

- Seven tests cover hand-calculated continuation and reversals, short symmetry,
  equality/ties, acceleration caps/zero, invalid data and closure gaps, event
  timestamps, forming-bar causality, colour/theme ownership, settings persistence
  and actual Chart options for point/line/scale switching.
- Combined SAR/ADX/Absolute Levels/registration run: 23 passing tests.
- Actual local browser used the real settings component and extracted production
  chart-series options with labelled synthetic OHLC. Verified visible dots,
  acceleration edit 0.02→0.10, line display, directional colours, immediate clean
  Save, close without another prompt, and persisted reload. A boolean key was
  renamed before release to avoid being misidentified as a colour picker.
- Scoped ESLint passed; production build passed (TypeScript and 80 static pages).
- No authenticated cloud-template roundtrip, live-market soak, exact DeepCharts
  seed/visual parity or whole-workspace frame-rate guarantee is claimed.

Outcome: released SAR, not completion of the whole indicator library.
Commit `5c16e9a5074a3272c450e1a9e656c08533b5a806` was pushed through main;
Vercel reported success for websiterepo-yfmi and the live diagnostics endpoint
returned that exact commit. No duplicate deployment or data-service restart.
