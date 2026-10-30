import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{normalizeControlValue,SETTING_CONTROLS,synchronizeSettingsControls}from'../public/heatmap-app/src/settings-controls.js';import{RollingDepthEngine}from'../public/heatmap-app/src/depth-engine.js';
const numeric={type:'range',min:'0',max:'100',step:'1'};
test('zero disables filtering; one includes every one-contract execution, two excludes only single lots',()=>{const e=new RollingDepthEngine();e.append({id:1,timestamp:1000,bids:new Map(),asks:new Map(),trades:[1,1,2,15].map((size,i)=>({id:i,timestamp:1000+i,tick:100+i,side:'buy',size}))});for(const min of [0,1,2,15,16]){const g=e.clusterTrades({minimumTradeSize:min,minimumPixelVolume:0,smartClustering:0});assert.equal(g.reduce((s,x)=>s+x.total,0),[1,1,2,15].filter(n=>n>=min).reduce((s,n)=>s+n,0));}assert.deepEqual(e.clusterTrades({minimumTradeSize:0}),e.clusterTrades({minimumTradeSize:1}));});
test('invalid persisted numbers, bounded sliders, integer steps and native numeric strings normalize consistently',()=>{for(const bad of [NaN,Infinity,null,{},false,''])assert.equal(normalizeControlValue(numeric,bad,1),1);assert.equal(normalizeControlValue(numeric,'1',10),1);assert.equal(normalizeControlValue(numeric,-3,1),0);assert.equal(normalizeControlValue(numeric,500,1),100);assert.equal(normalizeControlValue(numeric,1.7,1),2);assert.equal(normalizeControlValue({...numeric,min:'0.1',max:'2.5',step:'0.05'},'0.15',1),.15);});
test('legacy false strings stay false, invalid choices fall back to valid defaults',()=>{assert.equal(normalizeControlValue({type:'checkbox'},'false',true),false);assert.equal(normalizeControlValue({type:'checkbox'},'broken',true),true);assert.equal(normalizeControlValue({options:[{value:'auto'}]},'broken','auto'),'auto');});
test('every mapped control exists exactly once in the actual HTML and has an input handler',()=>{const html=readFileSync('public/heatmap-app/index.html','utf8'),main=readFileSync('public/heatmap-app/src/main.js','utf8');for(const id of Object.keys(SETTING_CONTROLS)){assert.equal(html.split('id="'+id+'"').length-1,1,id);assert.ok(main.includes("'"+id+"'"),id);}});
test('saved false controls and toolbar lights agree, including disabled CVD and zero filters',()=>{
 const html=readFileSync('public/heatmap-app/index.html','utf8'), controls={},defaults={};
 for(const[id,key]of Object.entries(SETTING_CONTROLS)){
  const tag=html.match(new RegExp('<(?:input|select)[^>]*id="'+id+'"[^>]*>'))[0];
  const attr=name=>tag.match(new RegExp(name+'="([^"]*)"'))?.[1]||'';
  const control={type:attr('type'),min:attr('min'),max:attr('max'),step:attr('step')};
  if(tag.startsWith('<select')){const options=html.slice(html.indexOf(tag),html.indexOf('</select>',html.indexOf(tag))).matchAll(/<option value="([^"]*)"/g);control.options=[...options].map(m=>({value:m[1]}));}
  controls[id]=control;defaults[key]=control.type==='checkbox'?true:control.options?control.options[0].value:Number(attr('value')||attr('min'));
 }
 const classes={};for(const id of ['toggleHeatmap','toggleDom','toggleTrades','toggleProfile','toggleCvd'])controls[id]={classList:{toggle:(name,value)=>{classes[id]=value;}},setAttribute:(name,value)=>{controls[id][name]=value;}};
 const settings={...defaults,minimumTradeSize:0,minimumPixelVolume:0,trails:false,grid:false,trades:false,heatmap:false,profile:false,domVisible:false,cvdEnabled:false,cvdPanel:true};
 synchronizeSettingsControls(settings,{...defaults,trades:true,heatmap:true,profile:true,cvdPanel:true},id=>controls[id]);
 assert.equal(controls.minimumTradeSizeRange.value,'0');assert.equal(controls.minimumVolumeRange.value,'0');assert.equal(controls.showTrails.checked,false);assert.equal(controls.showGrid.checked,false);
 assert.deepEqual(Object.values(classes),[false,false,false,false,false]);assert.equal(controls.toggleTrades['aria-pressed'],'false');
});
