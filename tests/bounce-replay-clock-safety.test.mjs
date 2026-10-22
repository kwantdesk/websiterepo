import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/bounce-levels/route.ts", import.meta.url), "utf8");
function extract(source, names) {
  const ast = ts.createSourceFile("audit.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes = ast.statements.filter((node) =>
    ts.isFunctionDeclaration(node) && names.includes(node.name?.text)
    || ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => names.includes(declaration.name.getText(ast))));
  const js = ts.transpileModule(nodes.map((node) => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return vm.runInNewContext(`${js}; ({${names.join(",")}})`);
}
const { selectBounceReplaySnapshot, bounceReplayResponseIsCurrent, nextBounceReplayTarget } = extract(chart, ["selectBounceReplaySnapshot", "bounceReplayResponseIsCurrent", "nextBounceReplayTarget"]);
const { finite } = extract(route, ["finite"]);
const head = {
  snapshotTimeMs: 100_000,
  levels: [{ id: "real-level", mappedPrice: 500 }],
  exposureField: [{ timestamp: 90_000 }, { timestamp: 110_000 }],
  exposureSeries: [{ samples: [{ timestamp: 90_000 }, { timestamp: 110_000 }] }],
  rolls: [{ timestamp: 90_000 }, { timestamp: 110_000 }],
};

test("a backward seek cannot paint the retained future head, including on request failure", () => {
  assert.equal(selectBounceReplaySnapshot(head, 95_000), null);
  assert.equal(selectBounceReplaySnapshot(head, 95_000), null);
});
test("safe heads retain exact levels while every trail collection is cut at the replay clock", () => {
  const selected = selectBounceReplaySnapshot(head, 100_000);
  assert.equal(selected.levels, head.levels);
  for (const rows of [selected.exposureField, selected.exposureSeries[0].samples, selected.rolls]) {
    assert.deepEqual(Array.from(rows, (row) => row.timestamp), [90_000]);
  }
  assert.equal(head.exposureField.length, 2, "source snapshot is not mutated");
});
test("live last-good heads remain untouched", () => {
  assert.equal(selectBounceReplaySnapshot(head, null), head);
});
test("forward playback admits causal heads without starving on slow I/O", () => {
  const target = { scope: "QQQ|gamma-settings", minute: 10, generation: 1 };
  assert.equal(bounceReplayResponseIsCurrent(target.scope, 10 * 60_000, 1, target), true);
  assert.equal(bounceReplayResponseIsCurrent(target.scope, 11 * 60_000, 1, target), false);
  assert.equal(bounceReplayResponseIsCurrent(target.scope, 9 * 60_000, 1, target), true);
  assert.equal(bounceReplayResponseIsCurrent("NDX|gamma-settings", 10 * 60_000, 1, target), false);
  assert.match(chart, /commitSnapshot\(payload, fromReplay, replayAsOfMs \?\? 0, replayGeneration\)/);
  assert.match(chart, /bounceLevelsSnapshotScope !== `\$\{instrument\}\|\$\{bounceLevelsDataSignature\}`/);
});
test("backward seek, scope and live/replay changes invalidate old in-flight responses", () => {
  const initial = { scope: "QQQ|gamma-settings", minute: 20, generation: 3 };
  const forward = nextBounceReplayTarget(initial, initial.scope, 21);
  assert.equal(forward.generation, 3);
  const backward = nextBounceReplayTarget(forward, initial.scope, 10);
  assert.equal(backward.generation, 4);
  const forwardAgain = nextBounceReplayTarget(backward, initial.scope, 25);
  assert.equal(bounceReplayResponseIsCurrent(initial.scope, 20 * 60_000, 3, forwardAgain), false, "later forward playback cannot resurrect a pre-seek response");
  assert.equal(nextBounceReplayTarget(initial, "NDX|gamma-settings", 20).generation, 4);
  assert.equal(nextBounceReplayTarget(initial, initial.scope, 0).generation, 4);
  assert.equal(nextBounceReplayTarget({ ...initial, minute: 0 }, initial.scope, 20).generation, 4);
  assert.match(chart, /current\.snapshotTimeMs > snapshot\.snapshotTimeMs/);
  assert.match(chart, /snapshot\.snapshotTimeMs > requestedAsOfMs/);
});
test("absent and blank Bounce numeric fields use real defaults while explicit zero survives", () => {
  const request = (query) => ({ nextUrl: new URL(`https://example.invalid/?${query}`) });
  for (const query of ["", "weight=", "weight=%20", "weight=invalid"]) assert.equal(finite(request(query), "weight", 55), 55);
  assert.equal(finite(request("weight=0"), "weight", 55), 0);
  assert.equal(finite(request("weight=15"), "weight", 55), 15);
});
