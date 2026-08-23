# Skylit Heatseeker GEX reconstruction — 2026-08-21 10:00 ET

## Decision

The supplied competitor screenshot is not a differently coloured version of
KwantDesk's current strike profile. It is **Skylit Heatseeker** in its
three-panel SPXW/SPY/QQQ layout with **0DTE** selected. Skylit describes the
displayed values as live dealer gamma exposure derived through custom inference
models and proprietary dealer-microstructure intelligence, rather than raw
vendor GEX repackaged without further modelling.

The values cannot be reproduced by applying a public, deterministic GEX formula
to the OPRA fields available at 10:00 ET. The missing transformation is the
competitor's proprietary estimate of signed position creation and removal from
the option tape.

This is a calculation finding, not a colour-map finding.

## Exact target

- Session: Friday, 2026-08-21
- Cutoff: 10:00 ET (`2026-08-21T14:00:00Z`)
- Expiration scope: same-day expiry / 0DTE
- Symbols: SPXW, SPY, QQQ
- Visible rows transcribed from the supplied screenshot: 28
- Unit: dollar GEX displayed with K/M suffixes

## Data and completeness checks

The reconstruction used the existing KwantDesk VPS options routes and did not
enable usage-based Databento access.

Inputs included:

- exact 0DTE option greeks at the requested strikes;
- start-of-day open interest;
- cumulative contract volume;
- consolidated trades from the 09:30 ET open through the cutoff;
- comprising trades for consolidated/complex prints;
- provider sentiment classifications;
- exact bid/ask trade-side statistics;
- trade volume, premium, delta, vega, gamma, OI, previous OI and OI change;
- cutoffs from 09:56 through 10:03 ET to cover timestamp, transport and
  screenshot-capture alignment around the requested 10:00 ET observation;
- rolling windows of 2, 5, 10, 15, 20 and 30 minutes plus session-to-date.

The exhaustive tape reader paginates each requested strike. The independent
contract trade-side endpoint was also used, so the conclusion is not caused by
a 100-row display or API pagination cap.

## Models tested

The audit evaluated 166,320 constrained candidate models, followed by bucket,
state-change and provider-sentiment searches. Candidate families included:

1. Standard OI GEX per 1% and per $1 move.
2. Call-volume minus put-volume GEX.
3. Dealer gamma flow inferred from ask/bid execution.
4. Directional customer flow: call buys and put sells positive; call sells and
   put buys negative.
5. All six independent execution buckets: call buy/sell/mid and put
   buy/sell/mid.
6. Opening-only, simple-only and classified-only prints.
7. Contract count, premium, gamma, delta-notional, vega and strike-scaled bases.
8. Latest contract-state volume, OI and OI-change snapshots.
9. Gamma-state changes from the session open to the cutoff.
10. Provider bullish/bearish sentiment, including simple-trade-only variants.

## Measured result

### Exact 0DTE model family

| Candidate | Best scale | R-squared | RMSE |
|---|---:|---:|---:|
| OI GEX / 1% | 0.008946 | -0.0119 | $57.35M |
| OI GEX / $1 | 0.113609 | -0.0076 | $57.23M |
| Volume GEX / 1% | -0.003507 | 0.0189 | $56.47M |
| Sampled dealer flow | 0.017291 | 0.0043 | $56.89M |
| Exact bid/ask dealer flow | 0.022251 | 0.0165 | $56.54M |
| Directional customer flow | -0.000533 | -0.0160 | $57.46M |

The exact dealer-flow calculation explains only 1.65% of the cross-strike
variation. A scale or unit mismatch would retain the row signs and produce an
R-squared near one. It does neither.

### Wider search

| Search | Best in-sample result | Validation result |
|---|---:|---:|
| Constrained rule search | R-squared 0.2029 | Holdout RMSE $59.22M |
| Best ternary execution-bucket rule | R-squared 0.2214 | Holdout RMSE $58.16M |
| Six independently fitted execution buckets | R-squared 0.4405 | Holdout RMSE $175.70M |
| Contract-state snapshots | R-squared 0.1075 | Holdout RMSE $65.07M |
| Gamma state-change models | R-squared 0.0583 | Holdout RMSE $62.78M |
| Provider-sentiment models | R-squared 0.0954 | Holdout RMSE $58.68M |

The six-bucket regression can force a better in-sample shape, but its holdout
error triples. Its coefficients also assign contradictory economic meanings to
equivalent executions. It is an overfit, not the competitor formula.

## Why KwantDesk currently differs

`deriveSessionVolumeGamma` in `src/lib/quantData.server.ts` takes the structural
call and put gamma at a strike and scales each side by `volume / openInterest`
(capped at 8). Algebraically, before the cap, this is a call-volume-minus-put-
volume gamma profile. It is a structural/participation hybrid.

The competitor screenshot is Skylit's inferred live dealer-positioning state.
That is a different measurement, so the discrepancy is expected and should not
be corrected with a colour or normalization multiplier.

## The missing state variable

OPRA publishes executions, quotes and contract identifiers. It does not publish
the trader's identity, dealer/customer flag, or a reliable opening-versus-
closing flag for every print. Bid/ask inference estimates aggressor direction,
but aggressor direction alone does not reveal whether the execution created a
new position, reduced an old position, or represented one leg of a spread.

Skylit's public material confirms that its exposure calculations use custom
inference models. The row values therefore require an internal position-
attribution layer. That layer can include:

- opening/closing probability;
- customer/dealer probability;
- complex-order grouping and leg attribution;
- spread/roll neutralization;
- midpoint and crossed-market confidence;
- a session baseline and inventory decay;
- suppression of duplicated consolidated/comprising prints.

## KwantDesk model to own

KwantDesk should expose two honest, separate calculations.

### 1. Flow GEX — intraday

For every 0DTE execution `i` at strike `K`:

```text
gammaDollar1pct_i = gamma_i * contracts_i * 100 * spot_i^2 * 0.01

direction_i =
  +1  call bought at/above ask
  -1  call sold at/below bid
  -1  put bought at/above ask
  +1  put sold at/below bid

positionChange_i = direction_i
                 * openCloseScore_i
                 * customerScore_i
                 * complexLegWeight_i
                 * quoteConfidence_i

FlowGEX(K, t) = sum(gammaDollar1pct_i * positionChange_i)
                for sessionOpen <= i.time <= t
```

Required score ranges:

- `openCloseScore`: `-1` closing, `0` unknown, `+1` opening;
- `customerScore`: `0..1` probability that the aggressor represents customer
  directional demand rather than dealer/intermarket activity;
- `complexLegWeight`: `0..1`, with defined spread/roll netting;
- `quoteConfidence`: `0..1`, highest at/through NBBO and lowest at midpoint.

This model must reset at the session open. Its ten-minute change should be a
separate chip, not substituted for the main row value.

### 2. Dealer OI GEX — structural

```text
DealerOIGEX(K, t) = sum((callGamma * signedCallInventory)
                      + (putGamma * signedPutInventory))
                      * 100 * spot^2 * 0.01
```

This view uses a standing inventory estimate and should remain available outside
RTH. It must not silently replace Flow GEX during a live session.

## Calibration method

The open/close and customer scores should be calibrated against future observed
OI changes and held-out sessions, not against the 28 screenshot numbers.

1. Group consolidated and comprising prints into unique economic trades.
2. Infer NBBO aggressor and assign quote confidence.
3. Detect complex strategies and neutralize paired/rolled legs.
4. Estimate each contract's intraday net-new position.
5. Reconcile the next published OI change as a delayed training label.
6. Train by symbol class (cash index, ETF) and validate on untouched dates.
7. Reject a model unless row signs, ranking, and dollar error remain stable on
   held-out sessions.
8. Persist the inferred state every snapshot so replay reproduces exactly what
   was visible live.

## Production guardrails

- Do not fit a per-symbol scalar to make one screenshot look correct.
- Do not use heatmap intensity as the source number.
- Do not mix 0DTE and all-expiry rows.
- Do not count a consolidated parent and its comprising legs twice.
- Do not assign midpoint trades full directional confidence.
- Show source timestamp, expiry scope and model name in the panel.
- Keep Flow GEX and Dealer OI GEX selectable and visibly distinct.
- Never label an unavailable Flow GEX frame as zero.

## Skylit source checks

- Skylit's product page identifies Trinity Mode as the simultaneous SPXW, SPY
  and QQQ dealer-exposure view:
  <https://www.skylit.ai/>.
- Skylit's GEX methodology article defines Heatseeker values as dealer gamma
  exposure at each strike and the King Node as the largest absolute GEX:
  <https://www.skylit.ai/learn/gamma-exposure>.
- Skylit's comparison article states that its displayed exposure is produced by
  custom inference models and proprietary dealer-microstructure intelligence,
  not raw vendor data alone:
  <https://www.skylit.ai/learn/best-gex-tools>.

## Reproduction

- `scripts/reconcile-opra-gex-2026-08-21.mjs` — exact 0DTE chain and trade-side
  reconciliation.
- `scripts/reconcile-full-chain-gex-2026-08-21.mjs` — full-chain structural and
  flow comparison.
- `scripts/reverse-engineer-opra-live-flow-2026-08-21.mjs` — paginated target-
  strike tape, 166,320 constrained combinations, bucket/state/sentiment models,
  and holdout diagnostics.
