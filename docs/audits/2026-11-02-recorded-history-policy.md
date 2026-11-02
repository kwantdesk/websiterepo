# Recorded live data is the chart-history source

Owner clarification, 2 November 2026. Supersedes the provider-priority history design and provider comparison in the earlier instrument audit.

## Data path

Licensed live feed → VPS raw recordings and compact execution tape → owned minute/flow/profile aggregates → website and replay. Rithmic remains the live vendor; its History Plant downloads are not our historical source. Cash/index history comes from the live quotes and live candle observations actually captured in our saved responses; quote feeds do not supply traded volume, so these bars report volume zero.

All 53 futures roots retain persistent recording subscriptions, independent of browser tabs. Raw live messages, compact trades and own minute candles continue recording. Existing options response/snapshot recording remains in place. This correction does not claim a new parity audit of options data.

## Changes applied

- Disable both provider-history maintenance timers and block their import command entry points. History readers exclude provider minute bars and execution sidecars. Preserve 1,602 labelled provider imports separately under the recordings provider-history-imports directory, with a hash manifest; no source files were deleted.
- Recover missing closed-session aggregates only from owned compact tapes/raw messages and saved live quote responses. Preserve existing owned candles. Active sessions remain exclusively with the live writer. Stale closing quotes and historical portions of downloaded response payloads cannot invent live observations.
- Persist cash observations under recorded-cash, separate from legacy imported cash sessions. No external historical vendor fallback serves chart candles.
- Reuse worker-folded owned trade profiles instead of scanning large raw L3 files on HTTP requests.
- Replace the two import jobs with daily recorded-history maintenance at 04:20 UTC: Docker network none, 0.35 CPU, 256 MiB memory, no provider credentials, serialized runs, closed sessions only, nine-day recovery window, bounded read budget and unchanged-tape checkpoints. Current service result: success / exit 0.
- Advance time/event/execution browser-cache versions to reject previously imported candles and prints. Accounts, settings, workspaces and drawings are untouched.

## Production evidence

Machine-readable evidence: [recorded-history-policy.json](2026-11-02-recorded-history-policy.json). After the gateway reconnect: authenticated and connected, 53 subscriptions, no reported recorder drops or component errors. All 53 futures history endpoints returned HTTP 200, source VPS recorded live trades, recordedOnly true. The checked 25–30 October UTC range contains 82,423 owned recorded minutes across those instruments. This total is not a claim of uninterrupted week-long coverage for each symbol.

At verification, 48 products were printing trades; all 48 had corresponding on-disk minute files labelled VPS recorded live trades. Two additional current-session legacy owned files had no new prints. NQ prior-session value area returned a recorded-only profile (POC 28,795; captured volume 754,744). SPY returned 2,598 captured quote-derived minutes for 26–30 October.

Network-isolated maintenance scanned 321,762,268 bytes and 77,169 saved cash responses. Its final pass found 120 existing owned futures files and 577 raw inputs without recorded executions; it did not invent bars for metadata-only files. Original recovery receipts and import-separation manifests are retained in /opt/kwantdesk/audits/recorded-history-policy-20261102.

Validation: 114 backend tests, four frontend cache/price-format tests, 18 focused recorded-policy/profile tests, scoped frontend lint and full Next production build passed.

## Limits and operating rules

A subscription cannot supply trades when the instrument is not trading. Existing unrecorded intervals cannot be recreated from our own archives; do not fill them with synthetic bars, snapshots presented as executions, or provider historical imports. Captured cash quotes are observations, not a complete exchange execution stream. Storage remains on the VPS and needs capacity monitoring as recordings grow. Recovery builds missing aggregates; it does not change historical values already owned.

Deployment uses the existing gateway image with preserved runtime overrides, plus new trade-tape, recorded-cash and recovery-script mounts in /opt/kwantdesk/compose.yml. The provider timers remain disabled. The network-isolated replacement is kwantdesk-recorded-history-maintenance.service/.timer. Restart only the gateway to load changed modules; preserve all unrelated compose settings, account state and recordings.
