export type LightweightSeriesDataPoint = Record<string, unknown>;

export interface LightweightSeriesDataSnapshot {
  length: number;
  fullHashA: number;
  fullHashB: number;
  prefixHashA: number;
  prefixHashB: number;
  lastTime: unknown;
  firstPointHashA: number;
  firstPointHashB: number;
  penultimatePointHashA: number;
  penultimatePointHashB: number;
  lastPointHashA: number;
  lastPointHashB: number;
  incrementalUpdates: number;
  syncHint?: "update-last" | "append";
}

export type LightweightSeriesDataSyncPlan = "none" | "update-last" | "append" | "replace";

const HASH_A_OFFSET = 0x811c9dc5;
const HASH_B_OFFSET = 0x9e3779b9;

function mixHashA(hash: number, value: number) {
  return Math.imul(hash ^ value, 0x01000193) >>> 0;
}

function mixHashB(hash: number, value: number) {
  hash = (hash + value + 0x7ed55d16 + (hash << 12)) >>> 0;
  hash = (hash ^ 0xc761c23c ^ (hash >>> 19)) >>> 0;
  return hash;
}

function hashText(hashA: number, hashB: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hashA = mixHashA(hashA, code);
    hashB = mixHashB(hashB, code);
  }
  return [mixHashA(hashA, 31), mixHashB(hashB, 31)] as const;
}

function stableScalar(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:NaN";
    if (!Number.isFinite(value)) return value > 0 ? "number:Infinity" : "number:-Infinity";
    return `number:${value}`;
  }
  if (typeof value === "string") return `string:${value}`;
  if (typeof value === "boolean") return value ? "boolean:1" : "boolean:0";
  if (typeof value === "bigint") return `bigint:${value.toString()}`;
  if (typeof value === "function") return `function:${value.toString()}`;
  return `other:${String(value)}`;
}

function hashPoint(hashA: number, hashB: number, point: LightweightSeriesDataPoint) {
  const keys = Object.keys(point).sort();
  for (const key of keys) {
    [hashA, hashB] = hashText(hashA, hashB, key);
    const value = point[key];
    if (Array.isArray(value)) {
      [hashA, hashB] = hashText(hashA, hashB, `[${value.map(stableScalar).join(",")}]`);
    } else if (value && typeof value === "object") {
      [hashA, hashB] = hashText(hashA, hashB, stableSeriesOptionsSignature(value));
    } else {
      [hashA, hashB] = hashText(hashA, hashB, stableScalar(value));
    }
  }
  return [mixHashA(hashA, 127), mixHashB(hashB, 127)] as const;
}

function pointFingerprint(point: LightweightSeriesDataPoint | undefined) {
  if (!point) return [0, 0] as const;
  return hashPoint(HASH_A_OFFSET, HASH_B_OFFSET, point);
}

export function buildLightweightSeriesDataSnapshot(
  points: LightweightSeriesDataPoint[],
  previous: LightweightSeriesDataSnapshot | null = null,
): LightweightSeriesDataSnapshot {
  const [firstPointHashA, firstPointHashB] = pointFingerprint(points[0]);
  const [penultimatePointHashA, penultimatePointHashB] = pointFingerprint(points.at(-2));
  const [lastPointHashA, lastPointHashB] = pointFingerprint(points.at(-1));
  const lastTime = points.at(-1)?.time;
  const canIncrement = previous && previous.incrementalUpdates < 128;
  const sameFirstPoint = Boolean(previous) && hashesEqual(
    previous!.firstPointHashA,
    previous!.firstPointHashB,
    firstPointHashA,
    firstPointHashB,
  );
  const penultimateMatchesPreviousLast = Boolean(previous) && hashesEqual(
    previous!.lastPointHashA,
    previous!.lastPointHashB,
    penultimatePointHashA,
    penultimatePointHashB,
  );
  const samePenultimatePoint = Boolean(previous) && hashesEqual(
    previous!.penultimatePointHashA,
    previous!.penultimatePointHashB,
    penultimatePointHashA,
    penultimatePointHashB,
  );
  const sameLastPoint = Boolean(previous) && hashesEqual(
    previous!.lastPointHashA,
    previous!.lastPointHashB,
    lastPointHashA,
    lastPointHashB,
  );

  if (
    canIncrement &&
    points.length === previous.length &&
    lastTime === previous.lastTime &&
    sameFirstPoint &&
    samePenultimatePoint &&
    sameLastPoint
  ) {
    return {
      ...previous,
      incrementalUpdates: previous.incrementalUpdates + 1,
      syncHint: undefined,
    };
  }

  if (
    canIncrement &&
    points.length === previous.length &&
    lastTime === previous.lastTime &&
    sameFirstPoint &&
    samePenultimatePoint
  ) {
    const [fullHashA, fullHashB] = hashPoint(
      previous.prefixHashA,
      previous.prefixHashB,
      points.at(-1) ?? {},
    );
    return {
      ...previous,
      fullHashA,
      fullHashB,
      lastTime,
      firstPointHashA,
      firstPointHashB,
      penultimatePointHashA,
      penultimatePointHashB,
      lastPointHashA,
      lastPointHashB,
      incrementalUpdates: previous.incrementalUpdates + 1,
      syncHint: "update-last",
    };
  }

  if (
    canIncrement &&
    points.length === previous.length + 1 &&
    sameFirstPoint &&
    penultimateMatchesPreviousLast
  ) {
    const [fullHashA, fullHashB] = hashPoint(
      previous.fullHashA,
      previous.fullHashB,
      points.at(-1) ?? {},
    );
    return {
      length: points.length,
      fullHashA,
      fullHashB,
      prefixHashA: previous.fullHashA,
      prefixHashB: previous.fullHashB,
      lastTime,
      firstPointHashA,
      firstPointHashB,
      penultimatePointHashA,
      penultimatePointHashB,
      lastPointHashA,
      lastPointHashB,
      incrementalUpdates: previous.incrementalUpdates + 1,
      syncHint: "append",
    };
  }

  // A bounded rolling window drops its oldest point as each new point arrives.
  // Lightweight Charts can append the new point cheaply; a complete replacement
  // every 128 updates trims the now-invisible tail and verifies the full history.
  if (
    canIncrement &&
    points.length === previous.length &&
    lastTime !== previous.lastTime &&
    penultimateMatchesPreviousLast
  ) {
    const [fullHashA, fullHashB] = hashPoint(
      previous.fullHashA,
      previous.fullHashB,
      points.at(-1) ?? {},
    );
    return {
      ...previous,
      fullHashA,
      fullHashB,
      lastTime,
      firstPointHashA,
      firstPointHashB,
      penultimatePointHashA,
      penultimatePointHashB,
      lastPointHashA,
      lastPointHashB,
      incrementalUpdates: previous.incrementalUpdates + 1,
      syncHint: "append",
    };
  }

  let hashA = HASH_A_OFFSET;
  let hashB = HASH_B_OFFSET;
  let prefixHashA = HASH_A_OFFSET;
  let prefixHashB = HASH_B_OFFSET;

  points.forEach((point, index) => {
    if (index === points.length - 1) {
      prefixHashA = hashA;
      prefixHashB = hashB;
    }
    [hashA, hashB] = hashPoint(hashA, hashB, point);
  });

  return {
    length: points.length,
    fullHashA: hashA,
    fullHashB: hashB,
    prefixHashA,
    prefixHashB,
    lastTime,
    firstPointHashA,
    firstPointHashB,
    penultimatePointHashA,
    penultimatePointHashB,
    lastPointHashA,
    lastPointHashB,
    incrementalUpdates: 0,
  };
}

function hashesEqual(
  leftA: number,
  leftB: number,
  rightA: number,
  rightB: number,
) {
  return leftA === rightA && leftB === rightB;
}

export function planLightweightSeriesDataSync(
  previous: LightweightSeriesDataSnapshot | null,
  next: LightweightSeriesDataSnapshot,
): LightweightSeriesDataSyncPlan {
  if (!previous) return "replace";
  if (next.syncHint) return next.syncHint;
  if (
    previous.length === next.length &&
    hashesEqual(previous.fullHashA, previous.fullHashB, next.fullHashA, next.fullHashB)
  ) {
    return "none";
  }
  if (
    previous.length === next.length &&
    previous.lastTime === next.lastTime &&
    hashesEqual(previous.prefixHashA, previous.prefixHashB, next.prefixHashA, next.prefixHashB)
  ) {
    return "update-last";
  }
  if (
    next.length === previous.length + 1 &&
    hashesEqual(previous.fullHashA, previous.fullHashB, next.prefixHashA, next.prefixHashB)
  ) {
    return "append";
  }
  return "replace";
}

export function stableSeriesOptionsSignature(value: unknown): string {
  if (value === null || typeof value !== "object") return stableScalar(value);
  if (Array.isArray(value)) return `[${value.map(stableSeriesOptionsSignature).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSeriesOptionsSignature(record[key])}`)
    .join(",")}}`;
}
