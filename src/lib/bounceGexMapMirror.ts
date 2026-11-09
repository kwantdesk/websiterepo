import type { BounceExposureNode, BounceExposureSlice, BounceLevel, BounceLevelsSnapshot } from "@/lib/bounceLevels";
import { gexMapProviderTicker, selectGexMapStarNode, type GexMapPanelPayload } from "@/lib/gexMap";
import { buildGexMapSnapshots, gexMapPriceAt, gexMapSurfaceRows } from "@/lib/gexMapSnapshots";
import { deriveGexMapStarModel } from "@/lib/gexMapStar";
import { gexMapExposureRange, gexMapHeatColorHex, gexMapHeatStrength } from "@/lib/gexMapPalette";
import type { LinkedGexMapSettings } from "@/lib/gexMapLinkedSettings";
import type { StrikeMappingSnapshot } from "@/lib/netGammaExposureByStrike";
import { buildGammaHeatmapMapping, mapGammaHeatmapStrike, normalizeGammaHeatmapInstrument } from "@/lib/gammaHeatmap";
import type { ExposureStrike } from "@/lib/optionsFlow";
import { bounceGexMapHistoryParent } from "@/lib/bounceGexMapHistory";
import { newYorkSessionTimestamp } from "@/lib/gexVueReplay";

type MirrorFrame = { timestamp: number; sourceTimestamp?: number; slice: BounceExposureSlice; mapping: StrikeMappingSnapshot; airPockets: BounceLevelsSnapshot["airPockets"] };
export type PreparedBounceGexMirror = { payload: GexMapPanelPayload; frames: MirrorFrame[]; live: MirrorFrame | null; display: string; atClock: (timestamp: number) => MirrorFrame | null };
type RawHistory = { timestamp: number; rows: Map<number, ExposureStrike> }[];
const historyCache = new WeakMap<GexMapPanelPayload["frames"], { key: string; frames: MirrorFrame[]; rawHistory: RawHistory; mappingThrough: number }>();
export function prepareBounceGexMirror(input: {
  payload: GexMapPanelPayload; settings: LinkedGexMapSettings; displayInstrument: string;
  displayPriceAt: (timestamp: number) => number | null; liveDisplayPrice: number | null; colorScale: string[];
  liveReference?: GexMapPanelPayload; historyKey?: string;
  mappingThrough?: number;
}): PreparedBounceGexMirror {
  const { payload, settings, colorScale } = input;
  const display = /^(M2K|RTY)/.exec(input.displayInstrument.toUpperCase())?.[1] ?? normalizeGammaHeatmapInstrument(input.displayInstrument), source = gexMapProviderTicker(payload.symbol);
  const direct = gexMapProviderTicker(display) === source;
  const futuresFamily = /^(NQ|MNQ)$/.test(display) ? ["NDX", "QQQ"]
    : /^(ES|MES)$/.test(display) ? ["SPX", "SPY"]
    : /^(RTY|M2K)$/.test(display) ? ["IWM"] : null;
  const crossFamily = !direct && futuresFamily !== null && !futuresFamily.includes(source);
  const cashClose = newYorkSessionTimestamp(payload.sessionDate, 16 * 60);
  // displayPriceAt supplies the containing minute's OPEN. Pair it with the
  // source OPEN, not that minute's final close (which creates a return-sized
  // sawtooth in every projected strike and leaks future prices into replay).
  const pairedPricesAt = (timestamp: number, reference = payload) => {
    let low = 0, high = reference.candles.length;
    while (low < high) { const mid = (low + high) >>> 1; if (reference.candles[mid].timestamp <= timestamp) low = mid + 1; else high = mid; }
    const candle = reference.candles[low - 1];
    if (candle && timestamp < candle.timestamp + 60_000) {
      const sourcePrice = candle.open, displayPrice = input.displayPriceAt(candle.timestamp);
      if (sourcePrice > 0 && displayPrice && displayPrice > 0) return { sourcePrice, displayPrice, timestamp: candle.timestamp };
    }
    // Exposure can finish at 16:15 while the underlying price series ends at
    // 16:00. Keep that closing ladder calibrated to a real, simultaneous pair
    // of recorded opens. Never pair it with today's futures price, carry an
    // intraday gap, or borrow a future minute during replay.
    if (reference.sessionDate !== payload.sessionDate || timestamp < cashClose || timestamp >= cashClose + 16 * 60_000) return null;
    for (let i = low - 1; i >= 0; i--) {
      const candidate = reference.candles[i];
      if (candidate.timestamp < cashClose - 60_000) break;
      if (candidate.timestamp > cashClose) continue;
      const displayPrice = input.displayPriceAt(candidate.timestamp);
      if (candidate.open > 0 && displayPrice && displayPrice > 0) return { sourcePrice: candidate.open, displayPrice, timestamp: candidate.timestamp };
    }
    return null;
  };
  // Independent index returns move the entire ladder when every strike
  // is repriced at the current ratio. Cross-family projections instead
  // use the first matched minute opens from the session history.
  let sessionAnchor: { timestamp: number; scale: number } | null = null;
  if (crossFamily && !payload.compact && !payload.historyPending) {
    for (const candle of payload.candles) {
      if (!Number.isFinite(candle.open) || candle.open <= 0) continue;
      const targetOpen = input.displayPriceAt(candle.timestamp);
      if (targetOpen === null || !Number.isFinite(targetOpen) || targetOpen <= 0) continue;
      sessionAnchor = { timestamp: candle.timestamp, scale: targetOpen / candle.open };
      break;
    }
  }
  const frame = (timestamp: number, current: ReadonlyMap<number, ExposureStrike>, previous: ReadonlyMap<number, ExposureStrike>, spot: number | null, live = false): MirrorFrame | null => {
    if (crossFamily && (!sessionAnchor || timestamp < sessionAnchor.timestamp)) return null;
    const rows = gexMapSurfaceRows(current);
    const exposureRange = gexMapExposureRange(rows.map((row) => row.net));
    // Compact live candles can lead the session archive. Both sides must still
    // come from the same minute OPEN; a current futures close paired with an
    // older options spot creates a false ramp at the ribbon's live edge.
    const pair = direct ? null : (live && input.liveReference ? pairedPricesAt(timestamp, input.liveReference) : null) ?? pairedPricesAt(timestamp);
    const displayPrice = direct ? spot ?? (live ? input.liveDisplayPrice : input.displayPriceAt(timestamp)) : pair?.displayPrice;
    if (!(displayPrice && displayPrice > 0) || (!direct && !(spot && spot > 0))) return null;
    const sourcePrice = spot ?? displayPrice;
    const mappingSourcePrice = pair?.sourcePrice ?? sourcePrice;
    const liveMapping = buildGammaHeatmapMapping({ sourceInstrument: source, displayInstrument: direct ? source : display,
      sourcePrice: mappingSourcePrice, displayPrice, asOf: new Date(timestamp).toISOString() });
    const mapped = sessionAnchor ? { ...liveMapping, scale: sessionAnchor.scale, basis: 0 } : liveMapping;
    const mapping: StrikeMappingSnapshot = {
      method: sessionAnchor ? "session-anchored-ratio" : mapped.method === "direct" ? "same-underlying-direct" : mapped.method === "live-basis" ? "spot-futures-basis" : "live-ratio",
      sourceTicker: source, displayInstrument: display, alpha: mapped.basis, beta: mapped.scale,
      sourceSpotPrice: mappingSourcePrice, displayMidPrice: displayPrice, mappedSourceSpotPrice: mapGammaHeatmapStrike(mappingSourcePrice, mapped),
      mappingConfidence: mapped.confidence * 100,
      calculatedAtMs: sessionAnchor?.timestamp ?? pair?.timestamp ?? timestamp,
      dataAgeMs: timestamp - (sessionAnchor?.timestamp ?? pair?.timestamp ?? timestamp),
    };
    const model = deriveGexMapStarModel({ rows, previous, spot, settings: settings.starSettings });
    const star = selectGexMapStarNode(rows), maximum = Math.abs(star?.net ?? 0), max = Math.max(1, maximum);
    const derived = new Map(model.rows.map((r) => [r.strike, r]));
    const nearSpot = spot === null || !rows.length ? null : rows.reduce((best, r) => Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best).strike;
    const total = rows.reduce((sum, r) => sum + Math.abs(r.net), 0);
    const levels: BounceLevel[] = rows.map((row): BounceLevel => {
      const d = derived.get(row.strike), roles = d?.roles ?? [];
      const role = row.strike === star?.strike ? "KING" : roles.includes("floor") ? "FLOOR" : roles.includes("ceiling") ? "CEILING" : roles.includes("gatekeeper") ? "GATEKEEPER" : "MAJOR";
      const before = previous.get(row.strike)?.net;
      const roc = before !== undefined && before !== 0 ? (Math.abs(row.net) - Math.abs(before)) / Math.abs(before) * 100 : 0;
      return {
        id: source + ":" + payload.greekMode + ":" + row.strike, role, sourceStrike: row.strike,
        mapRoleLabel: (settings.viewMode === "star" && row.strike === star?.strike
          ? ["star", ...roles.filter((r) => r !== "star" && r !== "normal")] : roles.filter((r) => r !== "normal")).map((r) => r.toUpperCase()).join(" / ") || "NODE",
        mappedPrice: direct ? row.strike : mapGammaHeatmapStrike(row.strike, mapped),
        signedExposure: row.net, absoluteExposure: Math.abs(row.net), callExposure: row.call, putExposure: row.put,
        magnitudePercentile: 0, magnitudeScore: max ? Math.abs(row.net) / max * 100 : 0,
        percentOfKing: max ? Math.abs(row.net) / max * 100 : 0, distancePoints: Math.abs(row.strike - sourcePrice),
        distancePercent: Math.abs(row.strike - sourcePrice) / sourcePrice * 100,
        rateOfChangeAbsolute: before === undefined ? 0 : row.net - before, rateOfChangePercent: roc,
        shortRateOfChange: roc, mediumRateOfChange: 0, longRateOfChange: 0, accumulationScore: 0,
        persistenceScore: 0, persistenceSnapshots: 1, freshnessScore: 100, clusterScore: 0,
        relevanceScore: (d?.importanceScore ?? 0) * 100, dataQuality: mapping.mappingConfidence, momentum: roc, touches: 0,
        isClusterMember: false, snapshotTimeMs: timestamp,
        explanation: "Exact GEX Map strike and signed exposure; structural role, not a guaranteed price reaction.",
      };
    }).sort((a, b) => a.mappedPrice - b.mappedPrice);
    const nodes: BounceExposureNode[] = levels.map((level) => {
      const d = derived.get(level.sourceStrike);
      const highlighted = settings.viewMode === "full" || (settings.viewMode === "star" ? level.sourceStrike === star?.strike : d?.isHighlighted === true);
      const ratio = max ? level.absoluteExposure / max : 0;
      return {
        id: level.id + ":" + timestamp, nodeKey: level.id, timestamp, sourceStrike: level.sourceStrike, mappedPrice: level.mappedPrice,
        signedExposure: level.signedExposure, absoluteExposure: level.absoluteExposure, callExposure: level.callExposure, putExposure: level.putExposure,
        strength: ratio, percentOfKing: level.percentOfKing / 100, normalizedAbsoluteMagnitude: ratio, visualStrength: ratio,
        bucketShare: total ? level.absoluteExposure / total : 0, rateOfChangePercent: level.rateOfChangePercent,
        shortRateOfChange: level.shortRateOfChange, oneMinuteRateOfChange: level.shortRateOfChange, fiveMinuteRateOfChange: 0,
        fifteenMinuteRateOfChange: 0, rollWindowRateOfChange: 0, active: true, retirementCount: 0,
        mapColor: gexMapHeatColorHex(gexMapHeatStrength(level.signedExposure, exposureRange), colorScale),
        mapOpacity: highlighted || level.sourceStrike === nearSpot ? 1 : Math.max(.02, settings.starSettings.dimOpacity),
        mapHighlighted: highlighted,
        mapRoleLabel: level.mapRoleLabel,
        mapImportanceScore: level.relevanceScore, mapExposureChange: level.rateOfChangeAbsolute,
      };
    });
    return { timestamp, mapping,
      slice: { timestamp, sourcePrice: spot, mappedSourcePrice: mapping.mappedSourceSpotPrice, maximumAbsoluteExposure: maximum, totalAbsoluteExposure: total, kingStrike: star?.strike ?? null, nodes },
      airPockets: model.airPockets.map((p) => ({ id: source + ":" + p.fromStrike + ":" + p.toStrike,
        lowerPrice: direct ? p.fromStrike : mapGammaHeatmapStrike(p.fromStrike, mapped),
        upperPrice: direct ? p.toStrike : mapGammaHeatmapStrike(p.toStrike, mapped), magnitudeRatio: p.combinedControlPct / 100 })),
    };
  };
  const independentHistory = direct && payload.candles.length > 0 && payload.candles[0].timestamp <= (payload.frames[0]?.timestamp ?? Infinity);
  const cacheKey = JSON.stringify([payload.symbol, payload.greekMode, payload.model, payload.scope, payload.representation, payload.sessionDate,
    settings.viewMode, settings.stepMinutes, settings.starSettings, display, colorScale, sessionAnchor, independentHistory ? "" : input.historyKey,
    direct ? "" : payload.candles.map((c) => `${c.timestamp}:${c.open}`).join("|")]);
  const cached = historyCache.get(payload.frames);
  const through = independentHistory ? Infinity : input.mappingThrough ?? Infinity;
  const reused = cached?.key === cacheKey && cached.mappingThrough === through;
  const lineage = bounceGexMapHistoryParent(payload.frames), parentFrames = lineage?.frames.deref();
  const parent = cached?.key === cacheKey && cached.mappingThrough < through ? cached : !reused && parentFrames ? historyCache.get(parentFrames) : undefined;
  const mappingPrefix = parent ? parent.rawHistory.findIndex((f) => f.timestamp > parent.mappingThrough) : 0;
  const prefix = parent?.key === cacheKey ? Math.min(parent === cached ? payload.frames.length : lineage!.dirtyFrom, mappingPrefix < 0 ? parent.rawHistory.length : mappingPrefix) : 0;
  const rawHistory: RawHistory = reused ? cached.rawHistory : prefix ? parent!.rawHistory.slice(0, prefix) : [];
  const frames: MirrorFrame[] = reused ? cached.frames : prefix ? parent!.frames.filter((f) => f.timestamp < (payload.frames[prefix]?.timestamp ?? Infinity)) : [];
  const current = new Map<number, ExposureStrike>(rawHistory.at(-1)?.rows ?? []);
  let previousIndex = -1;
  if (!reused) for (let index = prefix; index < payload.frames.length; index++) {
    const bucket = payload.frames[index];
    for (const row of bucket.updates) current.set(row.strike, row);
    const target = bucket.timestamp - settings.stepMinutes * 60000;
    while (previousIndex + 1 < rawHistory.length && rawHistory[previousIndex + 1].timestamp <= target) previousIndex++;
    const result = frame(bucket.timestamp, current, previousIndex >= 0 ? rawHistory[previousIndex].rows : new Map(), gexMapPriceAt(payload, bucket.timestamp));
    if (result) frames.push(result);
    rawHistory.push({ timestamp: bucket.timestamp, rows: new Map(current) });
  }
  if (!reused) historyCache.set(payload.frames, { key: cacheKey, frames, rawHistory, mappingThrough: through });
  // Live Map deliberately prefers latestStrikes over interval frames. Never do
  // that in replay: its latest ladder can be later than the selected clock.
  const livePayload = input.liveReference ?? payload;
  const head = buildGexMapSnapshots(livePayload, null, settings.stepMinutes);
  const liveTimestamp = Math.max(Date.parse(livePayload.asOf) || 0, livePayload.frames.at(-1)?.timestamp ?? 0);
  // Retain the last verified frame while the paired minute is arriving. Never
  // relabel old exposure as fresh or append an uncalibrated live point.
  const live = frame(liveTimestamp, head.current, head.previous, livePayload.stockPrice, true)
    ?? [...frames].reverse().find((candidate) => candidate.timestamp <= liveTimestamp) ?? null;
  const indexAt = (timestamp: number) => {
    let low = 0, high = rawHistory.length;
    while (low < high) { const mid = (low + high) >>> 1; if (rawHistory[mid].timestamp <= timestamp) low = mid + 1; else high = mid; }
    return low - 1;
  };
  const atClock = (timestamp: number) => {
    const index = indexAt(timestamp); if (index < 0) return null;
    const raw = rawHistory[index], previousIndex = indexAt(timestamp - settings.stepMinutes * 60000);
    const spot = gexMapPriceAt(payload, timestamp), known = frames.find((f) => f.timestamp === raw.timestamp);
    const displayPrice = direct ? spot ?? input.displayPriceAt(timestamp) : input.displayPriceAt(timestamp);
    if (known && previousIndex === indexAt(raw.timestamp - settings.stepMinutes * 60000)
      && spot === known.slice.sourcePrice && displayPrice === known.mapping.displayMidPrice) return known;
    // A clock can advance past the last exposure frame while quote candles
    // and the comparison window advance. Reclassify the same known ladder,
    // exactly as Map does, without ever borrowing latestStrikes from the future.
    const derived = frame(timestamp, raw.rows, previousIndex >= 0 ? rawHistory[previousIndex].rows : new Map(), spot);
    if (derived) derived.sourceTimestamp = raw.timestamp;
    return derived;
  };
  return { payload, frames, live, display, atClock };
}

export function selectBounceGexMirror(prepared: PreparedBounceGexMirror, timestampMs: number | null): BounceLevelsSnapshot | null {
  const historical = timestampMs !== null;
  let low = 0, high = prepared.frames.length;
  const cutoff = timestampMs ?? Infinity;
  while (low < high) { const mid = (low + high) >>> 1; if (prepared.frames[mid].timestamp <= cutoff) low = mid + 1; else high = mid; }
  const frame = historical ? prepared.atClock(timestampMs) : prepared.live;
  if (!frame) return null;
  const slices = prepared.frames.slice(0, low).map((f) => f.slice);
  if (historical && slices.at(-1)?.timestamp !== frame.timestamp) slices.push(frame.slice);
  if (!historical && slices.at(-1)?.timestamp === frame.timestamp) slices[slices.length - 1] = frame.slice;
  else if (!historical) slices.push(frame.slice);
  const payload = prepared.payload, levels = frame.slice.nodes.map((n): BounceLevel => ({
    id: n.nodeKey, sourceStrike: n.sourceStrike, mappedPrice: n.mappedPrice, mapRoleLabel: n.mapRoleLabel,
    role: n.sourceStrike === frame.slice.kingStrike ? "KING" : n.mapRoleLabel?.includes("FLOOR") ? "FLOOR" : n.mapRoleLabel?.includes("CEILING") ? "CEILING" : n.mapRoleLabel?.includes("GATEKEEPER") ? "GATEKEEPER" : "MAJOR",
    signedExposure: n.signedExposure, absoluteExposure: n.absoluteExposure, callExposure: n.callExposure, putExposure: n.putExposure,
    magnitudePercentile: 0, magnitudeScore: n.percentOfKing * 100, percentOfKing: n.percentOfKing * 100,
    distancePoints: Math.abs(n.sourceStrike - frame.mapping.sourceSpotPrice),
    distancePercent: Math.abs(n.sourceStrike - frame.mapping.sourceSpotPrice) / frame.mapping.sourceSpotPrice * 100,
    rateOfChangeAbsolute: n.mapExposureChange ?? 0, rateOfChangePercent: n.rateOfChangePercent, shortRateOfChange: n.shortRateOfChange,
    mediumRateOfChange: 0, longRateOfChange: 0, accumulationScore: 0, persistenceScore: 0, persistenceSnapshots: 1,
    freshnessScore: 100, clusterScore: 0, relevanceScore: n.mapImportanceScore ?? 0, dataQuality: frame.mapping.mappingConfidence,
    momentum: n.rateOfChangePercent, touches: 0, isClusterMember: false, snapshotTimeMs: frame.timestamp,
    explanation: "Exact GEX Map strike and signed exposure; structural role, not a guaranteed price reaction.",
  }));
  return {
    schemaVersion: 3, mirrorGexMap: true, sourceModel: payload.model,
    id: "gex-map-mirror:" + payload.symbol + ":" + payload.greekMode + ":" + payload.model + ":" + payload.scope + ":" + payload.representation + ":" + frame.timestamp,
    sourceTicker: gexMapProviderTicker(payload.symbol), displayInstrument: prepared.display, displayPrice: frame.mapping.displayMidPrice,
    greekMode: payload.greekMode, status: payload.status === "LIVE" ? "live" : payload.status === "DELAYED" ? "delayed" : "prior-session",
    snapshotTimeMs: frame.timestamp, sourceSnapshotTimeMs: frame.sourceTimestamp ?? frame.timestamp, receivedTimeMs: Date.parse(payload.asOf), refreshAfterMs: payload.refreshAfterMs,
    expirationLabel: payload.scope === "FRONT_EXPIRY" ? "Front / 0DTE" : "All expiries",
    representation: payload.representation === "PER_ONE_DOLLAR_MOVE" ? "per-one-dollar-move" : "per-one-percent-move",
    mapping: frame.mapping, exposureField: slices, exposureSeries: [], exposureRefreshIntervalMs: 60000,
    visualStrengthBasis: "percent-of-king", rolls: [], levels,
    king: levels.find((l) => l.sourceStrike === frame.slice.kingStrike) ?? null,
    floor: levels.find((l) => l.mapRoleLabel?.includes("FLOOR")) ?? null,
    ceiling: levels.find((l) => l.mapRoleLabel?.includes("CEILING")) ?? null, gatekeepers: levels.filter((l) => l.mapRoleLabel?.includes("GATEKEEPER")),
    airPockets: frame.airPockets, mapSignature: levels.map((l) => l.sourceStrike + ":" + l.signedExposure).join("|"),
    limitations: ["Levels mirror the selected GEX Map measurement. Floors and ceilings are structural classifications, not guaranteed support or resistance.",
      ...(frame.mapping.method === "session-anchored-ratio"
        ? ["Cross-family strikes use the first matched minute opens as a fixed session reference. Intraday relative price drift is possible."]
        : frame.mapping.method === "same-underlying-direct" ? [] : ["Cross-instrument prices are mapped projections; source strike and exposure remain unchanged."])],
  };
}
