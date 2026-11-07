import fs from 'node:fs';
import {calculateIndicatorSeries} from '../src/lib/chartIndicatorEngine.ts';
import {CHART_INDICATOR_CATALOG,CHART_INDICATOR_CATEGORIES} from '../src/lib/chartIndicatorCatalog.ts';
import {defaultIndicatorSettings,INDICATOR_NUMERIC_SETTINGS,normalizeStoredIndicator} from '../src/lib/chartIndicatorConfig.ts';
const theme={primary:'#eeeeee',secondary:'#aaaaee',positive:'#00cc88',negative:'#ee3355',muted:'#777777'};
const fixtures=[60000,3600000].map(step=>Array.from({length:480},(_,i)=>{const open=20000+Math.sin(i/17)*60+i*.07,close=open+Math.cos(i/5)*6,askVolume=1+(i*13)%410,bidVolume=1+(i*17)%380;return{timestamp:Date.UTC(2026,10,6,20)-(480-i)*step,open,close,high:Math.max(open,close)+3,low:Math.min(open,close)-3,volume:askVolume+bidVolume,askVolume,bidVolume,askTrades:Math.ceil(askVolume/3),bidTrades:Math.ceil(bidVolume/4),delta:askVolume-bidVolume};}));
function contextFor(id,key,s){const out={...s};if(/Color$/.test(key))out.useThemeColors=false;
if(/^filtered/.test(key)&&key!=='filteredEnabled')out.filteredEnabled=true;
if(/^volume(?:Ask|Bid)Color$/.test(key))out.showBidAskVolumes=true;
if(id==='delta-cumulative-candlestick'&&['showAverageDeviations','deviationColor'].includes(key)){out.showAverage=true;if(key==='deviationColor')out.showAverageDeviations=true;}
if(id==='know-sure-thing-kst'&&key==='signalSecondaryColor')out.signalColorMode='slope';
if(id==='volume-delta-sprint'&&key==='bidColor')out.showBid=true;
if(id==='volume-delta-sprint'&&key==='askColor')out.showAsk=true;
if(id==='deep-delta'&&key==='markerMinimumDelta')out.markerEnabled=true;
if(['parabolic-sar','linear-regression'].includes(id)&&key==='secondaryColor')out.secondaryColorEnabled=true;
if(id==='inverse-cyber-cycle'&&key==='cycleASecondaryColor')out.cycleAAutoColor='slope';
if(id==='inverse-cyber-cycle'&&key==='cycleBSecondaryColor')out.cycleBAutoColor='slope';
if(id==='pivot-points'&&key==='referenceValue')out.customReferenceEnabled=true;if(/^filter(Min|Max)Volume$/.test(key))out.filteredEnabled=true;if(/^average/.test(key)){out.showAverage=true;out.showAverageDeviations=true;}if(/^smoothing/.test(key)&&key!=='smoothingEnabled')out.smoothingEnabled=true;if(id==='regression-channel'&&key.startsWith('zigZag'))out.mode='zig-zag';if(id==='zig-zag'&&key==='absoluteReversalPercent')out.zigZagMode='absolute-reversal';if(id==='deep-delta'&&/^level\d/.test(key)&&!key.endsWith('Enabled'))out[key.slice(0,6)+'Enabled']=true;return out;}
const rows=[];
for(const category of CHART_INDICATOR_CATEGORIES)for(const def of CHART_INDICATOR_CATALOG.filter(d=>d.category===category)){
const defaults=defaultIndicatorSettings(def.id),run=(s,c)=>calculateIndicatorSeries({instanceId:'semantic',indicatorId:def.id,enabled:true,settings:s},c,theme,{instrument:'NQ',tickSize:.25});const entries=[];
if(!fixtures.some(c=>run(defaults,c).length)){rows.push({id:def.id,status:'dedicated-model-fixtures-required',settings:[]});continue;}
for(const [key,value]of Object.entries(defaults)){
if(/version|preset/i.test(key))continue;const numeric=INDICATOR_NUMERIC_SETTINGS[def.id]?.find(n=>n.key===key),candidates=typeof value==='boolean'?[!value]:typeof value==='number'?[value+(numeric?.step||1),value-(numeric?.step||1),value*1.1,value/2,numeric?.min??0,numeric?.max??value*2]:typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value)?['#123456']:[];if(!candidates.length)continue;
const base=contextFor(def.id,key,defaults);let changed=false,attempts=0,errors=[];for(const c of fixtures){const normalizedBase=normalizeStoredIndicator({instanceId:'semantic',indicatorId:def.id,enabled:true,settings:base}).settings;const before=JSON.stringify(run(normalizedBase,c));for(const next of [...new Set(candidates)].filter(Number.isFinite.bind(Number)).concat(candidates.filter(v=>typeof v!=='number'))){if(next===value)continue;try{attempts++;const s=normalizeStoredIndicator({instanceId:'semantic',indicatorId:def.id,enabled:true,settings:{...base,[key]:next}}).settings;changed||=JSON.stringify(run(s,c))!==before;}catch(e){errors.push(String(e));}}}
entries.push({key,status:changed?'output-effect-observed':errors.length?'mutation-error':'no-effect-in-these-fixtures-review-renderer-or-data-gate',attempts,errors});}
rows.push({id:def.id,category,status:'multi-fixture-mutations-completed',settings:entries});}
fs.writeFileSync('docs/audits/2026-11-07-indicator-full-audit/semantic-mutations.json',JSON.stringify(rows,null,2));console.log(JSON.stringify({indicators:rows.length,checks:rows.reduce((n,r)=>n+r.settings.length,0),effects:rows.flatMap(r=>r.settings).filter(r=>r.status==='output-effect-observed').length,errors:rows.flatMap(r=>r.settings).filter(r=>r.errors.length).length}));
