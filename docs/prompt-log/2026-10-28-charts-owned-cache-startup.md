# Charts startup in the New York session — 2026-10-28 Brisbane

User reports Charts takes too long to open during the live session. Reproduced a fresh production Charts document with zero canvases and Opening charts / Restoring your saved workspace before the market feed starts. It later settled to63 canvases/no loading statuses. The render gate awaited all hydrateUserPreferences cloud IO before any Chart mounted. VPS container sample showed gateway112%CPU across4vCPUs,3.164GiB/5GiB; stream edge0.37%, so this sample did not indicate a dead gateway or exhausted memory.

Change: after getUser verifies identity, canDisplayOwnedWorkspace permits chart display/history requests from an existing complete same-owner local cache while the cloud refresh continues. New/different users, missing/incomplete/unreadable cache fail closed. preferencesReady continues to gate paper execution, persistence guards and account sync; it is never set early. No provider restarts, saved history or owner preferences changed.

Validation:14 focused ownership/account-sync/frame/theme checks pass. Build and scoped lint pending. This addresses the observed pre-chart startup gate, not a claim that every cold history/indicator request has zero latency.

Production build/TypeScript passed. Scoped lint zero errors/19 existing warnings.
