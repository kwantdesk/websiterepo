// Shared by GEX DATA and KWANTY. Preserve the select data/form contract.
// No timers or chart-frame work. Dynamically mounted settings are supported.
export function installThemedSelects(doc = document) {
  const controls = new Map();
  let active = null;
  const close = (restore = false) => {
    if (!active) return;
    const {button, menu} = active;
    active = null;
    menu.remove();
    button.setAttribute('aria-expanded', 'false');
    if (restore && button.isConnected) button.focus();
  };
  const enhance = select => {
    if (controls.has(select)) {
      const {button} = controls.get(select);
      if (select.nextElementSibling !== button) select.after(button);
      return;
    }
    if (select.multiple || select.size > 1) return;
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'kwant-choice-trigger';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const text = doc.createElement('span'), arrow = doc.createElement('span');
    arrow.textContent = '⌄'; arrow.setAttribute('aria-hidden', 'true');
    button.append(text, arrow);
    select.after(button); select.classList.add('kwant-choice-source');
    select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    const sync = () => {
      text.textContent = select.selectedOptions[0]?.textContent || 'Select';
      button.disabled = select.disabled || !select.options.length;
      button.setAttribute('aria-label', select.getAttribute('aria-label') || select.name || text.textContent);
      if (active?.select === select) close();
    };
    controls.set(select, {button, sync});
    // Settings/templates restore selection through properties, not change events.
    for (const property of ['value', 'selectedIndex']) {
      const descriptor = Object.getOwnPropertyDescriptor(doc.defaultView.HTMLSelectElement.prototype, property);
      Object.defineProperty(select, property, {
        configurable: true,
        get() { return descriptor.get.call(this); },
        set(value) { descriptor.set.call(this, value); sync(); },
      });
    }
    select.addEventListener('change', sync);
    button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); event.stopPropagation(); button.click();
      }
    });
    button.addEventListener('click', () => {
      if (active?.select === select) return close();
      close();
      const menu = doc.createElement('div'); menu.className = 'kwant-choice-menu';
      menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', button.getAttribute('aria-label'));
      const heading = doc.createElement('div'); heading.className = 'kwant-choice-heading';
      heading.textContent = button.getAttribute('aria-label'); menu.append(heading);
      for (const option of select.options) {
        const row = doc.createElement('button'); row.type = 'button'; row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(option.selected));
        row.disabled = option.disabled || Boolean(option.closest('optgroup')?.disabled);
        row.textContent = option.textContent;
        row.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          select.value = option.value;
          select.dispatchEvent(new doc.defaultView.Event('input', {bubbles: true}));
          select.dispatchEvent(new doc.defaultView.Event('change', {bubbles: true}));
          close(); button.focus();
        });
        menu.append(row);
      }
      // Native dialogs live in the top layer; their dropdown must live there too.
      (select.closest('dialog[open]') || doc.body).append(menu);
      const rect = button.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 190), doc.defaultView.innerWidth - 16);
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.max(8, Math.min(rect.left, doc.defaultView.innerWidth - width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(rect.bottom + 7, doc.defaultView.innerHeight - Math.min(menu.scrollHeight, 324) - 8))}px`;
      active = {select, button, menu}; button.setAttribute('aria-expanded', 'true');
      (menu.querySelector('[aria-selected="true"]:not(:disabled)') || menu.querySelector('button:not(:disabled)'))?.focus();
    });
    sync();
  };
  const scan = node => {
    if (node.nodeType !== 1) return;
    if (node.matches('select')) enhance(node);
    node.querySelectorAll('select').forEach(enhance);
  };
  scan(doc.documentElement);
  const observer = new doc.defaultView.MutationObserver(records => {
    let removedControls = false;
    for (const record of records) {
      const select = record.target.closest?.('select');
      if (select) controls.get(select)?.sync();
      for (const node of record.addedNodes) scan(node);
      if ([...record.removedNodes].some(node => node.nodeType === 1 && (node.matches('select') || node.querySelector('select')))) removedControls = true;
    }
    if (removedControls) for (const [select, control] of controls) if (!select.isConnected) {
      if (active?.select === select) close();
      control.button.remove(); controls.delete(select);
    }
  });
  observer.observe(doc.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label', 'aria-label']});
  doc.addEventListener('pointerdown', event => {
    if (active && !active.menu.contains(event.target) && !active.button.contains(event.target)) close();
  });
  doc.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') close();
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const rows = [...active.menu.querySelectorAll('button:not(:disabled)')];
      const index = rows.indexOf(doc.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + rows.length) % rows.length;
      rows[next]?.focus();
    }
  });
  doc.addEventListener('scroll', event => { if (active && !active.menu.contains(event.target)) close(); }, true);
  doc.addEventListener('reset', event => queueMicrotask(() => {
    for (const [select, control] of controls) if (select.form === event.target) control.sync();
  }));
  doc.defaultView.addEventListener('resize', () => close());
}

if (typeof document !== 'undefined') installThemedSelects();
