# KWANTY Ctrl-wheel vertical zoom — 2026-10-20

Owner: scroll is wrong; match open GEXBot Classic, where Ctrl-scroll is vertical.

Reference inspection: existing observed main.f5205cc4.js maps Classic to chunk
9945.8a60c6e8 and shared chart chunk 6117.b82f2ad6; Chart.js zoom dependency is
5249.1c21014f. Read-only shipped code confirms Ctrl detection chooses y mode,
ordinary desktop wheel chooses horizontal mode and zoom speed defaults .1.
Retained REA parent ev_5035f3e0d0c0cf141b8475536485dbf7a3d638f49ecb099c9577ac590c2c27ed
selects the two shared chunks; partial graph/node ceilings and unselected sources
remain explicit. Earlier main-only trace no-match is not absence evidence.
No target bundle was executed for static analysis. IAB visible reference confirms
the advertised Ctrl-wheel vertical hint; its automation scroll cannot reliably
hold Ctrl concurrently, so do not claim a physical Ctrl-wheel input capture.

Faults: modifier handling applied only over plot; Orderflow changed metric but
left underlying spot domain unchanged. Zoom used raw device delta magnitude,
and multiple wheel events before a render reused stale geometry rather than
the already requested viewport, discarding accumulated wheel steps.

Fix: Ctrl consistently selects vertical domains, including over profile axes;
Orderflow plot scales price and metric together per owner's consistent vertical
control request (not a claim of exact Orderflow reference modifier parity).
Fixed 10% in/inverse-out steps, cursor anchor preserved, zero-delta no-op.
Resolve pending valid view bounds before every wheel transform; retain time and
exposure bounds. Consume canvas wheel bubbling and default browser action.
App v5/module v2 cache invalidation. No stream, gateway, data, or billing changes.

Validation: 175 focused tests pass, scoped ESLint/syntax pass. Regression tests
cover Classic/State axes, pending rapid events, inverse steps and Orderflow's
price domain. Fixture exposes labelled controlled DOM wheel replay buttons.
