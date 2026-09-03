import { createServer } from "node:http";
import { URL } from "node:url";

import { buildArchivedValueAreaProfile } from "./archive-value-area.mjs";
import { replayArchiveIntoBook } from "./archive-replay.mjs";
import { CashIndexArchiver } from "./cash-index-archiver.mjs";
import { HeatmapReplayStore } from "./heatmap-replay.mjs";
import { LabRepositoryStore } from "./lab-repository.mjs";
import { RithmicBookStore } from "./book-store.mjs";
import { loadConfig } from "./config.mjs";
import { DatabentoEquitiesTradeStream } from "./databento-equities-stream.mjs";
import { FuturesBarArchive, HistoryRequestError } from "./futures-bar-archive.mjs";
import { QuantDataSurfacePoller } from "./quantdata-surface-poller.mjs";
import { TradeTapeArchive, MAX_TAPE_PRINTS } from "./trade-tape-archive.mjs";
import { BarFlowArchive } from "./bar-flow-archive.mjs";
import { SessionProfileArchive } from "./session-profile-archive.mjs";
import {
  combinedVolumeProfileCoverage,
  volumeProfileSourcesHaveGap,
  volumeProfileTailTrades,
} from "./volume-profile-fold-merge.mjs";
import { compareInstrumentCandidates } from "./instrument-resolution.mjs";
import { DatabentoOptionsCatalog, OptionsCatalogError } from "./databento-options-catalog.mjs";
import { DatabentoOptionTradeStream } from "./databento-option-trades.mjs";
import { createDesktopStreamGuard } from "./desktop-stream-guard.mjs";
import { loadDesktopRevocationSynchronizerFromEnv } from "./desktop-revocation-synchronizer.mjs";
import { loadDesktopTicketRevocationCacheFromEnv } from "./desktop-ticket-revocations.mjs";
import { loadDesktopTicketVerifierFromEnv } from "./desktop-ticket-verifier.mjs";
import { GatewayAuthorizer } from "./gateway-authorizer.mjs";
import { MassiveIndicesStream } from "./massive-indices-stream.mjs";
import { NormalizedAnalyticsProxy, normalizedAnalyticsProblem } from "./normalized-analytics-proxy.mjs";
import { MarketIndexHistoryError, QuantDataMarketHistoryService } from "./quantdata-market-history.mjs";
import { QuantDataMarketSnapshotStream } from "./quantdata-market-snapshot-stream.mjs";
import { discoverRithmicSystems, RithmicMarketDataClient } from "./rithmic-client.mjs";
import { RTraderExcelMarketDataClient } from "./rtrader-excel-client.mjs";
import { MarketDataRecorder } from "./recorder.mjs";
import { ExposureArchiver } from "./exposure-archiver.mjs";
import { archiveStorageHealth } from "./archive-storage-health.mjs";
import { EventLoopLoadGuard, isDeferrableDuringOverload } from "./event-loop-load-guard.mjs";
import { VendorDataEdge } from "./vendor-data-edge.mjs";
import { ZyonServiceProxy, zyonServiceProblem } from "./zyon-service-proxy.mjs";
import {
  ZyonTranscriptionService,
  zyonTranscriptionProblem,
} from "./zyon-transcription-service.mjs";
import { NewsServiceProxy, newsServiceProblem } from "./news-service-proxy.mjs";
import { SocialsServiceProxy, socialsServiceProblem } from "./socials-service-proxy.mjs";
import { JournalServiceProxy, journalServiceProblem } from "./journal-service-proxy.mjs";
import {
  chicagoTradingDate,
  cmeSessionBounds,
  resolveVolumeProfileRange,
} from "./trading-session.mjs";

const config = loadConfig();
const desktopTicketRevocations = loadDesktopTicketRevocationCacheFromEnv();
const desktopRevocationSynchronizer = loadDesktopRevocationSynchronizerFromEnv(process.env, {
  log: (line) => process.stderr.write(`${line}\n`),
});
const desktopTicketVerifier = loadDesktopTicketVerifierFromEnv(process.env, desktopTicketRevocations
  ? { isRevoked: (principal) => desktopTicketRevocations.isRevoked(principal) }
  : {});
if (
  Boolean(desktopTicketVerifier) !== Boolean(desktopTicketRevocations) ||
  Boolean(desktopTicketVerifier) !== Boolean(desktopRevocationSynchronizer)
) {
  throw new Error(
    "Desktop ticket verification, revocation cache, and revocation synchronizer must be configured together.",
  );
}
const gatewayAuthorizer = new GatewayAuthorizer({
  gatewayToken: config.gatewayToken,
  desktopTicketVerifier,
});
const eventLoopLoadGuard = new EventLoopLoadGuard();
eventLoopLoadGuard.start();
const client = config.sourceMode === "rtrader-excel"
  ? new RTraderExcelMarketDataClient(config)
  : new RithmicMarketDataClient(config);
// Capture every observed message. Rithmic has no depth-by-order replay, so a
// session that is not recorded as it happens cannot be recovered later.
const recorder = new MarketDataRecorder({
  dir: config.recordDir,
  enabled: config.recordEnabled,
});
recorder.attach(client);
// Session LIQ MAP replay served from the recorder's own archive — the only
// depth-by-order history that exists anywhere (Rithmic sells none).
const heatmapReplay = new HeatmapReplayStore({
  dir: config.recordDir,
  tickSizeFor: (symbol) => tickSize(symbol),
  log: (line) => process.stdout.write(`${line}\n`),
});
// August V1 desk plans, Film, gates and analyst updates are published as one
// versioned artifact in the VPS-hosted Quant Desk repository. The browser
// consumes this read-only boundary; it never assembles a plan from vendor APIs.
const labRepository = new LabRepositoryStore({ root: config.labRepositoryRoot });
const normalizedAnalytics = new NormalizedAnalyticsProxy({
  origin: config.normalizedAnalyticsOrigin,
  serviceToken: config.normalizedAnalyticsServiceToken,
  timeoutMs: config.normalizedAnalyticsTimeoutMs,
});
const zyonService = new ZyonServiceProxy({
  origin: config.zyonServiceOrigin,
  serviceToken: config.zyonServiceToken,
  timeoutMs: config.zyonServiceTimeoutMs,
});
const zyonTranscription = new ZyonTranscriptionService({
  apiKey: config.openAiApiKey,
  model: config.openAiZyonTranscriptionModel,
  timeoutMs: config.openAiZyonTranscriptionTimeoutMs,
});
const newsService = new NewsServiceProxy({
  origin: config.newsServiceOrigin,
  serviceToken: config.newsServiceToken,
  timeoutMs: config.newsServiceTimeoutMs,
});
const socialsService = new SocialsServiceProxy({
  origin: config.socialsServiceOrigin,
  serviceToken: config.socialsServiceToken,
  timeoutMs: config.socialsServiceTimeoutMs,
});
const journalService = new JournalServiceProxy({
  origin: config.journalServiceOrigin,
  serviceToken: config.journalServiceToken,
  timeoutMs: config.journalServiceTimeoutMs,
});
// The QuantData counterpart to the Rithmic recorder. It stores the complete
// successful provider payload plus the request that gives it meaning. The
// vendor edge and every direct VPS QuantData client feed this same writer.
const exposureArchiver = new ExposureArchiver({
  dir: config.recordDir,
  enabled: config.exposureArchiveEnabled,
});
const archiveQuantDataResponse = (entry) => exposureArchiver.archive(entry);
// Our OWN daily copy of each completed cash-index session's real minute OHLC
// (the provider only serves it after the close, and keeps it on its own
// terms). Archived minutes after every close, retried until complete,
// backfilled on startup — replays never depend on the provider again.
const cashIndexArchiver = new CashIndexArchiver({
  dir: config.recordDir,
  apiKey: config.quantDataApiKey,
  tickers: String(process.env.CASH_INDEX_ARCHIVE_TICKERS || "")
    .split(",")
    .map((ticker) => ticker.trim())
    .filter(Boolean),
  archiveResponse: archiveQuantDataResponse,
  log: (line) => process.stdout.write(`${line}\n`),
});
const vendorDataEdge = new VendorDataEdge(config, fetch, exposureArchiver);
/*
 * Chart history comes from the desk's own recorded Rithmic prints.
 *
 * It used to be bought per request from a vendor. That vendor is gone - the
 * account answers 402 "insufficient budget", and the busiest window of the day
 * is the most expensive request, so the US cash session was exactly the part
 * that stopped being served. Charts showed live prices with a hole through the
 * middle of the day.
 *
 * Every print was already being recorded here. Turning them into bars as they
 * arrive costs nothing, cannot be revoked, and does not depend on anyone's
 * billing.
 */
const chartHistory = new FuturesBarArchive({
  dir: config.recordDir,
  enabled: config.recordEnabled,
});
/*
 * The bid/ask split behind every time-based chart. It reads the same
 * recordings directory as the bars and the tape - a flow archive pointed
 * somewhere else would answer "no flow" for every instrument and look exactly
 * like an instrument that simply is not taped.
 */
const barFlow = new BarFlowArchive({
  dir: config.recordDir,
  enabled: config.recordEnabled,
});
// Folds sessions in the background, one at a time. Never inside a request.
barFlow.startWarming();
/*
 * Traded volume per price, for windows the live execution ring can no longer
 * reach. Same discipline as the flow archive: folded once per session in the
 * background, never on the request path.
 */
const sessionProfiles = new SessionProfileArchive({
  dir: config.recordDir,
  enabled: config.recordEnabled,
  // Profile folds run in the single shared worker queue, never on the HTTP
  // event loop. Permit a missing live-session baseline to be built while the
  // market is open unless measured loop lag says the gateway is under load;
  // pausing for the entire session left Asia/Europe unavailable after any
  // intraday restart.
  maintenanceAllowed: () => !eventLoopLoadGuard.isOverloaded(),
});
sessionProfiles.startWarming();
chartHistory.attach(client);
/*
 * Range, volume, renko and tick bars cannot be built from minute bars: they
 * close on price travelled or contracts traded, so they need the individual
 * prints, and the path WITHIN a minute is exactly what an OHLC bar discards.
 * The website asked the vendor for a raw trades feed to build them and that
 * subscription is gone, so those chart types have had no history at all.
 *
 * The prints are in the raw tape, but a 2.2 GB session that takes 198 seconds
 * to extract is not a serving format - so they are written again in the four
 * fields a bar builder needs, at about a hundredth of the size.
 */
const tradeTape = new TradeTapeArchive({
  dir: config.recordDir,
  enabled: config.recordEnabled,
});
tradeTape.attach(client);
chartHistory.restore().catch((error) => {
  process.stderr.write(`[bars] restore failed: ${error.message}
`);
});
const optionCatalog = new DatabentoOptionsCatalog({
  apiKey: config.databentoApiKey,
  timeoutMs: config.vendorRequestTimeoutMs,
});
const optionTrades = new DatabentoOptionTradeStream({
  apiKey: config.databentoApiKey,
  reconnectMinMs: config.reconnectMinMs,
  reconnectMaxMs: config.reconnectMaxMs,
});
const databentoEquities = new DatabentoEquitiesTradeStream({
  apiKey: config.databentoApiKey,
  reconnectMinMs: config.reconnectMinMs,
  reconnectMaxMs: config.reconnectMaxMs,
  symbols: ["SPY", "QQQ", "IWM", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "AMD"],
});
const quantDataMarketSnapshots = new QuantDataMarketSnapshotStream({
  apiKey: config.quantDataApiKey,
  pollMs: 2_500,
  // Poll one cash index per cycle. SPX and NDX therefore each refresh every
  // five seconds without either symbol being able to starve the other.
  indexPollMs: 2_500,
  idlePollMs: 15_000,
  requestSpacingMs: Math.max(100, config.quantDataMinSpacingMs),
  timeoutMs: Math.min(10_000, config.vendorRequestTimeoutMs),
  equitySymbols: ["SPY", "QQQ", "IWM", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "AMD"],
  indexSymbols: ["SPX", "NDX"],
}, fetch, archiveQuantDataResponse);
const quantDataMarketHistory = new QuantDataMarketHistoryService({
  apiKey: config.quantDataApiKey,
  timeoutMs: Math.min(15_000, config.vendorRequestTimeoutMs),
  archiveResponse: archiveQuantDataResponse,
  archiveReadSession: (ticker, sessionDate) => cashIndexArchiver.readSession(ticker, sessionDate),
});
const massiveIndices = new MassiveIndicesStream({
  apiKey: config.massiveApiKey,
  websocketUrl: config.massiveWebsocketUrl,
  restOrigin: config.massiveRestOrigin,
  requestTimeoutMs: config.massiveRequestTimeoutMs,
  staleMs: config.massiveStaleMs,
  reconnectMinMs: config.reconnectMinMs,
  reconnectMaxMs: config.reconnectMaxMs,
  symbols: ["SPX", "SPXW", "NDX", "VIX", "VXN", "RUT", "DJI"],
});
const rawSseClients = new Set();
const tradeSseClients = new Set();
const heatmapSseClients = new Set();
const quoteSseClients = new Set();
const marketIndexSseClients = new Set();
const heatmapHistoryByInstrument = new Map();
const liveQuoteCache = new Map();
const quoteBatchesByInstrument = new Map();

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
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

/**
 * Resolve a requested symbol to a contract the collector actually carries.
 *
 * `exactRoot` refuses the micro-to-parent aliasing below. That aliasing is
 * right for a quote - a micro tracks its parent tick for tick, and for a long
 * time the micros were not subscribed at all, so NQ's book was the only
 * honest price available for MNQ. It is wrong for anything that returns the
 * instrument's OWN data: asked for MNQ prints it hands back NQ's, and the
 * caller cannot tell, because NQ prints look exactly like the MNQ prints it
 * expected. Measured before this: an MNQ range chart and an NQ range chart
 * returned byte-identical bars.
 */
function requestedInstrument(url, body = {}, options = {}) {
  const exactRoot = options.exactRoot === true;
  const asRoot = (value) => (exactRoot ? contractRoot(value) : parentRoot(contractRoot(value)));
  const requestedSymbol = String(
    body.contractSymbol ||
      body.symbol ||
      body.root ||
      url.searchParams.get("contractSymbol") ||
      url.searchParams.get("symbol") ||
      url.searchParams.get("root") ||
      "",
  ).toUpperCase();
  const requestedRoot = asRoot(String(body.root || requestedSymbol).toUpperCase());
  /*
   * The root as ASKED FOR, before micro aliasing.
   *
   * "NQ" aliases to root NQ and so does "MNQ", so once the micros were
   * actually subscribed both NQU6 and MNQU6 became candidates for a plain NQ
   * request - and MNQU6 sorted first, so NQ charts were served the micro's
   * history. The micro had only been recorded since the morning it was
   * subscribed, so every NQ timeframe showed about forty minutes and looked
   * like the archive had been wiped.
   */
  const requestedOwnRoot = contractRoot(String(body.root || requestedSymbol).toUpperCase());
  const requestedExchange = String(
    body.exchange || url.searchParams.get("exchange") || "",
  ).toUpperCase();
  const candidates = client.book
    .list()
    .filter((row) => (
      asRoot(row.symbol) === requestedRoot
      && (!requestedExchange || String(row.exchange || "").toUpperCase() === requestedExchange)
    ))
    .sort((left, right) =>
      compareInstrumentCandidates(left, right, requestedOwnRoot, contractRoot));
  const exact = candidates.find((row) => (
    row.symbol === requestedSymbol
    && (!requestedExchange || String(row.exchange || "").toUpperCase() === requestedExchange)
  ));
  const resolved = exact || candidates[0];
  // On an empty book, resolve micro requests through the PARENT root as well
  // — otherwise a cold-started collector asked for MNQU6 would try to
  // subscribe the micro itself and be refused by the instrument allowlist.
  const requestedIsAliased = contractRoot(requestedSymbol) !== requestedRoot;
  return {
    exchange: requestedExchange || resolved?.exchange || exchangeForRoot(requestedRoot),
    symbol: resolved?.symbol || (
      requestedSymbol && requestedSymbol !== requestedRoot && !requestedIsAliased
        ? requestedSymbol
        : activeContractSymbol(requestedRoot)
    ),
  };
}

function tickSize(symbol) {
  const root = contractRoot(symbol);
  if (["ES", "MES", "NQ", "MNQ"].includes(root)) return 0.25;
  if (["YM", "MYM"].includes(root)) return 1;
  if (["RTY", "M2K", "GC", "MGC", "PL", "PA", "ZM"].includes(root)) return 0.1;
  if (["CL", "MCL", "ZL"].includes(root)) return 0.01;
  if (root === "QM") return 0.025;
  if (["RB", "HO"].includes(root)) return 0.0001;
  if (["NG", "10Y"].includes(root)) return 0.001;
  if (root === "QG") return 0.005;
  if (["SI", "SIL"].includes(root)) return 0.005;
  if (root === "HG") return 0.0005;
  if (["ZN", "TN"].includes(root)) return 1 / 64;
  if (["ZB", "UB"].includes(root)) return 1 / 32;
  if (root === "ZF") return 1 / 128;
  if (root === "ZT") return 1 / 256;
  if (root === "SR3") return 0.0025;
  if (["6E", "6C"].includes(root)) return 0.00005;
  if (["6A", "6B", "6S", "6N", "M6E", "M6A", "M6B"].includes(root)) return 0.0001;
  if (root === "6J") return 0.0000005;
  if (root === "6M") return 0.00001;
  if (["ZC", "ZW", "ZS"].includes(root)) return 0.25;
  if (["LE", "HE", "GF"].includes(root)) return 0.025;
  if (["BTC", "MBT"].includes(root)) return 5;
  if (["ETH", "MET"].includes(root)) return 0.5;
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
  QG: "E-mini Natural Gas",
  RB: "RBOB Gasoline",
  HO: "ULSD Heating Oil",
  HG: "Copper",
  PL: "Platinum",
  PA: "Palladium",
  ZN: "10-Year Treasury Note",
  TN: "Ultra 10-Year Treasury Note",
  ZB: "30-Year Treasury Bond",
  UB: "Ultra Treasury Bond",
  ZF: "5-Year Treasury Note",
  ZT: "2-Year Treasury Note",
  "10Y": "10-Year Treasury Yield",
  SR3: "3-Month SOFR",
  "6E": "Euro FX",
  M6E: "Micro Euro FX",
  "6J": "Japanese Yen",
  "6B": "British Pound",
  M6B: "Micro British Pound",
  "6A": "Australian Dollar",
  M6A: "Micro Australian Dollar",
  "6C": "Canadian Dollar",
  "6S": "Swiss Franc",
  "6N": "New Zealand Dollar",
  "6M": "Mexican Peso",
  BTC: "Bitcoin",
  MBT: "Micro Bitcoin",
  ETH: "Ether",
  MET: "Micro Ether",
  ZC: "Corn",
  ZS: "Soybeans",
  ZW: "Wheat",
  ZM: "Soybean Meal",
  ZL: "Soybean Oil",
  LE: "Live Cattle",
  HE: "Lean Hogs",
  GF: "Feeder Cattle",
};

function contractRoot(symbol) {
  return String(symbol || "").toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
}

function requestedQuoteInstrument(requestedSymbol) {
  const alias = String(requestedSymbol || "").trim();
  const raw = alias.toUpperCase().replace(/\.[VNC]\.\d+$/i, "");
  const root = parentRoot(contractRoot(raw));
  // The root as asked for, so an NQ quote is NQ's book and not the micro's.
  const ownRoot = contractRoot(raw);
  const candidates = client.book
    .list()
    .filter((row) => parentRoot(contractRoot(row.symbol)) === root)
    .sort((left, right) => compareInstrumentCandidates(left, right, ownRoot, contractRoot));
  const exact = candidates.find((row) => row.symbol === raw);
  const resolved = exact || candidates[0];
  return {
    alias,
    exchange: resolved?.exchange || exchangeForRoot(root),
    symbol: resolved?.symbol || (raw !== root ? raw : activeContractSymbol(root)),
  };
}

function quotePayload(alias, instrument, event = null) {
  // Quotes need the current touch, not the retained execution ring. Copying
  // and scanning 2,500 trades on every 32 ms quote flush starved the gateway
  // under L3 load and made downstream heatmap frames arrive in bursts.
  const snapshot = client.book.snapshot(instrument.exchange, instrument.symbol, 1, { tradeLimit: 1 });
  if (!snapshot) return null;
  const trade = event?.type === "trade" ? event.trade : null;
  const bid = Number(snapshot.bestBid?.price || 0);
  const ask = Number(snapshot.bestAsk?.price || 0);
  const tradePrice = Number(trade?.price || 0);
  const mid = bid && ask ? (bid + ask) / 2 : tradePrice || Number(snapshot.lastPrice || 0) || bid || ask;
  if (!Number.isFinite(mid) || mid <= 0) return null;
  const size = Math.max(0, Number(event?.quoteSize ?? trade?.size ?? 0));
  const isTrade = Boolean(tradePrice && size);
  const tradeCount = Math.max(1, Number(event?.quoteTrades ?? 1));
  const classifiedDelta = Number(event?.quoteDelta);
  return {
    instrument: alias,
    contractSymbol: instrument.symbol,
    bid: bid || mid,
    ask: ask || mid,
    mid: tradePrice || mid,
    isTrade,
    size: isTrade ? size : undefined,
    trades: isTrade ? tradeCount : undefined,
    delta: isTrade
      ? Number.isFinite(classifiedDelta)
        ? classifiedDelta
        : trade.aggressor === "BUY" ? size : trade.aggressor === "SELL" ? -size : 0
      : undefined,
    timestamp: Number(trade?.timestampMs || snapshot.asOfMs || Date.now()),
    broker: "Databento",
    transport: "vps-rithmic",
  };
}

function queueQuoteBatch(event) {
  if (!event?.instrument || !quoteSseClients.size) return;
  const current = quoteBatchesByInstrument.get(event.instrument) || {
    latestEvent: event,
    lastTrade: null,
    size: 0,
    trades: 0,
    delta: 0,
  };
  current.latestEvent = event;
  if (event.type === "trade" && event.trade) {
    const size = Math.max(0, Number(event.trade.size || 0));
    current.lastTrade = event.trade;
    current.size += size;
    current.trades += 1;
    current.delta += event.trade.aggressor === "BUY"
      ? size
      : event.trade.aggressor === "SELL"
        ? -size
        : 0;
  }
  quoteBatchesByInstrument.set(event.instrument, current);
}

// Depth-by-order can produce thousands of messages per second. Building a
// complete book snapshot inside the raw market-data callback multiplied that
// work by every browser stream and eventually starved /health and heatmap
// rendering. Fold all messages received during one UI frame into one quote
// snapshot per instrument, then fan that compact result out to subscribers.
const quoteFlush = setInterval(() => {
  const batches = [...quoteBatchesByInstrument.entries()];
  quoteBatchesByInstrument.clear();
  for (const [instrumentKey, batch] of batches) {
    const subscribers = [...quoteSseClients].filter((subscriber) => (
      subscriber.aliasesByKey.has(instrumentKey)
      && !subscriber.response.destroyed
      && !subscriber.response.writableEnded
    ));
    if (!subscribers.length) continue;
    const instrument = subscribers[0].instrumentsByKey.get(instrumentKey);
    if (!instrument) continue;
    const event = batch.lastTrade
      ? {
          ...batch.latestEvent,
          type: "trade",
          trade: batch.lastTrade,
          quoteSize: batch.size,
          quoteTrades: batch.trades,
          quoteDelta: batch.delta,
        }
      : batch.latestEvent;
    const basePayload = quotePayload("", instrument, event);
    if (!basePayload) continue;
    for (const subscriber of subscribers) {
      for (const alias of subscriber.aliasesByKey.get(instrumentKey) || []) {
        const payload = { ...basePayload, instrument: alias };
        liveQuoteCache.set(alias, { payload, updatedAt: Date.now() });
        subscriber.pending.set(alias, payload);
      }
    }
  }

  const now = Date.now();
  for (const subscriber of [...quoteSseClients]) {
    if (subscriber.response.destroyed || subscriber.response.writableEnded) {
      quoteSseClients.delete(subscriber);
      continue;
    }
    for (const [alias, payload] of subscriber.pending) {
      if (!subscriber.priority.has(alias) && now - (subscriber.lastPublishedAt.get(alias) || 0) < 250) continue;
      subscriber.pending.delete(alias);
      subscriber.lastPublishedAt.set(alias, now);
      subscriber.response.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }
}, 32);
quoteFlush.unref();

// Micro contracts trade the same underlying at the same prices as their
// e-mini parent but generate comparable message volume for a tenth of the
// information. Ingesting all four saturated the collector's event loop at
// European open (health and profile requests timing out at 30s), which
// silently degraded every chart to the APPROX fallback. Micros are therefore
// served from the parent book, and the response carries the PARENT contract
// symbol so the provenance is honest: an MNQ chart reading NQ tape says so.
const MICRO_PARENT_ROOTS = {
  MNQ: "NQ", MES: "ES", MYM: "YM", M2K: "RTY", MGC: "GC", MCL: "CL",
  SIL: "SI", QG: "NG", M6E: "6E", M6B: "6B", M6A: "6A", MBT: "BTC", MET: "ETH",
};

// Full depth frames are materially heavier than trade ticks. The heatmap
// snapshot path is now bounded to only trades newer than the last frame, so a
// truthful 20 FPS book no longer rescans the retained execution ring.
const HEATMAP_FRAME_MS = Math.max(
  50,
  Number(process.env.RITHMIC_HEATMAP_FRAME_MS) || 50,
);
// A fresh browser used to begin with a single vertical sliver even when the
// collector had been running all session. Keep a compact, server-side warm
// window so page navigation does not throw away the liquidity map that the
// original long-running Kwantify tab had already accumulated. 180 frames is
// 18 seconds at the default cadence. History is sent in small SSE chunks so
// the browser can paint progressively instead of parsing one multi-megabyte
// object on its main thread.
const HEATMAP_HISTORY_LIMIT = Math.max(
  60,
  Math.min(450, Number(process.env.RITHMIC_HEATMAP_HISTORY_FRAMES) || 180),
);
const HEATMAP_CACHE_DEPTH = Math.max(
  100,
  Math.min(1_000, Number(process.env.RITHMIC_HEATMAP_CACHE_DEPTH) || 400),
);
const HEATMAP_HISTORY_CHUNK_SIZE = 24;

function parentRoot(root) {
  return MICRO_PARENT_ROOTS[root] || root;
}

function exchangeForRoot(root) {
  if (["GC", "MGC", "SI", "SIL", "HG"].includes(root)) return "COMEX";
  if (["CL", "MCL", "QM", "NG", "QG", "HO", "RB", "PL", "PA"].includes(root)) return "NYMEX";
  if (["YM", "MYM", "ZN", "TN", "ZB", "UB", "ZF", "ZT", "ZC", "ZS", "ZW", "ZM", "ZL"].includes(root)) return "CBOT";
  return "CME";
}

function activeContractSymbol(root, now = new Date()) {
  if (!root) return "";
  const quarterly = new Set([
    "MNQ", "NQ", "MES", "ES", "MYM", "YM", "M2K", "RTY",
    "ZN", "TN", "ZB", "UB", "ZF", "ZT", "10Y", "SR3",
    "6E", "M6E", "6J", "6B", "M6B", "6A", "M6A", "6C", "6S", "6N", "6M",
  ]);
  const deliveryMonths = {
    GC: [2, 4, 6, 8, 10, 12], MGC: [2, 4, 6, 8, 10, 12],
    SI: [3, 5, 7, 9, 12], SIL: [3, 5, 7, 9, 12], HG: [3, 5, 7, 9, 12],
    PL: [1, 4, 7, 10], PA: [3, 6, 9, 12],
    ZC: [3, 5, 7, 9, 12], ZW: [3, 5, 7, 9, 12],
    ZS: [1, 3, 5, 7, 8, 9, 11],
    ZM: [1, 3, 5, 7, 8, 9, 10, 12], ZL: [1, 3, 5, 7, 8, 9, 10, 12],
    LE: [2, 4, 6, 8, 10, 12], HE: [2, 4, 5, 6, 7, 8, 10, 12],
    GF: [1, 3, 4, 5, 8, 9, 10, 11],
  };
  const months = quarterly.has(root)
    ? [3, 6, 9, 12]
    : deliveryMonths[root] || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const currentMonth = now.getUTCMonth() + 1;
  let year = now.getUTCFullYear();
  // Quarterly contracts remain usable through their delivery month. Physical
  // and monthly products roll before delivery, so never guess the expiring
  // current-month contract when a user opens a product for the first time.
  let month = months.find((candidate) => (
    quarterly.has(root) ? candidate >= currentMonth : candidate > currentMonth
  ));
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

// Mirrors the payload Kwantify's collector served the heatmap app
// (services/market_data/app/main.py). Two things were wrong here.
//
// First, `after`: Kwantify sent a subscriber only the trades it had not seen,
// tracked by the book's monotonic sequence. We resent the whole retained
// 2,500-trade window on every frame, and the app stamps `frame.trades` onto
// the column it draws - so all 1,800 columns carried the entire session's
// executions and the heatmap rendered a wall of volume dots across every price
// the session had traded, instead of a trail of where it traded just then.
//
// Second, the derived fields below - cvd, delta, volume, totalVolume,
// imbalance, microTick, maxDepth, wallCount, tradeRate, eventsSince - were
// absent entirely. The app reads each through `finite(raw.x)`, so every one
// silently resolved to 0: no CVD, dead metrics row, and an event counter that
// only ever advanced by the trade count.
function heatmapPayload(snapshot, after = 0) {
  const tick = tickSize(snapshot.symbol);
  const bids = snapshot.bids.map((row) => [Math.round(row.price / tick), row.size, row.orders]);
  const asks = snapshot.asks.map((row) => [Math.round(row.price / tick), row.size, row.orders]);
  const sequence = Number(snapshot.sequence) || 0;
  const trades = snapshot.trades
    .filter((trade) => Number(trade.sequence) > after)
    .map((trade) => ({
      id: trade.sequence,
      timestamp: trade.timestampMs,
      tick: Math.round(trade.price / tick),
      size: trade.size,
      side: trade.aggressor === "BUY" ? "buy" : "sell",
    }));

  // Session running totals span the whole retained window; the per-frame delta
  // and volume cover only what this frame is delivering. That split is what
  // makes CVD a session line and delta a per-column bar.
  // The book store maintains these totals as trades arrive. Recomputing them
  // from the retained ring for every heatmap frame was O(2,500) work at the
  // hottest point in the gateway.
  const askVolume = Math.max(0, Number(snapshot.flowTotals?.askVolume) || 0);
  const bidVolume = Math.max(0, Number(snapshot.flowTotals?.bidVolume) || 0);
  let delta = 0;
  let volume = 0;
  for (const trade of trades) {
    volume += trade.size;
    delta += trade.side === "buy" ? trade.size : -trade.size;
  }

  const bestBid = bids[0]?.[0] || 0;
  const bestAsk = asks[0]?.[0] || 0;
  const bidTop = bids[0]?.[1] || 0;
  const askTop = asks[0]?.[1] || 0;
  const topTotal = bidTop + askTop;
  let bidDepth = 0;
  let askDepth = 0;
  let maxDepth = 0;
  for (const row of bids) {
    bidDepth += row[1];
    if (row[1] > maxDepth) maxDepth = row[1];
  }
  for (const row of asks) {
    askDepth += row[1];
    if (row[1] > maxDepth) maxDepth = row[1];
  }
  const depthTotal = bidDepth + askDepth;
  const wallThreshold = maxDepth * 0.6;
  let wallCount = 0;
  if (maxDepth) {
    for (const row of bids) if (row[1] >= wallThreshold) wallCount += 1;
    for (const row of asks) if (row[1] >= wallThreshold) wallCount += 1;
  }
  const ageMs = Number.isFinite(Number(snapshot.ageMs)) ? Math.max(0, Number(snapshot.ageMs)) : null;
  const fresh = ageMs !== null && ageMs <= 15_000;
  return {
    status: {
      // Socket connectivity is not market freshness. During the weekend the
      // Rithmic session remains authenticated while the last exchange book is
      // hours old; calling that LIVE made the heatmap confidently animate a
      // frozen close. Keep the completed book visible, but label it stale.
      connected: Boolean(client.status.connected && fresh),
      readOnly: true,
      trading: false,
      provider: "Rithmic",
      environment: config.systemName,
      depthMode: snapshot.depthMode,
      fullDepth: snapshot.fullDepth,
      individualOrders: snapshot.individualOrders,
      contractSymbol: snapshot.symbol,
      bookValid: snapshot.bookValid,
      levels: bids.length + asks.length,
      ageMs,
      stale: !fresh,
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
      cvd: askVolume - bidVolume,
      delta,
      volume,
      totalVolume: askVolume + bidVolume,
      imbalance: {
        bid: bidDepth,
        ask: askDepth,
        ratio: depthTotal ? bidDepth / depthTotal : 0.5,
      },
      microTick: topTotal
        ? (bestAsk * bidTop + bestBid * askTop) / topTotal
        : (bestBid + bestAsk) / 2,
      maxDepth,
      wallCount,
      tradeRate: trades.length,
      sweepScore: 0,
      absorptionScore: 0,
      changeTicks: 0,
      eventsSince: Math.max(0, sequence - after),
      orderEventSequence: Number(snapshot.orderEventSequence) || 0,
      orderStateComplete: Boolean(snapshot.orderStateComplete),
      orders: Array.isArray(snapshot.orders)
        ? snapshot.orders.map((order) => ({
            orderId: String(order.orderId),
            side: order.side,
            price: Number(order.price),
            size: Number(order.size),
            priority: String(order.priority || "0"),
          }))
        : undefined,
      source: snapshot.depthMode === "MBO_AGGREGATED"
        ? "rtrader-excel-mbo-aggregate"
        : snapshot.fullDepth
          ? "rithmic-depth-by-order"
          : "rithmic-order-book",
      fullDepth: snapshot.fullDepth,
      individualOrders: snapshot.individualOrders,
      bookValid: snapshot.bookValid,
      orderCount: snapshot.orderCount,
      latencyMs: ageMs,
      readOnly: true,
    },
  };
}

function gatewayInstrumentCatalog() {
  const configured = [
    ...config.allowedRoots,
    ...config.allowedInstruments,
    ...config.subscriptions,
  ];
  const liveRows = client.book.list();
  const roots = new Map();
  for (const row of configured) {
    const root = parentRoot(contractRoot(row.symbol));
    if (!root) continue;
    roots.set(root, {
      root,
      exchange: String(row.exchange || exchangeForRoot(root)).toUpperCase(),
    });
  }
  return [...roots.values()]
    .map(({ root, exchange }) => {
      const live = liveRows
        .filter((row) => parentRoot(contractRoot(row.symbol)) === root)
        .sort((left, right) => (right.status === "LIVE" ? 1 : 0) - (left.status === "LIVE" ? 1 : 0))[0];
      const contractSymbol = live?.symbol || activeContractSymbol(root);
      const metadata = contractMetadata(contractSymbol);
      return {
        root,
        symbol: contractSymbol,
        contractSymbol,
        displayName: FUTURES_DISPLAY_NAMES[root] || metadata.displayName || root,
        contractLabel: metadata.contractLabel,
        exchange: live?.exchange || exchange || exchangeForRoot(root),
        tickSize: tickSize(root),
        status: live?.status || "ON_DEMAND",
        depthMode: live?.depthMode || (config.enableDepthByOrder ? "DEPTH_BY_ORDER" : "MARKET_BY_PRICE"),
        fullDepth: config.enableDepthByOrder,
        readOnly: true,
      };
    })
    .sort((left, right) => left.root.localeCompare(right.root));
}

function isEventBasedInterval(value) {
  // Workspace event intervals use suffixes such as 40r, 500v, 200t, 1R,
  // 500dv, 12/4VB and 10PF. They have no clock duration and therefore cannot
  // be represented by the gateway's compact minute buckets.
  return /^\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?(?:r|v|t|dv|vb|pf)$/i.test(
    String(value || "").trim(),
  );
}

function acceptMonotonicHeatmapFrame(subscriber, frame) {
  const timestamp = Number(frame?.snapshot?.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const previous = Number(subscriber.lastMarketTimestampMs || 0);
  // A late packet may arrive marginally out of order; a packet that jumps
  // materially backwards belongs to an older market state and must never
  // stretch the chart's time axis. Small same-millisecond collisions are
  // nudged forward by one millisecond without changing visual cadence.
  if (previous > 0 && timestamp < previous - 1_000) return false;
  frame.snapshot.timestamp = previous > 0 ? Math.max(timestamp, previous + 1) : timestamp;
  subscriber.lastMarketTimestampMs = frame.snapshot.timestamp;
  return true;
}

function heatmapHistoryState(key) {
  let state = heatmapHistoryByInstrument.get(key);
  if (!state) {
    state = {
      frames: [],
      lastEmitAt: 0,
      lastMarketTimestampMs: 0,
      lastSequence: 0,
      pendingOrderEvents: [],
    };
    heatmapHistoryByInstrument.set(key, state);
  }
  return state;
}

function sessionCvdHistory(exchange, symbol, nowMs = Date.now()) {
  const bounds = cmeSessionBounds(chicagoTradingDate(nowMs));
  const candles = client.book.flowCandles(exchange, symbol, {
    fromMs: bounds?.startMs || nowMs - 24 * 60 * 60 * 1_000,
    toMs: Math.min(nowMs, bounds?.endMs || nowMs),
    intervalMs: 60_000,
    limit: 2_000,
  });
  let value = 0;
  let buy = 0;
  let sell = 0;
  return candles.map((candle) => {
    const open = value;
    const high = open + Number(candle.deltaHigh || 0);
    const low = open + Number(candle.deltaLow || 0);
    value = open + Number(candle.deltaClose || candle.delta || 0);
    buy += Number(candle.askVolume || 0);
    sell -= Number(candle.bidVolume || 0);
    return {
      timestamp: Number(candle.timestamp),
      open,
      high,
      low,
      close: value,
      value,
      buy,
      sell,
      volume: Number(candle.volume || 0),
    };
  });
}

function captureHeatmapFrame(instrumentKey, now = Date.now(), marketEvent = null) {
  let requestedDepth = 0;
  for (const subscriber of [...heatmapSseClients]) {
    if (
      subscriber.response.destroyed
      || subscriber.response.writableEnded
      || !subscriber.response.writable
    ) {
      subscriber.cleanup?.();
      continue;
    }
    if (subscriber.key === instrumentKey) {
      requestedDepth = Math.max(requestedDepth, Number(subscriber.depth) || 0);
    }
  }
  // Do not continuously clone the complete DBO book just to maintain an idle
  // cache. That work previously pinned Node above 100% CPU even when nobody
  // was viewing the map, starving charts, /health and vendor requests.
  if (!requestedDepth) return null;
  const state = heatmapHistoryState(instrumentKey);
  if (Array.isArray(marketEvent?.orderEvents) && marketEvent.orderEvents.length) {
    state.pendingOrderEvents.push(...marketEvent.orderEvents);
    if (state.pendingOrderEvents.length > 2_000) {
      state.pendingOrderEvents.splice(0, state.pendingOrderEvents.length - 2_000);
    }
  }
  if (now - state.lastEmitAt < HEATMAP_FRAME_MS) return null;
  const separator = instrumentKey.indexOf(":");
  if (separator < 1) return null;
  const exchange = instrumentKey.slice(0, separator);
  const symbol = instrumentKey.slice(separator + 1);
  const snapshot = client.book.snapshot(
    exchange,
    symbol,
    Math.min(HEATMAP_CACHE_DEPTH, requestedDepth),
    { afterSequence: state.lastSequence, tradeLimit: 256 },
  );
  if (!snapshot) return null;
  const frame = heatmapPayload(snapshot, state.lastSequence);
  frame.snapshot.orderEvents = state.pendingOrderEvents.slice();
  if (!acceptMonotonicHeatmapFrame(state, frame)) return null;
  state.pendingOrderEvents.splice(0);
  state.lastEmitAt = now;
  state.lastSequence = Number(snapshot.sequence) || state.lastSequence;
  // Only retain genuine moving-market frames. A completed Friday close stays
  // inspectable on Saturday, but repeatedly caching it would manufacture a
  // false horizontal history and imply liquidity existed after the session.
  if (frame.status.connected) {
    state.frames.push(frame);
    if (state.frames.length > HEATMAP_HISTORY_LIMIT) {
      state.frames.splice(0, state.frames.length - HEATMAP_HISTORY_LIMIT);
    }
  }
  return frame;
}

function emitRawSse(eventName, payload) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of [...rawSseClients]) {
    if (response.destroyed || response.writableEnded || !response.writable) {
      rawSseClients.delete(response);
      continue;
    }
    response.write(frame);
  }
}

client.on("marketData", (event) => {
  emitRawSse(event.type, event);
  queueQuoteBatch(event);
  for (const subscriber of [...tradeSseClients]) {
    if (
      subscriber.response.destroyed
      || subscriber.response.writableEnded
      || !subscriber.response.writable
    ) {
      subscriber.cleanup?.();
      continue;
    }
    if (event.type !== "trade" || subscriber.key !== event.instrument) continue;
    subscriber.response.write(
      `event: trades\ndata: ${JSON.stringify({
        historicalSeed: false,
        records: [normalizedTradeRecord(event.trade)],
      })}\n\n`,
    );
  }
  const capturedHeatmapFrame = event.instrument
    ? captureHeatmapFrame(event.instrument, Date.now(), event)
    : null;
  for (const subscriber of [...heatmapSseClients]) {
    if (
      subscriber.response.destroyed
      || subscriber.response.writableEnded
      || !subscriber.response.writable
    ) {
      subscriber.cleanup?.();
      continue;
    }
    if (subscriber.key !== event.instrument) continue;
    // Price can change much faster than a full 23 KB depth snapshot should be
    // serialized and proxied. Send the genuine execution tick separately so
    // high-refresh clients can move the live marker immediately without
    // multiplying full-book bandwidth or inventing trades.
    if (event.type === "trade" && Number.isFinite(Number(event.trade?.price))) {
      subscriber.response.write(
        `event: tick\ndata: ${JSON.stringify({
          timestamp: Number(event.trade.timestampMs) || Date.now(),
          tick: Math.round(Number(event.trade.price) / tickSize(subscriber.symbol)),
          contractSymbol: subscriber.symbol,
        })}\n\n`,
      );
    }
    if (!capturedHeatmapFrame) continue;
    subscriber.lastEmitAt = Date.now();
    subscriber.lastMarketTimestampMs = capturedHeatmapFrame.snapshot.timestamp;
    subscriber.lastSequence = Number(capturedHeatmapFrame.snapshot.id)
      || subscriber.lastSequence;
    const outgoingFrame = subscriber.includeOrderEvents
      ? capturedHeatmapFrame
      : {
          ...capturedHeatmapFrame,
          snapshot: { ...capturedHeatmapFrame.snapshot, orderEvents: undefined },
        };
    subscriber.response.write(
      `event: depth\ndata: ${JSON.stringify(outgoingFrame)}\n\n`,
    );
  }
});
client.on("status", (status) => emitRawSse("status", status));
client.on("gatewayError", (error) => {
  process.stderr.write(`[rithmic] ${error instanceof Error ? error.message : String(error)}\n`);
});

function emitMarketIndexQuote(snapshot) {
  for (const subscriber of [...marketIndexSseClients]) {
    if (
      subscriber.response.destroyed
      || subscriber.response.writableEnded
      || !subscriber.response.writable
    ) {
      subscriber.cleanup?.();
      continue;
    }
    if (subscriber.symbols.size && !subscriber.symbols.has(snapshot.symbol)) continue;
    subscriber.response.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  }
}

function marketIndexStatus() {
  const massive = massiveIndices.status();
  const databento = databentoEquities.status();
  const quantData = quantDataMarketSnapshots.status();
  return {
    connected: massive.connected || databento.connected || quantData.connected,
    source: massive.connected
      ? "Massive"
      : databento.connected
        ? "Databento"
        : quantData.connected
          ? "QuantData"
          : "VPS market-data edge",
    massive,
    databento,
    quantData,
  };
}

function emitMarketIndexStatus() {
  const status = marketIndexStatus();
  for (const subscriber of [...marketIndexSseClients]) {
    if (!subscriber.response.writable || subscriber.response.writableEnded) continue;
    subscriber.response.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
  }
}

function marketIndexSnapshot(symbol) {
  const massive = massiveIndices.snapshot(symbol);
  // Massive is authoritative for supported cash indices. During RTH, never
  // let a dead socket pin the chart to an old frame: a newer VPS fallback may
  // temporarily win until the one persistent Massive connection recovers.
  if (massive && (!massive.marketOpen || Date.now() - massive.timestamp < 60_000)) {
    return massive;
  }
  const direct = databentoEquities.snapshot(symbol);
  const fallback = quantDataMarketSnapshots.snapshot(symbol);
  const alternate = direct && (!fallback || direct.timestamp >= fallback.timestamp) ? direct : fallback;
  return massive && (!alternate || massive.timestamp >= alternate.timestamp) ? massive : alternate;
}

massiveIndices.on("quote", emitMarketIndexQuote);
massiveIndices.on("status", emitMarketIndexStatus);
massiveIndices.on("streamError", (error) => {
  process.stderr.write(`[massive-indices] ${error instanceof Error ? error.message : String(error)}\n`);
});
databentoEquities.on("quote", emitMarketIndexQuote);
databentoEquities.on("status", emitMarketIndexStatus);
databentoEquities.on("streamError", (error) => {
  process.stderr.write(`[databento-equities] ${error instanceof Error ? error.message : String(error)}\n`);
});
quantDataMarketSnapshots.on("quote", (snapshot) => {
  // A genuine Databento trade is the preferred source when the account is
  // entitled. The REST snapshot only fills symbols whose direct stream is
  // unavailable or stale; it can never rewind a newer live trade.
  const massive = massiveIndices.snapshot(snapshot.symbol);
  if (massive && (!massive.marketOpen || Date.now() - massive.timestamp < 60_000)) return;
  const direct = databentoEquities.snapshot(snapshot.symbol);
  if (direct && Date.now() - direct.timestamp < 5_000) return;
  emitMarketIndexQuote(snapshot);
});
quantDataMarketSnapshots.on("status", emitMarketIndexStatus);
quantDataMarketSnapshots.on("streamError", (error) => {
  process.stderr.write(`[quantdata-market-snapshots] ${error instanceof Error ? error.message : String(error)}\n`);
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    // Recording state rides on /health so "are we archiving?" is answerable
    // without shell access, and a silently stopped recorder is visible.
    return json(response, config.configured ? 200 : 503, {
      ...client.health(),
      recorder: recorder.status(),
      archiveStorage: await archiveStorageHealth(config.recordDir),
      // Checked the same way as the recorder: archived counts climbing while
      // the options market is open means gamma history is accumulating. A
      // skipped count far above archived is healthy — it is the dedupe working.
      exposure: exposureArchiver.status(),
      quantDataArchive: exposureArchiver.status(),
      vendorData: vendorDataEdge.health(),
      chartHistory: chartHistory.status(),
      tradeTape: tradeTape.status(),
      barFlow: barFlow.status(),
      sessionProfiles: sessionProfiles.status(),
      massiveIndices: massiveIndices.status(),
      databentoEquities: databentoEquities.status(),
      quantDataMarketSnapshots: quantDataMarketSnapshots.status(),
      quantDataSurfaces: quantDataSurfaces.status(),
      labRepository: labRepository.health(),
      normalizedAnalytics: normalizedAnalytics.health(),
      zyon: zyonService.health(),
      zyonTranscription: zyonTranscription.health(),
      news: newsService.health(),
      socials: socialsService.health(),
      journal: journalService.health(),
      desktopRevocations: desktopRevocationSynchronizer?.status() ?? { configured: false },
      eventLoop: eventLoopLoadGuard.status(),
    });
  }
  const authorization = await gatewayAuthorizer.authorize(request, url.pathname);
  if (!authorization.allowed) {
    return json(response, authorization.status, {
      error: authorization.status === 403
        ? "Forbidden"
        : authorization.status === 503
          ? "Authorization unavailable"
          : "Unauthorized",
      code: authorization.code,
    });
  }
  if (eventLoopLoadGuard.isOverloaded() && isDeferrableDuringOverload(url.pathname)) {
    response.setHeader("Retry-After", "30");
    return json(response, 503, {
      error: "Archive work is temporarily paused to protect the live market-data feed.",
      code: "live_feed_priority",
    });
  }
  try {
    if (zyonTranscription.canHandle(request.method, url.pathname)) {
      try {
        await zyonTranscription.handle(request, response, authorization.principal);
        return;
      } catch (error) {
        const failure = zyonTranscriptionProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (zyonService.canHandle(request.method, url.pathname)) {
      try {
        await zyonService.forward(request, response, url, authorization.principal);
        return;
      } catch (error) {
        const failure = zyonServiceProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (newsService.canHandle(request.method, url.pathname)) {
      try {
        await newsService.forward(request, response, url, authorization.principal);
        return;
      } catch (error) {
        const failure = newsServiceProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (socialsService.canHandle(request.method, url.pathname)) {
      try {
        await socialsService.forward(request, response, url, authorization.principal);
        return;
      } catch (error) {
        const failure = socialsServiceProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (journalService.canHandle(request.method, url.pathname)) {
      try {
        await journalService.forward(request, response, url, authorization.principal);
        return;
      } catch (error) {
        const failure = journalServiceProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (vendorDataEdge.canHandle(url.pathname)) {
      await vendorDataEdge.handle(request, response, url);
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/bounce-levels") {
      try {
        await normalizedAnalytics.forwardBounceLevels(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/gameplan") {
      try {
        await normalizedAnalytics.forwardGameplan(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/options-flow") {
      try {
        await normalizedAnalytics.forwardOptionsFlowWorkspace(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/options-flow/market-data") {
      try {
        await normalizedAnalytics.forwardOptionsFlowMarketData(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/classic-gex-profile") {
      try {
        await normalizedAnalytics.forwardClassicGexProfile(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/dark-pool-map") {
      try {
        await normalizedAnalytics.forwardDarkPoolMap(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/implied-volatility-rank") {
      try {
        await normalizedAnalytics.forwardImpliedVolatilityRank(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/gamma-environment") {
      try {
        await normalizedAnalytics.forwardGammaEnvironment(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/chart-gamma-levels") {
      try {
        await normalizedAnalytics.forwardChartGammaLevels(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/expected-move") {
      try {
        await normalizedAnalytics.forwardExpectedMove(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/hedge-levels") {
      try {
        await normalizedAnalytics.forwardHedgeLevels(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/vix-environment") {
      try {
        await normalizedAnalytics.forwardVixEnvironment(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/zero-gamma-line") {
      try {
        await normalizedAnalytics.forwardZeroGammaLine(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/options-delta") {
      try {
        await normalizedAnalytics.forwardOptionsDelta(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/zero-gamma-bars") {
      try {
        await normalizedAnalytics.forwardZeroGammaBars(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/gamma-heatmap") {
      try {
        await normalizedAnalytics.forwardGammaHeatmap(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/net-gamma-exposure-by-strike") {
      try {
        await normalizedAnalytics.forwardNetGammaExposureByStrike(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/gex-interval-map") {
      try {
        await normalizedAnalytics.forwardGexIntervalMap(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/gex-map") {
      try {
        await normalizedAnalytics.forwardGexMap(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/analytics/gex-flow") {
      try {
        await normalizedAnalytics.forwardGexFlow(response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "POST" && url.pathname === "/v1/analytics/gex-flow/ratios") {
      try {
        await normalizedAnalytics.forwardGexFlowRatios(request, response, url);
        return;
      } catch (error) {
        const failure = normalizedAnalyticsProblem(error);
        return json(response, failure.status, { error: failure.message, code: failure.code });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/options") {
      try {
        return json(response, 200, await optionCatalog.load());
      } catch (error) {
        const status = error instanceof OptionsCatalogError ? error.status : 502;
        return json(response, status, {
          error: error instanceof OptionsCatalogError
            ? error.message
            : "CME options catalog is unavailable.",
          code: error instanceof OptionsCatalogError
            ? error.code
            : "options_catalog_unavailable",
        });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/trade-tape") {
      /*
       * The prints behind an event-bar chart. Bounded by window and by count:
       * a range chart asks for a few hours, and a whole session unasked is
       * megabytes nobody wanted.
       */
      /*
       * Exact root: an MNQ chart must be built from MNQ prints. The default
       * resolution aliases a micro to its parent, which for a tape means
       * silently serving NQ's prints as MNQ's - indistinguishable to the
       * caller, and wrong.
       */
      const instrument = requestedInstrument(url, {}, { exactRoot: true });
      try {
        return json(response, 200, await tradeTape.load({
          exchange: instrument.exchange,
          symbol: instrument.symbol,
          fromMs: url.searchParams.get("fromMs"),
          toMs: url.searchParams.get("toMs"),
          limit: Math.min(MAX_TAPE_PRINTS, Number(url.searchParams.get("limit")) || MAX_TAPE_PRINTS),
        }));
      } catch (error) {
        return json(response, 502, {
          error: "The recorded trade tape is unavailable.",
          code: "trade_tape_unavailable",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/history") {
      let instrument = requestedInstrument(url);
      const root = parentRoot(contractRoot(instrument.symbol));
      let allowed = gatewayInstrumentCatalog().some((row) => (
        row.root === root
        && String(row.exchange || "").toUpperCase() === instrument.exchange
      ));
      if (!allowed) {
        try {
          const option = await optionCatalog.resolve(
            url.searchParams.get("contractSymbol") || url.searchParams.get("symbol"),
          );
          if (option) {
            instrument = { exchange: option.venue, symbol: option.symbol };
            allowed = true;
          }
        } catch (error) {
          if (error instanceof OptionsCatalogError && error.status === 503) {
            return json(response, error.status, { error: error.message, code: error.code });
          }
        }
      }
      if (!allowed) {
        return json(response, 400, {
          error: "The requested chart-history instrument is not enabled.",
          code: "history_instrument_not_enabled",
        });
      }
      try {
        const history = await chartHistory.load({
          exchange: instrument.exchange,
          symbol: instrument.symbol,
          interval: url.searchParams.get("interval"),
          fromMs: url.searchParams.get("fromMs"),
          toMs: url.searchParams.get("toMs"),
          limit: url.searchParams.get("limit"),
        });
        if (url.searchParams.get("orderFlow") !== "1") return json(response, 200, history);

        /*
         * Aggressor flow for footprint, CVD, delta and Big Trades.
         *
         * Attached to the bars rather than fetched separately, because the two
         * have to describe the same bars - and returned as a MISSING field
         * rather than as zeros when the instrument has no tape, since a real
         * zero delta means balanced trade and an absent one means nobody
         * recorded the side.
         */
        const candles = Array.isArray(history.candles) ? history.candles : [];
        const flowWindow = await barFlow.load({
          exchange: instrument.exchange,
          symbol: instrument.symbol,
          interval: url.searchParams.get("interval"),
          fromMs: candles.length ? candles[0].timestamp : url.searchParams.get("fromMs"),
          toMs: url.searchParams.get("toMs"),
        });
        let covered = 0;
        const withFlow = candles.map((candle) => {
          const flow = flowWindow.flow.get(candle.timestamp);
          if (!flow) return candle;
          covered += 1;
          return {
            ...candle,
            // The recorder's own count is the honest one where they differ:
            // the bar archive counts every print, flow only the sided ones.
            volume: Math.max(Number(candle.volume ?? 0), flow.volume),
            trades: flow.trades,
            askVolume: flow.askVolume,
            bidVolume: flow.bidVolume,
            delta: flow.delta,
            deltaOpen: 0,
            deltaHigh: flow.deltaHigh,
            deltaLow: flow.deltaLow,
            deltaClose: flow.delta,
          };
        });
        return json(response, 200, {
          ...history,
          candles: withFlow,
          executions: url.searchParams.get("exec") === "0" ? [] : flowWindow.executions,
          flowCoverage: candles.length ? covered / candles.length : 0,
        });
      } catch (error) {
        const status = error instanceof HistoryRequestError ? error.status : 502;
        return json(response, status, {
          error: error instanceof HistoryRequestError
            ? error.message
            : "CME chart history is unavailable.",
          code: error instanceof HistoryRequestError
            ? error.code
            : "history_unavailable",
        });
      }
    }
    if (request.method === "GET" && url.pathname === "/v1/lab/snapshot") {
      const root = String(url.searchParams.get("root") || "NQ").trim().toUpperCase();
      try {
        return json(response, 200, await labRepository.readSnapshot(root));
      } catch (error) {
        const status = error?.code === "ENOENT"
          ? 404
          : error?.code === "LAB_REPOSITORY_NOT_CONFIGURED"
            ? 503
            : error?.code === "LAB_ROOT_UNSUPPORTED"
              ? 400
              : 422;
        return json(response, status, {
          error: error instanceof Error ? error.message : "The Lab repository snapshot is unavailable.",
          code: error?.code || "LAB_REPOSITORY_ERROR",
        });
      }
    }
    if (request.method === "POST" && url.pathname === "/v1/lab/snapshot") {
      try {
        const body = await bodyJson(request);
        return json(response, 200, await labRepository.publishSnapshot(body));
      } catch (error) {
        const status = error?.code === "LAB_REPOSITORY_NOT_CONFIGURED"
          ? 503
          : error?.code === "LAB_SNAPSHOT_OUT_OF_ORDER"
            ? 409
            : error?.code === "LAB_ROOT_UNSUPPORTED"
              ? 400
              : 422;
        return json(response, status, {
          error: error instanceof Error ? error.message : "The Lab repository refused the snapshot publication.",
          code: error?.code || "LAB_REPOSITORY_ERROR",
        });
      }
    }
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
    if (request.method === "GET" && url.pathname === "/v1/market-data/quotes") {
      const symbols = String(url.searchParams.get("symbols") || "")
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean)
        .slice(0, 40);
      if (!symbols.length) return json(response, 400, { error: "Select at least one instrument." });
      const symbolSet = new Set(symbols);
      const priority = new Set(
        String(url.searchParams.get("priority") || "")
          .split(",")
          .map((symbol) => symbol.trim())
          .filter((symbol) => symbolSet.has(symbol)),
      );
      const aliasesByKey = new Map();
      const instrumentsByKey = new Map();
      const rejected = [];
      for (const alias of symbols) {
        try {
          const instrument = requestedQuoteInstrument(alias);
          client.subscribe(instrument.exchange, instrument.symbol);
          const key = `${instrument.exchange}:${instrument.symbol}`;
          const aliases = aliasesByKey.get(key) || [];
          aliases.push(alias);
          aliasesByKey.set(key, aliases);
          instrumentsByKey.set(key, instrument);
        } catch (error) {
          rejected.push({ alias, error: error instanceof Error ? error.message : String(error) });
        }
      }
      if (!aliasesByKey.size) {
        return json(response, 422, { error: "None of the requested instruments are available.", rejected });
      }
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.write("retry: 1500\n\n");
      response.write(`event: status\ndata: ${JSON.stringify({
        connected: Boolean(client.status.connected && client.status.authenticated),
        source: "CME",
        dataset: "Rithmic Ticker Plant",
        transport: "vps-rithmic",
        rejected,
      })}\n\n`);

      const subscriber = {
        response,
        aliasesByKey,
        instrumentsByKey,
        priority,
        pending: new Map(),
        lastPublishedAt: new Map(),
      };
      for (const [key, aliases] of aliasesByKey) {
        const instrument = instrumentsByKey.get(key);
        for (const alias of aliases) {
          const cached = liveQuoteCache.get(alias);
          const payload = cached && Date.now() - cached.updatedAt <= 120_000
            ? { ...cached.payload, cached: true }
            : quotePayload(alias, instrument);
          if (payload) response.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
      }
      quoteSseClients.add(subscriber);
      const keepalive = setInterval(() => response.write(
        `event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`,
      ), 8_000);
      const lease = setTimeout(() => {
        response.write(`event: rotate\ndata: ${JSON.stringify({ reason: "stream-lease", timestamp: Date.now() })}\n\n`);
        response.end();
      }, 4.5 * 60_000);
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(keepalive);
        clearTimeout(lease);
        quoteSseClients.delete(subscriber);
      };
      request.on("close", cleanup);
      response.on("close", cleanup);
      response.on("error", cleanup);
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/index-stream") {
      if (!config.massiveApiKey && !config.databentoApiKey && !config.quantDataApiKey) {
        return json(response, 503, { error: "No options-underlying provider is configured on the market-data gateway." });
      }
      const symbols = new Set(
        String(url.searchParams.get("symbols") || "")
          .split(",")
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean)
          .slice(0, 40),
      );
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.write("retry: 1000\n\n");
      response.write(`event: status\ndata: ${JSON.stringify(marketIndexStatus())}\n\n`);
      for (const symbol of symbols) {
        const cached = marketIndexSnapshot(symbol);
        if (cached) response.write(`data: ${JSON.stringify(cached)}\n\n`);
      }
      const subscriber = { response, symbols, cleanup: null };
      marketIndexSseClients.add(subscriber);
      const keepalive = setInterval(() => response.write(": keepalive\n\n"), 8_000);
      const streamGuard = createDesktopStreamGuard({
        authorization,
        response,
        revocationCache: desktopTicketRevocations,
      });
      const cleanup = () => {
        clearInterval(keepalive);
        streamGuard.dispose();
        marketIndexSseClients.delete(subscriber);
      };
      subscriber.cleanup = cleanup;
      request.on("close", cleanup);
      response.on("close", cleanup);
      response.on("error", cleanup);
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/index-snapshot") {
      if (!config.massiveApiKey && !config.databentoApiKey && !config.quantDataApiKey) {
        return json(response, 503, { error: "No options-underlying provider is configured on the market-data gateway." });
      }
      const symbols = [...new Set(
        String(url.searchParams.get("symbols") || "")
          .split(",")
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean)
          .slice(0, 40),
      )];
      if (!symbols.length) return json(response, 400, { error: "Select at least one market instrument." });
      const snapshots = symbols.flatMap((symbol) => {
        const snapshot = marketIndexSnapshot(symbol);
        return snapshot ? [snapshot] : [];
      });
      return json(response, 200, {
        snapshots,
        status: marketIndexStatus(),
        asOf: Date.now(),
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/index-history") {
      const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
      const timeframe = String(url.searchParams.get("timeframe") || "5m").trim();
      const from = Number(url.searchParams.get("from"));
      const to = Number(url.searchParams.get("to"));
      let providerFailure = null;
      if (quantDataMarketHistory.supports(symbol) && config.quantDataApiKey) {
        try {
          return json(response, 200, await quantDataMarketHistory.load({ symbol, timeframe, from, to }));
        } catch (error) {
          if (error instanceof MarketIndexHistoryError && error.status < 500) {
            return json(response, error.status, { error: error.message, code: error.code });
          }
          providerFailure = error;
        }
      }
      if (config.massiveApiKey) {
        try {
          const candles = await massiveIndices.history({ symbol, timeframe, from, to });
          return json(response, 200, {
            candles,
            symbol,
            source: "Massive (VPS)",
            from,
            to,
            truncated: candles.length >= 50_000,
          });
        } catch (error) {
          providerFailure = error;
        }
      }
      return json(response, providerFailure ? 502 : 503, {
        error: providerFailure
          ? "Market Index history is unavailable from the configured VPS providers."
          : "Market Index history is not configured on the VPS.",
        code: providerFailure ? "index_history_unavailable" : "index_history_unconfigured",
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/trades") {
      let instrument = requestedInstrument(url);
      const requestedRoot = parentRoot(contractRoot(instrument.symbol));
      const futuresEnabled = gatewayInstrumentCatalog().some((row) => (
        row.root === requestedRoot
        && String(row.exchange || "").toUpperCase() === instrument.exchange
      ));
      if (!futuresEnabled) {
        let option;
        try {
          option = await optionCatalog.resolve(
            url.searchParams.get("contractSymbol") || url.searchParams.get("symbol"),
          );
        } catch (error) {
          const status = error instanceof OptionsCatalogError ? error.status : 502;
          return json(response, status, {
            error: error instanceof OptionsCatalogError
              ? error.message
              : "CME option live data is unavailable.",
            code: error instanceof OptionsCatalogError
              ? error.code
              : "option_live_unavailable",
          });
        }
        if (!option) {
          return json(response, 400, {
            error: "The requested live instrument is not enabled.",
            code: "live_instrument_not_enabled",
          });
        }
        instrument = { exchange: option.venue, symbol: option.symbol };
        let release;
        try {
          release = optionTrades.subscribe(option.symbol);
        } catch (error) {
          return json(response, 429, {
            error: error instanceof Error ? error.message : "The CME option live limit was reached.",
            code: "option_live_limit",
          });
        }
        const seedTrades = optionTrades.trades(option.symbol);
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        response.write(`event: ready\ndata: ${JSON.stringify({
          provider: "Databento",
          dataset: "GLBX.MDP3",
          symbol: option.symbol,
        })}\n\n`);
        response.write(`event: seed\ndata: ${JSON.stringify({
          candles: aggregateCandles(seedTrades, 1_000, 7_200),
          records: seedTrades.map(normalizedTradeRecord),
          historicalAvailable: false,
        })}\n\n`);
        const onTrade = (event) => {
          if (event.symbol !== option.symbol || response.destroyed || response.writableEnded) return;
          response.write(`event: trades\ndata: ${JSON.stringify({
            historicalSeed: false,
            records: [normalizedTradeRecord(event.trade)],
          })}\n\n`);
        };
        optionTrades.on("trade", onTrade);
        const keepalive = setInterval(() => response.write(": keepalive\n\n"), 10_000);
        const streamGuard = createDesktopStreamGuard({
          authorization,
          response,
          revocationCache: desktopTicketRevocations,
        });
        let cleanedUp = false;
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          clearInterval(keepalive);
          streamGuard.dispose();
          optionTrades.off("trade", onTrade);
          release();
        };
        request.on("close", cleanup);
        response.on("close", cleanup);
        response.on("error", cleanup);
        return;
      }
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
      const streamGuard = createDesktopStreamGuard({
        authorization,
        response,
        revocationCache: desktopTicketRevocations,
      });
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(keepalive);
        streamGuard.dispose();
        tradeSseClients.delete(subscriber);
      };
      request.on("close", cleanup);
      response.on("close", cleanup);
      response.on("error", cleanup);
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/heatmap/stream") {
      const instrument = requestedInstrument(url);
      client.subscribe(instrument.exchange, instrument.symbol);
      const depth = Math.min(5_000, Math.max(20, Number(url.searchParams.get("depthTicks") || 400)));
      const afterTimestamp = Math.max(0, Number(url.searchParams.get("afterTimestamp") || 0));
      const includeOrderEvents = url.searchParams.get("includeOrderEvents") === "1";
      const includeOrders = url.searchParams.get("includeOrders") === "1";
      const snapshot = client.book.snapshot(instrument.exchange, instrument.symbol, depth, {
        includeOrders,
        orderLimit: 50_000,
      });
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
      // Seed the cursor just behind the tape's 35-row capacity. Starting at 0
      // would put every retained trade in the session on the first column;
      // starting at the head would leave the tape blank until the next print.
      const seedTrades = snapshot?.trades?.slice(-40) || [];
      let lastSequence = seedTrades.length
        ? Math.max(0, (Number(seedTrades[0].sequence) || 0) - 1)
        : Number(snapshot?.sequence) || 0;
      let initialMarketTimestampMs = 0;
      if (snapshot) {
        const initialFrame = heatmapPayload(snapshot, lastSequence);
        response.write(
          `event: cvd-history\ndata: ${JSON.stringify({
            tradingDate: chicagoTradingDate(snapshot.asOfMs || Date.now()),
            asOfMs: snapshot.asOfMs || Date.now(),
            points: sessionCvdHistory(
              instrument.exchange,
              instrument.symbol,
              snapshot.asOfMs || Date.now(),
            ),
          })}\n\n`,
        );
        const historyState = heatmapHistoryState(
          `${instrument.exchange}:${instrument.symbol}`,
        );
        const replayFrames = afterTimestamp > 0
          ? historyState.frames.filter((frame) => Number(frame.snapshot?.timestamp) > afterTimestamp)
          : historyState.frames;
        if (replayFrames.length > 1) {
          for (let offset = 0; offset < replayFrames.length; offset += HEATMAP_HISTORY_CHUNK_SIZE) {
            const chunk = replayFrames.slice(offset, offset + HEATMAP_HISTORY_CHUNK_SIZE);
            response.write(
              `event: history\ndata: ${JSON.stringify({
                status: initialFrame.status,
                snapshots: chunk.map((frame) => includeOrderEvents
                  ? frame.snapshot
                  : { ...frame.snapshot, orderEvents: undefined }),
                totalFrames: replayFrames.length,
                final: offset + chunk.length >= replayFrames.length,
              })}\n\n`,
            );
          }
          initialMarketTimestampMs = Math.max(afterTimestamp, historyState.lastMarketTimestampMs);
          lastSequence = historyState.lastSequence;
        } else {
          const initialCursor = { lastMarketTimestampMs: 0 };
          if (acceptMonotonicHeatmapFrame(initialCursor, initialFrame)) {
            const seededInitialFrame = {
              ...initialFrame,
              snapshot: {
                ...initialFrame.snapshot,
                // cvd-history already includes every retained execution up to
                // this snapshot. Keep its trades for bubbles/tape, but do not
                // add their net delta to CVD a second time.
                delta: 0,
              },
            };
            response.write(
              `event: depth\ndata: ${JSON.stringify(seededInitialFrame)}\n\n`,
            );
            initialMarketTimestampMs = initialCursor.lastMarketTimestampMs;
          }
        }
        lastSequence = Number(snapshot.sequence) || lastSequence;
      }
      const subscriber = {
        key: `${instrument.exchange}:${instrument.symbol}`,
        exchange: instrument.exchange,
        symbol: instrument.symbol,
        depth,
        lastEmitAt: 0,
        lastMarketTimestampMs: initialMarketTimestampMs,
        lastSequence,
        includeOrderEvents,
        response,
      };
      heatmapSseClients.add(subscriber);
      const keepalive = setInterval(() => response.write(
        `event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`,
      ), 5_000);
      const streamGuard = createDesktopStreamGuard({
        authorization,
        response,
        revocationCache: desktopTicketRevocations,
      });
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(keepalive);
        streamGuard.dispose();
        heatmapSseClients.delete(subscriber);
      };
      subscriber.cleanup = cleanup;
      request.on("close", cleanup);
      response.on("close", cleanup);
      response.on("error", cleanup);
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
    if (request.method === "GET" && url.pathname === "/v1/market-data/catalog") {
      return json(response, 200, {
        schemaVersion: "kwantdesk-liquidity-map-catalog-v1",
        provider: "Rithmic",
        environment: config.systemName,
        instruments: gatewayInstrumentCatalog(),
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/resolve") {
      const requestedRoot = parentRoot(contractRoot(
        String(url.searchParams.get("root") || url.searchParams.get("symbol") || "").toUpperCase(),
      ));
      const requestedExchange = String(
        url.searchParams.get("exchange") || exchangeForRoot(requestedRoot),
      ).toUpperCase();
      const catalogRow = gatewayInstrumentCatalog().find((row) => (
        row.root === requestedRoot && row.exchange === requestedExchange
      ));
      if (!catalogRow) {
        return json(response, 400, {
          error: `${requestedExchange}:${requestedRoot} is not enabled for full-depth liquidity data.`,
        });
      }
      const resolved = await client.resolveFrontMonth(requestedExchange, requestedRoot);
      client.subscribe(resolved.exchange, resolved.contractSymbol);
      const metadata = contractMetadata(resolved.contractSymbol);
      return json(response, 200, {
        root: requestedRoot,
        symbol: resolved.contractSymbol,
        contractSymbol: resolved.contractSymbol,
        exchange: resolved.exchange,
        displayName: FUTURES_DISPLAY_NAMES[requestedRoot] || metadata.displayName || requestedRoot,
        contractLabel: metadata.contractLabel,
        tickSize: tickSize(requestedRoot),
        fullDepth: config.enableDepthByOrder,
        status: "SUBSCRIBING",
        resolutionSource: resolved.source,
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
      const intervalMs = intervalDurationMs(interval);
      const eventBased = isEventBasedInterval(interval);
      const trades = client.book.trades(instrument.exchange, instrument.symbol, { fromMs, toMs });
      // The caller has always sent this; nothing here ever read it. Charts ask
      // for candles only, and were served the whole raw tape TWICE for their
      // trouble - measured at 6.1 MB for two hours of NQ 3m, of which the 42
      // candles CVD actually needs are a few kilobytes. The browser then parsed
      // and normalised both copies on the main thread, per pane, on load and on
      // every heal cycle. That is main-thread starvation bought with bandwidth.
      const includeTrades = String(url.searchParams.get("includeTrades") || "").toLowerCase() === "true";
      // Mapped ONCE. `records` and `trades` were two independent maps over the
      // same source, so the work and the payload were both doubled.
      const normalizedTrades = trades.map(normalizedTradeRecord);
      const compactFlowCandles = !eventBased && intervalMs >= 60_000
        ? client.book.flowCandles(instrument.exchange, instrument.symbol, { fromMs, toMs, intervalMs })
        : [];
      return json(response, 200, {
        schemaVersion: "kwantify-market-data-v3",
        provider: "Rithmic",
        source: "Rithmic Ticker Plant trades",
        root: instrument.symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, ""),
        contractSymbol: instrument.symbol,
        interval,
        // Minute-and-higher bars come from the lossless compact flow store.
        // Raw prints remain in the response for Big Trades and live studies,
        // but pruning that tape can no longer truncate or rebase CVD.
        // Event bars are built by the chart history provider. Returning a
        // minute-shaped fallback under a 40R/500V label corrupts their OHLC
        // geometry, so event requests carry executions only.
        candles: eventBased
          ? []
          : compactFlowCandles.length
            ? compactFlowCandles
            : aggregateCandles(trades, intervalMs),
        records: normalizedTrades,
        // Only when asked for. It is the same tape as `records`, so a caller
        // that wants the prints already has them.
        ...(includeTrades ? { trades: normalizedTrades } : {}),
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
      const { tradingDate, startMs, endMs } = resolveVolumeProfileRange(url.searchParams);
      const groupTicks = Math.max(1, Number(url.searchParams.get("groupTicks") || 1));
      const valueAreaPercent = Math.max(
        1,
        Math.min(100, Number(url.searchParams.get("valueAreaPercent") || 70)),
      );
      const minTradeVolume = Math.max(0, Number(url.searchParams.get("minTradeVolume") || 0));
      const maxTradeVolume = Math.max(0, Number(url.searchParams.get("maxTradeVolume") || 0));
      const priceTick = tickSize(instrument.symbol);
      const rows = new Map();
      /*
       * The live in-memory ring only. Reading the recorded tape here instead
       * took the gateway down at the open: a profile poll could pull a whole
       * session of prints, and this is one Node process, so each one blocked
       * the event loop that also serves options, GEX and every quote. Measured
       * during the incident: /health timing out at 30s and a single profile
       * request taking 58s.
       *
       * The tape is still the right source for a prior session - it has to be,
       * the ring cannot reach back - but it has to be folded once and cached,
       * the way bar flow is, rather than read per request.
       */
      const profileTrades = client.book.trades(
        instrument.exchange,
        instrument.symbol,
        { fromMs: startMs, toMs: endMs },
      );
      /*
       * The ring is bounded, so a window that has rolled out of it comes back
       * covering a fraction of what was asked for - measured mid-session, that
       * day's Asia window returned one hour of seven and London's was missing
       * its first six. Every figure below was then computed correctly over the
       * wrong span, which is how the daily session profiles "kept
       * disappearing" as the day went on.
       *
       * The folded session covers it, and is read only when it is ALREADY
       * folded: a fold reads a whole session, and doing that on the request
       * path is what took the desk down twice.
       */
      const ringReachesBack = startMs > 0
        && profileTrades.length > 0
        && profileTrades[0].timestampMs <= startMs + 60_000;
      const foldedProfile = ringReachesBack
        ? null
        : await sessionProfiles.load({
          exchange: instrument.exchange,
          symbol: instrument.symbol,
          tickSize: priceTick,
          fromMs: startMs,
          toMs: endMs,
          minTradeVolume,
          maxTradeVolume,
        });
      const tailTrades = volumeProfileTailTrades(profileTrades, foldedProfile);
      const { coverageStartMs, coverageEndMs } = combinedVolumeProfileCoverage(
        foldedProfile,
        tailTrades,
      );
      const coverageHasGap = volumeProfileSourcesHaveGap(foldedProfile, tailTrades);
      let weightedPrice = 0;
      let weightedSquaredPrice = 0;
      let includedTrades = 0;
      /*
       * A folded session arrives already summed per price, so the trade-size
       * filters cannot be applied to it - those need individual prints, which
       * folding is precisely the act of discarding. They are only ever set on
       * the developing profile, where the ring still reaches.
       */
      const foldedLevels = foldedProfile?.levels ?? null;
      for (const level of foldedLevels ?? []) {
        const groupedTick = Math.floor(Math.round(level.price / priceTick) / groupTicks) * groupTicks;
        let row = rows.get(groupedTick);
        if (!row) {
          row = {
            price: groupedTick * priceTick,
            volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0,
          };
          rows.set(groupedTick, row);
        }
        row.volume += level.volume;
        row.trades += level.trades;
        row.askVolume += level.askVolume;
        row.bidVolume += level.bidVolume;
        row.delta = row.askVolume - row.bidVolume;
        weightedPrice += level.price * level.volume;
        weightedSquaredPrice += level.price * level.price * level.volume;
        includedTrades += level.trades;
      }
      // A folded live session is a checkpoint, not a replacement for the live
      // ring. Append only prints newer than its coverage edge, otherwise the
      // profile freezes at the fold time until the next expensive rebuild.
      for (const trade of tailTrades) {
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
        tradingDate,
        startMs,
        endMs,
        coverageStartMs,
        coverageEndMs,
        /*
         * Whether the window asked for was actually covered.
         *
         * The tape is bounded per request, so a multi-session window can come
         * back holding only its newest part - and every field below is then
         * computed correctly over the wrong span. Measured: a prior-week NQ
         * profile reported a POC and value area from prints starting on the
         * Tuesday of that week, and an ES one from the Thursday, with nothing
         * in the response to say so.
         *
         * A value area is the band holding a share of ALL the volume in its
         * window, so a partly covered one is not a rougher answer - it is a
         * confident answer at the wrong prices. null when the request named no
         * start, since there is then nothing to have fallen short of.
         */
        complete: startMs > 0
          ? coverageStartMs !== null
            && coverageStartMs <= startMs + 5 * 60_000
            && !coverageHasGap
          : null,
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
    if (request.method === "GET" && url.pathname === "/v1/market-data/archive-value-area") {
      const instrument = requestedInstrument(url);
      const startMs = Number(url.searchParams.get("startMs") || 0);
      const endMs = Number(url.searchParams.get("endMs") || 0);
      const profile = await buildArchivedValueAreaProfile({
        dir: config.recordDir,
        exchange: instrument.exchange,
        symbol: instrument.symbol,
        startMs,
        endMs,
        tickSize: tickSize(instrument.symbol),
        valueAreaPercent: 0.7,
      });
      if (!profile) {
        return json(response, 404, {
          error: "No complete recorded trade profile is available for that session.",
        });
      }
      return json(response, 200, profile);
    }
    if (request.method === "GET" && url.pathname === "/v1/market-data/cash-index-history") {
      const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
      const sessionDate = String(url.searchParams.get("sessionDate") || "").trim();
      if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
        return json(response, 400, { error: "symbol and sessionDate (YYYY-MM-DD) are required." });
      }
      const archived = await cashIndexArchiver.readSession(symbol, sessionDate);
      if (!archived) {
        return json(response, 404, {
          error: `No archived ${symbol} session for ${sessionDate}.`,
          archiver: cashIndexArchiver.status(),
        });
      }
      return json(response, 200, archived);
    }
    if (request.method === "GET" && url.pathname === "/v1/heatmap/replay") {
      // Manifest for a completed session's replay pack, building it from the
      // archive on first request. The response is one of: {manifest},
      // {building, events, frames}, or {error} — never invented data.
      const tradingDate = String(url.searchParams.get("tradingDate") || "").trim();
      const root = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
      const exchange = String(url.searchParams.get("exchange") || "CME").trim().toUpperCase();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDate) || !root) {
        return json(response, 400, { error: "tradingDate (YYYY-MM-DD) and symbol are required." });
      }
      const result = await heatmapReplay.manifestOrBuild(tradingDate, exchange, root);
      return json(response, result.error ? 404 : 200, result);
    }
    if (request.method === "GET" && url.pathname === "/v1/heatmap/replay/chunk") {
      const tradingDate = String(url.searchParams.get("tradingDate") || "").trim();
      const root = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
      const exchange = String(url.searchParams.get("exchange") || "CME").trim().toUpperCase();
      const chunkStartMs = Number(url.searchParams.get("chunk"));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDate) || !root || !Number.isFinite(chunkStartMs)) {
        return json(response, 400, { error: "tradingDate, symbol and chunk are required." });
      }
      const chunk = await heatmapReplay.readChunk(tradingDate, exchange, root, chunkStartMs);
      if (!chunk) return json(response, 404, { error: "No replay chunk for that window." });
      return json(response, 200, chunk);
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
    // Asking for an instrument this collector is not allowed to subscribe is
    // a caller mistake, not a server fault. Answer 400 so it is obvious in
    // the website logs instead of hiding inside a generic 500.
    if (error?.code === "RITHMIC_INSTRUMENT_NOT_ALLOWED") {
      return json(response, 400, { error: error.message, code: error.code });
    }
    return json(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/*
 * Pull the options surfaces whether or not anyone is looking at them.
 *
 * The exposure archiver only ever sees what the product requests, so the
 * options archive recorded what was looked at rather than what the market did
 * - 4.0 GB on a day the desk was in use against 4.6 MB on a day GEX was
 * broken, and the provider sells no history to fill that back in.
 *
 * It polls through this gateway's OWN vendor edge over loopback, so the
 * payload is archived, cached and coalesced exactly as a pane's request would
 * be, and it holds a hard budget well under the account's 240/minute because
 * exhausting that kills every GEX page at once.
 */
const quantDataSurfaces = new QuantDataSurfacePoller({
  origin: `http://127.0.0.1:${config.port}`,
  token: config.gatewayToken,
  /*
   * Off unless explicitly switched on.
   *
   * The account allows 240 requests a minute for EVERYTHING, and the desk's
   * own GEX panes are spending it live. This poller takes up to 45 of those to
   * fill an archive, and a 429 is not a degraded surface - it is account-level,
   * so it kills every GEX page at once. Measured during a session: 79 requests,
   * 3 of them rate-limited, while GEX was dropping in and out.
   *
   * The archive is worth having; it is not worth it during a session. Set
   * QUANTDATA_SURFACE_POLLER=1 to run it, and run it out of hours.
   */
  enabled: Boolean(config.quantDataApiKey && config.gatewayToken)
    && process.env.QUANTDATA_SURFACE_POLLER === "1",
  log: (line) => process.stdout.write(`${line}
`),
});

server.listen(config.port, config.host, () => {
  process.stdout.write(
    `Olisa Labs Platform Rithmic gateway listening on http://${config.host}:${config.port}\n`,
  );
  // Started here rather than at construction: it talks to this server, so the
  // socket has to be accepting connections first.
  quantDataSurfaces.start();
  desktopRevocationSynchronizer?.start();
  if (recorder.enabled) {
    process.stdout.write(`[recorder] capturing raw stream to ${config.recordDir}\n`);
  } else {
    process.stdout.write("[recorder] DISABLED - live data is not being archived\n");
  }
  if (config.configured) {
    // The live connection must win the startup race. The old sequence waited
    // for every archived trade to replay before starting Rithmic, leaving all
    // charts frozen for minutes after a gateway restart. Replay into an
    // isolated book in parallel, then merge only historical tape fields.
    client.start().catch((error) => {
      process.stderr.write(`[rithmic] initial connection failed: ${error.message}\n`);
    });
    const archiveBook = new RithmicBookStore({ maxTrades: client.book?.maxTrades || 250_000 });
    replayArchiveIntoBook({
      dir: config.recordDir,
      book: archiveBook,
      log: (line) => process.stdout.write(`${line}\n`),
    })
      .then((result) => {
        const merged = client.book.mergeHistoricalTradesFrom(archiveBook);
        process.stdout.write(
          result.reason
            ? `[replay] skipped: ${result.reason}\n`
            : `[replay] restored ${result.replayed} trades and merged ${merged} historical trades from ${result.files} file(s) for ${result.tradingDate}\n`,
        );
      })
      .catch((error) => {
        process.stderr.write(`[replay] failed: ${error.message}\n`);
      });
  }
  if (config.databentoApiKey) databentoEquities.start();
  if (config.quantDataApiKey) quantDataMarketSnapshots.start();
  if (config.massiveApiKey) massiveIndices.start();
  if (exposureArchiver.enabled) {
    exposureArchiver.start();
    process.stdout.write(`[exposure] archiving options surfaces to ${exposureArchiver.dir}\n`);
  } else {
    process.stdout.write("[exposure] DISABLED - gamma history will not accumulate\n");
  }
  if (cashIndexArchiver.enabled) {
    cashIndexArchiver.start();
    process.stdout.write(`[cash-index] archiving ${cashIndexArchiver.tickers.join(", ")} after every cash close\n`);
  } else {
    process.stdout.write("[cash-index] DISABLED - needs recordDir and the QuantData key\n");
  }
});

/**
 * One shutdown, in order, and nothing exits before the tape is on disk.
 *
 * There were TWO handlers registered for the same signals and both called
 * process.exit(0). Whichever won killed the process while the other was still
 * working, and process.exit does not wait for pending writes - so the
 * recorder's gzip trailers were never written and every restart truncated the
 * last member of every open file. A reader stops at that point, which is why
 * roughly a third of each recorded session was unreadable.
 *
 * The recorder closes FIRST and is awaited, because its files are the only
 * copy of data that cannot be re-requested from anyone.
 */
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  // The tape first, and awaited.
  try { await recorder.close(); } catch { /* keep shutting down */ }
  try { await chartHistory.flush(); } catch { /* keep shutting down */ }
  try { await tradeTape.close(); } catch { /* keep shutting down */ }

  try { await desktopRevocationSynchronizer?.stop(); } catch { /* ignore */ }
  try { await exposureArchiver.stop(); } catch { /* ignore */ }
  for (const stop of [
    () => massiveIndices.stop(),
    () => databentoEquities.stop(),
    () => optionTrades.stop(),
    () => quantDataMarketSnapshots.stop(),
    () => quantDataSurfaces.stop(),
  ]) {
    try { stop(); } catch { /* ignore */ }
  }
  try { await client.stop(); } catch { /* ignore */ }

  server.close(() => process.exit(0));
  /*
   * A held-open connection must not outlast the container stop grace period,
   * or the runtime SIGKILLs us and the ordering above buys nothing.
   */
  const failsafe = setTimeout(() => process.exit(0), 5_000);
  if (typeof failsafe.unref === "function") failsafe.unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
