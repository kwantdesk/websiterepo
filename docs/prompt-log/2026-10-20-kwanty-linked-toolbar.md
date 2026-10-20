# KWANTY linked toolbar — 2026-10-20

Request: with Orderflow panels linked, changing three-minute timeframe or
line/candles should change every linked panel, not just the selected panel.

Use shared chartControlTargets for both toolbar handlers: active viewport-linked
panel targets all viewport-linked peers; unlinked active panel targets itself.
Classic/State retain package settings. Crosshair-only panels stay independent.
Quick timeframe buttons and interval dropdown share the same handler. Existing
reset/pan/zoom already follow viewport links; page-wide actions stay page-wide.
Per-panel metrics/expiry/thresholds are not overwritten with another tool's
settings. No extra source requests/subscriptions; local price aggregation stays.

Regression executes actual handlers for linked/unlinked/reverse-source changes,
unlinking, persisted values and Classic/State fallbacks. Release and visual
verification recorded locally after deployment.
