# Indicators must be reliable at login

## Request

Owner rejects missing indicators after login and asks for the underlying problem
to be fixed, following daily/weekly profile display recovery.

## Findings and changes

- Initial missing-session replay failed before TLS. Three DNS-address probes
  showed two connection resets and one certificate-verified connection for the
  same configured provider hostname. Existing clients stopped at one address.
- Added shared pre-authentication DNS-address failover to discovery/live and
  History Plant clients. Up to eight candidates within the original total
  deadline, each capped at three seconds; no certificate bypass, pinned IP,
  changed provider hostname, duplicate live owner or authentication retries.
- Incomplete imports cached empty hour responses and skipped them on later
  attempts. Empty checkpoints now refetch; nonempty ones remain resumable. No
  incomplete session is published and the cumulative transfer budget remains.
- Copied only four scoped backend modules to the temporary runtime. Graceful
  shutdown completed before starting its single replacement owner (PID16124).
  No site code, saved indicators or chart configuration changed.

## Verification and blocker

- Gateway suite: 393 tests passed; scoped lint passed before the final small
  timeout classification adjustment, which is covered by the full suite.
- Restored provider connection: local backend health connected/authenticated.
- NQ daily: HTTP200, NQZ6, complete true, 3826 levels, no missing session dates.
- NQ weekly: HTTP200, NQZ6, complete false, missing session-start 2026-10-11.
- NQ Oct11 import logged in and received zero trades for all 24 hourly windows;
  refused publication. ES Oct12 recovered existing checkpoints but subsequent
  hours and full-session minute validation returned empty; refused publication.
- Separate NQZ6 minute and volume-profile-minute probes for 14:00–14:59 UTC on
  Oct12 and Oct16 each returned zero rows, even though Oct16 is already present
  in the verified local archive. Empty results are therefore not evidence of
  an actual no-trade session. Root cause of provider history availability is
  unconfirmed; do not assert maintenance or entitlement failure without evidence.
- Remaining history recovery requires provider responses to become available
  or an authorized equivalent exact historical source. Do not fill missing
  sessions with OHLC-derived volume-at-price or silently shorten the week.

Standing launch-capacity notes from the preceding owner request are preserved
in CLAUDE.md and IMPORTANT-NOTES.md. VPS migration and authenticated browser/
market-open soak remain open. No paid infrastructure or provider was purchased.
