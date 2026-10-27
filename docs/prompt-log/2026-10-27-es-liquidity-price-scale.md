# ES liquidity map instrument and price-scale correction

Owner reported ES right-axis zoom ineffective and instrument-specific scaling not matching NQ usability.

Reproduced: ES defaults to 45 rows. Controller reduced its requested range toward 24, while renderer silently imposed a separate 45-row floor. The very first inward ES scroll therefore did not change the rendered span; NQ reached the same dead zone after zooming from 112. Regression against actual renderer declarations failed before change.

Fix: shared price-scale limits (8 rows minimum, maximum derived from the instrument tick size and depth range) used by controller and renderer. Price rail wheel respects pixel/line/page deltas with reciprocal zoom factors, ignores horizontal-only scroll, and leaves time density untouched. ES and NQ remain genuine quarter-point ticks; GC remains 0.1, so minimum displayed price spans are instrument-specific.

Live audit also found ES tab labelled MESZ6, description Micro E-mini S&P 500. Instrument catalog normalised micro rows to parent keys, so later MES/MGC entries overwrote ES/GC contracts and descriptions after resolve. Catalog selection now admits canonical parent entries only and rejects contradictory root/contract rows; micro UI aliases may still deliberately request a parent book, never replace it with a micro. No provider overrides or VPS service changes.

Related display corrections: watchlist preserves ES/NQ .25/.75 prices (was one decimal); YM integer display; normal RTY/M2K chart minMove corrected from 0.25 to canonical 0.1. Other tick/data rules unchanged.

Validation: 43 focused tests pass, including actual controller/renderer repeated ES/NQ/GC zoom to limit and reverse, rail/time isolation, delta units, catalog ordering/cross-contract rejection, actual watchlist/normal-chart price-format functions, feed/freeze/motion/performance/bubble regressions. Public JS syntax checks and production build passed; workspace bridge ESLint checked. Live ES browser confirmation performed after deployment, without orders.
