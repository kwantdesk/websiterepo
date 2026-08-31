import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";

import {
  NormalizedAnalyticsProxy,
  normalizedAnalyticsProblem,
  normalizedAnalyticsProxyContract,
  validateBounceQuery,
  validateClassicGexQuery,
  validateDarkPoolMapQuery,
  validateImpliedVolatilityRankQuery,
  validateGammaEnvironmentQuery,
  validateChartGammaLevelsQuery,
  validateExpectedMoveQuery,
  validateHedgeLevelsQuery,
  validateVixEnvironmentQuery,
  validateZeroGammaLineQuery,
  validateOptionsDeltaQuery,
  validateZeroGammaBarsQuery,
  validateGammaHeatmapQuery,
  validateNetGammaExposureQuery,
  validateGexIntervalMapQuery,
  validateGexMapQuery,
  validateGexFlowQuery,
  validateGexFlowRatioBody,
  validateGameplanQuery,
  validateOptionsFlowWorkspaceQuery,
  validateOptionsFlowMarketDataQuery,
} from "../src/normalized-analytics-proxy.mjs";

const TOKEN = "normalized-analytics-service-token-0123456789";

function bounceUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/bounce-levels?display=NQ&source=QQQ&displayPrice=25000&greekMode=GAMMA&expirationMode=zero-to-one-dte${extra}`,
  );
}

function classicGexUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/classic-gex-profile?source=QQQ&expiry=ZERO_DTE&profileSource=VOLUME&mapping=AUTO${extra}`,
  );
}

function darkPoolMapUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/dark-pool-map?display=NQ&source=QQQ&mappingMode=rolling-affine&historyDays=30&minimumPrintNotional=1000000&minimumPrintShares=0&maximumHistoricalPrints=100&displayPrice=25000${extra}`,
  );
}

function ivRankUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/implied-volatility-rank?source=QQQ&display=NQ&lookback=252&maturity=30&contractMode=average-call-put&live=1&maximumForwardFillMinutes=5${extra}`,
  );
}

function gammaEnvironmentUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/gamma-environment?display=NQ&source=QQQ&root=NQ${extra}`,
  );
}

function chartGammaLevelsUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/chart-gamma-levels?root=NQ&source=QQQ&calibrated=1&futuresPrice=25000${extra}`,
  );
}

function expectedMoveUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/expected-move?display=NQ&source=QQQ${extra}`,
  );
}

function hedgeLevelsUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/hedge-levels?instrument=NQ${extra}`,
  );
}

function vixEnvironmentUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/vix-environment?symbol=VIX&normal=15&elevated=20&high=25&extreme=30${extra}`,
  );
}

function zeroGammaLineUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/zero-gamma-line?instrument=NQ&sessions=5${extra}`,
  );
}

function optionsDeltaUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/options-delta?instrument=NQ${extra}`,
  );
}

function zeroGammaBarsUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/zero-gamma-bars?instrument=NQ${extra}`,
  );
}

function gammaHeatmapUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/gamma-heatmap?display=NQ&source=QQQ&metric=GAMMA&sourceMode=hybrid&historyHours=24&binSize=5&displayPrice=25000${extra}`,
  );
}

function netGammaExposureUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/net-gamma-exposure-by-strike?display=NQ&source=QQQ&provider=quantdata&displayPrice=25000&expirationMode=zero-to-one-dte&expirationDates=&includeWeeklies=true&includeMonthlies=true&includeQuarterlies=true&aggregationMode=auto-bin&customBinSizePoints=1&minimumDte=0&maximumDte=7${extra}`,
  );
}

function gexIntervalMapUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/gex-interval-map?display=NQ&source=QQQ&aggregationPeriod=1m&greekMode=GEX${extra}`,
  );
}

function gexMapUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/gex-map?symbol=SPXW&greekMode=GAMMA&scope=FRONT_EXPIRY&representation=PER_ONE_DOLLAR_MOVE${extra}`,
  );
}

function gexFlowUrl(extra = "") {
  return new URL(
    `http://gateway/v1/analytics/gex-flow?symbol=SPX&mode=HYBRID&size=100${extra}`,
  );
}

function gameplanUrl(extra = "") {
  return new URL(`http://gateway/v1/analytics/gameplan?root=NQ${extra}`);
}

function optionsFlowUrl(extra = "") {
  return new URL(`http://gateway/v1/analytics/options-flow?symbol=QQQ&priceMode=CASH&detail=FULL${extra}`);
}

function optionsFlowMarketDataUrl(extra = "") {
  return new URL(`http://gateway/v1/analytics/options-flow/market-data?symbol=QQQ&priceMode=CASH${extra}`);
}

function jsonRequest(value) {
  const body = Buffer.from(JSON.stringify(value));
  const request = Readable.from([body]);
  request.headers = { "content-length": String(body.length), "content-type": "application/json" };
  return request;
}

function output() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = Buffer.from(body || ""); },
  };
}

test("configuration is paired, bounded, and never embeds a vendor credential", () => {
  assert.throws(
    () => new NormalizedAnalyticsProxy({ origin: "http://analytics:3000" }),
    /configured together/,
  );
  assert.throws(
    () => new NormalizedAnalyticsProxy({ origin: "https://user:pass@analytics.example" , serviceToken: TOKEN }),
    /without credentials/,
  );
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
  });
  assert.deepEqual(proxy.health(), { configured: true, origin: "http://analytics:3000" });
  assert.equal("apiKey" in proxy, false);
  assert.equal("vendorToken" in proxy, false);
});

test("Gamma workspace queries expose only the fixed CASH product contract", () => {
  assert.equal(validateOptionsFlowWorkspaceQuery(optionsFlowUrl()), true);
  assert.equal(validateOptionsFlowMarketDataQuery(optionsFlowMarketDataUrl()), true);
  assert.throws(
    () => validateOptionsFlowWorkspaceQuery(optionsFlowUrl("&apiKey=secret")),
    /query is invalid/i,
  );
  assert.throws(
    () => validateOptionsFlowWorkspaceQuery(new URL("http://gateway/v1/analytics/options-flow?symbol=NQ&priceMode=CASH&detail=FULL")),
    /query is invalid/i,
  );
  assert.throws(
    () => validateOptionsFlowWorkspaceQuery(new URL("http://gateway/v1/analytics/options-flow?symbol=QQQ&priceMode=FUTURES&detail=FULL")),
    /query is invalid/i,
  );
  assert.throws(
    () => validateOptionsFlowMarketDataQuery(optionsFlowMarketDataUrl("&detail=FULL")),
    /query is invalid/i,
  );
});

test("Gamma workspace and market pulse forward only to their fixed internal routes", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ symbol: "QQQ" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await proxy.forwardOptionsFlowWorkspace(output(), optionsFlowUrl());
  await proxy.forwardOptionsFlowMarketData(output(), optionsFlowMarketDataUrl());

  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/options-flow\?/);
  assert.match(calls[1].url, /^http:\/\/analytics:3000\/api\/options-flow\/market-data\?/);
  assert.equal(calls[0].options.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal(calls[1].options.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.ok(!calls[0].url.includes("secret"));
});

test("Bounce Levels accepts only one value for each explicit normalized setting", () => {
  assert.equal(validateBounceQuery(bounceUrl("&maximumLevels=8&asOf=2026-08-14T15%3A00%3A00.000Z")), true);
  assert.throws(() => validateBounceQuery(bounceUrl("&maximumLevels=8&maximumLevels=9")), /invalid/);
  assert.throws(() => validateBounceQuery(bounceUrl("&apiKey=secret")), /invalid/);
  assert.throws(
    () => validateBounceQuery(new URL("http://gateway/v1/analytics/bounce-levels?display=NQ")),
    /incomplete/,
  );
});

test("Classic GEX accepts only its explicit normalized calculation settings", () => {
  assert.equal(validateClassicGexQuery(classicGexUrl("&futuresPrice=25000")), true);
  assert.throws(() => validateClassicGexQuery(classicGexUrl("&source=NDX")), /invalid/);
  assert.throws(() => validateClassicGexQuery(classicGexUrl("&apiKey=secret")), /invalid/);
  assert.throws(
    () => validateClassicGexQuery(new URL("http://gateway/v1/analytics/classic-gex-profile?source=QQQ")),
    /incomplete/,
  );
});

test("Dark Pool Map accepts only its bounded normalized desktop query", () => {
  assert.equal(validateDarkPoolMapQuery(darkPoolMapUrl("&maximumPrintNotional=9000000&priceBinMode=mapped-points&minimumLevelNotional=5000000&topLevels=50&mergeNearbyLevels=true&asOf=2026-08-14T15%3A00%3A00.000Z")), true);
  assert.throws(() => validateDarkPoolMapQuery(darkPoolMapUrl("&source=NQ")), /invalid/);
  assert.throws(() => validateDarkPoolMapQuery(darkPoolMapUrl("&maximumHistoricalPrints=0")), /invalid/);
  assert.throws(() => validateDarkPoolMapQuery(darkPoolMapUrl("&priceBinMode=made-up")), /invalid/);
  assert.throws(() => validateDarkPoolMapQuery(darkPoolMapUrl("&mergeNearbyLevels=1")), /invalid/);
  assert.throws(() => validateDarkPoolMapQuery(darkPoolMapUrl("&apiKey=secret")), /invalid/);
  assert.throws(
    () => validateDarkPoolMapQuery(new URL("http://gateway/v1/analytics/dark-pool-map?display=NQ")),
    /incomplete/,
  );
});

test("IV Rank accepts only its exact bounded calculation query", () => {
  assert.equal(validateImpliedVolatilityRankQuery(ivRankUrl()), true);
  assert.throws(() => validateImpliedVolatilityRankQuery(ivRankUrl("&source=NQ")), /invalid/);
  assert.throws(() => validateImpliedVolatilityRankQuery(ivRankUrl("&lookback=1")), /invalid/);
  assert.throws(() => validateImpliedVolatilityRankQuery(ivRankUrl("&maturity=366")), /invalid/);
  assert.throws(() => validateImpliedVolatilityRankQuery(ivRankUrl("&live=true")), /invalid/);
  assert.throws(() => validateImpliedVolatilityRankQuery(ivRankUrl("&apiKey=secret")), /invalid/);
});

test("Gamma Environment accepts only its canonical live or point-in-time scope", () => {
  assert.equal(validateGammaEnvironmentQuery(gammaEnvironmentUrl()), true);
  assert.equal(validateGammaEnvironmentQuery(gammaEnvironmentUrl("&asOf=2026-08-14T15%3A00%3A00.000Z&futuresPrice=25000")), true);
  assert.throws(() => validateGammaEnvironmentQuery(gammaEnvironmentUrl("&source=NDX")), /invalid/);
  assert.throws(() => validateGammaEnvironmentQuery(gammaEnvironmentUrl("&apiKey=secret")), /invalid/);
  assert.throws(() => validateGammaEnvironmentQuery(gammaEnvironmentUrl("&futuresPrice=25000")), /replay/);
});

test("Expected Move accepts only its exact NQ cash-to-futures calibration scope", () => {
  assert.equal(validateExpectedMoveQuery(expectedMoveUrl()), true);
  assert.equal(validateExpectedMoveQuery(new URL("http://gateway/v1/analytics/expected-move?display=MNQ&source=NDX")), true);
  assert.throws(() => validateExpectedMoveQuery(expectedMoveUrl("&display=ES")), /invalid/);
  assert.throws(() => validateExpectedMoveQuery(expectedMoveUrl("&source=SPY")), /invalid/);
  assert.throws(() => validateExpectedMoveQuery(expectedMoveUrl("&apiKey=secret")), /invalid/);
  assert.throws(
    () => validateExpectedMoveQuery(new URL("http://gateway/v1/analytics/expected-move?display=NQ")),
    /incomplete/,
  );
});

test("Hedge Levels accepts only one normalized NQ or MNQ instrument", () => {
  assert.equal(validateHedgeLevelsQuery(hedgeLevelsUrl()), true);
  assert.equal(validateHedgeLevelsQuery(new URL("http://gateway/v1/analytics/hedge-levels?instrument=MNQ")), true);
  assert.throws(() => validateHedgeLevelsQuery(hedgeLevelsUrl("&instrument=ES")), /invalid/);
  assert.throws(() => validateHedgeLevelsQuery(hedgeLevelsUrl("&apiKey=secret")), /invalid/);
  assert.throws(
    () => validateHedgeLevelsQuery(new URL("http://gateway/v1/analytics/hedge-levels")),
    /incomplete/,
  );
});

test("VIX Environment accepts only ordered bounded thresholds and a safe replay clock", () => {
  assert.equal(validateVixEnvironmentQuery(vixEnvironmentUrl()), true);
  assert.equal(validateVixEnvironmentQuery(vixEnvironmentUrl("&asOf=2026-08-14T15%3A00%3A00.000Z")), true);
  assert.throws(() => validateVixEnvironmentQuery(vixEnvironmentUrl("&symbol=VVIX")), /invalid/);
  const invalidThresholds = vixEnvironmentUrl();
  invalidThresholds.searchParams.set("elevated", "15");
  assert.throws(() => validateVixEnvironmentQuery(invalidThresholds), /thresholds/);
  assert.throws(() => validateVixEnvironmentQuery(vixEnvironmentUrl("&apiKey=secret")), /invalid/);
});

test("Zero Gamma Line accepts only bounded same-family source scopes", () => {
  assert.equal(validateZeroGammaLineQuery(zeroGammaLineUrl()), true);
  assert.equal(validateZeroGammaLineQuery(zeroGammaLineUrl("&source=NDX")), true);
  assert.throws(() => validateZeroGammaLineQuery(zeroGammaLineUrl("&source=SPX")), /invalid/);
  assert.throws(() => validateZeroGammaLineQuery(zeroGammaLineUrl("&sessions=6")), /invalid/);
  assert.throws(() => validateZeroGammaLineQuery(zeroGammaLineUrl("&apiKey=secret")), /invalid/);
});

test("Options Delta accepts only supported families and a non-future replay cutoff", () => {
  assert.equal(validateOptionsDeltaQuery(optionsDeltaUrl()), true);
  assert.equal(validateOptionsDeltaQuery(optionsDeltaUrl("&asOf=2026-08-14T15%3A00%3A00.000Z")), true);
  assert.throws(() => validateOptionsDeltaQuery(optionsDeltaUrl("&instrument=CL")), /invalid/);
  assert.throws(() => validateOptionsDeltaQuery(optionsDeltaUrl("&asOf=2999-01-01T00%3A00%3A00.000Z")), /replay/);
  assert.throws(() => validateOptionsDeltaQuery(optionsDeltaUrl("&apiKey=secret")), /invalid/);
});

test("Zero Gamma Bars accepts only supported families and a non-future replay cutoff", () => {
  assert.equal(validateZeroGammaBarsQuery(zeroGammaBarsUrl()), true);
  assert.equal(validateZeroGammaBarsQuery(zeroGammaBarsUrl("&asOf=2026-08-14T15%3A00%3A00.000Z")), true);
  assert.throws(() => validateZeroGammaBarsQuery(zeroGammaBarsUrl("&instrument=CL")), /invalid/);
  assert.throws(() => validateZeroGammaBarsQuery(zeroGammaBarsUrl("&asOf=2999-01-01T00%3A00%3A00.000Z")), /replay/);
  assert.throws(() => validateZeroGammaBarsQuery(zeroGammaBarsUrl("&apiKey=secret")), /invalid/);
});

test("Gamma Heatmap accepts only its bounded normalized surface request", () => {
  assert.equal(validateGammaHeatmapQuery(gammaHeatmapUrl()), true);
  assert.equal(validateGammaHeatmapQuery(gammaHeatmapUrl("&asOf=2026-08-14T15%3A00%3A00.000Z")), true);
  assert.throws(() => validateGammaHeatmapQuery(gammaHeatmapUrl("&display=CL")), /invalid/);
  assert.throws(() => validateGammaHeatmapQuery(gammaHeatmapUrl("&historyHours=121")), /invalid/);
  assert.throws(() => validateGammaHeatmapQuery(gammaHeatmapUrl("&apiKey=secret")), /invalid/);
  assert.throws(() => validateGammaHeatmapQuery(gammaHeatmapUrl("&asOf=2999-01-01T00%3A00%3A00.000Z")), /replay/);
});

test("Net Gamma Exposure accepts only its exact bounded live profile request", () => {
  assert.equal(validateNetGammaExposureQuery(netGammaExposureUrl()), true);
  const dated = netGammaExposureUrl();
  dated.searchParams.set("expirationDates", "2026-08-29");
  assert.equal(validateNetGammaExposureQuery(dated), true);
  assert.throws(() => validateNetGammaExposureQuery(netGammaExposureUrl("&source=SPY")), /invalid/);
  assert.throws(() => validateNetGammaExposureQuery(netGammaExposureUrl("&provider=databento-custom")), /invalid/);
  assert.throws(() => validateNetGammaExposureQuery(netGammaExposureUrl("&maximumDte=366")), /invalid/);
  assert.throws(() => validateNetGammaExposureQuery(netGammaExposureUrl("&apiKey=secret")), /invalid/);
  assert.throws(() => validateNetGammaExposureQuery(netGammaExposureUrl("&asOf=2026-08-29T00%3A00%3A00Z")), /invalid/);
});

test("GEX Interval Map accepts only a family-safe bounded live or historical scope", () => {
  assert.equal(validateGexIntervalMapQuery(gexIntervalMapUrl()), true);
  assert.equal(validateGexIntervalMapQuery(gexIntervalMapUrl("&sessionDate=2026-08-14")), true);
  assert.equal(validateGexIntervalMapQuery(gexIntervalMapUrl("&startTime=2026-08-14T14%3A30%3A00Z&endTime=2026-08-14T20%3A00%3A00Z")), true);
  assert.throws(() => validateGexIntervalMapQuery(gexIntervalMapUrl("&source=SPY")), /invalid/);
  assert.throws(() => validateGexIntervalMapQuery(gexIntervalMapUrl("&aggregationPeriod=7m")), /invalid/);
  assert.throws(() => validateGexIntervalMapQuery(gexIntervalMapUrl("&sessionDate=2026-08-14&startTime=2026-08-14T14%3A30%3A00Z&endTime=2026-08-14T20%3A00%3A00Z")), /history/);
  assert.throws(() => validateGexIntervalMapQuery(gexIntervalMapUrl("&startTime=2026-08-14T14%3A30%3A00Z")), /history/);
  assert.throws(() => validateGexIntervalMapQuery(gexIntervalMapUrl("&apiKey=secret")), /invalid/);
});

test("GEX Map accepts only its explicit bounded surface and replay scope", () => {
  assert.equal(validateGexMapQuery(gexMapUrl("&compact=1")), true);
  assert.equal(validateGexMapQuery(gexMapUrl("&sessionDate=2026-08-14")), true);
  assert.equal(validateGexMapQuery(gexMapUrl("&model=DEALER_INVENTORY")), true);
  assert.throws(() => validateGexMapQuery(gexMapUrl("&symbol=NQ")), /invalid/);
  assert.throws(() => validateGexMapQuery(gexMapUrl("&model=DEALER_INVENTORY&greekMode=DELTA")), /invalid/);
  assert.throws(() => validateGexMapQuery(gexMapUrl("&sessionDate=2026-08-14&compact=1")), /replay/);
  assert.throws(() => validateGexMapQuery(gexMapUrl("&apiKey=secret")), /invalid/);
});

test("GAMEPLAN accepts only a bounded NQ or ES live or historical scope", () => {
  assert.equal(validateGameplanQuery(gameplanUrl()), true);
  assert.equal(validateGameplanQuery(gameplanUrl("&sessionDate=2026-08-14")), true);
  assert.equal(validateGameplanQuery(new URL("http://gateway/v1/analytics/gameplan?root=ES")), true);
  assert.throws(() => validateGameplanQuery(gameplanUrl("&root=CL")), /invalid/i);
  assert.throws(() => validateGameplanQuery(gameplanUrl("&apiKey=secret")), /invalid/i);
  assert.throws(() => validateGameplanQuery(gameplanUrl("&sessionDate=2999-01-01")), /historical/i);
});

test("the VPS forwards GAMEPLAN only to its fixed internal analytics route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ instrument: "NQ", plan: { ladder: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardGameplan(response, gameplanUrl("&sessionDate=2026-08-14"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/gameplan\?/);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards a fixed internal route and returns the bounded normalized JSON", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 3, levels: [] }), {
        status: 200,
        headers: { "content-type": "application/json", etag: '"fixture"' },
      });
    },
  });
  const response = output();

  await proxy.forwardBounceLevels(response, bounceUrl("&maximumLevels=8"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/bounce-levels\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
  assert.equal(response.headers["X-KwantDesk-Data-Edge"], "Normalized-Analytics");
  assert.equal(response.headers.ETag, '"fixture"');
  assert.deepEqual(JSON.parse(response.body.toString("utf8")), { schemaVersion: 3, levels: [] });
});

test("the VPS forwards GEX Map only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ symbol: "SPXW", latestStrikes: [], frames: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardGexMap(response, gexMapUrl("&compact=1"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/gex-map\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Classic GEX only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ instrument: "NQ", rows: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardClassicGexProfile(response, classicGexUrl("&futuresPrice=25000"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/chart-gex-profile\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Dark Pool Map only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, provider: "quantdata", prints: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardDarkPoolMap(response, darkPoolMapUrl());

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/dark-pool-map\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards IV Rank only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "implied-volatility-rank", observations: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardImpliedVolatilityRank(response, ivRankUrl());

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/implied-volatility-rank\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Gamma Environment only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "gamma-environment" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardGammaEnvironment(response, gammaEnvironmentUrl());

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/gamma-environment\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS validates and forwards calibrated Chart Gamma Levels only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ root: "NQ", requestedSource: "NQ", sources: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardChartGammaLevels(response, chartGammaLevelsUrl());

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/chart-gamma-levels\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("Chart Gamma Levels rejects incompatible sources and uncalibrated desktop queries", () => {
  assert.equal(validateChartGammaLevelsQuery(chartGammaLevelsUrl()), true);
  assert.throws(
    () => validateChartGammaLevelsQuery(chartGammaLevelsUrl("&source=SPY")),
    /invalid/i,
  );
  const uncalibrated = new URL("http://gateway/v1/analytics/chart-gamma-levels?root=NQ&source=QQQ&calibrated=0");
  assert.throws(() => validateChartGammaLevelsQuery(uncalibrated), /invalid/i);
  assert.throws(
    () => validateChartGammaLevelsQuery(chartGammaLevelsUrl("&futuresPrice=-1")),
    /invalid/i,
  );
});

test("the VPS forwards Expected Move only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "expected-move" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardExpectedMove(response, expectedMoveUrl());

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/expected-move\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Hedge Levels only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "hedge-levels" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardHedgeLevels(response, hedgeLevelsUrl());

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/hedge-levels\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards VIX Environment only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "vix-environment" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardVixEnvironment(response, vixEnvironmentUrl());

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/vix-environment\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Zero Gamma Line only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "zero-gamma-line" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardZeroGammaLine(response, zeroGammaLineUrl("&source=QQQ"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/zero-gamma-line\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Options Delta only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "options-delta", points: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardOptionsDelta(response, optionsDeltaUrl("&asOf=2026-08-14T15%3A00%3A00.000Z"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/options-delta\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Zero Gamma Bars only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "zero-gamma-bars", points: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardZeroGammaBars(response, zeroGammaBarsUrl("&asOf=2026-08-14T15%3A00%3A00.000Z"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/zero-gamma-bars\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Gamma Heatmap only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "gamma-heatmap", snapshots: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardGammaHeatmap(response, gammaHeatmapUrl("&asOf=2026-08-14T15%3A00%3A00.000Z"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/gamma-heatmap\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards Net Gamma Exposure only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, id: "QQQ:NQ:fixture", rows: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardNetGammaExposureByStrike(response, netGammaExposureUrl());

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/net-gamma-exposure-by-strike\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("the VPS forwards GEX Interval Map only to its fixed internal route", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ schemaVersion: 1, provider: "quantdata", buckets: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = output();

  await proxy.forwardGexIntervalMap(response, gexIntervalMapUrl("&sessionDate=2026-08-14"));

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/gex-interval-map\?/);
  assert.equal(calls[0].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal(response.status, 200);
});

test("unconfigured and oversized analytics responses fail with typed sanitized errors", async () => {
  const unconfigured = new NormalizedAnalyticsProxy();
  await assert.rejects(
    () => unconfigured.forwardBounceLevels(output(), bounceUrl()),
    (error) => normalizedAnalyticsProblem(error).code === "analytics_unconfigured",
  );

  const oversized = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async () => new Response("{}", {
      headers: {
        "content-type": "application/json",
        "content-length": String(normalizedAnalyticsProxyContract.maximumResponseBytes + 1),
      },
    }),
  });
  await assert.rejects(
    () => oversized.forwardBounceLevels(output(), bounceUrl()),
    (error) => normalizedAnalyticsProblem(error).code === "analytics_payload_too_large",
  );
});

test("GEX FLOW query and exact-contract ratio bodies are strictly bounded", () => {
  assert.equal(validateGexFlowQuery(gexFlowUrl()), true);
  assert.equal(validateGexFlowQuery(gexFlowUrl("&sessionDate=2026-08-20&replayAt=2026-08-20T14%3A15%3A00Z")), true);
  assert.throws(() => validateGexFlowQuery(gexFlowUrl("&size=500")), /invalid/i);
  assert.throws(() => validateGexFlowQuery(gexFlowUrl("&apiKey=secret")), /invalid/i);
  const body = {
    contracts: [{ osi: "SPXW260820C06500000", ticker: "SPX", expirationDate: "2026-08-20", strikePrice: 6500, contractType: "CALL" }],
    sessionDate: "2026-08-20",
    replayAt: "2026-08-20T14:15:00Z",
  };
  assert.equal(validateGexFlowRatioBody(body), true);
  assert.throws(() => validateGexFlowRatioBody({ ...body, contracts: Array(26).fill(body.contracts[0]) }), /invalid/i);
  assert.throws(() => validateGexFlowRatioBody({ ...body, contracts: [{ ...body.contracts[0], contractType: "UNKNOWN" }] }), /invalid/i);
});

test("the VPS forwards GEX FLOW GET and POST only to fixed internal routes", async () => {
  const calls = [];
  const proxy = new NormalizedAnalyticsProxy({
    origin: "http://analytics:3000",
    serviceToken: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  await proxy.forwardGexFlow(output(), gexFlowUrl());
  const ratioBody = {
    contracts: [{ osi: "SPXW260820C06500000", ticker: "SPX", expirationDate: "2026-08-20", strikePrice: 6500, contractType: "CALL" }],
    sessionDate: "2026-08-20",
    replayAt: null,
  };
  await proxy.forwardGexFlowRatios(jsonRequest(ratioBody), output(), new URL("http://gateway/v1/analytics/gex-flow/ratios"));

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^http:\/\/analytics:3000\/api\/gex-flow\?/);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].url, "http://analytics:3000/api/gex-flow/ratios");
  assert.equal(calls[1].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].init.body.toString("utf8")), ratioBody);
  assert.equal(calls[1].init.headers[normalizedAnalyticsProxyContract.serviceTokenHeader], TOKEN);
  assert.equal("Authorization" in calls[1].init.headers, false);
});
