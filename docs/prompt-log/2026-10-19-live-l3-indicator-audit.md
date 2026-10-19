# Market-open L3 and indicator audit — 2026-10-19 Brisbane

Owner expects live L3 and every indicator, including weekly profiles, to work.
Read-only gateway/API checks at approximately 23:09–23:11 UTC October18:

- Ten currently subscribed futures (ES, NQ, CL, GC, MES, MNQ, YM, RTY, ZN,
  6E) report LIVE, depthMode L3, bookValid true, nonzero order counts.
- Raw decoded-wire recorder is attached; record totals and separate exact
  trade-tape writes advance. No dropped counts or recorder error reported.
  This proves active subscribed data capture, not all offered instruments or
  a continuously complete archive before the laptop restart.
- NQ current-session profile has 224 price rows initially and volume increased
  3403 -> 3407 -> 3640. Current one-minute order flow returns 14 candles.
- Current session began22:00Z; available exact profile coverage begins22:56Z.
  Its response correctly reports complete=false. Missing opening executions
  must be backfilled from an authoritative source, not OHLC allocations.
- Individual prior four sessions (Oct12/13/14/15 start dates) report complete
  and volumes529055/731443/803533/797048. The five-session aggregate nevertheless
  reports complete=true despite the incomplete current session. Its check only
  validates the aggregate's oldest edge and whole missing dates, not each
  present session's start. Treat aggregate completeness as unproven; do not
  relax the chart fail-closed rule to make it paint.
- Public diagnostics: gateway connected/authenticated, website SHA0643d39d.
  Historical execution-profile lane remains unusable/cooling down (503).
- Local NQ SSE over8s: ready+seed+21 live trade batches,913371 bytes.
  Public quick-tunnel SSE over20s: ready+seed only,917504 bytes, first data672ms,
  last data1410ms, then no further delivered data until timeout. Initial history
  delivery must not be confused with working continuous live streaming.

OPEN: production-reachable low-latency streaming origin (VPS/stable tunnel),
missing current opening exact tape, per-session aggregate completeness proof,
historical footprint/CVD source and full signed-in all-indicator audit. No feed
restart, duplicate login, provider entitlement change, synthetic data or paid
infrastructure was introduced by these checks. This is not an all-indicators-pass.
