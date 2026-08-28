import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The liquidity map's modules must all bust cache together.
 *
 * This app is plain ES modules served as static files - there is no bundler and
 * no content hashing, so the ONLY thing that makes a browser re-fetch a changed
 * module is the `?v=` query on its import. Ship a change without bumping it and
 * the browser keeps serving the old file; bump it on some imports and not
 * others and the browser runs a MIX of old and new modules, which fails in ways
 * that look like anything at all.
 *
 * That is not hypothetical. Two modules were changed - the inside-market repair
 * and the plot-geometry message - with the version left alone, and the map came
 * back with its trade bubbles missing. Four of the twelve relative imports
 * carried a version at the time; the other eight never had one.
 */

const root = fileURLToPath(new URL("../public/heatmap-app/", import.meta.url));
const html = readFileSync(`${root}index.html`, "utf8");
const files = readdirSync(`${root}src`).filter((name) => name.endsWith(".js"));
const sources = new Map(files.map((name) => [name, readFileSync(`${root}src/${name}`, "utf8")]));

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/*
 * The version on a .js URL only. The stylesheets carry their own, on their own
 * schedule, and there is no reason for a CSS change to force every module to
 * be re-fetched.
 */
const JS_VERSION = /\.js\?v=([0-9]{8}-[a-z0-9-]+)/g;
const versionsIn = (text) => [...text.matchAll(JS_VERSION)].map((m) => m[1]);

check("the entry point carries a version", () => {
  const found = versionsIn(html);
  assert.ok(found.length > 0, "index.html loads main.js with no ?v= at all");
});

check("every relative module import carries one", () => {
  /*
   * An unversioned import is a module that can never be refreshed except by the
   * browser deciding to on its own. It is the same defect as a stale version,
   * just silent.
   */
  const bare = [];
  for (const [name, text] of sources) {
    for (const match of text.matchAll(/from\s+'(\.\/[a-z-]+\.js)(\?[^']*)?'/g)) {
      if (!match[2]) bare.push(`${name} -> ${match[1]}`);
    }
  }
  assert.deepEqual(bare, [], `unversioned imports: ${bare.join(", ")}`);
});

check("there is exactly one version across the whole app", () => {
  // A second version string means half the graph reloaded and half did not.
  const all = new Set([...versionsIn(html), ...[...sources.values()].flatMap(versionsIn)]);
  assert.equal(all.size, 1, `found ${all.size} versions: ${[...all].join(", ")}`);
});

check("the version is not the one that shipped the missing bubbles", () => {
  /*
   * A guard against the exact mistake rather than a general one: this is the
   * version that was live when two modules changed underneath it. Any future
   * bump satisfies this; leaving it alone while editing a module does not.
   */
  const [version] = new Set(versionsIn(html));
  assert.notEqual(version, "20260817-live-stability", "the version was never bumped");
});

check("every module in src is reachable from the import graph", () => {
  // A module nobody imports cannot be versioned into a browser at all, so it
  // would sit stale forever without anyone noticing.
  const imported = new Set();
  for (const text of [html, ...sources.values()]) {
    for (const match of text.matchAll(/(?:from\s+'\.\/|src="src\/)([a-z-]+\.js)/g)) imported.add(match[1]);
  }
  const orphans = files.filter((name) => !imported.has(name));
  assert.deepEqual(orphans, [], `never imported: ${orphans.join(", ")}`);
});

console.log(`\nliquidity map cache busting: ${passed}/${passed} checks passed`);
