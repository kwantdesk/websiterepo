# Standard footprint preset

New selectable Standard preset: a normal OHLC candle at its timestamp, a gap, and a text-only Bid × Ask ladder to its right. Each pair has its own time-scale slot with a gap before the next candle. Extra volume/delta wings, summary, POC/imbalance markers and active-bar outline are off in this preset. Other presets retain the existing overlay layout.

The candle and ladder share the actual FootprintRenderBar. Existing live OHLC updates therefore move the candle without manufacturing execution-cell values. Candle colours use the chart’s resolved native body/border/wick colours, while footprint cells retain their own palette settings. Added a Candle layout setting in Cells and persisted the side-by-side option without changing storage keys.

Verification: 17 focused preset, geometry, settings, data, live-batch and zoom tests pass. Geometry checks span 8–180 pixel slots. Isolated headless Chrome paints the actual FootprintPrimitive and preset using a deterministic offline execution fixture: five candles and 90 Bid/Ask values in dark and light views; live OHLC changes candle geometry while preserving all printed execution values. Screenshots and browser-checks.json are included. These are fixture evidence, not licensed live-session captures or a Deep Charts parity claim.

Scoped lint passed for changed library/settings files and ChartIndicatorsControl. The full isolated production build passed TypeScript and 87 generated pages. Existing Chart.tsx lint remains limited by its known large-file heap issue; no higher-memory lint run attempted. No backend, feed, terminal, orders, accounts or owner trading tabs changed.
