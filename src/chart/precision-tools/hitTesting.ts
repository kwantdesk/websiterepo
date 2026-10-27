import type { PrecisionChartAdapter, PrecisionHit, PrecisionObject, PrecisionScreenPoint } from "./types";
import { objectScreenAnchors, shapeHandles, tradeCalculatorResizeHandles } from "./screenGeometry";
export { objectScreenAnchors, shapeHandles, tradeCalculatorResizeHandles } from "./screenGeometry";
import { precisionPaintedHitShapes } from "./renderer";
import { DRAWING_HANDLE_HIT_RADIUS, DRAWING_HIT_SLOP, pointHitsPaintedShape } from "@/lib/drawingPaintedHit";

export function hitTestObjects(objects: PrecisionObject[], point: PrecisionScreenPoint, adapter: PrecisionChartAdapter,
  tolerance = DRAWING_HIT_SLOP, selectedIds: readonly string[] = []): PrecisionHit | null {
  if (point.x < 0 || point.y < 0 || point.x > adapter.width-adapter.priceScaleWidth || point.y > adapter.height-adapter.timeScaleHeight) return null;
  for (const object of [...objects].sort((a,b)=>b.zIndex-a.zIndex)) {
    if (!object.visibility.visible || object.style.opacity <= 0
      || (object.visibility.timeframes.length && !object.visibility.timeframes.includes(adapter.timeframe))
      || (object.visibility.minZoom != null && adapter.pixelsPerBar < object.visibility.minZoom)
      || (object.visibility.maxZoom != null && adapter.pixelsPerBar > object.visibility.maxZoom)) continue;
    const anchors = objectScreenAnchors(object,adapter);
    if (selectedIds.includes(object.id)) {
      const calculator = object.toolId === "precision-buy-calculator" || object.toolId === "precision-sell-calculator";
      const shape = object.toolId === "precision-rectangle" || object.toolId === "precision-ellipse";
      const handles = calculator ? tradeCalculatorResizeHandles(anchors) : shape && anchors.length >= 2
        ? shapeHandles(anchors[0],anchors[1]) : [];
      for (let i=0;i<handles.length;i++) {
        const distance=Math.hypot(point.x-handles[i].x,point.y-handles[i].y);
        if(distance<=DRAWING_HANDLE_HIT_RADIUS)return {objectId:object.id,kind:"resize",handleIndex:i,distance};
      }
      for(let i=0;i<anchors.length;i++) {
        const distance=Math.hypot(point.x-anchors[i].x,point.y-anchors[i].y);
        if(distance<=DRAWING_HANDLE_HIT_RADIUS)return {objectId:object.id,kind:"anchor",handleIndex:i,distance};
      }
    }
    if(precisionPaintedHitShapes(object,adapter,selectedIds.includes(object.id)).some(shape=>pointHitsPaintedShape(point,shape,Math.min(DRAWING_HIT_SLOP,tolerance))))return {objectId:object.id,kind:"body",distance:0};
  }
  return null;
}
