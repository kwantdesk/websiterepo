# VPS historical capture audit — 9 November 2026

## Verified on the running VPS

- Sole Rithmic gateway connected; 53 persistent futures subscriptions. Recorder, compact trade tape, minute bar archive, options response archive and recorded cash quotes are active. Current recorder/options dropped maps empty; no current write errors. These counters cover the current process lifetime, not all past sessions.
- Durable host bind: /srv/kwantdesk-recordings → /recordings, shared with the Gexbot relay. This survives container replacement. Actual filesystem is ext4 on /dev/loop0 backed by /var/lib/kwantdesk/recordings.ext4 on the same VPS root disk. It is NOT an independent disk failure domain or an off-server backup.
- Actual bounded gzip read-back: 1,500 NQ rows include 531 trades (150), 14 BBO (151), 940 order-book (156), 15 L3 order updates (160). ES: 611 trades, 6 BBO, 876 book, 7 L3. Schema has templateId, exchange, symbol, full payload and receivedAt.
- NQ compressed file grew from 88,265,747 to 88,687,874 bytes and ES from 57,557,376 to 57,849,805 during the audit. This checks real filesystem growth rather than merely configured flags.
- Raw folders: 22 dates from 16 October to 8 November; trade tape 24 dates from 12 October; QuantData response folders 20 dates from 20 October; Gexbot response folders 17 dates from 20 October. Folder presence does NOT certify complete session coverage.
- Options response archive saved changed payloads with request context and timestamps for exposure, interval maps, consolidated/unconsolidated flow, net drift, IV rank, skew, volatility drift, term structure, OI, max pain, contract statistics and equity tools. Accepted identical payloads are intentionally deduplicated. Last successful capture advanced during this check. Raw response payloads preserve fields that current charts may not yet use.
- Gexbot relay archive enabled, 5,978 accepted snapshots since its process start, no drops/errors, last frame 7 November. Zero active consumers at inspection: request-driven capture, not continuous unattended coverage of all tickers.
- Recorded cash quote archive active; separate minute bars and exact tape permit later chart aggregation without replacing our own live capture with downloaded history. Daily owned-history maintenance runs with network disabled, --days=11. Its limited repair window is not a deletion/retention rule.

## Coverage limits — do not describe these as solved

Ten configured core products request full market updates and depth-by-order: NQ, ES, MNQ, MES, YM, RTY, GC, CL, ZN and 6E. The wider 53-product catalogue requests trades+BBO in archive-only mode; a consumer may upgrade depth. All received market wire messages are archived, including unknown templates, but full L3 is not being collected for all 53 products.

The subscription inventory inspected consists of futures contracts; it does not establish individual Rithmic futures-option contract subscriptions. QuantData is a shared REST feed, not a full exchange push tape. Every successful response crossing the shared edge is archived, but unopened/unrequested tools, strikes and contracts do not thereby acquire complete continuous history. The all-surface poller remains disabled to preserve the account-wide quota and live speed. No extra provider calls, subscriptions or paid entitlements were enabled.

The product's five-day chart load choice is not a five-day archive deletion policy. Longer replay needs adequate recorded coverage plus readers/indexes and UI range support. Do not promise every past date or indicator is already replayable from a folder listing. Imported/provider-origin older bar files exist separately; their presence is not proof of owned recording coverage.

Options read-back decoded valid saved rows. Python gzip reported an unfinished final stream member on active files; continuous gzip writers do not finish their trailer until stream close. This is not by itself evidence of corruption. The audit does not certify every historical gzip member or recover previously unrecorded data.

## Capacity and backup

Recording filesystem: 115,658,190,848 total bytes, approximately 41.2 billion bytes available (38.4 GiB), about 64% used. Root filesystem approximately 29.7 GiB available, 82% used. Recent substantial raw sessions use about 1.7–2.5 GB each; one options session used another 1.63 GB. Growth varies. Unlimited retention is not sustainable on this fixed disk. No off-server market-archive backup was configured or independently verified. Existing support-desk backups do not back up market recordings. No recordings were pruned, storage purchased or plan increased.

## Repair applied without restarting the feed

The existing minute watchdog checked container health and disk capacity but omitted recorder state. Added a pure, bounded recording_health.py diagnostic and hooked it into that watchdog's healthy-container branch. It reads local health with a 4s fetch / 8s process deadline. It detects disabled mandatory writers, nonzero dropped counters, writer errors, raw backpressure, and two consecutive intervals of incoming market-template growth without raw-record growth. Closed-market silence and process-counter resets do not trigger false stall warnings. No restart/deletion/purchase action is associated with a recording warning. Existing watchdog container-recovery behavior was preserved, not invoked manually.

Installed /opt/kwantdesk/recording_health.py and patched /opt/kwantdesk/watchdog.py atomically after checking its original SHA256. Timestamped original retained beside it with mode0600. Gateway, provider subscriptions and trading sessions were not restarted.

Seven Python diagnostic tests pass. Existing archive suite:18/19 pass; the unchanged recorder-completeness source-pattern test expects two literal ALL_UPDATE_BITS occurrences and fails against the intentional archive-only trades+BBO branch. The subscription implementation and test were not altered to force a pass. No website build/deployment is needed for this operator-only change.

Scheduled production verification: the next normal minute-watchdog execution included all five writers enabled, zero dropped records, no write errors, stalledIntervals=0 and warnings=[]. Incoming market-template count21,741,711 and raw-record count21,779,034 were observed. See monitor-live.json. No manual watchdog execution or service restart was performed.
