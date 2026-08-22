# GEX BOX QuantData Reconstruction Audit

## Purpose and boundaries

This document is the implementation source of truth for rebuilding the GEX BOX workspace as a professional multi-tool options dashboard. QuantData was inspected through the owner's authenticated product session as a read-only product reference. KwantDesk does not copy QuantData source code, proprietary assets, browser storage, cookies, or credentials. The reconstruction uses KwantDesk components, theme tokens, calculations, API contracts, and VPS-routed market-data services.

The browser must never connect directly to QuantData. QuantData data continues through the existing vendor edge and authenticated Next.js API routes. GEX BOX panels share requests and immutable snapshots; panel configuration and layout remain local to the panel/workspace.

## Product model observed

QuantData is not a single chart with four modes. It is a page/workspace system made from configurable tools:

- Multiple named pages, with create, copy, rename, reorder, and delete flows.
- Grid and infinite-canvas page types.
- Tabs/panels with duplicate, rename, maximize, pop-out, and delete actions.
- A categorized Add Tool catalogue.
- Per-panel symbol, date, expiry, metric, aggregation, filter, display, and reset controls.
- Global and custom appearance themes with primary, secondary, tertiary, foreground, and background colors plus font scaling.
- Persistent page/workspace state.

The KwantDesk replacement therefore uses a panel registry and stable panel IDs rather than hard-coded Classic/State/Orderflow branches.

## Production tool catalogue

Only tools with an authoritative KwantDesk server route are exposed in the Add Tool catalogue. The browser never invents rows, substitutes another metric, or displays an adapter placeholder.

### Options

1. Consolidated Order Flow
2. Contract Side Statistics
3. Contract Statistics
4. Exposure by Expiration
5. Exposure by Strike
6. Gainers / Losers
7. Heat Map
8. IV Rank
9. Interval Map
10. Max Pain
11. Net Drift
12. Net Flow
13. OI by Strike
14. Term Structure
15. Unconsolidated Order Flow
16. Volatility Drift

### Equities

1. Dark Pool Levels
2. Equity Prints
3. Market Map
4. Stock Price / Time

### KwantDesk-native tools retained

- Classic GEX profile
- State profile
- Orderflow profile

These retain the existing native snapshot/replay engines and are registered in the same panel catalogue.

## Panel behavior and semantics

### Interval Map

A time-by-strike exposure surface overlaid with the underlying path. Each point represents exposure for a strike and time bucket. Hover reveals timestamp, underlying, call exposure, put exposure, and net exposure. The panel includes horizontal/vertical navigation, a bottom visible-range selector, zoom, reset, and historical date selection.

Controls:

- Underlying: SPX, SPXW, SPY, NDX, QQQ and supported mapped futures displays.
- Date/session.
- Expiration filters.
- Aggregation: 1m, 2m, 3m, 4m, 5m, 10m, 15m, 20m, 30m, 1h, 2h, 4h where entitled by the upstream adapter.
- Strike padding/count.
- Greek: Charm/CHEX, Delta/DEX, Gamma/GEX, Vanna/VEX.
- Bubble, fixed-dot, heat-cell, ribbon, and hybrid display modes in KwantDesk.
- Minimum magnitude, maximum points, call/put/net/gross content, raw/difference mode, and baseline.

KwantDesk route: `/api/gex-interval-map`. Source: QuantData through `services/rithmic_gateway` vendor edge. Existing normalized model: `GexIntervalProviderSurface` / `GexIntervalMapSnapshot`.

### Exposure by Strike

Positive and negative signed exposure is positioned around zero with a spot marker and strike axis. The complete filtered strike list is used for extrema; visible scrolling never changes the calculation. Supports current snapshot and historical timeline/scrubber behavior.

Controls:

- Source/display instrument.
- Gamma, Delta, Vanna, Charm representation where available.
- Per-1% move, per-$1 move, and raw representation.
- 0DTE, 0-1DTE, 0-7DTE, front expiry, all expiries, custom DTE, and selected expiries.
- Exact tick, auto-bin, and custom-bin aggregation.
- Net, net with call/put detail, split, absolute concentration, and net-change content.
- Left/right/floating placement, linear/sqrt/log scale, percentile/fixed/visible scaling, and solid/gradient/outline/heat/compact rendering.

KwantDesk route: `/api/net-gamma-exposure-by-strike`. Existing normalized model: `NetGammaProfileSnapshot`.

### Consolidated and unconsolidated order flow

Consolidated flow groups prints into readable transactions; unconsolidated flow retains exchange-level/millisecond rows. Both expose sentiment, put/call ratio, put/call volume and put/call premium summary measures.

Observed row fields:

- Time
- Contract
- Spot
- Quantity
- Option price
- Side classification: A, B, AA, M
- Bid / ask
- Premium
- Sentiment
- Exchange
- Trade type, including extended-hours, sold-last, cancel, and cancel-last states

Panel controls include symbol, dates, expiries, side/sentiment/type filters, minimum premium/quantity, columns, sorting, density, grouping, and reset.

KwantDesk route foundation: `/api/options-flow` and existing `getOptionsFlowPayload`. No browser vendor calls.

### Dark Pool Levels and Equity Prints

Dark Pool Levels ranks persistent price concentrations. Equity Prints ranks individual/aggregated prints. Observed fields include rank, price, notional value, trade count, volume, and percentage shares. Filters include source ticker, date range, minimum notional/shares, row count, side, delayed-print inclusion, price binning, clustering, persistence, and display columns.

KwantDesk route: `/api/dark-pool-map`. Existing endpoint performs bounded provider fetch, deduplication, mapping, aggregation, clustering, and stale-while-refresh caching without manufacturing records.

### IV Rank and volatility tools

IV Rank compares current implied volatility with the selected historical range and supports call, put, combined, average-call-put, and split modes. It distinguishes IV Rank from IV Percentile and reports unavailable ranges honestly. Controls include lookback days, target maturity, tie mode, contract mode, live intraday IV, and display style.

KwantDesk route: `/api/implied-volatility-rank`. Existing model: `IvRankSnapshot`.

Term Structure, Volatility Drift, and Net Drift are separate tools. They must remain separate panel types even when they share a snapshot broker.

### Referenced product semantics not exposed without a source

- Contract Price / Time: selected option contract price history.
- Contract Side Statistics: bid/ask/mid/aggressor statistics for a selected contract.
- Contract Statistics: contract volume, OI, premium, trades, price, and IV statistics.
- Exposure by Expiration: selected Greek grouped by expiry.
- Gainers / Losers: rankable bullish/bearish premium, ratio, volume, and trade-count table with sector/date filters.
- Heat Map: strike/expiry or symbol exposure matrix with metric/filter controls.
- Market Share and Market Share Table: venue or participant-share visual/table variants.
- Max Pain and Max Pain / Time: current and historical max-pain surfaces.
- Net Flow: net options flow through time.
- OI / Time, OI by Expiration, OI by Strike, OI Change: distinct open-interest timeline/distribution/change views.
- Dark Flow: dark versus lit equity activity through time.
- Exchange Notifications: exchange alert/notification table.
- Market Map: cross-symbol equity map.
- Stock Price / Time: underlying price series.
- News Feed: timestamped source/headline list with symbol/topic filters.

Contract Price / Time, Market Share, Market Share Table, Max Pain / Time, OI / Time, OI by Expiration, OI Change, Dark Flow, Exchange Notifications, and News Feed were observed in the reference product but are not exposed in KwantDesk until a licensed, normalized server source exists. Legacy workspaces containing one of these IDs retain their saved identity and show an honest unavailable state; new users cannot add a dead panel.

## Default page layout

The first-run workspace is a four-panel grid:

1. Interval Map — SPY, Gamma, previous completed New York RTH session outside RTH.
2. Exposure by Strike — SPX/SPY mapped context.
3. Consolidated Order Flow — SPX.
4. Dark Pool Levels — SPY.

Existing users migrate from the old GEX BOX local state into a `Classic GEX` page, preserving their ticker, dataset, and appearance preferences.

## Workspace persistence contract

Storage key: `kwantdesk:gex-box:dashboard:v2`.

A saved workspace contains:

- Schema version.
- Workspace ID/name.
- Active page ID.
- Pages with stable IDs, name, layout mode (`grid` or `infinite`), and panel list.
- Panels with stable ID, tool ID, title, bounds/grid span, symbol, and tool-specific settings.
- Global appearance overrides and font scale.

Rules:

- Duplicate copies settings into a new stable panel ID; subsequent edits diverge.
- A tool change replaces the old tool settings with that tool's defaults.
- Import validates schema and tool IDs before replacing state.
- Export downloads deterministic JSON.
- Reset restores the default workspace.
- Workspace state is page-local and never mirrors Charts or GEX VUE workspaces.
- Vendor payloads, replay tapes, and credentials are never exported.

## Rendering and performance rules

- Lightweight Charts is used for real time-series panels.
- Canvas is used for dense bubble/heat surfaces.
- DOM tables are virtualized or capped by explicit row settings.
- One shared request per unique route/query, with subscribers per panel.
- No per-tick React state for high-rate data.
- Paints are batched by `requestAnimationFrame` and bounded.
- Hidden tabs suspend painting and slow non-live refreshes.
- Previous completed RTH snapshots are cached and rendered immediately; live updates replace them during RTH without a black flash.
- Every panel has loading, stale, unavailable, and error states. No blank surfaces and no silent fallback to unrelated data.

## Visual language

The reconstruction follows KwantDesk's current design system:

- Square, compact panel chrome.
- Rajdhani/JetBrains Mono typography already used by the application.
- Theme-token foreground/background/border/primary/secondary colors.
- Dense but readable tables and charts.
- Settings open in movable, centered dialogs with no background blur.
- All color roles are customizable, and automatic mode follows the selected website theme.
- Panel controls remain visible during scroll.

The visual composition may resemble the professional information density of the reference product, but no proprietary logo, screenshot, icon asset, source code, or exact CSS is copied.

## Verification checklist

- First load outside RTH renders the latest completed RTH session.
- Monday/holiday session resolution chooses the last completed New York RTH session.
- Live RTH updates do not clear the prior good frame while refreshing.
- Duplicate panels share network requests but not settings state.
- Import/export round-trips stable IDs and settings.
- Grid and infinite pages save and restore independently.
- Symbol/date/expiry/metric/aggregation controls change the correct panel only.
- Every settings control changes rendering or request semantics.
- No direct QuantData/Databento/Rithmic/Massive browser connection.
- TypeScript, lint, focused tests, production build, and deployed smoke test pass.
