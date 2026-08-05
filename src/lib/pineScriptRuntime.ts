import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";

export type PineDiagnostic = {
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
};

type Token = {
  kind: "number" | "string" | "identifier" | "operator" | "punctuation" | "eof";
  value: string;
};

type Expression =
  | { kind: "number"; value: number }
  | { kind: "identifier"; name: string }
  | { kind: "unary"; operator: string; value: Expression }
  | { kind: "binary"; operator: string; left: Expression; right: Expression }
  | { kind: "conditional"; condition: Expression; truthy: Expression; falsy: Expression }
  | { kind: "history"; value: Expression; offset: Expression }
  | { kind: "call"; name: string; args: Expression[] };

type PineAssignment = { name: string; expression: Expression; line: number };
type PinePlot = {
  expression: Expression;
  title: string;
  color: string | null;
  lineWidth: 1 | 2 | 3 | 4;
  style: "line" | "histogram";
  line: number;
};

export type PineProgram = {
  version: number;
  name: string;
  overlay: boolean;
  assignments: PineAssignment[];
  inputs: Record<string, number>;
  plots: PinePlot[];
  diagnostics: PineDiagnostic[];
};

const BANNED_FEATURES: Array<[RegExp, string]> = [
  [/\bstrategy\s*\(/, "Strategies and broker-emulator orders are not supported in Source Code Indicators."],
  [/\brequest\.(security|seed|economic|financial)\s*\(/, "External symbols and TradingView request.* data are not available in the local chart sandbox."],
  [/\b(import|library)\b/, "Published TradingView libraries cannot be imported outside TradingView."],
  [/\b(array|matrix|map)\./, "Pine collections are not supported in the current compatibility subset."],
  [/\b(line|box|label|table|polyline)\.(new|set_|delete)/, "Pine drawing objects are not supported yet; use plot() output."],
  [/\b(alert|alertcondition)\s*\(/, "Pine alerts are not imported. Use Kwant Desk chart alerts separately."],
];

const PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  ">": 4,
  ">=": 4,
  "<": 4,
  "<=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

const SUPPORTED_FUNCTIONS = new Set([
  "ta.sma",
  "ta.ema",
  "ta.rma",
  "ta.wma",
  "ta.vwma",
  "ta.highest",
  "ta.lowest",
  "ta.stdev",
  "ta.change",
  "ta.roc",
  "ta.rsi",
  "ta.atr",
  "ta.crossover",
  "ta.crossunder",
  "math.abs",
  "math.sqrt",
  "math.pow",
  "math.max",
  "math.min",
  "nz",
  "na",
]);

function stripComment(line: string) {
  let quoted = false;
  let quote = "";
  for (let index = 0; index < line.length - 1; index += 1) {
    const character = line[index];
    if ((character === "\"" || character === "'") && line[index - 1] !== "\\") {
      if (!quoted) {
        quoted = true;
        quote = character;
      } else if (quote === character) {
        quoted = false;
      }
    }
    if (!quoted && character === "/" && line[index + 1] === "/") return line.slice(0, index);
  }
  return line;
}

function splitTopLevel(value: string) {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === "\"" || character === "'") && value[index - 1] !== "\\") {
      if (!quoted) {
        quoted = true;
        quote = character;
      } else if (quote === character) {
        quoted = false;
      }
      continue;
    }
    if (quoted) continue;
    if (character === "(" || character === "[") depth += 1;
    if (character === ")" || character === "]") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function topLevelEquals(value: string) {
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
      continue;
    }
    if (quoted) continue;
    if (character === "(" || character === "[") depth += 1;
    if (character === ")" || character === "]") depth -= 1;
    if (character === "=" && depth === 0 && value[index - 1] !== "=" && value[index + 1] !== "=") return index;
  }
  return -1;
}

function unquote(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (/\d/.test(character) || (character === "." && /\d/.test(source[index + 1] ?? ""))) {
      const start = index;
      index += 1;
      while (/[\d.]/.test(source[index] ?? "")) index += 1;
      tokens.push({ kind: "number", value: source.slice(start, index) });
      continue;
    }
    if (character === "\"" || character === "'") {
      const quote = character;
      const start = index;
      index += 1;
      while (index < source.length && (source[index] !== quote || source[index - 1] === "\\")) index += 1;
      if (index >= source.length) throw new Error("Unterminated string.");
      index += 1;
      tokens.push({ kind: "string", value: source.slice(start, index) });
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      const start = index;
      index += 1;
      while (/[A-Za-z0-9_.]/.test(source[index] ?? "")) index += 1;
      tokens.push({ kind: "identifier", value: source.slice(start, index) });
      continue;
    }
    const pair = source.slice(index, index + 2);
    if ([">=", "<=", "==", "!=", "&&", "||"].includes(pair)) {
      tokens.push({ kind: "operator", value: pair });
      index += 2;
      continue;
    }
    if (["+", "-", "*", "/", "%", ">", "<", "!", "?", ":"].includes(character)) {
      tokens.push({ kind: "operator", value: character });
      index += 1;
      continue;
    }
    if (["(", ")", "[", "]", ","].includes(character)) {
      tokens.push({ kind: "punctuation", value: character });
      index += 1;
      continue;
    }
    throw new Error(`Unsupported character '${character}'.`);
  }
  tokens.push({ kind: "eof", value: "" });
  return tokens;
}

class ExpressionParser {
  private index = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse() {
    const expression = this.parseExpression(0);
    if (this.peek().kind !== "eof") throw new Error(`Unexpected token '${this.peek().value}'.`);
    return expression;
  }

  private peek() {
    return this.tokens[this.index];
  }

  private take(value?: string) {
    const token = this.tokens[this.index];
    if (value && token.value !== value) throw new Error(`Expected '${value}', received '${token.value}'.`);
    this.index += 1;
    return token;
  }

  private parseExpression(minimumPrecedence: number): Expression {
    let left = this.parsePrefix();
    while (true) {
      const token = this.peek();
      if (token.value === "[") {
        this.take("[");
        const offset = this.parseExpression(0);
        this.take("]");
        left = { kind: "history", value: left, offset };
        continue;
      }
      const precedence = PRECEDENCE[token.value];
      if (!precedence || precedence < minimumPrecedence) break;
      const operator = this.take().value;
      const right = this.parseExpression(precedence + 1);
      left = { kind: "binary", operator, left, right };
    }
    if (minimumPrecedence === 0 && this.peek().value === "?") {
      this.take("?");
      const truthy = this.parseExpression(0);
      this.take(":");
      const falsy = this.parseExpression(0);
      left = { kind: "conditional", condition: left, truthy, falsy };
    }
    return left;
  }

  private parsePrefix(): Expression {
    const token = this.take();
    if (token.kind === "number") return { kind: "number", value: Number(token.value) };
    if (token.kind === "identifier") {
      if (this.peek().value === "(") {
        this.take("(");
        const args: Expression[] = [];
        while (this.peek().value !== ")") {
          args.push(this.parseExpression(0));
          if (this.peek().value !== ",") break;
          this.take(",");
        }
        this.take(")");
        return { kind: "call", name: token.value, args };
      }
      return { kind: "identifier", name: token.value };
    }
    if (["+", "-", "!"].includes(token.value)) return { kind: "unary", operator: token.value, value: this.parsePrefix() };
    if (token.value === "(") {
      const value = this.parseExpression(0);
      this.take(")");
      return value;
    }
    throw new Error(`Unexpected token '${token.value}'.`);
  }
}

function parseExpression(source: string) {
  return new ExpressionParser(tokenize(source)).parse();
}

function expressionCalls(expression: Expression): string[] {
  if (expression.kind === "call") return [
    expression.name,
    ...expression.args.flatMap(expressionCalls),
  ];
  if (expression.kind === "unary") return expressionCalls(expression.value);
  if (expression.kind === "binary") return [...expressionCalls(expression.left), ...expressionCalls(expression.right)];
  if (expression.kind === "conditional") return [
    ...expressionCalls(expression.condition),
    ...expressionCalls(expression.truthy),
    ...expressionCalls(expression.falsy),
  ];
  if (expression.kind === "history") return [...expressionCalls(expression.value), ...expressionCalls(expression.offset)];
  return [];
}

function expressionIdentifiers(expression: Expression): string[] {
  if (expression.kind === "identifier") return [expression.name];
  if (expression.kind === "call") return expression.args.flatMap(expressionIdentifiers);
  if (expression.kind === "unary") return expressionIdentifiers(expression.value);
  if (expression.kind === "binary") return [...expressionIdentifiers(expression.left), ...expressionIdentifiers(expression.right)];
  if (expression.kind === "conditional") return [
    ...expressionIdentifiers(expression.condition),
    ...expressionIdentifiers(expression.truthy),
    ...expressionIdentifiers(expression.falsy),
  ];
  if (expression.kind === "history") return [...expressionIdentifiers(expression.value), ...expressionIdentifiers(expression.offset)];
  return [];
}

function callBody(line: string, name: string) {
  const start = line.indexOf(`${name}(`);
  if (start < 0 || !line.trim().endsWith(")")) return null;
  return line.slice(start + name.length + 1, line.lastIndexOf(")"));
}

function parseColor(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const colorNew = trimmed.match(/^color\.new\(\s*(color\.[A-Za-z]+|#[\da-fA-F]{6})\s*,/);
  return colorNew?.[1] ?? trimmed;
}

export function compilePineScript(source: string): PineProgram {
  const diagnostics: PineDiagnostic[] = [];
  const versionMatch = source.match(/^\s*\/\/@version=(\d+)/m);
  const version = Number(versionMatch?.[1] ?? 1);
  if (![5, 6].includes(version)) diagnostics.push({
    line: 1,
    severity: "error",
    message: `Pine v${version} is not supported. Use a v5 or v6 indicator.`,
  });
  if (source.length > 64_000) diagnostics.push({ line: 1, severity: "error", message: "Script exceeds the 64 KB sandbox limit." });

  let name = "Source indicator";
  let overlay = true;
  let declarationSeen = false;
  const assignments: PineAssignment[] = [];
  const inputs: Record<string, number> = {};
  const plots: PinePlot[] = [];

  source.split(/\r?\n/).forEach((rawLine, zeroBasedLine) => {
    const lineNumber = zeroBasedLine + 1;
    const line = stripComment(rawLine).trim();
    if (!line || rawLine.trim().startsWith("//@")) return;
    for (const [pattern, message] of BANNED_FEATURES) {
      if (pattern.test(line)) diagnostics.push({ line: lineNumber, severity: "error", message });
    }
    if (/^indicator\s*\(/.test(line)) {
      declarationSeen = true;
      const body = callBody(line, "indicator");
      if (!body) {
        diagnostics.push({ line: lineNumber, severity: "error", message: "The indicator() declaration must be on one line." });
        return;
      }
      const args = splitTopLevel(body);
      if (args[0]) name = unquote(args[0]);
      const named = Object.fromEntries(args.slice(1).flatMap((argument) => {
        const equals = topLevelEquals(argument);
        return equals < 0 ? [] : [[argument.slice(0, equals).trim(), argument.slice(equals + 1).trim()]];
      }));
      overlay = named.overlay !== "false";
      return;
    }
    if (/^plot\s*\(/.test(line)) {
      const body = callBody(line, "plot");
      if (!body) {
        diagnostics.push({ line: lineNumber, severity: "error", message: "plot() must be on one line." });
        return;
      }
      const args = splitTopLevel(body);
      const positional: string[] = [];
      const named: Record<string, string> = {};
      for (const argument of args) {
        const equals = topLevelEquals(argument);
        if (equals < 0) positional.push(argument);
        else named[argument.slice(0, equals).trim()] = argument.slice(equals + 1).trim();
      }
      if (!positional[0]) {
        diagnostics.push({ line: lineNumber, severity: "error", message: "plot() requires a series expression." });
        return;
      }
      try {
        plots.push({
          expression: parseExpression(positional[0]),
          title: unquote(named.title ?? positional[1] ?? `Plot ${plots.length + 1}`),
          color: parseColor(named.color ?? positional[2]),
          lineWidth: Math.max(1, Math.min(4, Number(named.linewidth ?? 2))) as 1 | 2 | 3 | 4,
          style: /histogram|columns/.test(named.style ?? "") ? "histogram" : "line",
          line: lineNumber,
        });
      } catch (error) {
        diagnostics.push({ line: lineNumber, severity: "error", message: error instanceof Error ? error.message : "Invalid plot expression." });
      }
      return;
    }

    const assignment = line.match(/^(?:(?:var|float|int|bool)\s+)?([A-Za-z_]\w*)\s*(=|:=)\s*(.+)$/);
    if (assignment) {
      const [, variable, operator, expressionSource] = assignment;
      if (operator === ":=") {
        diagnostics.push({ line: lineNumber, severity: "error", message: "Stateful := reassignment is not supported in the current compatibility subset." });
        return;
      }
      const inputMatch = expressionSource.match(/^input\.(?:int|float|bool)\((.*)\)$/);
      if (inputMatch) {
        const firstArgument = splitTopLevel(inputMatch[1])[0] ?? "0";
        const value = firstArgument === "true" ? 1 : firstArgument === "false" ? 0 : Number(firstArgument);
        if (!Number.isFinite(value)) diagnostics.push({ line: lineNumber, severity: "error", message: `Input '${variable}' requires a numeric or boolean default.` });
        else inputs[variable] = value;
        return;
      }
      try {
        assignments.push({ name: variable, expression: parseExpression(expressionSource), line: lineNumber });
      } catch (error) {
        diagnostics.push({ line: lineNumber, severity: "error", message: error instanceof Error ? error.message : "Invalid expression." });
      }
      return;
    }

    if (/^(hline|fill|plotshape|plotchar|plotbar|plotcandle|barcolor|bgcolor)\s*\(/.test(line)) {
      diagnostics.push({ line: lineNumber, severity: "warning", message: "This visual function is not rendered yet and was skipped." });
      return;
    }
    if (!BANNED_FEATURES.some(([pattern]) => pattern.test(line))) {
      diagnostics.push({ line: lineNumber, severity: "error", message: "Unsupported or multiline Pine statement." });
    }
  });

  if (!declarationSeen) diagnostics.push({ line: 1, severity: "error", message: "A Pine indicator() declaration is required." });
  if (!plots.length) diagnostics.push({ line: 1, severity: "error", message: "At least one supported plot() is required." });
  if (plots.length > 8) diagnostics.push({ line: 1, severity: "error", message: "A maximum of eight plots is supported per source indicator." });
  if (assignments.length > 32) diagnostics.push({ line: 1, severity: "error", message: "A maximum of 32 calculated series is supported per source indicator." });
  for (const item of [...assignments, ...plots]) {
    for (const functionName of new Set(expressionCalls(item.expression))) {
      if (!SUPPORTED_FUNCTIONS.has(functionName)) diagnostics.push({
        line: item.line,
        severity: "error",
        message: `Pine function '${functionName}' is not supported in the current compatibility subset.`,
      });
    }
  }
  const knownSeries = new Set([
    "open", "high", "low", "close", "volume", "hl2", "hlc3", "ohlc4", "tr", "bar_index", "time",
    "true", "false", "na",
    ...Object.keys(inputs),
  ]);
  for (const assignment of assignments) {
    for (const identifier of new Set(expressionIdentifiers(assignment.expression))) {
      if (!knownSeries.has(identifier)) diagnostics.push({
        line: assignment.line,
        severity: "error",
        message: `Unknown or not-yet-defined Pine series '${identifier}'.`,
      });
    }
    knownSeries.add(assignment.name);
  }
  for (const plot of plots) {
    for (const identifier of new Set(expressionIdentifiers(plot.expression))) {
      if (!knownSeries.has(identifier)) diagnostics.push({
        line: plot.line,
        severity: "error",
        message: `Unknown Pine series '${identifier}'.`,
      });
    }
  }
  if (!diagnostics.some((diagnostic) => diagnostic.severity === "error")) diagnostics.push({
    line: 1,
    severity: "info",
    message: `Pine v${version} compatibility check passed: ${assignments.length} calculation${assignments.length === 1 ? "" : "s"}, ${plots.length} plot${plots.length === 1 ? "" : "s"}.`,
  });

  return { version, name, overlay, assignments, inputs, plots, diagnostics };
}

type SeriesEnvironment = Record<string, number[]>;

const constantSeries = (length: number, value: number) => Array<number>(length).fill(value);
const finiteOrNa = (value: number) => Number.isFinite(value) ? value : Number.NaN;

function rolling(series: number[], length: number, reducer: (values: number[]) => number) {
  const output = Array<number>(series.length).fill(Number.NaN);
  const size = Math.max(1, Math.round(length));
  for (let index = size - 1; index < series.length; index += 1) {
    const window = series.slice(index - size + 1, index + 1);
    if (window.every(Number.isFinite)) output[index] = reducer(window);
  }
  return output;
}

function emaSeries(series: number[], length: number) {
  const output = Array<number>(series.length).fill(Number.NaN);
  const alpha = 2 / (Math.max(1, Math.round(length)) + 1);
  let previous = Number.NaN;
  series.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    previous = Number.isFinite(previous) ? value * alpha + previous * (1 - alpha) : value;
    output[index] = previous;
  });
  return output;
}

function rmaSeries(series: number[], length: number) {
  const output = Array<number>(series.length).fill(Number.NaN);
  const size = Math.max(1, Math.round(length));
  if (series.length < size) return output;
  const seed = series.slice(0, size);
  if (!seed.every(Number.isFinite)) return output;
  let previous = seed.reduce((sum, value) => sum + value, 0) / size;
  output[size - 1] = previous;
  for (let index = size; index < series.length; index += 1) {
    previous = (previous * (size - 1) + series[index]) / size;
    output[index] = previous;
  }
  return output;
}

function scalarArgument(series: number[] | undefined, fallback: number) {
  return series?.find(Number.isFinite) ?? fallback;
}

function evaluateExpression(expression: Expression, environment: SeriesEnvironment, candles: Candle[]): number[] {
  const length = candles.length;
  if (expression.kind === "number") return constantSeries(length, expression.value);
  if (expression.kind === "identifier") {
    if (expression.name === "true") return constantSeries(length, 1);
    if (expression.name === "false") return constantSeries(length, 0);
    if (expression.name === "na") return constantSeries(length, Number.NaN);
    const value = environment[expression.name];
    if (!value) throw new Error(`Unknown series or input '${expression.name}'.`);
    return value;
  }
  if (expression.kind === "history") {
    const values = evaluateExpression(expression.value, environment, candles);
    const offset = Math.max(0, Math.round(scalarArgument(evaluateExpression(expression.offset, environment, candles), 0)));
    return values.map((_, index) => index >= offset ? values[index - offset] : Number.NaN);
  }
  if (expression.kind === "unary") {
    const values = evaluateExpression(expression.value, environment, candles);
    return values.map((value) => expression.operator === "-" ? -value : expression.operator === "!" ? Number(!value) : value);
  }
  if (expression.kind === "binary") {
    const left = evaluateExpression(expression.left, environment, candles);
    const right = evaluateExpression(expression.right, environment, candles);
    return left.map((value, index) => {
      const other = right[index];
      switch (expression.operator) {
        case "+": return value + other;
        case "-": return value - other;
        case "*": return value * other;
        case "/": return other === 0 ? Number.NaN : value / other;
        case "%": return other === 0 ? Number.NaN : value % other;
        case ">": return Number(value > other);
        case ">=": return Number(value >= other);
        case "<": return Number(value < other);
        case "<=": return Number(value <= other);
        case "==": return Number(value === other);
        case "!=": return Number(value !== other);
        case "&&": return Number(Boolean(value) && Boolean(other));
        case "||": return Number(Boolean(value) || Boolean(other));
        default: return Number.NaN;
      }
    });
  }
  if (expression.kind === "conditional") {
    const condition = evaluateExpression(expression.condition, environment, candles);
    const truthy = evaluateExpression(expression.truthy, environment, candles);
    const falsy = evaluateExpression(expression.falsy, environment, candles);
    return condition.map((value, index) => value ? truthy[index] : falsy[index]);
  }

  const args = expression.args.map((argument) => evaluateExpression(argument, environment, candles));
  const source = args[0] ?? constantSeries(length, Number.NaN);
  const period = Math.max(1, Math.round(scalarArgument(args[1], 14)));
  switch (expression.name) {
    case "ta.sma": return rolling(source, period, (values) => values.reduce((sum, value) => sum + value, 0) / values.length);
    case "ta.ema": return emaSeries(source, period);
    case "ta.rma": return rmaSeries(source, period);
    case "ta.wma": return rolling(source, period, (values) => {
      const denominator = values.length * (values.length + 1) / 2;
      return values.reduce((sum, value, index) => sum + value * (index + 1), 0) / denominator;
    });
    case "ta.vwma": {
      const volume = environment.volume;
      const product = source.map((value, index) => value * volume[index]);
      const numerator = rolling(product, period, (values) => values.reduce((sum, value) => sum + value, 0));
      const denominator = rolling(volume, period, (values) => values.reduce((sum, value) => sum + value, 0));
      return numerator.map((value, index) => denominator[index] ? value / denominator[index] : Number.NaN);
    }
    case "ta.highest": return rolling(source, period, (values) => Math.max(...values));
    case "ta.lowest": return rolling(source, period, (values) => Math.min(...values));
    case "ta.stdev": return rolling(source, period, (values) => {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    });
    case "ta.change": {
      const offset = Math.max(1, Math.round(scalarArgument(args[1], 1)));
      return source.map((value, index) => index >= offset ? value - source[index - offset] : Number.NaN);
    }
    case "ta.roc": return source.map((value, index) => index >= period && source[index - period] !== 0
      ? (value - source[index - period]) / source[index - period] * 100
      : Number.NaN);
    case "ta.rsi": {
      const changes = source.map((value, index) => index ? value - source[index - 1] : 0);
      const gains = changes.map((value) => Math.max(0, value));
      const losses = changes.map((value) => Math.max(0, -value));
      const averageGain = rmaSeries(gains, period);
      const averageLoss = rmaSeries(losses, period);
      return averageGain.map((gain, index) => averageLoss[index] === 0 ? 100 : 100 - 100 / (1 + gain / averageLoss[index]));
    }
    case "ta.atr": return rmaSeries(environment.tr, Math.max(1, Math.round(scalarArgument(args[0], 14))));
    case "ta.crossover": return source.map((value, index) => index > 0 && value > (args[1]?.[index] ?? Number.NaN) && source[index - 1] <= (args[1]?.[index - 1] ?? Number.NaN) ? 1 : 0);
    case "ta.crossunder": return source.map((value, index) => index > 0 && value < (args[1]?.[index] ?? Number.NaN) && source[index - 1] >= (args[1]?.[index - 1] ?? Number.NaN) ? 1 : 0);
    case "math.abs": return source.map(Math.abs);
    case "math.sqrt": return source.map((value) => value >= 0 ? Math.sqrt(value) : Number.NaN);
    case "math.pow": return source.map((value, index) => value ** (args[1]?.[index] ?? 1));
    case "math.max": return source.map((value, index) => Math.max(value, ...args.slice(1).map((argument) => argument[index])));
    case "math.min": return source.map((value, index) => Math.min(value, ...args.slice(1).map((argument) => argument[index])));
    case "nz": return source.map((value, index) => Number.isFinite(value) ? value : args[1]?.[index] ?? 0);
    case "na": return source.map((value) => Number(!Number.isFinite(value)));
    default: throw new Error(`Unsupported function '${expression.name}'.`);
  }
}

function pineColor(value: string | null, theme: IndicatorTheme, index: number) {
  if (!value) return [theme.primary, theme.secondary, theme.positive, theme.negative][index % 4];
  const colors: Record<string, string> = {
    "color.aqua": "#22d3ee",
    "color.black": "#000000",
    "color.blue": "#3b82f6",
    "color.fuchsia": "#d946ef",
    "color.gray": "#9ca3af",
    "color.green": "#22c55e",
    "color.lime": "#9dff00",
    "color.maroon": "#7f1d1d",
    "color.navy": "#1e3a8a",
    "color.olive": "#7c7c16",
    "color.orange": "#f59e0b",
    "color.purple": "#a855f7",
    "color.red": "#ff4d68",
    "color.silver": "#d1d5db",
    "color.teal": "#14b8a6",
    "color.white": "#ffffff",
    "color.yellow": "#facc15",
  };
  return colors[value] ?? (/^#[\da-f]{6}$/i.test(value) ? value : theme.primary);
}

export function runPineScript(
  source: string,
  candles: Candle[],
  theme: IndicatorTheme,
  instanceKey: string,
): { program: PineProgram; series: CalculatedIndicatorSeries[]; runtimeError: string | null } {
  const program = compilePineScript(source);
  if (program.diagnostics.some((diagnostic) => diagnostic.severity === "error") || !candles.length) {
    return { program, series: [], runtimeError: null };
  }

  const close = candles.map((candle) => candle.close);
  const high = candles.map((candle) => candle.high);
  const low = candles.map((candle) => candle.low);
  const environment: SeriesEnvironment = {
    open: candles.map((candle) => candle.open),
    high,
    low,
    close,
    volume: candles.map((candle) => Number(candle.volume ?? 0)),
    hl2: high.map((value, index) => (value + low[index]) / 2),
    hlc3: high.map((value, index) => (value + low[index] + close[index]) / 3),
    ohlc4: candles.map((candle) => (candle.open + candle.high + candle.low + candle.close) / 4),
    tr: candles.map((candle, index) => index === 0
      ? candle.high - candle.low
      : Math.max(candle.high - candle.low, Math.abs(candle.high - close[index - 1]), Math.abs(candle.low - close[index - 1]))),
    bar_index: candles.map((_, index) => index),
    time: candles.map((candle) => candle.timestamp),
    ...Object.fromEntries(Object.entries(program.inputs).map(([key, value]) => [key, constantSeries(candles.length, value)])),
  };

  try {
    for (const assignment of program.assignments) {
      environment[assignment.name] = evaluateExpression(assignment.expression, environment, candles).map(finiteOrNa);
    }
    const series = program.plots.map((plot, index): CalculatedIndicatorSeries => ({
      key: `${instanceKey}-plot-${index}`,
      label: plot.title,
      kind: plot.style,
      placement: program.overlay ? "overlay" : "pane",
      color: pineColor(plot.color, theme, index),
      lineWidth: plot.lineWidth,
      showZeroLine: !program.overlay && plot.style === "histogram",
      data: evaluateExpression(plot.expression, environment, candles).flatMap((value, candleIndex) =>
        Number.isFinite(value)
          ? [{ time: candles[candleIndex].timestamp / 1_000, value }]
          : []),
    }));
    return { program, series, runtimeError: null };
  } catch (error) {
    return { program, series: [], runtimeError: error instanceof Error ? error.message : "The source indicator could not be evaluated." };
  }
}
