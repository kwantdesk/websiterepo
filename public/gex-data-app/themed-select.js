// Shared by GEX DATA and KWANTY. Preserve the select data/form contract.
// No timers or chart-frame work. Dynamically mounted settings are supported.
import {claimMenu,releaseMenu} from './menu-coordination.js';
export function installThemedSelects(doc = document) {
  if (!doc.body) { doc.addEventListener('DOMContentLoaded', () => installThemedSelects(doc), {once:true}); return; }
  const controls = new Map();
  let active = null;
  const close = (restore = false) => {
    if (!active) return;
    const {button, menu} = active;
    active = null;
    releaseMenu(doc,menu);
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
    if (doc.body.dataset.phoneWorkspace === 'heatmap' && !select.matches('.kwant-embed-phone-panels')) return;
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
      button.hidden = select.hidden;
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
      const preferences=doc.defaultView.__kwantSelectPreferences;
      const nativeGroups=[...select.children].filter(child=>child.tagName?.toLowerCase()==='optgroup');
      const optionSections=options=>nativeGroups.length?[...nativeGroups.map(group=>({label:group.label,options:options.filter(option=>option.source.closest('optgroup')===group)})),{label:'',options:options.filter(option=>!option.source.closest('optgroup'))}].filter(section=>section.options.length):[{label:'',options}];
      const manualSymbols=preferences?.isManualSymbolControl?.({id:select.id,name:select.name,label:select.getAttribute('aria-label')||''})===true;
      const group=preferences?.keyFor({id:select.id,name:select.name,label:select.getAttribute('aria-label')||'',values:[...select.options].map(option=>option.value)});
      let committed=false;
      const choose=option=>{
        if(committed)return;committed=true;
        if(![...select.options].includes(option))select.append(option);
        if(preferences&&!(manualSymbols&&option.value===''))try{preferences.select(group,option.value);}catch{/* Selection still works if account storage is full. */}
        select.value=option.value;
        select.dispatchEvent(new doc.defaultView.Event('input', {bubbles: true}));
        select.dispatchEvent(new doc.defaultView.Event('change', {bubbles: true}));
        close();button.focus();
      };
      if(preferences){
        menu.classList.add('with-preferences');
        const search=doc.createElement('input');search.type='search';search.placeholder=group==='instruments'?'Search tickers':'Search options';search.setAttribute('aria-label',group==='instruments'?'Search tickers':'Search dropdown options');
        const filters=doc.createElement('div');filters.className='kwant-choice-filters';
        const all=doc.createElement('button'),favourites=doc.createElement('button');
        for(const control of [all,favourites])control.type='button';
        all.textContent='All';favourites.textContent='Favourites only';
        filters.append(all,favourites);
        const recentLabel=doc.createElement('label'),recent=doc.createElement('input');recent.type='checkbox';recentLabel.className='kwant-choice-recents';recentLabel.append(recent,doc.createTextNode('Recents first'));
        const status=doc.createElement('p');status.className='kwant-choice-save-status';status.hidden=true;status.setAttribute('role','status');
        const list=doc.createElement('div');list.className='kwant-choice-options';
        menu.append(search,filters,recentLabel,status,list);
        const change=action=>{try{action();status.hidden=true;}catch{status.textContent='Could not save dropdown preferences.';status.hidden=false;}render();};
        const render=()=>{
          const prefs=preferences.get(group);all.setAttribute('aria-pressed',String(!prefs.favouritesOnly));favourites.setAttribute('aria-pressed',String(prefs.favouritesOnly));recent.checked=prefs.showRecents;
          const options=[...select.options].filter(option=>!manualSymbols||option.value!=='').map(option=>({value:option.value,label:option.textContent||option.value,menuLabel:option.dataset.menuLabel,disabled:option.disabled||Boolean(option.closest('optgroup')?.disabled),source:option}));
          for(const saved of preferences.savedOptionsFor?.(group)||[]){if(!options.some(option=>option.value===saved.value)){const option=doc.createElement('option');option.value=saved.value;option.textContent=saved.label;options.push({...saved,disabled:false,source:option});}}
          const sections=preferences.sections(options,prefs,search.value,{group});list.replaceChildren();
          const reset=manualSymbols?[...select.options].find(option=>option.value===''):null;
          if(reset){const row=doc.createElement('div');row.className='kwant-choice-option-row';const pick=doc.createElement('button');pick.type='button';pick.setAttribute('role','option');pick.setAttribute('aria-selected',String(reset.selected));pick.disabled=reset.disabled;pick.textContent=reset.textContent||'Clear instrument';pick.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();choose(reset);});row.append(pick);list.append(row);}
          for(const section of sections){
            const title=doc.createElement('div');title.className='kwant-choice-heading';title.textContent=manualSymbols&&section.label==='All tickers (A–Z)'?'Symbols (A–Z)':section.label;list.append(title);
            for(const native of optionSections(section.options)){
              if(native.label){const heading=doc.createElement('div');heading.className='kwant-choice-heading';heading.textContent=native.label;list.append(heading);}
            for(const option of native.options){
              const row=doc.createElement('div');row.className='kwant-choice-option-row';
              const pick=doc.createElement('button');pick.type='button';pick.setAttribute('role','option');pick.setAttribute('aria-selected',String(option.source.selected));pick.disabled=option.disabled;pick.textContent=option.menuLabel||option.label;
              pick.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();choose(option.source);});
              const star=doc.createElement('button');star.type='button';star.className='kwant-choice-favourite';const favourite=prefs.favourites.includes(option.value);
              star.textContent=favourite?'★':'☆';star.setAttribute('aria-label',`${favourite?'Remove':'Add'} ${option.label} ${favourite?'from':'to'} favourites`);star.setAttribute('aria-pressed',String(favourite));
              const toggle=()=>{change(()=>preferences.toggleFavourite(group,option.value));(list.querySelector(`[data-favourite-value="${doc.defaultView.CSS.escape(option.value)}"]`)||search).focus();};
              star.dataset.favouriteValue=option.value;
              star.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggle();});
              pick.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();star.focus();}else if(event.key==='*'){event.preventDefault();event.stopPropagation();toggle();}});
              star.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();pick.focus();}});
              row.append(pick,star);list.append(row);
            }}
          }
          const custom=preferences.customOptionFor?.({id:select.id,name:select.name,label:select.getAttribute('aria-label')||'',values:options.map(option=>option.value)},search.value);
          if(custom){const pick=doc.createElement('button');pick.type='button';pick.setAttribute('role','option');pick.setAttribute('aria-selected','false');pick.textContent=custom.label;
            const commitCustom=event=>{event.preventDefault();event.stopPropagation();if(committed)return;const option=doc.createElement('option');option.value=custom.value;option.textContent=custom.value;select.append(option);choose(option);};
            pick.addEventListener('click',commitCustom);list.append(pick);
            search.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();event.stopPropagation();if(!event.repeat)commitCustom(event);}};
          }else{const exact=group==='instruments'&&preferences.customOptionFor&&search.value.trim()?options.find(option=>!option.disabled&&option.value.toUpperCase()===search.value.trim().toUpperCase()):null;search.onkeydown=exact?event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();event.stopPropagation();if(!event.repeat)choose(exact.source);}}:null;}
          if(!sections.length&&!custom){const empty=doc.createElement('p');empty.className='kwant-choice-empty';empty.textContent=prefs.favouritesOnly?'No matching favourites. Choose All to star the options you want.':'No matching options.';list.append(empty);}
        };
        all.addEventListener('click',()=>change(()=>preferences.update(group,{favouritesOnly:false})));
        favourites.addEventListener('click',()=>change(()=>preferences.update(group,{favouritesOnly:true})));
        recent.addEventListener('change',()=>change(()=>preferences.update(group,{showRecents:recent.checked})));
        search.addEventListener('input',render);render();
      }else for(const native of optionSections([...select.options].map(source=>({source})))){
        if(native.label){const heading=doc.createElement('div');heading.className='kwant-choice-heading';heading.textContent=native.label;menu.append(heading);}
        for(const {source:option} of native.options) {
        const row = doc.createElement('button'); row.type = 'button'; row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(option.selected));
        row.disabled = option.disabled || Boolean(option.closest('optgroup')?.disabled);
        row.textContent = option.dataset.menuLabel || option.textContent;
        row.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          choose(option);
        });
        menu.append(row);
      }}
      // Keep nested choices inside their owning popup. Its outside-pointer and
      // scroll guards must see option interactions as inside, including native
      // dialogs in the top layer. Position remains fixed in viewport coordinates.
      (select.closest('dialog[open], .qtable-header-menu') || doc.body).append(menu);
      const rect = button.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, preferences?300:190), doc.defaultView.innerWidth - 16);
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.max(8, Math.min(rect.left, doc.defaultView.innerWidth - width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(rect.bottom + 7, doc.defaultView.innerHeight - Math.min(menu.scrollHeight, preferences?440:324) - 8))}px`;
      active = {select, button, menu}; button.setAttribute('aria-expanded', 'true');
      if(preferences?.isManualSymbolControl)claimMenu(doc,menu,reason=>close(reason==='escape'),button);
      (preferences?menu.querySelector('input[type="search"]'):menu.querySelector('[aria-selected="true"]:not(:disabled)') || menu.querySelector('button:not(:disabled)'))?.focus();
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
  observer.observe(doc.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'selected', 'label', 'aria-label']});
  doc.addEventListener('pointerdown', event => {
    if (active && !active.menu.contains(event.target) && !active.button.contains(event.target)) close();
  });
  doc.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') {
      if(!active.menu.classList.contains('with-preferences'))close();
      else {const focusable=[...active.menu.querySelectorAll('button:not(:disabled),input:not(:disabled)')];if(doc.activeElement===(event.shiftKey?focusable[0]:focusable.at(-1)))close();}
    }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      if(event.target.matches?.('input,textarea')&&event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
      if(event.target.matches?.('input,textarea')&&event.key==='ArrowUp')return;
      event.preventDefault();
      const rows = [...active.menu.querySelectorAll('[role="option"]:not(:disabled)')];
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
