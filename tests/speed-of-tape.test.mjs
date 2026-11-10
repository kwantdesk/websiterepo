import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { buildSpeedOfTapeFrame, buildChartSpeedOfTapeFrame, chartSpeedOfTapeSeries, normalizeSpeedOfTapeSettings } from "../src/lib/speedOfTape.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";

const trade = (timestamp, volume, aggressor = "BUY", trades = 1, flowOnly = false) => ({ timestamp, volume, aggressor, trades, recordIndex: timestamp, flowOnly });
const theme = { primary: "#fff", secondary: "#aaa", positive: "#0f0", negative: "#f00", muted: "#777" };
const candle = (timestamp, extra = {}) => ({timestamp, open: 100, high: 101, low: 99, close: 100, ...extra});

test("all time intervals place exactly one reading on each real candle, with no future timestamps",()=>{
  for (const interval of [1000,5000,15000,30000,45000,60000,120000,180000,300000,600000,900000,1800000,3600000,86400000]) {
    const candles=[candle(0),candle(interval),candle(interval*2)];
    const tape=candles.map(c=>trade(c.timestamp+interval-1,7));
    const frame=buildChartSpeedOfTapeFrame(tape,{numberSeconds:1},theme,candles,interval,interval*3-1);
    assert.deepEqual(chartSpeedOfTapeSeries(frame,'speed')[0].data.map(p=>p.time),candles.map(c=>c.timestamp/1000));
    assert.deepEqual(frame.bars.map(b=>b.value),[7,7,7]);
  }
});

test("live tape changes the current candle immediately and seconds, size and trade-count filters act independently",()=>{
  const candles=[candle(60000)];
  const tape=[trade(61000,50),trade(72000,2,'SELL'),trade(74000,8,'BUY',3)];
  const frame=buildChartSpeedOfTapeFrame(tape,{numberSeconds:10},theme,candles,60000,75000);
  assert.equal(frame.bars[0].value,10);
  assert.equal(buildChartSpeedOfTapeFrame(tape,{numberSeconds:30},theme,candles,60000,75000).bars[0].value,60);
  assert.equal(buildChartSpeedOfTapeFrame(tape,{numberSeconds:10,filterMin:5},theme,candles,60000,75000).bars[0].value,8);
  assert.equal(buildChartSpeedOfTapeFrame(tape,{numberSeconds:10,filterMax:5},theme,candles,60000,75000).bars[0].value,2);
  const counted=buildChartSpeedOfTapeFrame(tape,{database:'trades',numberSeconds:10,filterMin:5},theme,candles,60000,75000);
  assert.equal(counted.bars[0].value,3,'size filter is volume, not number of prints');
  assert.equal(buildChartSpeedOfTapeFrame([...tape,trade(75000,9)],{numberSeconds:10},theme,candles,60000,75000).bars[0].value,19);
  assert.equal(buildChartSpeedOfTapeFrame(tape,{numberSeconds:10},theme,candles,60000,90000).bars[0].value,0);
});

test("event bars use source execution end times and retain distinct chart anchors",()=>{
  const candles=[candle(10000,{sourceEndTimestamp:11000}),candle(10001,{sourceEndTimestamp:12000}),candle(10002,{sourceEndTimestamp:13000})];
  const frame=buildChartSpeedOfTapeFrame([trade(11000,4),trade(12000,7),trade(13000,9)],{numberSeconds:1},theme,candles,null,13000);
  assert.deepEqual(frame.bars.map(b=>b.value),[4,7,9]);
  assert.deepEqual(chartSpeedOfTapeSeries(frame,'s')[0].data.map(p=>p.time),[10,10.001,10.002]);
});

test("replay excludes later executions and aggregate footprint summaries are never treated as a tape",()=>{
  const bars=[candle(60000)];
  const frame=buildChartSpeedOfTapeFrame([trade(61000,5),trade(63000,100),trade(61000,999,'BUY',1,true)],{},theme,bars,60000,62000);
  assert.equal(frame.bars[0].value,5);
  assert.equal(buildChartSpeedOfTapeFrame([trade(61000,999,'BUY',1,true)],{},theme,bars,60000,62000).status,'waiting-for-executions');
});

test("a strongest-print historical sample cannot become a false intensity history",()=>{
  const frame=buildChartSpeedOfTapeFrame([trade(1000,999),trade(61000,5),trade(74000,8)],{},theme,
    [candle(0),candle(60000)],60000,75000,60000);
  assert.deepEqual(frame.bars.map(b=>[b.startMs,b.value]),[[60000,8]]);
});

test("zero-speed windows and custom colors survive filtering and unordered input",()=>{
  const tape=[trade(21000,10,'SELL'),trade(1000,3)];
  const frame=buildChartSpeedOfTapeFrame(tape,{numberSeconds:1,useThemeColors:false,bearFillColor:'#123456'},theme,
    [candle(0),candle(10000),candle(20000)],10000,21999);
  assert.deepEqual(frame.bars.map(b=>b.value),[0,0,10]);
  assert.equal(frame.bars.at(-1).color,'#123456');
  assert.equal(tape[0].timestamp,21000,'input tape is never mutated');
});

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
