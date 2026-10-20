const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) request = path.join(root, "src", request.slice(2));
  return resolve.call(this, request, parent, isMain, options);
};
const load = Module._load;
Module._load = function (request, ...args) {
  if (request === "next/dynamic") return () => () => null;
  return load.call(this, request, ...args);
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const Toolbar = require("../src/components/ChartDrawToolbar.tsx").default;
const noop = () => {};
const props = {
  activeTool: "cursor", keepDrawing: false, magnet: false, magnetStrength: "weak", emoji: "📈", quickEmojis: [],
  onSelectTool: noop, onToggleKeepDrawing: noop, onToggleMagnet: noop, onSelectMagnetStrength: noop,
  onSelectEmoji: noop, onOpenSettings: noop, hasSelection: false, onDeleteSelection: noop, onClearAll: noop,
};
const markup = renderToStaticMarkup(React.createElement(Toolbar, props));
for (const label of ["STD", "STAY", "STY", "DEL", "CLR"]) assert.ok(markup.includes(`>${label}</button>`), label);
assert.match(markup, /role="toolbar" aria-label="Chart drawing tools"/);
assert.match(markup, /kwant-draw-expand/);
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const rule = css.slice(css.indexOf(".kwant-draw-toolbar .kwant-draw-button,"), css.indexOf(".kwant-draw-toolbar .kwant-draw-expand,"));
for (const declaration of ["width: 28px", "height: 28px", "font-size: 8px", "line-height: 1", "white-space: nowrap"]) assert.ok(rule.includes(declaration), declaration);
assert.match(rule, /body\.kwant-cockpit-ui \.kwant-draw-toolbar \.kwant-draw-button/);
const strong = renderToStaticMarkup(React.createElement(Toolbar, { ...props, magnetStrength: "strong", magnet: true, keepDrawing: true, hasSelection: true }));
assert.ok(strong.includes(">STR</button>"));
assert.ok(!strong.includes("disabled=\"\""));
console.log("Drawing toolbar layout: real component SSR, all action labels, weak/strong/disabled states and cockpit typography contract passed");

// Optional read-only visual fixture: real toolbar markup + production CSS,
// without authentication, market-data calls or saved workspace mutations.
if (process.argv.includes("--serve")) {
  const http = require("node:http");
  const cssFiles = fs.readdirSync(path.join(root, ".next/static"), { recursive: true }).filter(file => String(file).endsWith(".css"));
  const links = cssFiles.map(file => `<link rel="stylesheet" href="/_next/static/${String(file).replaceAll("\\", "/")}">`).join("");
  const panel = (theme, title) => `<section style="${theme};width:240px"><h2 style="padding:12px;font-size:12px">${title}</h2><div style="display:flex;height:760px;border:1px solid var(--border);background:var(--background)">${markup}<div style="padding:14px;color:var(--muted);font-size:11px">Drawing toolbar<br>Layout check only<br>No market data</div></div></section>`;
  const html = `<!doctype html><html><head>${links}</head><body class="kwant-cockpit-ui"><main style="display:flex;gap:24px;padding:20px;background:var(--background)">${panel("--background:#000;--foreground:#eee;--primary:#dbff00;--border:#687000;--muted:#707780;--surface:#111", "Dark theme")}${panel("--background:#fff;--foreground:#152039;--primary:#005eff;--border:#9caed6;--muted:#64748b;--surface:#eef3fa", "Light theme")}</main></body></html>`;
  http.createServer((request, response) => {
    if (request.url === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); return; }
    if (/^\/fonts\/aleph\/Aleph-(Regular|Bold)\.ttf$/.test(request.url)) {
      response.setHeader("Content-Type", "font/ttf");
      response.end(fs.readFileSync(path.join(root, "public", request.url))); return;
    }
    const file = path.resolve(root, ".next", "." + String(request.url).replace(/^\/_next/, ""));
    if (!file.startsWith(path.join(root, ".next") + path.sep) || !file.endsWith(".css")) { response.writeHead(404); response.end(); return; }
    try { response.setHeader("Content-Type", "text/css"); response.end(fs.readFileSync(file)); } catch { response.writeHead(404); response.end(); }
  }).listen(4936, "127.0.0.1", () => console.log("Toolbar fixture http://127.0.0.1:4936"));
}
