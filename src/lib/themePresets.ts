import { defaultTheme, type ThemeColors } from "@/lib/theme";

export type ThemePreset = {
  name: string;
  colors: ThemeColors;
  swatches?: readonly string[];
};

type Palette = Partial<ThemeColors> & Pick<ThemeColors, "background" | "panel" | "surface" | "card" | "foreground" | "primary" | "secondary" | "muted" | "border" | "danger">;

function palette(name: string, colors: Palette, swatches?: readonly string[]): ThemePreset {
  return {
    name,
    ...(swatches ? { swatches } : {}),
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

function mixedPalette(name: string, colors: Palette): ThemePreset {
  return palette(name, colors, [colors.background, colors.panel, colors.primary, colors.secondary, colors.foreground]);
}

/** One fixed hue per preset, from an inky shell to luminous accents. Resolved
 * once at module load; applying a theme uses the existing saved hex tokens. */
function tonalPalette(name: string, hue: number): ThemePreset {
  const tone = (saturation: number, lightness: number): string => {
    const s = saturation / 100;
    const l = lightness / 100;
    const a = s * Math.min(l, 1 - l);
    const channel = (n: number) => {
      const k = (n + hue / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
  };
  const background = tone(70, 4);
  const panel = tone(65, 8);
  const primary = tone(95, 65);
  const secondary = tone(80, 48);
  return palette(name, {
    background, panel, surface: tone(60, 12), card: tone(62, 10),
    foreground: tone(45, 95), primary, secondary, accent: tone(85, 76),
    muted: tone(30, 68), border: tone(55, 30), danger: secondary,
    gridColor: tone(55, 15), candleUp: primary, candleDown: tone(50, 86),
  }, [primary, secondary, tone(65, 28), panel, background]);
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
  // Sampled from the centres of the owner's five-colour reference strips.
  palette("Deep Sea", { background: "#00171F", panel: "#003459", surface: "#007EA7", card: "#003459", foreground: "#FFFFFF", primary: "#00A8E8", secondary: "#007EA7", muted: "#97BAC8", border: "#007EA7", danger: "#FFFFFF", gridColor: "#003459", candleUp: "#00A8E8", candleDown: "#FFFFFF" }, ["#FFFFFF", "#00171F", "#003459", "#007EA7", "#00A8E8"]),
  palette("Blue Lagoon", { background: "#051923", panel: "#003554", surface: "#006494", card: "#003554", foreground: "#F5FCFF", primary: "#00A6FB", secondary: "#0582CA", muted: "#9BBECE", border: "#006494", danger: "#FFFFFF", gridColor: "#003554", candleUp: "#00A6FB", candleDown: "#FFFFFF" }, ["#00A6FB", "#0582CA", "#006494", "#003554", "#051923"]),
  palette("Sunflower Fields", { background: "#202020", panel: "#333533", surface: "#333533", card: "#333533", foreground: "#D6D6D6", primary: "#FFEE32", secondary: "#FFD100", muted: "#AFB0A5", border: "#686A5C", danger: "#D6D6D6", gridColor: "#333533", candleUp: "#FFEE32", candleDown: "#D6D6D6" }, ["#D6D6D6", "#FFEE32", "#FFD100", "#202020", "#333533"]),
  palette("Midnight Sky", { background: "#27187E", panel: "#2F2189", surface: "#3C2E98", card: "#32258C", foreground: "#F1F2F6", primary: "#FF8600", secondary: "#758BFD", accent: "#AEB8FE", muted: "#AEB8FE", border: "#6254AC", danger: "#AEB8FE", gridColor: "#3C2E98", candleUp: "#FF8600", candleDown: "#AEB8FE" }, ["#27187E", "#758BFD", "#AEB8FE", "#F1F2F6", "#FF8600"]),
  palette("Crimson Fade", { background: "#000000", panel: "#3D010E", surface: "#79021C", card: "#3D010E", foreground: "#FFF3F6", primary: "#F50538", secondary: "#B6042A", muted: "#D69DA9", border: "#B6042A", danger: "#F50538", gridColor: "#3D010E", candleUp: "#F50538", candleDown: "#FFB3C1" }, ["#F50538", "#B6042A", "#79021C", "#3D010E", "#000000"]),
  palette("Sunset Sorbet", { background: "#FBFD79", panel: "#FBD680", surface: "#FBAF87", card: "#FB878E", foreground: "#48242F", primary: "#9F244B", secondary: "#FB6095", accent: "#FB878E", muted: "#775348", border: "#C57965", danger: "#A62F4F", gridColor: "#E8BA76", candleUp: "#9F244B", candleDown: "#48242F" }, ["#FB6095", "#FB878E", "#FBAF87", "#FBD680", "#FBFD79"]),
  // Ten separate mixed-colour identities, not a hue-shifted monochrome batch.
mixedPalette("Copper Current", { background: "#071E20", panel: "#0D2A2C", surface: "#173B3D", card: "#112F31", foreground: "#F6E8DE", primary: "#FF9A52", secondary: "#38E0B8", muted: "#8DAEAC", border: "#31585A", danger: "#FF6B72", candleUp: "#38E0B8", candleDown: "#FF9A52" }),
  mixedPalette("Voltage Orchard", { background: "#160C20", panel: "#22132F", surface: "#342044", card: "#291838", foreground: "#F1F5DA", primary: "#B8F63D", secondary: "#E879F9", muted: "#AC98B7", border: "#513762", danger: "#FF637E", candleUp: "#B8F63D", candleDown: "#E879F9" }),
  mixedPalette("Glacier Ember", { background: "#081827", panel: "#102437", surface: "#1B354B", card: "#142B40", foreground: "#E9F4FA", primary: "#68D8FF", secondary: "#FF7154", muted: "#92ABBB", border: "#38566B", danger: "#FF7154", candleUp: "#68D8FF", candleDown: "#FF7154" }),
  mixedPalette("Saffron Ink", { background: "#171124", panel: "#241B35", surface: "#36294B", card: "#2B203D", foreground: "#FFF3DA", primary: "#FFC247", secondary: "#8F7AFF", muted: "#ACA0BB", border: "#57476B", danger: "#FA756C", candleUp: "#FFC247", candleDown: "#8F7AFF" }),
  mixedPalette("Racing Fern", { background: "#091B12", panel: "#112A1D", surface: "#1D3D2D", card: "#163224", foreground: "#E6F6E9", primary: "#56F095", secondary: "#FF605C", muted: "#91AD9B", border: "#355D47", danger: "#FF605C", candleUp: "#56F095", candleDown: "#FF605C" }),
  mixedPalette("Tangerine Circuit", { background: "#0B1730", panel: "#142443", surface: "#22375A", card: "#192C4C", foreground: "#F9EDDE", primary: "#FF9E2C", secondary: "#B8E44C", muted: "#9BAAC4", border: "#3F567A", danger: "#FF6289", candleUp: "#B8E44C", candleDown: "#FF9E2C" }),
  mixedPalette("Amethyst Petrol", { background: "#071C23", panel: "#0E2A34", surface: "#193D49", card: "#12313C", foreground: "#F0E9FC", primary: "#C18CFF", secondary: "#66E4DD", muted: "#96B0BC", border: "#355C6B", danger: "#F7768E", candleUp: "#66E4DD", candleDown: "#C18CFF" }),
  mixedPalette("Rose Alloy", { background: "#1D1713", panel: "#2D241F", surface: "#42362E", card: "#342A24", foreground: "#F8ECE3", primary: "#FF799B", secondary: "#92D9A5", muted: "#B8A799", border: "#665346", danger: "#FA8264", candleUp: "#92D9A5", candleDown: "#FF799B" }),
  mixedPalette("Ultraviolet Mint", { background: "#170C1C", panel: "#26132D", surface: "#3B2043", card: "#2E1835", foreground: "#F8E9F5", primary: "#FA52C5", secondary: "#4DFFBE", muted: "#B89DB5", border: "#5A3663", danger: "#FF7D76", candleUp: "#4DFFBE", candleDown: "#FA52C5" }),
  mixedPalette("Terracotta Ice", { background: "#21130F", panel: "#321F19", surface: "#493028", card: "#3A251E", foreground: "#F7EDE6", primary: "#6EBEFF", secondary: "#EF997C", muted: "#BDA294", border: "#6C4B3F", danger: "#FF746C", candleUp: "#6EBEFF", candleDown: "#EF997C" }),
  // Additional owner-requested single-family palettes. Keep prior themes intact.
  tonalPalette("Molten Copper", 24),
  tonalPalette("Amber Vault", 42),
  tonalPalette("Acid Gold", 64),
  tonalPalette("Lime Obsidian", 95),
  tonalPalette("Emerald Depths", 146),
  tonalPalette("Jade Current", 174),
  tonalPalette("Arctic Cyan", 196),
  tonalPalette("Indigo Night", 230),
  tonalPalette("Violet Noir", 270),
  tonalPalette("Magenta Ink", 314),
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
