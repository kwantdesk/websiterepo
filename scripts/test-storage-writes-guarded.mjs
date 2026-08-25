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

/** Whether the line sits inside a `try` block that has not closed yet. */
function insideTry(lines, upTo) {
  let depth = 0;
  const openTries = [];
  for (let index = 0; index <= upTo; index += 1) {
    const code = lines[index].replace(/\/\/.*$/, "");
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
      if (insideTry(lines, index)) continue;
      found.push(`${file}:${index + 1}`);
    }
  }
  return found;
}

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
