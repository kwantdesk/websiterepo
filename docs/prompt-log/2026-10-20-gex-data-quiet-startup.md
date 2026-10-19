# GEX DATA quiet, theme-first startup

Request: remove the mismatched loading screen when opening GEX DATA.

The dynamic workspace fallback still used the animated KwantLoader. The account
host then displayed Opening GEX DATA text. Finally, iframe theme installation
awaited a static colour-catalogue fetch before setting the site's base colours.

Both React stages now use the existing accessible quiet loader: theme surface,
no visible text/emblem/gradient/animation. A small classic script before styles
reads only the existing same-origin host palette, including nested tool hosts
and pop-outs, and paints the current theme immediately. Runtime theme changes
apply base variables synchronously and reuse the static colour download. No
account data is cleared and no auth/readiness/error/data/polling logic changed.

Verification:

- 158 GEX DATA/catalogue/reference tests pass, including four new regressions
  for light/dark first paint, nested/tool/pop-out hosts, cross-origin safety,
  synchronous theme changes with a delayed shared catalogue and both quiet
  React startup stages. Existing timezone host harness includes the new loader.
- The four adjacent GEX VUE quiet-startup regressions also pass.
- Full production build passes (84 pages, including TypeScript). Scoped lint
  passes for the host, bootstrap/theme scripts and changed tests. The giant
  shared workspace's change is a single quiet argument; no full-file lint run
  (the preceding task recorded a default-heap OOM there).
- Local browser verification renders real completed-session Net Drift output
  with the host's #08060d root background and no animated loading screen.
- Deployment receipt recorded below after completion. Unrelated dirty worktree
  changes are preserved.

Standing unresolved: supported stable VPS transport; full-month futures/options
recording/history/backfill and offline gaps; Asia tape; weekly profile,
footprint/CVD live soak; GEX DATA forecast/aggregate/cadence parity; shared
acquisition/cost and capacity for 100+ users. This visual change closes none of
those independent data-quality or infrastructure gates.
