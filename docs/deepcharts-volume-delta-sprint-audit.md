# DeepCharts Volume/Delta Sprint audit — 2026-09-07

## Evidence used

- Official guide: <https://www.deepcharts.com/helpcenter/article/volume-delta-sprint>
- Installed licensed DLL public settings candidate:
  `VolAnalysis.Collections.VisualCollectorDictionary`.
- Public enum/property contract: Volume/Order input, minimum and maximum
  filters, length, Fixed/Fading delta colour, smoothing enable/length, and
  Simple/Exponential/Triangular/Weighted averaging.
- Official screenshots verified stock length 10, Fading colour, smoothing off
  with length 3, and distinct Delta, Bid Vol and Ask Vol subgraphs. The Delta
  plot is Bars, +/- auto-coloured, solid, width 3.

No protected method body was copied. The DLL's `Order` label is treated as
classified executed-trade counts, not historical resting-book orders, because
the chart candle contract contains executions and not an MBO history snapshot.

## Implemented contract

- Each output is the rolling accumulation over `Length` complete classified
  Bid/Ask candle observations. Delta is rolling Ask minus Bid; the optional
  Bid and Ask subgraphs expose the two totals independently.
- Volume uses classified aggressive contract volume. Executed Trades uses
  classified ask/bid trade counts. Missing classification emits no false zero
  and starts a new rolling segment.
- Minimum/maximum filters are applied to each selected per-bar side value;
  zero maximum is unlimited. The filter scope is explicit because protected
  per-print filtering semantics cannot be established from the public prose.
- Smoothing is applied after the rolling accumulation using the selected SMA,
  EMA, double-SMA triangular or linearly weighted average.
- Fixed mode uses binary positive/negative colours. Fading mode scales from
  the theme-muted colour to the direction colour using magnitude versus the
  rolling-window maximum. Theme/custom colours, subgraph visibility, short
  name and histogram width are persisted and template/export/import compatible.

## Verification and limits

- `tests/volume-delta-sprint.test.mjs`: six settings, accumulation, filter,
  seam, smoothing, subgraph/theme and persistence/registration tests pass.
- TypeScript passes. New engine/config/test sources pass scoped ESLint. The
  existing 550 KB settings component exhausted ESLint even at an 8 GB heap;
  the full production build is the syntax/type/render integration gate for it.
- Shared catalogue, template and global-theme regressions and the complete
  80-page production build are release gates recorded in the prompt outcome.
- Exact protected filter allocation, native pixels and market-open latency
  parity are not claimed.
