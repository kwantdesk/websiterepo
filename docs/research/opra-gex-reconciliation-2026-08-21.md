# OPRA GEX numerical reconciliation — 2026-08-21 10:00 ET

## Objective

Determine whether the competitor strike values shown at 10:00 ET can be reproduced from standard OPRA-derived gamma-exposure calculations, independent of heatmap colour.

The comparison uses the exact visible strike values from the supplied screenshots for SPXW, SPY, and QQQ. The timestamp is `2026-08-21T14:00:00Z` (10:00 ET).

## Data used

- Consolidated OPRA-style option-chain frames at the exact 10:00 ET timestamp.
- All expiry buckets returned for each underlying, not only the displayed or front expiry.
- Start-of-day open interest by contract.
- Contract gamma and the latest contract state at or before the cutoff.
- Consolidated option prints from 09:30 through 10:00 ET.
- Trade-side classification using the contemporaneous bid/ask category when available: ask or above ask is treated as a customer buy; bid or below bid as a customer sell; midpoint prints remain unclassified.

The data was requested through the existing KwantDesk VPS market-data gateway. This investigation did **not** enable Databento usage-based billing and did not issue a paid direct OPRA historical download.

## Candidate calculations

### 1. Positional GEX from open interest

For each strike and expiry:

```text
GEX(1% move) = (call_gamma * call_OI - put_gamma * put_OI)
               * contract_multiplier * spot^2 * 0.01
```

The full-chain strike value is the sum across all returned expiries.

### 2. Positional GEX per $1 move

```text
GEX($1 move) = (call_gamma * call_OI - put_gamma * put_OI)
               * contract_multiplier * spot
```

### 3. Intraday gamma-flow candidates

The reconstruction also tested:

- call-volume gamma minus put-volume gamma;
- dealer gamma flow inferred from ask/bid trade classification;
- directional customer gamma flow;
- opening-only dealer and directional flow;
- latest cumulative-volume snapshot gamma;
- latest open-interest snapshot gamma.

Each candidate was fitted with one global scalar solely to test whether the competitor used the same underlying calculation in a different unit. A valid unit mismatch would retain the signs and produce a high R-squared.

## Result

No tested OPRA-standard candidate reproduces the competitor numbers.

| Candidate | Best global scale | R-squared | RMSE |
|---|---:|---:|---:|
| Full-chain positional GEX | -0.011893 | 0.0279 | $56.21M |
| Call-minus-put gamma flow | -0.030878 | 0.1187 | $53.52M |
| NBBO-classified dealer gamma flow | 0.016407 | 0.0051 | $56.86M |
| Directional customer gamma flow | 0.043889 | 0.0710 | $54.95M |
| Opening-only dealer flow | 1.227941 | -0.0127 | $57.37M |
| Latest cumulative-volume snapshot | -0.003741 | 0.0255 | $56.28M |
| Latest open-interest snapshot | -0.009059 | 0.0103 | $56.72M |

The best of these explains only 11.9% of the cross-strike variation. More importantly, several exact strikes have the opposite sign, so this is not a display-unit or divisor problem.

## Exact strike evidence

| Symbol | Strike | Competitor | Full-chain positional GEX |
|---|---:|---:|---:|
| SPXW | 7,680 | +$21.92M | +$1,367.02M |
| SPXW | 7,670 | -$1.73M | +$715.28M |
| SPXW | 7,640 | +$11.65M | -$1,120.14M |
| SPY | 765 | -$21.43M | -$3,100.60M |
| SPY | 764 | +$88.36M | -$158.46M |
| SPY | 760 | +$215.06M | -$1,788.61M |
| QQQ | 715 | +$10.95M | -$77.80M |
| QQQ | 712 | -$37.67M | +$100.86M |
| QQQ | 700 | +$29.16M | -$1,036.80M |

The reconstruction processed 640 SPX, 1,103 SPY, and 1,034 QQQ consolidated option-print rows through 10:00 ET in addition to the exact chain frame.

## What this establishes

1. The competitor is not showing the same full-chain positional GEX formula with a different colour or simple scale.
2. It is not enough to switch KwantDesk from front-expiry to all-expiry open-interest GEX; that would still produce materially wrong signs and magnitudes.
3. “Calculated from OPRA” describes the raw market-data source, not the proprietary exposure model. OPRA does not publish a ready-made signed dealer-GEX value.
4. The competitor likely applies at least one proprietary state layer: a restricted expiry/contract universe, a dealer-position sign model, trade-side inventory adjustments, rolling baselines, filters, or some combination of them.
5. Blindly normalizing KwantDesk values to match the screenshot would create fabricated numbers and would fail as soon as the strike distribution changes.

## Correct next calibration step

To identify the remaining transformation rather than guess it, capture at least two additional competitor frames from the same session, ideally 09:35, 10:00, and 10:30 ET, with:

- selected expiry or aggregation setting;
- selected metric and leg filters;
- exact underlying price;
- the complete strike table for SPXW, SPY, and QQQ.

Then fit changes between frames, not just absolute values. This separates static OI inventory from intraday flow and reveals whether values reset at the open, accumulate from 09:30, or use a rolling interval.

## Reproducible scripts

- `scripts/reconcile-opra-gex-2026-08-21.mjs` tests front-expiry positional and exact trade-side candidates.
- `scripts/reconcile-full-chain-gex-2026-08-21.mjs` tests the exact full-chain frame and consolidated 09:30–10:00 flow variants.
