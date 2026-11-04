import {heatMetricFor,niceValueDomain} from './exposure-models.js?v=1';
import {bindZoomNavigator,navigatorPreviewDomain} from './navigator-ui.js?v=3';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
// Source285529/564647: contract snapshots render Call/Put, scalar snapshots
// render Value. Owned archive rows are complete snapshots, never SUM deltas.
export function heatCellDetailSeries(rows,dataMode){
  const metric=heatMetricFor(dataMode);if(!metric)throw Error('Unsupported cell metric.');
  const suffix=metric.label.match(/\s+(\((?:Calls|Puts)\))$/)?.[1]||'',base=suffix?metric.label.slice(0,-suffix.length).trimEnd():metric.label;
  const paired=metric.group==='Net';
  const series=paired?[{key:'call',label:'Call '+base,color:metric.maxColor},{key:'put',label:'Put '+base,color:'#FF0000'}]:[{key:'value',label:base,color:metric.maxColor}];
  return {title:`${base} Heat Map Cell${suffix?' '+suffix:''}`,series:series.map(item=>({...item,points:rows.map(row=>({time:row.time,value:finite(row[item.key])?row[item.key]:null})),latest:rows.length&&finite(rows.at(-1)[item.key])?rows.at(-1)[item.key]:null}))};
}

export function mergeHeatCellDetailRows(previous,payload,selection,throughMs){
  const selected=payload?.selection;if(!selected||!Array.isArray(payload.rows)||payload.rows.length>256||payload.coverage?.kind!=='observations-only')throw Error('Recorded cell history is invalid.');
  for(const key of ['ticker','sessionDate','expirationDate','strikePrice','dataMode'])if(selected[key]!==selection[key])throw Error('Recorded cell selection changed.');
  if(!finite(selected.throughMs)||(throughMs!==undefined&&selected.throughMs!==throughMs))throw Error('Recorded cell boundary changed.');
  if(payload.nextCursor!==null&&typeof payload.nextCursor!=='string')throw Error('Recorded cell cursor is invalid.');
  const merged=new Map(previous.map(row=>[row.time,row]));
  for(const row of payload.rows){
    if(!row||!finite(row.time)||!finite(row.receivedAtMs)||row.time>selected.throughMs||!['snapshot','observation'].includes(row.basis)||row.sourceUnit!=='provider-native'||['call','put','value'].some(key=>row[key]!==null&&!finite(row[key])))throw Error('Recorded cell observation is invalid.');
    for(const key of ['ticker','expirationDate','strikePrice','dataMode'])if(row[key]!==selection[key])throw Error('Recorded cell observation changed.');
    if(!merged.has(row.time)||merged.get(row.time).receivedAtMs<=row.receivedAtMs)merged.set(row.time,{...row});
  }
  return [...merged.values()].sort((a,b)=>a.time-b.time);
}

/** A dialog-owned chart: never writes the main map, its camera, or global canvas. */
export function mountHeatCellDetailView({host,selection,fetchPage,formatTime,formatValue,themePaint=value=>value,throughMs}){
  const document=host.ownerDocument,window=document.defaultView||globalThis;
  const node=(tag,cls='',text)=>{const result=document.createElement(tag);result.className=cls;if(text!==undefined)result.textContent=text;return result;};
  const root=node('section','heat-cell-detail-chart quant-chart-shell'),head=node('div','quant-chart-head'),title=node('h2'),legend=node('div','quant-chart-legend'),plot=node('div','quant-chart-plot'),canvas=node('canvas','tool-chart quant-detail-chart'),tooltip=node('div','chart-tooltip'),status=node('p','workspace-note'),navigator=node('div','quant-navigator'),mini=node('canvas'),more=node('button','','Load more recorded observations');
  const metric=heatMetricFor(selection.dataMode);if(!metric)throw Error('Unsupported cell metric.');
  root.style.minWidth='0';root.style.height='auto';root.style.minHeight='0';root.style.flex='0 0 auto';canvas.style.height='320px';canvas.style.width='100%';canvas.setAttribute('aria-label','Heat Map cell metric over time');plot.style.position='relative';plot.style.height='320px';plot.style.minHeight='320px';plot.style.flex='0 0 320px';tooltip.hidden=true;status.setAttribute('role','status');more.type='button';more.hidden=true;
  navigator.style.height='30px';navigator.style.minHeight='30px';navigator.style.flex='0 0 30px';mini.setAttribute('aria-label','Cell metric history overview');navigator.append(mini);head.append(title,legend);plot.append(canvas,tooltip);root.append(head,plot,navigator,status,more);host.append(root);
  const controller=new AbortController(),listeners=[];let destroyed=false,activated=false,busy=false,rows=[],cursor=null,boundary=throughMs,range=[0,0],drag=null,hover=null,navigation=null;
  const listen=(target,type,callback,options)=>{target.addEventListener(type,callback,options);listeners.push(()=>target.removeEventListener(type,callback,options));};
  const valid=()=>!destroyed&&!controller.signal.aborted&&root.isConnected!==false;
  function windowRows(){return rows.slice(range[0],range[1]+1);}
  function draw(){
    if(!valid())return;const model=heatCellDetailSeries(rows,selection.dataMode);title.textContent=model.title;legend.replaceChildren();for(const item of model.series){const label=node('span','',item.label+(item.latest===null?'':` (${formatValue(item.latest)})`));label.style.color=themePaint(item.color);legend.append(label);}
    navigator.hidden=rows.length<2;navigation?.setLength(rows.length);more.hidden=!cursor;
    const preview=model.series[0].points,previewDomain=navigatorPreviewDomain(preview.map(point=>point.value)),miniWidth=navigator.getBoundingClientRect?.().width||host.clientWidth||600,miniHeight=25,miniRatio=window.devicePixelRatio||1;mini.width=Math.round(miniWidth*miniRatio);mini.height=Math.round(miniHeight*miniRatio);const miniContext=mini.getContext?.('2d');
    if(miniContext){miniContext.setTransform(miniRatio,0,0,miniRatio,0,0);miniContext.clearRect(0,0,miniWidth,miniHeight);if(previewDomain&&preview.length>1){const minTime=preview[0].time,maxTime=preview.at(-1).time,px=time=>(time-minTime)/Math.max(1,maxTime-minTime)*miniWidth,py=value=>miniHeight-(value-previewDomain.min)/(previewDomain.max-previewDomain.min)*miniHeight;miniContext.strokeStyle=themePaint('#7D1AD6');miniContext.fillStyle=themePaint('#7D1AD633');miniContext.lineWidth=1;let segment=[];const paint=()=>{if(!segment.length)return;miniContext.beginPath();miniContext.moveTo(px(segment[0].time),py(segment[0].value));for(const point of segment.slice(1))miniContext.lineTo(px(point.time),py(point.value));miniContext.stroke();miniContext.lineTo(px(segment.at(-1).time),miniHeight);miniContext.lineTo(px(segment[0].time),miniHeight);miniContext.closePath();miniContext.fill();segment=[];};for(const point of preview){if(finite(point.value))segment.push(point);else paint();}paint();}}
    const rect=canvas.getBoundingClientRect?.(),width=rect?.width||host.clientWidth||600,height=320,dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const ctx=canvas.getContext?.('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const visible=windowRows(),values=visible.flatMap(row=>model.series.map(item=>row[item.key]).filter(finite));if(!visible.length||!values.length)return;
    const left=78,right=Math.max(left+1,width-18),top=16,bottom=height-34,domain=niceValueDomain(Math.min(0,...values),Math.max(0,...values)),first=visible[0].time,lastTime=visible.at(-1).time,x=time=>first===lastTime?(left+right)/2:left+(time-first)/(lastTime-first)*(right-left),y=value=>bottom-(value-domain.min)/(domain.max-domain.min)*(bottom-top);
    ctx.font='12px Aleph, sans-serif';ctx.lineWidth=1;ctx.textAlign='right';for(const tick of domain.ticks){const py=y(tick);ctx.strokeStyle=themePaint('rgba(255,255,255,.12)');ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.stroke();ctx.fillStyle=themePaint('#FFFFFF');ctx.fillText(formatValue(tick),left-8,py+4);}
    ctx.save();ctx.translate(16,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillStyle=themePaint('#FFFFFF');ctx.fillText(metric.label,0,0);ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();for(const item of model.series){ctx.strokeStyle=themePaint(item.color);ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=2;ctx.beginPath();let connected=false;for(const row of visible){const value=row[item.key];if(!finite(value)){connected=false;continue;}if(connected)ctx.lineTo(x(row.time),y(value));else ctx.moveTo(x(row.time),y(value));connected=true;}ctx.stroke();if(visible.length===1&&finite(visible[0][item.key])){ctx.beginPath();ctx.arc(x(first),y(visible[0][item.key]),3,0,Math.PI*2);ctx.fill();}}ctx.restore();
    ctx.fillStyle=themePaint('#FFFFFF');ctx.textAlign='center';for(const index of [...new Set(Array.from({length:Math.min(5,visible.length)},(_,i)=>Math.round(i*(visible.length-1)/Math.max(1,Math.min(5,visible.length)-1))))])ctx.fillText(formatTime(visible[index].time),Math.max(left+24,Math.min(right-24,x(visible[index].time))),height-10);
    if(hover!==null&&visible[hover]){const row=visible[hover];ctx.strokeStyle=themePaint('rgba(255,255,255,.45)');ctx.beginPath();ctx.moveTo(x(row.time),top);ctx.lineTo(x(row.time),bottom);ctx.stroke();
      // Source188475: expiry/strike identify the contract, never the hover time.
      const expiry=new Date(selection.expirationDate+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}),strike=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:8}).format(selection.strikePrice).replace(/\.00$/,'');
      tooltip.replaceChildren(node('strong','',selection.ticker),node('div','',expiry+' '+strike),node('hr'));
      for(const item of model.series){const valueRow=node('div'),label=node('span','',model.series.length===1?'Value:':item.key==='call'?'Call Value:':'Put Value:'),value=node('span','',finite(row[item.key])?formatValue(row[item.key]):'—');valueRow.style.display='flex';valueRow.style.justifyContent='space-between';valueRow.style.gap='16px';value.style.color=themePaint(item.color);valueRow.append(label,value);tooltip.append(valueRow);}
      const time=formatTime(row.time),badgeWidth=(ctx.measureText?.(time)?.width??time.length*7)+12,badgeX=Math.max(left,Math.min(right-badgeWidth,x(row.time)-badgeWidth/2));ctx.fillStyle=themePaint('#7D1AD6');ctx.fillRect(badgeX,height-27,badgeWidth,24);ctx.fillStyle=themePaint('#FFFFFF');ctx.textAlign='center';ctx.fillText(time,badgeX+badgeWidth/2,height-11);
      tooltip.style.left='84px';tooltip.style.top='8px';tooltip.hidden=false;}else tooltip.hidden=true;
  }
  function setRange(first,last){const max=Math.max(0,rows.length-1);range=[Math.max(0,Math.min(max,Math.round(first))),Math.max(0,Math.min(max,Math.round(last)))].sort((a,b)=>a-b);hover=null;draw();}
  listen(canvas,'wheel',event=>{if(rows.length<2)return;event.preventDefault();const span=Math.max(1,range[1]-range[0]),delta=event.deltaY>0?Math.max(1,Math.round(span*.1)):-Math.max(1,Math.round(span*.1));setRange(range[0]-delta,range[1]+delta);},{passive:false});
  listen(canvas,'pointerdown',event=>{drag={x:event.clientX,range:[...range]};canvas.setPointerCapture?.(event.pointerId);});
  listen(canvas,'pointermove',event=>{if(!valid())return;const rect=canvas.getBoundingClientRect(),width=Math.max(1,rect.width-96);if(drag){const shift=Math.round((drag.x-event.clientX)/width*Math.max(1,drag.range[1]-drag.range[0])),span=drag.range[1]-drag.range[0],first=Math.max(0,Math.min(rows.length-1-span,drag.range[0]+shift));setRange(first,first+span);}else{const visible=windowRows(),ratio=Math.max(0,Math.min(1,(event.clientX-rect.left-78)/width)),time=visible[0]?.time+ratio*((visible.at(-1)?.time??0)-(visible[0]?.time??0));hover=visible.reduce((best,row,index)=>Math.abs(row.time-time)<Math.abs((visible[best]?.time??Infinity)-time)?index:best,0);draw();}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,()=>{drag=null;});listen(canvas,'pointerleave',()=>{if(!drag){hover=null;draw();}});
  async function load(){if(!valid()||busy)return;busy=true;more.disabled=true;status.textContent='Loading recorded observations…';try{const payload=await fetchPage({request:selection.request,sessionDate:selection.sessionDate,expirationDate:selection.expirationDate,strikePrice:selection.strikePrice,...(boundary===undefined?{}:{throughMs:boundary}),...(cursor?{cursor}:{}),limit:256},controller.signal);if(!valid())return;const initial=rows.length===0,previousLength=rows.length;rows=mergeHeatCellDetailRows(rows,payload,selection,boundary);boundary=payload.selection.throughMs;cursor=payload.nextCursor;if(initial)range=[0,Math.max(0,rows.length-1)];else if(range[1]===previousLength-1)range[1]=Math.max(0,rows.length-1);
      status.textContent=rows.length?`${rows.length} saved observation${rows.length===1?'':'s'}${payload.coverage.partial||!payload.coverage.scanComplete?' · Partial history':''}`:'No saved history for this cell.';draw();
    }catch(error){if(valid())status.textContent=error.message||'Recorded cell history is unavailable.';}finally{busy=false;if(valid())more.disabled=false;}}
  // showDataDialog builds its children before attaching/showing the dialog.
  // Activate exactly once after attachment, not via a polling timer. Resize
  // observation also covers a consumer that attaches in a later layout turn.
  function activate(){if(activated||!valid())return;activated=true;navigation=bindZoomNavigator({host:navigator,length:rows.length,minSpan:0,label:'Cell history window',getWindow:()=>({start:range[0],end:range[1]}),setWindow:next=>setRange(next.start,next.end)});draw();void load();}
  listen(more,'click',load);const observer=typeof window.ResizeObserver==='function'?new window.ResizeObserver(()=>{activate();draw();}):null;observer?.observe(plot);if(valid())activate();else queueMicrotask(activate);
  return {destroy(){if(destroyed)return;destroyed=true;controller.abort();observer?.disconnect();navigation?.destroy();listeners.splice(0).forEach(remove=>remove());root.remove();},getRows:()=>rows.map(row=>({...row}))};
}
