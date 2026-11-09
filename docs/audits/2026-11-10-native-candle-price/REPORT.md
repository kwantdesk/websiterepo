# Candle and last-price display authority

The owner reports that the candle still sometimes trails the moving last-price line after the prior fast-ingress repair.

## Change

Ordinary candles now use Lightweight Charts' built-in last-price line and axis value. Removed the separately maintained custom last-price marker from that display path. Both the visible candle close and line now belong to the same native series data; a parent redraw cannot leave an independently stored marker ahead. The previous repair paired two API calls but still kept two states, and its test did not enforce a single native display authority.

The verified trade/index fast path remains synchronous. No polling, smoothing, synthetic intermediate prices, artificial candle opens, extra network requests or feed delay was added. Unclassified observations no longer advance an independent line. BBO remains separate from actual trade prices. Heikin Ashi retains a raw-price marker intentionally because its candle close is derived, not the last trade. Footprint uses the same raw native series and its existing live geometry path.

## Validation

- 30 existing focused live ingress, timestamp, wick, bucket, BBO and price checks pass.
- Actual shared Chart and Lightweight Charts: NQ 1m, ES 5m, GC 1s, SPY 1m, MNQ 200-volume, NDX range. 160 classified updates; native last-price visibility; absence of independent last-price marker; delayed tape/wick correction; rollover; event-bar boundary authority; replay isolation.
- Additional 12 interleaved React parent refreshes while an isolated NQ paper position, SL and TP are present: live candle close remains the latest verified print and native line remains enabled. No real accounts/orders or owner trading tabs were used.
- browser-timing.json records local API timing, not exchange transport latency or a full production session soak.
- Full isolated Next webpack production build, TypeScript and static generation passed.

This removes a structural source of candle/line disagreement. It is not evidence that upstream pauses, main-thread load or every custom/derived chart renderer is fault-free. No gateway, provider subscription or terminal restart.
