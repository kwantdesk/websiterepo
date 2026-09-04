# Prompt 33 — Zero Gamma Line integrity

## Requested

> Zero gamma line still looks fucked. Like what I wanted it to be was a true
> representation of a live line that draws like a VWAP along with price. So in
> every session it draws. So I have it on so I can put it on my NQ chart and it
> calculates it correctly, obviously from options. But when you're above it,
> obviously positive gamma; when you're below it, negative gamma. It looks
> fucked. A picture of it, you know? What it looks like now is just a load of
> squiggly lines. It's not just a clean line, because obviously there is a line
> where above you're in a certain gamma environment and below you're in a
> certain... They have this on Gex Bot. It's called a zero gamma line. We have
> to sort ours out because it's not being calculated correctly, or it's like,
> you know, it's got a bug or something, because it doesn't look like a clean
> line. It just looks like random squiggles. Do you know what I mean? Like it
> should follow close to price, and then, you know, when price breaks above it,
> the line, then it says zero, and then above it it's obviously a certain
> environment. It needs to be clean and really accurate.

## Diagnosed

- The live chart merged two different calculations into one series: true
  Black-76/open-interest scenario roots and approximate one-minute interval-map
  balance roots. Alternating those observations produced a false saw-tooth.
- The historical reconstruction selected a fresh nearest-strike sample and a
  fresh nearest root every minute. Strike membership and root branch could
  therefore change even when the structural boundary had not.
- The renderer interpolated from one trading day's final observation toward
  the following day's first observation, drawing a false diagonal level across
  Globex.
- A pinned cash-index/ETF source could contribute uncalibrated cash-scale
  anchors to a futures chart, mixing NDX/QQQ/SPX/SPY prices with NQ/ES prices.

## Fixed

- A live session now contains only successive true scenario-repriced roots.
  The client keeps those snapshots as one causal live trail; approximate
  interval-map roots are no longer interleaved with them.
- Completed-session reconstruction freezes one near-money strike universe at
  the session opening and follows the previously selected root branch. This
  removes strike-window churn and multiple-root branch hopping.
- Each New York options session is painted independently from 09:30 through
  16:00 ET. There is a hard gap overnight and no interpolation into tomorrow.
- Event charts pass their real source timestamps separately from their
  synthetic chart slots, so the same session rule works on 500V, range, trade,
  delta, Renko, volume-bar and point-and-figure charts.
- Pinned cash sources are calibrated to the futures display scale before any
  point enters an NQ/ES chart; the durable cache identity includes that scale.
- The browser default opacity is reconciled with the cross-platform authority
  fixture at 72%.

## Verification

- Zero Gamma calculation, source-family, display-scale, live-method,
  interpolation, session-gap and regime-colour regressions pass.
- Zero Gamma browser/native authority fixture passes.
- Zero Gamma Bars browser and native fixtures pass.
- GEX BOX's 15 focused formula/history/normalisation tests pass.
- TypeScript and the 80-route optimized production build pass.

## Outcome

The indicator is now a clean session-scoped boundary. Price above it is painted
with the positive-Gamma theme colour and price below it with the negative-Gamma
theme colour. The calculation is not forced to hug price: it remains an options-
derived dealer-Gamma root, because cosmetically pinning it to candles would be
false market data.
