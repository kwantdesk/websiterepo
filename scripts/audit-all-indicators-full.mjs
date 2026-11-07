import fs from "node:fs";
import path from "node:path";
import { CHART_INDICATOR_CATALOG, CHART_INDICATOR_CATEGORIES } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings, INDICATOR_NUMERIC_SETTINGS, LIVE_CHART_INDICATOR_IDS } from "../src/lib/chartIndicatorConfig.ts";

const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(file) : /\.(ts|tsx)$/.test(file) ? [file] : [];
});
const files = walk("src").filter(file => !/chartIndicatorConfig|chartIndicatorCatalog|ChartIndicatorsControl|indicatorDedicatedControlKeys|indicatorSettingAvailability/.test(file))
  .map(file => ({ file: file.replaceAll("\\", "/"), text: fs.readFileSync(file, "utf8") }));
const control = fs.readFileSync("src/components/ChartIndicatorsControl.tsx", "utf8");
const output = "docs/audits/2026-11-07-indicator-full-audit";
fs.mkdirSync(output, { recursive: true });
const rows = CHART_INDICATOR_CATEGORIES.flatMap(category =>
  CHART_INDICATOR_CATALOG.filter(definition => definition.category === category).map(definition => {
    const defaults = defaultIndicatorSettings(definition.id);
    const numeric = new Set((INDICATOR_NUMERIC_SETTINGS[definition.id] ?? []).map(setting => setting.key));
    const settings = Object.entries(defaults).map(([key, value]) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp("\\b" + escaped + "\\b");
      const hits = files.filter(file => pattern.test(file.text)).map(file => file.file);
      const internal = /version|preset|stableFootprintRows/i.test(key);
      return { key, value, controlEvidence: numeric.has(key) ? "numeric registry" :
        pattern.test(control) ? "dialog source reference" : typeof value === "boolean" || /colou?r$/i.test(key) ? "generated control candidate" : "needs inspection",
        runtimeReferences: hits, status: internal ? "internal metadata" : hits.length ? "source reference found; behavior pending" : "no runtime reference; inspect dynamic wiring" };
    });
    return { ...definition, engineRegistered: LIVE_CHART_INDICATOR_IDS.has(definition.id), status: "pending behavioral verification", settings };
  }));
fs.writeFileSync(output + "/controls.json", JSON.stringify(rows, null, 2) + "\n");
const candidates = rows.flatMap(row => row.settings.filter(setting => setting.status.startsWith("no runtime")).map(setting => ({ indicator: row.name, id: row.id, key: setting.key, value: setting.value })));
fs.writeFileSync(output + "/candidates.json", JSON.stringify(candidates, null, 2) + "\n");
const markdown = [
"# Chart indicator control audit", "", "Started 7 November 2026. See REPORT.md for the current evidence and limits.", "",
"Source references establish a place to inspect. They do not establish that a button changes its intended output. Dynamic controls and shared keys require individual tracing.", "",
"## Tally", "", "- Indicators inventoried — " + rows.length,
"- Default setting entries inventoried — " + rows.reduce((sum, row) => sum + row.settings.length, 0),
"- Entries without a literal runtime reference — " + candidates.length,
"- Indicators fully behaviorally verified — 0",
"- Confirmed irreparable controls — 0",
"- Runtime and browser checks — pending", "",
...CHART_INDICATOR_CATEGORIES.flatMap(category => ["## " + category, "", ...rows.filter(row => row.category === category).flatMap(row => [
"### " + row.name, "", "- [ ] Add, disable, enable and remove",
"- [ ] Every settings tab and action", "- [ ] Save, close, reopen and persistence",
"- [ ] Every setting changes its intended calculation or rendering",
"- [ ] Live update and replay where supported", "",
"| Setting | Default | Control evidence | Runtime evidence | Status |",
"| --- | --- | --- | --- | --- |",
...row.settings.map(setting => "| " + [setting.key, JSON.stringify(setting.value), setting.controlEvidence, setting.runtimeReferences.length + " source files", setting.status].map(value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ") + "|"), ""
])])
].join("\n");
fs.writeFileSync(output + "/CHECKLIST.md", markdown.trimEnd() + "\n");
console.log(JSON.stringify({ indicators: rows.length, settings: rows.reduce((sum,row)=>sum+row.settings.length,0), candidates: candidates.length, categories: CHART_INDICATOR_CATEGORIES.map(category=>[category,rows.filter(row=>row.category===category).length]) }));
