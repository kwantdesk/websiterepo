# Temporary feed recovery — 2026-10-17

## Owner request

Restore the website temporarily while the closed Vultr account is investigated,
using the renewed providers and the last week of futures and options history.
Move the gateway back to a VPS after support responds.

## Diagnosis and recovery in progress

- The former VPS is unreachable; the website's configured feed origin is down.
- The existing local Rithmic credentials authenticate to both Ticker Plant and
  History Plant. NQ and ES resolve to December contracts.
- An isolated copy of the committed gateway runs under the owner's local
  application-data directory, excluding unrelated dirty native/social code.
- The existing Tailscale Funnel serves that gateway over HTTPS. The listener
  binds to loopback; market-data endpoints retain bearer authentication.
- Provider credentials stay in local backend process memory. Retired provider
  keys are deliberately excluded from the temporary launch environment.
- Five sessions of NQZ6 and ESZ6 minute history imported successfully: 6,900
  bars each, no malformed OHLC. The 53-root weekly import is running separately.
- The saved QuantData key returns HTTP 403 and the snapshot endpoint explicitly
  reports that an active API subscription is required. Both known local copies
  contain the same key. Renewed API activation/key verification remains required.
- Vercel's expired login was renewed. Production URL aliases and bearer values
  will be updated together; one scoped main push applies the environment change.

## Limits and handback

This computer must stay awake and online for the temporary gateway. Last week's
minute bars support minute-and-higher timeframes; they do not prove historical
tick/range/volume, footprint, CVD or full order-book coverage. Those sources must
remain unavailable until exact executions/VAP are restored. Weekend snapshots
must not be presented as new live market activity.

Before returning to the VPS, stop the temporary Rithmic owner, copy and verify
the new local recording archive, install credentials on the replacement backend,
then switch every website origin alias together and verify authenticated history
and live streams. Do not run competing Ticker Plant owners.
