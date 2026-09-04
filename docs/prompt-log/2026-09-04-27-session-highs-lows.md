# Prompt 27 — Session highs and lows contract

## Requested

Remove the `P3`-style prefix and numeric suffix from Session Highs & Lows chart
labels, use Asia rather than Tokyo, provide Globex, Asia, London and New York,
verify the sessions, and keep every line/label colour tied to the active theme.

## Fixed

- Replaced the rolling “latest three windows of any type” selection with one
  latest completed high/low pair for each enabled named session, so all four
  requested sessions can coexist.
- Standardized labels to `Globex High/Low`, `Asia High/Low`, `London High/Low`
  and `New York High/Low`; removed both the `P1/P2/P3` prefix and the appended
  numeric price from this study’s on-chart text.
- Standardized the DST-aware exchange-time windows in America/Chicago:
  Globex 17:00–16:00, Asia 17:00–02:00, London 02:00–10:00 and New York
  08:30–15:00.
- Removed the link to the separate Sessions overlay and its Tokyo/Sydney/random
  colour settings. Highs and lows now repaint from the active chart theme’s
  contrast-safe visible positive/negative colours on every theme change.
- Added a legacy workspace migration so saved Tokyo, Sydney, per-session
  colours and previous-rank switches cannot keep the old behavior alive.

## Outcome

The focused session contract regression passes, as do the existing Globex and
Initial Balance session regressions. Scoped lint reports zero errors, and the
complete 80-page production build passes compilation, TypeScript and static
generation.

Deployment details are appended after the production deployment reaches Ready.
