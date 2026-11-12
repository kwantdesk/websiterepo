# Bollinger Bands overhaul

Eleventh in the chart indicator checklist. Bollinger Bands draws a trailing simple moving average of candle closes and two bands separated from that average by the selected multiple of population standard deviation.

## Findings and changes

- Bands used the short indicator history window and could stop before earlier loaded candles. The chart now uses its deeper indicator history window. The existing replay cutoff still applies.
- Computing variance from uncentered prices lost precision on high-priced instruments with small price changes. Centered rolling moments preserve those changes and calculate all three plots in one pass. Imported numeric settings obey the same bounds as the dialog.
- A correction to an interior candle could be skipped by the overlay's tail-only sync. The overlay now checks changed intermediate points before deciding whether to update just the last point.
- The live overlay waited for a sampled React update. It now paints from the same canonical candle callback as price, using the actual chart timestamp for event bars. It retains pending paints through a late sample and reconciles them with newer or corrected history. The buffer resets on chart scope change and clears for replay.

## Evidence

- Four focused tests passed for the formula, precision, replay and delayed sample handling. The synthetic instrument and interval matrix checked 2,860 supported combinations across three parameter sets, for 8,580 calculations and replay checks. It retained 540 combinations marked unavailable by their source. This verifies the calculation and interval wiring under fixture inputs.
- The isolated chart used 2,500 recorded NQ one-minute bars. Length 50 produced 2,451 points per plot. An interior correction changed the basis from 28,241.18 to 28,241.68 and updated both bands. The live paint measured about 820 ms before the direct path and 46–53 ms after it. A later sample kept the painted values. A synthetic 500-volume chart, including multiple bar timestamps within a second, measured about 63 ms and preserved the chart-time mapping.
- The same chart verified Length and Standard deviations changing calculations and surviving a normalized settings reload. Replay showed 1,781 causal points after changing the length to 21 and ignored a live event. The Pink → Blue palette changed all three plots. Three custom colours reached their respective native series. Visible removed all three plots and restored them on re-enable. No browser errors were reported.
- The site-wide plot-colour and template scripts reported other studies' slot mismatches and a volume-profile preference assertion. Those checks are tracked separately. Production-provider cadence, complete history across all feeds, and the DeepChart desktop checks remain open.

## Reference

- John Bollinger specifies a trailing moving average with bands based on population standard deviation. [Bollinger Bands calculation](https://www.bollingerbands.com/bollinger-bands)
- DeepChart's retained managed metadata exposes the description accessor `VolAnalysis.Properties.IndicatorDescriptions.get_Bollinger_Band`, token `0x0600202c`. Its retained body only loads null and returns. It gives no evidence about the calculation. The desktop pass should compare length, multiplier, source, styling, live development and historical values on the same symbol and interval.
