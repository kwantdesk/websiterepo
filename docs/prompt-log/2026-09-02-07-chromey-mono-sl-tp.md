# 2026-09-02 — 07 — Chromey Mono: SL/TP/entry lines and triggers

## Prompt (verbatim)

> its bizarre you make so ,mamny mistakes we added anew theme called chromey mono and the fucking shit dont work properly mate, even the fucking sl tp and entry shi isnt correct there is no like coming off it and i dont think sl and tp are working when they are hit on this theme

## Answer

Two separate claims. One was a real bug, the other was a consequence of it.

### The lines: real, same root cause as the Sell button

Chromey Mono sets `candleDown: "#000000"` deliberately — it draws hollow down
candles, so the down body is meant to be the chart background. Applying a theme
copies `candleDown` straight into `chartSettings.downColor`, and the chart draws
stop, target and entry levels in those candle colours:

| Level | Colour | On Chromey |
|---|---|---|
| Stop loss | `downColor` | `#000000` on a `#000000` chart — **invisible** |
| Sell entry | `downColor` | **invisible** |
| Buy entry / target | `upColor` `#00FF00` | fine |

`borderTopColor: level.color` on the line, `backgroundColor: level.color` on the
price-scale chip — so there was no line, no chip, and nothing visible to drag.
The level was there and armed the whole time; it could not be seen.

Fixed by forcing those colours legible against the **chart background** (they
are drawn over the chart, not over a panel). Black resolves to `#666666`; the
green is already legible and is left exactly as chosen.

### The triggers: not broken — proven, not assumed

A theme cannot change whether a level fills, but "I don''t think SL and TP are
working" deserved a test rather than an opinion. New
`npm run test:paper-protection-triggers`, 8/8:

- a long''s stop fills when price trades down through it, recorded as `stop_loss`
- a long''s target fills, recorded as `take_profit`
- **a short''s stop fills when price trades up through it** (the inverted
  comparison — getting this wrong leaves a short''s stop permanently unarmed,
  which is exactly the reported symptom)
- a short''s target fills
- a level reached **exactly** fills, not only one passed through
- a gap straight through the level still fills
- a level not reached does not fill
- a stop still fills after several earlier quotes that did not reach it

The fill markers were never affected — they use hard-coded `#22C55E` / `#EF4444`.

So: the stops were firing. With the line invisible there was no way to see one
sitting on the chart or see it go.

### Verified

`test:paper-protection-triggers` 8/8, `test:paper-label-contrast` 7/7,
ESLint 0 errors, `tsc --noEmit`, `npm run build` — all green.
