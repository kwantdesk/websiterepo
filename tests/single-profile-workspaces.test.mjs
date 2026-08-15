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

test("single volume profile supports selecting and merging multiple completed sessions", () => {
  assert.match(profileSource, /merge-days/);
  assert.match(profileSource, /selectedDates/);
  assert.match(profileSource, /Promise\.all\(settings\.selectedDates/);
  assert.match(profileSource, /mergeInstitutionalVolumeProfiles/);
  assert.match(profileSource, /Sessions to merge/);
});

