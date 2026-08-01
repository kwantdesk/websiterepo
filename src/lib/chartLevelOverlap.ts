export type MergeableChartLevel = {
  id: string;
  price: number;
  color: string;
  label: string;
  lineStyle?: "solid" | "dashed" | "dotted";
  lineWidth?: 1 | 2 | 3 | 4;
  axisLabelVisible?: boolean;
};

type LevelLayer = "foreground" | "background";

type LayeredLevel<T extends MergeableChartLevel> = {
  level: T;
  layer: LevelLayer;
  order: number;
};

const REFERENCE_LABELS: Array<[RegExp, string]> = [
  [/\bPD VAH\b/gi, "Previous Day Value Area High"],
  [/\bPD VAL\b/gi, "Previous Day Value Area Low"],
  [/\bPD POC\b/gi, "Previous Day Point of Control"],
  [/\bPD VWAP\b/gi, "Previous Day Volume-Weighted Average Price"],
  [/\bPW VAH\b/gi, "Previous Week Value Area High"],
  [/\bPW VAL\b/gi, "Previous Week Value Area Low"],
  [/\bPW POC\b/gi, "Previous Week Point of Control"],
  [/\bPW VWAP\b/gi, "Previous Week Volume-Weighted Average Price"],
  [/\bHVL\b/gi, "High Volatility Level"],
  [/\bMPO\b/gi, "Major Positive Open Interest"],
  [/\bMPV\b/gi, "Major Positive Volume"],
];

function readableLevelLabel(label: string) {
  return REFERENCE_LABELS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    label.trim(),
  ).replace(/\s+/g, " ");
}

function labelParts(label: string) {
  return label
    .split(/\s+(?:\/|\+)\s+/)
    .map(readableLevelLabel)
    .filter(Boolean);
}

function combinedLabel<T extends MergeableChartLevel>(group: LayeredLevel<T>[]) {
  const labels = new Map<string, string>();
  for (const entry of group) {
    for (const label of labelParts(entry.level.label)) {
      const key = label.toLocaleLowerCase("en-US");
      if (!labels.has(key)) labels.set(key, label);
    }
  }
  return [...labels.values()].join(" + ");
}

function lineStyleStrength(style: MergeableChartLevel["lineStyle"]) {
  if (style === "solid") return 3;
  if (style === "dashed") return 2;
  return 1;
}

/**
 * Resolves every visible chart-level family against the instrument's tradable
 * tick grid. A price can only render one named reference: matching Gamma,
 * Gameplan, value-area and future structure levels are collapsed into a single
 * readable label, then separate automatically as soon as their prices diverge.
 *
 * Any group containing an underlay level stays in the underlay so candles remain
 * visually above Gameplan lines and zones.
 */
export function resolveChartLevelOverlaps<T extends MergeableChartLevel>(
  foreground: T[],
  background: T[],
  tickSize = 0.25,
) {
  const safeTick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.25;
  const groups = new Map<number, LayeredLevel<T>[]>();
  const entries: LayeredLevel<T>[] = [
    ...foreground.map((level, order) => ({ level, layer: "foreground" as const, order })),
    ...background.map((level, order) => ({ level, layer: "background" as const, order: foreground.length + order })),
  ];

  for (const entry of entries) {
    if (!Number.isFinite(entry.level.price)) continue;
    const tick = Math.round(entry.level.price / safeTick);
    const group = groups.get(tick) ?? [];
    group.push(entry);
    groups.set(tick, group);
  }

  const resolvedForeground: T[] = [];
  const resolvedBackground: T[] = [];
  for (const [tick, group] of groups) {
    const ranked = [...group].sort((left, right) =>
      (right.level.lineWidth ?? 1) - (left.level.lineWidth ?? 1)
      || lineStyleStrength(right.level.lineStyle) - lineStyleStrength(left.level.lineStyle)
      || left.order - right.order);
    const representative = ranked[0].level;
    const layer: LevelLayer = group.some((entry) => entry.layer === "background")
      ? "background"
      : "foreground";
    const level = {
      ...representative,
      id: group.length === 1
        ? representative.id
        : `combined-${group.map((entry) => entry.level.id).sort().join("--")}`,
      price: tick * safeTick,
      label: combinedLabel(group),
      lineWidth: Math.max(...group.map((entry) => entry.level.lineWidth ?? 1)) as 1 | 2 | 3 | 4,
      lineStyle: ranked[0].level.lineStyle,
      axisLabelVisible: group.some((entry) => entry.level.axisLabelVisible !== false),
    } as T;

    if (layer === "background") resolvedBackground.push(level);
    else resolvedForeground.push(level);
  }

  return {
    foreground: resolvedForeground,
    background: resolvedBackground,
  };
}
