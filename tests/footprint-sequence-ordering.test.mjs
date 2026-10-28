import test from 'node:test';
import assert from 'node:assert/strict';
import {institutionalTradeToFootprintTrade, orderFootprintTrades} from '../src/lib/footprintTradeAdapter.ts';
import {buildFootprintBars, buildFootprintBarsCached} from '../src/lib/footprint.ts';

const at=Date.UTC(2026,9,28,0);
const record=(id,size=1,buy=true,timestamp=at)=>({eventId:id,recordIndex:Number(id)||0,timestamp,open:20000,high:20000,low:20000,close:20000,trades:1,volume:size,bidVolume:buy?0:size,askVolume:buy?size:0,delta:buy?size:-size,aggressor:buy?'BUY':'SELL'});
const adapt=(rows)=>rows.map((row,index)=>institutionalTradeToFootprintTrade(row,'NQ',.25,index));
const settings={tickSize:.25,groupTicks:1,minimumTradeVolume:0,maximumTradeVolume:0,imbalanceMode:'diagonal',minimumImbalancePercent:300,minimumDelta:0,includeZero:false,instrument:'NQ'};
const candle={timestamp:at,open:20000,high:20000,low:20000,close:20000};

test('same-millisecond numeric execution order matches the former collation rules exactly',()=>{
 const ids=['print-10','print-2','print-001','print-1','12','2','0002','a-9','a-10','A-1','print-2'];
 const trades=adapt(ids.map((id,i)=>record(id,1,true,at+Math.floor(i/8))));
 const unique=new Map();
 for(const trade of trades)if(!unique.has(String(trade.sequence)))unique.set(String(trade.sequence),trade);
 const expected=[...unique.values()].sort((a,b)=>a.timestamp-b.timestamp||String(a.sequence??'').localeCompare(String(b.sequence??''),undefined,{numeric:true})||a.arrivalIndex-b.arrivalIndex);
 assert.deepEqual(orderFootprintTrades(trades),expected);
 assert.equal(trades.length,ids.length,'sorting does not mutate source tape');
});

test('same-millisecond buy/sell path retains true numeric-sequence delta extrema',()=>{
 const records=[record('10',20,false),record('1',10),record('2',5)];
 const [bar]=buildFootprintBars([candle],records,settings);
 assert.deepEqual([bar.askVolume,bar.bidVolume,bar.deltaClose,bar.deltaHigh,bar.deltaLow],[15,20,-5,15,-5]);
});

test('busy repeated cached folds preserve all rows, totals and delta excursions',()=>{
 const records=Array.from({length:2500},(_,i)=>({...record(String(i),i%7+1,i%3!==0,at+Math.floor(i/20)),close:20000+(i%40)*.25}));
 // Include a reconnect duplicate; it must not increase footprint volume.
 records.push(records.at(-1));
 for(const inputType of ['volume','num-trades']){
  const cache={current:null},options={...settings,inputType};
  for(const length of [500,1500,2501]){
   const tape=records.slice(0,length);
   const actual=buildFootprintBarsCached(cache,[candle],tape,options);
   assert.deepEqual(actual,buildFootprintBars([candle],tape,options));
  }
 }
});
