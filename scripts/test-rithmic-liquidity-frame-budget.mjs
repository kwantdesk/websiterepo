import assert from "node:assert/strict";

let nextAnimationFrameId = 1;
const animationFrames = new Map();

globalThis.window = {
  requestAnimationFrame(callback) {
    const id = nextAnimationFrameId++;
    animationFrames.set(id, callback);
    return id;
  },
  cancelAnimationFrame(id) {
    animationFrames.delete(id);
  },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
globalThis.document = { visibilityState: "visible" };

let latestSource = null;
class MockEventSource {
  constructor(url) {
    this.url = url;
    this.closed = false;
    this.listeners = new Map();
    latestSource = this;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  emit(type, payload) {
    this.listeners.get(type)?.({ data: JSON.stringify(payload) });
  }

  close() {
    this.closed = true;
  }
}
globalThis.EventSource = MockEventSource;

const { subscribeRithmicLiquidity } = await import("../src/lib/rithmicLiquidityStream.ts");

const snapshots = [];
const unsubscribe = subscribeRithmicLiquidity({
  root: "NQ",
  contractSymbol: "NQU6",
  exchange: "CME",
  onSnapshot(snapshot) {
    snapshots.push(snapshot);
  },
});

assert.ok(latestSource, "the shared market-data stream must connect");

for (let index = 1; index <= 500; index += 1) {
  latestSource.emit("depth", {
    status: {
      connected: true,
      fullDepth: true,
      bookValid: true,
      contractSymbol: "NQU6",
      individualOrders: true,
    },
    snapshot: {
      id: index,
      timestamp: 1_786_400_000_000 + index,
      tickSize: 0.25,
      bids: [[120_000 + index, index, 1, index]],
      asks: [[120_002 + index, index + 1, 1, index + 1]],
      bestBid: 120_000 + index,
      bestAsk: 120_002 + index,
      lastTick: 120_001 + index,
      trades: [{ id: index, timestamp: index, tick: 120_001 + index, size: 1, side: "buy" }],
      orderEvents: [{
        sequence: index,
        timestamp: index,
        orderId: `order-${index}`,
        action: "ADD",
        side: "BID",
        price: (120_000 + index) * 0.25,
        previousPrice: null,
        size: 1,
        previousSize: 0,
      }],
    },
  });
}

assert.equal(snapshots.length, 0, "raw exchange traffic must not render between browser paints");
assert.equal(animationFrames.size, 1, "a burst must schedule one browser paint, not one paint per message");

const flushDepth = [...animationFrames.values()][0];
animationFrames.clear();
flushDepth(performance.now());

assert.equal(snapshots.length, 1, "the full live burst must publish one authoritative depth frame");
assert.equal(snapshots[0].trades.length, 500, "every intervening execution must be retained");
assert.equal(snapshots[0].orderEvents.length, 500, "every intervening lifecycle event must be retained");
assert.equal(snapshots[0].lastPrice, (120_001 + 500) * 0.25, "the newest live price must win");
assert.equal(snapshots[0].levels.length, 2, "only the newest authoritative book rows should be materialized");

const depthRows = snapshots[0].levels;
for (let index = 1; index <= 500; index += 1) {
  latestSource.emit("tick", {
    timestamp: 1_786_400_100_000 + index,
    tick: 120_500 + index,
    contractSymbol: "NQU6",
  });
}

assert.equal(animationFrames.size, 1, "price bursts must also share one browser paint");
const flushTick = [...animationFrames.values()][0];
animationFrames.clear();
flushTick(performance.now());

assert.equal(snapshots.length, 2, "the tick burst must publish only its newest price");
assert.equal(snapshots[1].lastPrice, (120_500 + 500) * 0.25);
assert.equal(snapshots[1].levels, depthRows, "price-only frames must reuse the immutable depth rows");
assert.deepEqual(snapshots[1].trades, [], "price frames must not replay old executions");
assert.deepEqual(snapshots[1].orderEvents, [], "price frames must not replay old order events");

unsubscribe();
assert.equal(latestSource.closed, true, "the final subscriber must close the shared EventSource");
assert.equal(animationFrames.size, 0, "the final subscriber must cancel queued browser work");

console.log("Rithmic liquidity frame-budget tests passed");
