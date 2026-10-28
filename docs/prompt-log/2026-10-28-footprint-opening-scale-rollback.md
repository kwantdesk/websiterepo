# Owner-requested footprint rollback

Owner rejected the opening-scale fix e8f95ace: it worsened the chart and was not the transient first-open visual bug they meant. Rolled back every Chart.tsx change from that release, verified its Git blob exactly matches 840043de, and removed the opening-scale tests introduced for the rejected behavior. Earlier numeric-sort responsiveness and CVD fixes remain.

The prior memo/presentation tests reproduced a code scenario, but did not demonstrate the owner's observed first-open problem. Do not treat them or the prior completion message as proof that visual issue was fixed. It remains unresolved; a subsequent fix needs evidence of the actual initial vs correct rendering, without another inferred grouping change.

39 existing footprint/price/history/settings regressions pass. No gateway restart or changes to owner trading/settings/accounts. Full build and deployment verification recorded below when complete.

Production build and TypeScript passed with 1536MiB heap and BelowNormal priority. Restored source matches the previously linted 840043de Chart blob exactly.
