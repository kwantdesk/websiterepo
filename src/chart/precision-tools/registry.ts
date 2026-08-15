import type { PrecisionToolDefinition, PrecisionToolGroupId, PrecisionToolId } from "./types";

export const PRECISION_TOOL_GROUPS: ReadonlyArray<{ id: PrecisionToolGroupId; label: string; toolIds: PrecisionToolId[] }> = [
  {
    id: "geometry",
    label: "Geometry",
    toolIds: ["precision-line", "precision-ray", "precision-horizontal-line", "precision-vertical-line", "precision-parallel-line"],
  },
  {
    id: "shapes-notes",
    label: "Shapes & Notes",
    toolIds: ["precision-rectangle", "precision-ellipse", "precision-text", "precision-pencil"],
  },
  {
    id: "fibonacci",
    label: "Fibonacci",
    toolIds: ["precision-fibonacci-retracement", "precision-fibonacci-projection", "precision-fibonacci-fan"],
  },
  {
    id: "analysis",
    label: "Analysis",
    toolIds: ["precision-ruler", "precision-volume-profile", "precision-anchored-vwap"],
  },
  {
    id: "trade-calculators",
    label: "Trade Calculators",
    toolIds: ["precision-buy-calculator", "precision-sell-calculator"],
  },
] as const;

const definitions: PrecisionToolDefinition[] = [
  { id: "precision-line", label: "Precision Line", shortLabel: "Line", groupId: "geometry", anchorCount: 2, shortcut: "L", description: "Finite two-anchor trend line." },
  { id: "precision-ray", label: "Precision Ray", shortLabel: "Ray", groupId: "geometry", anchorCount: 2, description: "Two-anchor ray extended through the chart edge." },
  { id: "precision-horizontal-line", label: "Horizontal Line", shortLabel: "H Line", groupId: "geometry", anchorCount: 1, shortcut: "H", description: "Price-anchored horizontal level." },
  { id: "precision-vertical-line", label: "Vertical Line", shortLabel: "V Line", groupId: "geometry", anchorCount: 1, shortcut: "V", description: "Time-anchored vertical marker." },
  { id: "precision-parallel-line", label: "Parallel Line", shortLabel: "Parallel", groupId: "geometry", anchorCount: 3, description: "Two-point baseline and independently positioned parallel rail." },
  { id: "precision-rectangle", label: "Rectangle", shortLabel: "Rect", groupId: "shapes-notes", anchorCount: 2, shortcut: "R", description: "Price-time rectangle with eight edit handles." },
  { id: "precision-ellipse", label: "Ellipse", shortLabel: "Ellipse", groupId: "shapes-notes", anchorCount: 2, description: "Price-time ellipse with eight edit handles." },
  { id: "precision-text", label: "Text", shortLabel: "Text", groupId: "shapes-notes", anchorCount: 1, shortcut: "T", description: "Editable chart note anchored in time and price." },
  { id: "precision-pencil", label: "Pencil", shortLabel: "Pencil", groupId: "shapes-notes", anchorCount: 0, supportsPath: true, shortcut: "P", description: "Freehand path simplified with Ramer-Douglas-Peucker." },
  { id: "precision-fibonacci-retracement", label: "Fibonacci Retracement", shortLabel: "Fib", groupId: "fibonacci", anchorCount: 2, shortcut: "F", description: "Configurable retracement levels between two anchors." },
  { id: "precision-fibonacci-projection", label: "Fibonacci Projection", shortLabel: "Projection", groupId: "fibonacci", anchorCount: 3, description: "Three-anchor measured projection levels." },
  { id: "precision-fibonacci-fan", label: "Fibonacci Fan", shortLabel: "Fan", groupId: "fibonacci", anchorCount: 2, description: "Ratio fan rays projected from the first anchor." },
  { id: "precision-ruler", label: "Ruler", shortLabel: "Ruler", groupId: "analysis", anchorCount: 2, shortcut: "M", description: "Price, tick, percentage, bar and elapsed-time measurement." },
  { id: "precision-volume-profile", label: "Volume Profile", shortLabel: "Profile", groupId: "analysis", anchorCount: 2, description: "Selected-range executed volume-at-price profile." },
  { id: "precision-anchored-vwap", label: "Anchored VWAP", shortLabel: "AVWAP", groupId: "analysis", anchorCount: 1, description: "Volume-weighted average price from a selected anchor." },
  { id: "precision-buy-calculator", label: "Buy Calculator", shortLabel: "Buy", groupId: "trade-calculators", anchorCount: 3, description: "Long risk, reward, size and R-multiple calculator." },
  { id: "precision-sell-calculator", label: "Sell Calculator", shortLabel: "Sell", groupId: "trade-calculators", anchorCount: 3, description: "Short risk, reward, size and R-multiple calculator." },
];

export const PRECISION_TOOL_REGISTRY = new Map<PrecisionToolId, PrecisionToolDefinition>(
  definitions.map((definition) => [definition.id, Object.freeze(definition)]),
);

export function getPrecisionTool(id: PrecisionToolId): PrecisionToolDefinition {
  const definition = PRECISION_TOOL_REGISTRY.get(id);
  if (!definition) throw new Error(`Unknown Precision Tool: ${id}`);
  return definition;
}

export function requiredPrecisionAnchors(id: PrecisionToolId): number {
  return getPrecisionTool(id).anchorCount;
}
