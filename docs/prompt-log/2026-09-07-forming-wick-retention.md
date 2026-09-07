# Forming candle wick retention

## Owner prompt

> A wick will come up, tap somewhere, then not stay where it tapped and
> disappear. This is a candle-wick bug we seriously cannot have.

## Diagnosis

The tick path correctly retained and displayed fast extrema, and the
history/live merge correctly widened extrema. The final direct chart listener,
however, still trusted every incoming candle object independently. A delayed
flow reconciliation or other publisher could emit a stale same-timestamp
snapshot with a smaller high or higher low. Lightweight Charts then accepted
that object and visibly shortened the forming wick.

## Fix

- Added final-boundary same-source-bar authority before queueing or retaining a
  live candle.
- The first direct snapshot owns the forming open. High can only increase, low
  can only decrease, and cumulative volume/trade/side counters cannot rewind.
- Close remains the newest real close, so price can move naturally back inside
  the already printed range.
- A different source timestamp starts with independent OHLC and counters;
  previous-bar extrema cannot leak forward.
- The authoritative candle now feeds the visible frame queue, Footprint/CVD
  live sampling and the later React/history reconciliation path.

## Verification and outcome

- Live candle visual path: 13/13 passed, including explicit upper/lower wick
  shrink attempts, current-close movement and new-bar isolation.
- Live candle authority: all 19 time intervals passed.
- Candle OHLC healing: 7/7 passed.
- TypeScript passed.
- The broader Rithmic integrity matrix still has its already tracked 4/2VB
  gateway/browser builder-parity failure; this change neither caused nor hides
  that separate event-builder issue.

Outcome: after a wick is observed for a forming candle, no stale snapshot can
erase it. A true provider correction would need an explicit correction-aware
contract; ordinary snapshots are intentionally monotonic for trading safety.
