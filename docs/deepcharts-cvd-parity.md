# DeepCharts CVD settings audit

Audited 4 September 2026 against Volumetrica's current official indicator documentation and the licensed Deepchart installation present on the workstation.

## Reference studies

- [Delta Cumulative Candlestick](https://help.volumetricatrading.com/en/support/solutions/articles/204000012050-delta-cumulative-candlestick)
- [Cumulative Delta](https://help.volumetricatrading.com/en/support/solutions/articles/204000012028-cumulative-delta)
- [Cumulative Volume Delta](https://help.volumetricatrading.com/en/support/solutions/articles/204000013603-cumulative-volume-delta)

## Verified parity matrix

| Reference control | KwantDesk control | Calculation/render result |
| --- | --- | --- |
| Database: Volumes / Trades | Input data | Switches between aggressor contract volume and aggressor trade count. |
| Filter min / max | Minimum / maximum input value | Applies the configured inclusive volume band; max 0 remains unlimited. |
| Reset to start session | Reset to session | Now genuinely resets at the selected Chicago session hour; off now produces one continuous series. |
| CVD series Bars / Line | Display style | Both plots are selectable and rendered; solid and hatch line styles are wired. |
| Delta cumulative Candlestick / OHLC / CandleBody | Candle plot | All three presentations are selectable and rendered from the same cumulative OHLC values. |
| Average | Show average + Average length | The average can be enabled and its length changed. |
| Average type | Simple / Exponential | Both calculations are implemented and reset with the CVD session. |
| Average styling | Average line, width and colour | Style, width and colour reach the pane renderer. |
| Average standard deviations | Show average deviations + multiplier | Upper/lower deviations are calculated and no longer bridge reset gaps. |
| Zero line | Show zero line, colour and width | Visibility, colour and width reach the pane renderer. |
| Name / value / custom name | Show name, Show value, Series name | Pane heading and latest value can be hidden; a custom name is persisted. |
| CVD period mode/value | Trading days / minutes / seconds + Period value | Period resets are deterministic and supplementary ask/bid/filtered plots respect the same break. |
| Show bid/ask volume | Show bid ask volumes | Adds separate cumulative aggressor ask and bid series. |
| Filtered CVD / separate axis | Filtered enabled / separate axis | Adds the filtered series on the shared or independent scale. |

## Deliberate boundary

DeepCharts' Cumulative Volume Delta also advertises an `Order` period mode. KwantDesk's shared indicator engine currently receives completed chart bars, so it cannot place a reset in the middle of a bar at the exact Nth execution. That choice is intentionally not exposed: a bar-boundary approximation would be a fake precision control. Exact order-count periods belong in the execution-tape aggregation layer before they are added to this settings panel.

The current filter operates on the verified aggregate volume carried by each chart bar. Exact per-execution size filtering likewise requires the complete execution tape for the requested historical window; it must not silently claim full-history equivalence when only a bounded live tape is present.

## Regression coverage

`npm run test:cvd-settings-parity` verifies:

- session reset versus continuous accumulation;
- Volumes versus Aggregate Trades;
- minimum and maximum filters;
- simple and exponential averages;
- candle plot, zero line, series name and value visibility contracts;
- deterministic period resets; and
- hard reset gaps on CVD, bid, ask and filtered series.

## 7 September 2026 data-path re-audit

- Production NQ one-minute flow was reconciled from the raw execution response
  to its compact candles: classified bars obey `delta = ask - bid`; no side
  identity mismatch was found.
- A real event-chart error was found after the bar builder. Range, volume,
  tick and Renko candles already contain exact per-bar flow from the complete
  ordered tape, but the workspace could overwrite it with a later bounded
  indicator tape. That changed which executions appeared to belong to a bar.
- Event bars now retain their baked flow. Only a bar with no verified flow can
  be repaired, and only by exact executions; aggregated `flowOnly` summaries
  are explicitly rejected for that repair.
- The historical route now preserves all eight fields of a flow-summary tuple.
  It no longer truncates the `flow` marker and then misreads the summary as one
  directional execution.
- A seven-calendar-day NQ sample contained 6,911 one-minute bars. Every
  classified bar satisfied the delta identity, but only 79.179% of historical
  contract volume had an aggressor side across that whole window. The current
  session was 99.752% classified. CVD deliberately excludes the unknown older
  volume rather than guessing its side; historical visual parity cannot be
  claimed for those incomplete sessions until exact tick-side backfill exists.

Focused regression: `tests/cvd-event-flow-authority.test.mjs`.
