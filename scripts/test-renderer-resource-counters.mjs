import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// The module under test uses the app's "@/" alias, which only Next resolves.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const target = new URL(`../src/${specifier.slice(2)}`, import.meta.url);
      const withExtension = fileURLToPath(target).endsWith(".ts")
        ? target
        : pathToFileURL(`${fileURLToPath(target)}.ts`);
      return { url: withExtension.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

/**
 * The renderer health recorder's resource counters.
 *
 * The 08-25 trace named the crash: 276,938 event listeners in 148 seconds
 * while DOM nodes rose by 178. Heap alone only ever said "something grew".
 * Six sites were repaired and the crash returned, so the next report has to
 * arrive already carrying its cause - which means counting listeners,
 * intervals and observers in the user's own session.
 *
 * This drives the real module rather than asserting on its source text, so it
 * fails if the counting stops working rather than if the code moves.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// A browser small enough to boot the recorder, real enough to count against.
const store = new Map();
const listeners = [];
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = FakeResizeObserver;
globalThis.document = {
  getElementsByTagName: () => ({ length: 1_234 }),
  addEventListener: () => {},
  visibilityState: "visible",
};
globalThis.PerformanceObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.PerformanceObserver.supportedEntryTypes = [];
// The page itself is an EventTarget. Delegating rather than binding keeps the
// call going through the prototype, which is what the recorder wraps.
const pageBus = new EventTarget();
globalThis.addEventListener = (...args) => pageBus.addEventListener(...args);
globalThis.removeEventListener = (...args) => pageBus.removeEventListener(...args);
globalThis.dispatchEvent = (...args) => pageBus.dispatchEvent(...args);
globalThis.window = globalThis;
globalThis.setInterval = (fn, ms) => { const id = { fn, ms }; listeners.push(id); return id; };
globalThis.clearInterval = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.location = { href: "http://localhost/charts" };

const module = await import("../src/lib/rendererHealth.ts");
module.startRendererHealthRecorder();

const SNAPSHOT_KEY = "kwantdesk:renderer-health:active:v1";
const snapshot = () => {
  const raw = store.get(SNAPSHOT_KEY);
  return raw ? JSON.parse(raw) : null;
};
// The recorder writes on its own cadence; force one by running its timer body.
const tick = () => { for (const t of listeners) t.fn(); };

check("the recorder installs without a real browser", () => {
  tick();
  assert.ok(snapshot(), "no snapshot was written");
});

check("a listener that is added and removed nets to zero", () => {
  tick();
  const before = snapshot().listeners;
  const target = new EventTarget();
  const handler = () => {};
  target.addEventListener("mousemove", handler);
  target.addEventListener("mousemove", handler);
  tick();
  assert.equal(snapshot().listeners, before + 2, "additions were not counted");
  target.removeEventListener("mousemove", handler);
  target.removeEventListener("mousemove", handler);
  tick();
  assert.equal(snapshot().listeners, before, "removals did not net out");
});

check("a listener that is never removed keeps climbing", () => {
  // This is the defect itself: an effect that installs and never tears down.
  tick();
  const before = snapshot().listeners;
  const target = new EventTarget();
  for (let i = 0; i < 500; i += 1) target.addEventListener("pointermove", () => {});
  tick();
  assert.equal(snapshot().listeners - before, 500, "a leak would not have shown");
});

check("the report names the busiest listener type", () => {
  tick();
  const types = snapshot().listenerTypes;
  assert.match(types, /pointermove \d+/, `expected pointermove to lead, got "${types}"`);
  // A count alone says a leak exists; the type says which effect to open.
  assert.ok(types.split(", ").length <= 4, "the field must stay a one-line summary");
});

check("listeners still reach their target", () => {
  // Counting must never change behaviour: the wrapper delegates and returns
  // whatever the browser returned.
  const target = new EventTarget();
  let fired = 0;
  const handler = () => { fired += 1; };
  target.addEventListener("ping", handler);
  target.dispatchEvent(new Event("ping"));
  assert.equal(fired, 1, "the patched addEventListener dropped the listener");
  target.removeEventListener("ping", handler);
  target.dispatchEvent(new Event("ping"));
  assert.equal(fired, 1, "the patched removeEventListener did not remove");
});

check("observers are counted and released", () => {
  tick();
  const before = snapshot().observers;
  const observer = new globalThis.ResizeObserver(() => {});
  tick();
  assert.equal(snapshot().observers, before + 1, "construction was not counted");
  observer.disconnect();
  tick();
  assert.equal(snapshot().observers, before, "disconnect did not net out");
});

check("the snapshot stays small enough to write every five seconds", () => {
  tick();
  // It goes to localStorage on a 5s cadence; the budget in the file header is
  // about a kilobyte, and a snapshot that outgrows it costs the main thread.
  assert.ok(
    JSON.stringify(snapshot()).length < 1_024,
    `snapshot is ${JSON.stringify(snapshot()).length} bytes`,
  );
});

console.log(`\nrenderer resource counters: ${passed}/${passed} checks passed`);
