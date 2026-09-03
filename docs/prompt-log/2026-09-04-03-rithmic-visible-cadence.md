# Rithmic visible quote cadence

Date: 2026-09-04

## Prompt

> what with teh rithmic feed lagging and not ticking like it used to do, its fucking slow as shiut and takes ages to u[pdatyed, what did youd o? chart also keep randomyl refre4shing???

> mate its still sus as fuck mate, its not moving like it used to mate its updated every 2 seconds for fucks sake

> you have to sort this out im trying to trade man

## Diagnosis

- The earlier continuity fix did not throttle Rithmic.
- A simultaneous live NQ/ES trace showed book packets reaching the browser as
  close as 20–50 ms apart and roughly 300 ms after their provider timestamps.
- The visible candle path deliberately rejected non-trade book packets to
  protect OHLC integrity. During the sample, true executions arrived in
  multi-second clusters while valid BBO packets continued between them. The
  chart therefore looked frozen even though the Rithmic book was live.
- Gateway storage is separately critical at 97.7% used with about 1.8 GB free.
  This was not altered or deleted as part of the display repair.

## Fix and outcome

- Correction after live trader verification: the BID and ASK axis markers were
  not requested and did not solve the candle regression. They have been removed
  completely from ordinary charts. Liquidity Map retains its own book display.
- The actual regression was an execution-only filter added to the ordinary
  time-candle display. Rithmic price packets continued arriving, but the chart
  discarded them until a packet was tagged as a trade. The filter is removed,
  restoring the prior quote-responsive forming candle on every animation frame.
- Volume, delta and trade-count fields still advance only from execution-tagged
  packets. The authoritative history reconciliation remains in place.
- Active Footprint tape-to-canvas batching is reduced from 125 ms to 40 ms,
  matching the execution worker cadence; inactive panes remain throttled.
- Routing assertions now prohibit the execution-only time-chart filter, require
  the smooth accepted-packet path, and lock the Footprint foreground cadence.

## Verification

- Live routing regression passed with the execution-only filter prohibition and
  40 ms Footprint cadence contract.
- Rithmic's 53-instrument x 50-interval matrix passed (2,650 combinations).
- Candle gaps 7/7, candle gap fill 5/5, event source 10/10, event first paint
  7/7, Footprint bar window 6/6, execution-worker backpressure and the live
  chart memory guard all passed.
- TypeScript and the complete 80-page production build passed.
