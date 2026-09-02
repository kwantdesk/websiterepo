# 2026-09-02 — 01 — Timeframes only showing ~40 minutes

## Prompt (verbatim)

> why are most time frames only showing bars back to the last 40m mins like that aint on mate....  volume bars unavaibale so you need to fix that too, range ones only showing 40 mins back like mate sort this out, 40 range aint even working so sort out all the fucking timeframes, dont come back till every sinlge one is sorted otherwise im cancelling my subsription
>
> hard rule every prompt i give ytou know, you write it to a folder, you copy what is said in a file, the you write your answer to it once you are done, hard rule form now on so that we cna look back at progress and check if you are cutting corners and ims ick of it...

## Answer

Two separate faults, both mine, both from this morning's work.

### 1. NQ charts were being served MNQ's history

A micro root aliases to its parent so a request for MNQ can be answered from
NQ's book — a micro tracks its parent tick for tick, and until this morning the
micros were not subscribed at all. That match is symmetric: NQ aliases to root
NQ and so does MNQ. The moment I subscribed the micros, `MNQU6` entered the
book and a plain `NQ` request matched it too — and it sorted first.

Measured: `/v1/market-data/history?symbol=NQ` answered with symbol **MNQU6** and
**27** five-minute candles, against **809** for NQU6 over the same window. MNQ
has only been recorded since 08:50Z today, so every NQ timeframe showed about
forty minutes and looked like the archive had been wiped, while the bars sat on
disk the whole time.

Cash quotes, volume profiles and order-flow routes resolve through the same
function, so they were reading the micro's book too. The prices match tick for
tick, which is exactly why nothing looked wrong.

Fixed by comparing the requested root *before* aliasing. `NQ` picks NQU6, `MNQ`
picks MNQU6, and MNQ still falls back to NQU6 when no micro is in the book —
the reason the aliasing exists. Extracted to a pure module with 7 tests.

### 2. Every timeframe with order flow returned an error

Footprint, CVD, delta and Big Trades need the aggressor side, which an OHLC bar
does not carry. The website rebuilt it by streaming the vendor's raw trades, and
that account answers 422 for CME. Because the flow was fetched **inside the same
call** as the bars, its failure threw the bars away too — so every chart fell
back to what it had accumulated live since the tab was opened. `orderFlow=1` is
set on every chart request, so this hit all of them.

Now aggregated on the gateway, folded once per session and cached beside the
bars. A five-day NQ window is 1.5 million prints and 6 MB gzipped per pane per
load, against ~1,400 rows once folded — shipping the prints would have traded a
broken chart for a slow one.

Delta highs and lows are stored relative to each minute's own start so they
compose exactly onto any interval: a 5m bar's delta high is the peak of the
cumulative path across all five minutes, not the largest of its minutes' peaks.

## Verified (cold cache, against the live collector)

| Class | Result |
|---|---|
| 1m 2m 3m 5m 10m 15m 30m 1h 4h 1d | all **5 sessions**, 100% flow coverage |
| 8r 12r 21r **40r** 54r | all **5 sessions** (40r: 4,570 bars) |
| 500v 1000v 2000v 5000v **200v** | all **5 sessions** (200v: 7,048 bars) |
| 12/4VB 21/7VB 54/12VB | all **5 sessions** |
| NQ / ES / MNQ / MES | each resolves to its own contract |

283 gateway tests, 10/10 event-bar checks, eslint, `tsc`, `npm run build` — all
green. Commits `8d409e85`, `7723202d`, `db2a6852`, `f3ea5f9f`, `e8ad2192`.

## Found while checking, and also fixed

- **TPO Levels** returned "unavailable" on every request — same dead vendor.
  Rebuilt on the recorded tape: 11 zones over 5 sessions.
- **Prior-session volume profiles** were built from a bounded in-memory ring, so
  a prior day returned **1 price level and 3 contracts** — a POC and value area
  made of real prints from the wrong three trades. Now read from the tape:
  2026-08-31 returns 417,007 contracts across 2,245 levels.
- **Daily/weekly value areas** were failing 402. Rebuilt on the tape.
- **Provenance**: the chart route and TPO reported `dataset: "GLBX.MDP3"` while
  every bar came off our own recorder. The source field is the first thing
  checked when a number looks wrong, so a label naming a provider we no longer
  buy from is worse than none.
- Backfilled two more sessions (2026-08-23, 08-24) — tape now covers 8 sessions.

## Not fixed — read this part

- **Weekly value area is withheld.** A week of NQ exceeds the per-request print
  cap, so the window comes back covering only its newest part. I made both the
  gateway and the website refuse rather than draw it: a partly covered value
  area is not a rougher answer, it is a confident answer at the wrong prices.
  Because the payload requires daily *and* weekly, this means **no value-area
  levels draw at all** right now. Fixing it properly means folding value areas
  per session on the gateway, the same way flow now works. Not attempted this
  close to the open.
- **4r and 4/2VB show 3 sessions, not 5** — they hit the 120,000-bar ceiling,
  not a data limit.
- **MNQ and MES only have 2026-09-02** — they were never subscribed before
  08:50Z that day, so there is nothing to recover. Not filled from NQ/ES.
- Heaviest event intervals take ~10s on a cold load, then ~0.5s cached.
- **No live RTH check yet** — this was all verified pre-open.
