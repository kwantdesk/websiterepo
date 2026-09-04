# Composite Volume Profile

## User request

Confirm whether KWANTDESK already has a Composite Volume Profile, compare its
logic and complete settings with Deep Charts one-to-one, build a professional
right-side Composite profile with correct time, input, colour and adjustment
behaviour, and activate it in the indicator library.

## What changed

- Converted the existing catalogue placeholder into an addable live indicator.
- Added a single-profile range resolver and exact Rithmic custom-period request
  across the complete loaded chart range.
- Routed Composite through the native Volume Profile renderer, right-docked by
  default, with live execution development.
- Connected the complete shared Volume Profile settings surface and template
  workflow instead of creating disconnected Composite-only controls.
- Added futures, options-family projection and honest cash-volume handling.
- Added saved-workspace defaults/migration and focused regression coverage.

## Outcome

Composite Volume Profile is now a real live indicator rather than an “In
development” placeholder. It builds one execution-accurate distribution over
the loaded range, stays on the right by default, updates with Rithmic prints and
uses the same tested POC/value-area/VWAP/structure/style engine as the Daily and
Weekly studies.

## Verification

- `npm run test:composite-volume-profile` passed.
- Volume Profile data, structure, grouping, docking and parity suites passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` passed all 80 routes.
- Scoped lint passed; see the audit for the existing oversized-Chart parser
  limitation.

## Deployment

Pending the feature commit, single production deployment and public route
verification.
