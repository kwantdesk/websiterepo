// Deterministic calculation audit; does not establish live provider completeness.
// node --import ./scripts/alias-hook.mjs scripts/audit-es-indicators.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { CHART_INDICATOR_CATALOG } from '../src/lib/chartIndicatorCatalog.ts';
import { defaultIndicatorSettings } from '../src/lib/chartIndicatorConfig.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { buildFootprintBars } from '../src/lib/footprint.ts';
import { auditIndicatorLibrary } from './audit-indicator-library.mjs';
import { buildDeepProfileSwingFrame } from '../src/lib/deepProfileSwing.ts';
import { buildDeepProfileValuesFrame } from '../src/lib/deepProfileValues.ts';

const theme={primary:'#11ccdd',secondary:'#ddaa11',positive:'#00dd88',negative:'#ff4466',muted:'#888888'};
const start=Date.parse('2026-10-19T00:00:00Z');
const candles=Array.from({length:2880},(_,i)=>{
  const open=7700+Math.round(24*Math.sin(i/43)+8*Math.cos(i/7))*.25;
  const close=open+(i%7-3)*.25, bidVolume=50+i%41, askVolume=40+i%53;
  return {timestamp:start+i*60000,open,close,high:Math.max(open,close)+.5,
    low:Math.min(open,close)-.5,volume:bidVolume+askVolume,bidVolume,askVolume,
    delta:askVolume-bidVolume,trades:10+i%15};
});
const records=candles.flatMap((c,i)=>[
  {recordIndex:i*2,timestamp:c.timestamp+1000,open:c.open,high:c.open,low:c.open,close:c.open,volume:c.bidVolume,bidVolume:c.bidVolume,askVolume:0,delta:-c.bidVolume,trades:1,aggressor:'SELL'},
  {recordIndex:i*2+1,timestamp:c.timestamp+2000,open:c.close,high:c.close,low:c.close,close:c.close,volume:c.askVolume,bidVolume:0,askVolume:c.askVolume,delta:c.askVolume,trades:1,aggressor:'BUY'},
]);
const footprintBars=buildFootprintBars(candles,records,{instrument:'ES',tickSize:.25,groupTicks:1,minimumTradeVolume:0,maximumTradeVolume:0,imbalanceMode:'diagonal',minimumImbalancePercent:300,minimumDelta:0,includeZero:false});
assert.equal(footprintBars.length,candles.length);
for(const bar of footprintBars) for(const row of bar.levels) assert.equal(row.price*4,Math.round(row.price*4));
const rows=CHART_INDICATOR_CATALOG.map(d=>{
  try {
    const series=calculateIndicatorSeries({instanceId:`audit-${d.id}`,indicatorId:d.id,enabled:true,settings:defaultIndicatorSettings(d.id)},candles,theme,{instrument:'ES',tickSize:.25,footprintBars});
    let points=0;
    for(const plot of series) for(const point of plot.data){
      for(const key of ['time','value','open','high','low','close']) if(point[key]!=null) assert.ok(Number.isFinite(point[key]),`${d.id}: nonfinite ${key}`);
      points++;
    }
    return {id:d.id,name:d.name,category:d.category,series:series.length,points,status:series.length?'finite-calculation':'dedicated-path-or-no-signal'};
  } catch(error){return {id:d.id,name:d.name,status:'failed',error:String(error)};}
});
const report={fixture:'2,880 synthetic ES minute bars, quarter-tick prices, classified bid/ask executions. Not live-market proof.',
  registry:auditIndicatorLibrary(),footprintBars:footprintBars.length,rows};
report.dedicatedProfiles=[];
for(const [name,build] of [['swing',buildDeepProfileSwingFrame],['values',buildDeepProfileValuesFrame]]){
  const frame=build(footprintBars,'ES','ESZ6',.25,{automaticGrouping:false,manualGroupTicks:1},records);
  assert.ok(frame.profiles.length>0,`${name}: missing ES profiles`);
  for(const profile of frame.profiles){
    assert.equal(profile.tickSize,.25);
    assert.equal(profile.root,'ES');
    for(const row of profile.levels) assert.ok(Number.isFinite(row.volume)&&row.price*4===Math.round(row.price*4));
  }
  report.dedicatedProfiles.push({name,status:frame.status,profiles:frame.profiles.length});
}
writeFileSync('tmp/es-indicator-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:rows.length,finite:rows.filter(r=>r.status==='finite-calculation').length,dedicatedOrNoSignal:rows.filter(r=>r.status==='dedicated-path-or-no-signal').length,failed:rows.filter(r=>r.status==='failed'),registry:report.registry}));
if(rows.some(r=>r.status==='failed')) process.exitCode=1;
