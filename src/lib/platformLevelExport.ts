import { normalizeLevelExportColor } from "@/lib/levelExportColors";

export type PlatformLevelInput = {
  levelType: "Gamma Levels" | "Kwant Levels" | "Value Area Levels" | "Historical Supply/Demand + S/R";
  instrument: string;
  contractSymbol: string;
  id: string;
  name: string;
  role: string;
  price: number;
  zoneLow: number;
  zoneHigh: number;
  color: string;
  lineStyle: string;
  lineWidth: number;
};

export type PlatformLevelExportFormat =
  | "json"
  | "csv"
  | "deepcharts"
  | "quantower"
  | "sierra"
  | "ninjatrader"
  | "tradingview"
  | "metatrader5";

export type PlatformLevelExportOption = {
  id: PlatformLevelExportFormat;
  label: string;
  detail: string;
  delivery: "Universal" | "Direct import" | "Study source" | "Indicator source" | "Script source";
  extension: string;
  mimeType: string;
  oneInstrument: boolean;
  instructions: string;
};

export const PLATFORM_LEVEL_EXPORT_OPTIONS: PlatformLevelExportOption[] = [
  {
    id: "deepcharts",
    label: "DeepCharts",
    detail: "Annotation XML",
    delivery: "Direct import",
    extension: "xml",
    mimeType: "application/json;charset=utf-8",
    oneInstrument: false,
    instructions: "Import from the chart Annotation Import command. Horizontal levels preserve labels, colours, line styles and contract symbols.",
  },
  {
    id: "quantower",
    label: "Quantower",
    detail: "Quantower Algo C#",
    delivery: "Indicator source",
    extension: "cs",
    mimeType: "text/plain;charset=utf-8",
    oneInstrument: true,
    instructions: "Create a Quantower Algo Indicator project, replace the generated class with this source, build it, then add Kwant Desk Levels to the chart.",
  },
  {
    id: "sierra",
    label: "Sierra Chart",
    detail: "ACSIL C++ study",
    delivery: "Study source",
    extension: "cpp",
    mimeType: "text/x-c++src;charset=utf-8",
    oneInstrument: true,
    instructions: "Place the source in ACS_Source, use Analysis > Build Custom Studies DLL, then add the Kwant Desk Levels custom study to the chart.",
  },
  {
    id: "ninjatrader",
    label: "NinjaTrader 8",
    detail: "NinjaScript C#",
    delivery: "Indicator source",
    extension: "cs",
    mimeType: "text/plain;charset=utf-8",
    oneInstrument: true,
    instructions: "Create a new Indicator in the NinjaScript Editor, replace its source with this file, compile, then add KwantDeskLevels to the chart.",
  },
  {
    id: "tradingview",
    label: "TradingView",
    detail: "Pine Script v6",
    delivery: "Script source",
    extension: "pine",
    mimeType: "text/plain;charset=utf-8",
    oneInstrument: true,
    instructions: "Open Pine Editor, paste this source, save it and choose Add to chart. TradingView does not import user drawings from a file.",
  },
  {
    id: "metatrader5",
    label: "MetaTrader 5",
    detail: "MQL5 chart script",
    delivery: "Script source",
    extension: "mq5",
    mimeType: "text/plain;charset=utf-8",
    oneInstrument: true,
    instructions: "Save in MQL5/Scripts, compile in MetaEditor, then drag KwantDeskLevels onto the matching chart to create the horizontal objects.",
  },
  {
    id: "json",
    label: "Kwant JSON",
    detail: "Structured archive",
    delivery: "Universal",
    extension: "json",
    mimeType: "application/json;charset=utf-8",
    oneInstrument: false,
    instructions: "Machine-readable Kwant Desk level archive for integrations, automation and future re-import.",
  },
  {
    id: "csv",
    label: "Universal CSV",
    detail: "Spreadsheet rows",
    delivery: "Universal",
    extension: "csv",
    mimeType: "text/csv;charset=utf-8",
    oneInstrument: false,
    instructions: "Portable tabular data for spreadsheets and custom platform bridges. It does not create chart drawings by itself.",
  },
];

function safeIdentifier(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-z0-9_]/gi, "_").replace(/^(\d)/, "_$1");
  return cleaned || fallback;
}

function safeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cString(value: string) {
  return safeText(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function pineString(value: string) {
  return safeText(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function rgb(value: string) {
  const six = normalizeLevelExportColor(value).slice(1);
  return {
    hex: six.toUpperCase(),
    red: Number.parseInt(six.slice(0, 2), 16),
    green: Number.parseInt(six.slice(2, 4), 16),
    blue: Number.parseInt(six.slice(4, 6), 16),
  };
}

function cSharpLineStyle(value: string) {
  if (value === "dashed") return "LineStyle.Dash";
  if (value === "dotted") return "LineStyle.Dot";
  return "LineStyle.Solid";
}

function sierraLineStyle(value: string) {
  if (value === "dashed") return "LINESTYLE_DASH";
  if (value === "dotted") return "LINESTYLE_DOT";
  return "LINESTYLE_SOLID";
}

function ninjaLineStyle(value: string) {
  if (value === "dashed") return "DashStyleHelper.Dash";
  if (value === "dotted") return "DashStyleHelper.Dot";
  return "DashStyleHelper.Solid";
}

function mqlLineStyle(value: string) {
  if (value === "dashed") return "STYLE_DASH";
  if (value === "dotted") return "STYLE_DOT";
  return "STYLE_SOLID";
}

function levelLabel(level: PlatformLevelInput) {
  const zone = level.zoneLow === level.zoneHigh
    ? String(level.price)
    : `${level.zoneLow}-${level.zoneHigh}`;
  return `${safeText(level.name)} | ${level.role.toUpperCase()} | ${zone}`;
}

function lineRows(levels: PlatformLevelInput[]) {
  return levels.flatMap((level) => {
    if (level.zoneLow !== level.zoneHigh) {
      return [
        { ...level, id: `${level.id}:low`, name: `${level.name} LOW`, price: level.zoneLow },
        { ...level, id: `${level.id}:high`, name: `${level.name} HIGH`, price: level.zoneHigh },
      ];
    }
    return [level];
  });
}

export function serializeQuantowerLevels(levels: PlatformLevelInput[]) {
  const rows = lineRows(levels);
  const series = rows.map((level, index) => {
    const color = rgb(level.color);
    return `            AddLineSeries("${cString(levelLabel(level))}", Color.FromArgb(${color.red}, ${color.green}, ${color.blue}), ${Math.max(1, Math.min(5, Math.round(level.lineWidth)))}, ${cSharpLineStyle(level.lineStyle)}); // ${index}`;
  }).join("\n");
  const values = rows.map((level, index) =>
    `            SetValue(${level.price.toFixed(8)}, ${index});`,
  ).join("\n");

  return `// Kwant Desk level export
// Instrument: ${cString(levels[0]?.instrument ?? "")}
// Generated source follows Quantower Algo's Indicator/AddLineSeries model.
using System.Drawing;
using TradingPlatform.BusinessLayer;

namespace KwantDesk
{
    public class KwantDeskLevels : Indicator
    {
        public KwantDeskLevels()
        {
            Name = "Kwant Desk Levels";
            Description = "Exported Kwant Desk chart levels for ${cString(levels[0]?.instrument ?? "")}";
            SeparateWindow = false;
${series}
        }

        protected override void OnUpdate(UpdateArgs args)
        {
${values}
        }
    }
}
`;
}

export function serializeSierraLevels(levels: PlatformLevelInput[]) {
  const rows = lineRows(levels);
  const tools = rows.map((level, index) => {
    const color = rgb(level.color);
    return `    {
        s_UseTool Tool;
        Tool.Clear();
        Tool.ChartNumber = sc.ChartNumber;
        Tool.DrawingType = DRAWING_HORIZONTALLINE;
        Tool.LineNumber = ${8_410_000 + index};
        Tool.BeginValue = ${level.price.toFixed(8)};
        Tool.Color = RGB(${color.red}, ${color.green}, ${color.blue});
        Tool.LineWidth = ${Math.max(1, Math.min(5, Math.round(level.lineWidth)))};
        Tool.LineStyle = ${sierraLineStyle(level.lineStyle)};
        Tool.Text = "${cString(levelLabel(level))}";
        Tool.DisplayHorizontalLineValue = 1;
        Tool.AddMethod = UTAM_ADD_OR_ADJUST;
        sc.UseTool(Tool);
    }`;
  }).join("\n\n");

  return `// Kwant Desk level export
// Instrument: ${cString(levels[0]?.instrument ?? "")}
// Build with Sierra Chart's Analysis > Build Custom Studies DLL command.
#include "sierrachart.h"

SCDLLName("Kwant Desk Levels")

SCSFExport scsf_KwantDeskLevels(SCStudyInterfaceRef sc)
{
    if (sc.SetDefaults)
    {
        sc.GraphName = "Kwant Desk Levels";
        sc.StudyDescription = "Exported Kwant Desk chart levels for ${cString(levels[0]?.instrument ?? "")}";
        sc.AutoLoop = 0;
        sc.GraphRegion = 0;
        return;
    }

    if (sc.ArraySize == 0)
        return;

${tools}
}
`;
}

export function serializeNinjaTraderLevels(levels: PlatformLevelInput[]) {
  const rows = lineRows(levels);
  const brushes = rows.map((level, index) => {
    const color = rgb(level.color);
    return `                var brush${index} = new SolidColorBrush(Color.FromRgb(${color.red}, ${color.green}, ${color.blue}));
                brush${index}.Freeze();
                Draw.HorizontalLine(this, "KD_${safeIdentifier(level.id, `LEVEL_${index}`)}", false, ${level.price.toFixed(8)}, brush${index}, ${ninjaLineStyle(level.lineStyle)}, ${Math.max(1, Math.min(5, Math.round(level.lineWidth)))}, true);`;
  }).join("\n");

  return `// Kwant Desk level export
// Instrument: ${cString(levels[0]?.instrument ?? "")}
using System.Windows.Media;
using NinjaTrader.Gui.Tools;
using NinjaTrader.NinjaScript.DrawingTools;

namespace NinjaTrader.NinjaScript.Indicators
{
    public class KwantDeskLevels : Indicator
    {
        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "Exported Kwant Desk chart levels for ${cString(levels[0]?.instrument ?? "")}";
                Name = "KwantDeskLevels";
                Calculate = Calculate.OnBarClose;
                IsOverlay = true;
                DrawOnPricePanel = true;
                IsSuspendedWhileInactive = true;
            }
            else if (State == State.DataLoaded)
            {
${brushes}
            }
        }

        protected override void OnBarUpdate()
        {
        }
    }
}
`;
}

export function serializeTradingViewLevels(levels: PlatformLevelInput[]) {
  const declarations: string[] = [];
  const fills: string[] = [];

  levels.forEach((level, index) => {
    const color = rgb(level.color);
    const pineColor = `color.rgb(${color.red}, ${color.green}, ${color.blue})`;
    const style = level.lineStyle === "dashed"
      ? "hline.style_dashed"
      : level.lineStyle === "dotted"
        ? "hline.style_dotted"
        : "hline.style_solid";
    if (level.zoneLow !== level.zoneHigh) {
      declarations.push(`kd_low_${index} = hline(${level.zoneLow.toFixed(8)}, "${pineString(level.name)} LOW", color=${pineColor}, linestyle=${style}, linewidth=${Math.max(1, Math.min(4, Math.round(level.lineWidth)))})`);
      declarations.push(`kd_high_${index} = hline(${level.zoneHigh.toFixed(8)}, "${pineString(level.name)} HIGH", color=${pineColor}, linestyle=${style}, linewidth=${Math.max(1, Math.min(4, Math.round(level.lineWidth)))})`);
      fills.push(`fill(kd_low_${index}, kd_high_${index}, color=color.new(${pineColor}, 88), title="${pineString(level.name)} ZONE")`);
    } else {
      declarations.push(`hline(${level.price.toFixed(8)}, "${pineString(levelLabel(level))}", color=${pineColor}, linestyle=${style}, linewidth=${Math.max(1, Math.min(4, Math.round(level.lineWidth)))})`);
    }
  });

  return `// Kwant Desk level export
// Instrument: ${pineString(levels[0]?.instrument ?? "")}
//@version=6
indicator("Kwant Desk Levels - ${pineString(levels[0]?.instrument ?? "")}", overlay=true)

${declarations.join("\n")}
${fills.length ? `\n${fills.join("\n")}` : ""}
`;
}

export function serializeMetaTraderLevels(levels: PlatformLevelInput[]) {
  const rows = lineRows(levels);
  const objects = rows.map((level, index) => {
    const color = rgb(level.color);
    const objectName = `KD_${safeIdentifier(level.id, `LEVEL_${index}`)}`;
    return `   CreateKwantLine("${cString(objectName)}", ${level.price.toFixed(8)}, C'${color.red},${color.green},${color.blue}', ${mqlLineStyle(level.lineStyle)}, ${Math.max(1, Math.min(5, Math.round(level.lineWidth)))}, "${cString(levelLabel(level))}");`;
  }).join("\n");

  return `// Kwant Desk level export
// Instrument: ${cString(levels[0]?.instrument ?? "")}
#property script_show_inputs
#property strict

bool CreateKwantLine(
   const string name,
   const double price,
   const color lineColor,
   const ENUM_LINE_STYLE lineStyle,
   const int lineWidth,
   const string tooltip)
{
   ObjectDelete(0, name);
   if(!ObjectCreate(0, name, OBJ_HLINE, 0, 0, price))
      return false;
   ObjectSetInteger(0, name, OBJPROP_COLOR, lineColor);
   ObjectSetInteger(0, name, OBJPROP_STYLE, lineStyle);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, lineWidth);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, false);
   ObjectSetString(0, name, OBJPROP_TOOLTIP, tooltip);
   return true;
}

void OnStart()
{
${objects}
   ChartRedraw(0);
}
`;
}

export function serializePlatformLevels(
  format: Exclude<PlatformLevelExportFormat, "json" | "csv" | "deepcharts">,
  levels: PlatformLevelInput[],
) {
  if (format === "quantower") return serializeQuantowerLevels(levels);
  if (format === "sierra") return serializeSierraLevels(levels);
  if (format === "ninjatrader") return serializeNinjaTraderLevels(levels);
  if (format === "tradingview") return serializeTradingViewLevels(levels);
  return serializeMetaTraderLevels(levels);
}
