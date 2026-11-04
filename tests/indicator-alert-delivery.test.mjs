import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import test from "node:test";

function setup(replay = false, settings = {}) {
  const effects = [];
  const notices = [];
  const tones = [];
  class AudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    resume() { return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    createOscillator() {
      const tone = { frequency: { value: 0 }, connect() {}, disconnect() {}, start() { tones.push(this.frequency.value); }, stop() {} };
      return tone;
    }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const target = new EventTarget();
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(new URL("../src/components/useChartIndicatorAlertDelivery.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: module.exports, module,
    require: () => ({
      useRef: value => ({ current: value }),
      useState: () => [null, value => notices.push(value)],
      useEffect: callback => effects.push(callback),
    }),
    window: target, Date, Boolean, AudioContext, setTimeout: () => 1, clearTimeout() {},
  };
  vm.runInNewContext(source, context);
  module.exports.useChartIndicatorAlertDelivery([{ instanceId: "one", indicatorId: "test", enabled: true, settings }], "NQ", replay);
  const cleanup = effects.map(effect => effect());
  const emit = detail => {
    const event = new Event("kwantdesk:chart-indicator-alert");
    Object.defineProperty(event, "detail", { value: detail });
    target.dispatchEvent(event);
  };
  return { notices, tones, emit, cleanup: () => cleanup.forEach(fn => fn?.()) };
}

test("indicator alerts reach only the matching enabled chart instance", () => {
  const fixture = setup();
  fixture.emit({ instanceId: "other", indicatorId: "test", instrument: "NQ", title: "wrong instance" });
  fixture.emit({ instanceId: "one", indicatorId: "test", instrument: "ES", title: "wrong instrument" });
  fixture.emit({ instanceId: "one", indicatorId: "test", instrument: "NQ", title: "matched" });
  assert.deepEqual(fixture.notices.filter(Boolean), ["matched"]);
  fixture.cleanup();
});
test("replay and explicitly disabled popups remain silent", () => {
  for (const fixture of [setup(true), setup(false, { enablePopup: false })]) {
    fixture.emit({ instanceId: "one", indicatorId: "test", instrument: "NQ", title: "hidden" });
    assert.deepEqual(fixture.notices.filter(Boolean), []);
    fixture.cleanup();
  }
});
test("duplicate events are delivered once and cleanup removes the receiver", () => {
  const fixture = setup();
  const detail = { instanceId: "one", indicatorId: "test", instrument: "NQ", title: "matched" };
  fixture.emit(detail); fixture.emit(detail); fixture.cleanup();
  fixture.emit({ ...detail, title: "after unmount" });
  assert.deepEqual(fixture.notices.filter(Boolean), ["matched"]);
});
test("the configured alert tone is played while explicit sound-off stays silent", async () => {
  const fixture = setup(false, { inAppSound: true, alertTone: "bell" });
  const detail = { instanceId: "one", indicatorId: "test", instrument: "NQ", title: "bell", popup: false };
  fixture.emit(detail);
  await Promise.resolve();
  assert.deepEqual(fixture.tones, [1046]);
  fixture.emit({ ...detail, title: "muted", sound: null });
  await Promise.resolve();
  assert.deepEqual(fixture.tones, [1046]);
  fixture.cleanup();
});
