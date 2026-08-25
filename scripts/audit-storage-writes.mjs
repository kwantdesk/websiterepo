/**
 * Which localStorage writes can take the page down.
 *
 * `localStorage.setItem` THROWS when the origin's quota is full. This desk
 * fills that quota with cached provider payloads, and most of these writes run
 * inside React effects - where an exception reaches the workspace failure
 * boundary and reloads the page. That is what turned pressing Buy into a crash
 * and refresh.
 *
 * A write is safe if it is inside a try block, or goes through the quota-aware
 * helper. Everything else is a live crash site. This reports them so the sweep
 * can be finished rather than guessed at.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync(
  'git ls-files "src/**/*.ts" "src/**/*.tsx"',
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
).split("\n").filter(Boolean);

/**
 * Whether the line sits inside a `try {` that has not yet closed.
 *
 * Tracked by brace depth: remember the depth at each open `try`, and drop it
 * once the scan returns to that depth. Good enough for this codebase's
 * formatting, and it only has to separate "guarded" from "bare".
 */
function tryDepths(lines, upTo) {
  let depth = 0;
  const openTries = [];
  for (let index = 0; index <= upTo; index += 1) {
    const line = lines[index];
    const code = line.replace(/\/\/.*$/, "");
    if (/\btry\s*\{/.test(code)) openTries.push(depth);
    for (const char of code) {
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        while (openTries.length && depth <= openTries[openTries.length - 1]) openTries.pop();
      }
    }
  }
  return openTries.length;
}

const bare = [];
let guarded = 0;
let helper = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("localStorage.setItem") && !text.includes("writeProtectedItem")) continue;
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    // Prose about setItem is not a call to it; a doc comment explaining the
    // hazard would otherwise be reported as the hazard.
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
    if (lines[index].includes("writeProtectedItem(")) { helper += 1; continue; }
    if (!lines[index].includes("localStorage.setItem")) continue;
    if (tryDepths(lines, index) > 0) { guarded += 1; continue; }
    bare.push({ file, line: index + 1, text: lines[index].trim().slice(0, 96) });
  }
}

console.log(`localStorage writes: ${bare.length} bare, ${guarded} inside try, ${helper} via the quota helper\n`);
const byFile = new Map();
for (const row of bare) byFile.set(row.file, (byFile.get(row.file) ?? 0) + 1);
console.log("bare writes by file (each one can crash the page when storage is full):");
for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(3)}  ${file}`);
}
