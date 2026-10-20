// The market feed remains read-only. This forwards genuine packets to the
// host's existing paper execution engine; never create orders in the iframe.
export function executableBook(snapshot, symbol, metadata = {}, now = Date.now()) {
  if (metadata.historical || metadata.visualHold || snapshot.readOnly !== true) return null;
  const { tickSize, bestBid, bestAsk, timestamp } = snapshot;
  if (![tickSize, bestBid, bestAsk, timestamp].every(v => typeof v === 'number' && Number.isFinite(v))
    || tickSize <= 0 || bestBid <= 0 || bestAsk < bestBid || now - timestamp > 5000 || timestamp - now > 1000) return null;
  return { type: 'kwantdesk:liquidity-map-execution-quote', source: 'live', symbol,
    bid: bestBid * tickSize, ask: bestAsk * tickSize, timestamp };
}

export function executablePrint(book, tick, timestamp, tickSize, symbol, now = Date.now()) {
  if (!book || book.symbol !== symbol || ![tick, timestamp, tickSize].every(Number.isFinite)
    || tick <= 0 || tickSize <= 0 || timestamp < book.timestamp || timestamp - book.timestamp > 5000
    || now - timestamp > 5000 || timestamp - now > 1000) return null;
  return { ...book, timestamp, last: tick * tickSize };
}
