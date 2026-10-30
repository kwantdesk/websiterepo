# Remove bars from liquidity-map CVD

Owner request: remove bars from liquidity-map CVD.

Removed the Bars menu option and the CVD bar-rendering branch. The style normalizer now returns line for every saved value, so older Bars/Candles preferences cannot restore those styles. The header label remains CVD line. Split buyer/seller lines, exact historical points, live-tip easing, compact/include-zero/symmetric scaling and time alignment remain intact. Updated the iframe, entry script, renderer and presentation-module cache revisions to `20261030-cvd-line-only`.

Nine focused CVD/presentation/bubble checks pass, including actual canvas rendering with legacy bar settings, no bar fill calls, retained live-tip alignment/animation, preserved split lines and source totals. Public JS syntax checks and host-component lint pass. Verify the full production build, main-only deployment, actual release SHA and all four changed public asset hashes before reporting live. No liquidity heatmap/DOM/bubble behavior, data feed, recording, trade or VPS changes.
