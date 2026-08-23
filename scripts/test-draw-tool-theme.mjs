import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_DRAW_STYLE,
  DRAW_STYLE_SCHEMA_VERSION,
  createDrawing,
  normalizeDrawings,
  resolveDrawColor,
} from "../src/lib/chartDrawTools.ts";

/**
 * Drawing tools follow the theme, and they draw thin.
 *
 * Every tool on the left rail was pinned to a 2px #2962FF line regardless of
 * the chart's palette, so a white-bullish theme still got blue annotations at
 * twice the weight of the candles.
 */
const points = [{ time: 1, price: 10 }, { time: 2, price: 20 }];

// --- a new drawing is thin and follows the theme ---
{
  assert.equal(DEFAULT_DRAW_STYLE.width, 1, "half of the old 2px default");
  assert.equal(DEFAULT_DRAW_STYLE.useThemeColor, true);
  const line = createDrawing("trendLine", points);
  assert.equal(line.style.width, 1);
  assert.equal(resolveDrawColor(line.style, "#FFFFFF"), "#FFFFFF", "paints in the theme");
  assert.equal(resolveDrawColor(line.style, "#00FF00"), "#00FF00", "and follows it when it changes");
}

// --- an explicit colour wins and keeps winning ---
{
  const chosen = { ...DEFAULT_DRAW_STYLE, color: "#FF00FF", useThemeColor: false };
  assert.equal(resolveDrawColor(chosen, "#FFFFFF"), "#FF00FF", "the trader's choice is not overridden");
  // Changing theme must not steal it back.
  assert.equal(resolveDrawColor(chosen, "#000000"), "#FF00FF");
}

// --- saved drawings are migrated once, not every load ---
{
  const legacy = [{
    id: "d1",
    tool: "trendLine",
    points,
    style: { color: "#2962FF", width: 2, lineStyle: "solid", fillOpacity: 0.12, showLabels: true },
  }];
  const [migrated] = normalizeDrawings(legacy);
  assert.equal(migrated.style.width, 1, "an existing 2px line is halved");
  assert.equal(migrated.style.useThemeColor, true, "and joins the theme, having never opted out");
  assert.equal(migrated.style.styleVersion, DRAW_STYLE_SCHEMA_VERSION);

  // Idempotent: re-normalising must not halve it again down to 0.5.
  const [again] = normalizeDrawings([migrated]);
  assert.equal(again.style.width, 1, "the migration must not compound");
  const [third] = normalizeDrawings([again]);
  assert.equal(third.style.width, 1);
}

// --- a deliberate width chosen AFTER the migration survives ---
{
  const deliberate = [{
    id: "d2",
    tool: "trendLine",
    points,
    style: {
      color: "#2962FF", width: 3, lineStyle: "solid", fillOpacity: 0.12, showLabels: true,
      styleVersion: DRAW_STYLE_SCHEMA_VERSION,
    },
  }];
  assert.equal(normalizeDrawings(deliberate)[0].style.width, 3, "already migrated, so left alone");
}

// --- a migrated explicit colour is not dragged onto the theme ---
{
  const owned = [{
    id: "d3",
    tool: "trendLine",
    points,
    style: { color: "#FF0000", width: 2, lineStyle: "solid", fillOpacity: 0.12, showLabels: true, useThemeColor: false },
  }];
  const [kept] = normalizeDrawings(owned);
  assert.equal(kept.style.useThemeColor, false);
  assert.equal(resolveDrawColor(kept.style, "#FFFFFF"), "#FF0000");
}

// --- the migration never produces an invisible hairline ---
{
  const thin = [{
    id: "d4", tool: "trendLine", points,
    style: { color: "#2962FF", width: 0.5, lineStyle: "solid", fillOpacity: 0.12, showLabels: true },
  }];
  assert.ok(normalizeDrawings(thin)[0].style.width >= 0.5, "0.5px is the floor");
}

// --- the renderer actually resolves through the theme ---
{
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  assert.ok(layer.includes("resolveDrawColor(style, themeColor)"),
    "the stroke must come from the resolver, not straight off style.color");
  assert.ok(!layer.includes("const stroke = style.color"), "the raw read must be gone");
  // The profile tools drew their POC straight from style.color.
  assert.ok(!layer.includes("style.color"), "no tool may bypass the resolver");
  // Fib ladders shipped their own fixed red/orange/green palette, so a fib on
  // a white-bullish theme still came out in TradingView's colours. The
  // coefficient labels still distinguish the levels.
  assert.ok(!layer.includes("lv.color"), "fib levels must not carry their own palette");

  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.ok(chart.includes("themeColor={settings.upColor}"), "the bullish candle colour is the source");
  // The position calculator already resolved its zones from the theme; that
  // must stay, since it is the same requirement for the same reason.
  assert.ok(chart.includes("profitColor: visualStyle.targetColor ?? settings.upColor"));
  assert.ok(chart.includes("lossColor: visualStyle.stopColor ?? settings.downColor"));

  // Picking a colour has to claim the override or it is silently ignored.
  const settings = readFileSync(new URL("../src/components/ChartDrawSettings.tsx", import.meta.url), "utf8");
  assert.ok(settings.includes("color: e.target.value, useThemeColor: false"),
    "the colour picker must opt out of the theme");
}

console.log("Drawing tool theme and width tests passed.");
