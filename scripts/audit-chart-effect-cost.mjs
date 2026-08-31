/**
 * Which chart effects re-run on live data, and how much work they do.
 *
 * A Chrome trace of a real session put 110s of 192s busy main-thread seconds
 * under React's scheduler, and only 3.5s of that inside React itself - the
 * rest was application code running from effect bodies, almost all of it in
 * the chart bundle. The trace cannot name them (production build, no user
 * timing), so this reads the source instead.
 *
 * An effect is expensive-on-live when its dependency array contains a value
 * that changes with the tape (candles, trades, quotes, the live price) AND its
 * body loops over data. Those two together are what turns one print into a
 * full pass over the session.
 */

import { readFileSync } from "node:fs";

const FILES = process.argv.slice(2);
if (!FILES.length) {
  console.error("usage: node scripts/audit-chart-effect-cost.mjs <file...>");
  process.exit(1);
}

/** Dependencies that change as the market prints, not as the user acts. */
const LIVE = [
  "candles", "markettrades", "trades", "quote", "lastprice", "liveprice",
  "executions", "tape", "book", "depth", "prints", "bigtrade", "footprint",
  "cvd", "delta", "profile", "version", "revision", "tick", "frame",
];

/** Work that scales with the data rather than being a constant handful. */
const LOOPS = /\.(map|filter|forEach|reduce|flatMap|sort|slice|concat|find|some|every|entries|keys|values)\(|\bfor\s*\(|\bwhile\s*\(|JSON\.(parse|stringify)|Object\.(keys|values|entries|assign)|new (Map|Set)\(|\.\.\./g;

/**
 * The end of an effect, found by indentation rather than by counting braces.
 *
 * Brace counting needs a real tokeniser: `{` appears in comments, in regex
 * literals and inside template `${}` interpolation, and getting any of those
 * wrong runs the scan into the NEXT effect and reports its dependency array as
 * this one's - which is exactly how a 200-line dark-pool effect first came out
 * of here as a 1,519-line effect keyed on candles. This file is prettier
 * formatted with a consistent two-space indent, so an effect that opens at
 * column N closes on the first later line beginning with exactly N spaces then
 * `}, [`: both the end of the body and the start of the dependency array.
 */
function effectExtent(lines, startIndex) {
  const indent = lines[startIndex].match(/^(\s*)/)[1].length;
  const closer = new RegExp(`^\\s{${indent}}\\}, \\[`);
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (closer.test(lines[index])) return index;
    // A line that dedents past the opening indent means the effect ended
    // without the expected closer, so stop rather than run into the next one.
    if (/\S/.test(lines[index]) && lines[index].match(/^(\s*)/)[1].length < indent) return -1;
  }
  return -1;
}

const rows = [];

for (const file of FILES) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (!/use(Effect|LayoutEffect)\(\(\) => \{\s*$/.test(lines[index])) continue;
    const closeIndex = effectExtent(lines, index);
    if (closeIndex < 0) continue;

    const hook = lines[index].includes("useLayoutEffect") ? "useLayoutEffect" : "useEffect";
    const body = lines.slice(index + 1, closeIndex).join("\n");

    // The dependency array may wrap over several lines before its `]);`.
    const depsText = lines.slice(closeIndex, closeIndex + 60).join("\n");
    const depsMatch = depsText.match(/^\s*\}, \[([\s\S]*?)\]\s*\)/);
    if (!depsMatch) continue;
    const deps = depsMatch[1]
      .replace(/\/\/[^\n]*/g, "")
      .split(",")
      .map((dep) => dep.trim())
      .filter(Boolean);

    const liveDeps = deps.filter((dep) =>
      LIVE.some((needle) => dep.toLowerCase().includes(needle)));
    if (!liveDeps.length) continue;

    const loops = (body.match(LOOPS) || []).length;
    rows.push({
      file, line: index + 1, hook,
      lines: closeIndex - index,
      deps: deps.length, loops, liveDeps,
      // Work per run, weighted by how many separate live inputs re-trigger it.
      score: loops * liveDeps.length,
    });
  }
}

rows.sort((a, b) => b.score - a.score);
console.log(`${rows.length} effects re-run on live data\n`);
console.log(`${"score".padStart(6)} ${"loops".padStart(6)} ${"lines".padStart(6)}  location  <- live deps`);
console.log("-".repeat(118));
for (const row of rows.slice(0, 20)) {
  console.log(
    `${String(row.score).padStart(6)} ${String(row.loops).padStart(6)} ${String(row.lines).padStart(6)}  ` +
    `${row.file}:${row.line} (${row.hook})  <- ${row.liveDeps.slice(0, 4).join(", ")}`,
  );
}
const totalLoops = rows.reduce((sum, row) => sum + row.loops, 0);
const longest = rows.reduce((best, row) => (row.lines > best.lines ? row : best), rows[0]);
console.log(`\ntotal data-scaling operations across live effects: ${totalLoops}`);
console.log(`longest live effect body: ${longest.lines} lines at ${longest.file}:${longest.line}`);
