# Live candle responsiveness

Owner reports candles moving in jumps every few seconds.

Measured the existing production NQ.c.0 priority quote stream without restarting
services or changing settings. One 15-second VPS-local sample delivered 275
uncached quote packets, 26 trade-bearing packets, median arrival gap34ms,
p95 144ms/max292ms; source age median23ms/p95 77ms. A separate 15-second
public TLS sample from this workstation delivered199 quote packets but only8
trade-bearing packets; trade gap median824ms/max9202ms. All-quote source age
median814ms/p95 915ms. These are short, separate samples, not a latency SLA or
proof about the owner's exact chart/browser. No token or signed lease recorded.

Located additional browser visual buffering: every candle snapshot was queued,
with up to four successive frames displaying already-superseded intrabar closes.
Under a busy render loop this adds delay after data has arrived. Clock candles
now coalesce pending snapshots within the same source bucket, painting the most
recent received close next frame while retaining actual open/high/low and
cumulative counters. Final prior bars remain queued at rollover; event bars keep
their distinct snapshot path. No interpolation, midpoint-based futures candles,
new requests, timers, polling, gateway edits, restarts or trade actions.

Validation:
- Visual-path regression exercises burst coalescing, retained extrema, rollover,
  chronological compaction and event-path compatibility.
-36 candle/drawing/timeframe/viewport regression tests pass.
- Scoped helper/script lint and whitespace checks pass.
- Existing multi-pane static performance suite has14 failures both before and
  after this change, with identical failing names (tested against HEAD contents
  substituted into its file reads). Do not describe that suite as passing.
- Production build validated before release through main-only Git integration.
- Owner-session visual/CPU acceptance remains unperformed. Sparse exchange
  executions may legitimately leave a trade-based candle unchanged between
  trades; quote traffic alone must not invent wick/body movement. This removes
  a verified browser delay, not a claim that all responsiveness issues are solved.
