# Asia/London volume-profile availability — 2026-10-19

Owner reports only RTH profiles visible despite enabling Asia/London while
Globex is open.

## Findings and changes

- Standard daily settings already generate explicit session windows and retain
  session identities; their complete:false data admission must stay intact.
- Session variant planner ignored individual flags and lacked the active CME
  business date when candles were absent/stale. It also mapped mode none to
  RTH. Corrected those paths; fixed end bounds keep developing cache keys
  stable and selected future windows wait for their actual open.
- Owned publication removed all same-study profiles on each result. Added
  sibling-aware merge and removed-session pruning. Multiple sessions/months
  now coexist independent of arrival order and duplicate refreshes.
- Standard daily jobs now skip unopened windows rather than queuing known
  empty London/NY requests during Asia. No provider/feed/schema changes.

## Live read-only evidence

Authenticated local gateway, current Asia [2026-10-18T22:00Z,2026-10-19T07:00Z):

| Contract | First covered execution | complete |
|---|---|---|
| NQZ6 | 2026-10-18T22:56:00Z | false |
| ESZ6 | 2026-10-18T22:56:00Z | false |
| MNQZ6 | 2026-10-18T23:00:00Z | false |

Gateway connected with10 subscriptions. Public diagnostics historical
execution adapter reports unusable/cooldown. Missing opening tape is a real
remaining blocker, not cured by frontend fixes. London was future at probe
time (~03UTC), opening07UTC. No secrets printed, no restarts, new logins,
resource purchases or partial-volume fallback.

## Verification

-35 tests pass:8 new session availability,4 variants,7 owned exact-validation,
  5 continuity,2 daily business-date/session-boundary,3 ownership and6 style tests.
-7 session-selection checks plus session filtering script pass.
-Scoped ESLint passes for changed helpers/new tests.
-Full production build passes, including TypeScript and84 static pages.
-Production release verification pending.

## Still open

- Recover the missing Asia opening executions and prove full session coverage.
- Full rolling-month futures/options history, permanent gateway/public stream
  reliability, weekly completeness, footprint and signed-in live-grid soak.
- No claim of owner-side visible rendering or exact Deep Charts live parity.
