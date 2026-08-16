export type ChartIntervalKind =
  | "second"
  | "minute"
  | "time"
  | "volume-bars"
  | "range"
  | "volume"
  | "trade"
  | "renko"
  | "point-figure"
  | "delta";

export type ChartIntervalOption = {
  id: string;
  label: string;
  kind: ChartIntervalKind;
  value: number;
  secondaryValue?: number;
  futuresOnly?: boolean;
  requiresOrderFlow?: boolean;
};

export type ChartIntervalGroup = {
  kind: ChartIntervalKind;
  label: string;
  suffix: string;
  defaults: number[];
  secondaryDefault?: number;
  options: ChartIntervalOption[];
};

const timeOption = (id: string, label: string, kind: "second" | "minute" | "time", value: number): ChartIntervalOption => ({
  id,
  label,
  kind,
  value,
});

const eventOption = (
  id: string,
  label: string,
  kind: Exclude<ChartIntervalKind, "second" | "minute" | "time">,
  value: number,
  secondaryValue?: number,
): ChartIntervalOption => ({
  id,
  label,
  kind,
  value,
  secondaryValue,
  futuresOnly: true,
  requiresOrderFlow: kind === "delta",
});

export const CHART_INTERVAL_GROUPS: ChartIntervalGroup[] = [
  {
    kind: "second",
    label: "Second",
    suffix: "s",
    defaults: [1, 5, 15, 30, 45],
    options: [
      timeOption("1s", "1 s", "second", 1),
      timeOption("5s", "5 s", "second", 5),
      timeOption("15s", "15 s", "second", 15),
      timeOption("30s", "30 s", "second", 30),
      timeOption("45s", "45 s", "second", 45),
    ],
  },
  {
    kind: "minute",
    label: "Minute",
    suffix: "m",
    defaults: [1, 2, 3, 5, 10, 15, 30, 45],
    options: [
      timeOption("1m", "1 m", "minute", 1),
      timeOption("2m", "2 m", "minute", 2),
      timeOption("3m", "3 m", "minute", 3),
      timeOption("5m", "5 m", "minute", 5),
      timeOption("10m", "10 m", "minute", 10),
      timeOption("15m", "15 m", "minute", 15),
      timeOption("30m", "30 m", "minute", 30),
      timeOption("45m", "45 m", "minute", 45),
      timeOption("1h", "1 h", "minute", 60),
      timeOption("2h", "2 h", "minute", 120),
      timeOption("4h", "4 h", "minute", 240),
    ],
  },
  {
    kind: "time",
    label: "Time",
    suffix: "",
    defaults: [1],
    options: [
      timeOption("1D", "1 D", "time", 1),
      timeOption("1W", "1 W", "time", 7),
      timeOption("1M", "1 M", "time", 30),
    ],
  },
  {
    kind: "volume-bars",
    label: "Vol Bars",
    suffix: "VB",
    defaults: [4, 12, 21, 54],
    secondaryDefault: 2,
    options: [
      eventOption("4/2VB", "4/2 VB", "volume-bars", 4, 2),
      eventOption("12/4VB", "12/4 VB", "volume-bars", 12, 4),
      eventOption("21/7VB", "21/7 VB", "volume-bars", 21, 7),
      eventOption("54/12VB", "54/12 VB", "volume-bars", 54, 12),
    ],
  },
  {
    kind: "range",
    label: "Range",
    suffix: "r",
    defaults: [4, 8, 12, 21, 40, 54],
    options: [4, 8, 12, 21, 40, 54].map((value) => eventOption(`${value}r`, `${value} r`, "range", value)),
  },
  {
    kind: "volume",
    label: "Volume",
    suffix: "v",
    defaults: [200, 500, 1000, 2000, 5000],
    options: [200, 500, 1000, 2000, 5000].map((value) => eventOption(`${value}v`, `${value} v`, "volume", value)),
  },
  {
    kind: "trade",
    label: "Trade",
    suffix: "t",
    defaults: [50, 100, 200, 500],
    options: [50, 100, 200, 500].map((value) => eventOption(`${value}t`, `${value} t`, "trade", value)),
  },
  {
    kind: "renko",
    label: "Renko",
    suffix: "R",
    defaults: [4, 8, 12, 21, 54],
    options: [4, 8, 12, 21, 54].map((value) => eventOption(`${value}R`, `${value} R`, "renko", value)),
  },
  {
    kind: "point-figure",
    label: "P/F",
    suffix: "PF",
    defaults: [1, 2, 5],
    secondaryDefault: 27,
    options: [
      eventOption("1/27PF", "1/27 PF", "point-figure", 1, 27),
      eventOption("2/54PF", "2/54 PF", "point-figure", 2, 54),
      eventOption("5/128PF", "5/128 PF", "point-figure", 5, 128),
    ],
  },
  {
    kind: "delta",
    label: "Delta",
    suffix: "dv",
    defaults: [50, 100, 200, 500],
    options: [50, 100, 200, 500].map((value) => eventOption(`${value}dv`, `${value} dv`, "delta", value)),
  },
];

export const CHART_INTERVAL_OPTIONS = CHART_INTERVAL_GROUPS.flatMap((group) => group.options);

export function getChartInterval(value: string): ChartIntervalOption | undefined {
  const configured = CHART_INTERVAL_OPTIONS.find((option) => option.id === value);
  if (configured) return configured;
  const paired = value.match(/^(\d+)\/(\d+)(VB|PF)$/);
  if (paired) {
    const kind = paired[3] === "VB" ? "volume-bars" : "point-figure";
    return eventOption(value, value.replace(/(VB|PF)$/, " $1"), kind, Number(paired[1]), Number(paired[2]));
  }
  const simple = value.match(/^(\d+)(s|m|h|D|W|M|r|v|t|R|dv)$/);
  if (!simple) return undefined;
  const suffix = simple[2];
  const kind: ChartIntervalKind =
    suffix === "s" ? "second"
      : suffix === "m" || suffix === "h" ? "minute"
        : suffix === "D" || suffix === "W" || suffix === "M" ? "time"
          : suffix === "r" ? "range"
            : suffix === "v" ? "volume"
              : suffix === "t" ? "trade"
                : suffix === "R" ? "renko"
                  : "delta";
  const label = `${simple[1]} ${suffix}`;
  return ["second", "minute", "time"].includes(kind)
    ? timeOption(value, label, kind as "second" | "minute" | "time", Number(simple[1]))
    : eventOption(value, label, kind as Exclude<ChartIntervalKind, "second" | "minute" | "time">, Number(simple[1]));
}

export function parseChartIntervalInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "");
  const paired = compact.match(/^(\d+)\/(\d+)(vb|volumebars?|pf|point(?:and)?figure)$/i);
  if (paired) {
    const suffix = /^(vb|volumebars?)$/i.test(paired[3]) ? "VB" : "PF";
    return `${Number(paired[1])}/${Number(paired[2])}${suffix}`;
  }

  const match = raw.match(/^(\d+)\s*([a-z/]+)?$/i);
  if (!match) return null;
  const value = Math.max(1, Number(match[1]));
  if (!Number.isFinite(value)) return null;
  const originalUnit = match[2] ?? "m";
  const unit = originalUnit.toLowerCase();

  if (originalUnit === "M" || /^(mo|mon|mons|month|months)$/.test(unit)) return `${value}M`;
  if (/^(s|sec|secs|second|seconds)$/.test(unit)) return `${value}s`;
  if (/^(m|min|mins|minute|minutes)$/.test(unit)) return `${value}m`;
  if (/^(h|hr|hrs|hour|hours)$/.test(unit)) return `${value}h`;
  if (/^(d|day|days)$/.test(unit)) return `${value}D`;
  if (/^(w|wk|wks|week|weeks)$/.test(unit)) return `${value}W`;
  if (/^(r|range|ranges)$/.test(unit)) return `${value}r`;
  if (originalUnit === "R" || /^(renko|renkos)$/.test(unit)) return `${value}R`;
  if (/^(v|vol|volume|volumes)$/.test(unit)) return `${value}v`;
  if (/^(t|tick|ticks|trade|trades)$/.test(unit)) return `${value}t`;
  if (/^(dv|delta|deltas)$/.test(unit)) return `${value}dv`;
  return null;
}

export function isEventBasedChartInterval(value: string) {
  const option = getChartInterval(value);
  return Boolean(option && !["second", "minute", "time"].includes(option.kind));
}

export function supportsChartInterval(value: string, broker: string) {
  const option = getChartInterval(value);
  if (!option) return false;
  if (broker === "Databento") return true;
  // Options underlyings and indices use Massive aggregates for real intraday
  // history. Event-built futures intervals remain intentionally unavailable.
  // VIX still has its official Cboe daily fallback when Massive is absent.
  if (broker === "Market Index") {
    const minuteMatch = value.match(/^(\d+)m$/);
    if (minuteMatch) {
      const minutes = Number(minuteMatch[1]);
      return Number.isInteger(minutes) && minutes >= 1 && minutes <= 240;
    }
    return ["1h", "2h", "4h", "1D", "1W", "1M"].includes(value);
  }
  if (broker === "OANDA") {
    return ["5s", "15s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "4h", "1D", "1W", "1M"].includes(value);
  }
  if (option.futuresOnly) return false;
  if (!CHART_INTERVAL_OPTIONS.some((configured) => configured.id === value)) return false;
  if (option.kind !== "second") return true;
  return false;
}

export function makeCustomChartInterval(kind: ChartIntervalKind, value: number, secondaryValue?: number) {
  const primary = Math.max(1, Math.round(value));
  const secondary = Math.max(1, Math.round(secondaryValue ?? 1));
  if (kind === "second") return `${primary}s`;
  if (kind === "minute") return `${primary}m`;
  if (kind === "time") return `${primary}D`;
  if (kind === "volume-bars") return `${primary}/${secondary}VB`;
  if (kind === "range") return `${primary}r`;
  if (kind === "volume") return `${primary}v`;
  if (kind === "trade") return `${primary}t`;
  if (kind === "renko") return `${primary}R`;
  if (kind === "point-figure") return `${primary}/${secondary}PF`;
  return `${primary}dv`;
}

export function formatChartInterval(value: string) {
  return getChartInterval(value)?.label ?? value.replace(/(VB|PF|dv|[smhDWrRvtM])$/u, " $1").replace(/\s+/g, " ").trim();
}
