# Prompt log — Swing Point — 2026-09-07

## Owner request

Continue the pending-indicator overhaul one indicator at a time using official
DeepCharts material and the licensed local DLL, with real calculation,
settings, rendering, persistence, themes and performance rather than removing
the Pending label cosmetically.

## What was fixed

- Implemented confirmed swing highs/lows with the public `2 / 2 / Filter`
  contract and explicit, tested tie/filter conventions.
- Added three display modes, five line styles, high/low and text colours,
  widths, text sizing/offset, theme following, sliders and saved normalization.
- Added a custom overlay primitive whose horizontal levels terminate at the
  next swing and whose paths cannot cross missing or out-of-order history.
- Added deep-history routing and actual chart/preview renderer registration.

## Outcome

The complete catalogue audit moves from 22 to 21 pending entries. Nine focused
tests, 39 combined recent-indicator tests, shared slider/template/theme checks,
scoped ESLint, TypeScript and the full 80-page production build pass. Browser
QA verified the real plotted segments/settings and Save persistence. Exact
protected vendor tie/filter/pixel parity and a live-market soak are explicitly
not claimed.
