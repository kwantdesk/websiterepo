# Charts replay selectable timezone — 2026-10-25

Request: Charts replay picker must support selectable timezones, not only New York.

Replay now reuses the site's searchable TimeZoneSelect, initialised from the
current chart timezone. Go commits that zone through the existing chart-setting
handler, keeping chart axes, toolbar and replay transport consistent. Cancel
does not commit it. The transport no longer formats its clock as fixed ET and
uses h23 so midnight displays as 00 rather than 24.

The date remains explicitly labelled as the exchange trading-session date:
recording keys, RTH/Globex bounds and archive requests are unchanged. Start time
is resolved in the chosen zone against that session's actual local calendar
dates; the picker shows the complete local session range and selected local
start date/time. Changing zones preserves a valid selected UTC instant. Real
IANA offsets and round-trip validation handle DST and half/quarter-hour zones.
Invalid zones/times fail closed; an ambiguous repeated clock requires UTC
selection rather than silently guessing an occurrence. No invented history.

The shared dropdown accepts an optional historical reference timestamp, so its
UTC offset labels describe the selected session rather than today's DST state.
Existing consumers retain their current-time default. Nested menus retain Escape
and keyboard-focus ownership before the parent replay dialog handles keys.

Interaction testing reproduced a pre-existing KwantSelect defect: scrolling its
own long list closed it, preventing selection of later hours/minutes. Ignore
internal menu scrolls while preserving outside scroll/resize dismissal, matching
the existing timezone control's behaviour. No selection callbacks changed.

Verification:

- 23 focused replay/timezone/transport/dropdown regressions pass.
- 336 hourly observations across 14 representative zones round-trip exactly;
  explicit summer/winter, US/Europe DST transitions, Brisbane next-day rollover,
  Adelaide/India/Chatham fractional offsets, options RTH bounds and maintenance
  rejection checks pass. Legacy New York and causal master replay tests pass.
- Existing workspace-timezone test used a newline-sensitive source substring;
  replaced only that locator with whitespace-tolerant matching for CRLF files.
- Loopback-only fixture bundles the actual React picker, date/time controls and
  conversion helpers, with no market/account connections. Search and selection
  changed Brisbane23:30 to New York09:30 to UTC13:30 without shifting the instant.
  Escape closed only the zone menu. Long-list choices20 and59 work after repair.
- Actual Go submitted Brisbane24Oct06:59 as UTC23Oct20:59, session2026-10-23,
  bounds22Oct22:00Z–23Oct21:00Z. UTC Go submitted23Oct13:30Z. Cancel preserved
  the previous submission. This is real-component fixture acceptance, not a
  live market playback/history completeness certification.
- Evidence folder:
  C:/Users/Karen/.codex/visualizations/2026/09/02/01a06418-e374-7a73-bf53-3d3583cb166e/replay-timezone/
  Files:brisbane-next-day.png,utc-submission.json,build-final.log,lint.log,
  lint-controls-final.log. Final production build passes compilation, TypeScript
  and84 static pages. Production release receipt follows after one scoped push.
  Workspace lint:0errors/20existing warnings; final
  small controls/helper lint:0errors/one existing aria-required warning.

No new service, provider cadence, collector restart, backfill, polling, billing
setting or trade/account mutation. Existing archive/adapter coverage gaps from
the master replay task remain open; this task only repairs timezone selection.
