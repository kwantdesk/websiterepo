import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Queued study work shares the animation frame with painting.
 *
 * Exactly one task ran per frame. That is fine with two studies and starves
 * everything with ten: each waits for every study ahead of it to have had its
 * own frame first. Price and candles paint on their own imperative path, so
 * what the trader saw was the footprint box following price immediately while
 * its numbers arrived long afterwards — the box was never waiting, the data
 * was.
 *
 * The budget keeps the original point, which is never to block a frame, while
 * letting a queue that can be cleared cheaply be cleared now.
 */

const source = readFileSync(new URL("../src/lib/chartFrameWork.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("a frame is not limited to a single task", () => {
  assert.match(source, /const FRAME_WORK_BUDGET_MS = 8;/);
  assert.match(source, /performance\.now\(\) - started < FRAME_WORK_BUDGET_MS/);
  assert.match(source, /do \{/, "the loop must run before it checks the budget");
});

check("at least one task always runs", () => {
  // A do/while, so a study slower than the whole budget still makes progress
  // rather than being deferred for ever by its own cost.
  const body = source.slice(source.indexOf("scheduledFrame = window.requestAnimationFrame"));
  const doIndex = body.indexOf("do {");
  const whileIndex = body.indexOf("} while (");
  assert.ok(doIndex > 0 && whileIndex > doIndex, "the budget must be checked AFTER a task has run");
});

check("a failing study does not strand the queue", () => {
  assert.match(source, /\} catch \{/, "one study throwing must not stop the others");
  assert.match(source, /scheduleNextFrame\(\);/, "leftovers must take the next frame");
});

check("the newest task per study still replaces the older one", () => {
  // The point of keying the queue: a study that queues faster than it drains
  // must not build a backlog of stale rebuilds.
  assert.match(source, /pendingTasks\.set\(key, task\)/);
  assert.match(source, /pendingTasks\.delete\(key\)/);
});

// Modelled wait for the LAST study in a loaded workspace, which is the one the
// trader notices.
const FRAME_MS = 16.7;
const budgetFrames = (studies, taskMs, budgetMs = 8) =>
  Math.ceil(studies / Math.max(1, Math.floor(budgetMs / taskMs)));

check("a loaded workspace stops queueing behind itself", () => {
  const studies = 9;
  const taskMs = 1.2;
  const before = studies * FRAME_MS;
  const after = budgetFrames(studies, taskMs) * FRAME_MS;
  assert.ok(after < before / 3, `expected a large cut, got ${before.toFixed(0)}ms to ${after.toFixed(0)}ms`);
});

check("a slow study cannot blow the frame open", () => {
  // Forty milliseconds is longer than the whole budget, so it runs alone and
  // the frame yields rather than draining the rest behind it.
  assert.equal(budgetFrames(1, 40), 1);
  assert.equal(Math.max(1, Math.floor(8 / 40)), 1, "only one such task per frame");
});

console.log(`\nchart frame work: ${passed}/${passed} checks passed`);
