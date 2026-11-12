import assert from "node:assert/strict";
import { BigTradesPrimitive } from "../src/lib/bigTradesPrimitive.ts";

function render(overrides = {}) {
  const rectangles = [];
  const fills = [];
  const labels = [];
  let path;
  const context = {
    save() {}, restore() {}, rect() {}, clip() {}, stroke() {}, strokeText() {},
    beginPath() { path = null; },
    arc() { path = null; },
    roundRect(...bounds) { path = bounds; rectangles.push(bounds); },
    fill() { if (path) fills.push({ bounds: path, color: this.fillStyle }); },
    measureText(text) { return { width: text.length * 4.5 }; },
    fillText(text, x, y) { labels.push({ text, x, y }); },
  };
  const primitive = new BigTradesPrimitive();
  primitive.attached({
    chart: { timeScale: () => ({ getVisibleRange: () => null, timeToCoordinate: () => 50 }) },
    series: { priceToCoordinate: () => 50 },
    requestUpdate() {},
  });
  primitive.update([{
    id: "trade", time: 1, price: 100, volume: 106, executions: 1,
    side: "ASK", radius: 4, opacity: 1,
  }], {
    askColor: "#808080", bidColor: "#ffffff", markerType: "square", hollowFill: false,
    informationMode: "volume", showLabels: true, labelMinSize: 1,
    textColor: "#ffffff", backgroundColor: "#000000", showProjection: false,
    ...overrides,
  });
  primitive.paneViews()[0].renderer().draw({
    useMediaCoordinateSpace: (draw) => draw({ context, mediaSize: { width: 100, height: 100 } }),
  });
  return { rectangles, fills, labels };
}

const volume = render();
assert.deepEqual(volume.labels, [{ text: "106", x: 50, y: 50 }]);
assert.equal(volume.rectangles.length, 1);
assert.equal(volume.fills[0].color, "#808080");
const [left, top, width, height] = volume.fills[0].bounds;
assert.equal(width, height);
assert.equal(left + width / 2, 50);
assert.equal(top + height / 2, 50);
assert.ok(width >= 13.5 + 4);

const detailed = render({ informationMode: "full" });
assert.equal(detailed.rectangles[0][2], 24);
assert.equal(detailed.fills.at(-1).color, "#000000");
const [, badgeTop, , badgeHeight] = detailed.fills.at(-1).bounds;
assert.equal(badgeTop + badgeHeight / 2, detailed.labels[0].y);

assert.equal(render({ hollowFill: true }).fills.length, 0);
const noLabel = render({ labelMinSize: 5 });
assert.equal(noLabel.rectangles[0][2], 8);
assert.equal(noLabel.labels.length, 0);

const circle = render({ markerType: "circle" });
assert.equal(circle.rectangles.length, 0);
assert.equal(circle.labels[0].y, 40.75);

console.log("Small square background, overflow backing, anchor, hollow and label threshold checks passed");
