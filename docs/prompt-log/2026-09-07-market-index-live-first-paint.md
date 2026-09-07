# Market-index live first paint

## Prompt

During the live session, SPY was ticking while QQQ remained on its loading
spinner. Diagnose and fix the split behaviour urgently.

## Diagnosis

- The live gateway returned valid, current snapshots for both SPY and QQQ.
- Five-day minute history also returned for both symbols when requested
  directly.
- Gateway health nevertheless showed an overload trip and a recorded event-loop
  stall of roughly 44 seconds, so a newly opened pane could wait behind delayed
  history while an already hydrated pane continued ticking.
- After the fix was pushed, the public domain returned Vercel
  `DEPLOYMENT_PAUSED` (HTTP 503). The active `websiterepo-yfmi` production
  project itself—not merely the retired duplicate—was paused.
- The chart client accepted QQQ's live frame and constructed its current candle,
  but only cleared the loading overlay when `historyHydratedRef` was already
  true. This made history completion an unnecessary prerequisite for displaying
  verified live data.

## Fix and outcome

- A valid, accepted, market-open live snapshot now clears the pane loading and
  error state immediately after its candle is painted.
- Historical hydration remains independent and continues merging older candles
  when ready; the change does not fabricate history or weaken candle validation.
- Added a regression test that prevents live first paint from being gated by
  historical hydration.
- Resumed the active production project. A follow-up push then queued the fixed
  revision because the push made while the project was paused was not deployed.
- Verified the focused regression test, scoped lint (no errors), and the full
  production build.

## Follow-up

The client deadlock is fixed independently of the gateway. The backend overload
trip remains a separate performance incident and must continue to be traced so
history requests do not experience multi-second queue stalls.
