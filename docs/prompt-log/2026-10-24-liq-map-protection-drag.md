# LIQ Map SL / TP dragging and chart-label parity

Owner requires movable TP/SL in LIQ Map and labels matching normal charts.

- Capture now belongs to the stable plot, not the moving price-label button.
  Leaving the visible range can remove a button; it must not cancel the gesture.
  Pointer IDs and scope are checked, final pointer-up coordinates are sampled,
  scaled iframe coordinates are normalized, and every completion/cancellation
  releases the existing shared engine's protection suspension.
- Actual isolated browser drags: SL29990→29995.5, TP30010→30013.25, then TP
  beyond the visible plot→30022.5, each committed with dragging=false afterward.
  Only the synthetic in-memory ledger was edited; no owner trade was touched.
- Protection labels now match normal charts'24px height/12px bold monospace,
  width calculation, contrast-safe candle/theme colours, inverted background,
  dashed levels, signed quantity, tick-precision price, projected P&L and X
  removal control. Partial targets use remaining quantity and retain target ID.
- Both surfaces still use the same workspace protection/order handlers and
  ledger. No second account store, network endpoint or polling was introduced.
- Twelve focused tests pass, including actual handler execution for capture,
  final release, scaled iframe, unrelated pointer and stale scope/replay guards,
  plus24 dimension comparisons against the real normal-chart implementation.
  Scoped lint passes. Production build/typecheck passes (entry-caption-only
  follow-up is covered by focused tests and a final typecheck).
- Current authentication outage is separate. Do not test by modifying the
  owner's live paper position or claim signed-in production drag acceptance
  while routing is returning authentication middleware504s.
