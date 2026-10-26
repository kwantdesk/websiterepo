import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { beginPaperProtectionDrag } from "../src/lib/paperProtectionDrag.ts";
import { snapPaperPrice, updatePaperProtection, emptyPaperTradingLedger, placePaperOrder } from "../src/lib/paperTrading.ts";

const source = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
function fixture({ scale = 2, autoScale = true } = {}) {
  const capture = new Set(), listeners = new Map(), events = [], frames = new Map();
  let auto = autoScale, interactions = { handleScroll: { pressedMouseMove: true }, handleScale: { mouseWheel: true } };
  const plot = { clientHeight: 400, getBoundingClientRect: () => ({ top: 100, height: 400 * scale }),
    setPointerCapture: id => capture.add(id), hasPointerCapture: id => capture.has(id), releasePointerCapture: id => capture.delete(id),
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const priceScale = { options: () => ({ autoScale: auto }), setAutoScale: value => { auto = value; } };
  const series = { priceToCoordinate: price => 30000 - price, coordinateToPrice: y => 30000 - y, priceScale: () => priceScale };
  const chart = { options: () => interactions, applyOptions: value => { interactions = value; } };
  const originalInteractions = interactions;
  const event = (clientY, pointerId = 7) => ({ button: 0, clientY, pointerId, preventDefault() {}, stopPropagation() {} });
  const context = { beginPaperProtectionDrag, chartContainerRef: { current: plot }, candleSeriesRef: { current: series }, chartRef: { current: chart },
    paperActiveDragRef: { current: null }, paperDragCancelRef: { current: null },
    onPaperProtectionDragStateChange: (...args) => events.push(["drag", ...args]),
    onUpdatePaperProtection: (...args) => events.push(["commit", ...args]), onUpdatePaperOrderPrice: (...args) => events.push(["order", ...args]),
    constrainedPaperProtectionPrice: (_position, _kind, price) => snapPaperPrice("NQ", price),
    constrainDraggedPaperOrderPrice: (_order, price) => snapPaperPrice("NQ", price), visibleWorkingOrders: [],
    repositionPaperOverlays: () => events.push(["paint", context.paperActiveDragRef.current?.price]),
    setPaperDragPreview: value => events.push(["preview", value]), setPaperDraftProtection: value => events.push(["draft", value]),
    document: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
      requestAnimationFrame: fn => { frames.set(1, fn); return 1; }, cancelAnimationFrame: id => frames.delete(id) },
  };
  const block = source.slice(source.indexOf("  const startPaperProtectionDrag ="), source.indexOf("  const removePaperProtection ="));
  vm.runInNewContext(ts.transpileModule(block + "\nglobalThis.handlers={startPaperProtectionDrag,startNewPaperProtectionDrag};", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const position = { id: "position", accountId: "account", symbol: "NQ", side: "buy", entryPrice: 29900, remainingQuantity: 2 };
  return { ...context, events, listeners, frames, capture, event, position, handlers: context.handlers,
    autoScale: () => auto, interactions: () => interactions, originalInteractions };
}

for (const kind of ["stop_loss", "take_profit"]) {
  for (const scale of [0.75, 1, 2]) {
    test(`${kind} at ${scale}x: no grab jump, final pointerup wins, and chart gestures restore`, () => {
      const h = fixture({ scale });
      const level = { id: "level", kind, targetId: "target", price: 29900, position: h.position };
      const start = 100 + 105 * scale; // grab five chart pixels below the level
      h.handlers.startPaperProtectionDrag(h.event(start), level);
      assert.equal(h.autoScale(), false);
      assert.equal(h.interactions().handleScroll, false);
      assert.ok(h.capture.has(7));
      h.listeners.get("pointermove")(h.event(start));
      h.frames.get(1)();
      assert.equal(h.paperActiveDragRef.current.price, 29900);
      h.listeners.get("pointerup")(h.event(start + 30 * scale));
      const commit = h.events.find(row => row[0] === "commit");
      assert.equal(commit[3].price, 29870);
      if (kind === "take_profit") assert.equal(commit[3].targetId, "target");
      assert.equal(h.autoScale(), true);
      assert.deepEqual(h.interactions(), h.originalInteractions);
      assert.equal(h.capture.size, 0);
      assert.deepEqual(h.events.at(-1), ["drag", "position", false]);
    });
  }
}

test("new protection handles use the same stable projection and commit final release", () => {
  const h = fixture();
  h.handlers.startNewPaperProtectionDrag(h.event(310), h.position, "stop_loss");
  h.listeners.get("pointerup")(h.event(370));
  assert.equal(h.events.find(row => row[0] === "commit")[3].price, 29870);
});

test("pointer cancellation, capture loss, blur and source cleanup never commit", () => {
  for (const cancel of ["pointercancel", "lostpointercapture", "blur", "source"]) {
    const h = fixture({ autoScale: false });
    h.handlers.startPaperProtectionDrag(h.event(310), { id: "level", kind: "stop_loss", price: 29900, position: h.position });
    if (cancel === "source") h.paperDragCancelRef.current(); else h.listeners.get(cancel)(h.event(370));
    assert.equal(h.events.some(row => row[0] === "commit"), false);
    assert.equal(h.capture.size, 0);
    assert.equal(h.autoScale(), false);
    assert.equal(h.paperDragCancelRef.current, null);
    assert.equal(h.listeners.size, 0);
  }
});

test("unrelated pointers cannot release another pointer's protection", () => {
  const h = fixture();
  h.handlers.startPaperProtectionDrag(h.event(310), { id: "level", kind: "stop_loss", price: 29900, position: h.position });
  h.listeners.get("pointerup")(h.event(370, 8));
  assert.equal(h.events.some(row => row[0] === "commit"), false);
  assert.ok(h.capture.has(7));
  h.paperDragCancelRef.current();
});

test("release stores the chosen tick instead of silently moving the stop to a later quote", () => {
  const record = { id: "account", name: "fixture", balance: "$50,000", leverage: "1:30" };
  const result = placePaperOrder(emptyPaperTradingLedger(), [record], { accountId: record.id, symbol: "NQ", side: "buy", type: "market", quantity: 1, price: null, stopLoss: null, takeProfits: [] }, { bid: 29900, ask: 29900, timestamp: 1793000000000 });
  const position = result.ledger.accounts.account.positions[0];
  const updated = updatePaperProtection(result.ledger, record.id, position.id, { kind: "stop_loss", price: 29901.13 });
  assert.equal(updated.ledger.accounts.account.positions[0].stopLoss, 29901.25);
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /updatePaperProtection\(current, accountId, positionId, update\)/);
  assert.doesNotMatch(workspace, /price: constrainDraggedPaperStop\(/);
});
