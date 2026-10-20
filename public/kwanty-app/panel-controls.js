// Presentation-only panel state. All intervals reuse the one underlying price feed.
export const CANDLE_INTERVALS=[[60000,'1m'],[120000,'2m'],[180000,'3m'],[300000,'5m'],[600000,'10m'],[900000,'15m'],[1800000,'30m'],[3600000,'1h'],[14400000,'4h']];
const finite=Number.isFinite;
export const candleIntervalFor=(panel,settings={})=>CANDLE_INTERVALS.some(([value])=>value===Number(panel?.candleIntervalMs??settings.candleIntervalMs))?Number(panel?.candleIntervalMs??settings.candleIntervalMs):60000;
export const priceViewFor=(panel,settings={})=>(panel?.priceViewMode??settings.spotViewMode)==='line'?'line':'candles';
export const intervalLabel=value=>CANDLE_INTERVALS.find(([interval])=>interval===value)?.[1]||'1m';
export function sharedViewport(view={}){
 const shared={};for(const [min,max]of [['startTime','endTime'],['minSpot','maxSpot']])if(finite(view[min])&&finite(view[max])&&view[max]>view[min])Object.assign(shared,{[min]:view[min],[max]:view[max]});return shared;
}
export function linkedViewportUpdates(panels,id,next){
 const source=panels.find(panel=>panel.id===id),updates=new Map([[id,{...next}]]);
 if(source?.viewportLinked)for(const panel of panels)if(panel.id!==id&&panel.viewportLinked)updates.set(panel.id,sharedViewport(next));
 return updates;
}
export function linkedCursor(geometry,point){
 if(!geometry||point.x<geometry.left||point.x>geometry.right||point.y<geometry.top||point.y>geometry.bottom)return null;
 const time=geometry.xTime(point.x),domain=geometry.spotDomain;
 const spot=geometry.priceAxisVisible!==false&&domain?.every(finite)&&domain[1]>domain[0]?domain[0]+(geometry.bottom-point.y)/(geometry.bottom-geometry.top)*(domain[1]-domain[0]):null;
 return finite(time)?{time,spot}:null;
}
export function projectCursor(geometry,cursor){
 if(!geometry||!cursor||!finite(cursor.time)||cursor.time<geometry.startTime||cursor.time>geometry.endTime)return null;
 const x=geometry.timeX(cursor.time),y=geometry.priceAxisVisible!==false&&finite(cursor.spot)?geometry.spotY(cursor.spot):null;
 return {time:cursor.time,x,...(finite(y)&&y>=geometry.top&&y<=geometry.bottom?{y}:{})};
}
