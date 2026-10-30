/**
 * Frontend contracts for a future VPS strategy runner. Imported source is a draft,
 * never executable here. Every run currently produced by this module is PREVIEW.
 */
export type AlgoInstrument = "NQ" | "ES" | "GC";
export type AlgoInterval = 1 | 5 | 15 | 60;
export type AlgoInputs = { enabled: boolean; lookback: number; stopTicks: number; targetTicks: number };
export type AlgoConfig = {
  instrument: AlgoInstrument;
  from: string;
  to: string;
  timeZone: string;
  sessionStart: string;
  sessionEnd: string;
  capital: number;
  contracts: number;
  commission: number;
  slippageTicks: number;
  algorithms: Record<string, AlgoInputs>;
};
export type AlgoDraft = { id: string; name: string; language: "Pine Script" | "NinjaScript"; source: string };
export type AlgoCandle = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };
export type AlgoFill = {
  id: string; algo: string; algoId: string; direction: "Long" | "Short";
  entryTime: number; exitTime: number; entryPrice: number; exitPrice: number;
  stopPrice: number; targetPrice: number; quantity: number;
  reason: "TP" | "SL" | "Session close"; gross: number; costs: number; net: number; r: number;
};
export type AlgoEquityPoint = { timestamp: number; equity: number; drawdown: number; drawdownPercent: number };
export type AlgoMetrics = {
  net: number; returnPercent: number; grossProfit: number; grossLoss: number; trades: number;
  wins: number; losses: number; winRate: number; profitFactor: number | null;
  expectancy: number; averageWin: number; averageLoss: number; payoff: number | null;
  maxDrawdown: number; maxDrawdownPercent: number; sharpe: number | null;
  sortino: number | null; calmar: number | null; recovery: number | null;
  averageR: number; averageMinutes: number; consecutiveLosses: number;
};
export type AlgoRun = {
  kind: "preview"; id: string; config: AlgoConfig; candles: AlgoCandle[];
  trades: AlgoFill[]; equity: AlgoEquityPoint[]; metrics: AlgoMetrics;
};
export const ALGO_TEMPLATES = [
  { id: "opening-range", name: "Opening range breakout", short: "ORB", detail: "Range breakouts after the opening window.", color: "#22c55e", lookback: 15, stopTicks: 24, targetTicks: 48 },
  { id: "vwap-reversion", name: "VWAP reversion", short: "VWAP", detail: "Reversion to a volume-weighted reference.", color: "#38bdf8", lookback: 45, stopTicks: 32, targetTicks: 56 },
  { id: "trend-continuation", name: "Trend continuation", short: "TREND", detail: "Continuation following a momentum pullback.", color: "#f59e0b", lookback: 80, stopTicks: 40, targetTicks: 72 },
] as const;
export const ALGO_INSTRUMENTS = {
  NQ: { name: "E-mini Nasdaq-100", tick: 0.25, pointValue: 20, base: 24000 },
  ES: { name: "E-mini S&P 500", tick: 0.25, pointValue: 50, base: 6500 },
  GC: { name: "Gold", tick: 0.1, pointValue: 100, base: 4000 },
} as const;
export const ALGO_STORAGE_KEY = "kwantdesk:algo-workspace:v1";

export function defaultAlgoConfig(now = new Date()): AlgoConfig {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  while (end.getUTCDay() === 0 || end.getUTCDay() === 6) end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  while (start.getUTCDay() === 0 || start.getUTCDay() === 6) start.setUTCDate(start.getUTCDate() + 1);
  return {
    instrument: "NQ", from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10),
    timeZone: "America/New_York", sessionStart: "09:30", sessionEnd: "16:00",
    capital: 50000, contracts: 1, commission: 2.5, slippageTicks: 1,
    algorithms: Object.fromEntries(ALGO_TEMPLATES.map((a, i) => [a.id, {
      enabled: i < 2, lookback: a.lookback, stopTicks: a.stopTicks, targetTicks: a.targetTicks,
    }])),
  };
}

const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const minuteOfDay = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export function validateAlgoConfig(config: AlgoConfig, requireSelection = true): string | null {
  if (!ALGO_INSTRUMENTS[config.instrument]) return "Choose a supported preview instrument.";
  if (!validDay(config.from) || !validDay(config.to) || config.from > config.to) return "Choose a valid start and end date.";
  if ((Date.parse(config.to) - Date.parse(config.from)) / 86400000 > 365) return "Choose up to one year for an interface preview.";
  try { new Intl.DateTimeFormat("en", { timeZone: config.timeZone }).format(); } catch { return "Choose a valid timezone."; }
  if (![config.sessionStart, config.sessionEnd].every((v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v))) return "Choose valid session times.";
  if (minuteOfDay(config.sessionEnd) - minuteOfDay(config.sessionStart) < 30) return "The preview session must last at least 30 minutes and end on the same day.";
  if (!Number.isFinite(config.capital) || config.capital < 100 || config.capital > 1e9) return "Starting capital must be between $100 and $1 billion.";
  if (!Number.isInteger(config.contracts) || config.contracts < 1 || config.contracts > 100) return "Choose 1–100 contracts.";
  if (!Number.isFinite(config.commission) || config.commission < 0 || config.commission > 1000 ||
      !Number.isFinite(config.slippageTicks) || config.slippageTicks < 0 || config.slippageTicks > 100) return "Costs must be valid, non-negative amounts.";
  if (requireSelection && !ALGO_TEMPLATES.some((a) => config.algorithms[a.id]?.enabled)) return "Enable at least one algo template.";
  for (const algo of ALGO_TEMPLATES) {
    const p = config.algorithms[algo.id];
    if (!p || !Number.isInteger(p.lookback) || p.lookback < 1 || p.lookback > 300 ||
        !Number.isInteger(p.stopTicks) || p.stopTicks < 1 || p.stopTicks > 2000 ||
        !Number.isInteger(p.targetTicks) || p.targetTicks < 1 || p.targetTicks > 4000) return "Check the lookback, stop and target inputs.";
  }
  return null;
}

/** Exchange-local wall clock -> UTC; weekday sessions avoid ambiguous Sunday DST hours. */
export function algoSessionTimestamp(day: string, clock: string, timeZone: string): number {
  const target = Date.parse(day + "T" + clock + ":00Z");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  let value = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(value).map((p) => [p.type, p.value]));
    const local = Date.parse(parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute + ":00Z");
    value += target - local;
  }
  return value;
}

function tradingDays(from: string, to: string) {
  const days: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400000) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
function randomSource(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function seedFor(value: string) {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) seed = Math.imul(seed ^ value.charCodeAt(i), 16777619);
  return seed >>> 0;
}

export function summarizeAlgoTrades(trades: AlgoFill[], config: AlgoConfig) {
  const ordered = [...trades].sort((a, b) => a.exitTime - b.exitTime || a.id.localeCompare(b.id));
  let balance = config.capital, peak = balance, maxDD = 0, maxDDPct = 0, streak = 0, worstStreak = 0;
  const equity: AlgoEquityPoint[] = [{ timestamp: algoSessionTimestamp(config.from, config.sessionStart, config.timeZone), equity: balance, drawdown: 0, drawdownPercent: 0 }];
  const dailyPnl = new Map<string, number>();
  const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  for (const trade of ordered) {
    balance += trade.net;
    peak = Math.max(peak, balance);
    const dd = peak - balance, ddPct = peak > 0 ? dd / peak * 100 : 0;
    maxDD = Math.max(maxDD, dd); maxDDPct = Math.max(maxDDPct, ddPct);
    streak = trade.net < 0 ? streak + 1 : 0; worstStreak = Math.max(worstStreak, streak);
    equity.push({ timestamp: trade.exitTime, equity: balance, drawdown: dd, drawdownPercent: ddPct });
    const parts = Object.fromEntries(dayFormat.formatToParts(trade.exitTime).map((p) => [p.type, p.value]));
    const day = parts.year + "-" + parts.month + "-" + parts.day;
    dailyPnl.set(day, (dailyPnl.get(day) ?? 0) + trade.net);
  }
  const days = tradingDays(config.from, config.to);
  let dailyBalance = config.capital;
  const returns = days.map((day) => {
    const pnl = dailyPnl.get(day) ?? 0, r = dailyBalance > 0 ? pnl / dailyBalance : 0;
    dailyBalance += pnl;
    return r;
  });
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const std = returns.length > 1 ? Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1)) : 0;
  const downside = returns.length ? Math.sqrt(returns.reduce((a, b) => a + Math.min(0, b) ** 2, 0) / returns.length) : 0;
  const winners = ordered.filter((t) => t.net > 0), losers = ordered.filter((t) => t.net < 0);
  const grossProfit = winners.reduce((a, t) => a + t.net, 0), grossLoss = -losers.reduce((a, t) => a + t.net, 0);
  const averageWin = winners.length ? grossProfit / winners.length : 0, averageLoss = losers.length ? grossLoss / losers.length : 0;
  const net = balance - config.capital;
  const annualized = balance > 0 && days.length > 0 ? (balance / config.capital) ** (252 / days.length) - 1 : NaN;
  const annualReturn = Number.isFinite(annualized) ? annualized : null;
  const metrics: AlgoMetrics = {
    net, returnPercent: net / config.capital * 100, grossProfit, grossLoss, trades: ordered.length,
    wins: winners.length, losses: losers.length, winRate: ordered.length ? winners.length / ordered.length * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    expectancy: ordered.length ? net / ordered.length : 0, averageWin, averageLoss,
    payoff: averageLoss > 0 ? averageWin / averageLoss : null, maxDrawdown: maxDD, maxDrawdownPercent: maxDDPct,
    sharpe: std > 0 ? mean / std * Math.sqrt(252) : null,
    sortino: downside > 0 ? mean / downside * Math.sqrt(252) : null,
    calmar: maxDDPct > 0 && annualReturn !== null ? annualReturn / (maxDDPct / 100) : null,
    recovery: maxDD > 0 ? net / maxDD : null,
    averageR: ordered.length ? ordered.reduce((a, t) => a + t.r, 0) / ordered.length : 0,
    averageMinutes: ordered.length ? ordered.reduce((a, t) => a + (t.exitTime - t.entryTime) / 60000, 0) / ordered.length : 0,
    consecutiveLosses: worstStreak,
  };
  return { metrics, equity };
}

/** Deterministic illustration, deliberately unrelated to any live or archived market feed. */
export function buildAlgoPreview(config: AlgoConfig): AlgoRun {
  const error = validateAlgoConfig(config);
  if (error) throw new Error(error);
  const snapshot: AlgoConfig = JSON.parse(JSON.stringify(config));
  const instrument = ALGO_INSTRUMENTS[snapshot.instrument];
  const candles: AlgoCandle[] = [], trades: AlgoFill[] = [];
  const minutes = minuteOfDay(snapshot.sessionEnd) - minuteOfDay(snapshot.sessionStart);
  const tick = (price: number) => Math.round(price / instrument.tick) * instrument.tick;
  let last: number = instrument.base;
  const days = tradingDays(snapshot.from, snapshot.to);
  if (!days.length) throw new Error("Choose a window containing at least one weekday.");
  days.forEach((day, dayIndex) => {
    const random = randomSource(seedFor(day + snapshot.instrument));
    const start = algoSessionTimestamp(day, snapshot.sessionStart, snapshot.timeZone);
    const session: AlgoCandle[] = [];
    for (let m = 0; m < minutes; m++) {
      const open = last, move = (random() - 0.49 + Math.sin(m / 18 + dayIndex) * 0.12) * 18 * instrument.tick;
      const close = tick(open + move);
      session.push({ timestamp: start + m * 60000, open,
        high: tick(Math.max(open, close) + random() * 6 * instrument.tick),
        low: tick(Math.min(open, close) - random() * 6 * instrument.tick), close,
        volume: Math.floor(50 + random() * 500) });
      last = close;
    }
    candles.push(...session);
    ALGO_TEMPLATES.forEach((algo, index) => {
      const inputs = snapshot.algorithms[algo.id];
      if (!inputs.enabled) return;
      const entryIndex = Math.min(minutes - 3, inputs.lookback + index * 12);
      const entry = session[entryIndex], direction = (dayIndex + index) % 2 ? "Short" : "Long", sign = direction === "Long" ? 1 : -1;
      const stopPrice = tick(entry.open - sign * inputs.stopTicks * instrument.tick);
      const targetPrice = tick(entry.open + sign * inputs.targetTicks * instrument.tick);
      let exitPrice = session[session.length - 1].close, exitTime = session[session.length - 1].timestamp;
      let reason: AlgoFill["reason"] = "Session close";
      for (let i = entryIndex; i < session.length; i++) {
        const c = session[i];
        // Conservative ordering when an illustrative bar touches both brackets.
        const stop = sign > 0 ? c.low <= stopPrice : c.high >= stopPrice;
        const target = sign > 0 ? c.high >= targetPrice : c.low <= targetPrice;
        if (stop || target) {
          exitPrice = stop ? stopPrice : targetPrice; exitTime = c.timestamp; reason = stop ? "SL" : "TP"; break;
        }
      }
      const gross = sign * (exitPrice - entry.open) * instrument.pointValue * snapshot.contracts;
      const costs = 2 * snapshot.contracts * (snapshot.commission + snapshot.slippageTicks * instrument.tick * instrument.pointValue);
      const net = gross - costs, risk = inputs.stopTicks * instrument.tick * instrument.pointValue * snapshot.contracts;
      trades.push({ id: day + "-" + algo.id, algo: algo.name, algoId: algo.id, direction, entryTime: entry.timestamp,
        exitTime, entryPrice: entry.open, exitPrice, stopPrice, targetPrice, quantity: snapshot.contracts, reason, gross, costs, net, r: risk > 0 ? net / risk : 0 });
    });
  });
  trades.sort((a, b) => a.exitTime - b.exitTime || a.id.localeCompare(b.id));
  return { kind: "preview", id: "preview-" + seedFor(JSON.stringify(snapshot)), config: snapshot, candles, trades, ...summarizeAlgoTrades(trades, snapshot) };
}

export function aggregateAlgoCandles(candles: AlgoCandle[], interval: AlgoInterval): AlgoCandle[] {
  if (interval === 1) return candles;
  const result: AlgoCandle[] = [];
  for (const candle of candles) {
    const timestamp = Math.floor(candle.timestamp / (interval * 60000)) * interval * 60000;
    const previous = result[result.length - 1];
    if (previous?.timestamp === timestamp) {
      previous.high = Math.max(previous.high, candle.high); previous.low = Math.min(previous.low, candle.low);
      previous.close = candle.close; previous.volume += candle.volume;
    } else result.push({ ...candle, timestamp });
  }
  return result;
}

export type AlgoMonteCarlo = { paths: number[][]; p5: number; p50: number; p95: number; lossProbability: number; ruinProbability: number; ruinAt: number };
export function bootstrapAlgoTrades(trades: AlgoFill[], capital: number, count = 120, seed = 42): AlgoMonteCarlo {
  const random = randomSource(seed), steps = Math.min(300, trades.length), paths: number[][] = [];
  let losses = 0, ruined = 0;
  for (let p = 0; p < count; p++) {
    const path = [capital];
    for (let i = 0; i < steps; i++) path.push(path[path.length - 1] + trades[Math.floor(random() * trades.length)].net);
    paths.push(path);
    if (path[path.length - 1] < capital) losses++;
    if (path.some((v) => v <= capital * 0.5)) ruined++;
  }
  const terminals = paths.map((p) => p[p.length - 1]).sort((a, b) => a - b);
  const quantile = (q: number) => terminals.length ? terminals[Math.floor((terminals.length - 1) * q)] : capital;
  return { paths, p5: quantile(.05), p50: quantile(.5), p95: quantile(.95), lossProbability: count ? losses / count * 100 : 0, ruinProbability: count ? ruined / count * 100 : 0, ruinAt: capital * .5 };
}
