# Kwanty chrome alignment — 7 November 2026

Replaced accumulated conflicting header grids/scrolling lanes with a single responsive command layout. Instrument, interval and chart type stay left; mode tabs stay central at desktop widths; Indicators, Replay, Add Chart, Workspaces and More use the normal Charts 28px control rhythm. Quick timeframe/favourite picks wrap in a separate lane, with no horizontal toolbar scrollbar. At compact widths controls occupy additional orderly rows.

Templates is now Workspaces: saved layouts, save, import and export in one themed dropdown. Original storage keys, exported JSON format, restore behavior and twelve-save limit preserved. Existing templates remain readable. Click-away and Escape dismiss the menu. Phone drawer groups no longer shrink over their contents; menus clamp inside the viewport and paint above the drawer.

All three modes share 40px pane headers, readable titles, consistent SVG reset/close/settings icons, rounded pane/control surfaces and drawing-rail spacing. Profile/orderflow axes use regular Aleph 11px and theme-muted ink, consistent with normal Charts. Candle geometry, profile calculations, overlays, provider subscriptions and replay clocks were not changed.

Validation: full isolated Next webpack production build including TypeScript passed. 19 workspace/candle/State-axis checks and 45 price-rendering/theme/State/replay checks passed. Actual headless Chromium tested 1920/1440/1280/1024/768 desktop widths and 390px phone, no header scroll overflow or overlapping drawer buttons, selectors remain wired, saved workspace flow works, outside-dismissal works, phone menu is inside viewport and above drawer, zero page errors. Synthetic local visual inspection covered Classic, State and Order Flow with the real React drawing rail. Screenshots here are explicitly fixture observations, not live data parity evidence.

No gateway/Supabase restart, account/order edits, production workspace changes, native changes or paid-service changes.
