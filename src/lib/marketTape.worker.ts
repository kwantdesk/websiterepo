/**
 * Market-data worker: owns every execution feed the page is subscribed to.
 *
 * Parsing, dedup, tape maintenance and batching all happen here, so a busy
 * tape can no longer take milliseconds away from React and canvas painting on
 * the UI thread. The main thread receives finished batches and nothing else.
 */
import { createExecutionTapeEngine, type ExecutionTapeEngine } from "@/lib/executionTapeEngine";

type InboundMessage =
  | { type: "subscribe"; key: string; symbol: string; contractSymbol: string }
  | { type: "unsubscribe"; key: string };

const engines = new Map<string, ExecutionTapeEngine>();
const post = (message: unknown) => (self as unknown as Worker).postMessage(message);

self.addEventListener("message", (event: MessageEvent<InboundMessage>) => {
  const message = event.data;
  if (!message) return;

  if (message.type === "subscribe") {
    if (engines.has(message.key)) return;
    const key = message.key;
    const engine = createExecutionTapeEngine(message.symbol, message.contractSymbol, {
      onStatus: (status) => post({ type: "status", key, status }),
      onSeed: (records) => post({ type: "seed", key, records }),
      onTrades: (records) => post({ type: "trades", key, records }),
    });
    engines.set(key, engine);
    engine.start();
    return;
  }

  if (message.type === "unsubscribe") {
    engines.get(message.key)?.stop();
    engines.delete(message.key);
  }
});
