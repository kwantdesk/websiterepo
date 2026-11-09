# Entry / exit drawing fill colours — 9 November 2026

New arrow drawing defaults already use PAPER_FILL_BUY_COLOR (#22e887) and PAPER_FILL_SELL_COLOR (#ff3b5c), matching PaperFillMarkersRenderer in Chart.tsx. Entry defaults green, exit red. These defaults remain independent of the chart theme and preserve explicit saved custom colours.

Added permanent named Green and Red fill-colour buttons to both arrow Style panels, alongside the existing full custom colour picker. Both quick picks use the same shared fill constants, disable theme override, and report their selected state accessibly. Updated the drawing preview style path to use the same arrow-specific colour/width/label defaults rather than generic themed line styling.

Actual ChartDrawSettings browser checks cover both tool types: initial default colour, both quick picks and aria-pressed state, custom hex colour selection, return to quick pick and JSON normalization/restore with a conflicting chart theme. Zero browser errors. Scoped settings ESLint passes. Full isolated Next.js webpack production build, TypeScript and static page generation pass. No existing user drawing is overwritten, and there are no data feed, account, order or gateway changes.

Evidence: browser-checks.log; production receipt saved locally after release verification.
