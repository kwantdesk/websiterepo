# GEX Levels re-engineer

## Owner request

Rename the chart indicator previously presented as Kwant Levels to GEX Levels
and make it a proper live options-positioning study: clear Call Wall, Put Wall,
Zero Gamma and Gamma-exposure support/resistance roles; live intraday updates;
and a final end-of-day frame when the market is closed.

## Diagnosis

- The underlying route already supplied signed Call-minus-Put Gamma exposure,
  named structural objects, intraday snapshots and a New York end-of-day mode.
- The UI hid those semantics behind generic `KWANT 1…N` names.
- One source adapter incorrectly classified ranked exposure from strike position
  relative to spot rather than the sign of the calculated exposure.
- The browser continued refreshing the completed end-of-day frame throughout
  the closed session.
- Settings did not let a trader independently control structural GEX families.

## Fix and outcome

- The public indicator is now **GEX Levels** while its stable `gamma-levels`
  storage ID remains unchanged, preserving existing charts and templates.
- Named structures render as Call Wall, Put Wall, Zero Gamma, Gamma Magnet,
  Gamma Accelerator, High Volatility Level and Major Positive GEX. Remaining
  ranked strikes are labelled GEX Resistance/Support relative to live futures.
- Exposure sign now determines positive/negative GEX classification.
- Added independent controls for each structural/ranked family, labels and the
  Gamma Environment badge, with theme-aware colours retained.
- Live snapshots continue at the existing bounded cadence. After the server
  confirms its New York end-of-day snapshot, the chart retains that exact frame
  and sleeps until the next regular New York options open.
- Removed provider/private implementation wording from the changed visible UI.

## Accuracy boundary

This is a transparent signed-Gamma exposure implementation built from the
licensed options surface and mapped to the active futures chart. It does not
claim to reproduce a third party's protected positioning model. Dated or
incomplete order-flow/open-interest inputs are not labelled live.

## Verification

- GEX calculation/settings script
- indicator naming, display/lifecycle and resilience tests
- TypeScript compiler
- complete production build
