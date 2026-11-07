import test from 'node:test';
import assert from 'node:assert/strict';
import * as palettes from '../src/lib/gexMapPalette.ts';
import { readLinkedGexMapSettings, publishLinkedGexMapSettings } from '../src/lib/gexMapLinkedSettings.ts';
import {
  clearBounceGexMapDraft, commitBounceGexMapPreview, getBounceGexMapPreview,
  setBounceGexMapDraft, subscribeBounceGexMapPreview,
} from '../src/lib/bounceGexMapPreview.ts';

async function withStorage(run) {
  const previous = globalThis.window;
  const owner = {}, values = new Map();
  globalThis.window = Object.assign(new EventTarget(), { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });
  try { run(owner, values); await Promise.resolve(); }
  finally { clearBounceGexMapDraft(owner); globalThis.window = previous; }
}

test('every Bounce palette previews immediately without saving until the main commit', () => withStorage((owner, values) => {
  const seen = [];
  const unsubscribe = subscribeBounceGexMapPreview(() => seen.push(getBounceGexMapPreview()?.palette));
  try {
    for (const preset of palettes.GEX_MAP_SHARED_PALETTE_PRESETS) {
      const palette = palettes.gexMapPaletteFromPreset(preset);
      setBounceGexMapDraft(owner, { palette });
      assert.equal(seen.at(-1), palette);
      assert.equal(values.size, 0);
    }
    const last = seen.at(-1);
    commitBounceGexMapPreview(owner);
    assert.ok(palettes.gexMapPalettesEqual(palettes.loadGexMapPalette(), last));
    assert.equal(getBounceGexMapPreview(), null);
  } finally { unsubscribe(); }
}));

test('discard restores the saved palette and view; save merges linked changes with the latest map profile', () => withStorage(owner => {
  const saved = palettes.gexMapPaletteFromPreset(palettes.GEX_MAP_SHARED_PALETTE_PRESETS[0]);
  palettes.saveGexMapPalette(saved);
  const palette = { ...saved, star: '#12AB34' };
  const startingProfile = readLinkedGexMapSettings();
  const viewMode = startingProfile.viewMode === 'full' ? 'star' : 'full';
  setBounceGexMapDraft(owner, { palette, profile: { viewMode } });
  clearBounceGexMapDraft(owner);
  assert.equal(getBounceGexMapPreview(), null);
  assert.ok(palettes.gexMapPalettesEqual(palettes.loadGexMapPalette(), saved));
  assert.equal(readLinkedGexMapSettings().viewMode, startingProfile.viewMode);

  setBounceGexMapDraft(owner, { palette, profile: { viewMode } });
  publishLinkedGexMapSettings({ ...startingProfile, stepMinutes: 10 });
  commitBounceGexMapPreview(owner);
  assert.equal(readLinkedGexMapSettings().viewMode, viewMode);
  assert.equal(readLinkedGexMapSettings().stepMinutes, 10);
  assert.equal(palettes.loadGexMapPalette().star, '#12AB34');
}));
