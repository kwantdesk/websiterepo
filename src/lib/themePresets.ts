import { defaultTheme, type ThemeColors } from "@/lib/theme";

export type ThemePreset = {
  name: string;
  colors: ThemeColors;
};

type Palette = Partial<ThemeColors> & Pick<ThemeColors, "background" | "panel" | "surface" | "card" | "foreground" | "primary" | "secondary" | "muted" | "border" | "danger">;

function palette(name: string, colors: Palette): ThemePreset {
  return {
    name,
    colors: {
      ...defaultTheme,
      ...colors,
      accent: colors.accent ?? colors.secondary,
      chartBackground: colors.chartBackground ?? colors.background,
      gridColor: colors.gridColor ?? colors.border,
      crosshairColor: colors.crosshairColor ?? `${colors.primary}B8`,
      candleUp: colors.candleUp ?? colors.primary,
      candleDown: colors.candleDown ?? colors.danger,
      // Each side's outline follows its own body unless the preset says
      // otherwise, so every palette written before hollow candles existed
      // keeps drawing exactly what it drew.
      candleUpBorder: colors.candleUpBorder ?? colors.candleUp ?? colors.primary,
      candleDownBorder: colors.candleDownBorder ?? colors.candleDown ?? colors.danger,
    },
  };
}

/** Owner-approved catalogue, in the requested order. Saved/custom colour
 * snapshots remain independent of which presets are offered here. */
export const themePresets: ThemePreset[] = [
  palette("Midnight Cockpit", { background: "#020304", panel: "#050607", surface: "#0B0D10", card: "#07090B", foreground: "#DDE2E7", primary: "#FF1F78", secondary: "#16C7CE", accent: "#16C7CE", muted: "#707780", border: "#24282D", danger: "#FF1F78", chartBackground: "#020304", gridColor: "#11151A", crosshairColor: "rgba(255,31,120,.72)", candleUp: "#16C7CE", candleDown: "#FF1F78" }),
  palette("Kwant Desk", { background: "#000000", panel: "#050506", surface: "#0B0C0E", card: "#07080A", foreground: "#FFFFFF", primary: "#B6FF00", secondary: "#4361FF", accent: "#4361FF", muted: "#7F858D", border: "#1A1D22", danger: "#4361FF", chartBackground: "#000000", gridColor: "#111318", crosshairColor: "rgba(182,255,0,.78)", candleUp: "#B6FF00", candleDown: "#FFFFFF" }),
  palette("Mr. Quant", { background: "#000000", panel: "#050914", surface: "#0B1530", card: "#070D1D", foreground: "#F7FAFF", primary: "#47B7FF", secondary: "#91B9FF", accent: "#2E9FEA", muted: "#7E91B6", border: "#18315A", danger: "#FF4D67", chartBackground: "#000000", gridColor: "#0B172B", crosshairColor: "rgba(71,183,255,.78)", candleUp: "#47B7FF", candleDown: "#F7FAFF" }),
  palette("Retro Terminal", { background: "#071007", panel: "#0C1A0C", surface: "#132A13", card: "#102110", foreground: "#DFFFCF", primary: "#52FF52", secondary: "#FFB000", muted: "#6D946D", border: "#245024", danger: "#FF6B35", gridColor: "#193819", crosshairColor: "rgba(82,255,82,.66)" }),
  palette("Inverted Mono", { background: "#F7F7F5", panel: "#FFFFFF", surface: "#E6E6E2", card: "#EFEFED", foreground: "#080808", primary: "#111111", secondary: "#777777", muted: "#666666", border: "#C9C9C4", danger: "#555555", gridColor: "#DADAD5", candleUp: "#111111", candleDown: "#8A8A8A", crosshairColor: "rgba(0,0,0,.58)" }),
  palette("Mono Protocol", { background: "#000000", panel: "#080808", surface: "#151515", card: "#0E0E0E", foreground: "#FFFFFF", primary: "#FFFFFF", secondary: "#9A9A9A", muted: "#777777", border: "#333333", danger: "#6B6B6B", gridColor: "#1F1F1F", candleUp: "#FFFFFF", candleDown: "#737373", crosshairColor: "rgba(255,255,255,.72)" }),
  palette("Paper & Ink", { background: "#F5F2E9", panel: "#FFFEFA", surface: "#E5E0D4", card: "#EFEADF", foreground: "#15171A", primary: "#1D3557", secondary: "#D97706", muted: "#6F6C66", border: "#CEC8BA", danger: "#B42318", gridColor: "#DED8CB" }),
  palette("Bubblegum Blueprint", { background: "#F4F7FF", panel: "#FFFFFF", surface: "#DDE7FF", card: "#EAF0FF", foreground: "#242844", primary: "#FF70A6", secondary: "#3A6FF7", muted: "#747B94", border: "#C6D4F2", danger: "#D7396E", gridColor: "#DCE4F4" }),
  palette("Sakura Slate", { background: "#20242D", panel: "#2B303B", surface: "#3E4654", card: "#343A46", foreground: "#FFF4F6", primary: "#F2A7B5", secondary: "#7FA9C9", muted: "#9AA2AE", border: "#566170", danger: "#D95D75", gridColor: "#39414D" }),
  palette("Vermilion Sky", { background: "#EEF7FC", panel: "#FBFDFE", surface: "#D3EAF5", card: "#E2F1F8", foreground: "#26313A", primary: "#E34234", secondary: "#3A86C8", muted: "#71818C", border: "#BDD8E5", danger: "#A8203A", gridColor: "#D6E6ED" }),
  palette("Cherry Soda", { background: "#21090F", panel: "#311019", surface: "#481824", card: "#3A131D", foreground: "#FFF0F2", primary: "#F72545", secondary: "#4CC9F0", muted: "#A98289", border: "#682437", danger: "#FF4D6D", gridColor: "#421722" }),
  palette("Orchid Voltage", { background: "#1A1024", panel: "#281737", surface: "#3D2352", card: "#321C43", foreground: "#FFF8D8", primary: "#B56BFF", secondary: "#FFE45E", muted: "#A08DAA", border: "#593372", danger: "#FF5D8F", gridColor: "#392149" }),
  palette("Matcha Plum", { background: "#F5F4E8", panel: "#FCFBF4", surface: "#DFE3B6", card: "#ECECCF", foreground: "#332638", primary: "#718355", secondary: "#7A4E76", muted: "#7D7870", border: "#CED0A8", danger: "#A63D57", gridColor: "#E0E0C8" }),
  palette("Electric Lemon", { background: "#101128", panel: "#191B3D", surface: "#272A58", card: "#20234A", foreground: "#FCFFD9", primary: "#E9FF00", secondary: "#536DFE", muted: "#9095AA", border: "#3E4378", danger: "#FF477E", gridColor: "#292D54" }),
  palette("Tidepool Glass", { background: "#E8FFF9", panel: "#F7FFFD", surface: "#B8EFE1", card: "#D5F8EF", foreground: "#14332F", primary: "#00897B", secondary: "#FF6B6B", muted: "#688B84", border: "#9ED8CA", danger: "#D94F70", gridColor: "#C3E9E0" }),
  palette("Cobalt Clay", { background: "#171A2B", panel: "#22263B", surface: "#323852", card: "#292E47", foreground: "#F6F1EB", primary: "#4361EE", secondary: "#D97757", muted: "#9195AA", border: "#474E70", danger: "#E76F51", gridColor: "#30364F" }),
  palette("Playdough Parade", { background: "#FFF4D8", panel: "#FFF9E9", surface: "#FFD166", card: "#FFE7A3", foreground: "#25213B", primary: "#F77F00", secondary: "#4D96FF", muted: "#786C69", border: "#E7BE68", danger: "#9B5DE5", gridColor: "#EAD9B5" }),
];

export const RETAINED_THEME_NAMES = ["Midnight Cockpit", "Kwant Desk", "Mr. Quant"] as const;
export const KEPT_THEME_NAMES = [
  "Midnight Cockpit",
  "Kwant Desk",
  "Mr. Quant",
  "Retro Terminal",
  "Inverted Mono",
  "Mono Protocol",
  "Paper & Ink",
  "Bubblegum Blueprint",
  "Sakura Slate",
  "Vermilion Sky",
  "Cherry Soda",
  "Orchid Voltage",
  "Matcha Plum",
  "Electric Lemon",
  "Tidepool Glass",
  "Cobalt Clay",
  "Playdough Parade"
] as const;
