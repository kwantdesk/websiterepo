# 2026-09-02 — 03 — Options page and GEX map dead at the open

## Prompt (verbatim)

> why the fuck is the options page not working cunt fuck sake none of the tickers are working nor is gex map this is mroe improtant than vp

## Answer

My fault, and it took the whole desk down, not just options.

**Cause.** Ninety minutes before the open I shipped a volume-profile route that
read the recorded trade tape **per request**. The gateway is one Node process,
so each of those reads blocked the same event loop that serves options, GEX,
quotes and the live feed. With panes polling at the open they stacked up.

**Measured during the incident:** `/health` timing out at 30s (HTTP 000), one
volume-profile request taking 58.7s, load average 2.25.

**Fix.** Reverted the tape read out of that hot path (`24105c6c`) and
redeployed. `/health` went from timing out to 0.7s; GEX map returns real SPX
data again; gateway steady at ~1s under repeated polling.

**What this cost.** The prior-session volume profile is wrong again — the
in-memory ring cannot reach back, so a prior day returns almost nothing. That
is the right trade: the profile is worth nothing if the platform is down. The
correct fix is to fold each session once and cache it, the way bar flow now
works, and it does not go near a market open again.

285 gateway tests green. Rules to stop a third occurrence written up in
[04](2026-09-02-04-second-day-not-live-at-the-open.md).
