import type { IPrimitivePaneView, ISeriesPrimitiveAxisView, Time } from 'lightweight-charts';

import { Drawing } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { VerticalLinePaneView } from './vertical-line-pane-view';

/**
 * VerticalLine options
 */
export interface VerticalLineOptions extends DrawingOptions {
  showTime?: boolean;
  showLabel?: boolean;
  labelText?: string;
}

/**
 * VerticalLine - A vertical line at a specific time.
 *
 * Features:
 * - Single anchor point (time)
 * - Extends across entire viewport height
 * - Optional time label
 * - Optional custom label text
 */
export class VerticalLine extends Drawing {
  readonly type = 'vertical-line';

  protected static readonly REQUIRED_ANCHORS = 1;
  protected static readonly HIT_THRESHOLD = 5;

  private _verticalLineOptions: VerticalLineOptions;
  private readonly _timeAxisView: ISeriesPrimitiveAxisView;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<VerticalLineOptions> = {}
  ) {
    const { showTime, showLabel, labelText, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._verticalLineOptions = {
      ...this._options,
      showTime: showTime ?? true,
      showLabel: showLabel ?? false,
      labelText: labelText ?? '',
    };
    this._timeAxisView = {
      coordinate: () => -1_000_000,
      fixedCoordinate: () => this.timeAxisCoordinate() ?? undefined,
      text: () => this._verticalLineOptions.labelText || formatAxisTime(this._anchors[0]?.time),
      textColor: () => contrastingTextColor(this._style.lineColor),
      backColor: () => this._style.lineColor,
      visible: () => this._options.visible !== false && this.isValid() && this.timeAxisCoordinate() !== null,
      tickVisible: () => true,
    };
  }

  get verticalLineOptions(): VerticalLineOptions {
    return this._verticalLineOptions;
  }

  setVerticalLineOptions(options: Partial<VerticalLineOptions>): void {
    this._verticalLineOptions = { ...this._verticalLineOptions, ...options };
    this.requestUpdate();
  }

  isValid(): boolean {
    return this._anchors.length >= VerticalLine.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new VerticalLinePaneView(this)];
  }

  timeAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this._verticalLineOptions.showTime ? [this._timeAxisView] : [];
  }

  private timeAxisCoordinate(): number | null {
    if (!this._chart || !this.isValid()) return null;
    return this._chart.timeScale().timeToCoordinate(this._anchors[0].time);
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    if (!this.isValid()) return [];

    const anchor = this._anchors[0];
    const x = viewport.timeScale.timeToCoordinate(anchor.time);
    if (x === null) return [];

    const geometries: Geometry[] = [];

    // Vertical line spanning viewport
    const lineGeometry: LineGeometry = {
      type: 'line',
      start: { x, y: 0 },
      end: { x, y: viewport.height },
    };
    geometries.push(lineGeometry);

    return geometries;
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid()) return false;

    const anchor = this._anchors[0];
    const x = viewport.timeScale.timeToCoordinate(anchor.time);
    if (x === null) return false;

    return Math.abs(point.x - x) <= VerticalLine.HIT_THRESHOLD;
  }

  clone(newId: string): IDrawing {
    return new VerticalLine(
      newId,
      [...this._anchors],
      { ...this._style },
      { ...this._verticalLineOptions }
    );
  }

  static create(
    id: string,
    time: number | string,
    price: number,
    style?: Partial<DrawingStyle>,
    options?: Partial<VerticalLineOptions>
  ): VerticalLine {
    return new VerticalLine(id, [{ time: time as any, price }], style, options);
  }
}

function formatAxisTime(time: Time | undefined): string {
  if (typeof time === 'number') {
    const date = new Date(time * 1_000);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return date.getUTCSeconds() === 0 ? `${hours}:${minutes}` : `${hours}:${minutes}:${seconds}`;
  }
  if (time && typeof time === 'object' && 'year' in time) {
    return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
  }
  return String(time ?? '');
}

function contrastingTextColor(color: string): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return '#ffffff';
  const luminance = (0.2126 * Number.parseInt(match[1], 16))
    + (0.7152 * Number.parseInt(match[2], 16))
    + (0.0722 * Number.parseInt(match[3], 16));
  return luminance > 155 ? '#050505' : '#ffffff';
}
