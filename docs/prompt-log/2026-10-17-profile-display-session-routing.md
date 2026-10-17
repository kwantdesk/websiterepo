# Enabled daily and weekly profiles invisible

## Request

Daily and weekly profiles are on the chart but not showing. Owner confirmed
the problem affects all instruments, not one symbol.

## Diagnosis and repair

1. Daily browser labels are CME closing/business dates, while the gateway's
   default date-only window uses opening dates. A Friday Oct16 request selected
   Friday night instead of the actual ThuOct15 22Z–FriOct16 22Z session.
   The request builder now sends explicit CME start/end boundaries and retains
   its business-date label. DST/custom windows are covered by regression tests.
2. The shared futures profile effect stopped when live contract resolution was
   unavailable. The live resolver currently returns 500 with Ticker Plant not
   connected, even though historical tape exists. Historical requests now work
   without a live book or subscription. A root-only request can resolve an
   unambiguous actual recorded contract within that window. Exact requests stay
   exact, mini/micro identity is enforced and rollover ambiguity is rejected.
3. Valid historical profiles can remain painted during disconnected startup;
   cash/options sources stay isolated. Missing current daily data now surfaces
   a scoped chart error instead of silently leaving an empty study.

## Verification

- Gateway suite: 389 passing tests.
- Daily-boundary, weekly-unavailable and continuity tests: 8 passing tests.
- Scoped lint, final isolated TypeScript check and final isolated production
  build passed. Release-copy source hashes match the three changed frontend files.
- Real frontend request builder to public gateway: root-only NQ/ES requests for
  business date 2026-10-16 returned HTTP200, exact NQZ6/ESZ6, complete true,
  3826/535 price levels and the correct Thursday/Friday boundaries.
- Temporary gateway received the scoped backend modules and restarted once.
  No additional provider subscriptions or continuous Vercel streams were added.

## Not fixed / not claimed

Weekly NQ still lacks session-start Oct11; ES lacks Oct11/12. Provider connection
failures prevented remaining recovery. Other futures still need exact tape.
The owner's signed-in chart was not available in the connected browser, so no
claim of visual confirmation or live-market soak. Saved indicators/settings and
unrelated native/ALGO work were not changed.
