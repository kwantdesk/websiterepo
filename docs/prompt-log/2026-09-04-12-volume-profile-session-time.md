# Volume-profile session-time repair

## Prompt

> Volume profile session time adjustment does not seem to be working.

## Diagnosis

The dialog stored the exchange-time values correctly, but a non-split daily
profile was still requested by trading date. The Rithmic collector accepts an
explicit start and end for a profile; it does not apply the browser's
`filterTime`, `sessionStartMinutes` or `sessionEndMinutes` fields to a
trading-date request. The result was therefore the full session regardless of
the clock shown in settings.

The UI also allowed Custom window to coexist with Filter mode set to None. In
that state the time inputs looked configured while the selected mode explicitly
asked for no filtering.

## Fix

- Resolve every filtered daily session into concrete America/Chicago start and
  end timestamps before requesting Rithmic data.
- Give the bounded response a stable trading-date and session identity so it
  replaces the prior window immediately and remains eligible for live updates.
- Make choosing Custom window arm Filter mode, and make an edited clock
  explicitly persist Custom + Filter.
- Keep the end-session attribution option unavailable when a custom clock is
  not selected, because it has no effect there.

## Outcome

Changing either session time now changes the actual execution interval used to
build Daily, Ask/Bid and Delta volume profiles. Cross-midnight custom windows
remain supported, and whole-session mode remains an explicit separate choice.
