import {
  newYorkCashCloseIso,
  type NativeGammaRoot,
} from "@/lib/databentoGamma.server";
import { getChartGammaLevels } from "@/lib/quantData.server";
import type { ZeroGammaLinePayload, ZeroGammaLinePoint, ZeroGammaLineSource } from "@/lib/zeroGammaLine";

function previousTradingDay(sessionDate: string) {
  const value = new Date(`${sessionDate}T12:00:00.000Z`);
  do value.setUTCDate(value.getUTCDate() - 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

function currentNewYorkSessionDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  let value = `${parts.year}-${parts.month}-${parts.day}`;
  if (parts.weekday === "Sun") value = previousTradingDay(value);
  if (parts.weekday === "Sat") value = previousTradingDay(value);
  return value;
}

function newYorkMarketOpen(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return !["Sat", "Sun"].includes(String(parts.weekday)) && minutes >= 570 && minutes < 960;
}

function zeroGammaFromPayload(payload: Awaited<ReturnType<typeof getChartGammaLevels>>) {
  const source = payload.sources.find((candidate) => candidate.symbol === payload.requestedSource);
  return source?.cage?.flip
    ?? source?.levels.find((level) => level.kind === "ZERO_GAMMA")?.price
    ?? null;
}

export async function getZeroGammaLinePayload(
  root: NativeGammaRoot,
  sourceSymbol: ZeroGammaLineSource,
  displayInstrument: string,
  historySessions = 5,
): Promise<ZeroGammaLinePayload> {
  const now = new Date();
  const sessionDate = currentNewYorkSessionDate(now);
  const marketOpen = newYorkMarketOpen(now);
  const completedDates: string[] = [];
  let cursor = marketOpen ? previousTradingDay(sessionDate) : sessionDate;
  while (completedDates.length < Math.max(1, Math.min(5, Math.round(historySessions)))) {
    completedDates.unshift(cursor);
    cursor = previousTradingDay(cursor);
  }

  const historical = await Promise.all(completedDates.map(async (date): Promise<ZeroGammaLinePoint | null> => {
    try {
      const snapshot = await getChartGammaLevels(root, sourceSymbol, date);
      const zeroGamma = zeroGammaFromPayload(snapshot);
      if (zeroGamma === null) return null;
      return {
        timestampMs: Date.parse(newYorkCashCloseIso(snapshot.sessionDate)),
        sessionDate: snapshot.sessionDate,
        value: zeroGamma,
        status: "HISTORICAL",
      };
    } catch {
      return null;
    }
  }));

  const current = await getChartGammaLevels(root, sourceSymbol, sessionDate).catch(() => null);
  const points = historical.filter((point): point is ZeroGammaLinePoint => point !== null);
  const currentZeroGamma = current ? zeroGammaFromPayload(current) : null;
  if (current && currentZeroGamma !== null) {
    points.push({
      timestampMs: marketOpen ? now.getTime() : Date.parse(newYorkCashCloseIso(current.sessionDate)),
      sessionDate: current.sessionDate,
      value: currentZeroGamma,
      status: marketOpen ? "LIVE" : "EOD",
    });
  }

  const deduplicated = [...new Map(points.map((point) => [`${point.timestampMs}:${point.sessionDate}`, point])).values()]
    .sort((left, right) => left.timestampMs - right.timestampMs);
  if (!deduplicated.length) throw new Error(`No verified ${root} zero-Gamma snapshots are currently available.`);
  return {
    root,
    sourceSymbol,
    displayInstrument,
    asOf: now.toISOString(),
    status: marketOpen ? "LIVE" : "EOD",
    positiveAbove: current?.environment.gammaRegime === "POSITIVE"
      ? true
      : current?.environment.gammaRegime === "NEGATIVE"
        ? false
        : null,
    points: deduplicated,
    method: sourceSymbol === root ? "TRUE_OI_SCENARIO" : "OPTIONS_GAMMA_CROSSING",
    disclosure: "Zero Gamma is the verified aggregate dealer-Gamma sign crossing for the chart's own options family. Each observation paints forward from its timestamp like a running VWAP; completed-session values are never painted backward.",
  };
}
