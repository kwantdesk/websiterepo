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

### Full-lattice untouched 10:00 validation

The state result was subsequently repeated against the complete visible
SPXW/SPY/QQQ lattice rather than the seven illustrative nodes above. Model
selection used only the 09:50 and 09:55 frames; the 10:00 frame remained
untouched. Across 275 strike rows:

| Model | 10:00 R-squared | RMSE | MAE | Row-sign accuracy |
|---|---:|---:|---:|---:|
| Fresh OI/volume/OPRA snapshot families | at most 0.0189 | at least $56.47M | — | approximately 47–61% |
| Previous signed node state only | 0.97889 | $2.706M | $0.797M | 96.0% |
| Carried state plus classified OPRA level/change features | **0.97965** | **$2.656M** | $0.938M | 86.55% |

The OPRA-enhanced state model was selected without seeing 10:00. Exact examples
from that untouched frame were:

| Node | Trinity | Reconstructed |
|---|---:|---:|
| SPXW 7640 | +$11.647M | +$12.020M |
| SPXW 7675 | -$8.570M | -$7.504M |
| SPXW 7680 | +$21.916M | +$18.164M |
| SPY 760 | +$215.061M | +$216.371M |
| SPY 766 | -$80.040M | -$76.306M |
| QQQ 708 | -$83.276M | -$89.332M |
| QQQ 714 | +$24.885M | +$20.607M |

This is the decisive mathematical result. The cross-section cannot be recovered
from a static OPRA snapshot, while a strike-specific signed state carried from
the preceding frame reproduces almost all of it. The remaining 2.03% is the
unobserved trade-attribution and economic-order logic that Skylit describes as
its proprietary inference layer.

The production equation should keep the display normalization explicit until
the unit convention is independently verified:

```text
signedDealerContracts_i(t)
  = signedDealerContracts_i(t - dt)
  + sum_j(contracts_j
          * dealerTradeSign_j
          * P(dealer counterparty | j)
          * P(economic opening/closing role | j)
          * complexLegWeight_j
          * quoteConfidence_j)

NodeGEX_K(t)
  = sum_i_at_strike_K(
      signedDealerContracts_i(t)
      * gamma_i(t)
      * contractMultiplier_i
      * displayMove_i(t)
    )
```

For a one-dollar underlying move, `displayMove = spot`; for the common one-percent
GEX convention, `displayMove = spot^2 * 0.01`. This normalization changes units
and magnitude only. It cannot create Trinity's strike-by-strike sign pattern;
that comes from `signedDealerContracts`.

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
- Skylit's dealer-positioning guide distinguishes nodes that actively build or
  unwind from static hedge nodes, which is consistent with the carried-state
  result and inconsistent with a fresh OI-only calculation:
  <https://www.skylit.ai/learn/dealer-positioning>.

## Reproduction

- `scripts/reconcile-opra-gex-2026-08-21.mjs` — exact 0DTE chain and trade-side
  reconciliation.
- `scripts/reconcile-full-chain-gex-2026-08-21.mjs` — full-chain structural and
  flow comparison.
- `scripts/reverse-engineer-opra-live-flow-2026-08-21.mjs` — paginated target-
  strike tape, 166,320 constrained combinations, bucket/state/sentiment models,
  dynamic carried-state reconstruction and symbol holdout diagnostics.

## Addendum — 2026-08-27 — scope isolated, and a correction

Re-opened after a fresh side-by-side at **10:26 ET on 2026-08-26**, both products
in replay on the same minute and the same strikes. The 2026-08-21 conclusion
reproduced from data it never saw.

### Correction: GEX MAP does not use `deriveSessionVolumeGamma`

The "Why KwantDesk currently differs" section above attributes the divergence to
`deriveSessionVolumeGamma`'s `volume / openInterest` participation scaling. That
is true of the Classic GEX profile and the gameplan surface, but **not** of the
GEX MAP panel, which is the surface being compared. `getGexMapPanel` contains no
reference to it.

What GEX MAP actually does:

```text
getGexMapPanel
  -> quantDataPost("/options/tool/exposure-by-strike", { representationMode })
  -> parseExposure: net = callExposure + putExposure, summed over expiries in scope
```

We compute no gamma of our own on this surface. **Our levels are QuantData's
levels.** The comparison is therefore QuantData's dealer-exposure model against
Skylit's, not our arithmetic against theirs. That does not change the required
build, but it does change where the number comes from.

### Scope was isolated from model, and it is not the answer

`scripts/compare-gexmap-vs-trinity-scope.mjs` replays the captured QuantData
interval map against the captured Trinity lattice for the same minute, once
filtered to 0DTE and once across all expirations. If the divergence were a scope
mismatch, correlation would rise sharply when scope is matched.

| Symbol | Scope | Strikes | Sign match | r | Gross QD/Trinity |
|---|---|---:|---:|---:|---:|
| SPXW | 0DTE | 67 | 54% | 0.141 | 332.6x |
| SPXW | ALL-EXP | 78 | 56% | 0.141 | 594.3x |
| SPY | 0DTE | 36 | 47% | 0.006 | 7.7x |
| SPY | ALL-EXP | 63 | 52% | -0.131 | 17.2x |
| QQQ | 0DTE | 49 | 53% | 0.244 | 9.2x |
| QQQ | ALL-EXP | 75 | 51% | 0.024 | 15.4x |

Matching the scope roughly halves the magnitude gap (SPY 17.2x → 7.7x) and moves
correlation by at most +0.22. Best absolute correlation anywhere in the table is
**0.244**; sign agreement never leaves the 47–56% band, which is a coin flip.

Scope is worth fixing for honesty — the guardrail "do not mix 0DTE and all-expiry
rows" stands — but it converges nothing.

### Independent confirmation from the 2026-08-26 frame

The 08-26 screenshots were transcribed and compared with no reference to the
08-21 work. SPY, 23 overlapping strikes, ours on ALL EXP:

- sign agreement **12/23**;
- ratio spread where signs even agree: **6.5x to 1735x**;
- gross ratio **17.2x** — the same figure the 08-21 SPY ALL-EXP row produces.

Two independent sessions, five days apart, agree. A units difference cannot be
the cause: `$1` and `1%` differ by `spot/100`, a positive scalar, and a positive
scalar cannot flip a sign or change a correlation.

### Standing conclusion

Unchanged and now better supported. QuantData and Skylit measure different
quantities. The gap closes only by building the carried dealer-inventory state
engine specified in "KwantDesk model to own" above — for which the measured
ceiling remains R-squared 0.979 and 96% row-sign accuracy on an untouched frame,
with the residual being Skylit's unobservable trade-attribution layer.

## Addendum — 2026-08-27 — v2 engine built and calibrated

`src/lib/gexMapV2.ts`, with `test:gex-map-v2` (16 checks),
`research:gex-map-v2` and `scripts/calibrate-gex-map-v2.mjs`. v1 is untouched
and tagged `gex-map-v1` at `6ea90a4a`.

### The classifier inputs were available all along

The main report states that OPRA publishes no dealer flag and no reliable
open/close flag, so the classifier would need an unobservable inference layer.
That understated what the provider actually delivers. Each consolidated print
carries `tradeSideCode` (ASK / ABOVE_ASK / BID / BELOW_BID / MID_MARKET),
`tradeConsolidationType` (SWEEP / BLOCK / SPLIT) with `comprisingTrades` for
de-duplication, `greeks.gamma` per contract, plus `openInterest`, `size`,
`stockPrice`, `strikePrice` and `contractType`.

The dealer sign is therefore read, not guessed: a customer lifting the offer
leaves the dealer short that option and short gamma. Only `MID_MARKET` is
genuinely unresolvable, and it is dropped rather than assigned a direction.

`isOpeningPosition` is the one label that is NOT usable — true on 2 records out
of 417 in the sampled session. Gating on it would discard the tape.

### Accumulation policy, scored on every captured frame

Because there is no usable open/close flag, the engine needs a policy for how
long absorbed flow keeps counting. Each policy was scored against all four
captured Trinity frames rather than one, since a policy that wins on a single
minute is fitted to noise.

Mean cross-strike correlation (worst frame in brackets):

| Policy | SPXW | SPY | QQQ |
|---|---:|---:|---:|
| carry (nothing closes) | -0.302 | 0.120 (-0.187) | 0.001 |
| decay 24h | 0.180 | -0.057 | 0.076 |
| decay 6h | 0.564 | -0.342 | 0.043 |
| **decay 3h** | **0.603 (0.528)** | -0.330 | 0.038 |
| session only | 0.635 (0.458) | -0.450 | 0.165 |
| **v1 baseline** | **0.141** | **0.006** | **0.244** |

`carry` is actively wrong on the index, which settles the open/close question:
treating every classified print as a position still held is worse than useless.

Session-only edges the mean but is materially worse on the worst frame, is a
cliff rather than a rate, and means nothing for a non-0DTE expiry. **A 3-hour
half-life is the shipped default**; `decayDealerInventory` applies it to the
whole book once per step, which a test proves is identical to decaying each
trade individually.

### Result, stated plainly

- **Cash index: v2 beats v1 by 4.3x** (0.603 against 0.141), holding its sign on
  every frame.
- **ETFs: v2 is WORSE than v1** (SPY -0.330 against 0.006; QQQ 0.038 against
  0.244).

A plain aggressor rule works where 0DTE flow is overwhelmingly opening and
directional, and fails where much of the tape is hedging, covered-call and
spread activity that an aggressor flag alone reads backwards.

`v2Readiness()` therefore reports `validated` only for cash indices and
`experimental` for everything else. v2 must not present itself as authoritative
on a symbol where it measured worse than the thing it replaces.

### Next

Calibrate `dealerCounterpartyProbability` and an open/close weight against
observed OI change — the one real ground-truth label available — and re-score.
That is what should move the ETFs.

## Addendum — 2026-08-27 — why a node is negative for them and positive for us

The single most important measurement in this whole file, and it is one line:

**v1's sign is decided by chain composition, 100% of the time.**

| Symbol | v1 sign == whichever side carries more gamma-weighted OI | v1 sign == Trinity | put-heavy strikes v1 calls negative |
|---|---:|---:|---:|
| SPXW | **100%** | 55% | 75% |
| SPY | **100%** | 50% | 84% |
| QQQ | **100%** | 50% | 96% |

`parseExposure` computes `net = callExposure + putExposure`, and the provider
signs calls positive and puts negative. So the sign of every v1 row is just
`sign(|callExposure| - |putExposure|)`. Put-heavy strike, negative node.
Call-heavy strike, positive node. There is no third possibility and no input
from anyone's positioning.

Trinity's sign is decided by which way dealers actually ended up positioned,
which is a different question with a different answer. Two unrelated binary
signals agree about half the time, and that is exactly the 50-55% observed.

**This is why no setting closes the gap.** Units, expiry scope, greek, palette,
interval - none of them can change `sign(|call| - |put|)`. A strike that is
put-heavy will read negative on v1 forever, however the dealers are positioned
in it.

Their published material is consistent with this being the real difference:
positive GEX is defined as dealers long gamma and negative as dealers short
gamma (`/learn/gamma-exposure`), and the framing throughout is
"every option the gambler buys creates a hedge the dealer must execute"
(`/learn/dealer-positioning`) - an inferred dealer position, not a chain
statistic. The formula itself is deliberately not published.

### v2 escapes it

Because v2 multiplies per-contract gamma by INFERRED DEALER CONTRACTS, which
carry their own sign, its rows are no longer dictated by the chain's shape:

| Symbol | v2 sign == bigger side of chain | v2 sign == Trinity |
|---|---:|---:|
| SPXW | 47% (v1: 100%) | 66% |
| SPY | 36% (v1: 100%) | 59% |
| QQQ | 44% (v1: 100%) | 40% |

That is the structural confirmation the model class is right: v2 is answering
the question Trinity answers, where v1 was answering a different one.

## Addendum — 2026-08-27 — flow calibration against open interest

### Ground truth derived, not assumed

Open interest is a real label: `OI = opens - closes` and `Volume = opens + closes`,
so `opening fraction = (1 + OI/V) / 2`. The 45MB capture holds every trade in
the 2026-08-21 expiry across its whole 78-session life, and the chain snapshot
holds that expiry's open interest, so the fraction is measurable rather than
assumed:

| Symbol | contracts | aggregate OI/V | opening fraction |
|---|---:|---:|---:|
| SPXW | 473 | 0.229 | **0.615** |
| SPY | 291 | 0.388 | **0.694** |
| QQQ | 209 | 0.380 | **0.690** |

So 62-69% of volume opens and 31-38% closes. Note the consequence: cumulative
flow over a contract's life is roughly four times its standing open interest.

### The OI bound is not what sets the values

That raised the obvious worry - that `DEALER_INVENTORY_OI_BOUND` was clipping
most positions, which would make v2 a structural quantity in disguise and land
it in exactly v1's trap. It is not:

| Symbol | positions at the bound | median abs(inventory)/OI | p90 |
|---|---:|---:|---:|
| SPXW | 2% | 0.001 | 0.080 |
| SPY | 5% | 0.000 | 0.157 |
| QQQ | 9% | 0.000 | 0.223 |

The flow sets the values. Those p90 fractions also sit in the same range as the
signed OI-gamma share the main report derived from Trinity's own rows
(-0.21%..+1.39% SPXW, -15%..+19% SPY, -28%..+9% QQQ).

### Every available lever, swept

Mean across all four captured frames:

| Variant | SPXW r | SPY r | QQQ r |
|---|---:|---:|---:|
| **baseline, 3h decay** | **0.603** | -0.330 | 0.038 |
| buys only | 0.033 | 0.458 | -0.050 |
| sells only | 0.327 | -0.439 | 0.052 |
| buy bias 2x | 0.414 | -0.066 | -0.046 |
| buy bias 0.5x | 0.523 | -0.431 | 0.040 |
| size >= 10 / 50 / 200 | 0.546 / 0.387 / 0.573 | -0.302 / -0.228 / 0.009 | 0.034 / 0.028 / -0.113 |

**Nothing beats the shipped baseline on the index.** Combined with the earlier
half-life, session-versus-carry, sign-flip and bound sweeps, the levers
reachable in this data are exhausted and the shipped configuration is the best
of them.

### Why the ETFs cannot be fixed from this capture

The calibration tape carries `side` collapsed to BUY / SELL / MID. The LIVE path
receives strictly more: `tradeSideCode` at five levels (ABOVE_ASK / ASK / BID /
BELOW_BID / MID_MARKET), plus `tradeConsolidationType`, `tradeType`,
`greeks.gamma`, `openInterest` and `premium` per print.

Aggressor strength, sweep-versus-split and multi-leg detection are precisely the
distinctions that separate directional customer positioning from hedging and
spread activity - which is the diagnosis for why a plain aggressor rule works on
the index and reads backwards on the ETFs. The shipped classifier already uses
those five levels and the consolidation weight; they simply cannot be scored
against this capture.

**Next step is data capture, not model search:** record a live session's
consolidated tape with the full field set alongside Trinity frames, then re-run
this sweep against it. Searching further on the collapsed tape would be fitting
to noise.

## Addendum — 2026-08-27 — v2 measured against Trinity for the first time

Read directly out of the live API rather than a screenshot, SPX,
`model=DEALER_INVENTORY`, 2026-08-26:

| | v2 | v1 |
|---|---:|---:|
| cross-strike correlation | **0.481** | 0.141 |
| sign agreement | 56% | 55% |
| gross magnitude vs Trinity | **0.54x** | 142x |
| star node | **7670** | — |
| Trinity King node | **7670** | — |

**Both products pick the same King.** That is the first genuine agreement
anywhere in this investigation, and it is a lower bound: our reading is session
close (20:00Z) while the Trinity frame is the 11:15 replay, so they are
different minutes.

Magnitude went from 142x too large under v1 to 0.54x - about half. Half a
session's inventory is exactly what a truncated tape produces, so the page cap
was the binding constraint on magnitude rather than anything in the model. Raised
40 -> 100 pages.

### Two further model leaks found and closed

Both are the same failure as the empty-book fallback: v1 numbers presented under
a v2 label.

1. **`frames` were the structural frames.** They drive the change columns and
   replay, so the ladder was v2 while the history beside it was v1 - in the one
   place a trader reads to see how a node is BUILDING. v2 now ships no frames at
   all rather than another model's. Deriving them needs the book rebuilt per
   lookback, which waits for a persisted state.
2. **Decay was applied once to the whole book** instead of per trade, which is a
   global scalar and changes no relative value. The panel was silently running
   `carry`, measured at -0.302 where the shipped policy measures +0.603.

### Still open

Sign agreement is 56% against Trinity's own 96% frame-to-frame. The times do not
match, which accounts for some of it, but not all. Next measurement should be
like-for-like: the same minute on both products.
