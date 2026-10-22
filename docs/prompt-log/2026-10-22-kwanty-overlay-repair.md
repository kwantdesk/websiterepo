# KWANTY overlays missing or glitched

Owner reports overlays show nothing and do not behave like Gexbot.

## Observed reproduction

Signed-in owner tab10 used index9, showing old session candles without metric
curves. Fresh tab82 restored three QQQ panels: Aggregate DEX, two Convexity
Orderflow panes. Two panes were blank; one showed overnight underlying candles
with a single latest reading. Gexbot reference tab11 showed completed Oct21 SPX
Orderflow curves and majors. Reference restored to original Classic afterward.

VPS-only bounded probes: QQQ Orderflow200/source2026-10-21T20:00:00Z contains
zcvr-734.89/zgr418.06/agg_dex326.71/gexoflow-10.9; SPX200/source19:59:59Z.
QQQ native history Oct21 returns403 UPSTREAM_ENTITLEMENT_REQUIRED; legacy401.
These source restrictions are not repaired or masked by frontend work.

## Root causes repaired

1. Default viewport followed latest underlying prices into overnight/the next
   morning, hiding the actual options session. Anchor to genuine positioning
   observations, retain source epochs and reset affected Orderflow viewport/pins
   on source-session rollover. Classic/State default windows use the same rule.
2. Multiple isolated exposure points separated by missing/zero values all
   disappeared because the renderer drew a point only for one global observation.
   Paint each isolated actual segment without connecting missing values.
3. A profile a second newer than Orderflow could never pass its cutoff after
   market close. Unpinned LIVE mode selects latest same-session profile at its
   own source time. Paused/replay/pinned modes keep strict historical cutoff.
4. Spot off removed the price scale profiles need. Keep independent real-price
   coordinates for visible profile slots without drawing hidden price marks.

Shared source/query budgets, authentication, custom settings, linked panel
boundaries and real missing-history semantics preserved. No new endpoints,
provider login/poll rate, VPS restart, paid service or data fabrication.

## Verification

-248 combined KWANTY/reference tests pass, including actual Canvas isolated
  segments, profile-without-spot coordinates, live timestamp skew vs replay
  exclusion, overnight session windows and linked reset behavior.
- Scoped ESLint:0 errors; one unchanged OptionsFlowToolPanel ref-cleanup warning.
- TypeScript and full84-page production build passed. Production release and
  fresh signed-in browser acceptance are required after the main-only push.
- Standalone index10/embedded12/app18; changed leaf module imports version3.

## Open acceptance boundaries

This is a rendering/session repair, not full-session-history or one-to-one
cadence certification. API historical access and unavailable saved-session
restoration remain unresolved. Snapshot values cannot reconstruct the earlier
curve. Full rolling-month capture/restore, all-tool parity, independent restore
drill, multi-user capacity and live-market soak remain open in IMPORTANT-NOTES.
