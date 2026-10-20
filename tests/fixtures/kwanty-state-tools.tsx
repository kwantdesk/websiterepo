import {mountStateChartTools} from "../../src/components/kwanty/StateChartTools";
import type {InstitutionalVolumeProfile} from "../../src/lib/institutionalMarketData";
// No real transport: positive exact-profile branch deliberately uses fixture data.
(window as unknown as {mountFixtureStateTools: typeof mountStateChartTools}).mountFixtureStateTools=(element,api)=>mountStateChartTools(element,api,{
 frontMonth:async symbol=>({root:symbol,contractSymbol:symbol+"-SYNTHETIC",exchange:"CME",contractLabel:"Synthetic only",resolvedAt:Date.now(),resolutionSource:"isolated test"}),
 profile:async args=>{
  const levels=Array.from({length:25},(_,i)=>({price:497+i*.25,volume:100-Math.abs(i-12)*6,bidVolume:0,askVolume:0,delta:0,trades:1}));
  return {schemaVersion:"kwantify-volume-profile-v1",provider:"Rithmic",source:"SYNTHETIC TEST ONLY",root:args.symbol,contractSymbol:args.contractSymbol,period:"custom",startMs:args.startMs,endMs:args.endMs,complete:true,tickSize:.25,groupTicks:1,valueAreaPercent:args.valueAreaPercent,minTradeVolume:0,maxTradeVolume:0,totalVolume:sum(levels.map(l=>l.volume)),bidVolume:0,askVolume:0,delta:0,trades:25,poc:500,vah:502,val:498,vwap:500,standardDeviation:1,levels,developingPoc:[],asOf:new Date().toISOString()} as InstitutionalVolumeProfile;
 }
});
function sum(values:number[]){return values.reduce((a,b)=>a+b,0);}
