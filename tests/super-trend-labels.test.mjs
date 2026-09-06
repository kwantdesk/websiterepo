import { test } from "node:test";
import assert from "node:assert/strict";
import { SuperTrendLabels } from "../src/lib/superTrendLabels.ts";

const options = { name: "ST", nameLabel: true, valueLabel: true, nameBackground: true,
  valueBackground: false, chartColorForMarker: false };
function harness() {
  const labels = new SuperTrendLabels(), calls = [];
  let redraws = 0;
  const context = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    measureText: text => ({ width: text.length * 6 }),
    fillRect(...args) { calls.push({ kind: "box", args, color: this.fillStyle }); },
    strokeRect() {},
    fillText(text, ...args) { calls.push({ kind: "text", text, args, color: this.fillStyle }); },
  };
  labels.attached({ chart: { timeScale: () => ({ timeToCoordinate: time => time }) },
    series: { priceToCoordinate: value => value }, requestUpdate: () => redraws++ });
  const draw = () => labels.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: fn => fn({ context, mediaSize: { width: 200, height: 120 } }) });
  return { labels, calls, draw, redraws: () => redraws };
}

test("real label primitive uses visible point, independent backgrounds and current point colour", () => {
  const h = harness();
  h.labels.update([{ time: 100, value: 50, color: "#ff8800" }, { time: 300, value: 70 }], options, "#111111", "#00ff00", 2);
  h.draw();
  assert.equal(h.redraws(), 1);
  assert.deepEqual(h.calls.filter(c => c.kind === "text").map(c => c.text), ["ST", "50.00"]);
  assert.equal(h.calls.filter(c => c.kind === "box").length, 1);
  assert.equal(h.calls.find(c => c.kind === "box").color, "#ff8800");
  assert.equal(h.calls.find(c => c.text === "ST").color, "#111111");
  assert.equal(h.calls.find(c => c.text === "50.00").color, "#ff8800");
});

test("marker background choice, precision, label toggles and detach clear output", () => {
  const h = harness();
  h.labels.update([{ time: 100, value: 50.125 }], { ...options, nameLabel: false,
    valueBackground: true, chartColorForMarker: true }, "#112233", "#abcdef", 3);
  h.draw();
  assert.equal(h.calls.find(c => c.kind === "box").color, "#112233");
  assert.equal(h.calls.find(c => c.kind === "text").text, "50.125");
  h.calls.length = 0;
  h.labels.detached(); h.draw(); assert.deepEqual(h.calls, []);
});

test("offscreen values and both labels disabled do not paint stale chips", () => {
  const h = harness();
  h.labels.update([{ time: 300, value: 50 }, { time: 100, value: 150 }], options, "#000000", "#ffffff", 2);
  h.draw(); assert.deepEqual(h.calls, []);
  h.labels.update([{ time: 100, value: 50 }], { ...options, nameLabel: false, valueLabel: false }, "#000000", "#ffffff", 2);
  h.draw(); assert.deepEqual(h.calls, []);
});
