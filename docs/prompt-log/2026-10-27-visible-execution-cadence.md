# Visible ES/NQ/gold execution cadence

Owner reported prices jumping rather than ticking promptly.

Measured directly inside the existing VPS gateway over a simultaneous ten-second ES/NQ/GC subscription, without changing provider subscriptions/services: ES 179 records, median source age 17 ms; NQ 38 records, median age 30 ms; GC 8 records, median age 24 ms. Median interarrival 0/9/24 ms respectively; p95 gaps 293/1397/3011 ms. This short Asia-session sample is not a New York load benchmark or browser/network latency guarantee; gaps between actual trades are not the same thing as processing latency. SSE emits each execution immediately.

Confirmed browser delays: execution worker coalesced for 40 ms; pane then waited 40 ms for selected Footprint, 120 ms for selected ordinary chart, or 750 ms for every unselected pane (including visible charts).

Change: worker batches for 8 ms with existing acknowledgement/backpressure and dedupe retained. Every pane in a visible document folds and publishes on the next animation frame, independent of chart selection. Hidden documents retain 750 ms lossless batching; returning visible cancels the hidden timer and resumes next frame. Cleanup cancels all work/listeners. Expensive React/study checkpoints retain their existing slower sampling. Prices remain execution-authoritative; quotes are not converted to candle OHLC and no artificial intermediate trades are generated.

Validation: 14 focused tests pass, including the actual execution engine receiving 100 ordered records and publishing at 8 ms, fake-frame simultaneous ES/NQ/GC coalescing, hidden/resume/cancel, canonical candle execution authority and live tape. Separate worker-backpressure test drains a 100,000-record stalled-renderer burst in order without drops or unbounded in-flight messages. New helper/engine ESLint and production build pass. No VPS restart or added Vercel polling. Physical screen refresh rate still bounds visible painting.
