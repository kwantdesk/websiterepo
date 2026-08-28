import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { GEX_MAP_REPLAY_WINDOWS, easternMinutesOfDay, framesInReplayWindow } =
  await import("../src/lib/gexMapReplayWindow.ts");

/**
 * Which part of the day a GEX Map replay covers.
 *
 * The provider records frames across the whole trading date, so a replay opened
 * on it began in the overnight and spent most of its length before the cash
 * open - reported as the scrubber starting at 14:30 ET, which was the recording
 * genuinely beginning there rather than a formatting fault.
 *
 * Scrubbing through hours of pre-market to reach the session is not what
 * "replay the day" means, so the New York session is the default.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const source = readFileSync(
  new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url),
  "utf8",
);
/** 2026-08-27 was a Thursday in EDT (UTC-4). */
const at = (hour, minute = 0) => Date.UTC(2026, 7, 27, hour, minute);

check("New York minutes are read in New York, not in UTC", () => {
  // The whole bug class: 13:30 UTC IS 09:30 in New York during EDT.
  assert.equal(easternMinutesOfDay(at(13, 30)), 9 * 60 + 30);
  assert.equal(easternMinutesOfDay(at(20, 0)), 16 * 60);
  assert.equal(easternMinutesOfDay(at(8, 0)), 4 * 60);
});

check("the session window is the default and it is the cash session", () => {
  const first = GEX_MAP_REPLAY_WINDOWS[0];
  assert.equal(first.id, "rth", "the first window is what the map opens on");
  assert.equal(first.startMinutes, 9 * 60 + 30, "the session does not start at the open");
  assert.equal(first.endMinutes, 16 * 60, "the session does not end at the close");
});

check("a full trading date is narrowed to the session", () => {
  // Every minute from the Globex open through to the close.
  const frames = [];
  for (let minute = 0; minute < 24 * 60; minute += 1) frames.push(at(0, minute));
  const rth = framesInReplayWindow(frames, "rth");
  assert.ok(rth.length > 0, "the session window kept nothing");
  const minutes = rth.map(easternMinutesOfDay);
  assert.equal(Math.min(...minutes), 9 * 60 + 30, "the replay starts before the open");
  assert.ok(Math.max(...minutes) < 16 * 60, "the replay runs past the close");
  assert.ok(rth.length < frames.length, "nothing was narrowed at all");
});

check("FULL keeps every recorded frame", () => {
  const frames = [at(2), at(9, 45), at(23, 30)];
  assert.deepEqual(framesInReplayWindow(frames, "all"), frames);
});

check("a window the recording never reached falls back to everything", () => {
  /*
   * An empty scrubber looks broken. Showing the whole recording and letting the
   * control say which window is selected is the honest answer - the trader can
   * see why there is more than they asked for.
   */
  const overnightOnly = [at(2), at(3), at(4, 30)];
  const rth = framesInReplayWindow(overnightOnly, "rth");
  assert.deepEqual(rth, overnightOnly, "the scrubber would have been left empty");
});

check("the control only appears in replay, and beside the column control", () => {
  // A live map has no window to choose.
  assert.match(source, /\{replayMode \? \(/, "the window control is not gated on replay");
  const controlAt = source.indexOf("aria-label=\"Replay window\"");
  const addPanelAt = source.indexOf("onClick={addPanel}");
  assert.ok(controlAt > 0, "there is no replay window control");
  assert.ok(addPanelAt > controlAt, "the control is not beside the add-column button");
});

check("the choice survives a reload", () => {
  assert.match(source, /GEX_MAP_REPLAY_WINDOW_KEY/, "the window is not persisted");
  assert.match(source, /writeProtectedItem\(GEX_MAP_REPLAY_WINDOW_KEY/, "the window is never written");
});

check("the step control counts minutes of the window, not of the overnight", () => {
  // Narrow first, then thin. The other order anchors the step to a frame the
  // trader is not looking at.
  const narrowAt = source.indexOf("framesInReplayWindow([...timestamps]");
  const stepAt = source.indexOf("% stepMinutes === 0");
  assert.ok(narrowAt > 0 && stepAt > narrowAt, "the step is applied before the window");
});

console.log(`\ngex map replay window: ${passed}/${passed} checks passed`);
