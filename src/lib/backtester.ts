export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  trades?: number;
  bidVolume?: number;
  askVolume?: number;
  bidTrades?: number;
  askTrades?: number;
  delta?: number;
  deltaOpen?: number;
  deltaHigh?: number;
  deltaLow?: number;
  deltaClose?: number;
}

export interface Trade {
  entryTime: number;
  exitTime: number;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnlPoints: number;
  pnlPercent: number;
  rMultiple: number;
  result: "WIN" | "LOSS" | "BREAKEVEN";
  runUp: number;
  drawdown: number;
  durationBars: number;
}

export interface BacktestDirectionStats {
  totalPnL: number;
  totalPnLPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgTrade: number;
  avgWinningTrade: number;
  avgLosingTrade: number;
  largestWinningTrade: number;
  largestLosingTrade: number;
  avgBarsInTrades: number;
  avgBarsInWinningTrades: number;
  avgBarsInLosingTrades: number;
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: { timestamp: number; equity: number }[];
  totalTrades: number;
  wins: number;
  losses: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnlPoints: number;
  totalPnL: number;
  totalPnLPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageRMultiple: number;
  sharpeRatio: number;
  sortinoRatio: number;
  grossProfit: number;
  grossLoss: number;
  avgWinningTrade: number;
  avgLosingTrade: number;
  largestWinningTrade: number;
  largestLosingTrade: number;
  avgBarsInTrades: number;
  avgBarsInWinningTrades: number;
  avgBarsInLosingTrades: number;
  longTrades: BacktestDirectionStats;
  shortTrades: BacktestDirectionStats;
  maxRunUp: number;
  recoveryFactor: number;
  annualizedReturn: number;
  maxMarginUsed: number;
  marginEfficiency: number;
  avgEquityRunUp: number;
  maxEquityRunUp: number;
  avgDrawdownDuration: number;
  maxDrawdownDuration: number;
  error: string | null;
}

export interface StrategySignal {
  action: "LONG" | "SHORT" | null;
  stopLoss: number;
  takeProfit: number;
  riskPercent?: number;
}

export interface BrokerConfig {
  spread: number;
  slippage: number;
  commission: number;
}

export interface BacktestConfig {
  initialBalance: number;
  broker: BrokerConfig;
  maxPositions: number;
  sessionFilter?: string[];
  baseCurrency?: string;
  orderSizeType?: string;
  orderSizeValue?: number;
  pyramiding?: number;
  commissionType?: string;
  commissionValue?: number;
  slippage?: number;
  marginLong?: number;
  marginShort?: number;
  fillOrders?: string;
  intrabarFillPolicy?: "tradingview" | "stop_first" | "target_first";
  dateFrom?: string;
  dateTo?: string;
  datePreset?: string;
}

type OpenTrade = {
  entryTime: number;
  entryIndex: number;
  entryPrice: number;
  direction: "LONG" | "SHORT";
  sl: number;
  tp: number;
  runUp: number;
  drawdown: number;
  positionSize: number;
  entryCommission: number;
};

type PendingOrder = {
  direction: "LONG" | "SHORT";
  sl: number;
  tp: number;
  signalCandle: number;
  riskPercent: number;
};

export function calculateEMA(candles: Candle[], period: number): number[] {
  const ema = Array(candles.length).fill(0);
  if (candles.length === 0) return ema;

  const multiplier = 2 / (period + 1);
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i < period - 1) continue;
    if (i === period - 1) {
      ema[i] = sum / period;
      continue;
    }
    ema[i] = (candles[i].close - ema[i - 1]) * multiplier + ema[i - 1];
  }

  return ema;
}

export function calculateSMA(candles: Candle[], period: number): number[] {
  const sma = Array(candles.length).fill(0);
  let rollingSum = 0;

  for (let i = 0; i < candles.length; i++) {
    rollingSum += candles[i].close;
    if (i >= period) rollingSum -= candles[i - period].close;
    if (i >= period - 1) sma[i] = rollingSum / period;
  }

  return sma;
}

export function calculateATR(candles: Candle[], period: number): number[] {
  const atr = Array(candles.length).fill(0);
  if (candles.length === 0) return atr;

  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const prevClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose)
    );
  });

  let sum = 0;
  for (let i = 0; i < trueRanges.length; i++) {
    sum += trueRanges[i];
    if (i < period - 1) continue;
    if (i === period - 1) {
      atr[i] = sum / period;
      continue;
    }
    atr[i] = (atr[i - 1] * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

export function calculateRSI(candles: Candle[], period: number): number[] {
  const rsi = Array(candles.length).fill(50);
  if (candles.length <= period) return rsi;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

export const calcEMA = calculateEMA;
export const calcSMA = calculateSMA;
export const calcATR = calculateATR;

export function detectFVG(candles: Candle[], index: number): { bullish: boolean; bearish: boolean; top: number; bottom: number } {
  if (index < 2) return { bullish: false, bearish: false, top: 0, bottom: 0 };
  const prev = candles[index - 2];
  const current = candles[index - 1];
  const next = candles[index];
  const bullishGap = next.low > prev.high;
  const bearishGap = next.high < prev.low;
  return {
    bullish: bullishGap && current.close > current.open,
    bearish: bearishGap && current.close < current.open,
    top: bullishGap ? next.low : bearishGap ? prev.low : 0,
    bottom: bullishGap ? prev.high : bearishGap ? next.high : 0,
  };
}

export function getSession(timestamp: number): string {
  const hour = new Date(timestamp).getUTCHours();
  if (hour >= 0 && hour < 8) return "ASIA";
  if (hour >= 8 && hour < 16) return "LONDON";
  if (hour >= 13 && hour < 22) return "NEW_YORK";
  return "OFF";
}

export function getEMASlope(ema: number[], index: number, lookback = 5): "BULLISH" | "BEARISH" | "FLAT" {
  if (index < lookback) return "FLAT";
  const diff = ema[index] - ema[index - lookback];
  const threshold = ema[index] * 0.0001;
  if (diff > threshold) return "BULLISH";
  if (diff < -threshold) return "BEARISH";
  return "FLAT";
}

function emptyResult(config: BacktestConfig, error: string | null = null): BacktestResult {
  const emptyStats = createDirectionStats([], config.initialBalance);
  return {
    trades: [],
    equityCurve: [],
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    profitFactor: 0,
    totalPnlPoints: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    averageRMultiple: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    grossProfit: 0,
    grossLoss: 0,
    avgWinningTrade: 0,
    avgLosingTrade: 0,
    largestWinningTrade: 0,
    largestLosingTrade: 0,
    avgBarsInTrades: 0,
    avgBarsInWinningTrades: 0,
    avgBarsInLosingTrades: 0,
    longTrades: emptyStats,
    shortTrades: emptyStats,
    maxRunUp: 0,
    recoveryFactor: 0,
    annualizedReturn: 0,
    maxMarginUsed: 0,
    marginEfficiency: 0,
    avgEquityRunUp: 0,
    maxEquityRunUp: 0,
    avgDrawdownDuration: 0,
    maxDrawdownDuration: 0,
    error,
  };
}

function calculateSharpeRatio(trades: Trade[]) {
  const returns = trades.map((trade) => trade.pnlPercent / 100);
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((sum, value) => sum + Math.pow(value - avgReturn, 2), 0) / returns.length);
  return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
}

function calculateSortinoRatio(trades: Trade[]) {
  const returns = trades.map((trade) => trade.pnlPercent / 100);
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const downside = returns.filter((value) => value < 0);
  if (downside.length === 0) return 0;

  const downsideDeviation = Math.sqrt(downside.reduce((sum, value) => sum + Math.pow(value, 2), 0) / returns.length);
  return downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : 0;
}

function createDirectionStats(trades: Trade[], initialBalance: number): BacktestDirectionStats {
  const wins = trades.filter((trade) => trade.result === "WIN");
  const losses = trades.filter((trade) => trade.result === "LOSS");
  const totalPnL = trades.reduce((sum, trade) => sum + trade.pnlPoints, 0);
  const grossProfit = wins.reduce((sum, trade) => sum + Math.max(trade.pnlPoints, 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + Math.min(trade.pnlPoints, 0), 0));
  return {
    totalPnL,
    totalPnLPercent: initialBalance ? (totalPnL / initialBalance) * 100 : 0,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    avgTrade: trades.length ? totalPnL / trades.length : 0,
    avgWinningTrade: wins.length ? grossProfit / wins.length : 0,
    avgLosingTrade: losses.length ? losses.reduce((sum, trade) => sum + trade.pnlPoints, 0) / losses.length : 0,
    largestWinningTrade: wins.length ? Math.max(...wins.map((trade) => trade.pnlPoints)) : 0,
    largestLosingTrade: losses.length ? Math.min(...losses.map((trade) => trade.pnlPoints)) : 0,
    avgBarsInTrades: trades.length ? trades.reduce((sum, trade) => sum + trade.durationBars, 0) / trades.length : 0,
    avgBarsInWinningTrades: wins.length ? wins.reduce((sum, trade) => sum + trade.durationBars, 0) / wins.length : 0,
    avgBarsInLosingTrades: losses.length ? losses.reduce((sum, trade) => sum + trade.durationBars, 0) / losses.length : 0,
  };
}

function calculateDrawdownDurations(equityCurve: { timestamp: number; equity: number }[]) {
  let peak = equityCurve[0]?.equity ?? 0;
  let currentDuration = 0;
  const durations: number[] = [];

  for (const point of equityCurve) {
    if (point.equity >= peak) {
      if (currentDuration > 0) durations.push(currentDuration);
      peak = point.equity;
      currentDuration = 0;
    } else {
      currentDuration += 1;
    }
  }

  if (currentDuration > 0) durations.push(currentDuration);
  return {
    avgDrawdownDuration: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0,
    maxDrawdownDuration: durations.length ? Math.max(...durations) : 0,
  };
}

function buildResult(
  candles: Candle[],
  trades: Trade[],
  equityCurve: { timestamp: number; equity: number }[],
  config: BacktestConfig,
  maxDrawdown: number,
  drawdownDurations?: { avgDrawdownDuration: number; maxDrawdownDuration: number },
  maxMarginUsedOverride?: number,
  error: string | null = null
): BacktestResult {
  const wins = trades.filter((trade) => trade.result === "WIN");
  const losses = trades.filter((trade) => trade.result === "LOSS");
  const totalPnL = trades.reduce((sum, trade) => sum + trade.pnlPoints, 0);
  const allStats = createDirectionStats(trades, config.initialBalance);
  const longStats = createDirectionStats(trades.filter((trade) => trade.direction === "LONG"), config.initialBalance);
  const shortStats = createDirectionStats(trades.filter((trade) => trade.direction === "SHORT"), config.initialBalance);
  const initialEquity = config.initialBalance;
  const maxRunUp = Math.max(0, ...equityCurve.map((point) => point.equity - initialEquity));
  const runUps = equityCurve.map((point) => Math.max(0, point.equity - initialEquity));
  const { avgDrawdownDuration, maxDrawdownDuration } = drawdownDurations ?? calculateDrawdownDurations(equityCurve);
  const start = candles[0]?.timestamp ?? Date.now();
  const end = candles[candles.length - 1]?.timestamp ?? start;
  const years = Math.max((end - start) / (365 * 24 * 60 * 60 * 1000), 1 / 365);
  const endingEquity = initialEquity + totalPnL;
  const annualizedReturn = initialEquity > 0 ? (Math.pow(Math.max(endingEquity, 0.01) / initialEquity, 1 / years) - 1) * 100 : 0;
  const maxMarginUsed = maxMarginUsedOverride ?? trades.reduce((max, trade) => Math.max(max, Math.abs(trade.entryPrice)), 0);

  return {
    trades,
    equityCurve,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: allStats.winRate,
    profitFactor: allStats.profitFactor,
    totalPnlPoints: totalPnL,
    totalPnL,
    totalPnLPercent: initialEquity ? (totalPnL / initialEquity) * 100 : 0,
    maxDrawdown,
    maxDrawdownPercent: initialEquity ? (maxDrawdown / initialEquity) * 100 : 0,
    averageRMultiple: trades.length > 0 ? trades.reduce((sum, trade) => sum + trade.rMultiple, 0) / trades.length : 0,
    sharpeRatio: calculateSharpeRatio(trades),
    sortinoRatio: calculateSortinoRatio(trades),
    grossProfit: allStats.grossProfit,
    grossLoss: allStats.grossLoss,
    avgWinningTrade: allStats.avgWinningTrade,
    avgLosingTrade: allStats.avgLosingTrade,
    largestWinningTrade: allStats.largestWinningTrade,
    largestLosingTrade: allStats.largestLosingTrade,
    avgBarsInTrades: allStats.avgBarsInTrades,
    avgBarsInWinningTrades: allStats.avgBarsInWinningTrades,
    avgBarsInLosingTrades: allStats.avgBarsInLosingTrades,
    longTrades: longStats,
    shortTrades: shortStats,
    maxRunUp,
    recoveryFactor: maxDrawdown > 0 ? totalPnL / maxDrawdown : totalPnL > 0 ? 999 : 0,
    annualizedReturn,
    maxMarginUsed,
    marginEfficiency: maxMarginUsed > 0 ? totalPnL / maxMarginUsed : 0,
    avgEquityRunUp: runUps.length ? runUps.reduce((sum, value) => sum + value, 0) / runUps.length : 0,
    maxEquityRunUp: maxRunUp,
    avgDrawdownDuration,
    maxDrawdownDuration,
    error,
  };
}

function calculateCommission(price: number, config: BacktestConfig): number {
  const type = config.commissionType || "percent";
  const value = config.commissionValue ?? config.broker?.commission ?? 0;

  if (type === "percent") return price * (value / 100);
  if (type === "per_contract" || type === "fixed_contract") return value;
  if (type === "per_order" || type === "fixed_order") return value;
  return 0;
}

function calculatePositionSize(balance: number, price: number, slDistance: number, riskPercent: number, config: BacktestConfig): number {
  const type = config.orderSizeType || "percent_equity";
  const value = config.orderSizeValue ?? 10;

  if (type === "fixed_qty" || type === "fixed_quantity") return value;
  if (type === "fixed_usd") return price > 0 ? value / price : 0;

  const riskAmount = balance * ((riskPercent || 1) / 100);
  if (type === "percent_equity" && slDistance > 0 && price > 0) {
    const positionValue = riskAmount / (slDistance / price);
    return positionValue / price;
  }

  return price > 0 ? riskAmount / price : 0;
}

function createIndicators(candles: Candle[]) {
  return {
    ema20: calculateEMA(candles, 20),
    ema50: calculateEMA(candles, 50),
    ema200: calculateEMA(candles, 200),
    sma20: calculateSMA(candles, 20),
    sma50: calculateSMA(candles, 50),
    atr14: calculateATR(candles, 14),
    rsi14: calculateRSI(candles, 14),
  };
}

function inferIntrabarPath(candle: Candle): ("open" | "high" | "low" | "close")[] {
  const openToHigh = Math.abs(candle.high - candle.open);
  const openToLow = Math.abs(candle.open - candle.low);
  return openToHigh < openToLow ? ["open", "high", "low", "close"] : ["open", "low", "high", "close"];
}

function resolveSameBarExit(
  candle: Candle,
  trade: OpenTrade,
  policy: BacktestConfig["intrabarFillPolicy"]
): { exitLevel: number; exitReason: "TP" | "SL" } {
  if (policy === "target_first") return { exitLevel: trade.tp, exitReason: "TP" };
  if (policy === "stop_first") return { exitLevel: trade.sl, exitReason: "SL" };

  for (const point of inferIntrabarPath(candle)) {
    if (point === "high") {
      if (trade.direction === "LONG" && candle.high >= trade.tp) return { exitLevel: trade.tp, exitReason: "TP" };
      if (trade.direction === "SHORT" && candle.high >= trade.sl) return { exitLevel: trade.sl, exitReason: "SL" };
    }
    if (point === "low") {
      if (trade.direction === "LONG" && candle.low <= trade.sl) return { exitLevel: trade.sl, exitReason: "SL" };
      if (trade.direction === "SHORT" && candle.low <= trade.tp) return { exitLevel: trade.tp, exitReason: "TP" };
    }
  }

  return { exitLevel: trade.sl, exitReason: "SL" };
}

function extractStrategyFunctionSource(source: string): { code: string | null; error: string | null } {
  const strategyIndex = source.indexOf("function strategy");
  if (strategyIndex === -1) {
    return { code: null, error: "Code must contain: function strategy(candles, index, indicators) { ... }" };
  }

  const openBraceIndex = source.indexOf("{", strategyIndex);
  if (openBraceIndex === -1) {
    return { code: null, error: "Strategy function is missing an opening brace." };
  }

  let depth = 0;
  let quote: "'" | "\"" | "`" | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openBraceIndex; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) {
        return { code: source.slice(strategyIndex, i + 1).trim(), error: null };
      }
    }
  }

  return { code: null, error: "Strategy function is missing a closing brace." };
}

function splitParameters(parameters: string): string[] {
  const parts: string[] = [];
  let current = "";
  let genericDepth = 0;
  let bracketDepth = 0;

  for (const char of parameters) {
    if (char === "<") genericDepth++;
    if (char === ">") genericDepth = Math.max(0, genericDepth - 1);
    if (char === "[" || char === "(") bracketDepth++;
    if (char === "]" || char === ")") bracketDepth = Math.max(0, bracketDepth - 1);

    if (char === "," && genericDepth === 0 && bracketDepth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function stripTypeScriptAnnotations(code: string): string {
  const withUntypedParams = code.replace(/function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g, (_match, name: string, params: string) => {
    const cleanedParams = splitParameters(params)
      .map((param) => param.replace(/:\s*[^=]+(?=$|=)/, "").trim())
      .join(", ");
    return "function " + name + "(" + cleanedParams + ")";
  });

  return withUntypedParams.replace(/\b(var|let|const)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=;]+(?==|;)/g, "$1 $2");
}

function executeBacktest(
  candles: Candle[],
  strategyFn: (candles: Candle[], index: number, indicators: Record<string, number[]>) => StrategySignal | null,
  config: BacktestConfig
): BacktestResult {
  if (!candles || candles.length < 52) {
    return emptyResult(config, "Not enough candles for backtest (need at least 52)");
  }

  const indicators = createIndicators(candles);
  const trades: Trade[] = [];
  const equityCurve: { timestamp: number; equity: number }[] = [];
  const openTrades: OpenTrade[] = [];
  let pendingOrder: PendingOrder | null = null;
  let balance = config.initialBalance;
  let peakEquity = config.initialBalance;
  let maxDrawdown = 0;
  let currentDrawdownDuration = 0;
  let maxDrawdownDuration = 0;
  let drawdownPeriods = 0;
  let drawdownDurationTotal = 0;
  let maxMarginUsed = 0;

  const spread = config.broker?.spread ?? 0;
  const slippage = config.slippage ?? config.broker?.slippage ?? 0;
  const maxOpenTrades = config.pyramiding && config.pyramiding > 0 ? config.pyramiding : 1;
  const warmupBars = 50;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    if (pendingOrder && openTrades.length < maxOpenTrades) {
      const sameDirectionOpen = openTrades.length === 0 || openTrades.every((trade) => trade.direction === pendingOrder?.direction);
      if (sameDirectionOpen) {
        const fillPrice = pendingOrder.direction === "LONG"
          ? candle.open + slippage + spread / 2
          : candle.open - slippage - spread / 2;
        const sl = pendingOrder.direction === "LONG" ? fillPrice - pendingOrder.sl : fillPrice + pendingOrder.sl;
        const tp = pendingOrder.direction === "LONG" ? fillPrice + pendingOrder.tp : fillPrice - pendingOrder.tp;
        const slDistance = Math.abs(fillPrice - sl);
        const positionSize = calculatePositionSize(balance, fillPrice, slDistance, pendingOrder.riskPercent, config);
        const entryCommission = calculateCommission(fillPrice, config);

        balance -= entryCommission;
        maxMarginUsed = Math.max(maxMarginUsed, Math.abs(fillPrice * positionSize));
        openTrades.push({
          entryTime: candle.timestamp,
          entryIndex: i,
          entryPrice: fillPrice,
          direction: pendingOrder.direction,
          sl,
          tp,
          runUp: 0,
          drawdown: 0,
          positionSize,
          entryCommission,
        });
      }
      pendingOrder = null;
    }

    for (const trade of openTrades) {
      if (trade.direction === "LONG") {
        trade.runUp = Math.max(trade.runUp, candle.high - trade.entryPrice);
        trade.drawdown = Math.max(trade.drawdown, trade.entryPrice - candle.low);
      } else {
        trade.runUp = Math.max(trade.runUp, trade.entryPrice - candle.low);
        trade.drawdown = Math.max(trade.drawdown, candle.high - trade.entryPrice);
      }
    }

    for (let tradeIndex = openTrades.length - 1; tradeIndex >= 0; tradeIndex--) {
      const trade = openTrades[tradeIndex];
      let exitLevel = 0;
      let exitReason: "TP" | "SL" | "SL (gap)" | null = null;

      if (trade.direction === "LONG" && candle.open < trade.sl) {
        exitLevel = candle.open;
        exitReason = "SL (gap)";
      } else if (trade.direction === "SHORT" && candle.open > trade.sl) {
        exitLevel = candle.open;
        exitReason = "SL (gap)";
      } else {
        const slHit = trade.direction === "LONG" ? candle.low <= trade.sl : candle.high >= trade.sl;
        const tpHit = trade.direction === "LONG" ? candle.high >= trade.tp : candle.low <= trade.tp;

        if (slHit && tpHit) {
          const resolved = resolveSameBarExit(candle, trade, config.intrabarFillPolicy ?? "tradingview");
          exitLevel = resolved.exitLevel;
          exitReason = resolved.exitReason;
        } else if (slHit) {
          exitLevel = trade.sl;
          exitReason = "SL";
        } else if (tpHit) {
          exitLevel = trade.tp;
          exitReason = "TP";
        }
      }

      if (exitReason) {
        const exitPrice = trade.direction === "LONG"
          ? exitLevel - spread / 2 - slippage
          : exitLevel + spread / 2 + slippage;
        const exitCommission = calculateCommission(exitPrice, config);
        const pnlPoints = trade.direction === "LONG"
          ? exitPrice - trade.entryPrice
          : trade.entryPrice - exitPrice;
        const pnlDollars = pnlPoints * trade.positionSize;
        const balanceChange = pnlDollars - exitCommission;
        const totalTradePnl = pnlDollars - trade.entryCommission - exitCommission;
        const slDistance = Math.abs(trade.entryPrice - trade.sl);
        const positionValue = trade.entryPrice * trade.positionSize;

        if (trades.length === 0) {
          console.log("First trade:", { entryPrice: trade.entryPrice, exitPrice, pnlPoints, pnlDollars, balance, positionValue });
        }

        balance += balanceChange;
        trades.push({
          entryTime: trade.entryTime,
          exitTime: candle.timestamp,
          direction: trade.direction,
          entryPrice: trade.entryPrice,
          exitPrice,
          stopLoss: trade.sl,
          takeProfit: trade.tp,
          pnlPoints: totalTradePnl,
          pnlPercent: trade.entryPrice > 0 ? (pnlPoints / trade.entryPrice) * 100 : 0,
          rMultiple: slDistance > 0 ? pnlPoints / slDistance : 0,
          result: totalTradePnl > 0 ? "WIN" : totalTradePnl < 0 ? "LOSS" : "BREAKEVEN",
          runUp: trade.runUp,
          drawdown: trade.drawdown,
          durationBars: Math.max(1, i - trade.entryIndex),
        });
        openTrades.splice(tradeIndex, 1);
      }
    }

    let unrealized = 0;
    for (const trade of openTrades) {
      unrealized += trade.direction === "LONG"
        ? (candle.close - trade.entryPrice) * trade.positionSize
        : (trade.entryPrice - candle.close) * trade.positionSize;
    }
    const currentEquity = balance + unrealized;
    equityCurve.push({ timestamp: candle.timestamp, equity: currentEquity });

    if (currentEquity >= peakEquity) {
      peakEquity = currentEquity;
      if (currentDrawdownDuration > 0) {
        maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
        drawdownDurationTotal += currentDrawdownDuration;
        drawdownPeriods += 1;
      }
      currentDrawdownDuration = 0;
    } else {
      currentDrawdownDuration += 1;
      maxDrawdown = Math.max(maxDrawdown, peakEquity - currentEquity);
    }

    if (i < warmupBars || pendingOrder || openTrades.length >= maxOpenTrades) continue;

    const canOpenDirection = (direction: "LONG" | "SHORT") =>
      openTrades.length === 0 || openTrades.every((trade) => trade.direction === direction);

    try {
      const signal = strategyFn(candles, i, indicators);
      if (signal && typeof signal === "object" && (signal.action === "LONG" || signal.action === "SHORT") && canOpenDirection(signal.action)) {
        pendingOrder = {
          direction: signal.action,
          sl: Math.abs(signal.stopLoss || 15),
          tp: Math.abs(signal.takeProfit || 30),
          signalCandle: i,
          riskPercent: signal.riskPercent || 1,
        };
      }
    } catch (signalError: any) {
      return emptyResult(config, "Strategy runtime error on candle " + i + ": " + (signalError?.message ?? String(signalError)));
    }
  }

  if (currentDrawdownDuration > 0) {
    maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
    drawdownDurationTotal += currentDrawdownDuration;
    drawdownPeriods += 1;
  }

  return buildResult(
    candles,
    trades,
    equityCurve,
    config,
    maxDrawdown,
    {
      avgDrawdownDuration: drawdownPeriods ? drawdownDurationTotal / drawdownPeriods : 0,
      maxDrawdownDuration,
    },
    maxMarginUsed
  );
}

export function runBacktest(candles: Candle[], config: BacktestConfig): BacktestResult {
  if (!candles || candles.length < 52) {
    return emptyResult(config, "Not enough candles for backtest (need at least 52)");
  }

  return executeBacktest(candles, (strategyCandles, index, indicators) => {
    const ema20Current = indicators.ema20[index];
    const ema20Prev = indicators.ema20[index - 1];
    const ema50Current = indicators.ema50[index];
    const ema50Prev = indicators.ema50[index - 1];
    const candle = strategyCandles[index];
    const atrValue = indicators.atr14[index] || Math.max(candle.high - candle.low, 1);

    if (!ema20Current || !ema50Current || !ema20Prev || !ema50Prev) {
      return { action: null, stopLoss: 0, takeProfit: 0, riskPercent: 1 };
    }

    if (ema20Current > ema50Current && ema20Prev <= ema50Prev) {
      return { action: "LONG", stopLoss: atrValue * 1.5, takeProfit: atrValue * 3, riskPercent: 1 };
    }

    if (ema20Current < ema50Current && ema20Prev >= ema50Prev) {
      return { action: "SHORT", stopLoss: atrValue * 1.5, takeProfit: atrValue * 3, riskPercent: 1 };
    }

    return { action: null, stopLoss: 0, takeProfit: 0, riskPercent: 1 };
  }, config);
}

export function runStrategyCode(
  candles: Candle[],
  strategyCode: string,
  config: BacktestConfig
): BacktestResult & { error: string | null } {
  try {
    if (!candles || candles.length < 52) {
      return { ...emptyResult(config), error: "Not enough candles (need 52+)" };
    }

    const extractedCode = extractStrategyFunctionSource(strategyCode);
    if (!extractedCode.code) {
      return { ...emptyResult(config), error: extractedCode.error ?? "Code must contain: function strategy(candles, index, indicators) { ... }" };
    }

    let cleanCode = stripTypeScriptAnnotations(extractedCode.code)
      .replace(/```[\w]*\n?/g, "")
      .replace(/```/g, "")
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, "")
      .replace(/type\s+\w+\s*=\s*[^;]+;/g, "")
      .replace(/\)\s*:\s*\{[^}]*\}\s*\{/g, ") {")
      .replace(/\s+as\s+\w+(\[\])?/g, "")
      .replace(/export\s+/g, "")
      .replace(/import\s+.*\n/g, "")
      .trim();
    cleanCode = cleanCode.replace(/\bconst\s+/g, "var ");
    cleanCode = cleanCode.replace(/\blet\s+/g, "var ");
    cleanCode = cleanCode.replace(/\(\)\s*=>\s*\{/g, "function() {");
    cleanCode = cleanCode.replace(/\(([^)]*)\)\s*=>\s*\{/g, "function($1) {");
    cleanCode = cleanCode.replace(/`([^`]*)`/g, function(match, content) {
      return "\"" + content.replace(/\$\{([^}]+)\}/g, "\" + $1 + \"") + "\"";
    });
    cleanCode = cleanCode.replace(/\{\s*action\s*,/g, "{ action: null,");
    cleanCode = cleanCode.replace(/,\s*action\s*,/g, ", action: null,");
    cleanCode = cleanCode.replace(/,\s*action\s*\}/g, ", action: null }");
    cleanCode = cleanCode.replace(/\bvar\s+noSignal\s*=\s*\{[^}]*\}/g, function(match) {
      if (match.includes("action,") || match.includes("action }")) {
        return "var noSignal = { action: null, stopLoss: 0, takeProfit: 0, riskPercent: 1 }";
      }
      return match;
    });

    if (!cleanCode.includes("function strategy")) {
      return { ...emptyResult(config), error: "Code must contain: function strategy(candles, index, indicators) { ... }" };
    }

    let strategyFn: (candles: Candle[], index: number, indicators: Record<string, number[]>) => StrategySignal | null;
    try {
      const factory = new Function(
        "getSession",
        "detectFVG",
        "getEMASlope",
        "Math",
        cleanCode + "\nreturn strategy;"
      );
      strategyFn = factory(getSession, detectFVG, getEMASlope, Math);
    } catch (parseError) {
      return { ...emptyResult(config), error: "Syntax error in strategy code: " + (parseError as Error).message };
    }

    if (typeof strategyFn !== "function") {
      return { ...emptyResult(config), error: "strategy is not a function. Make sure your code defines: function strategy(candles, index, indicators) { ... }" };
    }

    return executeBacktest(candles, strategyFn, config);
  } catch (error) {
    return { ...emptyResult(config), error: "Backtest failed: " + (error as Error).message };
  }
}
