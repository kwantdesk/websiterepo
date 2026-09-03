import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { themePresets } from "../src/lib/themePresets.ts";

const globals = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const calendar = await readFile(
  new URL("../src/components/gex-cal/GexCalendarMatrix.tsx", import.meta.url),
  "utf8",
);

function hexRgb(value) {
  assert.match(value, /^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

function mix(first, firstWeight, second) {
  const firstRgb = hexRgb(first);
  const secondRgb = hexRgb(second);
  return firstRgb.map((channel, index) => (
    Math.round(channel * firstWeight + secondRgb[index] * (1 - firstWeight))
  ));
}

function luminance(rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

test("scrollbar colours derive from the active theme", () => {
  assert.match(globals, /--scrollbar-track:\s*color-mix\([^;]*var\(--panel\)[^;]*var\(--background\)[^;]*\);/);
  assert.match(globals, /--scrollbar-thumb:\s*color-mix\([^;]*var\(--muted\)[^;]*var\(--surface\)[^;]*\);/);
  assert.match(globals, /--scrollbar-thumb-hover:\s*color-mix\([^;]*var\(--primary\)[^;]*var\(--muted\)[^;]*\);/);
  assert.match(globals, /scrollbar-color:\s*var\(--scrollbar-thumb\)\s+var\(--scrollbar-track\);/);

  assert.doesNotMatch(globals, /scrollbar-color:\s*#363A45\s+#131722/i);
  assert.doesNotMatch(globals, /::-webkit-scrollbar-track\s*\{[^}]*background:\s*#030405/is);
  assert.doesNotMatch(globals, /::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*#343a41/is);
});

test("cockpit scrollbars share smooth geometry without native arrow blocks", () => {
  assert.match(globals, /\n::-webkit-scrollbar-thumb\s*\{[^}]*border-radius:\s*999px;/s);
  assert.match(globals, /\n::-webkit-scrollbar-button\s*\{[^}]*display:\s*none;[^}]*width:\s*0;[^}]*height:\s*0;/s);
  assert.match(globals, /\n::-webkit-scrollbar-corner\s*\{[^}]*background:\s*var\(--scrollbar-track\);/s);
});

test("feature surfaces inherit the shared scrollbar skin", () => {
  assert.doesNotMatch(calendar, /scrollbar-color:/);
  assert.doesNotMatch(calendar, /scrollbar-width:/);
});

test("every theme keeps the scrollbar thumb distinct from its track", () => {
  const failures = themePresets.flatMap((preset) => {
    const colors = preset.colors;
    const track = mix(colors.panel, 0.82, colors.background);
    const thumb = mix(colors.muted, 0.86, colors.surface);
    const hover = mix(colors.primary, 0.58, colors.muted);
    const thumbContrast = contrast(track, thumb);
    const hoverContrast = contrast(track, hover);
    return thumbContrast >= 3 && hoverContrast >= 3
      ? []
      : [`${preset.name}: thumb ${thumbContrast.toFixed(2)}, hover ${hoverContrast.toFixed(2)}`];
  });

  assert.deepEqual(failures, []);
});
