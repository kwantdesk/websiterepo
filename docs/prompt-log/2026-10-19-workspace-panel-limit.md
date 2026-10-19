# Remove workspace panel-count limit — 2026-10-19

Owner needs more than12 panels and requests no panel-count limit.

## Changes

- Removed three12-panel rejection guards: add, docked duplicate, floating
  duplicate. Removed matching disabled buttons and maximum-count titles.
- Floating normalize/save/restore no longer slices valid windows to12.
  Unique pane validation and geometry clamps remain intact.
- Existing docked-pane/preset normalization already preserves all panes and
  arbitrary custom layout trees. No other panel-count truncation found in the
  shared workspace shell. No new fixed count cap added.
- Workspace locks, minimum-one-panel close rule,2MB backup-file input guard,
  bounded market-data caches and request sharing are preserved. Separate
  per-tool column counts / saved-preset count are not this panel limit.

## Verification

-6 new tests run the actual extracted TypeScript handlers/normalizers:
  add to64 across workspace scope identities, duplicate docked to32,
  duplicate/JSON-restore31 floating windows,52-pane backup/tree round trip,
  independent copied settings, lock/geometry/input validation, no stale cap UI.
-21 focused/adjacent tests pass (new panel count, local dividers, options-flow
  panels and Levels workspaces).8 layout preservation checks pass. Test lint passes.
-Broader28-test run:25 pass,3 existing source-regex guard failures. Confirmed
  expected lock click expression, activeRef2s/5s expression and embedded active
  expression are absent from unmodified HEAD too. Not changed in this task.
-Full production build passes, including TypeScript and84 static pages.
-Production release verification pending.

## Boundaries/open issues

-No64-live-chart browser/render/provider soak or unlimited-performance claim.
  Browser RAM/CPU remain real constraints. No provider/data/infrastructure edits.
-Standing missing Asia opening tape, full-month futures/options archive,
  options signed-in live verification, public stream/permanent gateway,
  weekly/footprint reliability remain OPEN.
