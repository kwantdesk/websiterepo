# Live quotes arriving in bursts — 2026-10-20

## Request and scope

Owner says candles update roughly every30s. Trace live delivery separately from
the previous first-paint fix; do not disguise this by polling faster, padding SSE
with bulk bytes, interpolating prices or declaring every indicator repaired.
No questions/purchases/new infrastructure. Preserve the existing capture process.

## Measurements

- Same NQ quote endpoint,14s bounded probes: local76quotes/14,606bytes,
  first40ms; current public Quick Tunnel ZERO bytes and quotes during14s.
- Cloudflare official docs: Quick Tunnels explicitly do not support SSE:
  https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- Existing Tailscale service and Funnel are ALREADY running and proxy8793.
  A default-name probe gives73quotes/14s, but MagicDNS resolves the private
  tailnet IP; that alone is not public-network proof.
- Queried public DNS over HTTPS, then verified certificate/hostname/SNI while
  connecting through an advertised PUBLIC ingress IP. No certificate bypass.
  Public Funnel: HTTP200 headers/first quote1,677ms,149quotes/28,227bytes/14s.
- Public Funnel bulk NQ history:8,073bars/812,967bytes/14,507ms. Therefore do NOT
  replace the bulk origin globally; doing so would regress chart startup again.

## Change

- One new server-only production setting,
  KWANTDESK_MARKET_DATA_STREAM_GATEWAY_URL, points at the existing Funnel.
- Shared origin selector uses it ONLY for quotes, executions, cash-index and
  liquidity streams. Existing REST origins, provider keys and token untouched.
  Quote route and generic gateway stream proxy share this selection. A bad
  explicit override fails closed rather than disguising buffered transport as
  connected. Last-good stream origin cannot contaminate REST routing.
- No gateway restart, new tunnel, account, DNS change, API purchase, artificial
  padding, faster polling, changed candle maths, feed cadence or subscriptions.
- Remove/repoint this extra setting during the Vultr cutover. Temporary laptop
  must remain powered/online; this does not replace the always-on architecture.

## Verification

-23focused environment/routing/deadline/CVD-handoff tests pass, including the
  real server fetch adapter, authenticated upstream headers, stream passthrough,
  REST isolation, explicit invalid-origin refusal and legacy no-override routing.
-Scoped ESLint passes. Full production build and exact release/live-site stream
  receipt to follow. Do not confuse upstream proof with final browser delivery.
- Existing Vercel proxy costs remain. Owner-managed cap unchanged; no zero-cost
  or100-user capacity claim. Missing full month futures/options history, Asia
  tape, weekly completeness and complete indicator live soak remain OPEN.
