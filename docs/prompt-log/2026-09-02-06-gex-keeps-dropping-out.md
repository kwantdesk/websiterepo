# 2026-09-02 — 06 — GEX keeps dropping out

## Prompt (verbatim)

> cunt why the fuck does gex keep droppin gthe fuck out its unnaceptable matre

> mate fuck sake why the fuck does gex keep dropping out, its its not one thing its a fucvking nother with you

## Answer

Me again, third self-inflicted problem in one day.

**Cause.** The QuantData surface poller I added today spends up to 45 requests a
minute filling an options archive. The account allows 240 a minute for
*everything*, and the desk's own GEX panes are spending that live. From the
gateway's own status while GEX was dropping: `requests 79, ok 76,
rateLimited 3`. A 429 is account-level - it does not degrade one surface, it
kills every GEX page at once, intermittently, which is exactly the symptom.

**Fix.** The poller now defaults to **off** and needs `QUANTDATA_SURFACE_POLLER=1`
to run at all. Confirmed after deploy: `enabled: false`, 0 requests. The
archive is worth having; it is not worth taking quota from a live session, and
if it runs again it runs out of hours.

## All three of today's load sources, and where they are now

| What I added | What it did | Now |
|---|---|---|
| Volume-profile read the tape per request | Blocked the event loop — `/health` 30s, one request 58.7s | Reverted to the live ring (`24105c6c`) |
| Flow folding whole sessions in-request | Blocked it again — `/health` 25s, options and GEX dead | Background warmer, one session at a time (`e73ef324`) |
| QuantData surface poller | 429s killing GEX intermittently | Off unless explicitly enabled |

Common thread: **everything I built today to fill the archive competed with the
live desk.** All three are now off the live path.

286 gateway tests green, including a new one that fails if a request ever folds
a session itself again.

## Still owed

- The Globex volume-profile question from
  [02](2026-09-02-02-globex-volume-profile.md) is still undiagnosed.
- Prior-session volume profiles are knowingly wrong again after the revert.
- Weekly value area still withheld.
- The Sell button work is unfinished and uncommitted (it is invisible, not
  missing — border, fill and label all come from the chart down colour, which on
  a pale theme matches the panel).
