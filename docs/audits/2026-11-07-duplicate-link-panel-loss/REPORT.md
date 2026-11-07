# Duplicated chart disappears after interval/link changes

Reproduced a panel-loss race on commit 534e06265a59198a5a8487033c803d619e0dbf6b. A stale same-account tab edits its original NQ pane while a second tab has duplicated it. Preferences merged the whole pane array as one value. The stale edit removed the new pane from the saved list; layout normalization then collapsed the split.

The ordinary duplicate → change to 1m → link sequence retained both panes in isolation. Delivering the stale peer revision after that sequence reduced the old implementation from two panels to one. The fixed merge retained both panels and both one-minute intervals.

## Repair

- Merge known-baseline panes by unique pane ID, then merge independent field edits within a pane.
- An absent peer addition is not a Close. Explicit removal of a previously known panel remains effective.
- Reconcile the chosen tree with surviving visible panes; preserve concurrent duplicates, smaller layouts and detached windows.
- Merge linked/crosshair memberships using baseline-aware additions/removals.
- Preserve the last remaining panel if two devices concurrently close opposite panels.
- Apply independently to Charts, GEX Vue and Algo preference scopes. First sign-in without an acknowledged baseline retains the existing hydration policy.

## Verification

60 tests pass across the new pane-sync regressions, account/device sync, frame isolation, workspace-preset sync and paper-protection persistence. The 12 initial pane-sync tests were run against the old merge and reproduced the regression. The JSON files show the mounted React workspace shell before/after under JSDOM, including real duplicate/timeframe/link handlers and account hydration. Chart rendering/feed/network are stubbed: this proves layout persistence, not market-data quality or visual rendering. Scoped ESLint passes. Production build is checked before deployment.

No user workspace, account, order, provider subscription or recording was changed during verification. No live tab was refreshed and no gateway restarted. Existing open tabs must load the new release when safe; older loaded clients retain their earlier sync code.
