# DeepCharts Swing Point audit — 2026-09-07

## Public contract recovered

Official reference: https://helpdesk.deepcharts.com/portal/en/kb/articles/swing-point

- The study confirms swing highs and lows from configurable bars on the left
  and right. The installed screenshots show defaults of `2` and `2`.
- `Filter Swing` is a boolean and is off in the public screenshot.
- Plot settings expose display mode, line width (`2`), line style (`Dash`),
  independent high/low colours, text tick offset (`1`), text size (`11`) and
  independent high/low text colours.
- The licensed DLL public metadata confirms `LeftLength >= 1`,
  `RightLength >= 0`, the filter flag, display modes `Line`, `Text` and
  `LineAndText`, and line styles `Solid`, `Dash`, `Dot`, `DashDot` and
  `DashDotDot`. It also confirms line width, text offset and text-size fields.

The protected formula body is not inspectable. Public properties establish the
settings contract, not exact vendor tie-breaking or filter/lifetime semantics.

## KwantDesk implementation

- A pivot is emitted only after all configured right-side bars exist, so the
  plot never leaks a future swing into earlier history.
- Highs require the left highs to be less than or equal to the candidate and
  right highs to be strictly lower; lows use the symmetric rule. This makes the
  last equal plateau bar the confirmed pivot.
- With filtering enabled, swings alternate high/low and consecutive same-side
  candidates keep the more extreme pivot.
- Each horizontal level runs from its confirmed pivot to the next confirmed
  swing. The latest level reaches the current history edge.
- Invalid or non-increasing candle history is a hard boundary. Detection and
  horizontal segments restart and never bridge that boundary.
- The custom chart primitive implements all three display modes, all five DLL
  line styles, text offset/size and independent theme/custom high/low colours.
- Settings use the shared sliders, templates, saved-workspace normalization,
  theme ownership and deep-history path.

## Verification and explicit limits

- Nine focused tests pass: defaults/enums, future-safe confirmation, segment
  lifetime, filtering, history boundaries, display/styles, colours,
  release reachability and a 20,000-candle bounded-work check.
- A 39-test combined recent-indicator suite, numeric sliders (9/9), templates
  (18/18), global theme ownership, scoped ESLint, TypeScript and the complete
  80-page production build pass.
- Isolated browser QA showed separate green high and red low dashed segments,
  stable settings sections, immediate Save state and persisted line width.
- Exact DeepCharts tie handling, filtered-pivot sequence, native pixel geometry
  and market-open latency are not proven from public evidence and are not
  claimed.
