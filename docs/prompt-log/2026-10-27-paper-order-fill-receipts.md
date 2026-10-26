# Order-panel fill confirmation — 27 October 2026

Request: Buy/Sell can say filled without a visible fill/position. No owner trade
was submitted to investigate or test.

Found concrete failure paths:
-Success wording used requested order type rather than ledger execution evidence.
-Quote resolution fell back to watchlist/static display values and stamped them
  with Date.now, falsely presenting cached prices as fresh executable quotes.
-Live placement used the quote's source timestamp as creation time; delayed
  executions after that timestamp but before the click could immediately trigger
  protection on a position that did not exist when they happened.
-The selected-instrument tape was already warmed outside Charts, but it did not
  publish a ticket quote until a position existed. Old success messages also
  survived ticket side/type/quantity/instrument changes.

Fix:
-Fresh execution selection validates both source and receipt timestamps, symbol,
  live provenance and coherent finite prices. No static/watchlist bypass.
-Live order placement is stamped at click time; replay retains its replay clock.
-Reuse existing live trade fan-out to price demo orders when a chart is closed.
  Only actual new executions qualify, never history seeds or flow summaries.
  With no BBO this is the actual last-trade simulation price, not an invented
  bid/ask spread. No additional feed subscription or polling.
-Receipt requires a matching filled order, entry execution and open position.
  It reports actual side/quantity/price/account. Pending limit/stop is “working”.
-Persist the committed ledger before displaying success; storage failure reports
  session-only recording. Account hydration must finish before order placement.
-Clear stale confirmation when ticket context changes.

Verification:39targeted tests pass, including actual TSX Buy/Sell submit handlers,
matching positions/executions/persistence, missing/stale/replay quote rejection,
history-summary exclusion, working limit status, failed persistence, and a
delayed pre-click stop touch followed by a genuine post-click stop touch.
Existing drag, execution-tape and durable-journal tests included. Scoped lint
and production build pass. Owner's real order/position state was not manipulated.
