# Footprint chart engine

This is a clean-room footprint implementation built from exchange execution
data and public market-microstructure definitions. It does not depend on, copy,
or reproduce another platform's proprietary implementation.

## Data flow

1. The Rithmic gateway classifies executions as aggressive buys, aggressive
   sells, or unknown.
2. `src/lib/footprint.ts` assigns each execution to its source candle and an
   exchange-tick-aligned price bucket. `footprintTradeAdapter.ts` owns source
   classification and deterministic ordering, while `footprintAnalytics.ts`
   owns POC, value area, imbalance, stack, maximum and auction calculations.
3. `src/lib/footprintPrimitive.ts` renders the resulting price rows as a
   Lightweight Charts series primitive.
4. `src/components/Chart.tsx` connects the engine to the live indicator tape,
   chart viewport, saved settings, and theme.

## Price-level calculations

For every execution at price `p` with size `q`:

```text
aggressive buy   -> ask[p]     += q
aggressive sell  -> bid[p]     += q
unknown          -> between[p] += q

volume[p] = ask[p] + bid[p] + between[p]
delta[p]  = ask[p] - bid[p]
```

Trade counts are allocated with the same classification. Aggregated provider
records that contain both bid and ask volume split their trade count in
proportion to the classified volume while preserving the original total count.

## Bar calculations

```text
bar volume = sum(volume[p])
bar delta  = sum(ask[p]) - sum(bid[p])
VWAP       = sum(execution price * execution size) / sum(execution size)
POC        = price with the greatest volume[p]
delta POC  = price with the greatest absolute delta[p]
```

The engine also preserves the ordered execution path as delta Open, High, Low,
and Close. This is different from simply taking the largest price-level delta:
the OHLC values describe how cumulative delta evolved inside the candle.

The per-bar value area starts at the POC and expands toward the next adjacent
price row with the greater volume until its configured percentage is included.
Equal-volume rows above and below are included together so the selection stays
contiguous and deterministic.

## Imbalances

For adjacent rows `lower` and `upper = lower + groupedTickSize`:

```text
ask imbalance at upper:
ask[upper] / bid[lower] * 100 >= threshold

bid imbalance at lower:
bid[lower] / ask[upper] * 100 >= threshold
```

The minimum absolute volume difference is applied before the ratio. A zero
denominator only qualifies when **Include Zero** is enabled.

Same-row and delta-percentage comparison modes are also supported. Consecutive
same-side diagonal imbalances form configurable stacked imbalances; missing
ticks and opposite-side imbalances break a stack.

## Rendering

Available cell content:

- Bid x Ask and compact ladder
- Delta and delta histogram
- Total volume and volume histogram
- Volume x Delta
- Trade count
- Bid/Ask histogram

The renderer supports solid, heatmap, histogram, heatmap-histogram and
text-only visualization; detailed, compact and micro levels of detail;
diagonal and stacked imbalance emphasis; POC and value area; maximum levels;
unfinished auctions; summaries; unclassified-volume bands; and per-bar VWAP.

`footprintSettings.ts` contains the versioned defaults, validation, migrations,
five presets and an SSR-safe per-instance browser-storage fallback. Normal
workspace persistence remains authoritative in the application.

The footprint intentionally renders only when price-level execution data is
available. It never fabricates bid/ask splits from OHLCV candles.

## Verification

Run the focused test suite with:

```powershell
node --experimental-strip-types --test tests\footprint.test.mjs
```

Run the TypeScript check with:

```powershell
npx tsc --noEmit --pretty false
```
