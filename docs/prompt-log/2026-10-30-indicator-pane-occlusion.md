# Indicator panes must cover price-chart content

Owner screenshot shows a volume profile and session level painted over lower CVD/volume panes, with faint price candles visible behind them.

The dock **root** formed a z-index 9 stacking context, below price drawings (24), overlays and trade labels (31/32). Raising only a child surface cannot escape that parent context. Pane SVG backgrounds were also 97% opaque, leaving native price-chart pixels visible underneath.

Changed the root to layer 40, retained internal surface/menu ordering, and made horizontal/side SVG background rectangles fully opaque. Pane colors still come from the chart theme. Existing per-pane interaction surfaces now sit above the underlying drawing layer. Restricted `ChartDrawLayer`'s drawing-placement rectangle to its existing price-pane bounds, excluding top/bottom indicators and the price axis; drawings themselves already used that stationary clip.

Verification: 21 existing pane viewport/docking/CVD-scale/drawing-clipboard tests pass, scoped lint passes, and full production build passes. An isolated headless Chrome fixture renders the actual indicator component and drawing placement rectangle with compiled production CSS. Both dark/light fixtures reproduce the old fault: magenta drawings cover both panes, native green pixels bleed through, and drawing capture intercepts pane clicks. Afterward all eight sampled pixels equal the theme background exactly, all four pane hit targets belong to CVD/Volume, and drawing capture ends at the real price-pane boundary. Local evidence: `tmp/indicator-pane-occlusion-browser.json` and `tmp/indicator-panes-{dark,light}-{before,after}.png`. This is deterministic fixture evidence, not an observed owner-browser screenshot.

No indicator calculations, data feeds, recordings, subscriptions, trade/account state or VPS changes. Verify main-only deployment and production release SHA before reporting live.
