import fs from "node:fs";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { CHART_INDICATOR_CATALOG, CHART_INDICATOR_CATEGORIES } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings, INDICATOR_NUMERIC_SETTINGS, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";
const theme={primary:"#d0d0d0",secondary:"#8080cc",positive:"#00cc88",negative:"#ee3355",muted:"#777777"};
const candles=Array.from({length:800},(_,i)=>{const open=20000+Math.sin(i/17)*60+i*.07;const close=open+Math.cos(i/5)*6;const askVolume=200+i%211,bidVolume=180+i%137;return{timestamp:1700000000000+i*60000,open,close,high:Math.max(open,close)+3,low:Math.min(open,close)-3,volume:askVolume+bidVolume,askVolume,bidVolume,delta:askVolume-bidVolume};});
const output=[];
for(const category of CHART_INDICATOR_CATEGORIES) for(const def of CHART_INDICATOR_CATALOG.filter(row=>row.category===category)){
 const settings=defaultIndicatorSettings(def.id);
 const run=settings=>calculateIndicatorSeries({instanceId:"audit",indicatorId:def.id,enabled:true,settings},candles,theme,{instrument:"NQ",tickSize:.25});
 let baseline;
 try{baseline=run(settings);}catch(error){output.push({id:def.id,category,status:"engine error",error:String(error)});continue;}
 if(!baseline.length){output.push({id:def.id,category,status:"dedicated runtime or additional data required",settings:[]});continue;}
 const before=JSON.stringify(baseline);
 const tests=[];
 for(const [key,value] of Object.entries(settings)){
  if(/version|preset|stableFootprintRows/i.test(key))continue;
  const numeric=(INDICATOR_NUMERIC_SETTINGS[def.id]??[]).find(item=>item.key===key);
  const variations=typeof value==="boolean"?[!value]:typeof value==="number"?[numeric?.min??0,numeric?.max??Math.max(value*2,20)]:typeof value==="string"&&/^#[a-f0-9]{6}$/i.test(value)?["#123456"]:[];
  if(!variations.length)continue;
  try{
   const changed=variations.some(next=>JSON.stringify(run({...settings,[key]:next}))!==before);
   const roundtrip=normalizeStoredIndicator({instanceId:"audit",indicatorId:def.id,enabled:true,settings:{...settings,[key]:variations[0]}});
   tests.push({key,status:changed?"output changed on fixture":"no change on fixture; trace renderer/data-dependent path",persisted:roundtrip.settings?.[key]===variations[0]});
  }catch(error){tests.push({key,status:"mutation failed",error:String(error)});}
 }
 output.push({id:def.id,category,status:"calculation mutation pass completed",settings:tests});
}
fs.writeFileSync("docs/audits/2026-11-04-indicator-controls/calculation-mutations.json",JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({indicators:output.length,calculated:output.filter(row=>row.settings?.length).length,errors:output.filter(row=>row.status==="engine error").length,changed:output.flatMap(row=>row.settings??[]).filter(row=>row.status.startsWith("output changed")).length}));
