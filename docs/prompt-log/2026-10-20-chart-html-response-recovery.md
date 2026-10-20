# Chart request HTML / JSON failure recovery

Request: fix a blank NQ chart displaying `Unexpected token '<', '<!DOCTYPE' ...
is not valid JSON`.

Confirmed code path: normal CME history and execution-history loaders called
Response.json directly. An HTML holding/error response could therefore throw a
raw SyntaxError into the chart error surface. The shared workspace JSON reader
also explicitly refused to retry syntax errors. The gateway adapter remembered
any returned response as a successful origin, including an HTML 200 relay page.

Repair:
- Shared market JSON parsing rejects HTML/XHTML, malformed/empty JSON and
  primitive/null payloads with a clear, provider-neutral data/session message.
  Raw markup and JSON parser internals never become that message.
- CME candles and supplemental execution history use the shared bounded GET
  reader. One retry only, within the original end-to-end deadline; external
  cancellation and cache revalidation/explicit refresh modes remain intact.
- Index and legacy chart-history paths also use guarded parsing. Existing
  last-good history/cache and OHLC/continuity checks remain unchanged.
- Server gateway routing rejects HTML and HTTP 502/503/504 before remembering
  origin success, trips its existing cooldown and tries another configured
  address. Streaming responses are not decoded or changed.
- HTTP 401/403 HTML and mutating requests are not retried. No auth bypass,
  provider credentials/configuration changes, stream polling or recorder restart.

Verification: 19 focused transport, gateway failover, history critical-path and
live-edge checks pass. Tests reproduce transient HTML then exact real data,
persistent HTML, mislabeled/broken/empty JSON, authentication failure, aborts,
single timeout budget, four bad-origin cases and preserved candle readiness.
Scoped transport/gateway lint passes. Two pre-existing event-archive bootstrap
source checks fail on old durable-event API/header contracts in unchanged files;
not counted as passing or marked repaired.
TypeScript and full production build pass (84 static pages).

Read-only probe: local gateway returned JSON with 3,826 NQ candles. Public
production health returned JSON/configured true. The development .env.local
still points at an unreachable old feed domain; it is not proof of production
environment values and was not changed. This fix does not prove which HTML
response generated the owner's historical screenshot, or restore VPS uptime.

Existing supported transport/startup-delay, month history/capture, Asia tape,
indicator soak, options parity and shared multi-user capacity/cost remain open.
