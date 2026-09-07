# Live candle open authority

## Prompt

> but on a recent candle it closed, then new one opened in the correct spot in
> line with the closure of the one before then 1 second later jumper to
> somewhere else and cut half the candle off , fix this, ween it happen a few
> times, check this on the 1m time frame and all the other ones

## Diagnosis

The direct live stream created and painted the new bucket correctly. When a
slightly delayed history/cache response arrived for the same forming bucket,
the history/live seam always replaced the observed live open with the partial
provider snapshot's open. React could then repaint that stale geometry after
the direct live frame, producing the visible one-second jump and shortened
body.

## Fix

- Added a single candle-authority arbiter for delayed history/live joins.
- The startup bucket may have been only partly observed, so archived history
  remains authoritative for its open.
- Every later bucket began while the live stream was connected. Its first live
  price is therefore an immutable open; delayed history can contribute wider
  real highs/lows and volume but cannot rewind that open or the newest close.
- Applied the rule to both the cached/backfill seam and the observed Databento
  tail seam.
- Retained the direct live candle separately inside the renderer so a late
  same-bucket React commit cannot repaint over it.
- Event-driven range, volume, trade, Renko, point-and-figure and delta bars are
  intentionally unchanged because they do not use clock buckets.

## Verification and outcome

- New regression covers every configured clock interval: 1/5/15/30/45 second,
  1/2/3/5/10/15/30/45 minute, 1/2/4 hour, day, week and month (19 total).
- Candle OHLC healing: 6/6 passed.
- Candle visibility/series behavior: 5/5 passed.
- TypeScript and the full production build passed.
- Outcome: after a new time candle opens, delayed history/state cannot move its
  open, rewind its close or visually cut its body; genuine market gaps remain
  genuine and older completed bars retain historical authority.
