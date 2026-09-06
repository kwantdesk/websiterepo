import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { SuperTrendPaneScale } from "../src/lib/superTrendPaneScale.ts";

// Execute the actual pane-domain function rather than a convenient test formula.
const source = fs.readFileSync(new URL("../src/components/ChartIndicatorPanes.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("panes.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const node = file.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "seriesDomain");
assert.ok(node);
const compiled = ts.transpileModule(node.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const calculate = new Function(`${compiled}; return seriesDomain;`)();
const series = (values, excluded = false, difference = false) => [{
  key: "st", superTrendStyleKey: "settings", excludeFromAutoScale: excluded,
  includeZeroInScale: difference, data: values.map((value, i) => ({ time: i, value })),
}];

test("auto-centre off freezes the useful domain; re-enable and explicit reset recalculate", () => {
  const scale = new SuperTrendPaneScale();
  const first = scale.resolve("a", series([29000, 29100]), calculate);
  assert.equal(scale.resolve("a", series([30000, 31000], true), calculate), first);
  const updated = scale.resolve("a", series([30000, 31000]), calculate);
  assert.ok(updated.max > 31000); assert.notDeepEqual(updated, first);
  assert.equal(scale.reset("a"), true);
  const reset = scale.resolve("a", series([28000, 28100], true), calculate);
  assert.ok(reset.min < 28000 && reset.max > 28100);
});

test("saved auto-centre off bootstraps from actual prices or signed Difference values", () => {
  for (const difference of [false, true]) {
    const scale = new SuperTrendPaneScale();
    const values = difference ? [-8, 12] : [29000, 29100];
    const actual = scale.resolve("a", series(values, true, difference), calculate);
    assert.deepEqual(actual, calculate(series(values, false, difference)));
    assert.equal(scale.resolve("a", series([50000], true, difference), calculate), actual);
  }
});

test("scope, removed studies and empty warmup do not leak old scales", () => {
  const scale = new SuperTrendPaneScale();
  scale.retain("NQ", ["a"]);
  scale.resolve("a", series([29000, 29100]), calculate);
  scale.retain("ES", ["a"]);
  const es = scale.resolve("a", series([5000, 5100], true), calculate);
  assert.ok(es.max < 6000);
  scale.retain("ES", []); scale.retain("ES", ["a"]);
  assert.ok(scale.resolve("a", series([1, 2], true), calculate).max < 3);
  scale.reset("a");
  scale.resolve("a", series([], true), calculate);
  assert.ok(scale.resolve("a", series([900, 1000], true), calculate).max > 1000);
});

test("working indicator scaling bypasses Super Trend cache completely", () => {
  const scale = new SuperTrendPaneScale();
  for (const values of [[1, 2], [100, 200], []]) {
    const working = series(values, true).map(({ superTrendStyleKey, ...rest }) => rest);
    assert.deepEqual(scale.resolve("cvd", working, calculate), calculate(working));
  }
});
