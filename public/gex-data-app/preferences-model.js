import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
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

// Overrides are independent by field. An absent page field falls through to
// the global field; it must not suppress another field's global override.
export function resolveFilterOverride({ toolValue, pageValue, globalValue, isTicker = false, alert = false } = {}) {
  const present = value => isTicker ? Array.isArray(value) && value.length > 0 : value !== undefined && value !== null && value !== '';
  if (!alert && present(pageValue)) return { type: 'PAGE', value: structuredClone(pageValue) };
  if (!alert && present(globalValue)) return { type: 'GLOBAL', value: structuredClone(globalValue) };
  return { type: 'NONE', value: structuredClone(toolValue) };
}

export function toggleAttachedFilterGroup(ids, id) {
  const existing = Array.isArray(ids) ? [...new Set(ids.filter(value => typeof value === 'string'))] : [];
  if (typeof id !== 'string' || id.length === 0) return existing;
  return existing.includes(id) ? existing.filter(value => value !== id) : [id, ...existing];
}

// Public API grammar, not the private site's serialized Filter Group schema.
// Currency input here is dollars; private *_IN_CENTS values require translation.
const OPERATION_ALIASES = Object.freeze({
  EQUALS: 'EQUALS', '=': 'EQUALS', '==': 'EQUALS', EQ: 'EQUALS', EQUAL: 'EQUALS',
  DOES_NOT_EQUAL: 'DOES_NOT_EQUAL', '!=': 'DOES_NOT_EQUAL', '<>': 'DOES_NOT_EQUAL', NEQ: 'DOES_NOT_EQUAL', NOT_EQUALS: 'DOES_NOT_EQUAL', NOT_EQUAL: 'DOES_NOT_EQUAL',
  GREATER_THAN: 'GREATER_THAN', '>': 'GREATER_THAN', GT: 'GREATER_THAN', GREATER: 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL_TO: 'GREATER_THAN_OR_EQUAL_TO', '>=': 'GREATER_THAN_OR_EQUAL_TO', GTE: 'GREATER_THAN_OR_EQUAL_TO', GE: 'GREATER_THAN_OR_EQUAL_TO', GREATER_OR_EQUAL: 'GREATER_THAN_OR_EQUAL_TO',
  LESS_THAN: 'LESS_THAN', '<': 'LESS_THAN', LT: 'LESS_THAN', LESS: 'LESS_THAN',
  LESS_THAN_OR_EQUAL_TO: 'LESS_THAN_OR_EQUAL_TO', '<=': 'LESS_THAN_OR_EQUAL_TO', LTE: 'LESS_THAN_OR_EQUAL_TO', LE: 'LESS_THAN_OR_EQUAL_TO', LESS_OR_EQUAL: 'LESS_THAN_OR_EQUAL_TO',
});

export function normalizeFilterExpression(expression, { allowedFields } = {}) {
  let terminals = 0;
  const fail = (path, message) => { throw new TypeError(`${path}: ${message}`); };
  const visit = (node, depth, path) => {
    if (depth > 5) fail(path, 'maximum filter depth is 5');
    if (!node || typeof node !== 'object' || Array.isArray(node)) fail(path, 'expected a filter object');
    const hasCompound = Object.hasOwn(node, 'conjunction') || Object.hasOwn(node, 'filters');
    const hasTerminal = ['field', 'operation', 'value', 'values'].some(key => Object.hasOwn(node, key));
    if (hasCompound && hasTerminal) fail(path, 'terminal and compound shapes cannot be mixed');
    if (hasCompound) {
      if (node.conjunction !== 'AND' && node.conjunction !== 'OR') fail(path, 'conjunction must be AND or OR');
      if (!Array.isArray(node.filters) || node.filters.length === 0) fail(path, 'at least one child filter is required');
      return { conjunction: node.conjunction, filters: node.filters.map((child, index) => visit(child, depth + 1, `${path}.filters[${index}]`)) };
    }
    if (typeof node.field !== 'string' || !node.field.trim()) fail(path, 'field is required');
    const field = node.field.trim();
    if (allowedFields && !allowedFields.includes(field)) fail(path, `unsupported field ${field}`);
    const operation = typeof node.operation === 'string' ? OPERATION_ALIASES[node.operation.trim().toUpperCase()] : undefined;
    if (!operation) fail(path, 'unsupported comparison operation');
    if (Object.hasOwn(node, 'value') && Object.hasOwn(node, 'values')) fail(path, 'use value or values, not both');
    const input = Object.hasOwn(node, 'values') ? node.values : node.value;
    const values = Array.isArray(input) ? [...input] : [input];
    if (!values.length || values.some(value => value === null || value === undefined || typeof value === 'string' && value.trim() === '' || !['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value))) fail(path, 'values must be nonempty finite scalar values');
    if (++terminals > 100) fail(path, 'maximum terminal count is 100');
    return { field, operation, values };
  };
  return visit(expression, 0, 'filterExpression');
}

export const normalizeAPIExpression = normalizeFilterExpression;

// Licensed endpoint selectors are not interchangeable with private web filters.
export function expirationFilterForTool(toolId,expirationDate){
  return ['max-pain','interval-map','option-price-over-time'].includes(toolId)
    ? {expirationDate} : {expirationDates:[expirationDate]};
}
