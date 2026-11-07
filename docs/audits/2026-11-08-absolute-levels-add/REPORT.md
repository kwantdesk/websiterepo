# Absolute Levels Add behaviour

The library did create an enabled study, but both manual prices defaulted to zero (off-screen on NQ), then a special Add branch immediately closed the library and opened settings. This made Add look broken.

Removed that special settings redirect. Fresh manual levels seed once from the selected chart's observed candle close and high (or low when close equals high). The synchronous chart-instance-scoped reference event reads the existing imperative candle; it opens no feed/API connection and does not reprice the saved levels on later ticks. Backtesting and Kwanty's separate chart bridge supply their already revealed candle explicitly. Missing/invalid data is not replaced by a guessed price.

Existing saved references, including deliberate zero/negative prices, are unchanged. An existing zero-default instance can be removed/re-added to obtain the fresh initial prices, or edited normally.

The isolated full production build (`next build --webpack`), TypeScript and route generation pass.

Validation: 6 Absolute Levels tests pass, covering manual values, zero/negative and invalid inputs, theme/style persistence, actual overlay options, large histories and one-time initialisation. Isolated headless Chrome with the actual library and two mounted NQ/ES Charts passed Add, no forced settings, matching chart selection, Remove and re-add, with zero page errors and external/API requests blocked. Scoped controller/helper/Kwanty lint passes. Local evidence: tmp/absolute-levels-add-tests.log and tmp/absolute-levels-add-browser.json. No owner tabs, accounts, orders, gateway or recordings were changed.
