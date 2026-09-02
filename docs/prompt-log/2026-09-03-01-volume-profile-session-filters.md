# 2026-09-03 — 01 — Volume profiles disappearing, session filters wrong

## Prompt (verbatim)

> ok volume profiles, they keep fucking dissapearing mate, the daily ones and there is bugs, when i only select asia some dont show and sometiems it shoes others, same if i only select new york etc....

## Answer

Two separate faults.

### 1. Selecting one session showed the wrong ones — website

A split day makes one profile per session window, all sharing a trading date.
The filter deciding which already-drawn profiles to KEEP compared symbol,
contract, grouping, volume filters and date — but **not the session**. So
unticking a session left its profile drawn until something else evicted it,
while the one still ticked waited for a fetch. Same fault switching Filter time
(the RTH profile outlived a move to Overnight) and turning splitting off (split
profiles stayed when the day should be one profile again).

The session is now part of a profile's identity, as a pure function beside the
window definitions where it can be tested. This is the **third** fault in this
area; the first two are covered by `test:volume-profile-session-toggle`.

### 2. Daily profiles disappearing — gateway, and my own regression

The profile route built from the live in-memory execution ring, which is
bounded. Measured mid-session it reached back only to 14:04Z:

| Window asked | Coverage returned | Volume |
|---|---|---|
| Asia 00:00→07:00Z | 00:00→**01:01** | 9,433 |
| London 08:00→16:00Z | **14:04**→15:59 | 117,149 |
| New York 13:30→20:00Z | **14:04**→20:00 | 238,166 |

As the day rolled forward each session fell out of the ring in turn — that is
the disappearing — and the survivors were silently computed over a fraction of
their window.

This was my own regression: I had fixed it by reading the recorded tape per
request, which took the desk down twice, and reverted it. Done properly now,
the way bar flow works — each session folded **once** into per-minute price
histograms, cached to disk, warmed in the background, never folded inside a
request. Minutes are the unit because a profile SUMS, so any window on a minute
boundary is reconstructed exactly, and every session the product offers is one.

After:

| Session | Coverage | Volume |
|---|---|---|
| Asia | 00:00→**06:59** | **42,756** |
| London | **08:00**→15:59 | **243,872** |
| New York | **13:30**→19:59 | **304,351** |
| Globex | **22:00**→23:59 | 6,633 |

### Load tested this time

8 concurrent profile requests while sampling `/health`: **0.66–0.89s
throughout**, no blocking. That is the check I skipped on the two changes that
caused outages.

Deployed during the maintenance halt, ~15h before the RTH open.

### Also fixed

Two suites had been **failing on HEAD** since the windows moved to DeepChart's
boundaries — both asserted the sessions never overlap, but London and New York
deliberately do between 08:30 and 10:00 Chicago. They now assert what actually
matters: no two windows start on the same instant (a tie makes the level chain
unresolvable), and no gap. `test-volume-profile-data-settings.mjs` existed but
was never registered in `package.json`, so it had never run; it passes.

### Verified

294 gateway tests, 8 new profile-fold tests, volume-profile suites,
ESLint 0 errors, `tsc --noEmit`, `npm run build` — all green.

### Not covered

The first request for an un-folded session returns "no executions" for up to a
minute while the warmer catches up, then fills in. Honest, and self-healing,
but you may see a profile arrive a moment after load.
