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

/**
 * The first three palettes are the retained KwantDesk originals. Everything
 * after them is a deliberately distinct colour system rather than an accent
 * swap on the same black shell.
 */
export const themePresets: ThemePreset[] = [
  palette("Midnight Cockpit", { background: "#020304", panel: "#050607", surface: "#0B0D10", card: "#07090B", foreground: "#DDE2E7", primary: "#FF1F78", secondary: "#16C7CE", accent: "#16C7CE", muted: "#707780", border: "#24282D", danger: "#FF1F78", chartBackground: "#020304", gridColor: "#11151A", crosshairColor: "rgba(255,31,120,.72)", candleUp: "#16C7CE", candleDown: "#FF1F78" }),
  palette("Kwant Desk", { background: "#000000", panel: "#050506", surface: "#0B0C0E", card: "#07080A", foreground: "#FFFFFF", primary: "#B6FF00", secondary: "#4361FF", accent: "#4361FF", muted: "#7F858D", border: "#1A1D22", danger: "#4361FF", chartBackground: "#000000", gridColor: "#111318", crosshairColor: "rgba(182,255,0,.78)", candleUp: "#B6FF00", candleDown: "#FFFFFF" }),
  palette("Mr. Quant", { background: "#000000", panel: "#050914", surface: "#0B1530", card: "#070D1D", foreground: "#F7FAFF", primary: "#47B7FF", secondary: "#91B9FF", accent: "#2E9FEA", muted: "#7E91B6", border: "#18315A", danger: "#FF4D67", chartBackground: "#000000", gridColor: "#0B172B", crosshairColor: "rgba(71,183,255,.78)", candleUp: "#47B7FF", candleDown: "#F7FAFF" }),

  /*
   * The DeepChart look, matched from the owner's own terminal.
   *
   * Pure black with a single high-voltage green doing the work and red only for
   * what went the other way: the point of it is that a profile row, a level and
   * a candle are all the same green, so the eye reads STRUCTURE rather than
   * decoration. The greys are chrome - moving averages and axes - and the olive
   * is reserved for the horizontal levels, which is what keeps them legible
   * against the green without adding another accent.
   *
   * candleDown is deliberately the same red as danger rather than white. On a
   * black shell a white down-candle reads as neutral, and this palette wants
   * direction to be unmistakable at a glance.
   */
  palette("Chromey Mono", {
    background: "#000000", panel: "#040504", surface: "#0A0C0A", card: "#060806",
    foreground: "#DCE4DC", primary: "#00FF00", secondary: "#8C8C8C", accent: "#9A9A3D",
    muted: "#6F7A6F", border: "#161A16", danger: "#C11414",
    chartBackground: "#000000", gridColor: "#0E120E",
    crosshairColor: "rgba(0,255,0,.7)",
    /*
     * Bullish is the green, solid. Bearish is a HOLLOW candle - a black body
     * the colour of the chart, outlined and wicked in light grey - which is
     * what makes a down bar read as an absence rather than as another colour
     * competing with the green.
     *
     * The red is not a candle colour here. It belongs to the level bars, and
     * `danger` is where it lives.
     */
    candleUp: "#00FF00", candleUpBorder: "#00FF00",
    candleDown: "#000000", candleDownBorder: "#B9C0B9",
  }),

  palette("Solar Flare", { background: "#100702", panel: "#1B0C03", surface: "#2D1507", card: "#241005", foreground: "#FFF4E6", primary: "#FF8A00", secondary: "#36C5F0", muted: "#B48C70", border: "#5A2C0C", danger: "#28A8E0", gridColor: "#351A09" }),
  palette("Playdough Parade", { background: "#FFF4D8", panel: "#FFF9E9", surface: "#FFD166", card: "#FFE7A3", foreground: "#25213B", primary: "#F77F00", secondary: "#4D96FF", muted: "#786C69", border: "#E7BE68", danger: "#9B5DE5", gridColor: "#EAD9B5" }),
  palette("Tangerine Terminal", { background: "#061412", panel: "#0A201C", surface: "#10332C", card: "#0C2924", foreground: "#E9FFF8", primary: "#FF9F1C", secondary: "#2EC4B6", muted: "#79A49A", border: "#21584C", danger: "#FF5D3A", gridColor: "#163D35" }),
  palette("Desert Highway", { background: "#24150C", panel: "#332015", surface: "#4A3020", card: "#3C261A", foreground: "#FFF1D6", primary: "#E76F51", secondary: "#2A9D8F", muted: "#B19780", border: "#6A432D", danger: "#5BC0BE", gridColor: "#432B1D" }),
  palette("Citrus Circuit", { background: "#171205", panel: "#241C07", surface: "#382B08", card: "#2D2207", foreground: "#FFF8D1", primary: "#FFB000", secondary: "#665CFF", muted: "#A89C6E", border: "#554411", danger: "#8A7CFF", gridColor: "#362B0B" }),
  palette("Mango Static", { background: "#170B22", panel: "#231131", surface: "#371B4B", card: "#2C153D", foreground: "#FFF1D6", primary: "#FFB627", secondary: "#9B5DE5", muted: "#A18AAE", border: "#56316B", danger: "#F15BB5", gridColor: "#351D42" }),
  palette("Papaya Punch", { background: "#11202C", panel: "#182E3C", surface: "#244358", card: "#1D3748", foreground: "#FFF5ED", primary: "#FF7F51", secondary: "#4EA8DE", muted: "#91A6B3", border: "#315A73", danger: "#E63946", gridColor: "#233F51" }),
  palette("Copper Verdigris", { background: "#111B19", panel: "#182724", surface: "#253B36", card: "#1D302C", foreground: "#F5EFE6", primary: "#C97B49", secondary: "#52B69A", muted: "#88A098", border: "#36534C", danger: "#E05D4F", gridColor: "#263B36" }),
  palette("Lava Lamp", { background: "#180A18", panel: "#271027", surface: "#3C173B", card: "#311330", foreground: "#FFF1F8", primary: "#FF6D00", secondary: "#C77DFF", muted: "#AA88A5", border: "#5B2458", danger: "#FF3D68", gridColor: "#381635" }),
  palette("Creamsicle OS", { background: "#FFF7ED", panel: "#FFFCF7", surface: "#FFE2C2", card: "#FFF0DE", foreground: "#30251F", primary: "#F97316", secondary: "#0284C7", muted: "#88766B", border: "#EBC7A6", danger: "#DC4C64", gridColor: "#EDE1D4" }),

  palette("Arctic Signal", { background: "#03151D", panel: "#06232E", surface: "#0B3544", card: "#082B38", foreground: "#E8FBFF", primary: "#00D9FF", secondary: "#FF595E", muted: "#759DA8", border: "#145467", danger: "#FF595E", gridColor: "#0D3B4A" }),
  palette("Glacier Ink", { background: "#EAF7FF", panel: "#F7FCFF", surface: "#C9E9F6", card: "#DDF2FA", foreground: "#102536", primary: "#0077B6", secondary: "#7B2CBF", muted: "#607B8B", border: "#A8D3E5", danger: "#D1495B", gridColor: "#C6DFEA" }),
  palette("Deep Sea Sonar", { background: "#00141F", panel: "#002131", surface: "#003449", card: "#00293C", foreground: "#E7F9FF", primary: "#00B4D8", secondary: "#FFD60A", muted: "#6A96A5", border: "#07536A", danger: "#FF6B35", gridColor: "#063C4D" }),
  palette("Tidepool Glass", { background: "#E8FFF9", panel: "#F7FFFD", surface: "#B8EFE1", card: "#D5F8EF", foreground: "#14332F", primary: "#00897B", secondary: "#FF6B6B", muted: "#688B84", border: "#9ED8CA", danger: "#D94F70", gridColor: "#C3E9E0" }),
  palette("Petrol Rainbow", { background: "#071816", panel: "#0B2622", surface: "#123A34", card: "#0E2F2A", foreground: "#F1FFF9", primary: "#00A896", secondary: "#FFCA3A", muted: "#719B92", border: "#1D584E", danger: "#FF595E", gridColor: "#143F38" }),
  palette("Cobalt Clay", { background: "#171A2B", panel: "#22263B", surface: "#323852", card: "#292E47", foreground: "#F6F1EB", primary: "#4361EE", secondary: "#D97757", muted: "#9195AA", border: "#474E70", danger: "#E76F51", gridColor: "#30364F" }),
  palette("Blue Porcelain", { background: "#F3F7FF", panel: "#FFFFFF", surface: "#DDE8FF", card: "#EAF0FF", foreground: "#17223B", primary: "#3157C8", secondary: "#C65D35", muted: "#69758E", border: "#C5D2EE", danger: "#B94747", gridColor: "#DCE4F4" }),
  palette("Electric Lemon", { background: "#101128", panel: "#191B3D", surface: "#272A58", card: "#20234A", foreground: "#FCFFD9", primary: "#E9FF00", secondary: "#536DFE", muted: "#9095AA", border: "#3E4378", danger: "#FF477E", gridColor: "#292D54" }),

  palette("Acid Grape", { background: "#160E22", panel: "#221532", surface: "#361F4B", card: "#2B193E", foreground: "#F7FFE8", primary: "#A7F432", secondary: "#8B5CF6", muted: "#9A88AA", border: "#51306B", danger: "#F43F5E", gridColor: "#321E45" }),
  palette("Matcha Plum", { background: "#F5F4E8", panel: "#FCFBF4", surface: "#DFE3B6", card: "#ECECCF", foreground: "#332638", primary: "#718355", secondary: "#7A4E76", muted: "#7D7870", border: "#CED0A8", danger: "#A63D57", gridColor: "#E0E0C8" }),
  palette("Forest Fire", { background: "#0E1A12", panel: "#16271B", surface: "#243D2A", card: "#1B3021", foreground: "#F3F4DB", primary: "#76B041", secondary: "#F28C28", muted: "#82937D", border: "#36563D", danger: "#E4572E", gridColor: "#253B2A" }),
  palette("Moss & Mineral", { background: "#EDF1E4", panel: "#F8FAF3", surface: "#CDD8BB", card: "#DFE6D2", foreground: "#24302C", primary: "#627C45", secondary: "#3A86A8", muted: "#6F7C72", border: "#BAC8AA", danger: "#B5544D", gridColor: "#D6DECE" }),
  palette("Alpine Rescue", { background: "#102019", panel: "#182E24", surface: "#244436", card: "#1D372B", foreground: "#FFFBEA", primary: "#4CAF50", secondary: "#F4E285", muted: "#80988B", border: "#35624D", danger: "#E63946", gridColor: "#264536" }),
  palette("Orchid Voltage", { background: "#1A1024", panel: "#281737", surface: "#3D2352", card: "#321C43", foreground: "#FFF8D8", primary: "#B56BFF", secondary: "#FFE45E", muted: "#A08DAA", border: "#593372", danger: "#FF5D8F", gridColor: "#392149" }),
  palette("Ultraviolet Ice", { background: "#120F28", panel: "#1B183A", surface: "#2A2558", card: "#211E49", foreground: "#F1FBFF", primary: "#7B61FF", secondary: "#5CE1E6", muted: "#8587A8", border: "#403A7B", danger: "#FF6B8A", gridColor: "#2C2853" }),
  palette("Aubergine Mint", { background: "#1C101B", panel: "#2A1829", surface: "#40243E", card: "#341D32", foreground: "#F4FFF9", primary: "#C3FBD8", secondary: "#845EC2", muted: "#A08D9D", border: "#5D3659", danger: "#FF6F91", gridColor: "#3B233A", candleUp: "#78D6B0" }),
  palette("Lilac Asphalt", { background: "#17171B", panel: "#222228", surface: "#33333C", card: "#292930", foreground: "#F8F4FF", primary: "#C8A2FF", secondary: "#FF9F43", muted: "#92909A", border: "#484852", danger: "#FF5C77", gridColor: "#303038" }),

  palette("Cherry Soda", { background: "#21090F", panel: "#311019", surface: "#481824", card: "#3A131D", foreground: "#FFF0F2", primary: "#F72545", secondary: "#4CC9F0", muted: "#A98289", border: "#682437", danger: "#FF4D6D", gridColor: "#421722" }),
  palette("Vermilion Sky", { background: "#EEF7FC", panel: "#FBFDFE", surface: "#D3EAF5", card: "#E2F1F8", foreground: "#26313A", primary: "#E34234", secondary: "#3A86C8", muted: "#71818C", border: "#BDD8E5", danger: "#A8203A", gridColor: "#D6E6ED" }),
  palette("Brick & Butter", { background: "#FFF6D8", panel: "#FFFBEC", surface: "#F3D98B", card: "#F9E8B4", foreground: "#3B2B26", primary: "#B5482E", secondary: "#E0A800", muted: "#8B7668", border: "#DFC880", danger: "#8F2440", gridColor: "#EBDEB4" }),
  palette("Sakura Slate", { background: "#20242D", panel: "#2B303B", surface: "#3E4654", card: "#343A46", foreground: "#FFF4F6", primary: "#F2A7B5", secondary: "#7FA9C9", muted: "#9AA2AE", border: "#566170", danger: "#D95D75", gridColor: "#39414D" }),
  palette("Bubblegum Blueprint", { background: "#F4F7FF", panel: "#FFFFFF", surface: "#DDE7FF", card: "#EAF0FF", foreground: "#242844", primary: "#FF70A6", secondary: "#3A6FF7", muted: "#747B94", border: "#C6D4F2", danger: "#D7396E", gridColor: "#DCE4F4" }),
  palette("Chocolate Mint", { background: "#1D1511", panel: "#2A1F19", surface: "#403027", card: "#34261F", foreground: "#F1FFF8", primary: "#76D7B1", secondary: "#C18A5D", muted: "#9A897E", border: "#5B4335", danger: "#E66B62", gridColor: "#3B2C24" }),
  palette("Espresso Tangerine", { background: "#170F0A", panel: "#231711", surface: "#36241B", card: "#2C1D16", foreground: "#FFF3E8", primary: "#FF8C42", secondary: "#8AC926", muted: "#9A8171", border: "#513629", danger: "#FF595E", gridColor: "#322219" }),
  palette("Sandstorm", { background: "#E9D8B4", panel: "#F2E6CB", surface: "#D3B98B", card: "#E2CDA6", foreground: "#27231D", primary: "#8A5A2B", secondary: "#176B87", muted: "#766A58", border: "#C4A77B", danger: "#A33B35", gridColor: "#D8C6A3" }),

  palette("Paper & Ink", { background: "#F5F2E9", panel: "#FFFEFA", surface: "#E5E0D4", card: "#EFEADF", foreground: "#15171A", primary: "#1D3557", secondary: "#D97706", muted: "#6F6C66", border: "#CEC8BA", danger: "#B42318", gridColor: "#DED8CB" }),
  palette("Mono Protocol", { background: "#000000", panel: "#080808", surface: "#151515", card: "#0E0E0E", foreground: "#FFFFFF", primary: "#FFFFFF", secondary: "#9A9A9A", muted: "#777777", border: "#333333", danger: "#6B6B6B", gridColor: "#1F1F1F", candleUp: "#FFFFFF", candleDown: "#737373", crosshairColor: "rgba(255,255,255,.72)" }),
  palette("Inverted Mono", { background: "#F7F7F5", panel: "#FFFFFF", surface: "#E6E6E2", card: "#EFEFED", foreground: "#080808", primary: "#111111", secondary: "#777777", muted: "#666666", border: "#C9C9C4", danger: "#555555", gridColor: "#DADAD5", candleUp: "#111111", candleDown: "#8A8A8A", crosshairColor: "rgba(0,0,0,.58)" }),
  palette("Safety Vest", { background: "#17170A", panel: "#242410", surface: "#383817", card: "#2D2D12", foreground: "#FFFFE7", primary: "#FFF200", secondary: "#00A6FB", muted: "#A6A46C", border: "#55551F", danger: "#FF3B30", gridColor: "#363616" }),
  palette("Retro Terminal", { background: "#071007", panel: "#0C1A0C", surface: "#132A13", card: "#102110", foreground: "#DFFFCF", primary: "#52FF52", secondary: "#FFB000", muted: "#6D946D", border: "#245024", danger: "#FF6B35", gridColor: "#193819", crosshairColor: "rgba(82,255,82,.66)" }),
];

export const RETAINED_THEME_NAMES = ["Midnight Cockpit", "Kwant Desk", "Mr. Quant"] as const;
export const NEW_THEME_COUNT = 41;
