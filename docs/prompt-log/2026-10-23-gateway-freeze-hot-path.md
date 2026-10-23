# GEX/options ticking freezes — gateway follow-up

The website delivery fixes are deployed at809666e16c9754a0a526488bb0578ada0c372e51.
They do not establish that the shared VPS event loop no longer stalls.

At14:04Z the public gateway was connected/authenticated with fresh messages,
QuantData snapshot success and no current overload, but overload trip count
had reached99 with maximum observed lag3,396ms. A bounded five-second perf
sample showed network-write/compression and V8 marking pressure. JIT symbols
were unavailable; this is not proof of a particular function being the sole cause.

Locally prepared book-store optimization avoids sorting full ladders for
depth1 quotes and avoids scanning the retained trade ring for bounded incremental
frames. Equivalent output, source immutability and bounded reads are tested,
including restored negative history cursors. No history or recorder retention
is reduced. No paid resource or additional vendor request was introduced.

Owner approved activation with “YES GO”. Only the gateway was recreated at
2026-10-23T14:19:27Z (24 October Brisbane). The runtime baseline matched the
tested HEAD source; the targeted module was mounted read-only with production
image, credentials, recording mount and both vendor overrides preserved.
Runtime SHA256:76a27418b75b1a6a847511e45ac6859363ab97a6db5ba512d06797de9132fbc8.
Rollback: /opt/kwantdesk/compose.before-hotpath-20261024.yml and
/opt/kwantdesk/runtime-overrides/book-store.before-hotpath-20261024.mjs.

Checks: container healthy, connected/authenticated; source/QuantData success
timestamps advance; NQ recording64k→101k→175k with no reported dropped records
or recorder error. 43 focused tests pass. Existing vendor-module hashes match
their host overrides. No Vercel deployment or extra paid resource was created.

Residual faults remain:5 overload trips/max851ms after startup, and vendor edge
reported an oversized provider response. Different observation windows prevent
claiming measured speedup from the previous max3,396ms. Do not certify the full
freeze problem as fixed from this restart or the local test result.

Later14:22Z check: NQ313k recorded; MNQ dropped-record counter14,056 (initial
checks had none). That counter stayed stable on a subsequent check while pending
recording bytes drained below1MB and overload cleared. The captured archive is
not complete over that MNQ gap. No invented replay data or hidden loss claim.
