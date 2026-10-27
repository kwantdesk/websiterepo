import type { Point, Viewport } from './types';
import { drawingTextWidth, ellipseHitShape, pointHitsPaintedShape, rectangleHitShape } from '@/lib/drawingPaintedHit';
import { siteCanvasFont } from '../../../lib/siteFont';

/**
 * Line geometry with optional extensions
 */
export interface LineGeometry {
  type: 'line';
  start: Point;
  end: Point;
  extendLeft?: boolean;
  extendRight?: boolean;
  strokeColor?: string;
  opacity?: number;
  lineWidth?: number;
  lineDash?: number[];
}

/**
 * Arc/circle geometry
 */
export interface ArcGeometry {
  type: 'arc';
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise?: boolean;
}

/**
 * Rectangle geometry
 */
export interface RectangleGeometry {
  type: 'rectangle';
  topLeft: Point;
  width: number;
  height: number;
  rotation?: number;
  borderRadius?: number;
  fillColor?: string;
  strokeColor?: string;
  opacity?: number;
  lineWidth?: number;
}

/**
 * Polygon geometry (closed or open path)
 */
export interface PolygonGeometry {
  type: 'polygon';
  points: Point[];
  closed: boolean;
}

/**
 * Text geometry
 */
export interface TextGeometry {
  type: 'text';
  position: Point;
  text: string;
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  rotation?: number;
}

/**
 * Union of all geometry types
 */
export type Geometry =
  | LineGeometry
  | ArcGeometry
  | RectangleGeometry
  | PolygonGeometry
  | TextGeometry;

/** Hit only painted strokes and actual label bounds, never anchor boxes. */
export function hitTestGeometry(point: Point, geometry: Geometry, tolerance = 2,
  viewport?: Pick<Viewport, 'width' | 'height'>, baseWidth = 1): boolean {
  const slop = Math.max(0, Math.min(2, tolerance));
  if (geometry.type === 'line') {
    if (geometry.opacity === 0 || geometry.strokeColor === 'transparent') return false;
    const ends = viewport && (geometry.extendLeft || geometry.extendRight)
      ? extendLineToViewport(geometry.start, geometry.end, viewport.width, viewport.height, !!geometry.extendLeft, !!geometry.extendRight)
      : geometry;
    return pointHitsPaintedShape(point, {points:[ends.start,ends.end],width:geometry.lineWidth ?? baseWidth,dash:geometry.lineDash}, slop);
  }
  if (geometry.type === 'arc') {
    return pointHitsPaintedShape(point, ellipseHitShape(geometry.center.x, geometry.center.y,
      geometry.radius,geometry.radius,0,geometry.startAngle,geometry.endAngle,geometry.counterClockwise,baseWidth),slop);
  }
  if (geometry.type === 'polygon') {
    return pointHitsPaintedShape(point,{points:geometry.points,closed:geometry.closed,width:baseWidth},slop);
  }
  if (geometry.type === 'rectangle') {
    if (geometry.opacity === 0 || (geometry.fillColor && !geometry.strokeColor) || geometry.strokeColor === 'transparent') return false;
    const center={x:geometry.topLeft.x+geometry.width/2,y:geometry.topLeft.y+geometry.height/2};
    const local=geometry.rotation?rotatePoint(point,center,-geometry.rotation):point;
    const left=Math.min(geometry.topLeft.x,geometry.topLeft.x+geometry.width),top=Math.min(geometry.topLeft.y,geometry.topLeft.y+geometry.height);
    const width=Math.abs(geometry.width),height=Math.abs(geometry.height),radius=Math.min(Math.max(0,geometry.borderRadius??0),width/2,height/2);
    if (!radius) return pointHitsPaintedShape(local,rectangleHitShape(left,top,width,height,geometry.lineWidth??baseWidth),slop);
    const qx=Math.abs(local.x-center.x)-(width/2-radius),qy=Math.abs(local.y-center.y)-(height/2-radius);
    const distance=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;
    return Math.abs(distance)<=slop+(geometry.lineWidth??baseWidth)/2;
  }
  if (geometry.color === 'transparent' || !geometry.text) return false;
  const font=siteCanvasFont(geometry.font),size=Number(font.match(/([\d.]+)px/)?.[1])||12;
  const width=drawingTextWidth(geometry.text,font);
  const left=geometry.align==='right'||geometry.align==='end'?-width:geometry.align==='center'?-width/2:0;
  const top=geometry.baseline==='middle'?-size/2:geometry.baseline==='top'||geometry.baseline==='hanging'?0: -size;
  const local=geometry.rotation?rotatePoint(point,geometry.position,-geometry.rotation):point;
  return pointHitsPaintedShape({x:local.x-geometry.position.x,y:local.y-geometry.position.y},rectangleHitShape(left,top,width,size,0,true),0);
}
export function hitTestGeometries(point: Point, geometries: Geometry[], tolerance = 2,
  viewport?: Pick<Viewport, 'width' | 'height'>, baseWidth = 1): boolean {
  return geometries.some(geometry=>hitTestGeometry(point,geometry,tolerance,viewport,baseWidth));
}

/**
 * Calculate distance from point to line segment
 */
export function distanceToLineSegment(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line segment is a point
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }

  // Project point onto line, clamping to segment
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projectionX = lineStart.x + t * dx;
  const projectionY = lineStart.y + t * dy;
  const px = point.x - projectionX;
  const py = point.y - projectionY;

  return Math.sqrt(px * px + py * py);
}

/**
 * Calculate distance from point to infinite line
 */
export function distanceToLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }

  // Distance using cross product
  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  const denominator = Math.sqrt(lengthSquared);

  return numerator / denominator;
}

/**
 * Calculate distance between two points
 */
export function distanceBetweenPoints(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if point is within distance of another point
 */
export function isPointNear(p1: Point, p2: Point, threshold: number): boolean {
  return distanceBetweenPoints(p1, p2) <= threshold;
}

/**
 * Extend line to viewport boundaries
 */
export function extendLineToViewport(
  start: Point,
  end: Point,
  viewportWidth: number,
  viewportHeight: number,
  extendLeft: boolean,
  extendRight: boolean
): { start: Point; end: Point } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  let newStart = { ...start };
  let newEnd = { ...end };

  if (dx === 0) {
    // Vertical line
    if (extendLeft) newStart = { x: start.x, y: 0 };
    if (extendRight) newEnd = { x: end.x, y: viewportHeight };
    return { start: newStart, end: newEnd };
  }

  const slope = dy / dx;
  const intercept = start.y - slope * start.x;

  if (extendLeft) {
    // Extend towards x = 0 or viewport boundaries
    const yAtX0 = intercept;
    if (yAtX0 >= 0 && yAtX0 <= viewportHeight) {
      newStart = { x: 0, y: yAtX0 };
    } else if (yAtX0 < 0) {
      newStart = { x: -intercept / slope, y: 0 };
    } else {
      newStart = { x: (viewportHeight - intercept) / slope, y: viewportHeight };
    }
  }

  if (extendRight) {
    // Extend towards x = viewportWidth or viewport boundaries
    const yAtXMax = slope * viewportWidth + intercept;
    if (yAtXMax >= 0 && yAtXMax <= viewportHeight) {
      newEnd = { x: viewportWidth, y: yAtXMax };
    } else if (yAtXMax < 0) {
      newEnd = { x: -intercept / slope, y: 0 };
    } else {
      newEnd = { x: (viewportHeight - intercept) / slope, y: viewportHeight };
    }
  }

  return { start: newStart, end: newEnd };
}

/**
 * Resolve the horizontal span of an axis-aligned drawing that may extend to
 * either visible pane edge.
 *
 * Extension is screen geometry, not a mutation of the drawing's time anchors:
 * panning/zooming therefore keeps the rectangle flush with the current pane,
 * while switching the option off restores the exact two points the trader
 * placed. The primitive pane is already clipped before the price scale, so
 * `viewportWidth` is the content edge and never the outer application edge.
 */
export function extendHorizontalBoundsToViewport(
  firstX: number,
  secondX: number,
  viewportWidth: number,
  extendLeft: boolean,
  extendRight: boolean,
): { left: number; right: number } {
  const width = Math.max(0, Number.isFinite(viewportWidth) ? viewportWidth : 0);
  const anchorLeft = Math.min(firstX, secondX);
  const anchorRight = Math.max(firstX, secondX);
  return {
    left: extendLeft ? 0 : anchorLeft,
    right: extendRight ? width : anchorRight,
  };
}

/**
 * Get angle of line in radians
 */
export function getLineAngle(start: Point, end: Point): number {
  return Math.atan2(end.y - start.y, end.x - start.x);
}

/**
 * Get angle of line in degrees
 */
export function getLineAngleDegrees(start: Point, end: Point): number {
  return getLineAngle(start, end) * (180 / Math.PI);
}

/**
 * Rotate point around center
 */
export function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/**
 * Calculate midpoint between two points
 */
export function midpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Linear interpolation between two points
 */
export function lerp(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}
