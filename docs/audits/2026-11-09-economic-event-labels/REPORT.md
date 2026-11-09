# Economic calendar trader labels

Calendar providers use long-form series names. A shared display formatter now converts recognised names to CPI, Core CPI, PPI, Core PPI, GDP and FOMC terminology. MoM, YoY and QoQ display as m/m, y/y and q/q; revision/estimate qualifiers remain intact.

NewsWorkspace applies it while sanitizing both fresh and cached events, so the list, next release, reminders and shared messages agree. HighImpactNewsChip uses the same formatter while preserving its original dismissal identity. IDs, timestamps, readings, impact, currencies and source records are unchanged.

Only whole inflation-series prefixes map to CPI. PCE, inflation expectations and harmonised inflation are not renamed CPI. US Fed decisions, press conferences and minutes get specific FOMC labels; other countries’ central banks are not relabelled FOMC.

Validation: five focused naming/cache-idempotence/calendar-sharing tests passed; scoped ESLint passed. Production build result checked before release. No data-provider polling or infrastructure changes.
`nProduction webpack build, TypeScript and generation of all 87 pages passed in the isolated release worktree.
