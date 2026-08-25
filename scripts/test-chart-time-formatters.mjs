import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The chart's time labels must not build a formatter per label.
 *
 * `formatChartTimestamp` is what Lightweight Charts calls for every visible
 * axis tick on every repaint and for the crosshair label on every pointer
 * move. It constructed a fresh `Intl.DateTimeFormat` each time - far more
 * expensive than using one, and pure garbage in the path that has to stay
 * smooth while the tape prints.
 *
 * Caching them introduces a second, quieter risk: the cache key has to name
 * every option field the call sites actually pass. A call site that asks for
 * `second` or `timeZoneName` while the key ignores it would silently receive
 * another call site's formatter and print the wrong label. These checks pin
 * both halves.
 */

const source = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** The body of formatChartTimestamp, where the per-call construction lived. */
const formatterFn = source.slice(
  source.indexOf("function formatChartTimestamp("),
  source.indexOf("function formatChartTick("),
);

check("formatting a timestamp no longer constructs a formatter", () => {
  assert.doesNotMatch(
    formatterFn,
    /new Intl\.DateTimeFormat/,
    "formatChartTimestamp must reuse a cached formatter, not build one per label",
  );
  assert.match(formatterFn, /chartTimestampFormatter\(timeZone, options\)/);
});

check("formatters are cached and reused", () => {
  const cache = source.slice(
    source.indexOf("const chartTimestampFormatters"),
    source.indexOf("function formatChartTimestamp("),
  );
  assert.match(cache, /new Map<string, Intl\.DateTimeFormat>\(\)/);
  assert.match(cache, /chartTimestampFormatters\.get\(key\)/, "a hit must return the existing one");
  assert.match(cache, /chartTimestampFormatters\.set\(key, formatter\)/, "a miss must store it");
});

check("no Date object is allocated per label either", () => {
  // Intl.DateTimeFormat.format accepts a number of milliseconds directly, so
  // wrapping every timestamp in a Date was one more throwaway object per tick.
  assert.doesNotMatch(formatterFn, /new Date\(/);
});

check("the cache key covers every option any call site passes", () => {
  // THE COLLISION GUARD. Read the fields named in the key, then read the
  // fields actually requested by every formatChartTimestamp call in the file.
  const keyLine = source.slice(source.indexOf("const key = `${zone}"));
  const keyEnd = keyLine.indexOf("`;");
  const keyed = new Set([...keyLine.slice(0, keyEnd).matchAll(/options\.(\w+)/g)].map((m) => m[1]));
  assert.ok(keyed.size > 0, "the key must be built from the options");

  const used = new Set();
  const call = /formatChartTimestamp\(\s*[^,]+,\s*[^,]+,\s*\{([\s\S]*?)\}\s*\)/g;
  let match;
  let callSites = 0;
  while ((match = call.exec(source)) !== null) {
    callSites += 1;
    for (const field of match[1].matchAll(/(\w+)\s*:/g)) used.add(field[1]);
  }
  assert.ok(callSites >= 3, `expected the axis, crosshair and tick call sites, found ${callSites}`);

  const missing = [...used].filter((field) => !keyed.has(field));
  assert.deepEqual(
    missing, [],
    `these options change the output but not the cache key, so call sites would share a formatter: ${missing.join(", ")}`,
  );
});

check("the cached formatter produces the same text as building one each time", () => {
  // Reproduce both sides against the real Intl implementation.
  const options = [
    { day: "2-digit", month: "short" },
    { hour: "2-digit", minute: "2-digit" },
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
  ];
  const cache = new Map();
  const cachedFormat = (zone, option, at) => {
    const key = `${zone}|${option.day ?? ""}|${option.month ?? ""}|${option.year ?? ""}|${option.hour ?? ""}|${option.minute ?? ""}|${option.second ?? ""}|${option.weekday ?? ""}`;
    let formatter = cache.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-AU", { timeZone: zone, hour12: false, ...option });
      cache.set(key, formatter);
    }
    return formatter.format(at);
  };
  for (const zone of ["America/New_York", "Australia/Sydney", "UTC"]) {
    for (const option of options) {
      for (let hour = 0; hour < 48; hour += 1) {
        const at = Date.UTC(2026, 7, 20) + hour * 3_600_000;
        const fresh = new Intl.DateTimeFormat("en-AU", { timeZone: zone, hour12: false, ...option })
          .format(new Date(at));
        assert.equal(cachedFormat(zone, option, at), fresh, `${zone} ${JSON.stringify(option)} +${hour}h`);
      }
    }
  }
  assert.equal(cache.size, 9, "three zones times three option sets, built once each");
});

console.log(`\nchart time formatters: ${passed}/${passed} checks passed`);
