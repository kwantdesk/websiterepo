import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  MouseEventParams,
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
export class DrawingManager {
  private _drawings: Map<string, IDrawing> = new Map();
  private _selectedId: string | null = null;
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
  private _dragOriginalAnchors: Array<{ time: number; price: number }> = [];

  constructor() {
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleClick = this.handleClick.bind(this);
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
    container.addEventListener('mousemove', this.handleMouseMove);
    container.addEventListener('mouseup', this.handleMouseUp);
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
      this._container.removeEventListener('mousemove', this.handleMouseMove);
      this._container.removeEventListener('mouseup', this.handleMouseUp);
    }

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

    // Deselect if selected
    if (this._selectedId === id) {
      this.deselectAll();
    }

    // Detach from chart
    drawing.detach();

    this._drawings.delete(id);
    this.emit('drawing:removed', { drawingId: id });
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
    this.emit('drawing:cleared', {});
  }

  // ============ Selection ============

  /**
   * Select a drawing by id
   */
  selectDrawing(id: string): void {
    const drawing = this._drawings.get(id);
    if (!drawing) return;

    // Deselect current
    if (this._selectedId && this._selectedId !== id) {
      const current = this._drawings.get(this._selectedId);
      if (current) {
        current.setState('normal');
      }
    }

    drawing.setState('selected');
    this._selectedId = id;
    this.emit('drawing:selected', { drawingId: id, drawing });
  }

  /**
   * Deselect all drawings
   */
  deselectAll(): void {
    if (this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      if (drawing) {
        drawing.setState('normal');
      }
      const id = this._selectedId;
      this._selectedId = null;
      this.emit('drawing:deselected', { drawingId: id });
    }
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
      if (drawing.testHit(point, viewport)) {
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
    if (!params.point) return;

    const point: Point = { x: params.point.x, y: params.point.y };

    // If no active tool, try to select a drawing
    if (!this._activeTool) {
      const hitDrawing = this.hitTest(point);
      if (hitDrawing) {
        this.selectDrawing(hitDrawing.id);
      } else {
        this.deselectAll();
      }
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    if (this._activeTool) return;
    const point = this.getPointFromEvent(event);
    if (!point) return;

    // Check for anchor hit on selected drawing
    if (this._selectedId) {
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
    this.selectDrawing(hitDrawing.id);
    if (hitDrawing.options.locked) return;

    const viewport = this.getViewport();
    const time = viewport?.timeScale.coordinateToTime(point.x);
    const price = viewport?.priceScale.coordinateToPrice(point.y);
    if (typeof time !== 'number' || price == null || !Number.isFinite(price)) return;

    const numericAnchors = hitDrawing.anchors.flatMap((anchor) =>
      typeof anchor.time === 'number'
        ? [{ time: anchor.time, price: anchor.price }]
        : []
    );
    if (numericAnchors.length !== hitDrawing.anchors.length) return;

    this._isDragging = true;
    this._dragAnchorIndex = null;
    this._dragWholeDrawing = true;
    this._dragStartAnchor = { time, price };
    this._dragOriginalAnchors = numericAnchors;
    hitDrawing.setState('editing');
    event.preventDefault();
    event.stopPropagation();
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this._isDragging) return;
    if (!this._selectedId) return;

    const drawing = this._drawings.get(this._selectedId);
    if (!drawing) return;

    const point = this.getPointFromEvent(event);
    if (!point) return;

    const viewport = this.getViewport();
    if (!viewport) return;

    // Convert point to anchor
    const time = viewport.timeScale.coordinateToTime(point.x);
    const price = viewport.priceScale.coordinateToPrice(point.y);

    if (this._dragWholeDrawing && this._dragStartAnchor && typeof time === 'number' && price !== null) {
      const timeDelta = time - this._dragStartAnchor.time;
      const priceDelta = price - this._dragStartAnchor.price;
      this._dragOriginalAnchors.forEach((anchor, index) => {
        drawing.updateAnchor(index, {
          time: (anchor.time + timeDelta) as typeof time,
          price: anchor.price + priceDelta,
        });
      });
      this.emit('drawing:updated', { drawingId: drawing.id, drawing });
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._dragAnchorIndex !== null && time !== null && price !== null) {
      drawing.updateAnchor(this._dragAnchorIndex, { time, price });
      this.emit('drawing:updated', { drawingId: drawing.id, drawing });
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private handleMouseUp(_event: MouseEvent): void {
    if (this._isDragging && this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      if (drawing) {
        drawing.setState('selected');
      }
    }

    this._isDragging = false;
    this._dragAnchorIndex = null;
    this._dragWholeDrawing = false;
    this._dragStartAnchor = null;
    this._dragOriginalAnchors = [];
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
