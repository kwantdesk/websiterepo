# Chart emoji catalogue — 2026-09-06

## Owner prompt

“for out new emojis on the chart, can we make sure we have all the emojis we can get eg add more than what we already have...”

## Change

- Replaced the chart-only hand-picked list with the pinned Emojibase 17.0.0 English compact dataset: 1,949 base entries and 3,979 entries including actual skin-tone/mixed-tone sequences.
- Added all ten categories, name/keyword/pasted-emoji search, a skin-tone variation toggle, trading quick picks, and scrollable 120-entry pages. Every entry is reachable; the DOM does not mount thousands of buttons at once.
- Lazy-load the picker/catalogue only when its flyout opens. No provider requests, polling, image CDN, paid service or database migration.
- Preserve the existing placement, chart anchoring, zoom scaling, resizing and saved drawing path. Compare optional presentation selectors canonically so existing selected emojis still highlight.
- Device fonts determine the appearance/support of newer emoji and flags; the picker states this explicitly. No claim that every OS can render every Unicode sequence.
- Data source: https://emojibase.dev/docs/datasets/ (MIT package; Unicode/CLDR-derived data). Versions and integrity are pinned in the npm lockfile.

## Verification

- 15/15 catalogue, placement/persistence and zoom-scaling tests passed, including all 3,979 sequences through drawing save/restore, full page traversal and retention of previous choices.
- Scoped ESLint and TypeScript passed.
- Full Next.js production build passed (80 static pages). Production deployment is verified separately after this commit is pushed; no signed-in visual claim is made.

## Deployment authority

Owner confirmed the duplicate Vercel connection is disconnected in response to the explicit resume-push question. Updated the obsolete hold in AGENTS.md; its pre-existing unrelated desktop automation section remains user-owned and excluded from this commit.

## Remaining

- Signed-in browser visual verification is not yet performed.
- Existing launch ledger remains open: history backfill/tick-VAP coverage, VXN/options history licensing, off-site restore-tested backup, market-open reliability and final DeepCharts visual parity.
