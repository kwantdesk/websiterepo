import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * GEX BOX settings: picking a palette, and what a panel may be told to do.
 *
 * Choosing a colour used to apply it and shut the dialog, so comparing two
 * palettes meant reopening it for each one and there was no way back. And
 * every panel was offered a timeframe whether or not its request carries one,
 * so on most tools the control did nothing and the dialog quietly misdescribed
 * what it controlled.
 */

const source = readFileSync(new URL("../src/components/gexbot/GexBoxDashboard.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("a palette click previews instead of closing", () => {
  assert.doesNotMatch(
    source,
    /onApply=\{\(id\) => \{ applyPalette\(id\); setShowStyle\(false\); \}\}/,
    "choosing a colour must not close the dialog",
  );
  assert.match(source, /onClick=\{\(\) => \{ setDraft\(preset\.id\); onPreview\(preset\.id\); \}\}/);
  assert.match(source, /onPreview=\{applyPalette\}/, "the workspace behind the dialog must show the choice");
});

check("nothing is kept until Save", () => {
  assert.match(source, /const dirty = draft !== originalRef\.current;/);
  assert.match(source, /onSave=\{\(id\) => \{ applyPalette\(id\); setShowStyle\(false\); \}\}/);
  // Discard must restore exactly what was there on open, not a default.
  assert.match(source, /const originalRef = useRef\(paletteId\);/);
  assert.match(source, /onPreview\(originalRef\.current\);/);
});

check("leaving with an unsaved palette asks first", () => {
  assert.match(source, /const attemptClose = useCallback\(\(\) => \{\s*\n\s*if \(!dirty\) \{ onClose\(\); return; \}/);
  assert.match(source, /Save this palette\?/);
  // Both the close button and clicking the backdrop go through the check.
  const backdrop = source.slice(source.indexOf("function GexBoxStyleSettings"), source.indexOf("Saved GEX BOX workspaces"));
  assert.match(backdrop, /onMouseDown=\{\(event\) => \{ if \(event\.target === event\.currentTarget\) attemptClose\(\); \}\}/);
  assert.match(backdrop, /onClick=\{attemptClose\} aria-label="Close workspace style"/);
});

check("a panel only offers the controls its tool reads", () => {
  // Derived by probing the tool's own endpoint, so a tool added later is
  // described correctly without anyone maintaining a list.
  assert.match(source, /const uses = useMemo\(\(\) => \{/);
  assert.match(source, /url\.includes\("__AGG__"\)/);
  for (const key of ["symbol", "aggregation", "date", "greek", "expiry"]) {
    assert.match(
      source,
      new RegExp(`\\{uses\\.${key} \\? <Field`),
      `the ${key} control must be gated on the tool actually reading it`,
    );
  }
});

check("the probe reflects the real endpoints", () => {
  // Reproduce the gating against the tool table so the two cannot disagree.
  const table = source.slice(source.indexOf("const TOOLS"), source.indexOf("\n];", source.indexOf("const TOOLS")));
  const usesAggregation = (line) => /\$\{s\.aggregation\}/.test(line);
  const intervalLine = table.split("\n").find((line) => line.includes('id: "interval-map"'));
  const ivRankLine = table.split("\n").find((line) => line.includes('id: "iv-rank"'));
  assert.ok(intervalLine && usesAggregation(intervalLine), "Interval Map reads a timeframe");
  assert.ok(ivRankLine && !usesAggregation(ivRankLine), "IV Rank does not, so it must not offer one");
});

check("the shorthand tools carry no timeframe yet", () => {
  // Net Flow, Net Drift, Term Structure and Volatility Drift all route through
  // normalizedTool, which sends symbol, date, greek and expiry and no
  // aggregation — and /api/gex-box/tool does not read one either. This pins
  // that as a known gap rather than letting it look supported.
  const shorthand = source.slice(source.indexOf("const normalizedTool"), source.indexOf("const TOOLS"));
  assert.doesNotMatch(shorthand, /aggregation/, "normalizedTool sends no aggregation");
  const route = readFileSync(new URL("../src/app/api/gex-box/tool/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /searchParams\.get\("aggregationPeriod"\)/, "the route reads no aggregation");
});

console.log(`\ngex box panel settings: ${passed}/${passed} checks passed`);
