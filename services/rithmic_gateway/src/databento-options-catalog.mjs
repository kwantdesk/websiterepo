const DATABENTO_HISTORY_URL = "https://hist.databento.com/v0/timeseries.get_range";
const DATASET = "GLBX.MDP3";
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_DEFINITION_ROWS = 50_000;
const CACHE_MS = 5 * 60_000;

const OPTION_ROOTS = Object.freeze([
  { root: "ES", label: "E-mini S&P 500", venue: "CME", tickSize: 0.25 },
  { root: "NQ", label: "E-mini Nasdaq-100", venue: "CME", tickSize: 0.25 },
  { root: "CL", label: "WTI Crude Oil", venue: "NYMEX", tickSize: 0.01 },
  { root: "GC", label: "Gold", venue: "COMEX", tickSize: 0.1 },
  { root: "ZN", label: "10-Year Treasury Note", venue: "CBOT", tickSize: 1 / 64 },
]);

export class OptionsCatalogError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "OptionsCatalogError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Bounded VPS-owned equivalent of the August V1 /api/databento/options route.
 * Vendor credentials and provider payloads never cross this normalized edge.
 */
export class DatabentoOptionsCatalog {
  constructor({
    apiKey = "",
    fetchImpl = fetch,
    timeoutMs = 30_000,
    now = () => Date.now(),
  } = {}) {
    this.apiKey = String(apiKey || "").trim();
    this.fetch = fetchImpl;
    this.timeoutMs = Math.max(1, Number(timeoutMs) || 30_000);
    this.now = now;
    this.cached = null;
    this.inFlight = null;
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      lastLoadedAt: null,
      lastError: null,
    };
  }

  status() {
    return {
      configured: Boolean(this.apiKey),
      count: this.cached?.instruments.length || 0,
      ...this.metrics,
    };
  }

  async load() {
    if (!this.apiKey) {
      throw new OptionsCatalogError(
        "options_catalog_unconfigured",
        "CME options are not configured on the market-data gateway.",
        503,
      );
    }
    const now = this.now();
    if (this.cached && now - this.cached.storedAt <= CACHE_MS) {
      this.metrics.cacheHits += 1;
      return { ...this.cached, cached: true };
    }
    this.inFlight ??= this.#load()
      .then((instruments) => {
        const storedAt = this.now();
        this.cached = Object.freeze({
          schemaVersion: "kwantdesk-option-catalog-v1",
          provider: "Databento",
          dataset: DATASET,
          storedAt,
          instruments: Object.freeze(instruments),
        });
        this.metrics.lastLoadedAt = new Date(storedAt).toISOString();
        this.metrics.lastError = null;
        return { ...this.cached, cached: false };
      })
      .catch((error) => {
        this.metrics.lastError = {
          at: new Date(this.now()).toISOString(),
          code: error?.code || "options_catalog_failed",
        };
        throw error;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  async resolve(symbol) {
    const requested = normalizeSymbol(symbol);
    if (!requested) return null;
    const catalog = await this.load();
    return catalog.instruments.find((instrument) => instrument.symbol === requested) || null;
  }

  async #load() {
    const instruments = [];
    for (const root of OPTION_ROOTS) {
      const now = this.now();
      const [bars, definitions] = await Promise.all([
        this.#request(new URLSearchParams({
          dataset: DATASET,
          schema: "ohlcv-1m",
          symbols: `${root.root}.v.0`,
          stype_in: "continuous",
          start: new Date(now - 6 * 60 * 60_000).toISOString(),
          end: new Date(now).toISOString(),
          encoding: "json",
          pretty_px: "true",
          pretty_ts: "true",
          map_symbols: "false",
          limit: "400",
        })),
        this.#request(new URLSearchParams({
          dataset: DATASET,
          schema: "definition",
          symbols: `${root.root}.OPT`,
          stype_in: "parent",
          start: new Date(now).toISOString().slice(0, 10),
          encoding: "json",
          pretty_px: "true",
          pretty_ts: "true",
          map_symbols: "false",
          limit: String(MAX_DEFINITION_ROWS),
        })),
      ]);
      const underlyingPrice = bars.map((row) => finitePrice(row.close)).filter((value) => value > 0).at(-1) || 0;
      const candidates = definitions
        .slice(0, MAX_DEFINITION_ROWS)
        .map((row) => ({
          symbol: normalizeSymbol(row.raw_symbol ?? row.symbol),
          side: optionClass(row.instrument_class),
          strike: finitePrice(row.strike_price),
          expiration: timestampMs(row.expiration),
        }))
        .filter((row) => (
          row.symbol
          && row.side
          && row.strike > 0
          && row.expiration > now
          && row.expiration < now + 75 * 86_400_000
        ))
        .sort((left, right) => (
          left.expiration - right.expiration
          || Math.abs(left.strike - underlyingPrice) - Math.abs(right.strike - underlyingPrice)
        ));
      const nearestExpiry = candidates[0]?.expiration;
      if (!nearestExpiry) continue;
      for (const side of ["Call", "Put"]) {
        for (const row of candidates
          .filter((candidate) => candidate.expiration === nearestExpiry && candidate.side === side)
          .slice(0, 6)) {
          instruments.push(Object.freeze({
            symbol: row.symbol,
            label: `${root.label} ${side} ${row.strike.toLocaleString("en-US")}`,
            venue: root.venue,
            kind: "option",
            group: `Options · ${new Date(row.expiration).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "2-digit",
              timeZone: "UTC",
            })}`,
            parent: `${root.root}.OPT`,
            root: root.root,
            expiration: row.expiration,
            strike: row.strike,
            side,
            tickSize: root.tickSize,
          }));
        }
      }
    }
    return instruments.slice(0, OPTION_ROOTS.length * 12);
  }

  async #request(form) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(DATABENTO_HISTORY_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form,
        signal: controller.signal,
      });
      this.metrics.requests += 1;
      const payload = await readBoundedText(response, MAX_RESPONSE_BYTES);
      if (!response.ok) {
        throw new OptionsCatalogError(
          "options_catalog_provider_rejected",
          `CME options provider rejected the catalog request (${response.status}).`,
          502,
        );
      }
      return parseNdjson(payload);
    } catch (error) {
      if (error instanceof OptionsCatalogError) throw error;
      throw new OptionsCatalogError(
        "options_catalog_transport_failed",
        error?.name === "AbortError"
          ? "CME options catalog timed out."
          : "CME options catalog transport failed.",
        502,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeSymbol(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized && /^[A-Z0-9 ._+\-]{1,64}$/.test(normalized) ? normalized : "";
}

function optionClass(value) {
  const normalized = String(value ?? "").toUpperCase();
  if (["C", "CALL", "3"].includes(normalized)) return "Call";
  if (["P", "PUT", "4"].includes(normalized)) return "Put";
  return null;
}

function finitePrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || Math.abs(numeric) >= 9e18) return 0;
  return Math.abs(numeric) > 1e7 ? numeric / 1e9 : numeric;
}

function timestampMs(value) {
  if (typeof value === "string" && !/^\d+$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 1e17) return Math.floor(numeric / 1e6);
  if (numeric > 1e14) return Math.floor(numeric / 1e3);
  if (numeric > 1e11) return Math.floor(numeric);
  if (numeric > 1e9) return Math.floor(numeric * 1e3);
  return 0;
}

function parseNdjson(payload) {
  return String(payload || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line);
        if (Array.isArray(parsed)) return parsed.filter((row) => row && typeof row === "object");
        return parsed && typeof parsed === "object" ? [parsed] : [];
      } catch {
        return [];
      }
    });
}

async function readBoundedText(response, limit) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    throw new OptionsCatalogError(
      "options_catalog_payload_too_large",
      "CME options catalog exceeded its bounded payload limit.",
      502,
    );
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new OptionsCatalogError(
        "options_catalog_payload_too_large",
        "CME options catalog exceeded its bounded payload limit.",
        502,
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export const databentoOptionRoots = OPTION_ROOTS;
