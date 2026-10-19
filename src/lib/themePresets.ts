import { defaultTheme, type ThemeColors } from "@/lib/theme";
import { legibleOn } from "./readableContrast.ts";
import { VOLUME_PROFILE_GRADIENTS, mixHexColors, type VolumeProfileGradient } from "./volumeProfileGradients.ts";

export type ThemePreset = {
  name: string;
  colors: ThemeColors;
  profileGradient?: VolumeProfileGradient;
};

type Palette = Partial<ThemeColors> & Pick<ThemeColors, "background" | "panel" | "surface" | "card" | "foreground" | "primary" | "secondary" | "muted" | "border" | "danger">;

function palette(name: string, colors: Palette, profileGradient?: VolumeProfileGradient): ThemePreset {
  return {
    name,
    ...(profileGradient ? { profileGradient } : {}),
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

/** Share the profile's actual endpoints, not a second hand-copied catalogue.
 * Keep raw candle/preview colours exact; lift only UI ink and candle outlines
 * when a very dark endpoint (black/indigo) cannot be read on a dark surface. */
function profileGradientTheme(gradient: VolumeProfileGradient): ThemePreset {
  const {from, to, label} = gradient;
  const tint = mixHexColors(from, to, .5);
  const background = mixHexColors(tint, "#000000", .96);
  const panel = mixHexColors(tint, "#000000", .93);
  const surface = mixHexColors(tint, "#000000", .87);
  const readable = (color: string) => legibleOn(color, surface, 4.5);
  return palette(label, {
    background, panel, surface, card: mixHexColors(tint, "#000000", .9),
    foreground: "#F5F7FA", muted: "#ADB5C2", border: mixHexColors(tint, "#000000", .64),
    primary: readable(to), secondary: readable(from), accent: from, danger: readable(from),
    chartBackground: background, gridColor: mixHexColors(tint, "#000000", .88),
    candleUp: to, candleDown: from,
    candleUpBorder: legibleOn(to, surface, 3), candleDownBorder: legibleOn(from, surface, 3),
  }, gradient);
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
  }, VOLUME_PROFILE_GRADIENTS.find(gradient => gradient.id === "chromey-mono")),

  ...VOLUME_PROFILE_GRADIENTS
    .filter(gradient => gradient.id !== "chromey-mono")
    .map(profileGradientTheme),

  // Deep, ink-tinted shells and saturated accents. No animated glow/filter
  // layers: contrast supplies the luminous edge without repainting charts.
  palette("Velvet Voltage", { background: "#080310", panel: "#10071D", surface: "#1B0E2C", card: "#150A24", foreground: "#F3EEFF", primary: "#C452FF", secondary: "#25E2F4", muted: "#A99BBE", border: "#39204F", danger: "#FF4975", gridColor: "#1D102D", candleUp: "#C452FF", candleDown: "#25E2F4" }),
  palette("Ruby Noir", { background: "#140309", panel: "#210810", surface: "#32121D", card: "#280D16", foreground: "#FFF0F4", primary: "#FF367C", secondary: "#FFCC26", muted: "#BE9FAB", border: "#552137", danger: "#FF5260", gridColor: "#371522", candleUp: "#FF367C", candleDown: "#FFCC26" }),
  palette("Cobalt Copper", { background: "#030B1C", panel: "#09162B", surface: "#12223C", card: "#0D1B32", foreground: "#EFF5FF", primary: "#559BFF", secondary: "#FF9C45", muted: "#9FADC5", border: "#294364", danger: "#FF5668", gridColor: "#162943", candleUp: "#559BFF", candleDown: "#FF9C45" }),
  palette("Arctic Chrome", { background: "#080B0E", panel: "#11161B", surface: "#1B232B", card: "#161D23", foreground: "#F5F8FC", primary: "#E1E6ED", secondary: "#25D6A2", muted: "#A4AFBA", border: "#35434F", danger: "#FF6271", gridColor: "#222D36", candleUp: "#E1E6ED", candleDown: "#25D6A2" }),
  palette("Tangerine Obsidian", { background: "#150B03", panel: "#221407", surface: "#33200E", card: "#2A190A", foreground: "#FFF4E9", primary: "#FFA52C", secondary: "#C0F02B", muted: "#BCA78E", border: "#53391D", danger: "#FF5B55", gridColor: "#392613", candleUp: "#FFA52C", candleDown: "#C0F02B" }),
  palette("Pine Signal", { background: "#061109", panel: "#0D1E12", surface: "#172D1B", card: "#122516", foreground: "#F0FFEC", primary: "#41E16A", secondary: "#FFD93D", muted: "#A0B49E", border: "#2C4C31", danger: "#FF6551", gridColor: "#1C3421", candleUp: "#41E16A", candleDown: "#FFD93D" }),
  palette("Signal Yellow", { background: "#111103", panel: "#1D1D08", surface: "#2B2B11", card: "#24240D", foreground: "#FFFFED", primary: "#F5ED22", secondary: "#649EFF", muted: "#B5B39B", border: "#48472A", danger: "#FF5D53", gridColor: "#323216", candleUp: "#F5ED22", candleDown: "#649EFF" }),
  palette("Abyssal Laser", { background: "#020D14", panel: "#061820", surface: "#0C252F", card: "#091E27", foreground: "#EDFCFF", primary: "#00D8F0", secondary: "#4D9AFF", muted: "#96B1BE", border: "#1B4351", danger: "#FF5E6C", gridColor: "#102C37", candleUp: "#00D8F0", candleDown: "#4D9AFF" }),
  palette("Petrol Chrome", { background: "#020D10", panel: "#06191C", surface: "#0D272A", card: "#092023", foreground: "#EDFFFA", primary: "#00E0BC", secondary: "#D2F52A", muted: "#94B4AD", border: "#1B4844", danger: "#FF5B7B", gridColor: "#102E30", candleUp: "#00E0BC", candleDown: "#D2F52A" }),
  palette("Emerald Afterhours", { background: "#020E0A", panel: "#061B14", surface: "#0C2A20", card: "#092219", foreground: "#EEFFF5", primary: "#18E68A", secondary: "#619BFF", muted: "#96B4A6", border: "#1B4C39", danger: "#FF536E", gridColor: "#102F25", candleUp: "#18E68A", candleDown: "#619BFF" }),
  palette("Copper Current", { background: "#110A07", panel: "#1F130D", surface: "#2F1F15", card: "#261910", foreground: "#FFF4EA", primary: "#EF9F57", secondary: "#13E3A1", muted: "#BAA592", border: "#513B28", danger: "#FF6552", gridColor: "#35261B", candleUp: "#13E3A1", candleDown: "#EF9F57" }),
  palette("Acid Obsidian", { background: "#0A0D03", panel: "#131A08", surface: "#20270F", card: "#19210B", foreground: "#F8FFE9", primary: "#C4F01B", secondary: "#39BEFF", muted: "#ADB695", border: "#3D4B1C", danger: "#FF526B", gridColor: "#262E13", candleUp: "#C4F01B", candleDown: "#39BEFF" }),
  palette("Black Gold", { background: "#100B03", panel: "#1C1407", surface: "#2B200E", card: "#231A0A", foreground: "#FFF7E9", primary: "#FFBD2E", secondary: "#FF7442", muted: "#BCAC91", border: "#4C391B", danger: "#FF5260", gridColor: "#302512", candleUp: "#FFBD2E", candleDown: "#FF7442" }),
  palette("Ember Noir", { background: "#150703", panel: "#240E07", surface: "#35190E", card: "#2C130A", foreground: "#FFF2E9", primary: "#FF7D37", secondary: "#29D9E9", muted: "#BEA28F", border: "#56301A", danger: "#FF5367", gridColor: "#3A1D12", candleUp: "#29D9E9", candleDown: "#FF7D37" }),
  palette("Blood Moon", { background: "#120403", panel: "#200A08", surface: "#311410", card: "#280F0C", foreground: "#FFF2EF", primary: "#FF4D42", secondary: "#ECEFF4", muted: "#BEA39D", border: "#542823", danger: "#FF4D42", gridColor: "#371914", candleUp: "#ECEFF4", candleDown: "#FF4D42" }),
  palette("Coral Carbon", { background: "#12100E", panel: "#201B17", surface: "#302720", card: "#28201B", foreground: "#FFF5EE", primary: "#FF8461", secondary: "#00D5C0", muted: "#B9AA9E", border: "#4D3E32", danger: "#FF655C", gridColor: "#362D25", candleUp: "#00D5C0", candleDown: "#FF8461" }),
  palette("Fuchsia Carbon", { background: "#10040B", panel: "#1D0A15", surface: "#2D1222", card: "#240E1B", foreground: "#FFF0F9", primary: "#FF35C9", secondary: "#21DB7C", muted: "#B79FAF", border: "#4C273F", danger: "#FF5868", gridColor: "#33172A", candleUp: "#21DB7C", candleDown: "#FF35C9" }),
  palette("Hot Pink", { background: "#16050E", panel: "#250D19", surface: "#361726", card: "#2D111F", foreground: "#FFF2F8", primary: "#FF4AA5", secondary: "#25BFFF", muted: "#BDA0AF", border: "#593044", danger: "#FF536F", gridColor: "#3C1C2D", candleUp: "#25BFFF", candleDown: "#FF4AA5" }),
  palette("Venom Carbon", { background: "#0B1103", panel: "#151E08", surface: "#222D10", card: "#1B250C", foreground: "#F6FFEA", primary: "#90F000", secondary: "#FFBD22", muted: "#ACB89A", border: "#3E5120", danger: "#FF6652", gridColor: "#283415", candleUp: "#90F000", candleDown: "#FFBD22" }),
  palette("Plasma Lagoon", { background: "#041215", panel: "#081F23", surface: "#102D30", card: "#0C2529", foreground: "#ECFFFD", primary: "#18F2DD", secondary: "#FFC04A", muted: "#9BB7B7", border: "#255052", danger: "#FF674C", gridColor: "#143336", candleUp: "#18F2DD", candleDown: "#FFC04A" }),

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
export const NEW_THEME_COUNT = themePresets.length - RETAINED_THEME_NAMES.length;
export const PROFILE_GRADIENT_THEME_NAMES = VOLUME_PROFILE_GRADIENTS.map(gradient => gradient.label);

export const DEEP_DARK_THEME_NAMES = [
  "Velvet Voltage", "Ruby Noir", "Cobalt Copper", "Arctic Chrome", "Tangerine Obsidian",
  "Pine Signal", "Signal Yellow", "Abyssal Laser", "Petrol Chrome", "Emerald Afterhours",
  "Copper Current", "Acid Obsidian", "Black Gold", "Ember Noir", "Blood Moon",
  "Coral Carbon", "Fuchsia Carbon", "Hot Pink", "Venom Carbon", "Plasma Lagoon",
] as const;
