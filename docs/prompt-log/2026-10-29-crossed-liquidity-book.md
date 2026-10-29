# Authorized depth reset and integrity checks — 29 October 2026

Owner: “you can reset now i styopped trading”. The earlier wait is revoked for this reset. No owner trades, accounts, preferences, display backup or chart appearance were changed.

## Live work and honest result

NQZ6 and ESZ6 were unsubscribed and resubscribed one at a time through the existing authenticated gateway. Both initially returned clean positive spreads for three consecutive samples. A longer check then found NQ crossed 15/15 samples (minimum -30 ticks), ES 15/15 (-3 ticks), zero stale samples. A reset alone does not fix the fault.

Only the gateway container was subsequently restarted to activate tested repairs. VPS, Caddy, options relay, browser stream and independent heatmap-history service were not restarted. Existing runtime bind mounts/other modules and recording volumes were preserved. Exact before-hash checks, candidate syntax checks and saved backups protected the two runtime module updates.

Final active changes: preserve newer order deltas/cancel tombstones through atomic snapshot completion; explicitly encode aggregatedQuotes=false on ticker login; label crossed books invalid/non-full-depth while retaining exact rows; bounded same-socket baseline recovery after two crossed observations, at most once/30 seconds/instrument. No invented levels, quote-based pruning, extra provider login, or Vercel per-tick path.

A trial consuming known resting order IDs on executions did NOT establish a sustained fix and was completely removed from final source and runtime. Do not infer from missing later DBO deletes alone that consumption is correct for this feed; account for provider sequencing/absolute updates before trying it again.

## Validation and remaining fault

Four staged-snapshot race tests failed before repair and pass after. Actual localhost WebSocket/protobuf login test failed when the option was omitted and passes with explicit false. Crossed-book regression suite passes. All **532 gateway tests pass**, scoped ESLint and runtime Node syntax checks pass. Final live module SHA256: book-store 077897cdaf91b79e1c52651b5c25f031d146e4aa2fa751a1feb5d1c9bd1ab47c; rithmic-client e9f9ec88965186f113ede1c42a1af2418ee95f04060ed146ba34d9c29bd7a0e5.

**NOT resolved:** final 15-second NQ sample still crossed 3/15 (minimum -1 tick), ES 1/15 (zero spread), no stale samples. Gateway authenticated/connected, lastError null, 11 subscriptions, recorder enabled/no recorded drops, event loop not overloaded. All existing service health checks green. This is NOT proof of accurate or visually restored liquidity.

Bounded read-only reconstruction from the latest exact gzip member reproduced crossings from actual snapshot/delta records; aggregate level sums equal individual-order sums. First NQ cross at 03:58:39.170Z: new bid 6884185807124 at 29579.25 meets stored ask 6884185805291 at the same price. ES new bid at 7748.5 meets retained snapshot asks there. Further work must trace those exact IDs and source update semantics; do not keep guessing display palettes or claim the source is fixed. Quote arrival around 250ms is observed, not proven to be caused by aggregation; explicit false did not establish full correctness.

Backups: /opt/kwantdesk/staging/depth-reset-backup-20261029; depth-execution-backup-20261029; depth-unaggregated-backup-20261029. Final runtime is in the existing two override filenames, no compose changes. Earlier performance, archive, parity, Footprint and unattended-execution tasks remain separate/open. No browser inspection or changes to the owner's running chart were performed.
