# KWANTDESK important notes

This is the persistent launch ledger for material work that is incomplete,
provider-blocked or unsafe to forget. Every task handoff should include a short
recap of the open items below and update this file when their state changes.

## P0 — Historical market-data coverage

- **Options-underlying candles:** QuantData was directly verified on
  2026-09-04 to return real 2025-01-03 one-minute bars for all 13 physical
  targets: SPX, SPY, QQQ, NDX, IWM, AAPL, NVDA, TSLA, MSFT, AMZN, META, AMD
  and VIX. The checkpointed production VPS backfill is active and targets
  every physical options-underlying ticker from 2025-01-01. At the first
  post-deploy snapshot it had completed 88 of 113 attempted ticker/sessions,
  with 24 holiday/empty observations awaiting confirmation and one partial
  awaiting retry. It is intentionally blocked
  during the US cash session so history can never consume the quota needed by
  live GEX/tickers. Keep this item open until the production ledger proves all
  available sessions are complete.
- **VXN:** QuantData returned zero VXN rows for 2025-01-03 and the production
  Massive/index-provider credential is not configured. VXN live and intraday
  history therefore remain provider-blocked. Acquire an explicitly licensed
  VXN-capable source before presenting it as live or historically complete.
- **Historical option contracts/chains/tape:** underlying QQQ/META/VIX candles
  are not option-contract history. QuantData responses are archived from the
  day capture began, but January-2025 full chains, Greeks, open interest and
  trade tape have not been proven available. Confirm QuantData entitlement and
  retention or procure the planned licensed historical options source; never
  reconstruct past surfaces with future data.
- **Futures minute bars:** the Rithmic History Plant queue covers all 53 offered
  CME-group roots from 2025-01-01 and remains in progress/retry. Do not call it
  complete until its production ledger has no unresolved real-root windows.
- **Futures event charts:** historical tick, volume, range, Renko and Footprint
  require the separate trade-tick/VAP import. They must never be fabricated
  from minute OHLC.

## P0 — Launch reliability

- Preserve the live-feed priority rule: no bulk history, archive compaction or
  analytics work may compete with Rithmic or QuantData during the US market
  open. A healthy HTTP process is not sufficient; live timestamps and recorder
  counters must advance.
- The dedicated Vultr volume is primary recording storage, not an off-site
  backup. Add and restore-test nightly object-storage replication before the
  public launch.

## P1 — Reference parity evidence

- **Big/Deep Contracts and Big Blocks:** calculation/settings/live-event
  contract parity has been audited against the installed Deep Charts assembly.
  Deep Contracts now lives inside Big Contracts and Big Blocks updates from
  the forming Rithmic bar. Capture a fresh interactive screenshot sweep when
  safe native-window control is available; the proprietary protected formula
  body is not inspectable, so do not call it pixel/formula identical without
  that evidence.
- **Imbalance Tracker:** the installed licensed Deep Charts assembly metadata,
  calculation fixtures and KWANTDESK renderer have been reconciled. The
  live-edge width, real opacity and saved-settings faults are fixed. Capture a
  fresh interactive Deep Charts/KWANTDESK screenshot pair when native-window
  control is available; do not describe pixel-level visual parity as complete
  until that final comparison is recorded.
- **Composite Volume Profile:** the installed assembly contract and official
  Volume Profile reference have been mapped to the live KWANTDESK engine. The
  indicator is calculation/settings complete, right-docked and execution-live.
  Capture the final side-by-side screenshot sweep when safe native-window
  control can expose Deep Charts; do not claim pixel-identical parity before
  that evidence is recorded.
- **VWAP family:** VWAP, continuous VWAP Envelopes, Rolling VWAP, Anchored VWAP
  drawing and Volume Profile VWAP now share an audited period/source/envelope,
  five-band, colour and persistence contract. Capture the final interactive
  Deep Charts/KWANTDESK screenshot sweep when native-window control is
  available. Also compare Orders-period VWAP directly on raw executions when a
  period boundary falls inside an aggregated candle; candle trade counts
  cannot split that candle exactly.

## 2026-09-04 — Composite Volume Profile

- Activated the existing catalogue entry as a live indicator. It requests one
  exact Rithmic execution profile over the complete loaded range, stays fixed
  to the right by default and develops from the direct execution path.
- It inherits the full tested Volume Profile contract: input/filter/grouping,
  style/width/offset, POC, value area, peak/valley, VWAP/envelopes, summary and
  session filtering. Focused regressions, TypeScript and the production build
  passed; only the interactive screenshot comparison remains open above.

## 2026-09-04 — VWAP family

- Corrected VWAP Envelopes and Rolling VWAP so their continuous windows no
  longer reset at the CME reopen. Base VWAP now supports documented trading-day,
  minute, second and order-count periods.
- Added four price sources, standard-deviation/percentage envelopes, five
  independently enabled bands and complete theme/custom colour controls.
- Anchored VWAP now renders live deviation bands and optional fill, and its
  settings survive drawing templates. Shared indicator templates continue to
  account-sync and import/export the complete VWAP settings record.
- Calculation, migration, theme, template, profile, TypeScript and production
  build checks passed. Evidence limits remain listed under Reference parity.
