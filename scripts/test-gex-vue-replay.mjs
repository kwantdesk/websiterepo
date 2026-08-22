import assert from "node:assert/strict";

import {
  GEX_VUE_REPLAY_CLOSE_MINUTE,
  GEX_VUE_REPLAY_OPEN_MINUTE,
  clampGexVueReplayTimestamp,
  createGexVueReplayState,
  latestCompletedNewYorkSession,
  newYorkSessionTimestamp,
  normalizeGexVueReplaySessionDate,
  setGexVueReplaySession,
} from "../src/lib/gexVueReplay.ts";

const summerDate = "2026-08-17";
assert.equal(
  new Date(newYorkSessionTimestamp(summerDate, GEX_VUE_REPLAY_OPEN_MINUTE)).toISOString(),
  "2026-08-17T13:30:00.000Z",
  "RTH open must respect New York daylight saving time",
);
assert.equal(
  new Date(newYorkSessionTimestamp(summerDate, GEX_VUE_REPLAY_CLOSE_MINUTE)).toISOString(),
  "2026-08-17T20:00:00.000Z",
  "RTH close must respect New York daylight saving time",
);

const winterDate = "2026-01-12";
assert.equal(
  new Date(newYorkSessionTimestamp(winterDate, GEX_VUE_REPLAY_OPEN_MINUTE)).toISOString(),
  "2026-01-12T14:30:00.000Z",
  "RTH open must respect New York standard time",
);

assert.equal(
  latestCompletedNewYorkSession(Date.parse("2026-08-18T15:00:00.000Z")),
  "2026-08-17",
  "an active session must replay the prior completed session",
);
assert.equal(
  latestCompletedNewYorkSession(Date.parse("2026-08-18T21:00:00.000Z")),
  "2026-08-18",
  "a closed session must become replayable immediately",
);
assert.equal(
  latestCompletedNewYorkSession(Date.parse("2026-08-16T15:00:00.000Z")),
  "2026-08-14",
  "weekends must resolve to Friday's completed session",
);

let replay = createGexVueReplayState(Date.parse("2026-08-18T15:00:00.000Z"));
assert.equal(replay.sessionDate, "2026-08-17");
assert.equal(replay.timestampMs, replay.startMs);
assert.equal(clampGexVueReplayTimestamp(replay, replay.startMs - 1), replay.startMs);
assert.equal(clampGexVueReplayTimestamp(replay, replay.endMs + 1), replay.endMs);

replay = setGexVueReplaySession({ ...replay, playing: true }, "2026-08-14");
assert.equal(replay.sessionDate, "2026-08-14");
assert.equal(replay.timestampMs, replay.startMs);
assert.equal(replay.playing, false);

assert.equal(normalizeGexVueReplaySessionDate("2026-08-16"), "2026-08-14");
assert.equal(normalizeGexVueReplaySessionDate("2026-08-15"), "2026-08-14");
replay = setGexVueReplaySession(replay, "2026-08-16");
assert.equal(replay.sessionDate, "2026-08-14", "weekend selections must replay the prior market session");

console.log("GEX Vue replay clock tests passed.");
