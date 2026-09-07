# GEX Levels production rollback

## Incident

Immediately after the GEX Levels re-engineer release (`be186dfc`), the owner
reported that Charts could not be operated: panes remained spinning and the
page crashed while loading. The public diagnostics endpoint confirmed that
the affected bundle was live while the market-data gateway itself remained
connected and authenticated.

## Response and outcome

- Reverted the complete GEX release with Git commit `f3f1858d`; no partial
  calculation, catalogue, settings or lifecycle change was retained.
- Pushed the rollback to `main` and waited for the public production diagnostics
  endpoint to report exact rollback SHA
  `f3f1858df118880dc3bbf4d3eb46313484500ed6`.
- The gateway remained connected/authenticated throughout, isolating the event
  to the recent web client release rather than the live feed.
- When the owner reported the first rollback had not restored Charts, the two
  immediately preceding Speed of Tape Instant releases were identified as the
  remaining recent saved-chart startup changes. `e3ed22eb` had moved the
  overlay into a new chart flex rail and `f37eb324` had changed its meter-frame
  contract/rendering. Both were reverted, newest first, by `939108fc` and
  `d5312869`.
- Production was then verified on exact SHA
  `d53128690711acfc8df76d249b55aa93722aa82b`; gateway connectivity and
  authentication remained healthy.

## Required before retrying

Do not reapply the reverted GEX or Speed of Tape patches as batches. Reintroduce
them in isolated increments and require a production-like browser startup test
with existing saved indicators, multiple chart panes and restored settings
before any new production push. The precise client exception was not captured,
so no root-cause claim is made beyond release-level isolation and rollback.
