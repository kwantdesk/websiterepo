import { ALGO_INSTRUMENTS, ALGO_TEMPLATES, algoSessionTimestamp, summarizeAlgoTrades, validateAlgoConfig,
  type AlgoCandle, type AlgoConfig, type AlgoFill, type AlgoRun } from "./algoWorkspace.ts";

/** Strict input boundary: a test never invents a bar or trades across missing minutes. */
export function algoTestSessions(config: AlgoConfig, input: AlgoCandle[], now = Date.now()) {
  const invalid = validateAlgoConfig(config);
  if (invalid) throw new Error(invalid);
  if (Date.parse(config.to) - Date.parse(config.from) > 29 * 86400000) throw new Error("Select up to 30 calendar days per test.");
  const rows = new Map<number, AlgoCandle>();
  for (const raw of input) {
    const c = { ...raw };
    if (![c.timestamp,c.open,c.high,c.low,c.close].every(Number.isFinite)
      || c.timestamp % 60000 || c.low > Math.min(c.open,c.close) || c.high < Math.max(c.open,c.close)
      || c.low > c.high || Math.min(c.open,c.low,c.close) <= 0)
      throw new Error("Recorded history contains an invalid one-minute candle.");
    const old = rows.get(c.timestamp);
    if (old && ["open","high","low","close","volume"].some(k => old[k as keyof AlgoCandle] !== c[k as keyof AlgoCandle]))
      throw new Error("Recorded history contains conflicting candles.");
    rows.set(c.timestamp, c);
  }
  const sessions: { date: string; candles: AlgoCandle[] }[] = [];
  for (let d = Date.parse(config.from + "T00:00:00Z"); d <= Date.parse(config.to + "T00:00:00Z"); d += 86400000) {
    if ([0,6].includes(new Date(d).getUTCDay())) continue;
    const date = new Date(d).toISOString().slice(0,10);
    const start = algoSessionTimestamp(date, config.sessionStart, config.timeZone);
    const end = algoSessionTimestamp(date, config.sessionEnd, config.timeZone);
    if (end > now) throw new Error("Choose completed sessions for a backtest.");
    const candles: AlgoCandle[] = [];
    for (let t = start; t < end; t += 60000) {
      const c = rows.get(t);
      if (!c) throw new Error("Recorded one-minute history is incomplete for " + date + ". Choose a fully recorded session or a shorter session window.");
      candles.push(c);
    }
    if (candles.length) sessions.push({ date, candles });
  }
  if (!sessions.length) throw new Error("Choose a test window containing a completed weekday session.");
  return sessions;
}

/** Closed-bar signals, following-open entries, one trade per strategy/session.
 * OHLC ambiguity is resolved stop-first; adverse opening gaps fill at the open.
 * Commission and slippage are charged as cash costs, not hidden price edits. */
export function runRecordedAlgoBacktest(config: AlgoConfig, input: AlgoCandle[], now = Date.now()): AlgoRun {
  const sessions = algoTestSessions(config, input, now), spec = ALGO_INSTRUMENTS[config.instrument];
  const trades: AlgoFill[] = [];
  const tick = (p: number) => Math.round(p / spec.tick) * spec.tick;
  for (const { date, candles: bars } of sessions) {
    for (const algo of ALGO_TEMPLATES) {
      const p = config.algorithms[algo.id];
      if (!p.enabled || p.lookback >= bars.length - 1) continue;
      let rangeHigh = -Infinity, rangeLow = Infinity, volume = 0, weighted = 0, previousVwap = 0;
      for (let i = 0; i < bars.length - 1; i++) {
        const b = bars[i];
        if (algo.id === "vwap-reversion") {
          if (!Number.isFinite(b.volume) || b.volume! < 0) throw new Error("VWAP reversion requires recorded trade volume on every test candle.");
          weighted += ((b.high + b.low + b.close) / 3) * b.volume!; volume += b.volume!;
        }
        const vwap = volume ? weighted / volume : 0;
        let sign = 0;
        if (i >= p.lookback) {
          if (algo.id === "opening-range") sign = b.close > rangeHigh ? 1 : b.close < rangeLow ? -1 : 0;
          if (algo.id === "trend-continuation") {
            let high = -Infinity, low = Infinity;
            for (let j = i - p.lookback; j < i; j++) { high = Math.max(high, bars[j].high); low = Math.min(low, bars[j].low); }
            sign = b.close > high ? 1 : b.close < low ? -1 : 0;
          }
          if (algo.id === "vwap-reversion" && volume > 0)
            sign = bars[i-1].close <= previousVwap && b.close > vwap ? 1 : bars[i-1].close >= previousVwap && b.close < vwap ? -1 : 0;
        }
        if (i < p.lookback) { rangeHigh = Math.max(rangeHigh, b.high); rangeLow = Math.min(rangeLow, b.low); }
        previousVwap = vwap;
        if (!sign) continue;
        const entryIndex = i + 1, entry = bars[entryIndex];
        const stopPrice = tick(entry.open - sign * p.stopTicks * spec.tick);
        const targetPrice = tick(entry.open + sign * p.targetTicks * spec.tick);
        let exitPrice = bars.at(-1)!.close, exitTime = bars.at(-1)!.timestamp;
        let reason: AlgoFill["reason"] = "Session close";
        for (let j = entryIndex; j < bars.length; j++) {
          const c = bars[j], stop = sign > 0 ? c.low <= stopPrice : c.high >= stopPrice;
          const target = sign > 0 ? c.high >= targetPrice : c.low <= targetPrice;
          if (stop || target) {
            const gappedStop = sign > 0 ? c.open < stopPrice : c.open > stopPrice;
            exitPrice = stop ? gappedStop ? c.open : stopPrice : targetPrice;
            exitTime = c.timestamp; reason = stop ? "SL" : "TP"; break;
          }
        }
        const gross = sign * (exitPrice - entry.open) * spec.pointValue * config.contracts;
        const costs = 2 * config.contracts * (config.commission + config.slippageTicks * spec.tick * spec.pointValue);
        const net = gross - costs, risk = p.stopTicks * spec.tick * spec.pointValue * config.contracts;
        trades.push({ id: date + "-" + algo.id, algoId: algo.id, algo: algo.name, direction: sign > 0 ? "Long" : "Short",
          entryTime: entry.timestamp, exitTime, entryPrice: entry.open, exitPrice, stopPrice, targetPrice,
          quantity: config.contracts, reason, gross, costs, net, r: net / risk });
        break;
      }
    }
  }
  trades.sort((a,b) => a.exitTime - b.exitTime || a.id.localeCompare(b.id));
  const candles = sessions.flatMap(s => s.candles);
  return { kind: "recorded", id: "recorded-" + now, config: structuredClone(config), candles, trades,
    ...summarizeAlgoTrades(trades, config) };
}
