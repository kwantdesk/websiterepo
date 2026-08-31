import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = join(root, "src");
const lifecyclePatterns = [
  ["event-listener", /\.addEventListener\s*\(/],
  ["resize-observer", /new\s+ResizeObserver\s*\(/],
  ["mutation-observer", /new\s+MutationObserver\s*\(/],
  ["intersection-observer", /new\s+IntersectionObserver\s*\(/],
  ["interval", /\bsetInterval\s*\(/],
  ["animation-frame", /\brequestAnimationFrame\s*\(/],
];
const liveDependencyPattern = /\b(adapter|candles|bars|ticks|trades|quotes|snapshot|viewport|price|depth|frame|feed|book|events|rows|data)\b/i;

function walk(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (entry !== "node_modules" && entry !== ".next") walk(path, output);
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      output.push(path);
    }
  }
  return output;
}

const findings = [];
for (const path of walk(sourceRoot)) {
  const text = readFileSync(path, "utf8");
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const inspect = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["useEffect", "useLayoutEffect"].includes(node.expression.text)) {
      const [callback, dependencies] = node.arguments;
      if (!callback) return;
      const body = callback.getText(source);
      const kinds = lifecyclePatterns.filter(([, pattern]) => pattern.test(body)).map(([kind]) => kind);
      if (kinds.length === 0) return;
      const dependencyText = dependencies?.getText(source) ?? "<missing>";
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      findings.push({
        file: relative(root, path).replaceAll("\\", "/"),
        line,
        hook: node.expression.text,
        kinds: kinds.join(","),
        dependencies: dependencyText,
        liveRisk: dependencyText !== "[]" && liveDependencyPattern.test(dependencyText),
      });
    }
    ts.forEachChild(node, inspect);
  };
  inspect(source);
}

const risky = findings.filter((finding) => finding.liveRisk);
console.log(JSON.stringify({
  scannedFiles: walk(sourceRoot).length,
  lifecycleEffects: findings.length,
  liveDependencyRisks: risky.length,
  risks: risky,
}, null, 2));

