// Run with: node --import ./scripts/alias-hook.mjs scripts/audit-indicator-library.mjs
import { readFileSync } from "node:fs";
import ts from "typescript";
import { CHART_INDICATOR_CATALOG } from "../src/lib/chartIndicatorCatalog.ts";
import { LIVE_CHART_INDICATOR_IDS } from "../src/lib/chartIndicatorConfig.ts";

export function renderedIndicatorIds() {
  const file = ts.createSourceFile("ChartIndicatorsControl.tsx", readFileSync("src/components/ChartIndicatorsControl.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let ids;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === "RENDERED_CHART_INDICATOR_IDS") {
      const init = node.initializer;
      if (!init || !ts.isNewExpression(init) || init.expression.getText(file) !== "Set") throw new Error("Unexpected renderer registry shape");
      const array = init.arguments?.[0];
      if (!array || !ts.isArrayLiteralExpression(array) || array.elements.some(e => !ts.isStringLiteral(e))) throw new Error("Renderer registry must be explicit string IDs");
      ids = new Set(array.elements.map(e => e.text));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!ids) throw new Error("Renderer registry missing");
  return ids;
}

export function auditIndicatorLibrary() {
  const rendered = renderedIndicatorIds();
  const catalogIds = new Set(CHART_INDICATOR_CATALOG.map(d => d.id));
  const rows = CHART_INDICATOR_CATALOG.map(d => ({
    id: d.id, name: d.name, category: d.category,
    engineRegistered: LIVE_CHART_INDICATOR_IDS.has(d.id), rendererRegistered: rendered.has(d.id),
    status: LIVE_CHART_INDICATOR_IDS.has(d.id) && rendered.has(d.id) ? "registered" : "pending",
  }));
  return {
    total: rows.length,
    registered: rows.filter(r => r.status === "registered").length,
    pending: rows.filter(r => r.status === "pending"),
    orphanEngines: [...LIVE_CHART_INDICATOR_IDS].filter(id => !catalogIds.has(id)),
    orphanRenderers: [...rendered].filter(id => !catalogIds.has(id)),
  };
}

if (process.argv[1]?.endsWith("audit-indicator-library.mjs")) console.log(JSON.stringify(auditIndicatorLibrary(), null, 2));
