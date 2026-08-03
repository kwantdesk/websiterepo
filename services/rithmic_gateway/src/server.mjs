import { createServer } from "node:http";
import { URL } from "node:url";

import { loadConfig } from "./config.mjs";
import { discoverRithmicSystems, RithmicMarketDataClient } from "./rithmic-client.mjs";
import { RTraderExcelMarketDataClient } from "./rtrader-excel-client.mjs";

const config = loadConfig();
const client = config.sourceMode === "rtrader-excel"
  ? new RTraderExcelMarketDataClient(config)
  : new RithmicMarketDataClient(config);
const rawSseClients = new Set();
const tradeSseClients = new Set();
const heatmapSseClients = new Set();

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function authorized(request) {
  if (!config.gatewayToken) return false;
  const value = String(request.headers.authorization || "");
  return value.startsWith("Bearer ") && value.slice(7).trim() === config.gatewayToken;
}

async function bodyJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requestedInstrument(url, body = {}) {
  const requestedSymbol = String(
    body.contractSymbol ||
      body.symbol ||
      body.root ||
      url.searchParams.get("contractSymbol") ||
      url.searchParams.get("symbol") ||
      url.searchParams.get("root") ||
      "",
  ).toUpperCase();
  const requestedRoot = contractRoot(String(body.root || requestedSymbol).toUpperCase());
  const requestedExchange = String(
    body.exchange || url.searchParams.get("exchange") || "",
  ).toUpperCase();
  const candidates = client.book
    .list()
    .filter((row) => contractRoot(row.symbol) === requestedRoot)
    .sort((left, right) => {
      const statusRank = (value) => value === "LIVE" ? 2 : value === "STALE" ? 1 : 0;
      return statusRank(right.status) - statusRank(left.status);
    });
  const exact = candidates.find((row) => row.symbol === requestedSymbol);
  const resolved = exact || candidates[0];
  return {
    exchange: requestedExchange || resolved?.exchange || exchangeForRoot(requestedRoot),
    symbol: resolved?.symbol || (
      requestedSymbol && requestedSymbol !== requestedRoot
        ? requestedSymbol
        : activeContractSymbol(requestedRoot)
    ),
  };
}

function tickSize(symbol) {
  if (/^(ES|MES|NQ|MNQ)/.test(symbol)) return 0.25;
  if (/^(GC|MGC)/.test(symbol)) return 0.1;
  if (/^(CL|MCL)/.test(symbol)) return 0.01;
  return 0.01;
}

const MONTH_CODES = "FGHJKMNQUVXZ";
const FUTURES_DISPLAY_NAMES = {
  MNQ: "Micro E-mini Nasdaq-100",
  NQ: "E-mini Nasdaq-100",
  MES: "Micro E-mini S&P 500",
  ES: "E-mini S&P 500",
  MYM: "Micro E-mini Dow",
  YM: "E-mini Dow",
  M2K: "Micro E-mini Russell 2000",
  RTY: "E-mini Russell 2000",
  MGC: "Micro Gold",
  GC: "Gold",
  SIL: "Micro Silver",
  SI: "Silver",
  MCL: "Micro WTI Crude Oil",
  CL: "WTI Crude Oil",
  QM: "E-mini Crude Oil",
  NG: "Henry Hub Natural Gas",
  ZN: "10-Year Treasury Note",
  ZB: "30-Year Treasury Bond",
  ZF: "5-Year Treasury Note",
  ZT: "2-Year Treasury Note",
};

function contractRoot(symbol) {
  return String(symbol || "").toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
}

function exchangeForRoot(root) {
  if (["GC", "MGC", "SI", "SIL", "HG"].includes(root)) return "COMEX";
  if (["CL", "MCL", "QM", "NG", "HO", "RB"].includes(root)) return "NYMEX";
  if (["YM", "MYM", "ZN", "ZB", "ZF", "ZT"].includes(root)) return "CBOT";
  return "CME";
}

function activeContractSymbol(root, now = new Date()) {
  if (!root) return "";
  const quarterly = new Set([
    "MNQ", "NQ", "MES", "ES", "MYM", "YM", "M2K", "RTY",
    "ZN", "ZB", "ZF", "ZT",
  ]);
  const evenMonths = new Set(["GC", "MGC", "SI", "SIL", "HG"]);
  const months = quarterly.has(root)
    ? [3, 6, 9, 12]
    : evenMonths.has(root)
      ? [2, 4, 6, 8, 10, 12]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const currentMonth = now.getUTCMonth() + 1;
  let year = now.getUTCFullYear();
  let month = months.find((candidate) => candidate >= currentMonth);
  if (!month) {
    month = months[0];
    year += 1;
  }
  return `${root}${MONTH_CODES[month - 1]}${String(year).slice(-1)}`;
}

function contractMetadata(symbol) {
  const normalized = String(symbol || "").toUpperCase();
  const match = normalized.match(/^(.+)([FGHJKMNQUVXZ])(\d{1,2})$/);
  const root = contractRoot(normalized);
  if (!match) {
    return {
      root,
      contractMonth: 0,
      contractYear: 0,
      contractLabel: normalized,
      displayName: FUTURES_DISPLAY_NAMES[root] || root,
    };
  }
  const contractMonth = MONTH_CODES.indexOf(match[2]) + 1;
  const rawYear = Number(match[3]);
  const currentYear = new Date().getUTCFullYear();
  let contractYear = match[3].length === 1
    ? Math.floor(currentYear / 10) * 10 + rawYear
    : 2000 + rawYear;
  if (match[3].length === 1 && contractYear < currentYear - 2) contractYear += 10;
  return {
    root,
    contractMonth,
    contractYear,
    contractLabel: new Date(Date.UTC(contractYear, contractMonth - 1, 1))
      .toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
    displayName: FUTURES_DISPLAY_NAMES[root] || root,
  };
}

function normalizedTradeRecord(trade) {
  const bidVolume = trade.aggressor === "SELL" ? trade.size : 0;
  const askVolume = trade.aggressor === "BUY" ? trade.size : 0;
  return {
    eventId: trade.id,
    recordIndex: trade.sequence,
    timestamp: trade.timestampMs,
    open: trade.price,
    high: trade.price,
    low: trade.price,
    close: trade.price,
    trades: 1,
    volume: trade.size,
    bidVolume,
    askVolume,
    delta: askVolume - bidVolume,
    aggressor: trade.aggressor,
    sideSemanticsVersion: 2,
  };
}

function aggregateCandles(trades, intervalMs, limit = 20_000) {
  const candles = new Map();
  let runningDelta = 0;
  for (const trade of trades) {
    const timestamp = trade.timestampMs - (trade.timestampMs % intervalMs);
    const askVolume = trade.aggressor === "BUY" ? trade.size : 0;
    const bidVolume = trade.aggressor === "SELL" ? trade.size : 0;
    const delta = askVolume - bidVolume;
    let candle = candles.get(timestamp);
    if (!candle) {
      candle = {
        timestamp,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: 0,
        trades: 0,
        bidVolume: 0,
        askVolume: 0,
        deltaOpen: runningDelta,
        deltaHigh: runningDelta,
        deltaLow: runningDelta,
        deltaClose: runningDelta,
      };
      candles.set(timestamp, candle);
    }
    candle.high = Math.max(candle.high, trade.price);
    candle.low = Math.min(candle.low, trade.price);
    candle.close = trade.price;
    candle.volume += trade.size;
    candle.trades += 1;
    candle.bidVolume += bidVolume;
    candle.askVolume += askVolume;
    runningDelta += delta;
    candle.deltaHigh = Math.max(candle.deltaHigh, runningDelta);
    candle.deltaLow = Math.min(candle.deltaLow, runningDelta);
    candle.deltaClose = runningDelta;
    candle.delta = candle.askVolume - candle.bidVolume;
  }
  return [...candles.values()].slice(-limit);
}

function intervalDurationMs(value) {
  const normalized = String(value || "1m").trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!match) return 60_000;
  const quantity = Number(match[1]);
  const multiplier = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }[match[2]];
  return Math.max(1, Math.round(quantity * multiplier));
}

function heatmapPayload(snapshot) {
  const tick = tickSize(snapshot.symbol);
  const bids = snapshot.bids.map((row) => [Math.round(row.price / tick), row.size, row.orders]);
  const asks = snapshot.asks.map((row) => [Math.round(row.price / tick), row.size, row.orders]);
  const trades = snapshot.trades.map((trade) => ({
    id: trade.sequence,
    timestamp: trade.timestampMs,
    tick: Math.round(trade.price / tick),
    size: trade.size,
    side: trade.aggressor === "BUY" ? "buy" : "sell",
  }));
  const bestBid = bids[0]?.[0] || 0;
  const bestAsk = asks[0]?.[0] || 0;
  return {
    status: {
      connected: client.status.connected,
      readOnly: true,
      trading: false,
      provider: "Rithmic",
      environment: config.systemName,
      depthMode: snapshot.depthMode,
      fullDepth: snapshot.fullDepth,
      individualOrders: snapshot.individualOrders,
      contractSymbol: snapshot.symbol,
      bookValid: snapshot.bookValid,
    },
    snapshot: {
      id: snapshot.sequence,
      timestamp: snapshot.asOfMs,
      root: snapshot.symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, ""),
      contractSymbol: snapshot.symbol,
      tickSize: tick,
      bids,
      asks,
      bestBid,
      bestAsk,
      midTick: bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0,
      lastTick: snapshot.lastPrice ? Math.round(snapshot.lastPrice / tick) : 0,
      trades,
      source: snapshot.depthMode === "MBO_AGGREGATED"
        ? "rtrader-excel-mbo-aggregate"
        : snapshot.fullDepth
          ? "rithmic-depth-by-order"
          : "rithmic-order-book",
      fullDepth: snapshot.fullDepth,
      individualOrders: snapshot.individualOrders,
      bookValid: snapshot.bookValid,
      orderCount: snapshot.orderCount,
      latencyMs: snapshot.ageMs,
      readOnly: true,
    },
  };
}

function emitRawSse(eventName, payload) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of rawSseClients) response.write(frame);
}

client.on("marketData", (event) => {
  emitRawSse(event.type, event);
  for (const subscriber of tradeSseClients) {
    if (event.type !== "trade" || subscriber.key !== event.instrument) continue;
    subscriber.response.write(
      `event: trades\ndata: ${JSON.stringify({
        historicalSeed: false,
        records: [normalizedTradeRecord(event.trade)],
      })}\n\n`,
    );
  }
  for (const subscriber of heatmapSseClients) {
    if (subscriber.key !== event.instrument) continue;
    const now = Date.now();
    if (now - subscriber.lastEmitAt < 50 && event.type !== "trade") continue;
    const snapshot = client.book.snapshot(
      subscriber.exchange,
      subscriber.symbol,
      subscriber.depth,
    );
    if (!snapshot) continue;
    subscriber.lastEmitAt = now;
    subscriber.response.write(
      `event: depth\ndata: ${JSON.stringify(heatmapPayload(snapshot))}\n\n`,
    );
  }
});
client.on("status", (status) => emitRawSse("status", status));
client.on("gatewayError", (error) => {
  process.stderr.write(`[rithmic] ${error instanceof Error ? error.message : String(error)}\n`);
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, config.configured ? 200 : 503, client.health());
  }
  if (!authorized(request)) {
    return json(response, config.gatewayToken ? 401 : 503, {
      error: config.gatewayToken
        ? "Unauthorized"
        : "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN is not configured.",
    });
  }
  try {
    if (request.method === "GET" && url.pathname === "/v1/rithmic/systems") {
      if (config.sourceMode === "rtrader-excel") {
        return json(response, 200, { provider: "Rithmic", systems: ["RTrader Pro Excel"] });
      }
      const systems = await discoverRithmicSystems(config);
      return json(response, 200, { provider: "Rithmic", systems });
    }
    if (request.method === "POST" && url.pathname === "/v1/rithmic/connect") {
      await client.start();
      return json(response, 202, client.health());
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/bridge/rtrader/snapshot"
    ) {
      if (config.sourceMode !== "rtrader-excel") {
        return json(response, 409, {
          error: "RITHMIC_SOURCE_MODE must be rtrader-excel for workbook ingestion.",
        });
      }
      const body = await bodyJson(request);
      const snapshot = client.ingestSnapshot(body);
      return json(response, 202, {
        accepted: true,
        exchange: snapshot.exchange,
        contractSymbol: snapshot.symbol,
        asOfMs: snapshot.asOfMs,
        depthMode: snapshot.depthMode,
        bidLevels: snapshot.bids.length,
        askLevels: snapshot.asks.length,
      });
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/bridge/rtrader/trades"
    ) {
      if (config.sourceMode !== "rtrader-excel") {
        return json(response, 409, {
          error: "RITHMIC_SOURCE_MODE must be rtrader-excel for workbook ingestion.",
        });
      }
      const body = await bodyJson(request);
      const result = client.ingestTrades(body);
      return json(response, 202, {
        accepted: true,
        acceptedTrades: result.accepted,
        receivedTrades: result.received,
        exchange: result.snapshot?.exchange || String(body.exchange || "").toUpperCase(),
        contractSymbol: result.snapshot?.symbol || String(body.contractSymbol || "").toUpperCase(),
        asOfMs: result.snapshot?.asOfMs || null,
      });
    }
    if (request.method === "POST" && url.pathname === "/v1/rithmic/subscriptions") {
      const body = await bodyJson(request);
      const instrument = requestedInstrument(url, body);
      const subscription = client.subscribe(instrument.exchange, instrument.symbol);
      return json(response, 201, { subscription, status: client.health() });
    }
    if (request.method === "DELETE" && url.pathname === "/v1/rithmic/subscriptions") {
      const body = await bodyJson(request);
      const instrument = requestedInstrument(url, body);
      const subscription = client.unsubscribe(instrument.exchange, instrument.symbol);
      return json(response, 200, { subscription, status: client.health() });
    }
    if (request.method === "GET" && url.pathname === "/v1/rithmic/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.write(`event: ready\ndata: ${JSON.stringify(client.health())}\n\n`);
      rawSseClients.add(response);
      const keepalive = setInterval(() => response.write(": keepalive\n\n"), 10_000);
      request.on("close", () => {
        clearInterval(keepalive);
        rawSseClients.delete(response);
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/trades") {
      const instrument = requestedInstrument(url);
      client.subscribe(instrument.exchange, instrument.symbol);
      const snapshot = client.book.snapshot(instrument.exchange, instrument.symbol, 1);
      // The browser keeps one shared execution stream per instrument.  Seed it
      // with enough retained prints to restore markers across the visible
      // session, while keeping the generic book snapshot intentionally small.
      const indicatorTrades = client.book.trades(
        instrument.exchange,
        instrument.symbol,
        { limit: 25_000 },
      );
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.write("event: ready\ndata: {}\n\n");
      response.write(
        `event: seed\ndata: ${JSON.stringify({
          candles: aggregateCandles(indicatorTrades, 1_000, 7_200),
          records: indicatorTrades.map(normalizedTradeRecord),
          historicalAvailable: false,
        })}\n\n`,
      );
      const subscriber = {
        key: `${instrument.exchange}:${instrument.symbol}`,
        response,
      };
      tradeSseClients.add(subscriber);
      const keepalive = setInterval(() => response.write(": keepalive\n\n"), 10_000);
      request.on("close", () => {
        clearInterval(keepalive);
        tradeSseClients.delete(subscriber);
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/heatmap/stream") {
      const instrument = requestedInstrument(url);
      client.subscribe(instrument.exchange, instrument.symbol);
      const depth = Math.min(5_000, Math.max(20, Number(url.searchParams.get("depthTicks") || 400)));
      const snapshot = client.book.snapshot(instrument.exchange, instrument.symbol, depth);
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.write(
        `event: ready\ndata: ${JSON.stringify({
          provider: "Rithmic",
          symbol: instrument.symbol,
          environment: config.systemName,
        })}\n\n`,
      );
      if (snapshot) {
        response.write(`event: depth\ndata: ${JSON.stringify(heatmapPayload(snapshot))}\n\n`);
      }
      const subscriber = {
        key: `${instrument.exchange}:${instrument.symbol}`,
        exchange: instrument.exchange,
        symbol: instrument.symbol,
        depth,
        lastEmitAt: 0,
        response,
      };
      heatmapSseClients.add(subscriber);
      const keepalive = setInterval(() => response.write(": keepalive\n\n"), 10_000);
      request.on("close", () => {
        clearInterval(keepalive);
        heatmapSseClients.delete(subscriber);
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/instruments") {
      return json(response, 200, {
        provider: "Rithmic",
        environment: config.systemName,
        instruments: client.book.list(),
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/instruments") {
      return json(response, 200, {
        schemaVersion: "kwantify-market-data-v2",
        provider: "Rithmic",
        instruments: client.book.list().map((row) => {
          const metadata = contractMetadata(row.symbol);
          return {
            root: metadata.root,
            symbol: row.symbol,
            contractSymbol: row.symbol,
            displayName: metadata.displayName,
            contractLabel: metadata.contractLabel,
            contractMonth: metadata.contractMonth,
            contractYear: metadata.contractYear,
            exchange: row.exchange,
            lastPrice: row.lastPrice,
            asOf: row.asOf,
            ageMs: row.asOf ? Math.max(0, Date.now() - Date.parse(row.asOf)) : null,
            status: row.status,
            depthMode: row.depthMode,
            bookValid: row.bookValid,
            isPrimary: true,
          };
        }),
      });
    }
    if (request.method === "POST" && url.pathname === "/v1/market-data/snapshot") {
      const body = await bodyJson(request);
      const instrument = requestedInstrument(url, body);
      client.subscribe(instrument.exchange, instrument.symbol);
      const snapshot = client.book.snapshot(instrument.exchange, instrument.symbol, 500);
      if (!snapshot) return json(response, 404, { error: "Instrument is not subscribed." });
      const executionTape = client.book.trades(
        instrument.exchange,
        instrument.symbol,
        { limit: 100_000 },
      );
      const metadata = contractMetadata(instrument.symbol);
      const interval = String(body.interval || "1m");
      const lookbackBars = Math.min(100_000, Math.max(1, Number(body.lookbackBars || 100_000)));
      const candles = aggregateCandles(
        executionTape,
        intervalDurationMs(interval),
        lookbackBars,
      );
      const asOfMs = snapshot.asOfMs || Date.now();
      const status = snapshot.ageMs !== null && snapshot.ageMs <= 30_000
        ? "LIVE"
        : snapshot.asOfMs
          ? "STALE"
          : "NOT_OPEN";
      return json(response, 200, {
        schemaVersion: "kwantify-market-data-v3",
        provider: "Rithmic",
        source: "Rithmic Ticker Plant",
        root: metadata.root,
        symbol: instrument.symbol,
        contractSymbol: instrument.symbol,
        displayName: metadata.displayName,
        contractLabel: metadata.contractLabel,
        contractMonth: metadata.contractMonth,
        contractYear: metadata.contractYear,
        exchange: snapshot.exchange,
        asOf: new Date(asOfMs).toISOString(),
        lastPrice: snapshot.lastPrice,
        bid: snapshot.bestBid?.price ?? null,
        ask: snapshot.bestAsk?.price ?? null,
        tickSize: tickSize(instrument.symbol),
        orderFlowAvailable: executionTape.length > 0,
        status,
        ageMs: snapshot.ageMs,
        recordCount: executionTape.length,
        candles,
        records: executionTape.map(normalizedTradeRecord),
        sourceRecordCount: executionTape.length,
        historicalAvailable: false,
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/order-flow-levels") {
      const instrument = requestedInstrument(url);
      client.subscribe(instrument.exchange, instrument.symbol);
      const snapshot = client.book.snapshot(instrument.exchange, instrument.symbol, 1);
      if (!snapshot) return json(response, 404, { error: "Instrument is not subscribed." });
      const fromMs = Number(url.searchParams.get("fromMs") || 0);
      const toMs = Number(url.searchParams.get("toMs") || Date.now());
      const interval = String(url.searchParams.get("interval") || "1m");
      const trades = client.book.trades(instrument.exchange, instrument.symbol, { fromMs, toMs });
      return json(response, 200, {
        schemaVersion: "kwantify-market-data-v3",
        provider: "Rithmic",
        source: "Rithmic Ticker Plant trades",
        root: instrument.symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, ""),
        contractSymbol: instrument.symbol,
        interval,
        candles: aggregateCandles(trades, intervalDurationMs(interval)),
        records: trades.map(normalizedTradeRecord),
        trades: trades.map(normalizedTradeRecord),
        sourceRecordCount: trades.length,
        truncated: false,
        historicalAvailable: false,
        fromMs,
        toMs,
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/volume-profile") {
      const instrument = requestedInstrument(url);
      client.subscribe(instrument.exchange, instrument.symbol);
      const snapshot = client.book.snapshot(instrument.exchange, instrument.symbol, 1);
      if (!snapshot) return json(response, 404, { error: "Instrument is not subscribed." });
      const startMs = Number(url.searchParams.get("startMs") || 0);
      const endMs = Number(url.searchParams.get("endMs") || Date.now());
      const groupTicks = Math.max(1, Number(url.searchParams.get("groupTicks") || 1));
      const valueAreaPercent = Math.max(
        1,
        Math.min(100, Number(url.searchParams.get("valueAreaPercent") || 70)),
      );
      const minTradeVolume = Math.max(0, Number(url.searchParams.get("minTradeVolume") || 0));
      const maxTradeVolume = Math.max(0, Number(url.searchParams.get("maxTradeVolume") || 0));
      const priceTick = tickSize(instrument.symbol);
      const rows = new Map();
      const profileTrades = client.book.trades(
        instrument.exchange,
        instrument.symbol,
        { fromMs: startMs, toMs: endMs },
      );
      let weightedPrice = 0;
      let weightedSquaredPrice = 0;
      let includedTrades = 0;
      for (const trade of profileTrades) {
        if (trade.size < minTradeVolume || (maxTradeVolume > 0 && trade.size > maxTradeVolume)) continue;
        const groupedTick =
          Math.floor(Math.round(trade.price / priceTick) / groupTicks) * groupTicks;
        let row = rows.get(groupedTick);
        if (!row) {
          row = {
            price: groupedTick * priceTick,
            volume: 0,
            bidVolume: 0,
            askVolume: 0,
            delta: 0,
            trades: 0,
          };
          rows.set(groupedTick, row);
        }
        row.volume += trade.size;
        row.trades += 1;
        if (trade.aggressor === "BUY") row.askVolume += trade.size;
        if (trade.aggressor === "SELL") row.bidVolume += trade.size;
        row.delta = row.askVolume - row.bidVolume;
        weightedPrice += trade.price * trade.size;
        weightedSquaredPrice += trade.price * trade.price * trade.size;
        includedTrades += 1;
      }
      const levels = [...rows.values()].sort((left, right) => left.price - right.price);
      const total = levels.reduce((sum, row) => sum + row.volume, 0);
      if (!total) return json(response, 404, { error: "No executions in requested profile range." });
      const pocIndex = levels.reduce(
        (best, row, index) => (row.volume > levels[best].volume ? index : best),
        0,
      );
      let low = pocIndex;
      let high = pocIndex;
      let selectedVolume = levels[pocIndex].volume;
      const target = total * (valueAreaPercent / 100);
      while (selectedVolume < target && (low > 0 || high < levels.length - 1)) {
        const left = low > 0 ? levels[low - 1].volume : -1;
        const right = high < levels.length - 1 ? levels[high + 1].volume : -1;
        if (right > left) {
          high += 1;
          selectedVolume += right;
        } else {
          low -= 1;
          selectedVolume += left;
        }
      }
      return json(response, 200, {
        schemaVersion: "kwantify-volume-profile-v1",
        provider: "Rithmic",
        source: "Rithmic Ticker Plant trades",
        root: instrument.symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, ""),
        contractSymbol: instrument.symbol,
        period: String(url.searchParams.get("period") || "daily"),
        startMs,
        endMs,
        tickSize: priceTick,
        groupTicks,
        valueAreaPercent,
        minTradeVolume,
        maxTradeVolume,
        totalVolume: total,
        bidVolume: levels.reduce((sum, row) => sum + row.bidVolume, 0),
        askVolume: levels.reduce((sum, row) => sum + row.askVolume, 0),
        delta: levels.reduce((sum, row) => sum + row.delta, 0),
        trades: includedTrades,
        poc: levels[pocIndex].price,
        vah: levels[high].price,
        val: levels[low].price,
        vwap: total > 0 ? weightedPrice / total : null,
        standardDeviation: total > 0
          ? Math.sqrt(Math.max(0, weightedSquaredPrice / total - (weightedPrice / total) ** 2))
          : 0,
        levels,
        developingPoc: [],
        historicalAvailable: false,
        asOf: new Date().toISOString(),
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/heatmap/snapshot") {
      const instrument = requestedInstrument(url);
      client.subscribe(instrument.exchange, instrument.symbol);
      const depth = Math.min(5_000, Math.max(20, Number(url.searchParams.get("depthTicks") || 400)));
      const snapshot = client.book.snapshot(instrument.exchange, instrument.symbol, depth);
      if (!snapshot) return json(response, 404, { error: "Instrument is not subscribed." });
      return json(response, 200, heatmapPayload(snapshot));
    }
    return json(response, 404, { error: "Not found." });
  } catch (error) {
    return json(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(config.port, config.host, () => {
  process.stdout.write(
    `Olisa Labs Platform Rithmic gateway listening on http://${config.host}:${config.port}\n`,
  );
  if (config.configured) {
    client.start().catch((error) => {
      process.stderr.write(`[rithmic] initial connection failed: ${error.message}\n`);
    });
  }
});

async function shutdown() {
  await client.stop();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
