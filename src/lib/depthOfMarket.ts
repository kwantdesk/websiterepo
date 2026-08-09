export type DepthLevelInput = {
  side: "BID" | "ASK";
  price: number;
  size: number;
  orders?: number;
  addedSize?: number;
  removedSize?: number;
};

export type DepthLadderRow = {
  price: number;
  bidSize: number;
  askSize: number;
  bidOrders: number;
  askOrders: number;
  bidCumulative: number;
  askCumulative: number;
  bidPullStack: number;
  askPullStack: number;
};

export type DepthLadderModel = {
  rows: DepthLadderRow[];
  bestBid: number | null;
  bestAsk: number | null;
  increment: number;
  maxDepth: number;
  maxCumulative: number;
  bidTotal: number;
  askTotal: number;
  imbalance: number;
};

function finite(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Builds a display-only DOM ladder from the exchange book. Cumulative depth is
 * calculated outwards from the inside market on each side, matching
 * professional DOM conventions rather than summing both sides top-to-bottom.
 */
export function buildDepthLadder(args: {
  levels: DepthLevelInput[];
  tickSize: number;
  groupTicks: number;
  rowCount: number;
  centrePrice?: number | null;
  centreOffsetTicks?: number;
}): DepthLadderModel {
  const tickSize = Math.max(0.000_001, finite(args.tickSize, 0.25));
  const groupTicks = Math.max(1, Math.round(finite(args.groupTicks, 1)));
  const increment = tickSize * groupTicks;
  const requestedRows = Math.max(3, Math.round(finite(args.rowCount, 41)));
  const rowCount = requestedRows % 2 === 0 ? requestedRows + 1 : requestedRows;
  const grouped = new Map<number, Omit<DepthLadderRow, "bidCumulative" | "askCumulative">>();

  for (const level of args.levels) {
    const key = Math.round(finite(level.price) / increment);
    const current = grouped.get(key) ?? {
      price: key * increment,
      bidSize: 0,
      askSize: 0,
      bidOrders: 0,
      askOrders: 0,
      bidPullStack: 0,
      askPullStack: 0,
    };
    const size = Math.max(0, finite(level.size));
    const orders = Math.max(0, Math.round(finite(level.orders)));
    const pullStack = finite(level.addedSize) - finite(level.removedSize);
    if (level.side === "BID") {
      current.bidSize += size;
      current.bidOrders += orders;
      current.bidPullStack += pullStack;
    } else {
      current.askSize += size;
      current.askOrders += orders;
      current.askPullStack += pullStack;
    }
    grouped.set(key, current);
  }

  const allRows = [...grouped.values()];
  const bidPrices = allRows.filter((row) => row.bidSize > 0).map((row) => row.price);
  const askPrices = allRows.filter((row) => row.askSize > 0).map((row) => row.price);
  const bestBid = bidPrices.length ? Math.max(...bidPrices) : null;
  const bestAsk = askPrices.length ? Math.min(...askPrices) : null;
  const bookMid = bestBid !== null && bestAsk !== null
    ? (bestBid + bestAsk) / 2
    : bestBid ?? bestAsk ?? 0;
  const centrePrice = finite(args.centrePrice, bookMid) || bookMid;
  const centreKey = Math.round(centrePrice / increment)
    + Math.round(finite(args.centreOffsetTicks));
  const half = Math.floor(rowCount / 2);
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const key = centreKey + half - index;
    const current = grouped.get(key) ?? {
      price: key * increment,
      bidSize: 0,
      askSize: 0,
      bidOrders: 0,
      askOrders: 0,
      bidPullStack: 0,
      askPullStack: 0,
    };
    return { ...current, bidCumulative: 0, askCumulative: 0 };
  });

  let bidCumulative = 0;
  for (const row of rows) {
    if (bestBid !== null && row.price <= bestBid + increment / 2) {
      bidCumulative += row.bidSize;
      row.bidCumulative = bidCumulative;
    }
  }
  let askCumulative = 0;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (bestAsk !== null && row.price >= bestAsk - increment / 2) {
      askCumulative += row.askSize;
      row.askCumulative = askCumulative;
    }
  }

  const bidTotal = allRows.reduce((sum, row) => sum + row.bidSize, 0);
  const askTotal = allRows.reduce((sum, row) => sum + row.askSize, 0);
  const total = bidTotal + askTotal;
  return {
    rows,
    bestBid,
    bestAsk,
    increment,
    maxDepth: Math.max(1, ...rows.flatMap((row) => [row.bidSize, row.askSize])),
    maxCumulative: Math.max(1, ...rows.flatMap((row) => [row.bidCumulative, row.askCumulative])),
    bidTotal,
    askTotal,
    imbalance: total > 0 ? (bidTotal - askTotal) / total : 0,
  };
}

