# Workspace save blocked by browser quota — 5 November 2026

Owner reports Save Workspace says browser storage full. Investigated source/backend paths only; no browser inspection or mutation. Existing dirty changes preserved. No workspaces, drawings, journals, accounts or trades deleted; no gateway/terminal/feed lifecycle changes.

## Cause in save path
Named workspace persistence required a successful synchronous localStorage write and returned before account sync when quota was exhausted. The app also stored an entire second serialized account snapshot under kwantdesk:user-preferences:<user>:v1 beside the individual tracked keys. The previous suggestion to close tabs does not solve a persistent per-origin localStorage quota.

## Repair
- Losslessly pack only large acknowledged-account cache mirrors (fflate0.8.3, already in the lockfile transitively, now an explicit dependency). Local per-feature keys, cloud JSON, backups and exports keep their existing format. Both legacy and packed account caches read correctly; decode output is bounded. On quota refusal, compact legacy duplicate mirrors in place and verify round-trip before replacement, then retry. Existing eviction still targets only re-fetchable provider cache; user work is not evicted.
- Save As, Quick Save, Import and Delete await the persistence result. If a library/deletion write still cannot fit, use the existing authenticated private account compare-and-swap with explicit workspace patch. Wait for acknowledgement; merge peer workspaces and preserve concurrent unrelated edits. Never report success on account failure. Duplicate clicks are coalesced and a section change during the request cannot apply the saved workspace to another section.
- Confirmed account-backed libraries remain readable to the current account when their local mirror cannot fit. Preference capture includes those confirmed values so stale local data cannot undo the cloud save. A newer successful local-tab write supersedes that overlay. Initial account hydration and later receives use the same owner-scoped behavior. No overlay is created for an unacknowledged failed save.
- Delete still requires an explicit tombstone; failed partial local deletion rolls its tombstone back before trying account persistence. Backups remain unchanged and all four save callers wait before marking a workspace clean.

## Validation
-59 targeted tests pass: cache round-trip with Unicode/emoji, quota recovery preserving drawings/ledger, refused compaction preserving original bytes, legacy cache compatibility, confirmed save with blocked local library, stale-local sync protection, remote reload restoration, account isolation, backend-failure no-false-success, deletion/stale-peer protection, newer local-tab edit, actual workspace save callback acknowledgement and duplicate-click guard, account controller/hydration/read-failure regressions.
- Existing browser storage quota script10/10 and paper storage preservation script5/5 pass.
- Scoped lint passes for the four storage/preference modules. Full isolated webpack production build includes TypeScript and86 routes; exact scoped build-input hashes verified before release.
- Account writes exercised against a deterministic private-store/CAS fixture; no test workspaces created in the owner's live account. This is not a claim that the current owner tab has loaded the new bundle.

Release through existing main-only Git integration after the final build passes. Keep the resulting production receipt local; do not push only to publish a receipt. No paid service upgrade, no additional continuous polling and no forced owner-tab refresh.
