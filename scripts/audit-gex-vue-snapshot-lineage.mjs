// Explicit, bounded, read-only audit. No background polling or provider key output.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { vendorMarketDataFetch } from "../src/lib/vendorMarketData.server.ts";
import { buildGexMapSnapshots } from "../src/lib/gexMapSnapshots.ts";
import { compactLiveGexMapPanel } from "../src/lib/gexMap.ts";

if (!process.argv.includes("--run")) throw new Error("Requires --run: performs five bounded licensed-data comparisons against a loopback Next server.");
const date = process.argv.find((arg) => arg.startsWith("--session="))?.slice("--session=".length) ?? "2026-10-16";
assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
const selections = ["SPXW", "NDX", "QQQ", "SPY"].map((symbol) => ({ symbol, scope: "FRONT_EXPIRY", representation: "PER_ONE_DOLLAR_MOVE" }));
selections.push({ symbol: "SPY", scope: "ALL_EXPIRIES", representation: "PER_ONE_PERCENT_MOVE" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const results = [];
for (const selection of selections) {
  try {
    const query = new URLSearchParams({ ...selection, sessionDate: date, greekMode: "GAMMA" });
    const response = await fetch(`http://127.0.0.1:4320/api/gex-map?${query}`, { signal: AbortSignal.timeout(60_000) });
    assert.equal(response.status, 200, `local snapshot HTTP ${response.status}`);
    const appText = await response.text();
    const app = JSON.parse(appText);
    const filter = { ticker: selection.symbol === "SPXW" ? "SPX" : selection.symbol };
    if (selection.scope === "FRONT_EXPIRY") filter.expirationDate = app.expiration;
    const source = await vendorMarketDataFetch("quantdata", "/v1/options/tool/interval-map", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionDate: date, aggregationPeriod: "1m", greekMode: "GAMMA", representationMode: selection.representation, filter }),
    });
    assert.equal(source.status, 200, `licensed interval-map HTTP ${source.status}`);
    const sourceText = await source.text();
    const raw = JSON.parse(sourceText);
    assert.ok(raw.data && typeof raw.data === "object");
    let missingCells = 0;
    const number = (value) => {
      if (value == null || value === "" || !Number.isFinite(Number(value))) { missingCells += 1; return 0; }
      return Number(value);
    };
    const expected = Object.entries(raw.data).sort(([a], [b]) => Number(a) - Number(b)).flatMap(([key, bucket]) => {
      const timestamp = Number(key);
      if (!Number.isFinite(timestamp) || !bucket || typeof bucket !== "object") return [];
      const local = clock.format(new Date(timestamp));
      if (local < "09:30" || local > "16:15") return [];
      const rows = new Map();
      for (const [expiry, strikes] of Object.entries(bucket)) {
        if (selection.scope === "FRONT_EXPIRY" && expiry !== app.expiration) continue;
        if (!strikes || typeof strikes !== "object") continue;
        for (const [strikeKey, cell] of Object.entries(strikes)) {
          const strike = Number(strikeKey);
          if (!Number.isFinite(strike) || !cell || typeof cell !== "object") continue;
          const prior = rows.get(strike) ?? { strike, call: 0, put: 0, net: 0 };
          const call = number(cell.CALL), put = number(cell.PUT);
          rows.set(strike, { strike, call: prior.call + call, put: prior.put + put, net: prior.net + call + put });
        }
      }
      return rows.size ? [{ timestamp, updates: [...rows.values()].sort((a, b) => a.strike - b.strike) }] : [];
    });
    assert.ok(expected.length, "no comparable source frames");
    assert.equal(app.frames.length, expected.length, "missing/truncated frames");
    let cells = 0;
    const surface = new Map();
    for (let index = 0; index < expected.length; index += 1) {
      const frame = expected[index];
      assert.equal(app.frames[index].timestamp, frame.timestamp);
      assert.deepEqual([...app.frames[index].updates].sort((a, b) => a.strike - b.strike), frame.updates, `raw strike cells ${frame.timestamp}`);
      for (const row of frame.updates) surface.set(row.strike, row);
      const replay = buildGexMapSnapshots(app, frame.timestamp, 1);
      assert.deepEqual([...replay.current.values()].sort((a, b) => a.strike - b.strike), [...surface.values()].sort((a, b) => a.strike - b.strike));
      cells += frame.updates.length * 3;
    }
    const compact = compactLiveGexMapPanel(app);
    for (const minutes of [1, 2, 5, 10]) {
      const full = buildGexMapSnapshots(app, null, minutes), reduced = buildGexMapSnapshots(compact, null, minutes);
      for (const kind of ["current", "previous", "opening"]) assert.deepEqual([...reduced[kind]], [...full[kind]]);
    }
    results.push({ ...selection, sessionDate: date, expiration: app.expiration, frames: expected.length, callPutNetCells: cells,
      missingCellsDefaultedToZero: missingCells, first: new Date(expected[0].timestamp).toISOString(), last: new Date(expected.at(-1).timestamp).toISOString(),
      stockPrice: app.stockPrice, netExposure: app.netExposure, providerSHA256: hash(sourceText), appSHA256: hash(appText), status: "PASS_REST_LINEAGE_NOT_BROWSER_CERTIFICATION" });
  } catch (error) {
    results.push({ ...selection, status: "FAILED_OR_UNAVAILABLE", reason: error instanceof Error ? error.message : String(error) });
  }
  console.log(JSON.stringify(results.at(-1)));
}
console.log(JSON.stringify({ capturedAt: new Date().toISOString(), scope: `GAMMA only; ${date}; four default front-expiry/per-$1 columns plus SPY all-expiry/per-1%; not all Greeks/dates/live observations`, results }));
if (results.some((result) => result.status === "FAILED_OR_UNAVAILABLE")) process.exitCode = 1;
