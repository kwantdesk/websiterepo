import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
import {sliderBarWindow,sliderHandleWindow,sliderTrackClick,sliderMinimumSpan} from './chart-interaction-model.js?v=1';

// The navigator is a full-data overview, not a zero-based volume axis. Forcing
// zero into a $700 price series hides a $2 intraday move in the topmost pixel.
// A single allocation-free pass also avoids spreading long arrays into Math.
export function navigatorPreviewDomain(values, { includeZero = false, padding = .06 } = {}) {
  let min = Infinity, max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (min === Infinity) return null;
  if (includeZero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  const fraction = Number.isFinite(padding) ? Math.max(0, Math.min(.5, padding)) : .06;
  // Constant and zero-valued real series still get a finite, visible domain.
  const pad = min === max ? Math.max(Math.abs(min) * .01, min === 0 ? 1 : Number.EPSILON) : (max - min) * fraction;
  return { min: min - pad, max: max + pad };
}

// Original navigator semantics: band drag, nearest-edge track click, separate
// handles, keyboard access, and double-click FULL extent (not default crop).
export function bindZoomNavigator({host,length,getWindow,setWindow,vertical=false,inverted=vertical,minSpan,fractional=false,label='Chart window',onCommit=()=>{}}){
  let maximum=Math.max(0,length-1);const band=document.createElement('div'),handles={};band.className='zoom-gesture-band'+(vertical?' vertical':'');band.tabIndex=0;band.setAttribute('role','button');band.setAttribute('aria-label',label+' selection');host.append(band);
  for(const edge of ['start','end']){const handle=document.createElement('div');handle.className='zoom-gesture-handle'+(vertical?' vertical':'');handle.tabIndex=0;handle.setAttribute('role','slider');handle.setAttribute('aria-label',label+' '+edge);handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax',String(maximum));handle.setAttribute('aria-orientation',vertical?'vertical':'horizontal');host.append(handle);handles[edge]=handle;}
  const synchronize=()=>{const value=getWindow(),fraction=number=>maximum?number/maximum:0,start=fraction(value.start),end=fraction(value.end);if(vertical){Object.assign(band.style,{left:'0',width:'100%',top:`${(inverted?1-end:start)*100}%`,height:`${(end-start)*100}%`});handles.start.style.top=`calc(${(inverted?1-start:start)*100}% - 3px)`;handles.end.style.top=`calc(${(inverted?1-end:end)*100}% - 3px)`;}else{Object.assign(band.style,{top:'0',height:'100%',left:`${start*100}%`,width:`${(end-start)*100}%`});handles.start.style.left=`calc(${start*100}% - 3px)`;handles.end.style.left=`calc(${end*100}% - 3px)`;}for(const edge of ['start','end']){handles[edge].setAttribute('aria-valuenow',String(Math.round(value[edge]*100)/100));handles[edge].setAttribute('aria-valuetext',String(Math.round(value[edge])));}};
  function apply(value){setWindow(value);synchronize();}
  function begin(event,edge=null){if(event.button!==0)return;event.preventDefault();event.stopPropagation();const rect=host.getBoundingClientRect(),size=vertical?rect.height:rect.width,position=vertical?event.clientY:event.clientX,origin=vertical?rect.top:rect.left;let initial={...getWindow()},dragEdge=edge,baseline=position;
    if(event.target===host||event.target.tagName==='CANVAS'){const fraction=(position-origin)/Math.max(1,size),value=(vertical&&inverted?1-fraction:fraction)*maximum,result=sliderTrackClick(initial,value,length,{fractional});apply(result.window);initial=result.window;dragEdge=result.handle;if(!dragEdge)return;}
    const target=event.currentTarget;target.setPointerCapture(event.pointerId);
    const move=e=>{const current=vertical?e.clientY:e.clientX,delta=current-baseline;if(dragEdge){const value=initial[dragEdge]+(vertical&&inverted?-delta:delta)/Math.max(1,size)*maximum;apply(sliderHandleWindow(initial,dragEdge,value,length,{minSpan,fractional}));}else apply(sliderBarWindow(initial,delta,size,length,{inverted:vertical&&inverted,fractional}));};
    const end=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);onCommit(getWindow());};target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);
  }
  band.addEventListener('pointerdown',event=>begin(event));for(const edge of ['start','end'])handles[edge].addEventListener('pointerdown',event=>begin(event,edge));host.addEventListener('pointerdown',event=>{if(event.target===host||event.target.tagName==='CANVAS')begin(event);});
  host.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();apply({start:0,end:maximum});onCommit(getWindow());});
  for(const edge of ['start','end'])handles[edge].addEventListener('keydown',event=>{const value=getWindow();let next;if(event.key==='Home')next=edge==='start'?0:value.start+sliderMinimumSpan(length,minSpan);else if(event.key==='End')next=edge==='end'?maximum:value.end-sliderMinimumSpan(length,minSpan);else if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key))next=value[edge]+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)*(event.shiftKey?10:1);else return;event.preventDefault();apply(sliderHandleWindow(value,edge,next,length,{minSpan,fractional}));onCommit(getWindow());});
  synchronize();return {sync:synchronize,setLength(next){length=next;maximum=Math.max(0,length-1);for(const handle of Object.values(handles))handle.setAttribute('aria-valuemax',String(maximum));synchronize();}};
}
