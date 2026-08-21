import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  MouseEventParams,
  Time,
} from 'lightweight-charts';

import type {
  IDrawing,
  Point,
  Viewport,
  DrawingEvent,
  DrawingEventType,
  DrawingEventCallback,
  SerializedDrawing,
} from './types';
import { coordinateToNumericTime } from './coordinate-utils';
import { hitTestGeometries } from './geometry';

/**
 * DrawingManager - Central orchestration system for managing drawings.
 *
 * Responsibilities:
 * - Creating, storing, removing drawings
 * - Attaching/detaching to chart series
 * - Hit detection and selection
 * - Interaction state management
 * - JSON import/export
 * - Event emission
 */
/** Host magnet hook: maps a pane-pixel point to a snapped anchor, or null. */
export type AnchorSnapResolver = (point: Point) => { time: number; price: number } | null;

export class DrawingManager {
  private _drawings: Map<string, IDrawing> = new Map();
  private _selectedId: string | null = null;
  private _selectedIds: Set<string> = new Set();
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<SeriesType> | null = null;
  private _container: HTMLElement | null = null;
  private _listeners: Map<DrawingEventType, Set<DrawingEventCallback>> = new Map();
  private _isAttached: boolean = false;

  // Interaction state
  private _activeTool: string | null = null;
  private _isDragging: boolean = false;
  private _dragAnchorIndex: number | null = null;
  private _dragWholeDrawing: boolean = false;
  private _dragStartAnchor: { time: number; price: number } | null = null;
  private _dragOriginalAnchorsByDrawing: Map<string, Array<{ time: number; price: number }>> = new Map();
  private _isMarqueeSelecting: boolean = false;
  private _marqueeStart: Point | null = null;
  private _marqueeCurrent: Point | null = null;
  private _marqueeElement: HTMLDivElement | null = null;
  private _suppressNextClick: boolean = false;
  private _pendingDragPoint: Point | null = null;
  private _dragAnimationFrame: number | null = null;
  // Optional host-supplied magnet. The host owns candle data and the user's
  // magnet setting, so anchor snapping is injected rather than reimplemented
  // here. Returning null means "follow the raw pointer".
  private _anchorSnap: AnchorSnapResolver | null = null;

  constructor() {
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
  }

  // ============ Lifecycle ============

  /**
   * Attach manager to a chart and series
   */
  attach(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    container: HTMLElement
  ): void {
    if (this._isAttached) {
      this.detach();
    }

    this._chart = chart;
    this._series = series;
    this._container = container;
    this._isAttached = true;

    // Attach all existing drawings
    for (const drawing of this._drawings.values()) {
      drawing.attach(series, chart, this._container ?? undefined);
    }

    // Subscribe to chart events
    chart.subscribeClick(this.handleClick);

    // Add container event listeners for interaction
    // Capture before Lightweight Charts starts a pan gesture. A drawing body or
    // control point owns the gesture; empty chart space remains native chart UI.
    container.addEventListener('mousedown', this.handleMouseDown, true);
    // Capture on window so a fast pointer cannot outrun the chart container.
    // The handler is inert unless a drawing or marquee currently owns drag.
    window.addEventListener('mousemove', this.handleMouseMove, true);
    container.addEventListener('mouseup', this.handleMouseUp);
    container.addEventListener('dblclick', this.handleDoubleClick, true);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  /**
   * Detach manager from chart
   */
  detach(): void {
    if (!this._isAttached) return;

    // Detach all drawings
    for (const drawing of this._drawings.values()) {
      drawing.detach();
    }

    // Unsubscribe from chart events
    if (this._chart) {
      this._chart.unsubscribeClick(this.handleClick);
    }

    // Remove container event listeners
    if (this._container) {
      this._container.removeEventListener('mousedown', this.handleMouseDown, true);
      this._container.removeEventListener('mouseup', this.handleMouseUp);
      this._container.removeEventListener('dblclick', this.handleDoubleClick, true);
    }
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove, true);
    if (this._dragAnimationFrame !== null) window.cancelAnimationFrame(this._dragAnimationFrame);
    this._dragAnimationFrame = null;
    this._pendingDragPoint = null;
    this.removeMarqueeElement();

    this._chart = null;
    this._series = null;
    this._container = null;
    this._isAttached = false;
  }

  /**
   * Check if manager is attached
   */
  isAttached(): boolean {
    return this._isAttached;
  }

  // ============ Drawing Management ============

  /**
   * Add a drawing to the manager
   */
  addDrawing(drawing: IDrawing): void {
    if (this._drawings.has(drawing.id)) {
      console.warn(`Drawing with id ${drawing.id} already exists`);
      return;
    }

    this._drawings.set(drawing.id, drawing);

    // Attach to chart if manager is attached
    if (this._isAttached && this._series && this._chart) {
      drawing.attach(this._series, this._chart, this._container ?? undefined);
    }

    this.emit('drawing:added', { drawingId: drawing.id, drawing });
  }

  /**
   * Remove a drawing by id
   */
  removeDrawing(id: string): void {
    const drawing = this._drawings.get(id);
    if (!drawing) return;

    const wasSelected = this._selectedIds.delete(id);
    if (this._selectedId === id) this._selectedId = this._selectedIds.values().next().value ?? null;

    // Detach from chart
    drawing.detach();

    this._drawings.delete(id);
    this.emit('drawing:removed', { drawingId: id });
    if (wasSelected && this._selectedIds.size === 0) this.emit('drawing:deselected', { drawingId: id });
  }

  /**
   * Get a drawing by id
   */
  getDrawing(id: string): IDrawing | undefined {
    return this._drawings.get(id);
  }

  /**
   * Get all drawings
   */
  getAllDrawings(): IDrawing[] {
    return Array.from(this._drawings.values());
  }

  /**
   * Clear all drawings
   */
  clearAll(): void {
    for (const drawing of this._drawings.values()) {
      drawing.detach();
    }
    this._drawings.clear();
    this._selectedId = null;
    this._selectedIds.clear();
    this.emit('drawing:cleared', {});
  }

  // ============ Selection ============

  /**
   * Select a drawing by id
   */
  selectDrawing(id: string): void {
    const drawing = this._drawings.get(id);
    if (!drawing) return;

    for (const selectedId of this._selectedIds) {
      if (selectedId !== id) this._drawings.get(selectedId)?.setState('normal');
    }

    drawing.setState('selected');
    this._selectedId = id;
    this._selectedIds = new Set([id]);
    this.emit('drawing:selected', { drawingId: id, drawing });
  }

  /** Select several drawings as one movable and deleteable group. */
  selectDrawings(ids: string[]): void {
    const nextIds = new Set(ids.filter((id) => this._drawings.has(id)));
    for (const [id, drawing] of this._drawings) drawing.setState(nextIds.has(id) ? 'selected' : 'normal');
    this._selectedIds = nextIds;
    this._selectedId = ids.find((id) => nextIds.has(id)) ?? null;
    if (this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      this.emit('drawing:selected', { drawingId: this._selectedId, drawing });
    } else {
      this.emit('drawing:deselected', {});
    }
  }

  /**
   * Deselect all drawings
   */
  deselectAll(): void {
    if (this._selectedIds.size === 0 && !this._selectedId) return;
    const id = this._selectedId ?? undefined;
    for (const selectedId of this._selectedIds) this._drawings.get(selectedId)?.setState('normal');
    this._selectedIds.clear();
    this._selectedId = null;
    this.emit('drawing:deselected', { drawingId: id });
  }

  /**
   * Get selected drawing
   */
  getSelectedDrawing(): IDrawing | null {
    if (!this._selectedId) return null;
    return this._drawings.get(this._selectedId) || null;
  }

  // ============ Tool Management ============

  /**
   * Set the active drawing tool
   */
  /**
   * Install (or clear with null) the magnet used while dragging an anchor or a
   * whole drawing. `intent` lets the host apply velocity gating only to drags.
   */
  setAnchorSnapResolver(resolver: AnchorSnapResolver | null): void {
    this._anchorSnap = resolver;
  }

  setActiveTool(toolType: string | null): void {
    this._activeTool = toolType;
    this.emit('tool:changed', { toolType: toolType || undefined });
  }

  /**
   * Get the active drawing tool
   */
  getActiveTool(): string | null {
    return this._activeTool;
  }

  // ============ Hit Testing ============

  /**
   * Find drawing at point
   */
  hitTest(point: Point): IDrawing | null {
    const viewport = this.getViewport();
    if (!viewport) return null;

    // Test in reverse order (top to bottom)
    const drawings = Array.from(this._drawings.values()).reverse();

    for (const drawing of drawings) {
      if (!drawing.options.visible) continue;
      if (drawing.testHit(point, viewport) || hitTestGeometries(point, drawing.computeGeometry(viewport), 8)) {
        return drawing;
      }
    }

    return null;
  }

  /**
   * Find anchor at point for selected drawing
   */
  hitTestAnchor(point: Point): number | null {
    if (!this._selectedId) return null;

    const drawing = this._drawings.get(this._selectedId);
    if (!drawing) return null;

    const viewport = this.getViewport();
    if (!viewport) return null;

    return drawing.hitTestAnchor(point, viewport);
  }

  // ============ Event Handling ============

  private handleClick(params: MouseEventParams): void {
    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      return;
    }
    if (!params.point) return;

    const point: Point = { x: params.point.x, y: params.point.y };

    // If no active tool, try to select a drawing
    if (!this._activeTool) {
      const hitDrawing = this.hitTest(point);
      if (hitDrawing) {
        if (!this._selectedIds.has(hitDrawing.id)) this.selectDrawing(hitDrawing.id);
      } else {
        this.deselectAll();
      }
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    const point = this.getPointFromEvent(event);
    if (!point) return;

    if (event.ctrlKey && event.button === 0) {
      this._isMarqueeSelecting = true;
      this._marqueeStart = point;
      this._marqueeCurrent = point;
      this.deselectAll();
      this.updateMarqueeElement(point, point);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._activeTool) return;

    // Check for anchor hit on selected drawing
    if (this._selectedId && this._selectedIds.size === 1) {
      const anchorIndex = this.hitTestAnchor(point);
      if (anchorIndex !== null) {
        const drawing = this._drawings.get(this._selectedId);
        if (drawing && !drawing.options.locked) {
          this._isDragging = true;
          this._dragAnchorIndex = anchorIndex;
          this._dragWholeDrawing = false;
          drawing.setState('editing');
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
    }

    // The upstream template only moved control points. KwantDesk also treats
    // the body as a draggable object, matching professional charting tools.
    const hitDrawing = this.hitTest(point);
    if (!hitDrawing) return;
    if (!this._selectedIds.has(hitDrawing.id)) this.selectDrawing(hitDrawing.id);
    if (hitDrawing.options.locked) return;

    const viewport = this.getViewport();
    const time = viewport ? coordinateToNumericTime(viewport, point.x) : null;
    const price = viewport?.priceScale.coordinateToPrice(point.y);
    if (typeof time !== 'number' || price == null || !Number.isFinite(price)) return;

    const dragOriginalAnchors = new Map<string, Array<{ time: number; price: number }>>();
    for (const selected of this.getSelectedDrawings()) {
      if (selected.options.locked) continue;
      const numericAnchors = selected.anchors.flatMap((anchor) =>
        typeof anchor.time === 'number' ? [{ time: anchor.time, price: anchor.price }] : []
      );
      if (numericAnchors.length === selected.anchors.length) dragOriginalAnchors.set(selected.id, numericAnchors);
    }
    if (dragOriginalAnchors.size === 0) return;

    this._isDragging = true;
    this._dragAnchorIndex = null;
    this._dragWholeDrawing = true;
    this._dragStartAnchor = { time, price };
    this._dragOriginalAnchorsByDrawing = dragOriginalAnchors;
    for (const drawingId of dragOriginalAnchors.keys()) this._drawings.get(drawingId)?.setState('editing');
    if (this._selectedIds.size > 1) this._suppressNextClick = true;
    event.preventDefault();
    event.stopPropagation();
  }

  getSelectedDrawings(): IDrawing[] {
    return Array.from(this._selectedIds).flatMap((id) => {
      const drawing = this._drawings.get(id);
      return drawing ? [drawing] : [];
    });
  }

  private handleDoubleClick(event: MouseEvent): void {
    if (this._activeTool) return;
    const point = this.getPointFromEvent(event);
    if (!point) return;

    const drawing = this.hitTest(point);
    if (!drawing) return;

    this.selectDrawing(drawing.id);
    this.emit('drawing:double-clicked', { drawingId: drawing.id, drawing, point });
    event.preventDefault();
    event.stopPropagation();
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this._isMarqueeSelecting && this._marqueeStart) {
      const point = this.getPointFromEvent(event);
      if (!point) return;
      this._marqueeCurrent = point;
      this.updateMarqueeElement(this._marqueeStart, point);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!this._isDragging || !this._selectedId) return;
    const point = this.getPointFromEvent(event);
    if (!point) return;
    this._pendingDragPoint = point;
    if (this._dragAnimationFrame === null) {
      this._dragAnimationFrame = window.requestAnimationFrame(() => {
        this._dragAnimationFrame = null;
        const pending = this._pendingDragPoint;
        this._pendingDragPoint = null;
        if (pending) this.applyDragPoint(pending);
      });
    }
    event.preventDefault();
    event.stopPropagation();
  }

  private applyDragPoint(point: Point): void {
    if (!this._isDragging || !this._selectedId) return;
    const drawing = this._drawings.get(this._selectedId);
    if (!drawing) return;
    const viewport = this.getViewport();
    if (!viewport) return;

    // Lightweight Charts has no native time value in future whitespace. Use
    // logical-bar cadence so drawings remain draggable beyond the latest bar.
    const rawTime = coordinateToNumericTime(viewport, point.x);
    const rawPrice = viewport.priceScale.coordinateToPrice(point.y);
    // Magnet: a moving drag runs free and locks once the pointer slows near a
    // candle value, so an anchor can be placed precisely without the cursor
    // fighting it. The host resolver owns that policy.
    const snapped = this._anchorSnap ? this._anchorSnap(point) : null;
    const time = snapped ? snapped.time : rawTime;
    const price = snapped ? snapped.price : rawPrice;

    if (this._dragWholeDrawing && this._dragStartAnchor && typeof time === 'number' && price !== null) {
      const timeDelta = time - this._dragStartAnchor.time;
      const priceDelta = price - this._dragStartAnchor.price;
      for (const [drawingId, anchors] of this._dragOriginalAnchorsByDrawing) {
        const selectedDrawing = this._drawings.get(drawingId);
        if (!selectedDrawing) continue;
        anchors.forEach((anchor, index) => {
          selectedDrawing.updateAnchor(index, {
            time: (anchor.time + timeDelta) as Time,
            price: anchor.price + priceDelta,
          });
        });
      }
      this.emit('drawing:updated', { drawingId: drawing.id, drawing });
      return;
    }

    if (this._dragAnchorIndex !== null && time !== null && price !== null) {
      drawing.updateAnchor(this._dragAnchorIndex, { time: time as Time, price });
      this.emit('drawing:updated', { drawingId: drawing.id, drawing });
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (this._isMarqueeSelecting && this._marqueeStart) {
      const end = this.getPointFromEvent(event) ?? this._marqueeCurrent ?? this._marqueeStart;
      this.selectDrawingsInRectangle(this._marqueeStart, end);
      this._isMarqueeSelecting = false;
      this._marqueeStart = null;
      this._marqueeCurrent = null;
      this.hideMarqueeElement();
      this._suppressNextClick = true;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._isDragging) {
      if (this._dragAnimationFrame !== null) window.cancelAnimationFrame(this._dragAnimationFrame);
      this._dragAnimationFrame = null;
      const pending = this._pendingDragPoint;
      this._pendingDragPoint = null;
      if (pending) this.applyDragPoint(pending);
      for (const drawing of this.getSelectedDrawings()) drawing.setState('selected');
    }

    this._isDragging = false;
    this._dragAnchorIndex = null;
    this._dragWholeDrawing = false;
    this._dragStartAnchor = null;
    this._dragOriginalAnchorsByDrawing.clear();
  }

  private selectDrawingsInRectangle(start: Point, end: Point): void {
    const viewport = this.getViewport();
    if (!viewport) return;
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    const width = right - left;
    const height = bottom - top;
    if (width < 3 && height < 3) {
      this.deselectAll();
      return;
    }

    const selected: string[] = [];
    for (const drawing of this._drawings.values()) {
      if (drawing.options.visible === false || drawing.options.locked || drawing.id === '__kwantdesk_drawing_preview__') continue;
      const controlPoints = drawing.getControlPoints(viewport);
      const anchorInside = controlPoints.some((point) =>
        point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
      );
      const boundsIntersect = controlPoints.length > 1
        && Math.max(...controlPoints.map((point) => point.x)) >= left
        && Math.min(...controlPoints.map((point) => point.x)) <= right
        && Math.max(...controlPoints.map((point) => point.y)) >= top
        && Math.min(...controlPoints.map((point) => point.y)) <= bottom;
      let lineIntersects = false;
      if (!anchorInside && !boundsIntersect) {
        for (let xStep = 0; xStep <= 4 && !lineIntersects; xStep += 1) {
          for (let yStep = 0; yStep <= 4; yStep += 1) {
            if (drawing.testHit({
              x: left + (width * xStep) / 4,
              y: top + (height * yStep) / 4,
            }, viewport)) {
              lineIntersects = true;
              break;
            }
          }
        }
      }
      if (anchorInside || boundsIntersect || lineIntersects) selected.push(drawing.id);
    }
    this.selectDrawings(selected);
  }

  private updateMarqueeElement(start: Point, end: Point): void {
    if (!this._container) return;
    if (!this._marqueeElement) {
      const element = document.createElement('div');
      element.dataset.chartDrawingMarquee = 'true';
      element.style.position = 'absolute';
      element.style.zIndex = '25';
      element.style.pointerEvents = 'none';
      element.style.border = '1px solid var(--primary, #a855f7)';
      element.style.background = 'color-mix(in srgb, var(--primary, #a855f7) 14%, transparent)';
      element.style.boxShadow = 'inset 0 0 0 1px color-mix(in srgb, var(--primary, #a855f7) 18%, transparent)';
      this._container.appendChild(element);
      this._marqueeElement = element;
    }
    this._marqueeElement.style.display = 'block';
    this._marqueeElement.style.left = `${Math.min(start.x, end.x)}px`;
    this._marqueeElement.style.top = `${Math.min(start.y, end.y)}px`;
    this._marqueeElement.style.width = `${Math.abs(end.x - start.x)}px`;
    this._marqueeElement.style.height = `${Math.abs(end.y - start.y)}px`;
  }

  private hideMarqueeElement(): void {
    if (this._marqueeElement) this._marqueeElement.style.display = 'none';
  }

  private removeMarqueeElement(): void {
    this._marqueeElement?.remove();
    this._marqueeElement = null;
  }

  private getPointFromEvent(event: MouseEvent): Point | null {
    if (!this._container) return null;

    const rect = this._container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  // ============ Viewport ============

  private getViewport(): Viewport | null {
    if (!this._chart || !this._series) return null;

    const timeScale = this._chart.timeScale();
    // Get container height as fallback
    const height = this._container?.clientHeight ?? 400;

    return {
      width: timeScale.width(),
      height,
      timeScale: {
        coordinateToTime: (x: number) => timeScale.coordinateToTime(x),
        coordinateToLogical: (x: number) => timeScale.coordinateToLogical(x),
        timeToCoordinate: (time) => timeScale.timeToCoordinate(time),
        logicalToCoordinate: (logical) => timeScale.logicalToCoordinate(logical),
      },
      priceScale: {
        coordinateToPrice: (y: number) => this._series!.coordinateToPrice(y),
        priceToCoordinate: (price: number) => this._series!.priceToCoordinate(price),
      },
    };
  }

  // ============ Serialization ============

  /**
   * Export all drawings as JSON
   */
  exportDrawings(): SerializedDrawing[] {
    return this.getAllDrawings().map((d) => d.toJSON());
  }

  /**
   * Import drawings from JSON (requires a factory function)
   */
  importDrawings(
    data: SerializedDrawing[],
    factory: (type: string, data: SerializedDrawing) => IDrawing | null
  ): void {
    for (const item of data) {
      const drawing = factory(item.type, item);
      if (drawing) {
        this.addDrawing(drawing);
      }
    }
  }

  // ============ Events ============

  /**
   * Subscribe to an event
   */
  on(event: DrawingEventType, callback: DrawingEventCallback): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this._listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event
   */
  private emit(type: DrawingEventType, data: Partial<DrawingEvent>): void {
    const event: DrawingEvent = { type, ...data };
    const listeners = this._listeners.get(type);
    if (listeners) {
      for (const callback of listeners) {
        callback(event);
      }
    }
  }
}
