import type { Candle } from "@/lib/backtester";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";
import type { PrecisionAnchor, PrecisionObject, PrecisionScreenPoint } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function snapPrice(price: number, minMove: number, precision = 8): number {
  if (!Number.isFinite(price) || !Number.isFinite(minMove) || minMove <= 0) return price;
  return Number((Math.round(price / minMove) * minMove).toFixed(precision));
}

export function distanceToSegment(point: PrecisionScreenPoint, a: PrecisionScreenPoint, b: PrecisionScreenPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function extendRay(a: PrecisionScreenPoint, b: PrecisionScreenPoint, width: number, height: number): PrecisionScreenPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return b;
  const candidates = [
    dx > 0 ? (width - a.x) / dx : dx < 0 ? -a.x / dx : Infinity,
    dy > 0 ? (height - a.y) / dy : dy < 0 ? -a.y / dy : Infinity,
  ].filter((value) => value >= 1 && Number.isFinite(value));
  const t = candidates.length ? Math.min(...candidates) : 1;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function perpendicularDistance(point: PrecisionScreenPoint, start: PrecisionScreenPoint, end: PrecisionScreenPoint): number {
  return distanceToSegment(point, start, end);
}

export function simplifyRdp(points: PrecisionScreenPoint[], epsilon: number): PrecisionScreenPoint[] {
  if (points.length < 3) return [...points];
  let maxDistance = 0;
  let index = 0;
  for (let cursor = 1; cursor < points.length - 1; cursor += 1) {
    const distance = perpendicularDistance(points[cursor], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      index = cursor;
      maxDistance = distance;
    }
  }
  if (maxDistance <= epsilon) return [points[0], points[points.length - 1]];
  const left = simplifyRdp(points.slice(0, index + 1), epsilon);
  const right = simplifyRdp(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

export interface RangeVolumeRow {
  price: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  trades: number;
  inValueArea: boolean;
}

export interface RangeVolumeProfile {
  rows: RangeVolumeRow[];
  poc: number | null;
  vah: number | null;
  val: number | null;
  totalVolume: number;
  source: "executed-trades" | "unavailable";
  warning?: string;
}

export function buildExecutedVolumeProfile(
  trades: InstitutionalTrade[],
  startMs: number,
  endMs: number,
  minMove: number,
  requestedRows: number,
  valueAreaPercent: number,
  manualTicksPerRow = 0,
): RangeVolumeProfile {
  const selected = trades.filter((trade) => trade.timestamp >= startMs && trade.timestamp <= endMs && trade.volume > 0);
  if (!selected.length) {
    return { rows: [], poc: null, vah: null, val: null, totalVolume: 0, source: "unavailable", warning: "Executed volume-at-price is unavailable for this selection." };
  }
  const low = Math.min(...selected.map((trade) => trade.low));
  const high = Math.max(...selected.map((trade) => trade.high));
  const naturalTicks = Math.max(1, Math.round((high - low) / minMove));
  const groupTicks = manualTicksPerRow > 0
    ? Math.max(1, Math.round(manualTicksPerRow))
    : Math.max(1, Math.ceil(naturalTicks / clamp(requestedRows, 8, 200)));
  const binSize = minMove * groupTicks;
  const bins = new Map<number, Omit<RangeVolumeRow, "inValueArea">>();
  selected.forEach((trade) => {
    const price = snapPrice(Math.round(trade.close / binSize) * binSize, minMove);
    const current = bins.get(price) ?? { price, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0 };
    current.volume += trade.volume;
    current.bidVolume += trade.bidVolume;
    current.askVolume += trade.askVolume;
    current.delta += trade.delta;
    current.trades += Math.max(1, trade.trades);
    bins.set(price, current);
  });
  const ordered = [...bins.values()].sort((a, b) => a.price - b.price);
  const totalVolume = ordered.reduce((sum, row) => sum + row.volume, 0);
  const profileVwap = totalVolume > 0
    ? ordered.reduce((sum, row) => sum + row.price * row.volume, 0) / totalVolume
    : ordered[0].price;
  const finalClose = [...selected].sort((a, b) => a.timestamp - b.timestamp).at(-1)?.close ?? profileVwap;
  const pocIndex = ordered.reduce((best, row, index) => {
    const incumbent = ordered[best];
    if (row.volume !== incumbent.volume) return row.volume > incumbent.volume ? index : best;
    const vwapDistance = Math.abs(row.price - profileVwap);
    const incumbentVwapDistance = Math.abs(incumbent.price - profileVwap);
    if (vwapDistance !== incumbentVwapDistance) return vwapDistance < incumbentVwapDistance ? index : best;
    const closeDistance = Math.abs(row.price - finalClose);
    const incumbentCloseDistance = Math.abs(incumbent.price - finalClose);
    if (closeDistance !== incumbentCloseDistance) return closeDistance < incumbentCloseDistance ? index : best;
    return row.price < incumbent.price ? index : best;
  }, 0);
  const target = totalVolume * clamp(valueAreaPercent / 100, 0.5, 0.95);
  const included = new Set<number>([pocIndex]);
  let accumulated = ordered[pocIndex].volume;
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  while (accumulated < target && (lowIndex > 0 || highIndex < ordered.length - 1)) {
    const below = lowIndex > 0 ? ordered[lowIndex - 1].volume : -1;
    const above = highIndex < ordered.length - 1 ? ordered[highIndex + 1].volume : -1;
    if (above >= below) { highIndex += 1; included.add(highIndex); accumulated += ordered[highIndex].volume; }
    else { lowIndex -= 1; included.add(lowIndex); accumulated += ordered[lowIndex].volume; }
  }
  return {
    rows: ordered.map((row, index) => ({ ...row, inValueArea: included.has(index) })),
    poc: ordered[pocIndex].price,
    vah: ordered[highIndex].price,
    val: ordered[lowIndex].price,
    totalVolume,
    source: "executed-trades",
  };
}

export interface AnchoredVwapPoint { time: number; value: number; deviation: number; sd1: number; sd2: number; sd3: number; sd4: number; sd5: number }

function candleSource(candle: Candle, source: string): number {
  if (source === "close") return candle.close;
  if (source === "hl2") return (candle.high + candle.low) / 2;
  if (source === "ohlc4") return (candle.open + candle.high + candle.low + candle.close) / 4;
  return (candle.high + candle.low + candle.close) / 3;
}

export function calculateAnchoredVwap(candles: Candle[], anchorTime: number, source = "hlc3", endTime = Infinity): AnchoredVwapPoint[] {
  let volumeSum = 0;
  let weightedMean = 0;
  let weightedM2 = 0;
  const result: AnchoredVwapPoint[] = [];
  candles.filter((candle) => candle.timestamp >= anchorTime && candle.timestamp <= endTime).forEach((candle) => {
    const volume = Math.max(0, candle.volume ?? 0);
    if (volume <= 0) return;
    const typical = candleSource(candle, source);
    const previousMean = weightedMean;
    const nextVolume = volumeSum + volume;
    weightedMean = previousMean + (volume / nextVolume) * (typical - previousMean);
    weightedM2 += volume * (typical - previousMean) * (typical - weightedMean);
    volumeSum = nextVolume;
    const deviation = Math.sqrt(Math.max(0, weightedM2 / volumeSum));
    result.push({ time: candle.timestamp, value: weightedMean, deviation, sd1: deviation, sd2: deviation * 2, sd3: deviation * 3, sd4: deviation * 4, sd5: deviation * 5 });
  });
  return result;
}

export interface TradeCalculatorResult {
  valid: boolean;
  direction: "BUY" | "SELL";
  entry: number;
  stop: number;
  target: number;
  riskPoints: number;
  rewardPoints: number;
  riskTicks: number;
  rewardTicks: number;
  riskPerContract: number;
  rewardPerContract: number;
  quantity: number;
  totalRisk: number;
  totalReward: number;
  rMultiple: number;
  monetaryAvailable: boolean;
  warning?: string;
}

export function calculateTradeRisk(
  object: Pick<PrecisionObject, "toolId" | "anchors" | "options">,
  minMove: number,
  pointValue: number,
): TradeCalculatorResult {
  const [entryAnchor, stopAnchor, targetAnchor] = object.anchors;
  const direction = object.toolId === "precision-sell-calculator" ? "SELL" : "BUY";
  const empty: TradeCalculatorResult = { valid: false, direction, entry: 0, stop: 0, target: 0, riskPoints: 0, rewardPoints: 0, riskTicks: 0, rewardTicks: 0, riskPerContract: 0, rewardPerContract: 0, quantity: 0, totalRisk: 0, totalReward: 0, rMultiple: 0, monetaryAvailable: pointValue > 0 };
  if (!entryAnchor || !stopAnchor || !targetAnchor || minMove <= 0) return { ...empty, warning: "Three anchors and valid tick metadata are required." };
  const entry = entryAnchor.price;
  const stop = stopAnchor.price;
  const target = targetAnchor.price;
  const riskPoints = direction === "BUY" ? entry - stop : stop - entry;
  const rewardPoints = direction === "BUY" ? target - entry : entry - target;
  if (riskPoints <= 0 || rewardPoints <= 0) return { ...empty, entry, stop, target, warning: direction === "BUY" ? "Buy calculator requires stop below entry and target above entry." : "Sell calculator requires stop above entry and target below entry." };
  const riskTicks = riskPoints / minMove;
  const rewardTicks = rewardPoints / minMove;
  const monetaryAvailable = pointValue > 0;
  const commission = monetaryAvailable ? Number(object.options.commissionPerContract ?? 0) : 0;
  const slippageTicks = Number(object.options.slippageTicks ?? 0);
  const riskPerContract = monetaryAvailable ? riskPoints * pointValue + commission + slippageTicks * minMove * pointValue : 0;
  const rewardPerContract = monetaryAvailable ? rewardPoints * pointValue - commission - slippageTicks * minMove * pointValue : 0;
  const mode = String(object.options.quantityMode ?? "fixed");
  const fixedQuantity = Math.max(1, Math.floor(Number(object.options.quantity ?? object.options.quantityOverride ?? 1)));
  let quantity = fixedQuantity;
  if (monetaryAvailable && object.options.quantityMode == null && Number(object.options.accountSize ?? 0) > 0 && Number(object.options.riskPercent ?? 0) > 0) {
    const explicitBudget = Number(object.options.accountSize) * clamp(Number(object.options.riskPercent), 0, 100) / 100;
    quantity = Math.max(0, Math.floor(explicitBudget / Math.max(riskPerContract, 0.000001)));
  }
  if (monetaryAvailable && mode === "risk-stop") quantity = Math.max(0, Math.floor(Number(object.options.riskBudget ?? 0) / Math.max(riskPerContract, 0.000001)));
  if (monetaryAvailable && mode === "risk-target") quantity = Math.max(0, Math.floor(Number(object.options.targetAmount ?? 0) / Math.max(rewardPerContract, 0.000001)));
  return { valid: true, direction, entry, stop, target, riskPoints, rewardPoints, riskTicks, rewardTicks, riskPerContract, rewardPerContract, quantity, totalRisk: riskPerContract * quantity, totalReward: rewardPerContract * quantity, rMultiple: rewardPoints / Math.max(riskPoints, 0.000001), monetaryAvailable, warning: monetaryAvailable ? undefined : "Point value is unavailable; tick-based calculations remain active." };
}

export function fibPrice(start: number, end: number, ratio: number, reverse = false): number {
  const delta = end - start;
  return reverse ? end - delta * ratio : start + delta * ratio;
}

export function translateAnchors(anchors: PrecisionAnchor[], deltaTime: number, deltaLogical: number, deltaPrice: number): PrecisionAnchor[] {
  return anchors.map((anchor) => ({ time: anchor.time + deltaTime, logicalIndex: anchor.logicalIndex + deltaLogical, price: anchor.price + deltaPrice }));
}
