import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
// Source-backed chart rules. See EXPOSURE-CHART-AUDIT.md for provenance and limits.
const CALL = ()=>themePaint("#00FF00"), PUT = ()=>themePaint("#FF0000");
const netMetrics = [
  ['CHARM_EXPOSURE','Net CHEX'], ['DELTA_EXPOSURE','Net DEX'],
  ['GAMMA_EXPOSURE','Net GEX'], ['VANNA_EXPOSURE','Net VEX'],
  ['OPEN_INTEREST','Net Open Interest'], ['PREMIUM','Net Premium'],
  ['TRADE_COUNT','Net Trade Count'], ['VOLUME','Net Volume']
];
const legMetrics = [
  ['ASK_PRICE','Ask Price','currency'], ['BID_PRICE','Bid Price','currency'],
  ['CHARM','Charm','decimal'], ['COLOR','Color','decimal'], ['DELTA','Delta','decimal'],
  ['GAMMA','Gamma','decimal'], ['IMPLIED_VOLATILITY','Implied Volatility','percent'],
  ['OMEGA','Omega','decimal'], ['OPTION_PRICE','Option Price','currency'],
  ['RHO','Rho','decimal'], ['SIGMA','Sigma','decimal'], ['SPEED','Speed','decimal'],
  ['THETA','Theta','decimal'], ['ULTIMA','Ultima','decimal'], ['VANNA','Vanna','decimal'],
  ['VEGA','Vega','decimal'], ['VETA','Veta','decimal'], ['VOMMA','Vomma','decimal'],
  ['ZOMMA','Zomma','decimal']
];

// Browser enum names omit NET_; the licensed REST enum used by this app includes it.
// All 46 REST names match https://quantdata.us/api/docs/endpoints/heat-map.
export const HEAT_METRICS = Object.freeze([
  ...netMetrics.map(([sourceName,label])=>Object.freeze({
    sourceName, apiName:`NET_${sourceName}`, label, group:'Net',
    format:sourceName==='PREMIUM'?'currency':'abbreviated',
    exposure:sourceName.endsWith('_EXPOSURE'), supportsMVC:sourceName.endsWith('_EXPOSURE'),
    functionType:['PREMIUM','TRADE_COUNT','VOLUME'].includes(sourceName)?'SUM':'REPLACE',
    get minColor(){return PUT();},get maxColor(){return CALL();}
  })),
  ...['CALL','PUT'].flatMap(leg=>legMetrics.map(([name,label,format])=>Object.freeze({
    sourceName:`${leg}_${name}`,apiName:`${leg}_${name}`,
    label:`${label} (${leg==='CALL'?'Calls':'Puts'})`,group:leg==='CALL'?'Call':'Put',
    format,exposure:false,supportsMVC:false,functionType:'REPLACE',
    get minColor(){return leg==='CALL'?CALL():PUT();},get maxColor(){return leg==='CALL'?CALL():PUT();}
  })))
]);

export function heatMetricFor(name) {
  return HEAT_METRICS.find(metric=>metric.apiName===name||metric.sourceName===name);
}

export function heatCellValue(cell, name) {
  if (!cell || typeof cell !== 'object') return 0;
  if (cell.value != null) return Number(cell.value)||0;
  const call=Number(cell.callValue)||0,put=Number(cell.putValue)||0;
  return heatMetricFor(name)?.exposure ? call+put : call-put;
}

export function heatCellColor(value,name,positiveMax,negativeMin,isMVC=false,mvcColor=themePaint("#7D1AD6")) {
  const metric=heatMetricFor(name);
  if (!metric || !Number.isFinite(value) || value===0) return 'transparent';
  if (metric.supportsMVC&&isMVC) return mvcColor;
  const extreme=value>0?positiveMax:negativeMin;
  if (!extreme) return 'transparent';
  const alpha=Math.max(51,Math.min(230,Math.round((value/extreme+.2)*255)));
  return `${value>0?metric.maxColor:metric.minColor}${alpha.toString(16).padStart(2,'0')}`;
}

// QD computeNiceValueTicks: round the DOMAIN outward, not just interior tick labels.
export function niceValueDomain(min,max,target=5) {
  if (!Number.isFinite(min)||!Number.isFinite(max)) return {min:0,max:1,ticks:[0,.25,.5,.75,1]};
  if (min===max) {const pad=Math.abs(min)>0?.05*Math.abs(min):1;return niceValueDomain(min-pad,max+pad,target);}
  const raw=(max-min)/Math.max(1,target),magnitude=10**Math.floor(Math.log10(raw)),fraction=raw/magnitude;
  const steps=[1,2,2.5,5,10];let unit=steps.at(-1);
  for(let i=0;i<steps.length-1;i++)if(fraction<=Math.sqrt(steps[i]*steps[i+1])){unit=steps[i];break;}
  const step=unit*magnitude,start=Math.floor(min/step)*step,end=Math.ceil(max/step)*step;
  const count=Math.round((end-start)/step)+1;
  return {min:start,max:end,ticks:Array.from({length:count},(_,i)=>start+i*step)};
}

export function exposureLegs(point,display='NET') {
  const call=Number(point.call)||0,put=Number(point.put)||0;
  if(display==='NET'){const net=call+put;return [{value:Math.max(net,0),color:CALL()},{value:Math.min(net,0),color:PUT()}];}
  return [...(display!=='PUT'?[{value:call,color:CALL()}]:[]),...(display!=='CALL'?[{value:put,color:PUT()}]:[])];
}

export function exposureValueDomain(points,display='NET',fromZero=false) {
  const maximum=points.reduce((max,point)=>exposureLegs(point,display).reduce((m,leg)=>Math.max(m,Math.abs(leg.value)),max),0);
  return niceValueDomain(fromZero?0:-maximum,maximum,7);
}

// Keep every strike in the model; this returns only the initial visible indices.
// Source walks at least 5 and at most 40 strikes each side, bounded near ±8% spot.
export function exposureStrikeWindow(strikes,spot) {
  if(!strikes.length)return [0,0];
  const centerPrice=Number.isFinite(spot)?spot:strikes[Math.floor(strikes.length/2)];
  let center=0;for(let i=1;i<strikes.length;i++)if(Math.abs(strikes[i]-centerPrice)<Math.abs(strikes[center]-centerPrice))center=i;
  const walk=direction=>{let result=center,count=0;for(let i=center+direction;i>=0&&i<strikes.length&&count<40;i+=direction){
    if(!(direction>0?strikes[i]<=centerPrice*1.08:strikes[i]>=centerPrice*.92)&&count>=5)break;
    result=i;count++;
  }return result;};
  return [walk(-1),walk(1)];
}

export const MAX_PAIN_STYLES=Object.freeze({
  get maxPainMarker(){return themePaint("#FFFFFF");},maxPainMarkerWidth:2,spotMarkerWidth:2,
  get timeSpotMarker(){return themePaint("#FFFFFF88");},timeSpotMarkerWidth:2
});

export function heatMapInitialWindow(width,height,expiries,strikes,spot,invertAxes=false) {
  if(!expiries.length||!strikes.length||!Number.isFinite(spot))return null;
  let center=0;for(let i=1;i<strikes.length;i++)if(Math.abs(Number(strikes[i])-spot)<Math.abs(Number(strikes[center])-spot))center=i;
  const strikeRadius=(invertAxes?width:height)/(invertAxes?160:50),lastStrike=strikes.length-1;
  const strikeWindow=[Math.max(0,Math.min(lastStrike,Math.round(center-strikeRadius))),Math.max(0,Math.min(lastStrike,Math.round(center+strikeRadius)))];
  const expiryCount=expiries.length,expiryFraction=Math.max(0,Math.min(1,(invertAxes?height:width)/(invertAxes?32:80)/expiryCount));
  const expiryWindow=[0,Math.round(expiryFraction*Math.max(0,expiryCount-1))];
  return {horizontal:invertAxes?strikeWindow:expiryWindow,vertical:invertAxes?expiryWindow:strikeWindow};
}

// Canvas rendering equivalent of QDNativeExposureBarChart's settled frame.
// Animation and persisted wheel/pan state are the caller's responsibility.
export function drawExposureBars(ctx,width,height,points,options={}) {
  const {orientation='HORIZONTAL',display='NET',byExpiration=false,spot,
    start=0,end=points.length-1,fromZero=false,grouped=false,
    axisName='Exposure',categoryName=byExpiration?'Expiration':'Strike Price ($)',
    primary=themePaint("#700FEC"),grid=themePaint("#250B48"),font='Aleph, sans-serif',axisFont=13,
    categoryFormatter=point=>byExpiration?point.label:String(point.strike??point.label),
    valueFormatter=value=>String(value),markers=[],hover=null,pointerX,pointerY,hideAxisTitles=false}=options;
  if(!points.length)return null;
  const first=Math.max(0,Math.min(points.length-1,start)),last=Math.max(first,Math.min(points.length-1,end));
  const visible=points.slice(first,last+1),vertical=orientation==='VERTICAL';
  const domain=exposureValueDomain(visible,display,fromZero);
  ctx.save();ctx.font=`bold ${axisFont}px ${font}`;ctx.fillStyle=themePaint("#FFFFFF");ctx.textBaseline='middle';
  const exposureWidth=Math.max(...domain.ticks.map(value=>ctx.measureText(valueFormatter(value)).width));
  const categoryWidth=Math.max(24,...visible.map(point=>ctx.measureText(categoryFormatter(point)).width));
  const left=Math.ceil(vertical?categoryWidth:exposureWidth)+8+22+8,right=width-16,top=8,bottom=height-(20+(vertical?22:0));
  if(right<=left||bottom<=top){ctx.restore();return null;}
  let categoryMin,categoryMax;
  const categoryValue=(point,index)=>byExpiration?index:Number(point.strike??point.label);
  if(byExpiration){categoryMin=first;categoryMax=last+1;}
  else {
    const firstValue=categoryValue(points[first],first),lastValue=categoryValue(points[last],last);
    let loStep=first<last?categoryValue(points[first+1],first+1)-firstValue:1;
    let hiStep=first<last?lastValue-categoryValue(points[last-1],last-1):1;
    if(loStep<=0)loStep=1;if(hiStep<=0)hiStep=1;
    categoryMin=firstValue-loStep/2;categoryMax=lastValue+hiStep/2;
  }
  const categoryRatio=(point,index)=>byExpiration?(index-first+.5)/Math.max(1,last-first+1):(categoryValue(point,index)-categoryMin)/Math.max(1e-9,categoryMax-categoryMin);
  const categoryPixel=(point,index)=>vertical?bottom-categoryRatio(point,index)*(bottom-top):left+categoryRatio(point,index)*(right-left);
  const exposurePixel=value=>vertical?left+(value-domain.min)/(domain.max-domain.min)*(right-left):bottom-(value-domain.min)/(domain.max-domain.min)*(bottom-top);
  const zero=exposurePixel(0);
  let priorExposureLabel=-Infinity;
  for(const value of domain.ticks){const pixel=exposurePixel(value);ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.beginPath();if(vertical){ctx.moveTo(pixel,top);ctx.lineTo(pixel,bottom);ctx.textAlign='center';const text=valueFormatter(value),half=ctx.measureText(text).width/2,labelX=Math.max(half+2,Math.min(width-half-2,pixel));if(labelX-half>priorExposureLabel+8){ctx.fillText(text,labelX,bottom+axisFont/2+6);priorExposureLabel=labelX+half;}}else{ctx.moveTo(left,pixel);ctx.lineTo(right,pixel);ctx.textAlign='right';ctx.fillText(valueFormatter(value),left-8,pixel);}ctx.stroke();}
  ctx.fillStyle=themePaint("#FFFFFF");ctx.textAlign='center';
  if(!hideAxisTitles){if(vertical){ctx.fillText(axisName,(left+right)/2,height-6);ctx.save();ctx.translate(12,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText(categoryName,0,0);ctx.restore();}
  else{ctx.save();ctx.translate(12,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText(axisName,0,0);ctx.restore();}}
  ctx.strokeStyle=primary;ctx.lineWidth=2;ctx.beginPath();if(vertical){ctx.moveTo(left,top);ctx.lineTo(left,bottom);}else{ctx.moveTo(left,bottom);ctx.lineTo(right,bottom);}ctx.stroke();
  let prior=vertical?Infinity:-Infinity;
  const drawCategoryLabel=(label,pixel)=>{
    ctx.fillStyle=themePaint("#FFFFFF");ctx.strokeStyle=primary;ctx.lineWidth=2;ctx.beginPath();
    if(vertical){if(pixel+axisFont/2>prior-6)return;prior=pixel-axisFont/2;ctx.textAlign='right';ctx.moveTo(left,pixel);ctx.lineTo(left-4,pixel);ctx.fillText(label,left-8,pixel);}
    else{const labelWidth=ctx.measureText(label).width;if(pixel-labelWidth/2<prior+8)return;prior=pixel+labelWidth/2;ctx.textAlign='center';ctx.moveTo(pixel,bottom);ctx.lineTo(pixel,bottom+4);ctx.fillText(label,pixel,bottom+axisFont/2+6);}ctx.stroke();
  };
  if(byExpiration){const spacing=(vertical?bottom-top:right-left)/Math.max(1,last-first+1),every=Math.max(1,Math.ceil((vertical?2.2*axisFont:categoryWidth+12)/spacing));for(let index=first;index<=last;index+=every)drawCategoryLabel(categoryFormatter(points[index]),categoryPixel(points[index],index));}
  else{const size=vertical?bottom-top:right-left,number=Math.max(2,Math.min(12,Math.floor(size/(vertical?2.2*axisFont:Math.max(24,categoryWidth)+16))));for(const value of niceValueDomain(categoryMin,categoryMax,number).ticks){if(value<categoryMin||value>categoryMax)continue;drawCategoryLabel(categoryFormatter({strike:value,label:value}),categoryPixel({strike:value,label:value},0));}}
  const categorySize=vertical?bottom-top:right-left;
  let spacing=Infinity;for(let index=first+1;index<=last;index++)spacing=Math.min(spacing,Math.abs(categoryPixel(points[index],index)-categoryPixel(points[index-1],index-1)));
  const barWidth=Math.max(1,Math.min(64,.6*(Number.isFinite(spacing)?spacing:categorySize)));
  ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  for(let index=first;index<=last;index++){
    const point=points[index],center=categoryPixel(point,index),legs=exposureLegs(point,display);
    legs.forEach((leg,legIndex)=>{if(!leg.value)return;const valuePixel=exposurePixel(leg.value),both=grouped&&legs.length===2,thickness=both?barWidth/2:barWidth,offset=both?(legIndex===0?-thickness:0):-thickness/2;ctx.fillStyle=leg.color;
      if(vertical)ctx.fillRect(Math.min(zero,valuePixel),center+offset,Math.max(1,Math.abs(valuePixel-zero)),thickness);
      else ctx.fillRect(center+offset,Math.min(zero,valuePixel),thickness,Math.max(1,Math.abs(valuePixel-zero)));
    });
  }
  const allMarkers=[...markers,...(!byExpiration&&Number.isFinite(spot)?[{value:spot,color:primary,width:2}]:[])];
  for(const marker of allMarkers){if(!Number.isFinite(marker.value)||marker.value<categoryMin||marker.value>categoryMax)continue;const pixel=categoryPixel({strike:marker.value,label:marker.value},0);ctx.strokeStyle=marker.color||primary;ctx.lineWidth=marker.width??2;ctx.setLineDash([4,4]);ctx.beginPath();if(vertical){ctx.moveTo(left,pixel);ctx.lineTo(right,pixel);}else{ctx.moveTo(pixel,top);ctx.lineTo(pixel,bottom);}ctx.stroke();ctx.setLineDash([]);if(marker.label){ctx.fillStyle=marker.color||primary;const middle=marker.labelPosition==='middle';ctx.textAlign=middle?'center':'right';ctx.fillText(marker.label,vertical?(middle?(left+right)/2:right-6):(middle?pixel:pixel-6),vertical?pixel-4:(middle?(top+bottom)/2-10:20));}}
  if(hover!=null&&hover>=first&&hover<=last){const pixel=categoryPixel(points[hover],hover);ctx.strokeStyle=themePaint("rgba(255,255,255,.45)");ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();if(vertical){ctx.moveTo(left,pixel);ctx.lineTo(right,pixel);if(Number.isFinite(pointerX)){ctx.moveTo(pointerX,top);ctx.lineTo(pointerX,bottom);}}else{ctx.moveTo(pixel,top);ctx.lineTo(pixel,bottom);if(Number.isFinite(pointerY)){ctx.moveTo(left,pointerY);ctx.lineTo(right,pointerY);}}ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();ctx.restore();
  return {left,right,top,bottom,domain,first,last,categoryMin,categoryMax,categoryPixel,exposurePixel,barWidth};
}
