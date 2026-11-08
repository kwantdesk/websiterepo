// Calendar-date selection only. The request model owns market-time conversion.
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const label=date=>validDate(date)?new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}):'';
const adjacent=(month,offset)=>{const [year,index]=month.split('-').map(Number);return new Date(Date.UTC(year,index-1+offset,1,12)).toISOString().slice(0,7);};

export function mountOptionTapeSessionControls({host,popup,getScope,onChange,validateSelection=()=>{},monthsVisible=1,commitOnSelect=false,clearLabel='Current session',emptyHint='',businessDayEndpoints=false,toggleSameDay=false,continueSingleDayRange=false,closeCompletedRange=false,singleLineTrigger=false}){
  const document=host.ownerDocument,node=(tag,className='',text)=>{const result=document.createElement(tag);result.className=className;if(text!==undefined)result.textContent=text;return result;};
  const button=(text,action)=>{const result=node('button','',text);result.type='button';result.addEventListener('click',action);return result;};
  const root=node('div','control'),trigger=button('Session Date Range',open);trigger.className='kwant-choice-trigger'+(singleLineTrigger?' session-range-trigger-nowrap':'');trigger.setAttribute('aria-label','Session Date Range');trigger.setAttribute('aria-haspopup','dialog');root.append(trigger);host.append(root);
  let destroyed=false,active=null,lastKey='',committing=false;
  const close=()=>{active?.remove();active=null;};
  function scope(){const raw=getScope()||{};return {...raw,startDate:validDate(raw.startDate)?raw.startDate:'',endDate:validDate(raw.endDate)?raw.endDate:''};}
  function sync(){
    if(destroyed)return;const current=scope(),key=JSON.stringify(current);if(key!==lastKey&&!committing)close();lastKey=key;
    const start=current.startDate||current.endDate,end=current.endDate||current.startDate;
    root.className='control'+(singleLineTrigger&&start&&end!==start?' session-range-single-line':'');
    trigger.textContent=(start?label(start)+(end!==start?' – '+label(end):''):'Session Date Range')+'';trigger.disabled=!!current.disabled;
    trigger.title=current.disabled?'Session date is controlled by page or global filters':start?'Selected session dates':'Current session';
  }
  function open(){
    const current=scope();if(destroyed||current.disabled)return;close();
    let start=current.startDate||current.endDate,end=current.endDate||current.startDate,expectEnd=continueSingleDayRange&&!!start&&start===end,month=(start||current.currentDate||'1970-01-01').slice(0,7),error='';
    let key=lastKey,content;
    const menu=popup(trigger,'Session Date Range',section=>{
      section.classList.add('net-drift-contract-picker','surface-selection-menu');const css=node('link');css.rel='stylesheet';css.href=new URL('./net-drift-contract-controls.css',import.meta.url).href;content=node('div','net-drift-contract-content');section.append(css,content);
      if(monthsVisible>1){section.style.width='min(640px, calc(100vw - 32px))';section.style.maxWidth='min(640px, calc(100vw - 32px))';}
    });
    active=menu;
    const isCurrent=()=>!destroyed&&active===menu&&menu?.isConnected!==false&&lastKey===key&&JSON.stringify(scope())===key&&!scope().disabled;
    const commit=(first,last,closeAfter=true)=>{if(!isCurrent())return;const selection={startDate:first,endDate:last};try{validateSelection(selection);}catch(reason){error=reason.message;render();return;}committing=true;try{onChange(selection);sync();key=lastKey;}finally{committing=false;}if(closeAfter)close();else render();};
    function render(){
      if(!isCurrent())return;content.replaceChildren();
      const navigation=node('div','net-drift-calendar-navigation'),previous=button('‹',()=>{month=adjacent(month,-1);render();}),next=button('›',()=>{month=adjacent(month,1);render();});
      previous.setAttribute('aria-label','Previous month');next.setAttribute('aria-label','Next month');next.disabled=validDate(current.currentDate)&&month>=current.currentDate.slice(0,7);
      navigation.append(previous);for(let index=0;index<monthsVisible;index++)navigation.append(node('strong','',new Date(adjacent(month,index)+'-01T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'long',year:'numeric'})));navigation.append(next);content.append(navigation);
      content.append(node('p','net-drift-choice-status',emptyHint|| (start?label(start)+(end!==start?' – '+label(end):''): 'Select one date or a range.')));
      if(error){const message=node('p','net-drift-choice-status',error);message.setAttribute('role','alert');content.append(message);}
      const calendars=node('div');if(monthsVisible>1){calendars.style.display='grid';calendars.style.gridTemplateColumns=`repeat(${monthsVisible}, minmax(0, 1fr))`;calendars.style.gap='16px';}
      for(let monthIndex=0;monthIndex<monthsVisible;monthIndex++){
      const shownMonth=adjacent(month,monthIndex),grid=node('div','net-drift-calendar-grid');for(const day of ['Su','Mo','Tu','We','Th','Fr','Sa'])grid.append(node('span','net-drift-calendar-weekday',day));
      const first=new Date(shownMonth+'-01T12:00:00Z'),days=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
      for(let index=0;index<first.getUTCDay();index++)grid.append(node('span'));
      for(let day=1;day<=days;day++){
        const date=shownMonth+'-'+String(day).padStart(2,'0'),weekday=new Date(date+'T12:00:00Z').getUTCDay(),disabled=validDate(current.currentDate)&&date>current.currentDate||businessDayEndpoints&&(weekday===0||weekday===6),item=button(String(day),()=>{
          if(!isCurrent()||disabled)return;
          error='';let completed=false;if(toggleSameDay&&start===date&&end===date){start=end='';expectEnd=false;}else if(!expectEnd){start=end=date;expectEnd=true;}else{[start,end]=[start,date].sort();expectEnd=false;completed=true;}if(commitOnSelect)commit(start,end,closeCompletedRange&&completed);else render();
        });
        item.disabled=disabled;item.setAttribute('aria-label',label(date));item.setAttribute('aria-pressed',String(!!start&&date>=start&&date<=end));if(start&&date>=start&&date<=end)item.className='is-selected';grid.append(item);
      }
      calendars.append(grid);}
      const clear=button(clearLabel,()=>{start=end='';commit('','');});clear.disabled=clearLabel==='Clear'&&!start&&!end;content.append(calendars,clear);
      if(!commitOnSelect){const apply=button('Apply',()=>commit(start,end));apply.disabled=!validDate(start)||!validDate(end);content.append(apply);}
    }
    render();
  }
  sync();return {sync,destroy(){if(destroyed)return;destroyed=true;close();root.remove();}};
}
