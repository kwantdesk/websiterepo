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

- Added a pane-scoped live quote event carrying the genuine accepted Rithmic
  bid and ask.
- Added BID and ASK axis markers that update through a direct animation-frame
  path, independently of React state and candle reconciliation.
- Candle OHLC remains execution-only. Quote movement cannot create a false
  candle close, body, high, low or wick.
- Added routing assertions that require the quote event, its chart listener,
  and honest BID/ASK labels.

## Verification

- Live routing regression passed.
- TypeScript passed.
- Full production build passed before deployment.
