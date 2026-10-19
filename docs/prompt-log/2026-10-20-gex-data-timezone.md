# GEX DATA timezone control — 2026-10-20

Request: top-right time/time-zone option like normal charts.

## Changes

- Reused actual TimeZoneSelect: themed searchable IANA city/UTC-offset list,
  device-zone option and normal chart compact trigger.172px parent control;
 190px reserved in iframe toolbar using hostTimezone=1. Existing actions stay
  scrollable at narrow widths. Standalone/embedded frames do not get duplicate
  pickers. No global style or normal-chart setting changed.
- Existing account-keyed GEX DATA blob now stores gex-data-timezone. Fallback
  is chart default until explicitly chosen. Same host snapshot/restore path
  includes it. Other accounts cannot inherit it. Hydration/storage listeners
  synchronize, and compare-before-broadcast avoids unrelated setting repaints.
- Host ref exposes current zone to every nested frame. Same-origin message
  asks tool apps to re-render cached payload, snapshot labels and source-time
  footer without refetch/remount. Existing tables/detail dialogs refresh via
  their owned listener, cleaned by destroy. No polling or provider changes.
- Removed display-only hardcoded NY/browser clock formatting. Exchange session
  calculations, epoch timestamps and calendar-only expiration dates unchanged.

## Verification

-100 tests pass:7 new timezone,12 integration/silent-refresh,81 reference.
- Tests execute transpiled actual React host effects and actual JS handlers:
  stored/reopened choice, account isolation, workspace import, nested messages,
  foreign-origin rejection, unchanged-zone no-op, table update, NY DST,
  Brisbane midnight, source timestamp and session-date preservation.
- Scoped React/test lint, JS syntax and full84-page production build including
  TypeScript pass. Release recorded below.
- Signed-in visual/cross-device cloud roundtrip not claimed. Existing supported
  SSE transport/wait-for-Vultr, full month history, missing Asia opening tape,
  weekly/footprint and live-soak issues remain OPEN.
