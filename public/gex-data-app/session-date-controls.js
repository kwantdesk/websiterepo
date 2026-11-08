import {claimMenu,releaseMenu} from './menu-coordination.js';

// Session dates are calendar keys, not timestamps. UTC is used only to lay out
// the calendar; this control neither converts market clocks nor requests data.
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const label=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
const adjacent=(month,offset)=>{const [year,index]=month.split('-').map(Number);return new Date(Date.UTC(year,index-1+offset,1,12)).toISOString().slice(0,7);};

export function mountSessionDateControls({host,popup,getScope,onChange,label:fieldLabel='Session Date',emptyLabel='Current'}){
  const document=host.ownerDocument,node=(tag,className='',text)=>{const result=document.createElement(tag);result.className=className;if(text!==undefined)result.textContent=text;return result;};
  const button=(text,action)=>{const result=node('button','',text);result.type='button';result.addEventListener('click',action);return result;};
  const root=node('div','control'),trigger=button(emptyLabel+'',open);trigger.className='kwant-choice-trigger';trigger.setAttribute('aria-label',fieldLabel);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');root.append(trigger);host.append(root);
  let destroyed=false,active=null,lastKey='';
  function close(){const previous=active;active=null;if(previous){releaseMenu(document,previous);if(previous.ownerDocument!==document)releaseMenu(previous.ownerDocument,previous);previous.remove();}trigger.setAttribute('aria-expanded','false');}
  function scope(){const raw=getScope()||{};return {date:validDate(raw.date)?raw.date:'',currentDate:validDate(raw.currentDate)?raw.currentDate:'',minDate:validDate(raw.minDate)?raw.minDate:'',disabled:!!raw.disabled};}
  function sync(){if(destroyed)return;const current=scope(),key=JSON.stringify(current);if(key!==lastKey)close();lastKey=key;trigger.textContent=(current.date?label(current.date):emptyLabel)+'';trigger.disabled=current.disabled;trigger.title=current.disabled?'Session date is controlled by page or global filters':current.date?'Selected session date':'Current session';}
  function open(){
    if(destroyed)return;sync();const current=scope();if(current.disabled)return;if(active){close();return;}
    let month=(current.date||current.currentDate||new Date().toISOString().slice(0,10)).slice(0,7),content;
    const key=lastKey,menu=popup(trigger,fieldLabel,section=>{content=node('div','net-drift-contract-content');if(!section.classList.contains('kwant-date-input-menu')){section.classList.add('net-drift-contract-picker','surface-selection-menu');const css=node('link');css.rel='stylesheet';css.href=new URL('./net-drift-contract-controls.css',import.meta.url).href;section.append(css);}section.append(content);});
    active=menu;trigger.setAttribute('aria-expanded','true');const dismiss=reason=>{close();if(reason==='escape')trigger.focus();};claimMenu(document,menu,dismiss,trigger);if(menu.ownerDocument!==document)claimMenu(menu.ownerDocument,menu,dismiss,trigger);
    const isCurrent=()=>!destroyed&&active===menu&&menu.isConnected!==false&&lastKey===key&&JSON.stringify(scope())===key&&!scope().disabled;
    const commit=date=>{if(!isCurrent()||(date&&(!validDate(date)||(current.currentDate&&date>current.currentDate)||(current.minDate&&date<current.minDate))))return;onChange(date);close();sync();};
    function render(){
      if(!isCurrent())return;content.replaceChildren();const navigation=node('div','net-drift-calendar-navigation'),previous=button('‹',()=>{if(!isCurrent())return;month=adjacent(month,-1);render();}),next=button('›',()=>{if(!isCurrent())return;month=adjacent(month,1);render();});
      previous.setAttribute('aria-label','Previous month');previous.disabled=!!current.minDate&&month<=current.minDate.slice(0,7);next.setAttribute('aria-label','Next month');next.disabled=!!current.currentDate&&month>=current.currentDate.slice(0,7);
      navigation.append(previous,node('strong','',new Date(month+'-01T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'long',year:'numeric'})),next);content.append(navigation);
      const grid=node('div','net-drift-calendar-grid');for(const day of ['Su','Mo','Tu','We','Th','Fr','Sa'])grid.append(node('span','net-drift-calendar-weekday',day));
      const first=new Date(month+'-01T12:00:00Z'),days=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();for(let index=0;index<first.getUTCDay();index++)grid.append(node('span'));
      for(let day=1;day<=days;day++){const date=month+'-'+String(day).padStart(2,'0'),item=button(String(day),()=>commit(date));item.disabled=!!((current.currentDate&&date>current.currentDate)||(current.minDate&&date<current.minDate));item.setAttribute('aria-label',label(date));item.setAttribute('aria-pressed',String(date===current.date));if(date===current.date)item.className='is-selected';grid.append(item);}
      const clear=button('Clear',()=>commit(''));clear.className='net-drift-clear';content.append(grid,clear);
    }
    render();
  }
  sync();return {sync,destroy(){if(destroyed)return;destroyed=true;close();root.remove();}};
}
