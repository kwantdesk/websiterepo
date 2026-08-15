import type { IPrimitivePaneView, ISeriesPrimitiveAxisView } from 'lightweight-charts';

import { Drawing } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { formatPrice } from '../../rendering/canvas-utils';
import { HorizontalLinePaneView } from './horizontal-line-pane-view';

/**
 * HorizontalLine options
 */
export interface HorizontalLineOptions extends DrawingOptions {
  showPrice?: boolean;
  showLabel?: boolean;
  labelText?: string;
}

/**
 * HorizontalLine - A horizontal line at a specific price level.
 *
 * Features:
 * - Single anchor point (price level)
 * - Extends across entire viewport
 * - Optional price label
 * - Optional custom label text
 */
export class HorizontalLine extends Drawing {
  readonly type = 'horizontal-line';

  protected static readonly REQUIRED_ANCHORS = 1;
  protected static readonly HIT_THRESHOLD = 5;

  private _horizontalLineOptions: HorizontalLineOptions;
  private readonly _priceAxisView: ISeriesPrimitiveAxisView;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<HorizontalLineOptions> = {}
  ) {
    const { showPrice, showLabel, labelText, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._horizontalLineOptions = {
      ...this._options,
      showPrice: showPrice ?? true,
      showLabel: showLabel ?? false,
      labelText: labelText ?? '',
    };
    this._priceAxisView = {
      coordinate: () => -1_000_000,
      fixedCoordinate: () => this.priceAxisCoordinate() ?? undefined,
      text: () => this._horizontalLineOptions.labelText || formatPrice(this._anchors[0]?.price ?? 0),
      textColor: () => contrastingTextColor(this._style.lineColor),
      backColor: () => this._style.lineColor,
      visible: () => this._options.visible !== false && this.isValid() && this.priceAxisCoordinate() !== null,
      tickVisible: () => true,
    };
  }

  get horizontalLineOptions(): HorizontalLineOptions {
    return this._horizontalLineOptions;
  }

  setHorizontalLineOptions(options: Partial<HorizontalLineOptions>): void {
    this._horizontalLineOptions = { ...this._horizontalLineOptions, ...options };
    this.requestUpdate();
  }

  isValid(): boolean {
    return this._anchors.length >= HorizontalLine.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new HorizontalLinePaneView(this)];
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this._horizontalLineOptions.showPrice ? [this._priceAxisView] : [];
  }

  private priceAxisCoordinate(): number | null {
    if (!this._series || !this.isValid()) return null;
    return this._series.priceToCoordinate(this._anchors[0].price);
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    if (!this.isValid()) return [];

    const anchor = this._anchors[0];
    const y = viewport.priceScale.priceToCoordinate(anchor.price);
    if (y === null) return [];

    const geometries: Geometry[] = [];

    // Horizontal line spanning viewport
    const lineGeometry: LineGeometry = {
      type: 'line',
      start: { x: 0, y },
      end: { x: viewport.width, y },
    };
    geometries.push(lineGeometry);

    return geometries;
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid()) return false;

    const anchor = this._anchors[0];
    const y = viewport.priceScale.priceToCoordinate(anchor.price);
    if (y === null) return false;

    return Math.abs(point.y - y) <= HorizontalLine.HIT_THRESHOLD;
  }

  clone(newId: string): IDrawing {
    return new HorizontalLine(
      newId,
      [...this._anchors],
      { ...this._style },
      { ...this._horizontalLineOptions }
    );
  }

  static create(
    id: string,
    price: number,
    time: number | string,
    style?: Partial<DrawingStyle>,
    options?: Partial<HorizontalLineOptions>
  ): HorizontalLine {
    return new HorizontalLine(id, [{ time: time as any, price }], style, options);
  }
}

function contrastingTextColor(color: string): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return '#ffffff';
  const luminance = (0.2126 * Number.parseInt(match[1], 16))
    + (0.7152 * Number.parseInt(match[2], 16))
    + (0.0722 * Number.parseInt(match[3], 16));
  return luminance > 155 ? '#050505' : '#ffffff';
}
