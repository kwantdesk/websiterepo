# Weekly and composite volume-profile load latency

## User prompt

> composite and weekly volume profile take so long to load in like 30 seconds can we fix this?

## Diagnosis

The renderer and value-area calculation were not creating the delay. When an
exact weekly or composite window needed an archive session that had not yet
been folded, the request queued it and returned. The profile warmer examined
only one queued session every 20 seconds. The browser then suppressed another
request for 15 seconds after the incomplete response. Those two independent
delays produced the observed roughly 30-second wait even when the actual fold
was quick.

## Fix

- A missing session now immediately wakes the existing serialized archive
  worker instead of waiting for the next 20-second maintenance tick.
- Consecutive missing sessions drain promptly, while the shared worker still
  prevents concurrent disk-heavy folds.
- The original volume-profile request waits for up to eight seconds for its
  requested off-thread folds and retries the in-memory read once, allowing a
  cold weekly/composite profile to arrive in the first response.
- The event-loop load guard remains authoritative: under measured overload the
  work stays queued and the safety interval retries it later.

## Outcome

The artificial 20-second queue gap and following browser retry gap are gone.
Cold exact profiles now appear as soon as their real archive folds complete,
without replacing them with approximate candle-volume profiles or blocking the
live Rithmic/quote event loop.
