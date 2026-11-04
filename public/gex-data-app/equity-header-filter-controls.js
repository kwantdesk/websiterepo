import {multiChoiceDropdown} from './choice-controls.js';
import {releaseMenu} from './menu-coordination.js';

const operatorLabels={DOES_NOT_EQUAL:'does not equal',EQUALS:'equals',GREATER_THAN:'is greater than',GREATER_THAN_OR_EQUAL_TO:'is greater than or equal to',LESS_THAN:'is less than',LESS_THAN_OR_EQUAL_TO:'is less than or equal to'};
const grouped=value=>{const text=String(value??''),match=/^(-?)(\d+)(\.\d*)?$/.exec(text.replaceAll(',',''));return match?match[1]+match[2].replace(/\B(?=(\d{3})+(?!\d))/g,',')+(match[3]??''):text;};

// Native Equity filter editor: complete values commit after typing, with a
// nested operator chooser. Other tables retain their explicit Apply workflow.
export function mountEquityHeaderFilter({host,fields,getCurrent,normalize,onCommit,schedule=setTimeout,cancel=clearTimeout,debounceMs=300}){
  const document=host.ownerDocument,make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;},choices=[];
  let descriptor=fields.find(field=>getCurrent(field.field))??fields[0],input,operator,pending=null,destroyed=false,valueDestroy=null,enumWasOpen=false;
  const stop=()=>{if(pending!==null)cancel(pending);pending=null;};
  function choice(label,entries,value,onChange){
    const root=make('div'),button=make('button'),list=make('div');root.className='qtable-equity-choice';list.className='qtable-equity-choice-options';button.type='button';button.setAttribute('aria-label',label);button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');list.setAttribute('role','listbox');list.setAttribute('aria-label',label+' options');list.hidden=true;
    const close=restore=>{list.hidden=true;button.setAttribute('aria-expanded','false');if(restore)button.focus?.();};
    const api={root,button,list,value,set(next){api.value=next;button.textContent=entries.find(([key])=>key===next)?.[1]??String(next);for(const option of list.children)option.setAttribute('aria-selected',String(option.dataset.value===next));},close};
    for(const [key,text]of entries){const option=make('button',text);option.type='button';option.dataset.value=key;option.setAttribute('role','option');option.addEventListener('click',()=>{api.set(key);close(true);onChange(key);});list.append(option);}
    button.addEventListener('click',()=>{const open=list.hidden;for(const other of choices)other.close(false);list.hidden=!open;button.setAttribute('aria-expanded',String(open));});root.append(button,list);api.set(value);choices.push(api);return api;
  }
  const fieldLabel=make('label','Field*'),operatorLabel=make('label','Operator*'),valueLabel=make('label','Value*'),valueHost=make('div'),error=make('div');host.className='qtable-header-menu-section qtable-equity-filter-editor';error.className='qtable-header-filter-error';error.setAttribute('role','alert');
  if(fields.length===1){const name=make('input');name.value=descriptor.label;name.readOnly=true;name.setAttribute('aria-label','Field');fieldLabel.append(name);}else{const fieldChoice=choice('Field',fields.map(field=>[field.key,field.label]),descriptor.key,key=>{stop();descriptor=fields.find(field=>field.key===key);renderValue();});fieldLabel.append(fieldChoice.root);}
  function queue(){
    stop();pending=schedule(()=>{pending=null;if(destroyed)return;try{
      const raw=descriptor.type==='enum'?String(input.value??'').split(',').map(value=>value.trim()).filter(Boolean):input.value;
      if(raw===''||Array.isArray(raw)&&!raw.length){onCommit(descriptor,null,null);error.textContent='';return;}
      if(descriptor.type==='number'){
        const plain=String(raw).replaceAll(',','');if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(plain)||descriptor.integer&&!Number.isInteger(Number(plain)))throw Error('Enter a complete '+descriptor.label+' value.');
      }
      const update=normalize(descriptor,operator.value,raw);onCommit(descriptor,update.operator,update.value);error.textContent='';
    }catch(failure){error.textContent=failure.message;}},debounceMs);
  }
  function renderValue(){
    valueDestroy?.();valueDestroy=null;enumWasOpen=false;error.textContent='';const current=getCurrent(descriptor.field),operators=Object.entries(descriptor.operatorLabels??operatorLabels).filter(([key])=>descriptor.operators.includes(key));
    operator?.close(false);if(operator){choices.splice(choices.indexOf(operator),1);operator.root.remove?.();}
    operator=choice(descriptor.label+' operator',operators,current?.operator??'EQUALS',queue);operatorLabel.replaceChildren(make('span','Operator*'),operator.root);
    if(descriptor.type==='enum'){
      input=multiChoiceDropdown({document,choices:descriptor.choices.map(value=>[value,descriptor.rawChoiceLabels?value:value.replaceAll('_',' ')]),values:Array.isArray(current?.value)?current.value:current?.value==null?[]:[current.value],label:descriptor.label+' value',emptyLabel:'Select values',searchable:true});input.addEventListener('toggle',()=>{enumWasOpen=input.open;});valueDestroy=()=>{input.open=false;releaseMenu(document,input);};
    }else if(descriptor.type==='boolean'){
      const booleanChoice=choice(descriptor.label+' value',[['','Select value'],['true','true'],['false','false']],current?.value==null?'':String(current.value),queue);input=booleanChoice.root;Object.defineProperty(input,'value',{get:()=>booleanChoice.value});valueDestroy=()=>{booleanChoice.close(false);choices.splice(choices.indexOf(booleanChoice),1);};
    }else{input=make('input');input.type='text';input.value=descriptor.type==='number'?grouped(current?.value):String(current?.value??'');if(descriptor.type==='number')input.inputMode='decimal';input.addEventListener('input',()=>{if(descriptor.type==='number')input.value=grouped(input.value);queue();});}
    input.setAttribute('aria-label',descriptor.label+' value');input.addEventListener('change',queue);valueHost.replaceChildren(input);
  }
  valueLabel.append(valueHost);host.append(fieldLabel,operatorLabel,valueLabel,error);renderValue();
  return {escape(){const open=[...choices].reverse().find(choice=>!choice.list.hidden);if(open){open.close(true);return true;}if(input?.open||enumWasOpen){enumWasOpen=false;input.open=false;releaseMenu(document,input);return true;}return false;},destroy(){destroyed=true;stop();valueDestroy?.();for(const item of choices)item.close(false);}};
}
