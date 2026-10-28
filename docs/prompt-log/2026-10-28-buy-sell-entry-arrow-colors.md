# Buy/sell execution arrow colours — 2026-10-28

Request: a buy execution arrow is red; buys must be green and sells red.

Cause: PaperFillMarkersRenderer explicitly painted every entry red, while exits already selected by execution side. Change the colour expression to use actual fill.side for all execution markers: buy#22e887, sell#ff3b5c. Preserve exact execution price/time, entry/exit arrow geometry, fills, positions, trade execution and themes.

Validation: existing six entry-marker tests pass. Actual canvas renderer test now covers buy/sell across entry, take-profit, stop-loss and manual-close roles, checking fill colour and all arrow coordinates. Clock/event anchoring, invalid/unfilled record exclusion and chart recreation coverage pass. Scoped lint/build/release results pending below. No user trades/settings changed; no gateway restart.

Six marker tests pass; full1536MiB-capped BelowNormal production build/TypeScript pass. Component lint0errors/133existing warnings with optional React Compiler analysis disabled for this invocation only, ordinary React/Next/hooks/exhaustive-deps retained; config unchanged. Release pending.
