# Awesome Oscillator overhaul

Seventh in the chart indicator checklist. AO is the difference between the fast and slow simple moving averages of each candle's high-low midpoint. The default periods remain 5 and 34. The lower histogram remains the default placement, and the on-chart setting uses a separate scale.

## Findings and changes

- The histogram used the sign of AO for colour. It now colours a bar by whether its value grew or fell against the previous valid value. The first available bar and ties use the growing colour. For example, a decline from +2.67 to +2 now uses the falling colour. An increase from −3 to −0.67 uses the growing colour.
- The single custom colour was replaced in the dialog by Growing and Falling. Existing custom single-colour presets migrate both colours to the saved value. Theme mode and the shared gradient schemes still apply.
- An invalid fast/slow pair previously displayed one slow value while the engine silently used another. Editing either period now adjusts the other when necessary, and the effective lengths are saved. Inputs retain their supported limits.
- AO used the generic indicator history and delayed sampler. It now consumes existing loaded candles and the existing live price-study pane events, with no extra network requests. This raises the history bound for the calculation from the generic 1,500-bar tail to the price-study limit of 20,000 loaded bars.

TradingView documents growing and falling colours and the 5/34 midpoint formula. DeepChart's installed description accessor for Awesome Oscillator was observed via static REA. Its method body contains only two no-ops, a null load and a return. That provides no verified proprietary calculation or rendering details. [TradingView AO reference](https://www.tradingview.com/support/solutions/43000501826-awesome-oscillator-ao/)

## Verification

- The 18 focused AO and live-pane tests passed. They check numeric values, colours on both sides of zero, existing preset migration, real warmup, forming-candle equality, replay causality and independent on-chart scaling.
- A deterministic matrix passed 2,860 supported symbol/interval combinations at three period pairs, including synthetic execution-chart inputs. The other 540 cells are unsupported under the chart's existing source rules.
- Isolated Chromium used 2,500 archived NQ one-minute candles and verified the actual histogram, period correction in both directions, separate custom colours, palette locking, visibility, replay, switching to the price chart, and template import restoring the pane. A controlled candle event changed the histogram geometry in 123 ms with the parent candle state fixed. The browser recorded zero page exceptions.
- Actual provider timing and archive completeness across all symbols and intervals remain unverified. The DeepChart desktop comparison remains deferred.
- The histogram axis now retains small fractional price-unit values and includes zero in its domain, including when every visible AO value has the same sign. The combined AO, live-pane and ATR/Standard Deviation regression run passed 89 tests.
