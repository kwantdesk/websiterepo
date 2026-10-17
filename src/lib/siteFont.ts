export const SITE_FONT_FAMILY = "Aleph, sans-serif";

/** Repaint saved drawing text in the site face without changing its metrics settings. */
export function siteCanvasFont(font: string | undefined): string {
  if (!font) return `12px ${SITE_FONT_FAMILY}`;
  return font.replace(/((?:\d+(?:\.\d+)?)(?:px|pt|em|rem|%)(?:\/[^\s]+)?\s+).+$/, `$1${SITE_FONT_FAMILY}`);
}
