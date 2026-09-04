# The collector's archive

Rithmic sells **no history** for depth-by-order, and none at all for the
settlement, open-interest, market-mode and price-limit messages. What this
process writes to disk is the only copy that will ever exist. Everything below
follows from that.

## What is recorded

Every instrument in `RITHMIC_SUBSCRIPTIONS` is subscribed with
`update_bits = 131071` — **every bit** `request_market_data_update.proto`
defines, ORed together in `ALL_UPDATE_BITS` (`rithmic-client.mjs`):

| Bit | Type | Bit | Type |
| --- | --- | --- | --- |
| 1 | LAST_TRADE | 512 | SETTLEMENT |
| 2 | BBO | 1024 | MARKET_MODE |
| 4 | ORDER_BOOK | 2048 | OPEN_INTEREST |
| 8 | OPEN | 4096 | MARGIN_RATE |
| 16 | OPENING_INDICATOR | 8192 | HIGH_PRICE_LIMIT |
| 32 | HIGH_LOW | 16384 | LOW_PRICE_LIMIT |
| 64 | HIGH_BID_LOW_ASK | 32768 | PROJECTED_SETTLEMENT |
| 128 | CLOSE | 65536 | ADJUSTED_CLOSE |
| 256 | CLOSING_INDICATOR | | |

Plus depth-by-order snapshot and updates when `RITHMIC_ENABLE_DEPTH_BY_ORDER`
is set — the L3 tape, which is the part with no substitute anywhere.

> This was `update_bits = 7` (LAST_TRADE | BBO | ORDER_BOOK) until 2026-09-02.
> **Sessions recorded before that date contain three of the seventeen types**,
> and the other fourteen cannot be recovered for those dates.

`scripts/../test/recorder-completeness.test.mjs` reads the bit list out of
Rithmic's own `.proto` rather than a copy, so if they add a type and we stop
asking for it, the suite fails instead of silently narrowing.

### The archive filter is a denylist

`NON_MARKET_TEMPLATE_IDS` excludes only session plumbing: login, logout,
system info, heartbeats and the acknowledgements of our own subscriptions.
**Everything else is written, including message types we cannot name.** The
template ids for the newly-subscribed types are not published in the `.proto`
files, and an allowlist silently drops what it has not been told about — which
is the opposite of what an archive is for. Noise on disk costs bytes; a dropped
market event is gone for good.

What actually arrives can be read from `/health` → `templateCounts`.

Unmapped market-data templates are retained as base64 `raw` wire bytes. They
are not guessed into a schema: guessing can turn one valid message into
confidently wrong values. The original bytes allow the correct schema to be
applied retrospectively once identified. Check the archive record itself, not
only `protocol.decode()`—a 2026-09-03 audit found that the decoder preserved
the bytes but the client event accidentally discarded them before recording.

## QuantData capture

Every successful QuantData response received by the production gateway is
written with its request body and complete provider payload under
`/recordings/exposure/<CME-trading-date>/`. This includes:

- every options/equities tool response crossing the shared vendor edge;
- the always-on shared equity and cash-index snapshot poller;
- direct bounded cash/index history reads; and
- the completed-session cash-index archiver.

Identical request/payload pairs are deduplicated. A cache hit is not another
market observation and is not written twice. Provider failures and 429s are
not archived as data.

QuantData is REST, not a push tape. “Everything received” does **not** mean
poll every possible endpoint continuously. The autonomous all-surface poller
stays disabled during the live options session because it previously consumed
the account-wide request quota and froze every GEX surface. Sampling more
surfaces is a quota/licensing decision; it is not free historical coverage.

## Where it is stored

On the VPS, in the Docker volume `deploy_recordings`
(`/var/lib/docker/volumes/deploy_recordings/_data`, mounted `/recordings`):

```
/recordings
├── <YYYY-MM-DD>/                  one directory per CME trading date
│   └── <EXCHANGE>-<SYMBOL>.ndjson.gz     the raw tape, ~2-3.8 GB per session
├── bars/<YYYY-MM-DD>/
│   └── <EXCHANGE>-<SYMBOL>.json          minute OHLCV, ~332 KB per session
├── cash-index/                    all options-underlying + VIX session OHLC
├── exposure/                      options surfaces
└── heatmap-replay/                distilled LIQ MAP replay packs
```

Directories are **CME trading dates**, not calendar dates: the day rolls at
17:00 Chicago, so an overnight session lands in one file instead of being split
across midnight UTC. A record is filed by the trading date of the **print's own
exchange timestamp**, not our arrival time.

Bars are ~1/6600th the size of the tape they came from. Keeping bars is
effectively free; keeping raw tape is what consumes the disk.

The cash-underlying archive has two coordinated writers. The gateway captures
the recent completed sessions after the US close. The separate
`kwantdesk-cash-history-backfill.service` walks every offered physical
underlying from 2025-01-01 with a persisted ledger. Both refuse bulk provider
work during the US cash session, and the daily writer yields while the bulk
service owns the provider lane.

## Ordering and time

Each record is one JSON line: `{ type, receivedAt, payload }`.

- `payload.sequenceNumber` — Rithmic's own sequence, the authority on order.
- `payload.ssboe` / `usecs` — the exchange's timestamp, seconds and microseconds.
- `payload.sourceSsboe` / `sourceUsecs` / `sourceNsecs` — source-side precision.
- `receivedAt` — our arrival time, ISO. **Only ever a fallback**: a bar built
  from arrival time drifts with our scheduling and lines up with nobody else's
  chart.

Records are appended in arrival order per instrument. Readers that need strict
exchange order must sort on the exchange timestamp, not on file position.

## Durability

- **Backpressure.** If the OS write buffer exceeds `DEFAULT_MAX_PENDING_BYTES`
  (384 MB) the record is counted in `dropped` rather than growing the heap
  until the process dies. A non-zero `dropped` in `/health` means real loss.
- **Gaps are written down.** A disconnect emits an explicit `GAP` record.
  Never interpolate across one — an L3 gap cannot be reconstructed.
- **Compression is level 1, not 6.** Measured on this 2-vCPU box at full L3 on
  four instruments, level 6 could not keep up and the backpressure guard
  dropped ~45% of the busiest instrument. A smaller file with holes is worth
  less than a slightly larger complete one.
- **Shutdown flushes the tape first.** One ordered `shutdown()`, guarded
  against re-entry, awaits `recorder.close()` before anything exits, and
  `closeStreams()` waits for each file's `close` — a gzip trailer is written
  asynchronously and `process.exit` does not wait for it. Bounded at 4s per
  file and 5s overall so a stuck handle cannot outlast the container's stop
  grace period.
- **A refused login retries.** It used to schedule nothing, so one rejection
  left the collector dead while the process ran on and Docker still reported it
  healthy. Auth failures back off on their own schedule — 1 minute to 15
  minutes — which recovers from a session Rithmic has not yet released without
  hammering the account.

### Known limits

- Files are **multi-member gzip** (append per flush). A process killed mid-write
  corrupts the final member; readers stop there. Clean shutdowns now write
  complete members, but sessions recorded before 2026-09-02 keep the damage —
  measured at 933 readable minutes out of ~1,380 on an affected day, against a
  full 1,380 on a clean one. A reader that resynchronises past a corrupt member
  would recover the rest; not built.
- Retention is unbounded. Nothing prunes, and the tape is 2-3.8 GB per session.
  **Watch the disk.**
- `/health.archiveStorage` reports real filesystem capacity and enters
  `critical` at 8 GiB free. This is intentionally not a container-health
  failure: restarting cannot create space and would add another feed gap.
- The VPS disk is not a backup. Off-box object storage must be configured and
  verified before any retention/pruning job is permitted to delete a session.

## Reading it back

Chart history is served from the bar layer, not the tape:
`/v1/market-data/history?exchange=CME&symbol=NQ&interval=5m`, built live by
`FuturesBarArchive` and reloaded on boot.

Sessions recorded before that layer existed are rebuilt with:

```bash
node scripts/backfill-futures-bars.mjs --dir /recordings [--date YYYY-MM-DD] [--dry]
```

It merges rather than replaces, so it is safe to run twice and safe to run
against a session the collector is still writing. Run it **niced** — it is
CPU-heavy and this box has two cores:

```bash
docker compose exec -T gateway sh -c 'nice -n 19 node scripts/backfill-futures-bars.mjs --dir /recordings'
```

Scanning the raw tape directly (as `archive-value-area` does) takes ~2 minutes
per session and must never be done on a request path during live trading — it
starves the event loop and takes the whole gateway down with it.
