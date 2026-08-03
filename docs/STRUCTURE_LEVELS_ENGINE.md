# Kwant Desk structural zone engine

The chart **S** control publishes supply, demand, support and resistance as
zones rather than exact-price promises. The same canonical snapshot supplies
the chart, LEVELZ and chart-level exports.

## Data truth

- Historical evidence uses the latest eight calendar days requested from CME,
  with the engine capped to the latest 3,000 canonical five-minute bars.
- Bar volume is distributed transparently through each bar's traded range to
  estimate historical volume-at-price. It is not described as historical MBO.
- Live confirmation uses the current Rithmic Depth-by-Order book only when the
  gateway reports a valid full-depth L3 book no more than five seconds old.
- A resting order is evidence, not a trade. It can be cancelled, so no zone is
  described as guaranteed support or resistance.

## Historical candidates

The engine finds swing pivots, impulse origins, rejection wicks, repeated
tests, recent displacement and high-volume nodes. Zone width is bounded by the
instrument tick size and robust true range so a noisy candle cannot create an
untradeably wide area.

For a supply or demand origin:

`H = 0.30D + 0.22V + 0.20R + 0.18F + 0.10T`

For support, resistance or a role flip:

`H = 0.22D + 0.22V + 0.30R + 0.14F + 0.12T`

Where:

- `D` is forward displacement normalised by robust ATR;
- `V` is the bar's robust volume percentile;
- `R` combines rejection-wick quality and distinct retests;
- `F` is freshness, reduced as the area is repeatedly consumed;
- `T` is recency within the observed history.

Historical high-volume nodes use:

`Hnode = 0.58Vnode + 0.30Rnode + 0.12N`

where `N` rewards useful proximity without forcing distant nodes onto an
intraday chart.

## Live Level 3 confirmation

The browser keeps one shared, read-only Rithmic snapshot poll per contract. It
tracks each price's first-seen time, current and EMA size, peak size, order
count, additions, removals and stable observations. This avoids treating one
large, momentary order as durable structure.

`L = 0.45C + 0.25P + 0.18B + 0.12S`

Where:

- `C` is size concentration versus the current side of book;
- `P` is persistence, reaching full weight after 15 seconds;
- `B` is order breadth, preventing one displayed order from receiving the same
  weight as a broad queue;
- `S` measures size stability and penalises pulled liquidity.

When historical and L3 evidence align inside the volatility-scaled matching
band:

`Score = 0.66H + 0.34L`

A standalone live-liquidity zone requires all of the following:

- full, valid L3 book;
- score of at least 72%;
- at least four observations;
- at least three seconds of persistence.

This is deliberately stricter than historical confirmation because displayed
liquidity can be spoofed or cancelled.

## Lifecycle and delivery

- Canonical historical structure refreshes every five minutes.
- Live L3 evidence refreshes once per second without re-running the historical
  pass.
- Candidate clusters merge only when they share a role and remain within a
  volatility-scaled distance; the final view is limited to the nearest ten
  valid zones.
- A broken demand/support area can return as resistance, and broken
  supply/resistance can return as support. Price acceptance remains the final
  confirmation.
- Export preserves each zone's low edge, high edge, role, confidence, colour,
  source and timestamp. Platforms without native rectangles receive two named
  boundary lines; TradingView also receives a filled band.
