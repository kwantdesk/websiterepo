import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  HORIZONTAL_EXTENSION_TOOLS,
  horizontalExtensionBounds,
  normalizeDrawings,
} from "../src/lib/chartDrawTools.ts";

test("horizontal bounds extend to exactly the requested plot edges", () => {
  assert.deepEqual(horizontalExtensionBounds(180, 420, 900, "none"), { left: 180, right: 420 });
  assert.deepEqual(horizontalExtensionBounds(420, 180, 900, "left"), { left: 0, right: 420 });
  assert.deepEqual(horizontalExtensionBounds(420, 180, 900, "right"), { left: 180, right: 900 });
  assert.deepEqual(horizontalExtensionBounds(420, 180, 900, "both"), { left: 0, right: 900 });
  assert.deepEqual(horizontalExtensionBounds(180, 420, 900, "both", 2_000), { left: -2_000, right: 2_900 });
});

test("existing drawings remain unextended and new choices survive persistence", () => {
  const base = {
    id: "rect-1",
    tool: "rectangle",
    points: [{ time: 1, price: 10 }, { time: 2, price: 20 }],
    style: { color: "#fff", width: 1, lineStyle: "solid", fillOpacity: 0.1, showLabels: true },
  };
  const oldDrawing = normalizeDrawings([base])[0];
  assert.equal(oldDrawing.style.horizontalExtension, "none");

  const savedDrawing = normalizeDrawings([{ ...base, style: { ...base.style, horizontalExtension: "right" } }])[0];
  assert.equal(savedDrawing.style.horizontalExtension, "right");
});

test("only tools with meaningful horizontal geometry expose extension controls", () => {
  assert.deepEqual([...HORIZONTAL_EXTENSION_TOOLS].sort(), ["fibRetracement", "rectangle"]);

  const settings = readFileSync(new URL("../src/components/ChartDrawSettings.tsx", import.meta.url), "utf8");
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  assert.match(settings, /label="Extend"/);
  assert.match(settings, /\["left", "Left"\]/);
  assert.match(settings, /\["right", "Right"\]/);
  assert.match(settings, /\["both", "Both"\]/);
  assert.ok((layer.match(/horizontalExtensionBounds\(/g) ?? []).length >= 4,
    "renderer and both pointer hit paths must share the edge geometry");
});
