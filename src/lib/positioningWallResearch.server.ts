import { getDatabentoBars } from "@/lib/databento";
import { getHistoricalPositioningWallFrames } from "@/lib/quantData.server";
import {
  analyzePositioningWallTouches,
  reconstructPositioningWallSamples,
  type PositioningWallResearchRoot,
} from "@/lib/positioningWallResearch";

const DAY_MS = 24 * 60 * 60_000;

function validSessionDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

export async function runHistoricalPositioningWallStudy(args: {
  root: PositioningWallResearchRoot;
  sessionDate: string;
  source?: string;
  ranks?: number;
  reactionWindowMinutes?: number;
}) {
  if (!validSessionDate(args.sessionDate)) throw new Error("A valid historical session date is required.");
  const root = args.root;
  const source = (args.source || (root === "NQ" ? "QQQ" : "SPY")).trim().toUpperCase();
  const compatible = root === "NQ" ? new Set(["QQQ", "NDX"]) : new Set(["SPY", "SPX", "SPXW"]);
  if (!compatible.has(source)) throw new Error(`${source} cannot be used to reconstruct ${root} positioning walls.`);

  const positioning = await getHistoricalPositioningWallFrames(source, args.sessionDate);
  const firstTimestamp = Math.min(
    positioning.gammaFrames[0]?.timestamp ?? Infinity,
    positioning.candles[0]?.timestamp ?? Infinity,
  );
  const lastTimestamp = Math.max(
    positioning.gammaFrames.at(-1)?.timestamp ?? 0,
    positioning.candles.at(-1)?.timestamp ?? 0,
  );
  if (!Number.isFinite(firstTimestamp) || !lastTimestamp) {
    throw new Error(`No archived ${source} positioning frames are available for ${args.sessionDate}.`);
  }

  const futuresStart = new Date(firstTimestamp - 60 * 60_000).toISOString();
  const futuresEnd = new Date(Math.min(Date.now(), lastTimestamp + DAY_MS)).toISOString();
  const futuresCandles = await getDatabentoBars(`${root}.v.0`, "1m", futuresStart, futuresEnd);
  if (!futuresCandles.length) throw new Error(`No historical ${root} futures candles are available for this study.`);

  const samples = reconstructPositioningWallSamples({
    gammaFrames: positioning.gammaFrames,
    deltaFrames: positioning.deltaFrames,
    sourceCandles: positioning.candles,
    futuresCandles,
    limit: args.ranks,
  });
  const study = analyzePositioningWallTouches({
    root,
    samples,
    futuresCandles,
    reactionWindowMinutes: args.reactionWindowMinutes,
  });

  return {
    sessionDate: args.sessionDate,
    source,
    optionsScope: positioning.scope,
    fallbackReason: positioning.fallbackReason,
    optionsFrameCount: positioning.gammaFrames.length,
    deltaFrameCount: positioning.deltaFrames.length,
    futuresCandleCount: futuresCandles.length,
    pointInTimePolicy: "Each wall uses the most recent Gamma, Delta, cash-price and futures-price observations at or before its timestamp. Reactions use later futures candles only.",
    caveats: [
      "The wall midpoint is the cash options strike translated with the contemporaneous futures/cash basis and rounded to the CME tick.",
      "The top and bottom are tested as fixed offsets from that midpoint, alongside nearby control offsets.",
      "Touches crossing multiple candidate lines inside one one-minute candle are marked ambiguous and excluded from headline rates.",
    ],
    ...study,
  };
}
