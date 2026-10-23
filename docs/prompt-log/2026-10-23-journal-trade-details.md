# Expanded journal trade details

Request: clicking each journal trade should expose time in trade, highest
unrealised profit and more information about its execution.

Added precise duration, local entry/exit timestamps with timezone, recorded MFE
and MAE, profit giveback, peak capture percentage, direction-aware price change
and initial risk to the existing detail drawer. Excursion/capture amounts use
gross P&L consistently, with existing fees and net P&L displayed separately.
Missing historical data remains explicitly unknown. Scale-out metrics apply to
that exit's closed quantity.

Fixed cloud trade sanitization dropping both excursion fields. Demo close
analytics now include the actual exit P&L in extrema without changing execution
or order fills. No user trade or journal was reset, placed or changed for tests.

Verification: six detail tests, eight protection-trigger checks, fourteen paper
journal checks; focused reset/demo-link regressions also passed. Scoped ESLint
passed. No added polling or infrastructure spend.
