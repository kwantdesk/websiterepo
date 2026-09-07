import { finalizeValueAreaRows } from "./archive-value-area.mjs";
import { RithmicHistoryPlantClient } from "./history-plant-client.mjs";

const completed = new Map();
const inflight = new Map();
let requestLane = Promise.resolve();

function numberAt(values, index) {
  const value = Number(values?.[index] ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function accumulateHistoryVolumeProfileBar(bar, args, rows, totals) {
  const timestamp = Number(bar.marker) * 1_000;
  if (!Number.isFinite(timestamp) || timestamp < args.startMs || timestamp >= args.endMs) return false;
  const prices = Array.isArray(bar.profilePrice) ? bar.profilePrice : [];
  const bidVolumes = Array.isArray(bar.profileBidVolume) ? bar.profileBidVolume : [];
  const askVolumes = Array.isArray(bar.profileAskVolume) ? bar.profileAskVolume : [];
  const neutralVolumes = Array.isArray(bar.profileNoAggressorVolume) ? bar.profileNoAggressorVolume : [];
  const bidTrades = Array.isArray(bar.profileBidAggressorTrades) ? bar.profileBidAggressorTrades : [];
  const askTrades = Array.isArray(bar.profileAskAggressorTrades) ? bar.profileAskAggressorTrades : [];
  const neutralTrades = Array.isArray(bar.profileNoAggressorTrades) ? bar.profileNoAggressorTrades : [];
  let accepted = false;
  let profiledTrades = 0;
  prices.forEach((rawPrice, index) => {
    const price = Number(rawPrice);
    const volume = numberAt(bidVolumes, index)
      + numberAt(askVolumes, index)
      + numberAt(neutralVolumes, index);
    if (!Number.isFinite(price) || price <= 0 || volume <= 0) return;
    const tickIndex = Math.round(price / args.tickSize);
    rows.set(tickIndex, (rows.get(tickIndex) ?? 0) + volume);
    totals.volume += volume;
    totals.priceVolume += price * volume;
    profiledTrades += numberAt(bidTrades, index)
      + numberAt(askTrades, index)
      + numberAt(neutralTrades, index);
    accepted = true;
  });
  if (!accepted) return false;
  totals.trades += profiledTrades || Math.max(0, Number(bar.numTrades) || 0);
  totals.firstTradeAt = totals.firstTradeAt === null ? timestamp : Math.min(totals.firstTradeAt, timestamp);
  totals.lastTradeAt = totals.lastTradeAt === null ? timestamp : Math.max(totals.lastTradeAt, timestamp);
  return true;
}

async function replay(config, args) {
  const client = new RithmicHistoryPlantClient(config, { requestTimeoutMs: 4 * 60_000 });
  const rows = new Map();
  const totals = {
    volume: 0,
    priceVolume: 0,
    trades: 0,
    firstTradeAt: null,
    lastTradeAt: null,
  };
  let minuteBars = 0;
  try {
    await client.replayVolumeProfileMinuteBars({
      exchange: args.exchange,
      symbol: args.symbol,
      startSec: Math.floor(args.startMs / 1_000),
      finishSec: Math.ceil(args.endMs / 1_000) - 1,
      onBar: (bar) => {
        if (accumulateHistoryVolumeProfileBar(bar, args, rows, totals)) minuteBars += 1;
      },
    });
  } finally {
    client.close();
  }
  const profile = finalizeValueAreaRows(rows, totals, args.tickSize, args.valueAreaPercent ?? 0.7);
  if (!profile || minuteBars <= 0) return null;
  return {
    ...profile,
    provider: "Rithmic",
    source: "Rithmic History Plant volume-profile minute bars",
    contractSymbol: args.symbol,
    startMs: args.startMs,
    endMs: args.endMs,
    minuteBars,
    integrityGaps: 0,
    droppedMessages: 0,
  };
}

/**
 * Exact volume-at-price recovery for archive windows interrupted by collector
 * restarts. Requests share one History Plant lane so a burst of browsers can
 * never open competing replay sessions against the trading account.
 */
export function buildHistoryValueAreaProfile(config, args) {
  const key = [args.exchange, args.symbol, args.startMs, args.endMs, args.tickSize, args.valueAreaPercent ?? 0.7].join(":");
  if (completed.has(key)) return Promise.resolve(completed.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const operation = requestLane
    .catch(() => undefined)
    .then(() => replay(config, args))
    .then((profile) => {
      if (profile) completed.set(key, profile);
      return profile;
    })
    .finally(() => inflight.delete(key));
  requestLane = operation;
  inflight.set(key, operation);
  return operation;
}
