# Always-on Rithmic collector — deployment runbook

The professional shape: **one always-on collector owns the Rithmic session,
the website reads it over a bearer-protected HTTPS origin.** Vercel never
talks to Rithmic — serverless functions are killed between invocations and
physically cannot hold a persistent WSS session.

```
Rithmic AU · Ticker Plant
      │  ONE login · ONE persistent WSS
      ▼
  collector (this stack, on a VM)  ── Docker restart:always + autoheal
      │  normalized trades / BBO / L3 depth-by-order
      ▼
  Caddy · automatic TLS · bearer enforced by the gateway
      │
      ▼
  Next.js on Vercel  →  charts, volume profile, footprint
```

## The rule that prevents most "random" dropouts

**Rithmic permits a limited number of concurrent logins per user.** Two
processes sharing one credential force-logout each other in a loop — the SDK
ships `forced_logout.proto` for exactly this. It presents as a feed that keeps
dropping for no reason.

Once this stack is live, **stop the local gateway** and leave it stopped:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-background.ps1
```

Run the local one only when the VM stack is down, never both.

Expect one brief disconnect per day around CME settlement/reset — Rithmic
performs scheduled maintenance. The client's exponential backoff handles it.
Do not chase it and do not lower the healthcheck thresholds because of it.

## Prerequisites

- A small VM. 1 vCPU / 2 GB is ample — this process is I/O bound, not CPU
  bound. Sydney region keeps it near both you and the AU endpoint. Latency is
  irrelevant for charting; **uptime is the entire point**.
- Docker Engine + Compose plugin.
- A DNS **A record** — e.g. `feed.kwantdesk.com` → the VM's public IP.
- Ports 80 and 443 open. Port 8793 must **not** be exposed publicly; only
  Caddy reaches it, over the internal Docker network.

## Deploy

1. Copy the service directory to the VM (`services/rithmic_gateway`),
   including `vendor/proto` and `operator.env`. **Neither is in git** — the
   Rithmic licence forbids redistributing the SDK, and `operator.env` holds
   your credentials. Copy them over SSH, never through the repository:

   ```bash
   rsync -av --exclude node_modules --exclude .vercel \
     services/rithmic_gateway/ user@vm:/opt/kwantify/rithmic_gateway/
   ```

2. Set the hostname in `deploy/Caddyfile` (replace `feed.kwantdesk.com`).

3. Confirm `operator.env` on the VM contains:

   ```
   RITHMIC_SOURCE_MODE=protocol
   RITHMIC_WS_URL=wss://rprotocol-au.rithmic.com:443
   RITHMIC_SYSTEM_NAME=Rithmic Paper Trading
   RITHMIC_USER=...
   RITHMIC_PASSWORD=...
   RITHMIC_SUBSCRIPTIONS=CME:MNQU6,CME:NQU6,CME:ESU6,CME:MESU6
   KWANTIFY_MARKET_DATA_GATEWAY_TOKEN=...   # long random string
   KWANTDESK_DESKTOP_TICKET_ISSUER=https://www.kwantdesk.com/desktop-ticket
   KWANTDESK_DESKTOP_TICKET_AUDIENCE=https://feed.kwantdesk.com
   KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON=... # active Ed25519 public keys only
   KWANTDESK_DESKTOP_REVOCATIONS_URL=https://www.kwantdesk.com/api/desktop-auth/revocations
   KWANTDESK_DESKTOP_REVOCATIONS_SYNC_TOKEN=... # dedicated server-to-server secret
   KWANTDESK_DESKTOP_REVOCATIONS_FILE=/desktop-auth/revocations.json
   KWANTDESK_DESKTOP_REVOCATIONS_POLL_MS=15000
   KWANTDESK_ANALYTICS_ORIGIN=http://kwantdesk-analytics:3000 # fixed private/VPS analytics origin
   KWANTDESK_ANALYTICS_SERVICE_TOKEN=... # separate 32+ character internal token; also set server-side on analytics service
   KWANTDESK_ANALYTICS_TIMEOUT_MS=45000
   KWANTDESK_NEWS_SERVICE_ORIGIN=https://www.kwantdesk.com # fixed NEWS service origin; use the private/VPS origin when available
   KWANTDESK_NEWS_SERVICE_TOKEN=... # separate 32+ character internal token; set identically on the NEWS server routes
   KWANTDESK_NEWS_SERVICE_TIMEOUT_MS=120000
   KWANTDESK_SOCIALS_SERVICE_ORIGIN=https://www.kwantdesk.com # fixed server-side SOCIALS read/mutation service
   KWANTDESK_SOCIALS_SERVICE_TOKEN=... # separate 32+ character internal token; set identically on the web service
   KWANTDESK_SOCIALS_SERVICE_TIMEOUT_MS=120000
   KWANTDESK_JOURNAL_SERVICE_ORIGIN=https://www.kwantdesk.com # fixed server-side JOURNAL state/analysis service
   KWANTDESK_JOURNAL_SERVICE_TOKEN=... # separate 32+ character internal token; set identically on the web service
   KWANTDESK_JOURNAL_SERVICE_TIMEOUT_MS=120000
   QUANTDATA_API_KEY=...                    # VPS-only vendor credential
   KWANTDESK_LAB_REPOSITORY_ROOT=/opt/kwantify/QUANT-DESK-sync
   OPENAI_API_KEY=...                       # VPS-only ZYON transcription credential
   OPENAI_ZYON_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe-2025-12-15
   OPENAI_ZYON_TRANSCRIPTION_TIMEOUT_MS=45000
   ```

   Before enabling `socials.account:write`, apply
   `202608300002_create_desktop_social_follow_mutations.sql` to the server-side
   database and verify its service-role-only RPC. Do not grant or make the
   workstation request that scope while the native SOCIALS route is gated.

   Before enabling native JOURNAL, apply
   `202608300005_expand_desktop_journal_scopes.sql`, verify separate
   `journal.account:read` and `journal.account:write` entitlements, and probe
   state read, one reversible mutation, saved-analysis read and bounded
   analysis generation through the VPS. The JOURNAL origin/token pair is
   all-or-nothing; partial configuration is a startup error. Screenshots stay
   in Journal storage and are never forwarded to the analysis model.

   Leave every `KWANTDESK_DESKTOP_*` value blank until the website issuer,
   entitlement migration, sync-token rotation, and revocation outage/rollback
   drill are ready together. Partial configuration intentionally prevents the
   gateway from starting. Create `runtime/desktop-auth` beside `deploy` with
   owner-only permissions before enabling the boundary; Compose mounts it at
   `/desktop-auth` and the synchronizer publishes only verified snapshots.
   Leave both analytics values blank until the server-side web application is
   reachable at the fixed private origin. Configuring only one is a startup
   error. The token must never use a `NEXT_PUBLIC_` environment name.

   `RITHMIC_GATEWAY_HOST` is overridden to `0.0.0.0` by compose; the
   `127.0.0.1` in the file is correct for local dev and would make the
   container unreachable here.

4. Build and start. **Build on the VM** — the image embeds the licensed proto
   files and must never be pushed to a public registry:

   ```bash
   cd /opt/kwantify/rithmic_gateway/deploy
   docker compose up -d --build
   docker compose ps
   ```

5. Confirm the session and vendor edge are genuinely live, not merely serving HTTP:

   ```bash
   curl -s https://feed.kwantdesk.com/health | jq
   ```

   Required: `"connected": true`, `"authenticated": true`, a `lastMessageAt`
   that **advances between calls**, and a populated `instruments` array.
   Also require `vendorData.quantDataConfigured: true`. Databento and Massive
   are retired production providers: do not add their credentials back to the
   VM or Vercel. Rithmic owns futures market data and QuantData owns the
   licensed options/equities surface until the planned provider migration.
   Before enabling native ZYON dictation, additionally require
   `zyonTranscription.configured: true` and verify an authenticated bounded WAV
   fixture through `POST /v1/zyon/transcriptions`. The credential must exist
   only in the VPS secret manager/operator environment; do not add it to the
   native build or Vercel.
   `connected: true` with a frozen `lastMessageAt` is a dead feed wearing a
   live label — treat it as an outage.

## Point the website at it

Set these as **server-side** Vercel environment variables (Production and
Preview). They must never be `NEXT_PUBLIC_*` — that would ship your gateway
token to every browser:

```
KWANTIFY_MARKET_DATA_PROVIDER=Rithmic
KWANTIFY_MARKET_DATA_GATEWAY_URL=https://feed.kwantdesk.com
KWANTIFY_MARKET_DATA_GATEWAY_TOKEN=<the same token as operator.env>
```

Redeploy once. `src/lib/institutionalMarketData.server.ts` and
`src/lib/optionsMarketData.server.ts` already read these — no code change is
needed to switch the site from localhost to the VM.

## Operating it

```bash
docker compose logs -f gateway        # live gateway log
docker compose ps                     # health status per container
docker compose restart gateway        # manual bounce
docker compose down                   # stop everything
```

Health semantics, so nobody misreads a dead feed as a live one:

| `/health` says | Means |
|---|---|
| `connected:false, authenticated:false` | session down; backoff is retrying |
| `connected:true`, `lastMessageAt` advancing | genuinely live |
| `connected:true`, `lastMessageAt` frozen | **dead feed, live label** — outage |
| `instruments: []` | subscriptions have not populated yet |

The container is marked unhealthy after roughly 10 minutes of a genuinely
down session, and `autoheal` then restarts it. That window is deliberate: the
client's own backoff should win first, and restarting during Rithmic
maintenance only causes login thrash.

## Recording (on by default)

Rithmic's History Plant can replay **time bars, tick bars and volume-profile
minute bars**. It has **no depth-by-order replay** — there is no such proto in
the SDK. Full L3 order-book history therefore cannot be bought back after the
fact at any price, and every session that is not captured as it happens is
gone permanently. That is why the recorder defaults to on.

The collector appends the raw normalized stream to
`/recordings/<cme-trading-date>/<EXCHANGE>-<SYMBOL>.ndjson`, rotating on the
17:00 Chicago boundary so an overnight session stays in one file. Raw, not
bars: bars can always be derived from raw, raw can never be derived from bars.

A disconnect is written into the file as an explicit `GAP` record. Nothing is
interpolated across it and no reader is allowed to assume continuity that was
never observed. On shutdown a `manifest.json` records per-instrument message
counts so completeness is checkable rather than assumed.

Verify it is running:

```bash
curl -s https://feed.kwantdesk.com/health | jq .recorder
```

`enabled: true` with `recorded` counts climbing between calls means capture is
live. `enabled: false` means you are losing data you cannot get back.

The `recordings` volume is the only asset in this stack that cannot be
recreated. **Back it up off-box** — a nightly sync to object storage is
enough:

```bash
docker run --rm -v rithmic_gateway_recordings:/data -v /backup:/backup \
  alpine tar czf /backup/recordings-$(date +%F).tar.gz -C /data .
```

Sizing: full L3 on four instruments is roughly a few hundred MB per session
uncompressed and compresses hard (text, highly repetitive). **Measure it over
the first week rather than trusting that estimate** — then size the disk and
the retention policy from what it actually produces.

## Next layer (not required to go live)

Add Redis and Postgres between the collector and the website:

- **Redis** — hot last-good book and rolling window, so a collector restart
  is invisible to the charts instead of blanking them.
- **Postgres/Timescale** — durable bars for footprint and volume profile.
  Session profiles cannot be rebuilt from an in-memory ring buffer after a
  restart; this is the piece whose absence is felt first.
