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
- The listener binds to loopback; market-data endpoints retain bearer
  authentication. The existing Tailscale Funnel worked on the owner network
  but failed from production. A temporary Cloudflare HTTPS tunnel is now the
  production-origin candidate; verify production before declaring restoration.
- Provider credentials stay in local backend process memory. Retired provider
  keys are deliberately excluded from the temporary launch environment.
- Five sessions of NQZ6 and ESZ6 minute history imported successfully: 6,900
  bars each, no malformed OHLC. The 53-root import finished: 49 succeeded and
  authenticated HTTP history checks passed for all 49, with no invalid OHLC.
  QM, UB, 10Y and SR3 were rejected by the provider as reference data unavailable.
- The saved QuantData key returns HTTP 403 and the snapshot endpoint explicitly
  reports that an active API subscription is required. Both known local copies
  contain the same key. Renewed API activation/key verification remains required.
- Vercel's expired login was renewed. Production URL aliases and bearer values
  will be updated together; one scoped main push applies the environment change.

## Cost checks and owner key update

- The owner saved the renewed QuantData key in Vercel. Its sensitive value
  cannot be read back through Vercel's API, so a local backend copy is required.
  Rejected-key automatic polling is disabled on the temporary gateway.
- Verified project connections directly: `websiterepo-yfmi` is connected to
  `main`; the duplicate `websiterepo` has no Git connection.
- `test-volume-profile-cost-containment.mjs`: 8/8 passed. Shared conditional
  response checks passed before the broader historical deploy-cost script hit
  its previously documented stale Gamma Heatmap source-pattern assertion.
- A separate owner/manual redeploy of the previous SHA appeared alongside the
  Git deployment. It was not initiated by the recovery script. Avoid manual
  redeploys while the main Git build is already running.
- History import/folding, provider polling and raw streams remain on the local
  gateway. No direct provider fallback was enabled on Vercel. A Vercel spending
  cap has not yet been independently confirmed; do not promise a zero bill.

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
