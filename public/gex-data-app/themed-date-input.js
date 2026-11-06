import {mountSessionDateControls} from './session-date-controls.js?v=20261106';

const DATE = 'input[type="date"]';
const controls = new WeakMap();

function calendarPopup(anchor, label, build) {
  const doc = anchor.ownerDocument;
  const menu = doc.createElement('section');
  menu.className = 'kwant-date-input-menu';
  menu.setAttribute('role','dialog');
  menu.setAttribute('aria-label',label);
  menu.addEventListener('keydown',event => { if (event.key === 'Escape') event.preventDefault(); });
  build(menu);
  // Native dialogs are in the top layer. Page/Global Filters also need the
  // calendar to count as part of their own popup for outside-click handling.
  (anchor.closest('dialog[open], .workspace-popup') || doc.body).append(menu);
  const win = doc.defaultView, rect = anchor.getBoundingClientRect();
  const width = Math.min(260, win.innerWidth - 16);
  menu.style.width = width + 'px';
  menu.style.left = Math.max(8, Math.min(rect.left, win.innerWidth - width - 8)) + 'px';
  // Size after the day grid has been rendered by mountSessionDateControls.
  win.requestAnimationFrame(() => {
    if (!menu.isConnected) return;
    const height = menu.offsetHeight;
    const top = rect.bottom + height + 14 > win.innerHeight ? rect.top - height - 6 : rect.bottom + 6;
    menu.style.top = Math.max(8, Math.min(top, win.innerHeight - height - 8)) + 'px';
    (menu.querySelector('[aria-pressed="true"]:not(:disabled)') || menu.querySelector('button:not(:disabled)'))?.focus();
  });
  return menu;
}

function enhance(input) {
  if (controls.has(input) || input.closest('[inert]')) return;
  const doc = input.ownerDocument, win = doc.defaultView;
  const host = doc.createElement('span');
  host.className = 'kwant-date-input-host';
  const label = input.getAttribute('aria-label') || input.labels?.[0]?.textContent?.trim() || 'Select date';
  input.after(host);
  input.dataset.kwantDateSource = '';
  const control = mountSessionDateControls({
    host, popup: calendarPopup, label, emptyLabel: 'Select date',
    getScope: () => ({ date: input.value, minDate: input.min, currentDate: input.max, disabled: input.disabled || input.hidden }),
    onChange: (date) => {
      input.value = date;
      input.dispatchEvent(new win.Event('input', {bubbles:true}));
      input.dispatchEvent(new win.Event('change', {bubbles:true}));
      host.querySelector('button')?.focus();
    },
  });
  const sync = () => { host.hidden = input.hidden; control.sync(); };
  const value = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value');
  Object.defineProperty(input,'value',{
    configurable:true,
    get(){return value.get.call(this);},
    set(next){value.set.call(this,next);sync();},
  });
  input.addEventListener('change',sync);
  controls.set(input,{sync, destroy:() => {
    control.destroy(); host.remove(); delete input.dataset.kwantDateSource; delete input.value;
    input.removeEventListener('change',sync); controls.delete(input);
  }});
  sync();
}

function visit(node, callback) {
  if (node.nodeType !== 1) return;
  if (node.matches(DATE)) callback(node);
  node.querySelectorAll(DATE).forEach(callback);
}

visit(document.body, enhance);
new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === 'attributes') controls.get(record.target)?.sync();
    for (const node of record.addedNodes) visit(node,enhance);
    for (const node of record.removedNodes) visit(node,input => {
      if (!input.isConnected) controls.get(input)?.destroy();
    });
  }
}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','min','max','value']});
