// Presentation only. Original controls/handlers and stored desktop layouts survive.
function mountPhoneWorkspace() {
  const app = document.body.dataset.phoneWorkspace;
  if (!app) return;
  const phone = matchMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)');
  const host = document.querySelector(app === 'gex-data' ? '.app-shell' : app === 'heatmap' ? '.app-bar' : 'body > header');
  if (!host) return;
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'kwant-embed-phone-toggle'; toggle.textContent = 'Controls';
  toggle.setAttribute('aria-label', 'Open chart controls'); toggle.setAttribute('aria-expanded', 'false');
  const bar = document.createElement('div'); bar.className = 'kwant-embed-phone-bar';
  if (app === 'gex-data') { bar.append(toggle); host.prepend(bar); } else host.append(toggle);
  const shade = document.createElement('button'); shade.type = 'button'; shade.className = 'kwant-embed-phone-shade'; shade.setAttribute('aria-label', 'Close chart controls'); shade.tabIndex = -1; shade.hidden = true;
  const drawer = document.createElement('section'); drawer.className = 'kwant-embed-phone-drawer'; drawer.hidden = true; drawer.setAttribute('aria-label', 'Chart controls');
  const heading = document.createElement('div'); heading.className = 'kwant-embed-phone-heading';
  const title = document.createElement('strong'); title.textContent = 'Chart controls';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close chart controls');
  heading.append(title, close); drawer.append(heading); document.body.append(shade, drawer);
  const moved = new Map();
  function show(open) { drawer.hidden = shade.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); if (open) close.focus(); else toggle.focus(); }
  toggle.addEventListener('click', () => show(drawer.hidden)); close.addEventListener('click', () => show(false)); shade.addEventListener('click', () => show(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !drawer.hidden && !event.defaultPrevented) show(false); });
  const selectors = app === 'kwanty' ? ['.chart-top-controls', '.workspace-header-actions', '#sidebar'] : app === 'heatmap' ? ['#topDeck', '.app-actions'] : ['.topbar', '#toolControls'];
  function moveControls() {
    if (!phone.matches) {
      for (const [element, placeholder] of moved) { if (placeholder.parentNode) placeholder.replaceWith(element); }
      moved.clear(); drawer.hidden = shade.hidden = true; toggle.setAttribute('aria-expanded', 'false');
      return;
    }
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element || moved.has(element)) continue;
      const placeholder = document.createComment('phone control position'); element.before(placeholder); moved.set(element, placeholder); drawer.append(element);
    }
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
