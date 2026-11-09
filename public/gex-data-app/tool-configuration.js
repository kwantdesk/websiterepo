// market-data's shipped global Tool Configuration schema. Only this application's
// own storage should consume this model; never write the source site's storage.
export const TOOL_CONFIGURATION_OPTIONS = Object.freeze([
  { key: 'hideAxisTitles', label: 'Show Axis Titles' },
  { key: 'hideCrosshairs', label: 'Show Crosshairs' },
  { key: 'hideLegends', label: 'Show Legends' },
  { key: 'hideStatusIndicators', label: 'Show Status Indicators' },
  { key: 'hideTimeSliders', label: 'Show Time Sliders' },
  { key: 'hideTitles', label: 'Show Titles' },
  { key: 'hideTooltips', label: 'Show Tooltips' },
  { key: 'hideDataZoomSliders', label: 'Show Zoom Sliders' },
].map(Object.freeze));

export const DEFAULT_TOOL_CONFIGURATION = Object.freeze(Object.fromEntries(
  TOOL_CONFIGURATION_OPTIONS.map(({ key }) => [key, false]),
));

export function sanitizeToolConfiguration(value) {
  return Object.fromEntries(TOOL_CONFIGURATION_OPTIONS.map(({ key }) => [
    key, value && typeof value[key] === 'boolean' ? value[key] : false,
  ]));
}

export function setConfigurationVisibility(configuration, key, visible) {
  const result = sanitizeToolConfiguration(configuration);
  if (Object.hasOwn(result, key) && typeof visible === 'boolean') result[key] = !visible;
  return result;
}

