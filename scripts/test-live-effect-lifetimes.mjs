import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profile = readFileSync("src/components/gexbot/GexBotLightweightCharts.tsx", "utf8");
const dashboard = readFileSync("src/components/gexbot/GexBoxDashboard.tsx", "utf8");

const observerIndex = profile.indexOf("const resize = new ResizeObserver(draw)");
assert.ok(observerIndex >= 0, "GEX profile ResizeObserver must exist");
const lifecycleStart = profile.lastIndexOf("useLayoutEffect(() => {", observerIndex);
const lifecycleEnd = profile.indexOf("// Market frames and appearance updates", observerIndex);
const lifecycle = profile.slice(lifecycleStart, lifecycleEnd);

assert.match(lifecycle, /\}, \[chart, priceSeries\]\);/);
const dependencyList = lifecycle.match(/\}, \[([^\]]*)\]\);\s*$/)?.[1] ?? "";
assert.equal(dependencyList.trim(), "chart, priceSeries");
assert.doesNotMatch(dependencyList, /\b(frame|frames|strikes|appearance|dataset|palette|profileScale)\b/,
  "live GEX frames must not rebind DOM listeners or ResizeObserver instances");
assert.match(profile, /const drawStateRef = useRef\(/);
assert.match(profile, /drawStateRef\.current = \{ frame, frames, strikes, dataset, appearance, palette, profileScale \}/);
assert.match(profile, /drawRef\.current\(\);/);

const intervalCanvasStart = dashboard.indexOf("function IntervalCanvas(");
const intervalCanvasEnd = dashboard.indexOf("function intervalValue(", intervalCanvasStart);
const intervalCanvas = dashboard.slice(intervalCanvasStart, intervalCanvasEnd);
assert.match(intervalCanvas, /const drawStateRef = useRef\(\{ payload, settings \}\)/);
assert.match(intervalCanvas, /const observer = new ResizeObserver\(scheduleDraw\)/);
assert.match(intervalCanvas, /\}, \[\]\);/,
  "interval canvas observer lifecycle must not depend on live payloads");

const professionalStart = dashboard.indexOf("function ProfessionalIntervalMap(");
const professionalEnd = dashboard.indexOf("function compact(", professionalStart);
const professional = dashboard.slice(professionalStart, professionalEnd);
assert.match(professional, /const drawStateRef = useRef\(\{ model, settings, viewport \}\)/);
assert.match(professional, /\}, \[hasRenderablePoints\]\);/,
  "professional interval observer lifecycle may change only when renderability changes");

const seriesStart = dashboard.indexOf("function SeriesPanel(");
const seriesEnd = dashboard.indexOf("function GexBoxPanel", seriesStart);
const seriesPanel = dashboard.slice(seriesStart, seriesEnd);
assert.match(seriesPanel, /const drawStateRef = useRef\(\{ rows, series, settings \}\)/);
assert.match(seriesPanel, /\}, \[hasSeries\]\);/,
  "series observer lifecycle may change only when renderability changes");

assert.match(dashboard, /window\.clearTimeout\(timer\)/,
  "setTimeout-backed shared feed disposal must use clearTimeout");

console.log("live effect lifetimes: 13/13 checks passed");
