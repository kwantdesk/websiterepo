# Replay dropdown scroll persistence — 2026-10-25

Owner reports Replay workspace dropdowns disappear while scrolling.

## Cause and repair

The previous internal-target guard still dismissed shared selectors on any
external scroll or resize. Scroll chaining/momentum could therefore close a
menu without an outside click. KwantSelect and TimeZoneSelect now reanchor
their portals on external viewport changes, coalesced to one animation frame,
instead of dismissing. Internal list scrolling leaves position untouched;
overscroll containment prevents the list handing its gesture to a host.
Pending frames/listeners are cleaned up. Outside click, Escape and choosing
an option retain their existing dismissal behavior. Date picker has no
scroll-dismiss handler. No market-data, replay conversion or execution edits.

## Verification

- 25 focused replay/timezone/dropdown regressions pass, including executing
  each real viewport handler for internal scroll, external scroll, resize and
  repeated momentum events, plus full mocked TimeZoneSelect selection/cleanup.
- Scoped ESLint: zero errors; existing KwantSelect aria-required warning only.
- Production build/typecheck completes successfully (84 pages).
- Hidden isolated fixture renders actual React Replay components with no
  provider/account connections. Real wheel scroll reaches minute max2214px,
  hour max720px and timezone max22358px; continued downward scrolling and
  reverse scrolling keep each open. Hour/minute selection works afterwards;
  timezone Escape closes only that menu, leaving Replay dialog open.
- Screenshot: local visualization replay-timezone/scroll-boundary-proof.png.
  This is component-fixture proof, not signed-in production UI acceptance.

## Release

One scoped main push through existing websiterepo-yfmi integration; exact
production SHA/READY verification recorded locally after release.
