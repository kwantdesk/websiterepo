# Options-underlying chart history

## Prompt

Provide live and historical chart bars for every options ticker such as QQQ
and META, determine whether January-2025 QuantData history is available, cover
VIX/VXN where possible, and preserve any provider gaps in a running important
notes ledger.

## Provider verification

- Production-side direct probes returned 200 with real 2025-01-03 one-minute
  bars for all 13 physical targets: SPX 1,015; SPY, QQQ, NDX and IWM 405
  each; AAPL, NVDA, MSFT, AMZN, META and AMD 390 each; TSLA 391; and VIX 424.
- VXN returned 200 with zero rows. The separate Massive index service is not
  configured in production, so VXN is explicitly unavailable rather than
  substituted or simulated.
- This verifies underlying OHLC history only. It does not prove January-2025
  option-contract chains, Greeks, open interest or option trade tape.

## Engineering outcome

- Expanded permanent QuantData session capture from five underlyings to every
  physical ticker behind the 13 offered options symbols, with SPXW correctly
  sharing SPX, plus VIX.
- Added VIX to the live shared QuantData index poller and chart-history adapter.
- Added a checkpointed January-2025 bulk backfill service. It is low-resource,
  sequential, spaced to stay below the vendor allowance, and refuses to issue
  historical calls while the US cash market is open.
- The ordinary post-close archiver now also refuses to run during live market
  hours and yields whenever the bulk backfill owns the provider lane.
- Historical serving reads all locally archived sessions in the requested
  range before making a provider call. Missing-session provider fallback is
  capped at ten sessions, while the accepted request window is two years.
- Added an exact catalogue coverage regression and created
  `docs/IMPORTANT-NOTES.md` for the unresolved VXN, full historical options,
  futures completion, event-history and off-site-backup requirements.
