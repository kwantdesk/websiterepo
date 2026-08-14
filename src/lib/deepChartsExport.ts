import { normalizeLevelExportColor } from "@/lib/levelExportColors";

export type DeepChartsLevelInput = {
  levelType: "Gamma Levels" | "Kwant Levels" | "Value Area Levels" | "Historical Supply/Demand + S/R";
  instrument: string;
  contractSymbol: string;
  id: string;
  name: string;
  role: string;
  price: number;
  zoneLow: number;
  zoneHigh: number;
  color: string;
  lineStyle: string;
  lineWidth: number;
};

export type DeepChartsAnnotation = {
  AnnType: 19;
  alert: null;
  SymbName: string;
  Name: string;
  FontSize: 11;
  CAIndex: 0;
  X1SizeUnit: 0;
  X1SizeValue: number;
  DTX1: "0001-01-01T00:00:00";
  X2SizeUnit: 0;
  X2SizeValue: number;
  DTX2: "0001-01-01T00:00:00";
  X3SizeUnit: 0;
  X3SizeValue: number;
  DTX3: "0001-01-01T00:00:00";
  Y1: number;
  Y2: number;
  Y3: number;
  FreehandPoints: null;
  SlopeY2: 0;
  SlopeY3: 0;
  SourceTfInMs: 300000;
  IsExtended: true;
  IsLocked: false;
  Ann1: {
    Hidden: false;
    Style: {
      Color: string;
      LineWidth: number;
      LStyle: number;
    };
    Background: {
      Color: "#00000000";
      Opacity: 0;
    };
  };
  Ann2: null;
  TextMsg: string;
  TextPadding: 4;
  TextColor: string;
  ShowDifference: false;
  ShowPercent: false;
  ShowPrice: true;
  ShowLblBackground: true;
  LblBackground: {
    Color: "#E6111827";
    Opacity: 90;
  };
  IsExchDT: true;
  LabelAlign: 0;
  AnnParam: null;
  Money: null;
};

const MONTH_CODES = "FGHJKMNQUVXZ";

const ROOT_EXCHANGE: Record<string, string> = {
  ES: "CME",
  MES: "CME",
  NQ: "CME",
  MNQ: "CME",
  RTY: "CME",
  M2K: "CME",
  BTC: "CME",
  MBT: "CME",
  ETH: "CME",
  MET: "CME",
  "6A": "CME",
  "6B": "CME",
  "6C": "CME",
  "6E": "CME",
  "6J": "CME",
  "6N": "CME",
  "6S": "CME",
  YM: "CBOT",
  MYM: "CBOT",
  ZB: "CBOT",
  ZN: "CBOT",
  ZF: "CBOT",
  ZT: "CBOT",
  ZC: "CBOT",
  ZS: "CBOT",
  ZW: "CBOT",
  CL: "NYMEX",
  MCL: "NYMEX",
  NG: "NYMEX",
  RB: "NYMEX",
  HO: "NYMEX",
  GC: "COMEX",
  MGC: "COMEX",
  SI: "COMEX",
  SIL: "COMEX",
  HG: "COMEX",
};

function timeZoneOffsetMinutes(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour) % 24,
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((representedAsUtc - date.getTime()) / 60_000);
}

function deepChartsColor(value: string) {
  return `#FF${normalizeLevelExportColor(value).slice(1)}`;
}

function deepChartsLineStyle(value: string) {
  if (value === "dashed") return 1;
  if (value === "dotted") return 2;
  return 0;
}

function fourDigitContractYear(yearToken: string, now: Date) {
  if (yearToken.length >= 4) return Number(yearToken);
  const currentYear = now.getUTCFullYear();
  if (yearToken.length === 2) {
    const century = Math.floor(currentYear / 100) * 100;
    const candidate = century + Number(yearToken);
    return candidate < currentYear - 50 ? candidate + 100 : candidate;
  }
  const decade = Math.floor(currentYear / 10) * 10;
  let candidate = decade + Number(yearToken);
  if (candidate < currentYear - 3) candidate += 10;
  return candidate;
}

function deepChartsSymbol(level: DeepChartsLevelInput, now: Date) {
  const existing = level.contractSymbol.trim().toUpperCase();
  if (/^[A-Z0-9]+-\d{6}-[A-Z]+$/.test(existing)) return existing;

  const contractMatch = existing.match(/^([A-Z0-9]+)([FGHJKMNQUVXZ])(\d{1,4})$/);
  const root = (contractMatch?.[1] ?? level.instrument)
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
  const monthIndex = contractMatch ? MONTH_CODES.indexOf(contractMatch[2]) : -1;
  if (contractMatch && monthIndex >= 0) {
    const year = fourDigitContractYear(contractMatch[3], now);
    const month = String(monthIndex + 1).padStart(2, "0");
    return `${root}-${year}${month}-${ROOT_EXCHANGE[root] ?? "CME"}`;
  }

  return `${root}-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${ROOT_EXCHANGE[root] ?? "CME"}`;
}

function easternSessionAnchors(now: Date) {
  const easternParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(easternParts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month) - 1;
  const day = Number(values.day);
  const hour = Number(values.hour);
  const sessionDayUtc = Date.UTC(year, month, day + (hour < 18 ? -1 : 0));
  const sessionDay = new Date(sessionDayUtc);

  const asEasternEpoch = (date: Date, localHour: number) => {
    const utcGuess = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      localHour,
    );
    const offsetMinutes = timeZoneOffsetMinutes("America/New_York", new Date(utcGuess));
    return Math.floor((utcGuess - offsetMinutes * 60_000) / 1_000);
  };

  const start = asEasternEpoch(sessionDay, 18);
  const endDay = new Date(sessionDayUtc + 86_400_000);
  return {
    start,
    end: asEasternEpoch(endDay, 17),
  };
}

function cleanText(value: string) {
  return value
    .replace(/\u00c2\u00b7/g, " ·")
    .replace(/\s+/g, " ")
    .trim();
}

function annotationText(level: DeepChartsLevelInput) {
  const name = cleanText(level.name) || `${level.instrument} ${level.price}`;
  if (level.levelType === "Gamma Levels" || level.levelType === "Value Area Levels") return name;
  const zone = level.zoneLow === level.zoneHigh
    ? String(level.price)
    : `${level.zoneLow}-${level.zoneHigh}`;
  return `${name} · ${level.role.toUpperCase()} · ${zone}`;
}

export function buildDeepChartsAnnotations(
  levels: DeepChartsLevelInput[],
  exportedAt = new Date(),
): DeepChartsAnnotation[] {
  const anchors = easternSessionAnchors(exportedAt);
  const nameCounts = new Map<string, number>();
  const rows = levels.flatMap((level) => level.zoneLow !== level.zoneHigh
    ? [
        { ...level, id: `${level.id}:low`, name: `${level.name} LOW`, price: level.zoneLow, zoneHigh: level.zoneLow },
        { ...level, id: `${level.id}:high`, name: `${level.name} HIGH`, price: level.zoneHigh, zoneLow: level.zoneHigh },
      ]
    : [level]);

  return rows
    .filter((level) => Number.isFinite(level.price))
    .sort((left, right) =>
      left.instrument.localeCompare(right.instrument)
      || right.price - left.price)
    .map((level) => {
      const baseName = `KD_${level.instrument.replace(/[^A-Z0-9]/gi, "").toUpperCase()}_${Math.round(level.price)}`;
      const occurrence = (nameCounts.get(baseName) ?? 0) + 1;
      nameCounts.set(baseName, occurrence);
      const color = deepChartsColor(level.color);
      const lineWidth = Math.max(1, Math.min(4, Math.round(level.lineWidth || 1)));

      return {
        AnnType: 19,
        alert: null,
        SymbName: deepChartsSymbol(level, exportedAt),
        Name: occurrence === 1 ? baseName : `${baseName}_${occurrence}`,
        FontSize: 11,
        CAIndex: 0,
        X1SizeUnit: 0,
        X1SizeValue: anchors.start,
        DTX1: "0001-01-01T00:00:00",
        X2SizeUnit: 0,
        X2SizeValue: anchors.end,
        DTX2: "0001-01-01T00:00:00",
        X3SizeUnit: 0,
        X3SizeValue: anchors.start,
        DTX3: "0001-01-01T00:00:00",
        Y1: level.price,
        Y2: level.price,
        Y3: level.price,
        FreehandPoints: null,
        SlopeY2: 0,
        SlopeY3: 0,
        SourceTfInMs: 300000,
        IsExtended: true,
        IsLocked: false,
        Ann1: {
          Hidden: false,
          Style: {
            Color: color,
            LineWidth: lineWidth,
            LStyle: deepChartsLineStyle(level.lineStyle),
          },
          Background: {
            Color: "#00000000",
            Opacity: 0,
          },
        },
        Ann2: null,
        TextMsg: annotationText(level),
        TextPadding: 4,
        TextColor: color,
        ShowDifference: false,
        ShowPercent: false,
        ShowPrice: true,
        ShowLblBackground: true,
        LblBackground: {
          Color: "#E6111827",
          Opacity: 90,
        },
        IsExchDT: true,
        LabelAlign: 0,
        AnnParam: null,
        Money: null,
      };
    });
}

export function serializeDeepChartsXml(
  levels: DeepChartsLevelInput[],
  exportedAt = new Date(),
) {
  return JSON.stringify(buildDeepChartsAnnotations(levels, exportedAt), null, 1);
}
