# Auction Gap Tracker release

## Prompt

Finish the pending indicator catalogue one real indicator at a time using the
DeepCharts reference and licensed public DLL contract; do not blanket-enable.

## Fixed

- Audited the existing end-to-end Auction Gap work rather than rebuilding or
  aliasing it: exact raw tick rows, six location modes, time/event chart
  allocation, lifecycle/retests, worker scheduling, source continuity,
  zones/markers, full settings, themes, templates and alerts.
- Added both release registrations and stored-setting normalization.
- Kept missing/incomplete/mismatched raw data fail-closed.

## Outcome

All 112 focused tests, 18 template checks, TypeScript and the production build
pass. The catalogue count falls from 15 pending to 14. Protected native formula/
pixel parity and market-open soak remain explicitly unclaimed.

