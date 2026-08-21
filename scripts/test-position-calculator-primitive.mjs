import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const primitive = readFileSync("src/lib/positionCalculatorPrimitive.ts", "utf8");
const chart = readFileSync("src/components/Chart.tsx", "utf8");

// 1. The calculator resolves BOTH coordinates inside the chart's draw pass.
//    This is the whole point: same viewport snapshot as the candles, so it
//    cannot lag behind them.
const drawBody = primitive.slice(primitive.indexOf("private draw("));
assert.match(drawBody, /timeScale\.timeToCoordinate\(model\.startTime as Time\)/);
assert.match(drawBody, /timeScale\.timeToCoordinate\(model\.endTime as Time\)/);
assert.match(drawBody, /params\.series\.priceToCoordinate\(model\.entryPrice\)/);
assert.match(drawBody, /params\.series\.priceToCoordinate\(model\.stopPrice\)/);
assert.match(drawBody, /params\.series\.priceToCoordinate\(model\.targetPrice\)/);

// 2. Models carry prices and times ONLY. A screen coordinate in the model
//    would be computed in React and reintroduce the lag.
const modelType = primitive.slice(
  primitive.indexOf("export type PositionCalculatorModel"),
  primitive.indexOf("};", primitive.indexOf("export type PositionCalculatorModel")),
);
for (const banned of ["boxWidth", "entryY", "stopY", "targetY", "Coordinate"]) {
  assert.ok(!modelType.includes(banned), `the model must not carry ${banned}`);
}
assert.ok(modelType.includes("entryPrice") && modelType.includes("startTime"));

// 3. The SVG body is gone — only an invisible hit target remains, so the tool
//    stays clickable without drawing anything that can float.
const svgCase = chart.slice(
  chart.indexOf('      case "longPosition":'),
  chart.indexOf('      case "priceRange":'),
);
assert.ok(svgCase.includes('fill="transparent"'), "the hit target must be invisible");
for (const banned of ["withAlpha(profitColor", "strokeDasharray", "targetLabelX", "rewardRiskText"]) {
  assert.ok(!svgCase.includes(banned), `the SVG body must not still draw ${banned}`);
}

// 4. The primitive is attached to the candle series and released on teardown.
assert.match(chart, /candleSeries\.attachPrimitive\(positionCalculatorPrimitive\);/);
assert.match(chart, /positionCalculatorPrimitiveRef\.current = null;/);

// 5. Labels and handles still follow selection.
assert.match(drawBody, /if \(model\.selected && model\.showLabels\)/);
assert.match(drawBody, /if \(model\.selected\) \{/);

console.log("position calculator primitive: 5/5 checks passed");
