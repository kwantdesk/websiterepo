import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/liveExecutionTape.ts", import.meta.url), "utf8")
  .replace(/^import type .*\n/m, "")
  .replace(/: InstitutionalTrade\[\]/g, "")
  .replace(/: InstitutionalTrade/g, "")
  .replace(/: Set<number>/g, "")
  .replace(/new Map<string, InstitutionalTrade>\(\)/g, "new Map()")
  .replace(/ as const/g, "")
  .replace(/export /g, "");
const api = Function(`${source}; return { mergeInstitutionalTradeTape, LIVE_EXECUTION_TAPE_LIMITS };`)();

const trade = (index, flowOnly = false) => ({
  eventId: `${flowOnly ? "flow" : "exact"}-${index}`,
  recordIndex: index,
  timestamp: index * 1000,
  close: 100,
  volume: 1,
  flowOnly,
});

test("ordered live additions do not compact or reorder below the high-water mark", () => {
  const current = Array.from({ length: 55_000 }, (_, index) => trade(index, index % 2 === 0));
  const incoming = [trade(55_001), trade(55_002)];
  const result = api.mergeInstitutionalTradeTape(current, incoming);
  assert.equal(result.length, 55_002);
  assert.equal(result.at(-1).eventId, "exact-55002");
});

test("large tapes compact to reserved flow and exact capacities", () => {
  const current = Array.from({ length: 70_000 }, (_, index) => trade(index, index % 2 === 0));
  const result = api.mergeInstitutionalTradeTape(current, [trade(70_001)]);
  const flow = result.filter((record) => record.flowOnly).length;
  const exact = result.filter((record) => !record.flowOnly).length;
  assert.equal(flow, api.LIVE_EXECUTION_TAPE_LIMITS.flow);
  assert.equal(exact, api.LIVE_EXECUTION_TAPE_LIMITS.exact);
});

test("exact executions replace overlapping flow buckets", () => {
  const flow = { ...trade(1, true), timestamp: 1_500 };
  const exact = { ...trade(2), timestamp: 1_800 };
  const result = api.mergeInstitutionalTradeTape([flow], [exact]);
  assert.deepEqual(result.map((record) => record.eventId), [exact.eventId]);
});

test("exact execution replacement preserves records outside its second", () => {
  const before = { ...trade(1, true), timestamp: 500 };
  const overlap = { ...trade(2, true), timestamp: 1_500 };
  const after = { ...trade(3, true), timestamp: 2_500 };
  const exact = { ...trade(4), timestamp: 1_800 };
  const result = api.mergeInstitutionalTradeTape([before, overlap, after], [exact]);
  assert.deepEqual(result.map((record) => record.eventId), [
    before.eventId,
    exact.eventId,
    after.eventId,
  ]);
});
