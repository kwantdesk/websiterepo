import {themePaint} from './site-theme.js?v=1';
import {gexStorage,gexTimeZone} from './site-runtime.js?v=1';
import { OPTION_COLORS, exchangeColor, exchangeLabel } from './options-models.js';
import { abbreviate, currencyAbbreviated, currencyAuto } from './number-format.js';

const NUMERIC_TYPES = new Set(['integer', 'abbreviated', 'decimal', 'money', 'percentage', 'percentagePoints', 'greek', 'priceSide', 'bidAsk']);
const numberOrNull = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const idOf = column => column.id || column.key;
const make = (document, tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; };
export function tableValue(row, key) {
  if (Object.hasOwn(row || {}, key)) return row[key];
  return key.split('.').reduce((value, part) => value?.[part], row);
}
export function compareTableValues(a, b, type = 'text') {
  const an = NUMERIC_TYPES.has(type) || type === 'date' || type === 'time' ? numberOrNull(a) : null;
  const bn = NUMERIC_TYPES.has(type) || type === 'date' || type === 'time' ? numberOrNull(b) : null;
  if (an !== null && bn !== null) return an - bn;
  if (a === null || a === undefined || a === '') return b === null || b === undefined || b === '' ? 0 : 1;
  if (b === null || b === undefined || b === '') return -1;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}
export function filterTableValue(value, expression, type = 'text') {
  const query = String(expression ?? '').trim(); if (!query) return true;
  const numeric = NUMERIC_TYPES.has(type), n = numberOrNull(value);
  if (numeric) {
    const range = query.match(/^(-?[\d,.]+)\s*\.\.\s*(-?[\d,.]+)$/);
    if (range) return n !== null && n >= Number(range[1].replaceAll(',', '')) && n <= Number(range[2].replaceAll(',', ''));
    const comparison = query.match(/^(>=|<=|!=|>|<|=)?\s*(-?[\d,.]+)$/);
    if (comparison) {
      if (n === null) return false; const target = Number(comparison[2].replaceAll(',', ''));
      switch (comparison[1] || '=') { case '>=': return n >= target; case '<=': return n <= target; case '!=': return n !== target; case '>': return n > target; case '<': return n < target; default: return n === target; }
    }
  }
  const text = String(value ?? '').toLocaleLowerCase();
  if (query.startsWith('!=')) return text !== query.slice(2).trim().toLocaleLowerCase();
  if (query.startsWith('=')) return text === query.slice(1).trim().toLocaleLowerCase();
  if (query.startsWith('!')) return !text.includes(query.slice(1).toLocaleLowerCase());
  return query.split('|').some(part => text.includes(part.trim().toLocaleLowerCase()));
}
const compactNumber = (value, money = false) => {
  const n = numberOrNull(value); if (n === null) return '—';
  const absolute = Math.abs(n), scale = absolute >= 1e12 ? 1e12 : absolute >= 1e9 ? 1e9 : absolute >= 1e6 ? 1e6 : absolute >= 1e3 ? 1e3 : 1;
  const suffix = { 1e12: 'T', 1e9: 'B', 1e6: 'M', 1e3: 'K', 1: '' }[scale];
  return `${n < 0 ? '-' : ''}${money ? '$' : ''}${(absolute / scale).toLocaleString('en-US', { maximumFractionDigits: scale === 1 && !money ? 0 : 2 })}${suffix}`;
};
const price = value => { const n = numberOrNull(value); return n === null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const autoPrice = value => { const n = numberOrNull(value); return n === null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
const enumLabel = value => String(value ?? '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const sideCode = value => ({ ABOVE_ASK: 'AA', ASK: 'A', MID_MARKET: 'M', BID: 'B', BELOW_BID: 'BB' }[value] || value);
const expirationLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00Z`)) : value || '—';
export function formatTableValue(value, column = {}, row = {}, { timeZone = gexTimeZone() } = {}) {
  const n = numberOrNull(value);
  switch (column.type) {
    case 'date': case 'time': {
      if (value === null || value === undefined || value === '') return '—';
      const date = new Date(n === null ? value : n); if (!Number.isFinite(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en-US', column.type === 'date' ? { timeZone, year: 'numeric', month: 'short', day: 'numeric' } : { timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, ...(column.fractionalSecondDigits===3?{fractionalSecondDigits:3}:{}) }).format(date);
    }
    case 'integer': return n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    case 'money': return column.rawMoney?(n===null?'—':n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})):column.key === 'premium' || column.key === 'notionalValue' || /Premium$/.test(column.key || '') ? currencyAbbreviated(value,2) : column.key==='price'?price(value):currencyAuto(value);
    case 'abbreviated': return abbreviate(value,2);
    case 'decimal': return n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits:['dte','premiumRatio'].includes(column.key)?2:0,maximumFractionDigits: 2 });
    case 'percentage': return n === null ? '—' : `${(n * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
    case 'percentagePoints': return n === null ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    case 'greek': return n === null ? '—' : n.toFixed(5);
    case 'priceSide': return `${price(value)}${row.tradeSideCode ? ` · ${sideCode(row.tradeSideCode)}` : ''}`;
    case 'bidAsk': return `${price(row.bidPrice)} × ${price(row.askPrice)}`;
    case 'contract': return [row.ticker, row.expirationDate ? expirationLabel(row.expirationDate) : null, row.strikePrice == null ? null : autoPrice(row.strikePrice), row.contractType ? enumLabel(row.contractType) : null].filter(part => part !== null && part !== undefined && part !== '').join(' · ') || '—';
    case 'moneyness': {
      const m = row.moneyness || {}, code = { IN_THE_MONEY: 'ITM', AT_THE_MONEY: 'ATM', OUT_OF_THE_MONEY: 'OTM' }[m.moneyType] || m.moneyType;
      return code ? `${code}${m.degree == null ? '' : ` by ${price(m.degree)}`}${m.degreeInPercent == null ? '' : ` (${Number(m.degreeInPercent).toFixed(2)}%)`}` : '—';
    }
    case 'enum': case 'sentiment': return value==='NOT_APPLICABLE'?'N/A':enumLabel(value);
    default: return column.blankUnknown&&value==='UNKNOWN'?'':value === null || value === undefined ? '—' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
export function tableRowStyle(row) {
  if (['CANCEL', 'CANCEL_LAST', 'CANCEL_ONLY', 'CANCEL_OPEN'].includes(row.tradeType)) return 'qtable-cancelled';
  if (row.isGoldenSweep) return 'qtable-golden';
  if (row.isUnusual) return 'qtable-unusual';
  if (row.isOpeningPosition) return 'qtable-opening';
  return '';
}
const sentimentColor = row => row.sentimentType === 'BULLISH' ? OPTION_COLORS.call : row.sentimentType === 'BEARISH' ? OPTION_COLORS.put : themePaint("#AAAAAA");
function sourceDotColor(column, row, value) {
  if (column.key === 'exchange' || column.key === 'group') return row.color || exchangeColor(row.exchange);
  if (column.key === 'sentimentType' || column.key === 'premium' && row.sentimentType) return sentimentColor(row);
  if (column.key === 'tradeType') return `var(--qd-dot-tradeType${String(value).split('_').map(word => word[0] + word.slice(1).toLowerCase()).join('')}Color, #AAAAAA)`;
  if (column.key === 'tradeConsolidationType') return `var(--qd-dot-tradeConsolidation${String(value)[0] + String(value).slice(1).toLowerCase()}Color, #AAAAAA)`;
  if (column.type === 'moneyness') return `var(--qd-dot-money${{ IN_THE_MONEY: 'ITM', AT_THE_MONEY: 'ATM', OUT_OF_THE_MONEY: 'OTM' }[row.moneyness?.moneyType] || ''}Color, #AAAAAA)`;
  return null;
}

export function createTableView({ table, search = null, count = null, columnHost = null, onRowClick = null, onSort = null, onColumnsChange = null, onFilter = null, timeZone = gexTimeZone(), maxRows = 750, storage = null } = {}) {
  if (!table?.ownerDocument) throw new TypeError('A table element is required');
  const document = table.ownerDocument;
  const thead = table.tHead || table.createTHead(), tbody = table.tBodies[0] || table.createTBody(), tfoot = table.tFoot || table.createTFoot();
  table.classList.add('qtable');
  let rows = [], totalRow = null, columns = [], order = [], hidden = new Set(), widths = new Map(), filters = new Map(), sortId = null, sortDirection = -1, toolId = '', dragId = null, destroyed = false, resizeCleanup = null;
  const listeners = [];
  function listen(node, event, callback, options) { node.addEventListener(event, callback, options); listeners.push(() => node.removeEventListener(event, callback, options)); }
  const orderedColumns = () => order.map(id => columns.find(column => idOf(column) === id)).filter(Boolean);
  const visibleColumns = () => orderedColumns().filter(column => !hidden.has(idOf(column)));
  const valueFor = (row, column) => column.type === 'contract' ? row.ticker : column.type === 'moneyness' ? row.moneyness?.degree : tableValue(row, column.key);
  function savedKey() { return `gex-data-table-columns:${toolId}`; }
  function persist() {
    const state = { order: [...order], hidden: [...hidden], widths: Object.fromEntries(widths) };
    try { if (storage && toolId) storage.setItem(savedKey(), JSON.stringify(state)); } catch { /* Column preferences are optional. */ }
    onColumnsChange?.(state);
  }
  function matchesRow(row) {
    const query = String(search?.value || '').trim().toLocaleLowerCase();
    if (query && !columns.some(column => formatTableValue(valueFor(row, column), column, row, { timeZone }).toLocaleLowerCase().includes(query))) return false;
    for (const [id, expression] of filters) {
      const column = columns.find(item => idOf(item) === id); if (!column) continue;
      const value = ['contract', 'moneyness', 'bidAsk', 'date', 'time'].includes(column.type) ? formatTableValue(valueFor(row, column), column, row, { timeZone }) : valueFor(row, column);
      if (!filterTableValue(value, expression, ['contract', 'moneyness', 'bidAsk', 'date', 'time'].includes(column.type) ? 'text' : column.type)) return false;
    }
    return true;
  }
  function getVisibleRows() {
    const result = rows.filter(matchesRow), column = columns.find(item => idOf(item) === sortId);
    if (column) result.sort((a, b) => compareTableValues(valueFor(a, column), valueFor(b, column), column.type) * sortDirection);
    return result;
  }
  function setSort(id, direction = undefined) {
    const column = columns.find(item => idOf(item) === id); if (!column || column.sortable === false) return;
    sortDirection = direction ?? (sortId === id ? -sortDirection : -1); sortId = id;
    onSort?.({ id, key: column.key, direction: sortDirection }); render();
  }
  function setFilter(id, expression) { if (String(expression).trim()) filters.set(id, expression); else filters.delete(id); onFilter?.(Object.fromEntries(filters)); renderBody(); }
  function setVisible(id, visible) {
    const column = columns.find(item => idOf(item) === id); if (!column || column.canHide === false || !visible && visibleColumns().length <= 1) return;
    if (visible) hidden.delete(id); else hidden.add(id); persist(); render();
  }
  function reorder(from, to) {
    if (from === to || !order.includes(from) || !order.includes(to)) return;
    const next = order.filter(id => id !== from); next.splice(next.indexOf(to), 0, from); order = next; persist(); render();
  }
  function renderColumnControls() {
    if (!columnHost) return; const wasOpen = Boolean(columnHost.querySelector('details')?.open); columnHost.replaceChildren();
    const details = make(document, 'details', 'qtable-columns'), summary = make(document, 'summary', '', 'Columns'); details.open = wasOpen; details.append(summary);
    const panel = make(document, 'div', 'qtable-column-menu');
    orderedColumns().forEach(column => {
      const label = make(document, 'label'), checkbox = make(document, 'input'); checkbox.type = 'checkbox'; checkbox.checked = !hidden.has(idOf(column)); checkbox.disabled = column.canHide === false;
      checkbox.addEventListener('change', () => setVisible(idOf(column), checkbox.checked)); label.append(checkbox, document.createTextNode(column.label)); panel.append(label);
    });
    const reset = make(document, 'button', '', 'Reset columns'); reset.type = 'button'; reset.addEventListener('click', () => { order = columns.map(idOf); hidden.clear(); persist(); render(); }); panel.append(reset); details.append(panel); columnHost.append(details);
  }
  function applyColumnWidths() {
    table.style.width = `${visibleColumns().reduce((sum, column) => sum + (widths.get(idOf(column)) || column.width || 120), 0)}px`;
    for (const th of thead.querySelectorAll('tr:first-child th')) {
      const column = columns.find(item => idOf(item) === th.dataset.columnId); if (!column) continue;
      th.style.width = `${widths.get(idOf(column)) || column.width || 120}px`; th.style.minWidth = th.style.width;
    }
  }
  function renderHead() {
    thead.replaceChildren(); const heading = make(document, 'tr'), filterRow = make(document, 'tr', 'qtable-filter-row');
    visibleColumns().forEach(column => {
      const id = idOf(column), th = make(document, 'th'); th.dataset.columnId = id; th.draggable = true;
      const label = make(document, 'button', 'qtable-sort', `${column.label}${sortId === id ? sortDirection > 0 ? ' ↑' : ' ↓' : ''}`); label.type = 'button'; label.disabled = column.sortable === false; label.addEventListener('click', () => setSort(id)); th.append(label);
      th.setAttribute('aria-sort', sortId === id ? sortDirection > 0 ? 'ascending' : 'descending' : 'none');
      th.addEventListener('dragstart', event => { dragId = id; event.dataTransfer?.setData('text/plain', id); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; });
      th.addEventListener('dragover', event => { if (dragId) event.preventDefault(); });
      th.addEventListener('drop', event => { event.preventDefault(); if (dragId) reorder(dragId, id); dragId = null; }); th.addEventListener('dragend', () => { dragId = null; });
      const resize = make(document, 'span', 'qtable-resize'); resize.setAttribute('role', 'separator'); resize.setAttribute('aria-label', `Resize ${column.label}`); resize.setAttribute('aria-orientation', 'vertical'); resize.tabIndex = 0;
      resize.addEventListener('click', event => event.stopPropagation());
      resize.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); widths.set(id, Math.max(60, (widths.get(id) || column.width || 120) + (event.key === 'ArrowLeft' ? -10 : 10))); persist(); applyColumnWidths(); });
      resize.addEventListener('pointerdown', event => {
        event.preventDefault(); event.stopPropagation(); resizeCleanup?.();
        const startX = event.clientX, width = th.getBoundingClientRect().width;
        const move = pointer => { widths.set(id, Math.max(60, Math.min(1200, width + pointer.clientX - startX))); applyColumnWidths(); };
        const end = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end); resizeCleanup = null; persist(); };
        resizeCleanup = end; document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
      }); th.append(resize); heading.append(th);
      const filterCell = make(document, 'th'), input = make(document, 'input', 'qtable-column-filter'); input.type = 'text'; input.value = filters.get(id) || ''; input.placeholder = NUMERIC_TYPES.has(column.type) ? '=, >=, <=, min..max' : 'Filter…'; input.setAttribute('aria-label', `Filter ${column.label}`);
      input.addEventListener('input', () => setFilter(id, input.value)); filterCell.append(input); filterRow.append(filterCell);
    }); thead.append(heading, filterRow); applyColumnWidths();
  }
  function renderCell(row, column) {
    const td = make(document, 'td'), value = valueFor(row, column); td.dataset.columnId = idOf(column);
    const text = formatTableValue(value, column, row, { timeZone }), content = make(document, 'span', 'qtable-cell-value');
    td.title = text;
    if (column.bar) {
      const max = numberOrNull(row[column.maxField]), fraction = column.fractionField?Number(row[column.fractionField])||0:max && numberOrNull(value) !== null ? Math.max(0, Math.min(1, Number(value) / max)) : 0, progress = make(document, 'span', 'qtable-cell-progress');
      progress.style.width = `${fraction * 100}%`; progress.style.background = column.bar === 'primary'?themePaint("#700FEC"):column.bar === 'negative' ? OPTION_COLORS.putBar : OPTION_COLORS.callBar; td.append(progress);
    }
    const dotColor = column.dot?column.dot(row):sourceDotColor(column, row, value);
    if (dotColor && row.group !== 'TOTAL') { const dot = make(document, 'i', 'qtable-dot'); dot.style.background = dotColor; content.append(dot); }
    let displayText = text;
    if (column.key === 'exchange') displayText = column.rawExchange?String(value??'—'):row.exchangeLabel || exchangeLabel(value);
    if (column.type === 'contract') {
      const details = make(document, 'span', 'qtable-contract');
      details.append(make(document, 'span', 'qtable-contract-ticker', row.ticker || '—'), make(document, 'span', 'qtable-contract-expiration', expirationLabel(row.expirationDate)), make(document, 'span', 'qtable-contract-strike', autoPrice(row.strikePrice)), make(document, 'span', 'qtable-contract-type', enumLabel(row.contractType)));
      content.append(details);
    } else content.append(document.createTextNode(displayText));
    td.append(content);
    if (column.percentField && numberOrNull(row[column.percentField]) !== null) { const percent = make(document, 'span', 'qtable-cell-hint', `${(Number(row[column.percentField]) * 100).toFixed(2)}%`); td.append(percent); }
    if (NUMERIC_TYPES.has(column.type)) td.classList.add('qtable-numeric');
    return td;
  }
  function renderBody() {
    if (destroyed) return; const matching = getVisibleRows(), visible = visibleColumns(); tbody.replaceChildren(); tfoot.replaceChildren();
    matching.slice(0, maxRows).forEach((row, index) => {
      const tr = make(document, 'tr', tableRowStyle(row));
      visible.forEach(column => { const displayRow = column.key === 'rank' ? { ...row, rank: index + 1 } : row; tr.append(renderCell(displayRow, column)); });
      if (onRowClick) { tr.tabIndex = 0; tr.classList.add('qtable-clickable'); tr.addEventListener('click', event => onRowClick(row, event)); tr.addEventListener('keydown', event => { if (event.key === 'Enter') onRowClick(row, event); }); }
      tbody.append(tr);
    });
    if (totalRow) { const tr = make(document, 'tr', 'qtable-total'); visible.forEach(column => tr.append(renderCell(totalRow, column))); tfoot.append(tr); }
    if (!matching.length) { const tr = make(document, 'tr'), cell = make(document, 'td', 'qtable-empty', rows.length ? 'No matching rows' : 'No data for this session'); cell.colSpan = Math.max(1, visible.length); tr.append(cell); tbody.append(tr); }
    if (count) count.textContent = matching.length > maxRows ? `${matching.length.toLocaleString()} matching · first ${maxRows.toLocaleString()} rendered` : `${matching.length.toLocaleString()} loaded row${matching.length === 1 ? '' : 's'}`;
  }
  function render() { if (destroyed) return; renderHead(); renderBody(); renderColumnControls(); }
  function setRows(nextRows, configuration = {}) {
    const changedTool = (configuration.toolId ?? toolId) !== toolId;
    rows = [...(nextRows || [])].filter(row => row && row.group !== 'TOTAL'); totalRow = configuration.totalRow ?? nextRows?.find(row => row.group === 'TOTAL') ?? null;
    toolId = configuration.toolId ?? toolId;
    if (configuration.columns) {
      columns = configuration.columns.map(column => typeof column === 'string' ? { key: column, label: column, type: 'text' } : { ...column });
      const valid = new Set(columns.map(idOf));
      if (changedTool || !order.length) { order = columns.map(idOf); hidden.clear(); widths.clear(); filters.clear(); sortId = configuration.sortKey ?? null; sortDirection = configuration.sortDirection ?? -1;
        try { const saved = storage && toolId ? JSON.parse(storage.getItem(savedKey()) || 'null') : null; if (saved) { order = [...(saved.order || []).filter(id => valid.has(id)), ...order.filter(id => !saved.order?.includes(id))]; hidden = new Set((saved.hidden || []).filter(id => valid.has(id) && columns.find(column => idOf(column) === id)?.canHide !== false)); widths = new Map(Object.entries(saved.widths || {}).filter(([id, width]) => valid.has(id) && Number.isFinite(width) && width >= 60)); } } catch { /* Ignore malformed preferences. */ }
      } else order = [...order.filter(id => valid.has(id)), ...columns.map(idOf).filter(id => !order.includes(id))];
    }
    if (configuration.sortKey !== undefined && !sortId) sortId = configuration.sortKey;
    render();
  }
  if (search) listen(search, 'input', renderBody);
  if (document.defaultView) listen(document.defaultView, 'gex-data-timezone', () => {
    timeZone = gexTimeZone();
    render();
  });
  return { setRows, render, getVisibleRows, getColumns: () => orderedColumns().map(column => ({ ...column, id: idOf(column), visible: !hidden.has(idOf(column)), width: widths.get(idOf(column)) || column.width || 120 })), setSort, setFilter, setVisible, reorder, reset(){order=columns.map(idOf);hidden.clear();widths.clear();filters.clear();sortId=null;sortDirection=-1;if(search)search.value='';persist();render();}, destroy() { destroyed = true; resizeCleanup?.(); listeners.forEach(remove => remove()); columnHost?.replaceChildren(); } };
}
