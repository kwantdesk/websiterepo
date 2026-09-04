# Prompt 35 — Footprint integrity and latency

## Requested

> Let's make sure our footprint is working correctly, with good latency, smooth transitions, and let's make sure, you know, the point of control of it's working correctly. The numbers that are appearing inside are working correctly for each setting, and that it's accurate and doing what it's supposed to do. Yeah.

## Diagnosed

- A live execution packet was first coalesced by the workspace and then held
  for another 80 ms inside each chart before the Footprint rows, POC and value
  area were refreshed. Candle geometry already moved on the direct animation
  frame path, so the box could visibly lead its numbers.
- The `Trades` views printed trade counts, but POC, value area, VWAP, Delta POC
  and maximum-row markers were still calculated from contract volume. A large
  single trade could therefore highlight a different row from the largest
  displayed trade count.
- The named `Volume × trades` and `Trades histogram` views existed in the UI,
  but both settings validation and the chart runtime omitted their content
  modes. Saving or reloading them silently fell back to another view.
- A Trades footprint summary still said `V` and reported contract volume even
  though its cells showed trade counts.

## Fixed

- Live Footprint execution updates now go directly to the shared per-frame
  work queue. That queue coalesces bursts using the newest canonical tape, so
  there is no second chart-level latency timer and no extra React render.
- The selected input dataset now owns POC, value area, exact execution-price
  VWAP, Delta POC and maximum-row calculations. Volume views use contracts;
  Trades views use execution counts.
- All named Footprint content modes survive validation, save/reload and the
  final chart option resolver.
- The footer summary follows the selected data: `V` for contract volume and
  `T` for trade count, with the matching delta.

## Verification

- New Footprint integrity regressions: 4/4 passed.
- Existing Footprint aggregation/live/empty-state checks: 30/30 relevant
  assertions passed. One old schema-version assertion was updated to track the
  current schema instead of hard-coding version 6.
- Authoritative Deep Print Footprint browser/native fixture: passed unchanged.
- Footprint chart-type, row-size, bar-window and flow-coverage checks: passed.
- Event-chart indicator alignment and execution-tape admission checks: passed.
- TypeScript: passed.
- Benchmark: cached live update for 160 bars and 20,001 executions completed in
  about 0.49 ms on this machine; cold construction completed in about 35.92 ms.

## Outcome

The forming Footprint now updates on the next available chart frame after the
already-batched Rithmic execution packet. Its printed cells, POC/value area,
VWAP, maxima and summary all use the same selected input, and every advertised
view remains intact after saving and reloading.

