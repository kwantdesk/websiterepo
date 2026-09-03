# 2026-09-04 — 01 — Liquidity Map Chromey contrast

## Prompt (verbatim)

> look chrmey theme on liq map still not sorted see bid and ask colours you can see, sort this out blakc on blakc or something fuckkk

Follow-up:

> you also cant see the black bubbles..... maybe make it light green sake with sell dom

## Diagnosis

Chromey Mono intentionally uses a black bearish candle body with a grey outline
to produce hollow down-candles. The Liquidity Map treated that candle body as a
general Sell/Ask accent. Against its black chart and near-black ladder, Sell
headings, ask sizes and sell-side trade bubbles were painted but effectively
invisible. Best-price text also assumed fixed white-on-ask and black-on-bid,
which was unsafe once themes supplied either light or dark accents.

## Fix and outcome

- Added a shared market-accent resolver that checks both the chart and ladder
  surfaces at a 4.5:1 contrast floor while preserving the selected hue.
- Hollow Chromey sell-side ink now resolves to a separate pale green; Bid/Buy
  remains the theme's high-voltage green. The same resolved pair drives DOM
  headings, sizes, profiles and trade bubbles.
- Best bid/ask badges now calculate black or white label ink from their actual
  fill instead of assuming a fixed combination.
- Added the missing candle-outline tokens to the embedded theme contract and
  cache-busted the full module chain so existing browsers cannot retain the
  broken palette module.
- Regression coverage evaluates Bid and Ask against both surfaces for all 44
  website themes and pins the Chromey pale-green behavior.

## Verification

- Liquidity Map theme contrast: 2/2.
- Website theme suite: 12/12.
- Liquidity Map embed and volume-colour checks: 8/8.
- Scoped ESLint: zero errors (existing workspace warnings remain).
