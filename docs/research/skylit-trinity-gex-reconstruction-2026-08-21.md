# Skylit Trinity GEX reconstruction — 2026-08-21 10:00 ET

## Technical summary

The supplied competitor screenshot is not a differently coloured version of
KwantDesk's current strike profile. The product is **Skylit Trinity** in its
three-panel SPXW/SPY/QQQ layout with **0DTE** selected. The signed row values are
time-varying estimates of dealer gamma inventory. They are not raw OPRA gamma,
not start-of-day OI GEX, and not a colour normalization of either one.

The exact screenshot values were reproduced in Trinity's signed-in replay at
10:00 ET. Replaying the same strikes at 04:00, 09:30, 09:45 and 10:00 proves the
values build through time and can change sign. The missing transformation is
therefore a latent dealer-position state: an estimate of which trades opened,
closed, rolled or transferred inventory, combined with an inferred baseline.

Our current `volume / openInterest` participation model does not estimate that
state. This is a calculation difference, not a palette or display-scale bug.

## Exact target

- Session: Friday, 2026-08-21
- Cutoff: 10:00 ET (`2026-08-21T14:00:00Z`)
- Expiration scope: same-day expiry / 0DTE
- Symbols: SPXW, SPY, QQQ
- Visible rows transcribed from the supplied screenshot: 28
- Trinity replay rows inspected per panel: 92
- Unit: dollar GEX displayed with K/M suffixes

## Trinity replay verifies an intraday state engine

The signed-in Trinity replay was set to Friday, 2026-08-21 at exactly 10:00 AM
ET. The values below matched the supplied competitor screenshot, including
SPXW 7680 at +$21.9158M, SPY 760 at +$215.0608M and QQQ 708 at -$83.2761M.

Selected nodes were then read at four replay times:

| Time ET | SPXW 7680 | SPXW 7675 | SPY 760 | SPY 766 | SPY 768 | QQQ 708 | QQQ 714 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 04:00 | +$1.0786M | -$4.1016M | +$278.4441M | -$49.0386M | -$16.4092M | -$56.3210M | +$9.6300M |
| 09:30 | +$3.7398M | -$6.5263M | +$173.0337M | -$87.2575M | -$21.0619M | -$46.0274M | +$14.3406M |
| 09:45 | +$10.4664M | -$8.3699M | +$196.8316M | -$114.7039M | +$55.6024M | -$74.5908M | +$18.1604M |
| 10:00 | +$21.9158M | -$8.5702M | +$215.0608M | -$80.0403M | +$52.1683M | -$83.2761M | +$24.8849M |

SPY 768 changes from -$21.0619M at 09:30 to +$55.6024M at 09:45. A static
OI formula multiplied by a ticker-wide scalar cannot flip one strike while
other strikes retain different trajectories. Trinity is updating a separate
signed quantity for each option contract or strike.

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
11. Dynamic state models fitted to the observed 09:30, 09:45 and 10:00
    Trinity node transitions, with separate call-buy, call-sell, put-buy,
    put-sell and midpoint OPRA-flow features.

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

### Closest mathematical reconstruction: carried state plus OPRA flow

The time-series evidence was then fitted directly rather than treating the
10:00 screenshot as an independent snapshot:

```text
E_K(t) = rho * E_K(t - 15m)
       + beta_CB * CallBuyGammaFlow_K
       + beta_CS * CallSellGammaFlow_K
       + beta_PB * PutBuyGammaFlow_K
       + beta_PS * PutSellGammaFlow_K
       + beta_CM * CallMidGammaFlow_K
       + beta_PM * PutMidGammaFlow_K
```

The fit used the seven observed Trinity nodes across both 09:30→09:45 and
09:45→10:00 transitions. The results were:

| Dynamic model | R-squared | Node sign | Change direction | Leave-one-symbol-out RMSE |
|---|---:|---:|---:|---:|
| Carry only | 0.9219 | — | 78.6% | $31.84M |
| Carry + classified OPRA gamma-flow buckets | 0.9714 | 100.0% | 85.7% | $43.87M |

The best full-sample flow fit used `rho = 1.09`; bucket coefficients in
CB/CS/PB/PS order were approximately
`-0.169 / +0.070 / +0.655 / -0.166`.

Those coefficients must **not** be copied into production. Although they improve
the full-sample fit, their leave-one-symbol-out error is worse than carrying the
prior node alone. The put-buy coefficient also has the opposite sign expected
from a simple dealer-counterparty model. That means the small sample is using
the visible flow buckets as proxies for an unobserved classifier. The important
result is the model class: prior node state explains most of the variation. A
fresh per-window tape sum does not, and naïve OPRA aggressor signing makes the
cross-symbol result worse.

The fitted `rho > 1` should not be implemented as literal inventory growth. It
absorbs the fact that an unchanged option position has a different dollar GEX
15 minutes later because spot, gamma and time-to-expiry changed. The production
engine should carry **signed contracts**, then revalue those contracts using
current greeks. In contract space the correct form is:

```text
q_i(t) = q_i(t - dt) + inferredDealerContractFlow_i(t)

E_K(t) = sum_i_at_strike_K(
           q_i(t) * gamma_i(t) * 100 * spot(t)^2 * 0.01
         )
```

This is the closest defensible equation to Trinity from the observed replay and
the same OPRA inputs. It naturally preserves overnight state, permits a single
strike to flip sign, and revalues the carried book without inventing trades.
The OPRA update term still requires a calibrated economic-trade and
dealer/open-close classifier; public aggressor side by itself is insufficient.

### Trinity settings checked

The signed-in Trinity controls were inspected so display transforms were not
mistaken for source mathematics:

- `GEX / VEX` changes the greek being displayed;
- `Velocity` and its interval display the change in the node, not the node's
  underlying dollar-state formula;
- `Node %` expresses each node as a share of the largest absolute node;
- `Color scale` changes presentation only;
- `Center on spot` and `Center on King` change scroll position only;
- the `Confluence halo` compares current 5m, 10m and 15m direction agreement;
- replay exposes 1m, 5m, 10m, 15m, 1h, 4h and 1d node history.

None of these controls is a hidden unit conversion capable of turning ordinary
OI GEX into the displayed dollar rows.

### The target implies a small, strike-specific signed inventory share

For each row, gross OI gamma was calculated without assuming that calls are
positive and puts are negative:

```text
GrossOIGEX(K, t) = 100 * S(t)^2 * 0.01
                 * sum(gamma_i(t) * openInterest_i)
```

Dividing the Trinity target by gross OI gamma estimates the signed fraction of
gross contract gamma that would have to remain in dealer inventory at that
strike. This diagnostic ranges from -0.21% to +1.39% for the sampled SPXW
strikes, -15.41% to +18.60% for SPY, and -28.13% to +8.73% for QQQ. Every sampled
row remains inside the physical `[-100%, +100%]` OI bound.

That makes a latent inventory model plausible. It also shows why a global
multiplier fails: the required fraction is different in both sign and magnitude
at each strike.

## Why KwantDesk currently differs

`deriveSessionVolumeGamma` in `src/lib/quantData.server.ts` takes the structural
call and put gamma at a strike and scales each side by `volume / openInterest`
(capped at 8). Algebraically, before the cap, this is a call-volume-minus-put-
volume gamma profile. It is a structural/participation hybrid.

Trinity is instead consistent with an inferred signed dealer-positioning state
that is updated independently at every contract or strike. That is a different
measurement, so the discrepancy is expected and should not be corrected with a
colour or normalization multiplier.

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

### 1. Dealer inventory GEX — intraday

For every option contract `i` and economic trade `j`:

```text
gammaDollar1pct_i(t) = gamma_i(t) * 100 * spot(t)^2 * 0.01

dealerTradeSign_j =
  -1  customer buys an option; dealer inventory becomes shorter gamma
  +1  customer sells an option; dealer inventory becomes longer gamma
   0  direction or economic role is unresolved

signedDealerContracts_i(t) = signedDealerContracts_i(t - dt)
                           + sum(contracts_j
                                 * dealerTradeSign_j
                                 * dealerCounterpartyProbability_j
                                 * economicTradeWeight_j
                                 * complexLegWeight_j
                                 * quoteConfidence_j)

DealerGEX(K, t) = sum(gammaDollar1pct_i(t)
                      * signedDealerContracts_i(t))
                  for contracts i at strike K
```

The option type does not reverse the sign of dealer gamma: a long call and a
long put both have positive gamma. Call-positive/put-negative is a structural
convention, not an observed dealer position. Required score ranges are:

- `dealerCounterpartyProbability`: `0..1` probability that a dealer is the
  opposite side of the aggressor rather than another customer or non-dealer;
- `economicTradeWeight`: `0..1`, zeroing duplicate parent/child records and
  reducing prints whose economic role cannot be isolated;
- `complexLegWeight`: `0..1`, with defined spread/roll netting;
- `quoteConfidence`: `0..1`, highest at/through NBBO and lowest at midpoint.

Opening-versus-closing probability constrains persistence and the next OI
reconciliation; it does not reverse the immediate gamma sign. A customer buy
still requires the inferred dealer counterparty to sell that option, whether
the customer opened a long or closed a short.

The intraday accumulator must not reset to zero at the cash open. Trinity already
has non-zero nodes at 04:00 ET, so it starts from a carried baseline. The engine
must snapshot signed contract inventory, apply time-ordered trade updates, and
revalue the entire carried inventory against current spot and contract gamma on
every frame. A ten-minute change should be a separate chip, not substituted for
the main row value.

### 2. Dealer OI GEX — structural

```text
DealerOIGEX(K, t) = sum(gamma_i(t) * signedDealerContracts_i(t))
                    * 100 * spot(t)^2 * 0.01
```

This view uses a standing inventory estimate and should remain available outside
RTH. It must not silently replace Flow GEX during a live session.

## Calibration method

The open/close and customer scores should be calibrated against future observed
OI changes and held-out sessions, not against the 28 screenshot numbers.

1. Infer a bounded signed baseline for every contract from current OI, previous
   sessions and the next available OI reconciliation.
2. Group consolidated and comprising prints into unique economic trades.
3. Infer NBBO aggressor and assign quote confidence.
4. Detect complex strategies and neutralize paired, hedged and rolled legs.
5. Estimate opening/closing probability and update signed dealer contracts in
   event-time order.
6. Reconcile the next published OI change as a delayed training label.
7. Train by symbol class (cash index, ETF) and validate on untouched dates.
8. Reject a model unless row signs, ranking, and dollar error remain stable on
   held-out sessions.
9. Persist the inferred state every snapshot so replay reproduces exactly what
   was visible live.

## Identifiability limit

At a strike containing both calls and puts, Trinity supplies one displayed
number while the unknown dealer call inventory and dealer put inventory are two
separate quantities. OPRA does not publish either quantity. Therefore the exact
proprietary contract-level state cannot be uniquely solved from one screenshot,
or even from the observed row history, without additional labelled assumptions.

The replay evidence identifies the required model class and lets us reject the
current KwantDesk calculation. It does not justify copying fitted per-strike
numbers into production. The defensible implementation is an independently
calibrated state engine trained against later OI changes and validated on
untouched sessions.

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

- The exact values and time evolution in this report were verified directly in
  the signed-in Trinity replay on `app.skylit.ai/trinity` at the stated times.
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
  dynamic carried-state reconstruction and symbol holdout diagnostics.
