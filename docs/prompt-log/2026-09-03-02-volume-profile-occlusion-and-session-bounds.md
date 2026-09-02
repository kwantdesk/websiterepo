# 2026-09-03 — 02 — Volume-profile occlusion and session bounds

## Prompt (verbatim)

> third time ive asked for this and claude simply hasnt done it, the value are lines should not go infront of a volume profile in front so - when a volume profile is in front of another it should not have the lines pass through ever, they should stop at the back in any combination of volume profiles, this is still a bug and sometimes thty go right through creating a messy chart, fix this also, sommetimes value area lines go backwards instead of forward like what some just have the lines doing out the back to the left of the screen like that doesnt make any sense does it also the voume profules dont look like they are the correct height or calculating properly, i go back and look at a volume profile from last week and its tiny at the top then goes asion ll the way down in line with the current low, like its only meant to calculate its session thats it

## Answer

Two independent defects were fixed.

### Lines crossing profiles or travelling backwards

The renderer deliberately queued every POC, VAH and VAL until after all
histograms, then painted every line over every profile. Its time-based chain
also forced a stop point to be at least the source session's end, so an
overlapping London/New York or mixed-period profile could not stop the rear
line at the body in front.

The renderer now records the exact left/right screen span of every visible
profile body, including docked, left-facing, daily, weekly, fixed and split
profiles. A level begins only at its own body's forward edge and ends at the
nearest same-instrument body's back edge. If another profile already covers
that starting edge, no segment is drawn; it can never be reversed out toward
the left of the screen.

### Historical session profiles stretching to current price

The live Rithmic merge checked that a trade shared the profile's CME trading
date, but a named Asia/London/New York profile did not enforce its own end
time. Later prints from the same trading day were therefore added after the
session closed, expanding its stored end and adding price rows outside its
session. A historical Asia profile could consequently grow toward the current
market low.

Named daily sessions now accept trades only in `[startMs, endMs)` and their
closing boundary is immutable. Unsplit developing daily/weekly profiles still
grow normally.

### Verified

- Direct regressions cover the nearest blocker, mixed profile combinations,
  docked/overlapping bodies, other instruments, a covered source, and the
  no-backwards invariant.
- A data regression feeds an Asia profile one valid closing print and one later
  same-date print at a much lower price; only the in-session trade is accepted,
  and the session end remains unchanged.
- All 18 registered volume-profile test commands pass.
- Scoped ESLint, `tsc --noEmit`, and the full production `npm run build` pass.

### Deployment

Committed and pushed to `main`; the active `websiterepo-yfmi` Vercel project
receives the production deployment from that push. No gateway restart was
required because both fixes are in the website client/data merge.

### Unfinished

None for this prompt.
