import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { placeVolumeProfileLabelBoxes } from "../src/lib/nativeVolumeProfilePrimitive.ts";
import { PositionCalculatorPrimitive } from "../src/lib/positionCalculatorPrimitive.ts";
import { renderProfile } from "./helpers/volume-profile-render-harness.mjs";

// Exercise the actual embedded renderer without importing the React workspace.
const source = ts.createSourceFile("Chart.tsx", readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const renderer = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "SessionHighLowRenderer");
assert.ok(renderer);
const sandbox = {};
vm.runInNewContext(ts.transpileModule(renderer.getText(source) + "\nglobalThis.Renderer = SessionHighLowRenderer;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);

function canvas() {
  const text = [], paths = [];
  const context = new Proxy({}, {
    get(target, key) {
      if (key === "measureText") return value => ({ width: String(value).length * 6 });
      if (key === "fillText") return (value, x, y) => text.push({ value, x, y });
      if (key === "fill" || key === "stroke") return path => {
        if (path?.commands) paths.push({ color: target[key === "fill" ? "fillStyle" : "strokeStyle"], commands: path.commands });
      };
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      return target[key] ?? (() => {});
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { text, paths, draw: { useMediaCoordinateSpace: cb => cb({ context, mediaSize: { width: 600, height: 200 } }) } };
}

const level = (id, price, extra = {}) => ({ id, label: id, price, startTime: 80, precision: 2, fontSize: 10, opacity: 1, color: "#ffffff", lineWidth: 1, lineStyle: "solid", ...extra });
function session(levels, dx = 0, dy = 0) {
  const capture = canvas();
  new sandbox.Renderer({
    levels: () => levels, leftInset: () => 20,
    chart: () => ({ timeScale: () => ({ timeToCoordinate: t => t + dx }) }),
    series: () => ({ priceToCoordinate: p => p + dy }),
  }).draw(capture.draw);
  return capture.text;
}

test("session and IB labels outside any plot edge are omitted instead of pinned", () => {
  const text = session([
    level("above", -100), level("below", 500),
    level("left", 80, { startTime: -200 }), level("right", 90, { startTime: 900 }),
    level("end-outside", 100, { endTime: 950, labelAnchor: "end" }),
    level("future-IB", 100, { startTime: 950, labelAnchor: "end" }),
    level("visible", 120), level("IB-forward", 160, { labelAnchor: "end" }),
  ]);
  assert.deepEqual(text.map(t => t.value), ["visible 120.00", "IB-forward 160.00"]);
  assert.ok(text.every(t => t.x >= 24 && t.y >= 14 && t.y <= 198));
});

test("session labels follow their original price and time when panned out and back", () => {
  const levels = [level("anchor", 80)];
  const initial = session(levels)[0];
  const moved = session(levels, 37, 25)[0];
  assert.equal(moved.x - initial.x, 37);
  assert.equal(moved.y - initial.y, 25);
  assert.deepEqual(session(levels, 0, -200), []);
  assert.deepEqual(session(levels, -200), []);
  assert.deepEqual(session(levels), [initial]);
});

test("crowded session labels cannot be squeezed onto the top or bottom border", () => {
  for (const price of [20, 190]) {
    const painted = session(Array.from({ length: 100 }, (_, i) => level(`crowded-${i}`, price)));
    assert.ok(painted.length > 0 && painted.length < 100);
    assert.ok(painted.every(t => t.y - 12 >= 2 && t.y + 2 <= 198));
  }
});

const bounds = { left: 20, right: 600, top: 2, bottom: 198 };
const box = (id, x, y, width = 90, height = 12) => ({ id, preferredLeft: x, preferredTop: y, width, height });
test("profile captions preserve their index and coordinates without edge relocation or shrinking", () => {
  const boxes = [box("top", 30, -1), box("left", 0, 60), box("right", 570, 60), box("bottom", 30, 190), box("valid", 100, 80), box("oversized", 30, 20, 900)];
  const placed = placeVolumeProfileLabelBoxes(boxes, bounds);
  assert.equal(placed.length, boxes.length);
  assert.deepEqual(placed.slice(0, 4), [null, null, null, null]);
  assert.deepEqual(placed[4], { ...boxes[4], left: 100, top: 80 });
  assert.equal(placed[5], null);
});

test("crowded profile captions stay near their anchor and never pile up on a border", () => {
  const placed = placeVolumeProfileLabelBoxes(Array.from({ length: 12 }, (_, i) => box(String(i), 30, 2)), bounds);
  assert.equal(placed.filter(Boolean).length, 3);
  assert.deepEqual(placed.filter(Boolean).map(p => p.top), [2, 16, 30]);
  assert.ok(placed.slice(3).every(p => p === null));
});

test("fixed-range profile body pans by the actual time-axis distance beyond either edge", () => {
  const { primitive, paths, model } = renderProfile({ period: "custom", drawing: true, mode: "volume" });
  const firstX = list => list.find(p => p.color === "#5566FF").commands.find(c => c[0] === "move" || c[0] === "rect")[1];
  const initialX = firstX(paths);
  for (const offset of [-500, 700]) {
    const capture = canvas();
    primitive.attached({
      series: { priceToCoordinate: p => 300 - (p - 100) * 30, coordinateToPrice: y => 100 - (y - 300) / 30 },
      chart: { timeScale: () => ({
        timeToCoordinate: t => 350 + offset + (Number(t) - model.profile.startMs / 1000) / 60 * 20,
        coordinateToLogical: x => (x - 350 - offset) / 20, logicalToCoordinate: x => 350 + offset + Number(x) * 20,
        getVisibleLogicalRange: () => ({ from: -20, to: 40 }), width: () => 1200,
      }) }, requestUpdate() {},
    });
    primitive.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: cb => capture.draw.useMediaCoordinateSpace(({ context }) => cb({ context, mediaSize: { width: 1200, height: 600 } })) });
    // A fully hidden profile may be culled entirely. Otherwise its body keeps
    // its real translated coordinates instead of reappearing at a border.
    if (capture.paths.length) assert.equal(firstX(capture.paths) - initialX, offset);
  }
});

test("selected calculator readouts disappear with their anchors, not onto plot borders", () => {
  const primitive = new PositionCalculatorPrimitive();
  const model = { id: "calculator", startTime: 30, endTime: 110, entryPrice: 100, stopPrice: 150, targetPrice: 50,
    selected: true, showLabels: true, targetText: "profit", stopText: "loss", rewardRiskText: "entry",
    profitColor: "#00ff00", lossColor: "#ff0000", entryLineColor: "#ffffff", labelTextColor: "#ffffff",
    handleFill: "#000000", handleStroke: "#ffffff", fillOpacity: .2, borderOpacity: 1, lineWidth: 1, lineDash: null };
  primitive.setModels([model]);
  const paint = (dx, dy) => {
    const capture = canvas();
    primitive.attached({ chart: { timeScale: () => ({ timeToCoordinate: t => t + dx }) }, series: { priceToCoordinate: p => p + dy }, requestUpdate() {} });
    primitive.paneViews()[0].renderer().draw(capture.draw);
    return capture.text;
  };
  assert.equal(paint(0, 0).length, 3);
  assert.deepEqual(paint(0, -300), []);
  assert.deepEqual(paint(-90, 0), []);
  assert.deepEqual(paint(0, 0).map(t => t.y), [50.5, 150.5, 100.5]);
});
