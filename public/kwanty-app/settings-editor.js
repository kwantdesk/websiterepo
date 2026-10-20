import {themePaint} from './site-theme.js';
import {useThemeColour} from './theme-settings.js';
import {botStorage,botFetch} from './site-runtime.js';
import {ORDERFLOW_METRICS} from './orderflow-chart.js';
import {SOURCE_TIMEZONES} from './timezones.js';

const BASE=[['background','Chart Background','color'],['showCrosshairs','Show Cursor Crosshairs','boolean']];
const SPOT=[['show_spot_history','Spot History'],['candleUp','Candle Up','fixed'],['candleDown','Candle Down','fixed']];
const COUNTERPART={'net-convexity':'convexity-orderflow','net-gex':'gex-orderflow','aggregate-dex':'dex-orderflow','convexity-orderflow':'net-convexity','gex-orderflow':'net-gex','dex-orderflow':'aggregate-dex'};
export function editorRows(state){
 if(state.package==='orderflow'){
  const rows=[...BASE,['showCursorTooltip','Show Cursor Tooltip','boolean'],['showAxisTooltips','Axis Tooltips','boolean'],['showGrid','Grid','boolean'],['spotColor','Spot Color','color'],['candleUp','Candle Up','fixed'],['candleDown','Candle Down','fixed']];
  const metrics=new Set(state.panels.flatMap(p=>[p.metric,...(p.combine&&COUNTERPART[p.metric]?[COUNTERPART[p.metric]]:[])]));
  for(const metric of metrics){const d=ORDERFLOW_METRICS[metric];for(let i=0;i<2;i++)for(const [sign,j]of [['positive',0],['negative',1]])rows.push([`series:${d.fields[i]}:${sign}`,`${i?'Next':'Latest'} ${d.label} (${sign==='positive'?'+':'−'})`,null,d.colors[i*2+j]]);
   if(metric==='aggregate-dex')for(const [field,label,colors]of [['agg_call_dex','Aggregate Call DEX',[themePaint("lime"),themePaint("orange"),themePaint("#006400"),themePaint("#b8860b")]],['agg_put_dex','Aggregate Put DEX',[themePaint("crimson"),themePaint("#3682f0"),themePaint("#8b0000"),themePaint("#1e4c8c")]]])for(let i=0;i<2;i++)for(const [sign,j]of [['positive',0],['negative',1]])rows.push([`series:${i?'one_':''}${field}:${sign}`,`${i?'Next':'Latest'} ${label} (${sign==='positive'?'+':'−'})`,null,colors[i*2+j]]);
  }
  rows.push(['major_call_gamma','Major Call Gamma',null,themePaint("#00ff00")],['major_put_gamma','Major Put Gamma',null,themePaint("#ff0000")],['major_long_gamma','Major Long Gamma',null,themePaint("#00ffff")],['major_short_gamma','Major Short Gamma',null,themePaint("#ae4ad5")],['time_marker','Profile Time Marker',null,themePaint("#ff9800")]);return rows;
 }
 if(state.package==='state'&&state.greek){const greek=state.greek,title=greek[0].toUpperCase()+greek.slice(1),positive={get delta(){return themePaint("#4caf50");},get gamma(){return themePaint("#00ffff");},get vanna(){return themePaint("#3682f0");},get charm(){return themePaint("#daa520");}}[greek];return [...BASE,...(greek==='gamma'?[['major_long_gamma','Major Long Gamma',null,themePaint("#00ffff")],['major_short_gamma','Major Short Gamma',null,themePaint("#ae4ad5")]]:[]),[greek,'Long '+title,'fixed',positive],[greek+'_neg','Short '+title,'fixed',themePaint("#ae4ad5")],...[['five',5],['fifteen',15],['thirty',30]].map(([key,minute])=>[greek+'_'+key,`${title} (${minute} Min Prior)`,'boolean']),['call_skew','Call Skew',null,themePaint("#61ff00")],['put_skew','Put Skew',null,themePaint("#ff0000")],...SPOT,['expected_move','Expected Move (±1σ)',null,themePaint("#888888")],['showGrid','Grid','boolean']];}
 const rows=[...BASE,...(state.package==='classic'?[['zero_gamma','Zero Gamma']]:[]),['major_pos_vol',state.package==='state'?'Major Call Gamma':'Major Positive Volume'],['major_neg_vol',state.package==='state'?'Major Put Gamma':'Major Negative Volume'],...(state.package==='classic'?[['major_pos_oi','Major Positive OI'],['major_neg_oi','Major Negative OI']]:[]),...['one','five','ten','fifteen','thirty'].map((key,i)=>[key,[1,5,10,15,30][i]+' Min']),['gex_vol','Pos GEX by Volume','fixed'],['gex_vol_neg','Neg GEX by Volume','fixed'],...(state.package==='classic'?[['gex_oi','Pos GEX by OI','fixed'],['gex_oi_neg','Neg GEX by OI','fixed']]:[]),['show_volume','Show GEX Volume','boolean'],...(state.package==='classic'?[['show_oi','Show GEX OI','boolean']]:[]),...SPOT,...(state.package==='classic'?[['show_zero_gamma_history','Zero Gamma History'],['show_call_major_history','Major Positive History'],['show_put_major_history','Major Negative History']]:[]),['showGrid','Grid','boolean']];return rows;
}
export function readEditorSetting(settings,key){
 if(!key.startsWith('series:'))return settings[key];
 const [,field,sign]=key.split(':'),s=settings.series?.[field]||{};
 return {color:sign==='positive'?s.color:s.negativeColor,display:(sign==='positive'?s.showPositive:s.showNegative)!==false};
}
export function writeEditorSetting(settings,key,value,customized=false){
 if(key==='background'&&customized)settings.backgroundIsCustomized=true;
 if(!key.startsWith('series:')){if(customized&&typeof value==='object'&&value!==null)value.isCustomized=true;if(key==='spotColor'&&customized)settings.spotIsCustomized=true;settings[key]=value;return;}
 const [,field,sign]=key.split(':');settings.series??={};const s=settings.series[field]??={};
 s[sign==='positive'?'color':'negativeColor']=value.color;s[sign==='positive'?'showPositive':'showNegative']=value.display!==false;
 if(customized)s[sign==='positive'?'isCustomized':'negativeIsCustomized']=true;
}
export function colorParts(value){
 const named={get white(){return themePaint("#ffffff");},get cyan(){return themePaint("#00ffff");},get lime(){return themePaint("#00ff00");},get crimson(){return themePaint("#dc143c");},get magenta(){return themePaint("#ff00ff");},get orange(){return themePaint("#ffa500");},get yellow(){return themePaint("#ffff00");},get red(){return themePaint("#ff0000");}};let c=named[String(value).toLowerCase()]||value||themePaint("#00ffff");
 if(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c))return {hex:c.slice(0,7),alpha:c.length===9?Math.round(parseInt(c.slice(7),16)/255*100):100};
 return {get hex(){return themePaint("#00ffff");},alpha:100};
}
export function alphaColor(hex,alpha){return Math.max(0,Math.min(100,alpha))===100?hex:hex+Math.round(Math.max(0,Math.min(100,alpha))*2.55).toString(16).padStart(2,'0');}

export function mountSettingsEditor({state,settings,defaults,persist,redraw,clearViews,refresh,message,setSettings=value=>{state.settings[state.package]=value;}}){
 const $=s=>document.querySelector(s),make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;};
 const form=$('#settingsForm'),dialog=$('#settingsDialog');let activeRows=[];
 const zoneSelect=form.elements.timeZone;zoneSelect.replaceChildren();for(const group of ['Americas','Europe','Asia Pacific','Oceania','Africa','Atlantic']){const optgroup=make('optgroup');optgroup.label=group;for(const [value,label,offset]of SOURCE_TIMEZONES){const actualGroup=value==='Pacific/Honolulu'||value.startsWith('America/')?'Americas':value.startsWith('Europe/')?'Europe':value.startsWith('Asia/')?'Asia Pacific':value.startsWith('Australia/')||value.startsWith('Pacific/')?'Oceania':value.startsWith('Africa/')?'Africa':'Atlantic';if(actualGroup!==group)continue;const option=make('option','',label+' '+offset);option.value=value;optgroup.append(option);}zoneSelect.append(optgroup);}const utc=make('option','','UTC');utc.value='UTC';zoneSelect.append(utc);
 const candleMode=make('fieldset');candleMode.id='candleColorSettings';candleMode.innerHTML='<legend>Candle Colors</legend><label><input type="radio" name="candleColorMode" value="spot"> Spot</label><label><input type="radio" name="candleColorMode" value="metric"> Metric</label>';$('#chartTypeSettings').after(candleMode);
 function styleControls(row,key,label,value){
  const details=make('details','style-options'),summary=make('summary','','Style');details.append(summary);
  const add=(name,text,type,initial,options)=>{const l=make('label','',text),input=make(type==='select'?'select':'input');input.dataset.styleKey=key;input.dataset.styleProperty=name;input.setAttribute('aria-label',label+' '+text);if(type==='select')for(const item of options){const o=make('option','',item);o.value=item;input.append(o)}else{input.type=type;if(type==='number'){input.min='0.1';input.max='10';input.step='0.1';}}if(type==='checkbox')input.checked=initial!==false;else input.value=String(initial);l.append(input);details.append(l);return input;};
  if(!key.startsWith('series:')&&!['candleUp','candleDown','call_skew','put_skew'].includes(key)){
   add('size','Size','number',value?.size??(key.startsWith('gex_')||['delta','gamma','vanna','charm'].includes(key)?6.5:1));
   if(['show_spot_history','show_zero_gamma_history','show_call_major_history','show_put_major_history','expected_move','time_marker'].includes(key))add('lineType','Line style','select',value?.lineType||(key==='expected_move'||key==='show_zero_gamma_history'||key==='time_marker'?'dashed':key.includes('major_history')?'dotted':'solid'),['solid','dashed','dotted']);
   if(key==='show_spot_history')add('showHorizontalLine','Horizontal price line','checkbox',value?.showHorizontalLine!==false);
   if(key==='time_marker')add('showVerticalLine','Vertical time line','checkbox',value?.showVerticalLine!==false);
   if(key==='expected_move')add('labelPosition','Label position','select',value?.labelPosition||'auto',['auto','left','center','right']);
  }
  if(details.children.length>1)row.append(details);
 }
 $('#openSettings').addEventListener('click',()=>{
  const s=settings(),container=$('#settingsRows');container.replaceChildren();activeRows=editorRows(state);
  for(const [key,label,type,fallback]of activeRows){const row=make('div','setting-line'),labelNode=make('span','',label),inputs=make('span','setting-inputs'),value=readEditorSetting(s,key);row.append(labelNode,inputs);
   if(type!=='boolean'){const color=colorParts(typeof value==='string'?value:value?.color||fallback),input=make('input');input.type='color';input.dataset.color=key;input.value=color.hex;input.dataset.initialColor=color.hex;input.setAttribute('aria-label','Color for '+label);inputs.append(input);const opacity=make('input');opacity.type='number';opacity.min='0';opacity.max='100';opacity.step='1';opacity.value=color.alpha;opacity.dataset.alpha=key;opacity.dataset.initialAlpha=String(color.alpha);opacity.setAttribute('aria-label','Opacity for '+label);opacity.title='Opacity (%)';opacity.className='opacity-input';inputs.append(opacity);if(type!=='color')styleControls(row,key,label,value);}
   if(type!=='boolean'){const theme=make('button','use-theme-colour',key==='background'?'Use theme background':'Theme');theme.type='button';theme.setAttribute('aria-label','Use theme colour for '+label);theme.title='Apply and save the current theme colour; keep other settings';theme.addEventListener('click',()=>{useThemeColour(settings(),key);refresh();persist();redraw();const current=readEditorSetting(settings(),key),parts=colorParts(typeof current==='string'?current:current?.color||fallback),color=inputs.querySelector('[data-color]'),alpha=inputs.querySelector('[data-alpha]');color.value=color.dataset.initialColor=parts.hex;alpha.value=alpha.dataset.initialAlpha=String(parts.alpha);});inputs.append(theme);}
   if(type!=='color'){const check=make('input');check.type='checkbox';check.dataset.visibility=key;check.checked=typeof value==='object'?value?.display!==false:value!==false;check.disabled=type==='fixed';check.setAttribute('aria-label',label+' visibility');inputs.append(check);}container.append(row);
  }
  if(state.package==='orderflow'){const thresholds=make('fieldset');thresholds.append(make('legend','','Orderflow thresholds · '+state.ticker));for(const family of ['dex','gex','convexity']){const label=make('label','',family),input=make('input');input.type='number';input.min='0';input.step='any';input.dataset.threshold=family+' orderflow';input.value=s.flowThresholds?.[state.ticker]?.[family+' orderflow']||0;input.setAttribute('aria-label',family+' orderflow threshold');label.append(input);thresholds.append(label);}container.append(thresholds);}
  $('#alignmentSettings').hidden=state.package==='orderflow';candleMode.hidden=state.package!=='orderflow';
  for(const input of form.elements){if(input.type==='radio')input.checked=s[input.name]===input.value;else if(['priceMultiplier','priceOffset','timeZone'].includes(input.name))input.value=s[input.name];else if(input.name==='alignment')input.value=s.profileBarAlignment;}
  dialog.show();
 });
 $('#closeSettings').addEventListener('click',()=>dialog.close());
 $('#resetSettings').addEventListener('click',()=>{setSettings(defaults(state.package));dialog.close();persist();clearViews();refresh();redraw();});
 form.addEventListener('submit',event=>{
  event.preventDefault();const s=structuredClone(settings()),data=new FormData(form),multiplier=Number(data.get('priceMultiplier')),offset=Number(data.get('priceOffset'));
  if(!Number.isFinite(multiplier)||multiplier<=0||!Number.isFinite(offset)){message('Price multiplier must be positive and offset must be finite.');return;}
  for(const [key,,type]of activeRows){let value=readEditorSetting(s,key),next=typeof value==='object'?{...value}:{};const color=[...form.querySelectorAll('[data-color]')].find(e=>e.dataset.color===key),check=[...form.querySelectorAll('[data-visibility]')].find(e=>e.dataset.visibility===key);let customized=false;
   if(color){const alpha=[...form.querySelectorAll('[data-alpha]')].find(e=>e.dataset.alpha===key);next.color=alphaColor(color.value,Number(alpha.value));customized=color.value!==color.dataset.initialColor||alpha.value!==alpha.dataset.initialAlpha;if(key.startsWith('series:')&&!customized&&value?.color===undefined)delete next.color;}
   if(check)next.display=check.checked;
   for(const input of [...form.querySelectorAll('[data-style-key]')].filter(e=>e.dataset.styleKey===key))next[input.dataset.styleProperty]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;
   if(type==='boolean')writeEditorSetting(s,key,check.checked);else if(type==='color')writeEditorSetting(s,key,next.color,customized);else writeEditorSetting(s,key,next,customized);
  }
  for(const input of form.querySelectorAll('[data-threshold]')){s.flowThresholds??={};s.flowThresholds[state.ticker]??={};s.flowThresholds[state.ticker][input.dataset.threshold]=Math.max(0,Number(input.value)||0);}
  if(data.get('timeZone')!==s.timeZone)s.timeZoneIsCustomized=true;
  Object.assign(s,{spotViewMode:data.get('spotViewMode'),candleColorMode:data.get('candleColorMode')||'spot',priceMultiplier:multiplier,priceOffset:offset,profileBarAlignment:data.get('alignment'),timeZone:data.get('timeZone')});
  setSettings(s);persist();dialog.close();clearViews();refresh();redraw();
 });
}
