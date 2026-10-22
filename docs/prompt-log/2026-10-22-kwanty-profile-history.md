# KWANTY Classic/State historical replay repair

User: “why the f is histroy not working for anything ojn kwanty page including state”.

Root causes:

- Previous EOD adapter handled Orderflow only; Classic/State still called a
  denied native historical endpoint.
- Full QQQ Classic and State sessions decode to165,331,007 and141,993,839 bytes.
  Shipping entire arrays would breach hosting limits and stall browser memory.
- Generic State retention discarded early history after1200 observations.
- Play began at the loaded closing frame, so it immediately stopped.
- Empty Orderflow restoration results stayed cached for the entire page life.

Repair: exact streaming EOD indexing on VPS, bounded gzip pages and a complete
second-resolution timeline. Original profile arrays remain unchanged and are
fetched only for selected replay ranges; playback waits instead of inventing or
skipping unavailable frames. Authentication, fixed vendor origin, exact
selection/date/ticker, ZIP CRC and numeric source timestamp checks retained.
401/429 are not converted into valid history. Index jobs are single-owner,
atomic, disk/free-space bounded and request driven. Only specific in-progress
index errors retry for a bounded period; no per-tick Vercel polling added.

Real VPS probes: QQQ Classic GEX, State GEX, State Gamma and State Delta each
22017 original observations. QQQ last-page145 GEX strikes/127 Gamma tuples,
spot725.42. SPX State GEX15739 actual observations. These are actual source
counts, not a completeness claim for every wall-clock second. QQQ warm
manifest+last-page reads0.76–1.92s; initial indexing was slower and now uses
stream segment scanning/fast gzip plus explicit in-progress response handling.

VPS changes are only readonly Gexbot sidecar module mounts; no Rithmic restart,
new account, provider WebSocket negotiation, purchase or extra paid volume.
Rithmic gateway start2026-10-21T00:35:56.355932235Z remains unchanged.

Limits: reports older than the latest source export require a previously saved
ZIP. Never relabel a newer report as the requested older day. Live positioning
still30s REST; full parity, continuous all-ticker capture, archive restoration,
off-box backup/recovery and multi-user capacity/cost remain separately open.
