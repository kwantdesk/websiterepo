type Rgba = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseChannel(value: string) {
  const token = value.trim();
  if (token.endsWith("%")) return clamp(Number.parseFloat(token) * 2.55, 0, 255);
  return clamp(Number.parseFloat(token), 0, 255);
}

function parseAlpha(value: string | undefined) {
  if (!value) return 1;
  const token = value.trim();
  if (token.endsWith("%")) return clamp(Number.parseFloat(token) / 100, 0, 1);
  return clamp(Number.parseFloat(token), 0, 1);
}

function parseHex(value: string): Rgba | null {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(normalized) || ![3, 4, 6, 8].includes(normalized.length)) return null;
  const expanded = normalized.length <= 4
    ? normalized.split("").map((character) => character.repeat(2)).join("")
    : normalized;
  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
    alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

function parseRgbFunction(value: string): Rgba | null {
  const match = value.trim().match(/^rgba?\((.*)\)$/i);
  if (!match) return null;
  const [channelsText, slashAlpha] = match[1].split(/\s*\/\s*/);
  const parts = channelsText.includes(",")
    ? channelsText.split(",").map((part) => part.trim())
    : channelsText.trim().split(/\s+/);
  if (parts.length < 3 || parts.length > 4) return null;
  const channels = parts.slice(0, 3).map(parseChannel);
  if (channels.some((channel) => !Number.isFinite(channel))) return null;
  const alpha = parseAlpha(slashAlpha ?? parts[3]);
  if (!Number.isFinite(alpha)) return null;
  return { red: channels[0], green: channels[1], blue: channels[2], alpha };
}

function parseSrgbFunction(value: string): Rgba | null {
  const match = value.trim().match(/^color\(srgb\s+(.+)\)$/i);
  if (!match) return null;
  const [channelsText, alphaText] = match[1].split(/\s*\/\s*/);
  const channels = channelsText.trim().split(/\s+/).map((part) => clamp(Number.parseFloat(part) * 255, 0, 255));
  if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) return null;
  const alpha = parseAlpha(alphaText);
  if (!Number.isFinite(alpha)) return null;
  return { red: channels[0], green: channels[1], blue: channels[2], alpha };
}

function parseColor(value: string): Rgba | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === "transparent") return { red: 0, green: 0, blue: 0, alpha: 0 };
  return parseHex(normalized) ?? parseRgbFunction(normalized) ?? parseSrgbFunction(normalized);
}

function toHex(color: Rgba) {
  const channel = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0").toUpperCase();
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const backgroundAlpha = background.alpha * (1 - foreground.alpha);
  const alpha = foreground.alpha + backgroundAlpha;
  if (alpha <= 0) return { red: 0, green: 0, blue: 0, alpha: 1 };
  return {
    red: (foreground.red * foreground.alpha + background.red * backgroundAlpha) / alpha,
    green: (foreground.green * foreground.alpha + background.green * backgroundAlpha) / alpha,
    blue: (foreground.blue * foreground.alpha + background.blue * backgroundAlpha) / alpha,
    alpha: 1,
  };
}

/**
 * Converts CSS colour text into the opaque RGB colour that is actually visible
 * on the KwantDesk chart background. Export targets use different colour APIs,
 * so a canonical #RRGGBB value prevents them silently falling back to white.
 */
export function normalizeLevelExportColor(
  value: string,
  background = "#020304",
  fallback = "#FFFFFF",
) {
  const fallbackColor = parseColor(fallback) ?? { red: 255, green: 255, blue: 255, alpha: 1 };
  const backgroundColor = parseColor(background) ?? { red: 2, green: 3, blue: 4, alpha: 1 };
  const foregroundColor = parseColor(value) ?? fallbackColor;
  return toHex(composite(foregroundColor, backgroundColor));
}

function computedCssColor(value: string, documentRef: Document) {
  const host = documentRef.body ?? documentRef.documentElement;
  const view = documentRef.defaultView;
  if (!host || !view) return null;
  const probe = documentRef.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none";
  probe.style.color = value;
  if (!probe.style.color) return null;
  host.appendChild(probe);
  const resolved = view.getComputedStyle(probe).color;
  probe.remove();
  return resolved || null;
}

/** Resolve var(), color-mix(), rgb()/rgba() and theme colours in the browser. */
export function resolveLevelExportColor(
  value: string,
  background = "#020304",
  documentRef: Document | null = typeof document === "undefined" ? null : document,
) {
  if (!documentRef) return normalizeLevelExportColor(value, background);
  const resolvedForeground = computedCssColor(value, documentRef) ?? value;
  const resolvedBackground = computedCssColor(background, documentRef) ?? background;
  return normalizeLevelExportColor(resolvedForeground, resolvedBackground);
}
