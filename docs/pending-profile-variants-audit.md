# Volume profile variants — released 2026-09-07

## Reference

Official Deep Profile documentation (retrieved 2026-09-06):
https://www.deepcharts.com/helpcenter/article/deep-profile

The reference uses one profile engine with period/length choices: Latest,
Multiple, Composite, Visible and Custom. Monthly length is calendar based;
Visible follows the chart viewport. Session splitting belongs to the shared
profile settings. Public DLL profile-property evidence is already recorded
in `docs/deepcharts-composite-volume-profile-audit.md`; protected defaults and
exact formula/pixel parity are not inferred from property names.

## Why enabling the three rows is insufficient

- Workspace selects one daily, one weekly and one Composite instance.
- Chart chooses settings from the returned `daily`, `weekly` or `custom`
  period. Monthly and Visible both need exact custom requests, so this would
  silently use Composite settings and collide at matching start times.
- Historical request completion can arrive after a viewport/settings change.
  A range-dependent study must discard those late results.
- Monthly must use exchange trading-month boundaries, not loaded candles or
  rolling 30-day subtraction. Replay must cap every query at its own clock.
- Event candles have execution timestamps distinct from display slots. A trade
  can span multiple volume candles, so time-only requests cannot always isolate
  precisely the visible allocations. A sequence/allocation-aware endpoint is
  required for that case; the new planner refuses ambiguous slices.

## Shared foundation

- `profileVariantJobs.ts`: calendar-month windows (weekends, DST, leap year,
  previous-month and replay bounds), logical visible range mapped to execution
  bounds, owner/settings/contract-specific job identity, concurrency bounded
  to two by default/four maximum, invalidation and independent error handling.
- `volumeProfileOwnership.ts`: optional instance ownership retained through the
  shared gateway `custom` period. Actual Chart.tsx renderer uses this owner for
  settings, IDs and newest-only levels. Existing unowned daily/weekly/Composite
  data retains its prior identity and settings selection. Deleted or disabled
  explicit owners cannot fall through into Composite.
- Eleven tests and scoped ESLint pass. Production build passed (TypeScript,
  80 static pages). No source HTTP request, provider subscription or spend was
  initiated by these tests.

## Completed integration

### Additional data-path work verified locally

`ownedVolumeProfiles.ts` validates exact instrument/contract, range, grouping,
value area, size filters, coverage and row/totals reconciliation before assigning
an owner. Cache errors do not block the exact reader; late results are suppressed;
failed refreshes are explicit and do not issue a data-removal callback. A bounded
live-fold helper excludes the next month and trades after the replay clock.
Seven tests cover these paths using fixtures, not live provider requests.

Source audit found the gateway profile route does not apply Filter/Split flags.
The Next proxy only narrows a request when there is one resolved session span;
several daily RTH spans cannot be represented by its single forwarded interval.
The loader still refuses unsupported disjoint-window flags before any request.

- Monthly jobs use exchange trading-month boundaries and independently owned
  exact custom ranges, newest first.
- Session jobs resolve RTH, ETH, Custom or the three desk sessions through the
  DST-aware shared exchange-session engine and issue one exact range per window.
- Visible Range reads the logical viewport, preserves event-candle execution
  bounds and coalesces pan/zoom interaction for 250 ms before loading.
- All three reuse the complete profile editor, renderer, templates and theme
  ownership. Late responses from an old viewport/settings state are discarded.
- The archive loader is cache-first and bounded to two concurrent jobs. Valid
  snapshots top up from the shared exact execution tape; no extra stream opens.

## Remaining truthful limits

- A prior month whose contract archive cannot prove complete execution coverage
  stays blank. Current-contract data is never shown as a rolled historical month.
- Filtered Monthly and filtered Visible Range require merging disjoint execution
  windows. Those combinations remain fail-closed; Session Profile supports its
  windows as explicit independent ranges.
- Cash/options and replay coverage require provider-specific verification. This
  release proves the futures chart path and never relabels candle volume as an
  exact execution profile.
