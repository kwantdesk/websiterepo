# Weekly Volume Profile waiting — 2026-10-17

## Request and diagnosis

Weekly profiles take too long to load, if they appear at all.

Direct five-session backend probes returned NQ in 3.18 seconds cold and ES in
0.34 seconds, both `complete:false`. NQ starts one session late, ES two.
The browser correctly rejects incomplete calculations but did not explain
that on the chart. It looked like perpetual loading. History Plant recovery
was retried once after reconnect; TLS establishment still failed. Existing
seven completed sessions and all import checkpoints remain untouched.

## Changes

- Explicitly list missing CME session-start dates (Sunday–Thursday) in profile
  coverage; require every interior session before reporting complete. Weekend
  dates and the exclusive range endpoint do not become false missing sessions.
- Put a 15-second deadline on browser profile reads. Keep the existing
  coalescing and bounded retry backoff; add no provider or per-tick polling.
- Retain a safe failure reason in the bounded response-failure cache and show
  weekly errors in the owning chart. Successful recovery clears it. Removed
  indicators/changed contracts cannot retain another chart's error.
- Preserve last-good profiles during recalculation; never shrink the five-day
  calculation or fabricate the missing session's traded volume.

## Validation / remaining

- All 388 gateway tests pass, including missing interior sessions and weekend
  boundaries. Five frontend source-wiring/continuity tests pass; scoped lint
  passes. Isolated production build and deployment are checked in this turn.
- Full weekly profiles remain blocked on the missing licensed execution
  sessions. The accurate data has not been recovered by this UI/error fix.
- Signed-in browser validation, the memory soak, wider execution recovery and
  the VPS migration remain in `docs/IMPORTANT-NOTES.md`.
