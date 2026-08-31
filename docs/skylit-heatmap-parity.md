# Skylit Heatseeker Heatmaps — what they serve, what they show

Read live on 2026-09-01 during the session, from the owner's own account, on
SPXW at spot ~7670.

## How their data reaches the page

Three calls, in this order:

1. `POST /api/sse/ticket` — a short-lived ticket.
2. `GET /api/data?symbol=SPXW&max_strikes=92&max_expirations=5&nocache=<rand>`
   — the opening snapshot. Bearer-authenticated (Clerk); cookies alone are
   refused.
3. `GET /api/stream?symbol=SPXW&ticket=<ticket>&max_strikes=500&max_expirations=50`
   — **Server-Sent Events**, and where every subsequent update arrives. No
   WebSocket anywhere in the app.

Worth noting for us: the stream is opened with far wider bounds
(`max_strikes=500`, `max_expirations=50`) than the snapshot that paints the
first frame (`92`/`5`). They paint a small window fast and let the stream carry
the full book.

The page title carries spot and re-renders sub-second, so the SSE is genuinely
per-tick for price even though the grid interval control says `1m`.

## The grid

92 strike rows × 5 expiration columns, strikes every 5 points, columns headed
by expiration date. Values in `$K`, signed, with a diverging background per
cell — green through to purple/near-black at the extremes, bright yellow for
large positives.

Controls across the top: ticker tabs (QQQ / SPXW / SPY / +), **GEX | VEX**,
spot with change and percent, an expiry filter (`All`), the interval (`1m`),
**Movers** with a live count, refresh, history, and a view switcher.

## Movers — the one clear difference worth copying

18 strikes carried a small percentage chip: `+4%`, `-10%`, `-7%`, `+3%`, `-5%`,
`+2%`. The header counter read `Movers 28`.

Ours is the growth ticker beside the strikes (`763ade0a`, capped to the top
eight per side in `51c5269c`). The difference is the **magnitude**: theirs sit
in single and low double digits over the interval, ours needed a prior-magnitude
floor at 0.5% of the Star node and a `>500%` clamp because it was manufacturing
readings in the hundreds of percent. A percentage that large is a near-zero
denominator, not a market event. Theirs being uniformly small says their
denominator is a stable per-cell quantity rather than whatever the previous
window happened to hold.

**Next step on this:** score our movers against theirs on matched pairs and, if
ours are still an order of magnitude larger, change the denominator rather than
the clamp.

## The standing constraint — do not paper over this

Established previously and unchanged (`dcf0cdbd`): Skylit license **Cboe
Open-Close Volume Summary**, which categorises every trade by participant type
(including market maker), by action, and by OPEN vs CLOSE, as intraday
one-minute snapshots — including C1, where SPX and SPXW are exclusively listed.
Their `1m` interval is that cadence.

That is the signed dealer quantity itself. It is not in OPRA and it is not in
the chain, which is why every attempt to infer it scored around 55%. Their book
not being at-the-money peaked, and their King sitting on high-open-interest
strikes below spot, both follow from reading real open positions rather than
inferring from volume.

So the honest position: **our GEX Map can match their layout, their controls
and their responsiveness, but it cannot reproduce their dealer numbers without
that licence.** Anywhere we imply otherwise is the misinformation risk. Label
what ours is derived from and do not present a modelled number as a measured
one.

## Matched pairs only

Any scoring run must print `status`, `asOf` and spot from both sides and refuse
to score when they disagree — a stale cached payload once produced a clean
correlation peak that turned out to be spot alignment, not model quality.
