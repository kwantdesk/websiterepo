import {NativeVolumeProfilePrimitive} from "../../src/lib/nativeVolumeProfilePrimitive.ts";

export class ProfilePathStub {
  commands=[];
  rect(...args){this.commands.push(["rect",...args]);}
  roundRect(x,y,w,h){this.commands.push(["rect",x,y,w,h]);}
  moveTo(x,y){this.commands.push(["move",x,y]);}
  lineTo(x,y){this.commands.push(["line",x,y]);}
}

export function renderProfile({period="daily",mode="delta-volume",visualStyle="line",snapMode="off",
  showDelta=true,gradient=null,zeroDelta=false,inverted=false,drawing=false,
  symbol="NQ",tickSize=1,basePrice=100,pixelsPerTick=30,manualGroupTicks=1,automaticGrouping=false,autoGroupFactor=1,levelCount=6}={}){
  globalThis.Path2D=ProfilePathStub;
  const paths=[],state={};
  const context=new Proxy(state,{
    get:(target,key)=>{
      if(key==="fill"||key==="stroke")return path=>{
        if(path?.commands?.length)paths.push({kind:key,color:target[key==="fill"?"fillStyle":"strokeStyle"],commands:path.commands});
      };
      if(key==="createLinearGradient")return ()=>({kind:"gradient",addColorStop(){}});
      if(key==="measureText")return text=>({width:String(text).length*6});
      return key in target?target[key]:()=>{};
    },set:(target,key,value)=>{target[key]=value;return true;},
  });
  const startMs=Date.parse("2026-10-19T13:30:00Z"),endMs=startMs+600000;
  const origin=snapMode==="left"?-250:350;
  const mediaSize={width:1200,height:600};
  const scale={
    timeToCoordinate:t=>origin+(Number(t)-startMs/1000)/60*20,
    coordinateToLogical:x=>(x-origin)/20,logicalToCoordinate:x=>origin+Number(x)*20,
    getVisibleLogicalRange:()=>({from:-20,to:40}),width:()=>mediaSize.width,
  };
  const volumes=[100,200,300,160,240,120],deltas=[60,-100,0,80,-40,100];
  const levels=Array.from({length:levelCount},(_,i)=>{const volume=volumes[i%volumes.length];const delta=zeroDelta?0:deltas[i%deltas.length];return {
    price:basePrice+i*tickSize,volume,delta,bidVolume:(volume-delta)/2,askVolume:(volume+delta)/2,trades:volume/2,
  };});
  const profile={schemaVersion:"kwantify-volume-profile-v1",provider:"Rithmic",source:"CME executions",
    id:"test-profile",root:symbol,period,startMs,endMs,asOf:endMs,tickSize,groupTicks:1,levels,
    poc:basePrice+2*tickSize,vah:basePrice+4*tickSize,val:basePrice+tickSize,valueAreaHigh:basePrice+4*tickSize,valueAreaLow:basePrice+tickSize,totalVolume:levels.reduce((sum,row)=>sum+row.volume,0),developingPoc:[]};
  const style={mode,visualStyle,snapMode,showDelta,gradient,widthBasis:"percent",widthPercent:20,
    opacity:.75,borderWidth:1,automaticGrouping,autoGroupFactor,manualGroupTicks,valueAreaPercent:70,
    valueAreaColor:"#5566FF",outsideValueAreaColor:"#334455",positiveDeltaColor:"#22FF88",negativeDeltaColor:"#FF2255",
    pocColor:"#FFFFFF",showValueArea:true,showProfileOutline:true,showProfileSpine:false,
    showPocLine:false,showValueAreaLines:false,showPocHighlight:false,showText:false,
    showDevelopingPoc:false,showPeaks:false,showValleys:false,showBusinessZone:false,showVwap:false,
    showLevelLabels:false,showSummaryVolume:false,showSummaryTrades:false};
  const priceToCoordinate=p=>300+(inverted?1:-1)*(p-basePrice)*pixelsPerTick/tickSize;
  const primitive=new NativeVolumeProfilePrimitive();
  primitive.attached({series:{priceToCoordinate,coordinateToPrice:y=>basePrice+(inverted?1:-1)*(y-300)*tickSize/pixelsPerTick},chart:{timeScale:()=>scale},requestUpdate(){}});
  const model={id:"test-profile",profile,style,lastCandleTime:endMs/1000,intervalSeconds:60,
    maxVolume:300,maxAbsDelta:100,lowPrice:basePrice,highPrice:basePrice+(levelCount-1)*tickSize,
    ...(drawing?{drawingBounds:{startTime:startMs/1000,endTime:endMs/1000,firstPrice:99,secondPrice:106}}:{})};
  primitive.setModels([model]);
  primitive.paneViews()[0].renderer().draw({useMediaCoordinateSpace:cb=>cb({context,mediaSize})});
  return {paths,profile,model,primitive};
}
