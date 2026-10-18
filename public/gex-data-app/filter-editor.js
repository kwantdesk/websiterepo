import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
import { filterFieldsForTool, FILTER_OPERATORS, findFilterField, createFilterDraft, expressionToDraft, draftToExpression } from './filter-editor-model.js?v=1';
import { normalizeAPIExpression } from './preferences-model.js?v=1';
import {instrumentChoices,multiChoiceDropdown} from './choice-controls.js?v=1';

export function mountFilterEditor(host, { expression, onChange = () => {}, toolId } = {}) {
  const doc = host.ownerDocument, fields = filterFieldsForTool(toolId);
  let draft = expressionToDraft(expression,fields), destroyed = false, advancedDirty = false, advancedError = '';
  if(!Array.isArray(draft.filters))draft={conjunction:'OR',filters:[{conjunction:'AND',filters:[draft]}]};
  const root = doc.createElement('div'); root.className = 'qfe';
  const element = (tag, cls, text) => { const el=doc.createElement(tag); if(cls)el.className=cls; if(text!==undefined)el.textContent=text; return el; };
  const text = element('p','qfe-note','Conditions run on the licensed API before aggregation. Prices/premium are dollars. Multiple values in a row match any value (OR).');
  const limit = element('p','qfe-limit','API supports six comparison operators. Source-only Contains / Does not contain are unavailable.'+(fields.some(value=>value.unavailable)?' Exchange Group and Penny Program are shown but disabled until their public field support is verified.':''));
  const tree = element('div','qfe-tree'), status=element('p','qfe-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const advanced = element('details','qfe-advanced'), summary=element('summary','','Advanced API JSON');
  const raw=element('textarea','qfe-json');raw.rows=10;raw.setAttribute('aria-label','Advanced filter expression JSON');raw.spellcheck=false;
  const rawStatus=element('p','qfe-status');rawStatus.setAttribute('role','status');
  advanced.append(summary,raw,rawStatus);root.append(text,limit,tree,status,advanced);host.append(root);
  const button = (label,handler,cls='') => { const b=element('button',`qfe-button ${cls}`,label);b.type='button';b.addEventListener('click',handler);return b; };
  const labelControl = (label,control) => { const wrap=element(control.tagName==='DETAILS'?'div':'label','qfe-field');wrap.append(element('span','qfe-label',label),control);return wrap; };
  const select = (options,value,label) => { const el=element('select','qfe-select');el.setAttribute('aria-label',label);for(const [key,name,disabled]of options){const option=element('option','',name);option.value=key;option.disabled=!!disabled;el.append(option);}if(!options.some(([key])=>key===value)){const missing=element('option','',`${value} (unsupported)`);missing.value=value;el.prepend(missing);}el.value=value;return el; };
  function notify() {
    if(destroyed)return;
    let value=null,error=advancedError;
    if(!error){try{value=draftToExpression(draft,fields);}catch(problem){error=problem.message;}}
    status.textContent=error || 'Expression is valid. Save to apply this Filter Group.';status.classList.toggle('qfe-invalid',!!error);
    if(!advancedDirty)raw.value=value?JSON.stringify(value,null,2):'';
    onChange(value,{valid:!error,error:error||null,draft:structuredClone(draft)});
  }
  function rerender() { tree.replaceChildren();renderNode(draft,tree,null,-1,0,'1');notify(); }
  function renderNode(node,parent,container,index,depth,path) {
    if(Array.isArray(node.filters)) {
      const group=element('fieldset','qfe-set'),legend=element('legend','','Filter Set '+path),bar=element('div','qfe-set-bar');
      const conjunction=select([['AND','AND — match all'],['OR','OR — match any']],node.conjunction,`Filter Set ${path} conjunction`);
      conjunction.addEventListener('change',()=>{node.conjunction=conjunction.value;notify();});bar.append(labelControl('Match',conjunction));
      bar.append(button('Add Filter',()=>{node.filters.push(createFilterDraft(fields));rerender();}));
      const nested=button('Add Filter Set',()=>{node.filters.push({conjunction:'AND',filters:[createFilterDraft(fields)]});rerender();});nested.disabled=depth>=4;bar.append(nested);
      bar.append(button('Duplicate Filter Set',()=>{if(container){container.filters.splice(index+1,0,structuredClone(node));}else{draft={conjunction:'OR',filters:[structuredClone(node),structuredClone(node)]};}rerender();}));
      if(container)bar.append(button('Delete Filter Set',()=>{container.filters.splice(index,1);rerender();},'qfe-danger'));
      group.append(legend,bar);const children=element('div','qfe-children');node.filters.forEach((child,i)=>{if(i)children.append(element('div','qfe-conjunction',node.conjunction));renderNode(child,children,node,i,depth+1,`${path}.${i+1}`);});
      if(!node.filters.length)children.append(element('p','qfe-note','This set has no filters. Add a filter or delete the set.'));
      group.append(children);parent.append(group);return;
    }
    const row=element('div','qfe-row'),metadata=findFilterField(fields,node.field);
    const fieldSelect=select(fields.map(value=>[value.api,`${value.label}${value.unavailable?' — API unverified':''}`,!!value.unavailable]),node.field,`Filter ${path} field`);
    fieldSelect.addEventListener('change',()=>{const next=findFilterField(fields,fieldSelect.value);node.field=fieldSelect.value;node.operation=next?.defaultOperator||'EQUALS';node.text='';rerender();});
    const operators=FILTER_OPERATORS.filter(([operation])=>metadata?.operators.includes(operation));
    const opSelect=select(operators,node.operation,`Filter ${path} operator`);opSelect.addEventListener('change',()=>{node.operation=opSelect.value;notify();});
    let input;
    if(metadata?.kind==='boolean')input=select([['','Choose…'],['true','True'],['false','False']],node.text,`Filter ${path} value`);
    else if(metadata?.kind==='ticker'||metadata?.choices)input=multiChoiceDropdown({choices:metadata.kind==='ticker'?instrumentChoices():metadata.choices.map(value=>[value,value.replaceAll('_',' ')]),values:node.text.split(',').map(value=>value.trim()).filter(Boolean),label:`Filter ${path} value`,emptyLabel:'Choose values…'});
    else{input=element('input','qfe-input');input.type=metadata?.kind==='date'&&!node.text.includes(',')?'date':'text';input.value=node.text;input.setAttribute('aria-label',`Filter ${path} value`);input.placeholder=metadata?.kind==='date'?'YYYY-MM-DD':metadata?.kind==='dollars'?'Dollars, e.g. 100000':'Value; comma-separated for multiple';if(['number','dollars','integer'].includes(metadata?.kind))input.inputMode='decimal';}
    const change=()=>{node.text=input.value;advancedDirty=false;advancedError='';notify();};input.addEventListener(['SELECT','DETAILS'].includes(input.tagName)?'change':'input',change);
    row.append(labelControl('Field',fieldSelect),labelControl('Operator',opSelect),labelControl('Value',input));
    if(container){const remove=button('Remove Filter',()=>{container.filters.splice(index,1);rerender();},'qfe-danger');remove.disabled=container.filters.length===1;row.append(remove);}
    const unit=metadata?.kind==='dollars'?'Dollars, not cents.':metadata?.help;if(unit)row.append(element('small','qfe-value-help',unit));parent.append(row);
  }
  raw.addEventListener('input',()=>{advancedDirty=true;rawStatus.textContent='JSON draft changed. Use “Load JSON into editor” to validate and replace the visual draft.';});
  advanced.append(button('Load JSON into editor',()=>{try{const value=normalizeAPIExpression(JSON.parse(raw.value));let next=expressionToDraft(value,fields);draftToExpression(next,fields);if(!Array.isArray(next.filters))next={conjunction:'OR',filters:[{conjunction:'AND',filters:[next]}]};draft=next;advancedError='';advancedDirty=false;rawStatus.textContent='JSON loaded.';rerender();}catch(problem){advancedError=problem.message;rawStatus.textContent=problem.message;notify();}}));
  advanced.append(button('Discard JSON draft',()=>{advancedDirty=false;advancedError='';rawStatus.textContent='JSON draft discarded; visual conditions retained.';notify();}));
  if(!fields.length){tree.append(element('p','qfe-invalid','The source tool does not expose Filter Groups. This editor is unavailable for this tool.'));status.textContent='Unsupported source tool';advanced.hidden=true;onChange(null,{valid:false,error:'This source tool has no Filter Group field map.'});}
  else rerender();
  return {
    getExpression(){if(destroyed)throw new Error('Filter editor is destroyed.');if(!fields.length)throw new TypeError('This source tool has no Filter Group field map.');if(advancedDirty)throw new TypeError('Load or discard the changed JSON draft before saving.');if(advancedError)throw new TypeError(advancedError);return draftToExpression(draft,fields);},
    destroy(){destroyed=true;root.remove();},
  };
}
