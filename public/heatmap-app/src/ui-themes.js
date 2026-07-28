export const WEBSITE_THEME_STORAGE_KEY = 'olisa-theme';
export const DEFAULT_UI_THEME = 'kwantify';

const WEBSITE_DEFAULTS = Object.freeze({
  background: '#09090b',
  foreground: '#fafafa',
  primary: '#00f5a0',
  secondary: '#6366f1',
  accent: '#8b5cf6',
  muted: '#71717a',
  border: '#27272a',
  card: '#0f0f12',
  danger: '#ef4444',
  panel: '#0c0c0e',
  surface: '#18181b',
  chartBackground: '#0a0a0b',
  gridColor: '#1a1a1d',
  candleUp: '#00f5a0',
  candleDown: '#ef4444',
});

export const UI_THEMES = Object.freeze([
  Object.freeze({
    id: DEFAULT_UI_THEME,
    name: 'Website theme',
    code: 'SYNC',
    description: 'Linked to the appearance selected in Kwantify Settings.',
  }),
]);

function color(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function rgb(value, fallback = [0, 0, 0]) {
  const input = String(value || '').trim();
  const shortHex = input.match(/^#([\da-f])([\da-f])([\da-f])$/i);
  if (shortHex) return shortHex.slice(1).map(part => parseInt(part + part, 16));
  const hexValue = input.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hexValue) return hexValue.slice(1).map(part => parseInt(part, 16));
  const functional = input.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (functional) return functional.slice(1, 4).map(part => Math.max(0, Math.min(255, Math.round(Number(part)))));
  return fallback;
}

function hex(parts) {
  return `#${parts.map(part => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
}

function mix(from, to, amount) {
  const start = rgb(from);
  const end = rgb(to, start);
  return hex(start.map((part, index) => part + (end[index] - part) * amount));
}

export function websiteThemeColors() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(WEBSITE_THEME_STORAGE_KEY) || 'null'); }
  catch { saved = null; }
  const source = saved && typeof saved === 'object' ? saved : {};
  return Object.fromEntries(
    Object.entries(WEBSITE_DEFAULTS).map(([key, fallback]) => [key, color(source[key], fallback)]),
  );
}

function websiteUiTheme() {
  const site = websiteThemeColors();
  const primaryRgb = rgb(site.primary, [0, 245, 160]);
  const dangerRgb = rgb(site.danger, [239, 68, 68]);
  const borderRgb = rgb(site.border, [39, 39, 42]);
  const axisText = mix(site.muted, site.foreground, .32);

  return {
    id: DEFAULT_UI_THEME,
    name: 'Website theme',
    code: 'SYNC',
    description: 'Linked to the appearance selected in Kwantify Settings.',
    css: {
      '--ui-bg': site.background,
      '--ui-chrome': site.panel,
      '--ui-panel': site.panel,
      '--ui-panel-alt': site.card,
      '--ui-surface': site.surface,
      '--ui-line': site.border,
      '--ui-line-strong': mix(site.border, site.foreground, .14),
      '--ui-text': site.foreground,
      '--ui-muted': site.muted,
      '--ui-accent': site.primary,
      '--ui-accent-alt': site.secondary,
      '--ui-danger': site.danger,
      '--ui-warn': '#eab308',
      '--ui-accent-rgb': primaryRgb.join(', '),
      '--ui-danger-rgb': dangerRgb.join(', '),
      '--font-ui': '"Inter", system-ui, -apple-system, sans-serif',
      '--font-mono': '"JetBrains Mono", monospace',
    },
    canvas: {
      axis: site.chartBackground,
      axisAlt: site.panel,
      text: axisText,
      muted: site.muted,
      grid: rgb(site.gridColor, borderRgb).join(','),
    },
  };
}

export function normalizeUiTheme() {
  return DEFAULT_UI_THEME;
}

export function uiTheme() {
  return websiteUiTheme();
}

export function applyUiTheme(_value, root = document.documentElement) {
  const theme = websiteUiTheme();
  root.dataset.uiTheme = theme.id;
  for (const [property, value] of Object.entries(theme.css)) root.style.setProperty(property, value);
  return theme;
}

export function canvasUiTheme() {
  return websiteUiTheme().canvas;
}
