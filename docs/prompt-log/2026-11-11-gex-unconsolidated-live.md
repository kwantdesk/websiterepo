# GEX datatask resume: Unconsolidated live delivery

Resumed the owner's paused QuantData comparison. Isolated signed-in browser views used SPY, current November 10 New York session, no expiry/moneyness restriction. Timed screenshots and DOM observations are in the primary repository's `docs/audits/2026-11-11-quantdata-parity` folder.

The live client explicitly excluded Unconsolidated, leaving the app's 30-second finite REST refresh. A 30.822-second sample showed the latest displayed execution holding at 12:49:41 Brisbane while the reference advanced; ours later advanced to 12:50:18 while the reference reached 12:50:39. This is a demonstrated delivery fault, not proof of a session boundary error.

Enable the existing authenticated, shared VPS snapshot lease for latest-first Unconsolidated. Older pages remain finite requests and keep the first-page lease alive. Alternate sorts fall back to finite requests. Reuse provider-ID merging to retain older loaded trades, deepest cursor and new full-session statistics; failed refreshes retain the prior cursor. No gateway, subscriptions, orders, workspace layouts, provider credentials or session-window changes.

The suspected 09:30 boundary was NOT applied: the reference and public session response share the exact earliest SPY execution at epoch 1794313800485 (07:30 New York), Call765, quantity10, premium120, AMEX, EXT_HOURS. Current live summary differences still need matched acquisition-time comparison after deployment. Snapshot delivery does not reproduce every event on the reference's private push channel; this release does not certify 1:1 parity.

Validation: 62 targeted client, actual-app lifecycle, session/filter and provider-ID merge tests pass. Full production `next build --webpack` passes. Deployment and live UI retest must be recorded separately; tests alone are not parity evidence. Main-only Git integration; no backend restart or new paid service.
