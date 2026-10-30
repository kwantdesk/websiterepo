// Keep saved settings, native controls and toolbar states in the same units.
// Browser range elements silently clamp their UI; normalize the model too.
export const SETTING_CONTROLS = Object.freeze({
  paletteSelect: 'palette', sensitivityRange: 'sensitivity', quickHeatRange: 'sensitivity',
  dimmingRange: 'heatmapDimming', heatmapFilterSelect: 'heatmapFilter', sigmaRange: 'gaussianSigma',
  bubbleRange: 'circleSize', transparencyRange: 'circleTransparency', clusteringRange: 'smartClustering',
  minimumTradeSizeRange: 'minimumTradeSize', minimumVolumeRange: 'minimumPixelVolume',
  autoCenter: 'autoCenter', showTrails: 'trails', showGrid: 'grid', showDom: 'domVisible',
  showRestingSell: 'domRestingSellVisible', showRestingBuy: 'domRestingBuyVisible', showCob: 'domCobVisible',
  showBidPercent: 'domBidPercentVisible', showAskPercent: 'domAskPercentVisible', showSvp: 'domSvpVisible',
  aggregateDepth: 'aggregateDepth', bubbleDifferential: 'bubbleDifferential', cvdEnabled: 'cvdEnabled',
  cvdSplit: 'cvdSplit', cvdRangeSelect: 'cvdRange', cvdScaleSelect: 'cvdScale',
  cvdMinimumTradeSize: 'cvdMinimumTradeSize', cvdMaximumTradeSize: 'cvdMaximumTradeSize',
  imbalanceDepthLevels: 'imbalanceDepthLevels',
});

export function normalizeControlValue(control, value, fallback) {
  if (control.type === 'checkbox') {
    if (value === true || value === 'true' || value === 1) return true;
    if (value === false || value === 'false' || value === 0) return false;
    return fallback;
  }
  if (control.options) {
    return [...control.options].some(option => option.value === value) ? value : fallback;
  }
  let number = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
  if (!Number.isFinite(number)) number = fallback;
  const minimum = control.min === '' ? -Infinity : Number(control.min);
  const maximum = control.max === '' ? Infinity : Number(control.max);
  const step = Number(control.step);
  if (step > 0 && Number.isFinite(step)) {
    const base = Number.isFinite(minimum) ? minimum : 0;
    number = Number((base + Math.round((number - base) / step) * step).toPrecision(12));
  }
  return Math.max(minimum, Math.min(maximum, number));
}

export function synchronizeSettingsControls(settings, defaults, find) {
  for (const [id, key] of Object.entries(SETTING_CONTROLS)) {
    const control = find(id);
    const value = normalizeControlValue(control, settings[key], defaults[key]);
    settings[key] = value;
    if (control.type === 'checkbox') control.checked = value;
    else control.value = String(value);
  }
  for (const [id, key] of Object.entries({
    toggleHeatmap: 'heatmap', toggleDom: 'domVisible', toggleTrades: 'trades', toggleProfile: 'profile', toggleCvd: 'cvdPanel',
  })) {
    settings[key] = normalizeControlValue({ type: 'checkbox' }, settings[key], defaults[key]);
    const visible = key === 'cvdPanel' ? settings.cvdPanel && settings.cvdEnabled : settings[key];
    find(id).classList.toggle('active-toggle', visible);
    find(id).setAttribute('aria-pressed', String(visible));
  }
}
