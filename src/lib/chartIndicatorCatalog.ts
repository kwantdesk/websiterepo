export type ChartIndicatorCategory =
  | "Options Flow"
  | "Order Flow"
  | "Volume & Profiles"
  | "Market Structure"
  | "Trend"
  | "Momentum"
  | "Volatility"
  | "Overlays"
  | "KWANT Systems";

export type ChartIndicatorDefinition = {
  id: string;
  name: string;
  category: ChartIndicatorCategory;
  description: string;
  subcategory?: string;
  requiresOrderFlow?: boolean;
  source: "Reference" | "Kwantify";
};

export type ChartIndicatorInstance = {
  instanceId: string;
  indicatorId: string;
  enabled: boolean;
  settings?: Record<string, number | string | boolean>;
};

const indicator = (
  name: string,
  category: ChartIndicatorCategory,
  description: string,
  requiresOrderFlow = false,
  source: ChartIndicatorDefinition["source"] = "Reference",
  legacyNameForId?: string,
  subcategory?: string,
): ChartIndicatorDefinition => ({
  id: (legacyNameForId ?? name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  name,
  category,
  description,
  requiresOrderFlow,
  source,
  subcategory,
});

export const CHART_INDICATOR_CATEGORIES: ChartIndicatorCategory[] = [
  "Options Flow",
  "Order Flow",
  "Volume & Profiles",
  "Market Structure",
  "Trend",
  "Momentum",
  "Volatility",
  "Overlays",
  "KWANT Systems",
];

export const CHART_INDICATOR_CATALOG: ChartIndicatorDefinition[] = [
  indicator("Gamma Environment", "Options Flow", "Compact live gamma-regime status box with configurable chart-corner placement.", false, "Kwantify"),
  indicator("VIX Environment", "Volatility", "Compact VIX/VXN implied-volatility regime with daily move, session range and trailing 52-week rank and percentile.", false, "Kwantify"),
  indicator("Zero Gamma Line", "Options Flow", "True scenario-repriced dealer Gamma zero crossing with live updates and five completed trading sessions of no-lookahead history.", false, "Kwantify"),
  indicator("Options Delta", "Options Flow", "Net dealer Delta exposure of the chart's own options family through the session, drawn as signed bars beneath price like CVD.", false, "Kwantify"),
  indicator("Zero Gamma Bars", "Options Flow", "Net dealer Gamma of the chart's own options family through the session as signed bars: above zero is the positive-Gamma environment, below is negative, and the bar height shows how close the regime sits to flipping.", false, "Kwantify"),
  indicator("Gamma Heatmap", "Options Flow", "Historical and live gamma, delta, vanna and charm exposure ribbons mapped onto the futures price chart.", false, "Kwantify"),
  indicator("Net Gamma Exposure By Strike", "Options Flow", "Current signed Net GEX by source strike, mapped precisely onto the futures price scale around a zero spine.", false, "Kwantify"),
  indicator("GEX Interval Map", "Options Flow", "Live and historical signed Gamma exposure by strike and time, mapped onto the active chart without lookahead.", false, "Kwantify"),
  indicator("Bounce Levels", "Options Flow", "Ranked dealer Gamma, Delta, Vanna or Charm energy levels with KING, floor, ceiling, gatekeeper, cluster and air-pocket context.", false, "Kwantify"),
  indicator("Dark Pool Map", "Options Flow", "Real off-exchange equity prints aggregated into timestamped circles, mapped futures levels and institutional-style zones.", false, "Kwantify"),
  indicator("Dark Pool (GEX)", "Options Flow", "Direction-neutral off-exchange block prints anchored at exact event time and price, with separate dealer-Gamma confluence.", false, "Kwantify"),
  indicator("Implied Volatility Rank", "Options Flow", "QuantData IV Rank and true IV Percentile across configurable lookback, maturity and call/put modes.", false, "Kwantify"),
  indicator("Cumulative Volume Delta", "Order Flow", "Running aggressive buy volume minus aggressive sell volume.", true),
  indicator("CVD Divergence", "Order Flow", "Flags live price/CVD divergence on the recent candles: a wick-to-wick line on price and the matching line on the CVD pane, disappearing when CVD catches back up.", true, "Kwantify"),
  indicator("Pulling & Stacking", "Order Flow", "Displayed Bid and Ask liquidity being added, pulled, moved and reposted through time using Level 3 order-book events.", true, "Kwantify"),
  indicator("Delta Bar", "Order Flow", "Per-bar bid/ask aggression and delta.", true),
  indicator("Delta % Highlight", "Order Flow", "Highlights bars whose delta percentage exceeds configured thresholds.", true),
  indicator("Delta Cumulative Candlestick", "Order Flow", "Candlestick representation of cumulative delta.", true),
  indicator("Delta Cumulative Histogram", "Order Flow", "Histogram representation of cumulative buying and selling pressure.", true),
  indicator("Imbalance Tracker", "Order Flow", "Tracks stacked and diagonal bid/ask imbalances.", true),
  indicator("Imbalance Rejector", "Order Flow", "Marks imbalance patterns that reject and reverse.", true),
  indicator("Unfinished Auction", "Order Flow", "Flags auction extremes with incomplete bid/ask participation.", true),
  indicator("Bar POC Indicator", "Order Flow", "Plots each bar's highest-volume price.", true),
  indicator("Dynamic POC", "Order Flow", "Tracks the developing point of control.", true),
  indicator("Speed of Tape", "Order Flow", "Measures changes in transaction pace.", true),
  indicator("Speed of Tape (Instant)", "Order Flow", "Low-latency transaction-speed signal.", true),
  indicator("Volume/Delta Sprint", "Order Flow", "Detects rapid bursts in volume and delta.", true),
  indicator("Tape Speed & Order-Flow Burst", "Order Flow", "Live transaction velocity, directional burst, churn, response and contextual order-flow classification from the shared Rithmic execution tape.", true, "Kwantify", undefined, "Tape"),
  indicator("Big Contracts", "Order Flow", "Instant Big contracts markers and Deep contracts price boxes from exact aggressive executions.", true, "Reference", "Big Trades + Deep Trades"),
  indicator("Ratio Highlight", "Order Flow", "Highlights bid/ask ratios at price.", true),
  indicator("Stop Spotter", "Order Flow", "Locates potential stop-driven execution clusters.", true),
  indicator("Auction Gap Tracker", "Order Flow", "Tracks auction gaps and subsequent interaction.", true),
  indicator("Session Imbalance", "Order Flow", "Aggregates imbalance behaviour across a session.", true),
  indicator("Absorption Detector", "Order Flow", "Professional price-time absorption cells, confirmed zones, replenishment context, retests and breaks from the shared execution and Level 3 feed.", true, "Kwantify"),
  indicator("Stacked Imbalance Suite", "Order Flow", "Diagonal, horizontal and stacked aggressive-volume imbalances with scored zones, retests and breaks from the shared Footprint stream.", true, "Kwantify", undefined, "Imbalances"),
  indicator("Iceberg / Refresh Detector", "Order Flow", "Repeated passive-liquidity replenishment inferred from aggressive executions and the shared Level 3 order-book lifecycle.", true, "Kwantify", undefined, "Liquidity"),
  indicator("Liquidity Sweep / Stop Sweep Detector", "Order Flow", "Direct multi-level aggressive execution sweeps with inferred reference-level stop sweeps, continuation and rejection.", true, "Kwantify", undefined, "Signals"),
  indicator("POC & Auction Suite", "Order Flow", "Professional bar, session, rolling and anchored POC analysis with naked-level lifecycle, finished and unfinished auctions, excess and migration.", true, "Kwantify", undefined, "Auction"),
  indicator("Cumulative Iceberg/Stop", "Order Flow", "Signed cumulative or rolling Rithmic iceberg-replenishment and inferred stop-sweep activity.", true),
  indicator("Book Speed", "Order Flow", "Execution-confirmed Bid and Ask book levels consumed in time or tick-reversal windows.", true),
  indicator("DOM Pro", "Order Flow", "High-DPI Rithmic MBO ladder with resting depth, aggressor trades, order counts, queue-aware capability states and configurable professional columns.", true, "Kwantify", "Depth of Market"),
  indicator("Mini DOM", "Order Flow", "The resting book drawn on the chart itself, pinned beside the price scale with every row at its own price so depth lines up with the candles.", true, "Kwantify"),
  indicator("Footprint", "Order Flow", "Native bid × ask, volume and delta footprint bars at every traded price.", true, "Kwantify", "Deep Print (Footprint)"),
  indicator("KWANT Delta", "Order Flow", "Enhanced delta-bar and aggression analysis.", true, "Reference", "Deep Delta"),
  indicator("KWANT Wall", "Order Flow", "Tracks significant resting-liquidity walls.", true, "Reference", "Deep Wall"),
  indicator("KWANT V-Tracker", "Order Flow", "Tracks volume behaviour and participation shifts.", true, "Reference", "Deep V-Tracker"),

  indicator("Volume", "Volume & Profiles", "Total volume with filtering and delta-aware colouring."),
  indicator("Volume Swing", "Volume & Profiles", "Volume measured across detected price swings.", true),
  indicator("Daily Volume Profile", "Volume & Profiles", "Configurable daily volume, bid/ask and delta profile.", true, "Reference", "KWANT Profile"),
  // The display name is "TPO Daily", but the stable id must stay "tpo-chart":
  // every registry, settings block and engine check keys off it, and saved
  // workspaces store it. Renaming without this argument silently produced the
  // id "tpo-daily", which matched nothing — the indicator showed as "In
  // development" and could not be added.
  indicator("TPO Daily", "Volume & Profiles", "Daily time-price-opportunity profiles with square blocks, POC, value area, initial balance and auction analytics.", true, "Kwantify", "TPO Chart"),
  // Display name only — the id must stay "weekly-tpo" (see the note above).
  indicator("TPO Weekly", "Volume & Profiles", "Weekly time-price-opportunity profiles using the shared auction-market profile engine.", true, "Kwantify", "Weekly TPO"),
  indicator("Weekly Volume Profile", "Volume & Profiles", "Separate volume profile for each trading week.", true, "Kwantify"),
  indicator("Monthly Volume Profile", "Volume & Profiles", "Separate volume profile for each calendar month.", true, "Kwantify"),
  indicator("Session Volume Profile", "Volume & Profiles", "Profile for a configurable RTH, ETH or custom session.", true, "Kwantify"),
  indicator("Composite Volume Profile", "Volume & Profiles", "One profile across the complete loaded range.", true, "Kwantify"),
  indicator("Visible Range Volume Profile", "Volume & Profiles", "Profile recalculated from the visible chart range.", true, "Kwantify"),
  indicator("Custom Draw-On Volume Profile", "Volume & Profiles", "Draw a start and end range directly on the chart.", true, "Kwantify"),
  indicator("Ask/Bid Volume Profile", "Volume & Profiles", "Back-to-back ask and bid volume at each price.", true, "Kwantify"),
  indicator("Delta Profile", "Volume & Profiles", "Net aggressive volume distributed by price.", true, "Kwantify"),
  indicator("KWANT Profile Swing", "Volume & Profiles", "Automatically anchors profiles to price swings.", true, "Reference", "Deep Profile Swing"),
  indicator("KWANT Profile Values", "Volume & Profiles", "POC, value area, VWAP, peaks and valleys without profile bars.", true, "Reference", "Deep Profile Values"),
  indicator("Market Profile (TPO)", "Volume & Profiles", "Time-price-opportunity profile and value area.", false),
  indicator("TPO Levels", "Volume & Profiles", "Automated TPO rejection zones - tails, single prints, ledges, failed auctions, profile edges and low-time seams from completed RTH sessions.", false, "Kwantify"),
  indicator("VWAP", "Volume & Profiles", "Session volume-weighted average price.", false, "Kwantify"),
  indicator("VWAP Envelopes", "Volume & Profiles", "VWAP with configurable standard-deviation envelopes."),
  indicator("Anchored VWAP", "Volume & Profiles", "VWAP anchored to a selected chart point.", true, "Kwantify"),
  indicator("Rolling VWAP", "Volume & Profiles", "Continuous rolling-period VWAP.", false, "Kwantify"),
  indicator("Market Statistics", "Volume & Profiles", "Compact market and participation statistics.", true),
  indicator("On Candle Stats", "Volume & Profiles", "Displays selected statistics directly on candles.", true),

  indicator("Important Levels", "Market Structure", "Session open, high, low and other key references."),
  indicator("Absolute Levels", "Market Structure", "Fixed user-defined price levels."),
  indicator("Pivot Points", "Market Structure", "Traditional pivot support and resistance levels."),
  indicator("Price Movement Levels", "Market Structure", "Levels calculated from measured price movement."),
  indicator("FVG Identifier", "Market Structure", "Detects and tracks fair value gaps."),
  indicator("Gap Detector", "Market Structure", "Highlights gaps between chart bars."),
  indicator("Divergence Detector", "Market Structure", "Confirmed ES-NQ SMT divergence across synchronized swing highs and lows."),
  indicator("Confluence Identifier", "Market Structure", "Combines profile, swing and retracement structure.", true),
  indicator("Swing Point", "Market Structure", "Identifies confirmed swing highs and lows."),
  indicator("Average Daily Range Target", "Market Structure", "Projects daily range targets."),
  indicator("Sessions", "Market Structure", "DST-aware Tokyo, London, New York and Sydney session boxes, levels and labels.", false, "Kwantify"),
  indicator("Session Highs & Lows", "Market Structure", "Extends the latest completed Globex, Asia, London and New York highs and lows to the live edge.", false, "Kwantify"),
  indicator("IB Levels", "Market Structure", "Developing initial-balance high and low for each enabled session, frozen after 15, 30, 45 or 60 minutes.", false, "Kwantify"),
  indicator("Kwant Levels", "Market Structure", "Session-anchored KwantData gamma walls with selectable QQQ/NDX-to-NQ/MNQ and SPY/SPX/SPXW-to-ES/MES conversion.", false, "Kwantify", "Gamma Levels"),
  indicator("Classic GEX Profile", "Market Structure", "Live call and put gamma exposure ladder anchored to the NQ/MNQ chart price scale.", false, "Kwantify"),
  indicator("Session Marker", "Market Structure", "Marks configurable market sessions."),
  indicator("Shift Candle", "Market Structure", "Offsets candle reference and comparison logic."),

  indicator("Moving Average", "Trend", "Configurable moving-average overlay."),
  indicator("Ichimoku Indicator", "Trend", "Ichimoku cloud, conversion and base lines."),
  indicator("Parabolic SAR", "Trend", "Trend-following stop and reversal points."),
  indicator("Linear Regression", "Trend", "Linear-regression trend estimate."),
  indicator("Regression Channel", "Trend", "Regression line with deviation channel."),
  indicator("Super Trend", "Trend", "ATR-based directional trend overlay."),
  indicator("Super Trend Difference", "Trend", "Difference between price and Super Trend."),
  indicator("Keltner Channel", "Trend", "EMA channel expanded by average true range."),
  indicator("Bollinger Bands", "Trend", "Moving average with standard-deviation bands."),
  indicator("Donchian Channel", "Trend", "Rolling highest-high and lowest-low channel."),
  indicator("Tillson T3", "Trend", "Smooth low-lag T3 moving average."),
  indicator("Zig Zag", "Trend", "Filters minor movement to expose structural swings."),

  indicator("Relative Strength Index (RSI)", "Momentum", "Relative-strength momentum oscillator."),
  indicator("Rate of Change (ROC)", "Momentum", "Percentage price rate of change."),
  indicator("MACD Indicator", "Momentum", "Moving-average convergence/divergence oscillator."),
  indicator("Momentum Indicator", "Momentum", "Direct price momentum measurement."),
  indicator("Commodity Channel Index (CCI)", "Momentum", "Deviation from statistical mean price."),
  indicator("Know Sure Thing (KST)", "Momentum", "Multi-horizon smoothed rate-of-change oscillator."),
  indicator("Inverse Cyber Cycle", "Momentum", "Cycle-based oscillator for turning points."),
  indicator("Aroon Up/Down", "Momentum", "Time since recent highs and lows."),
  indicator("Aroon Oscillator", "Momentum", "Difference between Aroon Up and Down."),
  indicator("Awesome Oscillator", "Momentum", "Median-price momentum across two windows."),
  indicator("Stochastic Oscillator", "Momentum", "Close position within the recent range."),
  indicator("Williams %R", "Momentum", "Range-position momentum oscillator."),
  indicator("Chaikin Accumulation/Distribution", "Momentum", "Price and volume accumulation/distribution line."),
  indicator("Average Directional Index (ADX)", "Momentum", "Trend-strength oscillator."),

  indicator("Standard Deviation", "Volatility", "Rolling price dispersion."),
  indicator("Average True Range (ATR)", "Volatility", "Average true trading range."),
  indicator("Expected Move", "Volatility", "The options market's priced one-sigma travel for the session - a top and bottom rail from ATM implied volatility, anchored at the session open.", false, "Kwantify"),

  indicator("Candlestick Bar", "Overlays", "Alternative candlestick rendering layer."),
  indicator("Overlay Chart", "Overlays", "Overlays a secondary chart series."),
  indicator("Overlay Symbol", "Overlays", "Compares another instrument on the same chart."),
  indicator("Overlay Timeframe Candlestick", "Overlays", "Higher-timeframe candles on the active chart."),
  indicator("Overlay Timeframe Highlight", "Overlays", "Highlights higher-timeframe candle boundaries."),
  indicator("Annotations Overlay", "Overlays", "Displays structured annotations over price."),
  indicator("Text on Chart", "Overlays", "Data-driven text labels on the chart."),
  indicator("Source Code Indicator", "Overlays", "A sandboxed Pine Script v5/v6 compatibility indicator authored or imported in Kwant Desk.", false, "Kwantify"),

  indicator("KWANT Stats", "KWANT Systems", "Per-bar bid/ask volume, delta, trade pace, exhaustion and effort statistics.", true, "Kwantify"),
  indicator("Hedge Levels", "KWANT Systems", "The five dealer-hedging levels - cage ceiling and floor, magnet, accelerator and the flip - as simple full-width bands with plain-language labels.", false, "Kwantify"),
  indicator("KWANT-M IVB", "KWANT Systems", "Opening-range and initial-value breakout structure.", true, "Reference", "Deep-M IVB"),
  indicator("KWANT Pattern Builder", "KWANT Systems", "Composable market-pattern rules.", true, "Reference", "Deep Pattern Builder"),
  indicator("Big Blocks", "KWANT Systems", "Instrument-adaptive futures effort blocks anchored behind price.", true, "Reference", "Deep M Effort NQ"),
];

export const CHART_INDICATOR_BY_ID = new Map(
  CHART_INDICATOR_CATALOG.map((definition) => [definition.id, definition]),
);
