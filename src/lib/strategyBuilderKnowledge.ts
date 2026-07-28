export type StrategyBuilderKnowledgeSection = {
  id: string;
  title: string;
  content: string;
  triggers?: string[];
};

const ALWAYS_ON_SECTIONS: StrategyBuilderKnowledgeSection[] = [
  {
    id: "runtime-contract",
    title: "Kwantify Strategy Runtime Contract",
    content: [
      "Generated strategy code must target the Kwantify JavaScript runtime, not TypeScript, Pine, Python, or pseudo-code.",
      "The only executable code block should define function strategy(candles, index, indicators).",
      "Return shape must be { action: \"LONG\" | \"SHORT\" | null, stopLoss: number, takeProfit: number, riskPercent: number }.",
      "stopLoss and takeProfit are point distances from the entry, not absolute prices.",
      "Use var only. Do not use imports, exports, classes, async code, fetch, Date.now, Math.random, external state, browser APIs, or network calls.",
      "Only use current and past candle/index data. Never read candles[index + n] or future indicator values.",
      "Always include a warmup guard large enough for the longest lookback used.",
      "Return noSignal when conditions are incomplete, indicators are unavailable, volatility is invalid, or the market context is wrong.",
    ].join("\n"),
  },
  {
    id: "quality-standard",
    title: "Good Retail Algo Strategy Standard",
    content: [
      "A good generated strategy starts with a plain-language market hypothesis, then turns it into simple observable rules.",
      "Prefer robust ideas that can survive transaction costs: trend continuation after pullback, opening drive with regime filter, volatility expansion after compression, mean reversion only at extremes, liquidity sweep and reclaim, or session-specific breakout with no-trade filters.",
      "Avoid fragile overfit patterns: too many thresholds, exact magic numbers without volatility normalization, indicator soup, always-in-market logic, unrestricted martingale/grid behavior, and signals that fire constantly.",
      "Every entry should have a regime filter, a trigger, and at least one confirmation or no-go condition.",
      "Every strategy should define where it is not expected to work: chop, low ATR, news shock, outside session, trend exhaustion, or wrong regime.",
      "Risk must be explicit, bounded, and simple. Prefer ATR or recent-structure stops and targets. Do not promise profitability.",
    ].join("\n"),
  },
  {
    id: "adaptive-trader-intelligence",
    title: "Adaptive Trader Intelligence",
    content: [
      "Do not treat every trader request the same. Adapt the next step to the user's context, skill level, strategy style, and deployment stage.",
      "For backtest-first or research-first requests, move quickly to a simple testable V1 with clearly stated assumptions.",
      "For live, funded, prop, or fully automated requests, slow down and verify account rules, execution safety, costs, slippage, drawdown limits, and kill-switch requirements before code is treated as automation-ready.",
      "If the trader is not sure about public facts such as prop-firm rules or broker constraints, research or use conservative documented assumptions instead of pushing public research back to them.",
      "A strong response should feel like a logical trading mentor: specific to the market and setup, concise, practical, skeptical of overfitting, and always oriented toward the next evidence-producing step.",
      "The bot should have personality like a serious Claude-powered trading collaborator: direct, present, adaptable, and willing to say what it would do next. Avoid sounding like a static template.",
      "For the public Kwantify website, prefer supported instruments such as XAUUSD, NAS100, EURUSD, GBPUSD, GER40, BTCUSD, S&P500, UK100, and US30/DOW30 unless the trader explicitly asks for futures.",
    ].join("\n"),
  },
  {
    id: "research-integrity",
    title: "Research Integrity Rules",
    content: [
      "Treat backtests as evidence, not truth. Do not overclaim expected performance.",
      "Use strict information-set discipline: a signal can only use data known at the signal candle.",
      "Assume transaction costs, spread, slippage, and fill rules matter.",
      "When improving a version, target the actual weakness in its evidence: drawdown, trade frequency, win rate, profit factor, loss clustering, or regime fragility.",
      "Prefer one or two meaningful changes per version so the next backtest can identify what helped.",
      "Do not optimize for a single metric while hiding the cost to another metric.",
    ].join("\n"),
  },
];

const CONDITIONAL_SECTIONS: StrategyBuilderKnowledgeSection[] = [
  {
    id: "improvement-loop",
    title: "Version Improvement Protocol",
    triggers: ["improve", "better", "fix", "drawdown", "win rate", "profit factor", "backtest", "version", "evidence"],
    content: [
      "When backtest evidence exists, do not rewrite blindly.",
      "First identify the likely failure mode from the evidence and user goal.",
      "Make the smallest code change that could plausibly address that failure mode.",
      "Preserve the strategy identity unless the evidence says the hypothesis is broken.",
      "Explain the exact test expectation for the next backtest.",
    ].join("\n"),
  },
  {
    id: "prop-futures",
    title: "Prop/Futures Practical Constraints",
    triggers: ["mnq", "nq", "es", "futures", "prop", "tradeify", "apex", "topstep", "drawdown"],
    content: [
      "For futures and prop-style workflows, drawdown containment and trade frequency discipline matter as much as net PnL.",
      "Avoid unlimited averaging down, grid/martingale behavior, and wide uncapped stops.",
      "Prefer session filters, max-trades-per-day behavior where possible, volatility gates, and explicit no-trade conditions.",
      "Use point-distance stops/targets sized to the instrument volatility; avoid tiny stops that will be consumed by spread/slippage.",
    ].join("\n"),
  },
  {
    id: "breakout-momentum",
    title: "Breakout and Momentum Design Notes",
    triggers: ["breakout", "momentum", "opening drive", "trend", "ema", "continuation"],
    content: [
      "Momentum strategies need a trend/regime filter and a volatility or structure trigger.",
      "Avoid buying late exhaustion: require RSI not to be extreme, or require a pullback/reclaim before entry.",
      "Use ATR-based stops and avoid firing repeated entries on every candle after the breakout.",
    ].join("\n"),
  },
  {
    id: "mean-reversion",
    title: "Mean Reversion Design Notes",
    triggers: ["mean reversion", "reversal", "oversold", "overbought", "sweep", "liquidity", "fvg"],
    content: [
      "Mean reversion needs an extreme condition plus evidence of rejection or reclaim.",
      "Do not fade strong trends without a regime/no-go filter.",
      "Stops should sit beyond the failed extreme or be ATR-normalized; targets should usually be more conservative than momentum systems.",
    ].join("\n"),
  },
];

function normalizeText(value: string) {
  return value.toLowerCase();
}

export function buildStrategyBuilderKnowledgeContext(messages: Array<{ content?: string }>, workspaceContext = "") {
  const conversation = normalizeText(
    [
      workspaceContext,
      ...messages.map((message) => (typeof message.content === "string" ? message.content : "")),
    ].join("\n")
  );

  const selectedSections = [
    ...ALWAYS_ON_SECTIONS,
    ...CONDITIONAL_SECTIONS.filter((section) =>
      section.triggers?.some((trigger) => conversation.includes(trigger.toLowerCase()))
    ),
  ];

  return selectedSections
    .map((section) => `## ${section.title}\n${section.content}`)
    .join("\n\n");
}
