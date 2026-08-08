import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT } from "./volumeProfileMath.ts";
import {
  compilePineScript,
  runPineScript,
  type PineDiagnostic,
  type PineProgram,
} from "./pineScriptRuntime.ts";

export type SourceIndicatorLanguage = "auto" | "pine" | "thinkscript" | "easylanguage";
export type ResolvedSourceIndicatorLanguage = Exclude<SourceIndicatorLanguage, "auto">;

export type PreparedSourceIndicator = {
  requestedLanguage: SourceIndicatorLanguage;
  language: ResolvedSourceIndicatorLanguage;
  pineSource: string;
  program: PineProgram;
  diagnostics: PineDiagnostic[];
  nativeAdapter: NativeIndicatorAdapter | null;
};

export type NativeIndicatorAdapter = {
  id: string;
  indicatorId: string;
  name: string;
  description: string;
  settings: Record<string, number | string | boolean>;
};

const LANGUAGE_LABELS: Record<ResolvedSourceIndicatorLanguage, string> = {
  pine: "Pine Script",
  thinkscript: "thinkScript",
  easylanguage: "EasyLanguage",
};

const THINKSCRIPT_FUNCTIONS: Record<string, string> = {
  average: "ta.sma",
  expaverage: "ta.ema",
  wildersaverage: "ta.rma",
  wma: "ta.wma",
  highest: "ta.highest",
  lowest: "ta.lowest",
  stdev: "ta.stdev",
  rateofchange: "ta.roc",
  rsi: "ta.rsi",
  atr: "ta.atr",
  averagetruerange: "ta.atr",
  absvalue: "math.abs",
  abs: "math.abs",
  sqrt: "math.sqrt",
  power: "math.pow",
  max: "math.max",
  min: "math.min",
};

const EASYLANGUAGE_FUNCTIONS: Record<string, string> = {
  average: "ta.sma",
  averagefc: "ta.sma",
  xaverage: "ta.ema",
  waverage: "ta.wma",
  highest: "ta.highest",
  highestfc: "ta.highest",
  lowest: "ta.lowest",
  lowestfc: "ta.lowest",
  standarddev: "ta.stdev",
  rateofchange: "ta.roc",
  rsi: "ta.rsi",
  avgtruerange: "ta.atr",
  absvalue: "math.abs",
  squareRoot: "math.sqrt",
  power: "math.pow",
  maxlist: "math.max",
  minlist: "math.min",
};

const COLOR_MAP: Record<string, string> = {
  aqua: "color.aqua",
  black: "color.black",
  blue: "color.blue",
  cyan: "color.aqua",
  darkgray: "color.gray",
  darkgreen: "color.green",
  darkred: "color.red",
  default: "color.white",
  green: "color.green",
  gray: "color.gray",
  grey: "color.gray",
  lightgray: "color.silver",
  lime: "color.lime",
  magenta: "color.fuchsia",
  orange: "color.orange",
  pink: "color.fuchsia",
  purple: "color.purple",
  red: "color.red",
  white: "color.white",
  yellow: "color.yellow",
};

function diagnostic(line: number, severity: PineDiagnostic["severity"], message: string): PineDiagnostic {
  return { line, severity, message };
}

function pineInputBoolean(source: string, variable: string, fallback: boolean) {
  const match = source.match(new RegExp(`\\b${variable}\\s*=\\s*input\\.bool\\(\\s*(true|false)`, "i"));
  return match ? match[1].toLowerCase() === "true" : fallback;
}

function detectNativePineAdapter(source: string): NativeIndicatorAdapter | null {
  const isPriceVolumeProfile = [
    /\barray\.new_(?:float|box|line)\s*\(/i,
    /\bvolumeStorageT\b/i,
    /\bprofileLevels\b/i,
    /\bpointOfControl\b/i,
    /\bvalueAreaHigh\b/i,
    /\bvalueAreaLow\b/i,
  ].every((pattern) => pattern.test(source));
  if (!isPriceVolumeProfile) return null;

  return {
    id: "pine-price-volume-profile-v1",
    indicatorId: "kwant-profile",
    name: "Volume Profile / Price by Volume",
    description: "Advanced Pine profile mapped to Kwant Desk's native trade-by-trade volume-profile renderer.",
    settings: {
      profileMode: "delta-volume",
      groupingMode: "automatic",
      snapMode: "off",
      align: "session",
      useThemeColors: true,
      showText: true,
      showValueArea: pineInputBoolean(source, "valueAreaHigh", true) || pineInputBoolean(source, "valueAreaLow", true),
      showPocLine: pineInputBoolean(source, "pointOfControl", true),
      showValueAreaLines: true,
      showDelta: pineInputBoolean(source, "bullBearStr", true),
      showProfileSpine: true,
      showDevelopingPoc: true,
      showPocHighlight: true,
      showProfileOutline: true,
      showVwapLine: false,
      showVwapBands: false,
      showSummary: true,
      valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
      profileWidth: 24,
      opacity: 76,
      minTradeVolume: 0,
      maxTradeVolume: 0,
      autoGroupFactor: 1,
      profileSettingsVersion: 4,
    },
  };
}

function compactDiagnostics(items: PineDiagnostic[], limit = 28) {
  const unique: PineDiagnostic[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.line}:${item.severity}:${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  if (unique.length <= limit) return unique;
  return [
    ...unique.slice(0, limit),
    diagnostic(1, "warning", `${unique.length - limit} additional diagnostics were condensed. Fix the first errors and compile again.`),
  ];
}

export function sourceIndicatorLanguageLabel(language: ResolvedSourceIndicatorLanguage) {
  return LANGUAGE_LABELS[language];
}

export function detectSourceIndicatorLanguage(source: string): ResolvedSourceIndicatorLanguage | "ninjascript" | "unknown" {
  const value = source.trim();
  if (/\bnamespace\s+NinjaTrader\b|\bOnBarUpdate\s*\(|\bOnStateChange\s*\(|\bAddPlot\s*\(/i.test(value)) return "ninjascript";
  if (/\/\/@version\s*=\s*[56]|\bindicator\s*\(|\bta\.[A-Za-z_]+\s*\(/i.test(value)) return "pine";
  if (/\bdeclare\s+(?:upper|lower)\s*;|\bdef\s+[A-Za-z_]\w*\s*=|\bplot\s+[A-Za-z_]\w*\s*=|\.SetDefaultColor\s*\(/i.test(value)) return "thinkscript";
  if (/\binputs?\s*:|\bvars?(?:iables)?\s*:|\bplot\d{1,2}\s*\(|\bXAverage\s*\(|\bAverageFC\s*\(/i.test(value)) return "easylanguage";
  return "unknown";
}

export function inferSourceLanguageFromFileName(fileName: string): SourceIndicatorLanguage {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "pine") return "pine";
  if (extension === "thinkscript" || extension === "think" || extension === "ts") return "thinkscript";
  if (extension === "eld" || extension === "els" || extension === "el") return "easylanguage";
  return "auto";
}

function stripSourceComments(source: string, language: ResolvedSourceIndicatorLanguage) {
  let value = source.replace(/\/\*[\s\S]*?\*\//g, "");
  if (language === "easylanguage") value = value.replace(/\{[\s\S]*?\}/g, "");
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function splitStatements(source: string) {
  const statements: Array<{ value: string; line: number }> = [];
  let current = "";
  let line = 1;
  let startLine = 1;
  let depth = 0;
  let quoted = false;
  let quote = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if ((character === "\"" || character === "'") && source[index - 1] !== "\\") {
      if (!quoted) {
        quoted = true;
        quote = character;
      } else if (quote === character) quoted = false;
    }
    if (!quoted) {
      if (character === "(") depth += 1;
      if (character === ")") depth = Math.max(0, depth - 1);
      if (character === ";" && depth === 0) {
        if (current.trim()) statements.push({ value: current.trim(), line: startLine });
        current = "";
        startLine = line;
        continue;
      }
    }
    current += character;
    if (character === "\n") {
      line += 1;
      if (!current.trim()) startLine = line;
    }
  }
  if (current.trim()) statements.push({ value: current.trim(), line: startLine });
  return statements;
}

function splitTopLevel(value: string) {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let quoted = false;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === "\"" || character === "'") && value[index - 1] !== "\\") {
      if (!quoted) {
        quoted = true;
        quote = character;
      } else if (quote === character) quoted = false;
    }
    if (!quoted) {
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (character === "," && depth === 0) {
        result.push(current.trim());
        current = "";
        continue;
      }
    }
    current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function replaceFunctions(expression: string, mapping: Record<string, string>) {
  let value = expression;
  for (const [from, to] of Object.entries(mapping)) {
    value = value.replace(new RegExp(`\\b${from}\\s*\\(`, "gi"), `${to}(`);
  }
  return value;
}

function translateConditional(expression: string) {
  const match = expression.trim().match(/^if\s+(.+?)\s+then\s+(.+?)\s+else\s+(.+)$/i);
  if (!match) return expression;
  return `(${match[1]}) ? (${match[2]}) : (${match[3]})`;
}

function normalizeExpression(expression: string, mapping: Record<string, string>) {
  return replaceFunctions(translateConditional(expression), mapping)
    .replace(/\bTrueRange\s*\([^)]*\)/gi, "tr")
    .replace(/\b(?:Open|High|Low|Close|Volume)\b/gi, (value) => value.toLowerCase())
    .replace(/\bTrueRange\b/gi, "tr")
    .replace(/\bof\s+(\d+)\s+bars?\s+ago\b/gi, "[$1]")
    .replace(/\byes\b/gi, "true")
    .replace(/\bno\b/gi, "false")
    .replace(/\band\b/gi, "&&")
    .replace(/\bor\b/gi, "||")
    .replace(/\bnot\b/gi, "!")
    .trim();
}

function colorToken(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/^Color\./i, "").trim().toLowerCase();
  return COLOR_MAP[normalized] ?? null;
}

function translateThinkScript(source: string) {
  const diagnostics: PineDiagnostic[] = [];
  const statements = splitStatements(stripSourceComments(source, "thinkscript"));
  let overlay = true;
  const inputs: string[] = [];
  const assignments: string[] = [];
  const plots: Array<{ name: string; expression: string; color: string | null; width: number; line: number }> = [];
  const plotIndex = new Map<string, number>();

  for (const statement of statements) {
    const value = statement.value.replace(/\s+/g, " ").trim();
    if (/^declare\s+lower$/i.test(value)) {
      overlay = false;
      continue;
    }
    if (/^declare\s+upper$/i.test(value)) {
      overlay = true;
      continue;
    }
    if (/^(?:AddOrder|Alert|AddLabel|AddChartBubble|AssignPriceColor|AddCloud)\s*\(/i.test(value)) {
      diagnostics.push(diagnostic(statement.line, "error", "Trading, alerts, labels, bubbles, price coloring and clouds are not imported from thinkScript."));
      continue;
    }
    const input = value.match(/^input\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
    if (input) {
      const expression = normalizeExpression(input[2], THINKSCRIPT_FUNCTIONS);
      if (/^(?:open|high|low|close|volume|hl2|hlc3|ohlc4|tr)$/.test(expression)) {
        assignments.push(`${input[1]} = ${expression}`);
      } else if (!/^(?:-?\d+(?:\.\d+)?|true|false)$/.test(expression)) {
        diagnostics.push(diagnostic(statement.line, "error", `Input '${input[1]}' needs a numeric, yes/no or OHLCV source default in this compatibility layer.`));
      } else {
        inputs.push(`${input[1]} = input.${expression === "true" || expression === "false" ? "bool" : expression.includes(".") ? "float" : "int"}(${expression}, "${input[1]}")`);
      }
      continue;
    }
    const definition = value.match(/^(?:def|rec)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
    if (definition) {
      if (/^rec\b/i.test(value)) {
        diagnostics.push(diagnostic(statement.line, "error", "Recursive thinkScript series are not supported yet."));
      } else {
        assignments.push(`${definition[1]} = ${normalizeExpression(definition[2], THINKSCRIPT_FUNCTIONS)}`);
      }
      continue;
    }
    const plot = value.match(/^plot\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
    if (plot) {
      plotIndex.set(plot[1].toLowerCase(), plots.length);
      plots.push({ name: plot[1], expression: normalizeExpression(plot[2], THINKSCRIPT_FUNCTIONS), color: null, width: 2, line: statement.line });
      continue;
    }
    const defaultColor = value.match(/^([A-Za-z_]\w*)\.SetDefaultColor\s*\(\s*([^)]+)\s*\)$/i);
    if (defaultColor) {
      const index = plotIndex.get(defaultColor[1].toLowerCase());
      if (index === undefined) diagnostics.push(diagnostic(statement.line, "warning", `Color setting for unknown plot '${defaultColor[1]}' was skipped.`));
      else plots[index].color = colorToken(defaultColor[2]);
      continue;
    }
    const weight = value.match(/^([A-Za-z_]\w*)\.SetLineWeight\s*\(\s*(\d+)\s*\)$/i);
    if (weight) {
      const index = plotIndex.get(weight[1].toLowerCase());
      if (index !== undefined) plots[index].width = Math.max(1, Math.min(4, Number(weight[2])));
      continue;
    }
    if (/\.Set(?:PaintingStrategy|Style|Hiding)\s*\(/i.test(value)) {
      diagnostics.push(diagnostic(statement.line, "warning", "This thinkScript plot styling instruction was skipped."));
      continue;
    }
    diagnostics.push(diagnostic(statement.line, "error", "Unsupported thinkScript statement. Use inputs, def calculations and plot outputs."));
  }

  const name = plots[0]?.name ? `${plots[0].name} · thinkScript` : "Imported thinkScript";
  const pineSource = [
    "//@version=6",
    `indicator("${name}", overlay=${overlay})`,
    ...inputs,
    ...assignments,
    ...plots.map((plot) => `plot(${plot.expression}, title="${plot.name}",${plot.color ? ` color=${plot.color},` : ""} linewidth=${plot.width})`),
  ].join("\n");
  return { pineSource, diagnostics };
}

function translateEasyLanguage(source: string) {
  const diagnostics: PineDiagnostic[] = [];
  const statements = splitStatements(stripSourceComments(source, "easylanguage"));
  const inputs: string[] = [];
  const assignments: string[] = [];
  const plots: Array<{ name: string; expression: string; color: string | null; width: number; line: number }> = [];

  for (const statement of statements) {
    const value = statement.value.replace(/\s+/g, " ").trim();
    const inputDeclaration = value.match(/^inputs?\s*:\s*(.+)$/i);
    if (inputDeclaration) {
      for (const item of splitTopLevel(inputDeclaration[1])) {
        const match = item.match(/^([A-Za-z_]\w*)\s*\(\s*(-?\d+(?:\.\d+)?|true|false)\s*\)$/i);
        if (!match) diagnostics.push(diagnostic(statement.line, "error", `EasyLanguage input '${item}' needs a numeric or boolean default.`));
        else {
          const raw = match[2].toLowerCase();
          inputs.push(`${match[1]} = input.${raw === "true" || raw === "false" ? "bool" : raw.includes(".") ? "float" : "int"}(${raw}, "${match[1]}")`);
        }
      }
      continue;
    }
    if (/^vars?(?:iables)?\s*:/i.test(value)) continue;
    if (/\b(?:Buy|Sell|SellShort|BuyToCover|SetStopLoss|SetProfitTarget|Alert)\b/i.test(value)) {
      diagnostics.push(diagnostic(statement.line, "error", "Orders, strategies, stops and alerts are not imported from EasyLanguage."));
      continue;
    }
    if (/^(?:if|for|while|once)\b|\bbegin\b|\bend\b/i.test(value)) {
      diagnostics.push(diagnostic(statement.line, "error", "EasyLanguage control-flow blocks require manual migration in the current compatibility layer."));
      continue;
    }
    const plot = value.match(/^Plot(\d{1,2})\s*\((.*)\)$/i);
    if (plot) {
      const args = splitTopLevel(plot[2]);
      const expression = args[0] ? normalizeExpression(args[0], EASYLANGUAGE_FUNCTIONS) : "";
      const name = args[1]?.replace(/^['\"]|['\"]$/g, "") || `Plot${plot[1]}`;
      const color = colorToken(args[2]);
      const width = Math.max(1, Math.min(4, Number(args[4] ?? 2) || 2));
      plots.push({ name, expression, color, width, line: statement.line });
      continue;
    }
    if (/^(?:SetPlotColor|SetPlotWidth|NoPlot)\s*\(/i.test(value)) {
      diagnostics.push(diagnostic(statement.line, "warning", "Dynamic EasyLanguage plot styling was skipped."));
      continue;
    }
    const assignment = value.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (assignment) {
      assignments.push(`${assignment[1]} = ${normalizeExpression(assignment[2], EASYLANGUAGE_FUNCTIONS)}`);
      continue;
    }
    diagnostics.push(diagnostic(statement.line, "error", "Unsupported EasyLanguage statement. Use Inputs, variable calculations and Plot1–Plot99 outputs."));
  }

  const name = plots[0]?.name ? `${plots[0].name} · EasyLanguage` : "Imported EasyLanguage";
  const pineSource = [
    "//@version=6",
    `indicator("${name}", overlay=true)`,
    ...inputs,
    ...assignments,
    ...plots.map((plot) => `plot(${plot.expression}, title="${plot.name}",${plot.color ? ` color=${plot.color},` : ""} linewidth=${plot.width})`),
  ].join("\n");
  return { pineSource, diagnostics };
}

export function prepareSourceIndicator(
  source: string,
  requestedLanguage: SourceIndicatorLanguage = "auto",
): PreparedSourceIndicator {
  const detected = requestedLanguage === "auto" ? detectSourceIndicatorLanguage(source) : requestedLanguage;
  if (detected === "ninjascript") {
    const pineSource = "//@version=6\nindicator(\"NinjaScript import\", overlay=true)";
    const program = compilePineScript(pineSource);
    return {
      requestedLanguage,
      language: "pine",
      pineSource,
      program,
      diagnostics: [diagnostic(1, "error", "NinjaScript is compiled C# with NinjaTrader lifecycle and data APIs. It cannot be executed safely in the browser; migrate its calculations into Pine, thinkScript or EasyLanguage study form first.")],
      nativeAdapter: null,
    };
  }
  if (detected === "unknown") {
    const pineSource = "//@version=6\nindicator(\"Unknown source\", overlay=true)";
    const program = compilePineScript(pineSource);
    return {
      requestedLanguage,
      language: "pine",
      pineSource,
      program,
      diagnostics: [diagnostic(1, "error", "Language could not be detected. Choose Pine Script, thinkScript or EasyLanguage above the editor.")],
      nativeAdapter: null,
    };
  }

  const nativeAdapter = detected === "pine" ? detectNativePineAdapter(source) : null;
  if (nativeAdapter) {
    const pineSource = `//@version=6\nindicator("${nativeAdapter.name}", overlay=true)\nplot(close, title="Native profile anchor")`;
    const program = compilePineScript(pineSource);
    return {
      requestedLanguage,
      language: "pine",
      pineSource,
      program: { ...program, name: nativeAdapter.name },
      diagnostics: [
        diagnostic(1, "info", `${nativeAdapter.name} recognised. It will use Kwant Desk's native volume-at-price renderer with live bid/ask delta, POC and value area.`),
        diagnostic(1, "warning", "TradingView-only labels, tables, alerts and bar recolouring are excluded; the core volume-at-price structure is mapped to the native profile."),
      ],
      nativeAdapter,
    };
  }

  const translated = detected === "thinkscript"
    ? translateThinkScript(source)
    : detected === "easylanguage"
      ? translateEasyLanguage(source)
      : { pineSource: source, diagnostics: [] as PineDiagnostic[] };
  const program = compilePineScript(translated.pineSource);
  const compilerDiagnostics = program.diagnostics.map((item) => detected === "pine" ? item : ({
    ...item,
    message: `${LANGUAGE_LABELS[detected]} adapter: ${item.message}`,
  }));
  const diagnostics = compactDiagnostics([...translated.diagnostics, ...compilerDiagnostics]);
  return { requestedLanguage, language: detected, pineSource: translated.pineSource, program, diagnostics, nativeAdapter: null };
}

export function runSourceIndicator(
  source: string,
  requestedLanguage: SourceIndicatorLanguage,
  candles: Candle[],
  theme: IndicatorTheme,
  instanceKey: string,
): { prepared: PreparedSourceIndicator; series: CalculatedIndicatorSeries[]; runtimeError: string | null } {
  const prepared = prepareSourceIndicator(source, requestedLanguage);
  if (prepared.diagnostics.some((item) => item.severity === "error")) return { prepared, series: [], runtimeError: null };
  if (prepared.nativeAdapter) return { prepared, series: [], runtimeError: null };
  const result = runPineScript(prepared.pineSource, candles, theme, instanceKey);
  return { prepared, series: result.series, runtimeError: result.runtimeError };
}
