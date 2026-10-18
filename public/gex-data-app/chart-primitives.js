import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
import {timeDomain} from './time-axis.js?v=1';
// Rendering rules checked against market-data's shipped browser charts, 2026-10-18.
// Keep data preparation separate so visual fixes cannot fabricate market values.
export const CHART_COLORS = Object.freeze({
  get call(){return themePaint("#00FF00");}, get put(){return themePaint("#FF0000");}, get primary(){return themePaint("#6A12ED");},
  get price(){return themePaint("hsl(264.1095890410959 85.88235294117648% 70%)");}, get netPremium(){return themePaint("hsl(84.10958904109589 85.88235294117648% 70%)");}, get grid(){return themePaint("#250B48");}, get text(){return themePaint("#FFFFFF");}
});

export function bubbleDiameter(value, windowMax) {
  if (!Number.isFinite(value) || value === 0) return 0;
  const diameter = windowMax > 0 ? 1 + 19 * Math.min(1, Math.abs(value) / windowMax) : 1;
  return Math.round(diameter * 2) / 2;
}

export function exposureAlpha(value, positiveMax, negativeMin) {
  if (!Number.isFinite(value) || value === 0) return 0;
  const extreme = value > 0 ? positiveMax : negativeMin;
  if (!extreme) return 0;
  return Math.max(51, Math.min(230, Math.round((value / extreme + .2) * 255))) / 255;
}

export function niceTicks(min, max, target = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max <= min) return [min];
  const raw = (max - min) / target, magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude, steps=[1,2,2.5,5,10];
  let unit=steps.at(-1);for(let index=0;index<steps.length-1;index++){if(fraction<=Math.sqrt(steps[index]*steps[index+1])){unit=steps[index];break;}}
  const step = unit * magnitude;
  const ticks = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-7; value += step) ticks.push(Number(value.toPrecision(12)));
  return ticks;
}

export function intervalStrikeWindow(rows, padding = 5) {
  const strikes = [...new Set(rows.flatMap(row => row.strikes.map(point => point.strike)))].sort((a,b) => a-b);
  const prices = rows.map(row => row.spot).filter(Number.isFinite);
  if (!strikes.length) return [0,1];
  if (!prices.length) return [strikes[0],strikes.at(-1)];
  const nearest = value => strikes.reduce((best,strike,index) => Math.abs(strike-value) < Math.abs(strikes[best]-value) ? index : best,0);
  const start = Math.max(0,nearest(Math.min(...prices))-Math.max(0,padding));
  const end = Math.min(strikes.length-1,nearest(Math.max(...prices))+Math.max(0,padding));
  const lowerStep = strikes[start+1]-strikes[start] || 1, upperStep = strikes[end]-strikes[end-1] || lowerStep;
  return [strikes[start]-lowerStep,strikes[end]+upperStep];
}

export function intervalPreview(rows) {
  return rows.map(row => row.strikes.reduce((maximum,point) => Math.max(maximum,Math.abs(point.value)),0));
}

export function averagedIvRank(contractTypes) {
  const rows=Object.values(contractTypes||{}).filter(row=>row&&Number.isFinite(Number(row.lastIv))&&Number.isFinite(Number(row.windowMinIv))&&Number.isFinite(Number(row.windowMaxIv)));
  if(!rows.length)return null;
  const average=key=>rows.reduce((sum,row)=>sum+Number(row[key]),0)/rows.length;
  const last=average('lastIv'),min=average('windowMinIv'),max=average('windowMaxIv');
  return max===min?0:(last-min)/(max-min)*100;
}

export function marketMapColor(change) {
  const background=[12,2,22],extreme=change<0?[204,0,0]:[28,204,38],fraction=Math.min(1,Math.abs(change)/3);
  return `rgb(${background.map((value,index)=>Math.round(value+(extreme[index]-value)*fraction)).join(',')})`;
}

export function squarifyTreemap(items,rectangle,weight=item=>item.weight) {
  const sorted=items.map(item=>({item,weight:Math.max(0,Number(weight(item))||0)})).filter(entry=>entry.weight>0).sort((a,b)=>b.weight-a.weight);
  const total=sorted.reduce((sum,entry)=>sum+entry.weight,0),area=rectangle.width*rectangle.height;
  if(!total||area<=0)return [];
  const pending=sorted.map(entry=>({...entry,area:entry.weight/total*area})),result=[];let rect={...rectangle},row=[];
  const worst=(entries,side)=>{if(!entries.length)return Infinity;const areas=entries.map(entry=>entry.area),sum=areas.reduce((a,b)=>a+b,0);return Math.max(side*side*Math.max(...areas)/(sum*sum),sum*sum/(side*side*Math.min(...areas)));};
  const place=()=>{const sum=row.reduce((s,entry)=>s+entry.area,0);if(rect.width>=rect.height){const strip=sum/Math.max(1e-9,rect.height);let y=rect.y;for(const entry of row){const h=entry.area/Math.max(1e-9,strip);result.push({item:entry.item,x:rect.x,y,width:strip,height:h});y+=h;}rect.x+=strip;rect.width-=strip;}else{const strip=sum/Math.max(1e-9,rect.width);let x=rect.x;for(const entry of row){const w=entry.area/Math.max(1e-9,strip);result.push({item:entry.item,x,y:rect.y,width:w,height:strip});x+=w;}rect.y+=strip;rect.height-=strip;}row=[];};
  for(const entry of pending){const side=Math.max(1e-9,Math.min(rect.width,rect.height));if(row.length&&worst([...row,entry],side)>worst(row,side))place();row.push(entry);}if(row.length)place();return result;
}

export function foldIntervalUpdates(data) {
  const chain=new Map(),rows=[];
  const timestamps=Object.keys(data||{}).filter(key=>/^\d+$/.test(key)).map(Number).sort((a,b)=>a-b);
  for(const time of timestamps){
    for(const [expiration,strikes] of Object.entries(data[time]||{})){
      if(!strikes||typeof strikes!=="object")continue;
      let legsByStrike=chain.get(expiration);if(!legsByStrike){legsByStrike=new Map();chain.set(expiration,legsByStrike);}
      for(const [key,update] of Object.entries(strikes)){
        const strike=Number(key);if(!Number.isFinite(strike)||!update||typeof update!=="object")continue;
        const legs=legsByStrike.get(strike)||{call:0,put:0};
        // Updates are absolute values. Missing is unchanged; an explicit zero clears it.
        if(update.CALL!=null&&Number.isFinite(Number(update.CALL)))legs.call=Number(update.CALL);
        if(update.PUT!=null&&Number.isFinite(Number(update.PUT)))legs.put=Number(update.PUT);
        legsByStrike.set(strike,legs);
      }
    }
    const totals=new Map();
    for(const strikes of chain.values())for(const [strike,legs] of strikes){const total=totals.get(strike)||{strike,call:0,put:0};total.call+=legs.call;total.put+=legs.put;totals.set(strike,total);}
    rows.push({time,strikes:[...totals.values()].map(point=>({...point,value:point.call+point.put})).sort((a,b)=>a.strike-b.strike)});
  }
  return rows;
}

export function drawSignedVolume(ctx, points, zeroY, top, bottom) {
  if (points.length < 2) return;
  for (const [color,clipTop,clipBottom] of [[CHART_COLORS.call,top,zeroY],[CHART_COLORS.put,zeroY,bottom]]) {
    if (clipBottom <= clipTop) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(points[0][0],clipTop,Math.max(1,points.at(-1)[0]-points[0][0]),clipBottom-clipTop);ctx.clip();
    ctx.beginPath();ctx.moveTo(points[0][0],zeroY);points.forEach(point=>ctx.lineTo(point[0],point[1]));ctx.lineTo(points.at(-1)[0],zeroY);ctx.closePath();
    ctx.fillStyle=color;ctx.globalAlpha=.3;ctx.fill();ctx.globalAlpha=1;ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(point[0],point[1]):ctx.moveTo(point[0],point[1]));ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin="round";ctx.stroke();ctx.restore();
  }
}

export function drawIntervalPlot(ctx,width,height,rows,options={}) {
  const {start=0,end=rows.length-1,padding=5,minStrike,maxStrike,hover=null,formatTime,formatStrike,axisFont=13,left=98,right=width-18,top=10,bottom=height-34}=options;
  const visible=rows.slice(Math.floor(start),Math.ceil(end)+1);
  if(!visible.length || right<=left || bottom<=top) return null;
  const [autoMin,autoMax]=intervalStrikeWindow(rows,padding),baseMin=Number.isFinite(minStrike)?minStrike:autoMin,baseMax=Number.isFinite(maxStrike)?maxStrike:autoMax;
  const yWindow=options.yWindow||[0,1],minY=baseMin+(baseMax-baseMin)*yWindow[0],maxY=baseMin+(baseMax-baseMin)*yWindow[1];
  const domain=timeDomain(rows,start,end),from=domain.firstTime,to=domain.lastTime,minX=domain.min,maxX=domain.max;
  const xFor=time=>left+(time-minX)/Math.max(1,maxX-minX)*(right-left),yFor=strike=>bottom-(strike-minY)/Math.max(1e-9,maxY-minY)*(bottom-top);
  const strikeFormat=formatStrike||String,timeFormat=formatTime||String;
  ctx.font=`700 ${axisFont}px Aleph, sans-serif`;ctx.fillStyle=CHART_COLORS.text;ctx.textBaseline="middle";ctx.textAlign="right";
  for(const strike of niceTicks(minY,maxY,5)){const y=yFor(strike);ctx.strokeStyle=CHART_COLORS.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(strikeFormat(strike),left-8,y);}
  if(!options.hideAxisTitles){ctx.save();ctx.translate(15,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.textAlign="center";ctx.fillText("Strike Price ($)",0,0);ctx.restore();}
  ctx.strokeStyle=CHART_COLORS.primary;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();ctx.fillStyle=CHART_COLORS.text;ctx.textAlign="center";ctx.textBaseline="top";
  const duration=to-from,desired=Math.max(2,Math.floor((right-left)/125));
  const steps=[60000,300000,600000,900000,1800000,3600000,7200000,14400000,86400000];
  const step=steps.find(step=>duration/step<=desired)||steps.at(-1);
  let prior=-Infinity;
  for(let time=Math.ceil(from/step)*step;time<=to;time+=step){const x=xFor(time),label=timeFormat(time),textWidth=ctx.measureText(label).width;if(x-textWidth/2<prior+8)continue;ctx.fillText(label,x,bottom+7);prior=x+textWidth/2;}
  const maxAbs=visible.reduce((maximum,row)=>row.strikes.reduce((m,point)=>point.strike>=minY&&point.strike<=maxY?Math.max(m,Math.abs(point.value)):m,maximum),0);
  ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  const cells=new Map();
  for(const row of visible){const x=xFor(row.time),bin=Math.round(x/1.5);for(const point of row.strikes){if(!Number.isFinite(point.value)||point.value===0||point.strike<minY||point.strike>maxY)continue;const key=`${point.strike}:${bin}`,previous=cells.get(key);if(!previous||Math.abs(point.value)>Math.abs(previous.point.value))cells.set(key,{point,x});}}
  // Opaque area is encoded by circle diameter, never by alpha or glow.
  for(const {point,x} of cells.values()){const diameter=bubbleDiameter(point.value,maxAbs),y=yFor(point.strike);ctx.fillStyle=point.value>0?CHART_COLORS.call:CHART_COLORS.put;ctx.beginPath();if(diameter<2){ctx.fillRect(x-.6,y-.6,1.2,1.2);continue;}ctx.arc(x,y,diameter/2,0,Math.PI*2);ctx.fill();if(diameter>=4){ctx.lineWidth=.5;ctx.strokeStyle=themePaint("#000000");ctx.stroke();}}
  ctx.strokeStyle=CHART_COLORS.price;ctx.lineWidth=2;ctx.lineJoin="round";ctx.beginPath();let started=false;
  for(const row of visible){if(!Number.isFinite(row.spot)){started=false;continue;}const x=xFor(row.time),y=yFor(row.spot);if(started)ctx.lineTo(x,y);else{ctx.moveTo(x,y);started=true;}}ctx.stroke();
  // Draw session markers only at the actual New York equity open in the window.
  const openRow=rows.find(row=>new Date(row.time).toLocaleTimeString("en-GB",{timeZone:"America/New_York",hour:"2-digit",minute:"2-digit"})==="09:30");
  if(openRow&&openRow.time>=from&&openRow.time<=to){const x=xFor(openRow.time);ctx.strokeStyle=themePaint("#FFFFFF");ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=themePaint("#FFFFFF");ctx.font=`700 ${axisFont-2}px Aleph, sans-serif`;ctx.textAlign="left";ctx.textBaseline="top";ctx.fillText("Market Open",x+4,top+4);}
  if(hover!=null&&rows[hover]){const x=xFor(rows[hover].time);ctx.strokeStyle=themePaint("rgba(255,255,255,.45)");ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();ctx.textBaseline="alphabetic";
  return {left,right,top,bottom,minX,maxX,minY,maxY,maxAbs,xFor,yFor,cells:cells.size};
}
