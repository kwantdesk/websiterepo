// Same-origin host owns the existing normal-chart React drawing engine. State
// provides only genuine price/time geometry and per-panel/ticker persistence.
export function botMountStateDrawings(element,api){
 const hostId=new URLSearchParams(location.search).get('hostId');
 const host=hostId?window.parent?.__kwantOptionsToolHosts?.[hostId]:window.parent?.__kwantyHost;
 return host?.mountStateDrawings?host.mountStateDrawings(element,api):Promise.reject(Error('Chart drawing tools unavailable.'));
}
export function attachStateDrawingTools(chart,{mount,persist,activate,zoom,onError=()=>{}}){
 let disposed=false,renderer=null,frame=null,saveTimer=null;
 const panel=chart.panel,host=chart.toolsHost;
 const read=(ticker=panel.ticker)=>panel.drawingsByTicker?.[ticker]||[];
 const write=(drawings,ticker=panel.ticker)=>{
  if(disposed)return;
  panel.drawingsByTicker={...panel.drawingsByTicker,[ticker]:drawings};
  // Handle dragging is local and instant; save once after the gesture settles.
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=null;persist();},180);
 };
 const job=Promise.resolve().then(()=>mount(host,{read,write,activate,zoom})).then(value=>{
  if(disposed){value.dispose();return;}renderer=value;if(frame)renderer.update(frame);
 }).catch(reason=>{if(!disposed)onError(reason);});
 return{
  ready:job,
  update(next){if(disposed)return;frame=next;renderer?.update(next);},
  dispose(){disposed=true;clearTimeout(saveTimer);if(saveTimer!==null)persist();saveTimer=null;renderer?.dispose();renderer=null;frame=null;},
 };
}
