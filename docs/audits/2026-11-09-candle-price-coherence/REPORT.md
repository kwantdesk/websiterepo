# Candle / current-price paint coherence — 9 November 2026

## Cause
The current-price marker was published before pane processing from a mixed stream: real trades, bid/ask midpoints and cash-index last observations. Candles were painted separately from the lossless execution accumulator. A midpoint can legitimately differ from the candle's last traded price, and the marker could advance before the matching candle paint. A newer BBO observation also occupied the shared bus watermark, potentially suppressing a real execution with an earlier exchange timestamp.

## Change
All existing publishers now label trade / BBO quote / index observations. BBO still updates the watchlist, bid/ask and existing execution UI; it is excluded from the chart last-price bus and cannot advance its trade watermark. The chart current-price line now represents the real last-trade price, rather than alternating between last trade and midpoint.

Within an already-established clock candle, a fresh real trade or genuine cash-index last observation advances displayed close/extrema immediately through the existing direct candle event. The same flush submits the candle and its line to Lightweight Charts in one synchronous turn. No new bar/open is inferred from a coalesced quote. Event bars retain their lossless boundaries and submit line updates only alongside the actual calculated bar. Lossless execution batches still own volume, delta, new bars and recorded history. Fast-path observations never add volume or flow counts. Late execution batches can add wick evidence without rewinding a more recent known close. Existing replay isolation and subscription cleanup remain in place.

Heikin-Ashi is still mathematically derived; its candle body need not equal raw last market price. This task does not redefine derived candles or claim transport latency has been removed.

## Evidence and limits
30 focused tests pass, including 16 clock intervals, unchanged open/volume/delta, missing bar rejection, BBO rejection, late print/extrema handling, shared ingress ordering, scope/contract isolation, formatting and lifecycle. Existing live candle authority suite passes across 19 time intervals; latest-frame coalescing/rollover visual-path checks also pass. The earlier watchlist test expected an unclassified midpoint to move the last-price line; updated it to test the intentional separation while proving BBO still reaches the watchlist and cannot suppress a real trade.

Actual shared Chart + actual Lightweight Charts in isolated headless Chrome: six panes, four clock-chart real-price sources, 160 coherent direct updates; quote-only isolation; late tape/wick handling; rollover; volume/range-bar paired paint; replay isolation; zero browser errors. Browser timing JSON records ingress-to-API measurements and exact line/candle call separation. These are local display-path measurements, not exchange-to-browser latency or a production session soak. Current run: p95 0.2 ms to both APIs, max 1.3 ms, max call separation 0.6 ms within one synchronous turn.

Scoped helper lint passes. Final isolated Next.js webpack production build, TypeScript and static page generation pass. No live gateway, terminal or subscription restart; no owner trading-tab refresh, account/order mutation, network fan-out or new paid requests. Unrelated dirty/native/ALGO files preserved. Production receipt saved locally after live commit verification.
