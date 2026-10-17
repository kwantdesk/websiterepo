// Mechanical font-family migration only. Do not reformat source files or
// alter sizes, weights, tracking, line heights, geometry or market logic.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const aliases = /\b(?:JetBrains Mono|SFMono-Regular|SF Mono|Fira Code|Arial Narrow|Segoe UI(?! Emoji)|IBM Plex Mono|Times New Roman|Inter|Rajdhani|Roboto|Consolas|Menlo|Monaco|Arial|Helvetica(?: Neue)?|Verdana|Tahoma|Courier(?: New)?)\b/g;
const firstFamily = /(?<![-\w])(?:Aleph|ui-monospace|monospace|ui-sans-serif|sans-serif|system-ui|-apple-system|serif)(?![-\w])/;
function family(value) {
  if (/Color Emoji|Segoe UI Emoji/.test(value)) return value;
  let next = value.replace(aliases, "Aleph");
  const first = next.match(firstFamily);
  if (first && first[0] !== "Aleph") next = next.slice(0, first.index) + "Aleph, " + next.slice(first.index);
  return next;
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
}
let changed = 0;
for (const file of [...files("src"), ...files("public/heatmap-app/src")]) {
  if (!/\.(?:tsx?|[cm]?js)$/.test(file)) continue;
  const source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const edits = [];
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail) {
      const start = node.getStart(ast), raw = source.slice(start, node.end);
      const next = family(raw);
      if (next !== raw) edits.push({ start, end: node.end, next });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let next = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.next + next.slice(edit.end);
  if (next !== source) { writeFileSync(file, next); changed++; }
}
for (const file of ["src/app/globals.css", "public/heatmap-app/styles.css", "public/heatmap-app/embed.css", "public/cookie-recovery.html"]) {
  const source = readFileSync(file, "utf8");
  // Only font family declarations and font variables; leave all other CSS.
  const next = source.replace(/((?:font-family|--font-[\w-]+)\s*:\s*)([^;}\n]+)/g,
    (_, prefix, value) => prefix + family(value));
  if (next !== source) { writeFileSync(file, next); changed++; }
}
console.log(`Updated font families in ${changed} files.`);
