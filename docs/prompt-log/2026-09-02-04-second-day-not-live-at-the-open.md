# 2026-09-02 — 04 — Second day not live at the open

## Prompt (verbatim)

> ok its back on, this is the second fucking day that this has not be live when the market fucking opens and its pissing me off

## Answer

Fair, and both were mine.

- **2026-09-01:** I ran `archive-value-area` probes minutes before the open —
  119s cold gzip scans, 113% CPU, Caddy 502'd everything.
- **2026-09-02:** I shipped a volume-profile route that read the tape per
  request, 90 minutes before the open. `/health` timed out at 30s.

Same root cause both times: **CPU-bound archive work on the single-process
gateway, introduced close to the open.** It never presents as itself — it
presents as options, tickers and GEX all being dead at once.

## Three rules, now recorded so they survive a new session

1. **No gateway deploy, backfill, or archive probe from two hours before the
   RTH open until after the close** — unless it is fixing an active outage.
2. **No gateway route may read the archive per request.** Fold once per
   session and cache, the way `bar-flow-archive.mjs` does.
3. **Load-test a new gateway route concurrently** while sampling `/health`
   latency and `lastMessageAt`. Both outages passed a single sequential
   request; that test proves nothing.

Written to memory as `never-deploy-gateway-near-the-open`, alongside the
prompt-log rule, so they carry across sessions rather than depending on me
remembering.

Losing a feature is recoverable; losing the open is not. When those conflict I
revert the feature and keep the desk up.
