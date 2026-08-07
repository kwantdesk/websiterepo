import { websiteThemeColors } from './ui-themes.js';

export const DEFAULT_PALETTE = 'auto';

const BOOKMAP_LANDMARKS = Object.freeze([0, 0.18, 0.422422, 0.624625, 0.722723, 0.877878, 1]);
const atLandmarks = colors => colors.map((color, index) => [BOOKMAP_LANDMARKS[index], color]);

export const PALETTES = Object.freeze({
  kwantify: atLandmarks([
    [5, 7, 7], [5, 20, 16], [4, 50, 37], [0, 106, 75],
    [0, 174, 116], [0, 245, 160], [190, 255, 231],
  ]),
  liquid: atLandmarks([
    [8, 8, 14], [10, 24, 54], [10, 84, 170], [10, 132, 255],
    [100, 210, 255], [242, 242, 247], [255, 159, 10],
  ]),
  thermal: [
    [0.000000, [26, 34, 38]], [0.422422, [0, 140, 204]],
    [0.722723, [237, 237, 237]], [0.877878, [255, 255, 0]],
    [1.000000, [255, 155, 0]],
  ],
  bookmap2: [
    [0.000000, [26, 34, 38]], [0.450450, [0, 140, 204]],
    [0.624625, [237, 237, 237]], [0.768769, [255, 255, 0]],
    [0.877878, [255, 155, 0]], [0.958959, [255, 0, 0]],
    [1.000000, [150, 0, 0]],
  ],
  ember: [
    [0.00, [3, 3, 5]], [0.18, [32, 8, 17]], [0.38, [92, 20, 25]],
    [0.57, [177, 47, 27]], [0.76, [239, 112, 33]], [0.90, [255, 202, 91]],
    [1.00, [255, 249, 220]],
  ],
  ocean: [
    [0.00, [2, 5, 10]], [0.18, [5, 19, 49]], [0.38, [8, 54, 111]],
    [0.58, [10, 116, 164]], [0.76, [22, 190, 192]], [0.90, [142, 235, 215]],
    [1.00, [241, 255, 251]],
  ],
  mono: [
    [0.00, [3, 5, 7]], [0.25, [24, 31, 39]], [0.50, [70, 82, 95]],
    [0.75, [146, 160, 174]], [1.00, [239, 245, 250]],
  ],
  aurora: atLandmarks([
    [5, 8, 18], [15, 20, 58], [63, 48, 150], [0, 157, 196],
    [83, 230, 180], [220, 255, 117], [255, 255, 235],
  ]),
  magma: atLandmarks([
    [7, 4, 13], [35, 9, 49], [92, 16, 92], [177, 37, 105],
    [236, 82, 69], [252, 170, 51], [255, 246, 185],
  ]),
  viridis: atLandmarks([
    [5, 8, 17], [18, 33, 70], [38, 82, 115], [31, 139, 132],
    [73, 185, 110], [181, 222, 43], [253, 247, 115],
  ]),
  plasma: atLandmarks([
    [8, 4, 22], [43, 6, 98], [99, 18, 161], [169, 42, 151],
    [224, 81, 99], [250, 159, 58], [245, 249, 132],
  ]),
  arctic: atLandmarks([
    [3, 8, 17], [7, 29, 61], [16, 77, 120], [25, 148, 176],
    [103, 215, 226], [213, 249, 255], [255, 255, 255],
  ]),
  limefire: atLandmarks([
    [3, 7, 4], [10, 31, 12], [22, 82, 25], [57, 151, 33],
    [137, 211, 36], [237, 242, 65], [255, 255, 226],
  ]),
  purplegold: atLandmarks([
    [9, 5, 16], [34, 13, 57], [87, 31, 121], [154, 62, 142],
    [222, 112, 89], [250, 190, 52], [255, 249, 210],
  ]),
  copper: atLandmarks([
    [8, 6, 5], [35, 19, 13], [83, 42, 24], [145, 73, 35],
    [202, 118, 53], [244, 183, 92], [255, 244, 204],
  ]),
  icefire: atLandmarks([
    [4, 8, 20], [10, 37, 92], [27, 102, 170], [83, 190, 220],
    [236, 247, 245], [255, 188, 64], [232, 49, 36],
  ]),
  neon: atLandmarks([
    [3, 4, 12], [17, 16, 60], [31, 52, 159], [0, 174, 216],
    [211, 35, 205], [255, 224, 37], [255, 255, 245],
  ]),
});

// Every heat palette carries a two-sided accent pair. Bid/buy uses `bid` and
// ask/sell uses `ask`, so the market-side encoding stays consistent while the
// complete chart changes theme as one unit.
export const PALETTE_ACCENTS = Object.freeze({
  kwantify: Object.freeze({ bid: [0, 245, 160], ask: [239, 68, 68] }),
  liquid: Object.freeze({ bid: [100, 210, 255], ask: [255, 159, 10] }),
  thermal: Object.freeze({ bid: [0, 190, 230], ask: [255, 125, 0] }),
  bookmap2: Object.freeze({ bid: [0, 190, 225], ask: [255, 50, 38] }),
  ember: Object.freeze({ bid: [255, 202, 91], ask: [210, 45, 82] }),
  ocean: Object.freeze({ bid: [35, 220, 205], ask: [76, 125, 245] }),
  mono: Object.freeze({ bid: [239, 245, 250], ask: [125, 142, 160] }),
  aurora: Object.freeze({ bid: [83, 230, 180], ask: [157, 88, 245] }),
  magma: Object.freeze({ bid: [252, 170, 51], ask: [220, 55, 100] }),
  viridis: Object.freeze({ bid: [181, 222, 43], ask: [31, 139, 132] }),
  plasma: Object.freeze({ bid: [250, 159, 58], ask: [190, 55, 150] }),
  arctic: Object.freeze({ bid: [103, 215, 226], ask: [95, 145, 250] }),
  limefire: Object.freeze({ bid: [211, 235, 50], ask: [255, 142, 38] }),
  purplegold: Object.freeze({ bid: [250, 190, 52], ask: [166, 72, 160] }),
  copper: Object.freeze({ bid: [244, 183, 92], ask: [181, 80, 42] }),
  icefire: Object.freeze({ bid: [83, 190, 220], ask: [232, 49, 36] }),
  neon: Object.freeze({ bid: [0, 205, 225], ask: [211, 35, 205] }),
});

export const NEW_PALETTE_NAMES = Object.freeze([
  'aurora', 'magma', 'viridis', 'plasma', 'arctic',
  'limefire', 'purplegold', 'copper', 'icefire', 'neon',
]);

function rgb(value, fallback = [0, 0, 0]) {
  const input = String(value || '').trim();
  const shortHex = input.match(/^#([\da-f])([\da-f])([\da-f])$/i);
  if (shortHex) return shortHex.slice(1).map(part => parseInt(part + part, 16));
  const hexValue = input.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hexValue) return hexValue.slice(1).map(part => parseInt(part, 16));
  const functional = input.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (functional) {
    return functional
      .slice(1, 4)
      .map(part => Math.max(0, Math.min(255, Math.round(Number(part)))));
  }
  return fallback;
}

function mix(from, to, amount) {
  return from.map((part, index) => Math.round(part + (to[index] - part) * amount));
}

function automaticThemePalette() {
  const site = websiteThemeColors();
  const background = rgb(site.chartBackground || site.background, [10, 10, 11]);
  const primary = rgb(site.primary, [0, 245, 160]);
  const secondary = rgb(site.secondary, primary);
  const accent = rgb(site.accent, secondary);
  const foreground = rgb(site.foreground, [250, 250, 250]);
  return atLandmarks([
    background,
    mix(background, primary, .18),
    mix(background, primary, .42),
    mix(primary, secondary, .18),
    mix(primary, accent, .42),
    mix(secondary, accent, .58),
    mix(accent, foreground, .72),
  ]);
}

function automaticThemeSignature() {
  const site = websiteThemeColors();
  return [
    site.chartBackground,
    site.background,
    site.foreground,
    site.primary,
    site.secondary,
    site.accent,
    site.danger,
    site.candleUp,
    site.candleDown,
  ].join('|');
}

let automaticPaletteCache = { signature: '', lut: null };

export function createPalette(stops) {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let index = 0; index < 256; index += 1) {
    const value = index / 255;
    let low = stops[0];
    let high = stops[stops.length - 1];
    for (let stop = 0; stop < stops.length - 1; stop += 1) {
      if (value >= stops[stop][0] && value <= stops[stop + 1][0]) {
        low = stops[stop];
        high = stops[stop + 1];
        break;
      }
    }
    const mix = high[0] === low[0] ? 0 : (value - low[0]) / (high[0] - low[0]);
    for (let channel = 0; channel < 3; channel += 1) {
      lut[index * 3 + channel] = low[1][channel] + (high[1][channel] - low[1][channel]) * mix;
    }
  }
  return lut;
}

export const PALETTE_LUTS = Object.freeze(Object.fromEntries(
  Object.entries(PALETTES).map(([name, stops]) => [name, createPalette(stops)]),
));

export function paletteAccents(name) {
  if (name === DEFAULT_PALETTE) {
    const site = websiteThemeColors();
    return {
      bid: rgb(site.candleUp || site.primary, [0, 245, 160]),
      ask: rgb(site.candleDown || site.danger, [239, 68, 68]),
    };
  }
  return PALETTE_ACCENTS[name] || PALETTE_ACCENTS.kwantify;
}

export function paletteRenderKey(name) {
  return name === DEFAULT_PALETTE
    ? `${DEFAULT_PALETTE}:${automaticThemeSignature()}`
    : name;
}

export function paletteLut(name) {
  if (name !== DEFAULT_PALETTE) return PALETTE_LUTS[name] || PALETTE_LUTS.kwantify;
  const signature = automaticThemeSignature();
  if (automaticPaletteCache.signature !== signature || !automaticPaletteCache.lut) {
    automaticPaletteCache = {
      signature,
      lut: createPalette(automaticThemePalette()),
    };
  }
  return automaticPaletteCache.lut;
}

export function paletteCssGradient(name) {
  const stops = name === DEFAULT_PALETTE
    ? automaticThemePalette()
    : PALETTES[name] || PALETTES.kwantify;
  return `linear-gradient(90deg, ${stops.map(([position, [red, green, blue]]) => (
    `rgb(${red}, ${green}, ${blue}) ${(position * 100).toFixed(1)}%`
  )).join(', ')})`;
}
