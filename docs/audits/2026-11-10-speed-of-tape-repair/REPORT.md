# Speed of Tape repair — 10 November 2026

## Faults found
1. The study generated fixed ten-second-window END timestamps. Native timeToCoordinate only resolves actual chart timestamps, so on a minute chart most readings vanished. On event charts multiple windows were mapped onto the same candle, piling up bars; timestamps were then remapped a second time by the pane coordinate bridge.
2. The study consumed the sampled indicator tape/candles, adding the heavy-study sampling delay.
3. When Footprint was enabled, both tape-speed studies inherited its 1.5-second React checkpoint rather than the normal 500ms execution checkpoint.
4. In trade-count mode, min/max filtered the number of prints, not execution size.
5. Activity could stay visually elevated in a quiet tape until another data update arrived.

## Repair
- Sample the trailing configured seconds window at each candle's real timestamp, with current-bar cutoff at the current/replay time. Time intervals use their actual duration; event bars use source execution watermarks. The coordinate bridge resolves event geometry once.
- Compute volume or trade count independently of bar duration. Changing seconds therefore changes the actual lookback calculation rather than merely redistributing the same candle volume.
- Consume the unsampled execution prop in a separate lightweight memo; heavier pane calculations retain their own existing memo and cadence.
- Keep the normal 500ms execution checkpoint when either tape-speed study is combined with Footprint. No new provider polling or subscription.
- Tick the lightweight local quiet-tape clock once per second while visible and live; stop the timer in replay or when disabled. Live executions still trigger reads independently of that clock.
- Apply size filters to each execution's volume, then count either contracts or prints. Retain zero-value filtered samples, theme/custom fills and deviation filtering.
- Never treat footprint aggregates as timestamped prints or substitute candles for missing executions. Retained execution history is strongest-print sampled outside fifteen minutes: exclude that incomplete prefix and require the complete trailing window, rather than presenting biased historical intensity.
- Keep the UI description explicit: trailing-window intensity at each candle; Volume and Trades are the supported modes.

## Validation and limits
- 13 targeted checks passed (eight Speed of Tape tests plus recovery and indicator-library toggle checks). Includes 14 clock intervals from 1s to 1D, distinct event-bar anchors, same-candle live changes, quiet-window decay, min/max/trade mode, replay causality, aggregate rejection, incomplete-history exclusion, custom colors and unchanged input data.
- Scoped ESLint reports no errors; pre-existing hook warnings remain.
- The optional older Instant regression script completes its calculation assertions but fails its pre-existing Workspace source-regex assertion (`footprintLiveActive || instantTapeLiveActive`), which already differed before this change. It is not counted as passing.
- Production build and main-only deployment verified separately in production-receipt.json after release.
- This repair is for Speed of Tape; it does not invent an equities/options execution feed. Instruments need actual captured execution records. Full multi-day seconds-level intensity is not established by the browser's compacted historical tape. No claim of observed live-market cadence is made from closed-market tests.
