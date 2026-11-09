// Presentation only. Original controls/handlers and stored desktop layouts survive.
function mountPhoneWorkspace() {
  const app = document.body.dataset.phoneWorkspace;
  if (!app) return;
  // Docked GEX tools already expose their filters above the chart. A narrow
  // panel is not a second phone workspace and must not create another drawer.
  if (app === 'gex-data' && new URLSearchParams(location.search).get('embed') === '1') return;
  const workspacePane = app === 'heatmap' && new URLSearchParams(location.search).get('workspacePane') === '1';
  const phone = matchMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)');
  const host = document.querySelector(app === 'gex-data' ? '.app-shell' : app === 'heatmap' ? '.app-bar' : 'body > header');
  if (!host) return;
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'kwant-embed-phone-toggle'; toggle.textContent = 'Controls';
  // Charts already owns the top settings button, which opens this same drawer.
  // Keep its command handler but do not add a second visible launcher.
  if (workspacePane) toggle.style.display = 'none';
  toggle.setAttribute('aria-label', 'Open chart controls'); toggle.setAttribute('aria-expanded', 'false');
  const bar = document.createElement('div'); bar.className = 'kwant-embed-phone-bar';
  if (app === 'gex-data') { bar.append(toggle); host.prepend(bar); } else host.append(toggle);
  const shade = document.createElement('button'); shade.type = 'button'; shade.className = 'kwant-embed-phone-shade'; shade.setAttribute('aria-label', 'Close chart controls'); shade.tabIndex = -1; shade.hidden = true;
  const drawer = document.createElement('section'); drawer.className = 'kwant-embed-phone-drawer'; drawer.hidden = true; drawer.setAttribute('aria-label', app === 'heatmap' ? 'Liquidity Map settings' : 'Chart controls');
  if (app === 'heatmap') { drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); }
  const heading = document.createElement('div'); heading.className = 'kwant-embed-phone-heading';
  const title = document.createElement('strong'); title.textContent = app === 'heatmap' ? 'Liquidity Map settings' : 'Chart controls';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close chart controls');
  heading.append(title, close); drawer.append(heading); document.body.append(shade, drawer);
  const moved = new Map();
  // Move the original buttons, never clones: their live state and existing
  // click handlers must remain attached in a narrow embedded chart as well.
  const heatmapMoved = new Map();
  const heatmapSections = [];
  function organizeHeatmapControls(compact) {
    if (app !== 'heatmap') return;
    if (!compact) {
      for (const [button, placeholder] of heatmapMoved) {
        placeholder.replaceWith(button);
        button.querySelector('.kwant-compact-control-label')?.remove();
      }
      heatmapMoved.clear();
      heatmapSections.splice(0).forEach(section => section.remove());
      return;
    }
    if (heatmapSections.length) return;
    const groups = [
      ['Navigate', [['[data-tool="crosshair"]', 'Crosshair'], ['[data-tool="pan"]', 'Pan chart'], ['[data-tool="measure"]', 'Measure'], ['#zoomIn', 'Zoom in'], ['#zoomOut', 'Zoom out'], ['#resetView', 'Reset view']]],
      ['Chart layers', [['#toggleHeatmap', 'Heat map'], ['#toggleDom', 'Order book'], ['#toggleTrades', 'Trade bubbles'], ['#toggleProfile', 'Volume profile'], ['#toggleVolume', 'Volume bars'], ['#toggleCvd', 'Cumulative delta']]],
      ['Trading & settings', [['#mapTradeButton', 'Trade'], ['[data-panel-shortcut="depth"]', 'Depth settings'], ['[data-panel-shortcut="signals"]', 'Signals'], ['[data-panel-shortcut="settings"]', 'Display settings'], ['#fullscreenButton', 'Full screen'], ['#helpButton', 'Keyboard shortcuts']]],
    ];
    for (const [name, controls] of groups) {
      const section = document.createElement('section'); section.className = 'kwant-compact-control-section';
      const label = document.createElement('h3'); label.textContent = name;
      const grid = document.createElement('div'); grid.className = 'kwant-compact-control-grid';
      section.append(label, grid);
      for (const [selector, text] of controls) {
        const button = document.querySelector(selector);
        if (!button) continue;
        const placeholder = document.createComment('compact liquidity control');
        button.before(placeholder); heatmapMoved.set(button, placeholder);
        const caption = document.createElement('span'); caption.className = 'kwant-compact-control-label'; caption.textContent = text;
        button.append(caption); grid.append(button);
      }
      if (grid.children.length) { drawer.append(section); heatmapSections.push(section); }
    }
    const appearance = document.createElement('section'); appearance.className = 'kwant-compact-control-section';
    const appearanceTitle = document.createElement('h3'); appearanceTitle.textContent = 'Heat settings'; appearance.append(appearanceTitle);
    for (const [selector, text] of [['.heat-control', 'Heat sensitivity'], ['.heat-palette', 'Liquidity colour scale']]) {
      const control = document.querySelector(selector); if (!control) continue;
      const placeholder = document.createComment('compact liquidity appearance'); control.before(placeholder); heatmapMoved.set(control, placeholder);
      const field = document.createElement('div'); field.className = 'kwant-compact-control-field';
      const caption = document.createElement('span'); caption.textContent = text; field.append(caption, control); appearance.append(field);
    }
    if (appearance.children.length > 1) { drawer.append(appearance); heatmapSections.push(appearance); }
  }
  function show(open) {
    if (app === 'heatmap' && !phone.matches) organizeHeatmapControls(open);
    drawer.hidden = shade.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
    if (open) close.focus(); else (app === 'heatmap' && !phone.matches ? document.querySelector('#settingsButton') : toggle)?.focus();
  }
  toggle.addEventListener('click', () => show(drawer.hidden)); close.addEventListener('click', () => show(false)); shade.addEventListener('click', () => show(false));
  if (app === 'heatmap') window.addEventListener('kwantdesk:liquidity-instrument-menu', () => { if (!drawer.hidden) show(false); });
  if (app === 'heatmap') drawer.addEventListener('click', event => {
    if (event.target.closest('button[data-panel-shortcut],#helpButton,#fullscreenButton,#mapTradeButton')) show(false);
  });
  if (workspacePane) window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'kwantdesk:liquidity-map-panel-command') return;
    if (event.data.action === 'controls') show(true);
    if (event.data.action === 'instrument') document.querySelector('#newTab')?.click();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !drawer.hidden && !event.defaultPrevented) show(false); });
  const selectors = app === 'kwanty' ? ['.chart-top-controls', '.workspace-header-actions', '#sidebar'] : app === 'heatmap' ? ['#topDeck', '.app-actions'] : ['.topbar', '#toolControls'];
  function moveControls() {
    if (!phone.matches) {
      organizeHeatmapControls(false);
      for (const [element, placeholder] of moved) { if (placeholder.parentNode) placeholder.replaceWith(element); }
      moved.clear(); drawer.hidden = shade.hidden = true; toggle.setAttribute('aria-expanded', 'false');
      return;
    }
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element || moved.has(element)) continue;
      const placeholder = document.createComment('phone control position'); element.before(placeholder); moved.set(element, placeholder); drawer.append(element);
    }
    organizeHeatmapControls(true);
  }
  let scheduled = false;
  const refresh = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; moveControls(); updatePanels(); }); };
  const panelRoot = document.querySelector(app === 'gex-data' ? '#dashboard' : '#chartPanels');
  const picker = document.createElement('select'); picker.className = 'kwant-embed-phone-panels'; picker.setAttribute('aria-label', 'Choose chart panel'); picker.hidden = true;
  if (app === 'gex-data') bar.prepend(picker); else host.insertBefore(picker, toggle);
  let selected = '', signature = '';
  function panels() { return [...(panelRoot?.querySelectorAll(app === 'gex-data' ? '.dock-tabset' : '.chart-panel') ?? [])]; }
  function selectPanel() {
    panels().forEach((panel, index) => panel.classList.toggle('kwant-phone-selected-panel', String(index) === selected));
    // Existing chart engines own the actual canvas/frame dimensions.
    window.dispatchEvent(new Event('resize'));
  }
  picker.addEventListener('change', () => { selected = picker.value; selectPanel(); });
  function updatePanels() {
    const list = panels();
    const labels = list.map((panel, index) => panel.querySelector('[role=tab][aria-selected=true] .dock-tab-name,.panel-title')?.textContent?.trim() || `Chart ${index + 1}`);
    const next = labels.join('|');
    if (next === signature && list.every(panel => panel.dataset.phoneSeen === 'true')) return;
    signature = next; picker.replaceChildren(...labels.map((label, index) => new Option(`${index + 1}. ${label}`, String(index))));
    selected = Number(selected) < list.length ? selected || '0' : '0'; picker.value = selected; picker.hidden = list.length < 2;
    list.forEach(panel => { panel.dataset.phoneSeen = 'true'; });
    if (phone.matches) selectPanel();
  }
  const observer = new MutationObserver(refresh);
  function observePhone() {
    observer.disconnect();
    if (!phone.matches) return;
    observer.observe(host, { childList: true, subtree: true });
    if (panelRoot) observer.observe(panelRoot, { childList: true, subtree: true });
  }
  phone.addEventListener('change', () => { moveControls(); observePhone(); if (phone.matches) selectPanel(); else window.dispatchEvent(new Event('resize')); });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  observePhone();
  moveControls(); updatePanels();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPhoneWorkspace, { once: true }); else mountPhoneWorkspace();
