// Local-only manual QA. No authentication changes, vendor calls or production route.
import http from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import ts from "typescript";
const source = ts.createSourceFile("Chart.tsx", readFileSync("src/components/Chart.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let options;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "options" && node.initializer?.getText(source).includes("definition.horizontalPriceLine")) options = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
if (!options) throw new Error("Actual chart options not found");
const entry = readFileSync("scripts/fixtures/indicator-preview.jsx", "utf8").replace(
  'import actualOverlayOptions from "kwant-preview-overlay-options";',
  `import { LineStyle, LineType } from "lightweight-charts"; function actualOverlayOptions(definition) { const kind="line"; return (${options}); }`,
);
const bundle = execSync("npx esbuild --bundle --loader=jsx --jsx=automatic --format=iife --platform=browser --alias:@=../../src", {
  cwd: "scripts/fixtures", input: entry, maxBuffer: 32 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"],
});
const css = readdirSync(".next/static/chunks").filter(f => f.endsWith(".css")).map(f => readFileSync(`.next/static/chunks/${f}`, "utf8")).join("\n");
const html = '<!doctype html><meta charset="utf-8"><title>Local indicator QA</title><link rel="stylesheet" href="/style.css"><style>:root{--background:#080b10;--foreground:#eee;--primary:#11ff44;--secondary:#ffaa22;--muted:#999;--surface:#182028;--border:#374151}body{background:#080b10;color:#eee}button{cursor:pointer}</style><div id="root"></div><script src="/bundle.js"></script>';
http.createServer((req, res) => {
  const path = new URL(req.url, "http://127.0.0.1:3117").pathname;
  const body = path === "/" ? html : path === "/bundle.js" ? bundle : path === "/style.css" ? css : null;
  if (body === null) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": path === "/" ? "text/html" : path === "/style.css" ? "text/css" : "text/javascript", "Cache-Control": "no-store" });
  res.end(body);
}).listen(3117, "127.0.0.1", () => console.log("QA preview http://127.0.0.1:3117 — synthetic fixture only"));
