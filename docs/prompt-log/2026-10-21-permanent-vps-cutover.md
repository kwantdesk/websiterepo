# Permanent VPS cutover — 21 October 2026 (Brisbane)

Owner: “switch it all to the vps mate, no excuses, dont miss anything”.

## Scope and preserved work

Move the existing market-data collector and all website gateway selectors to
the new Vultr instance. Preserve original laptop archives, dirty native/social
work, provider credentials and main-only deployment/cost policy. No new paid
infrastructure or subscription was created. The web frontend remains on Vercel;
account/authentication/persistence remain on their existing services.

## VPS and storage

- Chicago144.202.52.66, owner-provisioned vhp4CPU/8GB/180GB plan.
- Owner-approved reinstall to Ubuntu24.04.5 LTS; verified SSH public-key login.
  Password and keyboard-interactive login disabled; Docker/security timers on.
- `feed.kwantdesk.com` A record changed by owner in Squarespace. Authoritative
  and Cloudflare DNS verified; TLS certificate verified without bypass.
- Clean committed gateway3c712357 built privately on VPS; licensed proto files
  and existing secrets transferred only over SSH. No image pushed publicly.
- 110GiB loop-backed ext4 allocation on the INCLUDED disk, with actual mount
  `/srv/kwantdesk-recordings`; this is NOT a separately purchased block device.
  Docker requires the mount. Recording and root capacity are monitored.
- Gateway5GiB memory/3.5CPU/256PID ceiling, bounded logs, independent Caddy TLS,
  boot restart policy and a local unhealthy-container watchdog. Disk warnings
  never trigger a restart loop, automatic data deletion or paid upgrades.
- Existing Vultr Automatic Backups selection left unchanged. Independent
  off-box backup and recovery drill are not certified by this work.

## Archive and ownership handover

- Original laptop archive is preserved. Essential sealed183.5MiB archive SHA:
  `a412bc4aed7ac1c01d9d1ac44bc859026afb402bc32bef0aac99e4fc34a49b73`.
- Activated the verified laptop gateway's loopback-only Node inspector solely
  to invoke its EXISTING SIGTERM shutdown handler. Checked exact PID and one
  handler first; closed debugger. Recorder/history/tape writers were awaited.
  Supervisor STOP marker prevents another local provider login after exit.
- Final delta42files/48.3MiB SHA verified on source and VPS before extraction:
  `688ca6462d06bc0dc3d09709e7233e86779916f2f24f7f36cdc32ec234650837`.
- Removed provider-disabled test container, restored delta, then started the
  actual VPS gateway. No overlapping laptop/VPS Rithmic collectors.
- Temporary loopback8793 compatibility adapter forwards old pinned deployments
  to the VPS HTTPS origin. No credentials/session, polling, local market-data
  generation or recording in this adapter; TLS verification stays enabled.
- A planned acquisition gap exists while final delta transferred. Its exact
  bounds are in private operational receipts/source GAP markers. Do not
  manufacture lost depth-by-order data or describe this as gap-free.
- Older approximately16GiB raw/exposure archive remains a separate sealed
  transfer. Verify SHA before restore; protect current-session append files.
  Preserve both source copies until full restore/integrity acceptance.

## Website configuration and acceptance

- Updated16 server-only production selectors on `websiterepo-yfmi`: all four
  gateway URL aliases, separate streaming origin, all four token aliases,
  explicit Rithmic snapshot token/URL and provider aliases. No secrets in Git,
  client bundles or this record. Environment update alone is not a deployment.
- Initial VPS live verification: health200, connected/authenticated, recording
  enabled/no recorder error; timestamps advanced22:43:17.815Z→22:43:19.661Z.
  NQ archived1m returned200/3,746candles in1,396ms. This is endpoint timing,
  NOT whole signed-in browser first-paint timing or proof every indicator works.
- Gateway env regression tests14/14. Clean gateway suite passed inside VPS
  image with read-only fixtures and provider network access disabled.
- Production deployment receipt, sustained SSE/record counters, authenticated
  browser and other provider acceptance must be appended after verification.

## Do not lose these remaining gates

- Browser streams currently use existing authenticated Next proxies. This
  cutover removes laptop transport ownership, NOT all Vercel CPU/transfer cost.
  Supported direct authenticated browser fanout still needs its own verified
  security/transport implementation; never expose the gateway bearer.
- KWANTY Supabase session archive previously unavailable; native provider
  full-session entitlement/stream negotiation and parity gaps are separate.
- QuantData surface poller remains quota-safe/disabled; observation capture is
  not a guarantee of every surface/ticker while nobody has that page open.
- No invented pre-recording month/L3 data, no promise of zero outages or proven
  hundred-user capacity. Daily manifests, full replay, quotas, backup restore,
  reboot recovery and live indicator/renderer soak remain acceptance checks.
