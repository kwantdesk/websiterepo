# Prompt 28 — Futures and options contract rollovers

## Requested

Make the platform aware of futures and options rollovers, automatically replace
labels such as `MESU6` when the active contract changes, and make sure rollover
does not break live bars, historical candles, caches or recording.

## Fixed

- Removed the browser's calendar-derived contract guess. Contract selection is
  now based on Rithmic's front-month response rather than assuming a contract
  remains active for its whole delivery month.
- Changed the gateway to ask Rithmic before accepting a locally live contract,
  shortened the shared answer from six hours to ten minutes and coalesced
  concurrent requests so 100 users do not create 100 provider calls.
- Continuous quote streams now resolve the provider contract on every SSE
  lease. Charts reconcile immediately, every ten minutes, after reconnect and
  when returning to the tab. A detected change rotates the shared stream and
  reloads data keyed to the concrete contract without restarting the service.
- Kept mini and micro roots separate, and preserved explicit old-contract
  selection for replay/diagnostics.
- Made local continuous history cross the exact-contract boundary. Rithmic
  History Plant root bars remain canonical, and overlapping locally recorded
  contracts select the highest-volume minute without double counting.
- Audited options expiry behavior: QuantData surfaces use provider-listed
  expiration dates, reject expired front dates against the New York session
  date, and partition caches by that session date. Options are not assigned a
  fabricated CME-style rollover code.

## Outcome

The new regressions prove that an already-live expiring contract cannot outrank
Rithmic's new front-month response, simultaneous clients coalesce into one
request, and history spanning `NQU6`/`NQZ6` retains both sides while choosing
one liquid contract during overlap. The complete 324-test gateway suite and
TypeScript compilation pass. Production deployment details are appended after
the single feature push reaches the active `websiterepo-yfmi` project.
