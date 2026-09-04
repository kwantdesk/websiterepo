# GEX VUE indicator compatibility audit

GEX VUE charts are charts of an **options underlying** (SPX, NDX, SPY, QQQ and supported equities), not charts of one option contract. Every catalog entry is evaluated against the active pane before Add is enabled. The library keeps unavailable studies visible and explains the missing data instead of silently drawing a substitute.

## Native on SPX / NDX / SPY / QQQ

- All implemented candle-only trend, momentum, volatility, market-structure and overlay studies use that pane's own five-day OHLC history.
- Options Flow studies use the active symbol's QuantData options family and its own price conversion. SPX stays SPX; NDX stays NDX.
- TPO Daily, TPO Weekly, Market Profile and TPO Levels use the active symbol's own candles because time-at-price does not require executions.
- SPY, QQQ and supported single-stock volume, VWAP and volume-profile calculations use their own OHLCV bars. They are no longer silently substituted with ES/NQ volume.

## Explicitly adapted on cash indices

- Daily, Weekly, Composite and Draw-On Volume Profile remain available on SPX/NDX because those indices are not directly traded and have no native execution volume. They use the related ES/NQ execution distribution projected to the cash price scale, and the library labels this **Hedge-futures profile**. This is the only honest volume-profile implementation without a licensed consolidated index execution tape.

## Visible but unavailable on cash-index / equity-underlying panes

- Footprint, CVD, Delta, Imbalance, DOM, Pulling/Stacking, Big Contracts, Speed of Tape, absorption, iceberg, sweep, auction and other aggressor/MBO studies require per-trade executions or Level 3 for the active instrument. QuantData option-chain events are not substituted for that tape.
- Native VWAP/Volume/Accumulation-Distribution are unavailable on SPX/NDX because a cash index has no executed volume. Use TPO or the labelled hedge-futures profile. They remain native on SPY/QQQ/equities.
- Dark Pool studies are available for traded equities such as SPY/QQQ/META, but unavailable for non-traded SPX/NDX indices.
- Catalog entries still marked In development remain Pending on every instrument until their renderer is completed.

## History contract

- Standard GEX VUE panes request `5D` by default.
- The history request always carries the active symbol, timeframe, from and to range to `/api/market-indices`; it does not request ES/NQ candles for an SPX/NDX chart.
- Profiles on SPY/QQQ now take their own bar volume. Only SPX/NDX profile volume uses the explicitly labelled hedge-futures projection described above.

The executable audit is `scripts/test-gex-vue-indicator-compatibility.mjs`. It resolves every catalog entry for SPX, NDX, SPY, QQQ, META and ES so newly-added indicators cannot bypass the matrix.
