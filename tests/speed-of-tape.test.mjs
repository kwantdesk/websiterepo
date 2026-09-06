import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { buildSpeedOfTapeFrame, normalizeSpeedOfTapeSettings } from "../src/lib/speedOfTape.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";

const trade = (timestamp, volume, aggressor = "BUY", trades = 1, flowOnly = false) => ({ timestamp, volume, aggressor, trades, recordIndex: timestamp, flowOnly });
const theme = { primary: "#fff", secondary: "#aaa", positive: "#0f0", negative: "#f00", muted: "#777" };

test("Speed of Tape measures exact volume/trade intensity in N-second windows", () => {
  const tape = [trade(1_000, 10), trade(2_000, 20, "SELL"), trade(11_000, 5, "BUY", 3), trade(12_000, 5, "BUY", 2)];
  const volume = buildSpeedOfTapeFrame(tape, { database: "volume", numberSeconds: 10, standardDeviationPerFilter: 0 }, theme);
  assert.deepEqual(volume.bars.map((bar) => [bar.value, bar.delta, bar.color]), [[30, -10, "#f00"], [10, 10, "#0f0"]]);
  const trades = buildSpeedOfTapeFrame(tape, { database: "trades", numberSeconds: 10, filterMin: 0, standardDeviationPerFilter: 0 }, theme);
  assert.deepEqual(trades.bars.map((bar) => bar.value), [2, 5]);
  assert.equal(buildSpeedOfTapeFrame([trade(1_000, 10, "BUY", 1, true)], {}, theme).status, "waiting-for-executions");
  assert.equal(buildSpeedOfTapeFrame(tape, { database: "order" }, theme).status, "orders-unavailable");
});

test("settings are bounded, persisted and public controls/runtime gates exist", () => {
  const normalized = normalizeSpeedOfTapeSettings({ numberSeconds: 0, standardDeviationPerFilter: 99, paneHeight: 1, database: "bad" });
  assert.deepEqual([normalized.numberSeconds, normalized.standardDeviationPerFilter, normalized.paneHeight, normalized.database], [1, 10, 120, "volume"]);
  const defaults = defaultIndicatorSettings("speed-of-tape");
  const restored = normalizePaneIndicatorState({ pane: [{ instanceId: "s", indicatorId: "speed-of-tape", enabled: true, settings: { ...defaults, database: "trades", numberSeconds: 30 } }] }).pane[0];
  assert.deepEqual([restored.settings.database, restored.settings.numberSeconds], ["trades", 30]);
  assert.ok(!auditIndicatorLibrary().pending.some((entry) => entry.id === "speed-of-tape"));
  const control = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  const wiring = `${control}\n${fs.readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8")}\n${fs.readFileSync(new URL("../src/lib/speedOfTape.ts", import.meta.url), "utf8")}`;
  for (const label of ["Database", "Filter min", "Filter max", "Number seconds", "Standard dev per filter", "bullBorderColor", "bullFillColor", "bearBorderColor", "bearFillColor"]) assert.match(wiring, new RegExp(label, "i"));
});
