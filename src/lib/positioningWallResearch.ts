import type { GexMapFrame } from "@/lib/gexMap";
import type { OptionsCandle } from "@/lib/optionsFlow";

export type PositioningWallResearchRoot = "NQ" | "ES";

export type PositioningWallResearchCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type PositioningWallSample = {
  timestamp: number;
  rank: number;
  sourceStrike: number;
  midpoint: number;
  score: number;
  netGex: number;
  netDex: number;
  futuresPrice: number;
  sourcePrice: number;
};

export type PositioningWallEpisode = {
  id: string;
  rank: number;
  sourceStrike: number;
  startedAt: number;
  endedAt: number;
  samples: PositioningWallSample[];
};

export type PositioningWallTouch = {
  episodeId: string;
  timestamp: number;
  rank: number;
  sourceStrike: number;
  line: string;
  offset: number;
  price: number;
  approach: "FROM_BELOW" | "FROM_ABOVE";
  exactExtremeTouch: boolean;
  ambiguousIntrabar: boolean;
  favorableExcursion: number;
  adverseExcursion: number;
  closeAfterWindow: number;
  cleanReaction: boolean;
};

export type PositioningWallLineSummary = {
  line: string;
  offset: number;
  touches: number;
  exactExtremeTouches: number;
  exactExtremeRate: number | null;
  cleanReactions: number;
  cleanReactionRate: number | null;
  medianFavorableExcursion: number | null;
  medianAdverseExcursion: number | null;
};

export type PositioningWallStudy = {
  root: PositioningWallResearchRoot;
  zoneHalfWidth: number;
  reactionWindowMinutes: number;
  reactionThreshold: number;
  adverseTolerance: number;
  samples: number;
  episodes: number;
  touches: PositioningWallTouch[];
  summaries: PositioningWallLineSummary[];
};

const TICK_SIZE = 0.25;

function finite(value: number) {
  return Number.isFinite(value);
}

function roundToTick(value: number) {
  return Math.round(value / TICK_SIZE) * TICK_SIZE;
}

function latestAtOrBefore<T extends { timestamp: number }>(rows: T[], timestamp: number) {
  let low = 0;
  let high = rows.length - 1;
  let match: T | null = null;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (rows[middle].timestamp <= timestamp) {
      match = rows[middle];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Rebuild the same GEX/DEX composite that produces generic Positioning Walls,
 * but at every archived options frame and with the futures/cash basis that was
 * observable at that timestamp. Nothing after the frame is used here.
 */
export function reconstructPositioningWallSamples(args: {
  gammaFrames: GexMapFrame[];
  deltaFrames: GexMapFrame[];
  sourceCandles: OptionsCandle[];
  futuresCandles: PositioningWallResearchCandle[];
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(10, Math.trunc(args.limit ?? 5)));
  const gammaFrames = [...args.gammaFrames].sort((a, b) => a.timestamp - b.timestamp);
  const deltaFrames = [...args.deltaFrames].sort((a, b) => a.timestamp - b.timestamp);
  const sourceCandles = [...args.sourceCandles].sort((a, b) => a.timestamp - b.timestamp);
  const futuresCandles = [...args.futuresCandles].sort((a, b) => a.timestamp - b.timestamp);
  const samples: PositioningWallSample[] = [];

  for (const gammaFrame of gammaFrames) {
    const sourceCandle = latestAtOrBefore(sourceCandles, gammaFrame.timestamp);
    const futuresCandle = latestAtOrBefore(futuresCandles, gammaFrame.timestamp);
    if (!sourceCandle || !futuresCandle || sourceCandle.close <= 0 || futuresCandle.close <= 0) continue;
    const deltaFrame = latestAtOrBefore(deltaFrames, gammaFrame.timestamp);
    const nearby = gammaFrame.updates.filter((row) =>
      finite(row.strike)
      && finite(row.net)
      && row.strike >= sourceCandle.close * 0.97
      && row.strike <= sourceCandle.close * 1.03);
    if (!nearby.length) continue;

    const deltaByStrike = new Map((deltaFrame?.updates ?? []).map((row) => [row.strike, row.net]));
    const maxGex = Math.max(TICK_SIZE, ...nearby.map((row) => Math.abs(row.net)));
    const maxDex = Math.max(TICK_SIZE, ...nearby.map((row) => Math.abs(deltaByStrike.get(row.strike) ?? 0)));
    const scale = futuresCandle.close / sourceCandle.close;
    nearby
      .map((row) => {
        const netDex = deltaByStrike.get(row.strike) ?? 0;
        return {
          sourceStrike: row.strike,
          midpoint: roundToTick(row.strike * scale),
          score: Math.abs(row.net) / maxGex * 0.65 + Math.abs(netDex) / maxDex * 0.35,
          netGex: row.net,
          netDex,
        };
      })
      .sort((left, right) => right.score - left.score || Math.abs(right.netGex) - Math.abs(left.netGex))
      .slice(0, limit)
      .forEach((row, index) => samples.push({
        timestamp: gammaFrame.timestamp,
        rank: index + 1,
        sourceStrike: row.sourceStrike,
        midpoint: row.midpoint,
        score: row.score,
        netGex: row.netGex,
        netDex: row.netDex,
        futuresPrice: futuresCandle.close,
        sourcePrice: sourceCandle.close,
      }));
  }
  return samples;
}

/** Group repeated one-minute observations into one wall lifecycle. */
export function createPositioningWallEpisodes(samples: PositioningWallSample[], maximumGapMinutes = 10) {
  const maximumGap = maximumGapMinutes * 60_000;
  const episodes: PositioningWallEpisode[] = [];
  const active = new Map<string, PositioningWallEpisode>();
  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp || a.rank - b.rank);

  for (const sample of ordered) {
    const key = `${sample.rank}:${sample.sourceStrike}`;
    const prior = active.get(key);
    if (!prior || sample.timestamp - prior.endedAt > maximumGap) {
      const episode: PositioningWallEpisode = {
        id: `${sample.timestamp}:${key}`,
        rank: sample.rank,
        sourceStrike: sample.sourceStrike,
        startedAt: sample.timestamp,
        endedAt: sample.timestamp,
        samples: [sample],
      };
      active.set(key, episode);
      episodes.push(episode);
    } else {
      prior.samples.push(sample);
      prior.endedAt = sample.timestamp;
    }
  }
  return episodes;
}

function excursionAfterTouch(
  candles: PositioningWallResearchCandle[],
  touchIndex: number,
  linePrice: number,
  approach: PositioningWallTouch["approach"],
  windowMs: number,
) {
  const touchTime = candles[touchIndex].timestamp;
  const future = candles.slice(touchIndex, touchIndex + 1 + Math.ceil(windowMs / 60_000) + 2)
    .filter((candle) => candle.timestamp <= touchTime + windowMs);
  const awaySign = approach === "FROM_BELOW" ? -1 : 1;
  let favorable = 0;
  let adverse = 0;
  for (const candle of future) {
    const favorablePrice = awaySign > 0 ? candle.high : candle.low;
    const adversePrice = awaySign > 0 ? candle.low : candle.high;
    favorable = Math.max(favorable, (favorablePrice - linePrice) * awaySign);
    adverse = Math.max(adverse, (adversePrice - linePrice) * -awaySign);
  }
  return {
    favorable,
    adverse,
    close: future.at(-1)?.close ?? candles[touchIndex].close,
  };
}

export function analyzePositioningWallTouches(args: {
  root: PositioningWallResearchRoot;
  samples: PositioningWallSample[];
  futuresCandles: PositioningWallResearchCandle[];
  zoneHalfWidth?: number;
  controlOffsets?: number[];
  reactionWindowMinutes?: number;
  reactionThreshold?: number;
  adverseTolerance?: number;
}) : PositioningWallStudy {
  const zoneHalfWidth = args.zoneHalfWidth ?? (args.root === "NQ" ? 6 : 1.5);
  const reactionWindowMinutes = args.reactionWindowMinutes ?? 30;
  const reactionThreshold = args.reactionThreshold ?? (args.root === "NQ" ? 8 : 2);
  const adverseTolerance = args.adverseTolerance ?? (args.root === "NQ" ? 4 : 1);
  const controls = args.controlOffsets ?? (args.root === "NQ" ? [4, 5, 7, 8] : [1, 2]);
  const lines = [
    { line: "BOTTOM", offset: -zoneHalfWidth },
    { line: "MIDPOINT", offset: 0 },
    { line: "TOP", offset: zoneHalfWidth },
    ...controls.flatMap((offset) => [
      { line: `CONTROL_MINUS_${offset}`, offset: -offset },
      { line: `CONTROL_PLUS_${offset}`, offset },
    ]),
  ].filter((line, index, all) => all.findIndex((candidate) => candidate.offset === line.offset) === index);
  const candles = [...args.futuresCandles].sort((a, b) => a.timestamp - b.timestamp);
  const episodes = createPositioningWallEpisodes(args.samples);
  const touches: PositioningWallTouch[] = [];

  for (const episode of episodes) {
    // A line may be touched while its latest frame is still current, but it
    // must not remain eligible for the entire reaction window after the
    // positioning cluster has disappeared from subsequent frames.
    const episodeEnd = episode.endedAt + 2 * 60_000;
    const firstCandleIndex = candles.findIndex((candle) => candle.timestamp >= episode.startedAt);
    if (firstCandleIndex < 1) continue;
    const touchedOffsets = new Set<number>();
    for (let candleIndex = firstCandleIndex; candleIndex < candles.length; candleIndex += 1) {
      const candle = candles[candleIndex];
      if (candle.timestamp > episodeEnd || touchedOffsets.size === lines.length) break;
      const sample = latestAtOrBefore(episode.samples, candle.timestamp);
      if (!sample) continue;
      const previousClose = candles[candleIndex - 1].close;
      const crossed = lines.filter(({ offset }) => {
        if (touchedOffsets.has(offset)) return false;
        const price = roundToTick(sample.midpoint + offset);
        return candle.low <= price && candle.high >= price && Math.abs(previousClose - price) >= TICK_SIZE;
      });
      for (const { line, offset } of crossed) {
        const price = roundToTick(sample.midpoint + offset);
        const approach: PositioningWallTouch["approach"] = previousClose < price ? "FROM_BELOW" : "FROM_ABOVE";
        const exactExtremeTouch = approach === "FROM_BELOW"
          ? Math.abs(candle.high - price) <= TICK_SIZE / 2
          : Math.abs(candle.low - price) <= TICK_SIZE / 2;
        const excursion = excursionAfterTouch(
          candles,
          candleIndex,
          price,
          approach,
          reactionWindowMinutes * 60_000,
        );
        touches.push({
          episodeId: episode.id,
          timestamp: candle.timestamp,
          rank: episode.rank,
          sourceStrike: episode.sourceStrike,
          line,
          offset,
          price,
          approach,
          exactExtremeTouch,
          ambiguousIntrabar: crossed.length > 1,
          favorableExcursion: excursion.favorable,
          adverseExcursion: excursion.adverse,
          closeAfterWindow: excursion.close,
          cleanReaction: excursion.favorable >= reactionThreshold && excursion.adverse <= adverseTolerance,
        });
        touchedOffsets.add(offset);
      }
    }
  }

  const summaries = lines.map(({ line, offset }) => {
    const matching = touches.filter((touch) => touch.offset === offset && !touch.ambiguousIntrabar);
    const exact = matching.filter((touch) => touch.exactExtremeTouch).length;
    const clean = matching.filter((touch) => touch.cleanReaction).length;
    return {
      line,
      offset,
      touches: matching.length,
      exactExtremeTouches: exact,
      exactExtremeRate: matching.length ? exact / matching.length : null,
      cleanReactions: clean,
      cleanReactionRate: matching.length ? clean / matching.length : null,
      medianFavorableExcursion: median(matching.map((touch) => touch.favorableExcursion)),
      medianAdverseExcursion: median(matching.map((touch) => touch.adverseExcursion)),
    };
  });

  return {
    root: args.root,
    zoneHalfWidth,
    reactionWindowMinutes,
    reactionThreshold,
    adverseTolerance,
    samples: args.samples.length,
    episodes: episodes.length,
    touches,
    summaries,
  };
}
