# Quiet KWANTY notices — 2026-10-20

Owner requested removal of checking-provider messages and the actual-snapshots /
no-full-session-history chart banner. Hide the three diagnostic elements at
initial markup, remove status roles and add a defensive display:none rule.
Their real internal diagnostic text/state still updates, but never announces.

Automatic load/init provider failures no longer open toasts; sourceError and
60s retry versus30s normal schedule remain. Empty charts show Data unavailable.
User-triggered history failures report a concise failed-action message, not
technical vendor/entitlement text. Unsupported profile-marker drags remain
blocked without the invented-history toast. Real source timestamps and replay
controls remain. No fabricated candles, altered calculations or new requests.

App/style URL version2. All 11 quiet-notice, integration and loader tests pass;
node syntax check passes. Failure simulation retains the actual source error
and60s backoff without opening a toast. Hidden notices stay hidden across auth,
failure, one-snapshot and historical updates. Full build/typecheck passes,84
pages. Release receipt pending.
