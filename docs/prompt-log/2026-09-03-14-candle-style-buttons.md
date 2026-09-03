# Prompt

these candle settings buttons aint workling, sort it out please:

# Answer

Traced the candle-style buttons through the per-pane settings store and Lightweight Charts renderer. The selection was saved and highlighted, but leaving Heikin Ashi did not fully replace the synthetic historical series. The renderer updated only the newest real candle, making the chart remain visually stuck despite the selected button. Every explicit candle-style change now forces one complete visible-series rebuild from the correct source bars.

# Outcome

The complete four-button catalogue is wired to the same style key consumed by the renderer, and every style transition now performs an immediate full-series replacement. Candle style tests passed 11/11, candle context-menu tests 6/6, candle visibility tests 5/5, focused test lint and TypeScript passed, and the complete 80-page production build passed. Production commit and deployment are recorded below after the active `websiterepo-yfmi` deployment completes.
