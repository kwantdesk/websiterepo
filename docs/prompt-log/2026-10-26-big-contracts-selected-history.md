# Big Contracts selected history — 2026-10-26

Request: selecting one day/two days must load that period instead of only hours.

Causes: missing history-day dependency; dense live execution compaction evicted
archived candidates; multi-day archive responses keep at most 50,000 executions;
drawing limits also discarded the oldest qualifying events.

Changes:
- Separate Big/Deep Contracts historical candidates from the bounded live tape.
- Fetch selected calendar-day range in daily slices, two concurrent requests,
  with cancellation on settings/instrument changes. Inclusive endpoint adjusted
  to avoid duplicating executions at daily boundaries.
- Deduplicate archive/live overlap by observed execution multiplicity rather
  than incompatible event IDs. Exclude aggregate flow buckets.
- Extend price history for selections beyond the default chart window without
  replacing already-visible candles; permit 30 days of one-minute anchors.
- Spread bounded markers across the period rather than keeping only the newest;
  keep first and latest qualification. Big/Deep drawing budgets remain bounded.

Verification:
- 11 targeted history/hydration tests pass, including one/two/five/thirty-day
  request coverage, 70,000-print compaction, overlap, actual 23/47-hour marker
  calculations, and over-budget marker time span.
- Big Contracts live-edge and Deep Contracts/Deep Effort scripts pass.
- Read-only VPS archive probe: NQZ6, 2026-10-20 09:00Z–2026-10-21 09:00Z,
  HTTP200 in143ms,16,501 executions, first09:00:06.203Z,last08:59:52.276Z.
- Old naming/filter static tests already expect superseded labels/settings;
  legacy tape test's handwritten TS stripper cannot parse its current generic
  function. These unrelated failures were not presented as passing.

Limits: archive is the existing strongest12executions/minute sample. No claim
of complete raw trade coverage or recovery of unrecorded periods. Calendar days
cross weekends; two days on Monday may legitimately contain Sunday trading only.
No provider subscription, VPS restart, recurring polling or new paid service.
