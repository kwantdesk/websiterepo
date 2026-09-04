# Prompt 26 — VWAP-family overhaul

## Requested

Audit every VWAP variant one by one against Deep Charts: ordinary VWAP, VWAP
Envelopes, other indicator VWAPs and draw-on/fixed VWAP behavior. Correct the
logic and settings, make theme colours work, and ensure templates persist.

## Fixed

- Replaced the shared session-reset shortcut with explicit period and
  continuous rolling VWAP calculators.
- Added all documented base periods and both envelope calculations.
- Added four selectable price sources, five switchable indicator bands, line
  widths/styles, per-series colours and optional current values.
- Migrated old Rolling VWAP workspaces without losing their chosen bar window.
- Upgraded live Anchored VWAP from one line to a configurable, filled
  deviation-band drawing whose settings are included in saved templates.
- Re-verified the existing Volume Profile VWAP against the shared profile
  structure/parity suites.

## Outcome

Focused VWAP, profile and template tests pass, TypeScript passes, and the full
production build passes. The licensed assembly and official documented
contract are reconciled. A fresh interactive Deep Charts screenshot sweep and
raw-execution validation of an Orders period that crosses within one candle
remain explicitly open; neither is represented as completed evidence.

Production commit `c743c973` deployed successfully through the sole active
Vercel project `websiterepo-yfmi`. GitHub deployment `6259191618` / Vercel
deployment `9qwhBugh8o8rTqhiwmD7MRGxdwtx` reached Ready at
`https://websiterepo-yfmi-ke7hqedvf-kwant-desk.vercel.app`; the production
`/charts` route returned HTTP 200.
