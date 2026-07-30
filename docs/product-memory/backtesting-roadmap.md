# Kwant Desk Backtesting — Future Product Memory

Updated: 2026-07-30
Status: Reserved for future development. No backtesting engine or data integration has been implemented.

## Product intent

Backtesting will let traders test Kwant Desk strategies and decision logic against historical markets. The future scope includes:

- KwantBot logic and generated Gameplans.
- Gameplan levels, zones, conditions, confirmations, targets, and invalidations.
- Futures price behaviour around the market structure and options-derived context available in Kwant Desk.
- Repeatable testing with results that can eventually connect to Journal and reasoning records.

## Required data review

Before implementation, audit the exact historical entitlements, retention, resolution, and rate limits available from the currently connected providers. The intended system will require:

- Historical futures price data at sufficient resolution for deterministic replay.
- Historical options-chain and options-tape data, including the fields needed to reconstruct the options-derived signals used by Kwant Desk.
- Time-aligned snapshots so the engine uses only information that was available at each historical moment and avoids look-ahead bias.
- A documented fallback or storage strategy if the providers do not retain all required historical options data.

## Current decision

The top-level `Backtesting` workspace is reserved and intentionally blank. Product design, provider entitlement checks, storage architecture, and engine implementation are deferred until this work is explicitly resumed.
