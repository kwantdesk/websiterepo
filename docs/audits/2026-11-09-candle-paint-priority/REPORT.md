# Candle paint priority — 9 November 2026

## Finding
The selected chart's live execution flush synchronously submitted a volume-profile update on every animation frame before publishing its candle snapshot. Profile updates rebuild level/value-area/developing-series models and enter React. Busy selected panes therefore repeated histogram work at display cadence, competing with exact candle painting. Inactive panes already batched this work for three seconds.

The watchlist is also a different observable: quotePayload in the gateway publishes the executed price on trade packets, and bid/ask midpoint on book packets. LiveWatchlistNumbers formats that mid to two decimals for NQ. Thus an NQ display ending .63 can be a rounded midpoint such as .625; it is not evidence of an outright execution at that price. CME specifies 0.25-point increments for NQ outright futures. This repair does not substitute midpoint quotes or invented intermediate movement for real candles.

## Repair
- Keep the exact candle update on the existing next-display-frame path and shared worker's eight-millisecond publication queue.
- Move active profile checkpoints to a lossless 100 ms timer outside the candle animation-frame call; React receives these model changes as transitions. Inactive profile cadence remains three seconds.
- Preserve every queued execution and the final quiet-market batch. Preserve minute-boundary checkpoints for developing POC/value area/VWAP, including arrival order across delayed records.
- Accelerate a pending inactive checkpoint on foreground resume, cancel its timers on pane disposal, and keep prices, paper protection, CVD/footprint execution fan-out outside this profile scheduler.
- No gateway or provider subscription restart, owner browser interaction, order/account/workspace changes, additional paid feeds, price interpolation or change to stored OHLC.

## Verification
35 focused tests pass: independent candle frame delivery, lossless histogram batching, quiet trailing delivery, foreground resume, cleanup, minute checkpoints, real profile calculation equivalence, lease renewal and exact paper-order protection. Scoped scheduler lint passes. Full isolated Next.js webpack production build passed, including TypeScript and route generation.

A controlled actual-profile-model benchmark used 120 simulated frame batches, 2,400 records and 4,000 price levels. The scheduler reduced model rebuilds to 18; measured model time was 54.67 ms versus 9.16 ms. Totals and level arrays matched exactly. Repeated floating-point variance reconstruction differs by about 1e-9 in standard deviation (test tolerance 1e-7, far below one tick). This is an isolated workload measurement, not a measured production feed latency, FPS or 83% platform-wide improvement.

Broader historical-candle regression suite: 16 pass, two existing source-pattern assertions fail. Running the same tests against unchanged HEAD workspace source reproduces both failures; baseline evidence is attached. Those assertions assume obsolete quote-branch syntax/structure and are not introduced by this repair. They have not been rewritten to conceal failures.

## Remaining limits
Network delivery, source trade activity, other expensive studies and device load still affect visible cadence. No owner-session performance capture was taken and peak-session smoothness remains unverified. This reduces a confirmed competing workload; it does not prove all previously reported freezes fixed. The owner receives updated frontend code on the next normal reload. Production deployment is verified separately against its commit SHA.

Reference: https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.quotes.html
