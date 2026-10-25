# LIQ Map shared replay — 2026-10-25

Request: "same replay needs to be added to liiq map and i expect it to work properly too"

## Implementation

- Standalone LIQ Map now uses the same centered date/time/timezone picker,
  master transport, selected-time left edge, speed options and real-time 1x
  clock as Charts. One shared transport implementation; depth stepping is 2s.
- The iframe handshake no longer waits for a live book to start replay. Clock
  advancement waits for the archive; gaps may advance without showing stale
  depth. The existing trading bridge stays read-only during replay.
- Rewinds clear future data AND painted pixels synchronously. Date/instrument
  changes and exit abort prior requests. Per-session ownership prevents stale
  replies from changing a replacement session, its cache, status or busy flag.
- Missing/truncated/wrong-instrument chunks fail closed, with bounded retries,
  request deadlines and at most four cached chunks. Future-dated trade bubbles
  are excluded. CVD uses archived observations, never the current live seed.
- Exact signed, Origin-bound five-minute leases also cover only the two replay
  read endpoints. Chunk bodies stream directly from the existing VPS, not via
  Vercel response buffers/transfer. Gateway/provider credentials stay private.
- Backend archive selection prefers the actual contract over administrative
  root subscription files. Version 3 invalidates prior wrong/empty packs.
  Contract rolls choose the most-recorded concrete contract and expose its
  name in the manifest; contracts are never mixed.
- One bounded worker builds packs independently of the live gateway event
  loop. Compression honors backpressure and publishes chunks only after the
  destination finishes. Gap/drop markers invalidate depth until a complete
  recorded resnapshot. No new paid service or unbounded background fan-out.

## Verification and limits

- 111 scoped regressions pass, covering map/trading, archive construction,
  races/rewinds/exit, missing coverage, gap/resnapshot, direct-edge security,
  timezone and real-time shared playback. Scoped ESLint is clean. Next.js
  production build succeeds, including TypeScript.
- Actual VPS read-only inspection found ~1.5GB compressed NQ contract data for
  October 22, but its small root administrative file shadowed it. October 23
  NQ contract data inspected contains only a brief exchange-time slice, not a
  continuous full session. Do not claim full Friday/week-long LIQ coverage.
- Depth replay is two-second sampled book data, not a lossless millisecond
  order-event replay. Archive gaps remain explicit and visually empty.
- First access to a large uncached session needs a one-time pack build. The
  UI reports building honestly and does not advance the clock over it.
- The connected browser is signed out (login returnTo gex-data); no signed-in
  pointer/visual acceptance or trading action has been claimed/performed.

## VPS activation

- Existing Chicago VPS only. Uploaded files SHA256 matched local sources.
  Preserved /opt/kwantdesk/compose.before-liq-replay-20261025.yml and
  browser-stream-edge.before-liq-replay-20261025.mjs for rollback.
- Actual Compose diff adds only two read-only mounts: versioned replay store
  and worker, at /app/src/heatmap-replay.mjs and heatmap-replay-worker.mjs.
  All existing recording mounts, provider overrides and limits retained.
- Recreated only gateway and browser-stream; gexbot-relay/Caddy untouched.
  Post-activation health, archive preparation and website release results
  must be checked before claiming live acceptance.

## Production configuration verification

- Read only the existing live-SSE rollout flag via the authenticated project
  API: it is false. Do not enable/reconfigure the existing live streams.
- Finite signed replay reads are independent and always use the verified VPS
  edge. Optional KWANTDESK_BROWSER_REPLAY_DIRECT=false disables them with 503;
  it never falls back to large Vercel response bodies. A regression executes
  the actual redirect helper with live-SSE disabled to verify this boundary.
