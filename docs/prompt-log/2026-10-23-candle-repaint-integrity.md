# Candle and wick repaint integrity

Request: candles and wicks sometimes move, change or disappear after painting.

Reproduced a delayed previous-bucket print deleting the real current candle in
the existing future-tail repair path. Repair is now limited to bars actually
ahead of wall-clock time. Explicit book-only futures packets no longer create
OHLC prints; they still mark trading UI. Unflagged legacy packets are unchanged.

Added bounded, scope-isolated live clock-candle retention. Stale full-history
redraws preserve all recently observed extrema and appended bars rather than
only the latest direct snapshot. Old source timestamps cannot rewind close;
equal-millisecond prints keep arrival order. Symbol/timeframe/replay changes
clear retention; event bars keep their separate authoritative rebuild behavior.
Earlier history corrections and two-to-five-bar batches now trigger the full
series update they need instead of a newest-bar-only paint.

Seven targeted deterministic tests plus existing live-authority (19 intervals),
visual path (13), Rithmic candle combinations (2,650), and continuity/CVD/VWAP (12)
passed. No provider load, live subscription, polling cadence, billing setting,
order matching or VPS process was changed. This is regression evidence for the
identified paths, not a claim of independent live exchange-price certification.
