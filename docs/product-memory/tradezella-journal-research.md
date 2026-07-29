# Kwant Desk Journal — Competitor Research and Product Memory

Updated: 2026-07-29
Scope: TradeZella product analysis and the product specification for Kwant Desk Journal.

This document is permanent internal product memory. It records what the competitor sells, why traders pay for it, which workflows users value, recurring weaknesses, and how Kwant Desk should build a differentiated journal. It is not an instruction to copy TradeZella’s branding, language, interface, or proprietary implementation.

## Executive conclusion

TradeZella succeeds because it turns an untidy set of fills, screenshots, memories, and rules into a repeatable improvement loop:

1. Get trades into one place.
2. Show the trader an immediate performance summary.
3. Make every trade reviewable with executions, charts, notes, tags, strategies, risk, and attachments.
4. Aggregate those reviews into reports that reveal patterns.
5. Use calendars, streaks, scores, reminders, replay, and AI to keep the user returning.

The product is not valuable because it calculates win rate. Win rate, profit factor, expectancy, calendars, and equity curves are commodity calculations. Its value is the low-friction workflow connecting import → review → classification → comparison → behavioural change.

Kwant Desk should match that workflow quality while creating a different product identity and a stronger evidence model. The Journal should know where every record came from, distinguish imported truth from manual annotation, expose missing or suspicious data, treat screenshots as first-class evidence, and eventually connect each trade to the market state already available inside Kwant Desk.

## Current commercial offer

TradeZella announced new pricing effective 2026-07-14:

| Plan | Monthly | Annual effective | Primary limits |
|---|---:|---:|---|
| Essential | $35/month | $26/month, billed $315 | 1 active account, 10 strategies, 10 trade replays/month, 500 AI credits |
| Pro | $59/month | $44/month, billed $531 | 50 active accounts, unlimited strategies and replay, 1,500 AI credits, 10 automated backtests/month |
| Ultra | $99/month | $74/month, billed $891 | Unlimited accounts, 3,000 AI credits, 100 automated backtests/month |

Across plans, TradeZella promotes 300+ reports/data points, prop-firm sync, manual backtesting, AI review reports, mentor access, Spaces, education, and community. The public pricing page still exposes older plan names and prices in some crawled material, so the July 2026 Help Center announcement is the more recent source.

### What customers are actually paying for

- Time saved importing and organizing trades.
- Confidence that calculations are consistent across accounts.
- A single master trade log with filters, sorting, merging, and trade-level detail.
- A dashboard that makes performance legible immediately.
- Calendar-based daily and weekly review.
- Deep comparisons across symbols, times, directions, size, duration, setup, tag, emotion, and risk.
- The ability to connect a result to the behaviour or setup that produced it.
- Screenshots, notes, executions, targets, stops, and chart replay attached to the same trade.
- Habit formation through review status, rules, progress tracking, streaks, and reports.
- Replay and backtesting without leaving the journaling product.
- AI summaries and auto-tagging that reduce review effort.
- Mentor sharing, community, education, and responsive support.

## Product anatomy

### 1. Ingestion

TradeZella supports three broad paths:

- Direct broker/platform synchronization.
- Broker-specific file upload.
- Manual or generic CSV import.

The generic CSV workflow records executions individually. Common fields include date, time, symbol, buy/sell, quantity, price, instrument type, expiration, strike, call/put, commission, and fees.

Why it matters:

- A journal without dependable ingestion becomes a spreadsheet with a subscription.
- Multiple paths prevent one broken broker connection from blocking the whole workflow.
- Broker-specific adapters reduce manual column mapping.
- Immediate post-import analysis gives the user a reward as soon as their data arrives.

Kwant Desk requirement:

- Begin file-first, but keep import architecture adapter-based.
- Accept CSV, TSV, JSON, screenshots/images, and text notes.
- Detect common column aliases instead of requiring one exact template.
- Preserve the original file name, import time, detected schema, row count, accepted records, rejected records, and warnings.
- Never silently invent missing P&L, dates, or prices.
- Hash imports and flag probable duplicates.
- Keep manual annotations separate from imported source truth.

### 2. Dashboard

TradeZella’s dashboard supports configurable upper KPI widgets and lower analytical widgets. Common KPIs include:

- Net P&L.
- Account balance and P&L.
- Trade win percentage.
- Day win percentage.
- Profit factor.
- Average win and average loss.
- Expectancy.
- Current and maximum streaks.
- Maximum and average drawdown.

Common lower widgets include:

- Daily and cumulative net P&L.
- Time and duration performance.
- Recent trades/open positions.
- Calendar views.
- Drawdown.
- Progress/rule tracking.
- Custom metric reports.

It supports several display units: dollars, percentage, privacy mode, R-multiple, futures ticks/points, and forex pips.

Why users value it:

- A useful dashboard answers “How am I doing?” in seconds.
- Customization lets different trading styles prioritize different evidence.
- Calendar and equity curve make consistency emotionally visible.

Kwant Desk requirement:

- Use a concise default dashboard instead of confronting a new user with hundreds of metrics.
- Provide Net P&L, win rate, profit factor, expectancy, average R, max drawdown, average win/loss, and reviewed percentage.
- Add an import-health card and review queue; these are more actionable than another decorative statistic.
- Let filters update every card from the same selected population.
- Never label a metric “strong” or “excellent” without a declared threshold.

### 3. Master trade log

TradeZella treats the trade log as the operational centre. It provides key performance widgets plus a searchable, sortable, filterable record of trades. Users can customize columns and manage imported records.

The strongest trade-log attributes are:

- Every trade remains accessible.
- Summary statistics stay visible while the population is filtered.
- Users can move from aggregate data to the exact trades responsible.
- Trade details can include stats, strategy, executions, attachments, notes, and running daily P&L.

Kwant Desk requirement:

- Fast virtualized table later; compact semantic table now.
- Search symbol, tag, setup, note, and import source.
- Filters for account/import, date, symbol, side, outcome, review state, and evidence state.
- Sort by time, P&L, R, size, duration, and review status.
- Open a trade inspector without navigating away.
- Preserve provenance and source row identifiers.

### 4. Calendar and daily review

TradeZella’s calendar is one of its most consistently praised workflows. It combines:

- Winning, losing, and breakeven day color states.
- Monthly and yearly views.
- Weekly totals.
- Daily trade counts and P&L.
- Journal-entry indicators.
- Cumulative P&L and day-level statistics.

Why it works:

- Traders remember sessions by day, not database row.
- It makes streaks, overtrading clusters, and recovery periods visually obvious.
- Clicking a day provides a natural route into notes and trade review.

Kwant Desk requirement:

- Month calendar with P&L, trade count, reviewed state, and evidence count.
- Day drawer showing trades, screenshots, notes, and daily metrics.
- A “no-trade day” note should be possible later.
- Calendar colors must derive from the selected website theme, not fixed green/red alone.

### 5. Tags, setups, strategies, and psychology

TradeZella encourages custom tag categories such as:

- Entry timeframe.
- Market condition.
- Mental state.
- Sleep quality.
- Pre-market routine.
- Setup and mistake.

Tags become valuable because reports calculate distribution, performance, summary statistics, and filtered trade populations for each tag.

Why it works:

- P&L tells the trader what happened.
- Tags connect outcomes to repeatable context and behaviour.
- Honest mistake tracking turns vague self-criticism into measurable leakage.

Kwant Desk requirement:

- Use “Setups”, “Behaviours”, “Market State”, and free tags as separate concepts.
- Provide sensible defaults but never force a psychology taxonomy.
- Show sample size next to every tag result.
- Avoid presenting small-sample rankings as an edge.
- Later, attach Gameplan state, gamma regime, GEX map state, volatility, and news automatically rather than asking the trader to remember them.

### 6. Risk and execution analysis

TradeZella reports across:

- Volume and position size.
- Planned and realized R-multiple.
- Average and maximum drawdown.
- Trade duration.
- Entry and exit time buckets.
- Long/short performance.
- Win/loss comparisons.
- Options expiration and instrument reports.
- MAE/MFE and best-exit style analysis in newer product material.

Why users pay:

- These reports can identify over-sizing, poor holding behaviour, bad time windows, and systematic exit leakage.
- Cross-analysis lets traders ask a second-order question instead of seeing only one-dimensional charts.

Kwant Desk requirement:

- Calculate only metrics supported by the imported fields.
- Make missing initial risk explicit before showing R-multiple.
- Separate commissions/fees from gross P&L.
- Track data completeness for duration, side, size, entry/exit, fees, and risk.
- Add MAE/MFE only when intratrade market data or broker fields support it.

### 7. Notes, attachments, screenshots, and evidence

TradeZella supports trade notes, day notes, notebook entries, attachments, and downloadable notes. Its guided-day workflow encourages chart screenshots during the session and post-trade review afterward.

Why it matters:

- The chart screenshot often contains information the execution record cannot.
- A trader’s original thesis should be preserved so hindsight cannot rewrite it.
- Evidence makes later pattern review substantially richer.

Kwant Desk requirement:

- Treat screenshots as first-class Journal evidence.
- Support image import independently of trades.
- Allow later attachment of media to a trade or day.
- Preserve the image’s import timestamp, original filename, and optional caption.
- Provide full-screen preview and direct download.
- Future edge: align imported screenshot time with the Kwant Desk chart and market-state archive.

### 8. Review workflow and habit system

TradeZella’s guided day moves through planning, trading, importing, trade review, and reflection. It supports progress rules grouped into Prepare, Trade, and Reflect, plus review status and daily heat maps.

Why it works:

- It turns journaling from an unstructured writing task into a checklist.
- Traders receive a clear definition of “finished.”
- The review queue creates an open loop that encourages return.

Kwant Desk requirement:

- Every imported trade begins “Needs review.”
- A review becomes complete when the user verifies source data and optionally adds setup, evidence, notes, and rating.
- Show outstanding reviews prominently.
- Avoid gamifying profitability; reward process completion and data integrity.

### 9. Replay, backtesting, AI, mentoring, and education

These are major parts of TradeZella’s paid value, but they are outside the first Kwant Desk Journal release.

TradeZella uses:

- Trade/day replay and higher-resolution replay.
- Manual and automated backtesting.
- AI chat, reports, auto-tagging, session review, and sentiment agents.
- Mentor access and collaborative Spaces.
- Education/community.

Kwant Desk should not bolt these into Journal prematurely. Kwant Desk already has Charts, Gameplan, Gamma, GEXMAP, KwantBot, and ZYON. The future advantage is connecting those existing systems to Journal records rather than recreating a separate replay/AI universe inside the Journal page.

## What users love

Patterns found across official material, independent reviews, Trustpilot summaries, and trader discussions:

- Clean, approachable interface.
- Detailed analytics that reveal weaknesses.
- Calendar review.
- Broker synchronization and reduced manual work.
- Backtesting and replay in the same product.
- Tags/playbooks that turn setups into measurable groups.
- Responsive support, particularly when import formats change.
- A workflow that makes journaling feel less tedious.
- The ability to drill from aggregate metrics into the underlying trades.

## Recurring pain points

- No meaningful free tier and relatively high recurring price.
- AI usage is credit-limited.
- Some replay and automation capability is plan-gated.
- No dedicated mobile app in independent reviews.
- Broker sync and CSV formats can break when providers change columns.
- Some users report delayed imports, refresh-required glitches, or lag with large/high-frequency datasets.
- The product can feel like too much information at once.
- Automatic analysis is only as trustworthy as import accuracy and user tagging.
- Psychology and between-trade decision context remain weaker than statistical reporting.
- Users may be able to alter/delete records, which makes the journal unsuitable as proof of verified performance unless provenance is preserved separately.

## Kwant Desk differentiation

### The core edge: market-aware evidence

TradeZella largely begins after the trade. Kwant Desk already observes the live market. In later releases, a Journal trade can be enriched automatically with:

- Gameplan levels and active zones.
- Gamma regime and key gamma levels.
- GEX map state.
- Options-flow and volatility conditions.
- News events and scheduled risk.
- KwantBot messages before, during, and after the trade.
- ZYON conversation and screenshot analysis.
- The exact chart workspace and timeframe.

This makes the journal answer not only “What did I do?” but “What information existed when I did it?”

### Source truth

Kwant Desk should make source quality visible:

- Immutable import batch metadata.
- Original filename and hash.
- Accepted/rejected row counts.
- Duplicate detection.
- Source fields separated from user annotations.
- Data completeness and warning states.
- Exportable audit bundle.

### Less metric theatre

The first view should prioritize:

- Net result.
- Expectancy.
- Profit factor.
- Drawdown.
- Average R when supported.
- Review completion.
- Data integrity.
- Largest behavioural leakage with adequate sample size.

Hundreds of reports should be discoverable, not dumped into the default dashboard.

### Screenshots are data

Kwant Desk Journal should make screenshot evidence searchable and attachable. Future computer vision can extract:

- Instrument and timeframe.
- Marked levels and zones.
- Entry/exit annotations.
- Thesis text.
- Confirmation/invalidation language.

Human review remains authoritative.

### Review quality over score vanity

Do not make a proprietary “trader score” the centre of the product. A process score can measure:

- Percentage of trades reviewed.
- Percentage with verified source fields.
- Percentage with evidence.
- Rule adherence completeness.
- Risk-data completeness.

It should not imply future profitability.

## First release product specification

### Navigation

Add **Journal** to the primary Kwant Desk top navigation after ZYON.

### Journal subviews

1. **Pulse** — concise KPIs, equity curve, daily P&L, review queue, import health.
2. **Calendar** — monthly day-level P&L, trade count, review/evidence status.
3. **Trade Log** — searchable, sortable imported trade table and trade inspector.
4. **Edgebook** — performance by instrument, side, day, hour, and setup/tag.
5. **Evidence** — screenshot/file gallery with preview and download.
6. **Imports** — batch lineage, accepted/rejected counts, warnings, and source details.

### Supported first-release files

- CSV.
- TSV/TXT delimited trade files.
- JSON arrays or `{ trades: [] }`.
- PNG, JPG/JPEG, WEBP, and GIF screenshots.
- TXT/MD notes.

Excel support can be added when a reviewed workbook parser is introduced. The UI must not claim unsupported formats.

### Import behaviour

- Multi-file drag and drop.
- Flexible header aliases.
- Direct closed-trade rows.
- Execution-row aggregation for common buy/sell files.
- Futures contract multipliers for common CME roots when P&L is not supplied.
- Warnings for missing dates, symbols, prices, or unmatched executions.
- Duplicate fingerprinting.
- Import account/batch label.
- No placeholder or sample trades in production state.

### Persistence

First release: IndexedDB, namespaced by authenticated Supabase user ID.
Next release: Supabase journal tables and Storage bucket, with IndexedDB as offline cache.

### Planned integration seams

- `marketContextId`
- `gameplanEditionId`
- `kwantBotMessageIds`
- `zyonJournalEntryIds`
- `chartWorkspaceSnapshotId`
- `sourceImportId`

These fields should be anticipated in the data model even if not populated yet.

## Product naming

Use Kwant Desk language:

- Dashboard → **Pulse**
- Trade Log → **Trade Log**
- Strategies/Playbooks → **Setups** or **Edgebook**
- Attachments → **Evidence**
- Import history → **Imports**
- Score → **Review Integrity**
- Daily journal → **Session Review**
- Reports → **Analysis**

Avoid using TradeZella-specific names such as Zella Score, Zella AI, Playbooks, Spaces, or Start My Day.

## Source register

Official:

- https://help.tradezella.com/en/articles/8911582-our-pricing
- https://www.tradezella.com/pricing
- https://www.tradezella.com/trading-journal
- https://help.tradezella.com/en/articles/13863136-getting-started-with-tradezella
- https://help.tradezella.com/en/articles/7118437-understanding-dashboard-widgets-and-stats
- https://help.tradezella.com/en/articles/7143872-understanding-the-trade-log-page
- https://help.tradezella.com/en/articles/7189346-reports-calendar
- https://help.tradezella.com/en/articles/9689020-advanced-calendar-widget-in-tradezella-dashboard
- https://help.tradezella.com/en/articles/8239862-how-to-import-trades-from-unsupported-broker-into-tradezella-via-generic-csv-file-upload
- https://help.tradezella.com/en/articles/10055421-list-of-supported-brokers-and-platforms
- https://help.tradezella.com/en/articles/7190691-analyzing-tags
- https://help.tradezella.com/en/articles/6509413-reports-risk
- https://help.tradezella.com/en/articles/10352042-getting-started-with-the-progress-tracker
- https://help.tradezella.com/en/articles/11201153-what-is-zella-ai-tradezella-s-ai-trading-assistant

Independent/user-sentiment references:

- https://www.stockbrokers.com/review/tools/tradezella
- https://www.trustpilot.com/review/tradezella.com
- https://www.reddit.com/r/Trading/comments/1qbowam/any_trading_journal_that_works_well_with_tv/
- https://www.reddit.com/r/Daytrading/comments/1c8c50l/brokerage_for_easy_syncing_with_trading_journals/
- https://www.reddit.com/r/Daytrading/comments/1ub414m/what_journal_do_you_guys_actually_use/

Independent claims are directional user-research evidence, not ground truth. Product decisions should prioritize observed Kwant Desk user behaviour once the Journal is in use.
