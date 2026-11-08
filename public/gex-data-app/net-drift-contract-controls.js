// Inventory is injected from real observed contracts. This module owns no feed.
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().startsWith(value);
const numbers = values => [...new Set((Array.isArray(values) ? values : []).filter(value =>
  (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) && Number(value) > 0).map(Number))].sort((a, b) => a - b);

export function netDriftContractAvailability(choices = {}, expiry = '') {
  return {
    expirationDates: [...new Set((choices.expirationDates ?? []).filter(dateValid))].sort(),
    strikes: expiry ? numbers(choices.strikePricesByExpiration?.[expiry]) : [],
  };
}

/** Date-only calendar, independent of machine timezone/DST and market clocks. */
export function netDriftCalendarMonth({ expirationDates = [], expiry = '', sessionDate = '', month } = {}) {
  const dates = [...new Set(expirationDates.filter(dateValid))].sort();
  const anchor = dateValid(expiry) ? expiry : dates.find(date => !dateValid(sessionDate) || date >= sessionDate) ?? dates[0] ?? (dateValid(sessionDate) ? sessionDate : '1970-01-01');
  const selectedMonth = /^\d{4}-(?:0[1-9]|1[0-2])$/.test(month ?? '') ? month : anchor.slice(0, 7);
  const first = new Date(selectedMonth + '-01T12:00:00Z'), days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const available = new Set(dates), cells = Array.from({ length: Math.ceil((first.getUTCDay() + days) / 7) * 7 }, (_, index) => {
    const day = index - first.getUTCDay() + 1;
    if (day < 1 || day > days) return null;
    const date = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    return { date, day, available: available.has(date), selected: date === expiry };
  });
  return { month: selectedMonth, title: first.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }), cells };
}

function adjacentMonth(month, direction) {
  const [year, index] = month.split('-').map(Number), date = new Date(Date.UTC(year, index - 1 + direction, 1, 12));
  return date.toISOString().slice(0, 7);
}
// Strike selection does not change the observed inventory. Keep its dropdown
// open while choosing several strikes; ticker/session/expiry changes invalidate it.
const scopeKey = scope => JSON.stringify([scope.ticker, scope.sessionDate, scope.expiry ?? '', !!scope.disabled,!!scope.expiryDisabled]);
const readableDate = date => dateValid(date) ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : date;

/** Uses the host's shared popup, so adjacent menus are mutually exclusive. */
export function mountNetDriftContractControls({ host, popup, getScope, loadChoices, onExpiryChange, onStrikesChange, singleStrike=false, clearable=true, currencyStrikes=singleStrike, countSummary=false, clearSearchOnSelect=false }) {
  return mountContractControls({ host, popup, getScope, loadChoices, onExpiryChange, onStrikesChange }, true, {singleStrike,clearable,currencyStrikes,countSummary,clearSearchOnSelect});
}

/** A standalone multi-strike selector over the injected observed strike list. */
export function mountObservedStrikeControl({ host, popup, getScope, loadChoices, onStrikesChange }) {
  return mountContractControls({ host, popup, getScope, loadChoices, onStrikesChange }, false);
}

/** A single observed-expiry calendar; no strike UI or automatic selection. */
export function mountObservedExpiryControl({ host, popup, getScope, loadChoices, onExpiryChange, clearable=true }) {
  return mountContractControls({ host, popup, getScope, loadChoices, onExpiryChange }, true, {singleStrike:true,clearable,withStrikes:false});
}

function mountContractControls({ host, popup, getScope, loadChoices, onExpiryChange, onStrikesChange }, withExpiry, {singleStrike=false,clearable=true,currencyStrikes=singleStrike,countSummary=false,clearSearchOnSelect=false,withStrikes=true}={}) {
  const document = host.ownerDocument;
  const node = (tag, className = '', text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
  const button = (text, action, className = '') => { const element = node('button', className, text); element.type = 'button'; element.addEventListener('click', action); return element; };
  const stylesheet = () => { const link = node('link'); link.rel = 'stylesheet'; link.href = new URL('./net-drift-contract-controls.css', import.meta.url).href; return link; };
  const root = node('div', 'net-drift-contract-controls'), expiryWrap = node('div', 'control'), strikesWrap = node('div', 'control');
  const keyForScope = scope => scopeKey(withExpiry ? scope : { ...scope, expiry: '' });
  let destroyed = false, generation = 0, active = null, lastScopeKey, refreshSelection = null;
  const strikeLabel=value=>currencyStrikes?'$'+value.toLocaleString('en-US',{minimumFractionDigits:Number.isInteger(value)?0:2,maximumFractionDigits:2}):String(value);
  const close = () => { generation++; active?.remove(); active = null; refreshSelection = null; };
  const expiryButton = button('Expiration', () => open('expiry'), 'kwant-choice-trigger');
  const strikesButton = button('Strike Price', () => open('strikes'), 'kwant-choice-trigger');
  expiryButton.setAttribute('aria-label', 'Expiration'); strikesButton.setAttribute('aria-label', 'Strike Price');
  for (const element of [expiryButton, strikesButton]) element.setAttribute('aria-haspopup', 'dialog');
  expiryWrap.append(expiryButton); strikesWrap.append(strikesButton); root.append(stylesheet()); if (withExpiry) root.append(expiryWrap); if(withStrikes)root.append(strikesWrap); host.append(root);

  function sync() {
    if (destroyed) return;
    const scope = getScope(), key = keyForScope(scope);
    if (lastScopeKey !== undefined && key !== lastScopeKey) close();
    lastScopeKey = key;
    expiryButton.textContent = `${scope.expiry ? readableDate(scope.expiry) : 'Expiration'}`;
    if(!withStrikes)expiryButton.title=!scope.ticker?'Select an instrument first':scope.expiryDisabled?'Expiration controlled by a filter override':clearable?'Select expiration':'Select one expiration';
    const selected = numbers(scope.strikes);
    strikesButton.textContent = `${selected.length ? countSummary?strikeLabel(selected[0])+(selected.length>1?` + ${selected.length-1}`:''):selected.map(strikeLabel).join(', ') : 'Strike Price'}`;
    strikesButton.title = selected.length ? selected.map(strikeLabel).join(', ') : clearable?'All strikes':'Select one strike';
    strikesWrap.hidden = withExpiry && !scope.expiry;
    expiryButton.disabled = !!scope.disabled || !!scope.expiryDisabled || singleStrike&&!scope.ticker; strikesButton.disabled = !!scope.disabled || singleStrike&&!scope.ticker || withExpiry && !scope.expiry;
    refreshSelection?.();
  }
  function open(kind) {
    if (destroyed) return;
    const scope = getScope(); if (scope.disabled || kind==='expiry'&&scope.expiryDisabled || singleStrike&&!scope.ticker || (withExpiry && kind === 'strikes' && !scope.expiry)) return;
    close();
    const token = generation, key = keyForScope(scope), anchor = kind === 'expiry' ? expiryButton : strikesButton;
    let content;
    const menu = popup(anchor, kind === 'expiry' ? 'Expiration' : 'Strike Price', section => {
      section.classList.add('net-drift-contract-picker', 'surface-selection-menu');
      content = node('div', 'net-drift-contract-content'); content.append(node('p', 'net-drift-choice-status', 'Loading choices…'));
      section.append(stylesheet(), content);
    });
    active = menu;
    const current = () => !destroyed && token === generation && active === menu && menu?.isConnected !== false && keyForScope(getScope()) === key;
    Promise.resolve().then(() => current() ? loadChoices({ ...scope, strikes: [...(scope.strikes ?? [])] }) : null).then(choices => {
      if (!current()) return;
      const inventory = withExpiry ? netDriftContractAvailability(choices, scope.expiry) : { expirationDates: [], strikes: numbers(choices?.strikePrices) };
      if (kind === 'expiry') renderCalendar(inventory, scope);
      else renderStrikes(inventory);
    }).catch(() => {
      if (current()) content.replaceChildren(node('p', 'net-drift-choice-status', 'Contract choices are unavailable. Close and try again.'));
    });

    function renderCalendar(inventory, selectedScope, month) {
      const state = netDriftCalendarMonth({ ...selectedScope, expirationDates: inventory.expirationDates, month });
      content.replaceChildren();
      const navigation = node('div', 'net-drift-calendar-navigation');
      const previous = button('‹', () => renderCalendar(inventory, selectedScope, adjacentMonth(state.month, -1)));
      const next = button('›', () => renderCalendar(inventory, selectedScope, adjacentMonth(state.month, 1)));
      previous.setAttribute('aria-label', 'Previous month'); next.setAttribute('aria-label', 'Next month');
      previous.disabled = !inventory.expirationDates.length || state.month <= inventory.expirationDates[0].slice(0, 7);
      next.disabled = !inventory.expirationDates.length || state.month >= inventory.expirationDates.at(-1).slice(0, 7);
      navigation.append(previous, node('strong', '', state.title), next); content.append(navigation);
      const grid = node('div', 'net-drift-calendar-grid');
      for (const day of ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']) grid.append(node('span', 'net-drift-calendar-weekday', day));
      for (const cell of state.cells) {
        if (!cell) { grid.append(node('span')); continue; }
        const available=cell.available&&(!singleStrike||!dateValid(selectedScope.sessionDate)||cell.date>=selectedScope.sessionDate);
        const day = button(String(cell.day), () => { if (!current() || !available) return; onExpiryChange(cell.date); close(); sync(); }, cell.selected ? 'is-selected' : '');
        day.disabled = !available; day.setAttribute('aria-label', readableDate(cell.date)); day.setAttribute('aria-pressed', String(cell.selected)); grid.append(day);
      }
      content.append(grid);if(clearable)content.append(button('Clear expiration', () => { if (!current()) return; onExpiryChange(''); close(); sync(); }, 'net-drift-clear'));
      if (!inventory.expirationDates.length) content.append(node('p', 'net-drift-choice-status', 'No expirations are available in this snapshot.'));
    }
    function renderStrikes(inventory) {
      const searchWrap = node('div', 'control'), search = node('input'); search.type = 'search'; search.placeholder = 'Search strike price'; search.setAttribute('aria-label', 'Search strike price'); searchWrap.append(search);
      const list = node('div', 'net-drift-strike-options'); list.setAttribute('role', 'group'); list.setAttribute('aria-label', 'Strike Price options');
      const clear = button('Clear all', () => { if (!current()) return; onStrikesChange([]); close(); sync(); }, 'net-drift-clear');
      content.replaceChildren(searchWrap,...(clearable?[clear]:[]),list);
      const render = () => {
        if (!current()) return;
        const selected = numbers(getScope().strikes);
        list.replaceChildren();
        const term=(search.value??'').trim().toLowerCase();
        const items = inventory.strikes.filter(value => String(value).includes(term)||strikeLabel(value).toLowerCase().includes(term));
        for (const value of items) {
          const label = node('label', 'multi-choice-option'), input = node('input'); input.type = singleStrike?'radio':'checkbox';if(singleStrike)input.name='observed-contract-strike'; input.value = String(value); input.checked = selected.includes(value);
          input.addEventListener('change', () => {
            if (!current()) return;
            if(singleStrike){onStrikesChange([value]);close();sync();return;}
            const latest = numbers(getScope().strikes);
            if(clearSearchOnSelect)search.value='';
            onStrikesChange(input.checked ? numbers([...latest, value]) : latest.filter(item => item !== value));
            sync();
          });
          label.append(input, node('span', '', strikeLabel(value))); list.append(label);
        }
        if (!items.length) list.append(node('p', 'net-drift-choice-status', inventory.strikes.length ? 'No matching strikes.' : 'No strikes are available in this snapshot.'));
      };
      refreshSelection = render;
      search.addEventListener('input', render); render();
    }
  }
  sync();
  return { sync, destroy() { if (destroyed) return; destroyed = true; close(); root.remove(); } };
}
