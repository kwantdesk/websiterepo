# Speed of Tape audit — 2026-09-07

## Evidence

- Public reference contract: https://help.volumetricatrading.com/en/support/solutions/articles/204000011988-speed-of-tape
- The study measures activity intensity and buy/sell acceleration.
- Published controls are Database (Volume, Order, Trades), Filter min/max,
  Number of seconds, Standard deviation per filter and bull/bear plot colours.
- This is separate from Speed of Tape (Instant) and Quant Desk's Tape Speed &
  Order-Flow Burst study.

## Quant Desk implementation

- Exact non-flow-only executions are sorted deterministically and accumulated
  once into fixed exchange-timestamp windows.
- Volume uses execution size. Trades uses the provider trade-count field, with
  one as the minimum count for an execution. Filter min/max apply before
  aggregation; zero maximum means unlimited.
- A positive deviation setting keeps windows at or above mean plus the chosen
  population-standard-deviation multiple. Zero disables that gate.
- Buy/sell execution dominance chooses the histogram colour. Theme colours are
  authoritative unless a user disables theme following; settings and templates
  persist normally.

## Honest limits and verification

- The current web feed carries executions and trade counts, not historical
  order-placement events. Database = Order therefore displays an explicit
  unavailable state and returns no invented values.
- Bull/bear border colours are persisted as part of the public contract. The
  current Lightweight Charts histogram API paints each bar with its fill colour;
  it does not expose a separate per-point border stroke.
- Focused tests cover exact aggregation, filtering, trade counts, flow-only
  rejection, unavailable Orders, bounds, persistence, controls and release gates.
- Protected vendor formula and pixel parity are not claimed.
