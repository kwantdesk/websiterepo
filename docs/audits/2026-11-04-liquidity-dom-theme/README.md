# Liquidity map DOM/price theme — 4 November 2026

The map preset controlled the heat-raster surface, while the canvas price/DOM rail used the independent website panel colour. Selecting a white map under a dark website theme (or the reverse) therefore left a mismatched ladder.

The DOM and price/time axes now derive their background from the selected map preset's first palette colour. Auto remains linked to website chrome. Text, grid and buy/sell accents are checked against the actual map/DOM surface, retaining website candle-side hues while adjusting contrast when necessary. The secondary DOM inspector receives the same background, price text and side colours when the preset or website theme changes. No order-book processing, data subscriptions, scales, geometry, liquidity intensity, clustering or trading code is changed. The unrelated dirty depth-engine.js is deliberately excluded.

Validation:
- Six theme/colour tests pass, including all website themes crossed with every selectable dark/white preset, readable side and price text, and consecutive preset/theme switches.
- Eight actual canvas renders in isolated headless Chrome (dark/light website settings and four map presets): sampled DOM pixels equal the selected palette surface; switching requires no reload. Zero page errors. External network blocked; synthetic local market fixture only. Screenshots included.
- Broader existing suite: 43/58 pass. The same 15 source-contract assertions fail against committed baseline and the changed source, with identical failure names; these are existing unrelated contract drift, not introduced by the colour patch.
- JavaScript syntax checks and full production build checked before main-only deployment. The exact live release and all four changed public asset hashes are verified after push.

Reproduce: scripts/audits/liquidity-dom-theme-browser.cjs. The browser serves committed assets except the changed renderer/palette modules, preventing unrelated local data-engine changes from contaminating the colour check.
