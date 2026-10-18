import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
// Original market-data tree-map camera, source 0j3p3hcgafh1-.js UTF16
// 2353900–2360500 and slider wiring2378100–2378650. No source bundle execution.
export const MARKET_MAP_SLIDER_MAX=999;
export const MARKET_MAP_CAMERA_IDENTITY=Object.freeze({zoomX:1,zoomY:1,offsetX:0,offsetY:0});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function marketMapMaxZoom(rectangles) {
  let minimum=Infinity;
  for(const rectangle of rectangles??[])
    if(rectangle.width>0&&rectangle.height>0)
      minimum=Math.min(minimum,rectangle.width,rectangle.height);
  return Number.isFinite(minimum)?Math.min(100000,Math.max(50,128/minimum)):50;
}

export function clampMarketMapCamera(camera,width,height,maxZoom=50) {
  const zoomX=clamp(camera.zoomX,1,maxZoom),zoomY=clamp(camera.zoomY,1,maxZoom);
  return {zoomX,zoomY,offsetX:Math.max(width*(1-zoomX),Math.min(0,camera.offsetX)),
    offsetY:Math.max(height*(1-zoomY),Math.min(0,camera.offsetY))};
}

export function wheelMarketMapCamera(camera,{x,y,deltaY,width,height,maxZoom=50}) {
  // Return unhandled at full outward extent: home infinite plane owns that wheel.
  if(deltaY>0&&camera.zoomX<=1&&camera.zoomY<=1)
    return {camera:{...camera},handled:false};
  const factor=deltaY<0?1.2:1/1.2;
  const zoomX=clamp(camera.zoomX*factor,1,maxZoom),zoomY=clamp(camera.zoomY*factor,1,maxZoom);
  return {camera:clampMarketMapCamera({zoomX,zoomY,
    offsetX:x-(x-camera.offsetX)/camera.zoomX*zoomX,
    offsetY:y-(y-camera.offsetY)/camera.zoomY*zoomY},width,height,maxZoom),handled:true};
}

export function panMarketMapCamera(camera,dx,dy,width,height,maxZoom=50) {
  return clampMarketMapCamera({...camera,offsetX:camera.offsetX+dx,offsetY:camera.offsetY+dy},width,height,maxZoom);
}

export function marketMapCameraWindows(camera,width,height) {
  if(width<=0||height<=0)return null;
  const horizontalStart=-camera.offsetX/(camera.zoomX*width)*MARKET_MAP_SLIDER_MAX;
  const verticalStart=-camera.offsetY/(camera.zoomY*height)*MARKET_MAP_SLIDER_MAX;
  return {
    horizontal:{start:horizontalStart,end:horizontalStart+MARKET_MAP_SLIDER_MAX/camera.zoomX},
    vertical:{start:verticalStart,end:verticalStart+MARKET_MAP_SLIDER_MAX/camera.zoomY}
  };
}

// Window values are fractional source-slider indices 0..999, not percentages.
// Tree-map vertical navigator uses TOP=start and BOTTOM=end (not inverted).
export function applyMarketMapWindow(camera,axis,window,width,height,maxZoom=50) {
  const start=window.start/MARKET_MAP_SLIDER_MAX,end=(window.end??MARKET_MAP_SLIDER_MAX)/MARKET_MAP_SLIDER_MAX;
  const scale=clamp(1/Math.max(end-start,1e-6),1,maxZoom);
  const updated=axis==='horizontal'?{...camera,zoomX:scale,offsetX:-start*width*scale}
    :{...camera,zoomY:scale,offsetY:-start*height*scale};
  return clampMarketMapCamera(updated,width,height,maxZoom);
}

export function marketMapWorldPoint(camera,x,y) {
  return {x:(x-camera.offsetX)/camera.zoomX,y:(y-camera.offsetY)/camera.zoomY};
}
