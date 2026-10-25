# Replay transport starts at selected time — 2026-10-25

Owner wants the selected date/time at the extreme left of the bottom bar,
with the right edge remaining the session end.

## Change

- selectWorkspaceReplaySession validates against full exchange boundaries,
  then sets playback startMs and timestampMs to the chosen instant. Existing
  slider min/max, scrub clamps, candle step clamps and rewind now use that
  interval. End remains actual session close (Charts17:00NY, gamma16:00NY).
- Rewind tooltip/accessibility name is Replay start, not Session open.
- Full session bounds remain separately computed for validation and recorded
  history loads; this does not truncate earlier context or indicator warmup.
- New selection can move earlier again; timezones, overnight session labels,
  DST and close-time zero-length interval remain validated. No feed changes.

## Checks

-26 focused replay/dropdown/timezone tests pass. Added numeric start/close,
  clamp, midpoint, earlier reselection, close-time and control wiring checks.
  Full336-observation timezone test still uses full exchange session bounds.
- Scoped lint has0 errors and20 pre-existing workspace warnings.
- Hidden fixture uses actual Replay picker/conversion with an isolated range
  mirroring production bindings (not the full signed-in workspace). Go at
  Brisbane23:30 produces start=value13:30UTC and end21:00UTC. End reaches max;
  Home returns to selected min. Screenshot selected-origin-proof.png in local
  visualization replay-timezone folder. No account/provider connections.
- Local production build/typecheck and exact release verification recorded
  after completion below. Only existing single main integration is used.

- Local production build/typecheck passes (84 pages). Additional27 adjacent
  GEX/KWANTY/Bounce replay regressions pass (53 tests total). Fixture closed.
