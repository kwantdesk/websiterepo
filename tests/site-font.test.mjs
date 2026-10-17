import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import ts from "typescript";
import { siteCanvasFont } from "../src/lib/siteFont.ts";

const checkpoint = "codex/pre-aleph-font-2026-10-17";
const read = file => readFileSync(file, "utf8");
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);

test("provided Regular/Bold assets are real TrueType and all HTML entry points load them", () => {
  for (const style of ["Regular", "Bold"]) {
    const data = readFileSync(`public/fonts/aleph/Aleph-${style}.ttf`);
    assert.equal(data.readUInt32BE(0), 0x00010000);
    assert.ok(data.length > 30000);
  }
  for (const file of ["src/app/layout.tsx", "public/heatmap-app/index.html", "public/cookie-recovery.html"]) {
    assert.ok(read(file).includes("/fonts/aleph/aleph.css"), file);
  }
  assert.match(read("public/fonts/aleph/OFL.txt"), /SIL OPEN FONT LICENSE Version 1.1/);
  assert.doesNotMatch(read("src/app/globals.css"), /@fontsource/);
  assert.doesNotMatch(read("public/heatmap-app/embed.css"), /@font-face/);
});

test("saved drawing font sizes, weights and line heights survive the family override", () => {
  assert.equal(siteCanvasFont("italic 600 13.5px/1.4 Inter, sans-serif"), "italic 600 13.5px/1.4 Aleph, sans-serif");
  assert.equal(siteCanvasFont("700 8px 'JetBrains Mono', monospace"), "700 8px Aleph, sans-serif");
});

test("source font migration leaves numeric settings and JSX formatting attributes unchanged", () => {
  // Audit this release, not every future legitimate UI size change.
  const release = execFileSync("git", ["rev-list", "--reverse", `${checkpoint}..HEAD`, "--", "src/app/layout.tsx"], { encoding: "utf8" }).trim().split(/\r?\n/)[0];
  const files = execFileSync("git", ["-c", "core.safecrlf=false", "-c", "core.autocrlf=false", "diff", "--name-only", checkpoint, ...(release ? [release] : []), "--", "src"], { encoding: "utf8" })
    .trim().split(/\r?\n/).filter(f => /\.[jt]sx?$/.test(f) && !f.includes("/app/api/") && f !== "src/lib/siteFont.ts");
  function metrics(file, source) {
    source = source.replace(/\r\n/g, "\n");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const result = [];
    function visit(node) {
      if (ts.isNumericLiteral(node)) result.push(["number", node.text]);
      if (ts.isJsxAttribute(node) && ["fontSize", "fontWeight", "className"].includes(node.name.getText(ast))) {
        result.push([node.name.getText(ast), node.initializer?.getText(ast)]);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    return result;
  }
  for (const file of files) {
    const before = execFileSync("git", ["show", `${checkpoint}:${file}`], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    const after = release ? execFileSync("git", ["show", `${release}:${file}`], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }) : read(file);
    const actual = metrics(file, after), expected = metrics(file, before);
    const index = actual.findIndex((metric, i) => JSON.stringify(metric) !== JSON.stringify(expected[i]));
    assert.ok(index === -1 && actual.length === expected.length,
      `${file}: metric ${index}: ${JSON.stringify(actual[index])} != ${JSON.stringify(expected[index])}`);
  }
});

test("active text faces no longer select legacy fonts; emoji fonts remain", () => {
  for (const file of [...walk("src"), ...walk("public/heatmap-app")].filter(f => /\.(css|js|tsx?|html)$/.test(f))) {
    const source = read(file);
    for (const line of source.split(/\r?\n/)) {
      if (!/font-family:|fontFamily:|fontFamily=|\.font\s*=|--font-/.test(line) || /Emoji/.test(line)) continue;
      assert.doesNotMatch(line, /["'](?:Inter|Rajdhani|JetBrains Mono|Consolas|Arial Narrow)["']/, file);
    }
  }
  assert.match(read("src/components/ChartEmojiPicker.tsx"), /Apple Color Emoji/);
  assert.match(read("public/heatmap-app/index.html"), /20261017-aleph-font/);
  assert.match(read("middleware.ts"), /fonts\/aleph\//);
});
