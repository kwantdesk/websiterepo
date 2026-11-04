import {themePaint} from './site-theme.js?v=1';
import {gexStorage,gexTimeZone} from './site-runtime.js?v=1';
import { OPTION_COLORS, exchangeColor, exchangeLabel } from './options-models.js';
import { abbreviate, currencyAbbreviated, currencyAuto } from './number-format.js';
import {netDriftCalendarMonth} from './net-drift-contract-controls.js';
import {multiChoiceDropdown} from './choice-controls.js';
import {claimMenu,releaseMenu} from './menu-coordination.js';
import {mountEquityHeaderFilter} from './equity-header-filter-controls.js';
import {mountTableScrollPaging} from './table-scroll-paging.js';

const NUMERIC_TYPES = new Set(['integer', 'abbreviated', 'decimal', 'money', 'percentage', 'percentagePoints', 'greek', 'priceSide', 'bidAsk']);
const numberOrNull = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const idOf = column => column.id || column.key;
// Keep the relative order of existing/custom columns, including columns that
// are temporarily absent (for example Date in the latest-session tape).
// New schema columns join beside their nearest default neighbour, not the end.
function mergeColumnOrder(previous, defaults) {
  const order = [...new Set(previous.filter(id => typeof id === 'string'))];
  for (let index = 0; index < defaults.length; index++) {
    const id = defaults[index];
    if (order.includes(id)) continue;
    const next = defaults.slice(index + 1).find(candidate => order.includes(candidate));
    if (next !== undefined) order.splice(order.indexOf(next), 0, id);
    else {
      const preceding = defaults.slice(0, index).reverse().find(candidate => order.includes(candidate));
      order.splice(preceding === undefined ? order.length : order.indexOf(preceding) + 1, 0, id);
    }
  }
  return order;
}
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
const autoPrice = value => numberOrNull(value)===null?'—':currencyAuto(value);
const enumLabel = value => String(value ?? '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const sideCode = value => ({ ABOVE_ASK: 'AA', ASK: 'A', MID_MARKET: 'M', BID: 'B', BELOW_BID: 'BB' }[value] || value);
const expirationLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00Z`)) : value || '—';
export function formatTableValue(value, column = {}, row = {}, { timeZone = gexTimeZone() } = {}) {
  const n = numberOrNull(value);
  switch (column.type) {
    case 'calendarDate': {
      if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '—';
      const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?expirationLabel(value):'—';
    }
    case 'date': case 'time': {
      if (value === null || value === undefined || value === '') return '—';
      const date = new Date(n === null ? value : n); if (!Number.isFinite(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en-US', column.type === 'date' ? { timeZone, year: 'numeric', month: 'short', day: 'numeric' } : { timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, ...(column.fractionalSecondDigits===3?{fractionalSecondDigits:3}:{}) }).format(date);
    }
    case 'integer': return n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    case 'money': return column.autoCurrency?currencyAuto(value):column.fixedCents?price(value):column.rawMoney?(n===null?'—':n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})):column.key === 'premium' || column.key === 'notionalValue' || /Premium$/.test(column.key || '') ? currencyAbbreviated(value,2) : column.key==='price'?price(value):currencyAuto(value);
    case 'abbreviated': return abbreviate(value,2);
    case 'decimal': return n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits:['dte','premiumRatio'].includes(column.key)?2:0,maximumFractionDigits: 2 });
    case 'percentage': return n === null ? '—' : `${(n * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
    case 'percentagePoints': return n === null ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    case 'greek': return n === null ? '—' : n.toFixed(5);
    case 'priceSide': {
      // Equity executions and option executions expose different licensed fields.
      // Never reclassify an execution using a later bid/ask quote.
      const side = column.sidePrintType && row.printType !== column.sidePrintType ? null : column.sideField ? row[column.sideField] : row.tradeSideCode;
      const code = sideCode(side);
      return `${price(value)}${['AA','A','M','B','BB'].includes(code) ? `${column.sideSeparator ?? ' · '}${code}` : ''}`;
    }
    case 'bidAsk': return `${price(row.bidPrice)}${column.bidAskSeparator??' × '}${price(row.askPrice)}`;
    case 'contract': return [row.ticker, row.expirationDate ? expirationLabel(row.expirationDate) : null, row.strikePrice == null ? null : autoPrice(row.strikePrice), row.contractType ? enumLabel(row.contractType) : null].filter(part => part !== null && part !== undefined && part !== '').join(' · ') || '—';
    case 'moneyness': {
      const m = row.moneyness || {}, code = { IN_THE_MONEY: 'ITM', AT_THE_MONEY: 'ATM', OUT_OF_THE_MONEY: 'OTM' }[m.moneyType] || m.moneyType;
      return code ? `${code}${m.degree == null ? '' : ` by ${price(m.degree)}`}${m.degreeInPercent == null ? '' : column.plainMoneynessPercent ? ` ${Number(m.degreeInPercent).toFixed(2)}%` : ` (${Number(m.degreeInPercent).toFixed(2)}%)`}` : '—';
    }
    case 'enum': case 'sentiment': return value==='NOT_APPLICABLE'?'N/A':enumLabel(value);
    default: return column.blankUnknown&&value==='UNKNOWN'?'':value === null || value === undefined ? '—' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
export function formatTablePercentageHint(value,{percentUnit='fraction'}={}){
  if(!['fraction','percentagePoints'].includes(percentUnit))throw Error('Choose an explicit percentage unit.');
  const n=numberOrNull(value);return n===null?null:formatTableValue(percentUnit==='percentagePoints'?n:n*100,{type:'percentagePoints'});
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

const HEADER_OPERATORS = ['EQUALS','DOES_NOT_EQUAL','GREATER_THAN','GREATER_THAN_OR_EQUAL_TO','LESS_THAN','LESS_THAN_OR_EQUAL_TO'];
const HEADER_OPERATOR_LABELS = {'EQUALS':'Equals','DOES_NOT_EQUAL':'Does not equal','GREATER_THAN':'Greater than','GREATER_THAN_OR_EQUAL_TO':'Greater than or equal','LESS_THAN':'Less than','LESS_THAN_OR_EQUAL_TO':'Less than or equal'};
export function normalizeTableHeaderFilter(descriptor, operator, raw) {
  if (!descriptor?.field || !HEADER_OPERATORS.includes(operator) || !descriptor.operators?.includes(operator)) throw Error('Choose a supported filter operator.');
  const parse = value => {
    if(typeof value==='object'&&value!==null)throw Error('Enter a scalar filter value.');
    if (value == null || String(value).trim() === '') throw Error('Enter a filter value.');
    const text = String(value).trim();
    if (descriptor.type === 'number') { const numberText=descriptor.field==='IMPLIED_VOLATILITY'?text.replace(/\s*%$/,''):text;const n = Number(numberText.replaceAll(',','')); if (!numberText.trim()||!Number.isFinite(n)) throw Error('Enter a finite number.'); return n; }
    if (descriptor.type === 'boolean') { if (value === true || text === 'true') return true; if (value === false || text === 'false') return false; throw Error('Choose true or false.'); }
    if (descriptor.type === 'date') { const date = new Date(text+'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== text) throw Error('Enter a valid calendar date.'); return text; }
    if (descriptor.type === 'datetime') { const epoch = typeof value === 'number' || /^\d+$/.test(text) ? Number(value) : /(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? Date.parse(text) : NaN; if (!Number.isFinite(epoch)) throw Error('Enter epoch milliseconds or an ISO time with timezone.'); return epoch; }
    if (descriptor.choices && !descriptor.choices.includes(text)) throw Error('Choose an available value.');
    return text;
  };
  const value = Array.isArray(raw) ? raw.map(parse) : parse(raw);
  if (Array.isArray(value) && (!value.length || !['EQUALS','DOES_NOT_EQUAL'].includes(operator))) throw Error('Use one value for this operator.');
  return {key:descriptor.key,field:descriptor.field,operator,value};
}

export function createTableView({ table, search = null, count = null, columnHost = null, onRowClick = null, onSort = null, onSortChange = null, onFilterChange = null, headerMenu = false, inlineFilters = true, onColumnsChange = null, onFilter = null, timeZone = gexTimeZone(), maxRows = 750, storage = null } = {}) {
  if (!table?.ownerDocument) throw new TypeError('A table element is required');
  const document = table.ownerDocument;
  const thead = table.tHead || table.createTHead(), tbody = table.tBodies[0] || table.createTBody(), tfoot = table.tFoot || table.createTFoot();
  table.classList.add('qtable');
  let rows = [], totalRow = null, columns = [], order = [], hidden = new Set(), widths = new Map(), filters = new Map(), sortId = null, sortDirection = -1, toolId = '', dragId = null, destroyed = false, resizeCleanup = null;
  const listeners = [];
  function listen(node, event, callback, options) { node.addEventListener(event, callback, options); listeners.push(() => node.removeEventListener(event, callback, options)); }
  const scroller = table.closest?.('.table-scroll') ?? null;
  const virtualThreshold = Math.max(1, Math.min(200, Number.isFinite(maxRows) ? maxRows : 200));
  const rowNodes = new Map(), expandedDetails = new Map();
  let matchingRows = [], measuredRowHeight = 28, lastViewportHeight = 0, pendingFrame = null, tableObserver = null, lastWindow = '';
  let externalSortChange = typeof onSortChange === 'function' ? onSortChange : null;
  let externalFilterChange = typeof onFilterChange === 'function' ? onFilterChange : null, headerMenuEnabled = headerMenu, inlineFiltersEnabled=inlineFilters, atomicSort = null, menuCleanup = null,fillLastColumn=false,localHeaderFilters=false;
  const headerFilters = new Map();
  let menuDragId=null,menuGrabbedId=null,autoFilterEditor=null,autoFilterPosition=null,autoFilterColumnId=null,paging=null;
  let columnMenuOwner=null,columnMenuClose=null;
  const sortEntries = column => (column.sortKeys?.length ? column.sortKeys : [{key:column.key,field:column.sortField??column.key,label:column.label,type:column.type}]).map(entry=>typeof entry==='string'?{key:entry,field:entry,label:entry}:entry);
  function isSortActive(column) {
    if(sortId===idOf(column))return true;
    if(!column.sharedSortIndicator||sortId===null)return false;
    const active=columns.find(column=>idOf(column)===sortId),field=atomicSort?.field??active?.sortField??active?.key;
    if(!field)return false;
    const canonical=value=>String(value).replace(/[^a-z0-9]/gi,'').toUpperCase();
    return sortEntries(column).some(entry=>canonical(entry.field)===canonical(field));
  }
  function visibilityLocked(column){
    // Source429072 @2230723: fixed metadata or the active sort field;
    // filtering and direction do not contribute to this opt-in lock.
    if(column.canHide===false)return true;
    if(!column.lockWhenSorted||sortId===null)return false;
    const active=columns.find(item=>idOf(item)===sortId),field=atomicSort?.field??active?.sortField??active?.key;
    const canonical=value=>String(value??'').replace(/[^a-z0-9]/gi,'').toUpperCase();
    return !!field&&sortEntries(column).some(entry=>canonical(entry.field)===canonical(field));
  }
  function enforceSortVisibility(){let changed=false;for(const column of columns)if(visibilityLocked(column)&&hidden.delete(idOf(column)))changed=true;if(changed)persist();}
  const filterEntries = column => column.filterFields || (column.filterField ? [{key:column.key,field:column.filterField,label:column.label,type:column.filterType??column.type,operators:column.filterOperators??['EQUALS','DOES_NOT_EQUAL']}] : []);
  function closeHeaderMenu() { menuCleanup?.(); menuCleanup = null; }
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
      const value = ['contract', 'moneyness', 'bidAsk', 'date', 'calendarDate', 'time'].includes(column.type) ? formatTableValue(valueFor(row, column), column, row, { timeZone }) : valueFor(row, column);
      if (!filterTableValue(value, expression, ['contract', 'moneyness', 'bidAsk', 'date', 'calendarDate', 'time'].includes(column.type) ? 'text' : column.type)) return false;
    }
    return true;
  }
  function getVisibleRows() {
    const result = rows.filter(matchesRow), column = columns.find(item => idOf(item) === sortId);
    // Equity's observed single-field headers preview the loaded page while the
    // public server request replaces it. Other server-ranked tables opt out.
    if (column && (!externalSortChange || column.previewSort===true)) result.sort((a, b) => (typeof column.compareRows==='function'?column.compareRows(a,b):compareTableValues(valueFor(a, column), valueFor(b, column), column.type)) * sortDirection);
    return result;
  }
  function setSort(id, direction = undefined) {
    const column = columns.find(item => idOf(item) === id); if (!column || column.sortable === false) return;
    atomicSort = null; sortDirection = direction ?? (sortId === id ? -sortDirection : -1); sortId = id;
    enforceSortVisibility();
    onSort?.({ id, key: column.key, direction: sortDirection });
    if (externalSortChange) {
      // A server-ranked page must not be misleadingly reordered as though the
      // loaded subset were the whole market. Keep it until its replacement arrives.
      if(columns.some(column=>column.lockWhenSorted))render();else renderHead();
      const field=column.sortField??column.key;externalSortChange({id,key:field,field,direction:sortDirection});
    } else render();
  }
  function setAtomicSort(id, key, direction) {
    const column = columns.find(item=>idOf(item)===id), entry = column && sortEntries(column).find(item=>item.key===key || item.field===key);
    if (!column || !entry || !externalSortChange || ![1,-1,null].includes(direction)) return;
    if(direction===null&&(sortId!==id||(atomicSort?.field??column.sortField??column.key)!==entry.field)){closeHeaderMenu();return;}
    closeHeaderMenu(); sortId = direction===null ? null : id; sortDirection = direction; atomicSort = direction===null ? null : entry;
    enforceSortVisibility();
    const update = {id,key:entry.key,field:entry.field,direction}; onSort?.(update); externalSortChange(update); if(column.previewSort===true||columns.some(column=>column.lockWhenSorted))render();else renderHead();
  }
  function setHeaderFilter(id, key, operator, raw, {keepOpen=false}={}) {
    const column = columns.find(item=>idOf(item)===id), descriptor = column && filterEntries(column).find(item=>item.key===key || item.field===key);
    if (!descriptor || !externalFilterChange) throw Error('This column does not support a server filter.');
    const update = operator===null ? {key:descriptor.key,field:descriptor.field,operator:null,value:null} : normalizeTableHeaderFilter(descriptor,operator,raw);
    const previous=headerFilters.get(descriptor.field);
    if (operator===null) headerFilters.delete(descriptor.field); else headerFilters.set(descriptor.field,update);
    try{externalFilterChange({id,...update});}catch(error){if(previous)headerFilters.set(descriptor.field,previous);else headerFilters.delete(descriptor.field);throw error;}
    if(!keepOpen){closeHeaderMenu();renderHead();}
  }
  function openHeaderMenu(column, anchor, mode='sort') {
    closeHeaderMenu(); const id=idOf(column), menu=make(document,'div','qtable-header-menu'),nestedChoices=[]; menu.setAttribute('role','dialog'); menu.setAttribute('aria-label',`${column.label} ${mode} settings`);
    const currentAnchor=()=>{const header=[...(thead.children[0]?.children??[])].find(node=>node.dataset.columnId===id);return [...(header?.children??[])].find(node=>String(node.className).split(/\s+/).includes(mode==='filter'?'qtable-header-filter':'qtable-sort'))??anchor;};
    const title=make(document,'div','qtable-header-menu-title',column.label), close=make(document,'button','','Close'); close.type='button'; close.addEventListener('click',()=>{closeHeaderMenu();if(column.autoApplyFilter)currentAnchor().focus?.();}); title.append(close); menu.append(title);
    if (mode==='sort' && externalSortChange && column.sortable!==false) for (const entry of sortEntries(column)) {
      const section=make(document,'section','qtable-header-menu-section'), heading=make(document,'h4','',entry.label??entry.key); section.append(heading);if(column.sortMenuRadios){section.setAttribute('role','radiogroup');section.setAttribute('aria-label',`${entry.label??entry.key} sort order`);}
      for (const [text,direction] of [['Ascending',1],['Descending',-1],['Unsorted',null]]) {
        const button=make(document,'button','qtable-header-choice',text);button.type='button';button.setAttribute('aria-label',`${entry.label??entry.key}: ${text}`);
        const selected=sortId===id && (atomicSort?.field??column.sortField??column.key)===entry.field;
        if(column.sortMenuRadios)button.setAttribute('role','radio');button.setAttribute(column.sortMenuRadios?'aria-checked':'aria-pressed',String(direction===null ? !selected : selected&&sortDirection===direction));button.addEventListener('click',()=>setAtomicSort(id,entry.key,direction));section.append(button);
      }
      menu.append(section);
    }
    if(mode==='filter'&&externalFilterChange&&column.autoApplyFilter){
      const editor=make(document,'div');menu.append(editor);autoFilterColumnId=id;autoFilterEditor=mountEquityHeaderFilter({host:editor,fields:filterEntries(column),getCurrent:field=>headerFilters.get(field),normalize:normalizeTableHeaderFilter,onCommit:(descriptor,operator,value)=>setHeaderFilter(id,descriptor.key,operator,value,{keepOpen:true})});
    }
    if (mode==='filter' && externalFilterChange&&!column.autoApplyFilter) for (const descriptor of filterEntries(column)) {
      const operators=(descriptor.operators||[]).filter(operator=>HEADER_OPERATORS.includes(operator));if(!operators.length)continue;
      const form=make(document,'form','qtable-header-menu-section'), heading=make(document,'h4','',`Filter ${descriptor.label??descriptor.key}`), select=make(document,'select'), current=headerFilters.get(descriptor.field);
      select.setAttribute('aria-label',`${descriptor.label??descriptor.key} operator`);
      for(const operator of operators){const option=make(document,'option','',HEADER_OPERATOR_LABELS[operator]);option.value=operator;select.append(option);}select.value=current?.operator??operators[0];
      const multipleEnum=descriptor.type==='enum'&&Array.isArray(descriptor.choices),initialValues=current?.value==null?[]:Array.isArray(current.value)?current.value:[current.value];
      const input=multipleEnum?multiChoiceDropdown({document,choices:descriptor.choices.map(value=>[value,enumLabel(value)]),values:initialValues,label:`${descriptor.label??descriptor.key} value`,emptyLabel:'Select values',searchable:true}):make(document,descriptor.choices||descriptor.type==='boolean'?'select':'input');input.setAttribute('aria-label',`${descriptor.label??descriptor.key} value`);
      if(multipleEnum){nestedChoices.push(input);input.style.flex='0 0 100%';input.style.width='100%';const list=input.children[1];list.style.position='static';list.style.minWidth='0';}
      else if(descriptor.choices||descriptor.type==='boolean'){for(const value of descriptor.choices??['true','false']){const option=make(document,'option','',value);option.value=value;input.append(option);}}
      else {input.type='text';if(descriptor.type==='number')input.inputMode='decimal';if(descriptor.type==='datetime')input.placeholder='ISO time + timezone / epoch ms';}
      if(!multipleEnum)input.value=current?.value==null?'':String(current.value);
      let calendarControl=null;
      if(descriptor.type==='date'){
        input.readOnly=true;input.placeholder='Select date';
        calendarControl=make(document,'div','qtable-header-date-control');
        const toggle=make(document,'button','','Choose date'),calendar=make(document,'div','qtable-header-calendar');toggle.type='button';toggle.setAttribute('aria-label',`Choose ${descriptor.label??descriptor.key} date`);toggle.setAttribute('aria-expanded','false');calendar.hidden=true;
        const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),part=type=>parts.find(item=>item.type===type).value;
        const today=`${part('year')}-${part('month')}-${part('day')}`;let month=(input.value||today).slice(0,7);
        const setOpen=open=>{calendar.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)renderCalendar();};
        function renderCalendar(){
          calendar.replaceChildren();const model=netDriftCalendarMonth({expiry:input.value,sessionDate:today,month}),navigation=make(document,'div','qtable-header-calendar-navigation');
          const navigationButtons=[];for(const [text,direction]of [['‹',-1],['›',1]]){const button=make(document,'button','',text);button.type='button';button.setAttribute('aria-label',direction<0?'Previous month':'Next month');button.addEventListener('click',()=>{const [year,index]=model.month.split('-').map(Number);month=new Date(Date.UTC(year,index-1+direction,1,12)).toISOString().slice(0,7);renderCalendar();});navigationButtons.push(button);}
          navigation.append(navigationButtons[0],make(document,'strong','',model.title),navigationButtons[1]);calendar.append(navigation);
          const grid=make(document,'div','qtable-header-calendar-grid');grid.setAttribute('role','grid');grid.setAttribute('aria-label',model.title);
          for(const day of ['Su','Mo','Tu','We','Th','Fr','Sa']){const weekday=make(document,'span','',day);weekday.setAttribute('role','columnheader');grid.append(weekday);}
          for(const cell of model.cells){if(!cell){grid.append(make(document,'span'));continue;}const day=make(document,'button','',cell.day);day.type='button';day.setAttribute('role','gridcell');day.setAttribute('aria-label',expirationLabel(cell.date));day.setAttribute('aria-selected',String(cell.date===input.value));day.dataset.date=cell.date;day.addEventListener('click',()=>{input.value=cell.date;setOpen(false);input.focus?.();});grid.append(day);}calendar.append(grid);
        }
        toggle.addEventListener('click',()=>setOpen(calendar.hidden));input.addEventListener('click',()=>setOpen(calendar.hidden));calendarControl.append(toggle,calendar);
      }
      const syncMultiple=()=>{if(!descriptor.choices||multipleEnum)return;input.multiple=['EQUALS','DOES_NOT_EQUAL'].includes(select.value);input.size=input.multiple?Math.min(4,descriptor.choices.length):1;};syncMultiple();select.addEventListener('change',syncMultiple);
      if(!multipleEnum&&descriptor.choices&&Array.isArray(current?.value))for(const option of input.children)option.selected=current.value.includes(option.value);
      const error=make(document,'div','qtable-header-filter-error');error.setAttribute('role','alert');
      const apply=make(document,'button','','Apply'), clear=make(document,'button','','Clear');apply.type='submit';clear.type='button';
      form.addEventListener('submit',event=>{event.preventDefault();try{const value=multipleEnum?String(input.value).split(',').map(value=>value.trim()).filter(Boolean):input.multiple&&input.selectedOptions?[...input.selectedOptions].map(option=>option.value):input.value;setHeaderFilter(id,descriptor.key,select.value,value);}catch(failure){error.textContent=failure.message;}});clear.addEventListener('click',()=>setHeaderFilter(id,descriptor.key,null));form.append(heading,select,input);if(calendarControl)form.append(calendarControl);form.append(apply,clear,error);menu.append(form);
    }
    if(mode==='filter'&&localHeaderFilters&&!externalFilterChange){
      const form=make(document,'form','qtable-header-menu-section'),label=make(document,'label','','Filter loaded rows'),input=make(document,'input'),apply=make(document,'button','','Apply'),clear=make(document,'button','','Clear');input.type='text';input.value=filters.get(id)||'';input.placeholder=NUMERIC_TYPES.has(column.type)?'=, >=, <=, min..max':'Contains text, =exact, !exclude';if(NUMERIC_TYPES.has(column.type))input.inputMode='decimal';input.setAttribute('aria-label','Filter '+column.label);apply.type='submit';clear.type='button';label.append(input);form.append(label,apply,clear);form.addEventListener('submit',event=>{event.preventDefault();setFilter(id,input.value);closeHeaderMenu();renderHead();});clear.addEventListener('click',()=>{setFilter(id,'');closeHeaderMenu();renderHead();});menu.append(form);
    }
    const host=document.body||table.parentElement||thead;host.append(menu);
    const viewport=document.defaultView;
    const position=()=>{const rect=(column.autoApplyFilter?currentAnchor():anchor).getBoundingClientRect?.()??{left:0,bottom:0};
    menu.style.left=Math.max(4,Math.min(rect.left,(viewport?.innerWidth??1024)-300))+'px';menu.style.top=Math.max(4,Math.min(rect.bottom+4,(viewport?.innerHeight??768)-200))+'px';
    menu.style.maxHeight=Math.max(100,(viewport?.innerHeight??768)-Number.parseFloat(menu.style.top)-8)+'px';};position();if(autoFilterEditor)autoFilterPosition=position;
    const outside=event=>{if(!menu.contains?.(event.target)&&!currentAnchor().contains?.(event.target))closeHeaderMenu();}, escape=event=>{if(event.key==='Escape'){event.stopPropagation();if(autoFilterEditor?.escape())return;closeHeaderMenu();currentAnchor().focus?.();}};
    const scroll=event=>{if(!menu.contains?.(event.target)){if(autoFilterEditor)position();else closeHeaderMenu();}},resize=()=>{if(autoFilterEditor)position();else closeHeaderMenu();};
    document.addEventListener?.('pointerdown',outside);document.addEventListener?.('keydown',escape);document.addEventListener?.('scroll',scroll,true);viewport?.addEventListener?.('resize',resize);
    anchor.setAttribute('aria-expanded','true');menuCleanup=()=>{autoFilterEditor?.destroy();autoFilterEditor=null;autoFilterPosition=null;autoFilterColumnId=null;for(const choice of nestedChoices){choice.open=false;releaseMenu(document,choice);}menu.remove?.();anchor.setAttribute('aria-expanded','false');currentAnchor().setAttribute('aria-expanded','false');document.removeEventListener?.('pointerdown',outside);document.removeEventListener?.('keydown',escape);document.removeEventListener?.('scroll',scroll,true);viewport?.removeEventListener?.('resize',resize);};
    menu.querySelector?.('button')?.focus?.();
  }
  function setFilter(id, expression) { if (String(expression).trim()) filters.set(id, expression); else filters.delete(id); onFilter?.(Object.fromEntries(filters)); renderBody(); }
  function setVisible(id, visible) {
    const column = columns.find(item => idOf(item) === id); if (!column || visibilityLocked(column) || !visible && visibleColumns().length <= 1) return;
    if (visible) hidden.delete(id); else hidden.add(id); persist(); render();
  }
  function reorder(from, to,placement='before') {
    if (from === to || !order.includes(from) || !order.includes(to)) return;
    const first=order.indexOf(from),last=order.indexOf(to),fixed=columns.filter(column=>column.reorderable===false).map(idOf);
    if(fixed.includes(from)||fixed.includes(to)||fixed.some(id=>{const index=order.indexOf(id);return index>Math.min(first,last)&&index<Math.max(first,last);}))return;
    const next = order.filter(id => id !== from); next.splice(next.indexOf(to)+(placement==='after'?1:0), 0, from); order = next; persist(); render();
  }
  function renderColumnControls() {
    if (!columnHost) return; const wasOpen = Boolean(columnHost.querySelector('details')?.open);columnMenuClose?.('remount');columnHost.replaceChildren();
    columnMenuOwner=null;columnMenuClose=null;
    const details = make(document, 'details', 'qtable-columns'), summary = make(document, 'summary', '', 'Columns'); details.open = wasOpen; details.append(summary);
    const panel = make(document, 'div', 'qtable-column-menu');
    const coordinated=columns.some(column=>column.menuReorder===true);
    let coordinateColumnMenu=null;
    if(coordinated){
      columnMenuOwner=details;
      let portalCleanup=null;
      const position=()=>{
        const viewport=document.defaultView,width=viewport?.innerWidth??1024,height=viewport?.innerHeight??768,anchor=summary.getBoundingClientRect?.()??{left:8,top:8,bottom:32};
        panel.style.position='fixed';panel.style.zIndex='10000';panel.style.boxSizing='border-box';panel.style.right='auto';panel.style.bottom='auto';panel.style.left='0px';panel.style.top='0px';panel.style.minWidth='min(200px, calc(100vw - 16px))';panel.style.maxWidth='calc(100vw - 16px)';panel.style.maxHeight=Math.max(1,height-16)+'px';panel.style.overflow='auto';
        const bounds=panel.getBoundingClientRect?.()??{width:220,height:240},below=anchor.bottom+6,above=anchor.top-bounds.height-6;
        panel.style.left=Math.max(8,Math.min(anchor.left,width-bounds.width-8))+'px';panel.style.top=Math.max(8,Math.min(below+bounds.height<=height-8?below:above>=8?above:below,height-bounds.height-8))+'px';
      };
      const dismiss=reason=>{details.open=false;menuDragId=null;if(reason!=='remount')menuGrabbedId=null;releaseMenu(document,panel);portalCleanup?.();portalCleanup=null;panel.remove?.();details.append(panel);if(reason==='escape'||reason==='close')summary.focus?.();};
      columnMenuClose=dismiss;
      const coordinate=()=>{
        if(destroyed||columnMenuOwner!==details||details.isConnected===false)return;
        if(!details.open){dismiss('toggle');return;}
        (document.body||columnHost).append(panel);position();claimMenu(document,panel,dismiss,summary);
        if(!portalCleanup){const scroll=event=>{if(!panel.contains?.(event.target))position();},resize=()=>position();document.addEventListener?.('scroll',scroll,true);document.defaultView?.addEventListener?.('resize',resize);portalCleanup=()=>{document.removeEventListener?.('scroll',scroll,true);document.defaultView?.removeEventListener?.('resize',resize);};}
      };
      coordinateColumnMenu=coordinate;
      summary.addEventListener('click',event=>{event.preventDefault();details.open=!details.open;coordinate();});details.addEventListener('toggle',coordinate);
      const heading=make(document,'div','qtable-column-menu-heading'),title=make(document,'strong','','Columns'),close=make(document,'button','qtable-column-menu-close','×');close.type='button';close.setAttribute('aria-label','Close Columns');close.addEventListener('click',()=>dismiss('close'));heading.append(title,close);panel.append(heading);
    }
    orderedColumns().filter(column=>column.columnMenu!==false).forEach(column => {
      const label = make(document, 'label'), checkbox = make(document, 'input'); checkbox.type = 'checkbox'; checkbox.checked = !hidden.has(idOf(column)); checkbox.disabled = visibilityLocked(column);
      if(column.lockWhenSorted&&checkbox.disabled)checkbox.title=column.canHide===false?'This column cannot be hidden.':'Sorted columns cannot be hidden.';
      checkbox.addEventListener('change', () => setVisible(idOf(column), checkbox.checked)); label.append(checkbox, document.createTextNode(column.label));
      if(column.menuReorder===true&&column.reorderable!==false){
        const id=idOf(column),row=make(document,'div','qtable-column-reorder-row'),grip=make(document,'button','qtable-column-reorder-handle');grip.type='button';grip.draggable=true;grip.dataset.columnReorder=id;
        grip.setAttribute('aria-label',`Reorder ${column.label}: Space to grab, arrow keys to move, Space to drop`);grip.setAttribute('aria-roledescription','draggable');grip.setAttribute('aria-pressed',String(menuGrabbedId===id));
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.setAttribute('viewBox','0 0 16 20');svg.setAttribute('width','14');svg.setAttribute('height','18');svg.setAttribute('aria-hidden','true');path.setAttribute('d','M5 4h.01M11 4h.01M5 10h.01M11 10h.01M5 16h.01M11 16h.01');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');svg.append(path);grip.append(svg);
        const focus=()=>{const target=document.querySelector?.(`.qtable-column-menu button[data-column-reorder="${id}"]`)??columnHost.querySelector(`button[data-column-reorder="${id}"]`);target?.focus?.();};
        grip.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
        grip.addEventListener('keydown',event=>{
          if(event.key===' '||event.key==='Spacebar'){event.preventDefault();menuGrabbedId=menuGrabbedId===id?null:id;grip.setAttribute('aria-pressed',String(menuGrabbedId===id));return;}
          if(event.key==='Escape'&&menuGrabbedId===id){event.preventDefault();menuGrabbedId=null;grip.setAttribute('aria-pressed','false');return;}
          if(menuGrabbedId!==id||!['ArrowUp','ArrowDown'].includes(event.key))return;
          event.preventDefault();const choices=orderedColumns().filter(item=>item.columnMenu!==false&&item.menuReorder===true&&item.reorderable!==false).map(idOf),index=choices.indexOf(id),next=choices[index+(event.key==='ArrowUp'?-1:1)];
          if(next){reorder(id,next,event.key==='ArrowDown'?'after':'before');focus();}
        });
        grip.addEventListener('dragstart',event=>{menuDragId=id;event.dataTransfer?.setData('text/plain',id);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';});
        grip.addEventListener('dragend',()=>{menuDragId=null;});
        row.addEventListener('dragover',event=>{if(menuDragId)event.preventDefault();});
        row.addEventListener('drop',event=>{if(!menuDragId)return;event.preventDefault();const from=menuDragId;menuDragId=null;reorder(from,id,order.indexOf(from)<order.indexOf(id)?'after':'before');});
        row.append(grip,label);panel.append(row);
      }else panel.append(label);
    });
    const reset = make(document, 'button', '', 'Reset columns'); reset.type = 'button'; reset.addEventListener('click', () => { order = columns.map(idOf); hidden.clear(); persist(); render(); }); panel.append(reset); details.append(panel); columnHost.append(details);
    if(coordinated&&wasOpen)coordinateColumnMenu();
  }
  function applyColumnWidths() {
    const visible=visibleColumns(),minimum=visible.reduce((sum,column)=>sum+(widths.get(idOf(column))||column.width||120),0),last=visible.at(-1);
    // Opt-in source table geometry: configured early widths, remaining space
    // in the final visible column. Its configured width remains a minimum,
    // so a narrow pane scrolls rather than collapsing or widening early cells.
    table.style.width = fillLastColumn?'100%':`${minimum}px`;
    table.style.minWidth=fillLastColumn?`${minimum}px`:'';
    for (const th of thead.querySelectorAll('tr:first-child th')) {
      const column = columns.find(item => idOf(item) === th.dataset.columnId); if (!column) continue;
      const width=`${widths.get(idOf(column))||column.width||120}px`,lastVisible=last&&idOf(column)===idOf(last);
      th.style.width=fillLastColumn&&lastVisible?'auto':width;th.style.minWidth=width;
      th.style.maxWidth=fillLastColumn&&!lastVisible?width:'';th.style.boxSizing=fillLastColumn?'border-box':'';
    }
  }
  function renderHead() {
    if(!autoFilterEditor)closeHeaderMenu();
    thead.replaceChildren(); const heading = make(document, 'tr'), filterRow = make(document, 'tr', 'qtable-filter-row');
    visibleColumns().forEach(column => {
      const id = idOf(column), th = make(document, 'th',headerMenuEnabled||localHeaderFilters?'qtable-menu-header':''); th.dataset.columnId = id; th.draggable = column.reorderable!==false;
      const menuEnabled=headerMenuEnabled&&(!!externalSortChange||!!externalFilterChange),canSort=menuEnabled&&!!externalSortChange&&column.sortable!==false,directSort=canSort&&column.directSort===true&&sortEntries(column).length===1,sortMenu=canSort&&!directSort,activeSort=isSortActive(column);
      const label = make(document, 'button', 'qtable-sort', `${column.label}${activeSort ? sortDirection > 0 ? ' ↑' : ' ↓' : ''}${sortMenu?' ▾':''}`); label.type = 'button'; label.disabled = headerMenuEnabled?!canSort:column.sortable===false; label.addEventListener('click', () => {if(directSort){const entry=sortEntries(column)[0];setAtomicSort(id,entry.key,isSortActive(column)&&sortDirection===-1?1:-1);}else if(sortMenu)openHeaderMenu(column,label,'sort');else if(!headerMenuEnabled)setSort(id);});if(directSort)label.title=`Sort by ${column.label}`;if(sortMenu){label.setAttribute('aria-haspopup','dialog');label.setAttribute('aria-expanded','false');} th.append(label);
      if(headerMenuEnabled&&externalFilterChange&&filterEntries(column).length||localHeaderFilters&&column.sortable!==false){
        const active=localHeaderFilters?filters.has(id):filterEntries(column).some(entry=>headerFilters.has(entry.field)),filter=make(document,'button',`qtable-header-filter${active?' is-active':''}`),icon=make(document,'span','qtable-header-filter-icon');filter.type='button';icon.setAttribute('aria-hidden','true');filter.append(icon);filter.setAttribute('aria-label',`Filter ${column.label}`);filter.setAttribute('aria-haspopup','dialog');filter.setAttribute('aria-expanded',String(!!autoFilterEditor&&autoFilterColumnId===id));filter.setAttribute('aria-pressed',String(active));filter.title=active?`${column.label} filter active`:`Filter ${column.label}`;filter.addEventListener('click',()=>openHeaderMenu(column,filter,'filter'));th.append(filter);
      }
      th.setAttribute('aria-sort', activeSort ? sortDirection > 0 ? 'ascending' : 'descending' : 'none');
      th.addEventListener('dragstart', event => { if(!th.draggable){event.preventDefault();return;}dragId = id; event.dataTransfer?.setData('text/plain', id); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; });
      th.addEventListener('dragover', event => { if (dragId&&column.reorderable!==false) event.preventDefault(); });
      th.addEventListener('drop', event => { event.preventDefault(); if (dragId) reorder(dragId, id); dragId = null; }); th.addEventListener('dragend', () => { dragId = null; });
      if(column.resizable!==false){
      const resize = make(document, 'span', 'qtable-resize'); resize.setAttribute('role', 'separator'); resize.setAttribute('aria-label', `Resize ${column.label}`); resize.setAttribute('aria-orientation', 'vertical'); resize.tabIndex = 0;
      resize.addEventListener('click', event => event.stopPropagation());
      resize.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); widths.set(id, Math.max(60, (widths.get(id) || column.width || 120) + (event.key === 'ArrowLeft' ? -10 : 10))); persist(); applyColumnWidths(); });
      resize.addEventListener('pointerdown', event => {
        event.preventDefault(); event.stopPropagation(); resizeCleanup?.();
        const startX = event.clientX, width = th.getBoundingClientRect().width;
        const move = pointer => { widths.set(id, Math.max(60, Math.min(1200, width + pointer.clientX - startX))); applyColumnWidths(); };
        const end = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end); resizeCleanup = null; persist(); };
        resizeCleanup = end; document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
      }); th.append(resize);}
      heading.append(th);
      const filterCell = make(document, 'th'), input = make(document, 'input', 'qtable-column-filter'); input.type = 'text'; input.value = filters.get(id) || ''; input.placeholder = NUMERIC_TYPES.has(column.type) ? '=, >=, <=, min..max' : 'Filter…'; input.setAttribute('aria-label', `Filter ${column.label}`);
      if(externalFilterChange){const button=make(document,'button','qtable-column-filter','Filter…');button.type='button';button.disabled=!filterEntries(column).length;button.setAttribute('aria-label',`Filter ${column.label}`);button.addEventListener('click',()=>openHeaderMenu(column,button,'filter'));filterCell.append(button);}else{input.addEventListener('input', () => setFilter(id, input.value));filterCell.append(input);}filterRow.append(filterCell);
    }); thead.append(heading); if(!headerMenuEnabled&&inlineFiltersEnabled)thead.append(filterRow); applyColumnWidths();autoFilterPosition?.();
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
    if(column.type==='priceSide'&&column.splitPriceSide){
      content.className+=' qtable-equity-price-side';content.append(make(document,'span','qtable-equity-price-amount',price(value)));
      const raw=column.sidePrintType&&row.printType!==column.sidePrintType?null:column.sideField?row[column.sideField]:row.tradeSideCode,code=sideCode(raw),name={AA:'Above ask',A:'Ask',M:'Mid',B:'Bid',BB:'Below bid'}[code];
      if(name){const side=make(document,'span','qtable-equity-price-side-code',code);side.title=name;side.setAttribute('role','img');side.setAttribute('aria-label',name);content.append(document.createTextNode(' '),side);td.title=`${price(value)} · ${name} (${code})`;}
    }else if (column.type === 'contract') {
      const details = make(document, 'span', 'qtable-contract');
      details.append(make(document, 'span', 'qtable-contract-ticker', row.ticker || '—'), make(document, 'span', 'qtable-contract-expiration', expirationLabel(row.expirationDate)), make(document, 'span', 'qtable-contract-strike', autoPrice(row.strikePrice)), make(document, 'span', 'qtable-contract-type', enumLabel(row.contractType)));
      content.append(details);
    } else content.append(document.createTextNode(displayText));
    td.append(content);
    if (column.percentField) {const text=formatTablePercentageHint(row[column.percentField],column);if(text!==null)td.append(make(document,'span','qtable-cell-hint',text));}
    if (NUMERIC_TYPES.has(column.type)) td.classList.add('qtable-numeric');
    return td;
  }
  function spacer(height, position, colspan) {
    const tr = make(document, 'tr', 'qtable-virtual-spacer'), cell = make(document, 'td');
    tr.dataset.spacer = position; tr.setAttribute('aria-hidden', 'true'); cell.colSpan = Math.max(1, colspan);
    Object.assign(tr.style, { height: height + 'px', pointerEvents: 'none' });
    Object.assign(cell.style, { height: height + 'px', padding: '0', border: '0', lineHeight: '0', fontSize: '0' });
    tr.append(cell); return tr;
  }
  function reconcileBody(desired) {
    if (typeof tbody.insertBefore !== 'function') { tbody.replaceChildren(...desired); return; }
    const keep = new Set(desired);
    for (let index = 0; index < desired.length; index++) if (tbody.children[index] !== desired[index]) tbody.insertBefore(desired[index], tbody.children[index] ?? null);
    for (const node of [...tbody.children]) if (!keep.has(node)) node.remove();
  }
  function renderViewport(force = false) {
    if (destroyed) return;
    if (scroller?.clientHeight > 0) lastViewportHeight = scroller.clientHeight;
    const viewportHeight = scroller?.clientHeight || lastViewportHeight || (scroller?.isConnected === true ? 540 : 0);
    const visible = visibleColumns(), canVirtualize = matchingRows.length > virtualThreshold && scroller && viewportHeight > 0;
    const firstRow = rowNodes.values().next().value;
    const measured = firstRow?.getBoundingClientRect?.().height;
    if (measured > 0 && Math.abs(measured - measuredRowHeight) > .5) { measuredRowHeight = measured; force = true; }
    for (const [index, tr] of rowNodes) if (tr.parentNode === tbody) {
      const detail = tr.nextElementSibling?.classList?.contains('detail-row') ? tr.nextElementSibling : null;
      const height = detail?.getBoundingClientRect?.().height || detail?.offsetHeight || 0;
      if (detail && expandedDetails.get(index)?.height !== height) { expandedDetails.set(index, {node: detail, height}); force = true; }
      else if (!detail && expandedDetails.has(index)) { expandedDetails.delete(index); force = true; }
    }
    const rowOffset = index => { let offset = index * measuredRowHeight; for (const [row, detail] of expandedDetails) if (row < index) offset += detail.height; return offset; };
    const indexAtOffset = value => { let low = 0, high = matchingRows.length; while (low < high) { const middle = Math.floor((low + high) / 2); if (rowOffset(middle + 1) <= value) low = middle + 1; else high = middle; } return low; };
    let start = 0, end = matchingRows.length;
    if (canVirtualize) {
      const headerHeight = thead.getBoundingClientRect?.().height || thead.offsetHeight || 0;
      const bodyTop = tbody.getBoundingClientRect?.().top, scrollTop = scroller.scrollTop || 0;
      const scrollerTop = scroller.getBoundingClientRect?.().top;
      const offset = Number.isFinite(bodyTop) && Number.isFinite(scrollerTop) ? Math.max(0, bodyTop - scrollerTop + scrollTop - (scroller.clientTop || 0)) : headerHeight;
      const top = Math.max(0, scrollTop - offset), overscan = 12;
      start = Math.max(0, Math.min(matchingRows.length - 1, indexAtOffset(top) - overscan));
      end = Math.min(matchingRows.length, indexAtOffset(top + viewportHeight) + overscan + 1);
    }
    const windowKey = `${start}:${end}:${measuredRowHeight}:${visible.map(idOf).join(',')}`;
    if (!force && windowKey === lastWindow) return;
    lastWindow = windowKey;
    const desired = [];
    if (start) desired.push(spacer(rowOffset(start), 'top', visible.length));
    for (let index = start; index < end; index++) {
      const row = matchingRows[index]; let tr = rowNodes.get(index);
      if (!tr) {
      tr = make(document, 'tr', tableRowStyle(row));
      visible.forEach(column => { const displayRow = column.key === 'rank' ? { ...row, rank: index + 1 } : row; tr.append(renderCell(displayRow, column)); });
      if (onRowClick) { tr.tabIndex = 0; tr.classList.add('qtable-clickable'); tr.addEventListener('click', event => {onRowClick(row, event);queueViewport();}); tr.addEventListener('keydown', event => { if (event.key === 'Enter') {onRowClick(row, event);queueViewport();} }); }
      tr.dataset.rowIndex = String(index); tr.setAttribute('aria-rowindex', String(index + thead.children.length + 1)); rowNodes.set(index, tr);
      }
      const detail = tr.nextElementSibling?.classList?.contains('detail-row') ? tr.nextElementSibling : expandedDetails.get(index)?.node;
      desired.push(tr); if (detail) desired.push(detail);
    }
    for (const index of rowNodes.keys()) if (index < start || index >= end) rowNodes.delete(index);
    if (end < matchingRows.length) desired.push(spacer(rowOffset(matchingRows.length) - rowOffset(end), 'bottom', visible.length));
    if (!matchingRows.length) { const tr = make(document, 'tr'), cell = make(document, 'td', 'qtable-empty', rows.length ? 'No matching rows' : 'No data for this session'); cell.colSpan = Math.max(1, visible.length); tr.append(cell); desired.push(tr); }
    reconcileBody(desired);
  }
  function queueViewport() {
    if (destroyed || pendingFrame !== null) return;
    if (document.defaultView?.requestAnimationFrame) pendingFrame = document.defaultView.requestAnimationFrame(() => { pendingFrame = null; renderViewport(); });
    else renderViewport();
  }
  function renderBody() {
    if (destroyed) return; matchingRows = getVisibleRows(); const visible = visibleColumns(); rowNodes.clear(); expandedDetails.clear(); lastWindow = ''; tfoot.replaceChildren();
    table.setAttribute('aria-rowcount', String(matchingRows.length + thead.children.length + (totalRow ? 1 : 0)));
    renderViewport(true);
    if (totalRow) { const tr = make(document, 'tr', 'qtable-total'); visible.forEach(column => tr.append(renderCell(totalRow, column))); tfoot.append(tr); }
    if (count) count.textContent = `${matchingRows.length.toLocaleString()} loaded row${matchingRows.length === 1 ? '' : 's'}`;
  }
  function render() { if (destroyed) return; renderHead(); renderBody(); renderColumnControls(); }
  let configuredSortKey;
  function setRows(nextRows, configuration = {}) {
    const previousSortId=sortId;
    const changedTool = (configuration.toolId ?? toolId) !== toolId;
    if(changedTool)closeHeaderMenu();paging=configuration.autoPaging??null;
    if (Object.hasOwn(configuration, 'onSortChange')) externalSortChange = typeof configuration.onSortChange === 'function' ? configuration.onSortChange : null;
    else if (changedTool) externalSortChange = typeof onSortChange === 'function' ? onSortChange : null;
    if(Object.hasOwn(configuration,'onFilterChange'))externalFilterChange=typeof configuration.onFilterChange==='function'?configuration.onFilterChange:null;else if(changedTool)externalFilterChange=typeof onFilterChange==='function'?onFilterChange:null;
    if(Object.hasOwn(configuration,'headerMenu'))headerMenuEnabled=configuration.headerMenu;else if(changedTool)headerMenuEnabled=headerMenu;
    if(Object.hasOwn(configuration,'inlineFilters'))inlineFiltersEnabled=configuration.inlineFilters;else if(changedTool)inlineFiltersEnabled=inlineFilters;
    if(Object.hasOwn(configuration,'localHeaderFilters'))localHeaderFilters=configuration.localHeaderFilters===true;else if(changedTool)localHeaderFilters=false;
    if(Object.hasOwn(configuration,'fillLastColumn'))fillLastColumn=configuration.fillLastColumn===true;else if(changedTool)fillLastColumn=false;
    if(changedTool){atomicSort=null;headerFilters.clear();menuDragId=null;menuGrabbedId=null;}
    if(Array.isArray(configuration.headerFilters)){headerFilters.clear();for(const filter of configuration.headerFilters)if(filter?.field&&filter.operator)headerFilters.set(filter.field,filter);}
    rows = [...(nextRows || [])].filter(row => row && row.group !== 'TOTAL'); totalRow = configuration.totalRow ?? nextRows?.find(row => row.group === 'TOTAL') ?? null;
    toolId = configuration.toolId ?? toolId;
    if (configuration.columns) {
      columns = configuration.columns.map(column => typeof column === 'string' ? { key: column, label: column, type: 'text' } : { ...column });
      if (changedTool || !order.length) { order = columns.map(idOf); hidden.clear(); widths.clear(); filters.clear(); sortId = configuration.sortKey ?? null; sortDirection = configuration.sortDirection ?? -1;
        try { const saved = storage && toolId ? JSON.parse(storage.getItem(savedKey()) || 'null') : null; if (saved) { order = mergeColumnOrder(saved.order || [], order); hidden = new Set((saved.hidden || []).filter(id => typeof id === 'string' && columns.find(column => idOf(column) === id)?.canHide !== false)); widths = new Map(Object.entries(saved.widths || {}).filter(([, width]) => Number.isFinite(width) && width >= 60)); } } catch { /* Ignore malformed preferences. */ }
      } else order = mergeColumnOrder(order, columns.map(idOf));
      // A required column stays visible even when a stale saved preference or
      // a prior schema had allowed hiding it. Menu visibility is independent.
      for(const column of columns)if(column.canHide===false)hidden.delete(idOf(column));
      for(const [index,column]of columns.entries()){
        const id=idOf(column);
        if(column.resizable===false)widths.delete(id);
        if(column.reorderable===false){order=order.filter(value=>value!==id);order.splice(Math.min(index,order.length),0,id);}
      }
    }
    // An explicit Rank/Metric control change owns sorting. Ordinary refreshes
    // with the same configured key must preserve the user's column sort.
    if (configuration.sortKey !== undefined && (changedTool || configuredSortKey !== configuration.sortKey || !sortId)) {
      sortId = configuration.sortKey; sortDirection = configuration.sortDirection ?? -1;
    }
    configuredSortKey = configuration.sortKey;
    if (externalSortChange && configuration.sortKey !== undefined) {
      const normalized=value=>String(value).replace(/[^a-z0-9]/gi,'').toUpperCase();
      const candidates=columns.filter(column=>column.sortable!==false&&[idOf(column),column.key,column.sortField,...sortEntries(column).flatMap(entry=>[entry.key,entry.field])].filter(value=>value!==undefined).some(value=>normalized(value)===normalized(configuration.sortKey)));
      // Date and Time both sort TRADE_TIME. Preserve the clicked header across
      // responses; a newly opened tape defaults to the native Time header.
      const column=candidates.find(column=>idOf(column)===configuration.sortId)??(!changedTool?candidates.find(column=>idOf(column)===previousSortId):null)??candidates.find(column=>normalized(configuration.sortKey)==='TRADETIME'&&column.type==='time')??candidates[0];
      if(column)sortId=idOf(column);
      atomicSort=column?sortEntries(column).find(entry=>[entry.key,entry.field].some(value=>normalized(value)===normalized(configuration.sortKey)))??null:null;
      if(configuration.sortDirection!==undefined)sortDirection=configuration.sortDirection;
    }
    enforceSortVisibility();render();
  }
  if (search) listen(search, 'input', renderBody);
  if (scroller) {
    listen(scroller, 'scroll', queueViewport, { passive: true });
    listeners.push(mountTableScrollPaging({scroller,getState:()=>paging?.getState(),onNext:()=>paging?.onNext()}));
    const Observer = document.defaultView?.ResizeObserver;
    if (Observer) { tableObserver = new Observer(queueViewport); tableObserver.observe(scroller); tableObserver.observe(thead); tableObserver.observe(tbody); }
  }
  if (document.defaultView) listen(document.defaultView, 'gex-data-timezone', () => {
    timeZone = gexTimeZone();
    render();
  });
  return { setRows, render, getVisibleRows, closeAutoFilter:()=>{if(autoFilterEditor)closeHeaderMenu();}, getSort:()=>{const column=columns.find(column=>idOf(column)===sortId);const field=atomicSort?.field??column?.sortField??column?.key;return {id:sortId,key:atomicSort?.key??field,field,direction:sortDirection,external:!!externalSortChange};}, getColumns: () => orderedColumns().map(column => ({ ...column, id: idOf(column), visible: !hidden.has(idOf(column)), width: widths.get(idOf(column)) || column.width || 120 })), setSort, setAtomicSort, setHeaderFilter, setFilter, setVisible, reorder, reset(){closeHeaderMenu();order=columns.map(idOf);hidden.clear();widths.clear();filters.clear();sortId=null;atomicSort=null;sortDirection=-1;if(search)search.value='';persist();render();}, destroy() { destroyed = true; closeHeaderMenu();columnMenuClose?.('destroy');columnMenuClose=null;columnMenuOwner=null;resizeCleanup?.(); listeners.forEach(remove => remove()); tableObserver?.disconnect(); if (pendingFrame !== null) document.defaultView?.cancelAnimationFrame?.(pendingFrame); pendingFrame = null; rowNodes.clear(); expandedDetails.clear(); matchingRows = []; columnHost?.replaceChildren(); } };
}
