/**
 * Route every UNGUARDED localStorage write through the quota-aware helper.
 *
 * `setItem` throws when the origin's quota is full, and most of these run
 * inside React effects, where the exception reaches the workspace failure
 * boundary and reloads the page. That is what turned pressing Buy into a
 * crash; the same hazard sits behind every other bare write in the app.
 *
 * Writes already inside a `try` are left ALONE. Their catch blocks may do real
 * fallback work, and changing which path runs would be a behaviour change
 * rather than a crash fix. This only converts the ones that can currently
 * take the page down.
 *
 * Run with --check to report without writing.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const checkOnly = process.argv.includes("--check");

const files = execSync(
  'git ls-files "src/**/*.ts" "src/**/*.tsx"',
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
).split("\n").filter(Boolean);

/** Open `try` blocks still in scope at this line, by brace depth. */
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

/** How this file should refer to the helper. */
function importSpecifier(file) {
  // src/lib files import each other relatively, and their test runners have no
  // path-alias hook - an aliased import there breaks the tests, not the build.
  if (file.startsWith("src/lib/")) return "./browserStorageQuota.ts";
  return "@/lib/browserStorageQuota";
}

/** Insert the import after the last existing top-level import. */
function withImport(text, specifier) {
  // Look for the IMPORT, not the identifier: by the time this runs the file is
  // already full of `writeProtectedItem(` calls this pass just inserted, so
  // testing for the name matches every file and adds the import to none.
  if (/import\s*\{[^}]*writeProtectedItem[^}]*\}\s*from/.test(text)) return text;
  const line = `import { writeProtectedItem } from "${specifier}";`;
  const imports = [...text.matchAll(/^import[\s\S]*?from\s+["'][^"']+["'];$/gm)];
  if (imports.length) {
    const last = imports[imports.length - 1];
    const at = last.index + last[0].length;
    return `${text.slice(0, at)}\n${line}${text.slice(at)}`;
  }
  // A file with no imports (a few pure helpers): put it at the very top,
  // after any "use client" directive.
  const directive = text.match(/^["']use client["'];\n/);
  if (directive) return `${directive[0]}\n${line}\n${text.slice(directive[0].length)}`;
  return `${line}\n\n${text}`;
}

let converted = 0;
const touched = [];

for (const file of files) {
  if (file === "src/lib/browserStorageQuota.ts") continue;
  const original = readFileSync(file, "utf8");
  if (!original.includes("localStorage.setItem")) continue;

  const lines = original.split("\n");
  let changedHere = 0;
  const next = lines.map((line, index) => {
    if (!line.includes("localStorage.setItem")) return line;
    if (insideTry(lines, index)) return line;
    // Prose about setItem is not a call to it.
    const trimmed = line.trim();
    if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) return line;
    const rewritten = line.replace(/(?:window\.)?localStorage\.setItem\(/g, "writeProtectedItem(");
    // Count what actually changed, so a line mentioning setItem without
    // calling it is not reported as a conversion.
    if (rewritten === line) return line;
    changedHere += 1;
    return rewritten;
  });
  if (!changedHere) continue;

  converted += changedHere;
  touched.push({ file, changedHere });
  if (checkOnly) continue;
  writeFileSync(file, next.join("\n"), "utf8");
}

// Import repair, run over every file rather than only the ones just edited, so
// a re-run after a partial pass still finishes the job.
let importsAdded = 0;
if (!checkOnly) {
  for (const file of files) {
    if (file === "src/lib/browserStorageQuota.ts") continue;
    const text = readFileSync(file, "utf8");
    if (!/\bwriteProtectedItem\(/.test(text)) continue;
    const repaired = withImport(text, importSpecifier(file));
    if (repaired === text) continue;
    writeFileSync(file, repaired, "utf8");
    importsAdded += 1;
  }
}

console.log(`${checkOnly ? "would convert" : "converted"} ${converted} bare writes across ${touched.length} files\n`);
for (const row of touched.sort((a, b) => b.changedHere - a.changedHere)) {
  console.log(`  ${String(row.changedHere).padStart(3)}  ${row.file}`);
}
