# 2026-09-03 — 23 — Live tickers and GEX Map opening-bell incident

## Prompt (verbatim)

> help quick tickers and gex map arnt loading on kwantdesk, market is open but they are frozern please fix andn push asap

Follow-ups:

> cunt fix it its frozen smae with rithmic no live data this happens every marke topen fuck

> quick i need gex map and options tickers asqap fuck

> the charts spx, all of that ndx not live gex mnapo is good but the tickers them selves are still frozen feed

> what is this bug mate, it happens ever market open mate very annoying it cant keep happneing

> shit frozen again the tickers man the fuck is going on

> they come and go keep coming and going

## Diagnosis

This was two faults in series.

1. The single production gateway was HTTP-unresponsive (`/health` returned
   502 and then timed out), freezing the Rithmic SSE and every vendor request.
2. The gateway deployment nine hours earlier had replaced `operator.env`
   without its VPS-owned `QUANTDATA_API_KEY`. After the process restart,
   Rithmic recovered but GEX and cash indices could not. The key remained in a
   preserved VPS environment and was restored without exposing its value.
3. SPX/NDX/SPY/QQQ still stayed at zero in the browser because the client-side
   VPS live-symbol set was empty after Massive was retired. QuantData's shared
   VPS market-snapshot stream had replaced Massive, but the client was still
   sending every cash ticker through a four-second REST fallback. GEX Map was
   also omitted from the global futures and cash-index subscription guards.
4. The remaining intermittent failure was deterministic: the Next.js proxy
   only granted a long-lived timeout to paths ending exactly in `/stream`, but
   the cash ticker endpoint is `/index-stream`. Vercel therefore aborted the
   healthy upstream SSE every 30 seconds. The browser automatically reconnected,
   producing the reported cycle where prices came back and disappeared again.

## Fix and outcome

- Restarted the isolated gateway container. Rithmic re-authenticated, accepted
  NQ/ES subscriptions, and `lastMessageAt` advanced on every health probe.
- Restored only `QUANTDATA_API_KEY` from the VPS's preserved environment and
  recreated the gateway container. QuantData GEX requests resumed and all
  three production GEX ladders visibly populated.
- Routed the supported QuantData cash/equity symbols through the existing
  shared VPS SSE instead of per-browser REST polling.
- Enabled the global futures and cash-index subscriptions on GEX Map as well as
  Charts and GEX VUE.
- Added a deployment preflight that refuses to replace the running production
  gateway when `QUANTDATA_API_KEY` is absent.
- Raised the central QuantData start spacing from 80ms (a theoretical 750
  requests/minute) to 350ms (about 171/minute), leaving headroom beneath the
  240/minute account allowance for the one shared cash-index poller. Identical
  successful requests are now held for ten seconds at the VPS edge instead of
  2.5 seconds. The two controls are VPS-owned and survive future deployments.
- Classified every `*stream*` proxy route as long-lived before the upstream
  request begins. `/index-stream` now receives the 295-second Vercel request
  budget and reconnects at the platform boundary instead of being killed every
  30 seconds. Added a regression assertion covering this exact route-name bug.

Verification and production deployment are recorded below after completion.
