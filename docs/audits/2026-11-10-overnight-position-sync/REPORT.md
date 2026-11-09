# Overnight position, device recovery and valuation repair

Owner report: an eight-hour overnight paper position was absent on phone Chrome, and displayed P&L changed incorrectly after a stop adjustment.

## Findings and changes

- A failed first account-preferences read could leave standalone pages outside account sync indefinitely. Recovery now retries with bounded backoff and reconnects on visibility/focus/network recovery, retaining saved account data.
- Workspace persistence now waits for preferences and paper-account hydration before saving a ledger. This prevents startup defaults from being published as an account update.
- Watchlist fallback quotes previously assigned wall-clock time to cached prices. They now retain actual source timestamps. Position valuation has a separate source-time watermark, so stale cached prices cannot rewind a newer mark.
- Ledger normalization recalculates unrealized P&L from instrument, side, entry, executable mark and remaining quantity. A newer stop/target edit retains the freshest valuation when accounts merge across devices. Execution-protection clocks remain independent, so display updates cannot suppress legitimate stop/target processing.
- Quote-only valuations intentionally do not trigger account uploads on every tick. A joining device now requests a valuation handoff; switching away persists the latest in-memory ledger and queues a bounded account exchange. Existing private account-row security and conflict handling remain in use.

## Verification

- 152 targeted paper-trading, preference-merge, account-device-sync, controller, startup-persistence and standalone-recovery tests passed.
- Regression coverage includes two-device position/valuation handoff without per-tick uploads; stale overnight marks; stop changes above breakeven; both merge directions; reload P&L normalization; retry and cleanup; and startup hydration guards.
- Ten failures in two older integration/source-pattern suites were reproduced against unchanged release HEAD: four harness ReferenceErrors for optionsChartTradingUnavailable and six obsolete source-pattern assertions. They are pre-existing, not claimed as passing.
- Scoped ESLint passed. Final production webpack build passed before the scoped main-only release.
- Read-only public checks observed signing keys responding (HTTP 200); no current signing-key timeout was reproduced. This does not establish private database or physical-phone health.

## Boundaries

No owner position, order, account row, workspace or history was edited. No market-data gateway, terminal, provider subscription or Supabase service was restarted. No browser control was used. These are source-backed fixes with simulated cross-device regression coverage; the owner's exact private position and a physical-phone round trip have not been independently verified. Existing deployments already open on devices must load the new application before executing the new recovery logic.

The Gex datatask remains paused. Its parity work and unrelated dirty changes are excluded from this release.

