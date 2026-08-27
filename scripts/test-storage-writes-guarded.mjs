import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * No localStorage write may be able to take the page down.
 *
 * `setItem` throws a QuotaExceededError once the origin is full, and this desk
 * fills that quota with cached provider payloads. Most of these writes run
 * inside React effects, where an exception reaches the workspace failure
 * boundary and reloads the page - which is how pressing Buy became a crash and
 * refresh. There were 110 such writes; every one was a live crash site.
 *
 * A write is acceptable if it goes through the quota-aware helper, or sits
 * inside a `try` whose catch already handles the failure. A bare one is not.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const files = execSync(
  'git ls-files "src/**/*.ts" "src/**/*.tsx"',
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
).split("\n").filter(Boolean);

/**
 * Whether the write at `lines[upTo]`, starting at `column`, sits inside a `try`
 * that has not closed yet.
 *
 * The column matters. This used to scan the whole of the final line, so a
 * one-line `try { ... } catch {}` had already closed by the time it was asked -
 * and every write written that way was reported as unguarded. The braces after
 * the call are not in front of it.
 */
function insideTry(lines, upTo, column) {
  let depth = 0;
  const openTries = [];
  for (let index = 0; index <= upTo; index += 1) {
    const whole = index === upTo ? lines[index].slice(0, column) : lines[index];
    const code = whole.replace(/\/\/.*$/, "");
    if (/\btry\s*\{/.test(code)) openTries.push(depth);
    for (const char of code) {
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        while (openTries.length && depth <= openTries[openTries.length - 1]) openTries.pop();
      }
    }
  }
  return openTries.length > 0;
}

function bareWrites() {
  const found = [];
  for (const file of files) {
    if (file === "src/lib/browserStorageQuota.ts") continue;
    const text = readFileSync(file, "utf8");
    if (!text.includes("localStorage.setItem")) continue;
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!/(?:window\.)?localStorage\.setItem\(/.test(line)) continue;
      const trimmed = line.trim();
      // Prose about setItem is not a call to it.
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
      const column = line.search(/(?:window\.)?localStorage\.setItem\(/);
      if (insideTry(lines, index, column < 0 ? line.length : column)) continue;
      found.push(`${file}:${index + 1}`);
    }
  }
  return found;
}

check("the detector still catches a bare write", () => {
  /*
   * A guard that has been loosened into always passing is worse than no guard,
   * so the loosening is tested directly. Each fixture is the line array
   * insideTry actually reads, with the column of the call.
   */
  const at = (line) => line.search(/(?:window\.)?localStorage\.setItem\(/);
  const guarded = (rows, index) => insideTry(rows, index, at(rows[index]));

  // THE FALSE POSITIVE. The braces after the call are not in front of it.
  const oneLine = ['try { window.localStorage.setItem("k", "v"); } catch { /* pref */ }'];
  assert.equal(guarded(oneLine, 0), true, "a one-line try/catch guards its write");

  // A bare write is still a bare write.
  assert.equal(guarded(['window.localStorage.setItem("k", "v");'], 0), false);
  // Including one that merely FOLLOWS a closed try on an earlier line.
  assert.equal(guarded([
    "try { doSomething(); } catch {}",
    'window.localStorage.setItem("k", "v");',
  ], 1), false, "a try that already closed guards nothing");
  // And one in the catch block itself, which is where a quota failure lands.
  assert.equal(guarded([
    "try { a(); } catch {",
    '  window.localStorage.setItem("k", "v");',
    "}",
  ], 1), false, "the catch block is not inside the try");

  // A multi-line try still guards, at any nesting depth.
  assert.equal(guarded([
    "try {",
    "  if (ready) {",
    '    window.localStorage.setItem("k", "v");',
    "  }",
    "} catch {}",
  ], 2), true);
});

check("no unguarded localStorage write remains", () => {
  const bare = bareWrites();
  assert.deepEqual(
    bare, [],
    `these writes throw when storage is full and will crash the page:\n  ${bare.join("\n  ")}\n` +
    "Use writeProtectedItem from src/lib/browserStorageQuota, or wrap the write in try/catch.",
  );
});

check("the helper still evicts cache rather than the trader's work", () => {
  const source = readFileSync(new URL("../src/lib/browserStorageQuota.ts", import.meta.url), "utf8");
  // Eviction is only safe because everything it drops can be fetched again.
  assert.match(source, /const DISPOSABLE_PREFIXES/);
  assert.match(source, /if \(entry\.key === key\) continue;/, "it must never evict the key being written");
  // It must try the plain write FIRST, so an ordinary save disturbs nothing.
  const write = source.slice(source.indexOf("export function writeProtectedItem"));
  const firstSet = write.indexOf("store.setItem(key, value)");
  const firstRemove = write.indexOf("store.removeItem");
  assert.ok(firstSet > 0 && firstSet < firstRemove, "eviction must only happen after a write actually fails");
});

check("the paths a trader's work travels are all covered", () => {
  // Spot-check the ones that lose real work when they fail.
  for (const file of [
    "src/lib/paperTrading.ts",
    "src/lib/paperAccounts.ts",
    "src/lib/userPreferences.ts",
    "src/lib/theme.ts",
    "src/lib/chartSettings.ts",
    "src/chart/precision-tools/persistence.ts",
  ]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(text, /writeProtectedItem\(/, `${file} must persist through the quota-aware write`);
  }
});

console.log(`\nstorage writes guarded: ${passed}/${passed} checks passed`);
