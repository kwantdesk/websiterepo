# All-futures historical-bar coverage

## Prompt

> By the way, for the historical bars, we need it for every single future we offer.

## Audit

- Reconciled the complete selectable futures catalogue against the production
  Rithmic History Plant queue.
- The two sets match exactly: all 53 enabled CME, CBOT, NYMEX and COMEX product
  roots are queued, including the separate mini and micro products. No future
  is being substituted with another product's history.
- A production read-only check confirmed the boot-enabled history service and
  its container are running. At the audit snapshot, 1,235 seven-day windows
  were complete, 10 ledger entries were failed, and the process was continuing
  through the remaining roots. Seven of those failures are real product-root
  windows and three are older pilot/control requests. The checkpoint-safe
  systemd run retries failed roots after the pass rather than discarding them.
- Current History Plant accounting was about 1.03 GiB for the week, below the
  deliberate 36 GiB ceiling protecting Rithmic's 40 GB weekly allowance.

## Fix and outcome

- Extended the futures routing regression to parse the actual History Plant
  runner and require exact set equality with the website catalogue.
- It now fails on a missing root, extra root, wrong exchange or duplicate. A
  newly offered future therefore cannot silently ship without being added to
  the historical-bar queue.
- The current 53-root queue passes the guard. The import remains in progress;
  this change does not falsely describe every root as downloaded already.
- This phase imports authoritative one-minute History Plant bars from
  2025-01-01 and supports all chart intervals of one minute or greater through
  aggregation. Historical tick, volume, range and Footprint charts require the
  separate trade-tick/VAP import phase and are not fabricated from minute OHLC.
- This is a test/documentation-only safeguard, so pushing it should be skipped
  by Vercel's ignore rule and incur no application deployment build.
