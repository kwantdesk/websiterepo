# Momentum indicator placement

## Research conclusion

The current Momentum category contains 14 oscillators/cumulative-flow studies, not price-level overlays. None needs an automatic conversion onto the candle price scale. Their conventional separate-pane defaults are appropriate. Price-unit studies such as moving averages, channels and Parabolic SAR are already in the Trend category and are outside this change.

[TradingView's plot documentation](https://www.tradingview.com/pine-script-docs/visuals/plots/) explicitly uses RSI to explain why a bounded oscillator is ordinarily separate from instrument prices. [Its pane-placement FAQ](https://www.tradingview.com/pine-script-docs/faq/visuals/) describes moving studies between panes. [DeepCharts' chart-area guide](https://www.deepcharts.com/helpcenter/article/how-to-change-the-layout-of-indicators) illustrates separate ADX/MACD panels and configurable chart areas. The references support flexible placement, not converting oscillator values into traded prices.

The useful distinction is between reading momentum alongside price (crossovers, directional changes, strength, extreme readings or divergence) and treating the oscillator's numeric value as a price level. This implementation preserves the former without inventing the latter. It adds no new trading signals or claims of a trading edge.

| Study | What its values represent / typical reading | Default | Reference |
| --- | --- | --- | --- |
| RSI | Relative strength, bounded 0–100; extreme readings | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/relative-strength-index) |
| ROC | Percentage price change over its lookback | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/rate-of-change) |
| MACD | EMA difference, signal and histogram around zero | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/macd-indicator) |
| Momentum | Change in price over a lookback, not an absolute price | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/momentum-indicator) |
| CCI | Mean-relative oscillator; extreme readings | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/commodity-channel-index) |
| KST | Smoothed multi-horizon ROC plus signal; crossovers/divergence | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/know-sure-thing) |
| Inverse Cyber Cycle | Two zero-centered cycle lines | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/inverse-cyber-cycle) |
| Aroon Up/Down | Recency of highs/lows on a percentage scale | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/aroon-up-down) |
| Aroon Oscillator | Difference between Aroon's two components | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/aroon-oscillator) |
| Awesome Oscillator | Difference of smoothed median prices around zero | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/awesome-oscillator) |
| Stochastic | Close position within a lookback range, bounded percentage | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/stochastic-oscillator) |
| Williams %R | Range-position oscillator, −100 to 0 | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/william-r) |
| Chaikin A/D | Cumulative price/volume buying-selling pressure | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/chaikin-accumulation-distribution) |
| ADX | Trend strength, with directional components where enabled | Bottom pane | [DeepCharts](https://www.deepcharts.com/helpcenter/article/average-directional-index) |

## Shipped behaviour

Every momentum study has General → Chart area → Bottom indicator / On candle chart. The choice previews through the existing settings mechanism and is saved/restored through shared workspace normalization. Defaults and invalid legacy choices resolve to the conventional pane. Choosing the candle chart removes its lower pane, including dedicated KST/Inverse Cyber/ADX pane paths.

On-chart oscillator plots use a private native scale per indicator instance. Related plots such as MACD's lines/histogram share that scale; an explicitly independent secondary cycle keeps its own. Their values/timestamps/colours/inputs are unchanged. Their scale is independent of candle price autoscaling and its margins stay inside the actual price plot above docked panels. Native scale updates occur only when scale membership or layout changes, rather than per live sample. Returning to Bottom indicator restores the original pane calculation/layout behaviour.

No provider, gateway, account, order, drawing, recording or live subscription changes. No owner tabs were used or refreshed.

## Validation

- 99 tests pass: all 14 momentum studies in both modes, identical underlying numeric series, persistence and return-to-pane, disabled indicators, separate instance scales, invalid settings, replay cutoff and event-bar alignment; existing ATR/deviation and Volume/CVD regressions also pass.
- Isolated headless Chrome mounted the actual Chart and indicator-settings components: all 14 studies rendered on-chart without a duplicate lower pane and without moving the candle price coordinates, then returned to a functioning lower pane. The actual ADX chart-area button and Save action persisted correctly. Zero browser page errors; external/API requests were blocked.
- Scoped library/control lint passes. No standalone giant Chart lint was run.
- Full isolated production build (`next build --webpack`), TypeScript and route generation pass.
- Local evidence: tmp/momentum-placement-tests.log, tmp/momentum-placement-browser.json and tmp/momentum-placement-browser.log. These are deterministic local UI/calculation checks, not live provider parity certification.
