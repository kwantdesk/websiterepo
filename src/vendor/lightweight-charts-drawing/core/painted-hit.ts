import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IDrawing, Point, Viewport } from './types';
import { paintedHitContext, pointHitsPaintedShape } from '@/lib/drawingPaintedHit';

/** Ask each actual pane painter for its strokes, including custom curves,
 * level styles, labels and visible handles. Decorative bands never grab. */
export function drawingPaintedHitShapes(drawing: IDrawing, viewport: Viewport) {
  const collector=paintedHitContext(/position|arrow|mark|flag|pin|profile|text|note|label|signpost|callout|table/.test(drawing.type));
  const scope={context:collector.context,horizontalPixelRatio:1,verticalPixelRatio:1,
    bitmapSize:{width:viewport.width,height:viewport.height},mediaSize:{width:viewport.width,height:viewport.height}};
  const target={useBitmapCoordinateSpace:(callback:(scope:unknown)=>void)=>callback(scope),useMediaCoordinateSpace:(callback:(scope:unknown)=>void)=>callback(scope)} as unknown as CanvasRenderingTarget2D;
  for(const pane of drawing.paneViews())pane.renderer()?.draw(target);
  return collector.shapes;
}
export function hitTestDrawingPaint(drawing:IDrawing,point:Point,viewport:Viewport) {
  if(drawing.options.visible===false||point.x<0||point.y<0||point.x>viewport.width||point.y>viewport.height)return false;
  return drawingPaintedHitShapes(drawing,viewport).some(shape=>pointHitsPaintedShape(point,shape));
}
