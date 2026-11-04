import type {GexMapPanelPayload} from '../../src/lib/gexMap';
export const projectionStart=Date.parse('2026-11-03T14:30:00Z');
export function projectionFixture(source='QQQ'){
 const start=projectionStart,minute=60000,isBasis=source==='NDX'||source==='SPX',base=isBasis?20000:500;
 const candles=Array.from({length:24},(_,i)=>{const open=base+(i%2===0?0:5);const close=base+(i%2===0?5:0);return{timestamp:start+i*minute,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume:100}});
 const rows=[{strike:base-5,call:0,put:-100e6,net:-100e6},{strike:base,call:70e6,put:0,net:70e6},{strike:base+5,call:30e6,put:0,net:30e6}];
 const payload:GexMapPanelPayload={symbol:source as GexMapPanelPayload["symbol"],greekMode:'GAMMA',sessionDate:'2026-11-03',expiration:'2026-11-03',expirations:['2026-11-03'],scope:'FRONT_EXPIRY',model:'STRUCTURAL_OI',representation:'PER_ONE_DOLLAR_MOVE',asOf:new Date(start+23*minute+30000).toISOString(),status:'LIVE',refreshAfterMs:5000,stockPrice:candles.at(-1)!.close,sessionChangePercent:0,sourceTimeZone:'America/New_York',source:'KwantData Interval Map',netExposure:0,grossExposure:0,rateLimitRemaining:null,latestStrikes:rows,frames:candles.map(c=>({timestamp:c.timestamp,updates:rows})),candles};
 return{payload,base,start,minute,rows,displayPriceAt:(timestamp:number)=>{const candle=candles.find(c=>c.timestamp<=timestamp&&timestamp<c.timestamp+minute);return candle?(isBasis?candle.open+20:candle.open*40):null}};
}
