export type AuctionGapHistoryRequest = {
  symbol: string; contractSymbol?: string; timeframe: string; fromMs: number; toMs: number;
};
export type AuctionGapHistoryResponse = {
  revision: number;
  request: Readonly<AuctionGapHistoryRequest>;
  /** Original response, before persistence merging or display-tape compaction.
   * Untrusted: truncated=false is NOT proof of complete exchange history.
   */
  payload: Readonly<Record<string, unknown>>;
};
type Listener = (response: AuctionGapHistoryResponse) => void;

/** No fetching, timers, caching, persistence or new feed subscriptions. A
 * chart consumer listens before its existing order-flow request finishes.
 * Nothing retains large response bodies after synchronous listener delivery.
 * Consumers must validate response contract, original side/schema metadata,
 * source coverage and candle reconciliation before using an execution seed.
 */
export class AuctionGapHistorySource {
  private listeners = new Map<string, Set<Listener>>();
  private revision = 0;
  private key(symbol: string, contract: string) { return JSON.stringify([symbol, contract]); }

  subscribe(symbol: string, contract: string, listener: Listener): () => void {
    if (!symbol || !contract) throw new Error("Auction Gap history requires an explicit symbol and contract");
    const key = this.key(symbol, contract);
    const listeners = this.listeners.get(key) ?? new Set<Listener>();
    listeners.add(listener); this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size && this.listeners.get(key) === listeners) this.listeners.delete(key);
    };
  }

  publish(request: AuctionGapHistoryRequest, payload: Record<string, unknown>): void {
    if (!request.contractSymbol) return;
    const listeners = this.listeners.get(this.key(request.symbol, request.contractSymbol));
    if (!listeners?.size) return;
    const response = Object.freeze({ revision: ++this.revision, request: Object.freeze({ ...request }), payload });
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue;
      try { listener(response); }
      catch { /* An optional study must not fail the shared history request. */ }
    }
  }

  get subscriberCount() {
    let count = 0; for (const listeners of this.listeners.values()) count += listeners.size;
    return count;
  }
}

export const auctionGapHistorySource = new AuctionGapHistorySource();
