# Saved workspace disappears when phone opens

Owner reports saving a workspace on desktop and finding it deleted after opening the same account on the phone.

The named workspace library was a whole-string account preference. A stale/empty phone copy could replace the complete saved list; there was no distinction between an empty default/stale list and an intentional user deletion. A mounted-state effect and scope-switch persistence also wrote rendered library copies back to storage, although explicit Save/Quick Save/Import/Delete already persisted the library themselves. A normal fresh-phone test retained the workspace; a controlled stale-empty-phone update reproduced the destructive path with the old merge code.

The repair merges named workspaces by ID, retaining baseline/local/remote records and independent saves. Only explicit Delete writes an account-synced, scope-specific deletion record. Those records prevent stale devices from resurrecting deliberate deletions. Concurrent edits use the baseline and saved modification time, with deterministic ordering. Charts, Options/GEX View and Algo retain independent libraries. No trading-ledger merge policy changes.

Removed automatic library writeback from mount state and scope switching. Explicit writes merge the latest local stored peer additions before committing and report failures; failed Delete rolls its removal record back and does not claim success. Explicit backup import stamps the user action and creates a fresh ID when restoring a previously deleted backup, preserving the old identity's deletion protection. Initial hydration retains surviving library copies only when they belong to the same account; another account's saved workspaces are never imported.

Verification:

- 46 focused tests pass: all three workspace scopes, stale/empty/missing/malformed copies, concurrent adds, Quick Save, explicit deletion, stale resurrection, scope isolation, actual Save handler, quota rollback, same-owner hydration recovery, other-owner isolation, existing account/execution merges, preference outages, focus behavior and custom themes.
- Two independent Chromium contexts exercise actual Workspace, hydration, account sync, storage and explicit Save/Delete controls. The database/realtime and candles are local fixtures. Fresh phone keeps the desktop save; a simulated stale empty phone list cannot erase it; explicit Delete removes it; a stale phone cannot restore the deleted identity; zero page errors.
- Negative control using the previous account merge fails the stale-empty-phone assertion: the cloud library loses the workspace. The repaired source passes.
- Scoped preference-library lint passes. Full isolated webpack production build, TypeScript and 86 static pages pass.

Browser runner: `scripts/audits/workspace-save-sync-browser.cjs`. Local logs: `tmp/workspace-save-negative-control.log`, `tmp/workspace-save-after.log`, `tmp/workspace-preset-tests.log`, `tmp/workspace-preset-production-build.log`. No live account, order, owner browser or VPS mutation. Release is scoped main-only Git integration followed by public exact-commit verification.

Limitations: browser checks emulate a phone, not the owner's physical device. Already-deleted records cannot be reconstructed if no surviving same-account local/cloud/export copy exists. Both active devices need the new frontend loaded; old open tabs still run their previous client-side sync code. No claim that any particular lost owner workspace has been recovered.
