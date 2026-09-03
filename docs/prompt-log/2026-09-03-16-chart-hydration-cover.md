# Prompt

just loaded the es chart and it just has a load of dots for a few seconds then loaded in bars, hard rule for charts, if we arent realy to load in just have aloading screen so its cleas, this shoul dhappenm on all instru,menbts and all timeframes

# Answer

Replaced the shared chart pane's “any cached candles are ready” behavior with an exact-request hydration contract. A chart now stays behind its themed loading screen until the requested broker, instrument, timeframe, period and replay window has either verified fresh/deep cache data or completed authoritative history. Instrument and interval changes synchronously cover the previous series before React effects run, so stale bars or one-price forming dots cannot flash during a switch. A failed load settles to the provider's honest error rather than exposing partial candles or spinning forever.

# Outcome

The exact-request loading transition passed 6/6; chart-history failure/retry behavior passed 4/4; event-bar first paint passed 7/7; candle-gap integrity passed 7/7; page-loader coverage passed 5/5; and the Rithmic matrix passed all 2,650 combinations across 53 instruments and 50 time/event intervals. Focused ESLint, TypeScript and the complete 80-page production build passed. Production commit and deployment are recorded below after the active `websiterepo-yfmi` deployment completes.
