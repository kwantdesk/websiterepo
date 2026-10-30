# NQ ticking and responsiveness investigation — 2026-10-30

## Request and verified repair

The owner reported glitchy, jumpy NQ movement compared with Deep Charts. Investigated upstream delivery, stream forwarding and the execution-to-candle paint path without interrupting trading.

Found a synchronous hot-path allocation in the actual workspace execution flush: `hasUsableOrderFlowHistory` filtered the entire candle history on every execution batch before publishing the candle paint event. All futures panes use this execution path, even plain candles. Extracted the same readiness rule into `src/lib/orderFlowHistoryReadiness.ts`: find the verified endpoints and stop counting after the required threshold. No full-history allocation; common hydrated histories require about 60 flow reads. Sparse histories still scan as needed, and the first/last timestamp rule and threshold remain identical. Neither prices, OHLC, executions, cadence nor CVD values are altered.

Verification: 24 focused readiness, hydration, same-frame series-paint, execution authority and rollover checks pass. Equivalence checked on 400 randomized sparse/mixed/invalid-flow histories plus explicit empty/small/large cases, including reverse ordering. A 20,000-candle accessor fixture proves at most 62 reads and rejects any reintroduced filter call. Scoped helper/test lint and full production build pass. The giant workspace edit is an import plus removal of the old function; no new full-file compiler lint was run against that previously memory-exhausting file.

Local benchmark, 5,000 calls over 20,000 hydrated candles: old **1231.83 ms**, new **2.64 ms**, about **467× faster for this check**. Equivalent work for 24 panes drops from **5.91 ms to 0.0127 ms per update**, excluding every other chart operation. This is not a 467× claim about the whole platform or proof of the owner's final screen latency.

## Bounded live observations

One 15-second read-only sample opened NQ execution and priority-quote SSE readers both inside the existing gateway and through the public HTTPS gateway from the VPS. It reused the existing Rithmic connection and NQZ6 subscription; no provider reset/login, trade or account mutation.

| Path | Execution packets / records | Price changes | Packet gap median / P95 | Reported timestamp age median / P95 |
| --- | --- | --- | --- | --- |
| VPS loopback | 76 / 76 | 55 | 34 / 787 ms | 6 / 29 ms |
| Public HTTPS, observed from VPS | 76 / 76 | 55 | 35 / 783 ms | 7 / 29 ms |

Quotes: 98 packets on each path, 87 changed prices, median gap about 170 ms and P95 about 265 ms. The request did include priority=NQ. Source inspection confirms active-priority aliases bypass the background 250-ms throttle; the 32-ms quote flush is a ceiling, not a promise of a new quote every 32 ms. Sampled execution gaps up to 940 ms alone do not prove dropped data; the sample does not establish complete exchange traffic.

Gateway connected/authenticated, no reported current overload, event-loop last lag 0 ms. Five unauthenticated public health reads from this laptop measured about **278–299 ms** round trip after an **836-ms** initial connection. These health timings do not measure the authenticated browser stream's final delivery or rendering latency.

Timestamp provenance remains a qualification: book-store execution timestamps prefer provider source timestamps but can fall back to receipt time when missing. No raw-wire sample was taken to certify the provenance of each measured record. Therefore reported ages must not be presented as certified exchange-to-screen latency. The observations show no material additional delay across the two sampled VPS-side forwarding paths; they do not rule out intermittent peak-session load, laptop/network delays or other browser work.

## Runtime comparison limitation

REA skill was consulted for passive runtime inspection. `list_browser_targets` requires a CDP endpoint; none was exposed by the running browser command lines. Connected Computer Use inventory showed no in-app browser tabs and no running Deep Charts window. No user page was navigated, reloaded or instrumented, no debug port enabled, and no Deep Charts session started. There is consequently **no captured browser paint trace and no claimed Deep Charts parity**. Existing opt-in `feedAudit=1` instrumentation can measure actual source-to-paint and long tasks when a suitable active chart target is available. A final end-user smoothness comparison remains unverified.

Earlier source-to-paint batching, candle-authority fixes, history protection and replay isolation remain in place. No artificial in-between-tick prices or animations were added. This release removes a measured browser bottleneck; it is not a blanket certification that every cause of the reported lag is resolved.
