# 2026-09-03 — 04 — Remove duplicate Volume Profile Inputs

## Prompt (verbatim)

> in volumr profile daily we have inputs and general, sometimes i can find the same setting twice on these ares so if we can get rit of inputs thatsgood cause it repeats some of the stuff we already have somewhere else...?

## Answer

The outer Inputs page was generated automatically from the generic numeric
indicator schema even though Volume Profile has its own purpose-built tabbed
editor. It repeated manual ticks, automatic grouping factor, profile width and
the execution-size filters.

Inputs is now suppressed for all five Volume Profile variants: daily, weekly,
custom range, ask/bid and delta. The generic Inputs generator remains intact
for other indicators that need it.

The audit found one non-duplicate before removal: Profile opacity existed only
on Inputs. It was moved into Plot settings so no capability was lost. The label
typo “Auto group factory” was also corrected to “Auto group factor.”

The resulting ownership is:

- Data settings: input source, minimum/maximum execution filters, automatic or
  manual grouping, grouping factor and manual ticks.
- Plot settings: profile widths, offsets, opacity, border, levels and profile
  count.
- General: profile type, templates and chart-edge placement.

### Verified

- The Volume Profile settings completeness audit passes 8/8 and checks that
  every removed Inputs key remains reachable in a named tab.
- Volume Profile data settings and grouping suites pass.
- Shared indicator Save lifecycle passes 10/10.
- Scoped ESLint and `tsc --noEmit` pass.
- Full production build passes.

### Deployment

Committed and pushed to `main`; Vercel production deployment to the active
`websiterepo-yfmi` project was verified from the exact commit status.

### Unfinished

None for this prompt.
