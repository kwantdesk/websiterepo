import type { Candle } from "./backtester";

export type SuperTrendPoint = {
  time: number;
  value: number;
  difference: number;
  atr: number;
  direction: "up" | "down";
  reversed: boolean;
  breakBefore?: boolean;
};

export const SUPER_TREND_PARAMETERS = { length: 10, multiplier: 3 } as const;

type Parameters = { length: number; multiplier: number };
type State = {
  previousClose?: number; lastTime: number; count: number; seedMean: number; atr?: number;
  upper: number; lower: number; direction: "up" | "down"; ready: boolean; breakPending: boolean;
};
const initialState = (): State => ({ lastTime: -Infinity, count: 0, seedMean: 0,
  upper: 0, lower: 0, direction: "down", ready: false, breakPending: false });

function validateParameters({ length, multiplier }: Parameters) {
  if (!Number.isInteger(length) || length < 1 || length > 1000
    || !Number.isFinite(multiplier) || multiplier < 0.01 || multiplier > 100) {
    throw new RangeError("Super Trend requires length 1–1000 and multiplier 0.01–100");
  }
}

function advance(state: State, candle: Candle, { length, multiplier }: Parameters): SuperTrendPoint | null {
  const reset = () => { Object.assign(state, initialState(), { lastTime: state.lastTime, breakPending: true });
    state.previousClose = undefined; state.atr = undefined; return null; };
  const { timestamp, high, low, close, open } = candle;
  if (![timestamp, high, low, close, open].every(Number.isFinite)
    || timestamp <= state.lastTime || high < low
    || close < low || close > high || open < low || open > high) {
    if (Number.isFinite(timestamp)) state.lastTime = Math.max(state.lastTime, timestamp);
    return reset();
  }
  state.lastTime = timestamp;
  const range = state.previousClose === undefined ? high - low
    : Math.max(high - low, Math.abs(high - state.previousClose), Math.abs(low - state.previousClose));
  if (!Number.isFinite(range)) return reset();
  if (state.atr === undefined) {
    state.count++;
    state.seedMean += (range - state.seedMean) / state.count;
    if (state.count === length) state.atr = state.seedMean;
  } else state.atr += (range - state.atr) / length;
  if (state.atr === undefined) { state.previousClose = close; return null; }
  const mid = high / 2 + low / 2;
  const candidateUpper = mid + multiplier * state.atr;
  const candidateLower = mid - multiplier * state.atr;
  if (![candidateUpper, candidateLower].every(Number.isFinite)) return reset();
  const oldDirection = state.direction;
  if (!state.ready) { state.upper = candidateUpper; state.lower = candidateLower; }
  else {
    if (candidateUpper < state.upper || state.previousClose! > state.upper) state.upper = candidateUpper;
    if (candidateLower > state.lower || state.previousClose! < state.lower) state.lower = candidateLower;
    if (state.direction === "down" && close > state.upper) state.direction = "up";
    else if (state.direction === "up" && close < state.lower) state.direction = "down";
  }
  const value = state.direction === "up" ? state.lower : state.upper;
  const difference = close - value;
  if (!Number.isFinite(difference)) return reset();
  const point: SuperTrendPoint = { time: timestamp / 1000, value, difference, atr: state.atr, direction: state.direction,
    reversed: state.ready && oldDirection !== state.direction,
    ...(state.breakPending ? { breakBefore: true } : {}) };
  state.previousClose = close; state.ready = true; state.breakPending = false;
  return point;
}

/** Conventional HL2/ATR trailing bands, not recovered vendor IL.
 * Wilder ATR starts with the mean of length true ranges (first = high-low).
 * First ready point seeds bearish; strict close crossings reverse the trend.
 * Recalculate from source bars so updating the live bar never double-counts it.
 * Invalid/duplicate/backwards data resets state and cannot bridge a plot gap.
 */
export function calculateSuperTrendValues(
  candles: readonly Candle[],
  parameters: Parameters = SUPER_TREND_PARAMETERS,
): SuperTrendPoint[] {
  validateParameters(parameters);
  const output: SuperTrendPoint[] = [];
  const state = initialState();
  for (const candle of candles) {
    const point = advance(state, candle, parameters);
    if (point) output.push(point);
  }
  return output;
}

/** O(1) current-bar replacement/append. History corrections require reseed().
 * Holds only two numerical states, never the history array or emitted points.
 */
export class SuperTrendLiveCalculator {
  private currentPoint: SuperTrendPoint | null = null;
  private priorPoint: SuperTrendPoint | null = null;
  private state = initialState();
  private beforeLast = initialState();
  private lastInputTime = -Infinity;
  private readonly parameters: Parameters;

  constructor(parameters: Parameters = SUPER_TREND_PARAMETERS) {
    validateParameters(parameters); this.parameters = { ...parameters };
  }

  reseed(candles: readonly Candle[]): SuperTrendPoint | null {
    this.state = initialState(); this.beforeLast = initialState(); this.lastInputTime = -Infinity;
    let point: SuperTrendPoint | null = null;
    this.currentPoint = null; this.priorPoint = null;
    for (const candle of candles) {
      this.priorPoint = point;
      this.beforeLast = { ...this.state };
      point = advance(this.state, candle, this.parameters);
      this.lastInputTime = candle.timestamp;
    }
    this.currentPoint = point;
    return point;
  }

  previousPoint() { return this.priorPoint; }

  update(candle: Candle): SuperTrendPoint | null {
    // Late/corrupt timestamps cannot roll the current live state backwards.
    if (!Number.isFinite(candle.timestamp) || candle.timestamp < this.lastInputTime) return null;
    if (candle.timestamp === this.lastInputTime) this.state = { ...this.beforeLast };
    else { this.beforeLast = { ...this.state }; this.priorPoint = this.currentPoint; }
    this.lastInputTime = candle.timestamp;
    this.currentPoint = advance(this.state, candle, this.parameters);
    return this.currentPoint;
  }
}
