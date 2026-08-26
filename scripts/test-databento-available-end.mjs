import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  availableEndFromError,
  clampEndToLicence,
  rememberAvailableEnd,
  rememberedAvailableEnd,
  resetRememberedAvailableEnd,
} from "../src/lib/databentoAvailableEnd.ts";

/**
 * Chart history must retry against the window the licence actually covers.
 *
 * Measured on production: EVERY symbol and EVERY timeframe returned 502 from
 * /api/cme-history. Databento was refusing with
 *
 *   422 {"detail":{"case":"dataset_unavailable_range","message":
 *        "Part or all of your request for dataset 'GLBX.MDP3' requires a
 *         subscription and/or license to access. Try again with an end..."}}
 *
 * There is already a clamp that retries against the end Databento names — but
 * it only recognised `data_end_after_available_end`, so this case fell through
 * and the request died outright. Nothing downstream survived that: candles,
 * and with them the flow-baked history CVD depends on, which is why CVD had
 * only whatever the live stream happened to deliver.
 *
 * The error text was also cut at 180 characters, right before the date it was
 * offering.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const iso = (value) => new Date(value).toISOString();

check("it reads the structured available_end", () => {
  const detail = JSON.stringify({
    detail: {
      case: "data_end_after_available_end",
      payload: { available_end: "2026-08-26T13:00:00Z" },
    },
  });
  assert.equal(iso(availableEndFromError(detail)), "2026-08-26T13:00:00.000Z");
});

check("it now handles the case that was breaking every chart", () => {
  // THE PRODUCTION FAILURE. This shape returned null before, so the clamp
  // never ran and the whole request failed.
  const detail = JSON.stringify({
    detail: {
      case: "dataset_unavailable_range",
      message: "Part or all of your request for dataset 'GLBX.MDP3' requires a subscription and/or license to access. Try again with an end date of at most 2026-08-19T21:00:00Z.",
    },
  });
  assert.equal(iso(availableEndFromError(detail)), "2026-08-19T21:00:00.000Z");
});

check("a date-only offer is read as the start of that day", () => {
  const detail = JSON.stringify({
    detail: {
      case: "dataset_unavailable_range",
      message: "Try again with an end date of at most 2026-08-19.",
    },
  });
  assert.equal(iso(availableEndFromError(detail)), "2026-08-19T00:00:00.000Z");
});

check("a structured payload still wins over the prose", () => {
  // If both are present the field is authoritative; the sentence may mention
  // another date for a different reason.
  const detail = JSON.stringify({
    detail: {
      case: "dataset_unavailable_range",
      message: "Your subscription started 2020-01-01. Try again with an end of 2026-08-19.",
      payload: { available_end: "2026-08-20T00:00:00Z" },
    },
  });
  assert.equal(iso(availableEndFromError(detail)), "2026-08-20T00:00:00.000Z");
});

check("an unrelated rejection names no end, so nothing is retried", () => {
  // Retrying a permission or symbology failure against a guessed window would
  // turn one honest error into a slower one.
  for (const problem of ["auth_required", "symbology_invalid_symbol", "bad_request"]) {
    assert.equal(availableEndFromError(JSON.stringify({ detail: { case: problem, message: "at 2026-08-19" } })), null);
  }
  assert.equal(availableEndFromError("not json at all"), null);
  assert.equal(availableEndFromError(JSON.stringify({ detail: { case: "dataset_unavailable_range", message: "no date here" } })), null);
  assert.equal(availableEndFromError("{}"), null);
});

check("the clamp only fires when the offered end is usable", () => {
  // A licence that ended BEFORE the requested window cannot be rescued by
  // clamping — there is genuinely no data to fetch, and the honest failure has
  // to reach the trader rather than a silently empty chart.
  const source = readFileSync(new URL("../src/lib/databento.ts", import.meta.url), "utf8");
  assert.match(source, /availableEnd > requestedStart/, "it must sit after the requested start");
  assert.match(source, /!Number\.isFinite\(requestedEnd\) \|\| availableEnd < requestedEnd/, "and before the requested end");
  assert.match(source, /end: new Date\(availableEnd - 1\)\.toISOString\(\)/, "retry stops just inside the licence");
  // Exactly one retry: `canRetryAvailableEnd` is passed false on the way back
  // in, so a still-failing clamp cannot loop.
  assert.match(source, /historicalRequest\(\s*\{[\s\S]*?\},\s*false,\s*\)/, "the retry must not be able to recurse");
});

check("the error keeps the part that says what to do", () => {
  const source = readFileSync(new URL("../src/lib/databento.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /detail\.slice\(0, 180\)/, "180 characters cut it off mid-sentence");
  assert.match(source, /detail\.slice\(0, 400\)/);
});

check("the boundary is remembered, so only the FIRST request pays for it", () => {
  // Measured on one production pane load: fifteen /api/cme-history requests,
  // THIRTEEN of them 502s at one to four seconds each. The entitlement here is
  // delayed rather than expired - it trails real time by hours - so every
  // request reaching for "now" is refused with a 422 naming the end it would
  // accept. Retrying rescued each call on its own, so the same fact was
  // rediscovered thirteen times: about twenty seconds of a chart's startup.
  resetRememberedAvailableEnd();
  const boundary = Date.parse("2026-08-25T20:50:07Z");
  // Straddles the boundary: legitimately starts inside the licence and reaches
  // past it, which is exactly the shape a live chart asks for.
  const window = { start: "2026-08-25T12:00:00Z", end: "2026-08-26T06:00:00Z" };

  // Nothing is touched until the provider has actually said so.
  assert.deepEqual(clampEndToLicence(window), window);

  rememberAvailableEnd(boundary);
  const clamped = clampEndToLicence(window);
  assert.equal(clamped.start, window.start, "the start is never moved");
  assert.ok(Date.parse(clamped.end) < boundary, "the end lands inside the licence");
  assert.equal(iso(Date.parse(clamped.end)), iso(boundary - 1));
});

check("a window already inside the licence is left alone", () => {
  resetRememberedAvailableEnd();
  rememberAvailableEnd(Date.parse("2026-08-25T20:50:07Z"));
  const safe = { start: "2026-08-24T00:00:00Z", end: "2026-08-25T00:00:00Z" };
  assert.deepEqual(clampEndToLicence(safe), safe, "clamping must never widen or disturb a valid window");
});

check("a window starting past the boundary is NOT rescued", () => {
  // Clamping this would produce end < start and hand back an empty chart with
  // no explanation. The honest failure has to reach the trader instead.
  resetRememberedAvailableEnd();
  rememberAvailableEnd(Date.parse("2026-08-25T20:50:07Z"));
  const beyond = { start: "2026-08-27T00:00:00Z", end: "2026-08-27T06:00:00Z" };
  assert.deepEqual(clampEndToLicence(beyond), beyond);
});

check("the boundary only ever moves forward", () => {
  // The provider extends this window as time passes; an older refusal arriving
  // late must not drag it backwards and start clamping valid requests.
  resetRememberedAvailableEnd();
  rememberAvailableEnd(Date.parse("2026-08-25T20:50:07Z"));
  rememberAvailableEnd(Date.parse("2026-08-25T18:00:00Z"));
  assert.equal(iso(rememberedAvailableEnd()), "2026-08-25T20:50:07.000Z");
  rememberAvailableEnd(Date.parse("2026-08-25T22:00:00Z"));
  assert.equal(iso(rememberedAvailableEnd()), "2026-08-25T22:00:00.000Z");
  rememberAvailableEnd(null);
  assert.equal(iso(rememberedAvailableEnd()), "2026-08-25T22:00:00.000Z");
  resetRememberedAvailableEnd();
});

console.log(`\ndatabento available end: ${passed}/${passed} checks passed`);
