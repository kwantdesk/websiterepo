import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GEX_BOX_ORDERFLOW_METRICS } from "../src/lib/gex-box/domain.ts";
import {
  charmExposure,
  dexExposure,
  gexExposure,
  majorNegative,
  majorPositive,
  maxChangeAtOrBefore,
  negativeVannaExposure,
  zeroGamma,
} from "../src/lib/gex-box/metrics.ts";
import { parseGexResearchCommand, serializeGexResearchCommand } from "../src/lib/gex-box/research.ts";
import { DEFAULT_GEX_BOX_SETTINGS, migrateGexBoxSettings } from "../src/lib/gex-box/settings.ts";
import { normalizeGexBotEnvelope } from "../src/lib/gex-box/normalize.ts";
import {
  normalizeReplayFrames,
  replayFrameAtOrBefore,
  replayFramesAtOrBefore,
} from "../src/lib/gex-box/replay.ts";

const contract = {
  symbol: "SPXW",
  underlying: "SPX",
  expiry: "2026-08-21",
  strike: 6500,
  side: "call",
  openInterest: 10,
  volume: 4,
  multiplier: 100,
  delta: 0.5,
  gamma: 0.02,
  vanna: 0.2,
  charm: 0.1,
  impliedVolatility: 0.25,
  source: {
    provider: "kwantdesk",
    providerTimestamp: 1,
    receivedAt: 1,
    session: "LIVE_RTH",
    freshnessMs: 0,
    formulaVersion: "test",
    simulated: false,
  },
};

const row = (strike, exposure) => ({
  strike,
  volumeExposure: exposure,
  openInterestExposure: exposure,
  priorOpenInterestExposure: [],
  changeByWindow: {},
});

test("published exposure formulas preserve multiplier, scaling and sign", () => {
  assert.equal(dexExposure(contract, 100), 50_000);
  assert.equal(gexExposure(contract, 100), 2_000);
  assert.ok(Math.abs(charmExposure(contract, 100) - 1.1415525114155252) < 1e-12);
  assert.equal(negativeVannaExposure(contract, 100), -5_000);
});

test("major levels and cumulative zero gamma use raw signed values", () => {
  const strikes = [row(100, -10), row(110, 5), row(120, 15)];
  assert.equal(majorPositive(strikes)?.strike, 120);
  assert.equal(majorNegative(strikes)?.strike, 100);
  assert.ok(Math.abs(zeroGamma(strikes) - 113.33333333333333) < 1e-10);
});

test("provider normalization preserves native levels, provenance and raw strike values", () => {
  const normalized = normalizeGexBotEnvelope({
    ok: true,
    view: "classic",
    ticker: "ES_SPX",
    category: "gex_full",
    session: "FROZEN_NEW_YORK_CLOSE",
    marketOpen: false,
    checkedAt: 1_500,
    frame: {
      timestamp: 1_000,
      ticker: "ES_SPX",
      spot: 6500,
      zero_gamma: 6450,
      major_pos_vol: 6550,
      major_pos_oi: 6600,
      major_neg_vol: 6400,
      major_neg_oi: 6350,
      strikes: [[6400, -3, -9, [-8]], [6500, 2, 5, [4]], [6600, 8, 14, [11]]],
      sum_gex_vol: 7,
      sum_gex_oi: 10,
    },
    majors: null,
    maxChange: null,
  });
  assert.ok(normalized);
  assert.equal(normalized.instrument.id, "ES_SPX");
  assert.equal(normalized.source.provider, "gexbot");
  assert.equal(normalized.source.freshnessMs, 500);
  assert.equal(normalized.source.formulaVersion, null);
  assert.equal(normalized.levels.zeroGamma?.price, 6450);
  assert.equal(normalized.levels.zeroGamma?.basis, "provider");
  assert.equal(normalized.levels.majorPositive?.price, 6600);
  assert.deepEqual(normalized.strikes[0].priorOpenInterestExposure, [-8]);
});

test("max change never reads a frame after the requested timestamp", () => {
  const history = [
    { timestamp: 0, strikes: [row(100, 5), row(110, 8)] },
    { timestamp: 300_000, strikes: [row(100, 30), row(110, 9)] },
    { timestamp: 600_000, strikes: [row(100, 31), row(110, 200)] },
  ];
  assert.deepEqual(maxChangeAtOrBefore(history, 300_000, 5), { strike: 100, change: 25 });
});

test("previous-session replay is ordered, deduplicated and never reads ahead", () => {
  const frames = normalizeReplayFrames([
    { timestamp: 300, value: "late" },
    { timestamp: 100, value: "open" },
    { timestamp: 200, value: "old" },
    { timestamp: 200, value: "replacement" },
  ]);
  assert.deepEqual(frames.map((frame) => frame.timestamp), [100, 200, 300]);
  assert.equal(frames[1].value, "replacement");
  assert.equal(replayFrameAtOrBefore(frames, 250)?.value, "replacement");
  assert.equal(replayFrameAtOrBefore(frames, 99), null);
  assert.deepEqual(replayFramesAtOrBefore(frames, 200).map((frame) => frame.timestamp), [100, 200]);
});

test("research grammar round-trips and rejects unknown tokens", () => {
  const command = "!gex SPX strikes=25 dte=0..7 view=profile calls=otm puts=all combine";
  assert.equal(serializeGexResearchCommand(parseGexResearchCommand(command)), command);
  assert.throws(() => parseGexResearchCommand("!gex SPX fake=yes"), /Unsupported research token/);
  assert.throws(() => parseGexResearchCommand("!gex SPX strikes=200"), /1 to 100/);
});

test("settings migrations bound controls and keep exactly three unique order-flow metrics", () => {
  const migrated = migrateGexBoxSettings({
    surface: "orderflow",
    lineWidth: 999,
    dotSize: -1,
    orderflowMetrics: ["net_gex", "net_gex", "net_charm"],
  });
  assert.equal(migrated.lineWidth, 8);
  assert.equal(migrated.dotSize, 2);
  assert.equal(migrated.orderflowMetrics.length, 3);
  assert.equal(new Set(migrated.orderflowMetrics).size, 3);
  assert.equal(migrateGexBoxSettings(null).ticker, DEFAULT_GEX_BOX_SETTINGS.ticker);
});

test("the public order-flow catalog contains the required eight metrics only", () => {
  assert.deepEqual(GEX_BOX_ORDERFLOW_METRICS, [
    "dex_orderflow",
    "gex_orderflow",
    "convexity_orderflow",
    "net_gex",
    "net_convexity",
    "aggregate_dex",
    "net_negative_vanna",
    "net_charm",
  ]);
});

test("navigation exposes GEX BOX immediately after GEX CAL and preserves GEX CAL", async () => {
  const sidebar = await readFile(new URL("../src/components/AppSidebar.tsx", import.meta.url), "utf8");
  const cal = sidebar.indexOf('href: "/gex-cal"');
  const box = sidebar.indexOf('href: "/gex-box"');
  const flow = sidebar.indexOf('href: "/gex-flow"');
  assert.ok(cal >= 0 && box > cal && flow > box);
  const layout = await readFile(new URL("../src/app/(workspace)/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /"\/gex-cal": "gexcal"/);
  assert.match(layout, /"\/gex-box": "gexbot"/);
});

test("workspace uses only canonical GEX BOX APIs and production history cannot request simulation", async () => {
  const workspace = await readFile(new URL("../src/components/gexbot/GexBotWorkspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /\/api\/gexbot-terminal/);
  assert.match(workspace, /\/api\/gex-box\/snapshot/);
  assert.match(workspace, /\/api\/gex-box\/history/);
  assert.match(workspace, /\/api\/gex-box\/research/);
  const historyRoute = await readFile(new URL("../src/app/api/gex-box/history/route.ts", import.meta.url), "utf8");
  assert.match(historyRoute, /validViews = new Set\(\["classic", "state", "orderflow"\]\)/);
  assert.match(historyRoute, /fetchGexBotReplay\(view as "classic" \| "state" \| "orderflow", ticker, category, requestedDate\)/);
  assert.match(historyRoute, /History date must use YYYY-MM-DD/);
  assert.doesNotMatch(historyRoute, /searchParams\.get\("preview"\)/);
  assert.match(workspace, /Replay previous NY/);
  assert.match(workspace, /replayFrameAtOrBefore/);
  assert.match(workspace, /replayFramesAtOrBefore/);
});

test("canonical deep-link route supports all four surfaces", async () => {
  const route = await readFile(new URL("../src/app/(workspace)/gex-box/[surface]/page.tsx", import.meta.url), "utf8");
  for (const surface of ["classic", "state", "orderflow", "research"]) assert.match(route, new RegExp(`\\b${surface}\\b`));
});

test("profile and order-flow controls are wired to their renderers and persisted", async () => {
  const workspace = await readFile(new URL("../src/components/gexbot/GexBotWorkspace.tsx", import.meta.url), "utf8");
  const charts = await readFile(new URL("../src/components/gexbot/GexBotCharts.tsx", import.meta.url), "utf8");

  assert.match(workspace, /chartType: "line" \| "candles"/);
  assert.match(workspace, /profileAlignment: "left" \| "center" \| "right"/);
  assert.match(workspace, /Independent order-flow panels/);
  assert.match(workspace, /Combine 0DTE \+ 1DTE/);
  assert.match(workspace, /Underlying spot overlay/);
  assert.match(workspace, /windowMinutes/);
  assert.match(workspace, /version: 3[\s\S]*orderflowPanels/);

  assert.match(charts, /CandlestickChart/);
  assert.match(charts, /appearance\.profileAlignment === "left"/);
  assert.match(charts, /metric\.combine/);
  assert.match(charts, /metric\.expiry === "next"/);
  assert.match(charts, /metric\.showSpot/);
  assert.match(charts, /metric\.windowMinutes \* 60_000/);
  assert.match(charts, /axisPointer: \{ link: \[\{ xAxisIndex: "all" \}\]/);
});
