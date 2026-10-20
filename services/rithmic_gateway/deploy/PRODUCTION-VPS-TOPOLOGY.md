# Production topology — October 2026 replacement VPS

The current deployment is **not** the older `/opt/kwantify` generic stack.
Use `/opt/kwantdesk/compose.yml` on the existing Chicago host. Back up and diff
that actual configuration before deploying; never replace it with an old
template. Provider data enters this VPS before the website.

| Service | Private port | Ownership |
| --- | --- | --- |
| gateway |8793| Sole Rithmic login; shared QuantData/native-positioning provider cache |
| gexbot-relay |8795| Legacy primary Gexbot API; forwards native reads to gateway and records accepted frames |
| browser-stream |8794| Short-lived signed browser read leases; website feature flag currently **off** |
| caddy |80/443 public| TLS feed origin; routes only, never provider secrets |

- Caddy routes `/v1/native-positioning/*` and `/v1/gexbot-legacy/*` to
  `gexbot-relay:8795`; `/browser-stream` goes to8794, other data routes to8793.
- Relay runs the existing private gateway image, with the versioned
  `src/gexbot-relay.mjs` mounted read-only at `/app/src/gexbot-relay.mjs`.
  Its script must reside beside compose on the host. Private env
  `/etc/kwantdesk/gexbot-relay.env` is0600 and contains only the existing
  `GEXBOT_API_KEY` and `KWANTIFY_MARKET_DATA_GATEWAY_TOKEN`.
- Do not copy the complete operator environment into the relay. No Rithmic
  username/password or website/Supabase credentials belong in that container.
- Relay limits:512MiB memory/swap ceiling,.75CPU,64PIDs,256MiB V8heap;
  restart-unless-stopped, init, read-only root, no-new-privileges, private
  expose8795,60s graceful stop, bounded Docker logs. Health is container-local
  `GET http://127.0.0.1:8795/health`. Only Caddy publishes public ports.
- Both gateway and relay bind `/srv/kwantdesk-recordings:/recordings`.
  Ensure the persistent recording mount is present before starting Docker.
  Relay files use separate `/recordings/gexbot/exposure`, preventing competing
  gzip writers. Do not overwrite or delete existing session files on upgrade.
- A relay-only upgrade requires copying the source then recreating **only**
  that service (`docker compose up -d --no-deps --force-recreate gexbot-relay`).
  Validate/reload Caddy when routing changes. Preserve the sole Rithmic process.
  When feeding deployment scripts over SSH stdin, redirect Docker command stdin
  from `/dev/null` so Compose cannot consume subsequent deployment instructions.
- Verify actual TLS native/legacy requests and advancing recorder timestamps,
  not just Compose exit status or a healthy sidecar. Do not turn direct-browser
  mode on until actual browser reachability and reconnection pass.

This is request-driven Gexbot capture, not guaranteed unattended every-ticker
collection. Vendor quota/stream entitlement, old-history restore, capacity and
independent backup/recovery remain explicit acceptance gates. No new paid
service or external object store was configured by this migration.
