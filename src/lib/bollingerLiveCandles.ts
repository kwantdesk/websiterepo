import type { Candle } from "@/lib/backtester";

const MAX_BOLLINGER_LENGTH = 500;
const MAX_LIVE_CANDLES = 64;

type LiveCandle = { candle: Candle; chartTime: number };

/** Retain direct candle paints until the slower indicator snapshot catches up. */
export class BollingerLiveCandles {
  private pending: LiveCandle[] = [];

  observe(candle: Candle, chartTime: number) {
    const previous = this.pending.at(-1);
    if (previous && candle.timestamp < previous.candle.timestamp) return false;
    if (previous?.candle.timestamp === candle.timestamp) {
      this.pending[this.pending.length - 1] = { candle, chartTime };
      return previous.candle.close !== candle.close || previous.chartTime !== chartTime;
    }
    this.pending.push({ candle, chartTime });
    if (this.pending.length > MAX_LIVE_CANDLES) this.pending.shift();
    return true;
  }

  merge(history: Candle[]) {
    const last = history.at(-1);
    this.pending = this.pending.filter(({ candle }) => {
      if (!last || candle.timestamp > last.timestamp) return true;
      if (candle.timestamp < last.timestamp || candle.close === last.close) return false;
      return last.sourceEndTimestamp === undefined || candle.sourceEndTimestamp === undefined
        || last.sourceEndTimestamp <= candle.sourceEndTimestamp;
    });
    if (!this.pending.length) return null;
    const first = this.pending[0].candle.timestamp;
    const settled = history.slice(-MAX_BOLLINGER_LENGTH).filter(candle => candle.timestamp < first);
    return { candles: [...settled, ...this.pending.map(entry => entry.candle)],
      chartTimes: new Map(this.pending.map(entry => [entry.candle.timestamp, entry.chartTime])) };
  }
}
