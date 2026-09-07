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

## Required before retrying

Do not reapply the reverted GEX patch as one batch. Reintroduce it in isolated
increments and require a production-like browser startup test with an existing
saved `gamma-levels` indicator, multiple chart panes and restored settings
before any new production push. The precise client exception was not captured,
so no root-cause claim is made beyond the release-level isolation and successful
rollback.
