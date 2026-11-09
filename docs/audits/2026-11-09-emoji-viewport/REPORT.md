# Emoji viewport stability

The drawings layer applies an imperative affine viewport transform during native gestures, then reconciles coordinates after 90ms. Entry/exit arrows already cancel that parent scale around their own anchors; emojis did not. Their glyph, selection target and resize handle temporarily stretched and snapped back at reconciliation.

Emojis now participate in that existing inverse scale. The chart time/price anchor continues to follow the viewport; saved pixel size remains constant, including during the gesture rather than only after React catches up. No animation or delayed transition was added. Saved drawings and manual resizing are unchanged.

Validation: isolated headless Chrome mounts the real ChartDrawLayer with mutable native projectors and subscription events, checking immediate geometry before the settle timer, React commits and settled geometry. Five pan/anisotropic zoom/return transformations pass with anchor and dimensions within 0.02px and no page errors. The identical harness against pre-fix HEAD fails at `before settle glyph width`. Five existing emoji size unit tests pass; scoped ESLint passes. Production webpack build and deployment verified separately in release receipt.

No owner tabs, accounts, orders, workspaces, provider subscriptions or gateway processes touched.
