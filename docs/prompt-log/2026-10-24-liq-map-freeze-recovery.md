# LIQ Map freezing

Owner reports recurring freezes. Gateway was connected and receiving messages
at inspection, without a current overload. Lifetime max lag1,306ms/50 trips
and MNQ recorded gaps remain backend limitations, not fixed by browser tests.

Repairs:
- Price-only ticks no longer reset the full-depth freshness watchdog; invalid
  depth cannot masquerade as a fresh complete book either.
- The existing stale-book probe has a4s response-body deadline. A newer genuine
  recovered book triggers the existing bounded socket reconnect with accepted
  cursor, rather than leaving the chart on8s snapshot repairs indefinitely.
  A generation change from that reconnect cannot create an extra immediate probe.
- A slow bootstrap cannot rewind a newer SSE book. Recovered snapshots still
  omit retained trades to avoid duplicating execution bubbles/tape/CVD.
- A single frame-index Map replaces per-bubble and per-boundary history scans
  during drawing/incremental clustering. Anchor prices, volumes and history are
  unchanged. No simulation or loss-hiding fallback added.

Four runtime regression tests pass; feed/anchor/performance/smooth-motion tests
also pass. Broad LIQ suite98/106 passes;8 older controls/assets source assertions
were verified failing against unchanged HEAD too. Only two cache-version gates
were intentionally updated. Scoped ESLint and production build/typecheck pass.
Entry iframe/main/changed module query versions advance together.

No collector restart, provider request cadence increase, new subscription,
always-on poller, storage limit reduction or paid resource added.
