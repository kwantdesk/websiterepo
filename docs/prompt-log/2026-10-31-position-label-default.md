# Position calculator labels enabled by default

Owner requests Show labels automatically checked when placing a Long Position or Short Position drawing. Set their shared drawing-style default to true and update the old contrary comment. The existing settings checkbox and renderer already read this field. New drawings across consumers of createDrawing receive the default; explicitly saved false values still survive normalization.

Verified both creation defaults and saved false normalization directly, plus 26 existing drawing-system/persistence checks and scoped lint. Full build and main-only production/live-SHA verification are the release gate. No old drawings, prices, accounts, trades, feeds or VPS settings modified.
