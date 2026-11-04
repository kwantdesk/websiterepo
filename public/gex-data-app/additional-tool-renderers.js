import {netFlowRows,volatilityDriftRows,volatilitySkewSeries,termStructureRows,openInterestStrikeRows} from './volatility-surface-model.js?v=20261103';
import {abbreviate,abbreviatedTick,currencyAbbreviated,percentagePointsAuto} from './number-format.js?v=2';
import {termSelectionState} from './term-selection-model.js?v=20261103';
import {netFlowTooltipRows} from './net-flow-interaction-model.js?v=20261103';
import {heatMetricFor} from './exposure-models.js?v=1';

const DAY=86400000;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const number=value=>{
  if(typeof value!=='number'&&!(typeof value==='string'&&value.trim()!==''))return null;
  const result=Number(value);return Number.isFinite(result)?result:null;
};
const nonnegative=value=>{const result=number(value);return result!==null&&result>=0?result:null;};
const positive=value=>{const result=number(value);return result!==null&&result>0?result:null;};
const selected=value=>Array.isArray(value)?value:String(value||'').split(',').map(value=>value.trim()).filter(Boolean);
const sum=values=>{const present=values.filter(finite);return present.length?present.reduce((total,value)=>total+value,0):null;};
const dateTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value?Date.parse(value+'T00:00:00Z'):null;
const dateLabel=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'});
const percentageFixed=value=>finite(value)?value.toFixed(2)+'%':'—';
// Source formatter 886167 (2zz6w3ti8kt-y.js at character 18527) rounds first,
// then auto uses no decimals for an integer or exactly two for a fraction.
const percentage=percentagePointsAuto;
const priceLabel=(env,value)=>finite(value)?env.formatPrice(value):'—';
const amountLabel=(env,value,money=false)=>finite(value)?env.compact(value,money):'—';

// Cached native tooltip609816 retains both supplied legs; zero is an
// observation, whereas an omitted/null leg must never become an invented zero.
export function heatMapCellPoint(raw,{expiry,strike,mode}={}){
  const point={expiry,strike,value:null};
  if(!record(raw))return point;
  for(const key of ['callValue','putValue']){
    const value=Object.hasOwn(raw,key)?number(raw[key]):null;if(value!==null)point[key]=value;
  }
  const value=Object.hasOwn(raw,'value')?number(raw.value):null;
  if(value!==null)point.value=value;
  else if(finite(point.callValue)&&finite(point.putValue))point.value=heatMetricFor(mode)?.exposure?point.callValue+point.putValue:point.callValue-point.putValue;
  return point;
}

export function heatMapTooltipRows(point,{ticker,mode,formatExpiry,formatStrike}={}){
  if(!point)return [];
  const metric=heatMetricFor(mode);
  // Metadata formatter contract: abbreviation2, currency abbreviation2,
  // Greeks fixed5, IV percentage points always2. REST currency is dollars.
  const format=value=>metric?.format==='currency'?currencyAbbreviated(value,2):metric?.format==='percent'?value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':metric?.format==='decimal'?value.toFixed(5):abbreviate(value,2);
  return [`${ticker} · ${formatExpiry(point.expiry)}`,formatStrike(point.strike),
    ...(finite(point.value)?[`Value: ${format(point.value)}`]:[]),
    ...(finite(point.callValue)?[`Call Value: ${format(point.callValue)}`]:[]),
    ...(finite(point.putValue)?[`Put Value: ${format(point.putValue)}`]:[])];
}

// Persist these arrays in the existing tool controls, not a global chart state.
// Missing arrays preserve source defaults; explicit empty arrays hide everything.
export function skewVisibilityState(payload,controls={}){
  const expiries=Object.entries(record(payload?.data)?payload.data:{}).filter(([date,value])=>dateTime(date)!==null&&record(value)).map(([date])=>date).sort();
  const contractTypes=['BOTH','CALL','PUT'];
  const clean=(values,allowed)=>[...new Set(values)].filter(value=>allowed.includes(value));
  const legacyExpiries=clean(selected(controls.expiry),expiries),legacyType=controls.contractTypeOptional||controls.contractType||'BOTH';
  return {expiries,contractTypes,
    visibleExpiry:Array.isArray(controls.visibleExpiry)?clean(controls.visibleExpiry,expiries):legacyExpiries.length?legacyExpiries:expiries.slice(0,5),
    visibleContractType:Array.isArray(controls.visibleContractType)?clean(controls.visibleContractType,contractTypes):contractTypes.includes(legacyType)?[legacyType]:['BOTH']};
}

export function setSkewVisibility(payload,controls={},change={}){
  const result={...controls};
  if(change.reset){for(const key of ['visibleExpiry','visibleContractType','expiry','contractTypeOptional','contractType'])delete result[key];return result;}
  const state=skewVisibilityState(payload,controls),key=change.kind==='expiry'?'visibleExpiry':change.kind==='contractType'?'visibleContractType':null;
  if(!key)return result;
  const allowed=key==='visibleExpiry'?state.expiries:state.contractTypes;
  if(change.value!=='ALL'&&!allowed.includes(change.value))return result;
  result.visibleExpiry=[...state.visibleExpiry];result.visibleContractType=[...state.visibleContractType];
  const active=result[key],checked=typeof change.checked==='boolean'?change.checked:!active.includes(change.value);
  result[key]=change.value==='ALL'?(checked?[...allowed]:[]):checked?[...new Set([...active,change.value])]:active.filter(value=>value!==change.value);
  return result;
}

function domain(env,values,zero=false,target=5){
  let min=Infinity,max=-Infinity;
  for(const value of values)if(finite(value)){min=Math.min(min,value);max=Math.max(max,value);}
  if(min===Infinity)return env.niceValueDomain(0,1,target);
  return env.niceValueDomain(zero?Math.min(0,min):min,zero?Math.max(0,max):max,target);
}

// Null means an absent observation, so split a line there. Never create a zero
// warm-up, inferred intervening bucket or a carry-forward contract/IV value.
function segments(rows,valueOf,x,y,draw){
  let points=[];
  const flush=()=>{if(points.length)draw(points);points=[];};
  rows.forEach((row,index)=>{const value=valueOf(row);if(!finite(value)){flush();return;}const px=x(index),py=y(value);if(!finite(px)||!finite(py)){flush();return;}points.push([px,py]);});flush();
}

function plotBox(width,height,right=78){return {left:78,right:width-right,top:12,bottom:height-34};}
function clip(ctx,box,draw){ctx.save();ctx.beginPath();ctx.rect(box.left,box.top,Math.max(0,box.right-box.left),Math.max(0,box.bottom-box.top));ctx.clip();draw();ctx.restore();}
function yScale(box,bounds){return value=>box.bottom-(value-bounds.min)/Math.max(1e-12,bounds.max-bounds.min)*(box.bottom-box.top);}
function timeScale(env,rows,state,box){
  const range=env.timeDomain(rows,state.rawStart??state.start,state.rawEnd??state.end);
  return index=>range?env.timeX(rows[index]?.time,range,box.left,box.right):box.left+(box.right-box.left)*index/Math.max(1,rows.length-1);
}

function temporal({title,rows,series,ticker,env,summary,area=false,zero=false,money=false,aggregateHeaders=false,formatHeader=null,tooltipRows=null,onClick=null}){
  const last=rows.at(-1),showSpot=rows.some(row=>finite(row.spot));
  const legend=series.map(line=>{
    const value=aggregateHeaders?sum(rows.map(row=>row[line.key])):last?.[line.key];
    return {label:line.label,color:line.color,value:formatHeader?formatHeader(value):line.headerFormat?.(value)??line.format?.(value)??amountLabel(env,value,money)};
  });
  if(showSpot)legend.push({label:ticker,color:env.CHART_COLORS.price,value:priceLabel(env,last?.spot)});
  env.quantCanvas({title,items:rows,timeScale:true,navigatorValues:rows.map(row=>row[series[0].key]),height:540,plotRight:showSpot?78:30,legend,
    onClick,
    tooltipRows:tooltipRows??(row=>row?[env.displayChartTime(row.time),...series.map(line=>`${line.label}: ${line.format?.(row[line.key])??(finite(row[line.key])?env.compact(row[line.key],money):'—')}`),...(showSpot?[`${ticker}: ${priceLabel(env,row.spot)}`]:[])]:[]),
    draw(ctx,width,height,state){
      const box=plotBox(width,height,showSpot?78:30),visible=rows.slice(state.start,state.end+1),bounds=domain(env,visible.flatMap(row=>series.map(line=>row[line.key])),zero),price=domain(env,visible.map(row=>row.spot)),y=yScale(box,bounds),py=yScale(box,price),x=timeScale(env,rows,state,box),local=index=>x(state.start+index);
      const formatter=series[0].format??(value=>env.compact(value,money));
      env.drawHorizontalTicks(ctx,box.left,box.right,box.top,box.bottom,bounds.min,bounds.max,formatter);
      clip(ctx,box,()=>{
        for(const line of series)segments(visible,row=>row[line.key],local,y,points=>{
          if(area){ctx.save();ctx.globalAlpha=.3;ctx.fillStyle=line.color;ctx.beginPath();ctx.moveTo(points[0][0],y(0));points.forEach(point=>ctx.lineTo(...point));ctx.lineTo(points.at(-1)[0],y(0));ctx.closePath();ctx.fill();ctx.restore();}
          env.quantLine(ctx,points,line.color,2);
        });
        if(showSpot)segments(visible,row=>row.spot,local,py,points=>env.quantLine(ctx,points,env.CHART_COLORS.price,2));
      });
      env.drawAxisLabels(ctx,{...box,min:bounds.min,max:bounds.max,label:money?'Premium ($)':series[0].format?'Volatility (%)':'Contracts',formatter});
      if(showSpot)env.drawAxisLabels(ctx,{...box,min:price.min,max:price.max,rightSide:true,label:'Underlying ($)',formatter:env.chartStrikeLabel});
      env.drawTimeLabels(ctx,rows,state.rawStart??state.start,state.rawEnd??state.end,box.left,box.right,box.bottom);
      env.drawChartCrosshair(ctx,state,box.left,box.right,box.top,box.bottom);
    }
  });
  env.setSummary(summary);
}

function dateRows(payload){
  return Object.entries(record(payload?.data)?payload.data:{}).flatMap(([date,cell])=>{
    const time=dateTime(date);if(time===null||!record(cell))return [];
    return [{date,time,label:date,call:nonnegative(cell.callOpenInterest),put:nonnegative(cell.putOpenInterest)}];
  }).sort((a,b)=>a.time-b.time);
}

function renderOi({view,payload,controls,ticker,env}){
  const expiry=view==='oiExpiration',time=view==='oiTime';
  const rows=time||expiry?dateRows(payload):openInterestStrikeRows(payload);
  const requestedLegs=time?controls.oiLegs:controls.exposureDisplay,display=['CALL','PUT'].includes(requestedLegs)?requestedLegs:'SPLIT',legs=[{key:'call',label:'Calls',tooltip:'Call Open Interest',color:env.CHART_COLORS.call},{key:'put',label:'Puts',tooltip:'Put Open Interest',color:env.CHART_COLORS.put}].filter(leg=>display==='SPLIT'||display.toLowerCase()===leg.key);
  const title=`Open Interest ${time?'/ Time':expiry?'By Expiration':'By Strike'} - ${ticker}`,spot=positive(payload.stockPrice??payload._spot);
  // OI is a stock on each date. Adding successive daily snapshots would count
  // the same outstanding contracts again; only strike/expiry partitions sum.
  const totals=time?{call:rows.at(-1)?.call??null,put:rows.at(-1)?.put??null}:{call:sum(rows.map(row=>row.call)),put:sum(rows.map(row=>row.put))};
  // Shipped headers 937780 / 454318 / 249556 have plain Calls/Puts legends,
  // including OI / Time. Actual totals belong in the summary, not this header.
  const legend=legs.map(({label,color})=>({label,color}));
  const summary=[['Call open interest',finite(totals.call)?env.compact(totals.call):'—'],['Put open interest',finite(totals.put)?env.compact(totals.put):'—'],[time?'Sessions':expiry?'Expirations':'Strikes',rows.length],...(!time&&spot!==null?[['Underlying',env.formatPrice(spot)]]:[])];
  if(time){
    const bars=(controls.oiChart??controls.oiChartType??controls.oiTimeChart)==='bar';
    let bounds=null;
    env.quantCanvas({title,items:rows,timeScale:false,legend,navigatorValues:rows.map(row=>finite(row.call)&&finite(row.put)?row.call+row.put:null),height:540,plotRight:30,
      tooltipRows:(row,_index,state)=>{if(bounds&&finite(state?.pointerX)){const position=bounds.start+Math.max(0,Math.min(1,(state.pointerX-bounds.box.left)/(bounds.box.right-bounds.box.left)))*(bounds.end-bounds.start+(bars?1:0)),index=Math.max(0,Math.min(rows.length-1,Math.ceil(position-(bars?1:.5))));row=rows[index];state.hover=index;state.hoverRatio=(index+(bars?.5:0)-bounds.start)/Math.max(1,bounds.end-bounds.start+(bars?1:0));}return row?[dateLabel(row.date),...legs.map(leg=>`${leg.tooltip}: ${amountLabel(env,row[leg.key])}`)]:[];},
      draw(ctx,width,height,state){
        const box=plotBox(width,height,30),visible=rows.slice(state.start,state.end+1),values=domain(env,visible.flatMap(row=>legs.map(leg=>row[leg.key])),bars,bars?7:5),start=state.rawStart??state.start,end=state.rawEnd??state.end,x=index=>box.left+(index+(bars?.5:0)-start)/Math.max(1,end-start+(bars?1:0))*(box.right-box.left),y=yScale(box,values);bounds={box,start,end};
        env.drawHorizontalTicks(ctx,box.left,box.right,box.top,box.bottom,values.min,values.max,abbreviatedTick);
        clip(ctx,box,()=>{
          for(const {key,color}of legs){
            if(bars){const centers=visible.map((_,i)=>x(state.start+i)),spacing=centers.length>1?Math.min(...centers.slice(1).map((value,index)=>value-centers[index])):box.right-box.left,thickness=Math.max(1,Math.min(32,spacing*(legs.length===2?.3:.6)));
              visible.forEach((row,index)=>{if(!finite(row[key])||row[key]===0)return;ctx.fillStyle=color;ctx.fillRect(centers[index]+(legs.length===1?-thickness/2:key==='call'?-thickness:0),y(row[key]),thickness,Math.max(1,y(0)-y(row[key])));});
            }else segments(visible,row=>row[key],index=>x(state.start+index),y,points=>env.quantLine(ctx,points,color,2));
          }
        });
        env.drawAxisLabels(ctx,{...box,min:values.min,max:values.max,label:'Open Interest',formatter:abbreviatedTick});
        drawDateLabels(env,ctx,rows,state,box,x);env.drawChartCrosshair(ctx,state,box.left,box.right,box.top,box.bottom);
      }
    });
  }else{
    const orientation=controls.exposureOrientation??controls.oiOrientation??'HORIZONTAL';
    // Legacy NET is presented as both positive OI legs, never signed GEX.
    const initialWindow=!expiry&&spot!==null?(()=>{const [start,end]=env.exposureStrikeWindow(rows.map(row=>row.strike),spot);return {start,end};})():null;
    let bounds=null;
    env.quantCanvas({title,items:rows,legend,navigatorValues:rows.map(row=>finite(row.call)&&finite(row.put)?row.call+row.put:null),height:540,zoomAxis:orientation==='VERTICAL'?'y':'x',initialWindow,
      tooltipRows:(row,index,state)=>{
        if(bounds){let nearest=state.start;const pointer=orientation==='VERTICAL'?state.pointerY:state.pointerX;for(let i=state.start;i<=state.end;i++)if(Math.abs(bounds.categoryPixel(rows[i],i)-pointer)<Math.abs(bounds.categoryPixel(rows[nearest],nearest)-pointer))nearest=i;row=rows[nearest];state.hover=nearest;}
        return row?[expiry?dateLabel(row.date):env.chartStrikeLabel(row.strike),...legs.map(leg=>`${leg.tooltip}: ${amountLabel(env,row[leg.key])}`)]:[];
      },
      draw(ctx,width,height,state){bounds=env.drawExposureBars(ctx,width,height,rows,{orientation,display,byExpiration:expiry,fromZero:true,grouped:true,spot:expiry?undefined:spot,start:state.start,end:state.end,axisName:'Open Interest',categoryFormatter:row=>expiry?dateLabel(row.label):env.chartStrikeLabel(row.strike),valueFormatter:env.compact,hover:state.hover,pointerX:state.pointerX,pointerY:state.pointerY});}
    });
  }
  env.setSummary(summary);
}

function drawDateLabels(env,ctx,rows,state,box,x){
  ctx.save();ctx.fillStyle=env.themePaint('#FFFFFF');ctx.font='700 13px Aleph, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';let right=-Infinity;
  const visible=rows.slice(state.start,state.end+1),maxWidth=Math.max(0,...visible.map(row=>ctx.measureText(dateLabel(row.date??row.expiration)).width)),stride=Math.max(1,Math.ceil((maxWidth+12)/((box.right-box.left)/Math.max(1,visible.length))));
  for(let index=state.start;index<=state.end;index+=stride){const row=rows[index];if(!row)continue;const text=dateLabel(row.date??row.expiration),pixel=x(index),half=ctx.measureText(text).width/2;if(pixel-half<=right+8)continue;ctx.fillText(text,pixel,box.bottom+6);right=pixel+half;}
  ctx.restore();
}

function renderSkew({payload,controls,ticker,env}){
  const visibility=skewVisibilityState(payload,controls),series=visibility.visibleExpiry.length?visibility.visibleContractType.flatMap(contractType=>volatilitySkewSeries(payload,{contractType,ivUnit:'percentage-points',expirations:visibility.visibleExpiry})):[];
  const strikes=[...new Set(series.flatMap(line=>line.rows.map(row=>row.strike)))].sort((a,b)=>a-b),maps=series.map(line=>new Map(line.rows.map(row=>[row.strike,row.iv]))),rows=strikes.map(strike=>({strike,values:maps.map(map=>map.get(strike)??null)})),spot=positive(payload.stockPrice);
  // Reference series 369505 stores each expiry's own valid strike/IV pairs.
  // A strike present only in another expiry must not insert a hole in this one.
  const paths=series.map(line=>line.rows.filter(row=>finite(row.iv)));
  // Keep one honest full-series IV domain while the horizontal window moves.
  // The navigator is an observation-count histogram, never synthetic IV quotes.
  const allIvs=paths.flatMap(path=>path.map(row=>row.iv)),ivDomain=domain(env,allIvs),ivSpan=ivDomain.max-ivDomain.min,counts=Array(48).fill(0);
  for(const iv of allIvs)counts[Math.max(0,Math.min(counts.length-1,Math.round((iv-ivDomain.min)/ivSpan*(counts.length-1))))]++;
  const verticalValues=counts.map((value,index)=>({position:index/(counts.length-1),value}));
  const colors=series.map((line,index)=>{
    const contractType=line.contractType,peers=series.filter(peer=>peer.contractType===contractType),fraction=peers.indexOf(series[index])/Math.max(1,peers.length),hue=contractType==='PUT'?0:contractType==='CALL'?.3+.1*fraction:.7*fraction,lightness=contractType==='BOTH'?.5+.1*fraction:.7-.4*fraction;
    return env.themePaint(`hsl(${Number((hue*360).toFixed(6))} 100% ${Number((lightness*100).toFixed(6))}%)`);
  });
  let initialWindow=null;
  if(spot!==null&&strikes.length){const first=strikes.findIndex(strike=>strike>=spot*.9),last=strikes.findLastIndex(strike=>strike<=spot*1.1);if(first>=0&&last>=first)initialWindow={start:first,end:last};}
  let bounds=null;
  env.quantCanvas({title:`Volatility Skew - ${ticker}`,items:rows,seriesVisibility:visibility,navigatorValues:rows.map(row=>{const values=row.values.filter(finite);return values.length?Math.max(...values):null;}),verticalValues,twoDimensional:true,height:540,plotRight:30,initialWindow,
    legend:[{label:'IV',color:env.themePaint('#FFFF00')},...(spot!==null?[{label:ticker,color:env.CHART_COLORS.price,value:env.formatPrice(spot)}]:[])],
    tooltipRows:(row,index,state)=>{
      if(bounds){let nearest=state.start;for(let i=state.start;i<=state.end;i++)if(Math.abs(bounds.x(rows[i].strike)-state.pointerX)<Math.abs(bounds.x(rows[nearest].strike)-state.pointerX))nearest=i;row=rows[nearest];state.hover=nearest;state.hoverRatio=(bounds.x(row.strike)-bounds.box.left)/(bounds.box.right-bounds.box.left);}
      return row?[env.chartStrikeLabel(row.strike),...series.flatMap((line,index)=>finite(row.values[index])?[`${dateLabel(line.expiration)}${visibility.visibleContractType.length>1?' '+line.contractType:''} IV: ${percentage(row.values[index])}`]:[])]:[];
    },
    draw(ctx,width,height,state){
      const box=plotBox(width,height,30),visible=rows.slice(state.start,state.end+1),window=Array.isArray(state.yWindow)&&state.yWindow.length===2&&state.yWindow.every(finite)&&state.yWindow[1]>state.yWindow[0]?state.yWindow.map(value=>Math.max(0,Math.min(1,value))):[0,1],iv=window[1]>window[0]?{min:ivDomain.min+ivSpan*window[0],max:ivDomain.min+ivSpan*window[1]}:ivDomain,extent=domain(env,visible.map(row=>row.strike)),x=value=>box.left+(value-extent.min)/(extent.max-extent.min)*(box.right-box.left),y=yScale(box,iv);bounds={box,x};
      env.drawHorizontalTicks(ctx,box.left,box.right,box.top,box.bottom,iv.min,iv.max,percentage);
      clip(ctx,box,()=>{paths.forEach((path,index)=>{
        let first=0;while(first<path.length&&path[first].strike<extent.min)first++;
        let end=first;while(end<path.length&&path[end].strike<=extent.max)end++;
        // Keep one genuine adjacent observation outside each edge so clipping
        // preserves a crossing segment without generating interpolated quotes.
        const visiblePath=path.slice(Math.max(0,first-1),Math.min(path.length,end+1));
        segments(visiblePath,row=>row.iv,i=>x(visiblePath[i].strike),y,points=>env.quantLine(ctx,points,colors[index],2));
      });if(spot!==null&&spot>=extent.min&&spot<=extent.max){ctx.strokeStyle=env.CHART_COLORS.price;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x(spot),box.top);ctx.lineTo(x(spot),box.bottom);ctx.stroke();ctx.setLineDash([]);}});
      env.drawAxisLabels(ctx,{...box,min:iv.min,max:iv.max,label:'Implied Volatility (%)',formatter:percentage});
      drawNumberLabels(env,ctx,box,extent,x,env.chartStrikeLabel,'Strike Price ($)');env.drawChartCrosshair(ctx,state,box.left,box.right,box.top,box.bottom);
    }
  });
  env.setSummary([['Expirations',new Set(series.map(line=>line.expiration)).size],['Strikes',rows.length],['Underlying',priceLabel(env,spot)],['Contract',visibility.visibleContractType.map(type=>type==='BOTH'?'Calls + puts':type).join(', ')||'None']]);
}

function drawNumberLabels(env,ctx,box,extent,x,format,title){
  ctx.save();ctx.fillStyle=env.themePaint('#FFFFFF');ctx.font='700 13px Aleph, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';let right=-Infinity;
  for(const value of env.niceTicks(extent.min,extent.max,5)){const text=format(value),pixel=x(value),half=ctx.measureText(text).width/2;if(pixel-half<=right+8)continue;ctx.fillText(text,pixel,box.bottom+6);right=pixel+half;}
  if(title)ctx.fillText(title,(box.left+box.right)/2,box.bottom+24);ctx.restore();
}

function renderTerm({payload,controls,ticker,sessionDate,env}){
  // Shipped reference modules 182527 / 404115 use yellow IV and an actual spot
  // header. A missing source stockPrice must not become a fabricated $0 quote.
  const ivColor=env.themePaint('#FFFF00'),spot=positive(payload.stockPrice);
  const selection=termSelectionState(payload,controls);
  // A resolved empty set with a nonempty filter means no matches, not All.
  const rows=(!selection.visibleExpirations.length||!selection.visibleStrikes.length?[]:termStructureRows(payload,{sessionDate,ivUnit:'percentage-points',deltaMin:controls.deltaMin==null||controls.deltaMin===''?0:Number(controls.deltaMin),deltaMax:controls.deltaMax==null||controls.deltaMax===''?1:Number(controls.deltaMax),moneyTypes:controls.moneyType==null?['ATM']:selected(controls.moneyType),contractTypes:selected(controls.contractTypeOptional),expirations:selection.visibleExpirations,strikePrices:selection.visibleStrikes})).map(row=>({...row,time:dateTime(row.expiration)}));
  env.quantCanvas({title:`Term Structure - ${ticker}`,items:rows,timeScale:true,navigatorValues:rows.map(row=>row.iv),height:540,plotRight:30,legend:[{label:'IV',color:ivColor},...(spot!==null?[{label:ticker,color:env.CHART_COLORS.price,value:env.formatPrice(spot)}]:[])],
    tooltipRows:row=>row?[`${row.daysUntilExpiration} Days Until Expiration`,`Implied Volatility: ${percentage(row.iv)}`]:[],
    draw(ctx,width,height,state){
      const box=plotBox(width,height,30),visible=rows.slice(state.start,state.end+1),iv=domain(env,visible.map(row=>row.iv)),x=timeScale(env,rows,state,box),y=yScale(box,iv);
      env.drawHorizontalTicks(ctx,box.left,box.right,box.top,box.bottom,iv.min,iv.max,percentage);
      clip(ctx,box,()=>segments(visible,row=>row.iv,index=>x(state.start+index),y,points=>env.quantLine(ctx,points,ivColor,2)));
      env.drawAxisLabels(ctx,{...box,min:iv.min,max:iv.max,label:'Implied Volatility',formatter:percentage});
      const range=env.timeDomain(rows,state.rawStart??state.start,state.rawEnd??state.end),base=dateTime(sessionDate),extent=range?{min:(range.min-base)/DAY,max:(range.max-base)/DAY}:{min:0,max:1},dx=value=>box.left+(value-extent.min)/Math.max(1e-12,extent.max-extent.min)*(box.right-box.left);
      drawNumberLabels(env,ctx,box,extent,dx,value=>String(Number(value.toFixed(2))),null);env.drawChartCrosshair(ctx,state,box.left,box.right,box.top,box.bottom);
    }
  });
  env.setSummary([['Expirations',rows.length],['Included contracts',rows.reduce((total,row)=>total+row.count,0)],['Delta',`${controls.deltaMin??0}–${controls.deltaMax??1}`],['Moneyness',controls.moneyType==null?'ATM':controls.moneyType||'All']]);
}

export function renderAdditionalChart({tool,payload,controls={},ticker='QQQ',sessionDate},env){
  const view=tool?.view;
  if(view==='netFlow'){
    const mode=controls.flowMetric??controls.flowMode??controls.dataMode??'NET_PREMIUM',money=['NET_PREMIUM','PREMIUM'].includes(mode),rows=netFlowRows(payload,{dataMode:mode}),last=rows.at(-1);
    temporal({title:`Net Flow (${money?'Premium':'Volume'}) - ${ticker}`,rows,ticker,env,area:true,zero:true,money,aggregateHeaders:true,formatHeader:value=>money?currencyAbbreviated(value,1):abbreviate(value,2),tooltipRows:row=>netFlowTooltipRows(rows,row,{mode,timeZone:env.gexTimeZone()}),onClick:env.onMinuteDetail?row=>row&&env.onMinuteDetail(row):null,series:[{key:'call',label:'Calls',color:env.CHART_COLORS.call},{key:'put',label:'Puts',color:env.CHART_COLORS.put}],summary:[['Calls',amountLabel(env,sum(rows.map(row=>row.call)),money)],['Puts',amountLabel(env,sum(rows.map(row=>row.put)),money)],['Underlying',priceLabel(env,last?.spot)],['Intervals',rows.length]]});return true;
  }
  if(view==='volatilityDrift'){
    const rows=volatilityDriftRows(payload,{ivUnit:'percentage-points'}),last=rows.at(-1);
    // Reference header module 467570 orders ARV before IV; module 290486 gives
    // the ARV semantic color #a33dff. Both pass through the host theme mapper.
    temporal({title:`Volatility Drift - ${ticker}`,rows,ticker,env,series:[{key:'arv',label:'ARV',color:env.themePaint('#A33DFF'),format:percentage,headerFormat:percentageFixed},{key:'iv',label:'IV',color:env.themePaint('#FFFF00'),format:percentage,headerFormat:percentageFixed}],summary:[['IV',percentageFixed(last?.iv)],['ARV',percentageFixed(last?.arv)],['Underlying',priceLabel(env,last?.spot)],['Intervals',rows.length]]});return true;
  }
  if(view==='volatilitySkew'){renderSkew({payload,controls,ticker,env});return true;}
  if(view==='termStructure'){renderTerm({payload,controls,ticker,sessionDate,env});return true;}
  if(['oiStrike','oiExpiration','oiTime'].includes(view)){renderOi({view,payload,controls,ticker,env});return true;}
  return false;
}
