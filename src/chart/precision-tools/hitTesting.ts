import { distanceToSegment } from "./math";
import type { PrecisionChartAdapter, PrecisionHit, PrecisionObject, PrecisionScreenPoint } from "./types";

export function objectScreenAnchors(object: PrecisionObject, adapter: PrecisionChartAdapter): PrecisionScreenPoint[] {
  return object.anchors.map((anchor) => ({ x: adapter.timeToX(anchor.time, anchor.logicalIndex) ?? NaN, y: adapter.priceToY(anchor.price) ?? NaN })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function hitTestObjects(objects: PrecisionObject[], point: PrecisionScreenPoint, adapter: PrecisionChartAdapter, tolerance = 8): PrecisionHit | null {
  const candidates = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  for (const object of candidates) {
    if (!object.visibility.visible) continue;
    const anchors = objectScreenAnchors(object, adapter);
    for (let index = 0; index < anchors.length; index += 1) {
      const distance = Math.hypot(point.x - anchors[index].x, point.y - anchors[index].y);
      if (distance <= tolerance + 2) return { objectId: object.id, kind: "anchor", handleIndex: index, distance };
    }
    if (object.toolId === "precision-horizontal-line" && anchors[0]) {
      const distance = Math.abs(point.y - anchors[0].y);
      if (distance <= tolerance) return { objectId: object.id, kind: "body", distance };
    }
    if (object.toolId === "precision-vertical-line" && anchors[0]) {
      const distance = Math.abs(point.x - anchors[0].x);
      if (distance <= tolerance) return { objectId: object.id, kind: "body", distance };
    }
    if ((object.toolId === "precision-rectangle" || object.toolId === "precision-ellipse") && anchors.length >= 2) {
      const left = Math.min(anchors[0].x, anchors[1].x), right = Math.max(anchors[0].x, anchors[1].x), top = Math.min(anchors[0].y, anchors[1].y), bottom = Math.max(anchors[0].y, anchors[1].y);
      const handles = [{ x: left, y: top }, { x: (left + right) / 2, y: top }, { x: right, y: top }, { x: right, y: (top + bottom) / 2 }, { x: right, y: bottom }, { x: (left + right) / 2, y: bottom }, { x: left, y: bottom }, { x: left, y: (top + bottom) / 2 }];
      for (let index = 0; index < handles.length; index += 1) {
        const distance = Math.hypot(point.x - handles[index].x, point.y - handles[index].y);
        if (distance <= tolerance + 2) return { objectId: object.id, kind: "resize", handleIndex: index, distance };
      }
      if (point.x >= left - tolerance && point.x <= right + tolerance && point.y >= top - tolerance && point.y <= bottom + tolerance) return { objectId: object.id, kind: "body", distance: 0 };
    }
    if ((object.toolId === "precision-buy-calculator" || object.toolId === "precision-sell-calculator") && anchors.length >= 3) {
      const left = Math.min(...anchors.map((anchor) => anchor.x));
      const right = Math.max(...anchors.map((anchor) => anchor.x));
      const top = Math.min(...anchors.map((anchor) => anchor.y));
      const bottom = Math.max(...anchors.map((anchor) => anchor.y));
      if (point.x >= left - tolerance && point.x <= right + tolerance && point.y >= top - tolerance && point.y <= bottom + tolerance) {
        return { objectId: object.id, kind: "body", distance: 0 };
      }
    }
    if (object.path?.length) {
      const path = object.path.map((anchor) => ({ x: adapter.timeToX(anchor.time, anchor.logicalIndex) ?? NaN, y: adapter.priceToY(anchor.price) ?? NaN })).filter((candidate) => Number.isFinite(candidate.x) && Number.isFinite(candidate.y));
      for (let index = 1; index < path.length; index += 1) {
        const distance = distanceToSegment(point, path[index - 1], path[index]);
        if (distance <= tolerance) return { objectId: object.id, kind: "body", distance };
      }
    }
    for (let index = 1; index < anchors.length; index += 1) {
      const distance = distanceToSegment(point, anchors[index - 1], anchors[index]);
      if (distance <= tolerance) return { objectId: object.id, kind: "body", distance };
    }
  }
  return null;
}
