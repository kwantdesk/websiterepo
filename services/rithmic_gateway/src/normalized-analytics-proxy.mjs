const BOUNCE_LEVELS_QUERY_KEYS = new Set([
  "display", "source", "displayPrice", "greekMode", "expirationMode",
  "minimumDte", "maximumDte", "expirationDates", "includeWeeklies",
  "includeMonthlies", "includeQuarterlies", "maximumLevels",
  "topExposurePercent", "minimumPercentOfKing", "minimumRelevanceScore",
  "maximumDistancePoints", "clusterDistancePoints", "airPocketRatio",
  "historyBuckets", "maximumNodesPerSlice", "maximumGatekeepers",
  "maximumMajorNodes", "minimumGatekeeperRelevance",
  "minimumGatekeeperPercentOfKing", "minimumClusterNodes",
  "minimumAirPocketWidthPercent", "magnitudeWeight", "proximityWeight",
  "accumulationWeight", "persistenceWeight", "freshnessWeight",
  "clusterWeight", "proximityDecayPercent", "developingMinimumPercentile",
  "developingMinimumGrowthPercent", "weakeningThresholdPercent",
  "weakeningRelevanceThreshold", "retirementRelevanceThreshold",
  "retirementExposurePercentile", "touchTolerancePercent", "touchDecayFactor",
  "activeEnterThreshold", "activeExitThreshold", "retirementConfirmationSnapshots",
  "visualStrengthBasis", "absoluteExposureScale", "rollDetectionEnabled",
  "rollVisualizationEnabled", "rollWeakeningThreshold", "rollBuildingThreshold",
  "maxRollDistance", "rollWindowSeconds", "sessionDate", "asOf",
]);
const CLASSIC_GEX_QUERY_KEYS = new Set([
  "source", "expiry", "profileSource", "mapping", "multiplier", "offset", "futuresPrice",
]);
const DARK_POOL_MAP_QUERY_KEYS = new Set([
  "display", "source", "mappingMode", "priceBinMode", "historyDays", "pollSeconds", "minimumPrintNotional",
  "maximumPrintNotional", "minimumPrintShares", "maximumPrintShares",
  "minimumLevelNotional", "minimumLevelShares", "minimumTradeCount", "topLevels",
  "minimumStrengthScore", "mappedBinPoints", "sourceBinCents", "displayTickMultiple",
  "mergeTolerancePoints", "maximumZoneWidthPoints", "recencyHalfLifeHours",
  "sessionsForFullPersistenceScore", "maximumHistoricalPrints", "manualAlpha", "manualBeta",
  "minimumMappingR2", "mappingWindowMinutes", "minimumMappingSamples", "staleAllowanceSeconds",
  "mergeNearbyLevels", "showDelayedPrints", "includeDelayedInLevels", "includeAskSide",
  "includeBidSide", "includeMid", "includeUnknown", "displayPrice", "asOf",
]);
const IMPLIED_VOLATILITY_RANK_QUERY_KEYS = new Set([
  "source", "display", "lookback", "maturity", "contractMode", "live", "maximumForwardFillMinutes",
]);
const GAMMA_ENVIRONMENT_QUERY_KEYS = new Set([
  "display", "source", "root", "asOf", "futuresPrice",
]);
const CHART_GAMMA_LEVELS_QUERY_KEYS = new Set([
  "root", "source", "sessionDate", "asOf", "futuresPrice", "calibrated", "replay",
]);
const EXPECTED_MOVE_QUERY_KEYS = new Set(["display", "source"]);
const HEDGE_LEVELS_QUERY_KEYS = new Set(["instrument"]);
const VIX_ENVIRONMENT_QUERY_KEYS = new Set([
  "symbol", "normal", "elevated", "high", "extreme", "asOf",
]);
const ZERO_GAMMA_LINE_QUERY_KEYS = new Set(["instrument", "sessions", "source"]);
const OPTIONS_DELTA_QUERY_KEYS = new Set(["instrument", "asOf"]);
const ZERO_GAMMA_BARS_QUERY_KEYS = new Set(["instrument", "asOf"]);
const GAMMA_HEATMAP_QUERY_KEYS = new Set([
  "display", "source", "metric", "sourceMode", "historyHours", "binSize", "displayPrice", "asOf",
]);
const NET_GAMMA_EXPOSURE_QUERY_KEYS = new Set([
  "display", "source", "provider", "displayPrice", "expirationMode",
  "expirationDates", "includeWeeklies", "includeMonthlies", "includeQuarterlies",
  "aggregationMode", "customBinSizePoints", "minimumDte", "maximumDte",
]);
const GEX_INTERVAL_MAP_QUERY_KEYS = new Set([
  "display", "source", "sessionDate", "startTime", "endTime",
  "aggregationPeriod", "greekMode",
]);
const GEX_MAP_QUERY_KEYS = new Set([
  "symbol", "greekMode", "sessionDate", "compact", "scope", "representation", "model",
]);
const GEX_FLOW_QUERY_KEYS = new Set([
  "symbol", "mode", "size", "sessionDate", "replayAt", "cursor",
]);
const GAMEPLAN_QUERY_KEYS = new Set(["root", "sessionDate"]);
const OPTIONS_FLOW_WORKSPACE_QUERY_KEYS = new Set(["symbol", "priceMode", "detail"]);
const OPTIONS_FLOW_MARKET_DATA_QUERY_KEYS = new Set(["symbol", "priceMode"]);
const OPTIONS_FLOW_SYMBOLS = new Set([
  "SPX", "SPXW", "SPY", "NDX", "QQQ", "IWM", "AAPL", "NVDA",
  "TSLA", "MSFT", "AMZN", "META", "AMD",
]);

const MAX_QUERY_LENGTH = 12_000;
const MAX_QUERY_VALUE_LENGTH = 1_000;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_REQUEST_BYTES = 64 * 1024;
const SERVICE_TOKEN_HEADER = "x-kwantdesk-internal-analytics-token";

export class NormalizedAnalyticsProxy {
  constructor({ origin = "", serviceToken = "", timeoutMs = 45_000, fetchImpl = fetch } = {}) {
    this.origin = normalizeOrigin(origin);
    this.serviceToken = String(serviceToken || "").trim();
    this.timeoutMs = Math.max(1_000, Math.min(120_000, Number(timeoutMs) || 45_000));
    this.fetch = fetchImpl;
    if ((this.origin && !this.serviceToken) || (!this.origin && this.serviceToken)) {
      throw new Error("The normalized analytics origin and service token must be configured together.");
    }
    if (this.serviceToken && (this.serviceToken.length < 32 || this.serviceToken.length > 4_096)) {
      throw new Error("The normalized analytics service token must contain 32 to 4096 characters.");
    }
  }

  get configured() {
    return Boolean(this.origin && this.serviceToken);
  }

  health() {
    return Object.freeze({ configured: this.configured, origin: this.origin || null });
  }

  async forwardBounceLevels(response, incomingUrl) {
    validateBounceQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/bounce-levels");
  }

  async forwardClassicGexProfile(response, incomingUrl) {
    validateClassicGexQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/chart-gex-profile");
  }

  async forwardDarkPoolMap(response, incomingUrl) {
    validateDarkPoolMapQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/dark-pool-map");
  }

  async forwardImpliedVolatilityRank(response, incomingUrl) {
    validateImpliedVolatilityRankQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/implied-volatility-rank");
  }

  async forwardGammaEnvironment(response, incomingUrl) {
    validateGammaEnvironmentQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/gamma-environment");
  }

  async forwardChartGammaLevels(response, incomingUrl) {
    validateChartGammaLevelsQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/chart-gamma-levels");
  }

  async forwardExpectedMove(response, incomingUrl) {
    validateExpectedMoveQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/expected-move");
  }

  async forwardHedgeLevels(response, incomingUrl) {
    validateHedgeLevelsQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/hedge-levels");
  }

  async forwardVixEnvironment(response, incomingUrl) {
    validateVixEnvironmentQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/vix-environment");
  }

  async forwardZeroGammaLine(response, incomingUrl) {
    validateZeroGammaLineQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/zero-gamma-line");
  }

  async forwardOptionsDelta(response, incomingUrl) {
    validateOptionsDeltaQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/options-delta");
  }

  async forwardZeroGammaBars(response, incomingUrl) {
    validateZeroGammaBarsQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/zero-gamma-bars");
  }

  async forwardGammaHeatmap(response, incomingUrl) {
    validateGammaHeatmapQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/gamma-heatmap");
  }

  async forwardNetGammaExposureByStrike(response, incomingUrl) {
    validateNetGammaExposureQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/net-gamma-exposure-by-strike");
  }

  async forwardGexIntervalMap(response, incomingUrl) {
    validateGexIntervalMapQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/gex-interval-map");
  }

  async forwardGexMap(response, incomingUrl) {
    validateGexMapQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/gex-map");
  }

  async forwardGexFlow(response, incomingUrl) {
    validateGexFlowQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/gex-flow");
  }

  async forwardGexFlowRatios(request, response, incomingUrl) {
    validateQuery(incomingUrl, new Set(), []);
    const body = await readBoundedJsonBody(request);
    validateGexFlowRatioBody(body);
    return this.#forward(
      response,
      incomingUrl,
      "/api/gex-flow/ratios",
      "POST",
      Buffer.from(JSON.stringify(body), "utf8"),
    );
  }

  async forwardGameplan(response, incomingUrl) {
    validateGameplanQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/gameplan");
  }

  async forwardOptionsFlowWorkspace(response, incomingUrl) {
    validateOptionsFlowWorkspaceQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/options-flow");
  }

  async forwardOptionsFlowMarketData(response, incomingUrl) {
    validateOptionsFlowMarketDataQuery(incomingUrl);
    return this.#forward(response, incomingUrl, "/api/options-flow/market-data");
  }

  async #forward(response, incomingUrl, upstreamPath, method = "GET", body = undefined) {
    if (!this.configured) {
      throw problem(503, "analytics_unconfigured", "Normalized options analytics is not configured on this VPS.");
    }
    const upstreamUrl = new URL(upstreamPath, this.origin);
    upstreamUrl.search = incomingUrl.search;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let upstream;
    try {
      upstream = await this.fetch(upstreamUrl, {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          [SERVICE_TOKEN_HEADER]: this.serviceToken,
        },
        ...(body ? { body } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      throw problem(
        error?.name === "AbortError" ? 504 : 502,
        error?.name === "AbortError" ? "analytics_timeout" : "analytics_unavailable",
        error?.name === "AbortError"
          ? "The normalized options snapshot timed out."
          : "The normalized options snapshot is unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }

    const declaredLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw problem(502, "analytics_payload_too_large", "The normalized options snapshot exceeded its bounded payload contract.");
    }
    const payload = Buffer.from(await upstream.arrayBuffer());
    if (payload.length > MAX_RESPONSE_BYTES) {
      throw problem(502, "analytics_payload_too_large", "The normalized options snapshot exceeded its bounded payload contract.");
    }
    const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw problem(502, "analytics_invalid_payload", "The normalized options service returned a non-JSON payload.");
    }
    const headers = {
      "Content-Type": contentType,
      "Content-Length": String(payload.length),
      "Cache-Control": upstream.headers.get("cache-control") || "private, no-store",
      "X-KwantDesk-Data-Edge": "Normalized-Analytics",
    };
    const etag = upstream.headers.get("etag");
    if (etag) headers.ETag = etag;
    response.writeHead(upstream.status, headers);
    response.end(payload);
  }
}

export function validateBounceQuery(url) {
  if (!(url instanceof URL) || url.search.length > MAX_QUERY_LENGTH) {
    throw problem(400, "analytics_invalid_query", "The Bounce Levels query is invalid.");
  }
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    if (!BOUNCE_LEVELS_QUERY_KEYS.has(key) || values.length !== 1 || values[0].length > MAX_QUERY_VALUE_LENGTH) {
      throw problem(400, "analytics_invalid_query", "The Bounce Levels query is invalid.");
    }
  }
  for (const required of ["display", "source", "displayPrice", "greekMode", "expirationMode"]) {
    if (!url.searchParams.get(required)) {
      throw problem(400, "analytics_invalid_query", "The Bounce Levels query is incomplete.");
    }
  }
  return true;
}

export function validateClassicGexQuery(url) {
  validateQuery(url, CLASSIC_GEX_QUERY_KEYS, ["source", "expiry", "profileSource", "mapping"]);
  const source = url.searchParams.get("source");
  const expiry = url.searchParams.get("expiry");
  const profileSource = url.searchParams.get("profileSource");
  const mapping = url.searchParams.get("mapping");
  if (!["QQQ", "NDX"].includes(source) ||
      !["ZERO_DTE", "NEXT_EXPIRY", "ALL"].includes(expiry) ||
      !["VOLUME", "OPEN_INTEREST"].includes(profileSource) ||
      !["AUTO", "MANUAL"].includes(mapping)) {
    throw problem(400, "analytics_invalid_query", "The Classic GEX query is invalid.");
  }
  return true;
}

export function validateDarkPoolMapQuery(url) {
  validateQuery(url, DARK_POOL_MAP_QUERY_KEYS, [
    "display", "source", "mappingMode", "historyDays", "minimumPrintNotional",
    "minimumPrintShares", "maximumHistoricalPrints", "displayPrice",
  ]);
  const display = url.searchParams.get("display");
  const source = url.searchParams.get("source");
  const mappingMode = url.searchParams.get("mappingMode");
  const displaySymbols = new Set([
    "NQ", "MNQ", "NDX", "QQQ", "ES", "MES", "SPY", "SPX", "SPXW",
    "RTY", "M2K", "IWM", "YM", "MYM", "DIA", "AAPL", "NVDA", "TSLA",
    "MSFT", "AMZN", "META", "AMD",
  ]);
  const sources = new Set(["QQQ", "SPY", "IWM", "DIA", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "AMD"]);
  if (!displaySymbols.has(display) || !sources.has(source) ||
      !["direct", "rolling-affine", "live-ratio", "manual"].includes(mappingMode)) {
    throw problem(400, "analytics_invalid_query", "The Dark Pool Map query is invalid.");
  }
  const priceBinMode = url.searchParams.get("priceBinMode");
  if (priceBinMode && !["exact-source-price", "source-cents", "mapped-points", "display-ticks"].includes(priceBinMode)) {
    throw problem(400, "analytics_invalid_query", "The Dark Pool Map query is invalid.");
  }
  const positive = ["historyDays", "maximumHistoricalPrints", "displayPrice"];
  const optionalPositive = [
    "pollSeconds", "minimumTradeCount",
    "topLevels", "mappedBinPoints", "sourceBinCents", "displayTickMultiple", "maximumZoneWidthPoints",
    "recencyHalfLifeHours", "sessionsForFullPersistenceScore", "manualBeta", "mappingWindowMinutes",
    "minimumMappingSamples", "staleAllowanceSeconds",
  ];
  const nonNegative = [
    "minimumPrintNotional", "minimumPrintShares", "maximumPrintNotional", "maximumPrintShares",
    "minimumLevelNotional", "minimumLevelShares", "minimumStrengthScore", "mergeTolerancePoints",
  ];
  if (positive.some((key) => !(Number(url.searchParams.get(key)) > 0)) ||
      optionalPositive.some((key) => url.searchParams.has(key) && !(Number(url.searchParams.get(key)) > 0)) ||
      nonNegative.some((key) => url.searchParams.has(key) && !(Number(url.searchParams.get(key)) >= 0))) {
    throw problem(400, "analytics_invalid_query", "The Dark Pool Map query is invalid.");
  }
  for (const key of ["mergeNearbyLevels", "showDelayedPrints", "includeDelayedInLevels", "includeAskSide", "includeBidSide", "includeMid", "includeUnknown"]) {
    if (url.searchParams.has(key) && !["true", "false"].includes(url.searchParams.get(key))) {
      throw problem(400, "analytics_invalid_query", "The Dark Pool Map query is invalid.");
    }
  }
  const finiteOptional = ["manualAlpha", "minimumMappingR2"];
  if (finiteOptional.some((key) => url.searchParams.has(key) && !Number.isFinite(Number(url.searchParams.get(key)))) ||
      Number(url.searchParams.get("historyDays")) > 365 ||
      Number(url.searchParams.get("maximumHistoricalPrints")) > 100_000 ||
      (url.searchParams.has("minimumMappingR2") && Number(url.searchParams.get("minimumMappingR2")) > 1)) {
    throw problem(400, "analytics_invalid_query", "The Dark Pool Map query is invalid.");
  }
  if (url.searchParams.has("asOf") && !Number.isFinite(Date.parse(url.searchParams.get("asOf")))) {
    throw problem(400, "analytics_invalid_query", "The Dark Pool Map query is invalid.");
  }
  return true;
}

export function validateImpliedVolatilityRankQuery(url) {
  validateQuery(url, IMPLIED_VOLATILITY_RANK_QUERY_KEYS, [
    "source", "display", "lookback", "maturity", "contractMode", "live", "maximumForwardFillMinutes",
  ]);
  const sources = new Set(["QQQ", "SPY", "NDX", "SPX", "SPXW", "IWM", "DIA"]);
  const displays = new Set(["QQQ", "NDX", "NQ", "MNQ", "SPY", "SPX", "SPXW", "ES", "MES", "IWM", "DIA"]);
  const modes = new Set(["combined", "average-call-put", "call", "put", "call-put-split"]);
  const lookback = Number(url.searchParams.get("lookback"));
  const maturity = Number(url.searchParams.get("maturity"));
  const maximumForwardFillMinutes = Number(url.searchParams.get("maximumForwardFillMinutes"));
  if (!sources.has(url.searchParams.get("source")) ||
      !displays.has(url.searchParams.get("display")) ||
      !modes.has(url.searchParams.get("contractMode")) ||
      !["0", "1"].includes(url.searchParams.get("live")) ||
      !Number.isInteger(lookback) || lookback < 2 || lookback > 365 ||
      !Number.isInteger(maturity) || maturity < 0 || maturity > 365 ||
      !Number.isInteger(maximumForwardFillMinutes) || maximumForwardFillMinutes < 1 || maximumForwardFillMinutes > 60) {
    throw problem(400, "analytics_invalid_query", "The IV Rank query is invalid.");
  }
  return true;
}

export function validateGammaEnvironmentQuery(url) {
  validateQuery(url, GAMMA_ENVIRONMENT_QUERY_KEYS, ["display", "source", "root"]);
  const display = url.searchParams.get("display");
  const source = url.searchParams.get("source");
  const root = url.searchParams.get("root");
  const scope = new Map([
    ["NQ", ["QQQ", "NQ"]], ["MNQ", ["QQQ", "NQ"]],
    ["QQQ", ["QQQ", "NQ"]], ["NDX", ["NDX", "NQ"]],
    ["ES", ["SPY", "ES"]], ["MES", ["SPY", "ES"]],
    ["SPY", ["SPY", "ES"]], ["SPX", ["SPX", "ES"]], ["SPXW", ["SPXW", "ES"]],
  ]).get(display);
  if (!scope || scope[0] !== source || scope[1] !== root) {
    throw problem(400, "analytics_invalid_query", "The Gamma Environment query is invalid.");
  }
  const asOf = url.searchParams.get("asOf");
  const futuresPrice = Number(url.searchParams.get("futuresPrice"));
  if ((asOf && (!Number.isFinite(Date.parse(asOf)) || Date.parse(asOf) > Date.now() || !(futuresPrice > 0))) ||
      (!asOf && url.searchParams.has("futuresPrice"))) {
    throw problem(400, "analytics_invalid_query", "The Gamma Environment replay query is invalid.");
  }
  return true;
}

export function validateChartGammaLevelsQuery(url) {
  validateQuery(url, CHART_GAMMA_LEVELS_QUERY_KEYS, ["root", "source", "calibrated"]);
  const root = url.searchParams.get("root");
  const source = url.searchParams.get("source");
  const calibrated = url.searchParams.get("calibrated");
  const compatible = root === "NQ"
    ? new Set(["NQ", "QQQ", "NDX"])
    : root === "ES"
      ? new Set(["ES", "SPY", "SPX", "SPXW"])
      : new Set();
  if (!compatible.has(source) || calibrated !== "1") {
    throw problem(400, "analytics_invalid_query", "The Chart Gamma Levels query is invalid.");
  }
  const sessionDate = url.searchParams.get("sessionDate");
  if (sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    throw problem(400, "analytics_invalid_query", "The Chart Gamma Levels session date is invalid.");
  }
  const replay = url.searchParams.get("replay");
  if (replay && replay !== "1") {
    throw problem(400, "analytics_invalid_query", "The Chart Gamma Levels replay mode is invalid.");
  }
  const asOf = url.searchParams.get("asOf");
  if (asOf && !Number.isFinite(Date.parse(asOf))) {
    throw problem(400, "analytics_invalid_query", "The Chart Gamma Levels cutoff is invalid.");
  }
  const futuresPrice = url.searchParams.get("futuresPrice");
  if (futuresPrice && !(Number(futuresPrice) > 0)) {
    throw problem(400, "analytics_invalid_query", "The Chart Gamma Levels futures price is invalid.");
  }
  return true;
}

export function validateExpectedMoveQuery(url) {
  validateQuery(url, EXPECTED_MOVE_QUERY_KEYS, ["display", "source"]);
  if (!["NQ", "MNQ"].includes(url.searchParams.get("display")) ||
      !["QQQ", "NDX"].includes(url.searchParams.get("source"))) {
    throw problem(400, "analytics_invalid_query", "The Expected Move query is invalid.");
  }
  return true;
}

export function validateHedgeLevelsQuery(url) {
  validateQuery(url, HEDGE_LEVELS_QUERY_KEYS, ["instrument"]);
  if (!["NQ", "MNQ"].includes(url.searchParams.get("instrument"))) {
    throw problem(400, "analytics_invalid_query", "The Hedge Levels query is invalid.");
  }
  return true;
}

export function validateVixEnvironmentQuery(url) {
  validateQuery(url, VIX_ENVIRONMENT_QUERY_KEYS, ["symbol", "normal", "elevated", "high", "extreme"]);
  if (!["VIX", "VXN"].includes(url.searchParams.get("symbol"))) {
    throw problem(400, "analytics_invalid_query", "The VIX Environment query is invalid.");
  }
  const normal = Number(url.searchParams.get("normal"));
  const elevated = Number(url.searchParams.get("elevated"));
  const high = Number(url.searchParams.get("high"));
  const extreme = Number(url.searchParams.get("extreme"));
  if (!Number.isFinite(normal) || normal < 5 || normal > 50 ||
      !Number.isFinite(elevated) || elevated < normal + 1 || elevated > 60 ||
      !Number.isFinite(high) || high < elevated + 1 || high > 70 ||
      !Number.isFinite(extreme) || extreme < high + 1 || extreme > 100) {
    throw problem(400, "analytics_invalid_query", "The VIX Environment thresholds are invalid.");
  }
  const asOf = url.searchParams.get("asOf");
  if (asOf && (!Number.isFinite(Date.parse(asOf)) || Date.parse(asOf) > Date.now())) {
    throw problem(400, "analytics_invalid_query", "The VIX Environment replay query is invalid.");
  }
  return true;
}

export function validateZeroGammaLineQuery(url) {
  validateQuery(url, ZERO_GAMMA_LINE_QUERY_KEYS, ["instrument", "sessions"]);
  const instrument = url.searchParams.get("instrument");
  const source = url.searchParams.get("source");
  const sessions = Number(url.searchParams.get("sessions"));
  const family = new Map([
    ["NQ", "NQ"], ["MNQ", "NQ"], ["NDX", "NQ"], ["QQQ", "NQ"],
    ["ES", "ES"], ["MES", "ES"], ["SPX", "ES"], ["SPXW", "ES"], ["SPY", "ES"],
  ]);
  const root = family.get(instrument);
  if (!root || !Number.isInteger(sessions) || sessions < 1 || sessions > 5 ||
      (source && (!family.has(source) || family.get(source) !== root))) {
    throw problem(400, "analytics_invalid_query", "The Zero Gamma Line query is invalid.");
  }
  return true;
}

export function validateOptionsDeltaQuery(url) {
  validateQuery(url, OPTIONS_DELTA_QUERY_KEYS, ["instrument"]);
  const instrument = url.searchParams.get("instrument");
  if (!["NQ", "MNQ", "NDX", "QQQ", "ES", "MES", "SPX", "SPXW", "SPY"].includes(instrument)) {
    throw problem(400, "analytics_invalid_query", "The Options Delta query is invalid.");
  }
  const asOf = url.searchParams.get("asOf");
  if (asOf && (!Number.isFinite(Date.parse(asOf)) || Date.parse(asOf) > Date.now())) {
    throw problem(400, "analytics_invalid_query", "The Options Delta replay query is invalid.");
  }
  return true;
}

export function validateZeroGammaBarsQuery(url) {
  validateQuery(url, ZERO_GAMMA_BARS_QUERY_KEYS, ["instrument"]);
  const instrument = url.searchParams.get("instrument");
  if (!["NQ", "MNQ", "NDX", "QQQ", "ES", "MES", "SPX", "SPXW", "SPY"].includes(instrument)) {
    throw problem(400, "analytics_invalid_query", "The Zero Gamma Bars query is invalid.");
  }
  const asOf = url.searchParams.get("asOf");
  if (asOf && (!Number.isFinite(Date.parse(asOf)) || Date.parse(asOf) > Date.now())) {
    throw problem(400, "analytics_invalid_query", "The Zero Gamma Bars replay query is invalid.");
  }
  return true;
}

export function validateGammaHeatmapQuery(url) {
  validateQuery(url, GAMMA_HEATMAP_QUERY_KEYS, [
    "display", "source", "metric", "sourceMode", "historyHours", "binSize", "displayPrice",
  ]);
  const display = url.searchParams.get("display");
  const source = url.searchParams.get("source");
  const metric = url.searchParams.get("metric");
  const sourceMode = url.searchParams.get("sourceMode");
  const historyHours = Number(url.searchParams.get("historyHours"));
  const binSize = Number(url.searchParams.get("binSize"));
  const displayPrice = Number(url.searchParams.get("displayPrice"));
  if (!["NQ", "MNQ", "ES", "MES"].includes(display) ||
      !["QQQ", "NDX", "SPY", "SPX", "SPXW"].includes(source) ||
      !["GAMMA", "DELTA", "VANNA", "CHARM"].includes(metric) ||
      !["hybrid", "quantdata", "databento-raw"].includes(sourceMode) ||
      !Number.isFinite(historyHours) || historyHours < 1 || historyHours > 120 ||
      !Number.isFinite(binSize) || binSize < 0.25 || binSize > 100 ||
      !Number.isFinite(displayPrice) || displayPrice <= 0 || displayPrice > 1_000_000) {
    throw problem(400, "analytics_invalid_query", "The Gamma Heatmap query is invalid.");
  }
  const asOf = url.searchParams.get("asOf");
  if (asOf && (!Number.isFinite(Date.parse(asOf)) || Date.parse(asOf) > Date.now())) {
    throw problem(400, "analytics_invalid_query", "The Gamma Heatmap replay query is invalid.");
  }
  return true;
}

export function validateNetGammaExposureQuery(url) {
  validateQuery(url, NET_GAMMA_EXPOSURE_QUERY_KEYS, [
    "display", "source", "provider", "displayPrice", "expirationMode",
    "includeWeeklies", "includeMonthlies", "includeQuarterlies", "aggregationMode",
    "customBinSizePoints", "minimumDte", "maximumDte",
  ]);
  const display = url.searchParams.get("display");
  const source = url.searchParams.get("source");
  const familySources = new Map([
    ["NQ", new Set(["QQQ", "NDX", "NQ"])],
    ["MNQ", new Set(["QQQ", "NDX", "NQ"])],
    ["ES", new Set(["SPY", "SPX", "SPXW"])],
    ["MES", new Set(["SPY", "SPX", "SPXW"])],
  ]).get(display);
  const expirationMode = url.searchParams.get("expirationMode");
  const aggregationMode = url.searchParams.get("aggregationMode");
  const displayPrice = Number(url.searchParams.get("displayPrice"));
  const customBin = Number(url.searchParams.get("customBinSizePoints"));
  const minimumDte = Number(url.searchParams.get("minimumDte"));
  const maximumDte = Number(url.searchParams.get("maximumDte"));
  if (!familySources?.has(source) || url.searchParams.get("provider") !== "quantdata" ||
      !["zero-dte", "zero-to-one-dte", "zero-to-seven-dte", "front-expiration", "all-expirations", "custom-dte-range", "specific-expirations"].includes(expirationMode) ||
      !["exact-display-tick", "auto-bin", "custom-bin"].includes(aggregationMode) ||
      !Number.isFinite(displayPrice) || displayPrice <= 0 || displayPrice > 1_000_000 ||
      !Number.isFinite(customBin) || customBin < .25 || customBin > 100 ||
      !Number.isInteger(minimumDte) || minimumDte < 0 || minimumDte > 365 ||
      !Number.isInteger(maximumDte) || maximumDte < minimumDte || maximumDte > 365) {
    throw problem(400, "analytics_invalid_query", "The Net Gamma Exposure query is invalid.");
  }
  for (const key of ["includeWeeklies", "includeMonthlies", "includeQuarterlies"]) {
    if (!["true", "false"].includes(url.searchParams.get(key))) {
      throw problem(400, "analytics_invalid_query", "The Net Gamma Exposure query is invalid.");
    }
  }
  const dates = (url.searchParams.get("expirationDates") || "").split(",").filter(Boolean);
  if (dates.length > 64 || dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date)) ||
      (expirationMode === "specific-expirations" && dates.length === 0)) {
    throw problem(400, "analytics_invalid_query", "The Net Gamma Exposure query is invalid.");
  }
  return true;
}

export function validateGexIntervalMapQuery(url) {
  validateQuery(url, GEX_INTERVAL_MAP_QUERY_KEYS, [
    "display", "source", "aggregationPeriod", "greekMode",
  ]);
  const display = url.searchParams.get("display");
  const source = url.searchParams.get("source");
  const nqFamily = ["NQ", "MNQ", "NDX", "QQQ"].includes(display);
  const familyMatches = nqFamily
    ? ["QQQ", "NDX", "NQ"].includes(source)
    : ["ES", "MES", "SPY", "SPX", "SPXW"].includes(display) && ["SPY", "SPX", "SPXW"].includes(source);
  const aggregation = url.searchParams.get("aggregationPeriod");
  const greek = url.searchParams.get("greekMode");
  if (!familyMatches ||
      !["1m", "2m", "3m", "4m", "5m", "10m", "15m", "20m", "30m", "1h", "2h", "4h"].includes(aggregation) ||
      !["GEX", "GAMMA", "DEX", "DELTA", "VEX", "VANNA", "CHEX", "CHARM"].includes(greek)) {
    throw problem(400, "analytics_invalid_query", "The GEX Interval Map query is invalid.");
  }
  const sessionDate = url.searchParams.get("sessionDate");
  const startTime = url.searchParams.get("startTime");
  const endTime = url.searchParams.get("endTime");
  if (sessionDate && (startTime || endTime) || Boolean(startTime) !== Boolean(endTime)) {
    throw problem(400, "analytics_invalid_query", "The GEX Interval Map history query is invalid.");
  }
  const maximumHistoryMs = 9 * 31 * 24 * 60 * 60_000;
  const now = Date.now();
  if (sessionDate) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate) ? Date.parse(`${sessionDate}T00:00:00.000Z`) : NaN;
    if (!Number.isFinite(date) || date < now - maximumHistoryMs || date > now) {
      throw problem(400, "analytics_invalid_query", "The GEX Interval Map history query is invalid.");
    }
  }
  if (startTime && endTime) {
    const start = Date.parse(startTime);
    const end = Date.parse(endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
        end - start > maximumHistoryMs || start < now - maximumHistoryMs || end > now) {
      throw problem(400, "analytics_invalid_query", "The GEX Interval Map history query is invalid.");
    }
  }
  return true;
}

export function validateGexMapQuery(url) {
  validateQuery(url, GEX_MAP_QUERY_KEYS, ["symbol", "greekMode", "scope", "representation"]);
  const symbol = url.searchParams.get("symbol");
  const greek = url.searchParams.get("greekMode");
  const scope = url.searchParams.get("scope");
  const representation = url.searchParams.get("representation");
  const model = url.searchParams.get("model") || "STRUCTURAL_OI";
  const compact = url.searchParams.get("compact");
  const supportedSymbols = new Set([
    "SPX", "SPXW", "SPY", "NDX", "QQQ", "IWM",
    "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "AMD",
  ]);
  if (!supportedSymbols.has(symbol) ||
      !["GAMMA", "DELTA", "VANNA", "CHARM"].includes(greek) ||
      !["ALL_EXPIRIES", "FRONT_EXPIRY"].includes(scope) ||
      !["PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE"].includes(representation) ||
      !["STRUCTURAL_OI", "DEALER_INVENTORY"].includes(model) ||
      (model === "DEALER_INVENTORY" && greek !== "GAMMA") ||
      (compact !== null && compact !== "1")) {
    throw problem(400, "analytics_invalid_query", "The GEX Map query is invalid.");
  }
  const sessionDate = url.searchParams.get("sessionDate");
  if (sessionDate) {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate)
      ? Date.parse(`${sessionDate}T00:00:00.000Z`)
      : NaN;
    const now = Date.now();
    if (!Number.isFinite(parsed) || parsed > now || parsed < now - 370 * 24 * 60 * 60_000 || compact !== null) {
      throw problem(400, "analytics_invalid_query", "The GEX Map replay query is invalid.");
    }
  }
  return true;
}

export function validateGexFlowQuery(url) {
  validateQuery(url, GEX_FLOW_QUERY_KEYS, ["symbol", "mode", "size"]);
  const symbols = new Set(["ALL", "SPX", "SPXW", "SPY", "NDX", "QQQ", "IWM", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "AMD"]);
  const symbol = url.searchParams.get("symbol")?.toUpperCase();
  const mode = url.searchParams.get("mode")?.toUpperCase();
  const size = Number(url.searchParams.get("size"));
  if (!symbols.has(symbol) || !["HYBRID", "CONSOLIDATED", "RAW"].includes(mode) || ![25, 50, 100].includes(size)) {
    throw problem(400, "analytics_invalid_query", "The GEX FLOW query is invalid.");
  }
  const sessionDate = url.searchParams.get("sessionDate");
  const replayAt = url.searchParams.get("replayAt");
  if (replayAt && !sessionDate) {
    throw problem(400, "analytics_invalid_query", "The GEX FLOW replay query is incomplete.");
  }
  if (sessionDate) {
    const session = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate) ? Date.parse(`${sessionDate}T00:00:00.000Z`) : NaN;
    const replay = replayAt ? Date.parse(replayAt) : null;
    const now = Date.now();
    if (!Number.isFinite(session) || session > now + 86_400_000 || session < now - 370 * 86_400_000 ||
        (replayAt && (!Number.isFinite(replay) || replay > now + 60_000))) {
      throw problem(400, "analytics_invalid_query", "The GEX FLOW replay query is invalid.");
    }
  }
  const cursor = url.searchParams.get("cursor");
  if (cursor && (cursor.length > 4_096 || cursor.split("|").length > 32)) {
    throw problem(400, "analytics_invalid_query", "The GEX FLOW cursor is invalid.");
  }
  return true;
}

export function validateGexFlowRatioBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !Array.isArray(body.contracts) || body.contracts.length < 1 || body.contracts.length > 25 ||
      typeof body.sessionDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.sessionDate) ||
      (body.replayAt !== null && body.replayAt !== undefined &&
        (typeof body.replayAt !== "string" || !Number.isFinite(Date.parse(body.replayAt))))) {
    throw problem(400, "analytics_invalid_request", "The GEX FLOW exact-contract ratio request is invalid.");
  }
  const allowed = new Set(["CALL", "PUT"]);
  for (const contract of body.contracts) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract) ||
        (contract.osi !== null && contract.osi !== undefined &&
          (typeof contract.osi !== "string" || contract.osi.length > 64)) ||
        typeof contract.ticker !== "string" || !/^[A-Z0-9.\-]{1,12}$/.test(contract.ticker.toUpperCase()) ||
        typeof contract.expirationDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(contract.expirationDate) ||
        typeof contract.strikePrice !== "number" || !Number.isFinite(contract.strikePrice) || contract.strikePrice <= 0 ||
        !allowed.has(contract.contractType)) {
      throw problem(400, "analytics_invalid_request", "The GEX FLOW exact-contract ratio request is invalid.");
    }
  }
  return true;
}

export function validateGameplanQuery(url) {
  validateQuery(url, GAMEPLAN_QUERY_KEYS, ["root"]);
  if (!["NQ", "ES"].includes(url.searchParams.get("root"))) {
    throw problem(400, "analytics_invalid_query", "The GAMEPLAN query is invalid.");
  }
  const sessionDate = url.searchParams.get("sessionDate");
  if (sessionDate) {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate)
      ? Date.parse(`${sessionDate}T00:00:00.000Z`)
      : NaN;
    const now = Date.now();
    if (!Number.isFinite(parsed) || parsed > now + 86_400_000 || parsed < now - 370 * 86_400_000) {
      throw problem(400, "analytics_invalid_query", "The GAMEPLAN historical query is invalid.");
    }
  }
  return true;
}

export function validateOptionsFlowWorkspaceQuery(url) {
  validateQuery(url, OPTIONS_FLOW_WORKSPACE_QUERY_KEYS, ["symbol", "priceMode", "detail"]);
  if (!OPTIONS_FLOW_SYMBOLS.has(url.searchParams.get("symbol")) ||
      url.searchParams.get("priceMode") !== "CASH" ||
      !["CORE", "FULL"].includes(url.searchParams.get("detail"))) {
    throw problem(400, "analytics_invalid_query", "The Gamma workspace query is invalid.");
  }
  return true;
}

export function validateOptionsFlowMarketDataQuery(url) {
  validateQuery(url, OPTIONS_FLOW_MARKET_DATA_QUERY_KEYS, ["symbol", "priceMode"]);
  if (!OPTIONS_FLOW_SYMBOLS.has(url.searchParams.get("symbol")) ||
      url.searchParams.get("priceMode") !== "CASH") {
    throw problem(400, "analytics_invalid_query", "The Gamma market-data query is invalid.");
  }
  return true;
}

async function readBoundedJsonBody(request) {
  const declared = Number(request?.headers?.["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw problem(413, "analytics_request_too_large", "The normalized analytics request exceeded its bounded payload contract.");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_REQUEST_BYTES) {
      throw problem(413, "analytics_request_too_large", "The normalized analytics request exceeded its bounded payload contract.");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw problem(400, "analytics_invalid_request", "The normalized analytics request is not valid JSON.");
  }
}

function validateQuery(url, allowedKeys, requiredKeys) {
  if (!(url instanceof URL) || url.search.length > MAX_QUERY_LENGTH) {
    throw problem(400, "analytics_invalid_query", "The normalized analytics query is invalid.");
  }
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    if (!allowedKeys.has(key) || values.length !== 1 || values[0].length > MAX_QUERY_VALUE_LENGTH) {
      throw problem(400, "analytics_invalid_query", "The normalized analytics query is invalid.");
    }
  }
  for (const required of requiredKeys) {
    if (!url.searchParams.get(required)) {
      throw problem(400, "analytics_invalid_query", "The normalized analytics query is incomplete.");
    }
  }
}

export function normalizedAnalyticsProblem(error) {
  return error?.normalizedAnalyticsProblem === true
    ? error
    : problem(502, "analytics_unavailable", "The normalized options snapshot is unavailable.");
}

function normalizeOrigin(value) {
  if (!String(value || "").trim()) return "";
  let parsed;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    throw new Error("The normalized analytics origin must be an absolute HTTP or HTTPS origin.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username || parsed.password || parsed.search || parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new Error("The normalized analytics origin must be an absolute HTTP or HTTPS origin without credentials, path, query, or fragment.");
  }
  return parsed.origin;
}

function problem(status, code, message) {
  return Object.assign(new Error(message), {
    normalizedAnalyticsProblem: true,
    status,
    code,
  });
}

export const normalizedAnalyticsProxyContract = Object.freeze({
  serviceTokenHeader: SERVICE_TOKEN_HEADER,
  maximumQueryLength: MAX_QUERY_LENGTH,
  maximumQueryValueLength: MAX_QUERY_VALUE_LENGTH,
  maximumResponseBytes: MAX_RESPONSE_BYTES,
  bounceLevelsQueryKeys: Object.freeze([...BOUNCE_LEVELS_QUERY_KEYS]),
  classicGexQueryKeys: Object.freeze([...CLASSIC_GEX_QUERY_KEYS]),
  darkPoolMapQueryKeys: Object.freeze([...DARK_POOL_MAP_QUERY_KEYS]),
  impliedVolatilityRankQueryKeys: Object.freeze([...IMPLIED_VOLATILITY_RANK_QUERY_KEYS]),
  gammaEnvironmentQueryKeys: Object.freeze([...GAMMA_ENVIRONMENT_QUERY_KEYS]),
  expectedMoveQueryKeys: Object.freeze([...EXPECTED_MOVE_QUERY_KEYS]),
  hedgeLevelsQueryKeys: Object.freeze([...HEDGE_LEVELS_QUERY_KEYS]),
  vixEnvironmentQueryKeys: Object.freeze([...VIX_ENVIRONMENT_QUERY_KEYS]),
  zeroGammaLineQueryKeys: Object.freeze([...ZERO_GAMMA_LINE_QUERY_KEYS]),
  optionsDeltaQueryKeys: Object.freeze([...OPTIONS_DELTA_QUERY_KEYS]),
  zeroGammaBarsQueryKeys: Object.freeze([...ZERO_GAMMA_BARS_QUERY_KEYS]),
  gammaHeatmapQueryKeys: Object.freeze([...GAMMA_HEATMAP_QUERY_KEYS]),
  netGammaExposureQueryKeys: Object.freeze([...NET_GAMMA_EXPOSURE_QUERY_KEYS]),
  gexIntervalMapQueryKeys: Object.freeze([...GEX_INTERVAL_MAP_QUERY_KEYS]),
  gexMapQueryKeys: Object.freeze([...GEX_MAP_QUERY_KEYS]),
  gexFlowQueryKeys: Object.freeze([...GEX_FLOW_QUERY_KEYS]),
  gameplanQueryKeys: Object.freeze([...GAMEPLAN_QUERY_KEYS]),
  optionsFlowWorkspaceQueryKeys: Object.freeze([...OPTIONS_FLOW_WORKSPACE_QUERY_KEYS]),
  optionsFlowMarketDataQueryKeys: Object.freeze([...OPTIONS_FLOW_MARKET_DATA_QUERY_KEYS]),
  maximumRequestBytes: MAX_REQUEST_BYTES,
});
