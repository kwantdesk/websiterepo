import { GEX_MAP_PALETTE_PRESETS, hexLerp } from "@/lib/gexMapPalette";

/**
 * One palette for a whole GEX BOX workspace.
 *
 * A page can hold eighteen panels, and every one of them carried its own two
 * colours. Setting a look meant opening eighteen settings dialogs and matching
 * hexes by eye, and a call on one panel could end up a different colour from a
 * call on the next — which is the one thing a dealer-exposure surface must
 * never do.
 *
 * The palettes are the GEX Map's, not a second set. A trader who has learned
 * to read Viridis on the map reads the same colours here, and there is one
 * place to add a palette rather than two that drift.
 *
 * Colour is assigned by ROLE, not per panel: every call is one colour, every
 * put another, every header the same, every strike the same. That holds across
 * net flow, net drift, exposure by expiration and anything added later,
 * because the roles are what panels ask for.
 */

export type GexBoxRole =
  | "call"
  | "callSoft"
  | "put"
  | "putSoft"
  | "net"
  | "strike"
  | "header";

export type GexBoxRoles = Record<GexBoxRole, string> & {
  id: string;
  label: string;
  /** The palette's ten-stop signed scale, for surfaces that shade by intensity. */
  scale: string[];
};

export const GEX_BOX_PALETTE_IDS = GEX_MAP_PALETTE_PRESETS.map((preset) => preset.id);
export const DEFAULT_GEX_BOX_PALETTE_ID = GEX_MAP_PALETTE_PRESETS[0]?.id ?? "viridis";

/**
 * Headers and strike labels have to stay READABLE on the panel background,
 * whatever the palette does. A scheme whose every tone is dark would otherwise
 * render its own column headings invisible, so both are pulled toward the
 * desk's neutral text tone rather than taken raw from the scheme.
 */
const NEUTRAL_TEXT = "#C8CDD6";
const MUTED_TEXT = "#8A8F98";

export function resolveGexBoxRoles(paletteId: string | undefined): GexBoxRoles {
  const preset = GEX_MAP_PALETTE_PRESETS.find((entry) => entry.id === paletteId)
    ?? GEX_MAP_PALETTE_PRESETS.find((entry) => entry.id === DEFAULT_GEX_BOX_PALETTE_ID)
    ?? GEX_MAP_PALETTE_PRESETS[0];
  const scale = preset.scale && preset.scale.length
    ? preset.scale
    : [preset.negative, preset.negativeSoft, preset.positiveSoft, preset.positive];
  return {
    id: preset.id,
    label: preset.label,
    call: preset.positive,
    callSoft: preset.positiveSoft,
    put: preset.negative,
    putSoft: preset.negativeSoft,
    // The scheme's own highlight, which is what the GEX Map uses for its Star.
    net: preset.star,
    // Tinted by the scheme but kept legible. Taken from the scale's bright end
    // rather than from `star`, which is plain white on most presets and would
    // give every palette an identical header and strike colour.
    strike: hexLerp(scale[scale.length - 1], NEUTRAL_TEXT, 0.42),
    header: hexLerp(scale[scale.length - 1], MUTED_TEXT, 0.68),
    scale: [...scale],
  };
}

/** The CSS custom properties a themed GEX BOX surface exposes to its panels. */
export function gexBoxThemeVariables(roles: GexBoxRoles): Record<string, string> {
  return {
    "--gexbox-call": roles.call,
    "--gexbox-call-soft": roles.callSoft,
    "--gexbox-put": roles.put,
    "--gexbox-put-soft": roles.putSoft,
    "--gexbox-net": roles.net,
    "--gexbox-strike": roles.strike,
    "--gexbox-header": roles.header,
  };
}

/**
 * The per-panel colours a palette implies.
 *
 * Panels already draw their positive side from `color` and their negative side
 * from `negativeColor`, so writing the roles into those two keys themes every
 * existing panel without touching a single renderer.
 */
export function gexBoxPanelColors(roles: GexBoxRoles): { color: string; negativeColor: string } {
  return { color: roles.call, negativeColor: roles.put };
}
