import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceSource = await readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const profileSource = await readFile(new URL("../src/components/profile-workspaces/SingleProfileWorkspace.tsx", import.meta.url), "utf8");

test("standalone TPO and volume profiles are workspace-native rather than candle overlays", () => {
  assert.match(workspaceSource, /tool-single-tpo-chart/);
  assert.match(workspaceSource, /tool-single-volume-profile/);
  assert.match(workspaceSource, /kind="tpo"/);
  assert.match(workspaceSource, /kind="volume"/);
  assert.match(workspaceSource, /value !== "tool-single-tpo-chart"/);
  assert.match(workspaceSource, /value !== "tool-single-volume-profile"/);
});

test("single profiles expose session presets, live price and fixed value-area landmarks", () => {
  for (const preset of ["previous-rth", "current-rth", "previous-globex", "current-week", "previous-week", "recurring-custom", "custom"]) {
    assert.match(profileSource, new RegExp(`\\"${preset}\\"`));
  }
  assert.match(profileSource, /DATABENTO_LIVE_TICK_EVENT/);
  assert.match(profileSource, /FIXED 70% VALUE AREA/);
  assert.match(profileSource, /\["LIVE".*\["POC".*\["VAH".*\["VAL"/s);
});

test("single TPO is the bounded production time-at-price path rather than execution-volume inference", () => {
  assert.match(profileSource, /engineSettings\.visitSource = "bar-range"/);
  assert.match(profileSource, /buildTpoProfiles\(\{ trades: \[\], bars/);
  assert.match(profileSource, /source: profile\.source === "exact-trades" \? "EXACT EXECUTIONS" : "CME 1M RANGE"/);
  assert.match(profileSource, /Math\.min\(300, Math\.max\(1, Math\.round\(row\.weight\)\)\)/);
  assert.match(profileSource, /min="5" max="120" step="5"/);
  assert.match(profileSource, /option value="blocks">Square blocks/);
  assert.match(profileSource, /option value="letters">TPO letters/);
  assert.match(profileSource, /window\.setInterval\(load, 15_000\)/);
});

test("single volume profile supports selecting and merging multiple completed sessions", () => {
  assert.match(profileSource, /merge-days/);
  assert.match(profileSource, /selectedDates/);
  assert.match(profileSource, /Promise\.all\(settings\.selectedDates/);
  assert.match(profileSource, /mergeInstitutionalVolumeProfiles/);
  assert.match(profileSource, /Sessions to merge/);
});

test("single volume profile exposes real granularity, execution and display controls", () => {
  assert.match(profileSource, /volumeGranularity: "auto" \| "ticks" \| "price"/);
  assert.match(profileSource, /Automatic target rows/);
  assert.match(profileSource, /Ticks per row/);
  assert.match(profileSource, /Price per row/);
  assert.match(profileSource, /resolvedVolumeGroupTicks/);
  assert.match(profileSource, /rebinVolumeProfile/);
  assert.match(profileSource, /calculateVolumeProfileValueArea/);
  assert.match(profileSource, /minTradeVolume: Math\.max/);
  assert.match(profileSource, /Total volume/);
  assert.match(profileSource, /Bid \/ Ask/);
  assert.match(profileSource, /Delta \+ Volume/);
  assert.match(profileSource, /Square root/);
  assert.match(profileSource, /Logarithmic/);
  assert.match(profileSource, /Show VWAP/);
});
