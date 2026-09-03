import { contrastRatio, legibleOn, parseResolvedColor } from "./readableContrast.ts";

const BRAND_MARK_MINIMUM_CONTRAST = 3;

type BrandTheme = {
  background: string;
  chartBackground: string;
  primary: string;
  secondary: string;
  accent: string;
  danger: string;
  candleUp: string;
  candleDown: string;
};

function colourContrast(foreground: string, background: string) {
  const foregroundRgb = parseResolvedColor(foreground);
  const backgroundRgb = parseResolvedColor(background);
  return foregroundRgb && backgroundRgb ? contrastRatio(foregroundRgb, backgroundRgb) : 0;
}

function colourHue(value: string) {
  const rgb = parseResolvedColor(value);
  if (!rgb) return null;
  const red = rgb.r / 255;
  const green = rgb.g / 255;
  const blue = rgb.b / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const chroma = maximum - minimum;
  // Even very dark cockpit backgrounds carry deliberate hue at low absolute
  // RGB chroma (Forest Fire is only 12/255 apart). Treat only near-neutral
  // surfaces as neutral, otherwise green would incorrectly choose green ink.
  if (chroma < 0.025) return null;
  const sector = maximum === red
    ? ((green - blue) / chroma) % 6
    : maximum === green
      ? (blue - red) / chroma + 2
      : (red - green) / chroma + 4;
  return (sector * 60 + 360) % 360;
}

function hueDistance(left: number, right: number) {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}

/**
 * Resolve the bright theme signature used by every KwantDesk wordmark.
 *
 * Primary is the intended brand ink: pink on Midnight, lime on Kwant Desk,
 * green on Chromey. If that exact colour is too close to the surface, choose
 * the most contrasting exact accent/secondary/danger colour before altering a
 * hue. This keeps the mark inside the selected palette instead of washing it
 * toward neutral foreground grey.
 */
export function resolveBrandMarkColor(theme: BrandTheme, background: string) {
  const backgroundHue = colourHue(background);
  const signatures = [theme.primary, theme.accent, theme.secondary]
    .filter((colour, index, values) => colour && values.indexOf(colour) === index)
    .map((colour, priority) => ({
      colour,
      priority,
      contrast: colourContrast(colour, background),
      hue: colourHue(colour),
    }))
    .filter((candidate) => candidate.contrast >= BRAND_MARK_MINIMUM_CONTRAST);

  if (signatures.length) {
    // A coloured surface should use the OTHER bright side of its palette:
    // orange on Forest Fire's green, while a neutral black surface keeps the
    // primary pink/green/orange signature named by the theme.
    if (backgroundHue !== null) {
      signatures.sort((left, right) => {
        const leftDistance = left.hue === null ? 0 : hueDistance(left.hue, backgroundHue);
        const rightDistance = right.hue === null ? 0 : hueDistance(right.hue, backgroundHue);
        return rightDistance - leftDistance || left.priority - right.priority;
      });
    }
    return signatures[0].colour;
  }

  const candidates = [theme.danger, theme.candleUp, theme.candleDown]
    .filter((colour, index, values) => colour && values.indexOf(colour) === index)
    .map((colour) => ({ colour, contrast: colourContrast(colour, background) }))
    .sort((left, right) => right.contrast - left.contrast);
  const strongest = candidates[0];
  if (strongest && strongest.contrast >= BRAND_MARK_MINIMUM_CONTRAST) return strongest.colour;
  return legibleOn(strongest?.colour ?? theme.primary, background, BRAND_MARK_MINIMUM_CONTRAST);
}

export function brandMarkTokens(theme: BrandTheme) {
  return {
    shell: resolveBrandMarkColor(theme, theme.background),
    chart: resolveBrandMarkColor(theme, theme.chartBackground),
  };
}
