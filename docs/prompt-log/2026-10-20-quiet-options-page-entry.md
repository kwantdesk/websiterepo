# Quiet options-page entry — 2026-10-20

Request: remove the opening flash on GEX DATA and options expiration calendar.

Removed both outer dynamic-import splash screens (calendar lives in KWANTY),
both host-bridge setup loaders and the calendar chunk loader. Their existing
theme surfaces remain. Embedded chart data loading/errors, calendar verification,
network cadence, host setup and account persistence are unchanged.

Updated startup regression tests to reflect this newer owner preference.
Validation: 28 startup, embedded-loader, timezone and official-calendar tests
passed; scoped ESLint passed on both edited host components. Production build
passed TypeScript and generated all 84 pages. Release receipt pending.
