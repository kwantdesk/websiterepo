import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  aggregateDarkPoolLevels,
  classifyDarkPoolLocation,
  clusterDarkPoolZones,
  createMappingReceipt,
  deduplicateDarkPoolPrints,
  defaultDarkPoolMapSettings,
  defaultDarkPoolSource,
  mapDarkPoolPrint,
  normalizeDarkPoolPrint,
} from "../src/lib/darkPoolMap.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const rawPrint = (id, price, size, time, side = "MID_MARKET", delayed = false) => ({
  ID: id,
  TICKER: "QQQ",
  PRICE: price,
  SIZE: size,
  NOTIONAL_VALUE: price * size,
  PRINT_TYPE: "DARK_POOL",
  TRADE_SIDE: side,
  IS_DELAYED_PRINT: delayed,
  TRADE_TIME: time,
});

test("Dark Pool Map registers one indicator and one chart-backed workspace tool", async () => {
  const [catalog, config, workspace, chart, route] = await Promise.all([
    read("src/lib/chartIndicatorCatalog.ts"),
    read("src/lib/chartIndicatorConfig.ts"),
    read("src/components/KwantifyWorkspace.tsx"),
    read("src/components/Chart.tsx"),
    read("src/app/api/dark-pool-map/route.ts"),
  ]);
  assert.match(catalog, /indicator\("Dark Pool Map", "Options Flow"/);
  assert.match(config, /"dark-pool-map"/);
  assert.match(workspace, /"tool-dark-pool-map"/);
  assert.match(workspace, /indicatorId: "dark-pool-map"/);
  assert.match(chart, /attachPrimitive\(darkPoolMapPrimitive\)/);
  assert.match(route, /getDarkPoolLevelsPayload/);
  assert.match(route, /getDarkPoolPrintsPayload/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_.*QUANTDATA/i);
});

test("automatic source mapping is explicit and never calls NQ a direct dark pool", () => {
  assert.equal(defaultDarkPoolSource("NQ"), "QQQ");
  assert.equal(defaultDarkPoolSource("MNQ"), "QQQ");
  assert.equal(defaultDarkPoolSource("ES"), "SPY");
  assert.equal(defaultDarkPoolSource("MES"), "SPY");
  assert.equal(defaultDarkPoolSource("RTY"), "IWM");
  assert.equal(defaultDarkPoolSource("YM"), "DIA");
  assert.equal(defaultDarkPoolSource("NVDA"), "NVDA");
});

test("deterministic level aggregation and deduplication", () => {
  const time = Date.parse("2026-08-14T15:00:00Z");
  const source = [rawPrint("A", 500, 10_000, time), rawPrint("B", 500, 20_000, time + 1_000), rawPrint("A", 500, 10_000, time)];
  const prints = deduplicateDarkPoolPrints(source.map(normalizeDarkPoolPrint).filter(Boolean));
  assert.equal(prints.length, 2);
  const mapping = createMappingReceipt({ mode: "manual", direct: false, sourceMid: 500, displayMid: 30_000, alpha: 100, beta: 60, calculatedAtMs: time });
  const mapped = prints.map((print) => mapDarkPoolPrint(print, "NQ", mapping));
  const levels = aggregateDarkPoolLevels(mapped, { ...defaultDarkPoolMapSettings, minimumPrintNotional: 0, minimumLevelNotional: 0, minimumStrengthScore: 0, mappedBinPoints: 2 }, time + 2_000);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].totalNotional, 15_000_000);
  assert.equal(levels[0].totalShares, 30_000);
  assert.equal(levels[0].tradeCount, 2);
  assert.equal(levels[0].mappedPrice, 30_100);
});

test("delayed print retains original timestamp and historical mapping receipt is frozen", () => {
  const time = Date.parse("2026-08-14T14:30:00Z");
  const print = normalizeDarkPoolPrint(rawPrint("delayed", 500, 1_000, time, "ASK", true));
  assert.equal(print.tradeTimeMs, time);
  const first = createMappingReceipt({ mode: "manual", direct: false, sourceMid: 500, displayMid: 30_000, alpha: 100, beta: 60, calculatedAtMs: time });
  const mapped = mapDarkPoolPrint(print, "NQ", first);
  first.alpha = 1_000;
  first.beta = 10;
  assert.equal(mapped.mappedPrice, 30_100);
  assert.equal(mapped.mapping.alpha, 100);
  assert.equal(mapped.mapping.beta, 60);
  assert.equal(mapped.isDelayedPrint, true);
});

test("ratio fallback, location classification, zone merging and score are deterministic", () => {
  const receipt = createMappingReceipt({ mode: "live-ratio", direct: false, sourceMid: 500, displayMid: 30_000 });
  assert.equal(receipt.beta, 60);
  assert.equal(mapDarkPoolPrint(normalizeDarkPoolPrint(rawPrint("R", 500, 1, Date.now())), "NQ", receipt).mappedPrice, 30_000);
  assert.equal(classifyDarkPoolLocation("ASK"), "ASK_SIDE");
  assert.equal(classifyDarkPoolLocation("ABOVE_ASK"), "ASK_SIDE");
  assert.equal(classifyDarkPoolLocation("BID"), "BID_SIDE");
  assert.equal(classifyDarkPoolLocation("BELOW_BID"), "BID_SIDE");
  assert.equal(classifyDarkPoolLocation("MID_MARKET"), "MID");

  const base = { sourceTicker: "QQQ", displayInstrument: "NQ", sourcePrice: 500, mappedTick: 0, totalNotional: 10_000_000, totalShares: 10_000, tradeCount: 1, askSideNotional: 0, bidSideNotional: 0, midMarketNotional: 10_000_000, unknownSideNotional: 0, delayedNotional: 0, nonDelayedNotional: 10_000_000, firstPrintTimeMs: 1, lastPrintTimeMs: 2, sessionCount: 1, contributingPrintIds: [], strengthScore: 70, recencyScore: 1, persistenceScore: 0.2, isZoneMember: false, zoneId: null };
  const levels = [
    { ...base, id: "a", mappedPrice: 30_100 },
    { ...base, id: "b", mappedPrice: 30_102 },
    { ...base, id: "c", mappedPrice: 30_110 },
  ];
  const zones = clusterDarkPoolZones(levels, { mergeNearbyLevels: true, mergeTolerancePoints: 3, maximumZoneWidthPoints: 20 });
  assert.equal(zones.length, 2);
  assert.equal(zones[0].levelCount, 2);
  assert.equal(zones[1].levelCount, 1);
  assert.ok(zones.every((zone) => zone.strengthScore >= 0 && zone.strengthScore <= 100));
});

test("renderer is Canvas-native, timestamped, chart-projected and below candles", async () => {
  const primitive = await read("src/lib/darkPoolMapPrimitive.ts");
  assert.match(primitive, /timeToCoordinate/);
  assert.match(primitive, /priceToCoordinate/);
  assert.match(primitive, /return "bottom" as const/);
  assert.match(primitive, /context\.ellipse/);
  assert.doesNotMatch(primitive, /createElement|appendChild/);
});

test("Dark Pool GEX renders without a chart-top information banner", async () => {
  const chart = await read("src/components/Chart.tsx");
  assert.doesNotMatch(
    chart,
    /\{darkPoolGexIndicator \? \(\s*<div\s*className="pointer-events-none absolute left-2/,
  );
  assert.doesNotMatch(chart, /\+ \(darkPoolGexIndicator \? 30 : 0\)/);
});

test("QuantData adapter uses the documented cursor contract and shared history cache", async () => {
  const adapter = await read("src/lib/quantData.server.ts");
  const darkPoolSection = adapter.slice(
    adapter.indexOf("type DarkPoolPrintWalk"),
    adapter.indexOf("function parseExposure"),
  );
  assert.match(darkPoolSection, /timeRange:/);
  assert.match(darkPoolSection, /size: 100/);
  assert.match(darkPoolSection, /searchAfter/);
  assert.match(darkPoolSection, /nextSearchAfter/);
  assert.match(darkPoolSection, /direction: "DESCENDING"/);
  assert.match(darkPoolSection, /darkPoolPrintHistoryCache/);
  assert.doesNotMatch(darkPoolSection, /pagination\s*:/);
  assert.doesNotMatch(darkPoolSection, /sessionDateRange/);
});
