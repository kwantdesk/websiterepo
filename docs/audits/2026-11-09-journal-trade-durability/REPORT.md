# Journal trade durability and consistent deletion — 9 November 2026

## Reported behavior and confirmed implementation faults
Owner reported a manually entered trade disappearing from their named journal and trades deleted in Overall remaining in Calendar/other views. The exact missing production row was not inspected, so the findings below establish code defects rather than a proven forensic cause for that particular entry.

- DELETE previously removed only one row/id. A copied outcome could remain in another journal, and Overall's deduplication could then select that surviving copy. Calendar uses the same outcome inputs.
- No durable per-trade deletion record existed. Additive cache merges, automatic paper-fill recording and old-device synchronization could reintroduce an intentionally removed outcome.
- The asynchronous startup load replaced component state after returning. It could replace manual additions/edits made while an earlier load was in flight. Cached copied trades were also discarded whenever any cloud response succeeded, making absence act like deletion.
- Local persistence accepted a whole older snapshot; a late IndexedDB read could also replace newer in-memory data. A working but empty IndexedDB ignored prior localStorage fallback data.
- Manual trades had execution dates but no booking/receipt clock for reset filtering. A newly added backdated result could immediately be excluded by a reset. Attachment failure after a successful cloud trade write could prevent the UI from adding the already-saved trade.
- Recovery sync upserted existing manual/imported rows, allowing stale devices to overwrite reviews and receipt metadata.

## Changes
A trade's canonical identity follows its original through journal copies. Individual deletion now removes that outcome from Overall, named journals, Calendar and derived reporting, with private owner-scoped deletion records persisted in the existing social_objects table. Original journal rows are retained for recovery rather than hard-deleted. GET filters deletions, copy/update/create paths check them, recovery uploads skip them, and paper recording respects local deletion records. Existing linked-Socials cleanup is applied to the outcome's references. No schema migration/new service/paid upgrade was required.

Snapshot merges preserve outcomes by identity; only explicit deletion records remove them. Late hydration preserves changes made after load started. Immediate local persistence accompanies acknowledged manual save and individual deletion, in addition to the existing background checkpoint. IndexedDB reads merge concurrent saves and recover a prior fallback when their own row is absent. Account reset/deletion guards remain in place.

New manual entries retain an authoritative server booking timestamp separately from their execution date. Existing manually booked rows use their actual database created_at when available; execution dates are unchanged. Editing does not invent a replacement booking time. Stale recovery synchronization is insert-only; explicit updates remain the edit path. Failed attachments no longer conceal an already-saved trade: its trade data is retained and attachment-sync failure is reported separately.

The deletion confirmation now explicitly states that the outcome is removed from Overall, Calendar and every journal containing it. No journal layout, balances or trading execution behavior was changed.

## Verification
- 39 focused tests pass, including full actual API handlers against an isolated in-memory Supabase adapter, owner isolation, creation/read/delete/copy references, stale upload suppression, failed deletion acknowledgement, failed deletion-history read, real legacy receipt clocks, merge races, fallback recovery, reset handling, local durability and existing paper journal recording.
- All six new API lifecycle tests fail against the preceding route (negative control), and pass with the repair.
- Broader journal suite:78/79 pass. The remaining equity-curve source-pattern assertion expects obsolete theme-variable markup. It also fails against unchanged HEAD source; baseline evidence attached. It was not rewritten to hide the failure. Two affected fragment/source tests were updated for the newly explicit deletion guard and insert-only recovery policy, which are additionally covered through full route behavior tests.
- Isolated headless Chrome with the real JournalWorkspace: add a manual result into a named journal; confirm in Overall; delete the other outcome from Overall; verify Calendar shows only the retained result and the copy journal is empty; reload with stale deleted rows still present in the mock response; verify deletion persists and the added result remains. No browser errors; evidence attached. These are synthetic fixtures, not the owner's records.
- Scoped lint passes. Final full isolated Next.js webpack production build passed, including TypeScript and route generation. Production SHA verification is recorded separately.

## Production data and limits
No real journal, account, order, workspace or Socials record was changed during debugging. No gateway/terminal/provider restart or owner browser interaction occurred. Backend read-only inspection did not provide an authenticated Supabase journal session. The Vercel CLI had no saved credentials; its automatic login attempt was cancelled. Consequently the owner's specific missing trade is NOT confirmed recovered. The repair can reveal records hidden by cached-copy omission, fallback-store omission or a reset using the wrong date when those records still exist. Physically deleted rows cannot be promised restored without a real backup/data inspection. No historical result was fabricated.

Scope is individual outcome deletion and journal save/hydration/recording. Existing journal-account lifecycle and import-batch deletion actions retain their separate behavior. This is not an assertion of atomic deletion of all linked Socials activity on every possible database/network failure.
