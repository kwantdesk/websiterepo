import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { publishChartAnnotations, readChartAnnotations, removeChartAnnotations, subscribeChartAnnotations } from "../src/lib/chartAnnotationRegistry.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";

const series = { key: "swing", groupKey: "source-instance", label: "Swing High", kind: "line", placement: "overlay", color: "#abcdef", data: [{ time: 1, value: 100 }] };

test("registry mirrors a source indicator by instance or catalogue id and notifies", () => {
  let revisions = 0;
  const unsubscribe = subscribeChartAnnotations(() => { revisions += 1; });
  publishChartAnnotations("chart-a", [{ indicatorId: "swing-point", instanceId: "source-instance", series: [series] }]);
  assert.deepEqual(readChartAnnotations("chart-a", "source-instance"), [series]);
  assert.deepEqual(readChartAnnotations("chart-a", "SWING-POINT"), [series]);
  assert.deepEqual(readChartAnnotations("missing", "swing-point"), []);
  removeChartAnnotations("chart-a");
  unsubscribe();
  assert.equal(revisions, 2);
});

test("source selection persists and release gates are active", () => {
  const defaults = defaultIndicatorSettings("annotations-overlay");
  const restored = normalizePaneIndicatorState({ pane: [{ instanceId: "target", indicatorId: "annotations-overlay", enabled: true, settings: { ...defaults, sourceChartId: " chart-a ", sourceIndicatorId: " swing-point " } }] }).pane[0];
  assert.deepEqual([restored.settings.sourceChartId, restored.settings.sourceIndicatorId], ["chart-a", "swing-point"]);
  assert.ok(!auditIndicatorLibrary().pending.some((entry) => entry.id === "annotations-overlay"));
});

test("chart publishes raw source annotations and aligns the imported copy locally", () => {
  const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const controls = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  assert.match(chart, /publishChartAnnotations\(chartInstanceId/);
  assert.match(chart, /readChartAnnotations\(sourceChartId, sourceIndicatorId\)/);
  assert.match(chart, /\[\.\.\.baseCalculatedIndicatorSeries, \.\.\.annotationOverlaySeries\]/);
  for (const label of ["Source chart ID", "Source indicator ID", "This chart ID", "Preserve source colours"]) assert.match(controls, new RegExp(label, "i"));
});
