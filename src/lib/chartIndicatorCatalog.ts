export type ChartIndicatorCategory =
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
): ChartIndicatorDefinition => ({
  id: (legacyNameForId ?? name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  name,
  category,
  description,
  requiresOrderFlow,
  source,
});

export const CHART_INDICATOR_CATEGORIES: ChartIndicatorCategory[] = [
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
  indicator("Cumulative Volume Delta", "Order Flow", "Running aggressive buy volume minus aggressive sell volume.", true),
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
  indicator("Big Contracts", "Order Flow", "Anchors filtered and clustered aggressive executions to traded price.", true, "Reference", "Big Trades"),
  indicator("Ratio Highlight", "Order Flow", "Highlights bid/ask ratios at price.", true),
  indicator("Stop Spotter", "Order Flow", "Locates potential stop-driven execution clusters.", true),
  indicator("Auction Gap Tracker", "Order Flow", "Tracks auction gaps and subsequent interaction.", true),
  indicator("Session Imbalance", "Order Flow", "Aggregates imbalance behaviour across a session.", true),
  indicator("Absorption", "Order Flow", "Detects aggressive flow absorbed by resting liquidity.", true),
  indicator("Stop Run", "Order Flow", "Detects bursts consistent with stop liquidation.", true),
  indicator("Cumulative Iceberg/Stop", "Order Flow", "Accumulates inferred iceberg and stop activity.", true),
  indicator("Book Speed", "Order Flow", "Measures order-book update velocity.", true),
  indicator("Depth of Market", "Order Flow", "Resizable Rithmic full-depth ladder with resting liquidity, recent executions, cumulative depth, pulling/stacking and imbalance.", true, "Kwantify"),
  indicator("Footprint", "Order Flow", "Native bid × ask, volume and delta footprint bars at every traded price.", true, "Kwantify", "Deep Print (Footprint)"),
  indicator("KWANT Delta", "Order Flow", "Enhanced delta-bar and aggression analysis.", true, "Reference", "Deep Delta"),
  indicator("KWANT Wall", "Order Flow", "Tracks significant resting-liquidity walls.", true, "Reference", "Deep Wall"),
  indicator("KWANT V-Tracker", "Order Flow", "Tracks volume behaviour and participation shifts.", true, "Reference", "Deep V-Tracker"),
  indicator("Big Contracts", "Order Flow", "Execution-level trade visualisation and filtering.", true, "Reference", "Deep Trades"),

  indicator("Volume", "Volume & Profiles", "Total volume with filtering and delta-aware colouring."),
  indicator("Volume Swing", "Volume & Profiles", "Volume measured across detected price swings.", true),
  indicator("Daily Profile", "Volume & Profiles", "Configurable daily volume, bid/ask and delta profile.", true, "Reference", "KWANT Profile"),
  indicator("TPO Chart", "Volume & Profiles", "Daily time-price-opportunity profiles with square blocks, POC, value area, initial balance and auction analytics.", true, "Kwantify"),
  indicator("Weekly TPO", "Volume & Profiles", "Weekly time-price-opportunity profiles using the shared auction-market profile engine.", true, "Kwantify"),
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
  indicator("Session Highs & Lows", "Market Structure", "Extends the high and low of the three most recently completed enabled sessions to the live edge.", false, "Kwantify"),
  indicator("Kwant Levels", "Market Structure", "Session-anchored KwantData gamma walls with selectable QQQ/NDX-to-NQ/MNQ and SPY/SPX-to-ES/MES conversion.", false, "Kwantify", "Gamma Levels"),
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
